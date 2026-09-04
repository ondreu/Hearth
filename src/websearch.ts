/**
 * The engines behind the “Search online” button: DuckDuckGo out of the
 * box, with a dropdown beside the button offering the rest for a one-off
 * search.
 *
 * Every engine here is reachable with a plain GET query string — no API key, no
 * account, nothing to configure — so the button stays a link-opener rather than
 * a network client. The list is deliberately short and stable: these are the
 * engines that accept `?q=` and render a normal results page for a signed-out
 * visitor.
 */

/** Ids are stored in settings, so they are part of the settings format: rename
 * one and existing vaults fall back to the default. */
export type WebSearchEngineId =
	| "duckduckgo"
	| "duckduckgo-noai"
	| "brave"
	| "kagi"
	| "google"
	| "mojeek"
	| "ecosia"
	| "qwant";

export interface WebSearchEngine {
	id: WebSearchEngineId;
	/** Shown in the dropdown and the settings picker. A brand name, so it is not
	 * translated — only the “(no AI)” qualifier reads as words, and it names a
	 * DuckDuckGo feature rather than describing one. */
	name: string;
	/** The search URL up to and including the query parameter; the encoded query
	 * is appended to it. */
	search: string;
	/** The page opened when the search field is empty — the engine's own start
	 * page, which is where "search online with nothing typed" should land. */
	home: string;
}

/** The dropdown's order, top to bottom. DuckDuckGo leads because it is the
 * default and was the only engine before the dropdown existed. */
export const WEB_SEARCH_ENGINES: readonly WebSearchEngine[] = [
	{
		id: "duckduckgo",
		name: "DuckDuckGo",
		search: "https://duckduckgo.com/?q=",
		home: "https://duckduckgo.com/",
	},
	{
		// DuckDuckGo's own opt-out host: same results, with the AI answers and the
		// Duck.ai entry points switched off for the session.
		id: "duckduckgo-noai",
		name: "DuckDuckGo (no AI)",
		search: "https://noai.duckduckgo.com/?q=",
		home: "https://noai.duckduckgo.com/",
	},
	{
		id: "brave",
		name: "Brave",
		search: "https://search.brave.com/search?q=",
		home: "https://search.brave.com/",
	},
	{
		// Kagi is subscription-only: the search page asks a signed-out visitor to
		// log in rather than refusing the query, so the link still does the right
		// thing for the people who pick it.
		id: "kagi",
		name: "Kagi",
		search: "https://kagi.com/search?q=",
		home: "https://kagi.com/",
	},
	{
		id: "google",
		name: "Google",
		search: "https://www.google.com/search?q=",
		home: "https://www.google.com/",
	},
	{
		id: "mojeek",
		name: "Mojeek",
		search: "https://www.mojeek.com/search?q=",
		home: "https://www.mojeek.com/",
	},
	{
		id: "ecosia",
		name: "Ecosia",
		search: "https://www.ecosia.org/search?q=",
		home: "https://www.ecosia.org/",
	},
	{
		id: "qwant",
		name: "Qwant",
		search: "https://www.qwant.com/?q=",
		home: "https://www.qwant.com/",
	},
];

/** The engine Hearth uses when nothing else is chosen. */
export const DEFAULT_WEB_SEARCH_ENGINE: WebSearchEngineId = "duckduckgo";

/** Whether `id` is one of the engines above — used to validate settings and
 * imported layouts, which can carry anything. */
export function isWebSearchEngineId(id: unknown): id is WebSearchEngineId {
	return WEB_SEARCH_ENGINES.some((e) => e.id === id);
}

/** The engine for an id, falling back to DuckDuckGo for an unknown or missing
 * one (an older settings file, or a hand-edited one). */
export function webSearchEngine(id: string | undefined): WebSearchEngine {
	return (
		WEB_SEARCH_ENGINES.find((e) => e.id === id) ??
		WEB_SEARCH_ENGINES.find((e) => e.id === DEFAULT_WEB_SEARCH_ENGINE)!
	);
}

/** The URL a search for `query` opens on `engine` — the engine's home page when
 * the query is empty. */
export function webSearchUrl(engine: WebSearchEngine, query: string): string {
	const q = query.trim();
	return q ? engine.search + encodeURIComponent(q) : engine.home;
}

/** Open a web search in the user's browser. Split from the button so the URL
 * can be built and tested without a DOM. */
export function openWebSearch(id: string | undefined, query: string): void {
	const url = webSearchUrl(webSearchEngine(id), query);
	try {
		window.open(url, "_blank");
	} catch {
		// Pop-up blocked or unavailable — fall back to Obsidian's window opener.
		window.open(url, "_blank", "noopener");
	}
}
