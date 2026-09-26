/**
 * The market card's requests, and the cache in front of them.
 *
 * Every card on every board shares one cache, keyed by source and symbol, so
 * ten cards watching the same fund make one request per refresh window, and a
 * full re-render (Hearth redraws boards often) never turns into a request. A
 * failed request is remembered for the same window too, so a source that is
 * down — or, from mainland China, Yahoo — isn't asked again on every redraw;
 * the feed falls through to the next source for the instrument instead (see
 * resolveSymbol in market.ts), and remembers which one answered.
 *
 * Nothing here throws. A card asks, waits, and reads whatever is cached.
 * With **Disable external calls** on, nothing is fetched at all.
 */
import { requestUrl, type RequestUrlResponse } from "obsidian";
import {
	coinParts,
	frankfurterQuote,
	type MarketQuote,
	type MarketSearchResult,
	type MarketSeries,
	type MarketTarget,
	mergeSearchResults,
	parseCoinGeckoChart,
	parseCoinGeckoMarkets,
	parseCoinGeckoSearch,
	parseEastmoneyEstimate,
	parseEastmoneyHistory,
	parseFrankfurterSeries,
	parseTencentKline,
	parseTencentMinutes,
	parseTencentQuotes,
	parseTencentSearch,
	parseYahooChart,
	parseYahooSearch,
	rangeDays,
	targetKey,
	tencentKey,
	wantsChineseSearch,
	yahooRange,
} from "./market";
import type { MarketProviderId, MarketRange } from "./types";

/** How the caller wants a load to behave. */
export interface MarketLoadOptions {
	/** How long a reading stays fresh. */
	ttlMs: number;
	/** The privacy switch: when true nothing is fetched. */
	disabled?: boolean;
	/** Refetch even what is fresh (the refresh button, the refresh timer). */
	force?: boolean;
}

/** A closed market's price won't move until it opens, so its quote is kept at
 * least this long however short the card's refresh is. */
const CLOSED_TTL_MS = 30 * 60_000;
/** A chart longer than a day is drawn from daily bars; an hour is plenty. */
const LONG_SERIES_TTL_MS = 60 * 60_000;
/** Yahoo requests in flight at once; the rest wait their turn. */
const YAHOO_CONCURRENCY = 4;
/** Tencent takes many symbols per request; this many at a time. */
const TENCENT_BATCH = 50;

interface Entry<T> {
	value: T | null;
	fetched: number;
	/** When the last attempt failed, so a dead source isn't retried on every
	 * redraw. 0 = the last attempt didn't fail. */
	failedAt: number;
}

const quotes = new Map<string, Entry<MarketQuote>>();
const series = new Map<string, Entry<MarketSeries>>();
/** For each item (its list of targets), the index of the target that last
 * answered, so the next load starts there. */
const preferred = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

function itemKey(targets: MarketTarget[]): string {
	return targets.map(targetKey).join("|");
}

function seriesKey(target: MarketTarget, range: MarketRange): string {
	return `${targetKey(target)}@${range}`;
}

/** The item's targets, the one that last answered first. */
function ordered(targets: MarketTarget[]): MarketTarget[] {
	const idx = preferred.get(itemKey(targets)) ?? 0;
	if (idx <= 0 || idx >= targets.length) return targets;
	return [targets[idx], ...targets.slice(0, idx), ...targets.slice(idx + 1)];
}

function remember(targets: MarketTarget[], target: MarketTarget): void {
	const idx = targets.findIndex((t) => targetKey(t) === targetKey(target));
	if (idx >= 0) preferred.set(itemKey(targets), idx);
}

function quoteTtl(quote: MarketQuote, ttlMs: number): number {
	return quote.state === "closed" ? Math.max(ttlMs, CLOSED_TTL_MS) : ttlMs;
}

/** The newest quote any of the item's targets has, preferring the one that
 * last answered. Null when none has ever loaded. */
export function cachedQuote(targets: MarketTarget[]): MarketQuote | null {
	for (const target of ordered(targets)) {
		const q = quotes.get(targetKey(target))?.value;
		if (q) return q;
	}
	return null;
}

/** The chart the item's preferred target has for a range, if any. */
export function cachedSeries(targets: MarketTarget[], range: MarketRange): MarketSeries | null {
	for (const target of ordered(targets)) {
		const s = series.get(seriesKey(target, range))?.value;
		if (s) return s;
	}
	return null;
}

function storeQuote(target: MarketTarget, quote: MarketQuote | null, now: number): void {
	const key = targetKey(target);
	const prev = quotes.get(key);
	if (quote) quotes.set(key, { value: quote, fetched: now, failedAt: 0 });
	else quotes.set(key, { value: prev?.value ?? null, fetched: prev?.fetched ?? 0, failedAt: now });
}

function storeSeries(target: MarketTarget, range: MarketRange, value: MarketSeries | null, now: number): void {
	const key = seriesKey(target, range);
	const prev = series.get(key);
	if (value) series.set(key, { value, fetched: now, failedAt: 0 });
	else series.set(key, { value: prev?.value ?? null, fetched: prev?.fetched ?? 0, failedAt: now });
}

/** Whether a target needs asking: nothing fresh cached, and no failure inside
 * the window either (unless forced). */
function needsQuote(target: MarketTarget, opts: MarketLoadOptions, now: number): boolean {
	const entry = quotes.get(targetKey(target));
	if (!entry) return true;
	if (opts.force) return true;
	if (entry.failedAt && now - entry.failedAt < opts.ttlMs) return false;
	if (!entry.value) return true;
	return now - entry.fetched >= quoteTtl(entry.value, opts.ttlMs);
}

function failedRecently(target: MarketTarget, opts: MarketLoadOptions, now: number): boolean {
	const entry = quotes.get(targetKey(target));
	return !opts.force && !!entry?.failedAt && now - entry.failedAt < opts.ttlMs && !entry.value;
}

// ---- Requests ---------------------------------------------------------------

async function get(url: string): Promise<RequestUrlResponse | null> {
	try {
		const res = await requestUrl({ url, throw: false });
		return res.status >= 200 && res.status < 300 ? res : null;
	} catch {
		// Offline, blocked, or a TLS failure: the same "no answer" to the card.
		return null;
	}
}

/** Tencent answers in GBK, which `text` would mangle. Every engine Obsidian
 * runs on decodes GBK (it is in the Encoding Standard). */
function gbkText(res: RequestUrlResponse): string {
	try {
		return new TextDecoder("gbk").decode(res.arrayBuffer);
	} catch {
		return res.text;
	}
}

function json(res: RequestUrlResponse | null): unknown {
	if (!res) return null;
	try {
		return res.json as unknown;
	} catch {
		return null;
	}
}

/** Run `fn` over `items`, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	const worker = async (): Promise<void> => {
		while (next < items.length) {
			const item = items[next++];
			await fn(item);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** One request per key at a time: a second caller waits on the first. */
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
	const running = inflight.get(key) as Promise<T> | undefined;
	if (running) return running;
	const p = run().finally(() => inflight.delete(key));
	inflight.set(key, p);
	return p;
}

const YAHOO_HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

async function yahooChart(symbol: string, range: MarketRange): Promise<unknown> {
	const { range: r, interval } = yahooRange(range);
	const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${interval}&includePrePost=false`;
	for (const host of YAHOO_HOSTS) {
		const body = json(await get(host + path));
		if (body) return body;
	}
	return null;
}

async function fetchYahooQuotes(targets: MarketTarget[]): Promise<void> {
	await pool(targets, YAHOO_CONCURRENCY, async (target) => {
		await once(`q:${targetKey(target)}`, async () => {
			const now = Date.now();
			const parsed = parseYahooChart(await yahooChart(target.symbol, "1d"), target, "1d", now);
			storeQuote(target, parsed.quote, now);
			// The day's chart rides along with the quote; keep it.
			if (parsed.series) storeSeries(target, "1d", parsed.series, now);
		});
	});
}

async function fetchTencentQuotes(targets: MarketTarget[]): Promise<void> {
	for (let i = 0; i < targets.length; i += TENCENT_BATCH) {
		const batch = targets.slice(i, i + TENCENT_BATCH);
		const list = batch.map((t) => t.symbol).join(",");
		await once(`q:tencent:${list}`, async () => {
			const now = Date.now();
			const res = await get(`https://qt.gtimg.cn/q=${list}`);
			const parsed = res ? parseTencentQuotes(gbkText(res), now) : new Map<string, MarketQuote>();
			for (const target of batch) {
				const q = parsed.get(tencentKey(target.symbol)) ?? null;
				// Keep the card's own spelling of the symbol on the quote.
				storeQuote(target, q ? { ...q, target } : null, now);
			}
		});
	}
}

async function fetchEastmoneyQuotes(targets: MarketTarget[]): Promise<void> {
	await pool(targets, YAHOO_CONCURRENCY, async (target) => {
		await once(`q:${targetKey(target)}`, async () => {
			const now = Date.now();
			const res = await get(
				`https://fundgz.1234567.com.cn/js/${encodeURIComponent(target.symbol)}.js?rt=${now}`,
			);
			storeQuote(target, res ? parseEastmoneyEstimate(res.text, target.symbol, now) : null, now);
		});
	});
}

async function fetchCoinGeckoQuotes(targets: MarketTarget[]): Promise<void> {
	const byVs = new Map<string, MarketTarget[]>();
	for (const target of targets) {
		const { vs } = coinParts(target.symbol);
		byVs.set(vs, [...(byVs.get(vs) ?? []), target]);
	}
	for (const [vs, group] of byVs) {
		const ids = group.map((t) => coinParts(t.symbol).id).join(",");
		await once(`q:coingecko:${vs}:${ids}`, async () => {
			const now = Date.now();
			const params = new URLSearchParams({ vs_currency: vs, ids, price_change_percentage: "24h" });
			const res = await get(`https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`);
			const parsed = parseCoinGeckoMarkets(json(res), vs, now);
			for (const target of group) {
				const q = parsed.get(coinParts(target.symbol).id) ?? null;
				storeQuote(target, q ? { ...q, target } : null, now);
			}
		});
	}
}

function isoDay(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

async function frankfurterSeries(pair: string, days: number): Promise<MarketSeries | null> {
	const [from, to] = pair.split("/");
	if (!from || !to) return null;
	const start = isoDay(Date.now() - days * 86_400_000);
	const params = new URLSearchParams({ from, to });
	const res = await get(`https://api.frankfurter.app/${start}..?${params.toString()}`);
	return parseFrankfurterSeries(json(res), to);
}

async function fetchFrankfurterQuotes(targets: MarketTarget[]): Promise<void> {
	await pool(targets, YAHOO_CONCURRENCY, async (target) => {
		await once(`q:${targetKey(target)}`, async () => {
			const now = Date.now();
			// Two weeks back always holds two fixes, holidays and all.
			const s = await frankfurterSeries(target.symbol, 14);
			storeQuote(target, s ? frankfurterQuote(s, target.symbol, now) : null, now);
		});
	});
}

const QUOTE_FETCHERS: Record<MarketProviderId, (targets: MarketTarget[]) => Promise<void>> = {
	yahoo: fetchYahooQuotes,
	tencent: fetchTencentQuotes,
	eastmoney: fetchEastmoneyQuotes,
	coingecko: fetchCoinGeckoQuotes,
	frankfurter: fetchFrankfurterQuotes,
};

/**
 * Bring every item's quote up to date. Each item is a list of targets (see
 * resolveSymbol); the feed asks the one that answered last time, and falls
 * through the rest, round by round, for the items it didn't get — batching
 * each round by source, so a board of Shanghai funds is one Tencent request.
 */
export async function loadQuotes(items: MarketTarget[][], opts: MarketLoadOptions): Promise<void> {
	if (opts.disabled) return;
	const now = Date.now();
	interface Pending {
		targets: MarketTarget[];
		order: MarketTarget[];
		/** The target this item is on. */
		cursor: number;
	}
	let pending: Pending[] = items
		.filter((targets) => targets.length > 0)
		.map((targets) => ({ targets, order: ordered(targets), cursor: 0 }))
		// Fresh on the target that answered last: nothing to do.
		.filter(({ order }) => needsQuote(order[0], opts, now) || !quotes.get(targetKey(order[0]))?.value);

	while (pending.length) {
		const asks = new Map<MarketProviderId, Map<string, MarketTarget>>();
		const asked: { item: Pending; target: MarketTarget }[] = [];
		for (const item of pending) {
			// Step past targets that failed inside the window.
			while (item.cursor < item.order.length - 1 && failedRecently(item.order[item.cursor], opts, now)) {
				item.cursor++;
			}
			const target = item.order[item.cursor];
			if (!target) continue;
			asked.push({ item, target });
			if (!needsQuote(target, opts, now)) continue;
			const group = asks.get(target.provider) ?? new Map<string, MarketTarget>();
			group.set(targetKey(target), target);
			asks.set(target.provider, group);
		}
		await Promise.all(
			[...asks].map(([provider, group]) => QUOTE_FETCHERS[provider]([...group.values()])),
		);
		const next: Pending[] = [];
		for (const { item, target } of asked) {
			const entry = quotes.get(targetKey(target));
			if (entry?.value && !entry.failedAt) {
				remember(item.targets, target);
			} else if (asks.size && item.cursor + 1 < item.order.length) {
				item.cursor++;
				next.push(item);
			}
		}
		pending = next;
	}
}

// ---- Charts -----------------------------------------------------------------

async function seriesFrom(target: MarketTarget, range: MarketRange): Promise<MarketSeries | null> {
	const now = Date.now();
	switch (target.provider) {
		case "yahoo": {
			const parsed = parseYahooChart(await yahooChart(target.symbol, range), target, range, now);
			// A day's chart carries the freshest quote as well.
			if (range === "1d" && parsed.quote) storeQuote(target, parsed.quote, now);
			return parsed.series;
		}
		case "tencent": {
			const mainland = /^(sh|sz|bj)\d{6}$/i.test(target.symbol);
			if (range === "1d") {
				if (!mainland) return null;
				const res = await get(
					`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${encodeURIComponent(target.symbol)}`,
				);
				const base = quotes.get(targetKey(target))?.value?.prevClose ?? null;
				return parseTencentMinutes(json(res), target.symbol.toLowerCase(), base);
			}
			const counts: Record<Exclude<MarketRange, "1d">, [string, number]> = {
				"5d": ["day", 6],
				"1mo": ["day", 23],
				"6mo": ["day", 128],
				"1y": ["day", 252],
				"5y": ["week", 262],
			};
			const [unit, count] = counts[range];
			const adjust = mainland ? "qfq" : "";
			const res = await get(
				`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(
					`${target.symbol},${unit},,,${count},${adjust}`,
				)}`,
			);
			return parseTencentKline(json(res), target.symbol);
		}
		case "eastmoney": {
			// A fund's value is published once a day: no intraday chart.
			if (range === "1d") return null;
			const res = await get(`https://fund.eastmoney.com/pingzhongdata/${encodeURIComponent(target.symbol)}.js`);
			return res ? parseEastmoneyHistory(res.text, rangeDays(range), now) : null;
		}
		case "coingecko": {
			const { id, vs } = coinParts(target.symbol);
			// The key-less API serves a year of history, no more.
			const days = Math.min(rangeDays(range), 365);
			const params = new URLSearchParams({ vs_currency: vs, days: String(days) });
			const res = await get(
				`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?${params.toString()}`,
			);
			return parseCoinGeckoChart(json(res));
		}
		case "frankfurter":
			// Daily fixes only; a day's chart is a week of them.
			return frankfurterSeries(target.symbol, Math.max(rangeDays(range), 7));
	}
}

/** The chart for an item over a range, from the first target that has one. */
export async function loadSeries(
	targets: MarketTarget[],
	range: MarketRange,
	opts: MarketLoadOptions,
): Promise<MarketSeries | null> {
	if (opts.disabled || !targets.length) return cachedSeries(targets, range);
	const ttl = range === "1d" ? opts.ttlMs : Math.max(opts.ttlMs, LONG_SERIES_TTL_MS);
	const now = Date.now();
	for (const target of ordered(targets)) {
		const key = seriesKey(target, range);
		const entry = series.get(key);
		if (entry?.value && !opts.force && now - entry.fetched < ttl) return entry.value;
		if (entry?.failedAt && !opts.force && now - entry.failedAt < ttl) continue;
		const value = await once(`s:${key}`, async () => {
			const s = await seriesFrom(target, range);
			storeSeries(target, range, s, Date.now());
			return s;
		});
		if (value) return value;
	}
	return cachedSeries(targets, range);
}

// ---- Search -------------------------------------------------------------------

async function searchYahoo(query: string): Promise<MarketSearchResult[]> {
	const params = new URLSearchParams({ q: query, quotesCount: "10", newsCount: "0", listsCount: "0" });
	for (const host of YAHOO_HOSTS) {
		const body = json(await get(`${host}/v1/finance/search?${params.toString()}`));
		if (body) return parseYahooSearch(body);
	}
	return [];
}

async function searchTencent(query: string): Promise<MarketSearchResult[]> {
	const params = new URLSearchParams({ v: "2", q: query, t: "all", c: "1" });
	const res = await get(`https://smartbox.gtimg.cn/s3/?${params.toString()}`);
	return res ? parseTencentSearch(gbkText(res)) : [];
}

async function searchCoinGecko(query: string): Promise<MarketSearchResult[]> {
	const params = new URLSearchParams({ query });
	const res = await get(`https://api.coingecko.com/api/v3/search?${params.toString()}`);
	return parseCoinGeckoSearch(json(res), 3);
}

/**
 * Look a name or symbol up in every source that could know it, merged into one
 * list. A Chinese name or a mainland code asks Tencent first; everything else
 * asks Yahoo first. Only ever called when the reader searches.
 */
export async function searchMarkets(query: string, opts: { disabled?: boolean } = {}): Promise<MarketSearchResult[]> {
	const q = query.trim();
	if (!q || opts.disabled) return [];
	const chinese = wantsChineseSearch(q);
	const settle = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);
	const [yahoo, tencent, coins] = await Promise.all([
		settle(searchYahoo(q)),
		chinese ? settle(searchTencent(q)) : Promise.resolve([]),
		settle(searchCoinGecko(q)),
	]);
	return mergeSearchResults(chinese ? [tencent, yahoo, coins] : [yahoo, coins]);
}
