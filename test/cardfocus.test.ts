import { describe, expect, it, vi } from "vitest";
import { createFocusHold, focusHasLeft, holdsTextEntryFocus } from "../src/cardfocus";

/**
 * The focus guard that keeps a vault-driven redraw from destroying the element
 * holding the caret (#212), tested without a DOM: the predicates run against
 * minimal element stand-ins, the hold/release machine is pure.
 */

/** A stand-in for the card body / view container: it owns a document whose
 * `activeElement` we set per case, and reports containment for the elements
 * listed as its descendants. */
function root(active: Element | null, inside: Element[] = []): HTMLElement {
	const el = {
		ownerDocument: { activeElement: active },
		contains: (other: Element | null) => other === el || inside.includes(other as Element),
	};
	return el as unknown as HTMLElement;
}

/** A stand-in for a focused element: only `matches` is ever called on it. */
function el(selectorsItMatches: string[] = []): Element {
	return {
		matches: (sel: string) => selectorsItMatches.some((s) => sel.includes(s)),
	} as unknown as Element;
}

const input = () => el(["input"]);
const textarea = () => el(["textarea"]);
const editable = () => el(["contenteditable"]);
const button = () => el([]);

describe("holdsTextEntryFocus", () => {
	it("holds for a text-entry element inside the card — the reported case", () => {
		for (const focused of [input(), textarea(), editable()]) {
			expect(holdsTextEntryFocus(root(focused, [focused]))).toBe(true);
		}
	});

	it("does not hold for a focused non-text element inside the card", () => {
		const focused = button();
		expect(holdsTextEntryFocus(root(focused, [focused]))).toBe(false);
	});

	it("does not hold for an input focused somewhere else on the board", () => {
		expect(holdsTextEntryFocus(root(input(), []))).toBe(false);
	});

	it("does not hold with nothing focused, or with the card itself focused", () => {
		expect(holdsTextEntryFocus(root(null))).toBe(false);
		// A card body that carries focus itself (a tabindex, a scroll container)
		// is not a field anyone is typing into, however it answers `matches`.
		const self: Record<string, unknown> = { contains: () => true, matches: () => true };
		self.ownerDocument = { activeElement: self };
		expect(holdsTextEntryFocus(self as unknown as HTMLElement)).toBe(false);
	});
});

describe("focusHasLeft", () => {
	it("is true only once focus sits outside the card", () => {
		const inside = input();
		expect(focusHasLeft(root(inside, [inside]))).toBe(false);
		expect(focusHasLeft(root(el(), []))).toBe(true);
		expect(focusHasLeft(root(null))).toBe(true);
	});

	it("keeps a held redraw held while focus moves to a button inside the card", () => {
		// Tearing that button out between its focusout and its click would
		// swallow the click, so "not typing any more" is not enough to flush.
		const btn = button();
		expect(focusHasLeft(root(btn, [btn]))).toBe(false);
	});
});

describe("createFocusHold", () => {
	it("draws immediately when nothing is being typed into", () => {
		const draw = vi.fn();
		const hold = createFocusHold(draw);
		hold.request(false);
		expect(draw).toHaveBeenCalledTimes(1);
	});

	it("holds while typing and catches up once — however many events were held", () => {
		const draw = vi.fn();
		const hold = createFocusHold(draw);
		hold.request(true);
		hold.request(true);
		hold.request(true);
		expect(draw).not.toHaveBeenCalled();
		hold.release(true);
		expect(draw).toHaveBeenCalledTimes(1);
	});

	it("stays held while focus has not left, and does not draw twice on a second release", () => {
		const draw = vi.fn();
		const hold = createFocusHold(draw);
		hold.request(true);
		hold.release(false);
		expect(draw).not.toHaveBeenCalled();
		hold.release(true);
		hold.release(true);
		expect(draw).toHaveBeenCalledTimes(1);
	});

	it("does not draw on focusout when nothing was held", () => {
		const draw = vi.fn();
		createFocusHold(draw).release(true);
		expect(draw).not.toHaveBeenCalled();
	});

	it("clears the held redraw when a live one runs, so leaving does not redraw again", () => {
		const draw = vi.fn();
		const hold = createFocusHold(draw);
		hold.request(true); // typed into, held
		hold.request(false); // focus moved on, a later event drew live
		expect(draw).toHaveBeenCalledTimes(1);
		hold.release(true);
		expect(draw).toHaveBeenCalledTimes(1);
	});
});
