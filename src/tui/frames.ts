/**
 * Box-drawn card frames, composited onto one character grid.
 *
 * Each card's border is not drawn on its own. Every frame on the board is
 * written into one shared grid of cells, each cell recording which of its four
 * sides a line leaves through, and only then is every cell turned into the
 * glyph that joins those sides. That is what lets two cards sharing an edge
 * meet in a proper `┬`, `├` or `┼` — one continuous line, the way a terminal
 * multiplexer draws its panes — instead of two borders side by side.
 *
 * Pure: no DOM and no Obsidian import (unit-tested in test/tui-frames.test.ts).
 */

/** How a frame's line is drawn. `heavy` marks the focused card, `dashed` a
 * card being arranged, `double` a dialog. */
export type BoxStyle = "light" | "heavy" | "dashed" | "double";

/** A frame's outer rectangle in cells, border included. */
export interface FrameRect {
	col: number;
	row: number;
	cols: number;
	rows: number;
}

/** A frame to composite: whose it is, where, and how it is drawn. */
export interface FrameSpec extends FrameRect {
	id: string;
	style: BoxStyle;
}

/** The composited grid: one glyph, one owner and one style per cell, row by
 * row. Cells no frame touches hold a space and no owner. */
export interface FrameGrid {
	width: number;
	height: number;
	glyphs: string[];
	owners: (string | null)[];
	styles: (BoxStyle | null)[];
}

const N = 1;
const E = 2;
const S = 4;
const W = 8;

/** Glyph for each combination of sides (N=1, E=2, S=4, W=8), per style. */
const TABLES: Record<BoxStyle, string> = {
	//      0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
	light: " ╵╶└╷│┌├╴┘─┴┐┤┬┼",
	heavy: " ╹╺┗╻┃┏┣╸┛━┻┓┫┳╋",
	dashed: " ╵╶└╷╎┌├╴┘╌┴┐┤┬┼",
	double: " ╵╶╚╷║╔╠╴╝═╩╗╣╦╬",
};

/** Which style wins a cell two frames share: the focused card's heavy line
 * over a dialog's double one over an arranging card's dashes over plain. */
const PRIORITY: Record<BoxStyle, number> = { light: 0, dashed: 1, double: 2, heavy: 3 };

/** The glyph joining `sides` (a bitmask of N/E/S/W) in `style`. */
export function junction(sides: number, style: BoxStyle): string {
	return Array.from(TABLES[style])[sides & 15] ?? " ";
}

/** Composite `frames` onto a `width` × `height` grid. Frames reaching past the
 * grid are clipped; a frame smaller than 2×2 cells draws nothing. */
export function composeFrames(frames: readonly FrameSpec[], width: number, height: number): FrameGrid {
	const size = Math.max(0, width) * Math.max(0, height);
	const sides = new Uint8Array(size);
	const owners: (string | null)[] = new Array<string | null>(size).fill(null);
	const styles: (BoxStyle | null)[] = new Array<BoxStyle | null>(size).fill(null);

	const mark = (c: number, r: number, bits: number, f: FrameSpec) => {
		if (c < 0 || r < 0 || c >= width || r >= height) return;
		const i = r * width + c;
		sides[i] |= bits;
		const cur = styles[i];
		if (cur === null || PRIORITY[f.style] >= PRIORITY[cur]) {
			styles[i] = f.style;
			owners[i] = f.id;
		}
	};

	for (const f of frames) {
		if (f.cols < 2 || f.rows < 2) continue;
		const c0 = f.col;
		const r0 = f.row;
		const c1 = f.col + f.cols - 1;
		const r1 = f.row + f.rows - 1;
		mark(c0, r0, E | S, f);
		mark(c1, r0, W | S, f);
		mark(c0, r1, E | N, f);
		mark(c1, r1, W | N, f);
		for (let c = c0 + 1; c < c1; c++) {
			mark(c, r0, E | W, f);
			mark(c, r1, E | W, f);
		}
		for (let r = r0 + 1; r < r1; r++) {
			mark(c0, r, N | S, f);
			mark(c1, r, N | S, f);
		}
	}

	const glyphs: string[] = new Array<string>(size);
	for (let i = 0; i < size; i++) {
		const style = styles[i];
		glyphs[i] = style ? junction(sides[i], style) : " ";
	}
	return { width, height, glyphs, owners, styles };
}

/**
 * Pull nearly-touching edges together, so two cards whose borders would land
 * one cell apart (`││`) share a single line instead.
 *
 * Card geometry is stored in board fractions and pixels, and rounding it to
 * cells can leave two cards that touch on a graphical board either sharing a
 * column or sitting in adjacent ones depending on the pane width. This decides
 * it one way: any right edge exactly one cell left of another card's left edge
 * — and overlapping it vertically — is moved onto it; the same for bottoms and
 * tops. Wider gaps are left alone: those were gaps on the board too.
 *
 * Returns new rectangles; the input is not modified.
 */
export function mergeAdjacentEdges<T extends FrameRect>(rects: readonly T[]): T[] {
	const out = rects.map((r) => ({ ...r }));
	for (const a of out) {
		for (const b of out) {
			if (a === b) continue;
			const overlapRows = a.row < b.row + b.rows && b.row < a.row + a.rows;
			if (overlapRows && a.col + a.cols === b.col) a.cols += 1;
			const overlapCols = a.col < b.col + b.cols && b.col < a.col + a.cols;
			if (overlapCols && a.row + a.rows === b.row) a.rows += 1;
		}
	}
	return out;
}
