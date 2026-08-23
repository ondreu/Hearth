import { Menu, Setting, setIcon } from "obsidian";
import type { HomeView } from "./view";
import {
	type BackgroundConfig,
	type BackgroundKind,
	type BackgroundLayout,
	type Dashboard,
	type DashboardHeaderConfig,
	type HeaderAlign,
	type HomeSettings,
	BANNER_HEIGHT_MAX,
	BANNER_HEIGHT_MIN,
	CARD_RADIUS_MAX,
	clampBannerHeight,
	CARD_BORDER_WIDTH_MAX,
	HEADER_MARGIN_TOP_MAX,
	HEADER_MARGIN_TOP_MIN,
	HEADER_SCALE_MAX,
	HEADER_SCALE_MIN,
	HEADER_SPACING_BELOW_MAX,
	HEADER_SPACING_BELOW_MIN,
	DEFAULT_SETTINGS,
	newDashboardId,
} from "./types";
import { cloneCard } from "./cards";
import { addIconPicker, renderIcon } from "./lucide";
import { configuredPlaces, renderSkySource } from "./placepicker";
import { formatSkyValue, parseSkyValue } from "./sky";
import { confirmAction } from "./ui";
import type { WorkspacesInstance } from "./obsidian-ext";
import { HearthTabbedModal, type HearthModalTab } from "./tabbedmodal";
import { t } from "./i18n";

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
): void {
	const s = view.plugin.settings;
	const zone = container.createDiv("hearth-dash-switcher-zone");
	zone.toggleClass("is-auto-hide", s.dashboardSwitcherVisibility === "hover");
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
				const copy: Dashboard = {
					id: newDashboardId(),
					name: t().dashboards.copySuffix(dash.name),
					cards: dash.cards.map((c) => cloneCard(c)),
				};
				if (dash.icon) copy.icon = dash.icon;
				if (dash.iconLucide) copy.iconLucide = dash.iconLucide;
				if (dash.gridColumns != null) copy.gridColumns = dash.gridColumns;
				if (dash.rowHeight != null) copy.rowHeight = dash.rowHeight;
				if (dash.fitToPage != null) copy.fitToPage = dash.fitToPage;
				if (dash.maxWidth != null) copy.maxWidth = dash.maxWidth;
				if (dash.showSearch != null) copy.showSearch = dash.showSearch;
				if (dash.compact != null) copy.compact = dash.compact;
				if (dash.cardOpacity != null) copy.cardOpacity = dash.cardOpacity;
				if (dash.cardBlur != null) copy.cardBlur = dash.cardBlur;
				if (dash.cardRadius != null) copy.cardRadius = dash.cardRadius;
				if (dash.cardBorderWidth != null)
					copy.cardBorderWidth = dash.cardBorderWidth;
				if (dash.header) copy.header = { ...dash.header };
				if (dash.background) copy.background = { ...dash.background };
				if (dash.backgroundLayout != null)
					copy.backgroundLayout = dash.backgroundLayout;
				if (dash.bannerHeight != null) copy.bannerHeight = dash.bannerHeight;
				if (dash.bannerFade != null) copy.bannerFade = dash.bannerFade;
				if (dash.bannerFullWidth != null)
					copy.bannerFullWidth = dash.bannerFullWidth;
				// linkedWorkspace is intentionally not copied: two dashboards
				// linked to the same workspace would race on auto-switch.
				const i = s.dashboards.findIndex((d) => d.id === dash.id);
				s.dashboards.splice(i + 1, 0, copy);
				s.activeDashboardId = copy.id;
				void view.plugin.saveData(s);
				view.render();
			}),
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
		return [
			{ id: "general", label: tabs.general, icon: "settings-2" },
			{ id: "header", label: tabs.header, icon: "heading" },
			{ id: "layout", label: tabs.layout, icon: "layout-dashboard" },
			{ id: "style", label: tabs.style, icon: "palette" },
			{ id: "background", label: tabs.background, icon: "image" },
		];
	}

	protected hearthRenderBody(body: HTMLElement, tabId: string): void {
		switch (tabId) {
			case "general":
				this.generalSection(body);
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

	/** Per-dashboard overrides for the header: the title/logo block, and whether
	 * the search section below it is drawn. */
	private headerSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;
		const header = dash.header;

		new Setting(containerEl)
			.setName(t().dashboards.modal.titleVisibility)
			.setDesc(t().dashboards.modal.titleVisibilityDesc)
			.addDropdown((d) => {
				d.addOption(
					"default",
					t().dashboards.modal.titleVisibilityDefault(
						s.showTitle
							? t().dashboards.modal.visibilityShown
							: t().dashboards.modal.visibilityHidden,
					),
				);
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
				d.addOption(
					"default",
					t().dashboards.modal.searchVisibilityDefault(
						s.showSearch
							? t().dashboards.modal.visibilityShown
							: t().dashboards.modal.visibilityHidden,
					),
				);
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

		this.overrideHeaderText(
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

		this.overrideHeaderText(
			containerEl,
			t().dashboards.modal.logoText,
			t().dashboards.modal.logoTextDesc,
			header?.logo,
			s.logo,
			(v) => {
				this.setHeaderOverride("logo", v);
				this.commit();
			},
		);

		this.overrideHeaderIcon(
			containerEl,
			t().dashboards.modal.logoIcon,
			t().dashboards.modal.logoIconDesc,
			header?.logoIcon,
			s.logoIcon,
			(v) => {
				this.setHeaderOverride("logoIcon", v);
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
			t().dashboards.modal.logoSize,
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

	private overrideHeaderText(
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
	 * The icon counterpart of {@link overrideHeaderText}: a toggle that takes the
	 * board off the global icon, and — once it has — a full Lucide picker.
	 *
	 * Turning the toggle on seeds the override with whatever the global icon is,
	 * so the board starts from the look it already had; clearing the picker
	 * leaves an empty override, which is a board that deliberately shows no
	 * Lucide icon while the global setting has one.
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
			addIconPicker(row, this.view.app, current, (v) => set(v));
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
					.setDynamicTooltip()
					.onChange((v) => set(v)),
			);
		}
	}

	/** Content width and fit-to-page, each an override of the global default. */
	private layoutSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const s = this.view.plugin.settings;

		this.overrideSlider(
			containerEl,
			t().dashboards.modal.contentWidth,
			dash.maxWidth,
			s.maxWidth,
			700,
			1600,
			20,
			(v) => {
				dash.maxWidth = v;
				this.commit();
			},
		);

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
					.setDynamicTooltip()
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
				.setDynamicTooltip()
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
				// Show the live value in a tooltip. On our declared minAppVersion
				// (1.8.7) sliders don't yet render the value inline, so this is
				// how the current opacity/blur stays visible while dragging.
				.setDynamicTooltip()
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
