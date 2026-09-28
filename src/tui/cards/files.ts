/**
 * The file-list cards as text: Recent files and Favorites.
 *
 * Both draw "a card's files" (src/cards/fileview.ts) and keep its two views:
 * the list is a table row per file — type, name, and on the right the age or
 * the folder — and the tiles are a grid of `[ name ]` buttons. The data is the
 * graphical cards' own: the same history, filters and counts.
 */
import { TFile } from "obsidian";
import { favoritesFor } from "../../cards/favorites";
import { fileViewFor } from "../../cards/fileview";
import { groupForFile } from "../../filetypes";
import { t } from "../../i18n";
import { clampRecentCount, RECENT_HISTORY_MAX, recentFilePaths } from "../../recentfiles";
import type { DashboardCard } from "../../types";
import type { HomeView } from "../../view";
import type { TuiContext, TuiOutput, TuiRenderer } from "../card";
import { asciify, padStart, shortAge, spread, type Line } from "../text";
import { buttonGrid, fileFolder, fileMenu, fileTag, fileTagStyle, listOutput, messageOutput, openCardFile, type Row } from "./common";

type Entry = { file: TFile } | { missing: string };

/** Draw `entries` in the card's list or tiles view. `right` is the dim column
 * on a list row. */
function drawFiles(ctx: TuiContext, entries: Entry[], right: (file: TFile) => string): TuiOutput {
	const { view } = ctx;
	if (fileViewFor(ctx.card) === "tiles") {
		const grid = buttonGrid(
			ctx,
			entries.map((e) =>
				"file" in e
					? {
							label: e.file.basename,
							activate: (evt) => openCardFile(view, e.file, evt),
							menu: (evt) => fileMenu(view, e.file, evt),
						}
					: { label: e.missing, style: ["dim", "strike"], activate: () => {} },
			),
			{ width: tileWidth(ctx.cols) },
		);
		return { lines: grid.lines, items: grid.items, foot: t().tui.cards.filesFoot };
	}
	const rows: Row[] = entries.map((e) => {
		if (!("file" in e)) {
			return { lines: [{ text: "gone ", style: "red" }, { text: asciify(e.missing), style: ["dim", "strike"] }] };
		}
		const file = e.file;
		const tagText = fileTag(file).padEnd(5, " ");
		const r = right(file);
		const line: Line = spread(
			[{ text: tagText, style: fileTagStyle(file) }, { text: asciify(file.basename) }],
			r ? [{ text: ` ${r}`, style: "dim" }] : [],
			ctx.cols,
		);
		return {
			lines: line,
			activate: (evt) => openCardFile(view, file, evt),
			menu: (evt) => fileMenu(view, file, evt),
		};
	});
	return { ...listOutput(rows), foot: t().tui.cards.filesFoot };
}

/** The width that gives a tiles grid even columns: three across when the
 * body is wide enough, fewer when it isn't, never narrower than a name. */
export function tileWidth(cols: number): number {
	const across = cols >= 72 ? 4 : cols >= 48 ? 3 : cols >= 28 ? 2 : 1;
	return Math.max(8, Math.floor((cols - (across - 1)) / across));
}

// ---- Recent files -------------------------------------------------------------

function recentEntries(view: HomeView, card: DashboardCard, rows: number): TFile[] {
	const auto = card.recentAuto === true;
	const count = auto ? Math.max(1, Math.min(RECENT_HISTORY_MAX, rows)) : clampRecentCount(card.count);
	const types = card.recentTypes && card.recentTypes.length > 0 ? new Set(card.recentTypes) : null;
	return recentFilePaths(view.app)
		.map((p) => view.app.vault.getAbstractFileByPath(p))
		.filter((f): f is TFile => f instanceof TFile)
		.filter((f) => {
			if (!types) return true;
			const group = groupForFile(f);
			return group != null && types.has(group.id);
		})
		.slice(0, count);
}

export const recentTui: TuiRenderer = {
	render(ctx) {
		const files = recentEntries(ctx.view, ctx.card, ctx.zoomed ? RECENT_HISTORY_MAX : ctx.rows);
		if (files.length === 0) return messageOutput(t().cards.empty.recentEmpty, ctx.cols);
		const out = drawFiles(ctx, files.map((file) => ({ file })), (file) => padStart(shortAge(Date.now() - file.stat.mtime), 4));
		return { ...out, hint: String(files.length) };
	},
};

// ---- Favorites -------------------------------------------------------------------

export const favoritesTui: TuiRenderer = {
	render(ctx) {
		const paths = favoritesFor(ctx.view, ctx.card);
		if (!paths.length) return messageOutput(t().cards.empty.favoritesEmpty, ctx.cols);
		const entries: Entry[] = paths.map((path) => {
			const file = ctx.view.app.vault.getAbstractFileByPath(path);
			return file instanceof TFile ? { file } : { missing: path };
		});
		return drawFiles(ctx, entries, (file) => fileFolder(file));
	},
};
