import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, graphicalBoardsInUse, type HomeSettings } from "../src/types";

/**
 * Which settings the panes offer while terminal mode is on. Terminal mode
 * draws every card board as text and leaves a plugin board as it is, so the
 * settings that shape only the graphical board are hidden exactly while no
 * board is drawn graphically.
 */
function settings(boards: ("cards" | "plugin")[], terminal: boolean): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = boards.map((mode, i) => ({
		id: `d${i}`,
		name: `Board ${i}`,
		cards: [],
		...(mode === "plugin" ? { mode, pluginView: { viewType: "rss" } } : {}),
	}));
	s.activeDashboardId = "d0";
	s.terminalMode = terminal || undefined;
	return s;
}

describe("graphicalBoardsInUse", () => {
	it("is true outside terminal mode", () => {
		expect(graphicalBoardsInUse(settings(["cards"], false))).toBe(true);
	});

	it("is false in terminal mode when every board is a card board", () => {
		expect(graphicalBoardsInUse(settings(["cards", "cards"], true))).toBe(false);
	});

	it("stays true in terminal mode while a plugin board is drawn graphically", () => {
		expect(graphicalBoardsInUse(settings(["cards", "plugin"], true))).toBe(true);
	});
});
