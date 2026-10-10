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
import { Notice, Setting } from "obsidian";
import { setIcon } from "../glyphs";
import { applyModalDesign, HearthModal } from "../uidesign";
import type { CardDesign } from "../types";
import { t } from "../i18n";
import type HearthPlugin from "../main";
import { configuredPlaces, renderPlacePicker, renderSkySource } from "../placepicker";
import {
	daylightFromHour,
	drawSky,
	formatSkyValue,
	parseSkyValue,
	resolveDaylight,
	skyGroupCode,
} from "../sky";
import { drawHarbour, drawWallpaper } from "../wallpaper";
import { addTitleIconPicker } from "../titleicon";
import { makeClickable } from "../ui";
import { galleryConfigured } from "../gallery";
import { openGallery } from "../gallerybrowse";
import { detectSetup, type DetectedIntegration, type SetupDetection } from "./detect";
import {
	applySetup,
	backgroundTuning,
	defaultAnswers,
	feedUrl,
	isUntouchedStarterBoard,
	planCards,
	plannedBackground,
	PURPOSE_ICONS,
	SETUP_BACKGROUNDS,
	SETUP_PURPOSES,
	SETUP_SURFACES,
	SURFACE_PRESETS,
	weatherPlace,
	type PlannedCard,
	type SetupAnswers,
	type SetupPurpose,
	type SetupSurface,
} from "./plan";

/** The wizard's steps, in order. Three, and the first one already builds
 * the board: every question after it is about how it looks. */
type SetupStepId = "purpose" | "look" | "finish";

const SETUP_STEPS: readonly SetupStepId[] = ["purpose", "look", "finish"];

/** The Lucide icon shown beside each step on the progress rail. */
const STEP_ICONS: Record<SetupStepId, string> = {
	purpose: "compass",
	look: "palette",
	finish: "layout-dashboard",
};

/** The icon each planned card wears in the board preview, by blueprint id. */
const PLAN_ICONS: Record<string, string> = {
	clock: "clock",
	daily: "calendar-days",
	tasks: "list-todo",
	schedule: "calendar-range",
	calendar: "calendar",
	weather: "cloud-sun",
	stats: "bar-chart-3",
	links: "zap",
	templater: "file-plus-2",
	recent: "history",
	favorites: "star",
	bookmarks: "bookmark",
	heatmap: "activity",
	rss: "rss",
	dataview: "table",
	datacore: "database",
	operon: "workflow",
	git: "git-branch",
	base: "layout-grid",
	pet: "cat",
};

/** Grid columns the finish step's board preview is drawn against — the same
 * width `planCards` lays out to. */
const PREVIEW_COLUMNS = 12;

/** The look step's design choices, in order: the two card designs, then
 * terminal mode (experimental), which is not a third card design but a
 * vault-wide mode drawn over whichever of the two is underneath. */
type SetupDesignChoice = CardDesign | "terminal";
const DESIGNS: readonly SetupDesignChoice[] = ["classic", "expressive", "terminal"];

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

export class SetupWizardModal extends HearthModal {
	private readonly plugin: HearthPlugin;
	private readonly detection: SetupDetection;
	private readonly options: SetupWizardOptions;
	private answers: SetupAnswers;
	private stepIndex = 0;
	/** The step last drawn, so a redraw within it keeps its scroll position. */
	private renderedStep: SetupStepId | null = null;
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
		// A place already set on a weather card elsewhere is where the new
		// board's weather is most likely wanted too.
		this.answers.weatherPlace = configuredPlaces(plugin.settings)[0];
		// Drawn in the design it is about to offer as chosen, so the first look
		// at the choice is also a preview of it.
		applyModalDesign(this, this.answers.design);
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

	/** The steps this run has. */
	private wizardSteps(): SetupStepId[] {
		return [...SETUP_STEPS];
	}

	private currentStep(): SetupStepId {
		const steps = this.wizardSteps();
		return steps[Math.min(this.stepIndex, steps.length - 1)];
	}

	/** Build (or rebuild) the whole modal. Called on every answer that changes
	 * what the rest of the step shows, and on every navigation. */
	private renderWizard(): void {
		const { contentEl } = this;
		// An answer redraws the step in place; keep the body where the user was
		// reading instead of snapping it back to the top. Only a move to another
		// step starts at the top.
		const step = this.currentStep();
		const keepTop =
			step === this.renderedStep
				? (contentEl.querySelector<HTMLElement>(".hearth-setup-body")?.scrollTop ?? 0)
				: 0;
		this.renderedStep = step;
		contentEl.empty();
		contentEl.addClass("hearth-setup");

		const steps = this.wizardSteps();
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
		body.scrollTop = keepTop;
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
		// On the first step only, and beside Next rather than instead of it:
		// somebody setting Hearth up for the first time is exactly who might
		// rather start from a board somebody else built than answer five
		// questions — and exactly who has nothing yet that installing one would
		// overwrite, since importing adds a board and touches no global setting.
		if (this.stepIndex === 0 && galleryConfigured(this.plugin)) {
			const gallery = right.createEl("button", {
				cls: "hearth-setup-gallery",
				text: t().gallery.browse.openLabel,
			});
			gallery.setAttribute("aria-label", t().gallery.browse.openAria);
			gallery.addEventListener("click", () => openGallery(this.plugin));
		}
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
			case "purpose":
				this.renderPurposeStep(body);
				break;
			case "look":
				this.renderLookStep(body);
				break;
			case "finish":
				this.renderFinishStep(body);
				break;
		}
	}

	/**
	 * What the vault is for, and what it already has.
	 *
	 * The first step is the one that decides the board, so it comes first —
	 * there used to be a welcome page and a page of title fields in front of
	 * it, two screens of reading and typing before a new user had told Hearth
	 * anything that mattered. The detected plugins sit here too: they add cards
	 * exactly the way a purpose does, so they belong beside the purposes.
	 */
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

		const count = body.createDiv("hearth-setup-note");
		const refreshCount = (): void => {
			const n = planCards(a, this.detection, (i) => `preview-${i}`).length;
			count.setText(t().setup.purpose.count(n));
		};

		// Two purposes need one answer only the user has — a feed, a place — and
		// their card waits for it rather than arriving empty.
		if (a.purposes.includes("reading")) this.renderFeedField(body, refreshCount);
		if (a.purposes.includes("ambience")) this.renderWeatherPlace(body);

		if (this.detection.integrations.length > 0) this.renderIntegrations(body);

		// Last, so it counts everything above it.
		body.appendChild(count);
		refreshCount();
	}

	/** The Reading card's feed. Typing updates the card count in place — no
	 * redraw, so the field keeps its focus. */
	private renderFeedField(body: HTMLElement, refreshCount: () => void): void {
		const strings = t().setup.purpose;
		const a = this.answers;
		const setting = new Setting(body).setName(strings.feed).setDesc(strings.feedDesc);
		setting.settingEl.addClass("hearth-setup-followup");
		const hint = setting.descEl.createDiv("hearth-setup-followup-hint");
		const refreshHint = (): void => {
			hint.setText(feedUrl(a) ? "" : strings.feedMissing);
			refreshCount();
		};
		setting.addText((text) =>
			text
				.setPlaceholder("https://example.com/feed.xml")
				.setValue(a.feedUrl)
				.onChange((v) => {
					a.feedUrl = v;
					refreshHint();
				}),
		);
		refreshHint();
	}

	/** Where the Weather card forecasts for — the same picker the card uses. */
	private renderWeatherPlace(body: HTMLElement): void {
		const strings = t().setup.purpose;
		const a = this.answers;
		const box = body.createDiv("hearth-setup-followup-box");
		box.createDiv({ cls: "hearth-setup-grouplabel", text: strings.weatherPlace });
		renderPlacePicker(box, {
			current: weatherPlace(a),
			onPick: (place) => {
				a.weatherPlace = place;
				this.renderWizard();
			},
			rerender: () => this.renderWizard(),
			disabled: this.plugin.settings.disableExternalCalls,
			session: this.placeSession,
			suggestions: configuredPlaces(this.plugin.settings),
		});
		if (!weatherPlace(a)) {
			box.createDiv({ cls: "hearth-setup-followup-hint", text: strings.weatherMissing });
		}
	}

	private renderIntegrations(body: HTMLElement): void {
		const strings = t().setup.integrations;
		const a = this.answers;

		body.createDiv({
			cls: "hearth-setup-grouplabel",
			text: t().setup.purpose.integrationsHeading,
		});
		body.createDiv({ cls: "hearth-setup-lead is-small", text: strings.lead });

		for (const found of this.detection.integrations) {
			const setting = new Setting(body)
				.setName(found.name)
				.setDesc(this.integrationEffect(found))
				.addToggle((tg) =>
					tg.setValue(a.integrations.includes(found.id)).onChange((v) => {
						a.integrations = v
							? [...a.integrations, found.id]
							: a.integrations.filter((id) => id !== found.id);
						// The Tasks card's configuration and the card count both
						// hinge on this, so redraw rather than let them go stale.
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
		return t().setup.integrations.effects[found.id];
	}

	/**
	 * The look, chosen by looking.
	 *
	 * Every visual choice is a picture of itself: each background is painted in
	 * miniature with a card floating on it, and each card surface is shown over
	 * the background already picked. "Frosted" means nothing written down and
	 * everything next to "Solid" when both are in front of you.
	 */
	private renderLookStep(body: HTMLElement): void {
		const strings = t().setup.look;
		const a = this.answers;

		body.createDiv({ cls: "hearth-setup-grouplabel", text: strings.designHeading });
		this.optionGrid(
			body,
			DESIGNS,
			(design) => ({
				icon: t().setup.designs[design].icon,
				name: t().setup.designs[design].name,
				desc: t().setup.designs[design].desc,
				selected: design === "terminal" ? a.terminal : !a.terminal && a.design === design,
				badge:
					design === "expressive"
						? t().setup.integrations.recommended
						: design === "terminal"
							? t().tui.settings.experimental
							: undefined,
				experimental: design === "terminal",
			}),
			(design) => {
				// Terminal leaves the card design as it was: it is what the boards
				// go back to when terminal mode is switched off.
				a.terminal = design === "terminal";
				if (design !== "terminal") {
					a.design = design;
					// The wizard is Hearth's interface too, so it shows the choice
					// at once rather than after the board is built.
					applyModalDesign(this, design);
				}
				this.renderWizard();
			},
		);
		if (a.terminal) {
			// Terminal mode draws no wallpaper and no card surfaces, and spaces
			// the board by its character grid, so the rest of this step would
			// change nothing — it stands aside for a line saying what it is.
			body.createDiv({ cls: "hearth-setup-note is-quiet", text: strings.terminalNote });
			return;
		}
		// Only the first setup makes the choice vault-wide (see applyDesign), so
		// only that one says so.
		if (this.plugin.settings.setupStatus !== "done") {
			body.createDiv({ cls: "hearth-setup-note is-quiet", text: strings.designNote });
		}

		body.createDiv({ cls: "hearth-setup-grouplabel", text: strings.backgroundHeading });
		this.swatchGrid(
			body,
			SETUP_BACKGROUNDS,
			(background) => ({
				name: t().setup.backgrounds[background].name,
				desc: t().setup.backgrounds[background].desc,
				selected: a.background === background,
				paint: (scene) => {
					this.paintScene(scene, { ...a, background });
					this.sampleCards(scene, a.surface, 1);
				},
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
					// Repaint the swatches in place: redrawing the step would
					// throw the picker away mid-drag.
					body
						.querySelectorAll<HTMLElement>(".hearth-setup-scene-bg.is-color")
						.forEach((el) => (el.style.background = v));
				}),
			);
		}

		if (a.background === "weather") {
			const sky = parseSkyValue(a.skyValue);
			body.createDiv({ cls: "hearth-setup-note is-quiet", text: strings.weatherDesc });
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

		// Frosted, solid or minimal are Classic's frames. Expressive has one
		// frame of its own, so there is nothing to choose (see applyLook).
		if (a.design === "classic") {
			body.createDiv({ cls: "hearth-setup-grouplabel", text: strings.surfaceHeading });
			this.swatchGrid(
				body,
				SETUP_SURFACES,
				(surface) => ({
					name: t().setup.surfaces[surface].name,
					desc: t().setup.surfaces[surface].desc,
					selected: a.surface === surface,
					paint: (scene) => {
						this.paintScene(scene, a);
						this.sampleCards(scene, surface, 2);
					},
				}),
				(surface) => {
					a.surface = surface;
					this.renderWizard();
				},
			);
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

	/**
	 * The board as it will be built, drawn — then the few things worth naming.
	 *
	 * The preview is the step: the chosen background, the header, and every
	 * planned card in its real position wearing the chosen surface. The title
	 * field writes straight into it as you type, and the clock and search
	 * toggles redraw it, so what is on screen is always what "Build" makes.
	 */
	private renderFinishStep(body: HTMLElement): void {
		const strings = t().setup.finish;
		const vault = t().setup.vault;
		const a = this.answers;
		const planned = planCards(a, this.detection, (i) => `preview-${i}`);

		const titleEl = this.renderBoardPreview(body, planned);
		if (planned.length === 0) {
			body.createDiv({ cls: "hearth-setup-note", text: strings.empty });
		}

		new Setting(body)
			.setName(vault.title)
			.setDesc(vault.titleDesc)
			.addText((text) =>
				text
					.setPlaceholder(this.detection.vaultName || "Obsidian")
					.setValue(a.title)
					.onChange((v) => {
						a.title = v;
						titleEl?.setText(this.previewTitle());
					}),
			);

		new Setting(body)
			.setName(strings.clock)
			.setDesc(strings.clockDesc)
			.addToggle((tg) =>
				tg.setValue(a.clock).onChange((v) => {
					a.clock = v;
					this.renderWizard();
				}),
			);

		new Setting(body)
			.setName(vault.showSearch)
			.setDesc(vault.showSearchDesc)
			.addToggle((tg) =>
				tg.setValue(a.showSearch).onChange((v) => {
					a.showSearch = v;
					this.renderWizard();
				}),
			);

		// The finer points of the header, folded: they matter to someone
		// tuning a board, not to someone deciding whether they like it.
		const more = this.fold(body, strings.more);
		new Setting(more)
			.setName(vault.showTitle)
			.setDesc(vault.showTitleDesc)
			.addToggle((tg) =>
				tg.setValue(a.showTitle).onChange((v) => {
					a.showTitle = v;
					this.renderWizard();
				}),
			);
		addTitleIconPicker(
			new Setting(more).setName(vault.titleIcon).setDesc(vault.titleIconDesc),
			this.app,
			a.titleIcon,
			(v) => {
				a.titleIcon = v;
			},
			this.plugin.settings.disableExternalCalls,
		);
		new Setting(more)
			.setName(vault.themeColor)
			.setDesc(vault.themeColorDesc)
			.addDropdown((d) => {
				const labels = vault.themeColorOptions;
				d.addOption("none", labels.none);
				d.addOption("icon", labels.icon);
				d.addOption("title", labels.title);
				d.addOption("both", labels.both);
				d.setValue(a.themeColorTarget).onChange((v) => {
					a.themeColorTarget = v as SetupAnswers["themeColorTarget"];
				});
			});

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

		if (planned.length > 0) {
			const why = this.fold(body, strings.why);
			const list = why.createDiv("hearth-setup-plan");
			for (const entry of planned) {
				const row = list.createDiv("hearth-setup-plan-row");
				row.createSpan({ cls: "hearth-setup-plan-name", text: plannedName(entry) });
				row.createSpan({ cls: "hearth-setup-plan-why", text: plannedReason(entry) });
			}
		}

		// The board is a starting point, and the one place that says so is the
		// last thing before the button.
		const callout = body.createDiv("hearth-setup-callout");
		const head = callout.createDiv("hearth-setup-callout-head");
		setIcon(head.createSpan("hearth-setup-callout-icon"), "sliders-horizontal");
		head.createSpan({ cls: "hearth-setup-callout-title", text: strings.calloutTitle });
		callout.createDiv({ cls: "hearth-setup-callout-text", text: strings.calloutHint });
	}

	/** A collapsed group of rows under a one-line summary. */
	private fold(parent: HTMLElement, label: string): HTMLElement {
		const details = parent.createEl("details", { cls: "hearth-setup-fold" });
		const summary = details.createEl("summary", { cls: "hearth-setup-fold-summary" });
		setIcon(summary.createSpan("hearth-setup-fold-chevron"), "chevron-right");
		summary.createSpan({ text: label });
		return details.createDiv("hearth-setup-fold-body");
	}

	/** The header title the board will show. */
	private previewTitle(): string {
		return this.answers.title.trim() || this.detection.vaultName || "Obsidian";
	}

	/**
	 * A scale model of the board about to be built: background, header and
	 * every card in place, in the chosen surface.
	 *
	 * Returns the title element so the title field can write into it live.
	 */
	private renderBoardPreview(body: HTMLElement, planned: PlannedCard[]): HTMLElement | null {
		const a = this.answers;
		const surface = SURFACE_PRESETS[a.surface];
		// Terminal mode draws no wallpaper and no card surfaces: the model is
		// boxes on the theme's own background, in a monospaced face.
		const banner = !a.terminal && a.backgroundLayout === "banner" && a.background !== "none";

		const frame = body.createDiv("hearth-setup-board");
		frame.toggleClass("is-terminal", a.terminal);
		const scene = frame.createDiv("hearth-setup-board-scene");
		scene.toggleClass("is-banner", banner);
		this.paintScene(scene, a.terminal ? { ...a, background: "none" } : a);

		const page = scene.createDiv("hearth-setup-board-page");
		page.toggleClass("is-compact", a.compact);

		let titleEl: HTMLElement | null = null;
		if (a.showTitle || a.showSearch) {
			const header = page.createDiv("hearth-setup-board-header");
			if (a.showTitle) {
				titleEl = header.createDiv({
					cls: "hearth-setup-board-title",
					text: this.previewTitle(),
				});
			}
			if (a.showSearch) {
				const search = header.createDiv("hearth-setup-board-search");
				setIcon(search.createSpan("hearth-setup-board-search-icon"), "search");
			}
		}

		const rows = planned.reduce((max, p) => Math.max(max, p.card.y + p.card.h), 0);
		const grid = page.createDiv("hearth-setup-board-grid");
		grid.style.gridTemplateColumns = `repeat(${PREVIEW_COLUMNS}, 1fr)`;
		grid.style.gridTemplateRows = `repeat(${Math.max(1, rows)}, minmax(0, 1fr))`;
		for (const entry of planned) {
			const cell = grid.createDiv("hearth-setup-board-card");
			if (!a.terminal) styleSampleCard(cell, surface, banner);
			cell.toggleClass("is-x-frame", !a.terminal && a.design === "expressive");
			cell.style.gridColumn = `${entry.card.x + 1} / span ${entry.card.w}`;
			cell.style.gridRow = `${entry.card.y + 1} / span ${entry.card.h}`;
			const head = cell.createDiv("hearth-setup-board-card-head");
			setIcon(head.createSpan("hearth-setup-board-card-icon"), PLAN_ICONS[entry.id] ?? "square");
			head.createSpan({ cls: "hearth-setup-board-card-name", text: plannedName(entry) });
			// A few lines of stand-in content, as many as the card is tall.
			const lines = cell.createDiv("hearth-setup-board-card-lines");
			for (let i = 0; i < Math.min(4, entry.card.h - 1); i++) lines.createDiv();
		}
		return titleEl;
	}

	/**
	 * Paint a background into `scene` the way the board will: Hearth's own
	 * wallpaper and the harbour are the real drawings, the sky is the real sky
	 * (a clear one until a condition or place is picked), a colour is that
	 * colour, and "none" is the theme's own surface.
	 */
	private paintScene(scene: HTMLElement, a: SetupAnswers): void {
		scene.addClass("hearth-setup-scene");
		const bg = scenePaint(a);
		const layer = scene.createDiv("hearth-setup-scene-bg");
		layer.addClass(`is-${a.background}`);
		layer.style.opacity = String(bg.opacity);
		switch (a.background) {
			case "default":
				drawWallpaper(layer, a.design);
				break;
			case "harbour":
				drawHarbour(layer);
				break;
			case "weather":
				drawSky(layer, { ...bg.sky, animate: false, spread: "board", design: a.design });
				break;
			case "color":
				layer.style.background = a.backgroundColor;
				break;
			case "none":
				break;
		}
	}

	/** One or two stand-in cards over a swatch's scene, in `surface`. */
	private sampleCards(scene: HTMLElement, surface: SetupSurface, count: number): void {
		const stack = scene.createDiv("hearth-setup-sample");
		for (let i = 0; i < count; i++) {
			const card = stack.createDiv("hearth-setup-sample-card");
			styleSampleCard(card, SURFACE_PRESETS[surface], false);
			card.toggleClass("is-x-frame", this.answers.design === "expressive");
			card.createDiv("hearth-setup-sample-line is-strong");
			card.createDiv("hearth-setup-sample-line");
		}
	}

	// ---- Option tiles --------------------------------------------------

	/**
	 * A grid of selectable tiles — the wizard's main input for choices whose
	 * *description* is the question.
	 */
	private optionGrid<T extends string>(
		parent: HTMLElement,
		options: readonly T[],
		describe: (option: T) => {
			icon: string;
			name: string;
			desc: string;
			selected: boolean;
			badge?: string;
			/** A badge that warns rather than recommends. */
			experimental?: boolean;
		},
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
			const name = text.createDiv({ cls: "hearth-setup-option-name", text: info.name });
			if (info.badge) {
				const badge = name.createSpan({ cls: "hearth-setup-badge", text: info.badge });
				badge.toggleClass("is-experimental", info.experimental === true);
			}
			text.createDiv({ cls: "hearth-setup-option-desc", text: info.desc });
			const pick = () => onPick(option);
			makeClickable(tile, pick, info.name);
			tile.setAttribute("aria-pressed", String(info.selected));
			tile.addEventListener("click", pick);
		}
	}

	/** A grid of picture tiles: a painted miniature above a name, for choices
	 * that are about how something looks. */
	private swatchGrid<T extends string>(
		parent: HTMLElement,
		options: readonly T[],
		describe: (option: T) => {
			name: string;
			desc: string;
			selected: boolean;
			paint: (scene: HTMLElement) => void;
		},
		onPick: (option: T) => void,
	): void {
		const grid = parent.createDiv("hearth-setup-swatches");
		for (const option of options) {
			const info = describe(option);
			const tile = grid.createDiv("hearth-setup-swatch");
			tile.toggleClass("is-selected", info.selected);
			info.paint(tile.createDiv("hearth-setup-swatch-scene"));
			tile.createDiv({ cls: "hearth-setup-swatch-name", text: info.name });
			tile.setAttribute("title", info.desc);
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

/** Dress a stand-in card in a surface preset, scaled to the miniature. On a
 * banner board the cards sit on the theme's surface, not the picture, so they
 * are drawn opaque there. */
function styleSampleCard(
	el: HTMLElement,
	surface: (typeof SURFACE_PRESETS)[SetupSurface],
	opaque: boolean,
): void {
	const opacity = opaque ? Math.max(surface.cardOpacity, 0.9) : surface.cardOpacity;
	el.style.setProperty("--sample-opacity", `${Math.round(opacity * 100)}%`);
	el.style.setProperty("--sample-blur", `${Math.round(surface.cardBlur / 2)}px`);
	el.style.setProperty("--sample-radius", `${Math.max(2, Math.round(surface.cardRadius / 2))}px`);
	el.style.setProperty("--sample-border", `${surface.cardBorderWidth}px`);
}

/** How a miniature paints its background: the board's own opacity for the
 * choice, and for a sky the condition to draw — the pinned one, else a clear
 * sky at the reader's hour, since a live forecast would be a request made just
 * to draw a thumbnail. */
function scenePaint(a: SetupAnswers): {
	opacity: number;
	sky: { code: number; isDay: boolean };
} {
	const hour = new Date().getHours();
	const sky = parseSkyValue(a.skyValue);
	const planned = a.background === "weather" && a.skyValue ? plannedBackground(a) : null;
	const opacity =
		a.background === "none" ? 0 : (planned?.opacity ?? backgroundTuning(a.background).opacity);
	return {
		opacity,
		sky:
			sky?.mode === "fixed"
				? { code: skyGroupCode(sky.group), isDay: resolveDaylight(sky.daylight, hour) }
				: { code: 0, isDay: daylightFromHour(hour) },
	};
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
