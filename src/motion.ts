/**
 * When the board is worth animating at all.
 *
 * The performance tier (see PerformanceTier in types.ts) decides how much motion
 * a board *has*; this module decides when that motion is worth paying for, which
 * is a different question with a different answer minute to minute. Both gates
 * here amount to the same observation: an animation nobody can see costs exactly
 * as much as one somebody is watching.
 *
 * Two gates, independent of each other:
 *
 * - **The window gate** (`pauseWhenUnfocused`). A Hearth tab the workspace has
 *   hidden already costs nothing — Obsidian takes an inactive leaf out of layout,
 *   and a subtree that isn't laid out isn't animated. The gap is a *visible*
 *   Hearth tab in a window nobody is using: beside a browser, on a second
 *   monitor, behind another app. Measured at full price.
 *
 * - **The element gate.** A card scrolled below the fold, or clipped away by a
 *   fit-to-page board's `overflow: hidden`, also pays full price: 240 style
 *   recalcs and 240 layouts per 4 seconds in the harness, against 0 for the same
 *   board hidden by `display: none`.
 *
 * Both gates *freeze* rather than clear: the CSS they trigger sets
 * `animation-play-state: paused`, not `animation: none`. That matters twice
 * over — it measures at 0 style recalcs (so the saving is the whole saving), and
 * an animation that resumes from where it stopped has no visible jump, which
 * `animation: none` would produce every time a window regained focus.
 *
 * See docs/performance/macos-power-investigation.md for the measurements.
 */
import { type Component, Platform } from "obsidian";
import { motionAllowed } from "./types";
import type { HomeView } from "./view";

/** Set on the view root while the window gate is closed. */
const VIEW_PAUSED = "hearth-motion-paused";

/** Set on a card while the element gate is closed. */
const CARD_PAUSED = "is-motion-paused";

/**
 * How far outside the viewport a card still counts as visible.
 *
 * Generous on purpose: the point is to catch a card that is *parked* off screen
 * for minutes, not to shave a frame off one that is halfway into view. A tight
 * margin would toggle the class repeatedly through every scroll, which costs
 * style invalidation of its own and would make a card flicker between moving and
 * frozen as it crosses the edge.
 */
const VISIBILITY_MARGIN = "250px";

/**
 * Hold the board's animation while its window is not the one being used.
 *
 * Registered per view rather than once globally, so a board in a popout window
 * gates on *that* window's focus rather than the main one's, and so every
 * listener tears down with the render component.
 *
 * No-op when the setting is off, and when the tier has already stopped the board
 * moving — there is nothing left to pause.
 */
export function gateMotionOnWindow(view: HomeView, component: Component): void {
	const settings = view.plugin.settings;
	if (!settings.pauseWhenUnfocused || !motionAllowed(settings)) return;

	const root = view.contentEl;
	const doc = root.ownerDocument;
	const win = doc.defaultView;
	if (!win) return;

	const apply = () => {
		// `hasFocus` is deliberately desktop-only. On mobile there is no
		// second window to lose focus to, the OS suspends a backgrounded app
		// anyway, and the on-screen keyboard moves focus around in ways that
		// would freeze the board while the reader is plainly looking at it.
		const active = !doc.hidden && (Platform.isMobile || doc.hasFocus());
		root.toggleClass(VIEW_PAUSED, !active);
	};

	component.registerDomEvent(doc, "visibilitychange", apply);
	component.registerDomEvent(win, "focus", apply);
	component.registerDomEvent(win, "blur", apply);
	apply();
}

/**
 * Hold each card's animation while that card is off screen.
 *
 * One observer for the whole board rather than one per card: a busy board can
 * carry thirty cards, and thirty observers watching the same scroll container is
 * itself a cost worth not paying.
 *
 * Applied to every card, not just the ones known to animate. The class does
 * nothing to a card with no animation, and the alternative — a list of "these
 * kinds move" — is exactly the kind of list that goes stale the first time
 * somebody adds an animation to a card kind that isn't on it.
 *
 * No-op when the tier has already stopped the board moving.
 */
export function gateCardMotionOnVisibility(
	view: HomeView,
	gridEl: HTMLElement,
	component: Component,
): void {
	if (!motionAllowed(view.plugin.settings)) return;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				(entry.target as HTMLElement).toggleClass(CARD_PAUSED, !entry.isIntersecting);
			}
		},
		{ root: null, rootMargin: VISIBILITY_MARGIN },
	);

	for (const card of Array.from(
		gridEl.querySelectorAll<HTMLElement>(":scope > .hearth-card"),
	)) {
		observer.observe(card);
	}

	component.register(() => observer.disconnect());
}
