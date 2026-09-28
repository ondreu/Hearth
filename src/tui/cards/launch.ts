/**
 * The launchpad cards as text: Links, Commands and New note from template.
 *
 * Their tiles become `[ label ]` buttons in the card's own order, laid out
 * left to right and wrapping at the card's width — the free-form tile geometry
 * is a graphical idea, and a row of buttons is the text interface's. A tile's
 * icon becomes its terminal glyph in front of the label.
 */
import { runCommand } from "../../cards/commands";
import { openLink } from "../../cards/links";
import { runTemplaterItem, tileLabel } from "../../cards/templater";
import { isEmojiIcon } from "../../fileicons";
import { iconGlyph } from "../../glyphs";
import { t } from "../../i18n";
import { resolveIconId } from "../../lucide";
import { isTemplaterAvailable } from "../../templater";
import type { TuiContext, TuiOutput, TuiRenderer } from "../card";
import { asciify } from "../text";
import { buttonGrid, type GridButton, messageOutput } from "./common";
import { tileWidth } from "./files";

/** A tile's label with its icon's glyph in front, when it has one. */
function label(icon: string | undefined, text: string): string {
	const raw = icon?.trim() ?? "";
	let mark = "";
	if (raw && isEmojiIcon(raw)) mark = asciify(raw);
	else if (raw && resolveIconId(raw)) mark = iconGlyph(raw);
	return mark ? `${mark} ${text}` : text;
}

function grid(ctx: TuiContext, buttons: GridButton[]): TuiOutput {
	const g = buttonGrid(ctx, buttons, { width: tileWidth(ctx.cols) });
	return { lines: g.lines, items: g.items, foot: t().tui.cards.launchFoot };
}

export const linksTui: TuiRenderer = {
	render(ctx) {
		const links = ctx.card.links ?? [];
		if (links.length === 0) return messageOutput(t().cards.empty.linksEmpty, ctx.cols);
		return grid(
			ctx,
			links.map((link) => ({
				label: label(link.icon, link.label || link.target),
				activate: () => openLink(ctx.view, link),
			})),
		);
	},
};

export const commandsTui: TuiRenderer = {
	render(ctx) {
		const commands = ctx.card.commands ?? [];
		if (commands.length === 0) return messageOutput(t().cards.empty.commandsEmpty, ctx.cols);
		return grid(
			ctx,
			commands.map((cmd) => ({
				label: label(cmd.icon, cmd.name || cmd.id),
				activate: () => runCommand(ctx.view, cmd),
			})),
		);
	},
};

export const templaterTui: TuiRenderer = {
	render(ctx) {
		if (!isTemplaterAvailable(ctx.view.app)) return messageOutput(t().cards.empty.templaterEnable, ctx.cols);
		const items = ctx.card.templater?.items ?? [];
		if (items.length === 0) return messageOutput(t().cards.empty.templaterEmpty, ctx.cols);
		// One note per press, as on the graphical card: making one is async and
		// Templater may prompt, so a second press while it runs is ignored.
		const busy = (ctx.state.busy ??= new Set<number>()) as Set<number>;
		return grid(
			ctx,
			items.map((item, i) => ({
				label: `${busy.has(i) ? "…" : "+"} ${label(undefined, tileLabel(item))}`,
				style: busy.has(i) ? "dim" : "green",
				activate: () => {
					if (busy.has(i)) return;
					busy.add(i);
					ctx.redraw();
					void runTemplaterItem(ctx.view, item).finally(() => {
						busy.delete(i);
						ctx.redraw();
					});
				},
			})),
		);
	},
};
