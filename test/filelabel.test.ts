import { describe, expect, it } from "vitest";
import { noteLabel, propertyLabel } from "../src/filelabel";

/**
 * Naming a note from frontmatter (#399). What's covered here is the two
 * decisions a file-listing card makes per row: which frontmatter value counts as
 * a name, and what the row falls back to when there isn't one. Reading the
 * metadata cache and drawing the row are Obsidian's, and stay in the vault
 * checklist.
 */

describe("propertyLabel", () => {
	it("reads a string, trimmed", () => {
		expect(propertyLabel({ title: "  Panel schedule  " }, "title")).toBe("Panel schedule");
	});

	it("takes the first non-blank entry of a list", () => {
		expect(propertyLabel({ aliases: ["", "  ", "Kitchen", "Kitchen notes"] }, "aliases")).toBe(
			"Kitchen",
		);
	});

	it("matches the property name regardless of case", () => {
		// Obsidian keeps the casing the user typed; #398 settled the same rule
		// for property names read as icons.
		expect(propertyLabel({ Aliases: ["Notes"] }, "aliases")).toBe("Notes");
		expect(propertyLabel({ aliases: ["Notes"] }, "ALIASES")).toBe("Notes");
	});

	it("trims the property name it is given", () => {
		expect(propertyLabel({ aliases: ["Notes"] }, "  aliases  ")).toBe("Notes");
	});

	it("shows a number as text", () => {
		expect(propertyLabel({ year: 2026 }, "year")).toBe("2026");
	});

	it("has no label for values that are not names", () => {
		expect(propertyLabel({ aliases: [] }, "aliases")).toBeNull();
		expect(propertyLabel({ aliases: "   " }, "aliases")).toBeNull();
		expect(propertyLabel({ aliases: null }, "aliases")).toBeNull();
		expect(propertyLabel({ aliases: true }, "aliases")).toBeNull();
		expect(propertyLabel({ aliases: { first: "Notes" } }, "aliases")).toBeNull();
		expect(propertyLabel({ aliases: [Number.NaN] }, "aliases")).toBeNull();
	});

	it("has no label for a missing property, an empty name, or no frontmatter", () => {
		expect(propertyLabel({ title: "x" }, "aliases")).toBeNull();
		expect(propertyLabel({ title: "x" }, "   ")).toBeNull();
		expect(propertyLabel(undefined, "aliases")).toBeNull();
		expect(propertyLabel(null, "aliases")).toBeNull();
		expect(propertyLabel("aliases", "aliases")).toBeNull();
	});
});

describe("noteLabel", () => {
	const basename = "PRJ-118 widget spec";
	const name = { basename, property: "aliases", title: null };

	it("uses the card's property when the note has it", () => {
		expect(noteLabel({ ...name, frontmatter: { aliases: ["Widget spec"] } })).toBe("Widget spec");
	});

	it("falls back to the file name when the note lacks the property", () => {
		expect(noteLabel({ ...name, frontmatter: { tags: ["project"] } })).toBe(basename);
	});

	it("falls back to the explorer's title before the file name", () => {
		// Front Matter Title (#375) is what the sidebar shows, so a card that
		// names no property — or whose note has none — has to agree with it.
		expect(noteLabel({ ...name, frontmatter: undefined, title: "Widget spec" })).toBe(
			"Widget spec",
		);
		expect(noteLabel({ ...name, frontmatter: { aliases: [] }, title: "Widget spec" })).toBe(
			"Widget spec",
		);
	});

	it("keeps the file name for a card with no property and no titles", () => {
		expect(noteLabel({ basename, property: "", frontmatter: undefined, title: null })).toBe(
			basename,
		);
	});

	it("keeps the file name while the property field is still empty", () => {
		// The Advanced toggle stores an empty string before anything is typed.
		expect(
			noteLabel({ basename, property: "", frontmatter: { aliases: ["Widget spec"] }, title: null }),
		).toBe(basename);
	});

	it("ignores a title the resolver left blank", () => {
		expect(noteLabel({ basename, property: "", frontmatter: null, title: "   " })).toBe(basename);
	});
});
