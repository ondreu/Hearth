import { describe, expect, it } from "vitest";
import {
	activeIsPluginBoard,
	activeIsSingleCardBoard,
	type DashboardCard,
	DEFAULT_SETTINGS,
	effectiveFullWidth,
	effectiveShowSearch,
	effectiveShowTitle,
	type HomeSettings,
	isFullBoard,
	isSingleCardBoard,
	renderCards,
	singleBoardCard,
} from "../src/types";

/**
 * A single-card board — a dashboard whose whole board is one of its own Hearth
 * cards, drawn at full size.
 *
 * What is pinned down here is which card that is, what the board renders, and
 * that it takes the same header and width defaults a plugin board does. The
 * full-size placement itself is CSS.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Cards", cards: [] },
		{ id: "d2", name: "Reader", cards: [card("rss"), card("tasks")], mode: "single" },
	];
	s.activeDashboardId = "d1";
	return s;
}

function card(id: string): DashboardCard {
	return { id, kind: "text", x: 0, y: 0, w: 4, h: 3 };
}

describe("isSingleCardBoard", () => {
	it("reads only the exact mode", () => {
		const s = settings();
		expect(isSingleCardBoard(s.dashboards[0])).toBe(false);
		expect(isSingleCardBoard(s.dashboards[1])).toBe(true);
		s.dashboards[1].mode = "plugin";
		expect(isSingleCardBoard(s.dashboards[1])).toBe(false);
	});

	it("is a full board, but not a plugin board", () => {
		const s = settings();
		s.activeDashboardId = "d2";
		expect(activeIsSingleCardBoard(s)).toBe(true);
		expect(activeIsPluginBoard(s)).toBe(false);
		expect(isFullBoard(s.dashboards[1])).toBe(true);
		expect(isFullBoard(s.dashboards[0])).toBe(false);
	});
});

describe("singleBoardCard", () => {
	it("falls back to the board's first card when none is chosen", () => {
		const s = settings();
		expect(singleBoardCard(s.dashboards[1])?.id).toBe("rss");
	});

	it("shows the chosen card", () => {
		const s = settings();
		s.dashboards[1].singleCardId = "tasks";
		expect(singleBoardCard(s.dashboards[1])?.id).toBe("tasks");
	});

	it("falls back to the first card when the chosen one is gone", () => {
		const s = settings();
		s.dashboards[1].singleCardId = "removed";
		expect(singleBoardCard(s.dashboards[1])?.id).toBe("rss");
	});

	it("has nothing to show on a board without cards", () => {
		const s = settings();
		s.dashboards[1].cards = [];
		expect(singleBoardCard(s.dashboards[1])).toBeUndefined();
	});
});

describe("renderCards on a single-card board", () => {
	it("renders exactly its one card, and no pinned ones", () => {
		const s = settings();
		s.pinnedCards = [card("pinned")];
		s.activeDashboardId = "d2";
		s.dashboards[1].singleCardId = "tasks";
		expect(renderCards(s).map((c) => c.id)).toEqual(["tasks"]);
	});

	it("renders nothing before it has a card", () => {
		const s = settings();
		s.pinnedCards = [card("pinned")];
		s.dashboards[1].cards = [];
		s.activeDashboardId = "d2";
		expect(renderCards(s)).toEqual([]);
	});

	it("brings every card back when switched back to cards", () => {
		const s = settings();
		s.activeDashboardId = "d2";
		s.dashboards[1].mode = undefined;
		expect(renderCards(s).map((c) => c.id)).toEqual(["rss", "tasks"]);
	});
});

describe("defaults on a single-card board", () => {
	it("hides the header and fills the pane, like a plugin board", () => {
		const s = settings();
		s.showTitle = true;
		s.showSearch = true;
		s.fullWidth = false;
		s.activeDashboardId = "d2";
		expect(effectiveShowTitle(s)).toBe(false);
		expect(effectiveShowSearch(s)).toBe(false);
		expect(effectiveFullWidth(s)).toBe(true);
	});

	it("still honours the board's own overrides", () => {
		const s = settings();
		s.activeDashboardId = "d2";
		s.dashboards[1].header = { showTitle: true };
		s.dashboards[1].showSearch = true;
		s.dashboards[1].fullWidth = false;
		expect(effectiveShowTitle(s)).toBe(true);
		expect(effectiveShowSearch(s)).toBe(true);
		expect(effectiveFullWidth(s)).toBe(false);
	});
});
