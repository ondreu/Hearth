import { Menu, Modal, Setting, setIcon } from "obsidian";
import type { HomeView } from "./view";
import {
	type BackgroundConfig,
	type BackgroundKind,
	type Dashboard,
	CARD_RADIUS_MAX,
	DEFAULT_SETTINGS,
	newDashboardId,
	cloneCard,
} from "./types";
import { confirmAction } from "./ui";
import { t } from "./i18n";

/** A per-dashboard background's opacity and blur default to — and reset to —
 * the global background defaults, so a dashboard override starts from the same
 * look as the global background. */
const DEFAULT_DASH_BG_OPACITY = DEFAULT_SETTINGS.backgroundOpacity;
const DEFAULT_DASH_BG_BLUR = DEFAULT_SETTINGS.backgroundBlur;

/**
 * The top-left dashboard switcher: a button per dashboard (its emoji/icon or its
 * 1-based number) plus a "+" to add one. Clicking switches to it; right-clicking
 * opens a menu to edit its settings or delete it.
 */
export function renderDashboardSwitcher(view: HomeView, container: HTMLElement): void {
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
		if (lucide) {
			setIcon(btn, lucide);
		} else {
			btn.setText(icon || String(i + 1));
		}
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

/** Context menu for a single dashboard button: settings and delete. */
function showDashboardMenu(view: HomeView, dash: Dashboard, evt: MouseEvent): void {
	const s = view.plugin.settings;
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle(t().dashboards.menu.settings)
			.setIcon("settings-2")
			.onClick(() => new DashboardSettingsModal(view, dash).open()),
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
				if (dash.cardOpacity != null) copy.cardOpacity = dash.cardOpacity;
				if (dash.cardBlur != null) copy.cardBlur = dash.cardBlur;
				if (dash.cardRadius != null) copy.cardRadius = dash.cardRadius;
				if (dash.background) copy.background = { ...dash.background };
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
 * the global settings when left off. */
class DashboardSettingsModal extends Modal {
	private view: HomeView;
	private dash: Dashboard;

	constructor(view: HomeView, dash: Dashboard) {
		super(view.app);
		this.view = view;
		this.dash = dash;
	}

	onOpen(): void {
		this.titleEl.setText(t().dashboards.modal.title);
		this.render();
	}

	/** Persist and refresh the live view without closing the modal. */
	private commit(): void {
		void this.view.plugin.saveData(this.view.plugin.settings);
		this.view.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const dash = this.dash;
		const s = this.view.plugin.settings;

		new Setting(contentEl).setName(t().dashboards.modal.name).addText((tx) =>
			tx.setValue(dash.name).onChange((v) => {
				dash.name = v || t().dashboards.fallbackName;
				this.commit();
			}),
		);

		new Setting(contentEl)
			.setName(t().dashboards.modal.switcherIcon)
			.setDesc(t().dashboards.modal.switcherIconDesc)
			.addText((tx) =>
				tx.setValue(dash.icon ?? "").onChange((v) => {
					dash.icon = v.trim() || undefined;
					this.commit();
				}),
			);

		new Setting(contentEl)
			.setName(t().dashboards.modal.switcherLucide)
			.setDesc(t().dashboards.modal.switcherLucideDesc)
			.addText((tx) =>
				tx
					.setPlaceholder(t().dashboards.modal.lucidePlaceholder)
					.setValue(dash.iconLucide ?? "")
					.onChange((v) => {
						dash.iconLucide = v.trim() || undefined;
						this.commit();
					}),
			);

		new Setting(contentEl)
			.setName(t().dashboards.modal.showSearch)
			.setDesc(t().dashboards.modal.showSearchDesc)
			.addToggle((tg) =>
				tg.setValue(dash.showSearch ?? true).onChange((v) => {
					dash.showSearch = v ? undefined : false;
					this.commit();
				}),
			);

		this.overrideSlider(
			contentEl,
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

		new Setting(contentEl)
			.setName(t().dashboards.modal.fitToPage)
			.setDesc(t().dashboards.modal.fitToPageDesc)
			.addDropdown((d) => {
				d.addOption(
					"default",
					t().dashboards.modal.fitDefault(
						s.fitToPage ? t().dashboards.modal.fitStateFit : t().dashboards.modal.fitStateScroll,
					),
				);
				d.addOption("fit", t().dashboards.modal.fitOptionFit);
				d.addOption("scroll", t().dashboards.modal.fitOptionScroll);
				d.setValue(dash.fitToPage === undefined ? "default" : dash.fitToPage ? "fit" : "scroll");
				d.onChange((v) => {
					dash.fitToPage = v === "default" ? undefined : v === "fit";
					this.commit();
				});
			});

		this.overrideSlider(
			contentEl,
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
			contentEl,
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
			contentEl,
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

		this.backgroundSection(contentEl);

		new Setting(contentEl).addButton((b) =>
			b.setButtonText(t().dashboards.modal.done).setCta().onClick(() => this.close()),
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
				Object.entries(t().dashboards.backgroundOptions).forEach(([k, label]) => {
					d.addOption(k, label);
				});
				d.setValue(bg ? bg.kind : "default").onChange((v) => {
					if (v === "default") {
						dash.background = undefined;
					} else {
						dash.background = {
							kind: v as BackgroundKind,
							value: bg?.value ?? "",
							opacity: bg?.opacity ?? DEFAULT_DASH_BG_OPACITY,
							blur: bg?.blur ?? DEFAULT_DASH_BG_BLUR,
						};
					}
					this.commit();
					this.render();
				});
			});

		if (!bg || bg.kind === "none") return;

		if (bg.kind !== "default") {
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

		this.bgNumber(containerEl, t().dashboards.modal.opacity, bg, "opacity", 0, 1, 0.05, DEFAULT_DASH_BG_OPACITY);
		this.bgNumber(containerEl, t().dashboards.modal.blur, bg, "blur", 0, 40, 1, DEFAULT_DASH_BG_BLUR);
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
