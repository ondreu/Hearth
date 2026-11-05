import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	blankNoteName,
	newNoteButtonLabel,
	newNoteUsesTemplate,
	noteTitleFromQuery,
	UNTITLED_NOTE,
} from "../src/newnote";
import { DEFAULT_SETTINGS, type HomeSettings } from "../src/types";

/** A vault with one board, so the label resolver has an active dashboard to ask
 * about before it falls back to the global setting. */
function withLabel(label: string, board?: string): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [{ id: "d1", name: "Board", cards: [] }];
	s.activeDashboardId = "d1";
	s.newNoteButtonLabel = label;
	if (board !== undefined) s.dashboards[0].newNoteButtonLabel = board;
	return s;
}

/**
 * The configurable "New note" button (#227). The calls *into* Obsidian and
 * Templater are API and stay untested (per the no-mocks rule); what's covered
 * here is everything Hearth decides on its own — what the button is called, and
 * what the note it makes is called.
 */

describe("newNoteButtonLabel", () => {
	it("falls back to the built-in label when nothing is set", () => {
		expect(newNoteButtonLabel(withLabel(""))).toBe("New note");
	});

	it("uses the user's label", () => {
		expect(newNoteButtonLabel(withLabel("Capture"))).toBe("Capture");
	});

	it("treats whitespace as unset, so the button is never blank", () => {
		expect(newNoteButtonLabel(withLabel("   "))).toBe("New note");
	});

	it("lets one board rename the button while the vault keeps its own", () => {
		expect(newNoteButtonLabel(withLabel("Capture", "New meeting note"))).toBe(
			"New meeting note",
		);
	});

	it("treats a board's empty label as a real override back to the built-in", () => {
		expect(newNoteButtonLabel(withLabel("Capture", ""))).toBe("New note");
	});

	it("keeps a label's own inner spacing", () => {
		expect(newNoteButtonLabel(withLabel(" New meeting note "))).toBe(
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

/**
 * The search-field-as-name shortcut: the button beside the search bar makes a
 * note called whatever is typed there. What's covered is the decision — is this
 * text a name at all, and is the name legal — the click itself is API.
 */
describe("noteTitleFromQuery", () => {
	it("takes a typed title as the note's name", () => {
		expect(noteTitleFromQuery("Meeting notes")).toBe("Meeting notes");
	});

	it("trims the field's padding", () => {
		expect(noteTitleFromQuery("  Inbox  ")).toBe("Inbox");
	});

	it("is nothing for an empty field, so the filename setting stays in charge", () => {
		expect(noteTitleFromQuery("")).toBe("");
		expect(noteTitleFromQuery("   ")).toBe("");
	});

	it("is nothing for a tag search — that's a filter, not a title", () => {
		expect(noteTitleFromQuery("#project")).toBe("");
		expect(noteTitleFromQuery("#project/sub")).toBe("");
	});

	it("is nothing for a property search", () => {
		expect(noteTitleFromQuery("type:meeting")).toBe("");
		expect(noteTitleFromQuery("author: Jan")).toBe("");
	});

		it("still takes a title whose colon is not a filter — the key must be one word", () => {
		expect(noteTitleFromQuery("Meeting notes: Q3")).toBe("Meeting notes Q3");
	});

	it("drops characters a filename can't hold", () => {
		expect(noteTitleFromQuery('a/b\\c*d?e"f<g>h|i')).toBe("a b c d e f g h i");
	});

	it("drops the quotes around a quoted phrase", () => {
		expect(noteTitleFromQuery('"exact phrase"')).toBe("exact phrase");
	});

	it("collapses runs of whitespace the stripping leaves behind", () => {
		expect(noteTitleFromQuery("a   /   b")).toBe("a b");
	});

	it("is nothing when the query is all illegal characters", () => {
		expect(noteTitleFromQuery('"??"')).toBe("");
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
