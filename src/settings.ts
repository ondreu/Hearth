import { type App, type ButtonComponent, debounce, Notice, Platform, PluginSettingTab, setIcon, Setting, type SettingDefinitionItem, type SliderComponent, type TextComponent, TFile } from "obsidian";
import type HearthPlugin from "./main";
import { TaskFieldsModal } from "./cards/tasks";
import { hasFileIconPlugin } from "./fileicons";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { kofiTipButton } from "./kofi";
import { addIconPicker } from "./lucide";
import { CommandPickerModal, FilePickerModal, FolderPickerModal } from "./pickers";
import { addTitleIconPicker } from "./titleicon";
import { configuredPlaces, renderSkySource } from "./placepicker";
import { activeDashboard, BANNER_HEIGHT_MAX, BANNER_HEIGHT_MIN, type BackgroundKind, type BackgroundLayout, CARD_BORDER_WIDTH_MAX, clampBannerHeight, CONTENT_WIDTH_MAX, CONTENT_WIDTH_MIN, CONTENT_WIDTH_STEP, DEFAULT_SETTINGS, defaultMobileActionButtons, frostAllowed, type HomeSettings, LOW_POWER_BACKGROUND, lowPowerActive, type MobileActionButton, motionAllowed, OPEN_IN_MODES, OPEN_SOURCES, type OpenIn, type OpenInRule, type OpenOutsideRule, PERFORMANCE_TIERS, type PerformanceTier, performanceTier, skyDensity, timersAllowed } from "./types";
import {
	exportLayout,
	exportSettings,
	openExportDashboard,
	pickAndImport,
} from "./exportimport";
import { makeClickable } from "./ui";
import { isOmnisearchAvailable, OMNISEARCH_PLUGIN_ID } from "./omnisearch";
import { formatSkyValue, parseSkyValue } from "./sky";
import {
	type IntegrationEntry,
	type IntegrationGroup,
	type IntegrationSectionId,
	integrationsInGroup,
	integrationStatus,
	type SettingsTabId,
} from "./integrations";
import {
	isOperonAvailable,
	OPERON_PLUGIN_ID,
	operonCapabilities,
	type OperonAccessState,
} from "./operon";
import { CHANGELOG, WhatsNewModal } from "./whatsnew";
import { openSetupWizard } from "./onboarding";
import { t } from "./i18n";
import {
	destinationSummary,
	isTemplaterAvailable,
	isTemplaterTemplate,
	normalizeFolderPath,
	templateDisplayName,
} from "./templater";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a number —
 * used to reset slider-backed settings back to their factory value. */
type NumericSettingKey =
	| "maxWidth"
	| "backgroundOpacity"
	| "backgroundBlur"
	| "bannerHeight"
	| "cardOpacity"
	| "cardBlur"
	| "cardRadius"
	| "cardBorderWidth";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a string and
 * would be awkward to reconstruct by hand (frontmatter field names, the search
 * placeholder, the title) — used to reset text-backed settings to their factory
 * value. */
type StringSettingKey =
	| "title"
	| "searchPlaceholder"
	| "backgroundValue"
	| "lowPowerBackgroundColor"
	| "taskNotesStatusField"
	| "taskNotesDueField"
	| "taskNotesPriorityField"
	| "taskNotesDoneValue"
	| "iconizeIconProperty";

/** The performance ladder's names, in the reader's language. Shared by the
 * desktop tier dropdown and the mobile one so the two can never drift into
 * describing the same ladder differently. */
function tierLabels(): Record<PerformanceTier, string> {
	const strings = t().settings.performance;
	return {
		full: strings.tierFull,
		balanced: strings.tierBalanced,
		reduced: strings.tierReduced,
		minimal: strings.tierMinimal,
	};
}

/** The GitHub links surfaced in the About tab. (The Ko-fi URL lives in
 * `kofi.ts` — the tip button is shown in three places now.) */
const GITHUB_URL = "https://github.com/ondreu/hearth";
const GITHUB_ISSUES_URL = "https://github.com/ondreu/hearth/issues/new";

/** Download filenames for the JSON exports. */

/** A tab in the settings ribbon: an id (keys `t().settings.tabs`, declared in
 * `integrations.ts` so the catalogue can point at one) and a Lucide icon shown
 * beside the label. */
const SETTINGS_TABS: { id: SettingsTabId; icon: string }[] = [
	{ id: "appearance", icon: "palette" },
	{ id: "search", icon: "search" },
	{ id: "dashboard", icon: "layout-dashboard" },
	{ id: "behaviour", icon: "settings-2" },
	{ id: "mobile", icon: "smartphone" },
	{ id: "integrations", icon: "plug" },
	{ id: "backup", icon: "archive" },
	{ id: "about", icon: "info" },
];

/** Where the settings pane currently is: the category index, or one category's
 * own page. The pane is two levels deep — see `renderInto`. */
type SettingsRoute = "index" | SettingsTabId;

/** How the index groups the categories. Ids key `t().settings.indexGroups`, so a
 * missing translation is a build error rather than an empty heading.
 *
 * The grouping is editorial, not structural: seven rows in one undivided list
 * reads as a wall, and these four headings are how the categories actually
 * cluster when you say out loud what each is for. */
const SETTINGS_INDEX: { id: "lookFeel" | "howItWorks" | "data" | "etc"; tabs: SettingsTabId[] }[] = [
	{ id: "lookFeel", tabs: ["appearance", "dashboard"] },
	{ id: "howItWorks", tabs: ["search", "behaviour", "mobile"] },
	{ id: "data", tabs: ["integrations", "backup"] },
	{ id: "etc", tabs: ["about"] },
];

/** localStorage key for where the pane was last left — a tab id, or "index". */
const ACTIVE_TAB_KEY = "hearth-settings-tab";

/**
 * ⚠️ Naming hazard: members of this class live on the same prototype chain as
 * Obsidian's `SettingTab`, whose *undocumented internals* are not in the
 * typings — so a colliding name compiles cleanly and silently replaces engine
 * behaviour at runtime. That is exactly how #52 happened: a private
 * `renderTab(body, tab)` helper shadowed the internal `SettingTab.renderTab()`
 * that Obsidian 1.13's settings window calls to open a tab. Obsidian invoked
 * it with no arguments, the `switch (undefined)` matched nothing, and the pane
 * came up completely blank — no error, on every reopen. Keep member names
 * unmistakably Hearth-specific; the constructor tripwire below turns any
 * future collision into a loud console error instead of a silent blank pane.
 */
export class HomeSettingTab extends PluginSettingTab {
	plugin: HearthPlugin;

	/** Scratch space for the background place picker (its query and the last
	 * search's results). Kept on the tab so it survives the in-place rerenders
	 * the picker's own buttons trigger, and is dropped when the tab closes. */
	private placeSession: Record<string, unknown> = {};

	/** Members we deliberately override — the documented extension points of
	 * `SettingTab`. Anything else that exists on the base prototype chain is an
	 * Obsidian internal we must not shadow. */
	private static readonly INTENDED_OVERRIDES = new Set([
		"constructor",
		"display",
		"hide",
		"getSettingDefinitions",
		"getControlValue",
		"setControlValue",
	]);

	constructor(app: App, plugin: HearthPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.warnOnBaseMemberShadowing();
	}

	/** #52 tripwire: at runtime (inside real Obsidian, where the internals
	 * actually exist on the base prototypes) report any member of this class
	 * that shadows a `SettingTab` member we didn't mean to override. */
	private warnOnBaseMemberShadowing(): void {
		const base = Object.getPrototypeOf(HomeSettingTab.prototype) as object | null;
		if (!base) return;
		for (const name of Object.getOwnPropertyNames(HomeSettingTab.prototype)) {
			if (!HomeSettingTab.INTENDED_OVERRIDES.has(name) && name in base) {
				console.error(
					`Hearth: HomeSettingTab.${name} shadows an internal Obsidian SettingTab member and will break settings rendering — rename it (see issue #52)`,
				);
			}
		}
	}

	/**
	 * Persist the settings and refresh open boards, coalescing a burst of edits
	 * into one of each.
	 *
	 * Every control in this pane calls `save()` from its `onChange`, and for a
	 * text field or a slider that is once per keystroke or per drag step. Each
	 * call was writing the entire settings JSON to disk *and* tearing down and
	 * rebuilding the DOM of every open board — so typing a twenty-character
	 * search placeholder cost twenty full board rebuilds and twenty disk writes.
	 *
	 * `resetTimer` so a run of edits settles once at the end rather than firing
	 * partway through. The window is short enough to feel immediate for a slider
	 * whose effect the user is watching on the board behind the pane.
	 *
	 * Anything that must not be left pending flushes it: {@link hide} when the
	 * pane closes, and {@link rerender} before the pane is rebuilt.
	 */
	private readonly saveDebounced = debounce(() => void this.plugin.saveSettings(), 200, true);

	private save(): void {
		this.saveDebounced();
	}

	/** Write out any edit still sitting in the debounce window. */
	private flushSave(): void {
		this.saveDebounced.run();
	}

	hide(): void {
		// The pane is closing, so there may be a keystroke from a moment ago that
		// has not reached disk yet.
		this.flushSave();
		super.hide();
	}

	/** Tell the user Omnisearch isn't available and offer a one-click jump to it
	 * in Obsidian's Community-plugins browser (via the `show-plugin` URI). */
	private promptInstallOmnisearch(): void {
		const frag = createFragment();
		frag.appendText(t().settings.appearance.omnisearchMissing + " ");
		const link = frag.createEl("a", {
			text: t().settings.appearance.omnisearchInstallLink,
			href: `obsidian://show-plugin?id=${OMNISEARCH_PLUGIN_ID}`,
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			window.open(link.href);
		});
		new Notice(frag, 10000);
	}

	/** Where the pane last rendered: the declarative host row on Obsidian
	 * 1.13+, `containerEl` on the legacy path. Internal re-renders (ribbon
	 * clicks, list mutations) must target this element — on 1.13 `containerEl`
	 * is never attached, so rendering into it would silently go nowhere. */
	private renderTarget: HTMLElement | null = null;

	/** Title of a section to scroll to on the next render, set by a catalogue
	 * row's "Show" button. */
	private revealSectionTitle: string | null = null;

	/**
	 * Obsidian 1.13 reworked the settings modal around declarative setting
	 * definitions; when a tab's definitions are non-empty, the legacy
	 * `display()` is never called. On affected installs (#52) the modal took
	 * that path for this tab, so the pane stayed completely blank — no error,
	 * and no guard inside display() could ever run. Registering the whole pane
	 * as a single self-rendered definition makes the tab render on the new
	 * pipeline; older Obsidian versions never call this and keep using
	 * `display()`. Same builder either way.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: this.plugin.manifest.name,
				// The pane manages its own layout and content; keep the host
				// row out of the 1.13 settings search.
				searchable: false,
				render: (setting: Setting) => {
					const host = setting.settingEl;
					// Drop the empty name/desc/control skeleton and the
					// setting-row flex layout; the pane is a plain block.
					host.empty();
					host.addClass("hearth-settings-host");
					this.renderTarget = host;
					this.renderInto(host);
					return () => {
						if (this.renderTarget === host) this.renderTarget = null;
					};
				},
			},
		];
	}

	display(): void {
		this.renderTarget = this.containerEl;
		this.renderInto(this.containerEl);
	}

	/** Re-render the pane in place after a state change (tab switch, list
	 * mutation, import) — into whichever element the pane currently lives in. */
	private rerender(): void {
		// A rerender follows a structural change (a card added, a list reordered,
		// a settings import) and rebuilds every control from `plugin.settings`.
		// Flush first so the pending edit is on disk before the pane that produced
		// it is thrown away.
		this.flushSave();
		this.renderInto(this.renderTarget ?? this.containerEl);
	}

	/** Build the full settings pane into `containerEl`, shared by both render
	 * paths (legacy `display()` and the 1.13 setting-definition host). */
	private renderInto(containerEl: HTMLElement): void {
		containerEl.empty();
		containerEl.addClass("hearth-settings");

		// Whole-pane backstop. #52 reports a completely blank settings pane — no
		// content, no error in the (main-window) console — for some users on
		// Obsidian 1.13, which renders settings in a *separate window*. A throw
		// anywhere in the build (even before the first row, e.g. in `fileDatalist`
		// or `activeRoute`) would blank everything, and its error lands in that
		// other window's console where it's easy to miss. Guard the entire build so
		// the pane can never be silently blank: on failure, show an inline error
		// and log the real stack (to whichever console this window uses).
		try {
			// Two levels: an index of categories, and one category's page. Which
			// one is showing persists per-vault in localStorage, so closing and
			// reopening settings comes back to the same place.
			const route = this.activeRoute();
			if (route === "index") {
				this.renderIndex(containerEl);
				return;
			}

			// Only a category page has file-path inputs to complete, and building
			// this walks the whole vault — so it stays out of the index.
			this.fileDatalist(containerEl);
			this.renderCategoryHead(containerEl, route);

			const body = containerEl.createDiv("hearth-settings-tabbody");
			// A page-level backstop nested inside: individual sections already
			// isolate their own failures (see `section`), but the About page and a
			// couple of bare rows render straight into the body. Guard here too so
			// a throw shows an inline error rather than a blank pane — and, because
			// the back link above is already drawn, the user can still leave.
			try {
				this.renderTabSections(body, route);
			} catch (err) {
				body.empty();
				this.renderError(body, t().settings.tabs[route], err);
			}
		} catch (err) {
			// The datalist or the navigation itself failed to build. Append the
			// error rather than empty()-ing, so anything that survived still lets
			// the user navigate.
			this.renderError(containerEl, "Hearth", err);
		}
	}

	/** Render an inline error block in place of content that failed to render,
	 * and log the real stack to the console so it can be reported. Keeps one
	 * broken section from blanking the entire settings pane. */
	private renderError(containerEl: HTMLElement, name: string, err: unknown): void {
		console.error(`Hearth: the "${name}" settings section failed to render`, err);
		const box = containerEl.createDiv("hearth-settings-error");
		setIcon(box.createSpan("hearth-settings-error-icon"), "alert-triangle");
		const text = box.createDiv("hearth-settings-error-text");
		text.createDiv({
			cls: "hearth-settings-error-title",
			text: t().settings.sectionError(name),
		});
		text.createDiv({ cls: "hearth-settings-error-hint", text: t().settings.sectionErrorHint });
	}

	/** Where the pane was last left. Anything unrecognised — including the absent
	 * key of a first visit — lands on the index. */
	private activeRoute(): SettingsRoute {
		const saved = this.app.loadLocalStorage(ACTIVE_TAB_KEY) as string | null;
		return SETTINGS_TABS.some((tab) => tab.id === saved) ? (saved as SettingsTabId) : "index";
	}

	/** Move to another level of the pane, remembering it for next time. */
	private navigate(route: SettingsRoute): void {
		this.app.saveLocalStorage(ACTIVE_TAB_KEY, route);
		this.rerender();
	}

	/** The index: every category as a full-width row, grouped under headings.
	 *
	 * This replaced a ribbon of seven pinned tabs. Seven pills never fit a
	 * stock-width settings pane, so they either wrapped onto a ragged second line
	 * or — once made to scroll — clipped the last two out of sight; and pinning
	 * the row left content sliced behind it. Rows have neither failure mode: they
	 * are vertical, they are not pinned, and an eighth category costs nothing. */
	private renderIndex(containerEl: HTMLElement): void {
		const s = t().settings;
		const head = containerEl.createDiv("hearth-settings-index-head");
		head.createDiv({ cls: "hearth-settings-index-title", text: this.plugin.manifest.name });
		head.createDiv({ cls: "hearth-settings-index-sub", text: s.indexSub });

		for (const group of SETTINGS_INDEX) {
			containerEl.createDiv({
				cls: "hearth-settings-index-grouplabel",
				text: s.indexGroups[group.id],
			});
			const rows = containerEl.createDiv("hearth-settings-index-rows");
			for (const id of group.tabs) {
				const entry = SETTINGS_TABS.find((tab) => tab.id === id);
				if (!entry) continue;
				this.indexRow(rows, entry);
			}
		}
	}

	/** One index row: icon, category name, a line on what's inside, chevron.
	 *
	 * A div rather than a `<button>`, via the same `makeClickable` treatment the
	 * rest of the plugin uses. Obsidian's base `button` style fixes the element's
	 * height, which a two-line row overflows — its name and description spilled
	 * straight out of the row's own box. */
	private indexRow(rowsEl: HTMLElement, entry: { id: SettingsTabId; icon: string }): void {
		const s = t().settings;
		const label = s.tabs[entry.id];
		const row = rowsEl.createDiv("hearth-settings-index-row");
		const open = () => this.navigate(entry.id);
		makeClickable(row, open, label);
		setIcon(row.createSpan("hearth-settings-index-glyph"), entry.icon);
		const text = row.createDiv("hearth-settings-index-rowtext");
		text.createDiv({ cls: "hearth-settings-index-rowname", text: label });
		text.createDiv({ cls: "hearth-settings-index-rowdesc", text: s.tabDescs[entry.id] });
		setIcon(row.createSpan("hearth-settings-index-go"), "chevron-right");
		row.addEventListener("click", open);
	}

	/** A category page's header: the way back to the index, then the category's
	 * name and a line on what it covers. Deliberately not pinned — it scrolls
	 * away with the content, which is the whole point of dropping the ribbon. */
	private renderCategoryHead(containerEl: HTMLElement, tab: SettingsTabId): void {
		const s = t().settings;
		// A div, for the same reason as an index row — see `indexRow`.
		const back = containerEl.createDiv("hearth-settings-back");
		const leave = () => this.navigate("index");
		makeClickable(back, leave, s.backToIndex);
		setIcon(back.createSpan("hearth-settings-back-icon"), "chevron-left");
		back.createSpan({ text: this.plugin.manifest.name });
		back.addEventListener("click", leave);

		containerEl.createDiv({ cls: "hearth-settings-page-title", text: s.tabs[tab] });
		containerEl.createDiv({ cls: "hearth-settings-page-desc", text: s.tabDescs[tab] });
	}

	/** Render the sections that belong to a given ribbon tab. (Named
	 * `renderTabSections`, not `renderTab` — the latter is an Obsidian 1.13
	 * internal and shadowing it blanked the whole pane, #52.) */
	private renderTabSections(body: HTMLElement, tab: SettingsTabId): void {
		const s = t().settings;
		switch (tab) {
			case "appearance":
				this.section(body, s.sections.performance, s.sections.performanceDesc, (b) =>
					this.performanceSection(b),
				);
				this.section(body, s.sections.home, s.sections.homeDesc, (b) => this.homeSection(b));
				this.section(body, s.background.heading, s.background.headingDesc, (b) =>
					this.backgroundSection(b),
				);
				break;
			case "search":
				this.section(body, s.sections.searchBar, s.sections.searchBarDesc, (b) =>
					this.searchBarSection(b),
				);
				this.section(body, s.filters.heading, s.filters.headingDesc, (b) => this.filtersSection(b));
				break;
			case "dashboard":
				this.section(body, s.sections.grid, s.sections.gridDesc, (b) => this.gridSection(b));
				this.section(body, s.sections.dashboardControls, s.sections.dashboardControlsDesc, (b) =>
					this.dashboardControlsSection(b),
				);
				this.section(body, s.sections.cardSurface, s.sections.cardSurfaceDesc, (b) =>
					this.cardSurfaceSection(b),
				);
				// The cards themselves are added and configured on the board, not
				// here — surface that as a plain informational row.
				new Setting(body).setName(s.dashboard.cards).setDesc(s.dashboard.cardsDesc);
				break;
			case "behaviour":
				this.section(body, s.sections.startup, s.sections.startupDesc, (b) => this.startupSection(b));
				this.section(body, s.sections.opening, s.sections.openingDesc, (b) =>
					this.openingSection(b),
				);
				this.section(body, s.sections.privacy, s.sections.privacyDesc, (b) =>
					this.privacySection(b),
				);
				break;
			// Mobile is a category of its own rather than two sections inside
			// Behaviour. Hearth runs on a phone as a first-class board now, not as
			// a reduced mode of the desktop one, and the settings pane is where
			// that is either stated or quietly contradicted.
			case "mobile":
				this.section(body, s.sections.mobileMode, s.sections.mobileModeDesc, (b) =>
					this.mobileModeSection(b),
				);
				this.section(body, s.mobileActions.heading, s.mobileActions.headingDesc, (b) =>
					this.mobileActionsSection(b),
				);
				break;
			case "integrations":
				// The catalogue first: every integration Hearth has, listed whether
				// or not it is installed and whether or not it has a setting. The two
				// sections below are the only ones that *do* have settings, and rows
				// in the catalogue link down to them.
				this.section(body, s.integrations.heading, s.integrations.headingDesc, (b) =>
					this.integrationsCatalogue(b),
				);
				this.section(body, s.tasks.heading, s.tasks.headingDesc, (b) => this.tasksSection(b));
				this.section(body, s.operon.heading, s.operon.headingDesc, (b) =>
					this.operonSection(b),
				);
				this.section(body, s.fileIcons.heading, s.fileIcons.headingDesc, (b) =>
					this.fileIconsSection(b),
				);
				break;
			case "backup":
				this.section(body, s.layout.heading, s.layout.headingDesc, (b) => this.layoutSection(b));
				break;
			case "about":
				this.aboutSection(body);
				break;
		}
	}

	/** A shared <datalist> of vault files used by file-path inputs. */
	private fileDatalist(containerEl: HTMLElement): void {
		const datalist = containerEl.createEl("datalist", {
			attr: { id: "hearth-file-list" },
		});
		for (const file of this.app.vault.getFiles()) {
			datalist.createEl("option", { attr: { value: file.path } });
		}
	}

	// ---- Section wrapper -----------------------------------------------

	/** Wrap a section in a labelled group: a heading, and a bordered box holding
	 * its rows.
	 *
	 * Sections used to be collapsible, with the fold state persisted per section,
	 * because a tab held every section of its category in one long scroll. Now
	 * that each category is its own page holding two to five groups, there is
	 * nothing left to tame — so nothing folds, and every setting on a page is
	 * visible the moment it opens. */
	private section(
		containerEl: HTMLElement,
		title: string,
		desc: string | undefined,
		render: (body: HTMLElement) => void,
	): void;
	private section(
		containerEl: HTMLElement,
		title: string,
		render: (body: HTMLElement) => void,
	): void;
	private section(
		containerEl: HTMLElement,
		title: string,
		descOrRender: string | undefined | ((body: HTMLElement) => void),
		maybeRender?: (body: HTMLElement) => void,
	): void {
		const desc = typeof descOrRender === "string" ? descOrRender : undefined;
		const render = typeof descOrRender === "function" ? descOrRender : maybeRender!;

		const wrap = containerEl.createDiv("hearth-section");
		const head = wrap.createDiv("hearth-section-head");
		head.createDiv({ cls: "hearth-section-title", text: title });
		if (desc) head.createDiv({ cls: "hearth-section-desc", text: desc });

		const body = wrap.createDiv("hearth-section-body");
		// Isolate each section: a throw while rendering one section shows an inline
		// error there instead of blanking the whole page, so its siblings still
		// render.
		try {
			render(body);
		} catch (err) {
			body.empty();
			this.renderError(body, title, err);
		}

		// A catalogue row asked for this section — it lives further down the same
		// page, so scroll it into view once the pane has been laid out.
		if (this.revealSectionTitle === title) {
			this.revealSectionTitle = null;
			window.requestAnimationFrame(() =>
				wrap.scrollIntoView({ block: "start", behavior: "smooth" }),
			);
		}
	}

	// ---- Slider reset helper -------------------------------------------

	/** Add a reset (rotate-ccw) extra button to a slider Setting that restores
	 * the factory default from DEFAULT_SETTINGS. The current value is surfaced by
	 * Obsidian itself, which draws it inline beside the slider. */
	private addSliderReset(
		setting: Setting,
		sl: SliderComponent,
		key: NumericSettingKey,
	): void {
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(async () => {
					const def = DEFAULT_SETTINGS[key];
					(this.plugin.settings as unknown as Record<string, number>)[key] = def;
					sl.setValue(def);
					this.save();
				}),
		);
	}

	/** Add a reset (rotate-ccw) extra button to a text Setting that restores the
	 * factory default from DEFAULT_SETTINGS. Used for fields whose default string
	 * would be troublesome to reconstruct if overwritten. */
	private addTextReset(
		setting: Setting,
		txt: TextComponent,
		key: StringSettingKey,
	): void {
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetField)
				.onClick(async () => {
					const def = DEFAULT_SETTINGS[key];
					(this.plugin.settings as unknown as Record<string, string>)[key] = def;
					txt.setValue(def);
					this.save();
				}),
		);
	}

	// ---- Home (title, title icon, width) --------------------------------

	private homeSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.appearance.showTitle)
			.setDesc(t().settings.appearance.showTitleDesc)
			.addToggle((t) =>
				t.setValue(s.showTitle).onChange(async (v) => {
					s.showTitle = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.showSearch)
			.setDesc(t().settings.appearance.showSearchDesc)
			.addToggle((t) =>
				t.setValue(s.showSearch).onChange(async (v) => {
					s.showSearch = v;
					this.save();
				}),
			);

		const title = new Setting(containerEl)
			.setName(t().settings.appearance.title)
			.setDesc(t().settings.appearance.titleDesc);
		title.addText((txt) => {
			txt.setValue(s.title).onChange(async (v) => {
				s.title = v;
				this.save();
			});
			this.addTextReset(title, txt, "title");
		});

		addTitleIconPicker(
			new Setting(containerEl)
				.setName(t().settings.appearance.titleIcon)
				.setDesc(t().settings.appearance.titleIconDesc),
			this.app,
			s.titleIcon,
			(v) => {
				s.titleIcon = v;
				void this.save();
			},
		);

		addIconPicker(
			new Setting(containerEl)
				.setName(t().settings.appearance.tabIcon)
				.setDesc(t().settings.appearance.tabIconDesc),
			this.app,
			s.tabIcon,
			(v) => {
				s.tabIcon = v;
				this.save();
				// Reads the setting straight from memory, so it doesn't wait on the
				// (now debounced) write reaching disk.
				this.plugin.refreshBrandIcons();
			},
		);

		new Setting(containerEl)
			.setName(t().settings.appearance.themeColorTarget)
			.setDesc(t().settings.appearance.themeColorTargetDesc)
			.addDropdown((dd) =>
				dd
					.addOption("none", t().settings.appearance.themeColorNone)
					.addOption("icon", t().settings.appearance.themeColorIcon)
					.addOption("title", t().settings.appearance.themeColorTitle)
					.addOption("both", t().settings.appearance.themeColorBoth)
					.setValue(s.themeColorTarget)
					.onChange(async (v) => {
						s.themeColorTarget = v as HomeSettings["themeColorTarget"];
						this.save();
						this.plugin.refreshBrandIcons();
					}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.fullWidth)
			.setDesc(t().settings.appearance.fullWidthDesc)
			.addToggle((tg) =>
				tg.setValue(s.fullWidth).onChange(async (v) => {
					s.fullWidth = v;
					this.save();
					// The slider below is the ceiling this toggle removes, so it goes
					// away with it rather than sitting there doing nothing.
					this.rerender();
				}),
			);

		if (s.fullWidth) return;

		const width = new Setting(containerEl)
			.setName(t().settings.appearance.contentWidth)
			.setDesc(t().settings.appearance.contentWidthDesc);
		width.addSlider((sl) => {
			sl.setLimits(CONTENT_WIDTH_MIN, CONTENT_WIDTH_MAX, CONTENT_WIDTH_STEP)
				.setValue(s.maxWidth)
				.onChange(async (v) => {
					s.maxWidth = v;
					this.save();
				});
			this.addSliderReset(width, sl, "maxWidth");
		});
	}

	// ---- Search bar -----------------------------------------------------

	private searchBarSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		const searchPlaceholder = new Setting(containerEl)
			.setName(t().settings.appearance.searchPlaceholder);
		searchPlaceholder.addText((txt) => {
			txt.setValue(s.searchPlaceholder).onChange(async (v) => {
				s.searchPlaceholder = v;
				this.save();
			});
			this.addTextReset(searchPlaceholder, txt, "searchPlaceholder");
		});

		new Setting(containerEl)
			.setName(t().settings.appearance.searchContents)
			.setDesc(t().settings.appearance.searchContentsDesc)
			.addToggle((t) =>
				t.setValue(s.searchContents).onChange(async (v) => {
					s.searchContents = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.searchEngine)
			.setDesc(t().settings.appearance.searchEngineDesc)
			.addDropdown((d) => {
				d.addOption("builtin", t().settings.appearance.searchEngineBuiltin)
					.addOption("omnisearch", t().settings.appearance.searchEngineOmnisearch)
					.setValue(s.searchEngine)
					.onChange(async (v) => {
						const engine = v as HomeSettings["searchEngine"];
						// Guard the Omnisearch choice: if the plugin isn't there,
						// prompt the user to install it and snap the dropdown back to
						// the built-in engine rather than silently saving a mode that
						// can't work.
						if (engine === "omnisearch" && !isOmnisearchAvailable(this.plugin.app)) {
							this.promptInstallOmnisearch();
							d.setValue("builtin");
							s.searchEngine = "builtin";
							this.save();
							return;
						}
						s.searchEngine = engine;
						this.save();
					});
			});

		new Setting(containerEl)
			.setName(t().settings.appearance.showNewNoteButton)
			.setDesc(t().settings.appearance.showNewNoteButtonDesc)
			.addToggle((t) =>
				t.setValue(s.showNewNoteButton).onChange(async (v) => {
					s.showNewNoteButton = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.newNoteButtonMode)
			.setDesc(t().settings.appearance.newNoteButtonModeDesc)
			.addDropdown((d) => {
				d.addOption("newNote", t().settings.appearance.newNoteButtonModeNewNote)
					.addOption("searchOnline", t().settings.appearance.newNoteButtonModeSearchOnline)
					.setValue(s.newNoteButtonMode)
					.onChange(async (v) => {
						s.newNoteButtonMode = v as typeof s.newNoteButtonMode;
						this.save();
					});
			});

		this.newNoteSection(containerEl);
	}

	/**
	 * What the "New note" button makes (#227): its text, an optional Templater
	 * template, the folder the note lands in and the name it gets.
	 *
	 * Shown whatever the search-bar button is set to, because these settings
	 * also drive the search-bar card's button and Hearth's own "Create new note"
	 * command — a user who has switched the header button to "Search online"
	 * still has both of those.
	 */
	private newNoteSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const strings = t().settings.appearance;

		new Setting(containerEl)
			.setName(strings.newNoteHeading)
			.setDesc(strings.newNoteHeadingDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.newNoteButtonLabel)
			.setDesc(strings.newNoteButtonLabelDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(t().header.newNote)
					.setValue(s.newNoteButtonLabel)
					.onChange(async (v) => {
						s.newNoteButtonLabel = v;
						this.save();
					}),
			);

		// Say it here rather than leaving the user to wonder why picking a
		// template did nothing — the same courtesy the Templater card extends.
		const template = new Setting(containerEl)
			.setName(strings.newNoteTemplate)
			.setDesc(
				isTemplaterAvailable(this.plugin.app)
					? strings.newNoteTemplateDesc
					: strings.newNoteTemplaterMissing,
			);
		template.addButton((b) => {
			b.setButtonText(
				templateDisplayName(s.newNoteTemplate) || strings.newNoteTemplateNone,
			);
			b.setTooltip(strings.newNoteTemplatePick);
			b.onClick(() => {
				new FilePickerModal(
					this.plugin.app,
					(file) => {
						s.newNoteTemplate = file.path;
						this.save();
						this.rerender();
					},
					strings.newNoteTemplatePick,
					(file: TFile) => isTemplaterTemplate(this.plugin.app, file),
				).open();
			});
		});
		if (s.newNoteTemplate) {
			template.addExtraButton((b) =>
				b
					.setIcon("x")
					.setTooltip(strings.newNoteTemplateClear)
					.onClick(() => {
						s.newNoteTemplate = "";
						this.save();
						this.rerender();
					}),
			);
		}

		const folder = new Setting(containerEl)
			.setName(strings.newNoteFolder)
			.setDesc(strings.newNoteFolderDesc);
		folder.addButton((b) => {
			b.setButtonText(
				normalizeFolderPath(s.newNoteFolder) || t().cards.templater.vaultRoot,
			);
			b.onClick(() => {
				new FolderPickerModal(this.plugin.app, (picked) => {
					// The picker offers the root as "/", which normalizes to "" —
					// the same value as "wherever Obsidian puts new notes".
					s.newNoteFolder = normalizeFolderPath(picked.path);
					this.save();
					this.rerender();
				}).open();
			});
		});
		if (normalizeFolderPath(s.newNoteFolder)) {
			folder.addExtraButton((b) =>
				b
					.setIcon("x")
					.setTooltip(strings.newNoteFolderClear)
					.onClick(() => {
						s.newNoteFolder = "";
						this.save();
						this.rerender();
					}),
			);
		}

		const filename = new Setting(containerEl)
			.setName(strings.newNoteFilename)
			.setDesc(strings.newNoteFilenameDesc);
		filename.addText((txt) =>
			txt
				.setPlaceholder(strings.newNoteFilenamePlaceholder)
				.setValue(s.newNoteFilename)
				.onChange(async (v) => {
					s.newNoteFilename = v;
					this.save();
					destination.setDesc(this.newNoteDestination());
				}),
		);

		// The one thing the rows above can't show between them: where a click
		// actually puts the note.
		const destination = new Setting(containerEl).setDesc(this.newNoteDestination());
		destination.settingEl.addClass("hearth-setting-note");
	}

	/** One line spelling out the path the New-note button will write to. */
	private newNoteDestination(): string {
		const s = this.plugin.settings;
		return t().settings.appearance.newNoteDestination(
			destinationSummary(
				s.newNoteFolder,
				s.newNoteFilename,
				t().cards.templater.vaultRoot,
				// A template with no filename is Templater's to name; a blank note
				// with no filename is "Untitled". Both read as "Untitled" here.
				t().cards.templater.untitledNote,
			),
		);
	}

	// ---- Performance tier ------------------------------------------------

	/**
	 * The low power toggle and its backdrop colour.
	 *
	 * The mode is an override layer, not a bulk edit: turning it on writes only
	 * `lowPower`, and every resolver (`effectiveBackground`, `effectiveCardBlur`,
	 * `effectiveCardOpacity`, `effectiveAutoRefreshMinutes`) reports the low
	 * power value while it is set. So there is nothing to snapshot and nothing to
	 * restore — the sections it overrides keep their values, greyed out, and come
	 * back untouched the moment it is switched off.
	 */
	private performanceSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const strings = t().settings.performance;
		const tier = performanceTier(s);

		const label = tierLabels();

		new Setting(containerEl)
			.setName(strings.tier)
			.setDesc(strings.tierDesc)
			.addDropdown((d) => {
				for (const value of PERFORMANCE_TIERS) d.addOption(value, label[value]);
				d.setValue(tier).onChange(async (v) => {
					s.performanceTier = v as PerformanceTier;
					this.save();
					// The colour field, the effects list and the "overridden" notes
					// below all follow the selected tier.
					this.rerender();
				});
			});

		const chosen = new Setting(containerEl).setDesc(
			{
				full: strings.tierFullDesc,
				balanced: strings.tierBalancedDesc,
				reduced: strings.tierReducedDesc,
				minimal: strings.tierMinimalDesc,
			}[tier],
		);
		chosen.settingEl.addClass("hearth-setting-note");

		// Independent of the tier: this one is about *when* the board is worth
		// animating at all, not how much of it there is to animate.
		new Setting(containerEl)
			.setName(strings.pauseWhenUnfocused)
			.setDesc(strings.pauseWhenUnfocusedDesc)
			.addToggle((tg) =>
				tg.setValue(s.pauseWhenUnfocused).onChange(async (v) => {
					s.pauseWhenUnfocused = v;
					this.save();
				}),
			);

		if (tier === "minimal") {
			const color = new Setting(containerEl)
				.setName(strings.color)
				.setDesc(strings.colorDesc);
			color.addText((txt) => {
				txt.setPlaceholder(LOW_POWER_BACKGROUND)
					.setValue(s.lowPowerBackgroundColor)
					.onChange(async (v) => {
						s.lowPowerBackgroundColor = v;
						this.save();
					});
				this.addTextReset(color, txt, "lowPowerBackgroundColor");
			});
		}

		// What the selected tier actually does, spelled out. Built from the same
		// predicates the renderers use, so the list cannot drift from behaviour.
		const lines: string[] = [];
		if (skyDensity(s) < 1) lines.push(strings.effectSkyHalf);
		if (!motionAllowed(s)) {
			lines.push(strings.effectMotion, strings.effectClock, strings.effectSlideshow);
		}
		if (!frostAllowed(s)) lines.push(strings.effectFrost);
		if (lowPowerActive(s)) lines.push(strings.effectBackground, strings.effectOpaque);
		if (!timersAllowed(s)) lines.push(strings.effectRefresh, strings.effectLiveRefresh);
		if (lines.length === 0) return;

		const effects = new Setting(containerEl).setName(strings.effects);
		effects.settingEl.addClass("hearth-setting-note");
		const list = effects.descEl.createEl("ul", { cls: "hearth-setting-note-list" });
		for (const line of lines) list.createEl("li", { text: line });
	}

	/** Mark a section whose settings the performance tier is currently
	 * overriding: a note explaining that the controls still hold the user's
	 * values, and a class that dims them so it's obvious they aren't what's on
	 * screen right now. `active` is the caller's own test, because the tiers
	 * override different sections at different rungs. */
	private tierOverrideNote(containerEl: HTMLElement, active: boolean): void {
		if (!active) return;
		containerEl.addClass("hearth-settings-overridden");
		const note = new Setting(containerEl).setDesc(t().settings.performance.overridden);
		note.settingEl.addClass("hearth-setting-note");
		const icon = createSpan("hearth-setting-note-icon");
		setIcon(icon, "gauge");
		note.descEl.prepend(icon);
	}

	// ---- Background -----------------------------------------------------

	private backgroundSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		// Only the minimal tier replaces the backdrop; the tiers above it leave
		// the wallpaper exactly as configured.
		this.tierOverrideNote(containerEl, lowPowerActive(s));

		new Setting(containerEl)
			.setName(t().settings.background.type)
			.setDesc(t().settings.background.typeDesc)
			.addDropdown((d) => {
				(Object.keys(t().settings.background.labels) as BackgroundKind[]).forEach((k) => {
					d.addOption(k, t().settings.background.labels[k]);
				});
				d.setValue(s.backgroundKind).onChange((v) => {
					s.backgroundKind = v as BackgroundKind;
					// Opacity means different things to the two kinds of backdrop.
					// For a photo it is "dim this so the text on top reads", and
					// the default (0.35) is set for that. The weather sky is a
					// gradient, not a photo — dimmed that far it is a grey slab
					// with the weather invisible in it, and the contrast the
					// reader needs comes from the card surfaces instead. So lift
					// it once on the switch, only from a photo-ish value, with
					// the slider right below to put it back.
					if (v === "weather" && s.backgroundOpacity <= 0.5) {
						s.backgroundOpacity = 1;
					}
					void this.save();
					this.rerender();
				});
			});

		// The weather sky stores a place rather than a typed-in value, so it gets
		// the shared place picker instead of the text field below.
		if (s.backgroundKind === "weather") {
			this.weatherBackgroundSection(containerEl);
		}

		// "default", "none" and "weather" have no free-text value field; the rest do.
		if (
			s.backgroundKind !== "none" &&
			s.backgroundKind !== "default" &&
			s.backgroundKind !== "weather"
		) {
			const desc =
				s.backgroundKind === "color"
					? t().settings.background.valueColorDesc
					: s.backgroundKind === "image"
						? t().settings.background.valueImageDesc
						: t().settings.background.valueUrlDesc;
			const setting = new Setting(containerEl)
				.setName(t().settings.background.value)
				.setDesc(desc);
			setting.addText((txt) => {
				txt.setValue(s.backgroundValue).onChange(async (v) => {
					s.backgroundValue = v;
					this.save();
				});
				this.addTextReset(setting, txt, "backgroundValue");
			});
			if (s.backgroundKind === "image") {
				setting.controlEl
					.querySelector("input")
					?.setAttribute("list", "hearth-file-list");
			}
		}

		// Opacity/blur apply to every background except "none".
		if (s.backgroundKind !== "none") {
			const opacity = new Setting(containerEl)
				.setName(t().settings.background.opacity)
				.setDesc(t().settings.background.opacityDesc);
			opacity.addSlider((sl) => {
				sl.setLimits(0, 1, 0.05)
					.setValue(s.backgroundOpacity)
					.onChange(async (v) => {
						s.backgroundOpacity = v;
						this.save();
					});
				this.addSliderReset(opacity, sl, "backgroundOpacity");
			});

			const blur = new Setting(containerEl)
				.setName(t().settings.background.blur)
				.setDesc(t().settings.background.blurDesc);
			blur.addSlider((sl) => {
				sl.setLimits(0, 40, 1)
					.setValue(s.backgroundBlur)
					.onChange(async (v) => {
						s.backgroundBlur = v;
						this.save();
					});
				this.addSliderReset(blur, sl, "backgroundBlur");
			});

			this.bannerSection(containerEl);
		}
	}

	/**
	 * Where the background is painted: across the whole view, or as a banner
	 * strip at the top of the board. The banner's own shape (height, fade,
	 * width) only appears once it is the mode in force — there is nothing to
	 * tune about a strip that isn't being drawn.
	 */
	private bannerSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const strings = t().settings.background;

		new Setting(containerEl)
			.setName(strings.layout)
			.setDesc(strings.layoutDesc)
			.addDropdown((d) => {
				(Object.keys(strings.layoutLabels) as BackgroundLayout[]).forEach((k) => {
					d.addOption(k, strings.layoutLabels[k]);
				});
				d.setValue(s.backgroundLayout).onChange((v) => {
					s.backgroundLayout = v as BackgroundLayout;
					// A wallpaper is dimmed and softened so the board on top of it
					// stays readable — that is what the 0.35/2 defaults are for. A
					// banner has nothing on top of it: it is the picture itself, and
					// at those values it arrives as a grey smear. So lift it once on
					// the way in, only from wallpaper-ish values, with both sliders
					// right above to put it back.
					if (v === "banner") {
						if (s.backgroundOpacity <= 0.5) s.backgroundOpacity = 1;
						if (s.backgroundBlur > 0) s.backgroundBlur = 0;
					}
					void this.save();
					this.rerender();
				});
			});

		if (s.backgroundLayout !== "banner") return;

		const height = new Setting(containerEl)
			.setName(strings.bannerHeight)
			.setDesc(strings.bannerHeightDesc);
		height.addSlider((sl) => {
			sl.setLimits(BANNER_HEIGHT_MIN, BANNER_HEIGHT_MAX, 10)
				.setValue(clampBannerHeight(s.bannerHeight))
				.onChange(async (v) => {
					s.bannerHeight = v;
					this.save();
				});
			this.addSliderReset(height, sl, "bannerHeight");
		});

		new Setting(containerEl)
			.setName(strings.bannerFade)
			.setDesc(strings.bannerFadeDesc)
			.addToggle((tg) =>
				tg.setValue(s.bannerFade !== false).onChange(async (v) => {
					s.bannerFade = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(strings.bannerFullWidth)
			.setDesc(strings.bannerFullWidthDesc)
			.addToggle((tg) =>
				tg.setValue(s.bannerFullWidth === true).onChange(async (v) => {
					s.bannerFullWidth = v;
					this.save();
				}),
			);
	}

	/** The weather sky's own controls: where it is, and whether it moves. The
	 * place is stored packed into `backgroundValue` — the same field the other
	 * kinds use for a colour, a path or a URL. */
	private weatherBackgroundSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const strings = t().settings.background;
		const sky = parseSkyValue(s.backgroundValue);

		new Setting(containerEl).setName(strings.weatherHeading).setHeading();
		containerEl.createDiv({
			cls: "setting-item-description hearth-setting-note",
			text: sky ? strings.weatherDesc : `${strings.weatherNoPlace} ${strings.weatherDesc}`,
		});

		renderSkySource(containerEl, {
			current: sky,
			onChange: (next) => {
				s.backgroundValue = next ? formatSkyValue(next) : "";
				void this.save();
			},
			rerender: () => this.rerender(),
			disabled: s.disableExternalCalls,
			session: this.placeSession,
			suggestions: configuredPlaces(s),
		});

		new Setting(containerEl)
			.setName(strings.skyAnimate)
			.setDesc(strings.skyAnimateDesc)
			.addToggle((tg) =>
				tg.setValue(s.backgroundSkyAnimate !== false).onChange(async (v) => {
					s.backgroundSkyAnimate = v ? undefined : false;
					this.save();
				}),
			);
	}

	// ---- Startup & tabs -------------------------------------------------

	private startupSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.behaviour.openOnStartup)
			.setDesc(t().settings.behaviour.openOnStartupDesc)
			.addToggle((t) =>
				t.setValue(s.openOnStartup).onChange(async (v) => {
					s.openOnStartup = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.replaceNewTabs)
			.setDesc(t().settings.behaviour.replaceNewTabsDesc)
			.addToggle((t) =>
				t.setValue(s.replaceNewTabs).onChange(async (v) => {
					s.replaceNewTabs = v;
					this.save();
				}),
			);

		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName(t().settings.behaviour.focusSearchOnOpen)
				.setDesc(t().settings.behaviour.focusSearchOnOpenDesc)
				.addToggle((tg) =>
					tg.setValue(s.focusSearchOnOpen).onChange(async (v) => {
						s.focusSearchOnOpen = v;
						this.save();
					}),
				);
		}

		new Setting(containerEl)
			.setName(t().settings.behaviour.liveRefresh)
			.setDesc(t().settings.behaviour.liveRefreshDesc)
			.addToggle((tg) =>
				tg.setValue(s.liveRefresh).onChange(async (v) => {
					s.liveRefresh = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.liveSettingsSync)
			.setDesc(t().settings.behaviour.liveSettingsSyncDesc)
			.addToggle((tg) =>
				tg.setValue(s.liveSettingsSync).onChange(async (v) => {
					s.liveSettingsSync = v;
					this.save();
				}),
			);
	}

	// ---- Opening notes ---------------------------------------------------

	/**
	 * Where notes Hearth opens end up (#106). One dropdown decides it for
	 * everything; the per-source rows below it start on "Same as above", so the
	 * detail is there for anyone who wants a link to behave differently from a
	 * search hit without getting in the way of anyone who doesn't.
	 */
	private openingSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const labels = t().settings.behaviour.openInModes;

		new Setting(containerEl)
			.setName(t().settings.behaviour.openIn)
			.setDesc(t().settings.behaviour.openInDesc)
			.addDropdown((d) => {
				for (const mode of OPEN_IN_MODES) d.addOption(mode, labels[mode]);
				d.setValue(s.openIn).onChange(async (v) => {
					s.openIn = v as OpenIn;
					this.save();
				});
			});

		const sources = t().settings.behaviour.openInSources;
		const descKey = { link: "linkDesc", search: "searchDesc", card: "cardDesc", newNote: "newNoteDesc" } as const;
		for (const source of OPEN_SOURCES) {
			new Setting(containerEl)
				.setName(sources[source])
				.setDesc(sources[descKey[source]])
				.addDropdown((d) => {
					d.addOption("default", t().settings.behaviour.openInFollow);
					for (const mode of OPEN_IN_MODES) d.addOption(mode, labels[mode]);
					d.setValue(s.openInOverrides?.[source] ?? "default").onChange(async (v) => {
						// Rebuilt from the defaults so a settings file written before this
						// feature (or hand-edited into a partial map) ends up complete.
						const overrides = { ...DEFAULT_SETTINGS.openInOverrides, ...s.openInOverrides };
						overrides[source] = v as OpenInRule;
						s.openInOverrides = overrides;
						this.save();
					});
				});
		}

		// Not one of the four sources above: Obsidian, not Hearth, decides where
		// these land, and the only say Hearth has is whether its tab may be taken
		// over — so the choice is two-way, and it defaults to being taken over
		// (what Hearth has done since #84) rather than following the global
		// dropdown, which would change that for everyone on upgrade.
		const outside = t().settings.behaviour.openFromOutsideModes;
		new Setting(containerEl)
			.setName(t().settings.behaviour.openFromOutside)
			.setDesc(t().settings.behaviour.openFromOutsideDesc)
			.addDropdown((d) => {
				d.addOption("default", t().settings.behaviour.openInFollow);
				d.addOption("same", outside.same);
				d.addOption("tab", outside.tab);
				d.setValue(s.openFromOutside ?? "same").onChange(async (v) => {
					s.openFromOutside = v as OpenOutsideRule;
					this.save();
				});
			});
	}

	// ---- Privacy & network ----------------------------------------------

	private privacySection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.behaviour.disableExternalCalls)
			.setDesc(t().settings.behaviour.disableExternalCallsDesc)
			.addToggle((tg) =>
				tg.setValue(s.disableExternalCalls).onChange(async (v) => {
					s.disableExternalCalls = v;
					this.save();
				}),
			);
	}

	// ---- Mobile mode ----------------------------------------------------

	private mobileModeSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.behaviour.mobileSearchOnly)
			.setDesc(t().settings.behaviour.mobileSearchOnlyDesc)
			.addToggle((t) =>
				t.setValue(s.mobileSearchOnly).onChange(async (v) => {
					s.mobileSearchOnly = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.stackOnNarrow)
			.setDesc(t().settings.behaviour.stackOnNarrowDesc)
			.addToggle((tg) =>
				tg.setValue(s.stackOnNarrow).onChange(async (v) => {
					s.stackOnNarrow = v;
					this.save();
				}),
			);

		// The mobile performance tier lives here rather than beside the desktop
		// one: it is a mobile setting that happens to be about performance, and
		// this is the page someone opens when they are thinking about their phone.
		new Setting(containerEl)
			.setName(t().settings.behaviour.mobilePerformanceTier)
			.setDesc(t().settings.behaviour.mobilePerformanceTierDesc)
			.addDropdown((d) => {
				d.addOption("match", t().settings.behaviour.mobileTierMatch);
				const label = tierLabels();
				for (const tier of PERFORMANCE_TIERS) d.addOption(tier, label[tier]);
				d.setValue(s.mobilePerformanceTier).onChange(async (v) => {
					s.mobilePerformanceTier = v as HomeSettings["mobilePerformanceTier"];
					this.save();
				});
			});
	}

	// ---- Mobile action bar ----------------------------------------------

	private mobileActionsSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.mobileActions.showActionBar)
			.setDesc(t().settings.mobileActions.showActionBarDesc)
			.addToggle((t) =>
				t.setValue(s.showMobileActionBar).onChange(async (v) => {
					s.showMobileActionBar = v;
					this.save();
				}),
			);

		const buttons = s.mobileActionButtons;
		buttons.forEach((btn, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.labelPlaceholder).setValue(btn.label).onChange(async (v) => {
					btn.label = v;
					this.save();
				}),
			);
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.iconPlaceholder).setValue(btn.icon).onChange(async (v) => {
					btn.icon = v;
					this.save();
				}),
			);
			// A button can run a command, open a note/file, or open a URL — pick the
			// kind here, then the target control below swaps to match (a command
			// picker vs. a free-text path/URL field), exactly like a launchpad tile.
			row.addDropdown((d) => {
				(Object.keys(t().editors.linkTypes) as Array<"note" | "url" | "command">).forEach((k) => {
					d.addOption(k, t().editors.linkTypes[k]);
				});
				d.setValue(btn.type ?? "command").onChange((v) => {
					btn.type = v as MobileActionButton["type"];
					// Target semantics differ per type, so clear a stale target when
					// switching kinds.
					btn.target = "";
					void this.save();
					this.rerender();
				});
			});
			const currentTarget = btn.target ?? "";
			if ((btn.type ?? "command") === "command") {
				// Show a proper button labelled with the picked command (or a
				// prompt when none is set yet) instead of a tiny icon, so which
				// command a button runs — and how to change it — is always visible.
				row.addButton((b) => {
					const current = currentTarget
						? this.app.commands.listCommands().find((c) => c.id === currentTarget)
						: undefined;
					b.setButtonText(current ? current.name : t().settings.mobileActions.pickCommand);
					b.setTooltip(currentTarget ? t().settings.mobileActions.commandTooltip(currentTarget) : t().settings.mobileActions.pickCommand);
					b.onClick(() => {
						new CommandPickerModal(this.app, (command) => {
							btn.type = "command";
							btn.target = command.id;
							if (!btn.label.trim()) btn.label = command.name;
							void this.save();
							this.rerender();
						}).open();
					});
				});
			} else {
				row.addText((txt) =>
					txt
						.setPlaceholder(
							btn.type === "url" ? t().editors.links.targetUrl : t().editors.links.targetNote,
						)
						.setValue(currentTarget)
						.onChange(async (v) => {
							btn.target = v;
							this.save();
						}),
				);
			}
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().settings.mobileActions.moveUp)
					.setDisabled(index === 0)
					.onClick(() => this.moveMobileAction(buttons, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().settings.mobileActions.moveDown)
					.setDisabled(index === buttons.length - 1)
					.onClick(() => this.moveMobileAction(buttons, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().settings.mobileActions.removeButton)
					.onClick(async () => {
						buttons.splice(index, 1);
						this.save();
						this.rerender();
					}),
			);
		});

		new Setting(containerEl)
			.addButton((b) =>
				b.setButtonText(t().settings.mobileActions.addButton).onClick(async () => {
					// Add an empty button first; the row's type dropdown and target
					// control then let the user choose what it does — no forced
					// command pick up front.
					buttons.push({
						id: `action-${Date.now().toString(36)}`,
						label: "",
						icon: "circle",
						type: "command",
						target: "",
					});
					this.save();
					this.rerender();
				}),
			)
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.mobileActions.resetDefaults)
					.onClick(async () => {
						s.mobileActionButtons = defaultMobileActionButtons();
						this.save();
						this.rerender();
					}),
			);
	}

	/** Move a mobile action button within the list, then persist and redraw. */
	private moveMobileAction(arr: MobileActionButton[], from: number, to: number): void {
		if (to < 0 || to >= arr.length) return;
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		void this.save();
		this.rerender();
	}

	// ---- Integrations catalogue -------------------------------------------

	/**
	 * The full list of everything Hearth works with.
	 *
	 * Deliberately not filtered by what's installed: the point of the list is to
	 * answer "what does Hearth work with?" as much as "is it working?", so every
	 * entry in {@link INTEGRATIONS} renders, with a live status pill and a line
	 * saying where its settings are — including when the honest answer is "there
	 * aren't any" or "on the card". Integrations whose settings sit elsewhere
	 * (Omnisearch on the Search tab) get a button that jumps straight there.
	 */
	private integrationsCatalogue(containerEl: HTMLElement): void {
		const strings = t().settings.integrations;
		const groups: IntegrationGroup[] = ["plugin", "core", "service"];
		const groupDescKey = { plugin: "pluginDesc", core: "coreDesc", service: "serviceDesc" } as const;

		for (const group of groups) {
			const head = new Setting(containerEl)
				.setName(strings.groups[group])
				.setDesc(strings.groups[groupDescKey[group]])
				.setHeading();
			head.settingEl.addClass("hearth-integration-group");
			for (const entry of integrationsInGroup(group)) {
				this.integrationRow(containerEl, entry);
			}
		}
	}

	/** One catalogue row: name, status pill, what it does, where its settings
	 * are, and (where there is somewhere to go) a button that goes there. */
	private integrationRow(containerEl: HTMLElement, entry: IntegrationEntry): void {
		const strings = t().settings.integrations;
		const item = strings.items[entry.id];
		const status = integrationStatus(this.plugin.app, entry);

		const row = new Setting(containerEl).setName(item.name).setDesc(item.desc);
		row.settingEl.addClass("hearth-integration-row");

		// The pill sits with the name rather than in the control column, so the
		// row still reads as a sentence at narrow widths (and on mobile, where
		// Obsidian stacks name and control).
		const pill = row.nameEl.createSpan({
			cls: `hearth-integration-status is-${status}`,
			text: strings.status[status],
		});
		pill.setAttribute("aria-label", strings.statusTooltip[status]);
		pill.setAttribute("title", strings.statusTooltip[status]);

		row.descEl.createDiv({
			cls: "hearth-integration-where",
			text: this.integrationWhereText(entry),
		});

		// Not installed and installable — offer the community plugin browser.
		// Core plugins have no such URI, and their "where" line already says to
		// enable them in Obsidian's settings.
		if (entry.pluginId && status === "missing") {
			row.addButton((b) =>
				b
					.setButtonText(strings.install)
					.setTooltip(strings.installTooltip)
					.onClick(() => window.open(`obsidian://show-plugin?id=${entry.pluginId}`)),
			);
			return;
		}

		if (entry.where.kind === "section") {
			const section = entry.where.section;
			row.addButton((b) =>
				b.setButtonText(strings.goToSection).onClick(() => {
					this.revealSectionTitle = this.integrationSectionTitle(section);
					this.rerender();
				}),
			);
			return;
		}

		if (entry.where.kind === "tab") {
			const tab = entry.where.tab;
			row.addButton((b) => b.setButtonText(strings.goToTab).onClick(() => this.navigate(tab)));
		}
	}

	/** The "where are its settings" line for a catalogue row. */
	private integrationWhereText(entry: IntegrationEntry): string {
		const where = t().settings.integrations.where;
		switch (entry.where.kind) {
			case "section":
				return where.section;
			case "tab":
				return where.tab(t().settings.tabs[entry.where.tab]);
			case "card":
				return where.card;
			case "pluginSettings":
				return where.pluginSettings;
			case "none":
				return where.none;
		}
	}

	/** The heading of the collapsible section a catalogue row links down to —
	 * the same string `renderTabSections` passes to `section()`, which is what
	 * keys its collapsed state. */
	private integrationSectionTitle(section: IntegrationSectionId): string {
		return section === "tasks" ? t().settings.tasks.heading : t().settings.fileIcons.heading;
	}

	// ---- Tasks / TaskNotes ------------------------------------------------

	private tasksSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		const statusField = new Setting(containerEl)
			.setName(t().settings.tasks.statusField)
			.setDesc(t().settings.tasks.statusFieldDesc);
		statusField.addText((txt) => {
			txt.setValue(s.taskNotesStatusField).onChange(async (v) => {
				s.taskNotesStatusField = v;
				this.save();
			});
			this.addTextReset(statusField, txt, "taskNotesStatusField");
		});

		const dueField = new Setting(containerEl)
			.setName(t().settings.tasks.dueField)
			.setDesc(t().settings.tasks.dueFieldDesc);
		dueField.addText((txt) => {
			txt.setValue(s.taskNotesDueField).onChange(async (v) => {
				s.taskNotesDueField = v;
				this.save();
			});
			this.addTextReset(dueField, txt, "taskNotesDueField");
		});

		const priorityField = new Setting(containerEl)
			.setName(t().settings.tasks.priorityField)
			.setDesc(t().settings.tasks.priorityFieldDesc);
		priorityField.addText((txt) => {
			txt.setValue(s.taskNotesPriorityField).onChange(async (v) => {
				s.taskNotesPriorityField = v;
				this.save();
			});
			this.addTextReset(priorityField, txt, "taskNotesPriorityField");
		});

		const doneValue = new Setting(containerEl)
			.setName(t().settings.tasks.doneValue)
			.setDesc(t().settings.tasks.doneValueDesc);
		doneValue.addText((txt) => {
			txt.setValue(s.taskNotesDoneValue).onChange(async (v) => {
				s.taskNotesDoneValue = v;
				this.save();
			});
			this.addTextReset(doneValue, txt, "taskNotesDoneValue");
		});

		// The fields above say where a value is *read* from. The rest of this
		// section is about what tasks *show*, which is off until asked for: with
		// the switch off every tasks card renders exactly as it always has, and
		// the per-card controls stay hidden.
		new Setting(containerEl)
			.setName(t().settings.tasks.fieldsEnable)
			.setDesc(t().settings.tasks.fieldsEnableDesc)
			.addToggle((tog) =>
				tog.setValue(s.taskFieldsEnabled).onChange(async (v) => {
					s.taskFieldsEnabled = v;
					this.save();
					this.rerender();
				}),
			);

		if (!s.taskFieldsEnabled) return;

		const fields = new Setting(containerEl)
			.setName(t().settings.tasks.fields)
			.setDesc(t().settings.tasks.fieldsDesc);
		fields.addButton((b) =>
			b.setButtonText(t().editors.tasks.fieldsCustomize).onClick(() => {
				new TaskFieldsModal(this.app, null, s, s.taskFields, (next) => {
					s.taskFields = next;
					void this.save();
				}).open();
			}),
		);
		fields.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.tasks.fieldsReset)
				.onClick(async () => {
					s.taskFields = [];
					this.save();
				}),
		);
	}

	// ---- Operon ---------------------------------------------------------

	/** Which of Operon's states describes the connection right now, for the
	 * readout below. Reuses the same rules the cards branch on, so the settings
	 * pane and the dashboard never disagree about why nothing is showing. */
	private operonStatusText(state: OperonAccessState | "idle" | "off"): string {
		const s = t().settings.operon;
		switch (state) {
			case "unsupported":
				return s.statusUnsupported;
			case "booting":
				return s.statusBooting;
			case "pending":
				return s.statusPending;
			case "suspended":
				return s.statusSuspended;
			case "revoked":
				return s.statusRevoked;
			case "ready":
				return s.statusReady;
			case "idle":
				return s.statusIdle;
			case "off":
				return s.statusOff;
			case "error":
				return s.statusError;
			case "absent":
			default:
				return s.statusAbsent;
		}
	}

	private operonSection(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		const s = t().settings.operon;

		new Setting(containerEl)
			.setName(s.enable)
			.setDesc(s.enableDesc)
			.addToggle((tog) =>
				tog.setValue(settings.operonIntegration).onChange((v) => {
					settings.operonIntegration = v;
					// Drop any live session immediately, so turning the switch off
					// stops Hearth holding a handle to Operon rather than merely
					// hiding the cards.
					if (!v) this.plugin.operon.invalidate();
					this.save();
					this.rerender();
				}),
			);

		// Writes are their own decision. Operon grants all-or-nothing, so turning
		// this on widens what Hearth requests and needs a fresh approval in
		// Operon's settings — which is why it is never on by default and why the
		// session is dropped either way, so the next read renegotiates for the
		// new set instead of reusing a session with the old one.
		if (settings.operonIntegration) {
			new Setting(containerEl)
				.setName(s.writes)
				.setDesc(s.writesDesc)
				.addToggle((tog) =>
					tog.setValue(settings.operonWrites).onChange((v) => {
						settings.operonWrites = v;
						this.plugin.operon.invalidate();
						this.save();
						this.rerender();
					}),
				);
		}

		// Asking for the state is what opens a session, so ask only when the user
		// has opted in and Operon is actually there — otherwise merely opening
		// this pane would file a capability request nobody asked for. Read once
		// and derive everything below from it, so the status line and the
		// missing-capability list can never describe different attempts.
		const available = isOperonAvailable(this.plugin.app);
		const connected = settings.operonIntegration && available
			? this.plugin.operon.access()
			: null;
		const state: OperonAccessState | "idle" | "off" = connected
			? connected.state
			: !available
				? "absent"
				: settings.operonIntegration
					? "idle"
					: "off";

		const statusRow = new Setting(containerEl)
			.setName(s.status)
			.setDesc(this.operonStatusText(state));
		// Operon's own code and sentence, verbatim, whenever it gave one. This is
		// the only place the exact refusal is visible, and it is what makes a
		// problem reportable rather than guessable.
		if (connected?.error) {
			statusRow.descEl.createDiv({
				cls: "hearth-operon-caps-missing",
				text: `${s.detail}: ${connected.error.reasonCode ?? connected.error.code}${connected.error.reason ? ` — ${connected.error.reason}` : ""}`,
			});
		}

		const capabilities = new Setting(containerEl)
			.setName(s.capabilities)
			.setDesc(s.capabilitiesDesc);
		capabilities.controlEl.createDiv({
			cls: "hearth-operon-caps",
			// What Operon was actually sent, which widens with the writes
			// toggle — a list that always showed the reads would understate the
			// grant the user is being asked to approve.
			text: operonCapabilities(settings.operonWrites).join(", "),
		});
		// Approved for reads, but the writes the user asked for haven't been
		// granted: the cards read fine and simply offer no drag or "+", which is
		// confusing without saying why.
		if (settings.operonWrites && connected?.state === "ready" && !connected.canWrite) {
			capabilities.descEl.createDiv({
				cls: "hearth-operon-caps-missing",
				text: s.writesPending,
			});
		}
		// Only meaningful once a session has actually been attempted and came
		// back short of what was asked for.
		if (connected && connected.state !== "ready" && connected.missing.length > 0) {
			capabilities.descEl.createDiv({
				cls: "hearth-operon-caps-missing",
				text: s.missing(connected.missing.join(", ")),
			});
		}

		new Setting(containerEl)
			.setName(s.recheck)
			.setDesc(s.recheckDesc)
			.addButton((btn) =>
				btn.setButtonText(s.recheckAction).onClick(() => {
					this.plugin.operon.invalidate();
					new Notice(t().notices.operonRechecked);
					this.rerender();
				}),
			);

		if (!available) {
			const link = containerEl.createEl("a", {
				cls: "hearth-operon-install",
				text: s.install,
				href: `obsidian://show-plugin?id=${OPERON_PLUGIN_ID}`,
			});
			link.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(link.href);
			});
		}
	}

	// ---- File icons (Iconic / Iconize) ----------------------------------

	private fileIconsSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.fileIcons.enable)
			.setDesc(
				hasFileIconPlugin(this.plugin.app)
					? t().settings.fileIcons.enableDesc
					: t().settings.fileIcons.enableDescNoPlugin,
			)
			.addToggle((tog) =>
				tog.setValue(s.customFileIcons).onChange(async (v) => {
					s.customFileIcons = v;
					this.save();
				}),
			);

		const property = new Setting(containerEl)
			.setName(t().settings.fileIcons.property)
			.setDesc(t().settings.fileIcons.propertyDesc);
		property.addText((txt) => {
			txt.setValue(s.iconizeIconProperty).onChange(async (v) => {
				s.iconizeIconProperty = v;
				this.save();
			});
			this.addTextReset(property, txt, "iconizeIconProperty");
		});
	}

	// ---- Filters --------------------------------------------------------

	private filtersSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const hidden = new Set(s.hiddenFilters);

		for (const group of FILE_TYPE_GROUPS) {
			new Setting(containerEl)
				.setName(fileTypeLabel(group))
				.addToggle((t) =>
					t.setValue(!hidden.has(group.id)).onChange(async (v) => {
						if (v) hidden.delete(group.id);
						else hidden.add(group.id);
						s.hiddenFilters = Array.from(hidden);
						this.save();
					}),
				);
		}
	}

	// ---- Dashboard: grid & spacing --------------------------------------

	private gridSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.dashboard.fitToPage)
			.setDesc(t().settings.dashboard.fitToPageDesc)
			.addToggle((t) =>
				t.setValue(s.fitToPage).onChange(async (v) => {
					s.fitToPage = v;
					this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.dashboard.compact)
			.setDesc(t().settings.dashboard.compactDesc)
			.addToggle((t) =>
				t.setValue(s.compact).onChange(async (v) => {
					s.compact = v;
					this.save();
				}),
			);
	}

	// ---- Dashboard: UI controls -----------------------------------------

	private dashboardControlsSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const labels = t().settings.dashboard.visibilityOptions;

		new Setting(containerEl)
			.setName(t().settings.dashboard.arrangeButtonVisibility)
			.setDesc(t().settings.dashboard.arrangeButtonVisibilityDesc)
			.addDropdown((d) => {
				d.addOption("always", labels.always)
					.addOption("hover", labels.hover)
					.setValue(s.arrangeButtonVisibility === "hover" ? "hover" : "always")
					.onChange(async (v) => {
						s.arrangeButtonVisibility = v as HomeSettings["arrangeButtonVisibility"];
						this.save();
					});
			});

		new Setting(containerEl)
			.setName(t().settings.dashboard.dashboardSwitcherVisibility)
			.setDesc(t().settings.dashboard.dashboardSwitcherVisibilityDesc)
			.addDropdown((d) => {
				d.addOption("always", labels.always)
					.addOption("hover", labels.hover)
					.setValue(s.dashboardSwitcherVisibility === "hover" ? "hover" : "always")
					.onChange(async (v) => {
						s.dashboardSwitcherVisibility = v as HomeSettings["dashboardSwitcherVisibility"];
						this.save();
					});
			});
	}

	// ---- Dashboard: card surface (opacity / blur) -----------------------

	private cardSurfaceSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		// Radius and border width below are untouched by the tier; blur is dropped
		// from `reduced` down and opacity on `minimal`, hence the note covering
		// the section as soon as either applies.
		this.tierOverrideNote(containerEl, !frostAllowed(s) || lowPowerActive(s));

		const cardOpacity = new Setting(containerEl)
			.setName(t().settings.dashboard.cardOpacity)
			.setDesc(t().settings.dashboard.cardOpacityDesc);
		cardOpacity.addSlider((sl) => {
			sl.setLimits(0, 1, 0.05)
				.setValue(s.cardOpacity)
				.onChange(async (v) => {
					s.cardOpacity = v;
					this.save();
				});
			this.addSliderReset(cardOpacity, sl, "cardOpacity");
		});

		const cardBlur = new Setting(containerEl)
			.setName(t().settings.dashboard.cardBlur)
			.setDesc(t().settings.dashboard.cardBlurDesc);
		cardBlur.addSlider((sl) => {
			sl.setLimits(0, 24, 1)
				.setValue(s.cardBlur)
				.onChange(async (v) => {
					s.cardBlur = v;
					this.save();
				});
			this.addSliderReset(cardBlur, sl, "cardBlur");
		});

		const cardRadius = new Setting(containerEl)
			.setName(t().settings.dashboard.cardRadius)
			.setDesc(t().settings.dashboard.cardRadiusDesc);
		cardRadius.addSlider((sl) => {
			// Capped at the design baseline (14): only sharper corners are offered,
			// since rounding beyond it was never tuned for.
			sl.setLimits(0, DEFAULT_SETTINGS.cardRadius, 1)
				.setValue(s.cardRadius)
				.onChange(async (v) => {
					s.cardRadius = v;
					this.save();
				});
			this.addSliderReset(cardRadius, sl, "cardRadius");
		});

		const cardBorderWidth = new Setting(containerEl)
			.setName(t().settings.dashboard.cardBorderWidth)
			.setDesc(t().settings.dashboard.cardBorderWidthDesc);
		cardBorderWidth.addSlider((sl) => {
			sl.setLimits(0, CARD_BORDER_WIDTH_MAX, 1)
				.setValue(s.cardBorderWidth)
				.onChange(async (v) => {
					s.cardBorderWidth = v;
					this.save();
				});
			this.addSliderReset(cardBorderWidth, sl, "cardBorderWidth");
		});
	}

	// ---- Layout import / export ----------------------------------------

	/**
	 * The four export/import rows, all on the portable-package engine (see
	 * `src/portable/`).
	 *
	 * The dashboard row is the one that's new, and it comes first because it is
	 * the one most people want: a single board, carrying its whole look, that
	 * lands in someone else's vault without replacing anything. The two
	 * whole-vault rows below it are the backups, and only those are destructive
	 * — which is why only those wear the danger styling.
	 */
	private layoutSection(containerEl: HTMLElement): void {
		const strings = t().settings.layout;

		// Export the active dashboard on its own.
		new Setting(containerEl)
			.setName(strings.exportDashboard)
			.setDesc(strings.exportDashboardDesc)
			.addButton((b) =>
				b
					.setButtonText(strings.exportDashboardButton)
					.onClick(() =>
						openExportDashboard(this.plugin, activeDashboard(this.plugin.settings)),
					),
			);

		// Import anything: one board, a layout, or a full backup. The dialog
		// reads the file and offers only the modes that make sense for it.
		new Setting(containerEl)
			.setName(strings.importAny)
			.setDesc(strings.importAnyDesc)
			.addButton((b) =>
				b.setButtonText(strings.importButton).onClick(() => void pickAndImport(this.plugin)),
			);

		// Export the whole dashboard setup as a JSON file.
		new Setting(containerEl)
			.setName(strings.export)
			.setDesc(strings.exportDesc)
			.addButton((b) => this.exportButton(b, () => exportLayout(this.plugin)));

		// Export every Hearth setting as a JSON file.
		new Setting(containerEl)
			.setName(strings.exportSettings)
			.setDesc(strings.exportSettingsDesc)
			.addButton((b) => this.exportButton(b, () => exportSettings(this.plugin)));
	}

	/** Wire an export button. `run` is called at click time so it always
	 * serializes the current settings. On mobile, where a browser download can't
	 * be triggered, the file is written to the vault root instead and the button
	 * carries a tooltip saying so. */
	private exportButton(b: ButtonComponent, run: () => Promise<void>): void {
		b.setButtonText(t().settings.layout.exportButton);
		if (Platform.isMobile) b.setTooltip(t().settings.layout.exportMobileTooltip);
		b.onClick(() => void run());
	}

	// ---- About ----------------------------------------------------------

	/** Project links, a low-key Ko-fi tip button, and the running version. */
	private aboutSection(containerEl: HTMLElement): void {
		const about = t().settings.about;

		// Grouped like every other page, rather than as bare rows: the section
		// heading replaces what used to be a `setHeading()` row of its own.
		this.section(containerEl, about.heading, about.headingDesc, (body) => {
			// First in the list: the row a user who skipped the first-run wizard —
			// or who simply wants another board — comes here looking for.
			//
			// Always `forceNewDashboard`: from settings the wizard is a board
			// *generator*, not a reset. Every dashboard that already exists is
			// left untouched and the result arrives as a new one in the switcher,
			// so this row can be pressed to see what it would make without any
			// risk to work already done.
			const skipped = this.plugin.settings.setupStatus !== "done";
			new Setting(body)
				.setName(skipped ? about.setup : about.setupAgain)
				.setDesc(skipped ? about.setupDesc : about.setupAgainDesc)
				.addButton((b) =>
					this.aboutButton(b, "wand-2", about.setupButton, () =>
						openSetupWizard(this.plugin, { forceNewDashboard: true }),
					),
				);

			new Setting(body)
				.setName(about.whatsNew)
				.setDesc(about.whatsNewDesc)
				.addButton((b) =>
					this.aboutButton(b, "sparkles", about.whatsNewButton, () =>
						new WhatsNewModal(this.app, CHANGELOG).open(),
					),
				);

			new Setting(body)
				.setName(about.github)
				.setDesc(about.githubDesc)
				.addButton((b) => this.linkButton(b, "github", about.githubButton, GITHUB_URL));

			new Setting(body)
				.setName(about.reportIssue)
				.setDesc(about.reportIssueDesc)
				.addButton((b) =>
					this.linkButton(b, "bug", about.reportIssueButton, GITHUB_ISSUES_URL),
				);

			new Setting(body)
				.setName(about.kofi)
				.setDesc(about.kofiDesc)
				.addButton((b) => kofiTipButton(b));

			new Setting(body)
				.setName(about.version(this.plugin.manifest.version))
				.setDesc(about.versionDesc);
		});
	}

	/** A button that shows an icon *and* a label (Obsidian's setButtonText wipes a
	 * setIcon, so the content is built by hand), runs `onClick`, and carries an
	 * optional tooltip. */
	private aboutButton(
		b: ButtonComponent,
		icon: string,
		label: string,
		onClick: () => void,
		tooltip?: string,
	): void {
		b.onClick(onClick);
		if (tooltip) b.setTooltip(tooltip);
		const el = b.buttonEl;
		el.empty();
		el.addClass("hearth-about-btn");
		setIcon(el.createSpan("hearth-about-btn-icon"), icon);
		el.createSpan({ text: label });
	}

	/** An {@link aboutButton} that opens `url` in the browser. */
	private linkButton(b: ButtonComponent, icon: string, label: string, url: string): void {
		this.aboutButton(b, icon, label, () => window.open(url, "_blank"), url);
	}
}
