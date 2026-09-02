import { Menu, Setting, setIcon } from "obsidian";
import type { HomeView } from "./view";
import {
	type BackgroundConfig,
	type BackgroundKind,
	type BackgroundLayout,
	BANNER_HEIGHT_MAX,
	BANNER_HEIGHT_MIN,
	CARD_BORDER_WIDTH_MAX,
	CARD_RADIUS_MAX,
	clampBannerHeight,
	CONTENT_WIDTH_MAX,
	CONTENT_WIDTH_MIN,
	CONTENT_WIDTH_STEP,
	type Dashboard,
	DASHBOARD_MODES,
	type DashboardHeaderConfig,
	type DashboardMode,
	DEFAULT_SETTINGS,
	effectiveSwitcherVisibility,
	HEADER_MARGIN_TOP_MAX,
	HEADER_MARGIN_TOP_MIN,
	HEADER_SCALE_MAX,
	HEADER_SCALE_MIN,
	HEADER_SPACING_BELOW_MAX,
	HEADER_SPACING_BELOW_MIN,
	type HeaderAlign,
	type HomeSettings,
	isPluginBoard,
	newDashboardId,
} from "./types";
import { cloneCard } from "./cards";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { openExportDashboard, pickAndImport } from "./exportimport";
import {
	FULL_VIEW_SCOPE,
	isDocumentViewType,
	isViewTypeHostable,
	listLeafViewTypes,
} from "./leafview";
import { FilePickerModal } from "./pickers";
import { addIconPicker, renderIcon } from "./lucide";
import { addTitleIconPicker } from "./titleicon";
import { configuredPlaces, renderSkySource } from "./placepicker";
import { formatSkyValue, parseSkyValue } from "./sky";
import { confirmAction } from "./ui";
import type { WorkspacesInstance } from "./obsidian-ext";
import { HearthTabbedModal, type HearthModalTab } from "./tabbedmodal";
import { t } from "./i18n";

/**
 * Copy a board under a new name: same cards, same every override, its own
 * identity.
 *
 * Written as "clone the whole thing, then take back the few fields a copy must
 * not share" rather than as a list of fields to carry across. The list-of-fields
 * version silently dropped every override added after it was written — the copy
 * looked subtly unlike the board it came from — and a board now has enough
 * overrides that the list would be the more likely of the two to go stale.
 *
 * The clone is a JSON round trip rather than `structuredClone`: settings are
 * JSON by definition (they are persisted to `data.json`), so the trip is exact,
 * and it drops `undefined`-valued keys instead of persisting them.
 */
export function cloneDashboard(dash: Dashboard, name: string): Dashboard {
	const copy: Dashboard = JSON.parse(JSON.stringify(dash)) as Dashboard;
	copy.id = newDashboardId();
	copy.name = name;
	// A copied plugin board hosts its own view rather than sharing one: the
	// hosted-view cache is keyed by board id, so the two boards keep separate
	// state (scroll position, open item) as you'd expect of two boards.
	copy.cards = dash.cards.map((c) => cloneCard(c));
	// Not copied: a workspace link, because two boards linked to the same
	// workspace would race on auto-switch; and the mobile-default flag, because
	// two boards claiming it would make which one a phone opens depend on array
	// order. Both are things the copy can be given deliberately afterwards.
	delete copy.linkedWorkspace;
	delete copy.mobileDefault;
	return copy;
}

/** A per-dashboard background's opacity and blur default to — and reset to —
 * the global background defaults, so a dashboard override starts from the same
 * look as the global background. */
const DEFAULT_DASH_BG_OPACITY = DEFAULT_SETTINGS.backgroundOpacity;
const DEFAULT_DASH_BG_BLUR = DEFAULT_SETTINGS.backgroundBlur;
const DEFAULT_HEADER_SCALE = 1;
const DEFAULT_HEADER_MARGIN_TOP = 24;
const DEFAULT_HEADER_SPACING_BELOW = 28;

/**
 * The top-left dashboard switcher: a button per dashboard (its emoji/icon or its
 * 1-based number) plus a "+" to add one. Clicking switches to it; right-clicking
 * opens a menu to edit its settings or delete it.
 */
export function renderDashboardSwitcher(
	view: HomeView,
	container: HTMLElement,
): HTMLElement {
	const s = view.plugin.settings;
	const zone = container.createDiv("hearth-dash-switcher-zone");
	zone.toggleClass("is-auto-hide", effectiveSwitcherVisibility(s) === "hover");
	const bar = zone.createDiv("hearth-dash-switcher");

	s.dashboards.forEach((d, i) => {
		const lucide = d.iconLucide?.trim();
		const icon = d.icon?.trim();
		const btn = bar.createEl("button", {
			cls: "hearth-dash-btn",
		});
		// An icon id that names nothing renderable falls through to the emoji or
		// the number, so a mistyped id never leaves a blank switcher button.
		if (!renderIcon(btn, lucide)) btn.setText(icon || String(i + 1));
		const active = d.id === s.activeDashboardId;
		btn.toggleClass("is-active", active);
		if (active) btn.setAttribute("aria-current", "true");
		btn.setAttribute("aria-label", d.name);
		btn.setAttribute("title", d.name);
		btn.addEventListener("click", () => view.plugin.setActiveDashboard(d.id));
		btn.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			showDashboardMenu(view, d, e);
		});

		// Drag to reorder the boards in the switcher.
		btn.setAttribute("draggable", "true");
		btn.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("text/plain", String(i));
			btn.addClass("is-dragging");
			bar.addClass("is-dragging");
		});
		btn.addEventListener("dragend", () => {
			btn.removeClass("is-dragging");
			bar.removeClass("is-dragging");
		});
		btn.addEventListener("dragover", (e) => {
			e.preventDefault();
			btn.addClass("is-drop-target");
		});
		btn.addEventListener("dragleave", () => btn.removeClass("is-drop-target"));
		btn.addEventListener("drop", (e) => {
			e.preventDefault();
			btn.removeClass("is-drop-target");
			bar.removeClass("is-dragging");
			const from = parseInt(e.dataTransfer?.getData("text/plain") ?? "", 10);
			if (Number.isNaN(from) || from === i) return;
			const [moved] = s.dashboards.splice(from, 1);
			s.dashboards.splice(i, 0, moved);
			void view.plugin.saveData(s);
			view.render();
		});
	});

	const add = bar.createEl("button", {
		cls: "hearth-dash-btn hearth-dash-add",
		attr: { "aria-label": t().dashboards.newDashboard },
	});
	setIcon(add, "plus");
	add.addEventListener("click", () => {
		const dash: Dashboard = {
			id: newDashboardId(),
			name: t().dashboards.defaultName(s.dashboards.length + 1),
			cards: [],
		};
		s.dashboards.push(dash);
		s.activeDashboardId = dash.id;
		void view.plugin.saveData(s);
		view.render();
	});

	// Returned so a board with no toolbar of its own — a plugin board, which is
	// edge-to-edge below this row — can put its one action on the same row
	// instead of spending a second one on it.
	return zone;
}

/** Open the per-dashboard settings editor for `dash`. Shared by the switcher's
 * right-click menu and the arrange-mode toolbar button, so both routes land in
 * exactly the same modal. */
export function openDashboardSettings(view: HomeView, dash: Dashboard): void {
	new DashboardSettingsModal(view, dash).open();
}

/** Context menu for a single dashboard button: settings and delete. */
function showDashboardMenu(
	view: HomeView,
	dash: Dashboard,
	evt: MouseEvent,
): void {
	const s = view.plugin.settings;
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.settings)
			.setIcon("settings-2")
			.onClick(() => openDashboardSettings(view, dash)),
	);

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.duplicate)
			.setIcon("copy")
			.onClick(() => {
				const copy = cloneDashboard(dash, t().dashboards.copySuffix(dash.name));
				const i = s.dashboards.findIndex((d) => d.id === dash.id);
				s.dashboards.splice(i + 1, 0, copy);
				s.activeDashboardId = copy.id;
				void view.plugin.saveData(s);
				view.render();
			}),
	);

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.exportBoard)
			.setIcon("upload")
			.onClick(() => openExportDashboard(view.plugin, dash)),
	);

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.importBoard)
			.setIcon("download")
			.onClick(() => void pickAndImport(view.plugin)),
	);

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.delete)
			.setIcon("trash-2")
			// Always keep at least one dashboard around.
			.setDisabled(s.dashboards.length <= 1)
			.onClick(() => {
				confirmAction(view.app, {
					title: t().dashboards.deleteTitle,
					message: t().dashboards.deleteMessage(dash.name, dash.cards.length),
					confirmText: t().dashboards.deleteConfirm,
					onConfirm: () => {
						const i = s.dashboards.findIndex((d) => d.id === dash.id);
						if (i >= 0) s.dashboards.splice(i, 1);
						if (s.activeDashboardId === dash.id) {
							s.activeDashboardId = s.dashboards[0].id;
						}
						void view.plugin.saveData(s);
						view.render();
					},
				});
			}),
	);

	menu.showAtMouseEvent(evt);
}

/** Per-dashboard settings: name, switcher icon, dashboard chrome, and optional
 * overrides for grid columns, row height and background. Overrides fall back to
 * the global settings when left off.
 *
 * Laid out as a tabbed modal (General / Layout / Style / Background) with a
 * persistent Done footer, mirroring the plugin settings pane so both configure
 * the same way. */
class DashboardSettingsModal extends HearthTabbedModal {
	private view: HomeView;
	private dash: Dashboard;

	/** Scratch space for the background place picker; survives this modal's
	 * in-place rerenders, and goes when it closes. */
	private placeSession: Record<string, unknown> = {};

	constructor(view: HomeView, dash: Dashboard) {
		super(view.app);
		this.view = view;
		this.dash = dash;
	}

	onOpen(): void {
		this.titleEl.setText(t().dashboards.modal.title);
		this.hearthRenderShell();
	}

	/** Rebuild the modal in place, keeping the active tab. Used by the override
	 * toggles and background dropdown, which swap which controls are shown. */
	private render(): void {
		this.hearthRenderShell();
	}

	/** Persist and refresh the live view without closing the modal. */
	private commit(): void {
		void this.view.plugin.saveData(this.view.plugin.settings);
		this.view.render();
	}

	protected hearthTabStorageKey(): string {
		return "hearth-dash-settings-tab";
	}

	protected hearthTabs(): HearthModalTab[] {
		const tabs = t().dashboards.modal.tabs;
		const plugin = isPluginBoard(this.dash);
		return [
			{ id: "general", label: tabs.general, icon: "settings-2" },
			// Which view the board hosts, right after the board's identity: on a
			// plugin board it is the single most important thing about it.
			...(plugin
				? [{ id: "plugin", label: tabs.plugin, icon: "layout-panel-left" }]
				: []),
			{ id: "header", label: tabs.header, icon: "heading" },
			{ id: "layout", label: tabs.layout, icon: "layout-dashboard" },
			// Kept on a plugin board: the hosted view sits on one big card surface,
			// so opacity, blur, radius and border all still land somewhere.
			{ id: "style", label: tabs.style, icon: "palette" },
			{ id: "background", label: tabs.background, icon: "image" },
		];
	}

	protected hearthRenderBody(body: HTMLElement, tabId: string): void {
		switch (tabId) {
			case "general":
				this.generalSection(body);
				break;
			case "plugin":
				this.pluginSection(body);
				break;
			case "header":
				this.headerSection(body);
				break;
			case "layout":
				this.layoutSection(body);
				break;
			case "style":
				this.styleSection(body);
				break;
			case "background":
				this.backgroundSection(body);
				break;
		}
	}

	/** Persistent footer shared by every tab: close the modal. */
	protected hearthRenderFooter(footer: HTMLElement): void {
		new Setting(footer).addButton((b) =>
			b
				.setButtonText(t().dashboards.modal.done)
				.setCta()
				.onClick(() => this.close()),
		);
	}

	/** Name, switcher icons, mobile default and workspace link. */
	private generalSection(containerEl: HTMLElement): void {
		const dash = this.dash;

		new Setting(containerEl).setName(t().dashboards.modal.name).addText((tx) =>
			tx.setValue(dash.name).onChange((v) => {
				dash.name = v || t().dashboards.fallbackName;
				this.commit();
			}),
		);

		// What the board *is*. Changing it swaps which tabs the modal offers, so
		// the whole shell is rebuilt — and the cards of a board turned into a
		// plugin board are kept, not deleted, so turning it back brings them back.
		new Setting(containerEl)
			.setName(t().dashboards.modal.mode)
			.setDesc(t().dashboards.modal.modeDesc)
			.addDropdown((dd) => {
				const labels = t().dashboards.modal.modeOptions;
				for (const mode of DASHBOARD_MODES) dd.addOption(mode, labels[mode]);
				dd.setValue(dash.mode ?? "cards").onChange((v) => {
					const mode = v as DashboardMode;
					dash.mode = mode === "cards" ? undefined : mode;
					if (mode === "plugin") dash.pluginView ??= {};
					this.commit();
					this.render();
				});
			});

		if (isPluginBoard(dash) && !dash.pluginView?.viewType?.trim()) {
			const hint = new Setting(containerEl).setDesc(
				t().dashboards.modal.modePickViewHint,
			);
			hint.settingEl.addClass("hearth-setting-note");
		}

		new Setting(containerEl)
			.setName(t().dashboards.modal.switcherIcon)
			.setDesc(t().dashboards.modal.switcherIconDesc)
			.addText((tx) =>
				tx.setValue(dash.icon ?? "").onChange((v) => {
					dash.icon = v.trim() || undefined;
					this.commit();
				}),
			);

		addIconPicker(
			new Setting(containerEl)
				.setName(t().dashboards.modal.switcherLucide)
				.setDesc(t().dashboards.modal.switcherLucideDesc),
			this.view.app,
			dash.iconLucide ?? "",
			(v) => {
				dash.iconLucide = v || undefined;
				this.commit();
			},
		);

		new Setting(containerEl)
			.setName(t().dashboards.modal.mobileDefault)
			.setDesc(t().dashboards.modal.mobileDefaultDesc)
			.addToggle((tg) =>
				tg.setValue(dash.mobileDefault ?? false).onChange((v) => {
					// Only one board is the mobile default; enabling this one clears
					// the flag on the others so the first-match lookup is unambiguous.
					if (v) {
						for (const d of this.view.plugin.settings.dashboards) {
							d.mobileDefault = d === dash ? true : undefined;
						}
					} else {
						dash.mobileDefault = undefined;
					}
					this.commit();
				}),
			);

		new Setting(containerEl)
			.setName(t().dashboards.modal.linkedWorkspace)
			.setDesc(t().dashboards.modal.linkedWorkspaceDesc)
			.addDropdown((dd) => {
				dd.addOption("", t().dashboards.modal.linkedWorkspaceNone);
				const instance = this.view.app.internalPlugins.getPluginById(
					"workspaces",
				)?.instance as WorkspacesInstance | undefined;
				const names = Object.keys(instance?.workspaces ?? {});
				// A link to a deleted/renamed workspace stays listed so it shows
				// as selected instead of silently falling back to "None".
				if (dash.linkedWorkspace && !names.includes(dash.linkedWorkspace))
					names.push(dash.linkedWorkspace);
				for (const n of names) dd.addOption(n, n);
				dd.setValue(dash.linkedWorkspace ?? "").onChange((v) => {
					dash.linkedWorkspace = v || undefined;
					this.commit();
				});
			});
	}

	/**
	 * Which view a plugin board hosts, and how it behaves while it is not the
	 * board on screen.
	 *
	 * The type list is everything the app has registered right now — core panes
	 * plus whatever community plugins have added — so the choices follow which
	 * plugins are enabled. Unlike the leaf card's list it includes Obsidian's own
	 * document surfaces (Markdown, PDF, image, audio, video), which only work
	 * pointed at a file; the file picker below is right there, and the board says
	 * so when one is needed but missing.
	 */
	private pluginSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const strings = t().dashboards.modal;
		const cfg = (dash.pluginView ??= {});
		const types = listLeafViewTypes(this.view.app, FULL_VIEW_SCOPE);

		const picker = new Setting(containerEl)
			.setName(strings.pluginViewType)
			.setDesc(strings.pluginViewTypeDesc);
		if (types.length === 0) {
			// No registry to read — the same condition that hides the leaf card's
			// template. Nothing below it would do anything, so stop here.
			picker.setDesc(t().editors.leaf.none);
			return;
		}
		picker.addDropdown((dd) => {
			dd.addOption("", strings.pluginViewTypeNone);
			for (const vt of types) dd.addOption(vt.type, vt.name);
			// A view whose plugin is currently off stays listed and selected, so
			// switching that plugin back on restores the board untouched.
			const current = cfg.viewType?.trim();
			if (current && !types.some((vt) => vt.type === current)) {
				dd.addOption(current, current);
			}
			dd.setValue(current ?? "").onChange((v) => {
				cfg.viewType = v || undefined;
				// A file chosen for the old view can't be shown by the new one, and
				// makes file-backed views throw — so it goes with the view.
				cfg.file = undefined;
				this.commit();
				this.render();
			});
		});

		const type = cfg.viewType?.trim() ?? "";
		if (type && !isViewTypeHostable(this.view.app, type, FULL_VIEW_SCOPE)) {
			const missing = new Setting(containerEl).setDesc(
				t().cards.empty.leafViewMissing,
			);
			missing.settingEl.addClass("hearth-setting-note");
			missing.settingEl.addClass("hearth-setting-warning");
		}

		const fileSetting = new Setting(containerEl)
			.setName(strings.pluginViewFile)
			.setDesc(
				// A document surface has nothing to show without one, so the same
				// control is described as required rather than optional there.
				isDocumentViewType(type)
					? strings.pluginViewFileRequiredDesc
					: strings.pluginViewFileDesc,
			);
		fileSetting.addText((tx) =>
			tx
				.setPlaceholder(t().editors.leaf.filePlaceholder)
				.setValue(cfg.file ?? "")
				.onChange((v) => {
					cfg.file = v.trim() || undefined;
					this.commit();
				}),
		);
		fileSetting.addExtraButton((b) =>
			b
				.setIcon("file-symlink")
				.setTooltip(t().editors.leaf.pickFile)
				.onClick(() => {
					new FilePickerModal(this.view.app, (file) => {
						cfg.file = file.path;
						this.commit();
						this.render();
					}).open();
				}),
		);
		if (cfg.file) {
			fileSetting.addExtraButton((b) =>
				b
					.setIcon("x")
					.setTooltip(t().editors.leaf.clearFile)
					.onClick(() => {
						cfg.file = undefined;
						this.commit();
						this.render();
					}),
			);
		}

		new Setting(containerEl)
			.setName(strings.pluginViewHideHeader)
			.setDesc(strings.pluginViewHideHeaderDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.hideHeader ?? false).onChange((v) => {
					cfg.hideHeader = v || undefined;
					this.commit();
				}),
			);

		new Setting(containerEl)
			.setName(strings.pluginViewKeepMounted)
			.setDesc(strings.pluginViewKeepMountedDesc)
			.addToggle((tg) =>
				// Undefined is on (see PluginBoardConfig.keepMounted), so only the
				// off case is written back.
				tg.setValue(cfg.keepMounted ?? true).onChange((v) => {
					cfg.keepMounted = v ? undefined : false;
					this.commit();
				}),
			);

		new Setting(containerEl)
			.setName(strings.pluginViewFocusable)
			.setDesc(strings.pluginViewFocusableDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.focusable ?? false).onChange((v) => {
					cfg.focusable = v || undefined;
					this.commit();
				}),
			);

		const note = new Setting(containerEl)
			.setName(t().editors.leaf.perfLabel)
			.setDesc(strings.pluginViewPerfNote);
		note.settingEl.addClass("hearth-setting-note");
		note.settingEl.addClass("hearth-setting-warning");
		const icon = createSpan("hearth-setting-note-icon");
		setIcon(icon, "alert-triangle");
		note.nameEl.prepend(icon);
	}

	/**
	 * The label for the "no override" option of a header-visibility dropdown.
	 *
	 * Normally that is the global setting. On a plugin board it isn't: the board
	 * is given over to the hosted view, so the title and search default to
	 * hidden there whatever the global says (see `effectiveShowTitle`). Saying
	 * "use global default (shown)" over a board that hides it anyway would be a
	 * plain lie, so the plugin board gets its own wording.
	 */
	private visibilityDefaultLabel(globalOn: boolean): string {
		const strings = t().dashboards.modal;
		if (isPluginBoard(this.dash)) {
			return strings.visibilityDefaultPlugin(strings.visibilityHidden);
		}
		return strings.titleVisibilityDefault(
			globalOn ? strings.visibilityShown : strings.visibilityHidden,
		);
	}

	private ensureHeader(): DashboardHeaderConfig {
		return (this.dash.header ??= {});
	}

	private clearEmptyHeader(): void {
		const header = this.dash.header;
		if (!header) return;
		if (Object.values(header).every((v) => v === undefined)) {
			this.dash.header = undefined;
		}
	}

	private setHeaderOverride<K extends keyof DashboardHeaderConfig>(
		key: K,
		value: DashboardHeaderConfig[K] | undefined,
	): void {
		if (value === undefined) {
			if (this.dash.header) delete this.dash.header[key];
			this.clearEmptyHeader();
			return;
		}
		this.ensureHeader()[key] = value;
	}

	/** Per-dashboard overrides for the header: the title block, and whether
	 * the search section below it is drawn. */
	private headerSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;
		const header = dash.header;

		new Setting(containerEl)
			.setName(t().dashboards.modal.titleVisibility)
			.setDesc(t().dashboards.modal.titleVisibilityDesc)
			.addDropdown((d) => {
				d.addOption("default", this.visibilityDefaultLabel(s.showTitle));
				d.addOption("show", t().dashboards.modal.visibilityShow);
				d.addOption("hide", t().dashboards.modal.visibilityHide);
				d.setValue(
					header?.showTitle === undefined
						? "default"
						: header.showTitle
							? "show"
							: "hide",
				);
				d.onChange((v) => {
					this.setHeaderOverride(
						"showTitle",
						v === "default" ? undefined : v === "show",
					);
					this.commit();
					this.render();
				});
			});

		// Search visibility lives beside the title's, since both decide whether a
		// block of the header is drawn. It is stored on the dashboard itself
		// rather than in `header`, where it has always been.
		new Setting(containerEl)
			.setName(t().dashboards.modal.searchVisibility)
			.setDesc(t().dashboards.modal.searchVisibilityDesc)
			.addDropdown((d) => {
				d.addOption("default", this.visibilityDefaultLabel(s.showSearch));
				d.addOption("show", t().dashboards.modal.searchVisibilityShow);
				d.addOption("hide", t().dashboards.modal.searchVisibilityHide);
				d.setValue(
					dash.showSearch === undefined ? "default" : dash.showSearch ? "show" : "hide",
				);
				d.onChange((v) => {
					dash.showSearch = v === "default" ? undefined : v === "show";
					this.commit();
				});
			});

		// The rest of the search row: its placeholder, the button beside it, and
		// the filter chips under it. All four were vault-wide until the portable
		// package needed a board to be able to carry its own header — see the
		// resolver block in types.ts.
		this.overrideText(
			containerEl,
			t().dashboards.modal.searchPlaceholder,
			t().dashboards.modal.searchPlaceholderDesc,
			dash.searchPlaceholder,
			s.searchPlaceholder,
			(v) => {
				dash.searchPlaceholder = v;
				this.commit();
			},
		);

		this.overrideBool(
			containerEl,
			t().dashboards.modal.newNoteButton,
			t().dashboards.modal.newNoteButtonDesc,
			dash.showNewNoteButton,
			s.showNewNoteButton,
			{
				on: t().dashboards.modal.newNoteButtonStateOn,
				off: t().dashboards.modal.newNoteButtonStateOff,
				stateOn: t().dashboards.modal.newNoteButtonStateOn,
				stateOff: t().dashboards.modal.newNoteButtonStateOff,
			},
			(v) => {
				dash.showNewNoteButton = v;
			},
			// The two rows below only describe a button that is drawn.
			true,
		);

		if (dash.showNewNoteButton ?? s.showNewNoteButton) {
			this.overrideChoice(
				containerEl,
				t().dashboards.modal.newNoteButtonMode,
				t().dashboards.modal.newNoteButtonModeDesc,
				dash.newNoteButtonMode,
				t().dashboards.modal.newNoteButtonModeOptions,
				t().dashboards.modal.newNoteButtonModeOptions[s.newNoteButtonMode],
				(v) => {
					dash.newNoteButtonMode = v;
				},
			);

			this.overrideText(
				containerEl,
				t().dashboards.modal.newNoteButtonLabel,
				t().dashboards.modal.newNoteButtonLabelDesc,
				dash.newNoteButtonLabel,
				s.newNoteButtonLabel,
				(v) => {
					dash.newNoteButtonLabel = v;
					this.commit();
				},
			);
		}

		this.filterChipsOverride(containerEl);

		this.overrideText(
			containerEl,
			t().dashboards.modal.titleText,
			t().dashboards.modal.titleTextDesc,
			header?.title,
			s.title,
			(v) => {
				this.setHeaderOverride("title", v);
				this.commit();
			},
		);

		this.overrideHeaderIcon(
			containerEl,
			t().dashboards.modal.titleIcon,
			t().dashboards.modal.titleIconDesc,
			header?.titleIcon,
			s.titleIcon,
			(v) => {
				this.setHeaderOverride("titleIcon", v);
				this.commit();
			},
		);

		new Setting(containerEl)
			.setName(t().dashboards.modal.titleAlign)
			.setDesc(t().dashboards.modal.titleAlignDesc)
			.addDropdown((d) => {
				d.addOption("default", t().dashboards.modal.alignDefault);
				d.addOption("left", t().dashboards.modal.alignLeft);
				d.addOption("center", t().dashboards.modal.alignCenter);
				d.addOption("right", t().dashboards.modal.alignRight);
				d.setValue(header?.align ?? "default");
				d.onChange((v) => {
					this.setHeaderOverride(
						"align",
						v === "default" ? undefined : (v as HeaderAlign),
					);
					this.commit();
					this.render();
				});
			});

		new Setting(containerEl)
			.setName(t().dashboards.modal.themeColorTarget)
			.setDesc(t().dashboards.modal.themeColorTargetDesc)
			.addDropdown((d) => {
				const labels = t().dashboards.modal.themeColorTargetOptions;
				d.addOption(
					"default",
					t().dashboards.modal.themeColorTargetDefault(labels[s.themeColorTarget]),
				);
				d.addOption("none", labels.none);
				d.addOption("icon", labels.icon);
				d.addOption("title", labels.title);
				d.addOption("both", labels.both);
				d.setValue(header?.themeColorTarget ?? "default");
				d.onChange((v) => {
					this.setHeaderOverride(
						"themeColorTarget",
						v === "default"
							? undefined
							: (v as HomeSettings["themeColorTarget"]),
					);
					this.commit();
				});
			});

		this.overrideHeaderSlider(
			containerEl,
			t().dashboards.modal.titleSize,
			header?.titleScale,
			DEFAULT_HEADER_SCALE,
			HEADER_SCALE_MIN,
			HEADER_SCALE_MAX,
			0.05,
			(v) => {
				this.setHeaderOverride("titleScale", v);
				this.commit();
			},
		);

		this.overrideHeaderSlider(
			containerEl,
			t().dashboards.modal.titleIconSize,
			header?.logoScale,
			DEFAULT_HEADER_SCALE,
			HEADER_SCALE_MIN,
			HEADER_SCALE_MAX,
			0.05,
			(v) => {
				this.setHeaderOverride("logoScale", v);
				this.commit();
			},
		);

		this.overrideHeaderSlider(
			containerEl,
			t().dashboards.modal.titleTopMargin,
			header?.marginTop,
			DEFAULT_HEADER_MARGIN_TOP,
			HEADER_MARGIN_TOP_MIN,
			HEADER_MARGIN_TOP_MAX,
			1,
			(v) => {
				this.setHeaderOverride("marginTop", v);
				this.commit();
			},
		);

		this.overrideHeaderSlider(
			containerEl,
			t().dashboards.modal.headerSpacingBelow,
			header?.spacingBelow,
			DEFAULT_HEADER_SPACING_BELOW,
			HEADER_SPACING_BELOW_MIN,
			HEADER_SPACING_BELOW_MAX,
			1,
			(v) => {
				this.setHeaderOverride("spacingBelow", v);
				this.commit();
			},
		);
	}

	/**
	 * The filter chips this board shows under the search bar.
	 *
	 * A list rather than a dropdown, because the override is the whole list: a
	 * board either follows the vault's choice or states its own. The stored value
	 * is the *hidden* ids (matching the vault-wide setting), so an empty array is
	 * a real override meaning "show every chip on this board" and is kept.
	 */
	private filterChipsOverride(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;
		const overriding = dash.hiddenFilters !== undefined;
		new Setting(containerEl)
			.setName(t().dashboards.modal.hiddenFilters)
			.setDesc(
				overriding
					? t().dashboards.modal.hiddenFiltersDesc
					: t().dashboards.modal.hiddenFiltersFollowing(s.hiddenFilters.length),
			)
			.addToggle((tg) =>
				tg.setValue(overriding).onChange((v) => {
					// Seeded from the vault's own list so the board starts out looking
					// exactly as it already does.
					dash.hiddenFilters = v ? [...s.hiddenFilters] : undefined;
					this.commit();
					this.render();
				}),
			);
		if (!overriding) return;
		const hidden = new Set(dash.hiddenFilters);
		for (const group of FILE_TYPE_GROUPS) {
			new Setting(containerEl)
				.setName(fileTypeLabel(group))
				.setClass("hearth-setting-sub")
				.addToggle((tg) =>
					tg.setValue(!hidden.has(group.id)).onChange((v) => {
						if (v) hidden.delete(group.id);
						else hidden.add(group.id);
						dash.hiddenFilters = Array.from(hidden);
						this.commit();
					}),
				);
		}
	}

	/**
	 * A board-level choice, with "follow the vault" as its first option.
	 *
	 * Every per-board override in this modal is a three-state control — follow
	 * the vault, or one of the explicit values — and the vault's current answer
	 * is named in the first option so the reader can see what following it means
	 * without leaving the modal. This is that control, once, for the overrides
	 * added with the portable-package work; the older rows above still spell it
	 * out inline.
	 */
	private overrideChoice<T extends string>(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		current: T | undefined,
		options: Record<T, string>,
		globalState: string,
		set: (value: T | undefined) => void,
		rerender = false,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown((d) => {
				d.addOption("default", t().dashboards.modal.titleVisibilityDefault(globalState));
				for (const [value, label] of Object.entries(options)) {
					d.addOption(value, label as string);
				}
				d.setValue(current ?? "default");
				d.onChange((v) => {
					set(v === "default" ? undefined : (v as T));
					this.commit();
					if (rerender) this.render();
				});
			});
	}

	/** {@link overrideChoice} for a boolean override: follow the vault, or say
	 * yes or no on this board. */
	private overrideBool(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		current: boolean | undefined,
		globalOn: boolean,
		labels: { on: string; off: string; stateOn: string; stateOff: string },
		set: (value: boolean | undefined) => void,
		rerender = false,
	): void {
		this.overrideChoice(
			containerEl,
			name,
			desc,
			current === undefined ? undefined : current ? "on" : "off",
			{ on: labels.on, off: labels.off },
			globalOn ? labels.stateOn : labels.stateOff,
			(v) => set(v === undefined ? undefined : v === "on"),
			rerender,
		);
	}

	private overrideText(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		current: string | undefined,
		fallback: string,
		set: (value: string | undefined) => void,
	): void {
		const overriding = current !== undefined;
		const row = new Setting(containerEl)
			.setName(name)
			.setDesc(
				overriding
					? desc
					: t().dashboards.modal.usingDefaultText(fallback || "∅"),
			)
			.addToggle((tg) =>
				tg.setValue(overriding).onChange((v) => {
					set(v ? fallback : undefined);
					this.render();
				}),
			);
		if (overriding) {
			row.addText((tx) =>
				tx.setValue(current).onChange((v) => {
					set(v);
				}),
			);
		}
	}

	/**
	 * The icon counterpart of {@link overrideText}: a toggle that takes the
	 * board off the vault-wide title icon, and — once it has — the same
	 * title-icon field the settings tab offers (icon, emoji/text, vault picture
	 * or URL).
	 *
	 * Turning the toggle on seeds the override with whatever the global mark is,
	 * so the board starts from the look it already had; clearing the field
	 * leaves an empty override, which is a board that deliberately wears the
	 * Hearth crystal while the vault-wide setting has something else.
	 */
	private overrideHeaderIcon(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		current: string | undefined,
		fallback: string,
		set: (value: string | undefined) => void,
	): void {
		const overriding = current !== undefined;
		const row = new Setting(containerEl)
			.setName(name)
			.setDesc(
				overriding
					? desc
					: t().dashboards.modal.usingDefaultText(fallback || "∅"),
			)
			.addToggle((tg) =>
				tg.setValue(overriding).onChange((v) => {
					set(v ? fallback : undefined);
					this.render();
				}),
			);
		if (overriding) {
			addTitleIconPicker(row, this.view.app, current, (v) => set(v));
		}
	}

	private overrideHeaderSlider(
		containerEl: HTMLElement,
		name: string,
		current: number | undefined,
		fallback: number,
		min: number,
		max: number,
		step: number,
		set: (value: number | undefined) => void,
	): void {
		const overriding = typeof current === "number";
		const row = new Setting(containerEl)
			.setName(name)
			.setDesc(
				overriding
					? t().dashboards.modal.overriding
					: t().dashboards.modal.usingDefault(fallback),
			)
			.addToggle((tg) =>
				tg.setValue(overriding).onChange((v) => {
					set(v ? fallback : undefined);
					this.render();
				}),
			);
		if (overriding) {
			row.addSlider((sl) =>
				sl
					.setLimits(min, max, step)
					.setValue(current)
					.onChange((v) => set(v)),
			);
		}
	}

	/** Content width and fit-to-page, each an override of the global default. */
	private layoutSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;

		new Setting(containerEl)
			.setName(t().dashboards.modal.fullWidth)
			.setDesc(t().dashboards.modal.fullWidthDesc)
			.addDropdown((d) => {
				d.addOption(
					"default",
					t().dashboards.modal.fullWidthDefault(
						s.fullWidth
							? t().dashboards.modal.fullWidthStateOn
							: t().dashboards.modal.fullWidthStateOff,
					),
				);
				d.addOption("on", t().dashboards.modal.fullWidthOptionOn);
				d.addOption("off", t().dashboards.modal.fullWidthOptionOff);
				d.setValue(
					dash.fullWidth === undefined ? "default" : dash.fullWidth ? "on" : "off",
				);
				d.onChange((v) => {
					dash.fullWidth = v === "default" ? undefined : v === "on";
					this.commit();
					// The width slider below is the ceiling this drops, so it appears
					// and disappears with the choice rather than sitting there inert.
					this.render();
				});
			});

		// Only offered while this board actually has a ceiling to set.
		if (!(dash.fullWidth ?? s.fullWidth)) {
			this.overrideSlider(
				containerEl,
				t().dashboards.modal.contentWidth,
				dash.maxWidth,
				s.maxWidth,
				CONTENT_WIDTH_MIN,
				CONTENT_WIDTH_MAX,
				CONTENT_WIDTH_STEP,
				(v) => {
					dash.maxWidth = v;
					this.commit();
				},
			);
		}

		// Stacking and the two pieces of chrome sit above the plugin-board early
		// return below, because all three apply to a hosted view just as much as
		// to a grid of cards.
		this.overrideBool(
			containerEl,
			t().dashboards.modal.stackOnNarrow,
			t().dashboards.modal.stackOnNarrowDesc,
			dash.stackOnNarrow,
			s.stackOnNarrow,
			{
				on: t().dashboards.modal.stackOnNarrowOptionOn,
				off: t().dashboards.modal.stackOnNarrowOptionOff,
				stateOn: t().dashboards.modal.stackOnNarrowStateOn,
				stateOff: t().dashboards.modal.stackOnNarrowStateOff,
			},
			(v) => {
				dash.stackOnNarrow = v;
			},
		);

		this.overrideChoice(
			containerEl,
			t().dashboards.modal.arrangeVisibility,
			t().dashboards.modal.arrangeVisibilityDesc,
			dash.arrangeButtonVisibility,
			t().dashboards.modal.chromeOptions,
			t().dashboards.modal.chromeStates[s.arrangeButtonVisibility],
			(v) => {
				dash.arrangeButtonVisibility = v;
			},
		);

		this.overrideChoice(
			containerEl,
			t().dashboards.modal.switcherVisibility,
			t().dashboards.modal.switcherVisibilityDesc,
			dash.dashboardSwitcherVisibility,
			t().dashboards.modal.chromeOptions,
			t().dashboards.modal.chromeStates[s.dashboardSwitcherVisibility],
			(v) => {
				dash.dashboardSwitcherVisibility = v;
			},
		);

		// A plugin board is always fitted — the hosted view needs a definite
		// height to fill and scrolls itself inside it — so the choice isn't
		// offered there. The width controls above still apply.
		if (isPluginBoard(dash)) {
			const note = new Setting(containerEl)
				.setName(t().dashboards.modal.fitToPage)
				.setDesc(t().dashboards.modal.fitToPagePluginNote);
			note.settingEl.addClass("hearth-setting-note");
			return;
		}

		new Setting(containerEl)
			.setName(t().dashboards.modal.fitToPage)
			.setDesc(t().dashboards.modal.fitToPageDesc)
			.addDropdown((d) => {
				d.addOption(
					"default",
					t().dashboards.modal.fitDefault(
						s.fitToPage
							? t().dashboards.modal.fitStateFit
							: t().dashboards.modal.fitStateScroll,
					),
				);
				d.addOption("fit", t().dashboards.modal.fitOptionFit);
				d.addOption("scroll", t().dashboards.modal.fitOptionScroll);
				d.setValue(
					dash.fitToPage === undefined
						? "default"
						: dash.fitToPage
							? "fit"
							: "scroll",
				);
				d.onChange((v) => {
					dash.fitToPage = v === "default" ? undefined : v === "fit";
					this.commit();
				});
			});
	}

	/** Card surface overrides: opacity, blur and corner radius. */
	private styleSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;

		new Setting(containerEl)
			.setName(t().dashboards.modal.compact)
			.setDesc(t().dashboards.modal.compactDesc)
			.addDropdown((d) => {
				d.addOption(
					"default",
					t().dashboards.modal.compactDefault(
						s.compact
							? t().dashboards.modal.compactStateOn
							: t().dashboards.modal.compactStateOff,
					),
				);
				d.addOption("on", t().dashboards.modal.compactOptionOn);
				d.addOption("off", t().dashboards.modal.compactOptionOff);
				d.setValue(dash.compact === undefined ? "default" : dash.compact ? "on" : "off");
				d.onChange((v) => {
					dash.compact = v === "default" ? undefined : v === "on";
					this.commit();
				});
			});

		this.overrideSlider(
			containerEl,
			t().dashboards.modal.cardOpacity,
			dash.cardOpacity,
			s.cardOpacity,
			0,
			1,
			0.05,
			(v) => {
				dash.cardOpacity = v;
				this.commit();
			},
		);

		this.overrideSlider(
			containerEl,
			t().dashboards.modal.cardBlur,
			dash.cardBlur,
			s.cardBlur,
			0,
			24,
			1,
			(v) => {
				dash.cardBlur = v;
				this.commit();
			},
		);

		// Corner radius is capped at the design baseline (CARD_RADIUS_MAX): only
		// sharper corners are offered, since rounding beyond it was never tuned for.
		this.overrideSlider(
			containerEl,
			t().dashboards.modal.cardRadius,
			dash.cardRadius,
			s.cardRadius,
			0,
			CARD_RADIUS_MAX,
			1,
			(v) => {
				dash.cardRadius = v;
				this.commit();
			},
		);

		this.overrideSlider(
			containerEl,
			t().dashboards.modal.cardBorderWidth,
			dash.cardBorderWidth,
			s.cardBorderWidth,
			0,
			CARD_BORDER_WIDTH_MAX,
			1,
			(v) => {
				dash.cardBorderWidth = v;
				this.commit();
			},
		);
	}

	/** A labelled override: a toggle that, when on, reveals a slider. Off clears
	 * the override (passing undefined) so the global default applies. */
	private overrideSlider(
		containerEl: HTMLElement,
		name: string,
		current: number | undefined,
		fallback: number,
		min: number,
		max: number,
		step: number,
		set: (value: number | undefined) => void,
	): void {
		const overriding = typeof current === "number";
		const row = new Setting(containerEl)
			.setName(name)
			.setDesc(
				overriding
					? t().dashboards.modal.overriding
					: t().dashboards.modal.usingGlobal(fallback),
			)
			.addToggle((tg) =>
				tg.setValue(overriding).onChange((v) => {
					set(v ? fallback : undefined);
					this.render();
				}),
			);
		if (overriding) {
			row.addSlider((sl) =>
				sl
					.setLimits(min, max, step)
					.setValue(current)
					.onChange((v) => set(v)),
			);
		}
	}

	private backgroundSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const bg = dash.background;

		new Setting(containerEl)
			.setName(t().dashboards.modal.background)
			.setDesc(t().dashboards.modal.backgroundDesc)
			.addDropdown((d) => {
				Object.entries(t().dashboards.backgroundOptions).forEach(
					([k, label]) => {
						d.addOption(k, label);
					},
				);
				d.setValue(bg ? bg.kind : "default").onChange((v) => {
					if (v === "default") {
						dash.background = undefined;
					} else {
						const opacity = bg?.opacity ?? DEFAULT_DASH_BG_OPACITY;
						dash.background = {
							kind: v as BackgroundKind,
							value: bg?.value ?? "",
							// See the same lift in the global background settings:
							// the photo default (0.35) mutes the sky to a slab.
							opacity: v === "weather" && opacity <= 0.5 ? 1 : opacity,
							blur: bg?.blur ?? DEFAULT_DASH_BG_BLUR,
						};
					}
					this.commit();
					this.render();
				});
			});

		// How the board wears its backdrop is settable whether or not the board
		// overrides *what* that backdrop is — the two are separate overrides, so
		// this comes before the early return below and a board using the vault's
		// background can still choose to show it as a banner.
		this.bannerControls(containerEl);

		// Offered whenever the backdrop this board actually shows is a painted
		// sky — including one it inherits from the vault, which is why the guard
		// resolves the kind instead of testing the override. It sits with the
		// banner controls for the same reason those do: it says how the board
		// wears its backdrop, not what the backdrop is.
		if ((bg?.kind ?? this.view.plugin.settings.backgroundKind) === "weather") {
			this.overrideBool(
				containerEl,
				t().dashboards.modal.skyAnimate,
				t().dashboards.modal.skyAnimateDesc,
				dash.backgroundSkyAnimate,
				this.view.plugin.settings.backgroundSkyAnimate !== false,
				{
					on: t().dashboards.modal.skyAnimateOptionOn,
					off: t().dashboards.modal.skyAnimateOptionOff,
					stateOn: t().dashboards.modal.skyAnimateStateOn,
					stateOff: t().dashboards.modal.skyAnimateStateOff,
				},
				(v) => {
					dash.backgroundSkyAnimate = v;
				},
			);
		}

		if (!bg || bg.kind === "none") return;

		// The weather sky stores a place, not a typed-in value, so it gets the
		// shared picker in place of the text field below.
		if (bg.kind === "weather") {
			renderSkySource(containerEl, {
				current: parseSkyValue(bg.value),
				onChange: (next) => {
					bg.value = next ? formatSkyValue(next) : "";
					this.commit();
				},
				rerender: () => this.render(),
				disabled: this.view.plugin.settings.disableExternalCalls,
				session: this.placeSession,
				suggestions: configuredPlaces(this.view.plugin.settings),
			});
		}

		if (bg.kind !== "default" && bg.kind !== "weather") {
			const desc =
				bg.kind === "color"
					? t().dashboards.backgroundValueDesc.color
					: bg.kind === "image"
						? t().dashboards.backgroundValueDesc.image
						: t().dashboards.backgroundValueDesc.url;
			new Setting(containerEl)
				.setName(t().dashboards.modal.backgroundValue)
				.setDesc(desc)
				.addText((t) =>
					t.setValue(bg.value).onChange((v) => {
						bg.value = v;
						this.commit();
					}),
				);
		}

		this.bgNumber(
			containerEl,
			t().dashboards.modal.opacity,
			bg,
			"opacity",
			0,
			1,
			0.05,
			DEFAULT_DASH_BG_OPACITY,
		);
		this.bgNumber(
			containerEl,
			t().dashboards.modal.blur,
			bg,
			"blur",
			0,
			40,
			1,
			DEFAULT_DASH_BG_BLUR,
		);
	}

	/**
	 * How this board wears its backdrop — full view or banner, and the banner's
	 * shape — as overrides in their own right, each falling back to the global
	 * setting.
	 *
	 * They are deliberately not tied to the background override above. A board
	 * that keeps the vault's background can still show it as a banner, and a
	 * board that overrides the picture can still wear it however the vault does.
	 */
	private bannerControls(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;
		const strings = t().dashboards.modal;
		const globalLayout = s.backgroundLayout ?? "full";
		const labels = t().dashboards.backgroundLayoutOptions;

		new Setting(containerEl)
			.setName(strings.backgroundLayout)
			.setDesc(
				dash.backgroundLayout
					? t().dashboards.modal.overriding
					: t().dashboards.modal.usingGlobal(labels[globalLayout]),
			)
			.addDropdown((d) => {
				d.addOption("global", t().dashboards.useGlobal);
				(Object.keys(labels) as BackgroundLayout[]).forEach((k) => {
					d.addOption(k, labels[k]);
				});
				d.setValue(dash.backgroundLayout ?? "global").onChange((v) => {
					dash.backgroundLayout =
						v === "global" ? undefined : (v as BackgroundLayout);
					// Same lift as the global setting, but only on a background
					// this board actually owns: a banner is the picture itself,
					// not a backdrop for something else, so wallpaper-ish opacity
					// and blur would hand the reader a grey smear. A board riding
					// the global background is left alone — its opacity and blur
					// belong to every other board too.
					if (v === "banner" && dash.background) {
						if (dash.background.opacity <= 0.5) dash.background.opacity = 1;
						if (dash.background.blur > 0) dash.background.blur = 0;
					}
					this.commit();
					this.render();
				});
			});

		// The strip's shape is worth showing whenever this board ends up with a
		// banner — whether it chose one itself or inherits one from the vault.
		if ((dash.backgroundLayout ?? globalLayout) !== "banner") return;

		this.dashNumber(
			containerEl,
			strings.bannerHeight,
			"bannerHeight",
			BANNER_HEIGHT_MIN,
			BANNER_HEIGHT_MAX,
			10,
			clampBannerHeight(s.bannerHeight),
		);
		this.dashToggle(containerEl, strings.bannerFade, "bannerFade", s.bannerFade !== false);
		this.dashToggle(
			containerEl,
			strings.bannerFullWidth,
			"bannerFullWidth",
			s.bannerFullWidth === true,
		);
	}

	/** A board-level numeric override with a reset button that clears it back to
	 * the global value, rather than to a hard-coded factory number: these
	 * overrides *are* "unset = follow the vault", so reset means unset. */
	private dashNumber(
		containerEl: HTMLElement,
		name: string,
		key: "bannerHeight",
		min: number,
		max: number,
		step: number,
		globalValue: number,
	): void {
		const dash = this.dash;
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(
				dash[key] == null
					? t().dashboards.modal.usingGlobal(globalValue)
					: t().dashboards.modal.overriding,
			);
		setting.addSlider((sl) => {
			sl.setLimits(min, max, step)
				.setValue(dash[key] ?? globalValue)
				.onChange((v) => {
					dash[key] = v;
					this.commit();
				});
			setting.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().dashboards.modal.clearOverride)
					.onClick(() => {
						dash[key] = undefined;
						sl.setValue(globalValue);
						this.commit();
						this.render();
					}),
			);
		});
	}

	/** A board-level boolean override: a toggle plus a reset that clears it back
	 * to following the global setting. */
	private dashToggle(
		containerEl: HTMLElement,
		name: string,
		key: "bannerFade" | "bannerFullWidth",
		globalValue: boolean,
	): void {
		const dash = this.dash;
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(
				dash[key] == null
					? t().dashboards.modal.usingGlobal(
							globalValue ? t().dashboards.on : t().dashboards.off,
						)
					: t().dashboards.modal.overriding,
			);
		setting.addToggle((tg) =>
			tg.setValue(dash[key] ?? globalValue).onChange((v) => {
				dash[key] = v;
				this.commit();
				this.render();
			}),
		);
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().dashboards.modal.clearOverride)
				.onClick(() => {
					dash[key] = undefined;
					this.commit();
					this.render();
				}),
		);
	}

	/** A per-dashboard background slider (opacity/blur) with a reset button that
	 * restores the factory default `def`. */
	private bgNumber(
		containerEl: HTMLElement,
		name: string,
		bg: BackgroundConfig,
		key: "opacity" | "blur",
		min: number,
		max: number,
		step: number,
		def: number,
	): void {
		const setting = new Setting(containerEl).setName(name);
		setting.addSlider((sl) => {
			sl.setLimits(min, max, step)
				.setValue(bg[key])
				.onChange((v) => {
					bg[key] = v;
					this.commit();
				});
			setting.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.resetSlider)
					.onClick(() => {
						bg[key] = def;
						sl.setValue(def);
						this.commit();
					}),
			);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
