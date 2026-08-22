import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankNoteName, newNoteButtonLabel, newNoteUsesTemplate, UNTITLED_NOTE } from "../src/newnote";

/**
 * The configurable "New note" button (#227). The calls *into* Obsidian and
 * Templater are API and stay untested (per the no-mocks rule); what's covered
 * here is everything Hearth decides on its own — what the button is called, and
 * what the note it makes is called.
 */

describe("newNoteButtonLabel", () => {
	it("falls back to the built-in label when nothing is set", () => {
		expect(newNoteButtonLabel({ newNoteButtonLabel: "" })).toBe("New note");
	});

	it("uses the user's label", () => {
		expect(newNoteButtonLabel({ newNoteButtonLabel: "Capture" })).toBe("Capture");
	});

	it("treats whitespace as unset, so the button is never blank", () => {
		expect(newNoteButtonLabel({ newNoteButtonLabel: "   " })).toBe("New note");
	});

	it("keeps a label's own inner spacing", () => {
		expect(newNoteButtonLabel({ newNoteButtonLabel: " New meeting note " })).toBe(
			"New meeting note",
		);
	});
});

describe("newNoteUsesTemplate", () => {
	it("is off by default", () => {
		expect(newNoteUsesTemplate({ newNoteTemplate: "" })).toBe(false);
	});

	it("is off for a path that is only whitespace", () => {
		expect(newNoteUsesTemplate({ newNoteTemplate: "  " })).toBe(false);
	});

	it("is on once a template is picked", () => {
		expect(newNoteUsesTemplate({ newNoteTemplate: "Templates/Meeting.md" })).toBe(true);
	});
});

describe("blankNoteName", () => {
	const now = new Date(2026, 4, 17, 9, 5);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("is Obsidian's Untitled when no pattern is set", () => {
		expect(blankNoteName("", now)).toBe(UNTITLED_NOTE);
	});

	it("keeps a plain name as it is", () => {
		expect(blankNoteName("Inbox", now)).toBe("Inbox");
	});

	it("substitutes the date and time tokens", () => {
		expect(blankNoteName("{{date}} {{time}}", now)).toBe("2026-05-17 09-05");
	});

	it("honours an explicit format", () => {
		expect(blankNoteName("Meeting {{date:YYYY}}", now)).toBe("Meeting 2026");
	});

	it("fills {{prompt}} with what the user typed", () => {
		expect(blankNoteName("{{date}} {{prompt}}", now, "Standup")).toBe("2026-05-17 Standup");
	});

	it("strips characters a filename can't carry — including a typed ../", () => {
		expect(blankNoteName("{{prompt}}", now, "../escape")).toBe(".. escape");
	});

	it("falls back to Untitled when a pattern expands to nothing usable", () => {
		expect(blankNoteName("{{prompt}}", now, "??")).toBe(UNTITLED_NOTE);
	});
});
