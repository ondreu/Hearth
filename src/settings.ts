import { type App, type ButtonComponent, Notice, Platform, PluginSettingTab, setIcon, Setting, type SettingDefinitionItem, type SliderComponent, type TextComponent, TFile } from "obsidian";
import type HearthPlugin from "./main";
import { TaskFieldsModal } from "./cards/tasks";
import { hasFileIconPlugin } from "./fileicons";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { CommandPickerModal } from "./pickers";
import { configuredPlaces, renderSkySource } from "./placepicker";
import { type BackgroundKind, CARD_BORDER_WIDTH_MAX, DEFAULT_SETTINGS, defaultMobileActionButtons, type HomeSettings, LOW_POWER_BACKGROUND, type MobileActionButton, OPEN_IN_MODES, OPEN_SOURCES, type OpenIn, type OpenInRule, type OpenOutsideRule } from "./types";
import { exportLayout, exportSettings, importLayout, importSettings } from "./layout";
import { confirmAction, downloadTextFile, makeClickable, pickTextFile } from "./ui";
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
import { CHANGELOG, WhatsNewModal } from "./whatsnew";
import { t } from "./i18n";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a number —
 * used to reset slider-backed settings back to their factory value. */
type NumericSettingKey =
	| "maxWidth"
	| "backgroundOpacity"
	| "backgroundBlur"
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
	| "logo"
	| "searchPlaceholder"
	| "backgroundValue"
	| "lowPowerBackgroundColor"
	| "taskNotesStatusField"
	| "taskNotesDueField"
	| "taskNotesPriorityField"
	| "taskNotesDoneValue"
	| "iconizeIconProperty";

/** The GitHub repository and support links surfaced in the About tab. */
const GITHUB_URL = "https://github.com/ondreu/hearth";
const GITHUB_ISSUES_URL = "https://github.com/ondreu/hearth/issues/new";
const KOFI_URL = "https://ko-fi.com/ondru";

/** Download filenames for the JSON exports. */
const LAYOUT_FILE = "hearth-layout.json";
const SETTINGS_FILE = "hearth-settings.json";

/** A tab in the settings ribbon: an id (keys `t().settings.tabs`, declared in
 * `integrations.ts` so the catalogue can point at one) and a Lucide icon shown
 * beside the label. */
const SETTINGS_TABS: { id: SettingsTabId; icon: string }[] = [
	{ id: "appearance", icon: "palette" },
	{ id: "search", icon: "search" },
	{ id: "dashboard", icon: "layout-dashboard" },
	{ id: "behaviour", icon: "settings-2" },
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
	{ id: "howItWorks", tabs: ["search", "behaviour"] },
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

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
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

	/** Temporary #52 diagnostic state — see getSettingDefinitions. */
	private loggedDefinitionsQuery = false;

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
		// Temporary #52 diagnostic: Obsidian 1.13+ calls this once when the tab
		// is added to the settings modal (for search indexing) and again per
		// display cycle; pre-1.13 never calls it. One log on the first call
		// closes the gap between the load log in main.ts and the render-path
		// warns below — "queried but never rendered" (this line without a
		// render line) is otherwise indistinguishable from "old Obsidian,
		// display() pipeline". Remove with the other #52 warns.
		if (!this.loggedDefinitionsQuery) {
			this.loggedDefinitionsQuery = true;
			console.warn(
				`Hearth ${this.plugin.manifest.version}: settings tab queried on the 1.13 definitions pipeline`,
			);
		}
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
					// Temporary #52 diagnostic: names the render path in the
					// console of whichever window hosts settings. Remove once
					// the blank-pane report is confirmed fixed.
					console.warn(
						`Hearth ${this.plugin.manifest.version}: rendering settings via setting definitions (Obsidian 1.13+)`,
					);
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
		// Temporary #52 diagnostic — see getSettingDefinitions above.
		console.warn(
			`Hearth ${this.plugin.manifest.version}: rendering settings via legacy display()`,
		);
		this.renderInto(this.containerEl);
	}

	/** Re-render the pane in place after a state change (tab switch, list
	 * mutation, import) — into whichever element the pane currently lives in. */
	private rerender(): void {
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
				this.section(body, s.sections.lowPower, s.sections.lowPowerDesc, (b) =>
					this.lowPowerSection(b),
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
				this.section(body, s.sections.mobileMode, s.sections.mobileModeDesc, (b) =>
					this.mobileModeSection(b),
				);
				this.section(body, s.mobileActions.heading, s.mobileActions.headingDesc, (b) =>
					this.mobileActionsSection(b),
				);
				this.section(body, s.sections.privacy, s.sections.privacyDesc, (b) =>
					this.privacySection(b),
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
	 * the slider's own dynamic tooltip (see the sliders below). */
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
					await this.save();
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
					await this.save();
				}),
		);
	}

	// ---- Home (title, logo, width) --------------------------------------

	private homeSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.appearance.showTitle)
			.setDesc(t().settings.appearance.showTitleDesc)
			.addToggle((t) =>
				t.setValue(s.showTitle).onChange(async (v) => {
					s.showTitle = v;
					await this.save();
				}),
			);

		const title = new Setting(containerEl)
			.setName(t().settings.appearance.title)
			.setDesc(t().settings.appearance.titleDesc);
		title.addText((txt) => {
			txt.setValue(s.title).onChange(async (v) => {
				s.title = v;
				await this.save();
			});
			this.addTextReset(title, txt, "title");
		});

		const logo = new Setting(containerEl)
			.setName(t().settings.appearance.logo)
			.setDesc(t().settings.appearance.logoDesc);
		logo.addText((txt) => {
			txt.setValue(s.logo).onChange(async (v) => {
				s.logo = v;
				await this.save();
			});
			this.addTextReset(logo, txt, "logo");
		});

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
						await this.save();
						this.plugin.refreshBrandIcons();
					}),
			);

		const width = new Setting(containerEl)
			.setName(t().settings.appearance.contentWidth)
			.setDesc(t().settings.appearance.contentWidthDesc);
		width.addSlider((sl) => {
			sl.setLimits(700, 1600, 20)
				.setValue(s.maxWidth)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.maxWidth = v;
					await this.save();
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
				await this.save();
			});
			this.addTextReset(searchPlaceholder, txt, "searchPlaceholder");
		});

		new Setting(containerEl)
			.setName(t().settings.appearance.searchContents)
			.setDesc(t().settings.appearance.searchContentsDesc)
			.addToggle((t) =>
				t.setValue(s.searchContents).onChange(async (v) => {
					s.searchContents = v;
					await this.save();
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
							await this.save();
							return;
						}
						s.searchEngine = engine;
						await this.save();
					});
			});

		new Setting(containerEl)
			.setName(t().settings.appearance.showNewNoteButton)
			.setDesc(t().settings.appearance.showNewNoteButtonDesc)
			.addToggle((t) =>
				t.setValue(s.showNewNoteButton).onChange(async (v) => {
					s.showNewNoteButton = v;
					await this.save();
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
						await this.save();
					});
			});
	}

	// ---- Low power mode --------------------------------------------------

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
	private lowPowerSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;
		const strings = t().settings.lowPower;

		new Setting(containerEl)
			.setName(strings.enable)
			.setDesc(strings.enableDesc)
			.addToggle((tg) =>
				tg.setValue(s.lowPower).onChange(async (v) => {
					s.lowPower = v;
					await this.save();
					// The colour field and the "overridden" notes below appear and
					// disappear with the toggle.
					this.rerender();
				}),
			);

		if (!s.lowPower) return;

		const color = new Setting(containerEl)
			.setName(strings.color)
			.setDesc(strings.colorDesc);
		color.addText((txt) => {
			txt.setPlaceholder(LOW_POWER_BACKGROUND)
				.setValue(s.lowPowerBackgroundColor)
				.onChange(async (v) => {
					s.lowPowerBackgroundColor = v;
					await this.save();
				});
			this.addTextReset(color, txt, "lowPowerBackgroundColor");
		});

		const effects = new Setting(containerEl).setName(strings.effects);
		effects.settingEl.addClass("hearth-setting-note");
		const list = effects.descEl.createEl("ul", { cls: "hearth-setting-note-list" });
		for (const line of [
			strings.effectBackground,
			strings.effectFrost,
			strings.effectMotion,
			strings.effectRefresh,
			strings.effectLiveRefresh,
			strings.effectClock,
		]) {
			list.createEl("li", { text: line });
		}
	}

	/** Mark a section whose settings low power mode is currently overriding: a
	 * note explaining that the controls still hold the user's values, and a class
	 * that dims them so it's obvious they aren't what's on screen right now. */
	private lowPowerOverrideNote(containerEl: HTMLElement): void {
		if (!this.plugin.settings.lowPower) return;
		containerEl.addClass("hearth-settings-overridden");
		const note = new Setting(containerEl).setDesc(t().settings.lowPower.overridden);
		note.settingEl.addClass("hearth-setting-note");
		const icon = createSpan("hearth-setting-note-icon");
		setIcon(icon, "gauge");
		note.descEl.prepend(icon);
	}

	// ---- Background -----------------------------------------------------

	private backgroundSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		this.lowPowerOverrideNote(containerEl);

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
					await this.save();
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
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.backgroundOpacity = v;
						await this.save();
					});
				this.addSliderReset(opacity, sl, "backgroundOpacity");
			});

			const blur = new Setting(containerEl)
				.setName(t().settings.background.blur)
				.setDesc(t().settings.background.blurDesc);
			blur.addSlider((sl) => {
				sl.setLimits(0, 40, 1)
					.setValue(s.backgroundBlur)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.backgroundBlur = v;
						await this.save();
					});
				this.addSliderReset(blur, sl, "backgroundBlur");
			});
		}
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
					await this.save();
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
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.replaceNewTabs)
			.setDesc(t().settings.behaviour.replaceNewTabsDesc)
			.addToggle((t) =>
				t.setValue(s.replaceNewTabs).onChange(async (v) => {
					s.replaceNewTabs = v;
					await this.save();
				}),
			);

		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName(t().settings.behaviour.focusSearchOnOpen)
				.setDesc(t().settings.behaviour.focusSearchOnOpenDesc)
				.addToggle((tg) =>
					tg.setValue(s.focusSearchOnOpen).onChange(async (v) => {
						s.focusSearchOnOpen = v;
						await this.save();
					}),
				);
		}

		new Setting(containerEl)
			.setName(t().settings.behaviour.liveRefresh)
			.setDesc(t().settings.behaviour.liveRefreshDesc)
			.addToggle((tg) =>
				tg.setValue(s.liveRefresh).onChange(async (v) => {
					s.liveRefresh = v;
					await this.save();
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
					await this.save();
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
						await this.save();
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
					await this.save();
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
					await this.save();
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
					await this.save();
				}),
			);
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
					await this.save();
				}),
			);

		const buttons = s.mobileActionButtons;
		buttons.forEach((btn, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.labelPlaceholder).setValue(btn.label).onChange(async (v) => {
					btn.label = v;
					await this.save();
				}),
			);
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.iconPlaceholder).setValue(btn.icon).onChange(async (v) => {
					btn.icon = v;
					await this.save();
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
							await this.save();
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
						await this.save();
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
					await this.save();
					this.rerender();
				}),
			)
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.mobileActions.resetDefaults)
					.onClick(async () => {
						s.mobileActionButtons = defaultMobileActionButtons();
						await this.save();
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
				await this.save();
			});
			this.addTextReset(statusField, txt, "taskNotesStatusField");
		});

		const dueField = new Setting(containerEl)
			.setName(t().settings.tasks.dueField)
			.setDesc(t().settings.tasks.dueFieldDesc);
		dueField.addText((txt) => {
			txt.setValue(s.taskNotesDueField).onChange(async (v) => {
				s.taskNotesDueField = v;
				await this.save();
			});
			this.addTextReset(dueField, txt, "taskNotesDueField");
		});

		const priorityField = new Setting(containerEl)
			.setName(t().settings.tasks.priorityField)
			.setDesc(t().settings.tasks.priorityFieldDesc);
		priorityField.addText((txt) => {
			txt.setValue(s.taskNotesPriorityField).onChange(async (v) => {
				s.taskNotesPriorityField = v;
				await this.save();
			});
			this.addTextReset(priorityField, txt, "taskNotesPriorityField");
		});

		const doneValue = new Setting(containerEl)
			.setName(t().settings.tasks.doneValue)
			.setDesc(t().settings.tasks.doneValueDesc);
		doneValue.addText((txt) => {
			txt.setValue(s.taskNotesDoneValue).onChange(async (v) => {
				s.taskNotesDoneValue = v;
				await this.save();
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
					await this.save();
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
					await this.save();
				}),
		);
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
					await this.save();
				}),
			);

		const property = new Setting(containerEl)
			.setName(t().settings.fileIcons.property)
			.setDesc(t().settings.fileIcons.propertyDesc);
		property.addText((txt) => {
			txt.setValue(s.iconizeIconProperty).onChange(async (v) => {
				s.iconizeIconProperty = v;
				await this.save();
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
						await this.save();
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
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.dashboard.compact)
			.setDesc(t().settings.dashboard.compactDesc)
			.addToggle((t) =>
				t.setValue(s.compact).onChange(async (v) => {
					s.compact = v;
					await this.save();
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
						await this.save();
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
						await this.save();
					});
			});
	}

	// ---- Dashboard: card surface (opacity / blur) -----------------------

	private cardSurfaceSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		// Radius and border width below are untouched by low power mode; opacity
		// and blur are, hence the note covering the section.
		this.lowPowerOverrideNote(containerEl);

		const cardOpacity = new Setting(containerEl)
			.setName(t().settings.dashboard.cardOpacity)
			.setDesc(t().settings.dashboard.cardOpacityDesc);
		cardOpacity.addSlider((sl) => {
			sl.setLimits(0, 1, 0.05)
				.setValue(s.cardOpacity)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.cardOpacity = v;
					await this.save();
				});
			this.addSliderReset(cardOpacity, sl, "cardOpacity");
		});

		const cardBlur = new Setting(containerEl)
			.setName(t().settings.dashboard.cardBlur)
			.setDesc(t().settings.dashboard.cardBlurDesc);
		cardBlur.addSlider((sl) => {
			sl.setLimits(0, 24, 1)
				.setValue(s.cardBlur)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.cardBlur = v;
					await this.save();
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
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.cardRadius = v;
					await this.save();
				});
			this.addSliderReset(cardRadius, sl, "cardRadius");
		});

		const cardBorderWidth = new Setting(containerEl)
			.setName(t().settings.dashboard.cardBorderWidth)
			.setDesc(t().settings.dashboard.cardBorderWidthDesc);
		cardBorderWidth.addSlider((sl) => {
			sl.setLimits(0, CARD_BORDER_WIDTH_MAX, 1)
				.setValue(s.cardBorderWidth)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.cardBorderWidth = v;
					await this.save();
				});
			this.addSliderReset(cardBorderWidth, sl, "cardBorderWidth");
		});
	}

	// ---- Layout import / export ----------------------------------------

	private layoutSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		// Export the current dashboard layout as a JSON file.
		new Setting(containerEl)
			.setName(t().settings.layout.export)
			.setDesc(t().settings.layout.exportDesc)
			.addButton((b) =>
				this.exportButton(b, LAYOUT_FILE, () => exportLayout(s), t().notices.layoutExported),
			);

		// Import a dashboard layout from a chosen JSON file.
		new Setting(containerEl)
			.setName(t().settings.layout.import)
			.setDesc(t().settings.layout.importDesc)
			.addButton((b) => {
				b.buttonEl.addClass("hearth-danger-btn");
				b.setButtonText(t().settings.layout.importButton).onClick(() =>
					this.importFromFile({
						title: t().settings.layout.importTitle,
						message: t().settings.layout.importMessage,
						apply: (json) => importLayout(s, json),
						imported: t().notices.layoutImported,
					}),
				);
			});

		// Export every Hearth setting as a JSON file.
		new Setting(containerEl)
			.setName(t().settings.layout.exportSettings)
			.setDesc(t().settings.layout.exportSettingsDesc)
			.addButton((b) =>
				this.exportButton(b, SETTINGS_FILE, () => exportSettings(s), t().notices.settingsExported),
			);

		// Import a full settings backup from a chosen JSON file.
		new Setting(containerEl)
			.setName(t().settings.layout.importSettings)
			.setDesc(t().settings.layout.importSettingsDesc)
			.addButton((b) => {
				b.buttonEl.addClass("hearth-danger-btn");
				b.setButtonText(t().settings.layout.importButton).onClick(() =>
					this.importFromFile({
						title: t().settings.layout.importSettingsTitle,
						message: t().settings.layout.importSettingsMessage,
						apply: (json) => importSettings(s, json),
						imported: t().notices.settingsImported,
					}),
				);
			});
	}

	/** Wire an export button. `build` is called at click time so it always
	 * serializes the current settings. On mobile, where a browser download can't
	 * be triggered, the file is written to the vault root instead and the button
	 * carries a tooltip saying so. */
	private exportButton(
		b: ButtonComponent,
		filename: string,
		build: () => string,
		desktopNotice: string,
	): void {
		b.setButtonText(t().settings.layout.exportButton);
		if (Platform.isMobile) b.setTooltip(t().settings.layout.exportMobileTooltip);
		b.onClick(() => void this.exportJson(filename, build(), desktopNotice));
	}

	/** Save an export: download it (desktop) or write it to the vault root
	 * (mobile, which can't download). */
	private async exportJson(filename: string, content: string, desktopNotice: string): Promise<void> {
		if (Platform.isMobile) {
			try {
				await this.saveToVaultRoot(filename, content);
				new Notice(t().notices.exportedToVault(filename));
			} catch {
				new Notice(t().notices.exportFailed);
			}
			return;
		}
		downloadTextFile(filename, content);
		new Notice(desktopNotice);
	}

	/** Create (or overwrite) a file at the vault root. */
	private async saveToVaultRoot(filename: string, content: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(filename);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
		} else {
			await this.app.vault.create(filename, content);
		}
	}

	/** Shared flow for the file-based imports: pick a JSON file, confirm the
	 * destructive replace, then apply it. `apply` returns an error string or null. */
	private async importFromFile(opts: {
		title: string;
		message: string;
		apply: (json: string) => string | null;
		imported: string;
	}): Promise<void> {
		const json = await pickTextFile();
		if (json === null) return; // cancelled or unreadable
		confirmAction(this.app, {
			title: opts.title,
			message: opts.message,
			confirmText: t().settings.layout.importButton,
			onConfirm: () => {
				const error = opts.apply(json);
				if (error) {
					new Notice(t().notices.layoutImportError(error));
					return;
				}
				void this.save();
				this.rerender();
				new Notice(opts.imported);
			},
		});
	}

	// ---- About ----------------------------------------------------------

	/** Project links, a low-key Ko-fi tip button, and the running version. */
	private aboutSection(containerEl: HTMLElement): void {
		const about = t().settings.about;

		// Grouped like every other page, rather than as bare rows: the section
		// heading replaces what used to be a `setHeading()` row of its own.
		this.section(containerEl, about.heading, about.headingDesc, (body) => {
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
				.addButton((b) => {
					this.linkButton(b, "coffee", about.kofiButton, KOFI_URL);
					b.buttonEl.addClass("hearth-kofi-btn");
				});

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
