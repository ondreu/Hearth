/**
 * Back gestures in the settings pane (#413).
 *
 * The pane has two levels — an index of categories and one category's own page
 * — and the only way back used to be the link the page header draws. Escape and
 * the mouse's back button went to Obsidian instead: Escape closes the settings
 * window, the back button walks the note history.
 *
 * This module owns the rule for when the pane should take such a gesture and
 * return to the index. It is pure, and reads the event target structurally
 * rather than touching the DOM, so the rule is covered by the node test suite;
 * where the listener sits and what it cancels is `settings.ts`'s business.
 */

/** A gesture that may mean "leave this page". */
export type BackGesture = { kind: "key"; key: string } | { kind: "mouse"; button: number };

/** Keys that mean "go back": Escape, plus the dedicated Back key some
 * keyboards send (Chromium calls it `BrowserBack`; `GoBack` is the legacy
 * name). */
const BACK_KEYS = new Set(["Escape", "BrowserBack", "GoBack"]);

/** Input types that take no typed text, so Escape is not "cancel this edit"
 * for them and the pane may use it. */
const NON_TEXT_INPUT_TYPES = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"radio",
	"range",
	"reset",
	"submit",
]);

/** What {@link isEditableTarget} reads off an event target. All optional, so a
 * plain object satisfies it in a test and anything unexpected reads as "not
 * editable" instead of throwing. */
interface EditableCandidate {
	tagName?: string | null;
	type?: string | null;
	isContentEditable?: boolean;
}

/**
 * True for the controls that already give Escape a meaning of their own: a text
 * field cancels or leaves the edit, a `<select>` closes its dropdown. Taking the
 * key there would throw away what the user was in the middle of doing.
 *
 * Checkboxes, sliders and buttons are not text entry — Escape means nothing to
 * them, so the pane is free to treat it as "back".
 */
export function isEditableTarget(target: unknown): boolean {
	if (!target || typeof target !== "object") return false;
	const el = target as EditableCandidate;
	const tag = el.tagName?.toUpperCase();
	if (tag === "TEXTAREA" || tag === "SELECT") return true;
	// An `<input>` with no type attribute reports "text" in a real document.
	if (tag === "INPUT") return !NON_TEXT_INPUT_TYPES.has((el.type ?? "text").toLowerCase());
	return el.isContentEditable === true;
}

/**
 * Where a back gesture should land, or `null` when the pane must leave the
 * gesture alone.
 *
 * Only a category page can go back. On the index the gesture keeps whatever
 * meaning it has in Obsidian — Escape closes the settings window, the mouse
 * button walks the note history — which is what every other pane does.
 *
 * `editable` is the caller's answer to {@link isEditableTarget}. It applies to
 * keys only: a mouse button pressed over a text field is still a back gesture.
 */
export function backGestureTarget(
	route: string,
	gesture: BackGesture,
	editable = false,
): "index" | null {
	if (route === "index") return null;
	if (gesture.kind === "mouse") return gesture.button === 3 ? "index" : null;
	if (editable) return null;
	return BACK_KEYS.has(gesture.key) ? "index" : null;
}

/** What {@link isBareTarget} reads off an event target. */
interface BareCandidate {
	tagName?: string | null;
	nodeType?: number;
}

/**
 * True when an event landed on the bare document — `<body>`, `<html>` or the
 * document itself — which is where a keystroke goes when nothing has focus.
 *
 * That is the normal state of a category page right after it opens: the index
 * row that was clicked to get there had `tabindex="0"`, so it took focus, and
 * the re-render removed it. Chromium then drops focus to the body, and a
 * keystroke's path never passes through the pane at all.
 */
export function isBareTarget(target: unknown): boolean {
	if (!target || typeof target !== "object") return false;
	const el = target as BareCandidate;
	const tag = el.tagName?.toUpperCase();
	if (tag) return tag === "BODY" || tag === "HTML";
	return el.nodeType === 9;
}

/** What {@link isInsideShell} reads off a node. */
interface ShellCandidate {
	contains?: (node: unknown) => boolean;
}

/** True when `target` sits inside `shell`, or is `shell` itself. Structural, so
 * a plain object stands in for the DOM in the node test suite. */
export function isInsideShell(target: unknown, shell: unknown): boolean {
	if (!target || typeof target !== "object") return false;
	const node = shell as ShellCandidate | null;
	if (typeof node?.contains !== "function") return false;
	return node.contains(target);
}

/** A gesture as the pane sees it: where the event landed, relative to the pane
 * and to the settings window drawn around it. */
export interface PaneGesture {
	kind: BackGesture["kind"];
	/** The event's path runs through the pane. */
	inPane: boolean;
	/** The event landed inside the settings window's shell — the modal the pane
	 * is drawn in — without being a text field. */
	inShell: boolean;
	/** The pane is still mounted and visible. */
	paneShown: boolean;
}

/**
 * Is this gesture the pane's to answer?
 *
 * A mouse event always lands on whatever is under the pointer, so a press
 * outside the pane belongs to Obsidian. A keystroke is not so lucky: it lands
 * on whatever holds focus, and just after a category page opens nothing in the
 * pane does — the row that was clicked is gone with the re-render — so the
 * event goes to the document body and its path never touches the pane.
 * Checking only the path is what made Escape work only once a control had been
 * touched, i.e. once focus was back inside the pane (#413).
 *
 * `paneShown` keeps a binding that outlived its pane from answering: when
 * another plugin's settings tab has the window, this pane's Escape is not the
 * user's Escape.
 */
export function gestureIsPanesOwn(gesture: PaneGesture): boolean {
	if (gesture.inPane) return true;
	if (gesture.kind !== "key") return false;
	return gesture.inShell && gesture.paneShown;
}
