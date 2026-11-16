import { describe, expect, it } from "vitest";
import {
	cardsForBoard,
	type DashboardCard,
	DEFAULT_SETTINGS,
	findCardById,
	type HomeSettings,
} from "../src/types";
import { PANE_STATE_KEY, paneBoard, paneCard, paneCardIdFromState } from "../src/cardpanestate";

/**
 * The sidebar card pane's state (#492): which card a pane leaf names, and the
 * one-card board it draws that card through.
 *
 * The rendering itself needs an Obsidian view and a DOM, so what is pinned down
 * here is the part that can be wrong silently: a pane that lost its card, a
 * pane's board leaking the active board's cards, or the leaf state being read
 * out of a shape it shouldn't be.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Home", cards: [card("a"), card("b")] },
		{ id: "d2", name: "Work", cards: [card("c")], mode: "single", singleCardId: "c" },
		{ id: "d3", name: "Plugin", cards: [card("d")], mode: "plugin" },
	];
	s.activeDashboardId = "d1";
	s.pinnedCards = [card("p")];
	return s;
}

function card(id: string): DashboardCard {
	return { id, kind: "text", x: 0, y: 0, w: 4, h: 3 };
}

describe("paneCardIdFromState", () => {
	it("reads the card id a pane wrote", () => {
		expect(paneCardIdFromState({ [PANE_STATE_KEY]: "a" })).toBe("a");
	});

	it("is null for anything that is not a pane's state", () => {
		expect(paneCardIdFromState(null)).toBeNull();
		expect(paneCardIdFromState(undefined)).toBeNull();
		expect(paneCardIdFromState({})).toBeNull();
		expect(paneCardIdFromState({ [PANE_STATE_KEY]: "" })).toBeNull();
		expect(paneCardIdFromState({ [PANE_STATE_KEY]: 7 })).toBeNull();
		// A board's own state (scroll memory, and nothing else) is not a pane.
		expect(paneCardIdFromState({ scroll: { d1: 120 } })).toBeNull();
	});
});

describe("paneCard", () => {
	it("finds a card on any board, and one in the pinned set", () => {
		const s = settings();
		expect(paneCard(s, "a")?.id).toBe("a");
		expect(paneCard(s, "c")?.id).toBe("c");
		expect(paneCard(s, "p")?.id).toBe("p");
	});

	it("is null once the card is gone — the pane's empty state", () => {
		const s = settings();
		s.dashboards[0].cards = s.dashboards[0].cards.filter((c) => c.id !== "a");
		expect(paneCard(s, "a")).toBeNull();
		expect(paneCard(s, "nope")).toBeNull();
	});
});

describe("paneBoard", () => {
	it("is a single-card board holding just that card", () => {
		const c = { ...card("a"), title: "Weather" };
		const board = paneBoard(c);
		expect(board.mode).toBe("single");
		expect(board.singleCardId).toBe("a");
		expect(board.cards).toEqual([c]);
		expect(cardsForBoard(board, settings())).toEqual([c]);
	});

	it("does not borrow the active board's cards or its pinned ones", () => {
		const s = settings();
		const board = paneBoard(card("a"));
		// The active board renders a, b and the pinned card; the pane renders a.
		expect(cardsForBoard(board, s).map((c) => c.id)).toEqual(["a"]);
	});

	it("names itself after the card, falling back to the card's kind", () => {
		expect(paneBoard({ ...card("a"), title: " Weather " }).name).toBe("Weather");
		expect(paneBoard(card("a")).name.length).toBeGreaterThan(0);
	});

	it("keys the board by the card, so two panes are two boards", () => {
		expect(paneBoard(card("a")).id).not.toBe(paneBoard(card("b")).id);
	});
});

describe("cardsForBoard", () => {
	it("keeps the rules renderCards has, for a board given explicitly", () => {
		const s = settings();
		// A cards board: its own cards plus every pinned one.
		expect(cardsForBoard(s.dashboards[0], s).map((c) => c.id)).toEqual(["a", "b", "p"]);
		// A single-card board: exactly its card, no pinned ones.
		expect(cardsForBoard(s.dashboards[1], s).map((c) => c.id)).toEqual(["c"]);
		// A plugin board renders no cards at all.
		expect(cardsForBoard(s.dashboards[2], s)).toEqual([]);
	});
});

describe("findCardById", () => {
	it("looks on every board and in the pinned set", () => {
		const s = settings();
		expect(findCardById(s, "c")?.id).toBe("c");
		expect(findCardById(s, "p")?.id).toBe("p");
		expect(findCardById(s, "missing")).toBeNull();
	});
});
