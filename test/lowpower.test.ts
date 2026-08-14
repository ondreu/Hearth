import { describe, expect, it } from "vitest";
import {
	BANNER_HEIGHT_DEFAULT,
	DEFAULT_SETTINGS,
	effectiveAutoRefreshMinutes,
	effectiveBackground,
	effectiveCardBlur,
	effectiveCardOpacity,
	LOW_POWER_BACKGROUND,
	lowPowerActive,
	migrateSettings,
	resolveCardBlur,
	resolveCardOpacity,
	type DashboardCard,
	type HomeSettings,
} from "../src/types";

/**
 * Low power mode is an override layer, not a bulk edit of the settings it
 * covers: turning it on changes what the `effective*` resolvers *report*, and
 * turning it off must give back the previous look byte for byte — including
 * per-dashboard and per-card overrides, which no snapshot-and-restore scheme
 * would have captured.
 *
 * That round-trip is the whole promise of the feature, so it is what these
 * tests pin: every assertion below is paired, checking both the overridden
 * value while the mode is on and the *original* value once it is off, off the
 * same settings object.
 */

/** Settings with one dashboard carrying a distinctive, non-default look, so an
 * accidental write by the mode would be visible rather than blending into the
 * defaults. */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.backgroundKind = "url";
	s.backgroundValue = "https://example.com/wallpaper.png";
	s.backgroundOpacity = 0.4;
	s.backgroundBlur = 6;
	s.cardOpacity = 0.5;
	s.cardBlur = 7;
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
	return { id: "c1", kind: "text", title: "", x: 0, y: 0, w: 2, h: 2, ...overrides };
}

describe("lowPowerActive", () => {
	it("is off by default and reads the flag", () => {
		const s = settings();
		expect(lowPowerActive(s)).toBe(false);
		s.lowPower = true;
		expect(lowPowerActive(s)).toBe(true);
	});
});

describe("effectiveBackground under low power", () => {
	it("substitutes a flat colour and restores the configured background", () => {
		const s = settings();
		const before = effectiveBackground(s);
		expect(before).toEqual({
			kind: "url",
			value: "https://example.com/wallpaper.png",
			opacity: 0.4,
			blur: 6,
			// Resolved rather than configured: effectiveBackground always reports
			// the banner fields so callers never repeat the fallbacks.
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});

		s.lowPower = true;
		expect(effectiveBackground(s)).toEqual({
			kind: "color",
			value: LOW_POWER_BACKGROUND,
			opacity: 1,
			blur: 0,
			// The mode replaces the picture, not the shape of the board: the
			// layout is not a paint cost, and changing it would move every card
			// on a bannered board the moment the mode is toggled.
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});

		s.lowPower = false;
		expect(effectiveBackground(s)).toEqual(before);
	});

	it("uses the configured low power colour, falling back when it is blank", () => {
		const s = settings();
		s.lowPower = true;
		s.lowPowerBackgroundColor = "#123456";
		expect(effectiveBackground(s).value).toBe("#123456");

		s.lowPowerBackgroundColor = "   ";
		expect(effectiveBackground(s).value).toBe(LOW_POWER_BACKGROUND);
	});

	it("overrides a per-dashboard background too, without erasing it", () => {
		const s = settings();
		s.dashboards[0].background = {
			kind: "image",
			value: "Attachments/board.png",
			opacity: 0.8,
			blur: 12,
		};

		s.lowPower = true;
		expect(effectiveBackground(s).kind).toBe("color");

		s.lowPower = false;
		expect(effectiveBackground(s)).toEqual({
			kind: "image",
			value: "Attachments/board.png",
			opacity: 0.8,
			blur: 12,
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});
	});
});

describe("card surface under low power", () => {
	it("reports opaque, unblurred cards and then the configured values", () => {
		const s = settings();

		s.lowPower = true;
		expect(effectiveCardOpacity(s)).toBe(1);
		expect(effectiveCardBlur(s)).toBe(0);

		s.lowPower = false;
		expect(effectiveCardOpacity(s)).toBe(0.5);
		expect(effectiveCardBlur(s)).toBe(7);
	});

	it("overrides per-dashboard and per-card values without losing them", () => {
		const s = settings();
		s.dashboards[0].cardOpacity = 0.2;
		s.dashboards[0].cardBlur = 20;
		const c = card({ cardOpacity: 0.15, cardBlur: 30 });

		s.lowPower = true;
		expect(effectiveCardOpacity(s)).toBe(1);
		expect(effectiveCardBlur(s)).toBe(0);
		expect(resolveCardOpacity(s, c)).toBe(1);
		expect(resolveCardBlur(s, c)).toBe(0);

		s.lowPower = false;
		expect(effectiveCardOpacity(s)).toBe(0.2);
		expect(effectiveCardBlur(s)).toBe(20);
		expect(resolveCardOpacity(s, c)).toBe(0.15);
		expect(resolveCardBlur(s, c)).toBe(30);
	});
});

describe("effectiveAutoRefreshMinutes", () => {
	it("passes the configured interval through, and reports 0 under low power", () => {
		const s = settings();
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(30);
		expect(effectiveAutoRefreshMinutes(s, 0)).toBe(0);

		s.lowPower = true;
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(0);

		s.lowPower = false;
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(30);
	});
});

describe("low power mode never writes to the settings it overrides", () => {
	it("leaves every covered field untouched across a full on/off cycle", () => {
		const s = settings();
		s.dashboards[0].background = {
			kind: "color",
			value: "#ff0000",
			opacity: 0.9,
			blur: 3,
		};
		s.dashboards[0].cardOpacity = 0.25;
		s.dashboards[0].cardBlur = 18;
		const c = card({ cardOpacity: 0.1, cardBlur: 9 });
		const before = structuredClone(s);

		// Everything a render would ask for, while the mode is on.
		s.lowPower = true;
		effectiveBackground(s);
		effectiveCardOpacity(s);
		effectiveCardBlur(s);
		resolveCardOpacity(s, c);
		resolveCardBlur(s, c);
		effectiveAutoRefreshMinutes(s, 15);
		s.lowPower = false;

		expect(s).toEqual(before);
	});
});

describe("migrateSettings and low power", () => {
	it("defaults both fields for settings saved before the mode existed", () => {
		const s = settings();
		// Simulate a data.json written by an older version.
		delete (s as Partial<HomeSettings>).lowPower;
		delete (s as Partial<HomeSettings>).lowPowerBackgroundColor;

		migrateSettings(s, {});

		expect(s.lowPower).toBe(false);
		expect(s.lowPowerBackgroundColor).toBe(LOW_POWER_BACKGROUND);
	});

	it("repairs wrong-typed or blank values and keeps a good one", () => {
		const s = settings();
		(s as unknown as Record<string, unknown>).lowPower = "yes";
		s.lowPowerBackgroundColor = "  ";
		migrateSettings(s, {});
		expect(s.lowPower).toBe(false);
		expect(s.lowPowerBackgroundColor).toBe(LOW_POWER_BACKGROUND);

		s.lowPower = true;
		s.lowPowerBackgroundColor = "#0a0a0a";
		migrateSettings(s, {});
		expect(s.lowPower).toBe(true);
		expect(s.lowPowerBackgroundColor).toBe("#0a0a0a");
	});
});
