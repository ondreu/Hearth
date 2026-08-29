/**
 * The geometry behind the launchpad-like cards' buttons — Links, Commands and
 * Templater. Pure arithmetic: no DOM, no Obsidian API, so every rule here is
 * unit-testable. `src/cardbodies.ts` holds the DOM side (the grid element, the
 * resize handle and the drag engine) and reads its numbers from here.
 *
 * Two styles of sizing live side by side (see {@link TileSizing}):
 *
 * - **fixed** — the original. A button is a fixed number of pixels, laid out on
 *   a fine 44px grid that auto-fills the card. Widening the card fits *more*
 *   buttons; it never makes them bigger.
 * - **scale** — the card is divided into a fixed number of columns
 *   ({@link TileSpec.cols}), so a button is a fraction of the card and grows
 *   with it, exactly as a card grows with the dashboard. Buttons are still tied
 *   to the grid — sized in whole cells, never freely in pixels — so a launchpad
 *   stays a launchpad rather than becoming a second free-form board.
 *
 * Both readings share one stored tile: pixel sizes and cell spans are separate
 * fields, so switching a card between the two styles never destroys the other
 * style's sizes.
 */

import { type DashboardCard, type TileGeometry } from "./types";


/** Gap between tiles, in px. Mirrors the `gap` on `.hearth-links` in
 * `styles.css` — both readings need it to map pixels onto cells. */
export const TILE_GAP = 6;

/** Fine grid (px) that a *fixed* tile's size snaps to, so tiles align like
 * Android widgets. */
export const TILE_SNAP = 4;

/** Base cell size (px) of the fixed style's grid. Smaller = finer granularity:
 * a tile can span more columns/rows in smaller steps, so sizing feels precise
 * rather than chunky. Half of the visual default so 2 cells ≈ one old tile. */
export const TILE_CELL = 44;

/** A cell's height as a fraction of its width. Shared by both styles: it is
 * what makes the fixed grid's 44px column a 34px row, and what gives a scaled
 * cell its shape as the card resizes. */
export const TILE_ROW_RATIO = 0.78;

/** Default span of a *fixed* tile with no explicit size: 2 columns × 2 rows on
 * the fine grid (≈88×68px), matching the visual size of the old 90px default. */
export const FIXED_TILE_CS = 2;

export const FIXED_TILE_RS = 2;

/** Default pixel size of a fixed-style tile, when the card sets none. */
export const FIXED_TILE_BASE = 90;

/** One scaled cell is one whole button, so the pixel size a fixed tile has to
 * carry to read as a 1×1 scaled button is the fixed default's footprint. Used
 * to derive spans for a card flipped to the scaled style before its tiles have
 * ever been resized there — sizes carry over, while positions start afresh
 * (see {@link tilePlacement}). */
const SCALE_UNIT_W = TILE_CELL * FIXED_TILE_CS;

const SCALE_UNIT_H = Math.round(TILE_CELL * TILE_ROW_RATIO) * FIXED_TILE_RS;

/** How many cells across a scaled card's grid is, when the card says nothing.
 * Six puts a default button at a sixth of the card — close to what the fixed
 * default looks like on a half-width card, and a comfortable launchpad. */
export const TILE_COLS_DEFAULT = 6;

export const TILE_COLS_MIN = 2;

export const TILE_COLS_MAX = 16;

/** The largest span a button may carry, so a stored value can never blow the
 * grid open. Columns are additionally capped by the card's own column count. */
const TILE_SPAN_MAX = 24;


/** Which of the two sizing styles a card's buttons use. See the module comment. */
export type TileSizing = "fixed" | "scale";

/** Everything the two readings need from the card. Resolved once per render by
 * {@link tileSpec} so the DOM helpers never re-read the card. */
export interface TileSpec {
	sizing: TileSizing;
	/** Fixed style: the card's base tile size, in px. */
	baseTile: number;
	/** Scaled style: how many cells wide the card's grid is. */
	cols: number;
}

/** A tile's size in grid cells, as the CSS `span` values. */
export interface TileSpans {
	cs: number;
	rs: number;
}

/** The measured grid: how many columns it has and how big one cell is. */
export interface TileMetrics {
	columns: number;
	colW: number;
	rowH: number;
}


/** A card's sizing style. Absent means fixed: cards predating the scaled style
 * must keep looking exactly as they did. */
export function tileSizing(card: DashboardCard): TileSizing {
	return card.tileSizing === "scale" ? "scale" : "fixed";
}


/** Resolve everything a render needs to size and place a card's buttons. */
export function tileSpec(card: DashboardCard): TileSpec {
	return {
		sizing: tileSizing(card),
		baseTile: card.tileSize && card.tileSize > 0 ? card.tileSize : FIXED_TILE_BASE,
		cols: tileCols(card.tileCols),
	};
}


/** A scaled card's column count, clamped to what the grid can draw. */
export function tileCols(cols: number | undefined): number {
	if (typeof cols !== "number" || !Number.isFinite(cols)) return TILE_COLS_DEFAULT;
	return Math.min(TILE_COLS_MAX, Math.max(TILE_COLS_MIN, Math.round(cols)));
}


/**
 * A tile's size, in cells of whichever grid its card is on.
 *
 * Fixed: pixels divided by the fine cell, the original arithmetic, with the
 * legacy single `size` standing in for a missing width/height.
 *
 * Scaled: the stored spans — or, for a tile that has never been sized in the
 * scaled style, its pixel size read as spans, so a card switched over keeps its
 * proportions instead of flattening to a row of identical buttons.
 */
export function tileSpans(item: TileGeometry, spec: TileSpec): TileSpans {
	if (spec.sizing === "scale") {
		const w = item.spanW ?? unitSpan(item.sizeW ?? item.size, SCALE_UNIT_W);
		const h = item.spanH ?? unitSpan(item.sizeH ?? item.size, SCALE_UNIT_H);
		return {
			cs: Math.min(spec.cols, clampSpan(w)),
			rs: clampSpan(h),
		};
	}
	const w = item.sizeW ?? item.size;
	const h = item.sizeH ?? item.size;
	return {
		cs: w && w > 0 ? Math.max(1, Math.round(w / TILE_CELL)) : FIXED_TILE_CS,
		rs: h && h > 0 ? Math.max(1, Math.round(h / fixedRowHeight())) : FIXED_TILE_RS,
	};
}


/** A pixel size read as whole cells of `unit`, for a tile crossing from the
 * fixed style to the scaled one. Nothing stored, nothing lost: the pixels stay
 * where they were, so turning the fixed style back on restores them. */
function unitSpan(px: number | undefined, unit: number): number {
	if (!px || px <= 0) return 1;
	return Math.max(1, Math.round(px / unit));
}


function clampSpan(span: number): number {
	if (!Number.isFinite(span)) return 1;
	return Math.min(TILE_SPAN_MAX, Math.max(1, Math.round(span)));
}


/** Row height of the fixed style's fine grid, in px. */
export function fixedRowHeight(): number {
	return Math.round(TILE_CELL * TILE_ROW_RATIO);
}


/**
 * The grid's live metrics at a given content width, so a pointer gesture can be
 * mapped onto cells.
 *
 * Fixed: the CSS is `repeat(auto-fill, minmax(44px, 1fr))`, so the column count
 * follows the width and the columns then stretch past their 44px minimum.
 *
 * Scaled: the column count is the card's own, so the cell — and with it every
 * button — is a fraction of the card. Rows keep the cell's shape rather than a
 * fixed height, which is what makes a button grow in both directions at once.
 */
export function tileMetrics(width: number, spec: TileSpec): TileMetrics {
	if (spec.sizing === "scale") {
		const columns = spec.cols;
		const colW = Math.max(1, (width - (columns - 1) * TILE_GAP) / columns);
		return { columns, colW, rowH: colW * TILE_ROW_RATIO };
	}
	const columns = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_CELL + TILE_GAP)));
	const colW = Math.max(1, (width - (columns - 1) * TILE_GAP) / columns);
	return { columns, colW, rowH: fixedRowHeight() };
}


/** The pixel size of a `span`-cell tile on a grid of `cell`-sized cells — the
 * cells plus the gaps between them. */
export function pixelsFromSpan(span: number, cell: number): number {
	return span * cell + (span - 1) * TILE_GAP;
}


/** The span a tile of `px` pixels covers, rounded to the nearest whole cell.
 * The inverse of {@link pixelsFromSpan}, and what a resize gesture snaps to in
 * the scaled style. */
export function spanFromPixels(px: number, cell: number, max: number): number {
	const span = Math.round((px + TILE_GAP) / (cell + TILE_GAP));
	return Math.min(max, Math.max(1, span));
}


/**
 * A tile's free-form position, in cells of the grid it is about to be drawn on.
 *
 * Each style keeps its own pin, because their cells are different sizes: one
 * scaled cell is a whole button, one fixed cell half of one, so the same column
 * number means two different places. Neither reads the other's, which is what
 * makes a card safe to switch: tiles arranged by hand under the fixed style
 * flow back into the grid under the scaled one, and switching back puts every
 * one of them exactly where it was.
 *
 * A column is clamped so the tile always ends inside the grid; a row is free,
 * since the grid grows downwards for as many rows as the tiles need.
 */
export function tilePlacement(
	item: TileGeometry,
	spans: TileSpans,
	spec: TileSpec,
): { col?: number; row?: number } {
	if (spec.sizing !== "scale") {
		return { col: positive(item.col), row: positive(item.row) };
	}
	const col = positive(item.scaleCol);
	return {
		col: col == null ? undefined : Math.min(Math.max(1, spec.cols - spans.cs + 1), col),
		row: positive(item.scaleRow),
	};
}


function positive(value: number | undefined): number | undefined {
	return value != null && value > 0 ? value : undefined;
}


/** Pin a tile to a grid cell, into whichever pair of fields the card's style
 * owns, so the other style's placement survives untouched. */
export function pinTile(item: TileGeometry, spec: TileSpec, col: number, row: number): void {
	if (spec.sizing === "scale") {
		item.scaleCol = col;
		item.scaleRow = row;
	} else {
		item.col = col;
		item.row = row;
	}
}


/** Whether a tile is pinned under the card's current style — i.e. whether
 * {@link unpinTile} has anything to clear. */
export function isTilePinned(item: TileGeometry, spec: TileSpec): boolean {
	return spec.sizing === "scale"
		? item.scaleCol != null || item.scaleRow != null
		: item.col != null || item.row != null;
}


/** Let a tile auto-flow again under the card's current style. */
export function unpinTile(item: TileGeometry, spec: TileSpec): void {
	if (spec.sizing === "scale") {
		delete item.scaleCol;
		delete item.scaleRow;
	} else {
		delete item.col;
		delete item.row;
	}
}


/** Resize a tile to a pixel footprint, into whichever fields the card's style
 * owns: pixels snapped to the fine grid for the fixed style, whole cells for
 * the scaled one. `cell`/`rowH` are the measured grid metrics (unused by the
 * fixed style, which sizes in absolute pixels). */
export function resizeTile(
	item: TileGeometry,
	spec: TileSpec,
	widthPx: number,
	heightPx: number,
	metrics: TileMetrics,
): TileSpans {
	if (spec.sizing === "scale") {
		const cs = spanFromPixels(widthPx, metrics.colW, maxSpanW(item, spec));
		const rs = spanFromPixels(heightPx, metrics.rowH, TILE_SPAN_MAX);
		item.spanW = cs;
		item.spanH = rs;
		return { cs, rs };
	}
	const w = Math.max(TILE_CELL, Math.min(480, snap(widthPx, TILE_SNAP)));
	const h = Math.max(34, Math.min(480, snap(heightPx, TILE_SNAP)));
	item.sizeW = w === spec.baseTile ? undefined : w;
	item.sizeH = h === Math.round(spec.baseTile * TILE_ROW_RATIO) ? undefined : h;
	item.size = undefined;
	return tileSpans({ sizeW: w, sizeH: h }, spec);
}


/** The widest a tile may be dragged: the card's columns, less the ones to the
 * left of a tile pinned to a spot. Without this a pinned tile could be resized
 * past the card's right edge, where the grid would grow an implicit column and
 * the whole row would go out of step with the card. */
export function maxSpanW(item: TileGeometry, spec: TileSpec): number {
	if (spec.sizing !== "scale") return TILE_SPAN_MAX;
	const col = positive(item.scaleCol);
	return col == null ? spec.cols : Math.max(1, spec.cols - col + 1);
}


/** Snap a value to the nearest multiple of `grid`. */
export function snap(value: number, grid: number): number {
	return Math.round(value / grid) * grid;
}


/** The pixel footprint a resize gesture starts from: whatever the tile is
 * currently drawn at, measured the way the card's style stores it. */
export function tileStartSize(
	item: TileGeometry,
	spec: TileSpec,
	metrics: TileMetrics,
): { width: number; height: number } {
	const spans = tileSpans(item, spec);
	if (spec.sizing === "scale") {
		return {
			width: pixelsFromSpan(spans.cs, metrics.colW),
			height: pixelsFromSpan(spans.rs, metrics.rowH),
		};
	}
	return {
		width: item.sizeW ?? item.size ?? spec.baseTile,
		height: item.sizeH ?? item.size ?? Math.round(spec.baseTile * TILE_ROW_RATIO),
	};
}
