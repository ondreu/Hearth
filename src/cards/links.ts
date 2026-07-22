import { setIcon, TFile } from "obsidian";
import { applyTileSize, emptyState, makeTileDraggable, makeTileResizable, markOverlappingTiles } from "../cardbodies";
import { linksEditor } from "../editors";
import { t } from "../i18n";
import { type DashboardCard, type LinkItem } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Links / launchpad --------------------------------------------------

export function renderLinks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const links = card.links ?? [];
	if (links.length === 0) {
		emptyState(body, "layout-grid", t().cards.empty.linksEmpty);
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	// Flag the card body so CSS can disable the card drag overlay over tiles in
	// arrange mode (tiles are self-contained widgets with their own resize).
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, link.sizeW, link.sizeH, link.size, baseTile, link.col, link.row);
		setIcon(tile.createDiv("hearth-link-icon"), link.icon || "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		const open = () => openLink(view, link);
		// In arrange mode, clicking a tile must NOT trigger its action — the
		// click is almost always the tail end of a resize/drag gesture.
		if (!view.arrangeMode) {
			tile.addEventListener("click", open);
			makeClickable(tile, open, link.label || link.target);
		}

		// Tiles can only be resized/repositioned while the dashboard is in
		// arrange mode.
		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => link.sizeW, (v) => {
				link.sizeW = v;
			}, () => link.sizeH, (v) => {
				link.sizeH = v;
			}, () => link.size, (v) => {
				link.size = v;
			});
			makeTileDraggable(view, grid, tile, links, link, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}


function openLink(view: HomeView, link: LinkItem): void {
	switch (link.type) {
		case "url":
			if (link.target) window.open(link.target, "_blank");
			break;
		case "command":
			if (link.target) view.app.commands.executeCommandById(link.target);
			break;
		case "note": {
			const file = view.app.vault.getAbstractFileByPath(link.target);
			if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
			else if (link.target) void view.app.workspace.openLinkText(link.target, "", true);
			break;
		}
	}
}

/** A free-form launchpad of link tiles. */
export const linksCard: CardDefinition<"links"> = {
	kind: "links",
	templates: [
		{ id: "links", name: "Links / launchpad", icon: "layout-grid", build: () => ({ kind: "links", title: "Links", links: [], w: 6, h: 2 }) },
	],
	render: (view, card, body) => renderLinks(view, card, body),
	renderEditor: (container, ctx) => linksEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.links) copy.links = source.links.map((l) => ({ ...l }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
};
