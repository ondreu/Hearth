import type { Component } from "obsidian";

/**
 * Keeping an event-driven redraw from destroying the element that holds the
 * caret (#212).
 *
 * A card can render focusable content it doesn't own — anything a plugin puts
 * inside an embed — and that content is often what writes to the very file the
 * card watches, so typing into it schedules the redraw that then wipes it. The
 * card's own focusable pieces were already safe (the editable embed's textarea
 * skips its sync while focused, the tasks card's inline-add form waits for a
 * real `focusout`); this generalises that rule to the whole card body, and to
 * the board-level live refresh one level up.
 *
 * The decision is split so it can be unit-tested without a DOM: {@link
 * createFocusHold} is the pure hold/release state machine, and the predicates
 * below are the only part that touches elements.
 */

/** Elements a redraw must not pull out from under the user while they hold
 * focus: the native text-entry controls plus contenteditable hosts (Obsidian's
 * own live-preview editors, and whatever a plugin renders into an embed). */
const TEXT_ENTRY_SELECTOR =
	"input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** The focused element in the document `root` actually lives in. Read through
 * `ownerDocument` rather than the global `document` so a board in a popped-out
 * window is judged against its own document. */
function activeIn(root: HTMLElement): Element | null {
	return root.ownerDocument?.activeElement ?? null;
}

/** True while a text-entry element inside `root` has focus — the one state in
 * which redrawing would take the caret with it. */
export function holdsTextEntryFocus(root: HTMLElement): boolean {
	const active = activeIn(root);
	if (!active || active === root || !root.contains(active)) return false;
	return active.matches(TEXT_ENTRY_SELECTOR);
}

/** True once focus sits outside `root` entirely. Deliberately stricter than
 * "no longer typing": a held redraw stays held while focus moves to a button
 * *inside* the card, because tearing that button out between its `focusout`
 * and its `click` would swallow the click. */
export function focusHasLeft(root: HTMLElement): boolean {
	const active = activeIn(root);
	return !active || !root.contains(active);
}

/**
 * The pure half: a redraw that can be held. `request` runs the redraw unless
 * the user is typing, in which case it is remembered; `release` runs a
 * remembered redraw once focus has left. Only ever one catch-up draw, however
 * many events were held.
 */
export function createFocusHold(draw: () => void): {
	request(typing: boolean): void;
	release(left: boolean): void;
} {
	let pending = false;
	return {
		request(typing: boolean): void {
			if (typing) {
				pending = true;
				return;
			}
			pending = false;
			draw();
		},
		release(left: boolean): void {
			if (!pending || !left) return;
			pending = false;
			draw();
		},
	};
}

/**
 * Wrap a redraw so it never fires while a field inside `root` is being typed
 * into: it is held, and runs once — as a single catch-up — after focus leaves.
 * Returns the wrapped redraw. `component` scopes the listener to the render
 * that owns `root`.
 *
 * Only for redraws the *vault* asks for. A redraw the user asked for (the
 * embed's view switcher) must still be immediate, so it keeps calling `draw`.
 */
export function deferRedrawWhileTyping(
	root: HTMLElement,
	draw: () => void,
	component: Component,
): () => void {
	const hold = createFocusHold(draw);
	component.registerDomEvent(root, "focusout", () => {
		// `focusout` fires before the next element takes focus, and moving
		// between two fields inside the card is not leaving it — so decide on the
		// next tick, from where focus actually landed. Same shape as the tasks
		// card's inline-add form.
		window.setTimeout(() => hold.release(focusHasLeft(root)), 0);
	});
	return () => hold.request(holdsTextEntryFocus(root));
}
