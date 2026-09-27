import { describe, expect, it } from "vitest";
import { parseWikiSearch, parseWikiSummary, wikiLang } from "../src/wiki";

/** The Wikipedia answer's parsers, fed the shapes the Wikimedia REST API
 * returns (trimmed to the fields read). */
describe("wiki", () => {
	it("wikiLang takes a language code for a host name", () => {
		expect(wikiLang("en")).toBe("en");
		expect(wikiLang("zh-TW")).toBe("zh");
		expect(wikiLang("pt_BR")).toBe("pt");
		expect(wikiLang("")).toBeNull();
		expect(wikiLang("evil.example")).toBeNull();
	});

	it("parseWikiSearch takes the best match's key", () => {
		expect(parseWikiSearch({ pages: [{ key: "Prague", title: "Prague" }, { key: "Prague_Castle" }] })).toBe("Prague");
		expect(parseWikiSearch({ pages: [] })).toBeNull();
		expect(parseWikiSearch(null)).toBeNull();
	});

	it("parseWikiSummary reads title, description, lead, picture and link", () => {
		const s = parseWikiSummary(
			{
				title: "Prague",
				description: "Capital of the Czech Republic",
				extract: "Prague is the capital and largest city of the Czech Republic.",
				thumbnail: { source: "https://upload.wikimedia.org/x.jpg" },
				content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Prague" } },
			},
			"en",
		);
		expect(s).toEqual({
			title: "Prague",
			description: "Capital of the Czech Republic",
			extract: "Prague is the capital and largest city of the Czech Republic.",
			thumbnail: "https://upload.wikimedia.org/x.jpg",
			url: "https://en.wikipedia.org/wiki/Prague",
			lang: "en",
		});
	});

	it("parseWikiSummary builds the link itself and skips non-articles", () => {
		expect(parseWikiSummary({ title: "Alan Turing", extract: "…" }, "de")?.url).toBe(
			"https://de.wikipedia.org/wiki/Alan_Turing",
		);
		expect(parseWikiSummary({ title: "Nothing" }, "en")).toBeNull();
		expect(parseWikiSummary("oops", "en")).toBeNull();
	});
});
