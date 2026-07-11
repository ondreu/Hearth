import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate, parseNaturalDate } from "../src/dates";

/**
 * Date logic is the classic trap: without a frozen clock the same test passes
 * or fails depending on the day it runs. Every test here pins "now" with
 * vi.setSystemTime (noon UTC, so no timezone offset can flip the calendar day)
 * before touching the parser. TZ is forced to UTC in vitest.config.ts.
 */

/** Freeze the clock at noon UTC on the given YYYY-MM-DD. */
function freezeAt(isoDay: string): void {
	vi.setSystemTime(new Date(`${isoDay}T12:00:00Z`));
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("parseNaturalDate — relative words", () => {
	beforeEach(() => freezeAt("2026-07-15")); // a Wednesday

	it("today / tonight / now → the frozen day", () => {
		expect(parseNaturalDate("today")).toBe("2026-07-15");
		expect(parseNaturalDate("tonight")).toBe("2026-07-15");
		expect(parseNaturalDate("now")).toBe("2026-07-15");
	});

	it("tomorrow / tmrw", () => {
		expect(parseNaturalDate("tomorrow")).toBe("2026-07-16");
		expect(parseNaturalDate("tmrw")).toBe("2026-07-16");
	});

	it("yesterday", () => {
		expect(parseNaturalDate("yesterday")).toBe("2026-07-14");
	});

	it("is case- and whitespace-insensitive", () => {
		expect(parseNaturalDate("  ToMoRRoW  ")).toBe("2026-07-16");
	});
});

describe("parseNaturalDate — offsets", () => {
	beforeEach(() => freezeAt("2026-07-15"));

	it('"in N days/weeks/months"', () => {
		expect(parseNaturalDate("in 3 days")).toBe("2026-07-18");
		expect(parseNaturalDate("in 2 weeks")).toBe("2026-07-29");
		expect(parseNaturalDate("in 1 month")).toBe("2026-08-15");
	});

	it('bare "N days" (implicit in)', () => {
		expect(parseNaturalDate("3 days")).toBe("2026-07-18");
		expect(parseNaturalDate("1 week")).toBe("2026-07-22");
	});

	it('"next week/month/year"', () => {
		expect(parseNaturalDate("next week")).toBe("2026-07-22");
		expect(parseNaturalDate("next month")).toBe("2026-08-15");
		expect(parseNaturalDate("next year")).toBe("2027-07-15");
	});

	it('"end of week/month/year" and short forms', () => {
		expect(parseNaturalDate("end of week")).toBe("2026-07-18"); // en locale: week ends Saturday
		expect(parseNaturalDate("end of month")).toBe("2026-07-31");
		expect(parseNaturalDate("end of year")).toBe("2026-12-31");
		expect(parseNaturalDate("eom")).toBe("2026-07-31");
		expect(parseNaturalDate("eoy")).toBe("2026-12-31");
	});

	it('"start of month/year"', () => {
		expect(parseNaturalDate("start of month")).toBe("2026-07-01");
		expect(parseNaturalDate("start of year")).toBe("2026-01-01");
	});
});

describe("parseNaturalDate — weekdays (next occurrence)", () => {
	it("bare weekday rolls forward to the next such day", () => {
		freezeAt("2026-07-15"); // Wednesday
		expect(parseNaturalDate("friday")).toBe("2026-07-17");
		expect(parseNaturalDate("monday")).toBe("2026-07-20");
	});

	it("accepts Czech weekday names", () => {
		freezeAt("2026-07-15"); // Wednesday
		expect(parseNaturalDate("pátek")).toBe("2026-07-17"); // Friday
		expect(parseNaturalDate("pondělí")).toBe("2026-07-20"); // Monday
	});

	// The reason today-is-Friday is called out as an edge case: the three
	// weekday phrasings must diverge only when the target equals today.
	describe("when today IS the named weekday (Friday)", () => {
		beforeEach(() => freezeAt("2026-07-10")); // a Friday

		it('bare "friday" resolves to today', () => {
			expect(parseNaturalDate("friday")).toBe("2026-07-10");
		});

		it('"this friday" resolves to today', () => {
			expect(parseNaturalDate("this friday")).toBe("2026-07-10");
		});

		it('"next friday" rolls to the following week', () => {
			expect(parseNaturalDate("next friday")).toBe("2026-07-17");
		});
	});
});

describe("parseNaturalDate — ISO passthrough", () => {
	beforeEach(() => freezeAt("2026-07-15"));

	it("returns a valid ISO date unchanged", () => {
		expect(parseNaturalDate("2026-03-09")).toBe("2026-03-09");
	});
});

describe("parseNaturalDate — month & year boundaries", () => {
	it("tomorrow crosses into the new year", () => {
		freezeAt("2026-12-31"); // New Year's Eve
		expect(parseNaturalDate("tomorrow")).toBe("2027-01-01");
	});

	it('"next year" and "end of year" at year end', () => {
		freezeAt("2026-12-31");
		expect(parseNaturalDate("next year")).toBe("2027-12-31");
		expect(parseNaturalDate("end of year")).toBe("2026-12-31");
	});

	it("tomorrow crosses into the new month", () => {
		freezeAt("2026-01-31");
		expect(parseNaturalDate("tomorrow")).toBe("2026-02-01");
	});

	it('"in 1 month" from Jan 31 clamps to end of February (non-leap 2026)', () => {
		freezeAt("2026-01-31");
		expect(parseNaturalDate("in 1 month")).toBe("2026-02-28");
	});

	it("tomorrow from Feb 28 lands on Mar 1 (2026 is not a leap year)", () => {
		freezeAt("2026-02-28");
		expect(parseNaturalDate("tomorrow")).toBe("2026-03-01");
	});
});

describe("parseNaturalDate — unrecognised input", () => {
	beforeEach(() => freezeAt("2026-07-15"));

	it("returns null for empty / whitespace input", () => {
		expect(parseNaturalDate("")).toBeNull();
		expect(parseNaturalDate("   ")).toBeNull();
	});

	it('returns null for gibberish ("blabla")', () => {
		expect(parseNaturalDate("blabla")).toBeNull();
	});

	it('returns null for an unparseable localized string ("31. února")', () => {
		expect(parseNaturalDate("31. února")).toBeNull();
	});

	// Regression: an ISO-shaped but calendar-invalid date must be rejected.
	// Previously the guard `if (!m.isValid) return null` never fired (moment's
	// isValid is a *method*, so the property reference was always truthy) and
	// the invalid moment formatted to the literal string "Invalid date".
	it('returns null for "2026-02-31" (Feb 31 doesn\'t exist)', () => {
		expect(parseNaturalDate("2026-02-31")).toBeNull();
	});

	it('returns null for "2026-13-01" (there is no month 13)', () => {
		expect(parseNaturalDate("2026-13-01")).toBeNull();
	});
});

describe("formatRelativeDate", () => {
	beforeEach(() => freezeAt("2026-07-15")); // Wednesday

	it("Today / Tomorrow / Yesterday", () => {
		expect(formatRelativeDate("2026-07-15")).toBe("Today");
		expect(formatRelativeDate("2026-07-16")).toBe("Tomorrow");
		expect(formatRelativeDate("2026-07-14")).toBe("Yesterday");
	});

	it("names the weekday for the next few days", () => {
		expect(formatRelativeDate("2026-07-17")).toBe("Friday"); // +2
		expect(formatRelativeDate("2026-07-18")).toBe("Saturday"); // +3
	});

	it('"N days ago" for the past few days', () => {
		expect(formatRelativeDate("2026-07-13")).toBe("2 days ago");
	});

	it('"Next <weekday>" / "Last <weekday>" for the surrounding week', () => {
		expect(formatRelativeDate("2026-07-22")).toBe("Next Wednesday"); // +7
		expect(formatRelativeDate("2026-07-08")).toBe("Last Wednesday"); // -7
	});

	it('falls back to compact "D MMM" beyond two weeks', () => {
		expect(formatRelativeDate("2026-08-15")).toBe("15 Aug");
	});

	it("strips a time component before comparing", () => {
		expect(formatRelativeDate("2026-07-16T09:30:00")).toBe("Tomorrow");
	});

	// Regression: an unparseable input must echo the raw string verbatim (per
	// the doc-comment), not format an invalid moment to "Invalid date". Same
	// root cause as the parseNaturalDate case — the isValid guard now fires.
	it("echoes the raw string verbatim when it can't be parsed", () => {
		expect(formatRelativeDate("blabla")).toBe("blabla");
	});
});
