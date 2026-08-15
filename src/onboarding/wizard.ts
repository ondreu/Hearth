/**
 * The first-run setup wizard.
 *
 * A new Hearth install used to drop the user straight onto a five-card starter
 * board with a wallpaper they didn't choose and no indication that the plugin
 * can read their tasks, their calendar or their git repository. Everything was
 * configurable; nothing was offered. This asks instead — a handful of questions
 * about how the vault is used and what it already has installed — and builds
 * the board from the answers.
 *
 * This module is the *asking*. What the answers mean lives in `plan.ts`, and
 * what the vault has lives in `detect.ts`, both of which are pure and tested;
 * a step here does nothing but read and write one field of {@link SetupAnswers}
 * and then redraw.
 *
 * ⚠️ #52 naming hazard: members here share a prototype chain with Obsidian's
 * `Modal`, whose undocumented internals aren't in the typings, so a colliding
 * method name compiles cleanly and silently replaces engine behaviour. Every
 * member below is named unmistakably (`renderWizard`, not `render`).
 */
import { Modal, Notice, Setting, setIcon } from "obsidian";
import { t } from "../i18n";
import type HearthPlugin from "../main";
import { configuredPlaces, renderSkySource } from "../placepicker";
import { formatSkyValue, parseSkyValue } from "../sky";
import { makeClickable } from "../ui";
import type { OpenIn } from "../types";
import { OPEN_IN_MODES } from "../types";
import { detectSetup, type DetectedIntegration, type SetupDetection } from "./detect";
import {
	applySetup,
	defaultAnswers,
	isUntouchedStarterBoard,
	planCards,
	PURPOSE_ICONS,
	SETUP_BACKGROUNDS,
	SETUP_PURPOSES,
	SETUP_SURFACES,
	type PlannedCard,
	type SetupAnswers,
	type SetupBackground,
	type SetupPurpose,
	type SetupSurface,
} from "./plan";

/** The wizard's steps, in order. `integrations` is dropped when the vault has
 * none to offer, so nobody is walked through an empty page. */
type SetupStepId =
	| "welcome"
	| "vault"
	| "look"
	| "purpose"
	| "integrations"
	| "behaviour"
	| "finish";

/** The Lucide icon shown beside each step on the progress rail. */
const STEP_ICONS: Record<SetupStepId, string> = {
	welcome: "flame",
	vault: "book-open",
	look: "palette",
	purpose: "compass",
	integrations: "plug",
	behaviour: "settings-2",
	finish: "check",
};

/** Grid columns the finish step's board preview is drawn against — the same
 * width `planCards` lays out to. */
const PREVIEW_COLUMNS = 12;

/** How a particular run of the wizard behaves. */
export interface SetupWizardOptions {
	/**
	 * Force the built board onto a *new* dashboard, with no option to replace
	 * an existing one.
	 *
	 * Set for every entry point except the first-run prompt. Re-running the
	 * wizard from settings is something people do to explore — "what would it
	 * build if I said I plan in here?" — and an exploration that can overwrite a
	 * board somebody spent an evening arranging is a trap, however clearly the
	 * dropdown is labelled. So the destructive option simply isn't offered:
	 * every existing dashboard is left exactly as it is, and the result arrives
	 * as one more board in the switcher.
	 */
	forceNewDashboard?: boolean;
}

export class SetupWizardModal extends Modal {
	private readonly plugin: HearthPlugin;
	private readonly detection: SetupDetection;
	private readonly options: SetupWizardOptions;
	private answers: SetupAnswers;
	private stepIndex = 0;
	/** True once the board has been built, so closing the modal afterwards
	 * doesn't record the run as skipped. */
	private finished = false;
	/** Scratch space for the weather background's place picker, which keeps its
	 * query and last results across the in-place redraws its own buttons
	 * trigger. Dropped with the modal. */
	private readonly placeSession: Record<string, unknown> = {};

	constructor(plugin: HearthPlugin, options: SetupWizardOptions = {}) {
		super(plugin.app);
		this.plugin = plugin;
		this.options = options;
		this.detection = detectSetup(plugin.app);
		this.answers = defaultAnswers(plugin.settings, this.detection);
		// Replacing the board is right on a fresh install and wrong on a re-run
		// over a board somebody has arranged; decide from what is actually there
		// rather than making the user think about it. A forced run never replaces
		// anything regardless.
		this.answers.target =
			!options.forceNewDashboard && isUntouchedStarterBoard(plugin.settings)
				? "replace"
				: "new";
		// A second board wants a name that isn't already taken, so the switcher
		// doesn't end up with two identically-labelled entries.
		this.answers.dashboardName = this.freeDashboardName();
	}

	/** "Home", or "Home 2", "Home 3"… when the vault already has one. */
	private freeDashboardName(): string {
		const base = t().setup.finish.defaultName;
		const taken = new Set(this.plugin.settings.dashboards.map((d) => d.name));
		if (!taken.has(base)) return base;
		for (let n = 2; n < 100; n++) {
			const candidate = `${base} ${n}`;
			if (!taken.has(candidate)) return candidate;
		}
		return base;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-setup-modal");
		this.renderWizard();
	}

	onClose(): void {
		// Dismissing the wizard is an answer too: record it, or a fresh install
		// would be greeted by it again on every single load.
		if (!this.finished && this.plugin.settings.setupStatus === "pending") {
			this.plugin.settings.setupStatus = "skipped";
			void this.plugin.saveData(this.plugin.settings);
		}
		this.contentEl.empty();
	}

	// ---- Shell ---------------------------------------------------------

	/** The steps this run actually has. */
	private wizardSteps(): SetupStepId[] {
		const steps: SetupStepId[] = ["welcome", "vault", "look", "purpose"];
		if (this.detection.integrations.length > 0) steps.push("integrations");
		steps.push("behaviour", "finish");
		return steps;
	}

	private currentStep(): SetupStepId {
		const steps = this.wizardSteps();
		return steps[Math.min(this.stepIndex, steps.length - 1)];
	}

	/** Build (or rebuild) the whole modal. Called on every answer that changes
	 * what the rest of the step shows, and on every navigation. */
	private renderWizard(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("hearth-setup");

		const steps = this.wizardSteps();
		const step = this.currentStep();
		const strings = t().setup;

		this.renderRail(contentEl, steps, step);

		const head = contentEl.createDiv("hearth-setup-head");
		head.createDiv({ cls: "hearth-setup-title", text: strings.stepTitles[step] });
		head.createDiv({ cls: "hearth-setup-subtitle", text: strings.stepDescs[step] });

		const body = contentEl.createDiv("hearth-setup-body");
		// Per-step backstop, the #52 lesson: a throw while building one step
		// shows an inline message instead of a blank modal, and the footer below
		// still lets the user move on or leave.
		try {
			this.renderStepBody(body, step);
		} catch (err) {
			console.error(`Hearth: the "${step}" setup step failed to render`, err);
			body.empty();
			const box = body.createDiv("hearth-settings-error");
			setIcon(box.createSpan("hearth-settings-error-icon"), "alert-triangle");
			const text = box.createDiv("hearth-settings-error-text");
			text.createDiv({
				cls: "hearth-settings-error-title",
				text: t().settings.sectionError(strings.stepTitles[step]),
			});
			text.createDiv({
				cls: "hearth-settings-error-hint",
				text: t().settings.sectionErrorHint,
			});
		}

		this.renderFooter(contentEl.createDiv("hearth-setup-foot"), steps);
	}

	/** The progress rail: one pill per step, showing where the user is and how
	 * much is left. Completed steps are clickable so going back is one press
	 * rather than several. */
	private renderRail(
		parent: HTMLElement,
		steps: SetupStepId[],
		active: SetupStepId,
	): void {
		const strings = t().setup;
		const rail = parent.createDiv("hearth-setup-rail");
		const activeIndex = steps.indexOf(active);
		steps.forEach((step, index) => {
			const pill = rail.createDiv("hearth-setup-rail-step");
			pill.toggleClass("is-active", index === activeIndex);
			pill.toggleClass("is-done", index < activeIndex);
			setIcon(
				pill.createSpan("hearth-setup-rail-icon"),
				index < activeIndex ? "check" : STEP_ICONS[step],
			);
			pill.createSpan({ cls: "hearth-setup-rail-label", text: strings.stepNames[step] });
			if (index < activeIndex) {
				const go = () => {
					this.stepIndex = index;
					this.renderWizard();
				};
				makeClickable(pill, go, strings.stepNames[step]);
				pill.addEventListener("click", go);
			}
		});
	}

	/** Back / Next / Finish, plus the escape hatch on the first step. */
	private renderFooter(footer: HTMLElement, steps: SetupStepId[]): void {
		const strings = t().setup;
		const last = this.stepIndex >= steps.length - 1;

		const left = footer.createDiv("hearth-setup-foot-left");
		if (this.stepIndex === 0) {
			const skip = left.createEl("button", {
				cls: "hearth-setup-skip",
				text: strings.nav.skip,
			});
			skip.addEventListener("click", () => this.close());
		}

		const right = footer.createDiv("hearth-setup-foot-right");
		if (this.stepIndex > 0) {
			const back = right.createEl("button", { text: strings.nav.back });
			back.addEventListener("click", () => {
				this.stepIndex = Math.max(0, this.stepIndex - 1);
				this.renderWizard();
			});
		}
		const next = right.createEl("button", {
			cls: "mod-cta",
			text: last ? strings.nav.finish : strings.nav.next,
		});
		next.addEventListener("click", () => {
			if (last) {
				void this.finishSetup();
				return;
			}
			this.stepIndex = Math.min(steps.length - 1, this.stepIndex + 1);
			this.renderWizard();
		});
	}

	// ---- Steps ---------------------------------------------------------

	private renderStepBody(body: HTMLElement, step: SetupStepId): void {
		switch (step) {
			case "welcome":
				this.renderWelcomeStep(body);
				break;
			case "vault":
				this.renderVaultStep(body);
				break;
			case "look":
				this.renderLookStep(body);
				break;
			case "purpose":
				this.renderPurposeStep(body);
				break;
			case "integrations":
				this.renderIntegrationsStep(body);
				break;
			case "behaviour":
				this.renderBehaviourStep(body);
				break;
			case "finish":
				this.renderFinishStep(body);
				break;
		}
	}

	private renderWelcomeStep(body: HTMLElement): void {
		const strings = t().setup.welcome;
		body.createEl("p", { cls: "hearth-setup-lead", text: strings.lead });

		const list = body.createDiv("hearth-setup-bullets");
		for (const bullet of strings.bullets) {
			const row = list.createDiv("hearth-setup-bullet");
			setIcon(row.createSpan("hearth-setup-bullet-icon"), bullet.icon);
			const text = row.createDiv("hearth-setup-bullet-text");
			text.createDiv({ cls: "hearth-setup-bullet-title", text: bullet.title });
			text.createDiv({ cls: "hearth-setup-bullet-desc", text: bullet.desc });
		}

		const found = this.detection.integrations;
		body.createDiv({
			cls: "hearth-setup-note",
			text: found.length
				? strings.detected(found.map((i) => i.name).join(", "))
				: strings.detectedNone,
		});
	}

	private renderVaultStep(body: HTMLElement): void {
		const strings = t().setup.vault;
		const a = this.answers;

		new Setting(body)
			.setName(strings.title)
			.setDesc(strings.titleDesc)
			.addText((text) =>
				text
					.setPlaceholder(this.detection.vaultName || "Obsidian")
					.setValue(a.title)
					.onChange((v) => {
						a.title = v;
					}),
			);

		new Setting(body)
			.setName(strings.showTitle)
			.setDesc(strings.showTitleDesc)
			.addToggle((tg) =>
				tg.setValue(a.showTitle).onChange((v) => {
					a.showTitle = v;
				}),
			);

		new Setting(body)
			.setName(strings.logo)
			.setDesc(strings.logoDesc)
			.addText((text) =>
				text
					.setPlaceholder("🔥")
					.setValue(a.logo)
					.onChange((v) => {
						a.logo = v;
					}),
			);

		new Setting(body)
			.setName(strings.themeColor)
			.setDesc(strings.themeColorDesc)
			.addDropdown((d) => {
				const labels = t().setup.vault.themeColorOptions;
				d.addOption("none", labels.none);
				d.addOption("icon", labels.icon);
				d.addOption("title", labels.title);
				d.addOption("both", labels.both);
				d.setValue(a.themeColorTarget).onChange((v) => {
					a.themeColorTarget = v as SetupAnswers["themeColorTarget"];
				});
			});

		new Setting(body)
			.setName(strings.showSearch)
			.setDesc(strings.showSearchDesc)
			.addToggle((tg) =>
				tg.setValue(a.showSearch).onChange((v) => {
					a.showSearch = v;
				}),
			);
	}

	private renderLookStep(body: HTMLElement): void {
		const strings = t().setup.look;
		const a = this.answers;

		body.createDiv({ cls: "hearth-setup-grouplabel", text: strings.surfaceHeading });
		this.optionGrid(
			body,
			SETUP_SURFACES,
			(surface: SetupSurface) => ({
				icon: t().setup.surfaces[surface].icon,
				name: t().setup.surfaces[surface].name,
				desc: t().setup.surfaces[surface].desc,
				selected: a.surface === surface,
			}),
			(surface) => {
				a.surface = surface;
				this.renderWizard();
			},
		);

		body.createDiv({ cls: "hearth-setup-grouplabel", text: strings.backgroundHeading });
		this.optionGrid(
			body,
			SETUP_BACKGROUNDS,
			(background: SetupBackground) => ({
				icon: t().setup.backgrounds[background].icon,
				name: t().setup.backgrounds[background].name,
				desc: t().setup.backgrounds[background].desc,
				selected: a.background === background,
			}),
			(background) => {
				a.background = background;
				this.renderWizard();
			},
		);

		if (a.background === "color") {
			new Setting(body).setName(strings.color).setDesc(strings.colorDesc).addColorPicker((c) =>
				c.setValue(a.backgroundColor).onChange((v) => {
					a.backgroundColor = v;
				}),
			);
		}

		if (a.background === "weather") {
			const sky = parseSkyValue(a.skyValue);
			body.createDiv({ cls: "hearth-setup-note", text: strings.weatherDesc });
			renderSkySource(body, {
				current: sky,
				onChange: (next) => {
					a.skyValue = next ? formatSkyValue(next) : "";
				},
				rerender: () => this.renderWizard(),
				disabled: this.plugin.settings.disableExternalCalls,
				session: this.placeSession,
				suggestions: configuredPlaces(this.plugin.settings),
			});
		}

		if (a.background !== "none") {
			new Setting(body)
				.setName(strings.layout)
				.setDesc(strings.layoutDesc)
				.addDropdown((d) => {
					d.addOption("full", strings.layoutFull);
					d.addOption("banner", strings.layoutBanner);
					d.setValue(a.backgroundLayout).onChange((v) => {
						a.backgroundLayout = v as SetupAnswers["backgroundLayout"];
					});
				});
		}

		new Setting(body)
			.setName(strings.compact)
			.setDesc(strings.compactDesc)
			.addToggle((tg) =>
				tg.setValue(a.compact).onChange((v) => {
					a.compact = v;
				}),
			);
	}

	private renderPurposeStep(body: HTMLElement): void {
		const a = this.answers;
		this.optionGrid(
			body,
			SETUP_PURPOSES,
			(purpose: SetupPurpose) => ({
				icon: PURPOSE_ICONS[purpose],
				name: t().setup.purposes[purpose].name,
				desc: t().setup.purposes[purpose].desc,
				selected: a.purposes.includes(purpose),
			}),
			(purpose) => {
				a.purposes = a.purposes.includes(purpose)
					? a.purposes.filter((p) => p !== purpose)
					: [...a.purposes, purpose];
				this.renderWizard();
			},
			"is-multi",
		);

		const count = planCards(a, this.detection, (i) => `preview-${i}`).length;
		body.createDiv({ cls: "hearth-setup-note", text: t().setup.purpose.count(count) });
	}

	private renderIntegrationsStep(body: HTMLElement): void {
		const strings = t().setup.integrations;
		const a = this.answers;

		body.createDiv({ cls: "hearth-setup-note", text: strings.lead });

		for (const found of this.detection.integrations) {
			const setting = new Setting(body)
				.setName(found.name)
				.setDesc(this.integrationEffect(found))
				.addToggle((tg) =>
					tg.setValue(a.integrations.includes(found.id)).onChange((v) => {
						a.integrations = v
							? [...a.integrations, found.id]
							: a.integrations.filter((id) => id !== found.id);
						// The Tasks card's configuration and the plan's card count
						// both hinge on this, so redraw rather than let the summary
						// go stale.
						this.renderWizard();
					}),
				);
			setting.settingEl.addClass("hearth-setup-integration");
			if (found.recommended) {
				setting.nameEl.createSpan({
					cls: "hearth-setup-badge",
					text: strings.recommended,
				});
			}
		}

		// The one detection worth spelling out: a TaskNotes vault that renamed
		// its fields is exactly the vault where a Tasks card would otherwise come
		// up empty, so say what was read rather than merely that something was.
		const taskNotes = this.detection.taskNotes;
		if (taskNotes && a.integrations.includes("tasknotes")) {
			const box = body.createDiv("hearth-setup-detected");
			box.createDiv({ cls: "hearth-setup-detected-title", text: strings.taskNotesTitle });
			const fields = box.createDiv("hearth-setup-detected-list");
			const row = (label: string, value: string): void => {
				const line = fields.createDiv("hearth-setup-detected-row");
				line.createSpan({ cls: "hearth-setup-detected-key", text: label });
				line.createSpan({ cls: "hearth-setup-detected-value", text: value });
			};
			row(strings.taskNotesStatus, taskNotes.fields.status);
			row(strings.taskNotesDue, taskNotes.fields.due);
			row(strings.taskNotesPriority, taskNotes.fields.priority);
			const done = taskNotes.statuses.filter((s) => s.isCompleted).map((s) => s.label);
			row(strings.taskNotesDone, done.length ? done.join(", ") : strings.taskNotesDoneNone);
		}
	}

	/** What accepting an integration will actually do, in one line. */
	private integrationEffect(found: DetectedIntegration): string {
		const effects = t().setup.integrations.effects;
		return effects[found.id];
	}

	private renderBehaviourStep(body: HTMLElement): void {
		const strings = t().setup.behaviour;
		const a = this.answers;

		new Setting(body)
			.setName(strings.openOnStartup)
			.setDesc(strings.openOnStartupDesc)
			.addToggle((tg) =>
				tg.setValue(a.openOnStartup).onChange((v) => {
					a.openOnStartup = v;
				}),
			);

		new Setting(body)
			.setName(strings.replaceNewTabs)
			.setDesc(strings.replaceNewTabsDesc)
			.addToggle((tg) =>
				tg.setValue(a.replaceNewTabs).onChange((v) => {
					a.replaceNewTabs = v;
				}),
			);

		new Setting(body)
			.setName(strings.focusSearch)
			.setDesc(strings.focusSearchDesc)
			.addToggle((tg) =>
				tg.setValue(a.focusSearchOnOpen).onChange((v) => {
					a.focusSearchOnOpen = v;
				}),
			);

		new Setting(body)
			.setName(strings.openIn)
			.setDesc(strings.openInDesc)
			.addDropdown((d) => {
				const labels = t().settings.behaviour.openInModes;
				for (const mode of OPEN_IN_MODES) d.addOption(mode, labels[mode]);
				d.setValue(a.openIn).onChange((v) => {
					a.openIn = v as OpenIn;
				});
			});
	}

	private renderFinishStep(body: HTMLElement): void {
		const strings = t().setup.finish;
		const a = this.answers;
		const planned = planCards(a, this.detection, (i) => `preview-${i}`);

		if (planned.length === 0) {
			body.createDiv({ cls: "hearth-setup-note", text: strings.empty });
		} else {
			this.renderBoardPreview(body, planned);
			const list = body.createDiv("hearth-setup-plan");
			for (const entry of planned) {
				const row = list.createDiv("hearth-setup-plan-row");
				row.createSpan({ cls: "hearth-setup-plan-name", text: plannedName(entry) });
				row.createSpan({ cls: "hearth-setup-plan-why", text: plannedReason(entry) });
			}
		}

		if (this.options.forceNewDashboard) {
			// No dropdown at all: an option that is never selectable is noise, and
			// stating the guarantee outright is the reassurance this run needs.
			body.createDiv({ cls: "hearth-setup-note is-safe", text: strings.targetForcedNew });
		} else {
			new Setting(body)
				.setName(strings.target)
				.setDesc(strings.targetDesc)
				.addDropdown((d) => {
					d.addOption("replace", strings.targetReplace);
					d.addOption("new", strings.targetNew);
					d.setValue(a.target).onChange((v) => {
						a.target = v as SetupAnswers["target"];
					});
				});
		}

		new Setting(body)
			.setName(strings.name)
			.setDesc(strings.nameDesc)
			.addText((text) =>
				text
					.setPlaceholder("Home")
					.setValue(a.dashboardName)
					.onChange((v) => {
						a.dashboardName = v;
					}),
			);

		body.createDiv({ cls: "hearth-setup-note", text: strings.reassurance });
	}

	/**
	 * A scale drawing of the board about to be built: the planned cards in their
	 * packed positions, labelled.
	 *
	 * Worth the few lines it costs. "Clock, Today, Tasks, Recent…" as a list says
	 * nothing about whether the result will look like a home screen; the same
	 * information as boxes says it immediately.
	 */
	private renderBoardPreview(body: HTMLElement, planned: PlannedCard[]): void {
		const rows = planned.reduce((max, p) => Math.max(max, p.card.y + p.card.h), 0);
		const preview = body.createDiv("hearth-setup-preview");
		preview.style.gridTemplateColumns = `repeat(${PREVIEW_COLUMNS}, 1fr)`;
		preview.style.gridTemplateRows = `repeat(${Math.max(1, rows)}, 1fr)`;
		for (const entry of planned) {
			const cell = preview.createDiv("hearth-setup-preview-card");
			cell.style.gridColumn = `${entry.card.x + 1} / span ${entry.card.w}`;
			cell.style.gridRow = `${entry.card.y + 1} / span ${entry.card.h}`;
			cell.createSpan({ cls: "hearth-setup-preview-label", text: plannedName(entry) });
		}
	}

	// ---- Option tiles --------------------------------------------------

	/**
	 * A grid of selectable tiles — the wizard's main input.
	 *
	 * Deliberately not a dropdown or a row of toggles: every choice the wizard
	 * asks about is one where the *description* is the question. "Frosted" means
	 * nothing on its own and everything next to "translucent cards over the
	 * wallpaper", and a tile has room for both.
	 */
	private optionGrid<T extends string>(
		parent: HTMLElement,
		options: readonly T[],
		describe: (option: T) => { icon: string; name: string; desc: string; selected: boolean },
		onPick: (option: T) => void,
		extraClass?: string,
	): void {
		const grid = parent.createDiv("hearth-setup-options");
		if (extraClass) grid.addClass(extraClass);
		for (const option of options) {
			const info = describe(option);
			const tile = grid.createDiv("hearth-setup-option");
			tile.toggleClass("is-selected", info.selected);
			setIcon(tile.createSpan("hearth-setup-option-icon"), info.icon);
			const text = tile.createDiv("hearth-setup-option-text");
			text.createDiv({ cls: "hearth-setup-option-name", text: info.name });
			text.createDiv({ cls: "hearth-setup-option-desc", text: info.desc });
			const pick = () => onPick(option);
			makeClickable(tile, pick, info.name);
			tile.setAttribute("aria-pressed", String(info.selected));
			tile.addEventListener("click", pick);
		}
	}

	// ---- Finishing -----------------------------------------------------

	/** Apply everything, persist once, and hand the user their board. */
	private async finishSetup(): Promise<void> {
		// Belt and braces: the "replace" control is never drawn on a forced run,
		// so this can only differ if the answers were reached some other way —
		// and the one thing this run promises is that it touches nothing.
		if (this.options.forceNewDashboard) this.answers.target = "new";
		const outcome = applySetup(this.plugin.settings, this.answers, this.detection);
		this.finished = true;
		// Record the version too, so a first-run user isn't shown the changelog
		// for a build they have just been set up on.
		this.plugin.settings.lastSeenVersion = this.plugin.manifest.version;
		await this.plugin.saveSettings();
		this.plugin.refreshBrandIcons();
		this.close();
		new Notice(t().setup.notice.done(outcome.cardCount));
		await this.plugin.activateView();
	}
}

/** What a planned card is called in the review list: its own title, or the
 * blueprint's name when it has none (the clock and the search bar carry no
 * title by design). Keyed by a plain string, so the lookup is widened rather
 * than each blueprint id having to exist in the union. */
function plannedName(entry: PlannedCard): string {
	const names = t().setup.plan.names as Record<string, string>;
	return entry.card.title || names[entry.id] || entry.id;
}

/** Why a planned card is on the board, in one phrase. */
function plannedReason(entry: PlannedCard): string {
	const reasons = t().setup.plan.reasons as Record<string, string>;
	return reasons[entry.reason] ?? "";
}

/**
 * Open the wizard.
 *
 * The single entry point: the command, the settings button and the first-run
 * prompt all come through here, so there is one place that decides what
 * "running setup" means.
 */
export function openSetupWizard(plugin: HearthPlugin, options: SetupWizardOptions = {}): void {
	new SetupWizardModal(plugin, options).open();
}

/**
 * Offer the wizard on a genuinely fresh install, once.
 *
 * `setupStatus` is `pending` only for a vault with no persisted Hearth settings
 * at all (see `migrateSettings`), and the modal itself moves it off `pending`
 * whether it is completed or dismissed — so this can never nag.
 */
export function maybeRunSetup(plugin: HearthPlugin): boolean {
	if (plugin.settings.setupStatus !== "pending") return false;
	openSetupWizard(plugin);
	return true;
}
