/**
 * Feed fetching and parsing for the "rss" card.
 *
 * Feeds are fetched through Obsidian's `requestUrl` (which bypasses the browser
 * CORS restrictions a plain `fetch` would hit) and parsed with the platform
 * `DOMParser`. Both RSS 2.0 (`<item>`) and Atom (`<entry>`) are understood.
 *
 * Results are cached in memory per URL for a card-configurable window, so a
 * board with several feed cards (and Hearth's frequent full re-renders) makes at
 * most one request per feed per refresh window. Everything degrades gracefully
 * offline: a failed fetch keeps the last good items, and the one outbound
 * request is skipped entirely when the user has disabled external calls.
 */
import { requestUrl } from "obsidian";

/** A single parsed feed entry, normalised across RSS and Atom. */
export interface RssItem {
	title: string;
	/** Absolute link to the article, or "" when the feed gives none. */
	link: string;
	/** Plain-text excerpt (HTML stripped, collapsed whitespace). */
	excerpt: string;
	/** Publish time in epoch ms, or null when absent/unparseable. */
	published: number | null;
	/** Thumbnail image URL when the item advertises one, else "". */
	image: string;
}

/** A parsed feed: its own title plus its items, newest first. */
export interface RssFeed {
	/** The feed's `<title>`, or "" when it has none. */
	title: string;
	items: RssItem[];
	/** Epoch ms when these items were fetched. */
	fetched: number;
}

interface CacheEntry {
	feed: RssFeed | null;
	inflight: Promise<RssFeed | null> | null;
}

const cache = new Map<string, CacheEntry>();

/** The last-fetched feed for a URL (possibly stale), or null if never loaded. */
export function cachedFeed(url: string): RssFeed | null {
	return cache.get(url)?.feed ?? null;
}

/**
 * Return a feed, fetching only when the cache is missing or older than
 * `ttlMs`. Concurrent callers for the same URL share one in-flight request.
 * Never throws: on failure it returns whatever was cached (possibly null).
 *
 * When `disabled` is true (the "disable external calls" setting) no request is
 * made — only an already-cached feed, if any, is returned. Set `force` to
 * bypass the freshness check for an explicit manual refresh.
 */
export async function loadFeed(
	url: string,
	opts: { ttlMs: number; disabled?: boolean; force?: boolean } = { ttlMs: 0 },
): Promise<RssFeed | null> {
	let entry = cache.get(url);
	if (!entry) {
		entry = { feed: null, inflight: null };
		cache.set(url, entry);
	}
	if (opts.disabled) return entry.feed;
	const fresh =
		entry.feed && Date.now() - entry.feed.fetched < opts.ttlMs;
	if (fresh && !opts.force) return entry.feed;
	if (entry.inflight) return entry.inflight;

	const current = entry;
	current.inflight = (async () => {
		try {
			const res = await requestUrl({ url });
			const parsed = parseFeed(res.text);
			// Keep prior items when a fetch returns something unparseable.
			if (parsed) current.feed = parsed;
			return current.feed;
		} catch {
			// Offline or blocked — keep any prior items.
			return current.feed;
		} finally {
			current.inflight = null;
		}
	})();
	return current.inflight;
}

/** Drop cached data so the next load refetches. Used when a source URL changes. */
export function forgetFeed(url: string): void {
	cache.delete(url);
}

/** Parse a raw RSS/Atom document into a normalised feed, or null when the text
 * isn't a recognisable feed. Exported for direct use and testing. */
export function parseFeed(xml: string): RssFeed | null {
	const doc = new DOMParser().parseFromString(xml, "text/xml");
	// A parse error yields a <parsererror> element rather than throwing.
	if (doc.querySelector("parsererror")) return null;

	const channel = doc.querySelector("channel");
	const atomFeed = doc.querySelector("feed");
	const root = channel ?? atomFeed;
	if (!root) return null;

	const title = text(root.querySelector(":scope > title"));
	const entries = channel
		? Array.from(doc.querySelectorAll("item"))
		: Array.from(doc.querySelectorAll("entry"));

	const items: RssItem[] = entries.map((el) =>
		channel ? parseRssItem(el) : parseAtomEntry(el),
	);
	// Newest first; items with no date sink to the bottom in original order.
	items.sort((a, b) => (b.published ?? 0) - (a.published ?? 0));
	return { title, items, fetched: Date.now() };
}

/** An RSS 2.0 `<item>`. */
function parseRssItem(el: Element): RssItem {
	const description = text(el.querySelector("description"));
	const encoded = text(tagNS(el, "content:encoded"));
	const body = encoded || description;
	return {
		title: text(el.querySelector("title")),
		link: text(el.querySelector("link")),
		excerpt: stripHtml(description || encoded),
		published: parseDate(
			text(el.querySelector("pubDate")) ||
				text(tagNS(el, "dc:date")),
		),
		image: rssImage(el, body),
	};
}

/** An Atom `<entry>`. */
function parseAtomEntry(el: Element): RssItem {
	const summary =
		text(el.querySelector("summary")) || text(el.querySelector("content"));
	return {
		title: text(el.querySelector("title")),
		link: atomLink(el),
		excerpt: stripHtml(summary),
		published: parseDate(
			text(el.querySelector("published")) ||
				text(el.querySelector("updated")),
		),
		image: htmlImage(summary),
	};
}

/** Atom links live in <link href> attributes; prefer rel="alternate"/no rel. */
function atomLink(el: Element): string {
	const links = Array.from(el.querySelectorAll("link"));
	const alt =
		links.find((l) => l.getAttribute("rel") === "alternate") ??
		links.find((l) => !l.getAttribute("rel")) ??
		links[0];
	return alt?.getAttribute("href")?.trim() ?? "";
}

/** Best-effort thumbnail for an RSS item: media/enclosure elements first, then
 * the first <img> in the item's HTML body. */
function rssImage(el: Element, htmlBody: string): string {
	const mediaContent = el.querySelector("*|content[url]");
	const mediaThumb = el.querySelector("*|thumbnail[url]");
	const media = mediaContent ?? mediaThumb;
	if (media) {
		const type = media.getAttribute("type") ?? "";
		const medium = media.getAttribute("medium") ?? "";
		// media:content may point at video/audio too — only take images.
		if (!type || type.startsWith("image") || medium === "image") {
			const url = media.getAttribute("url")?.trim();
			if (url) return url;
		}
	}
	const enclosure = el.querySelector("enclosure[type^='image']");
	const enc = enclosure?.getAttribute("url")?.trim();
	if (enc) return enc;
	return htmlImage(htmlBody);
}

/** First <img src> found in a snippet of HTML markup, or "". */
function htmlImage(html: string): string {
	const m = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html);
	return m ? m[1].trim() : "";
}

/** Read a namespaced child (e.g. "content:encoded", "dc:date") independent of
 * how the parser exposes the prefix. */
function tagNS(el: Element, name: string): Element | null {
	const direct = el.getElementsByTagName(name);
	if (direct.length) return direct[0];
	const local = name.split(":").pop() ?? name;
	const byLocal = el.getElementsByTagName(local);
	return byLocal.length ? byLocal[0] : null;
}

/** Trimmed text content of an element, or "" when null. */
function text(el: Element | null): string {
	return el?.textContent?.trim() ?? "";
}

/** Strip HTML tags and entities down to a single-line plain-text excerpt. */
function stripHtml(html: string): string {
	if (!html) return "";
	const doc = new DOMParser().parseFromString(html, "text/html");
	return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Parse a feed date (RFC 822 or ISO 8601) to epoch ms, or null. */
function parseDate(raw: string): number | null {
	if (!raw) return null;
	const t = Date.parse(raw);
	return Number.isNaN(t) ? null : t;
}
