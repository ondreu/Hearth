import { describe, expect, it } from "vitest";
import {
	eventsByDay,
	expandEvents,
	parseIcs,
	parseIcsDate,
	type IcsEvent,
	type IcsOccurrence,
} from "../src/ics";

/**
 * The ICS reader is tested against real-world calendar shapes. vitest forces
 * TZ=UTC (see vitest.config.ts), so the local-time paths below resolve to UTC
 * and every epoch assertion is deterministic.
 */

/** Wrap VEVENT body lines in a minimal VCALENDAR. */
function cal(...vevents: string[]): string {
	return ["BEGIN:VCALENDAR", "VERSION:2.0", ...vevents, "END:VCALENDAR"].join("\r\n");
}

function vevent(...lines: string[]): string {
	return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
}

describe("parseIcs — basic parsing", () => {
	it("returns null for non-calendar text", () => {
		expect(parseIcs("just some text")).toBeNull();
	});

	it("reads a timed event's fields", () => {
		const doc = cal(
			vevent(
				"UID:abc@example.com",
				"SUMMARY:Team sync",
				"LOCATION:Room 4",
				"DTSTART:20260720T090000Z",
				"DTEND:20260720T100000Z",
			),
		);
		const parsed = parseIcs(doc);
		expect(parsed).not.toBeNull();
		const ev = parsed!.events[0];
		expect(ev.summary).toBe("Team sync");
		expect(ev.location).toBe("Room 4");
		expect(ev.allDay).toBe(false);
		expect(ev.start).toBe(Date.UTC(2026, 6, 20, 9, 0, 0));
		expect(ev.end).toBe(Date.UTC(2026, 6, 20, 10, 0, 0));
	});

	it("detects all-day events (VALUE=DATE / 8-digit)", () => {
		const doc = cal(
			vevent("SUMMARY:Holiday", "DTSTART;VALUE=DATE:20260720", "DTEND;VALUE=DATE:20260721"),
		);
		const ev = parseIcs(doc)!.events[0];
		expect(ev.allDay).toBe(true);
		expect(ev.start).toBe(new Date(2026, 6, 20).getTime());
	});

	it("reads the calendar name from X-WR-CALNAME", () => {
		const doc = [
			"BEGIN:VCALENDAR",
			"X-WR-CALNAME:Work",
			vevent("SUMMARY:x", "DTSTART:20260720T090000Z"),
			"END:VCALENDAR",
		].join("\r\n");
		expect(parseIcs(doc)!.name).toBe("Work");
	});

	it("unfolds RFC 5545 continuation lines (one leading space stripped)", () => {
		const doc = cal(
			vevent("SUMMARY:A very long title that the\r\n  server folded", "DTSTART:20260720T090000Z"),
		);
		expect(parseIcs(doc)!.events[0].summary).toBe("A very long title that the server folded");
	});

	it("unescapes text (\\, \\; \\n)", () => {
		const doc = cal(vevent("SUMMARY:Lunch\\, then\\; walk\\nhome", "DTSTART:20260720T090000Z"));
		expect(parseIcs(doc)!.events[0].summary).toBe("Lunch, then; walk\nhome");
	});

	it("reads DESCRIPTION and URL", () => {
		const doc = cal(
			vevent(
				"SUMMARY:x",
				"DTSTART:20260720T090000Z",
				"DESCRIPTION:Bring the deck\\nand a laptop",
				"URL:https://example.com/mtg",
			),
		);
		const ev = parseIcs(doc)!.events[0];
		expect(ev.description).toBe("Bring the deck\nand a laptop");
		expect(ev.url).toBe("https://example.com/mtg");
	});

	it("derives end from DURATION when DTEND is absent", () => {
		const doc = cal(vevent("SUMMARY:x", "DTSTART:20260720T090000Z", "DURATION:PT90M"));
		const ev = parseIcs(doc)!.events[0];
		expect(ev.end).toBe(Date.UTC(2026, 6, 20, 10, 30, 0));
	});

	it("skips a VEVENT with no DTSTART", () => {
		const doc = cal(vevent("SUMMARY:no start"));
		expect(parseIcs(doc)!.events).toHaveLength(0);
	});

	it("ignores VTIMEZONE blocks (their DTSTART/RRULE must not leak)", () => {
		const doc = [
			"BEGIN:VCALENDAR",
			"BEGIN:VTIMEZONE",
			"TZID:America/New_York",
			"BEGIN:DAYLIGHT",
			"DTSTART:20070311T020000",
			"RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
			"END:DAYLIGHT",
			"END:VTIMEZONE",
			vevent("SUMMARY:Real", "DTSTART:20260720T090000Z"),
			"END:VCALENDAR",
		].join("\r\n");
		const parsed = parseIcs(doc)!;
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0].summary).toBe("Real");
		expect(parsed.events[0].rrule).toBeNull();
	});
});

describe("parseIcsDate", () => {
	it("parses UTC datetimes", () => {
		expect(parseIcsDate("20260720T130000Z")).toBe(Date.UTC(2026, 6, 20, 13, 0, 0));
	});
	it("parses date-only values to local midnight", () => {
		expect(parseIcsDate("20260720")).toBe(new Date(2026, 6, 20).getTime());
	});
	it("parses floating/TZID datetimes as local wall-clock", () => {
		// TZID is intentionally ignored (see module note) — treated as local.
		expect(parseIcsDate("20260720T090000", { TZID: "Europe/Paris" })).toBe(
			new Date(2026, 6, 20, 9, 0, 0).getTime(),
		);
	});
	it("returns null for garbage", () => {
		expect(parseIcsDate("not-a-date")).toBeNull();
	});
});

/** Build a one-off IcsEvent for expansion tests. */
function ev(partial: Partial<IcsEvent> & { start: number }): IcsEvent {
	return {
		uid: "u",
		summary: "e",
		location: "",
		description: "",
		url: "",
		end: null,
		allDay: false,
		rrule: null,
		exdates: [],
		...partial,
	};
}

describe("expandEvents — one-offs", () => {
	it("emits an event that overlaps the window", () => {
		const start = Date.UTC(2026, 6, 20, 9);
		const occ = expandEvents([ev({ start, end: start + 3600_000 })], start - 1, start + 1);
		expect(occ).toHaveLength(1);
		expect(occ[0].start).toBe(start);
	});
	it("drops an event outside the window", () => {
		const start = Date.UTC(2026, 6, 20, 9);
		const occ = expandEvents([ev({ start })], start + 10, start + 20);
		expect(occ).toHaveLength(0);
	});
});

describe("expandEvents — recurrence", () => {
	const base = Date.UTC(2026, 6, 20, 9); // Mon 20 Jul 2026
	const day = 86400_000;

	it("expands a daily rule across the window", () => {
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=DAILY" })],
			base,
			base + 5 * day,
		);
		expect(occ.map((o) => o.start)).toEqual([
			base,
			base + day,
			base + 2 * day,
			base + 3 * day,
			base + 4 * day,
		]);
	});

	it("honours INTERVAL", () => {
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=DAILY;INTERVAL=2" })],
			base,
			base + 5 * day,
		);
		expect(occ.map((o) => o.start)).toEqual([base, base + 2 * day, base + 4 * day]);
	});

	it("honours COUNT", () => {
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=DAILY;COUNT=3" })],
			base,
			base + 30 * day,
		);
		expect(occ).toHaveLength(3);
	});

	it("honours UNTIL", () => {
		const until = "20260722T090000Z"; // inclusive of the 22nd
		const occ = expandEvents(
			[ev({ start: base, rrule: `FREQ=DAILY;UNTIL=${until}` })],
			base,
			base + 30 * day,
		);
		expect(occ.map((o) => o.start)).toEqual([base, base + day, base + 2 * day]);
	});

	it("excludes EXDATE occurrences", () => {
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=DAILY;COUNT=3", exdates: [base + day] })],
			base,
			base + 30 * day,
		);
		expect(occ.map((o) => o.start)).toEqual([base, base + 2 * day]);
	});

	it("expands weekly BYDAY across multiple weekdays", () => {
		// Mon start; MO,WE,FR over two weeks.
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" })],
			base,
			base + 8 * day,
		);
		// Mon20, Wed22, Fri24, Mon27 (within [base, base+8d)).
		expect(occ.map((o) => o.start).sort((a, b) => a - b)).toEqual([
			base,
			base + 2 * day,
			base + 4 * day,
			base + 7 * day,
		]);
	});

	it("caps a runaway rule at MAX_OCCURRENCES", () => {
		const occ = expandEvents(
			[ev({ start: base, rrule: "FREQ=DAILY" })],
			base,
			base + 100_000 * day,
		);
		expect(occ.length).toBeLessThanOrEqual(750);
	});
});

describe("eventsByDay", () => {
	/** Build an occurrence with sensible empty defaults for the detail fields. */
	const occ = (o: {
		summary: string;
		start: number;
		end: number | null;
		allDay: boolean;
	}): IcsOccurrence => ({ uid: "u", location: "", description: "", url: "", ...o });

	it("buckets a timed event on its start day", () => {
		const start = Date.UTC(2026, 6, 20, 9);
		const map = eventsByDay([occ({ summary: "x", start, end: start + 3600_000, allDay: false })]);
		expect([...map.keys()]).toEqual(["2026-07-20"]);
	});

	it("spans a multi-day all-day event with an exclusive end", () => {
		// 20th–22nd inclusive means DTEND = 23rd (exclusive).
		const start = new Date(2026, 6, 20).getTime();
		const end = new Date(2026, 6, 23).getTime();
		const map = eventsByDay([occ({ summary: "trip", start, end, allDay: true })]);
		expect([...map.keys()].sort()).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
	});

	it("sorts all-day events before timed ones within a day", () => {
		const timed = Date.UTC(2026, 6, 20, 9);
		const allDayStart = new Date(2026, 6, 20).getTime();
		const map = eventsByDay([
			occ({ summary: "timed", start: timed, end: null, allDay: false }),
			occ({ summary: "allday", start: allDayStart, end: allDayStart + 86400_000, allDay: true }),
		]);
		expect(map.get("2026-07-20")!.map((o) => o.summary)).toEqual(["allday", "timed"]);
	});
});
