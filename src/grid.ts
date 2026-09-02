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
	// The floor is scaled with everything else, and that is not cosmetic: an
	// unscaled floor is applied with Math.max, so it can only ever make a card
	// TALLER than the linear map placed it — pushing its bottom edge past where
	// the next card's top edge was scaled to, which is an overlap. Once the
	// squeeze is hard enough that ordinary cards scale below 56px, every one of
	// them clamps to 56px and the whole board piles up. That is the normal case
	// on a phone-shaped viewport, not an extreme one, so fit-to-page was
	// reliably broken there.
	//
	// Scaling the floor keeps it inert for any card that is at least MIN_H_PX
	// tall to begin with (which resizing and placement both guarantee), so it
	// goes back to being what it was meant to be: a guard against a degenerate
	// stored height, not a second placement rule fighting the first.
	el.style.height = `${Math.max(Math.round(MIN_H_PX * scale), bottom - top)}px`;
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

/** The vertical scale currently applied to this board's cards on screen: the
 * fit-to-page squeeze when the board is fitted, 1 otherwise. Anything that has
 * to convert between a card's stored geometry and the pixels it actually
 * occupies must go through this — see cardGeometryFromScreen. */
export function boardFitScale(gridEl: HTMLElement, cards: DashboardCard[]): number {
	if (!gridEl.closest(".hearth-fit")) return 1;
	return fitVerticalScale(cards, gridEl.clientHeight);
}

/** Re-apply the fit-to-page layout: derive the one shared vertical scale from
 * the cards' stored geometry and position every card with it. Render-only — see
 * applyCardPositionFitted for why this never writes back. Returns the scale it
 * used. Both the initial/observer-driven refit and the end of a drag go through
 * here, so a committed arrangement is drawn in exactly the same coordinate space
 * as the rest of the board. */
export function applyFitLayout(gridEl: HTMLElement, layout: GridLayout): number {
	const vScale = fitVerticalScale(layout.cards, gridEl.clientHeight);
	const boardWidth = gridEl.clientWidth;
	for (const card of layout.cards) {
		const el = layout.elements.get(card);
		if (el) applyCardPositionFitted(el, card, vScale, boardWidth);
	}
	return vScale;
}

/** A card's live on-screen footprint, in the grid's own pixel space. */
export interface ScreenRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Read a card element's footprint as laid out right now. offset* is relative to
 * the positioned grid, so this is the board-space geometry the pointer sees —
 * including any fit-to-page vertical squeeze already applied to it. */
export function screenRect(el: HTMLElement): ScreenRect {
	return {
		left: el.offsetLeft,
		top: el.offsetTop,
		width: el.offsetWidth,
		height: el.offsetHeight,
	};
}

/** Convert an on-screen footprint back into a card's stored geometry.
 *
 * The horizontal axis is a plain board-width fraction. The vertical axis is
 * where this earns its keep: on a fit-to-page board the cards are painted at
 * `fy * vScale` / `fh * vScale` (applyCardPositionFitted), so the pixels a drag
 * ends on are NOT the pixels to store. Dividing the screen geometry back out by
 * the same scale is what keeps a drop where the user dropped it — storing the
 * scaled values instead made every committed move/resize re-squeeze on the next
 * render, jumping the card upward (and shrinking it) by the fit factor, then
 * compounding on the next arrange because the true geometry had been
 * overwritten. */
export function cardGeometryFromScreen(
	rect: ScreenRect,
	boardWidth: number,
	vScale: number,
): { fx: number; fw: number; fy: number; fh: number } {
	const w = boardWidth > 0 ? boardWidth : 1;
	// A zero/negative scale would blow the geometry up to infinity; fitVerticalScale
	// never returns one, but the model must not depend on that.
	const scale = vScale > 0 ? vScale : 1;
	return {
		fx: clamp(rect.left / w, 0, 1),
		fw: clamp(rect.width / w, Math.min(MIN_W_PX / w, 1), 1),
		fy: Math.max(0, rect.top / scale),
		fh: Math.max(MIN_H_PX, rect.height / scale),
	};
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
	/** The fit-to-page vertical squeeze in force when the drag started, so the
	 * committed geometry can be converted back out of screen space. */
	vScale: number;
	mode: "move" | "resize";
	/** For resize: which edges follow the pointer. */
	dir: ResizeDir | null;
	// Candidate snap lines (px, board-relative) collected from siblings + board.
	xTargets: number[];
	yTargets: number[];
}

/** Collect the vertical (x) and horizontal (y) guide positions a dragged card
 * can snap to: the board's own edges/centre plus every other card's edges,
 * centres and a one-gap offset for tidy adjacency.
 *
 * The guides are read off the siblings as they are actually laid out, not from
 * their stored geometry. On a fit-to-page board the two disagree by the fit
 * scale, and a guide line that sits tens of pixels away from the edge the user
 * can see is a guide that never comes within SNAP_THRESHOLD of it — which is
 * why snapping simply stopped working once the layout overflowed the pane
 * (typically after zooming Obsidian in, which shortens the board). */
function collectTargets(
	layout: GridLayout,
	active: DashboardCard,
	boardWidth: number,
): { xTargets: number[]; yTargets: number[] } {
	const xs = new Set<number>([0, boardWidth / 2, boardWidth]);
	const ys = new Set<number>([0]);
	for (const card of layout.cards) {
		if (card === active) continue;
		const el = layout.elements.get(card);
		if (!el) continue;
		const { left, top, width, height } = screenRect(el);
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
 * Let a card in the stacked layout be resized by dragging its bottom edge.
 *
 * The stacked layout has exactly one dimension a card owns: its height. Width
 * is the column's and position is the order, so the full drag engine has
 * nothing to offer here — but height without a gesture meant typing a number
 * into the card's settings, which is not how anyone resizes a card anywhere
 * else in Hearth.
 *
 * The height is written to `mobile.height`, the card's own stacked-layout
 * override, so resizing a card on a phone never touches the `fh` the desktop
 * board is laid out with. That is the same separation the rest of the stacked
 * layout keeps, and it is what lets the two layouts have different answers.
 */
export function enableStackedResize(
	cardEl: HTMLElement,
	card: DashboardCard,
	component: Component,
	onCommit: () => void,
): void {
	const handle = cardEl.createDiv("hearth-resize-handle is-s is-stacked-grip");
	let start: { y: number; height: number; pointer: number } | null = null;

	component.registerDomEvent(handle, "pointerdown", (e: PointerEvent) => {
		// The card header sits above this in arrange mode and the board scrolls
		// under it; neither should see the drag that starts here.
		e.preventDefault();
		e.stopPropagation();
		start = { y: e.clientY, height: cardEl.offsetHeight, pointer: e.pointerId };
		handle.setPointerCapture(e.pointerId);
		cardEl.addClass("is-resizing");
	});

	component.registerDomEvent(handle, "pointermove", (e: PointerEvent) => {
		if (start?.pointer !== e.pointerId) return;
		const height = Math.max(MIN_H_PX, Math.round(start.height + (e.clientY - start.y)));
		cardEl.style.height = `${height}px`;
	});

	const end = (e: PointerEvent) => {
		if (start?.pointer !== e.pointerId) return;
		start = null;
		cardEl.removeClass("is-resizing");
		// Dragging a card to a height is someone stating one, so it is stored as
		// an explicit override rather than left to be derived again on the next
		// render — which would snap the card straight back.
		card.mobile = { ...card.mobile, height: cardEl.offsetHeight };
		onCommit();
	};
	component.registerDomEvent(handle, "pointerup", end);
	component.registerDomEvent(handle, "pointercancel", end);
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

	/** Redraw the board from the stored geometry, in whichever coordinate space
	 * the board is currently using: fitted boards re-derive the shared vertical
	 * scale (which a commit may have changed) and reposition every card with it,
	 * scrolling boards just place the dragged card. */
	const reposition = () => {
		if (gridEl.closest(".hearth-fit")) applyFitLayout(gridEl, layout);
		else applyCardPosition(cardEl, card);
	};

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
		const fit = !!gridEl.closest(".hearth-fit");
		// Fit-to-page clamps cards to the visible board; scroll mode lets the board
		// grow downward without limit, so a card can be dragged/resized as far down
		// as the pointer goes (the board height follows via updateBoardHeight).
		const boardHeight = fit ? gridEl.clientHeight : Infinity;
		const { xTargets, yTargets } = collectTargets(layout, card, boardWidth);
		// Seed the drag from where the card actually is on screen rather than from
		// its stored geometry: the pointer deltas below are screen pixels, and on a
		// fitted board the stored values are the pre-squeeze ones, so mixing the two
		// snapped the card to its unscaled position the moment it started moving.
		const rect = screenRect(cardEl);
		ctx = {
			pointerId: e.pointerId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startLeft: rect.left,
			startTop: rect.top,
			startWidth: rect.width,
			startHeight: Math.max(MIN_H_PX, rect.height),
			boardWidth,
			boardHeight,
			vScale: boardFitScale(gridEl, layout.cards),
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
		// Persist the live pixel geometry back into the fractional/pixel model,
		// undoing any fit-to-page squeeze the card was drawn with.
		const geo = cardGeometryFromScreen(screenRect(cardEl), ctx.boardWidth, ctx.vScale);
		card.fx = geo.fx;
		card.fw = geo.fw;
		card.fy = geo.fy;
		card.fh = geo.fh;
		cardEl.removeClass("is-moving");
		cardEl.removeClass("is-resizing");
		showGuide("x", null);
		showGuide("y", null);
		ctx = null;
		// Normalise back to the stored form. On a fitted board that means re-running
		// the fit across every card, not just this one: growing or moving a card can
		// change the layout's total height and so the scale the whole board is drawn
		// at. Repositioning only the dragged card — with the unscaled helper, as this
		// used to — left it in a different coordinate space from its neighbours until
		// the next full render, which is when it appeared to teleport.
		reposition();
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

/** Touch threshold: cards snap edges to a 0-gap line, so a couple of px of
 *  slack covers sub-pixel rendering without merging cards that merely sit near
 *  each other. The perpendicular overlap floor avoids joining cards that only
 *  brush at a corner. Shared by the corner/border merging below and by the
 *  frost's run grouping, so the blur groups exactly the cards the eye reads as
 *  joined — see mergedRuns. */
const TOUCH = 2;
const OVERLAP = 6;

/** The rectangle the merge and frost geometry works in: a card's border box in
 *  the grid's own pixel space. */
export interface CardBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Whether two cards touch along an edge closely enough to read as one merged
 *  tile — the same test applyEdgeMerging uses before it sharpens corners and
 *  drops shared borders. Pure geometry, so the frost grouping cannot drift from
 *  what the cards actually look like. */
export function cardsMerge(a: CardBox, b: CardBox): boolean {
	// Side by side: the right edge of one meets the left edge of the other, with
	// real vertical overlap.
	if (Math.abs(a.right - b.left) <= TOUCH || Math.abs(b.right - a.left) <= TOUCH) {
		if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP) return true;
	}
	// Stacked: bottom edge meets top edge, with real horizontal overlap.
	if (Math.abs(a.bottom - b.top) <= TOUCH || Math.abs(b.bottom - a.top) <= TOUCH) {
		if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP) return true;
	}
	return false;
}

/**
 * Partition cards into runs of touching cards — the connected components of the
 * `cardsMerge` graph.
 *
 * This is what keeps one card's frost off another's patch of wallpaper. A single
 * layer covering every blurred card on the board has to span the gaps between
 * them, and then leans entirely on its mask to hide the blur in those gaps; where
 * the mask is not honoured, the whole bounding box reads as one frosted sheet with
 * the cards floating on it. One layer per run makes each layer's *box* hug its own
 * cards, so there is nothing over a gap to hide in the first place — and a run of
 * one card is just that card.
 *
 * Runs come back ordered by position (top-left first) so a layer keeps its
 * identity across rebuilds and is not torn down and recreated on every reflow.
 */
export function mergedRuns<T extends CardBox>(boxes: readonly T[]): T[][] {
	// Union-find over the touching pairs. n is the number of blurred cards on one
	// board, so the O(n^2) pair scan is the same shape (and cost) as the merge scan.
	const parent = boxes.map((_, i) => i);
	const find = (i: number): number => {
		while (parent[i] !== i) {
			parent[i] = parent[parent[i]];
			i = parent[i];
		}
		return i;
	};
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			if (!cardsMerge(boxes[i], boxes[j])) continue;
			const ri = find(i);
			const rj = find(j);
			if (ri !== rj) parent[ri] = rj;
		}
	}

	const runs = new Map<number, T[]>();
	for (let i = 0; i < boxes.length; i++) {
		const root = find(i);
		const run = runs.get(root);
		if (run) run.push(boxes[i]);
		else runs.set(root, [boxes[i]]);
	}

	// Order by the run's own top-left so the nth run is the same run next reflow.
	return Array.from(runs.values()).sort((a, b) => {
		const ay = Math.min(...a.map((c) => c.top));
		const by = Math.min(...b.map((c) => c.top));
		if (ay !== by) return ay - by;
		return Math.min(...a.map((c) => c.left)) - Math.min(...b.map((c) => c.left));
	});
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
	// One card has nothing to merge with — but it still needs its frost rebuilt,
	// so this cannot just return. The frost is driven from here (see the call at
	// the end) and this is its only entry point, so returning early left a
	// one-card board with no frosted glass at all however high its blur.
	if (cards.length < 2) {
		updateFrostLayers(gridEl);
		return;
	}

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
function cardSilhouettePath(
	el: HTMLElement,
	radius: number,
	originX = 0,
	originY = 0,
): string {
	const x = el.offsetLeft - originX;
	const y = el.offsetTop - originY;
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

/** Rebuild the frosted-glass blur layers behind the cards. See the .hearth-frost
 *  note in styles.css for why the blur is shared across touching cards rather
 *  than run per card. One .hearth-frost layer is created per distinct resolved
 *  blur value (stashed on each card as data-blur) *per run of touching cards*
 *  (see mergedRuns), each masked — via an inline SVG built from the cards' live
 *  silhouettes — to the union of that run's cards. So a run of touching cards
 *  blurs as one seamless surface, and a card standing on its own gets a layer no
 *  bigger than itself. */
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

	const radius = resolveGridRadius(gridEl);
	const gridW = gridEl.clientWidth;
	const gridH = gridEl.clientHeight;
	const seen = new Set<string>();
	for (const [blur, group] of byBlur) {
		// …then split each blur group into runs of touching cards, one layer each.
		// Grouping by blur alone would put every card of that blur under a single
		// layer spanning them all, which then has to span the gaps between them too.
		const boxes = group.map((el) => ({
			el,
			left: el.offsetLeft,
			top: el.offsetTop,
			right: el.offsetLeft + el.offsetWidth,
			bottom: el.offsetTop + el.offsetHeight,
		}));
		const runs = mergedRuns(boxes);
		for (let i = 0; i < runs.length; i++) {
			const run = runs[i];
			// Keyed by blur *and* run index (runs are position-ordered) so a layer is
			// reused across reflows rather than rebuilt from scratch each time.
			const key = `${blur}:${i}`;
			seen.add(key);
			let layer = root.querySelector<HTMLElement>(
				`:scope > .hearth-frost[data-frost="${key}"]`,
			);
			if (!layer) {
				layer = root.createDiv("hearth-frost");
				layer.dataset.frost = key;
			}
			const filter = `blur(${blur}px)`;
			layer.style.setProperty("backdrop-filter", filter);
			layer.style.setProperty("-webkit-backdrop-filter", filter);

			// Size the layer to its own run, and to EXACTLY that run — no padding.
			//
			// A backdrop-filter is priced by the element's box, not by how much of it
			// the mask lets through: a layer spanning the grid makes the compositor
			// blur the entire board's backdrop and *then* mask the result away. On a
			// Retina display that is the full board area at 2x, re-evaluated whenever
			// anything behind it changes.
			//
			// This box used to be padded by twice the blur radius, on the theory that a
			// blurred layer goes soft at its own edges and so the box has to reach past
			// the cards for the blur under a card's border to sample real backdrop
			// rather than a clamped edge. The padding was a bad trade:
			//
			// - What it cost is a visible blur FRAME. The padding is only invisible
			//   while the mask is trimming it away, and a backdrop-filter is not
			//   reliably clipped by its element's own mask — Chromium has shipped
			//   versions that ignore it. Where it is ignored, every card wears a band
			//   of blurred wallpaper twice the blur radius wide.
			// - What it bought is nothing you can see. Compared side by side at 2x, the
			//   padded and unpadded boxes are indistinguishable over a photographic
			//   wallpaper, which is what Hearth's backgrounds are. The clamping only
			//   shows against contrived high-frequency content (hard 4px stripes).
			//
			// So the box is the run's own bounding box, rounded off by border-radius
			// below. Nothing extends past the cards, so there is nothing for the mask
			// to have to hide, and the layer is correct whether or not it is honoured.
			// Padding cannot be recovered by clipping the overflow of a wrapper either:
			// any clip also becomes the filter's sampling region, so the clamped edge
			// comes straight back (which is likewise why the mask is not a clip-path).
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (const c of run) {
				minX = Math.min(minX, c.left);
				minY = Math.min(minY, c.top);
				maxX = Math.max(maxX, c.right);
				maxY = Math.max(maxY, c.bottom);
			}
			const x = Math.max(0, Math.floor(minX));
			const y = Math.max(0, Math.floor(minY));
			const w = Math.min(gridW, Math.ceil(maxX)) - x;
			const h = Math.min(gridH, Math.ceil(maxY)) - y;
			layer.style.left = `${x}px`;
			layer.style.top = `${y}px`;
			layer.style.width = `${w}px`;
			layer.style.height = `${h}px`;
			// Round the box the way the cards round. border-radius is the element's own
			// clip rather than a mask, and is honoured where the mask is not, so a run
			// whose outline is a rounded rectangle — a lone card, a row, a column, a
			// block of equal cards — comes out exact with no help from the mask at all.
			// A run with a notch in it (cards of unequal size along a shared edge) still
			// needs the mask to carve the notch, and reads as its bounding box without.
			layer.style.borderRadius = `${radius}px`;

			const paths = run
				.map((c) => `<path d="${cardSilhouettePath(c.el, radius, x, y)}" fill="#fff"/>`)
				.join("");
			const svg =
				`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
				`viewBox="0 0 ${w} ${h}">${paths}</svg>`;
			const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
			layer.style.setProperty("mask-image", mask);
			layer.style.setProperty("-webkit-mask-image", mask);
		}
	}
	// Drop layers whose blur value or run no longer exists.
	for (const layer of Array.from(
		root.querySelectorAll<HTMLElement>(":scope > .hearth-frost"),
	)) {
		if (!seen.has(layer.dataset.frost ?? "")) layer.remove();
	}
}
