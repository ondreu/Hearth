import { Component, Notice, setIcon, Setting, TFile } from "obsidian";
import {
	cardOverlayButton,
	emptyState,
	livePreviewSetting,
	redrawCard,
	renderEditableEmbed,
	renderLivePreviewEmbed,
	renderMarkdownFile,
} from "../cardbodies";
import { t } from "../i18n";
import {
	cachedPath,
	createJournalNote,
	forget,
	getJournalsApi,
	JOURNALS_PLUGIN_ID,
	type JournalInfo,
	listJournals,
	peekNote,
} from "../journals";
import { openFile } from "../opener";
import {
	createPeriodicNote,
	findPeriodicNote,
	getPeriodicNotesPlugin,
	GRANULARITIES,
	type Granularity,
	isGranularity,
	isGranularityEnabled,
	now,
	PERIODIC_NOTES_PLUGIN_ID,
	periodicNotePathFor,
} from "../periodic";
import { type DashboardCard, type PeriodicSource } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


/** The period a card with no explicit setting shows. Weekly is the reason the
 * card exists — a daily note already has a card of its own. */
const DEFAULT_GRANULARITY: Granularity = "week";

/** Where a card with no explicit setting gets its note. Periodic Notes, because
 * it was the card's only source before Journals (#318) and every card saved
 * before that release means it. */
const DEFAULT_SOURCE: PeriodicSource = "periodic-notes";

/** The plugin this card reads from. Validated rather than trusted, like every
 * persisted value here. */
function sourceOf(card: DashboardCard): PeriodicSource {
	return card.periodic?.source === "journals" ? "journals" : DEFAULT_SOURCE;
}

/** The period this card tracks. Validated rather than trusted: the value comes
 * from persisted data, which an imported layout or a hand-edited data.json can
 * have written anything into. */
function granularityOf(card: DashboardCard): Granularity {
	const granularity = card.periodic?.granularity;
	return isGranularity(granularity) ? granularity : DEFAULT_GRANULARITY;
}

/** The journal this card follows, or "" when none has been chosen yet. */
function journalOf(card: DashboardCard): string {
	const journal = card.periodic?.journal;
	return typeof journal === "string" ? journal.trim() : "";
}


// ---- The parts both sources share ---------------------------------------

/**
 * The "there is no note for this period yet" state, with the button that has
 * the owning plugin make one.
 *
 * Shared so the two sources can't drift on what an absent note looks like —
 * only on who is asked to write it.
 */
function createPrompt(
	body: HTMLElement,
	text: string,
	label: string,
	onCreate: () => void,
): void {
	const empty = body.createDiv("hearth-card-empty");
	setIcon(empty.createDiv("hearth-card-empty-icon"), "calendar-plus");
	empty.createDiv({ cls: "hearth-card-empty-text", text });
	const create = empty.createEl("button", { cls: "hearth-periodic-create", text: label });
	create.addEventListener("click", onCreate);
}

/**
 * Draw the note itself: the optional open button, then the embed in whichever
 * of the three modes the card is set to. Identical for both sources — by the
 * time we are here the note is just a file.
 */
function renderNote(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
	file: TFile,
	openLabel: string,
): void {
	// Optional button to open the note in the editor (hideable), floated over
	// the card so it takes no part in the body's scroll or flow.
	if (card.showOpenButton !== false) {
		cardOverlayButton(body, "square-pen", openLabel, () => {
			void openFile(view, file, "card");
		});
	}

	if (card.editable) {
		if (card.livePreview && renderLivePreviewEmbed(view, file, body, component)) return;
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	void renderMarkdownFile(view, file, host, component);
}


// ---- Periodic Notes -----------------------------------------------------

/**
 * Embed the current periodic note — this week's, this month's, this quarter's
 * or this year's — resolved fresh on every render so the card rolls over on its
 * own when the period ends (issue #116).
 *
 * Everything about *where* that note lives, and what a new one contains, is
 * Periodic Notes'. The card only asks it two questions ("is there a note for
 * now?", "please make one") and renders the answer with the same embed
 * machinery every other file-backed card uses.
 */
function renderFromPeriodicNotes(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const granularity = granularityOf(card);

	if (!getPeriodicNotesPlugin(view.app)) {
		emptyState(body, "plug-zap", t().cards.empty.periodicInstall);
		return;
	}
	if (!isGranularityEnabled(view.app, granularity)) {
		emptyState(
			body,
			"calendar-days",
			t().cards.periodic.notEnabled(t().editors.periodic.granularities[granularity]),
		);
		return;
	}

	const period = t().cards.periodic.period[granularity];
	const file = findPeriodicNote(view.app, granularity, now());

	if (!file) {
		createPrompt(
			body,
			t().cards.periodic.noNoteYet(period),
			t().cards.periodic.create(period),
			() => {
				void (async () => {
					// Periodic Notes writes the note, with its own template: Hearth
					// never invents one (see src/periodic.ts).
					const made = await createPeriodicNote(view.app, granularity, now());
					if (!made.ran) {
						new Notice(t().notices.couldNotOpenPeriodic);
						return;
					}
					// 1.0 hands the file back without opening it, so Hearth opens it
					// the way it opens everything else (#106) and redraws the card
					// itself — the file-watch below can't see a note whose path the
					// card couldn't work out. 0.x's command opened it already, and
					// the watch picks the creation up.
					if (made.file) {
						void openFile(view, made.file, "card");
						redrawCard(body);
					}
				})();
			},
		);
		return;
	}

	renderNote(view, card, body, component, file, t().cards.periodic.open(period));
}


// ---- Journals -----------------------------------------------------------

/**
 * Embed the current note of one journal from the Journals plugin (issue #318).
 *
 * The shape is the same as the Periodic Notes branch above — is there a note
 * for now, else offer to make one — with two differences that come from the
 * plugin rather than from Hearth:
 *
 * - **The card names a journal, not a period.** A vault can hold several
 *   journals of one cadence, and the journal itself knows what period it
 *   writes, so there is nothing for Hearth to choose.
 * - **The lookup is asynchronous**, and this render is not. So the path comes
 *   from the cache in `src/journals.ts`, which answers instantly with what it
 *   last learned and redraws the card when a newer answer lands. Whether the
 *   *file* is there is still read from the vault on every render, so a note
 *   created or deleted behind Hearth's back shows immediately.
 */
function renderFromJournals(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	if (!getJournalsApi(view.app)) {
		emptyState(body, "plug-zap", t().cards.empty.journalsInstall);
		return;
	}

	const journal = journalOf(card);
	if (!journal) {
		emptyState(body, "notebook-pen", t().cards.periodic.pickJournal);
		return;
	}

	const lookup = peekNote(view.app, journal, () => redrawCard(body));
	if (!lookup) {
		// First ask for this journal today: the answer is on its way.
		emptyState(body, "notebook-pen", t().cards.periodic.loading);
		return;
	}
	if (lookup.unknownJournal) {
		emptyState(body, "notebook-pen", t().cards.periodic.noSuchJournal(journal));
		return;
	}

	const file = lookup.path ? view.app.vault.getAbstractFileByPath(lookup.path) : null;
	if (!(file instanceof TFile)) {
		createPrompt(
			body,
			t().cards.periodic.noJournalNoteYet(journal),
			t().cards.periodic.createJournalNote,
			() => {
				void (async () => {
					// Journals writes the note, applying its own template and asking
					// its own creation prompts; it does not open what it creates.
					const made = await createJournalNote(view.app, journal);
					if (!made) {
						new Notice(t().notices.couldNotCreateJournalNote);
						return;
					}
					void openFile(view, made, "card");
					redrawCard(body);
				})();
			},
		);
		return;
	}

	renderNote(view, card, body, component, file, t().cards.periodic.openJournalNote(journal));
}


/** The current note of the card's chosen source, embedded live. */
export function renderPeriodic(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	if (sourceOf(card) === "journals") renderFromJournals(view, card, body, component);
	else renderFromPeriodicNotes(view, card, body, component);
}


// ---- Editor -------------------------------------------------------------

/**
 * The journal dropdown, filled from Journals itself.
 *
 * Built empty and populated when the plugin answers, because listing journals
 * is async and `renderEditor` is not. The card's saved journal is offered even
 * while the list is loading (and even when it is gone from the vault), so
 * opening the settings of a card can never silently clear what it follows.
 */
function journalSetting(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const chosen = journalOf(card);

	new Setting(containerEl)
		.setName(t().editors.periodic.journal)
		.setDesc(t().editors.periodic.journalDesc)
		.addDropdown((d) => {
			const fill = (journals: readonly JournalInfo[]): void => {
				const names = journals.map((j) => j.name);
				if (chosen && !names.includes(chosen)) names.unshift(chosen);
				if (names.length === 0) {
					d.addOption("", t().editors.periodic.noJournals);
				} else {
					d.addOption("", t().editors.periodic.chooseJournal);
					for (const name of names) d.addOption(name, name);
				}
				d.setValue(chosen);
			};

			fill([]);
			void listJournals(ctx.app).then((journals) => {
				if (!d.selectEl.isConnected || journals.length === 0) return;
				d.selectEl.empty();
				fill(journals);
			});

			d.onChange((v) => {
				// The old journal's cached note is of no further use, and the new
				// one must not be answered from an entry that predates the change.
				if (chosen) forget(chosen);
				card.periodic = { ...card.periodic, journal: v || undefined };
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
}

export function periodicEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const labels = t().editors.periodic.granularities;
	const source = sourceOf(card);

	new Setting(containerEl)
		.setName(t().editors.periodic.source)
		.setDesc(t().editors.periodic.sourceDesc)
		.addDropdown((d) => {
			d.addOption("periodic-notes", t().editors.periodic.sources.periodicNotes);
			d.addOption("journals", t().editors.periodic.sources.journals);
			d.setValue(source).onChange((v) => {
				card.periodic = { ...card.periodic, source: v as PeriodicSource };
				ctx.opts.save();
				// The rest of this tab differs per source, so the modal is rebuilt
				// rather than only the board.
				ctx.requestRender();
				ctx.opts.rerender();
			});
		});

	if (source === "journals") {
		journalSetting(ctx, containerEl);
	} else {
		new Setting(containerEl)
			.setName(t().editors.periodic.granularity)
			.setDesc(t().editors.periodic.granularityDesc)
			.addDropdown((d) => {
				for (const granularity of GRANULARITIES) d.addOption(granularity, labels[granularity]);
				d.setValue(granularityOf(card)).onChange((v) => {
					card.periodic = { ...card.periodic, granularity: v as Granularity };
					ctx.opts.save();
					ctx.opts.rerender();
				});
			});
	}

	new Setting(containerEl)
		.setName(t().editors.periodic.editable)
		.setDesc(t().editors.periodic.editableDesc)
		.addToggle((tg) =>
			tg.setValue(card.editable ?? false).onChange((v) => {
				card.editable = v || undefined;
				ctx.opts.save();
				// The live-preview choice below only exists while editing is on.
				ctx.requestRender();
			}),
		);
	if (card.editable) livePreviewSetting(ctx, containerEl, card);

	new Setting(containerEl)
		.setName(t().editors.periodic.openButton)
		.setDesc(t().editors.periodic.openButtonDesc)
		.addToggle((tg) =>
			tg.setValue(card.showOpenButton !== false).onChange((v) => {
				card.showOpenButton = v ? undefined : false;
				ctx.opts.save();
			}),
		);

	// Says the same thing the card's own empty state does, so the dependency is
	// discoverable from the settings modal too (see src/cards/README.md).
	const strings = t().editors.periodic;
	if (source === "journals") {
		new Setting(containerEl)
			.setName(strings.journalsInfo)
			.setDesc(getJournalsApi(ctx.app) ? strings.journalsInfoDesc : strings.journalsMissingDesc);
	} else {
		new Setting(containerEl)
			.setName(strings.info)
			.setDesc(getPeriodicNotesPlugin(ctx.app) ? strings.infoDesc : strings.missingDesc);
	}
}


/** The current week's, month's, quarter's or year's note from Periodic Notes —
 * or one journal's current note from Journals — embedded live. */
export const periodicCard: CardDefinition<"periodic"> = {
	kind: "periodic",
	templates: [
		{
			id: "periodic",
			name: "Periodic note",
			icon: "calendar-range",
			build: () => ({ kind: "periodic", periodic: { granularity: DEFAULT_GRANULARITY }, w: 6, h: 4 }),
			requires: {
				name: "Periodic Notes",
				pluginId: PERIODIC_NOTES_PLUGIN_ID,
				satisfied: (app) => getPeriodicNotesPlugin(app) !== null,
			},
		},
		{
			id: "journal",
			name: "Journal note",
			icon: "notebook-pen",
			// No journal yet: which one is the card's only real setting, and the
			// list of them belongs to a plugin that may not be installed. The card
			// says so, and the editor's dropdown fills itself.
			build: () => ({ kind: "periodic", periodic: { source: "journals" }, w: 6, h: 4 }),
			requires: {
				name: "Journals",
				pluginId: JOURNALS_PLUGIN_ID,
				satisfied: (app) => getJournalsApi(app) !== null,
			},
		},
	],
	render: (view, card, body, component) => renderPeriodic(view, card, body, component),
	renderEditor: (container, ctx) => periodicEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.periodic) copy.periodic = { ...source.periodic };
	},
	liveness: {
		mode: "watch-file",
		// The note the card actually shows, falling back to where it *would* be
		// so creating it redraws the card (see the create buttons above). On
		// Journals both come from the same cached path, which is read here
		// without asking the plugin again — see `cachedPath`.
		watchedPath: (view, card) => {
			if (sourceOf(card) === "journals") {
				const journal = journalOf(card);
				return journal ? cachedPath(journal) : null;
			}
			const granularity = granularityOf(card);
			const file = findPeriodicNote(view.app, granularity, now());
			return file?.path ?? periodicNotePathFor(view.app, granularity, now());
		},
		editableInPlace: (card) => !!card.editable,
	},
};
