import { describe, expect, it } from "vitest";
import { type CardBox, cardsMerge, mergedRuns } from "../src/grid";

/**
 * The frost's run grouping (src/grid.ts). One blur layer per run of touching
 * cards is what keeps a card's frosted glass off the wallpaper between it and
 * the next card: a layer covering every blurred card on the board has to span
 * those gaps, and then only its mask keeps the blur out of them.
 *
 * `cardsMerge` is deliberately the same test that decides whether two cards
 * sharpen their corners and drop their shared border, so the blur can never
 * group cards differently from how they look. These tests pin both halves.
 */

/** A card box from left/top/width/height, the way the DOM reports one. */
function box(left: number, top: number, w: number, h: number): CardBox {
	return { left, top, right: left + w, bottom: top + h };
}

/** Sort a partition into a comparable shape, since run order within the array
 *  is position-based but membership is what matters. */
function shape(runs: CardBox[][]): number[][] {
	return runs.map((r) => r.map((c) => c.left).sort((a, b) => a - b));
}

describe("cardsMerge", () => {
	it("joins cards that share an edge with real overlap", () => {
		// Side by side, touching exactly.
		expect(cardsMerge(box(0, 0, 100, 100), box(100, 0, 100, 100))).toBe(true);
		// Stacked, touching exactly.
		expect(cardsMerge(box(0, 0, 100, 100), box(0, 100, 100, 100))).toBe(true);
		// Order must not matter.
		expect(cardsMerge(box(100, 0, 100, 100), box(0, 0, 100, 100))).toBe(true);
	});

	// The 2px slack exists for sub-pixel rendering, not for cards that merely
	// sit near each other — a board's normal card gap is far wider.
	it("keeps cards apart once the gap is more than the touch slack", () => {
		expect(cardsMerge(box(0, 0, 100, 100), box(102, 0, 100, 100))).toBe(true);
		expect(cardsMerge(box(0, 0, 100, 100), box(103, 0, 100, 100))).toBe(false);
		expect(cardsMerge(box(0, 0, 100, 100), box(112, 0, 100, 100))).toBe(false);
	});

	// Two cards diagonally adjacent touch at a single point. Blurring them as
	// one surface would frost the empty quadrants between them.
	it("does not join cards that only brush at a corner", () => {
		expect(cardsMerge(box(0, 0, 100, 100), box(100, 100, 100, 100))).toBe(false);
		// A sliver of overlap is still not enough (the OVERLAP floor).
		expect(cardsMerge(box(0, 0, 100, 100), box(100, 95, 100, 100))).toBe(false);
		// …but a real shared edge is.
		expect(cardsMerge(box(0, 0, 100, 100), box(100, 90, 100, 100))).toBe(true);
	});
});

describe("mergedRuns", () => {
	it("gives a lone card a run of its own", () => {
		const a = box(0, 0, 100, 100);
		expect(mergedRuns([a])).toEqual([[a]]);
	});

	// The case that motivates the whole thing: two cards at opposite ends of a
	// board must never share a layer, or that layer spans the gap between them.
	it("keeps far-apart cards in separate runs", () => {
		const runs = mergedRuns([box(0, 0, 100, 100), box(600, 0, 100, 100)]);
		expect(runs).toHaveLength(2);
		expect(shape(runs)).toEqual([[0], [600]]);
	});

	it("collects a chain of touching cards into one run", () => {
		// A—B—C in a row: A touches B, B touches C, A does not touch C.
		const runs = mergedRuns([
			box(0, 0, 100, 100),
			box(100, 0, 100, 100),
			box(200, 0, 100, 100),
		]);
		expect(runs).toHaveLength(1);
		expect(shape(runs)).toEqual([[0, 100, 200]]);
	});

	it("separates two runs that each merge internally", () => {
		const runs = mergedRuns([
			box(0, 0, 100, 100),
			box(100, 0, 100, 100),
			box(500, 0, 100, 100),
			box(600, 0, 100, 100),
		]);
		expect(runs).toHaveLength(2);
		expect(shape(runs)).toEqual([[0, 100], [500, 600]]);
	});

	// An L: the corner card joins both arms, so all three are one surface.
	it("follows connectivity around a corner", () => {
		const runs = mergedRuns([
			box(0, 0, 100, 100),
			box(100, 0, 100, 100),
			box(100, 100, 100, 100),
		]);
		expect(runs).toHaveLength(1);
		expect(runs[0]).toHaveLength(3);
	});

	// Run order keys the layer's identity (data-frost), so it has to be stable
	// under a reordered input — otherwise a reflow swaps two layers' masks.
	it("orders runs by position, not by input order", () => {
		const near = box(10, 10, 100, 100);
		const far = box(10, 500, 100, 100);
		expect(shape(mergedRuns([far, near]))).toEqual([[10], [10]]);
		expect(mergedRuns([far, near])[0][0].top).toBe(10);
		expect(mergedRuns([near, far])[0][0].top).toBe(10);
	});

	it("returns every card exactly once", () => {
		const boxes = [
			box(0, 0, 100, 100),
			box(100, 0, 100, 100),
			box(400, 0, 100, 100),
			box(0, 300, 100, 100),
		];
		const runs = mergedRuns(boxes);
		const flat = runs.flat();
		expect(flat).toHaveLength(boxes.length);
		expect(new Set(flat).size).toBe(boxes.length);
	});

	it("handles an empty board", () => {
		expect(mergedRuns([])).toEqual([]);
	});
});
