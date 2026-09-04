/**
 * A dashboard reduced to something a listing can draw: where the cards sit,
 * what kind each one is, and what the board is wearing behind them.
 *
 * A gallery has to show you a board before you install it, and there are three
 * ways to do that. A screenshot the author uploads is a picture of a different
 * vault, in a different theme, with their notes in it. A rendered thumbnail
 * means running Hearth headless somewhere. And SVG a server hands back is
 * markup from a stranger — the exact thing `assets.ts` refuses to embed, for
 * the exact same reason, and it would be odd to bar it from a package and then
 * inject it into the modal that lists packages.
 *
 * So the preview is *data*: numbers and a card kind, drawn by the client with
 * its own DOM in the reader's own theme. Nothing here can carry markup, script
 * or a URL, every number is clamped at the point it is read, and a kind this
 * build has never heard of draws as a blank tile rather than as nothing.
 *
 * The same function runs in the plugin and on the gallery server (see
 * `docs/gallery-hosting.md`): the server derives the preview from the uploaded
 * package rather than accepting one, so a listing cannot advertise a layout the
 * package does not contain. Keep this module free of Obsidian imports.
 */

import type { HearthPackage } from "../portable/schema";

/** How many columns a preview is normalised to when the board doesn't say. */
export const PREVIEW_COLUMNS = 12;

/** Ceiling on tiles in one preview. A board with more is drawn truncated: past
 * this the thumbnail is a grey mush anyway, and the cap is what stops a hostile
 * package from making every listing row expensive to draw. */
export const PREVIEW_MAX_TILES = 60;

/** Rows a preview is clipped to. Boards are taller than they are wide and a
 * listing tile is wider than it is tall, so a long board shows its top. */
export const PREVIEW_MAX_ROWS = 24;

/** One card, as a rectangle. */
export interface PreviewTile {
	x: number;
	y: number;
	w: number;
	h: number;
	/** The card's kind, for the icon drawn in the tile. Free text as far as this
	 * module is concerned — the renderer looks it up and falls back. */
	kind: string;
}

/** What sits behind the tiles. */
export interface PreviewBackground {
	/** The background kind the board resolved to (`color`, `image`, `gradient`,
	 * `sky`, `weather`, `none`, …). Passed through as text; the renderer decides
	 * what it can draw. */
	kind: string;
	/**
	 * A CSS colour, and *only* if it parses as one here.
	 *
	 * The value behind a background can be a vault path, a URL or a packed
	 * place, and this field is interpolated into a style, so anything that isn't
	 * plainly a colour is dropped rather than passed along.
	 */
	color?: string;
	/** Whether the board's wallpaper travels inside the package, so a listing
	 * knows it can ask the server for the real picture. */
	hasImage?: boolean;
}

/** A board, as a listing draws it. */
export interface GalleryPreview {
	columns: number;
	rows: number;
	tiles: PreviewTile[];
	background?: PreviewBackground;
	/** The board's card corner radius, in px, when it overrides the default. */
	radius?: number;
	/** Card surface opacity, 0–1, when the board overrides it. */
	opacity?: number;
	/** True when the board hosts a plugin view instead of a grid of cards, which
	 * has no tiles to draw. */
	pluginBoard?: boolean;
	/** How many cards were left out by {@link PREVIEW_MAX_TILES} / rows. */
	truncated?: number;
}

/** One line of the detail view's "what's on this board" list. */
export interface PreviewCardCount {
	kind: string;
	count: number;
}

/** Hex, rgb()/rgba(), hsl()/hsla() or a bare CSS colour keyword. Anything else
 * — a path, a URL, a `var()`, a `url()` — is not a colour and does not travel. */
const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9a-z.,%\s/-]{1,64}\)|[a-z]{3,20})$/i;

function isColor(value: unknown): value is string {
	return typeof value === "string" && value.length <= 72 && COLOR.test(value.trim());
}

/** A finite number in range, or the fallback. Every number the preview carries
 * goes through this, in both directions: deriving one and reading one back. */
function clamp(value: unknown, min: number, max: number, fallback: number): number {
	const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : NaN;
	if (Number.isNaN(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

/** A kind id, or "" for anything that isn't one. Kept to the shape Hearth's own
 * kinds have so a listing can't be made to look up something strange. */
function safeKind(value: unknown): string {
	return typeof value === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(value) ? value : "";
}

/**
 * Build the preview for a dashboard package, or null for a package that isn't
 * one.
 *
 * Reads only the payload's own board — nothing global, nothing from the vault —
 * so it gives the same answer in Hearth, on the server and in a test.
 */
export function previewFromPackage(pkg: HearthPackage): GalleryPreview | null {
	if (pkg.hearth.kind !== "dashboard") return null;
	const payload = pkg.payload as { dashboard?: Record<string, unknown> } | undefined;
	const dash = payload?.dashboard;
	if (!dash || typeof dash !== "object") return null;

	const columns = clamp(dash.gridColumns, 1, 48, PREVIEW_COLUMNS);
	const preview: GalleryPreview = { columns, rows: 1, tiles: [] };

	if (dash.mode === "plugin") preview.pluginBoard = true;

	const radius = clamp(dash.cardRadius, 0, 64, -1);
	if (radius >= 0) preview.radius = radius;
	const opacity =
		typeof dash.cardOpacity === "number" && Number.isFinite(dash.cardOpacity)
			? Math.min(1, Math.max(0, dash.cardOpacity))
			: null;
	if (opacity !== null) preview.opacity = Math.round(opacity * 100) / 100;

	const background = dash.background as Record<string, unknown> | undefined;
	if (background && typeof background === "object" && typeof background.kind === "string") {
		const bg: PreviewBackground = { kind: safeKind(background.kind) || "none" };
		if (isColor(background.value)) bg.color = String(background.value).trim();
		// An embedded wallpaper is an asset reference by the time a package is
		// published; a path or URL is one the reader can't resolve either way.
		if (typeof background.value === "string" && background.value.startsWith("hearth:asset/")) {
			bg.hasImage = true;
		}
		preview.background = bg;
	}

	const cards = Array.isArray(dash.cards) ? (dash.cards as Record<string, unknown>[]) : [];
	let truncated = 0;
	let rows = 0;
	for (const card of cards) {
		if (!card || typeof card !== "object") continue;
		if (preview.tiles.length >= PREVIEW_MAX_TILES) {
			truncated++;
			continue;
		}
		const x = clamp(card.x, 0, columns, 0);
		const y = clamp(card.y, 0, 4096, 0);
		const w = clamp(card.w, 1, columns, 1);
		const h = clamp(card.h, 1, 64, 1);
		if (y >= PREVIEW_MAX_ROWS) {
			truncated++;
			continue;
		}
		preview.tiles.push({ x, y, w: Math.min(w, columns - x) || 1, h, kind: safeKind(card.kind) });
		rows = Math.max(rows, Math.min(PREVIEW_MAX_ROWS, y + h));
	}
	preview.rows = Math.max(1, rows);
	if (truncated) preview.truncated = truncated;
	return preview;
}

/**
 * What is on the board, by kind and how many — the detail view's contents list.
 *
 * Counted rather than listed one by one: "4 × tasks" is what somebody deciding
 * whether to install this wants, and a board's fourteenth link card is not.
 * Sorted by count, then by kind, so the same board always reads the same way.
 */
export function cardCountsFromPackage(pkg: HearthPackage): PreviewCardCount[] {
	if (pkg.hearth.kind !== "dashboard") return [];
	const payload = pkg.payload as { dashboard?: { cards?: unknown } } | undefined;
	const cards = payload?.dashboard?.cards;
	if (!Array.isArray(cards)) return [];
	const counts = new Map<string, number>();
	for (const card of cards as Record<string, unknown>[]) {
		const kind = safeKind(card?.kind);
		if (!kind) continue;
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	return Array.from(counts, ([kind, count]) => ({ kind, count })).sort(
		(a, b) => b.count - a.count || (a.kind < b.kind ? -1 : 1),
	);
}

/**
 * Read a preview that arrived over the wire.
 *
 * Everything a listing draws goes through here first, because a preview is the
 * one part of an entry that is turned into geometry and style rather than into
 * text — so it is re-clamped on arrival exactly as it was on the way out, and a
 * server that has been persuaded to serve nonsense produces a small odd
 * thumbnail rather than a broken modal.
 */
export function readPreview(raw: unknown): GalleryPreview | null {
	if (!raw || typeof raw !== "object") return null;
	const src = raw as Record<string, unknown>;
	const columns = clamp(src.columns, 1, 48, PREVIEW_COLUMNS);
	const preview: GalleryPreview = { columns, rows: 1, tiles: [] };

	const tiles = Array.isArray(src.tiles) ? src.tiles.slice(0, PREVIEW_MAX_TILES) : [];
	let rows = 0;
	for (const tile of tiles as Record<string, unknown>[]) {
		if (!tile || typeof tile !== "object") continue;
		const x = clamp(tile.x, 0, columns, 0);
		const y = clamp(tile.y, 0, PREVIEW_MAX_ROWS, 0);
		const w = clamp(tile.w, 1, columns, 1);
		const h = clamp(tile.h, 1, PREVIEW_MAX_ROWS, 1);
		preview.tiles.push({ x, y, w: Math.min(w, columns - x) || 1, h, kind: safeKind(tile.kind) });
		rows = Math.max(rows, Math.min(PREVIEW_MAX_ROWS, y + h));
	}
	preview.rows = clamp(src.rows, 1, PREVIEW_MAX_ROWS, Math.max(1, rows));

	const bg = src.background as Record<string, unknown> | undefined;
	if (bg && typeof bg === "object") {
		const out: PreviewBackground = { kind: safeKind(bg.kind) || "none" };
		if (isColor(bg.color)) out.color = String(bg.color).trim();
		if (bg.hasImage === true) out.hasImage = true;
		preview.background = out;
	}

	const radius = clamp(src.radius, 0, 64, -1);
	if (radius >= 0) preview.radius = radius;
	if (typeof src.opacity === "number" && Number.isFinite(src.opacity)) {
		preview.opacity = Math.min(1, Math.max(0, src.opacity));
	}
	if (src.pluginBoard === true) preview.pluginBoard = true;
	const truncated = clamp(src.truncated, 0, 100000, 0);
	if (truncated) preview.truncated = truncated;
	return preview;
}
