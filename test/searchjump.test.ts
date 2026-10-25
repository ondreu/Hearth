import { describe, expect, it } from "vitest";
import { offsetToLine } from "../src/opener";
import { omnisearchBodyMatch } from "../src/omnisearch";
import { DEFAULT_SETTINGS } from "../src/types";

/** Scroll-to-match on open (#397): the pure helpers behind it. The actual
 * leaf/editor work needs a live Obsidian workspace, so it is deliberately not
 * covered here — everything it decides happens in these functions. */

describe("offsetToLine", () => {
	it("counts newlines before the offset", () => {
		expect(offsetToLine("a\nb\nc", 0)).toBe(0);
		expect(offsetToLine("a\nb\nc", 1)).toBe(0);
		expect(offsetToLine("a\nb\nc", 2)).toBe(1);
		expect(offsetToLine("a\nb\nc", 4)).toBe(2);
	});

	it("clamps out-of-range offsets", () => {
		expect(offsetToLine("a\nb", -5)).toBe(0);
		expect(offsetToLine("a\nb", 99)).toBe(1);
	});
});

describe("omnisearchBodyMatch", () => {
	it("takes the first match's offset and length", () => {
		expect(
			omnisearchBodyMatch({ matches: [{ match: "hello", offset: 42 }] }),
		).toEqual({ offset: 42, length: 5 });
	});

	it("has nothing usable for title-only hits", () => {
		expect(omnisearchBodyMatch({})).toBeUndefined();
		expect(omnisearchBodyMatch({ matches: [] })).toBeUndefined();
		expect(omnisearchBodyMatch({ matches: [{ match: "", offset: 3 }] })).toBeUndefined();
		expect(omnisearchBodyMatch({ matches: [{ match: "x", offset: -1 }] })).toBeUndefined();
	});
});

describe("searchScrollToMatch setting", () => {
	it("ships enabled, so search opens jump by default", () => {
		expect(DEFAULT_SETTINGS.searchScrollToMatch).toBe(true);
	});
});
