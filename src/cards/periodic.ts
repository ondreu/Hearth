import { Component, Notice, setIcon, Setting } from "obsidian";
import {
	cardOverlayButton,
	emptyState,
	livePreviewSetting,
	renderEditableEmbed,
	renderLivePreviewEmbed,
	renderMarkdownFile,
} from "../cardbodies";
import { t } from "../i18n";
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
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


/** The period a card with no explicit setting shows. Weekly is the reason the
 * card exists — a daily note already has a card of its own. */
const DEFAULT_GRANULARITY: Granularity = "week";

/** The period this card tracks. Validated rather than trusted: the value comes
 * from persisted data, which an imported layout or a hand-edited data.json can
 * have written anything into. */
function granularityOf(card: DashboardCard): Granularity {
	const granularity = card.periodic?.granularity;
	return isGranularity(granularity) ? granularity : DEFAULT_GRANULARITY;
}


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
export function renderPeriodic(
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
		const empty = body.createDiv("hearth-card-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "calendar-plus");
		empty.createDiv({
			cls: "hearth-card-empty-text",
			text: t().cards.periodic.noNoteYet(period),
		});
		const create = empty.createEl("button", {
			cls: "hearth-periodic-create",
			text: t().cards.periodic.create(period),
		});
		create.addEventListener("click", () => {
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
					body.empty();
					renderPeriodic(view, card, body, component);
				}
			})();
		});
		return;
	}

	// Optional button to open the note in the editor (hideable), floated over
	// the card so it takes no part in the body's scroll or flow.
	if (card.showOpenButton !== false) {
		cardOverlayButton(body, "square-pen", t().cards.periodic.open(period), () => {
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


export function periodicEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const labels = t().editors.periodic.granularities;

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
	new Setting(containerEl)
		.setName(t().editors.periodic.info)
		.setDesc(
			getPeriodicNotesPlugin(ctx.app)
				? t().editors.periodic.infoDesc
				: t().editors.periodic.missingDesc,
		);
}


/** The current week's, month's, quarter's or year's note from Periodic Notes,
 * embedded live. */
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
	],
	render: (view, card, body, component) => renderPeriodic(view, card, body, component),
	renderEditor: (container, ctx) => periodicEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.periodic) copy.periodic = { ...source.periodic };
	},
	liveness: {
		mode: "watch-file",
		// The note the card actually shows, falling back to where it *would* be
		// so creating it redraws the card (see renderPeriodic's create button).
		watchedPath: (view, card) => {
			const granularity = granularityOf(card);
			const file = findPeriodicNote(view.app, granularity, now());
			return file?.path ?? periodicNotePathFor(view.app, granularity, now());
		},
		editableInPlace: (card) => !!card.editable,
	},
};
