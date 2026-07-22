import { Component } from "obsidian";
import { emptyState } from "../cardbodies";
import { leafEditor, leafTypeNote } from "../editors";
import { t } from "../i18n";
import { isLeafViewAvailable, isViewTypeHostable, mountLeafView } from "../leafview";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";

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
