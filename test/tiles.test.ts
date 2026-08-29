import { describe, expect, it } from "vitest";
import {
	FIXED_TILE_BASE,
	TILE_COLS_DEFAULT,
	TILE_COLS_MAX,
	TILE_COLS_MIN,
	TILE_GAP,
	fixedRowHeight,
	isTilePinned,
	maxSpanW,
	pinTile,
	pixelsFromSpan,
	resizeTile,
	spanFromPixels,
	tileCols,
	tileMetrics,
	tilePlacement,
	tileSizing,
	tileSpans,
	tileSpec,
	tileStartSize,
	unpinTile,
	type TileSpec,
} from "../src/tiles";
import type { DashboardCard, TileGeometry } from "../src/types";

/**
 * The two ways a launchpad-like card sizes its buttons.
 *
 * What's pinned here is the pair of promises the feature rests on:
 *
 *   1. **the fixed style is untouched** — a card stored before the scaled style
 *      existed carries no `tileSizing`, and every number it is drawn from is
 *      the one it was drawn from before (44px cells, 34px rows, the legacy
 *      single `size` standing in for a missing width/height);
 *   2. **the scaled style is a fraction of the card** — a button spans whole
 *      cells of the card's own grid, so its pixel size follows the card, and it
 *      can never leave the grid however odd the stored numbers are.
 *
 * Plus the thing that makes switching between them safe: neither style writes
 * into the other's fields, so a card switched over and back is where it began.
 */

function card(over: Partial<DashboardCard> = {}): DashboardCard {
	return { id: "c1", kind: "links", ...over } as DashboardCard;
}

const FIXED: TileSpec = { sizing: "fixed", baseTile: FIXED_TILE_BASE, cols: TILE_COLS_DEFAULT };
const SCALED: TileSpec = { sizing: "scale", baseTile: FIXED_TILE_BASE, cols: 6 };


describe("tileSizing / tileSpec", () => {
	it("reads a card with no sizing style as the fixed one", () => {
		expect(tileSizing(card())).toBe("fixed");
		expect(tileSizing(card({ tileSizing: "fixed" }))).toBe("fixed");
		expect(tileSizing(card({ tileSizing: "scale" }))).toBe("scale");
	});

	it("resolves the card's defaults", () => {
		expect(tileSpec(card())).toEqual({
			sizing: "fixed",
			baseTile: 90,
			cols: TILE_COLS_DEFAULT,
		});
		expect(tileSpec(card({ tileSizing: "scale", tileSize: 120, tileCols: 4 }))).toEqual({
			sizing: "scale",
			baseTile: 120,
			cols: 4,
		});
	});

	it("ignores a nonsense tile size, as it always did", () => {
		expect(tileSpec(card({ tileSize: 0 })).baseTile).toBe(90);
		expect(tileSpec(card({ tileSize: -40 })).baseTile).toBe(90);
	});

	it("clamps the column count to what the grid can draw", () => {
		expect(tileCols(undefined)).toBe(TILE_COLS_DEFAULT);
		expect(tileCols(1)).toBe(TILE_COLS_MIN);
		expect(tileCols(999)).toBe(TILE_COLS_MAX);
		expect(tileCols(7.4)).toBe(7);
		expect(tileCols(Number.NaN)).toBe(TILE_COLS_DEFAULT);
	});
});


describe("tileSpans — the fixed style", () => {
	it("defaults to the old 2×2 fine-grid footprint", () => {
		expect(tileSpans({}, FIXED)).toEqual({ cs: 2, rs: 2 });
	});

	it("divides pixels by the fine cell", () => {
		expect(tileSpans({ sizeW: 176, sizeH: 68 }, FIXED)).toEqual({ cs: 4, rs: 2 });
		expect(tileSpans({ sizeW: 44, sizeH: 34 }, FIXED)).toEqual({ cs: 1, rs: 1 });
	});

	it("stands the legacy single size in for a missing axis", () => {
		expect(tileSpans({ size: 132 }, FIXED)).toEqual({ cs: 3, rs: 4 });
		expect(tileSpans({ size: 132, sizeH: 34 }, FIXED)).toEqual({ cs: 3, rs: 1 });
	});

	it("never collapses a tile below one cell", () => {
		expect(tileSpans({ sizeW: 4, sizeH: 4 }, FIXED)).toEqual({ cs: 1, rs: 1 });
	});

	it("ignores the scaled style's spans", () => {
		expect(tileSpans({ spanW: 5, spanH: 5 }, FIXED)).toEqual({ cs: 2, rs: 2 });
	});
});


describe("tileSpans — the scaled style", () => {
	it("defaults to one cell, which is one button", () => {
		expect(tileSpans({}, SCALED)).toEqual({ cs: 1, rs: 1 });
	});

	it("uses the stored spans", () => {
		expect(tileSpans({ spanW: 2, spanH: 3 }, SCALED)).toEqual({ cs: 2, rs: 3 });
	});

	it("keeps a tile inside the card's columns", () => {
		expect(tileSpans({ spanW: 20 }, SCALED).cs).toBe(6);
		expect(tileSpans({ spanW: 20 }, { ...SCALED, cols: 12 }).cs).toBe(12);
	});

	it("never collapses a tile below one cell", () => {
		expect(tileSpans({ spanW: 0, spanH: -3 }, SCALED)).toEqual({ cs: 1, rs: 1 });
	});

	it("reads a tile that has only ever been sized in pixels as whole buttons, so a switched card keeps its proportions", () => {
		// One fixed default (88 × 68) is one scaled button; twice that is two.
		expect(tileSpans({ sizeW: 88, sizeH: 68 }, SCALED)).toEqual({ cs: 1, rs: 1 });
		expect(tileSpans({ sizeW: 176, sizeH: 136 }, SCALED)).toEqual({ cs: 2, rs: 2 });
		expect(tileSpans({ size: 264 }, SCALED)).toEqual({ cs: 3, rs: 4 });
	});

	it("prefers a scaled span over the pixels it was derived from", () => {
		expect(tileSpans({ sizeW: 264, spanW: 1 }, SCALED).cs).toBe(1);
	});
});


describe("tileMetrics", () => {
	it("auto-fills the fixed grid's columns and stretches them, as the CSS does", () => {
		// repeat(auto-fill, minmax(44px, 1fr)) with a 6px gap: 500px fits 10.
		const m = tileMetrics(500, FIXED);
		expect(m.columns).toBe(10);
		expect(m.colW).toBeCloseTo((500 - 9 * TILE_GAP) / 10, 5);
		expect(m.rowH).toBe(fixedRowHeight());
		expect(m.rowH).toBe(34);
	});

	it("takes a scaled cell as measured: neither axis can be worked out from the card alone", () => {
		// A column is a share of the card's width until the floor catches it, and
		// a row depends on how many rows the buttons came to as well — so only the
		// laid-out grid knows either, and the caller passes both in.
		const m = tileMetrics(500, SCALED, { colW: 48, rowH: 120 });
		expect(m.columns).toBe(6);
		expect(m.colW).toBe(48);
		expect(m.rowH).toBe(120);
	});

	it("falls back to the share it would be without a floor, per axis, while a scaled grid can't be measured", () => {
		const share = (500 - 5 * TILE_GAP) / 6;
		for (const measured of [undefined, {}, { colW: 0 }, { colW: -20, rowH: -1 }]) {
			const m = tileMetrics(500, SCALED, measured);
			expect(m.colW).toBeCloseTo(share, 5);
			expect(m.rowH).toBeCloseTo(share * 0.78, 5);
		}
		// A measured column with no measured row still shapes the row.
		expect(tileMetrics(500, SCALED, { colW: 48 }).rowH).toBeCloseTo(48 * 0.78, 5);
	});

	it("ignores a measured cell in the fixed style, whose grid is what it always was", () => {
		const m = tileMetrics(500, FIXED, { colW: 48, rowH: 120 });
		expect(m.rowH).toBe(34);
		expect(m.colW).toBeCloseTo((500 - 9 * TILE_GAP) / 10, 5);
	});

	it("makes a scaled cell grow with the card — the whole point of it", () => {
		const narrow = tileMetrics(400, SCALED);
		const wide = tileMetrics(800, SCALED);
		expect(wide.colW).toBeGreaterThan(narrow.colW * 1.9);
		// The fixed grid answers a wider card with more columns, not bigger ones.
		expect(tileMetrics(800, FIXED).colW).toBeCloseTo(tileMetrics(400, FIXED).colW, 0);
		expect(tileMetrics(800, FIXED).columns).toBeGreaterThan(tileMetrics(400, FIXED).columns);
	});

	it("survives a card too narrow to measure", () => {
		expect(tileMetrics(0, SCALED).colW).toBe(1);
		expect(tileMetrics(0, FIXED).columns).toBe(1);
	});
});


describe("spans and pixels", () => {
	it("round-trips a span through its pixel footprint", () => {
		for (const span of [1, 2, 3, 6]) {
			expect(spanFromPixels(pixelsFromSpan(span, 70), 70, 12)).toBe(span);
		}
	});

	it("counts the gaps between the cells a tile covers", () => {
		expect(pixelsFromSpan(1, 70)).toBe(70);
		expect(pixelsFromSpan(3, 70)).toBe(3 * 70 + 2 * TILE_GAP);
	});

	it("snaps to the nearest whole cell and stays on the grid", () => {
		expect(spanFromPixels(80, 70, 6)).toBe(1);
		expect(spanFromPixels(120, 70, 6)).toBe(2);
		expect(spanFromPixels(-40, 70, 6)).toBe(1);
		expect(spanFromPixels(4000, 70, 6)).toBe(6);
	});
});


describe("tilePlacement", () => {
	const spans = { cs: 2, rs: 1 };

	it("passes a fixed tile's pin straight through", () => {
		expect(tilePlacement({ col: 7, row: 3 }, spans, FIXED)).toEqual({ col: 7, row: 3 });
	});

	it("treats an unpinned tile as auto-flowing", () => {
		expect(tilePlacement({}, spans, FIXED)).toEqual({ col: undefined, row: undefined });
		expect(tilePlacement({ col: 0, row: 0 }, spans, SCALED)).toEqual({
			col: undefined,
			row: undefined,
		});
	});

	it("uses the scaled pin when the tile has one", () => {
		expect(tilePlacement({ col: 9, row: 9, scaleCol: 2, scaleRow: 3 }, spans, SCALED)).toEqual({
			col: 2,
			row: 3,
		});
	});

	it("ignores a fixed-style pin, whose columns mean somewhere else entirely", () => {
		expect(tilePlacement({ col: 5, row: 3 }, spans, SCALED)).toEqual({
			col: undefined,
			row: undefined,
		});
	});

	it("never lets a tile end outside the card's columns", () => {
		expect(tilePlacement({ scaleCol: 6 }, spans, SCALED).col).toBe(5);
		expect(tilePlacement({ scaleCol: 99 }, { cs: 6, rs: 1 }, SCALED).col).toBe(1);
	});

	it("leaves rows alone — the grid grows downwards", () => {
		expect(tilePlacement({ scaleRow: 40 }, spans, SCALED).row).toBe(40);
	});
});


describe("pinning", () => {
	it("writes into the style's own fields and leaves the other style's alone", () => {
		const tile: TileGeometry = { col: 5, row: 5 };
		pinTile(tile, SCALED, 2, 3);
		expect(tile).toEqual({ col: 5, row: 5, scaleCol: 2, scaleRow: 3 });
		pinTile(tile, FIXED, 8, 9);
		expect(tile).toEqual({ col: 8, row: 9, scaleCol: 2, scaleRow: 3 });
	});

	it("clears only the style's own pin", () => {
		const tile: TileGeometry = { col: 5, row: 5, scaleCol: 2, scaleRow: 3 };
		expect(isTilePinned(tile, SCALED)).toBe(true);
		unpinTile(tile, SCALED);
		expect(tile).toEqual({ col: 5, row: 5 });
		expect(isTilePinned(tile, SCALED)).toBe(false);
		expect(isTilePinned(tile, FIXED)).toBe(true);
		unpinTile(tile, FIXED);
		expect(tile).toEqual({});
	});
});


describe("resizeTile", () => {
	it("snaps a fixed tile to the fine pixel grid and drops the legacy size", () => {
		const tile: TileGeometry = { size: 120 };
		const spans = resizeTile(tile, FIXED, 131, 69, tileMetrics(500, FIXED));
		expect(tile.sizeW).toBe(132);
		expect(tile.sizeH).toBe(68);
		expect(tile.size).toBeUndefined();
		expect(spans).toEqual({ cs: 3, rs: 2 });
	});

	it("stores nothing for a fixed tile dragged back to the card's own size", () => {
		const tile: TileGeometry = { sizeW: 200 };
		resizeTile(tile, { ...FIXED, baseTile: 120 }, 120, 94, tileMetrics(500, FIXED));
		expect(tile.sizeW).toBeUndefined();
		// The height's own default (94px for a 120px card) isn't a multiple of the
		// 4px snap, so it keeps a value rather than clearing — as it always did.
		expect(tile.sizeH).toBe(96);
	});

	it("keeps a fixed tile within the sizes the handle always allowed", () => {
		const tile: TileGeometry = {};
		resizeTile(tile, FIXED, 4, 4, tileMetrics(500, FIXED));
		expect(tile.sizeW).toBe(44);
		expect(tile.sizeH).toBe(34);
		resizeTile(tile, FIXED, 9000, 9000, tileMetrics(500, FIXED));
		expect(tile.sizeW).toBe(480);
		expect(tile.sizeH).toBe(480);
	});

	it("sizes a scaled tile in whole cells, and leaves its pixel size untouched", () => {
		const metrics = tileMetrics(500, SCALED);
		const tile: TileGeometry = { sizeW: 176, sizeH: 136 };
		const spans = resizeTile(tile, SCALED, pixelsFromSpan(3, metrics.colW) - 4, metrics.rowH, metrics);
		expect(spans).toEqual({ cs: 3, rs: 1 });
		expect(tile.spanW).toBe(3);
		expect(tile.spanH).toBe(1);
		// The fixed style's pixels are still there for when it is switched back.
		expect(tile.sizeW).toBe(176);
		expect(tile.sizeH).toBe(136);
	});

	it("never drags a scaled tile wider than its card", () => {
		const tile: TileGeometry = {};
		expect(resizeTile(tile, SCALED, 9000, 200, tileMetrics(500, SCALED)).cs).toBe(6);
		expect(tile.spanW).toBe(6);
	});

	it("never drags a pinned scaled tile past the card's right edge", () => {
		const tile: TileGeometry = { scaleCol: 4, scaleRow: 1 };
		expect(resizeTile(tile, SCALED, 9000, 200, tileMetrics(500, SCALED)).cs).toBe(3);
		expect(maxSpanW({ scaleCol: 4 }, SCALED)).toBe(3);
		expect(maxSpanW({}, SCALED)).toBe(6);
	});
});


describe("tileStartSize", () => {
	it("starts a fixed gesture from the tile's stored pixels, or the card's default", () => {
		const metrics = tileMetrics(500, FIXED);
		expect(tileStartSize({}, FIXED, metrics)).toEqual({ width: 90, height: 70 });
		expect(tileStartSize({ size: 120 }, FIXED, metrics)).toEqual({ width: 120, height: 120 });
		expect(tileStartSize({ sizeW: 132, sizeH: 68 }, FIXED, metrics)).toEqual({
			width: 132,
			height: 68,
		});
	});

	it("starts a scaled gesture from where the tile is actually drawn", () => {
		const metrics = tileMetrics(500, SCALED);
		expect(tileStartSize({ spanW: 2, spanH: 2 }, SCALED, metrics)).toEqual({
			width: pixelsFromSpan(2, metrics.colW),
			height: pixelsFromSpan(2, metrics.rowH),
		});
	});
});
