import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import {
	FULL_VIEW_SCOPE,
	isDocumentViewType,
	isViewTypeHostable,
	listLeafViewTypes,
} from "../src/leafview";
import {
	activeIsPluginBoard,
	type DashboardCard,
	DEFAULT_SETTINGS,
	effectiveFullWidth,
	effectiveShowSearch,
	effectiveShowTitle,
	type HomeSettings,
	isPluginBoard,
	pluginBoardKeepsMounted,
	pluginBoardViewType,
	renderCards,
} from "../src/types";

/**
 * A plugin board — a dashboard whose whole board is one hosted plugin view
 * rather than a grid of cards.
 *
 * What is worth pinning down here is everything a plugin board changes about
 * *the rest* of Hearth: which cards render, what the header defaults to, and
 * which view types the picker is allowed to offer. The hosting itself (detached
 * leaves, the keep-alive cache) is DOM and Obsidian API and is deliberately not
 * mocked, per the no-API-mocks rule.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Cards", cards: [] },
		{ id: "d2", name: "Reader", cards: [], mode: "plugin", pluginView: { viewType: "rss" } },
	];
	s.activeDashboardId = "d1";
	return s;
}

function card(id: string): DashboardCard {
	return { id, kind: "text", x: 0, y: 0, w: 4, h: 3 };
}

describe("isPluginBoard", () => {
	it("treats a board with no mode as a cards board", () => {
		const s = settings();
		expect(isPluginBoard(s.dashboards[0])).toBe(false);
		expect(isPluginBoard(s.dashboards[1])).toBe(true);
	});

	it("treats an unknown mode synced back from a future version as cards", () => {
		const s = settings();
		// Deliberately not a DashboardMode: a board saved by a newer Hearth must
		// degrade to the board every version can render, not to a blank one.
		s.dashboards[0].mode = "mosaic" as never;
		expect(isPluginBoard(s.dashboards[0])).toBe(false);
	});

	it("reads the active board", () => {
		const s = settings();
		expect(activeIsPluginBoard(s)).toBe(false);
		s.activeDashboardId = "d2";
		expect(activeIsPluginBoard(s)).toBe(true);
	});
});

describe("renderCards on a plugin board", () => {
	it("renders no cards at all, pinned ones included", () => {
		const s = settings();
		// A card left on the board from before it became a plugin board, and a
		// pinned card that follows the user from board to board.
		s.dashboards[1].cards = [card("stale")];
		s.pinnedCards = [card("pinned")];

		s.activeDashboardId = "d1";
		expect(renderCards(s).map((c) => c.id)).toEqual(["pinned"]);

		s.activeDashboardId = "d2";
		expect(renderCards(s)).toEqual([]);
	});

	it("keeps the cards of a board turned into a plugin board", () => {
		const s = settings();
		s.dashboards[0].cards = [card("keep")];
		s.dashboards[0].mode = "plugin";
		s.activeDashboardId = "d1";
		expect(renderCards(s)).toEqual([]);
		// Switching back has to bring them straight back — turning the type over
		// is not a way to delete a board's cards.
		s.dashboards[0].mode = undefined;
		expect(renderCards(s).map((c) => c.id)).toEqual(["keep"]);
	});
});

describe("header defaults on a plugin board", () => {
	it("hides the title and search by default, whatever the global says", () => {
		const s = settings();
		s.showTitle = true;
		s.showSearch = true;
		s.activeDashboardId = "d2";
		expect(effectiveShowTitle(s)).toBe(false);
		expect(effectiveShowSearch(s)).toBe(false);
	});

	it("still lets the board ask for them back", () => {
		const s = settings();
		s.showTitle = false;
		s.showSearch = false;
		s.activeDashboardId = "d2";
		s.dashboards[1].header = { showTitle: true };
		s.dashboards[1].showSearch = true;
		expect(effectiveShowTitle(s)).toBe(true);
		expect(effectiveShowSearch(s)).toBe(true);
	});

	it("leaves a cards board following the global setting", () => {
		const s = settings();
		s.showTitle = true;
		s.showSearch = true;
		expect(effectiveShowTitle(s)).toBe(true);
		expect(effectiveShowSearch(s)).toBe(true);
	});
});

describe("effectiveFullWidth on a plugin board", () => {
	it("fills the pane by default rather than sitting in a text column", () => {
		const s = settings();
		s.fullWidth = false;
		s.activeDashboardId = "d2";
		expect(effectiveFullWidth(s)).toBe(true);
	});

	it("honours a board that asks to be boxed", () => {
		const s = settings();
		s.activeDashboardId = "d2";
		s.dashboards[1].fullWidth = false;
		expect(effectiveFullWidth(s)).toBe(false);
	});

	it("leaves a cards board following the global setting", () => {
		const s = settings();
		s.fullWidth = false;
		expect(effectiveFullWidth(s)).toBe(false);
		s.fullWidth = true;
		expect(effectiveFullWidth(s)).toBe(true);
	});
});

describe("plugin board config readers", () => {
	it("reads an unset view as empty, whitespace included", () => {
		const s = settings();
		expect(pluginBoardViewType(s.dashboards[0])).toBe("");
		expect(pluginBoardViewType(s.dashboards[1])).toBe("rss");
		s.dashboards[1].pluginView = { viewType: "   " };
		expect(pluginBoardViewType(s.dashboards[1])).toBe("");
	});

	it("keeps a view mounted unless the board opts out", () => {
		const s = settings();
		expect(pluginBoardKeepsMounted(s.dashboards[1])).toBe(true);
		s.dashboards[1].pluginView = { viewType: "rss", keepMounted: false };
		expect(pluginBoardKeepsMounted(s.dashboards[1])).toBe(false);
	});
});

/** A stand-in for the app's view registry, which is all these functions read. */
function appWith(...types: string[]): App {
	return {
		viewRegistry: { viewByType: Object.fromEntries(types.map((t) => [t, {}])) },
	} as unknown as App;
}

describe("view types offered to a full-view host", () => {
	const app = appWith("rss", "markdown", "pdf", "canvas", "empty", "hearth-home-view");

	it("never offers the empty view or Hearth's own, at either scope", () => {
		for (const scope of [undefined, FULL_VIEW_SCOPE]) {
			const offered = listLeafViewTypes(app, scope).map((v) => v.type);
			expect(offered).not.toContain("empty");
			expect(offered).not.toContain("hearth-home-view");
			expect(isViewTypeHostable(app, "empty", scope)).toBe(false);
			expect(isViewTypeHostable(app, "hearth-home-view", scope)).toBe(false);
		}
	});

	it("hides Obsidian's document surfaces by default — the card's scope", () => {
		const offered = listLeafViewTypes(app).map((v) => v.type);
		expect(offered).toEqual(["canvas", "rss"]);
		expect(isViewTypeHostable(app, "markdown")).toBe(false);
		expect(isViewTypeHostable(app, "pdf")).toBe(false);
	});

	it("offers them to a plugin board, which has a file picker for them", () => {
		const offered = listLeafViewTypes(app, FULL_VIEW_SCOPE).map((v) => v.type);
		expect(offered).toContain("markdown");
		expect(offered).toContain("pdf");
		expect(isViewTypeHostable(app, "markdown", FULL_VIEW_SCOPE)).toBe(true);
	});

	it("names which types need a file, so the board can say so", () => {
		expect(isDocumentViewType("markdown")).toBe(true);
		expect(isDocumentViewType("pdf")).toBe(true);
		// Canvas carries its own file handling and has always been offered.
		expect(isDocumentViewType("canvas")).toBe(false);
		expect(isDocumentViewType("rss")).toBe(false);
	});

	it("reports nothing hostable when the registry can't be read", () => {
		const blind = {} as unknown as App;
		expect(listLeafViewTypes(blind, FULL_VIEW_SCOPE)).toEqual([]);
		expect(isViewTypeHostable(blind, "rss", FULL_VIEW_SCOPE)).toBe(false);
	});
});
