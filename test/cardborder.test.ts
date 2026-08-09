import { describe, expect, it } from "vitest";
import {
	CARD_BORDER_WIDTH_MAX,
	DEFAULT_SETTINGS,
	effectiveCardBorderWidth,
	resolveCardBorderWidth,
	type DashboardCard,
	type HomeSettings,
} from "../src/types";

/**
 * The card border width is settable at three levels — global, per dashboard and
 * (since the Style tab grew the slider) per card — and each level only matters
 * when the one below it says nothing. These tests pin that fallback chain, and
 * the clamping that keeps a hand-edited layout file from painting a 400px frame.
 */

function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.cardBorderWidth = 1;
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
	return { id: "c1", kind: "text", title: "", x: 0, y: 0, w: 2, h: 2, ...overrides };
}

describe("resolveCardBorderWidth", () => {
	it("falls back to the global width when neither board nor card overrides", () => {
		const s = settings();
		s.cardBorderWidth = 3;
		expect(resolveCardBorderWidth(s, card())).toBe(3);
	});

	it("falls back to the board override before the global width", () => {
		const s = settings();
		s.cardBorderWidth = 3;
		s.dashboards[0].cardBorderWidth = 5;
		expect(effectiveCardBorderWidth(s)).toBe(5);
		expect(resolveCardBorderWidth(s, card())).toBe(5);
	});

	it("prefers the card's own override over both", () => {
		const s = settings();
		s.cardBorderWidth = 3;
		s.dashboards[0].cardBorderWidth = 5;
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: 0 }))).toBe(0);
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: 2 }))).toBe(2);
	});

	it("clamps and rounds an out-of-range card override", () => {
		const s = settings();
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: 400 }))).toBe(
			CARD_BORDER_WIDTH_MAX,
		);
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: -4 }))).toBe(0);
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: 2.6 }))).toBe(3);
		expect(resolveCardBorderWidth(s, card({ cardBorderWidth: Number.NaN }))).toBe(1);
	});
});
