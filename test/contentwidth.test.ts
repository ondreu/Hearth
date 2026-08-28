import { describe, expect, it } from "vitest";
import { exportLayout, importLayout } from "../src/layout";
import {
	CONTENT_WIDTH_MAX,
	CONTENT_WIDTH_MIN,
	DEFAULT_SETTINGS,
	effectiveFullWidth,
	effectiveMaxWidth,
	type HomeSettings,
} from "../src/types";

/**
 * The content column has two controls that decide one thing between them: how
 * wide the board is allowed to get. `maxWidth` is a *ceiling* (the column is
 * fluid and follows a narrow pane down on its own), and `fullWidth` removes
 * that ceiling entirely. Both are per-dashboard overridable, and both have to
 * survive a layout export/import round trip — see #251, where a hard 1600px
 * ceiling left a large monitor with a board stranded in the middle of it.
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

describe("content width bounds", () => {
	it("reaches the full width of a 4K panel", () => {
		// The reporter hand-patched the source to 2400 to fill their monitor; the
		// slider has to reach at least that far without anyone editing a file.
		expect(CONTENT_WIDTH_MAX).toBeGreaterThanOrEqual(2400);
		expect(CONTENT_WIDTH_MIN).toBeLessThan(DEFAULT_SETTINGS.maxWidth);
		expect(DEFAULT_SETTINGS.maxWidth).toBeLessThan(CONTENT_WIDTH_MAX);
	});

	it("leaves the default board capped, exactly as it drew before", () => {
		const s = settings();
		expect(effectiveFullWidth(s)).toBe(false);
		expect(effectiveMaxWidth(s)).toBe(1600);
	});
});

describe("effectiveFullWidth", () => {
	it("follows the global setting when the board sets no override", () => {
		const s = settings();
		expect(effectiveFullWidth(s)).toBe(false);
		s.fullWidth = true;
		expect(effectiveFullWidth(s)).toBe(true);
	});

	it("lets one board fill the pane while the vault stays capped", () => {
		const s = settings();
		s.dashboards[0].fullWidth = true;
		expect(effectiveFullWidth(s)).toBe(true);
		s.activeDashboardId = "d2";
		expect(effectiveFullWidth(s)).toBe(false);
	});

	it("lets one board keep its ceiling while the vault goes full width", () => {
		const s = settings();
		s.fullWidth = true;
		s.dashboards[0].fullWidth = false;
		expect(effectiveFullWidth(s)).toBe(false);
		s.activeDashboardId = "d2";
		expect(effectiveFullWidth(s)).toBe(true);
	});

	it("keeps the board's own ceiling readable while it is uncapped", () => {
		// `maxWidth` is not cleared by going full width, so turning it back off
		// returns to the width the reader had already chosen.
		const s = settings();
		s.dashboards[0].maxWidth = 2400;
		s.dashboards[0].fullWidth = true;
		expect(effectiveMaxWidth(s)).toBe(2400);
	});
});

describe("content width through a layout export", () => {
	it("round-trips a width the old ceiling would have clipped", () => {
		const from = settings();
		from.maxWidth = 2400;
		from.dashboards[0].maxWidth = 3200;

		const into = settings();
		expect(importLayout(into, exportLayout(from))).toBeNull();
		expect(into.maxWidth).toBe(2400);
		expect(into.dashboards[0].maxWidth).toBe(3200);
	});

	it("round-trips full width, globally and per board", () => {
		const from = settings();
		from.fullWidth = true;
		from.dashboards[1].fullWidth = false;

		const into = settings();
		expect(importLayout(into, exportLayout(from))).toBeNull();
		expect(into.fullWidth).toBe(true);
		expect(into.dashboards[0].fullWidth).toBeUndefined();
		expect(into.dashboards[1].fullWidth).toBe(false);
	});

	it("clamps a width past the ceiling instead of taking it", () => {
		const into = settings();
		const err = importLayout(
			into,
			JSON.stringify({
				hearthLayout: 2,
				dashboards: [{ id: "d1", name: "Imported", cards: [] }],
				activeDashboardId: "d1",
				maxWidth: 99999,
			}),
		);
		expect(err).toBeNull();
		expect(into.maxWidth).toBe(CONTENT_WIDTH_MAX);
	});

	it("does not re-impose a ceiling from a layout saved before full width", () => {
		// Layouts exported by older builds carry no `fullWidth` key at all.
		const into = settings();
		into.fullWidth = true;
		const err = importLayout(
			into,
			JSON.stringify({
				hearthLayout: 2,
				dashboards: [{ id: "d1", name: "Imported", cards: [] }],
				activeDashboardId: "d1",
				maxWidth: 1400,
			}),
		);
		expect(err).toBeNull();
		expect(into.fullWidth).toBe(true);
		expect(into.maxWidth).toBe(1400);
	});
});
