import { describe, expect, it } from "vitest";
import {
	clampRecentCount,
	mergeRecentPaths,
	pushRecentPath,
	RECENT_COUNT_DEFAULT,
	RECENT_HISTORY_MAX,
	rowsThatFit,
} from "../src/recentfiles";

/**
 * Hearth's own recent-file history and the Recent files card's row maths
 * (#228). Obsidian's getLastOpenFiles() stops at ten entries, so a card asking
 * for more needs a history of its own — these cover the pure parts of it. The
 * reads and writes themselves are Obsidian API (localStorage, workspace) and
 * stay untested, per the no-mocks rule.
 */

describe("clampRecentCount", () => {
	it("keeps a count Hearth can honour", () => {
		expect(clampRecentCount(1)).toBe(1);
		expect(clampRecentCount(8)).toBe(8);
		expect(clampRecentCount(RECENT_HISTORY_MAX)).toBe(RECENT_HISTORY_MAX);
	});

	it("caps a count past what the history holds", () => {
		// The bug: 15 was accepted and 10 shown. Now the stored value is one the
		// card can actually fill.
		expect(clampRecentCount(15)).toBe(15);
		expect(clampRecentCount(RECENT_HISTORY_MAX + 1)).toBe(RECENT_HISTORY_MAX);
		expect(clampRecentCount(9999)).toBe(RECENT_HISTORY_MAX);
	});

	it("refuses to render nothing", () => {
		expect(clampRecentCount(0)).toBe(1);
		expect(clampRecentCount(-4)).toBe(1);
	});

	it("falls back to the default when the field is empty or unparsable", () => {
		expect(clampRecentCount(undefined)).toBe(RECENT_COUNT_DEFAULT);
		expect(clampRecentCount(NaN)).toBe(RECENT_COUNT_DEFAULT);
	});

	it("takes the whole part of a typed decimal", () => {
		expect(clampRecentCount(4.7)).toBe(4);
	});
});

describe("mergeRecentPaths", () => {
	it("puts Obsidian's list first and appends the older tail", () => {
		expect(mergeRecentPaths(["b.md", "a.md"], ["b.md", "a.md", "old.md"])).toEqual([
			"b.md",
			"a.md",
			"old.md",
		]);
	});

	it("never lists a path twice, whichever side it came from", () => {
		const merged = mergeRecentPaths(["a.md", "b.md"], ["b.md", "a.md", "c.md"]);
		expect(merged).toEqual(["a.md", "b.md", "c.md"]);
		expect(new Set(merged).size).toBe(merged.length);
	});

	it("follows Obsidian's order even when the history disagrees", () => {
		// A file reopened in another window updates Obsidian's list; the stored
		// history of this device is the stale one.
		expect(mergeRecentPaths(["new.md", "a.md"], ["a.md", "new.md"])).toEqual([
			"new.md",
			"a.md",
		]);
	});

	it("survives an empty side and drops empty entries", () => {
		expect(mergeRecentPaths([], ["a.md"])).toEqual(["a.md"]);
		expect(mergeRecentPaths(["a.md"], [])).toEqual(["a.md"]);
		expect(mergeRecentPaths([""], ["a.md"])).toEqual(["a.md"]);
	});
});

describe("pushRecentPath", () => {
	it("prepends the newest open", () => {
		expect(pushRecentPath(["a.md"], "b.md")).toEqual(["b.md", "a.md"]);
	});

	it("moves a re-opened file to the front instead of duplicating it", () => {
		expect(pushRecentPath(["a.md", "b.md", "c.md"], "c.md")).toEqual([
			"c.md",
			"a.md",
			"b.md",
		]);
	});

	it("stays bounded", () => {
		const full = Array.from({ length: RECENT_HISTORY_MAX }, (_, i) => `f${i}.md`);
		const next = pushRecentPath(full, "new.md");
		expect(next).toHaveLength(RECENT_HISTORY_MAX);
		expect(next[0]).toBe("new.md");
		// The oldest entry is the one that fell off the end.
		expect(next).not.toContain(`f${RECENT_HISTORY_MAX - 1}.md`);
	});
});

describe("rowsThatFit", () => {
	it("charges every row but the last for its gap", () => {
		// Three 30px rows with 2px gaps measure 94px, so 94 fits three and 93
		// fits two.
		expect(rowsThatFit(94, 30, 2)).toBe(3);
		expect(rowsThatFit(93, 30, 2)).toBe(2);
	});

	it("fills a taller card with more rows", () => {
		expect(rowsThatFit(320, 30, 2)).toBe(10);
		expect(rowsThatFit(640, 30, 2)).toBe(20);
	});

	it("shows one row rather than an empty card when nothing fits", () => {
		expect(rowsThatFit(10, 30, 2)).toBe(1);
		expect(rowsThatFit(0, 30, 2)).toBe(1);
		expect(rowsThatFit(-50, 30, 2)).toBe(1);
	});

	it("survives an unmeasurable row", () => {
		// A body that hasn't been laid out yet measures zero; the observer
		// re-fits once it has, so the interim answer only has to be sane.
		expect(rowsThatFit(300, 0, 0)).toBe(1);
	});
});
