import { beforeEach, describe, expect, it } from "vitest";
import type { TAbstractFile } from "obsidian";
import {
	clearContentSearchCache,
	formatPropertyValue,
	foldedBody,
	mergeRanked,
	queryMode,
	RANK,
	slotsAboveBody,
	sortByRank,
	type QueryHit,
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

/** A stand-in hit; only `file.name`, `rank` and `score` affect ordering. */
function hit(name: string, rank: number, score = 0): QueryHit {
	return { file: { name, path: name } as TAbstractFile, rank, score };
}
const names = (hits: QueryHit[]) => hits.map((h) => h.file.name);

describe("result ranking", () => {
	it("puts every literal match above any fuzzy one", () => {
		// The bug this exists for: searching "banán" scattered b-a-n-a-n across
		// "Pohanákový chléb s avokádovo-vaječnou pomazánkou" and ranked that title
		// above notes whose body plainly says "banánu".
		const ranked = sortByRank([
			hit("Pohanákový chléb", RANK.FUZZY_NAME, 10),
			hit("Snídaně do skleničky", RANK.BODY),
			hit("Banánové Snickersky", RANK.NAME_PREFIX),
		]);
		expect(names(ranked)).toEqual([
			"Banánové Snickersky",
			"Snídaně do skleničky",
			"Pohanákový chléb",
		]);
	});

	it("orders the literal bands name, path, body", () => {
		const ranked = sortByRank([
			hit("body", RANK.BODY),
			hit("path", RANK.PATH),
			hit("substring", RANK.NAME_SUBSTRING),
			hit("word", RANK.NAME_WORD),
			hit("prefix", RANK.NAME_PREFIX),
		]);
		expect(names(ranked)).toEqual(["prefix", "word", "substring", "path", "body"]);
	});

	it("a high fuzzy score still cannot beat a low-scoring literal match", () => {
		const ranked = sortByRank([hit("fuzzy", RANK.FUZZY_NAME, 999), hit("literal", RANK.BODY, -999)]);
		expect(names(ranked)).toEqual(["literal", "fuzzy"]);
	});

	it("falls back to score, then name, within a band", () => {
		const ranked = sortByRank([
			hit("b", RANK.NAME_WORD, 1),
			hit("a", RANK.NAME_WORD, 1),
			hit("c", RANK.NAME_WORD, 5),
		]);
		expect(names(ranked)).toEqual(["c", "a", "b"]);
	});

	it("treats a hit with no rank as the lowest band", () => {
		const unranked: QueryHit = { file: { name: "x", path: "x" } as TAbstractFile, score: 0 };
		expect(names(sortByRank([unranked, hit("body", RANK.BODY)]))).toEqual(["body", "x"]);
	});
});

describe("mergeRanked", () => {
	it("interleaves late body hits instead of appending them", () => {
		const nameHits = [hit("Banánové", RANK.NAME_PREFIX), hit("Pohanákový", RANK.FUZZY_NAME, 10)];
		const bodyHits = [hit("Snídaně", RANK.BODY)];
		expect(names(mergeRanked(nameHits, bodyHits, 10))).toEqual([
			"Banánové",
			"Snídaně",
			"Pohanákový",
		]);
	});

	it("caps the merged list at the limit", () => {
		const merged = mergeRanked([hit("a", RANK.NAME_PREFIX)], [hit("b", RANK.BODY)], 1);
		expect(names(merged)).toEqual(["a"]);
	});
});

describe("slotsAboveBody", () => {
	it("counts only the hits that outrank a body match", () => {
		expect(
			slotsAboveBody([
				hit("name", RANK.NAME_PREFIX),
				hit("path", RANK.PATH),
				hit("body", RANK.BODY),
				hit("fuzzy", RANK.FUZZY_NAME),
			]),
		).toBe(2);
	});

	it("reserves nothing for a page of pure fuzzy hits", () => {
		// This is the point: 40 scattered-letter titles must not starve body
		// search of its budget, or the good matches never get looked for.
		const fuzzy = Array.from({ length: 40 }, (_, i) => hit(`f${i}`, RANK.FUZZY_NAME));
		expect(slotsAboveBody(fuzzy)).toBe(0);
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
