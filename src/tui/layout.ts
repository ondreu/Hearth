/**
 * Card geometry on terminal mode's character grid.
 *
 * Terminal mode draws the same boards the graphical one does, from the same
 * stored geometry: `fx`/`fw` are fractions of the board's width and `fy`/`fh`
 * are pixels. A card's cell rectangle is that geometry rounded to the grid —
 * columns from the fractions, rows from the pixels at {@link ROW_PX} per row —
 * so a board arranged in either mode looks like itself in the other, and
 * arranging in terminal mode writes back geometry the graphical board reads.
 *
 * Pure: no DOM and no Obsidian import (unit-tested in test/tui-layout.test.ts).
 */
import type { FrameRect } from "./frames";

/** Board pixels one terminal row stands for. Close to the height of a row of
 * text at the default terminal font size, so a card keeps roughly the number
 * of lines it would show on the graphical board. */
export const ROW_PX = 18;

/** The smallest frame a card is drawn in: a title bar, one line of body, a
 * bottom border, and room for a few characters. */
export const MIN_CARD_COLS = 12;
export const MIN_CARD_ROWS = 3;

/** The fraction of the board a card's geometry defaults to when unset — the
 * same defaults the graphical board applies (src/grid.ts). */
const DEFAULT_FW = 0.25;
const DEFAULT_FH_PX = 56;

/** The stored free-form geometry a card carries. */
export interface CardGeometry {
	fx?: number;
	fy?: number;
	fw?: number;
	fh?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A card's rectangle on a board `cols` cells wide. Always at least the
 * minimum frame and always inside the board horizontally; vertically the
 * board simply grows. */
export function cardRect(g: CardGeometry, cols: number): FrameRect {
	const width = Math.max(MIN_CARD_COLS, cols);
	const fw = clamp(g.fw ?? DEFAULT_FW, 0.02, 1);
	const fx = clamp(g.fx ?? 0, 0, 1 - fw);
	let col = Math.round(fx * width);
	const end = Math.round((fx + fw) * width);
	let w = Math.max(MIN_CARD_COLS, end - col);
	if (w > width) w = width;
	if (col + w > width) col = Math.max(0, width - w);
	const row = Math.max(0, Math.round((g.fy ?? 0) / ROW_PX));
	const h = Math.max(MIN_CARD_ROWS, Math.round((g.fh ?? DEFAULT_FH_PX) / ROW_PX));
	return { col, row, cols: w, rows: h };
}

/** The stored geometry for a cell rectangle on a board `cols` cells wide —
 * the inverse of {@link cardRect}, used when a card is moved or resized in
 * terminal mode. */
export function rectGeometry(r: FrameRect, cols: number): Required<CardGeometry> {
	const width = Math.max(1, cols);
	const fw = clamp(r.cols / width, 0.02, 1);
	return {
		fx: clamp(r.col / width, 0, 1 - fw),
		fw,
		fy: Math.max(0, r.row * ROW_PX),
		fh: Math.max(MIN_CARD_ROWS, r.rows) * ROW_PX,
	};
}

/** Scale every rectangle's rows so the whole board fits `rows` rows — the
 * terminal counterpart of fit-to-page. A linear map of tops and bottoms, so
 * cards that didn't overlap still don't; never grows a board. */
export function fitRows<T extends FrameRect>(rects: readonly T[], rows: number): T[] {
	const bottom = rects.reduce((m, r) => Math.max(m, r.row + r.rows), 0);
	if (bottom <= rows || bottom === 0 || rows <= 0) return rects.map((r) => ({ ...r }));
	const k = rows / bottom;
	return rects.map((r) => {
		const top = Math.floor(r.row * k);
		const end = Math.floor((r.row + r.rows) * k);
		return { ...r, row: top, rows: Math.max(MIN_CARD_ROWS, end - top) };
	});
}

/** Stack rectangles into one full-width column, in order, each `heights[i]`
 * rows tall, sharing borders with the next — the narrow layout. */
export function stackRects(heights: readonly number[], cols: number): FrameRect[] {
	const out: FrameRect[] = [];
	let row = 0;
	for (const h of heights) {
		const rows = Math.max(MIN_CARD_ROWS - 1, h);
		out.push({ col: 0, row, cols: Math.max(MIN_CARD_COLS, cols), rows });
		// Share the border line with the card below.
		row += rows - 1;
	}
	return out;
}

/** How many rows a board of rectangles needs. */
export function boardRows(rects: readonly FrameRect[]): number {
	return rects.reduce((m, r) => Math.max(m, r.row + r.rows), 0);
}

/** The inner (body) area of a frame: inside the border, one cell of padding
 * left and right. */
export function bodyRect(r: FrameRect): FrameRect {
	return { col: r.col + 2, row: r.row + 1, cols: Math.max(0, r.cols - 4), rows: Math.max(0, r.rows - 2) };
}

/** Move `r` by whole cells, kept inside a board `cols` wide and below row 0. */
export function moveRect(r: FrameRect, dCol: number, dRow: number, cols: number): FrameRect {
	return {
		...r,
		col: clamp(r.col + dCol, 0, Math.max(0, cols - r.cols)),
		row: Math.max(0, r.row + dRow),
	};
}

/** Resize `r` by whole cells from its bottom-right corner, kept at least the
 * minimum frame and inside the board. */
export function resizeRect(r: FrameRect, dCols: number, dRows: number, cols: number): FrameRect {
	return {
		...r,
		cols: clamp(r.cols + dCols, MIN_CARD_COLS, Math.max(MIN_CARD_COLS, cols - r.col)),
		rows: Math.max(MIN_CARD_ROWS, r.rows + dRows),
	};
}

/**
 * Which tabs of a tab bar fit in `avail` cells, as the range `[from, to)` —
 * always holding `active`, the way tmux windows its status line. `widths` are
 * the tabs' widths; `marker` is the width of the "more this way" marker a side
 * with tabs left out gets, which the window makes room for.
 *
 * The window moves no more than it has to: it starts at the first tab while
 * the active one is among those that fit from there, and otherwise ends at the
 * active tab — so stepping along the bar slides it one tab at a time rather
 * than jumping a page — then takes whatever room is left after it.
 */
export function tabWindow(
	widths: readonly number[],
	active: number,
	avail: number,
	marker: number,
): { from: number; to: number } {
	const n = widths.length;
	const total = widths.reduce((sum, w) => sum + w, 0);
	if (n === 0 || total <= avail) return { from: 0, to: n };
	const at = Math.min(Math.max(active, 0), n - 1);
	const width = (from: number, to: number) =>
		widths.slice(from, to).reduce((sum, w) => sum + w, 0) + (from > 0 ? marker : 0) + (to < n ? marker : 0);
	const growRight = (from: number, to: number) => {
		while (to < n && width(from, to + 1) <= avail) to++;
		return to;
	};

	const first = growRight(0, 1);
	if (at < first) return { from: 0, to: first };

	let from = at;
	while (from > 0 && width(from - 1, at + 1) <= avail) from--;
	return { from, to: growRight(from, at + 1) };
}
