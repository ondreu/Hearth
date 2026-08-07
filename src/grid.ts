import { Component } from "obsidian";
import type { HomeView } from "./view";
import { DashboardCard } from "./types";

/** Seed metrics used to convert legacy grid layouts (and freshly packed cards)
 * into free-form coordinates. Once converted, the live layout is continuous. */
export const ROW_HEIGHT = 92;
export const GRID_GAP = 16;
export const MIN_W = 2;
export const MIN_H = 1;

/** Minimum card footprint on the free-form board, in pixels. */
export const MIN_W_PX = 120;
export const MIN_H_PX = 56;

/** How close (px) an edge/centre must come to a guide before it snaps. */
const SNAP_THRESHOLD = 8;

/** Assign coordinates to any cards missing them (e.g. settings saved by an
 * older version, or freshly added cards that carry x/y = -1). Simple
 * left-to-right shelf packing by current order — this only seeds the free-form
 * coordinates derived in ensureFreeform. */
export function ensureLayout(cards: DashboardCard[], columns: number): boolean {
	let changed = false;
	// Track the lowest free row per column.
	const colBottom: number[] = new Array<number>(columns).fill(0);

	for (const card of cards) {
		const placed =
			typeof card.x === "number" && card.x >= 0 &&
			typeof card.y === "number" && card.y >= 0;
		if (placed) {
			// Respect existing placement but keep the column map up to date.
			const w = clamp(card.w, MIN_W, columns);
			for (let c = card.x; c < Math.min(card.x + w, columns); c++) {
				colBottom[c] = Math.max(colBottom[c], card.y + card.h);
			}
			continue;
		}
		const w = clamp(card.w || MIN_W, MIN_W, columns);
		const h = Math.max(card.h || MIN_H, MIN_H);
		const { x, y } = findSlot(colBottom, columns, w);
		card.x = x;
		card.y = y;
		card.w = w;
		card.h = h;
		for (let c = x; c < x + w; c++) colBottom[c] = y + h;
		changed = true;
	}
	return changed;
}

function findSlot(colBottom: number[], columns: number, w: number): { x: number; y: number } {
	let best = { x: 0, y: Number.MAX_SAFE_INTEGER };
	for (let x = 0; x + w <= columns; x++) {
		let y = 0;
		for (let c = x; c < x + w; c++) y = Math.max(y, colBottom[c]);
		if (y < best.y) best = { x, y };
	}
	if (best.y === Number.MAX_SAFE_INTEGER) best = { x: 0, y: 0 };
	return best;
}

/** Derive free-form coordinates (fractional horizontal, pixel vertical) from the
 * legacy grid units for any card that hasn't got them yet. Runs once per card;
 * afterwards the drag engine owns fx/fy/fw/fh directly. */
export function ensureFreeform(
	cards: DashboardCard[],
	columns: number,
	rowHeight: number,
	gap: number,
	boardWidth: number,
): boolean {
	let changed = false;
	// Reconstruct the old CSS grid (repeat(columns, 1fr) with `gap`) at a
	// representative board width so migrated cards keep their familiar spacing.
	const colW = Math.max(1, (boardWidth - (columns - 1) * gap) / columns);
	for (const card of cards) {
		if (
			typeof card.fx === "number" &&
			typeof card.fy === "number" &&
			typeof card.fw === "number" &&
			typeof card.fh === "number"
		) {
			continue;
		}
		const w = clamp(card.w || MIN_W, MIN_W, columns);
		const h = Math.max(card.h || MIN_H, MIN_H);
		const x = clamp(card.x < 0 ? 0 : card.x, 0, columns - w);
		const y = Math.max(0, card.y < 0 ? 0 : card.y);
		const leftPx = x * (colW + gap);
		const widthPx = w * colW + (w - 1) * gap;
		card.fx = clamp(leftPx / boardWidth, 0, 1);
		card.fw = clamp(widthPx / boardWidth, 0.02, 1);
		card.fy = y * (rowHeight + gap);
		card.fh = h * rowHeight + (h - 1) * gap;
		changed = true;
	}
	return changed;
}

/** Give a brand-new card free-form coordinates that don't disturb the cards
 * already on the board. Adding a card used to seed it from the legacy grid
 * (ensureLayout/ensureFreeform), which — because a dragged card's legacy x/y go
 * stale — could drop it far below the real content; in fit-to-page mode that
 * grew the board and rescaled (shoved up) every existing card until the layout
 * was re-saved.
 *
 * Instead we drop it into the first empty slot inside the current content
 * bounds, so the board's total height (and therefore the fit scale of every
 * other card) is unchanged. If the content is genuinely full, it's placed
 * bottom-aligned within the existing bounds (overlapping, for the user to drag
 * out) rather than extending the board — again leaving the other cards put. */
export function placeFreeform(
	card: DashboardCard,
	existing: DashboardCard[],
	boardWidth: number,
	columns: number,
	gap: number,
	rowHeight: number,
): void {
	const colW = Math.max(1, (boardWidth - (columns - 1) * gap) / columns);
	const w = clamp(card.w || MIN_W, MIN_W, columns);
	const h = Math.max(card.h || MIN_H, MIN_H);
	const fw = clamp((w * colW + (w - 1) * gap) / boardWidth, 0.02, 1);
	const fh = h * rowHeight + (h - 1) * gap;

	// Existing footprints in the board's mixed units (fx/fw are width fractions,
	// fy/fh are pixels). Cards without free-form coords yet are ignored.
	const rects = existing
		.filter(
			(c) =>
				c !== card &&
				typeof c.fx === "number" &&
				typeof c.fy === "number" &&
				typeof c.fw === "number" &&
				typeof c.fh === "number",
		)
		.map((c) => ({ x: c.fx as number, y: c.fy as number, w: c.fw as number, h: c.fh as number }));
	const contentBottom = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
	const overlaps = (x: number, y: number) =>
		rects.some((r) => x < r.x + r.w && x + fw > r.x && y < r.y + r.h && y + fh > r.y);

	const place = (fx: number, fy: number) => {
		card.fx = clamp(fx, 0, 1 - fw);
		card.fy = Math.max(0, fy);
		card.fw = fw;
		card.fh = fh;
		// Keep the legacy grid units consistent so later seeding stays sane.
		card.w = w;
		card.h = h;
		card.x = clamp(Math.round(card.fx * columns), 0, columns - w);
		card.y = Math.max(0, Math.round(card.fy / (rowHeight + gap)));
	};

	// Scan the current content area for the first free slot (top-to-bottom,
	// left-to-right); a card dropped here never changes the board's height.
	const stepY = rowHeight + gap;
	const stepX = (colW + gap) / boardWidth;
	for (let y = 0; y + fh <= contentBottom + 0.5; y += stepY) {
		for (let x = 0; x + fw <= 1.0001; x += stepX) {
			const fx = Math.min(x, 1 - fw);
			if (!overlaps(fx, y)) {
				place(fx, y);
				return;
			}
		}
	}

	// No gap in the content: bottom-align within the existing bounds so the board
	// doesn't grow (the new card overlaps, ready to be dragged into place).
	place(0, Math.max(0, contentBottom - fh));
}

/** Position a card on the free-form board. Horizontal uses percentages so the
 * board reflows with the pane; vertical uses pixels. */
export function applyCardPosition(el: HTMLElement, card: DashboardCard): void {
	const fx = clamp(card.fx ?? 0, 0, 1);
	const fw = clamp(card.fw ?? 0.25, 0.02, 1);
	el.style.left = `${clamp(fx, 0, 1 - fw) * 100}%`;
	el.style.width = `${fw * 100}%`;
	el.style.top = `${Math.max(0, card.fy ?? 0)}px`;
	el.style.height = `${Math.max(MIN_H_PX, card.fh ?? MIN_H_PX)}px`;
}

/** Position a card in a fit-to-page board, WITHOUT mutating or persisting the
 * card's stored geometry. `vScale` (0..1) proportionally shrinks the vertical
 * layout when the cards are taller than the board (see fitVerticalScale); pass
 * 1 to leave the vertical placement untouched.
 *
 * This is deliberately non-destructive. Fitting used to clamp the stored fy/fh
 * and save them, but the clamp bound came from a *measured* board height. On a
 * PC start, plugin update or full sync the workspace restores panes before they
 * reach their final size, so the board is briefly short; clamping to that
 * transient height (and only ever upward) permanently shoved the bottom cards
 * up and — because the true positions were overwritten — the drift compounded
 * and never recovered. Keeping this render-only means a wrong transient
 * measurement can't corrupt anything: once the pane reaches its real height the
 * next call repositions every card from its untouched stored geometry.
 *
 * Vertical fitting scales rather than clamps so it mirrors the horizontal axis
 * (fx/fw are board-width fractions, so cards already scale proportionally as the
 * pane narrows). Scaling top AND height by the same factor is a linear map, so
 * cards that didn't overlap before still don't afterwards — clamping each card
 * independently, as an earlier version did, piled them at the top and made them
 * overlap when the window was made short. */
export function applyCardPositionFitted(
	el: HTMLElement,
	card: DashboardCard,
	vScale: number,
	boardWidth: number,
): void {
	// Horizontal placement. When the board width is known, snap the LEFT and
	// RIGHT edges to whole pixels (deriving the width from them) so two
	// side-by-side cards share the exact same pixel. Percentage widths round
	// left and width independently, so `round(left) + round(width)` and the
	// neighbour's `round(left)` can land a pixel apart — the thin vertical seam
	// between adjacent cards. Fall back to percentages if the width isn't known.
	const fx = clamp(card.fx ?? 0, 0, 1);
	const fw = clamp(card.fw ?? 0.25, 0.02, 1);
	const leftFrac = clamp(fx, 0, 1 - fw);
	if (boardWidth > 0) {
		const left = Math.round(leftFrac * boardWidth);
		const right = Math.round((leftFrac + fw) * boardWidth);
		el.style.left = `${left}px`;
		el.style.width = `${Math.max(1, right - left)}px`;
	} else {
		el.style.left = `${leftFrac * 100}%`;
		el.style.width = `${fw * 100}%`;
	}

	// Vertical placement. Snap the TOP and BOTTOM edges the same way so stacked
	// cards meet on the exact pixel too. When the layout overflows the board
	// (vScale < 1) the edges are scaled first; otherwise they're used as-is.
	const scale = vScale < 1 ? vScale : 1;
	const fy = Math.max(0, card.fy ?? 0);
	const fh = card.fh ?? MIN_H_PX;
	const top = Math.round(fy * scale);
	const bottom = Math.round((fy + fh) * scale);
	el.style.top = `${top}px`;
	el.style.height = `${Math.max(MIN_H_PX, bottom - top)}px`;
}

/** The proportional vertical scale (0..1] that fits every card's stored layout
 * inside `boardHeight`. Returns 1 when the cards already fit (never enlarges).
 * Returns 1 for a non-positive/zero board height so a not-yet-laid-out pane
 * leaves the layout untouched. */
export function fitVerticalScale(cards: DashboardCard[], boardHeight: number): number {
	if (boardHeight <= 0) return 1;
	const contentHeight = layoutHeight(cards);
	if (contentHeight <= boardHeight) return 1;
	return boardHeight / contentHeight;
}

/** Total pixel height the board needs to show every card. */
export function layoutHeight(cards: DashboardCard[]): number {
	let bottom = 0;
	for (const card of cards) {
		bottom = Math.max(bottom, (card.fy ?? 0) + (card.fh ?? 0));
	}
	return bottom;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

/** Shared layout state passed to the drag engine. */
export interface GridLayout {
	cards: DashboardCard[];
	elements: Map<DashboardCard, HTMLElement>;
}

/** Which edge(s) a resize drag moves. Compass directions; corners combine two. */
type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

interface DragContext {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startLeft: number;
	startTop: number;
	startWidth: number;
	startHeight: number;
	boardWidth: number;
	/** Board height (fit-to-page clips to this); Infinity when scrolling. */
	boardHeight: number;
	mode: "move" | "resize";
	/** For resize: which edges follow the pointer. */
	dir: ResizeDir | null;
	// Candidate snap lines (px, board-relative) collected from siblings + board.
	xTargets: number[];
	yTargets: number[];
}

/** Collect the vertical (x) and horizontal (y) guide positions a dragged card
 * can snap to: the board's own edges/centre plus every other card's edges,
 * centres and a one-gap offset for tidy adjacency. */
function collectTargets(
	layout: GridLayout,
	active: DashboardCard,
	boardWidth: number,
): { xTargets: number[]; yTargets: number[] } {
	const xs = new Set<number>([0, boardWidth / 2, boardWidth]);
	const ys = new Set<number>([0]);
	for (const card of layout.cards) {
		if (card === active) continue;
		const left = (card.fx ?? 0) * boardWidth;
		const width = (card.fw ?? 0) * boardWidth;
		const top = card.fy ?? 0;
		const height = card.fh ?? 0;
		xs.add(left);
		xs.add(left + width / 2);
		xs.add(left + width);
		xs.add(left - GRID_GAP);
		xs.add(left + width + GRID_GAP);
		ys.add(top);
		ys.add(top + height / 2);
		ys.add(top + height);
		ys.add(top - GRID_GAP);
		ys.add(top + height + GRID_GAP);
	}
	return { xTargets: [...xs], yTargets: [...ys] };
}

/** Find the smallest snap adjustment for a set of moving edges against the
 * candidate guide lines. Returns the delta to apply and the guide that won. */
function bestSnap(
	edges: number[],
	targets: number[],
): { delta: number; guide: number } | null {
	let best: { delta: number; guide: number } | null = null;
	for (const edge of edges) {
		for (const target of targets) {
			const diff = target - edge;
			if (Math.abs(diff) <= SNAP_THRESHOLD) {
				if (!best || Math.abs(diff) < Math.abs(best.delta)) {
					best = { delta: diff, guide: target };
				}
			}
		}
	}
	return best;
}

/**
 * Make a card draggable (move) and resizable while the dashboard is in arrange
 * mode. Movement is fully continuous; while dragging, edges and centres snap
 * magnetically to neighbouring cards and the board, with alignment guides shown.
 */
export function enableDragResize(
	view: HomeView,
	cardEl: HTMLElement,
	gridEl: HTMLElement,
	card: DashboardCard,
	layout: GridLayout,
	component: Component,
	onCommit: () => void,
): void {
	const overlay = cardEl.createDiv("hearth-card-overlay");
	// One resize grip per edge and corner, so the card can be resized from any
	// side, not just the bottom-right.
	const handles = RESIZE_DIRS.map((dir) => ({
		dir,
		el: cardEl.createDiv(`hearth-resize-handle is-${dir}`),
	}));

	let ctx: DragContext | null = null;
	let guideX: HTMLElement | null = null;
	let guideY: HTMLElement | null = null;

	// The dragged card's own position is written synchronously on every
	// pointermove so it tracks the pointer with no lag. The *derived* visual
	// work — growing the board (a forced layout read over every card), the
	// O(n²) edge-merge scan, and the frosted-glass SVG rebuild — is coalesced
	// into a single animation frame so it runs at most once per painted frame
	// instead of once per pointer event (pointermove can fire far more often).
	let reflowFrame = 0;
	const runReflow = () => {
		reflowFrame = 0;
		updateBoardHeight(gridEl);
		applyEdgeMerging(gridEl);
	};
	const scheduleReflow = () => {
		if (reflowFrame) return;
		reflowFrame = window.requestAnimationFrame(runReflow);
	};
	const cancelReflow = () => {
		if (reflowFrame) {
			window.cancelAnimationFrame(reflowFrame);
			reflowFrame = 0;
		}
	};
	// A drag interrupted by a view teardown never reaches `end`; drop any frame
	// still queued so it can't run against a detached grid.
	component.register(cancelReflow);

	const showGuide = (axis: "x" | "y", pos: number | null) => {
		if (axis === "x") {
			if (pos == null) {
				guideX?.remove();
				guideX = null;
				return;
			}
			if (!guideX) guideX = gridEl.createDiv("hearth-align-guide is-vertical");
			guideX.style.left = `${pos}px`;
		} else {
			if (pos == null) {
				guideY?.remove();
				guideY = null;
				return;
			}
			if (!guideY) guideY = gridEl.createDiv("hearth-align-guide is-horizontal");
			guideY.style.top = `${pos}px`;
		}
	};

	const begin = (e: PointerEvent, mode: "move" | "resize", dir: ResizeDir | null) => {
		e.preventDefault();
		e.stopPropagation();
		const boardWidth = gridEl.clientWidth;
		// Fit-to-page clamps cards to the visible board; scroll mode lets the board
		// grow downward without limit, so a card can be dragged/resized as far down
		// as the pointer goes (the board height follows via updateBoardHeight).
		const boardHeight = gridEl.closest(".hearth-fit") ? gridEl.clientHeight : Infinity;
		const { xTargets, yTargets } = collectTargets(layout, card, boardWidth);
		ctx = {
			pointerId: e.pointerId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startLeft: (card.fx ?? 0) * boardWidth,
			startTop: card.fy ?? 0,
			startWidth: (card.fw ?? 0) * boardWidth,
			startHeight: card.fh ?? MIN_H_PX,
			boardWidth,
			boardHeight,
			mode,
			dir,
			xTargets,
			yTargets,
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		cardEl.addClass(mode === "move" ? "is-moving" : "is-resizing");
	};

	const move = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		const dx = e.clientX - ctx.startClientX;
		const dy = e.clientY - ctx.startClientY;

		if (ctx.mode === "move") {
			let left = clamp(ctx.startLeft + dx, 0, ctx.boardWidth - ctx.startWidth);
			let top = Math.max(0, ctx.startTop + dy);
			// In fit-to-page mode keep the card fully inside the board so it
			// can't be dragged (or dropped) off-screen.
			if (ctx.boardHeight > 0) {
				top = Math.min(top, ctx.boardHeight - ctx.startHeight);
			}
			// Snap left/centre/right edges to vertical guides.
			const snapX = bestSnap(
				[left, left + ctx.startWidth / 2, left + ctx.startWidth],
				ctx.xTargets,
			);
			if (snapX) {
				left = clamp(left + snapX.delta, 0, ctx.boardWidth - ctx.startWidth);
				showGuide("x", snapX.guide);
			} else {
				showGuide("x", null);
			}
			// Snap top/middle/bottom edges to horizontal guides.
			const snapY = bestSnap(
				[top, top + ctx.startHeight / 2, top + ctx.startHeight],
				ctx.yTargets,
			);
			if (snapY) {
				top = Math.max(0, top + snapY.delta);
				showGuide("y", snapY.guide);
			} else {
				showGuide("y", null);
			}
			cardEl.style.left = `${left}px`;
			cardEl.style.width = `${ctx.startWidth}px`;
			cardEl.style.top = `${top}px`;
		} else {
			const dir = ctx.dir ?? "se";
			const right = ctx.startLeft + ctx.startWidth;
			const bottom = ctx.startTop + ctx.startHeight;
			let left = ctx.startLeft;
			let top = ctx.startTop;
			let width = ctx.startWidth;
			let height = ctx.startHeight;

			// East/west edges — one stays anchored while the other follows.
			if (dir.includes("e")) {
				width = clamp(ctx.startWidth + dx, MIN_W_PX, ctx.boardWidth - ctx.startLeft);
				const snap = bestSnap([left + width], ctx.xTargets);
				if (snap) width = clamp(width + snap.delta, MIN_W_PX, ctx.boardWidth - left);
				showGuide("x", snap ? snap.guide : null);
			} else if (dir.includes("w")) {
				left = clamp(ctx.startLeft + dx, 0, right - MIN_W_PX);
				const snap = bestSnap([left], ctx.xTargets);
				if (snap) left = clamp(left + snap.delta, 0, right - MIN_W_PX);
				width = right - left;
				showGuide("x", snap ? snap.guide : null);
			} else {
				showGuide("x", null);
			}

			// North/south edges. In fit-to-page mode clamp so a card can't be
			// resized past the bottom of the visible board.
			const heightMax = ctx.boardHeight > 0 ? ctx.boardHeight - ctx.startTop : Number.MAX_SAFE_INTEGER;
			if (dir.includes("s")) {
				height = Math.max(MIN_H_PX, Math.min(ctx.startHeight + dy, heightMax));
				const snap = bestSnap([top + height], ctx.yTargets);
				if (snap) height = Math.max(MIN_H_PX, Math.min(height + snap.delta, heightMax));
				showGuide("y", snap ? snap.guide : null);
			} else if (dir.includes("n")) {
				const topMax = ctx.boardHeight > 0 ? ctx.boardHeight - MIN_H_PX : bottom - MIN_H_PX;
				top = clamp(ctx.startTop + dy, 0, Math.min(bottom - MIN_H_PX, topMax));
				const snap = bestSnap([top], ctx.yTargets);
				if (snap) top = clamp(top + snap.delta, 0, Math.min(bottom - MIN_H_PX, topMax));
				height = bottom - top;
				showGuide("y", snap ? snap.guide : null);
			} else {
				showGuide("y", null);
			}

		cardEl.style.left = `${left}px`;
		cardEl.style.width = `${width}px`;
		cardEl.style.top = `${top}px`;
		cardEl.style.height = `${height}px`;
		}
		// Live edge-merge / board-height update so touching corners sharpen as the
		// card snaps to a neighbour during a drag/resize — coalesced to one frame.
		scheduleReflow();
	};

	const end = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		// Drop any queued mid-drag reflow; this handler recomputes everything
		// synchronously below from the final committed geometry.
		cancelReflow();
		const w = ctx.boardWidth || 1;
		// Persist the live pixel geometry back into the fractional/pixel model.
		card.fx = clamp(cardEl.offsetLeft / w, 0, 1);
		card.fw = clamp(cardEl.offsetWidth / w, MIN_W_PX / w, 1);
		card.fy = Math.max(0, cardEl.offsetTop);
		card.fh = Math.max(MIN_H_PX, cardEl.offsetHeight);
		cardEl.removeClass("is-moving");
		cardEl.removeClass("is-resizing");
		showGuide("x", null);
		showGuide("y", null);
		ctx = null;
		// Normalise back to the responsive percentage form.
		applyCardPosition(cardEl, card);
		updateBoardHeight(gridEl);
		// After a committed move/resize, recompute merges from the final
		// stored positions (responsive reflow may have shifted neighbours).
		applyEdgeMerging(gridEl);
		onCommit();
	};

	component.registerDomEvent(overlay, "pointerdown", (e) => begin(e, "move", null));
	component.registerDomEvent(overlay, "pointermove", move);
	component.registerDomEvent(overlay, "pointerup", end);
	component.registerDomEvent(overlay, "pointercancel", end);
	for (const { dir, el } of handles) {
		component.registerDomEvent(el, "pointerdown", (e) => begin(e, "resize", dir));
		component.registerDomEvent(el, "pointermove", move);
		component.registerDomEvent(el, "pointerup", end);
		component.registerDomEvent(el, "pointercancel", end);
	}
}

/** Grow the board so it always contains its lowest card (plus breathing room).
 * In fit-to-page mode the board is locked to one screen, so skip the inline
 * min-height there — the CSS handles clipping instead. */
export function updateBoardHeight(gridEl: HTMLElement): void {
	if (gridEl.closest(".hearth-fit")) return;
	let bottom = 0;
	for (const child of Array.from(gridEl.children)) {
		const el = child as HTMLElement;
		if (!el.classList.contains("hearth-card")) continue;
		bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
	}
	gridEl.style.minHeight = `${bottom + GRID_GAP}px`;
}

/** Detect pairs of cards whose edges touch and flag them so CSS can sharpen
 *  the touching corners (and drop the double border between them) — making two
 *  adjacent cards read as a single merged tile, like grouped Android
 *  notifications. Reads live DOM offsets so it works both at rest and while a
 *  card is being dragged (its inline position is already current). */
export function applyEdgeMerging(gridEl: HTMLElement): void {
	const cards = Array.from(gridEl.querySelectorAll<HTMLElement>(":scope > .hearth-card"));
	const MERGE_CLASSES = [
		"merge-top", "merge-bottom", "merge-left", "merge-right",
		"merge-tl", "merge-tr", "merge-bl", "merge-br",
	];
	for (const c of cards) {
		c.classList.remove(...MERGE_CLASSES);
	}
	if (cards.length < 2) return;

	// Touch threshold: cards snap edges to a 0-gap line, so a couple of px of
	// slack covers sub-pixel rendering without merging cards that merely sit
	// near each other. The perpendicular overlap floor avoids joining cards
	// that only brush at a corner.
	const TOUCH = 2;
	const OVERLAP = 6;
	// Per-card corner-end coverage. Each flag records whether the given end of
	// the given edge is reached by a touching neighbour, e.g. `rT` = the top end
	// of the right edge is covered. A corner sharpens when either edge meeting
	// at it is covered there; a border drops only when its whole edge is covered
	// (both ends), so a partially-shared edge keeps its outline.
	const rects = cards.map((el) => ({
		el,
		left: el.offsetLeft,
		top: el.offsetTop,
		right: el.offsetLeft + el.offsetWidth,
		bottom: el.offsetTop + el.offsetHeight,
		rT: false, rB: false, lT: false, lB: false,
		tL: false, tR: false, bL: false, bR: false,
	}));

	for (let i = 0; i < rects.length; i++) {
		for (let j = i + 1; j < rects.length; j++) {
			const a = rects[i];
			const b = rects[j];
			// Horizontal adjacency (side by side): the right edge of one meets
			// the left edge of the other, with real vertical overlap.
			const aLeftOfB = Math.abs(a.right - b.left) <= TOUCH;
			const bLeftOfA = Math.abs(b.right - a.left) <= TOUCH;
			if (aLeftOfB || bLeftOfA) {
				const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
				if (vOverlap > OVERLAP) {
					// L sits to the left of R along the shared edge (L's right
					// edge meets R's left edge). A corner-end is covered only
					// where the neighbour actually reaches that end.
					const L = aLeftOfB ? a : b;
					const R = aLeftOfB ? b : a;
					if (R.top <= L.top + TOUCH) L.rT = true;
					if (R.bottom >= L.bottom - TOUCH) L.rB = true;
					if (L.top <= R.top + TOUCH) R.lT = true;
					if (L.bottom >= R.bottom - TOUCH) R.lB = true;
				}
			}
			// Vertical adjacency (stacked): bottom edge meets top edge, with
			// real horizontal overlap.
			const aAboveB = Math.abs(a.bottom - b.top) <= TOUCH;
			const bAboveA = Math.abs(b.bottom - a.top) <= TOUCH;
			if (aAboveB || bAboveA) {
				const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
				if (hOverlap > OVERLAP) {
					// T sits above Bot (T's bottom edge meets Bot's top edge).
					const T = aAboveB ? a : b;
					const Bot = aAboveB ? b : a;
					if (Bot.left <= T.left + TOUCH) T.bL = true;
					if (Bot.right >= T.right - TOUCH) T.bR = true;
					if (T.left <= Bot.left + TOUCH) Bot.tL = true;
					if (T.right >= Bot.right - TOUCH) Bot.tR = true;
				}
			}
		}
	}

	for (const r of rects) {
		const cl = r.el.classList;
		// Sharpen a corner when either edge meeting there is covered at that end.
		if (r.tL || r.lT) cl.add("merge-tl");
		if (r.tR || r.rT) cl.add("merge-tr");
		if (r.bL || r.lB) cl.add("merge-bl");
		if (r.bR || r.rB) cl.add("merge-br");
		// Drop a shared border only when the whole edge is covered end-to-end.
		if (r.tL && r.tR) cl.add("merge-top");
		if (r.bL && r.bR) cl.add("merge-bottom");
		if (r.lT && r.lB) cl.add("merge-left");
		if (r.rT && r.rB) cl.add("merge-right");
	}

	// The frosted-glass blur is shared across touching cards, and its mask keys
	// off the merge classes just set above, so rebuild it here — every reflow
	// path (initial render, drag/resize, viewport resize, fit) already routes
	// through applyEdgeMerging.
	updateFrostLayers(gridEl);
}

/** Fallback card corner radius (px), matching the `border-radius` fallback in
 *  styles.css, used when the board hasn't set --hearth-card-radius. */
const CARD_RADIUS_FALLBACK = 14;

/** Resolve the board's live corner radius (px) from the --hearth-card-radius
 *  CSS variable set by renderDashboard, so the frost mask rounds by exactly the
 *  same amount the cards do. Falls back to the design baseline if unset. */
function resolveGridRadius(gridEl: HTMLElement): number {
	const raw = getComputedStyle(gridEl).getPropertyValue("--hearth-card-radius");
	const n = parseFloat(raw);
	return Number.isFinite(n) && n >= 0 ? n : CARD_RADIUS_FALLBACK;
}

/** SVG path for one card's border-box silhouette, rounding each corner to
 *  `radius` unless that corner is merged flat. A zero-radius elliptical arc
 *  renders as a straight line to its endpoint, so all four arcs are always
 *  emitted regardless of merge state. Coordinates are in the grid's own pixel
 *  space (offset* is relative to the positioned grid). */
function cardSilhouettePath(el: HTMLElement, radius: number): string {
	const x = el.offsetLeft;
	const y = el.offsetTop;
	const w = el.offsetWidth;
	const h = el.offsetHeight;
	const cl = el.classList;
	const tl = cl.contains("merge-tl") ? 0 : radius;
	const tr = cl.contains("merge-tr") ? 0 : radius;
	const br = cl.contains("merge-br") ? 0 : radius;
	const bl = cl.contains("merge-bl") ? 0 : radius;
	return (
		`M${x + tl},${y}` +
		`L${x + w - tr},${y}A${tr},${tr} 0 0 1 ${x + w},${y + tr}` +
		`L${x + w},${y + h - br}A${br},${br} 0 0 1 ${x + w - br},${y + h}` +
		`L${x + bl},${y + h}A${bl},${bl} 0 0 1 ${x},${y + h - bl}` +
		`L${x},${y + tl}A${tl},${tl} 0 0 1 ${x + tl},${y}Z`
	);
}

/** Rebuild the shared frosted-glass blur layers behind the cards. See the
 *  .hearth-frost note in styles.css for why the blur is shared rather than
 *  per-card. One .hearth-frost layer is created per distinct resolved blur value
 *  (stashed on each card as data-blur), each masked — via an inline SVG built
 *  from the cards' live silhouettes — to the union of its cards. The blur is
 *  therefore computed once per value and shows only under the cards, so touching
 *  cards blur as one seamless surface while gaps stay sharp. */
export function updateFrostLayers(gridEl: HTMLElement): void {
	let root = gridEl.querySelector<HTMLElement>(":scope > .hearth-frost-root");
	const cards = Array.from(
		gridEl.querySelectorAll<HTMLElement>(":scope > .hearth-card.has-blur"),
	);
	if (cards.length === 0) {
		root?.remove();
		return;
	}
	if (!root) {
		root = gridEl.createDiv("hearth-frost-root");
		// Paint behind every card by sitting first in the grid.
		gridEl.prepend(root);
	}

	// Group cards by resolved blur so touching cards that share a value blur as
	// one surface; a card with a custom blur gets its own layer (and may still
	// seam against a neighbour of a different blur — that difference is intended).
	const byBlur = new Map<string, HTMLElement[]>();
	for (const c of cards) {
		const b = c.dataset.blur ?? "0";
		const list = byBlur.get(b);
		if (list) list.push(c);
		else byBlur.set(b, [c]);
	}

	const w = gridEl.clientWidth;
	const h = gridEl.clientHeight;
	const radius = resolveGridRadius(gridEl);
	const seen = new Set<string>();
	for (const [blur, group] of byBlur) {
		seen.add(blur);
		let layer = root.querySelector<HTMLElement>(
			`:scope > .hearth-frost[data-blur="${blur}"]`,
		);
		if (!layer) {
			layer = root.createDiv("hearth-frost");
			layer.dataset.blur = blur;
		}
		const filter = `blur(${blur}px)`;
		layer.style.setProperty("backdrop-filter", filter);
		layer.style.setProperty("-webkit-backdrop-filter", filter);
		const paths = group
			.map((c) => `<path d="${cardSilhouettePath(c, radius)}" fill="#fff"/>`)
			.join("");
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
			`viewBox="0 0 ${w} ${h}">${paths}</svg>`;
		const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
		layer.style.setProperty("mask-image", mask);
		layer.style.setProperty("-webkit-mask-image", mask);
	}
	// Drop layers for blur values that no longer have any cards.
	for (const layer of Array.from(
		root.querySelectorAll<HTMLElement>(":scope > .hearth-frost"),
	)) {
		if (!seen.has(layer.dataset.blur ?? "")) layer.remove();
	}
}
