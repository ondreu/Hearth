/**
 * Wikipedia summaries for the search bar's instant answers (`wiki Prague`).
 *
 * Two key-less Wikimedia REST calls: a title search that turns what was typed
 * into an article, then that article's summary (its lead, a short description
 * and a thumbnail). Answers are cached for the session, so retyping a query
 * doesn't ask again. Only ever called when the reader asks for a wiki lookup,
 * and not at all with **Disable external calls** on.
 *
 * The parsers are pure and tested (test/wiki.test.ts).
 */
import { requestUrl } from "obsidian";

export interface WikiSummary {
	title: string;
	/** Wikidata's one-line description ("Capital of the Czech Republic"). */
	description: string;
	/** The article's lead, as plain text. */
	extract: string;
	/** A small image of the subject, when the article has one. */
	thumbnail: string | null;
	/** The article on the web. */
	url: string;
	/** The wiki's language code, e.g. "en". */
	lang: string;
}

function obj(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** A wiki language code worth putting in a host name, or null. */
export function wikiLang(raw: string): string | null {
	const code = raw.trim().toLowerCase().split(/[-_]/)[0];
	return /^[a-z]{2,3}$/.test(code) ? code : null;
}

/** The article key of the best title match, from `rest.php/v1/search/title`. */
export function parseWikiSearch(json: unknown): string | null {
	const pages = obj(json)?.pages;
	if (!Array.isArray(pages)) return null;
	const key = str(obj(pages[0])?.key);
	return key || null;
}

/** A `page/summary` response, or null when it isn't an article. */
export function parseWikiSummary(json: unknown, lang: string): WikiSummary | null {
	const body = obj(json);
	if (!body) return null;
	const title = str(body.title);
	const extract = str(body.extract);
	if (!title || !extract) return null;
	const page = str(obj(obj(body.content_urls)?.desktop)?.page);
	const thumb = str(obj(body.thumbnail)?.source);
	return {
		title,
		description: str(body.description),
		extract,
		thumbnail: thumb || null,
		url: page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
		lang,
	};
}

/** Wikimedia asks API clients to say who they are. */
const HEADERS = { "Api-User-Agent": "Hearth (Obsidian plugin; https://github.com/ondreu/Hearth)" };

const cache = new Map<string, WikiSummary | null>();
const CACHE_MAX = 50;

async function getJson(url: string): Promise<unknown> {
	try {
		const res = await requestUrl({ url, headers: HEADERS, throw: false });
		return res.status >= 200 && res.status < 300 ? (res.json as unknown) : null;
	} catch {
		return null;
	}
}

/**
 * The summary of the article a query names, on the wiki in `lang`. Never
 * throws: nothing found, offline, or disabled all come back as null.
 */
export async function lookupWiki(
	query: string,
	lang: string,
	opts: { disabled?: boolean } = {},
): Promise<WikiSummary | null> {
	const q = query.trim();
	if (!q || opts.disabled) return null;
	const key = `${lang}|${q.toLowerCase()}`;
	if (cache.has(key)) return cache.get(key) ?? null;
	const base = `https://${lang}.wikipedia.org`;
	const params = new URLSearchParams({ q, limit: "1" });
	const title = parseWikiSearch(await getJson(`${base}/w/rest.php/v1/search/title?${params.toString()}`));
	const summary = title
		? parseWikiSummary(await getJson(`${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`), lang)
		: null;
	if (cache.size >= CACHE_MAX) {
		const [oldest] = cache.keys();
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, summary);
	return summary;
}
