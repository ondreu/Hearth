import { NARROW_WIDTH_DEFAULT } from "./types";
import type { DashboardCard } from "./types";
import { MIN_H_PX } from "./grid";

/**
 * The narrow layout: what Hearth does when the board is too small for the
 * free-form one.
 *
 * The free-form board places every card at `left: fx * 100%` / `width: fw *
 * 100%` — fractions of the board width — with pixel tops and heights. That is
 * exactly right down to a laptop pane and meaningless below it: the fractions
 * hold, so a quarter-width card on a 390px phone is 90px across, and the pixel
 * heights don't compress at all. There is no width at which that board becomes
 * readable, which is why the only mobile answer used to be hiding it.
 *
 * So below a threshold the board stops being free-form and becomes a single
 * full-width column, top to bottom, in the order you'd read the desktop board.
 * Two properties matter more than the layout itself:
 *
 *  - It is keyed off the *measured board width*, not `Platform.isMobile`. A
 *    320px desktop sidebar has the same problem as a phone and gets the same
 *    fix, an iPad in landscape has neither and keeps the real board, and the
 *    whole narrow layout can be exercised on a desktop by dragging a pane
 *    narrow — which is also how the Arrange phone preview works.
 *  - It is render-only. Nothing here writes to `fx/fy/fw/fh`, so opening a
 *    vault on a phone cannot reshape the desktop board. (`applyCardPositionFitted`
 *    in grid.ts carries the scar from the version of fit-to-page that did
 *    persist; the same rule applies here for the same reason.)
 */

/** The width the Arrange phone preview clamps the board to — a mainstream
 * phone in portrait, comfortably inside the narrow threshold at its lowest
 * setting ({@link NARROW_WIDTH_MIN} is 320px, and the preview forces the narrow
 * layout on regardless). */
export const PHONE_PREVIEW_WIDTH = 400;

/** How far below a row's top a card may start and still belong to that row.
 * Side-by-side cards are rarely pixel-aligned — dragged into place, they land a
 * few pixels apart — and without a band the card two pixels higher wins the
 * whole comparison, so a row of three could stack right, left, middle. */
export const ROW_BAND = 48;

/** The height a card stacks at when it has no stored height of its own. */
export const STACK_HEIGHT_DEFAULT = 184;

/** Bounds for a *derived* stacked height. The ceiling exists because a stacked
 * card is full width — usually far wider than it was on the board — so its
 * desktop height is more than its content now needs, and a 900px hero would
 * otherwise be two phone screens of one card. An explicit `mobile.height` is
 * deliberately not capped: someone who asks for a tall card has answered the
 * question the cap is guessing at. */
export const STACK_HEIGHT_MAX = 420;

/**
 * Whether a board of this width uses the narrow layout.
 *
 * The threshold is a setting ({@link HomeSettings.narrowWidth}, per board or
 * global) rather than a constant, because the width at which a board stops
 * working is a property of that board: a six-card grid is unreadable at a width
 * a two-card one is fine at, and someone who works in a half-screen window
 * wants the stacked layout well before a phone would (#316). Callers pass the
 * effective value; the default is only for the handful of call sites that have
 * no settings to hand.
 */
export function isNarrowWidth(width: number, threshold = NARROW_WIDTH_DEFAULT): boolean {
	// A zero/negative width is a pane that hasn't been laid out yet. Answering
	// "narrow" there would stack the board for one frame and then reflow it, so
	// an unmeasured board keeps the free-form layout until it has a real width.
	return width > 0 && width <= threshold;
}

/**
 * Reading order on the desktop board: top to bottom, and left to right within
 * a row.
 *
 * Rows are found by walking the cards in vertical order and keeping each one
 * that starts within {@link ROW_BAND} of the row's own top. Deliberately not a
 * `floor(fy / ROW_BAND)` bucket, which sounds equivalent and is not: bucketing
 * puts a fixed grid over the board, so two cards four pixels apart land in
 * different rows whenever that grid line happens to fall between them — and a
 * row assembled by dragging is exactly a set of cards a few pixels apart at an
 * arbitrary height. Measuring from the row's own top has no grid to straddle.
 */
function readingOrder(cards: DashboardCard[]): DashboardCard[] {
	const top = (card: DashboardCard) => card.fy ?? 0;
	const left = (card: DashboardCard) => card.fx ?? 0;

	const vertical = [...cards].sort((a, b) => top(a) - top(b) || left(a) - left(b));

	const rows: DashboardCard[][] = [];
	let rowTop = 0;
	for (const card of vertical) {
		if (rows.length === 0 || top(card) - rowTop > ROW_BAND) {
			rows.push([card]);
			rowTop = top(card);
		} else {
			rows[rows.length - 1].push(card);
		}
	}

	return rows.flatMap((row) => row.sort((a, b) => left(a) - left(b) || top(a) - top(b)));
}

/**
 * The cards a narrow board shows, in the order it shows them.
 *
 * Cards marked `mobile.hidden` are dropped. The rest are placed by
 * `mobile.order` where it is set and by their reading-order position where it
 * isn't — the two share one number line, so `order: 0` pulls a card to the top
 * and a large `order` pushes it to the bottom without having to number every
 * other card. Ties keep reading order.
 *
 * `includeHidden` keeps the hidden ones in the list, in the place they would
 * hold if they were shown. That is what arranging a stacked board asks for: a
 * card hidden from a phone can only be brought back from a control that is
 * itself on the phone, so the arrange view has to be able to show what the
 * rendered board deliberately does not. Nothing outside arrange mode passes it.
 */
export function stackedCards(
	cards: DashboardCard[],
	opts: { includeHidden?: boolean } = {},
): DashboardCard[] {
	return readingOrder(cards.filter((card) => opts.includeHidden || !card.mobile?.hidden))
		.map((card, index) => ({
			card,
			index,
			key: card.mobile?.order ?? index,
			// An explicit order wins a tie against a derived one. A card asking for
			// position 0 means it; the card that happens to read first there is only
			// defaulting, and would otherwise keep the place it was asked to give up.
			asked: card.mobile?.order != null ? 0 : 1,
		}))
		.sort((a, b) => a.key - b.key || a.asked - b.asked || a.index - b.index)
		.map((entry) => entry.card);
}

/** The height, in pixels, a card gets in the stacked layout. */
export function stackedHeight(card: DashboardCard): number {
	const asked = card.mobile?.height;
	if (asked != null && Number.isFinite(asked)) {
		return Math.max(MIN_H_PX, Math.round(asked));
	}
	const derived = Math.round(card.fh ?? STACK_HEIGHT_DEFAULT);
	return Math.min(Math.max(derived, MIN_H_PX), STACK_HEIGHT_MAX);
}

/**
 * Watch an element's width and report, on every resize, which layout that width
 * now calls for. Returns a disposer.
 *
 * `narrowAt` is asked each time rather than the threshold being captured once,
 * and the answer is reported rather than compared against a remembered one.
 * Both because the threshold is now a setting: an observer holding its own
 * "last" state would go stale the moment the setting changed under it, and
 * would then sit on the next real crossing — the board would be resized past
 * the new threshold and stay in the old layout, which is exactly the bug this
 * whole feature exists to fix.
 *
 * That makes it the caller's job not to loop: this watches an element inside
 * the view the callback rebuilds, so the callback must compare against the
 * layout it last rendered and do nothing when they agree. `HomeView.trackWidth`
 * does, against `narrowAtRender`.
 */
export function observeNarrowWidth(
	el: HTMLElement,
	narrowAt: (width: number) => boolean,
	onChange: (narrow: boolean) => void,
): () => void {
	// `clientWidth`, not the entry's `contentRect`: the two differ by the
	// element's padding, and `HomeView.isNarrow` measures with `clientWidth`. A
	// stateless observer that measured the other one could report "narrow" for a
	// width the render then judges wide, and the two would trade renders on every
	// resize. The entry is only the signal that a measurement is worth taking.
	const observer = new ResizeObserver(() => onChange(narrowAt(el.clientWidth)));
	observer.observe(el);
	return () => observer.disconnect();
}

/**
 * Move a card one place up or down the stack, and return whether it moved.
 *
 * The new sequence is written out as explicit `mobile.order` values on every
 * visible card rather than only on the two that swapped. Stacking order is
 * otherwise derived from the desktop geometry, so writing one card's order
 * would leave the rest to be re-derived and the move could partly undo itself
 * the next time the board is dragged about. Numbering the whole stack makes the
 * order someone arranged the thing that holds.
 *
 * Hidden cards are left out and left alone: they are not in the stack, so they
 * have no position in it to renumber. `includeHidden` — what arrange mode
 * passes, where the hidden cards are on screen and movable — puts them back in
 * the same one line, so a card moved past a hidden one keeps the place it was
 * dragged to and the hidden card comes back where it was left rather than
 * wherever the desktop geometry would re-derive it.
 */
export function moveStacked(
	cards: DashboardCard[],
	card: DashboardCard,
	delta: -1 | 1,
	opts: { includeHidden?: boolean } = {},
): boolean {
	const order = stackedCards(cards, opts);
	const from = order.indexOf(card);
	const to = from + delta;
	if (from < 0 || to < 0 || to >= order.length) return false;

	order.splice(to, 0, ...order.splice(from, 1));
	order.forEach((entry, index) => {
		entry.mobile = { ...entry.mobile, order: index };
	});
	return true;
}
