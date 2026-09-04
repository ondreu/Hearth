import { describe, expect, it } from "vitest";
import { classifyTitleIcon, titleIconBlocked } from "../src/titleicon";
import {
	backgroundIsRemote,
	backgroundPaintable,
	bannerActive,
	DEFAULT_SETTINGS,
	effectiveBackground,
	type HomeSettings,
} from "../src/types";

/**
 * **Disable external calls** is a kill switch, so what it does not cover is a
 * hole rather than a rough edge (#281). Every card that fetches checks it; the
 * two things that didn't were a background image and a title icon given as a
 * web address — the two strings an *imported* board gets to choose (#282), and
 * so the two a stranger's board could point at a host of their own to learn
 * that the board had been opened, and by which IP.
 *
 * Both are now gated, which means a URL wallpaper and a URL icon disappear
 * while the switch is on: that is the promise the switch makes, and these tests
 * are what keeps it. The pure predicates are tested here rather than the
 * painting, because the painting is DOM (there is no jsdom in this suite) and
 * because both renderers ask exactly these questions.
 */

function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

const classify = (raw: string) => classifyTitleIcon(raw, () => false);

describe("backgroundIsRemote", () => {
	it("names the two kinds that are fetched over the network", () => {
		expect(backgroundIsRemote("url")).toBe(true);
		// The bundled default is not bundled: it is served from GitHub.
		expect(backgroundIsRemote("default")).toBe(true);
	});

	it("leaves the local kinds alone", () => {
		expect(backgroundIsRemote("none")).toBe(false);
		expect(backgroundIsRemote("color")).toBe(false);
		expect(backgroundIsRemote("image")).toBe(false);
		// A live sky asks for a forecast, but that fetch is gated on its own and
		// the sky is drawn either way — so it still paints something.
		expect(backgroundIsRemote("weather")).toBe(false);
	});
});

describe("backgroundPaintable", () => {
	const bg = (kind: HomeSettings["backgroundKind"], value = "") => ({
		kind,
		value,
		opacity: 1,
		blur: 0,
	});

	it("has nothing to paint without a background", () => {
		expect(backgroundPaintable(bg("none"), false)).toBe(false);
	});

	it("needs a value for every kind but the default", () => {
		expect(backgroundPaintable(bg("default"), false)).toBe(true);
		expect(backgroundPaintable(bg("url"), false)).toBe(false);
		expect(backgroundPaintable(bg("url", "https://example.com/bg.png"), false)).toBe(true);
		expect(backgroundPaintable(bg("color", "#123456"), false)).toBe(true);
	});

	it("drops the remote kinds once external calls are off", () => {
		expect(backgroundPaintable(bg("url", "https://example.com/bg.png"), true)).toBe(false);
		expect(backgroundPaintable(bg("default"), true)).toBe(false);
	});

	it("keeps the local kinds when external calls are off", () => {
		expect(backgroundPaintable(bg("color", "#123456"), true)).toBe(true);
		expect(backgroundPaintable(bg("image", "Assets/wall.png"), true)).toBe(true);
		expect(backgroundPaintable(bg("weather", "50.1,14.4,Prague"), true)).toBe(true);
	});
});

describe("bannerActive with external calls off", () => {
	it("reserves no strip for a picture that will not be fetched", () => {
		const s = settings();
		s.backgroundKind = "url";
		s.backgroundValue = "https://attacker.example/bg.png?u=1";
		s.backgroundLayout = "banner";
		expect(bannerActive(s)).toBe(true);

		s.disableExternalCalls = true;
		expect(bannerActive(s)).toBe(false);
		// The setting is untouched: turn the switch off again and the banner is
		// back, wallpaper and all.
		expect(effectiveBackground(s).value).toBe("https://attacker.example/bg.png?u=1");
	});

	it("leaves a vault picture's banner standing", () => {
		const s = settings();
		s.backgroundKind = "image";
		s.backgroundValue = "Assets/wall.png";
		s.backgroundLayout = "banner";
		s.disableExternalCalls = true;
		expect(bannerActive(s)).toBe(true);
	});
});

describe("titleIconBlocked", () => {
	it("blocks a web address, and only while the switch is on", () => {
		const icon = classify("https://attacker.example/i.png?u=1");
		expect(icon.kind).toBe("url");
		expect(titleIconBlocked(icon, true)).toBe(true);
		expect(titleIconBlocked(icon, false)).toBe(false);
	});

	it("never blocks a mark that is drawn locally", () => {
		for (const raw of ["Assets/me.png", "🔥", "AB", "data:image/png;base64,AAAA"]) {
			expect(titleIconBlocked(classify(raw), true)).toBe(false);
		}
		expect(titleIconBlocked(classify(""), true)).toBe(false);
	});
});
