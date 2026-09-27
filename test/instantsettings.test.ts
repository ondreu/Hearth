import { describe, expect, it } from "vitest";
import { applySettings, exportSettingsPayload, sanitizeCard, sanitizeDashboard } from "../src/layout";
import { DEFAULT_SETTINGS, effectiveHiddenInstantAnswers, type HomeSettings } from "../src/types";

/**
 * Where instant answers are switched on and off: the vault decides what may
 * run at all, and a board or a search-bar card can only switch more off — so
 * a board imported from someone else can't turn back on an answer (and the
 * requests it makes) that this vault has off.
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

describe("effectiveHiddenInstantAnswers", () => {
	it("follows the vault on a board that switches nothing off", () => {
		const s = settings();
		expect(effectiveHiddenInstantAnswers(s)).toEqual([]);
		s.hiddenInstantAnswers = ["market"];
		expect(effectiveHiddenInstantAnswers(s)).toEqual(["market"]);
	});

	it("adds a board's own to the vault's, on that board only", () => {
		const s = settings();
		s.hiddenInstantAnswers = ["market"];
		s.dashboards[0].hiddenInstantAnswers = ["wiki", "market"];
		expect(effectiveHiddenInstantAnswers(s).sort()).toEqual(["market", "wiki"]);
		s.activeDashboardId = "d2";
		expect(effectiveHiddenInstantAnswers(s)).toEqual(["market"]);
	});

	it("never lets a board switch one back on", () => {
		const s = settings();
		s.hiddenInstantAnswers = ["weather"];
		s.dashboards[0].hiddenInstantAnswers = [];
		expect(effectiveHiddenInstantAnswers(s)).toEqual(["weather"]);
	});
});

describe("instant-answer settings through export and import", () => {
	it("round-trips the vault's choice and drops unknown ids", () => {
		const s = settings();
		s.searchInstantAnswers = false;
		s.hiddenInstantAnswers = ["wiki", "chance"];
		const payload = exportSettingsPayload(s);
		expect(payload.searchInstantAnswers).toBe(false);
		expect(payload.hiddenInstantAnswers).toEqual(["wiki", "chance"]);

		const t = settings();
		applySettings(t, { ...payload, hiddenInstantAnswers: ["wiki", "wiki", "teleport", 3] });
		expect(t.searchInstantAnswers).toBe(false);
		expect(t.hiddenInstantAnswers).toEqual(["wiki"]);
	});

	it("keeps a board's and a card's own list, sanitized", () => {
		const s = settings();
		const dash = sanitizeDashboard(
			{ id: "x", name: "X", cards: [], hiddenInstantAnswers: ["market", "nope"] },
			s,
			0,
		);
		expect(dash?.hiddenInstantAnswers).toEqual(["market"]);
		const card = sanitizeCard(
			{ id: "c", kind: "searchbar", x: 0, y: 0, w: 6, h: 1, searchBar: { hiddenInstantAnswers: ["time", 1] } },
			0,
		);
		expect(card?.searchBar?.hiddenInstantAnswers).toEqual(["time"]);
	});
});
