import { setIcon } from "obsidian";
import { applyTileSize, emptyState, makeTileDraggable, makeTileResizable, markOverlappingTiles } from "../cardbodies";
import { commandsEditor } from "../editors";
import { t } from "../i18n";
import { type CommandItem, type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Commands / command palette tiles -----------------------------------

export function renderCommands(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const commands = card.commands ?? [];
	if (commands.length === 0) {
		emptyState(body, "terminal", t().cards.empty.commandsEmpty);
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		// A per-tile size overrides the card default: it drives the tile's own
		// height/icon (via --hearth-tile) and, when larger than the base, makes
		// the tile span proportionally more grid columns so it's wider too.
		applyTileSize(tile, cmd.sizeW, cmd.sizeH, cmd.size, baseTile, cmd.col, cmd.row);
		setIcon(tile.createDiv("hearth-link-icon"), cmd.icon || "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		const run = () => runCommand(view, cmd);
		// In arrange mode, clicking a tile must NOT trigger its action.
		if (!view.arrangeMode) {
			tile.addEventListener("click", run);
			makeClickable(tile, run, cmd.name || cmd.id);
		}

		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => cmd.sizeW, (v) => {
				cmd.sizeW = v;
			}, () => cmd.sizeH, (v) => {
				cmd.sizeH = v;
			}, () => cmd.size, (v) => {
				cmd.size = v;
			});
			makeTileDraggable(view, grid, tile, commands, cmd, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}


function runCommand(view: HomeView, cmd: CommandItem): void {
	if (cmd.id) view.app.commands.executeCommandById(cmd.id);
}

/** A free-form grid of command-palette tiles. */
export const commandsCard: CardDefinition<"commands"> = {
	kind: "commands",
	templates: [
		{ id: "commands", name: "Commands", icon: "terminal-square", build: () => ({ kind: "commands", title: "Commands", commands: [], w: 6, h: 2 }) },
	],
	render: (view, card, body) => renderCommands(view, card, body),
	renderEditor: (container, ctx) => commandsEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.commands) copy.commands = source.commands.map((c) => ({ ...c }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
};
