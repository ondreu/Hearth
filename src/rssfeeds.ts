/**
 * An RSS card's feeds as the card, its terminal form and the reader all see
 * them: the tabs (one per feed, and "All" when the card merges them), the
 * entries under a tab, newest first, and what each is called. Kept in one
 * place so the reader steps through exactly the list the card shows.
 */
import { feedHost } from "./cardbodies";
import { t } from "./i18n";
import { cachedFeed, type RssItem } from "./rss";
import { isRssRead, rssReadKey, unreadCount } from "./rssstate";
import type { DashboardCard, RssSource } from "./types";

/** A header tab: one feed, or the merged "All" over several. */
export interface RssTab {
	id: string;
	urls: string[];
}

/** One entry with the feed it came from. */
export interface RssEntry {
	url: string;
	item: RssItem;
	/** The feed's display name. */
	feed: string;
	/** The entry's read-state key, which also names it in a reader tab's state. */
	key: string;
}

/** The card's feeds that have an address. */
export function rssSources(card: DashboardCard): RssSource[] {
	return (card.rss?.sources ?? []).filter((s) => s.url.trim());
}

/** The card's tabs, "All" first when it merges more than one feed. */
export function rssTabs(card: DashboardCard): RssTab[] {
	const sources = rssSources(card);
	const tabs: RssTab[] = [];
	if (card.rss?.mergeAll && sources.length > 1) tabs.push({ id: "all", urls: sources.map((s) => s.url) });
	for (const s of sources) tabs.push({ id: s.id, urls: [s.url] });
	return tabs;
}

/** A feed's name: the card's for it, else the feed's own title, else its host. */
export function rssSourceLabel(source: RssSource): string {
	return source.name.trim() || cachedFeed(source.url)?.title || feedHost(source.url);
}

/** What a tab is called. */
export function rssTabLabel(card: DashboardCard, tab: RssTab): string {
	if (tab.id === "all") return t().cards.rss.allTab;
	const source = rssSources(card).find((s) => s.id === tab.id);
	return rssSourceLabel(source ?? { id: tab.id, name: "", url: tab.urls[0] });
}

/** Every cached entry under a tab, newest first across merged feeds. */
export function rssTabEntries(card: DashboardCard, tab: RssTab): RssEntry[] {
	const sources = rssSources(card);
	const out: RssEntry[] = [];
	for (const url of tab.urls) {
		const feed = cachedFeed(url);
		if (!feed) continue;
		const source = sources.find((s) => s.url === url);
		const label = source ? rssSourceLabel(source) : feed.title || feedHost(url);
		for (const item of feed.items) out.push({ url, item, feed: label, key: rssReadKey(url, item) });
	}
	if (tab.urls.length > 1) out.sort((a, b) => (b.item.published ?? 0) - (a.item.published ?? 0));
	return out;
}

/** Whether every feed under a tab has been fetched at least once. */
export function rssTabLoaded(tab: RssTab): boolean {
	return tab.urls.every((url) => cachedFeed(url) !== null);
}

/** How many entries under a tab are unread. */
export function rssTabUnread(tab: RssTab): number {
	let n = 0;
	for (const url of tab.urls) n += unreadCount(url, cachedFeed(url)?.items ?? []);
	return n;
}

/** Whether an entry has been read. */
export function rssEntryRead(entry: Pick<RssEntry, "url" | "item">): boolean {
	return isRssRead(entry.url, entry.item);
}

/** A tab's entries as a list shows them: all, or only the unread when the
 * card says so — keeping `keep` (the entry being read) either way, so marking
 * it read doesn't pull it out from under the reader. */
export function rssVisibleEntries(card: DashboardCard, tab: RssTab, keep?: string): RssEntry[] {
	const all = rssTabEntries(card, tab);
	if (!card.rss?.unreadOnly) return all;
	return all.filter((e) => e.key === keep || !rssEntryRead(e));
}

/** The card a reader tab belongs to, wherever it lives: a board or the
 * pinned row. */
export function findRssCard(
	settings: { dashboards: { cards: DashboardCard[] }[]; pinnedCards?: DashboardCard[] },
	id: string,
): DashboardCard | null {
	for (const d of settings.dashboards) {
		const card = d.cards.find((c) => c.id === id && c.kind === "rss");
		if (card) return card;
	}
	return settings.pinnedCards?.find((c) => c.id === id && c.kind === "rss") ?? null;
}
