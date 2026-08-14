import { describe, expect, it } from "vitest";
import {
	BANNER_HEIGHT_DEFAULT,
	BANNER_HEIGHT_MAX,
	BANNER_HEIGHT_MIN,
	bannerActive,
	clampBannerHeight,
	DEFAULT_SETTINGS,
	effectiveBackground,
	migrateSettings,
	type HomeSettings,
} from "../src/types";

/**
 * Banner mode is a *layout* on top of the existing background, not a second
 * background: the kind, value, opacity and blur mean the same thing whichever
 * way the backdrop is worn, and switching between them must never lose what was
 * configured.
 *
 * These tests pin the two things the rest of the code relies on: that
 * `effectiveBackground` always reports resolved banner fields (so nothing has
 * to repeat the fallbacks), and that a board only counts as bannered when there
 * is actually something to put in the strip.
 */

function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.backgroundKind = "url";
	s.backgroundValue = "https://example.com/cover.png";
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

describe("clampBannerHeight", () => {
	it("keeps a sane height, rounds, and bounds the rest", () => {
		expect(clampBannerHeight(300)).toBe(300);
		expect(clampBannerHeight(220.4)).toBe(220);
		expect(clampBannerHeight(BANNER_HEIGHT_MIN - 50)).toBe(BANNER_HEIGHT_MIN);
		expect(clampBannerHeight(BANNER_HEIGHT_MAX + 50)).toBe(BANNER_HEIGHT_MAX);
	});

	it("falls back to the default for a missing or unusable value", () => {
		expect(clampBannerHeight(undefined)).toBe(BANNER_HEIGHT_DEFAULT);
		expect(clampBannerHeight(Number.NaN)).toBe(BANNER_HEIGHT_DEFAULT);
	});
});

describe("effectiveBackground banner fields", () => {
	it("resolves the global banner settings", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		s.bannerHeight = 1000;
		s.bannerFade = false;
		s.bannerFullWidth = true;

		expect(effectiveBackground(s)).toEqual({
			kind: "url",
			value: "https://example.com/cover.png",
			opacity: DEFAULT_SETTINGS.backgroundOpacity,
			blur: DEFAULT_SETTINGS.backgroundBlur,
			layout: "banner",
			bannerHeight: BANNER_HEIGHT_MAX,
			bannerFade: false,
			bannerFullWidth: true,
		});
	});

	it("fills a per-dashboard override's missing banner fields", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		// A background saved before banners existed: layout and the rest absent.
		s.dashboards[0].background = {
			kind: "image",
			value: "Attachments/board.png",
			opacity: 0.8,
			blur: 12,
		};

		// The override carries its own layout, so it stays a wallpaper even
		// though the global default has moved to banners.
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

	it("lets one board wear a banner while the vault keeps its wallpaper", () => {
		const s = settings();
		s.dashboards[0].background = {
			kind: "url",
			value: "https://example.com/board-cover.png",
			opacity: 1,
			blur: 0,
			layout: "banner",
			bannerHeight: 320,
		};

		expect(s.backgroundLayout).toBe("full");
		expect(bannerActive(s)).toBe(true);
		expect(effectiveBackground(s).bannerHeight).toBe(320);
	});
});

describe("bannerActive", () => {
	it("is off for the classic full-view background", () => {
		expect(bannerActive(settings())).toBe(false);
	});

	it("is on once the layout says so", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		expect(bannerActive(s)).toBe(true);
	});

	it("stays off with no background to put in the strip", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		s.backgroundKind = "none";
		expect(bannerActive(s)).toBe(false);
	});

	it("stays off under low power, which replaces the whole backdrop", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		s.lowPower = true;
		expect(bannerActive(s)).toBe(false);
		expect(effectiveBackground(s).kind).toBe("color");
	});
});

describe("migrateSettings and banners", () => {
	it("defaults a pre-banner install to the full-view background", () => {
		const s = settings();
		// Simulate a data.json written before banner mode existed.
		delete (s as Partial<HomeSettings>).backgroundLayout;
		delete (s as Partial<HomeSettings>).bannerHeight;
		delete (s as Partial<HomeSettings>).bannerFade;
		delete (s as Partial<HomeSettings>).bannerFullWidth;

		migrateSettings(s, {});

		expect(s.backgroundLayout).toBe("full");
		expect(s.bannerHeight).toBe(BANNER_HEIGHT_DEFAULT);
		expect(s.bannerFade).toBe(true);
		expect(s.bannerFullWidth).toBe(false);
		expect(bannerActive(s)).toBe(false);
	});

	it("keeps a chosen banner and repairs an out-of-range height", () => {
		const s = settings();
		s.backgroundLayout = "banner";
		s.bannerHeight = 5;

		migrateSettings(s, {});

		expect(s.backgroundLayout).toBe("banner");
		expect(s.bannerHeight).toBe(BANNER_HEIGHT_MIN);
	});

	it("repairs a wrong-typed layout rather than trusting it", () => {
		const s = settings();
		(s as unknown as Record<string, unknown>).backgroundLayout = "cover";

		migrateSettings(s, {});

		expect(s.backgroundLayout).toBe("full");
	});
});
