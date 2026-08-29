import type { Component } from "obsidian";
import type { HomeView } from "./view";

/**
 * Swipe left/right across a narrow board to move between dashboards.
 *
 * The gesture is cheap to add and easy to get wrong, because Obsidian's own
 * mobile UI already owns horizontal swipes: a drag from either screen edge
 * opens the left or right sidebar. A board-wide swipe handler that ignored
 * that would make the sidebars unreachable from the home view — trading one
 * navigation for another. So the gesture is deliberately narrow:
 *
 *  - touch pointers only, so a trackpad's inertial horizontal scroll on a
 *    narrow desktop pane never switches boards;
 *  - one finger only, so a pinch-zoom is never read as a swipe;
 *  - it never starts inside {@link EDGE_GUARD} of either screen edge, which is
 *    where Obsidian's sidebar gestures begin;
 *  - it never starts inside anything that scrolls horizontally itself (a Bases
 *    table, a wide code block, a scrolling launchpad), because there the swipe
 *    belongs to that element;
 *  - and it must be clearly horizontal and clearly long, or it is a scroll.
 *
 * Everything is decided when the finger lifts. Nothing is captured, nothing is
 * preventDefault-ed and no listener runs during the gesture beyond recording a
 * position, so vertical scrolling behaves exactly as it would without this.
 */

/** How close to the screen edge a swipe may not start, in pixels. Obsidian's
 * sidebar gestures live in this band. */
const EDGE_GUARD = 40;

/** How far a swipe must travel horizontally to count, in pixels. */
const MIN_DISTANCE = 72;

/** How much more horizontal than vertical the travel must be. A scroll that
 * drifts sideways is still a scroll. */
const DOMINANCE = 2;

/** How long a swipe may take, in milliseconds. Past this the finger was resting
 * on the screen, not swiping across it. */
const MAX_DURATION = 800;

/** Whether anything between `target` and `root` scrolls horizontally, in which
 * case the swipe is that element's, not the board's. */
function insideHorizontalScroller(target: EventTarget | null, root: HTMLElement): boolean {
	let el = target instanceof HTMLElement ? target : null;
	while (el && el !== root) {
		if (el.scrollWidth > el.clientWidth + 1) {
			const overflow = getComputedStyle(el).overflowX;
			if (overflow === "auto" || overflow === "scroll") return true;
		}
		el = el.parentElement;
	}
	return false;
}

/** Register the swipe gesture on `el`. No-op unless there is somewhere to swipe
 * to and the gesture is switched on. */
export function enableDashboardSwipe(
	view: HomeView,
	el: HTMLElement,
	component: Component,
): void {
	const s = view.plugin.settings;
	// Arranging is a drag-heavy mode where a stray horizontal drag switching the
	// board would lose the placement someone is in the middle of.
	if (!s.swipeDashboards || s.dashboards.length < 2 || view.arrangeMode) return;

	let start: { x: number; y: number; at: number; id: number } | null = null;

	component.registerDomEvent(el, "pointerdown", (e: PointerEvent) => {
		if (e.pointerType !== "touch") return;
		// A second finger cancels whatever the first one was doing rather than
		// leaving a half-tracked gesture to complete on its own.
		if (start) {
			start = null;
			return;
		}
		const width = el.ownerDocument.defaultView?.innerWidth ?? 0;
		if (e.clientX < EDGE_GUARD || (width > 0 && e.clientX > width - EDGE_GUARD)) return;
		if (insideHorizontalScroller(e.target, el)) return;
		start = { x: e.clientX, y: e.clientY, at: e.timeStamp, id: e.pointerId };
	});

	const cancel = (e: PointerEvent) => {
		if (start?.id === e.pointerId) start = null;
	};
	component.registerDomEvent(el, "pointercancel", cancel);

	component.registerDomEvent(el, "pointerup", (e: PointerEvent) => {
		const from = start;
		start = null;
		if (!from || from.id !== e.pointerId) return;
		if (e.timeStamp - from.at > MAX_DURATION) return;

		const dx = e.clientX - from.x;
		const dy = e.clientY - from.y;
		if (Math.abs(dx) < MIN_DISTANCE) return;
		if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

		// Swiping left moves to the next board, matching how every paged mobile
		// UI reads: the content follows the finger.
		const boards = view.plugin.settings.dashboards;
		const current = boards.findIndex((d) => d.id === view.plugin.settings.activeDashboardId);
		if (current < 0) return;
		const next = current + (dx < 0 ? 1 : -1);
		// Deliberately not wrapping. On a board with no switcher visible, wrapping
		// makes the two ends of the list indistinguishable and leaves no way to
		// tell you have reached one.
		if (next < 0 || next >= boards.length) return;
		view.plugin.setActiveDashboard(boards[next].id);
	});
}
