import { describe, expect, it } from "vitest";
import {
	isNarrowWidth,
	moveStacked,
	ROW_BAND,
	STACK_HEIGHT_DEFAULT,
	STACK_HEIGHT_MAX,
	stackedCards,
	stackedHeight,
} from "../src/narrow";
import { MIN_H_PX } from "../src/grid";
import {
	clampNarrowWidth,
	DEFAULT_SETTINGS,
	effectiveNarrowWidth,
	NARROW_WIDTH_DEFAULT,
	NARROW_WIDTH_MAX,
	NARROW_WIDTH_MIN,
} from "../src/types";
import type { Dashboard, DashboardCard, HomeSettings } from "../src/types";

/**
 * The stacked layout a narrow board reflows to. Everything under test here is
 * pure: it reads a board's free-form geometry and answers with an order and a
 * set of heights, never touching the geometry itself — which is the property
 * that keeps a board opened on a phone from reshaping itself for the desktop.
 */

function card(id: string, overrides: Partial<DashboardCard> = {}): DashboardCard {
	return {
		id,
		kind: "text",
		x: 0,
		y: 0,
		w: 2,
		h: 2,
		fx: 0,
		fy: 0,
		fw: 0.25,
		fh: 200,
		...overrides,
	};
}

const ids = (cards: DashboardCard[]) => cards.map((c) => c.id);

describe("isNarrowWidth", () => {
	it("takes the threshold itself as narrow", () => {
		expect(isNarrowWidth(NARROW_WIDTH_DEFAULT)).toBe(true);
		expect(isNarrowWidth(NARROW_WIDTH_DEFAULT + 1)).toBe(false);
	});

	it("treats an unmeasured pane as wide", () => {
		// A pane that has not been laid out reports 0. Answering "narrow" there
		// would stack the board for one frame and then reflow it.
		expect(isNarrowWidth(0)).toBe(false);
		expect(isNarrowWidth(-10)).toBe(false);
		// Including when the threshold is raised to the top of its range: an
		// unmeasured pane is not "narrower than anything", it is unknown.
		expect(isNarrowWidth(0, NARROW_WIDTH_MAX)).toBe(false);
	});

	it("calls a phone narrow at the widths phones actually report", () => {
		// The default has to clear the phone, not the readable card width: a
		// device that misses it gets the free-form layout with no way to reach
		// the stacked one from the phone itself. An Android phone at a device
		// pixel ratio of 2 reports ~608px for a 1216px display, which the old
		// 600px default called wide — a desktop board on a phone screen (#326).
		expect(isNarrowWidth(608)).toBe(true);
		expect(isNarrowWidth(640)).toBe(true);
		expect(isNarrowWidth(680)).toBe(true);
		// …while a half-screen desktop window is still free-form, which is the
		// layout someone with that much width is asking for.
		expect(isNarrowWidth(760)).toBe(false);
		expect(isNarrowWidth(960)).toBe(false);
	});

	it("measures against the threshold it is given", () => {
		// The point of the setting (#316): a half-screen desktop window is wide
		// by the default and narrow once someone says it is.
		expect(isNarrowWidth(960)).toBe(false);
		expect(isNarrowWidth(960, 1000)).toBe(true);
		expect(isNarrowWidth(960, 960)).toBe(true);
		expect(isNarrowWidth(960, 959)).toBe(false);
	});
});

describe("clampNarrowWidth", () => {
	it("brings a stored value into range", () => {
		expect(clampNarrowWidth(NARROW_WIDTH_MIN - 100)).toBe(NARROW_WIDTH_MIN);
		expect(clampNarrowWidth(NARROW_WIDTH_MAX + 5000)).toBe(NARROW_WIDTH_MAX);
		expect(clampNarrowWidth(800)).toBe(800);
		expect(clampNarrowWidth(800.4)).toBe(800);
	});

	it("falls back to the default rather than to a bound", () => {
		// Settings saved before the threshold was customizable have no key here,
		// and clamping `undefined` to a bound would pick an extreme nobody asked
		// for. The default such a vault lands on is the current one, not the
		// width the threshold was once hard-coded to (see the phone-width case
		// below) — a vault that never chose a threshold follows Hearth's answer.
		expect(clampNarrowWidth(undefined)).toBe(NARROW_WIDTH_DEFAULT);
		expect(clampNarrowWidth("600")).toBe(NARROW_WIDTH_DEFAULT);
		expect(clampNarrowWidth(Number.NaN)).toBe(NARROW_WIDTH_DEFAULT);
	});
});

describe("effectiveNarrowWidth", () => {
	const settings = (dash: Partial<Dashboard>, global: number): HomeSettings => ({
		...DEFAULT_SETTINGS,
		narrowWidth: global,
		activeDashboardId: "a",
		dashboards: [{ id: "a", name: "A", cards: [], ...dash }],
	});

	it("prefers the board's own threshold", () => {
		expect(effectiveNarrowWidth(settings({ narrowWidth: 900 }, 600))).toBe(900);
		expect(effectiveNarrowWidth(settings({}, 700))).toBe(700);
	});

	it("clamps whatever it finds", () => {
		// An imported or hand-edited board can hold a number the slider could
		// never produce; the board is still drawn at a width that means something.
		expect(effectiveNarrowWidth(settings({ narrowWidth: 99999 }, 600))).toBe(
			NARROW_WIDTH_MAX,
		);
		expect(effectiveNarrowWidth(settings({}, 1))).toBe(NARROW_WIDTH_MIN);
	});
});

describe("stackedCards", () => {
	it("reads the board top to bottom", () => {
		const cards = [
			card("bottom", { fy: 400 }),
			card("top", { fy: 0 }),
			card("middle", { fy: 200 }),
		];
		expect(ids(stackedCards(cards))).toEqual(["top", "middle", "bottom"]);
	});

	it("reads a row left to right even when its cards are not pixel-aligned", () => {
		// Cards dragged into a row land a few pixels apart. Without the row band
		// the card sitting two pixels higher would win the whole comparison, so a
		// row could stack right, left, middle.
		const cards = [
			card("right", { fx: 0.7, fy: 100 }),
			card("left", { fx: 0.05, fy: 100 + ROW_BAND - 1 }),
			card("centre", { fx: 0.4, fy: 103 }),
		];
		expect(ids(stackedCards(cards))).toEqual(["left", "centre", "right"]);
	});

	it("starts a new row once the gap is a real one", () => {
		const cards = [
			card("below", { fx: 0.05, fy: ROW_BAND * 2 }),
			card("above", { fx: 0.7, fy: 0 }),
		];
		expect(ids(stackedCards(cards))).toEqual(["above", "below"]);
	});

	it("drops hidden cards", () => {
		const cards = [
			card("shown", { fy: 0 }),
			card("gone", { fy: 100, mobile: { hidden: true } }),
			card("also-shown", { fy: 200 }),
		];
		expect(ids(stackedCards(cards))).toEqual(["shown", "also-shown"]);
	});

	it("keeps hidden cards in place when asked for them", () => {
		// What arranging a stacked board shows: the hidden card is on screen, in
		// the position it would hold if it were shown, so it can be brought back.
		const cards = [
			card("shown", { fy: 0 }),
			card("gone", { fy: 100, mobile: { hidden: true } }),
			card("also-shown", { fy: 200 }),
		];
		expect(ids(stackedCards(cards, { includeHidden: true }))).toEqual([
			"shown",
			"gone",
			"also-shown",
		]);
	});

	it("places an explicit order on the same number line as the derived one", () => {
		// The clock is last on the board and asks to come first; everything else
		// keeps its reading-order position around it.
		const cards = [
			card("a", { fy: 0 }),
			card("b", { fy: 100 }),
			card("clock", { fy: 900, mobile: { order: 0 } }),
		];
		expect(ids(stackedCards(cards))).toEqual(["clock", "a", "b"]);
	});

	it("sends a card to the end on a large order, without numbering the others", () => {
		const cards = [
			card("heavy", { fy: 0, mobile: { order: 99 } }),
			card("a", { fy: 100 }),
			card("b", { fy: 200 }),
		];
		expect(ids(stackedCards(cards))).toEqual(["a", "b", "heavy"]);
	});

	it("breaks a tie on reading order", () => {
		const cards = [
			card("second", { fy: 300, mobile: { order: 1 } }),
			card("first", { fy: 0, mobile: { order: 1 } }),
		];
		expect(ids(stackedCards(cards))).toEqual(["first", "second"]);
	});

	it("never writes to the geometry it reads", () => {
		const cards = [card("a", { fy: 300, fx: 0.5 }), card("b", { fy: 0 })];
		const before = cards.map((c) => ({ ...c }));
		stackedCards(cards);
		expect(cards.map((c) => ({ ...c }))).toEqual(before);
	});
});

describe("stackedHeight", () => {
	it("keeps a card's own height", () => {
		expect(stackedHeight(card("a", { fh: 240 }))).toBe(240);
	});

	it("caps a derived height so one card can't fill the screen", () => {
		expect(stackedHeight(card("a", { fh: 900 }))).toBe(STACK_HEIGHT_MAX);
	});

	it("does not cap a height that was asked for", () => {
		// The cap guesses at what a full-width card needs; an explicit height has
		// already answered that question.
		expect(stackedHeight(card("a", { fh: 900, mobile: { height: 800 } }))).toBe(800);
	});

	it("floors every height at the card minimum", () => {
		expect(stackedHeight(card("a", { fh: 4 }))).toBe(MIN_H_PX);
		expect(stackedHeight(card("a", { mobile: { height: 0 } }))).toBe(MIN_H_PX);
	});

	it("falls back to a default when the card has no stored height", () => {
		expect(stackedHeight(card("a", { fh: undefined }))).toBe(STACK_HEIGHT_DEFAULT);
	});
});

describe("moveStacked", () => {
	it("moves a card one place and numbers the whole stack", () => {
		const cards = [card("a", { fy: 0 }), card("b", { fy: 100 }), card("c", { fy: 200 })];
		expect(moveStacked(cards, cards[2], -1)).toBe(true);
		expect(ids(stackedCards(cards))).toEqual(["a", "c", "b"]);
		// Numbering every card is what makes the move hold: leaving the rest to be
		// re-derived would let the next drag on the desktop board undo it.
		expect(cards.map((c) => c.mobile?.order)).toEqual([0, 2, 1]);
	});

	it("refuses to move past either end", () => {
		const cards = [card("a", { fy: 0 }), card("b", { fy: 100 })];
		expect(moveStacked(cards, cards[0], -1)).toBe(false);
		expect(moveStacked(cards, cards[1], 1)).toBe(false);
		expect(cards.every((c) => c.mobile === undefined)).toBe(true);
	});

	it("ignores hidden cards rather than renumbering them", () => {
		const cards = [
			card("a", { fy: 0 }),
			card("hidden", { fy: 100, mobile: { hidden: true } }),
			card("c", { fy: 200 }),
		];
		expect(moveStacked(cards, cards[2], -1)).toBe(true);
		expect(ids(stackedCards(cards))).toEqual(["c", "a"]);
		expect(cards[1].mobile).toEqual({ hidden: true });
	});

	it("counts hidden cards when arranging with them on screen", () => {
		const cards = [
			card("a", { fy: 0 }),
			card("hidden", { fy: 100, mobile: { hidden: true } }),
			card("c", { fy: 200 }),
		];
		expect(moveStacked(cards, cards[2], -1, { includeHidden: true })).toBe(true);
		// The move is one place on the stack the arranger can see, so `c` lands
		// above the hidden card rather than jumping the whole way to the top.
		expect(ids(stackedCards(cards, { includeHidden: true }))).toEqual([
			"a",
			"c",
			"hidden",
		]);
		// Hidden or not, the whole stack is numbered — so unhiding the card later
		// brings it back where it was left.
		expect(cards.map((c) => c.mobile?.order)).toEqual([0, 2, 1]);
		expect(cards[1].mobile?.hidden).toBe(true);
	});

	it("keeps a card's other mobile options while reordering", () => {
		const cards = [
			card("a", { fy: 0, mobile: { collapsed: true } }),
			card("b", { fy: 100 }),
		];
		moveStacked(cards, cards[0], 1);
		expect(cards[0].mobile).toEqual({ collapsed: true, order: 1 });
	});
});
