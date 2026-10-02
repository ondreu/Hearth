/**
 * What has been read, across every RSS card (#377).
 *
 * An entry is read once it has been opened — in the reader or the browser —
 * or marked so by hand. The record lives in the plugin's `data.json`
 * (`HomeSettings.rssRead`), so it follows the vault to every device the
 * settings sync to: read on the phone, read on the desktop.
 *
 * Each entry is one short key — a hash of the feed's address and the entry's
 * id — against the day it was read. Feeds are large and long-lived, so the
 * record is bounded: past {@link MAX_READ} keys the ones read longest ago go
 * first, which only ever matters for entries that dropped out of their feeds
 * long ago.
 *
 * A change is saved quietly — `saveData`, not `saveSettings`, since redrawing
 * every board for one tick of "read" would be absurd — and announced to
 * whoever listens (the cards, the reader), which repaint just themselves.
 */
import type { RssItem } from "./rss";
import type { HomeSettings } from "./types";

/** The most read marks kept. */
export const MAX_READ = 5000;

/** What the store needs from the plugin. */
export interface RssStateHost {
	settings: HomeSettings;
	saveData(data: unknown): Promise<void>;
}

let host: RssStateHost | null = null;
let saveTimer: number | null = null;
const listeners = new Set<() => void>();

/** Hand the store the plugin, at load. */
export function initRssState(plugin: RssStateHost): void {
	host = plugin;
}

/** A 53-bit string hash (cyrb53), in base 36: short, and plenty for telling
 * a few thousand entries apart. */
function hash(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The key an entry is remembered under. */
export function rssReadKey(feedUrl: string, item: Pick<RssItem, "id">): string {
	return hash(`${feedUrl}\n${item.id}`);
}

/** The record, or an empty one when settings hold something unusable. */
function record(settings: HomeSettings | undefined = host?.settings): Record<string, number> {
	const map = settings?.rssRead;
	return map && typeof map === "object" && !Array.isArray(map) ? map : {};
}

/** Whether an entry has been read. */
export function isRssRead(feedUrl: string, item: Pick<RssItem, "id">): boolean {
	return rssReadKey(feedUrl, item) in record();
}

/** How many of a feed's entries are unread. */
export function unreadCount(feedUrl: string, items: readonly RssItem[]): number {
	const map = record();
	let n = 0;
	for (const item of items) if (!(rssReadKey(feedUrl, item) in map)) n++;
	return n;
}

/** Keep the newest `max` marks, dropping those read longest ago. Pure. */
export function pruneRead(map: Record<string, number>, max = MAX_READ): Record<string, number> {
	const keys = Object.keys(map);
	if (keys.length <= max) return map;
	const kept = keys.sort((a, b) => map[b] - map[a]).slice(0, max);
	const out: Record<string, number> = {};
	for (const key of kept) out[key] = map[key];
	return out;
}

/** Mark entries read or unread, save (soon) and tell the listeners. */
export function setRssRead(entries: readonly { url: string; item: Pick<RssItem, "id"> }[], read: boolean): void {
	if (!host || entries.length === 0) return;
	let map = { ...record() };
	const day = Math.floor(Date.now() / 86_400_000);
	let changed = false;
	for (const { url, item } of entries) {
		const key = rssReadKey(url, item);
		if (read && !(key in map)) {
			map[key] = day;
			changed = true;
		} else if (!read && key in map) {
			delete map[key];
			changed = true;
		}
	}
	if (!changed) return;
	map = pruneRead(map);
	host.settings.rssRead = map;
	scheduleSave();
	for (const fn of [...listeners]) fn();
}

/** Be told whenever something is marked read or unread. Returns the
 * unsubscribe. */
export function onRssReadChange(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function scheduleSave(): void {
	if (saveTimer !== null) window.clearTimeout(saveTimer);
	saveTimer = window.setTimeout(() => {
		saveTimer = null;
		if (host) void host.saveData(host.settings);
	}, 800);
}

/** Write a pending change now (on unload). */
export function flushRssState(): void {
	if (saveTimer === null) return;
	window.clearTimeout(saveTimer);
	saveTimer = null;
	if (host) void host.saveData(host.settings);
}
