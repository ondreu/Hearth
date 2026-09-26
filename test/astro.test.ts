import { describe, expect, it } from "vitest";
import {
	instantOf,
	minutesInto,
	moonPhase,
	moonPhaseKey,
	moonTimes,
	nextMoonPhase,
	splitMinutes,
	sunArc,
	SYNODIC_MONTH,
	wallClockAt,
} from "../src/astro";
import { arcBox, litPath } from "../src/cards/weatherastro";

/**
 * The moon and daylight styles' clockwork. The low-precision series the moon
 * runs on is good to an hour or two on a phase instant, so the known events
 * below are checked to a few hours — tight enough to land every one on the
 * right day, which is all the card prints.
 */

const HOUR = 3_600_000;

/** The 8 April 2024 total solar eclipse: a new moon at 18:21 UTC. */
const ECLIPSE_NEW = Date.UTC(2024, 3, 8, 18, 21);
/** The full moon after it, 23 April 2024 at 23:49 UTC. */
const APRIL_FULL = Date.UTC(2024, 3, 23, 23, 49);

describe("moonPhase", () => {
	it("is new, and dark, at a solar eclipse", () => {
		const phase = moonPhase(ECLIPSE_NEW);
		expect(phase.key).toBe("new");
		expect(phase.illumination).toBeLessThan(0.01);
	});

	it("is full, and lit, a fortnight later", () => {
		const phase = moonPhase(APRIL_FULL);
		expect(phase.key).toBe("full");
		expect(phase.illumination).toBeGreaterThan(0.99);
		expect(phase.phase).toBeCloseTo(0.5, 1);
	});

	it("waxes between new and full and wanes after", () => {
		const waxing = moonPhase(ECLIPSE_NEW + 7 * 24 * HOUR);
		expect(waxing.waxing).toBe(true);
		expect(waxing.key).toBe("firstQuarter");
		expect(waxing.illumination).toBeGreaterThan(0.4);
		expect(waxing.illumination).toBeLessThan(0.6);

		const waning = moonPhase(APRIL_FULL + 4 * 24 * HOUR);
		expect(waning.waxing).toBe(false);
		expect(waning.key).toBe("waningGibbous");
	});

	it("keeps its age within the month", () => {
		for (let day = 0; day < 60; day += 3) {
			const { age } = moonPhase(ECLIPSE_NEW + day * 24 * HOUR);
			expect(age).toBeGreaterThanOrEqual(0);
			expect(age).toBeLessThan(SYNODIC_MONTH);
		}
	});
});

describe("moonPhaseKey", () => {
	it("gives each principal phase a day either side", () => {
		const day = 1 / SYNODIC_MONTH;
		expect(moonPhaseKey(0)).toBe("new");
		expect(moonPhaseKey(1 - day / 2)).toBe("new");
		expect(moonPhaseKey(day * 1.5)).toBe("waxingCrescent");
		expect(moonPhaseKey(0.25 + day / 2)).toBe("firstQuarter");
		expect(moonPhaseKey(0.4)).toBe("waxingGibbous");
		expect(moonPhaseKey(0.5 - day / 2)).toBe("full");
		expect(moonPhaseKey(0.6)).toBe("waningGibbous");
		expect(moonPhaseKey(0.75)).toBe("lastQuarter");
		expect(moonPhaseKey(0.9)).toBe("waningCrescent");
	});

	it("wraps a phase outside 0–1", () => {
		expect(moonPhaseKey(1.5)).toBe("full");
		expect(moonPhaseKey(-0.25)).toBe("lastQuarter");
	});
});

describe("nextMoonPhase", () => {
	it("finds the next full and new moon to within a few hours", () => {
		const from = Date.UTC(2024, 3, 1);
		expect(Math.abs(nextMoonPhase(from, 0) - ECLIPSE_NEW)).toBeLessThan(4 * HOUR);
		expect(Math.abs(nextMoonPhase(from, 0.5) - APRIL_FULL)).toBeLessThan(4 * HOUR);
	});

	it("never answers with one already past", () => {
		const after = ECLIPSE_NEW + 2 * 24 * HOUR;
		const next = nextMoonPhase(after, 0);
		expect(next).toBeGreaterThan(after);
		expect((next - ECLIPSE_NEW) / (24 * HOUR)).toBeCloseTo(SYNODIC_MONTH, 0);
	});
});

describe("moonTimes", () => {
	it("rises around sunset and sets around sunrise on the night of a full moon", () => {
		// Prague, 23 April 2024, CEST: sunset 20:06, sunrise 05:50.
		const offset = 7200;
		const times = moonTimes(instantOf("2024-04-23", offset), 50.08, 14.44);
		expect(times.rise).not.toBeNull();
		expect(times.set).not.toBeNull();
		const rise = wallClockAt(times.rise!, offset);
		const set = wallClockAt(times.set!, offset);
		expect(rise.slice(0, 10)).toBe("2024-04-23");
		expect(rise.slice(11) >= "18:30" && rise.slice(11) <= "21:30").toBe(true);
		expect(set.slice(11) >= "04:00" && set.slice(11) <= "07:30").toBe(true);
	});

	it("stays inside the day it was asked about", () => {
		const start = instantOf("2026-09-15", 7200);
		const times = moonTimes(start, 50.08, 14.44);
		for (const at of [times.rise, times.set]) {
			if (at === null) continue;
			expect(at).toBeGreaterThanOrEqual(start);
			expect(at).toBeLessThan(start + 25 * HOUR);
		}
	});
});

describe("the location's clock", () => {
	it("reads a wall clock at an offset, and back", () => {
		const at = Date.UTC(2026, 8, 26, 21, 30);
		expect(wallClockAt(at, 7200)).toBe("2026-09-26T23:30");
		expect(wallClockAt(at, 9 * 3600)).toBe("2026-09-27T06:30");
		expect(instantOf("2026-09-26T23:30", 7200)).toBe(at);
		expect(instantOf("2026-09-26", 0)).toBe(Date.UTC(2026, 8, 26));
		expect(Number.isNaN(instantOf("soon", 0))).toBe(true);
	});

	it("counts minutes into a day across midnight", () => {
		expect(minutesInto("2026-06-21", "2026-06-21T04:52")).toBe(292);
		// A northern summer's sunset after midnight, and tomorrow's sunrise.
		expect(minutesInto("2026-06-21", "2026-06-22T00:30")).toBe(1470);
		expect(minutesInto("2026-06-21", "2026-06-22T04:53")).toBe(1733);
		expect(minutesInto("2026-06-21", "")).toBeNull();
	});
});

describe("sunArc", () => {
	const sunrise = 6 * 60;
	const sunset = 18 * 60;

	it("runs the day from sunrise to sunset", () => {
		const noon = sunArc(12 * 60, sunrise, sunset);
		expect(noon).toMatchObject({ isDay: true, progress: 0.5, remaining: 360, dayLength: 720 });
		expect(sunArc(sunrise, sunrise, sunset).progress).toBe(0);
	});

	it("counts down to tomorrow's sunrise after dusk", () => {
		const late = sunArc(22 * 60, sunrise, sunset, 1440 + 6 * 60 + 2);
		expect(late.isDay).toBe(false);
		expect(late.remaining).toBe(8 * 60 + 2);
		expect(late.progress).toBeGreaterThan(0);
		expect(late.progress).toBeLessThan(0.5);
	});

	it("counts down to today's sunrise before dawn", () => {
		const early = sunArc(3 * 60, sunrise, sunset);
		expect(early.isDay).toBe(false);
		expect(early.remaining).toBe(180);
		// Three hours from the end of a twelve-hour night.
		expect(early.progress).toBeCloseTo(0.75, 5);
	});
});

describe("splitMinutes", () => {
	it("splits into hours and minutes, never negative", () => {
		expect(splitMinutes(192)).toEqual({ h: 3, m: 12 });
		expect(splitMinutes(40)).toEqual({ h: 0, m: 40 });
		expect(splitMinutes(-5)).toEqual({ h: 0, m: 0 });
	});
});

describe("litPath", () => {
	const at = (illumination: number, waxing: boolean) =>
		litPath({ phase: 0, illumination, age: 0, waxing, key: "new" }, 50, 50, 36);

	it("draws the limb on the lit side: right while waxing, left while waning", () => {
		expect(at(0.3, true)).toContain("A 36 36 0 0 1 50 86");
		expect(at(0.3, false)).toContain("A 36 36 0 0 0 50 86");
	});

	it("bulges the terminator toward the light for a crescent and away for a gibbous", () => {
		expect(at(0.2, true)).toMatch(/A [\d.]+ 36 0 0 0 50 14 Z$/);
		expect(at(0.8, true)).toMatch(/A [\d.]+ 36 0 0 1 50 14 Z$/);
	});

	it("closes to a straight line at a half moon and a full circle at full", () => {
		expect(at(0.5, true)).toContain("A 0.000 36");
		expect(at(1, true)).toContain("A 36.000 36");
	});
});

describe("arcBox", () => {
	it("keeps the day's arc and the night's dip inside the box", () => {
		for (const [w, h] of [[300, 112], [640, 90], [200, 36], [10, 10]]) {
			const box = arcBox(w, h);
			expect(box.horizon - box.day).toBeGreaterThan(0);
			expect(box.horizon + box.night).toBeLessThanOrEqual(box.h);
			expect(box.day).toBeGreaterThan(box.night);
		}
	});
});

