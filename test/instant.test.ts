import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currencyConversion } from "../src/calculator";
import {
	daysBetween,
	detectInstant,
	formatOffset,
	instantOnly,
	instantTakesEnter,
	isoWeek,
	resolveZone,
	zoneOffsetMinutes,
} from "../src/instant";

/**
 * The search bar's instant answers: which queries get one, and which are left
 * to the note search. A false positive puts a row above the notes, so most of
 * these pin down what must *not* be read as a sum, a date or a lookup.
 */

const ZONES = ["Europe/Prague", "Asia/Tokyo", "America/New_York", "America/Sao_Paulo", "UTC"];

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-15T12:00:00Z")); // a Wednesday
});
afterEach(() => {
	vi.useRealTimers();
});

describe("detectInstant — calculations", () => {
	it("answers arithmetic and unit conversions", () => {
		expect(detectInstant("1+1")).toEqual({ kind: "calc", input: "1+1", forced: false });
		expect(detectInstant("20% of 150")?.kind).toBe("calc");
		expect(detectInstant("10 km to miles")?.kind).toBe("calc");
		expect(detectInstant("sqrt(16)")?.kind).toBe("calc");
	});

	it("leaves numbers, dates and times of day to the note search", () => {
		expect(detectInstant("2026")).toBeNull();
		expect(detectInstant("-5")).toBeNull();
		expect(detectInstant("1,000.5")).toBeNull();
		expect(detectInstant("2026-10-02")).toBeNull();
		expect(detectInstant("2026-10")).toBeNull();
		expect(detectInstant("2.10.2026")).toBeNull();
		expect(detectInstant("10/2")).toBeNull();
		expect(detectInstant("10:30")).toBeNull();
	});

	it("leaves words and note names alone", () => {
		expect(detectInstant("meeting notes")).toBeNull();
		expect(detectInstant("project 2")).toBeNull();
		expect(detectInstant("pi")).toBeNull();
		expect(detectInstant("#tag")).toBeNull();
	});

	it("= forces the calculator, errors included", () => {
		expect(detectInstant("=2026-10")).toEqual({ kind: "calc", input: "2026-10", forced: true });
		expect(detectInstant("= foo")).toEqual({ kind: "calc", input: "foo", forced: true });
		expect(detectInstant("=")).toBeNull();
	});
});

describe("detectInstant — currencies", () => {
	it("reads a conversion with an amount", () => {
		expect(detectInstant("20CZK to EUR")).toEqual({
			kind: "currency",
			input: "20CZK to EUR",
			from: "czk",
			to: "eur",
		});
		expect(detectInstant("10 € in usd")).toMatchObject({ from: "eur", to: "usd" });
		expect(detectInstant("$5 to czk")).toMatchObject({ kind: "currency", from: "usd", to: "czk" });
	});

	it("asks for one unit when no amount is given", () => {
		expect(detectInstant("czk to eur")).toEqual({
			kind: "currency",
			input: "1 czk to eur",
			from: "czk",
			to: "eur",
		});
		expect(detectInstant("EUR/USD")).toEqual({ kind: "currency", input: "1 eur to usd", from: "eur", to: "usd" });
	});

	it("isn't fooled by a path or an unknown code", () => {
		expect(detectInstant("src/app")).toBeNull();
		expect(detectInstant("eur/eur")).toBeNull();
		expect(detectInstant("10 km to eur")).toBeNull();
	});

	it("currencyConversion reads the calculator's grammar", () => {
		expect(currencyConversion("what is 20 czk in eur?")).toEqual({ from: "czk", to: "eur", hasAmount: true });
		expect(currencyConversion("usd to czk")).toEqual({ from: "usd", to: "czk", hasAmount: false });
		expect(currencyConversion("10 km to miles")).toBeNull();
	});
});

describe("detectInstant — market lookups", () => {
	it("a $ before a letter is a lookup", () => {
		expect(detectInstant("$AAPL")).toEqual({ kind: "market", query: "AAPL" });
		expect(detectInstant("$ apple")).toEqual({ kind: "market", query: "apple" });
		expect(detectInstant("$sh510300")).toEqual({ kind: "market", query: "sh510300" });
		expect(detectInstant("$")).toBeNull();
	});

	it("a lookup and a forced sum stand alone; a date shares Enter", () => {
		expect(instantOnly({ kind: "market", query: "x" })).toBe(true);
		expect(instantOnly({ kind: "calc", input: "1", forced: true })).toBe(true);
		expect(instantOnly({ kind: "calc", input: "1+1", forced: false })).toBe(false);
		expect(instantTakesEnter({ kind: "date", date: "2026-07-15" })).toBe(false);
		expect(instantTakesEnter({ kind: "calc", input: "1+1", forced: false })).toBe(true);
	});
});

describe("detectInstant — dates", () => {
	it("answers date phrases", () => {
		expect(detectInstant("tomorrow")).toEqual({ kind: "date", date: "2026-07-16" });
		expect(detectInstant("next friday")).toEqual({ kind: "date", date: "2026-07-17" });
		expect(detectInstant("in 3 weeks")).toEqual({ kind: "date", date: "2026-08-05" });
		expect(detectInstant("end of month")).toEqual({ kind: "date", date: "2026-07-31" });
	});

	it("shifts a date by days, weeks, months or years", () => {
		expect(detectInstant("today + 45 days")).toEqual({ kind: "date", date: "2026-08-29" });
		expect(detectInstant("today - 2w")).toEqual({ kind: "date", date: "2026-07-01" });
		expect(detectInstant("2026-01-31 + 1 month")).toEqual({ kind: "date", date: "2026-02-28" });
	});

	it("counts days to or from a date", () => {
		expect(detectInstant("days until 2026-12-24")).toEqual({ kind: "date", date: "2026-12-24", count: "until" });
		expect(detectInstant("days since 2026-01-01")).toEqual({ kind: "date", date: "2026-01-01", count: "since" });
		expect(detectInstant("days until someday")).toBeNull();
	});

	it("a bare weekday or date is a daily note's name, not a question", () => {
		expect(detectInstant("friday")).toBeNull();
		expect(detectInstant("2026-07-15")).toBeNull();
	});

	it("daysBetween and isoWeek", () => {
		expect(daysBetween("2026-07-15", "2026-12-24")).toBe(162);
		expect(daysBetween("2026-07-15", "2026-07-14")).toBe(-1);
		expect(isoWeek("2026-07-15")).toBe(29);
		expect(isoWeek("2026-01-01")).toBe(1);
		expect(isoWeek("2027-01-01")).toBe(53);
	});
});

describe("detectInstant — time zones", () => {
	it("answers the time somewhere", () => {
		expect(detectInstant("time in Tokyo", ZONES)).toEqual({ kind: "time", zone: "Asia/Tokyo", place: "tokyo" });
		expect(detectInstant("new york time", ZONES)).toMatchObject({ zone: "America/New_York" });
		expect(detectInstant("čas v Praze", ZONES)).toMatchObject({ zone: "Europe/Prague" });
		expect(detectInstant("time in sao paulo", ZONES)).toMatchObject({ zone: "America/Sao_Paulo" });
	});

	it("leaves a phrase that names no place", () => {
		expect(detectInstant("screen time", ZONES)).toBeNull();
		expect(detectInstant("time in the garden", ZONES)).toBeNull();
	});

	it("resolveZone takes a city, a zone name or an alias", () => {
		expect(resolveZone("Europe/Prague", ZONES)).toBe("Europe/Prague");
		expect(resolveZone("NYC", ZONES)).toBe("America/New_York");
		expect(resolveZone("nowhere", ZONES)).toBeNull();
	});

	it("zoneOffsetMinutes and formatOffset", () => {
		const july = new Date("2026-07-15T12:00:00Z");
		expect(zoneOffsetMinutes("Asia/Tokyo", july)).toBe(540);
		expect(zoneOffsetMinutes("Europe/Prague", july)).toBe(120);
		expect(zoneOffsetMinutes("America/New_York", july)).toBe(-240);
		expect(zoneOffsetMinutes("Not/AZone", july)).toBeNull();
		expect(formatOffset(540)).toBe("+9");
		expect(formatOffset(-330)).toBe("−5:30");
		expect(formatOffset(0)).toBe("±0");
	});
});
