import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	effectiveShowSearch,
	type HomeSettings,
} from "../src/types";

/**
 * The search section is controlled in two places at once: a global toggle
 * (Settings → Appearance → Search bar) and a per-dashboard override. The board
 * has the last word, and a board that never sets the option has to keep
 * following the global toggle — including when the global toggle is later
 * turned off, which is exactly what a stored `true` would silently break.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Dashboard 1", cards: [] },
		{ id: "d2", name: "Dashboard 2", cards: [] },
	];
	s.activeDashboardId = "d1";
	return s;
}

describe("effectiveShowSearch", () => {
	it("shows the section by default", () => {
		expect(effectiveShowSearch(settings())).toBe(true);
	});

	it("follows the global toggle when the board sets no override", () => {
		const s = settings();
		s.showSearch = false;
		expect(effectiveShowSearch(s)).toBe(false);
		s.showSearch = true;
		expect(effectiveShowSearch(s)).toBe(true);
	});

	it("lets a board hide the section while the global toggle is on", () => {
		const s = settings();
		s.dashboards[0].showSearch = false;
		expect(effectiveShowSearch(s)).toBe(false);
		// The override is per board: the other one still follows the global.
		s.activeDashboardId = "d2";
		expect(effectiveShowSearch(s)).toBe(true);
	});

	it("lets a board show the section while the global toggle is off", () => {
		const s = settings();
		s.showSearch = false;
		s.dashboards[0].showSearch = true;
		expect(effectiveShowSearch(s)).toBe(true);
		s.activeDashboardId = "d2";
		expect(effectiveShowSearch(s)).toBe(false);
	});
});
