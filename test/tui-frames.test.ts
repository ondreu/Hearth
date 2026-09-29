import { describe, expect, it } from "vitest";
import { composeFrames, junction, mergeAdjacentEdges, type FrameSpec } from "../src/tui/frames";
import {
	bodyRect,
	cardRect,
	fitRows,
	MIN_CARD_COLS,
	MIN_CARD_ROWS,
	moveRect,
	rectGeometry,
	resizeRect,
	ROW_PX,
	stackRects,
} from "../src/tui/layout";

/** The composited grid as rows of text. */
function rows(frames: FrameSpec[], w: number, h: number): string[] {
	const g = composeFrames(frames, w, h);
	const out: string[] = [];
	for (let r = 0; r < h; r++) out.push(g.glyphs.slice(r * w, (r + 1) * w).join(""));
	return out;
}

const frame = (id: string, col: number, row: number, cols: number, rows: number, style: FrameSpec["style"] = "light"): FrameSpec => ({
	id,
	col,
	row,
	cols,
	rows,
	style,
});

describe("composeFrames", () => {
	it("draws one frame as a box", () => {
		expect(rows([frame("a", 0, 0, 4, 3)], 4, 3)).toEqual(["┌──┐", "│  │", "└──┘"]);
	});

	it("joins two frames that share an edge", () => {
		const out = rows([frame("a", 0, 0, 4, 3), frame("b", 3, 0, 4, 3)], 7, 3);
		expect(out).toEqual(["┌──┬──┐", "│  │  │", "└──┴──┘"]);
	});

	it("joins a frame under two others where their borders meet", () => {
		const out = rows([frame("a", 0, 0, 4, 3), frame("b", 3, 0, 4, 3), frame("c", 0, 2, 7, 3)], 7, 5);
		expect(out[2]).toBe("├──┴──┤");
	});

	it("draws a cross where four frames meet", () => {
		const out = rows([frame("a", 0, 0, 4, 3), frame("b", 3, 0, 4, 3), frame("c", 0, 2, 4, 3), frame("d", 3, 2, 4, 3)], 7, 5);
		expect(out[2]).toBe("├──┼──┤");
	});

	it("lets the focused card's heavy line win the shared cells", () => {
		const g = composeFrames([frame("a", 0, 0, 4, 3), frame("b", 3, 0, 4, 3, "heavy")], 7, 3);
		expect(g.styles[3]).toBe("heavy");
		expect(g.owners[3]).toBe("b");
	});

	it("clips frames past the grid and skips degenerate ones", () => {
		expect(() => composeFrames([frame("a", 5, 5, 10, 10), frame("b", 0, 0, 1, 1)], 6, 6)).not.toThrow();
		expect(rows([frame("b", 0, 0, 1, 1)], 2, 2)).toEqual(["  ", "  "]);
	});

	it("has a glyph for every side combination in every style", () => {
		for (const style of ["light", "heavy", "dashed", "double"] as const) {
			for (let sides = 1; sides < 16; sides++) expect(junction(sides, style)).not.toBe(" ");
			expect(junction(0, style)).toBe(" ");
		}
	});
});

describe("mergeAdjacentEdges", () => {
	it("pulls a border in the next column onto its neighbour's", () => {
		const [a, b] = mergeAdjacentEdges([frame("a", 0, 0, 4, 3), frame("b", 4, 0, 4, 3)]);
		expect(a.col + a.cols - 1).toBe(b.col);
	});

	it("leaves a real gap alone", () => {
		const [a, b] = mergeAdjacentEdges([frame("a", 0, 0, 4, 3), frame("b", 7, 0, 4, 3)]);
		expect(a.cols).toBe(4);
		expect(b.col).toBe(7);
	});

	it("does not touch the input", () => {
		const input = [frame("a", 0, 0, 4, 3), frame("b", 4, 0, 4, 3)];
		mergeAdjacentEdges(input);
		expect(input[0].cols).toBe(4);
	});
});

describe("layout", () => {
	it("maps a card's stored geometry onto cells and back", () => {
		const cols = 120;
		const r = cardRect({ fx: 0.25, fw: 0.5, fy: ROW_PX * 4, fh: ROW_PX * 10 }, cols);
		expect(r).toEqual({ col: 30, row: 4, cols: 60, rows: 10 });
		const g = rectGeometry(r, cols);
		expect(cardRect(g, cols)).toEqual(r);
	});

	it("never draws a card smaller than the minimum or outside the board", () => {
		const r = cardRect({ fx: 0.99, fw: 0.01, fh: 1 }, 80);
		expect(r.cols).toBeGreaterThanOrEqual(MIN_CARD_COLS);
		expect(r.rows).toBeGreaterThanOrEqual(MIN_CARD_ROWS);
		expect(r.col + r.cols).toBeLessThanOrEqual(80);
	});

	it("fits a tall board into the rows it has without overlapping cards", () => {
		const input = [frame("a", 0, 0, 10, 20), frame("b", 0, 20, 10, 20)];
		const out = fitRows(input, 20);
		expect(out[0].row + out[0].rows).toBeLessThanOrEqual(out[1].row + 1);
		expect(out[1].row + out[1].rows).toBeLessThanOrEqual(20);
	});

	it("never grows a board that already fits", () => {
		const input = [frame("a", 0, 0, 10, 5)];
		expect(fitRows(input, 50)).toEqual([{ ...input[0] }]);
	});

	it("stacks cards sharing their borders", () => {
		const [a, b] = stackRects([5, 6], 40);
		expect(b.row).toBe(a.row + a.rows - 1);
		expect(a.cols).toBe(40);
	});

	it("keeps the body inside the border with a cell of padding", () => {
		expect(bodyRect({ col: 0, row: 0, cols: 10, rows: 5 })).toEqual({ col: 2, row: 1, cols: 6, rows: 3 });
	});

	it("keeps a moved card on the board and a resized one at least minimal", () => {
		const r = { col: 2, row: 2, cols: 20, rows: 5 };
		expect(moveRect(r, -10, -10, 80)).toMatchObject({ col: 0, row: 0 });
		expect(moveRect(r, 100, 0, 80).col).toBe(60);
		expect(resizeRect(r, -100, -100, 80)).toMatchObject({ cols: MIN_CARD_COLS, rows: MIN_CARD_ROWS });
		expect(resizeRect(r, 100, 0, 80).cols).toBe(78);
	});
});
