import { describe, expect, it } from "vitest";
import { dailyNameMatcher } from "../src/dailyformat";

/**
 * Reading a date back out of a daily-note filename (issue #229). The point of
 * the matcher is that the weekday in a name like "Wed, 19.08.2026" is noise:
 * whatever locale wrote it, the numbers still say which day it is.
 */

describe("dailyNameMatcher", () => {
	it("reads a plain ISO format without calling it locale-dependent", () => {
		const m = dailyNameMatcher("YYYY-MM-DD");
		expect(m?.localeDependent).toBe(false);
		expect(m?.dayKey("2026-08-19")).toBe("2026-08-19");
		expect(m?.dayKey("2026-08-19 notes")).toBeNull();
		expect(m?.dayKey("Random")).toBeNull();
	});

	it("ignores the weekday in a locale-dependent format", () => {
		const m = dailyNameMatcher("dd, DD.MM.YYYY");
		expect(m?.localeDependent).toBe(true);
		// Same day, three locales' short weekday names — all resolve.
		expect(m?.dayKey("Wed, 19.08.2026")).toBe("2026-08-19");
		expect(m?.dayKey("Mi, 19.08.2026")).toBe("2026-08-19");
		expect(m?.dayKey("st, 19.08.2026")).toBe("2026-08-19");
		expect(m?.dayKey("19.08.2026")).toBeNull();
	});

	it("handles long weekday names and other separators", () => {
		const m = dailyNameMatcher("dddd D MMMM");
		// A spelled-out month can't be read back without knowing the locale.
		expect(m).toBeNull();
		const ok = dailyNameMatcher("dddd YYYY-MM-DD");
		expect(ok?.localeDependent).toBe(true);
		expect(ok?.dayKey("Wednesday 2026-08-19")).toBe("2026-08-19");
	});

	it("honours moment's [escaped] literals", () => {
		const m = dailyNameMatcher("[Daily] YYYY-MM-DD");
		expect(m?.dayKey("Daily 2026-08-19")).toBe("2026-08-19");
		expect(m?.dayKey("2026-08-19")).toBeNull();
		// A literal token inside brackets stays literal, not a wildcard.
		const lit = dailyNameMatcher("[dd] YYYY-MM-DD");
		expect(lit?.localeDependent).toBe(false);
		expect(lit?.dayKey("dd 2026-08-19")).toBe("2026-08-19");
		expect(lit?.dayKey("Wed 2026-08-19")).toBeNull();
	});

	it("supports nested folder formats and time tokens", () => {
		const nested = dailyNameMatcher("YYYY/MM/YYYY-MM-DD");
		expect(nested?.dayKey("2026/08/2026-08-19")).toBe("2026-08-19");
		const timed = dailyNameMatcher("YYYY-MM-DD HHmm");
		expect(timed?.dayKey("2026-08-19 0930")).toBe("2026-08-19");
	});

	it("reads an ordinal day whatever suffix the locale spells", () => {
		const m = dailyNameMatcher("Do MM YYYY");
		expect(m?.localeDependent).toBe(true);
		expect(m?.dayKey("19th 08 2026")).toBe("2026-08-19");
		expect(m?.dayKey("19e 08 2026")).toBe("2026-08-19");
		expect(m?.dayKey("1st 08 2026")).toBe("2026-08-01");
	});

	it("expands a two-digit year the way moment does", () => {
		const m = dailyNameMatcher("DD.MM.YY");
		expect(m?.dayKey("19.08.26")).toBe("2026-08-19");
		expect(m?.dayKey("19.08.99")).toBe("1999-08-19");
	});

	it("rejects a name that matches the shape but isn't a real date", () => {
		const m = dailyNameMatcher("YYYY-MM-DD");
		expect(m?.dayKey("2026-02-31")).toBeNull();
		expect(m?.dayKey("2026-13-01")).toBeNull();
	});

	it("declines formats it can't invert", () => {
		// No day at all — a weekly note, not a daily one.
		expect(dailyNameMatcher("YYYY-[W]ww")).toBeNull();
		// Day of year, ISO week year: nothing to read the calendar date from.
		expect(dailyNameMatcher("YYYY-DDD")).toBeNull();
		expect(dailyNameMatcher("gggg-MM-DD")).toBeNull();
		expect(dailyNameMatcher("")).toBeNull();
	});

	it("keeps group numbering stable when a token repeats", () => {
		const m = dailyNameMatcher("YYYY-MM-DD (YYYY)");
		expect(m?.dayKey("2026-08-19 (2026)")).toBe("2026-08-19");
	});
});
