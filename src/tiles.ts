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
 * - **scale** — the buttons fill the card. Its columns are the card's own
 *   ({@link TileSpec.cols}) and its rows divide the card's height between them,
 *   so a button is a fraction of the card in both directions: it grows with the
 *   card exactly as a card grows with the dashboard, and every button stays
 *   visible whatever size the card is — down to the floor the card sets
 *   ({@link TileSpec.min}), below which a button would be too small to read or
 *   hit, and past which the card scrolls like the fixed style always did.
 *   Buttons are still tied to the grid — sized in cells, never freely in pixels
 *   — so a launchpad stays a launchpad rather than becoming a second free-form
 *   board, but the grid is drawn at *half*-cell resolution
 *   ({@link TILE_SUBDIV}), so a button can be half a cell wide, half a cell
 *   tall, or both, exactly as the fixed style's fine grid always allowed.
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

/** A cell's height as a fraction of its width: what makes the fixed grid's 44px
 * column a 34px row. A scaled grid's rows are shares of the card's height
 * instead, and fall back to this shape only while they can't be measured. */
export const TILE_ROW_RATIO = 0.78;

/** Default span of a *fixed* tile with no explicit size: 2 columns × 2 rows on
 * the fine grid (≈88×68px), matching the visual size of the old 90px default. */
export const FIXED_TILE_CS = 2;

export const FIXED_TILE_RS = 2;

/** Default pixel size of a fixed-style tile, when the card sets none. */
export const FIXED_TILE_BASE = 90;

/** How many grid tracks one cell of the scaled grid is drawn as — two, so a
 * button can be sized and placed in *halves* of a cell as well as whole ones.
 * That is what the fixed style's fine grid always allowed: its cell is half a
 * default button, so a half-width or half-height button was a size you could
 * simply drag to, and the first cut of the scaled style — whole cells only —
 * took it away.
 *
 * Only the grid is halved. Everything stored stays in *cells*
 * ({@link TileGeometry.spanW} and friends), now in steps of `1 / TILE_SUBDIV`,
 * so a card saved before this reads back exactly as it did. And a whole-cell
 * button is still the size it was: a cell is `TILE_SUBDIV` tracks plus the gap
 * between them, so the halved tracks and their gaps add up to the same card.
 *
 * One track is also, conveniently, one cell of the fixed style's fine grid
 * (44px across, 34px down) — which is what lets a button crossing from one
 * style to the other keep its size to the half-cell. */
export const TILE_SUBDIV = 2;

/** How many cells across a scaled card's grid is, when the card says nothing.
 * Six puts a default button at a sixth of the card — close to what the fixed
 * default looks like on a half-width card, and a comfortable launchpad. */
export const TILE_COLS_DEFAULT = 6;

export const TILE_COLS_MIN = 2;

export const TILE_COLS_MAX = 16;

/** How small a scaled cell may get, in px, before the card scrolls instead of
 * shrinking its buttons further — the default for a card that doesn't say.
 * About the smallest an icon button can be and still be aimed at: low on
 * purpose, since the floor exists to stop a card drawing slivers rather than to
 * decide how big a button ought to be. */
export const TILE_MIN_DEFAULT = 28;

/** The smallest floor a card may ask for. Below this a button is a dot, and the
 * grid's own gap is a third of it. */
export const TILE_MIN_MIN = 16;

/** The largest floor a card may ask for. Past this a launchpad is mostly
 * scrollbar on any card small enough to matter. */
export const TILE_MIN_MAX = 96;

/** Step the floor moves in, so the slider lands on round numbers. */
export const TILE_MIN_STEP = 4;

/** The largest span a button may carry, in cells, so a stored value can never
 * blow the grid open. Columns are additionally capped by the card's own column
 * count. */
const TILE_SPAN_MAX = 24;

/** The same cap in tracks, which is what a scaled span is counted in. */
const TILE_TRACK_SPAN_MAX = TILE_SPAN_MAX * TILE_SUBDIV;


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
	/** Scaled style: how small a cell may get, in px, before the card scrolls
	 * rather than shrinking its buttons any further. */
	min: number;
}

/** A tile's size as the CSS `span` values — counted in tracks of the grid it
 * is drawn on, which is a fine cell in the fixed style and half a cell in the
 * scaled one (see {@link TILE_SUBDIV}). */
export interface TileSpans {
	cs: number;
	rs: number;
}

/** The measured grid: how many track columns it has and how big one track is
 * (again a fine cell fixed, half a cell scaled). */
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
		min: tileMinSize(card.tileMinSize),
	};
}


/** A scaled card's column count, clamped to what the grid can draw. */
export function tileCols(cols: number | undefined): number {
	if (typeof cols !== "number" || !Number.isFinite(cols)) return TILE_COLS_DEFAULT;
	return Math.min(TILE_COLS_MAX, Math.max(TILE_COLS_MIN, Math.round(cols)));
}


/** A scaled card's floor: how small a cell may get before the card scrolls
 * instead. Clamped to the range the slider offers, so a hand-edited layout can't
 * ask for a launchpad of dots or one that is all scrollbar. */
export function tileMinSize(min: number | undefined): number {
	if (typeof min !== "number" || !Number.isFinite(min)) return TILE_MIN_DEFAULT;
	return Math.min(TILE_MIN_MAX, Math.max(TILE_MIN_MIN, Math.round(min)));
}


/**
 * A tile's size, in tracks of whichever grid its card is on.
 *
 * Fixed: pixels divided by the fine cell, the original arithmetic, with the
 * legacy single `size` standing in for a missing width/height.
 *
 * Scaled: the stored spans, which are in cells and may be halves, converted to
 * the tracks the grid is actually drawn at — or, for a tile that has never been
 * sized in the scaled style, its pixel size read as tracks, so a card switched
 * over keeps its proportions instead of flattening to a row of identical
 * buttons. One track being one fine cell, that reading is the fixed style's own
 * arithmetic: a 132px-wide button crosses over as a button one and a half cells
 * wide rather than being rounded to one or two.
 */
export function tileSpans(item: TileGeometry, spec: TileSpec): TileSpans {
	if (spec.sizing === "scale") {
		const w =
			item.spanW == null
				? pixelTracks(item.sizeW ?? item.size, TILE_CELL, FIXED_TILE_CS)
				: cellTracks(item.spanW);
		const h =
			item.spanH == null
				? pixelTracks(item.sizeH ?? item.size, fixedRowHeight(), FIXED_TILE_RS)
				: cellTracks(item.spanH);
		return {
			cs: Math.min(gridTracks(spec), clampSpan(w)),
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


/** How many tracks a scaled grid is drawn at: the card's columns, each split
 * into {@link TILE_SUBDIV} of them. */
export function gridTracks(spec: TileSpec): number {
	return spec.cols * TILE_SUBDIV;
}


/** A stored span, in cells and possibly a half, as tracks. */
function cellTracks(cells: number): number {
	return Math.round(cells * TILE_SUBDIV);
}


/** The inverse: a track count as the cells it is stored as, halves and all. */
function trackCells(tracks: number): number {
	return tracks / TILE_SUBDIV;
}


/** A pixel size read as tracks of `unit`, for a tile crossing from the fixed
 * style to the scaled one, falling back to `absent` tracks when it has no size
 * of its own. Nothing stored, nothing lost: the pixels stay where they were, so
 * turning the fixed style back on restores them. */
function pixelTracks(px: number | undefined, unit: number, absent: number): number {
	if (!px || px <= 0) return absent;
	return Math.max(1, Math.round(px / unit));
}


function clampSpan(span: number): number {
	if (!Number.isFinite(span)) return 1;
	return Math.min(TILE_TRACK_SPAN_MAX, Math.max(1, Math.round(span)));
}


/** Row height of the fixed style's fine grid, in px. */
export function fixedRowHeight(): number {
	return Math.round(TILE_CELL * TILE_ROW_RATIO);
}


/** A grid's cell size as the browser actually resolved it, for the scaled style
 * — whose cells share out the card but never shrink below its floor, so neither
 * axis can be worked out from the card's size alone. Both fields are optional: a
 * grid that isn't laid out yet has neither. */
export interface MeasuredCell {
	colW?: number;
	rowH?: number;
}


/**
 * The grid's live metrics, so a pointer gesture can be mapped onto cells.
 *
 * Fixed: the CSS is `repeat(auto-fill, minmax(44px, 1fr))` over rows of a fixed
 * height, so the column count follows the width, the columns then stretch past
 * their 44px minimum, and the rows are always 34px. Nothing to measure, and it
 * stays on the arithmetic it has always used.
 *
 * Scaled: the track count is the card's columns halved out, and a track would
 * be a fraction of the card — except that neither axis shrinks past the card's
 * own floor ({@link TileSpec.min}), and the rows also depend on how many of them
 * the buttons came to. Only the laid-out grid knows, so the caller measures it
 * and passes it in;
 * `measured` is ignored by the fixed style, and whatever a scaled grid can't
 * supply falls back to the fraction it would be without a floor.
 */
export function tileMetrics(width: number, spec: TileSpec, measured?: MeasuredCell): TileMetrics {
	if (spec.sizing === "scale") {
		const columns = gridTracks(spec);
		const share = Math.max(1, (width - (columns - 1) * TILE_GAP) / columns);
		const colW = positive(measured?.colW) ?? share;
		// A row keeps a whole cell's shape, so the fallback is worked out on the
		// cell and halved back down rather than applied to the track.
		const rowH = positive(measured?.rowH) ?? trackOfCell(cellOfTrack(colW) * TILE_ROW_RATIO);
		return { columns, colW, rowH };
	}
	const columns = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_CELL + TILE_GAP)));
	const colW = Math.max(1, (width - (columns - 1) * TILE_GAP) / columns);
	return { columns, colW, rowH: fixedRowHeight() };
}


/** The pixel size of a `span`-track tile on a grid of `cell`-sized tracks — the
 * tracks plus the gaps between them. */
export function pixelsFromSpan(span: number, cell: number): number {
	return span * cell + (span - 1) * TILE_GAP;
}


/** A whole cell built out of `track`-sized tracks: the tracks plus the gap
 * between them, which is why halving the grid leaves a whole-cell button
 * exactly the size it was. */
function cellOfTrack(track: number): number {
	return pixelsFromSpan(TILE_SUBDIV, track);
}


/** The inverse: one track of a `cell`-sized cell. */
function trackOfCell(cell: number): number {
	return Math.max(1, (cell - (TILE_SUBDIV - 1) * TILE_GAP) / TILE_SUBDIV);
}


/** The span a tile of `px` pixels covers, rounded to the nearest whole track.
 * The inverse of {@link pixelsFromSpan}, and what a resize gesture snaps to in
 * the scaled style — half a cell at a time. */
export function spanFromPixels(px: number, cell: number, max: number): number {
	const span = Math.round((px + TILE_GAP) / (cell + TILE_GAP));
	return Math.min(max, Math.max(1, span));
}


/**
 * A tile's free-form position, as a track line of the grid it is about to be
 * drawn on.
 *
 * Each style keeps its own pin, because their tracks are different sizes: one
 * fixed track is half a default button and one scaled track half a cell of a
 * card-sized grid, so the same column number means two different places.
 * Neither reads the other's, which is what makes a card safe to switch: tiles
 * arranged by hand under the fixed style flow back into the grid under the
 * scaled one, and switching back puts every one of them exactly where it was.
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
	const row = positive(item.scaleRow);
	const last = Math.max(1, gridTracks(spec) - spans.cs + 1);
	return {
		col: col == null ? undefined : Math.min(last, trackLine(col)),
		row: row == null ? undefined : trackLine(row),
	};
}


/** A stored cell line — 1-based, and possibly a half — as the track line it
 * starts at. Cell 2 of a halved grid begins at track 3, and the half step
 * between them at track 2. */
function trackLine(cell: number): number {
	return Math.max(1, Math.round((cell - 1) * TILE_SUBDIV) + 1);
}


/** The inverse: the cell line a track line stands at, in halves. */
function cellLine(track: number): number {
	return trackCells(Math.max(1, Math.round(track)) - 1) + 1;
}


function positive(value: number | undefined): number | undefined {
	return value != null && value > 0 ? value : undefined;
}


/** Pin a tile to a grid track line, into whichever pair of fields the card's
 * style owns, so the other style's placement survives untouched. The scaled
 * style stores cells rather than tracks, so a tile dropped on a half step is
 * kept as one (2.5 rather than track 4). */
export function pinTile(item: TileGeometry, spec: TileSpec, col: number, row: number): void {
	if (spec.sizing === "scale") {
		item.scaleCol = cellLine(col);
		item.scaleRow = cellLine(row);
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
 * owns: pixels snapped to the fine grid for the fixed style, and cells — in
 * halves, since that is what the grid is drawn at — for the scaled one.
 * `cell`/`rowH` are the measured grid metrics (unused by the fixed style, which
 * sizes in absolute pixels). */
export function resizeTile(
	item: TileGeometry,
	spec: TileSpec,
	widthPx: number,
	heightPx: number,
	metrics: TileMetrics,
): TileSpans {
	if (spec.sizing === "scale") {
		const cs = spanFromPixels(widthPx, metrics.colW, maxSpanW(item, spec));
		const rs = spanFromPixels(heightPx, metrics.rowH, TILE_TRACK_SPAN_MAX);
		item.spanW = trackCells(cs);
		item.spanH = trackCells(rs);
		return { cs, rs };
	}
	const w = Math.max(TILE_CELL, Math.min(480, snap(widthPx, TILE_SNAP)));
	const h = Math.max(34, Math.min(480, snap(heightPx, TILE_SNAP)));
	item.sizeW = w === spec.baseTile ? undefined : w;
	item.sizeH = h === Math.round(spec.baseTile * TILE_ROW_RATIO) ? undefined : h;
	item.size = undefined;
	return tileSpans({ sizeW: w, sizeH: h }, spec);
}


/** The widest a tile may be dragged, in tracks: the card's own, less the ones
 * to the left of a tile pinned to a spot. Without this a pinned tile could be
 * resized past the card's right edge, where the grid would grow an implicit
 * column and the whole row would go out of step with the card. */
export function maxSpanW(item: TileGeometry, spec: TileSpec): number {
	if (spec.sizing !== "scale") return TILE_TRACK_SPAN_MAX;
	const tracks = gridTracks(spec);
	const col = positive(item.scaleCol);
	return col == null ? tracks : Math.max(1, tracks - trackLine(col) + 1);
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
