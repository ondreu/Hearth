import { Component, setIcon, Setting } from "obsidian";
import { emptyState } from "../cardbodies";
import { t } from "../i18n";
import { isLeafViewAvailable, isViewTypeHostable, listLeafViewTypes, mountLeafView } from "../leafview";
import { FilePickerModal } from "../pickers";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


/** A card that hosts another plugin's (or a core) registered side-panel view —
 * a calendar, outline, tag pane, kanban board, and so on — by mounting a
 * detached workspace leaf inside the card body. Beta.
 *
 * The card shows a friendly prompt when it has no view chosen yet, or when the
 * chosen view type isn't registered right now (the plugin that provides it is
 * disabled or uninstalled). Mounting is best-effort: `mountLeafView` never
 * throws, and the hosted leaf's lifecycle is tied to `component`, so it is torn
 * down cleanly on the next redraw or when the dashboard closes. */
export function renderLeaf(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const type = card.leafView?.viewType?.trim();
	if (!type) {
		emptyState(body, "layout-panel-left", t().cards.empty.leafPickView);
		return;
	}
	if (!isViewTypeHostable(view.app, type)) {
		emptyState(body, "layout-panel-left", t().cards.empty.leafViewMissing);
		return;
	}

	const host = body.createDiv("hearth-leaf-host");
	// Hosted views are natively interactive and manage their own scrolling, so
	// let them fill the card edge-to-edge like canvas/Excalidraw embeds do.
	body.addClass("hearth-card-body-live");
	// Optionally suppress the hosted view's breadcrumbs/nav/kebab header — for a
	// single-file card that chrome is just noise.
	if (card.leafView?.hideHeader) host.addClass("hearth-leaf-hide-header");
	if (!mountLeafView(view.app, type, host, component, card.leafView?.file)) {
		host.remove();
		body.removeClass("hearth-card-body-live");
		emptyState(body, "layout-panel-left", t().cards.empty.leafViewMissing);
	}
}


/** The performance note shown under the type dropdown for the leaf card. */
export function leafTypeNote(containerEl: HTMLElement): void {
	const note = new Setting(containerEl).setDesc(t().editors.leaf.perfNote);
	note.settingEl.addClass("hearth-setting-note");
	const icon = createSpan("hearth-setting-note-icon");
	setIcon(icon, "gauge");
	note.descEl.prepend(icon);
}


	/** Pick which registered side-panel view the "leaf" card hosts. The dropdown
	 * lists every hostable view type found in the app right now (core panes plus
	 * whatever community plugins have registered), so the choices depend on which
	 * plugins are enabled. */
export function leafEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.leafView ??= {});
	const types = listLeafViewTypes(ctx.app);

	const setting = new Setting(containerEl)
		.setName(t().editors.leaf.view)
		.setDesc(t().editors.leaf.viewDesc);

	if (types.length === 0) {
		setting.setDesc(t().editors.leaf.none);
		return;
	}

	setting.addDropdown((d) => {
		d.addOption("", t().editors.leaf.pickPlaceholder);
		for (const vt of types) d.addOption(vt.type, vt.name);
		// Keep a previously-chosen view selectable even if its plugin is now
		// disabled, so switching the plugin back on restores the card as-is.
		const current = cfg.viewType?.trim();
		if (current && !types.some((vt) => vt.type === current)) {
			d.addOption(current, current);
		}
		d.setValue(current ?? "").onChange((v) => {
			cfg.viewType = v || undefined;
			// A file chosen for the old view can't be shown by the new one and
			// makes file-backed views throw, so drop it when the view changes.
			cfg.file = undefined;
			ctx.opts.save();
			ctx.requestRender();
			ctx.opts.rerender();
		});
	});

	const fileSetting = new Setting(containerEl)
		.setName(t().editors.leaf.file)
		.setDesc(t().editors.leaf.fileDesc);
	fileSetting.addText((txt) =>
		txt
			.setPlaceholder(t().editors.leaf.filePlaceholder)
			.setValue(cfg.file ?? "")
			.onChange((v) => {
				const trimmed = v.trim();
				cfg.file = trimmed || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	fileSetting.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.leaf.pickFile)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					cfg.file = file.path;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
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
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}),
		);
	}

	new Setting(containerEl)
		.setName(t().editors.leaf.hideHeader)
		.setDesc(t().editors.leaf.hideHeaderDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.hideHeader ?? false).onChange((v) => {
				cfg.hideHeader = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	new Setting(containerEl)
		.setName(t().editors.leaf.note)
		.setDesc(t().editors.leaf.noteDesc);
}

/** Hosts another plugin's registered side-panel view inside a card. Beta. */
export const leafCard: CardDefinition<"leaf"> = {
	kind: "leaf",
	templates: [
		{
			id: "leaf",
			name: "Plugin view (beta)",
			icon: "layout-panel-left",
			build: () => ({ kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 }),
			available: (app) => isLeafViewAvailable(app),
		},
	],
	render: (view, card, body, component) => renderLeaf(view, card, body, component),
	renderEditor: (container, ctx) => leafEditor(ctx, container),
	editorTypeNote: (container) => leafTypeNote(container),
	liveness: { mode: "static" },
};
