import { describe, expect, it } from "vitest";
import {
	buildEventNote,
	sanitizeFilename,
	upgradeEventNote,
	type EventNoteConfig,
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

describe("event variables", () => {
	const ev = makeEvent();
	const name = (template: string, e = ev): string => buildEventNote(e, { name: template, linkKey: "" }).filename;
	it("fills plain fields and dates", () => {
		expect(name("{{title}} @ {{location}}")).toBe("Design review @ Room 4");
		expect(name("{{date}} {{start}}-{{end}}")).toBe("2026-07-20 09 00-10 30");
	});
	it("still reads the old {{field:FORMAT}} form", () => {
		expect(name("{{date:DD.MM.YYYY}} {{start:h.mm A}}")).toBe("20.07.2026 9.00 AM");
		expect(name("{{summary}}")).toBe("Design review");
	});
	it("gives an all-day event days, not clock times", () => {
		expect(name("{{start}}", makeEvent({ allDay: true }))).toBe("2026-07-20");
	});
	it("leaves unknown tokens untouched", () => {
		expect(buildEventNote(ev, { name: "x", body: "{{unknown}} {{title}}", linkKey: "" }).body).toBe(
			"{{unknown}} Design review",
		);
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

describe("upgradeEventNote", () => {
	it("turns routing rules into properties and body sections", () => {
		const cfg: EventNoteConfig = {
			filename: "{{date}} {{summary}}",
			fields: [
				{ field: "date", action: "frontmatter" },
				{ field: "start", action: "frontmatter", key: "starts_at", format: "h:mm A" },
				{ field: "url", action: "ignore" },
				{ field: "description", action: "body", key: "Notes" },
				{ field: "location", action: "body" },
			],
		};
		upgradeEventNote(cfg);
		expect(cfg).toEqual({
			name: "{{date}} {{title}}",
			properties: [
				{ name: "date", value: "{{date}}", type: "date" },
				{ name: "starts_at", value: '{{start|date:"h:mm A"}}', type: "text" },
			],
			body: "## Notes\n\n{{description}}\n\n{{location}}",
		});
	});

	it("keeps a card that never customised its rules on the defaults", () => {
		const cfg: EventNoteConfig = { folder: "Events", linkKey: "uid" };
		expect(upgradeEventNote(cfg)).toEqual({ folder: "Events", linkKey: "uid" });
	});

	it("builds the same note before and after the upgrade", () => {
		const legacy: EventNoteConfig = {
			filename: "{{summary}} ({{calendar}})",
			fields: [
				{ field: "start", action: "frontmatter", key: "at", format: "HH:mm" },
				{ field: "description", action: "body", key: "Agenda" },
			],
		};
		const before = buildEventNote(makeEvent(), legacy, "# {{summary}}");
		const after = buildEventNote(makeEvent(), upgradeEventNote({ ...legacy }), "# {{summary}}");
		expect(after).toEqual(before);
		expect(before.filename).toBe("Design review (Work)");
		expect(before.body).toBe("# Design review\n\n## Agenda\n\nBring the deck");
	});
});

describe("buildEventNote — templates", () => {
	it("types properties and fills a folder pattern", () => {
		const built = buildEventNote(makeEvent(), {
			folder: "Meetings/{{calendar}}/{{date|date:\"YYYY\"}}",
			properties: [
				{ name: "attendees", value: "Ann, Bob", type: "list" },
				{ name: "when", value: "{{start}}", type: "datetime" },
				{ name: "billable", value: "yes", type: "checkbox" },
				{ name: "empty", value: "{{url|replace:\"https://example.com/mtg\",\"\"}}" },
			],
			linkKey: "",
		});
		expect(built.folder).toBe("Meetings/Work/2026");
		expect(built.frontmatter).toEqual({
			attendees: ["Ann", "Bob"],
			when: "2026-07-20T09:00",
			billable: true,
		});
	});
});
