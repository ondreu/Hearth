import { describe, expect, it } from "vitest";
import {
	applyEventPlaceholders,
	buildEventNote,
	eventFieldValue,
	sanitizeFilename,
	type EventNoteInput,
} from "../src/eventnote";

/**
 * The note builder is pure. vitest forces TZ=UTC, so the local-time paths in
 * date/time formatting resolve to UTC and every assertion is deterministic.
 */

function makeEvent(partial: Partial<EventNoteInput> = {}): EventNoteInput {
	return {
		uid: "evt-1@example.com",
		summary: "Design review",
		location: "Room 4",
		description: "Bring the deck",
		url: "https://example.com/mtg",
		start: Date.UTC(2026, 6, 20, 9, 0),
		end: Date.UTC(2026, 6, 20, 10, 30),
		allDay: false,
		calendar: "Work",
		...partial,
	};
}

describe("eventFieldValue", () => {
	const ev = makeEvent();
	it("returns plain fields verbatim", () => {
		expect(eventFieldValue("summary", ev)).toBe("Design review");
		expect(eventFieldValue("location", ev)).toBe("Room 4");
		expect(eventFieldValue("calendar", ev)).toBe("Work");
	});
	it("formats date and time fields", () => {
		expect(eventFieldValue("date", ev)).toBe("2026-07-20");
		expect(eventFieldValue("start", ev)).toBe("09:00");
		expect(eventFieldValue("end", ev)).toBe("10:30");
	});
	it("honours a custom format", () => {
		expect(eventFieldValue("start", ev, "h:mm A")).toBe("9:00 AM");
		expect(eventFieldValue("date", ev, "DD.MM.YYYY")).toBe("20.07.2026");
	});
	it("all-day events have no clock time (fall back to date)", () => {
		const allDay = makeEvent({ allDay: true });
		expect(eventFieldValue("start", allDay)).toBe("2026-07-20");
	});
	it("returns '' for a missing end", () => {
		expect(eventFieldValue("end", makeEvent({ end: null }))).toBe("");
	});
});

describe("applyEventPlaceholders", () => {
	const ev = makeEvent();
	it("substitutes plain and formatted tokens", () => {
		expect(applyEventPlaceholders("{{summary}} @ {{location}}", ev)).toBe("Design review @ Room 4");
		expect(applyEventPlaceholders("{{date}} {{start:h:mm A}}", ev)).toBe("2026-07-20 9:00 AM");
	});
	it("leaves unknown tokens untouched", () => {
		expect(applyEventPlaceholders("{{unknown}} {{summary}}", ev)).toBe("{{unknown}} Design review");
	});
});

describe("sanitizeFilename", () => {
	it("strips illegal characters and collapses whitespace", () => {
		expect(sanitizeFilename('a/b:c*d?  e')).toBe("a b c d e");
	});
});

describe("buildEventNote — defaults", () => {
	it("routes fields per the default rules and links by UID", () => {
		const built = buildEventNote(makeEvent(), {});
		expect(built.filename).toBe("Design review");
		expect(built.frontmatter).toMatchObject({
			date: "2026-07-20",
			time: "09:00",
			location: "Room 4",
			calendar: "Work",
			event_uid: "evt-1@example.com",
		});
		// Description defaults into the body.
		expect(built.body).toContain("Bring the deck");
	});

	it("omits empty values", () => {
		const built = buildEventNote(makeEvent({ location: "", description: "" }), {});
		expect(built.frontmatter.location).toBeUndefined();
		expect(built.body).toBe("");
	});
});

describe("buildEventNote — custom routing", () => {
	it("ignores everything but the name", () => {
		const built = buildEventNote(makeEvent(), {
			fields: [],
			linkKey: "", // linking off
		});
		expect(built.filename).toBe("Design review");
		expect(built.frontmatter).toEqual({});
		expect(built.body).toBe("");
	});

	it("appends description to the body under a heading", () => {
		const built = buildEventNote(makeEvent(), {
			fields: [{ field: "description", action: "body", key: "Notes" }],
			linkKey: "",
		});
		expect(built.body).toBe("## Notes\n\nBring the deck");
	});

	it("writes a custom frontmatter key with a custom format", () => {
		const built = buildEventNote(makeEvent(), {
			fields: [{ field: "start", action: "frontmatter", key: "starts_at", format: "h:mm A" }],
			linkKey: "",
		});
		expect(built.frontmatter).toEqual({ starts_at: "9:00 AM" });
	});

	it("uses a custom filename pattern and folder", () => {
		const built = buildEventNote(makeEvent(), {
			filename: "{{date}} {{summary}}",
			folder: "Calendar/Events/",
			fields: [],
			linkKey: "",
		});
		expect(built.filename).toBe("2026-07-20 Design review");
		expect(built.folder).toBe("Calendar/Events");
	});
});

describe("buildEventNote — template", () => {
	it("seeds the body from a template with placeholders, then appends body rules", () => {
		const template = "# {{summary}}\n\nWhere: {{location}}";
		const built = buildEventNote(
			makeEvent(),
			{ fields: [{ field: "description", action: "body" }], linkKey: "" },
			template,
		);
		expect(built.body).toBe("# Design review\n\nWhere: Room 4\n\nBring the deck");
	});
});
