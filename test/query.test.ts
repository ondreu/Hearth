import { beforeEach, describe, expect, it } from "vitest";
import {
	clearContentSearchCache,
	formatPropertyValue,
	foldedBody,
	queryMode,
} from "../src/query";

/**
 * Covers the pure parts of the query engine: mode dispatch, frontmatter value
 * stringification and the folded body cache. The result-gathering entry
 * points (runQuery, searchByName, searchByTag, searchByProperty,
 * searchFileContents) all need a live Obsidian `App`/vault and the fuzzy
 * matcher, so they are intentionally NOT tested here (no Obsidian API mocks).
 * Excerpt building lives in excerpt.test.ts.
 */

describe("queryMode", () => {
	it('a leading "#" means a tag query', () => {
		expect(queryMode("#project")).toBe("tag");
		expect(queryMode("#")).toBe("tag");
		expect(queryMode("#multi word")).toBe("tag");
	});

	it('"key:value" means a property query', () => {
		expect(queryMode("status:active")).toBe("property");
		expect(queryMode("priority:1")).toBe("property");
		expect(queryMode("kebab-case_key:x")).toBe("property");
	});

	it("tolerates whitespace around the colon", () => {
		expect(queryMode("status : active")).toBe("property");
		expect(queryMode("status: ")).toBe("property"); // empty value still a property probe
	});

	it("plain text is a name query", () => {
		expect(queryMode("meeting notes")).toBe("name");
		expect(queryMode("report")).toBe("name");
		expect(queryMode("")).toBe("name");
	});

	it("a key with spaces is NOT a property (not an identifier)", () => {
		// "two words" before the colon isn't a legal property key → name query.
		expect(queryMode("two words:x")).toBe("name");
	});

	// query.ts does not special-case ">command" — command-palette parsing lives
	// elsewhere (the search bar), so from queryMode's perspective ">foo" is just
	// a name query. Documented here so the behaviour is explicit, not a surprise.
	it('">command" is treated as a name query by queryMode', () => {
		expect(queryMode(">open settings")).toBe("name");
	});
});

describe("formatPropertyValue", () => {
	it("passes strings through and stringifies scalars", () => {
		expect(formatPropertyValue("active")).toBe("active");
		expect(formatPropertyValue(3)).toBe("3");
		expect(formatPropertyValue(true)).toBe("true");
		expect(formatPropertyValue(10n)).toBe("10");
	});

	it("renders null and undefined as empty, not as the words", () => {
		expect(formatPropertyValue(null)).toBe("");
		expect(formatPropertyValue(undefined)).toBe("");
	});

	it("falls back to JSON for anything structured", () => {
		expect(formatPropertyValue(["a", "b"])).toBe('["a","b"]');
		expect(formatPropertyValue({ a: 1 })).toBe('{"a":1}');
	});
});

describe("foldedBody", () => {
	beforeEach(() => clearContentSearchCache());

	it("folds the text it is given", () => {
		expect(foldedBody("a.md", 1, "Hello World")).toBe("hello world");
		// Accents come off too, so a query typed without them still matches.
		expect(foldedBody("b.md", 1, "Banánové Snickersky")).toBe("bananove snickersky");
	});

	it("re-uses the cached value while the mtime is unchanged", () => {
		expect(foldedBody("a.md", 1, "Original")).toBe("original");
		// A stale read of the same unchanged file must not be re-folded — the
		// cache hit is the whole point, so the second argument is ignored.
		expect(foldedBody("a.md", 1, "IGNORED")).toBe("original");
	});

	it("re-folds once the file's mtime moves", () => {
		expect(foldedBody("a.md", 1, "Original")).toBe("original");
		expect(foldedBody("a.md", 2, "Edited")).toBe("edited");
		// ...and the new value is what sticks.
		expect(foldedBody("a.md", 2, "IGNORED")).toBe("edited");
	});

	it("keeps separate entries per path", () => {
		foldedBody("a.md", 1, "Apple");
		foldedBody("b.md", 1, "Banana");
		expect(foldedBody("a.md", 1, "x")).toBe("apple");
		expect(foldedBody("b.md", 1, "x")).toBe("banana");
	});

	it("clearContentSearchCache forgets everything", () => {
		foldedBody("a.md", 1, "Original");
		clearContentSearchCache();
		expect(foldedBody("a.md", 1, "Replaced")).toBe("replaced");
	});

	it("evicts cold entries once the budget is exceeded", () => {
		// Two notes just over the 4M-char budget between them: caching the second
		// must push the first out rather than grow without bound.
		const big = "X".repeat(2_500_000);
		foldedBody("first.md", 1, big);
		foldedBody("second.md", 1, big);
		// "first.md" was evicted, so it re-lowers whatever it's handed now.
		expect(foldedBody("first.md", 1, "Fresh")).toBe("fresh");
		// "second.md" is still cached.
		expect(foldedBody("second.md", 1, "IGNORED").length).toBe(big.length);
	});

	it("keeps a single over-budget note rather than looping to evict itself", () => {
		const huge = "Y".repeat(5_000_000);
		expect(foldedBody("huge.md", 1, huge).length).toBe(huge.length);
	});
});
