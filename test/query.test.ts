import { describe, expect, it } from "vitest";
import { queryMode } from "../src/query";

/**
 * Only `queryMode` is pure — it classifies a raw search string into a mode
 * from its syntax alone. The actual result-gathering (runQuery, searchByName,
 * searchByTag, searchByProperty, searchFileContents) all need a live Obsidian
 * `App`/vault and the fuzzy matcher, so they are intentionally NOT tested here
 * (no Obsidian API mocks). This covers the syntax-dispatch logic that a
 * typecheck can't catch.
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
