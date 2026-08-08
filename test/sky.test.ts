import { describe, expect, it } from "vitest";
import {
	cloudField,
	daylightFromHour,
	formatSkyValue,
	parseSkyValue,
	resolveDaylight,
	SKY_GROUPS,
	skyGroupCode,
	starField,
} from "../src/sky";
import { weatherGroup } from "../src/weather";

/**
 * The sky's pure half: which sky a background is set to, and the generated
 * star/cloud fields behind a board-sized one. The drawing itself is SVG in a
 * DOM and stays untested here (see the preview harness in the PR notes); what
 * is covered is everything that decides *what* gets drawn.
 */

describe("packing a sky background", () => {
	it("round-trips a live place", () => {
		const value = formatSkyValue({
			mode: "live",
			place: { name: "Prague", lat: 50.0755, lon: 14.4378 },
		});
		expect(value).toBe("50.0755,14.4378,Prague");
		expect(parseSkyValue(value)).toEqual({
			mode: "live",
			place: { name: "Prague", lat: 50.0755, lon: 14.4378 },
		});
	});

	it("keeps a place name that contains a comma", () => {
		// The name goes last precisely so it can hold "Praha, Czechia".
		const value = formatSkyValue({
			mode: "live",
			place: { name: "Praha, Czechia", lat: 50.0755, lon: 14.4378 },
		});
		expect(parseSkyValue(value)).toMatchObject({
			mode: "live",
			place: { name: "Praha, Czechia" },
		});
	});

	it("round-trips a fixed sky", () => {
		const value = formatSkyValue({ mode: "fixed", group: "snow", daylight: "night" });
		expect(value).toBe("fixed:snow:night");
		expect(parseSkyValue(value)).toEqual({
			mode: "fixed",
			group: "snow",
			daylight: "night",
		});
	});

	it("round-trips every condition a fixed sky can be pinned to", () => {
		for (const group of SKY_GROUPS) {
			const value = formatSkyValue({ mode: "fixed", group, daylight: "auto" });
			expect(parseSkyValue(value), group).toEqual({ mode: "fixed", group, daylight: "auto" });
		}
	});

	it("tells a fixed sky from a place without ambiguity", () => {
		// A packed place always starts with a number, so the "fixed:" prefix can
		// never be one — which is what lets both live in the same field.
		expect(parseSkyValue("fixed:rain:day")?.mode).toBe("fixed");
		expect(parseSkyValue("50.07,14.44")?.mode).toBe("live");
	});

	it("falls back to following the clock on an unknown daylight", () => {
		expect(parseSkyValue("fixed:rain:whenever")).toEqual({
			mode: "fixed",
			group: "rain",
			daylight: "auto",
		});
		expect(parseSkyValue("fixed:rain")).toMatchObject({ daylight: "auto" });
	});

	it("rejects anything that is neither", () => {
		// Chiefly a value left behind by a previous background kind.
		expect(parseSkyValue("")).toBeNull();
		expect(parseSkyValue("#1e1e2e")).toBeNull();
		expect(parseSkyValue("Attachments/bg.png")).toBeNull();
		expect(parseSkyValue("https://example.com/sky.jpg")).toBeNull();
		expect(parseSkyValue("fixed:hurricane:day")).toBeNull();
		// Coordinates off the globe.
		expect(parseSkyValue("500,14")).toBeNull();
	});

	it("drops a name that is only whitespace rather than storing a trailing comma", () => {
		expect(formatSkyValue({ mode: "live", place: { name: "  ", lat: 1, lon: 2 } })).toBe(
			"1.0000,2.0000",
		);
	});
});

describe("fixed sky conditions", () => {
	it("gives every group a code that classifies back to it", () => {
		// The stand-in code has to round-trip, or picking "Snow" would paint rain.
		for (const group of SKY_GROUPS) {
			expect(weatherGroup(skyGroupCode(group)), group).toBe(group);
		}
	});

	it("offers every group the drawing knows", () => {
		expect([...SKY_GROUPS].sort()).toEqual([
			"clear",
			"cloudy",
			"drizzle",
			"fog",
			"partly",
			"rain",
			"snow",
			"thunder",
		]);
	});
});

describe("daylight", () => {
	it("calls the middle of the day day, and the small hours night", () => {
		expect(daylightFromHour(12)).toBe(true);
		expect(daylightFromHour(7)).toBe(true);
		expect(daylightFromHour(19)).toBe(true);
		expect(daylightFromHour(20)).toBe(false);
		expect(daylightFromHour(3)).toBe(false);
		expect(daylightFromHour(0)).toBe(false);
	});

	it("lets a fixed sky override the clock in both directions", () => {
		expect(resolveDaylight("day", 3)).toBe(true);
		expect(resolveDaylight("night", 12)).toBe(false);
		expect(resolveDaylight("auto", 12)).toBe(true);
		expect(resolveDaylight("auto", 3)).toBe(false);
	});
});

describe("generated fields", () => {
	it("deals the same sky every time for a given seed", () => {
		// The whole reason the generator is seeded: a redraw (every forecast
		// refresh, every dashboard switch) must not reshuffle the constellation
		// under the reader.
		expect(starField(12, 400, 200, 99)).toEqual(starField(12, 400, 200, 99));
		expect(cloudField(6, 400, 200, 7)).toEqual(cloudField(6, 400, 200, 7));
	});

	it("deals a different sky for a different seed", () => {
		expect(starField(12, 400, 200, 1)).not.toEqual(starField(12, 400, 200, 2));
	});

	it("keeps stars inside the box and inside their band", () => {
		for (const star of starField(60, 400, 200, 5, 0.85)) {
			expect(star.x).toBeGreaterThanOrEqual(0);
			expect(star.x).toBeLessThanOrEqual(400);
			expect(star.y).toBeGreaterThanOrEqual(0);
			expect(star.y).toBeLessThanOrEqual(200 * 0.85);
			expect(star.r).toBeGreaterThan(0);
		}
	});

	it("keeps clouds in their band and spread across the three drift lanes", () => {
		const clouds = cloudField(9, 400, 200, 11, 0.08, 0.62);
		for (const cloud of clouds) {
			expect(cloud.x).toBeGreaterThanOrEqual(0);
			expect(cloud.x).toBeLessThanOrEqual(400);
			expect(cloud.y).toBeGreaterThanOrEqual(200 * 0.08);
			expect(cloud.y).toBeLessThanOrEqual(200 * 0.7);
			expect(cloud.scale).toBeGreaterThan(0);
		}
		expect(new Set(clouds.map((c) => c.lane))).toEqual(new Set([1, 2, 3]));
	});

	it("asks for nothing when asked for nothing", () => {
		expect(starField(0, 400, 200, 1)).toEqual([]);
		expect(cloudField(0, 400, 200, 1)).toEqual([]);
	});
});
