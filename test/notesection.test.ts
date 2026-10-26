import { describe, expect, it } from "vitest";
import { noteSection, type SectionCache, sectionSubpath } from "../src/notesection";

/** A cache with headings at the lines the note below actually has them on. */
const NOTE = [
	"---", // 0
	"tags: [x]", // 1
	"---", // 2
	"", // 3
	"# Today", // 4
	"", // 5
	"- [ ] write the report", // 6
	"- [x] send it", // 7
	"", // 8
	"## Later", // 9
	"", // 10
	"- [ ] water the plants", // 11
	"", // 12
	"# Backlog", // 13
	"", // 14
	"- [ ] someday", // 15
	"", // 16
	"> a paragraph I want on its own ^quote", // 17
].join("\n");

function heading(headingText: string, level: number, line: number) {
	return { heading: headingText, level, position: { start: { line }, end: { line } } };
}

const CACHE: SectionCache = {
	headings: [heading("Today", 1, 4), heading("Later", 2, 9), heading("Backlog", 1, 13)],
	blocks: { quote: { position: { start: { line: 17 }, end: { line: 17 } } } },
};


describe("sectionSubpath", () => {
	it("accepts a bare heading name and adds the #", () => {
		expect(sectionSubpath("Today")).toBe("#Today");
	});

	it("keeps an already-prefixed subpath", () => {
		expect(sectionSubpath("#Today")).toBe("#Today");
		expect(sectionSubpath("  #^quote ")).toBe("#^quote");
	});

	it("drops heading level markers, which are not part of the name", () => {
		expect(sectionSubpath("## Later")).toBe("#Later");
		expect(sectionSubpath("# Later")).toBe("#Later");
	});

	it("takes the subpath out of a pasted embed or link", () => {
		expect(sectionSubpath("![[Note#Today]]")).toBe("#Today");
		expect(sectionSubpath("[[Note#Today|today's tasks]]")).toBe("#Today");
		expect(sectionSubpath("folder/Note.md#Today")).toBe("#Today");
	});

	it("gives null for nothing usable", () => {
		expect(sectionSubpath("")).toBeNull();
		expect(sectionSubpath("   ")).toBeNull();
		expect(sectionSubpath("#")).toBeNull();
		expect(sectionSubpath(null)).toBeNull();
		expect(sectionSubpath(undefined)).toBeNull();
	});
});


describe("noteSection — headings", () => {
	it("spans the heading and everything under it, sub-headings included", () => {
		const s = noteSection(NOTE, CACHE, "#Today")!;
		expect(s.text.split("\n")).toEqual([
			"# Today",
			"",
			"- [ ] write the report",
			"- [x] send it",
			"",
			"## Later",
			"",
			"- [ ] water the plants",
		]);
		// The slice's own line numbers are what a checkbox tick is mapped against.
		expect([s.from, s.to]).toEqual([4, 11]);
		expect(s.anchor).toBe(4);
		expect(s.heading).toBe(true);
	});

	it("runs to the end of the note when nothing follows", () => {
		const s = noteSection(NOTE, CACHE, "#Backlog")!;
		expect(s.text.split("\n")).toEqual(["# Backlog", "", "- [ ] someday", "", "> a paragraph I want on its own ^quote"]);
		expect([s.from, s.to]).toEqual([13, 17]);
	});

	it("stops at the next heading of the same or a higher level", () => {
		const s = noteSection(NOTE, CACHE, "#Later")!;
		expect(s.text).toBe("## Later\n\n- [ ] water the plants");
		expect([s.from, s.to]).toEqual([9, 11]);
	});

	it("matches the heading case-insensitively and ignores surrounding spaces", () => {
		expect(noteSection(NOTE, CACHE, "today")?.text).toContain("# Today");
		expect(noteSection(NOTE, CACHE, "  #LATER  ")?.text).toContain("## Later");
	});

	it("drops the heading line when asked to hide it, and keeps the anchor", () => {
		const s = noteSection(NOTE, CACHE, "#Today", { hideHeading: true })!;
		expect(s.text.split("\n")).toEqual([
			"- [ ] write the report",
			"- [x] send it",
			"",
			"## Later",
			"",
			"- [ ] water the plants",
		]);
		// Line numbers still point into the note, not into the slice.
		expect([s.from, s.to]).toEqual([6, 11]);
		expect(s.anchor).toBe(4);
	});

	it("collapses to an empty section when the heading has no body", () => {
		const text = "# Alone\n\n# Next";
		const cache: SectionCache = {
			headings: [heading("Alone", 1, 0), heading("Next", 1, 2)],
		};
		// Nothing under the heading: the slice is the heading line alone.
		const s = noteSection(text, cache, "#Alone")!;
		expect(s.text).toBe("# Alone");
		expect([s.from, s.to]).toEqual([0, 0]);
		// Hiding it leaves nothing at all, and the range says so.
		const hidden = noteSection(text, cache, "#Alone", { hideHeading: true })!;
		expect(hidden.text).toBe("");
		expect(hidden.to).toBe(hidden.from - 1);
	});

	it("reports a missing heading as null rather than an empty slice", () => {
		expect(noteSection(NOTE, CACHE, "#Financials")).toBeNull();
		expect(noteSection(NOTE, null, "#Today")).toBeNull();
	});
});


describe("noteSection — blocks", () => {
	it("takes the one line a block id names", () => {
		const s = noteSection(NOTE, CACHE, "#^quote")!;
		expect(s.text).toBe("> a paragraph I want on its own ^quote");
		expect([s.from, s.to]).toEqual([17, 17]);
		expect(s.heading).toBe(false);
	});

	it("reports a missing block as null", () => {
		expect(noteSection(NOTE, CACHE, "#^nope")).toBeNull();
		expect(noteSection(NOTE, {}, "#^quote")).toBeNull();
	});
});


describe("noteSection — text handling", () => {
	it("reads CRLF notes as if they were LF", () => {
		const crlf = NOTE.replace(/\n/g, "\r\n");
		const s = noteSection(crlf, CACHE, "#Later")!;
		expect(s.text).toBe("## Later\n\n- [ ] water the plants");
	});

	it("clamps a cache that points past the end of the text", () => {
		const cache: SectionCache = { blocks: { gone: { position: { start: { line: 99 }, end: { line: 120 } } } } };
		const s = noteSection("only one line", cache, "#^gone")!;
		expect([s.from, s.to]).toEqual([0, 0]);
	});
});
