import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	effectiveCompact,
	effectiveThemeColorTarget,
	type HomeSettings,
} from "../src/types";

/**
 * The two overrides the setup wizard needed in order to stop writing global
 * settings: compact spacing and the title's accent target.
 *
 * Both follow the same contract every other per-dashboard override has — a
 * board that sets nothing keeps following the global setting *as it changes
 * later*, which is exactly what a stored copy of the global value would
 * silently break.
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

describe("effectiveCompact", () => {
	it("follows the global setting when the board sets no override", () => {
		const s = settings();
		expect(effectiveCompact(s)).toBe(false);
		s.compact = true;
		expect(effectiveCompact(s)).toBe(true);
	});

	it("lets one board tighten up while the vault stays roomy", () => {
		const s = settings();
		s.dashboards[0].compact = true;
		expect(effectiveCompact(s)).toBe(true);
		s.activeDashboardId = "d2";
		expect(effectiveCompact(s)).toBe(false);
	});

	it("lets one board stay roomy while the vault is compact", () => {
		const s = settings();
		s.compact = true;
		s.dashboards[0].compact = false;
		expect(effectiveCompact(s)).toBe(false);
	});
});

describe("effectiveThemeColorTarget", () => {
	it("follows the global setting when the board's header sets no override", () => {
		const s = settings();
		expect(effectiveThemeColorTarget(s)).toBe("none");
		s.themeColorTarget = "both";
		expect(effectiveThemeColorTarget(s)).toBe("both");
	});

	it("takes the board's override over the global one", () => {
		const s = settings();
		s.themeColorTarget = "both";
		s.dashboards[0].header = { themeColorTarget: "icon" };
		expect(effectiveThemeColorTarget(s)).toBe("icon");
		s.activeDashboardId = "d2";
		expect(effectiveThemeColorTarget(s)).toBe("both");
	});

	it("treats a header override of \"none\" as a real answer, not as absent", () => {
		const s = settings();
		s.themeColorTarget = "title";
		s.dashboards[0].header = { themeColorTarget: "none" };
		expect(effectiveThemeColorTarget(s)).toBe("none");
	});
});
