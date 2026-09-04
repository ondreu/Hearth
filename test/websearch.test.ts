import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEB_SEARCH_ENGINE,
	isWebSearchEngineId,
	WEB_SEARCH_ENGINES,
	webSearchEngine,
	webSearchUrl,
} from "../src/websearch";
import { DEFAULT_SETTINGS } from "../src/types";

/**
 * The engines behind the “Search online” button and its dropdown. Opening the
 * URL needs a browser; building it doesn't, and that is where the mistakes
 * live — an unencoded query, an engine that lost its query parameter, a
 * settings value from an older vault that no longer names an engine.
 */

describe("the engine list", () => {
	it("starts at DuckDuckGo, which stays the default", () => {
		expect(WEB_SEARCH_ENGINES[0].id).toBe("duckduckgo");
		expect(DEFAULT_WEB_SEARCH_ENGINE).toBe("duckduckgo");
		expect(DEFAULT_SETTINGS.webSearchEngine).toBe("duckduckgo");
	});

	it("offers the five engines the dropdown promises, and three more", () => {
		expect(WEB_SEARCH_ENGINES.map((e) => e.id)).toEqual([
			"duckduckgo",
			"duckduckgo-noai",
			"brave",
			"kagi",
			"google",
			"mojeek",
			"ecosia",
			"qwant",
		]);
	});

	it("gives every engine an https query endpoint and a home page", () => {
		for (const engine of WEB_SEARCH_ENGINES) {
			expect(engine.name.trim()).not.toBe("");
			expect(engine.search.startsWith("https://")).toBe(true);
			expect(engine.home.startsWith("https://")).toBe(true);
			// The query is appended raw, so the URL has to end at the parameter.
			expect(engine.search.endsWith("q=")).toBe(true);
		}
	});

	it("has no duplicate ids", () => {
		const ids = WEB_SEARCH_ENGINES.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("webSearchEngine", () => {
	it("finds an engine by id", () => {
		expect(webSearchEngine("brave").name).toBe("Brave");
	});

	it("falls back to the default for a missing or unknown id", () => {
		expect(webSearchEngine(undefined).id).toBe("duckduckgo");
		expect(webSearchEngine("").id).toBe("duckduckgo");
		expect(webSearchEngine("altavista").id).toBe("duckduckgo");
	});
});

describe("isWebSearchEngineId", () => {
	it("accepts the ids on the list and nothing else", () => {
		expect(isWebSearchEngineId("qwant")).toBe(true);
		expect(isWebSearchEngineId("duckduckgo-noai")).toBe(true);
		expect(isWebSearchEngineId("altavista")).toBe(false);
		expect(isWebSearchEngineId(undefined)).toBe(false);
		expect(isWebSearchEngineId(7)).toBe(false);
	});
});

describe("webSearchUrl", () => {
	it("appends the encoded query", () => {
		expect(webSearchUrl(webSearchEngine("duckduckgo"), "tea & cake")).toBe(
			"https://duckduckgo.com/?q=tea%20%26%20cake",
		);
		expect(webSearchUrl(webSearchEngine("google"), "obsidian md")).toBe(
			"https://www.google.com/search?q=obsidian%20md",
		);
	});

	it("opens the engine's home page when nothing is typed", () => {
		expect(webSearchUrl(webSearchEngine("duckduckgo"), "")).toBe("https://duckduckgo.com/");
		expect(webSearchUrl(webSearchEngine("kagi"), "   ")).toBe("https://kagi.com/");
	});

	it("trims the query rather than searching for the spaces around it", () => {
		expect(webSearchUrl(webSearchEngine("mojeek"), "  hearth  ")).toBe(
			"https://www.mojeek.com/search?q=hearth",
		);
	});

	it("keeps the no-AI DuckDuckGo on its own host", () => {
		expect(webSearchUrl(webSearchEngine("duckduckgo-noai"), "hearth")).toBe(
			"https://noai.duckduckgo.com/?q=hearth",
		);
	});
});
