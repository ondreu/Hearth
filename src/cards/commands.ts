import { setTooltip, Setting } from "obsidian";
import { applyTileSize, createTileGrid, emptyState, makeTileDraggable, makeTileResizable, markOverlappingTiles } from "../cardbodies";
import { moveItem } from "../editors";
import { t } from "../i18n";
import { CommandPickerModal } from "../pickers";
import { tileSizing } from "../tiles";
import { addIconHelp, applyTileVisual } from "../widgeticon";
import { type CommandItem, type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Commands / command palette tiles -----------------------------------

export function renderCommands(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const commands = card.commands ?? [];
	if (commands.length === 0) {
		emptyState(body, "terminal", t().cards.empty.commandsEmpty);
		return;
	}

	const { grid, spec } = createTileGrid(view, card, body);
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		// A per-tile size overrides the card default: how many cells of the
		// card's grid the tile spans, in either sizing style.
		applyTileSize(tile, cmd, spec);
		applyTileVisual(view, tile, cmd.icon, "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		const run = () => runCommand(view, cmd);
		// In arrange mode, clicking a tile must NOT trigger its action.
		if (!view.arrangeMode) {
			tile.addEventListener("click", run);
			makeClickable(tile, run, cmd.name || cmd.id);
		}

		if (view.arrangeMode) {
			makeTileResizable(view, tile, cmd, spec);
			makeTileDraggable(view, grid, tile, cmd, card.tileAutoFlow === true, spec);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}


function runCommand(view: HomeView, cmd: CommandItem): void {
	if (cmd.id) view.app.commands.executeCommandById(cmd.id);
}


export function commandsEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	new Setting(containerEl)
		.setName(t().editors.commands.autoShift)
		.setDesc(t().editors.commands.autoShiftDesc)
		.addToggle((t) =>
			t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
				card.tileAutoFlow = v;
				ctx.opts.save();
			}),
		);
	// Only the fixed style has a pixel size to set; the scaled one sizes its
	// buttons from the card's column count (see tileSizingSettings).
	if (tileSizing(card) === "fixed") {
		const buttonSize = new Setting(containerEl)
			.setName(t().editors.commands.buttonSize)
			.setDesc(t().editors.commands.buttonSizeDesc);
		buttonSize.addSlider((s) => {
			s.setLimits(60, 180, 10)
				.setValue(card.tileSize ?? 90)
				.onChange((v) => {
					card.tileSize = v === 90 ? undefined : v;
					ctx.opts.save();
				});
		});
		buttonSize.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.tileSize = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}

	new Setting(containerEl).setName(t().editors.commands.heading).setHeading();
	const commands = (ctx.card.commands ??= []);

	commands.forEach((cmd, index) => {
		const row = new Setting(containerEl)
			.setClass("hearth-link-setting")
			.setName(cmd.name || cmd.id);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.commands.iconOptionalPlaceholder)
				.setValue(cmd.icon ?? "")
				.onChange((v) => {
					cmd.icon = v || undefined;
					ctx.opts.save();
				});
			setTooltip(txt.inputEl, t().editors.iconHelp);
		});
		addIconHelp(row.controlEl);
		// A pixel size per tile only means something in the fixed style; a scaled
		// button is sized in whole cells, by dragging its corner in arrange mode.
		if (tileSizing(card) === "fixed") {
			row.addText((txt) => {
				txt
					.setPlaceholder(t().editors.commands.sizePlaceholder)
					.setValue(cmd.size ? String(cmd.size) : "")
					.onChange((v) => {
						const n = parseInt(v, 10);
						cmd.size = Number.isNaN(n) || n <= 0 ? undefined : n;
						ctx.opts.save();
					});
				txt.inputEl.type = "number";
				txt.inputEl.addClass("hearth-count-input");
				txt.inputEl.setAttribute(
					"aria-label",
					t().editors.commands.tileSizeAria,
				);
			});
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.commands.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, commands, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.commands.moveDown)
				.setDisabled(index === commands.length - 1)
				.onClick(() => moveItem(ctx, commands, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.commands.removeCommand)
				.onClick(() => {
					commands.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.commands.addCommand).onClick(() => {
			new CommandPickerModal(ctx.app, (command) => {
				commands.push({
					id: command.id,
					name: command.name,
					icon: command.icon,
				});
				ctx.opts.save();
				ctx.requestRender();
			}).open();
		}),
	);
}

/** A free-form grid of command-palette tiles. */
export const commandsCard: CardDefinition<"commands"> = {
	kind: "commands",
	templates: [
		{
			id: "commands",
			name: "Commands",
			icon: "terminal-square",
			// New cards scale their buttons with the card; see the Links template.
			build: () => ({ kind: "commands", title: "Commands", commands: [], tileSizing: "scale", w: 6, h: 2 }),
		},
	],
	render: (view, card, body) => renderCommands(view, card, body),
	renderEditor: (container, ctx) => commandsEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.commands) copy.commands = source.commands.map((c) => ({ ...c }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
	tileButtons: true,
};
