import { describe, expect, it } from "vitest";
import type { SearchResult } from "obsidian";
import {
	matchCandidate,
	switcherListsExtension,
	switcherText,
	tailRanges,
} from "../src/quickswitcher";

/**
 * Covers the pure parts of the Quick switcher engine. The vault walk itself
 * needs a live `App` and Obsidian's fuzzy matcher, so matching is exercised
 * with a stand-in matcher instead.
 */

/** Case-insensitive substring "matcher": score is minus the match position,
 * so an earlier match scores better, as with Obsidian's. */
function substring(query: string): (text: string) => SearchResult | null {
	return (text) => {
		const at = text.toLowerCase().indexOf(query.toLowerCase());
		return at < 0 ? null : { score: -at, matches: [[at, at + query.length]] };
	};
}

describe("switcherText", () => {
	it("drops .md from notes, like the switcher", () => {
		expect(switcherText("Projects/Hearth.md", "md")).toBe("Projects/Hearth");
	});
	it("keeps other extensions", () => {
		expect(switcherText("Boards/Plan.canvas", "canvas")).toBe("Boards/Plan.canvas");
	});
});

describe("switcherListsExtension", () => {
	const defaults = { showAttachments: true, showAllFileTypes: false };
	it("always lists notes, canvases and bases", () => {
		const off = { showAttachments: false, showAllFileTypes: false };
		for (const ext of ["md", "canvas", "base"]) expect(switcherListsExtension(ext, off)).toBe(true);
	});
	it("lists attachments only when the switcher does", () => {
		expect(switcherListsExtension("PNG", defaults)).toBe(true);
		expect(switcherListsExtension("png", { ...defaults, showAttachments: false })).toBe(false);
	});
	it("lists unknown types only with Show all file types", () => {
		expect(switcherListsExtension("zip", defaults)).toBe(false);
		expect(switcherListsExtension("zip", { ...defaults, showAllFileTypes: true })).toBe(true);
	});
});

describe("tailRanges", () => {
	it("re-bases ranges onto the file name and drops folder-only ones", () => {
		// "Notes/Hearth": "Notes/" is 6 chars, "Hearth" starts at 6.
		expect(tailRanges([[0, 2], [6, 8], [10, 12]], 12, 6)).toEqual([[0, 2], [4, 6]]);
	});
	it("clips a range straddling the folder boundary", () => {
		expect(tailRanges([[4, 8]], 12, 6)).toEqual([[0, 2]]);
	});
});

describe("matchCandidate", () => {
	const candidate = { text: "People/Jan Novák", displayName: "Jan Novák", aliases: ["Honza"] };

	it("matches the path and highlights within the name", () => {
		expect(matchCandidate(candidate, substring("novák"))).toEqual({
			score: -11,
			matches: [[4, 9]],
		});
	});

	it("matches a folder in the path without highlighting the name", () => {
		expect(matchCandidate(candidate, substring("people"))?.matches).toEqual([]);
	});

	it("lets an alias win when it scores better", () => {
		expect(matchCandidate(candidate, substring("honza"))).toEqual({
			score: -0,
			matches: [],
			alias: { text: "Honza", matches: [[0, 5]] },
		});
	});

	it("keeps the path on a tie", () => {
		const tie = { text: "Honza", displayName: "Honza", aliases: ["Honza"] };
		expect(matchCandidate(tie, substring("honza"))?.alias).toBeUndefined();
	});

	it("returns null when nothing matches", () => {
		expect(matchCandidate(candidate, substring("xyz"))).toBeNull();
	});
});
