import { describe, expect, it } from "vitest";
import { DATACORE_LANGUAGES, datacoreQueryScript } from "../src/datacore";

/**
 * The Datacore card's no-code "Query" mode works by generating a small JSX view
 * around the user's query — Datacore ships no query-only codeblock to hand a
 * bare query to. That generation is the one piece of pure logic in the
 * integration, and the one that can silently produce a broken script, so it is
 * pinned here. (Executing it needs the Datacore plugin, which tests don't have.)
 */
describe("datacoreQueryScript", () => {
	it("embeds the query as a string literal and returns a component", () => {
		const script = datacoreQueryScript("@page and #project");
		expect(script).toContain('dc.useQuery("@page and #project")');
		expect(script.startsWith("return function ")).toBe(true);
		expect(script).toContain("<dc.List");
	});

	it("escapes quotes, backslashes and newlines in the query", () => {
		const script = datacoreQueryScript('@page and path("a\\b") and\n#x');
		// The literal round-trips: what Datacore evaluates is exactly what was
		// typed, and no stray quote can break out into the surrounding script.
		const literal = script.match(/dc\.useQuery\((".*?[^\\]")\)/)?.[1];
		expect(literal).toBeDefined();
		expect(JSON.parse(literal!)).toBe('@page and path("a\\b") and\n#x');
		// The embedded newline must not split the generated line.
		expect(script.split("\n").filter((l) => l.includes("dc.useQuery"))).toHaveLength(1);
	});

	it("pages the list only when a positive page size is given", () => {
		expect(datacoreQueryScript("@page", 25)).toContain("paging={25}");
		expect(datacoreQueryScript("@page")).toContain("paging={false}");
		expect(datacoreQueryScript("@page", 0)).toContain("paging={false}");
		expect(datacoreQueryScript("@page", -5)).toContain("paging={false}");
		expect(datacoreQueryScript("@page", Number.NaN)).toContain("paging={false}");
		// Non-integer sliders/hand-edited data still yield a valid literal.
		expect(datacoreQueryScript("@page", 12.4)).toContain("paging={12}");
	});
});

describe("DATACORE_LANGUAGES", () => {
	it("lists the query mode plus Datacore's four script dialects", () => {
		expect([...DATACORE_LANGUAGES].sort()).toEqual(["js", "jsx", "query", "ts", "tsx"]);
	});
});
