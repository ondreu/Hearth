import { App, ButtonComponent, Notice, Platform, PluginSettingTab, setIcon, Setting, SliderComponent, TextComponent, TFile } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { CommandPickerModal } from "./pickers";
import { BackgroundKind, DEFAULT_SETTINGS, defaultMobileActionButtons, HomeSettings, MobileActionButton } from "./types";
import { exportLayout, exportSettings, importLayout, importSettings } from "./layout";
import { confirmAction, downloadTextFile, pickTextFile } from "./ui";
import { isOmnisearchAvailable, OMNISEARCH_PLUGIN_ID } from "./omnisearch";
import { t } from "./i18n";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a number —
 * used to reset slider-backed settings back to their factory value. */
type NumericSettingKey =
	| "maxWidth"
	| "backgroundOpacity"
	| "backgroundBlur"
	| "cardOpacity"
	| "cardBlur";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a string and
 * would be awkward to reconstruct by hand (frontmatter field names, the search
 * placeholder, the title) — used to reset text-backed settings to their factory
 * value. */
type StringSettingKey =
	| "title"
	| "logo"
	| "searchPlaceholder"
	| "backgroundValue"
	| "taskNotesStatusField"
	| "taskNotesDueField"
	| "taskNotesPriorityField"
	| "taskNotesDoneValue";

/** The GitHub repository and support links surfaced in the About tab. */
const GITHUB_URL = "https://github.com/ondreu/hearth";
const GITHUB_ISSUES_URL = "https://github.com/ondreu/hearth/issues/new";
const KOFI_URL = "https://ko-fi.com/ondru";

/** Download filenames for the JSON exports. */
const LAYOUT_FILE = "hearth-layout.json";
const SETTINGS_FILE = "hearth-settings.json";

/** A tab in the settings ribbon: an id (keys `t().settings.tabs`) and a Lucide
 * icon shown beside the label. */
type SettingsTabId =
	| "appearance"
	| "search"
	| "dashboard"
	| "behaviour"
	| "integrations"
	| "backup"
	| "about";

const SETTINGS_TABS: { id: SettingsTabId; icon: string }[] = [
	{ id: "appearance", icon: "palette" },
	{ id: "search", icon: "search" },
	{ id: "dashboard", icon: "layout-dashboard" },
	{ id: "behaviour", icon: "settings-2" },
	{ id: "integrations", icon: "plug" },
	{ id: "backup", icon: "archive" },
	{ id: "about", icon: "info" },
];

/** localStorage key for the last-opened settings tab. */
const ACTIVE_TAB_KEY = "hearth-settings-tab";

export class HomeSettingTab extends PluginSettingTab {
	plugin: HearthPlugin;

	constructor(app: App, plugin: HearthPlugin) {
		super(app, plugin);
		this.plugin = plugin;
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("hearth-settings");

		this.fileDatalist(containerEl);

		// A ribbon of category tabs sits pinned at the top; only the active tab's
		// sections render below it, keeping a long settings panel navigable. The
		// active tab persists per-vault in localStorage.
		const active = this.activeTab();
		this.renderRibbon(containerEl, active);

		const body = containerEl.createDiv("hearth-settings-tabbody");
		this.renderTab(body, active);
	}

	/** The currently-selected ribbon tab, defaulting to the first. */
	private activeTab(): SettingsTabId {
		const saved = this.app.loadLocalStorage(ACTIVE_TAB_KEY) as string | null;
		return SETTINGS_TABS.some((tab) => tab.id === saved)
			? (saved as SettingsTabId)
			: SETTINGS_TABS[0].id;
	}

	/** Draw the category ribbon. Clicking a tab persists the choice and redraws. */
	private renderRibbon(containerEl: HTMLElement, active: SettingsTabId): void {
		const ribbon = containerEl.createDiv("hearth-settings-ribbon");
		ribbon.setAttribute("role", "tablist");
		for (const tab of SETTINGS_TABS) {
			const label = t().settings.tabs[tab.id];
			const btn = ribbon.createEl("button", { cls: "hearth-ribbon-tab" });
			btn.setAttribute("role", "tab");
			btn.toggleClass("is-active", tab.id === active);
			btn.setAttribute("aria-selected", String(tab.id === active));
			btn.setAttribute("aria-label", label);
			const icon = btn.createSpan("hearth-ribbon-tab-icon");
			setIcon(icon, tab.icon);
			btn.createSpan({ cls: "hearth-ribbon-tab-label", text: label });
			btn.addEventListener("click", () => {
				this.app.saveLocalStorage(ACTIVE_TAB_KEY, tab.id);
				this.display();
			});
		}
	}

	/** Render the sections that belong to a given tab. */
	private renderTab(body: HTMLElement, tab: SettingsTabId): void {
		const s = t().settings;
		switch (tab) {
			case "appearance":
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
				this.section(body, s.sections.cardSurface, s.sections.cardSurfaceDesc, (b) =>
					this.cardSurfaceSection(b),
				);
				// The cards themselves are added and configured on the board, not
				// here — surface that as a plain informational row.
				new Setting(body).setName(s.dashboard.cards).setDesc(s.dashboard.cardsDesc);
				break;
			case "behaviour":
				this.section(body, s.sections.startup, s.sections.startupDesc, (b) => this.startupSection(b));
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
				this.section(body, s.tasks.heading, s.tasks.headingDesc, (b) => this.tasksSection(b));
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

	// ---- Foldable section wrapper --------------------------------------

	/** Wrap a section in a collapsible block. The heading toggles visibility of
	 * the body; the collapsed state is persisted per-section in localStorage so
	 * long settings panels can be tamed and stay tamed. */
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
		head.setAttribute("role", "button");
		head.setAttribute("tabindex", "0");
		const titles = head.createDiv("hearth-section-titles");
		titles.createDiv({ cls: "hearth-section-title", text: title });
		if (desc) titles.createDiv({ cls: "hearth-section-desc", text: desc });
		const chevron = head.createDiv("hearth-section-chevron");
		setIcon(chevron, "chevron-down");

		const body = wrap.createDiv("hearth-section-body");
		render(body);

		// Persist the collapsed state per-section and per-vault via Obsidian's
		// vault-scoped local storage.
		const key = `hearth-section-${title}`;
		let collapsed = this.app.loadLocalStorage(key) === "1";
		const apply = () => {
			wrap.toggleClass("is-collapsed", collapsed);
			body.style.display = collapsed ? "none" : "";
			chevron.toggleClass("is-rotated", collapsed);
			head.setAttribute("aria-expanded", String(!collapsed));
			head.setAttribute("aria-label", collapsed ? t().settings.expandSection : t().settings.collapseSection);
		};
		apply();
		head.addEventListener("click", () => {
			collapsed = !collapsed;
			this.app.saveLocalStorage(key, collapsed ? "1" : null);
			apply();
		});
		head.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				head.click();
			}
		});
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

	// ---- Background -----------------------------------------------------

	private backgroundSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.background.type)
			.setDesc(t().settings.background.typeDesc)
			.addDropdown((d) => {
				(Object.keys(t().settings.background.labels) as BackgroundKind[]).forEach((k) => {
					d.addOption(k, t().settings.background.labels[k]);
				});
				d.setValue(s.backgroundKind).onChange((v) => {
					s.backgroundKind = v as BackgroundKind;
					void this.save();
					this.display();
				});
			});

		// "default" and "none" have no value field; the others do.
		if (s.backgroundKind !== "none" && s.backgroundKind !== "default") {
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
					btn.commandId = undefined;
					void this.save();
					this.display();
				});
			});
			const currentTarget = btn.target ?? btn.commandId ?? "";
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
							btn.commandId = undefined;
							if (!btn.label.trim()) btn.label = command.name;
							void this.save();
							this.display();
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
							btn.commandId = undefined;
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
						this.display();
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
					this.display();
				}),
			)
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.mobileActions.resetDefaults)
					.onClick(async () => {
						s.mobileActionButtons = defaultMobileActionButtons();
						await this.save();
						this.display();
					}),
			);
	}

	/** Move a mobile action button within the list, then persist and redraw. */
	private moveMobileAction(arr: MobileActionButton[], from: number, to: number): void {
		if (to < 0 || to >= arr.length) return;
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		void this.save();
		this.display();
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

	// ---- Dashboard: card surface (opacity / blur) -----------------------

	private cardSurfaceSection(containerEl: HTMLElement): void {
		const s = this.plugin.settings;

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
				this.display();
				new Notice(opts.imported);
			},
		});
	}

	// ---- About ----------------------------------------------------------

	/** Project links, a low-key Ko-fi tip button, and the running version. */
	private aboutSection(containerEl: HTMLElement): void {
		const about = t().settings.about;

		new Setting(containerEl)
			.setName(about.heading)
			.setDesc(about.headingDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(about.github)
			.setDesc(about.githubDesc)
			.addButton((b) => this.linkButton(b, "github", about.githubButton, GITHUB_URL));

		new Setting(containerEl)
			.setName(about.reportIssue)
			.setDesc(about.reportIssueDesc)
			.addButton((b) => this.linkButton(b, "bug", about.reportIssueButton, GITHUB_ISSUES_URL));

		new Setting(containerEl)
			.setName(about.kofi)
			.setDesc(about.kofiDesc)
			.addButton((b) => {
				this.linkButton(b, "coffee", about.kofiButton, KOFI_URL);
				b.buttonEl.addClass("hearth-kofi-btn");
			});

		new Setting(containerEl)
			.setName(about.version(this.plugin.manifest.version))
			.setDesc(about.versionDesc);
	}

	/** A button that shows an icon *and* a label (Obsidian's setButtonText wipes a
	 * setIcon, so the content is built by hand) and opens `url` in the browser. */
	private linkButton(b: ButtonComponent, icon: string, label: string, url: string): void {
		b.setTooltip(url).onClick(() => window.open(url, "_blank"));
		const el = b.buttonEl;
		el.empty();
		el.addClass("hearth-about-btn");
		setIcon(el.createSpan("hearth-about-btn-icon"), icon);
		el.createSpan({ text: label });
	}
}
