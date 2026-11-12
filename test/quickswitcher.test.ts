import { describe, expect, it } from "vitest";
import type { SearchResult, TAbstractFile } from "obsidian";
import type { QueryHit } from "../src/query";
import {
	matchCandidate,
	sortSwitcherHits,
	switcherListsExtension,
	switcherName,
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

describe("switcherName", () => {
	it("takes the last path segment — the part the switcher matches first", () => {
		expect(switcherName("Black Sphinx/Black Sphinx")).toBe("Black Sphinx");
		expect(switcherName("Archive/2026/Plan.canvas")).toBe("Plan.canvas");
	});
	it("keeps a root file whole", () => {
		expect(switcherName("Hearth")).toBe("Hearth");
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
	it("covers the attachment types the switcher itself names", () => {
		// Obsidian's own lists, not ours to invent — oga/opus/tiff are easy to miss.
		for (const ext of ["oga", "opus", "tiff", "pdf", "mkv"]) {
			expect(switcherListsExtension(ext, defaults)).toBe(true);
		}
	});
	it("lists unknown types only with Show all file types", () => {
		expect(switcherListsExtension("zip", defaults)).toBe(false);
		expect(switcherListsExtension("zip", { ...defaults, showAllFileTypes: true })).toBe(true);
	});
	it("lists a plugin's file type when Obsidian can display it", () => {
		const registry = (ext: string): boolean => ext === "excalidraw";
		expect(switcherListsExtension("excalidraw", defaults, registry)).toBe(true);
		expect(switcherListsExtension("zip", defaults, registry)).toBe(false);
	});
	it("doesn't ask the registry for types its own options already decided", () => {
		let asked = 0;
		const registry = (): boolean => {
			asked += 1;
			return true;
		};
		for (const ext of ["md", "canvas", "base", "png", "mp3", "pdf"]) {
			switcherListsExtension(ext, defaults, registry);
		}
		expect(asked).toBe(0);
		expect(switcherListsExtension("excalidraw", { ...defaults, showAttachments: false }, registry)).toBe(false);
		expect(asked).toBe(0);
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

	it("matches the name and highlights within it", () => {
		expect(matchCandidate(candidate, substring("novák"))).toEqual({
			score: -4,
			matches: [[4, 9]],
		});
	});

	it("matches a folder in the path only when the name misses, docked by one point", () => {
		expect(matchCandidate(candidate, substring("people"))).toEqual({ score: -1, matches: [] });
	});

	it("matches an attachment by its name with the extension, highlighting only the title", () => {
		const plan = { text: "Boards/Plan.canvas", displayName: "Plan", aliases: [] };
		expect(matchCandidate(plan, substring("plan.canvas"))).toEqual({ score: -0, matches: [[0, 4]] });
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

/**
 * The report in #447: a folder "Black Sphinx" holding an empty note "A" and a
 * note called "Black Sphinx". The empty note used to tie with the named one —
 * both matched at offset 0 of the full path — and the alphabetical tiebreak
 * put "A" first.
 */
describe("name before path (#447)", () => {
	const empty = { text: "Black Sphinx/A", displayName: "A", aliases: [] };
	const named = { text: "Black Sphinx/Black Sphinx", displayName: "Black Sphinx", aliases: [] };

	it("ranks the note whose own name matched above the one that only hit the folder", () => {
		const onName = matchCandidate(named, substring("bla"));
		const onPath = matchCandidate(empty, substring("bla"));
		expect(onName).toEqual({ score: -0, matches: [[0, 3]] });
		expect(onPath).toEqual({ score: -1, matches: [] });
		expect(onName?.score ?? -Infinity).toBeGreaterThan(onPath?.score ?? -Infinity);
	});

	it("holds for a partial query in the middle of the name too", () => {
		expect(matchCandidate(named, substring("sphinx"))?.score).toBe(-6);
		expect(matchCandidate(empty, substring("sphinx"))?.score).toBe(-7);
	});
});

describe("sortSwitcherHits", () => {
	const hit = (score: number, name: string): QueryHit => ({
		file: { name, path: name } as TAbstractFile,
		score,
	});

	it("orders by score alone, best first", () => {
		const sorted = sortSwitcherHits([hit(-3, "c"), hit(-1, "a"), hit(-2, "b")]);
		expect(sorted.map((h) => h.file.name)).toEqual(["a", "b", "c"]);
	});

	it("keeps the vault's order on a tie, like the core switcher", () => {
		const sorted = sortSwitcherHits([hit(-1, "Zebra"), hit(-1, "Apple")]);
		expect(sorted.map((h) => h.file.name)).toEqual(["Zebra", "Apple"]);
	});
});
