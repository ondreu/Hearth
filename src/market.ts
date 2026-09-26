/**
 * The market card's data, pure: which source a symbol belongs to, what each
 * source's response means, and how a price, a move and a portfolio are written.
 *
 * Nothing here touches the network or the DOM, so all of it is tested directly
 * (test/market.test.ts). The requests themselves, and the cache in front of
 * them, live in marketfeed.ts; the card in cards/market.ts.
 *
 * Every source is free and key-less, and none of them is an official API. That
 * is the trade the card makes for "type a symbol and it works": each symbol is
 * resolved to an ordered list of *targets* — the same instrument as more than
 * one source names it — and the feed falls through the list when a source
 * fails. A Shanghai fund is `sh510300` to Tencent and `510300.SS` to Yahoo, so
 * either can answer for it, and a reader in mainland China (where Yahoo is
 * often unreachable) is served by Tencent first.
 */
import { CURRENCY_CODES } from "./currency";
import type { MarketProviderId, MarketRange } from "./types";

// ---- Shapes ---------------------------------------------------------------

/** One instrument as one source names it. `symbol` is that source's own id. */
export interface MarketTarget {
	provider: MarketProviderId;
	symbol: string;
}

/** What kind of instrument a quote is for; drives formatting and the label. */
export type MarketAssetType =
	| "equity"
	| "etf"
	| "fund"
	| "index"
	| "currency"
	| "crypto"
	| "future"
	| "other";

/** Whether the instrument is trading now. Null when the source doesn't say. */
export type MarketState = "open" | "pre" | "post" | "closed";

/** A price series for a chart: points in time order, and the price the move
 * is measured against (the previous close for a day, the range's first price
 * otherwise). */
export interface MarketSeries {
	points: { t: number; v: number }[];
	baseline: number | null;
}

/** The latest reading for one instrument, normalized across sources. */
export interface MarketQuote {
	target: MarketTarget;
	name: string;
	/** ISO 4217, upper case, after minor units are folded (GBp → GBP). */
	currency: string;
	price: number;
	prevClose: number | null;
	change: number | null;
	changePct: number | null;
	open: number | null;
	dayHigh: number | null;
	dayLow: number | null;
	yearHigh: number | null;
	yearLow: number | null;
	volume: number | null;
	/** Exchange or venue, for display. "" when unknown. */
	exchange: string;
	type: MarketAssetType;
	state: MarketState | null;
	/** Epoch ms of the last trade (or the source's timestamp for it). */
	time: number;
	/** Epoch ms when the quote was fetched. */
	fetched: number;
}

/** One match from a symbol search. */
export interface MarketSearchResult {
	target: MarketTarget;
	/** The symbol as the reader would recognize it ("510300", "AAPL"). */
	display: string;
	name: string;
	exchange: string;
	type: MarketAssetType;
}

// ---- Small helpers --------------------------------------------------------

/** A finite number from whatever the response holds, or null. Numeric strings
 * count: Tencent and Eastmoney send every number as text. */
export function num(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim() !== "") {
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function str(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function obj(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

const FIAT = new Set(CURRENCY_CODES.map((c) => c.toUpperCase()));

/** Whether a three-letter code is a currency the ECB (and Yahoo's forex) quotes. */
export function isFiat(code: string): boolean {
	return FIAT.has(code.toUpperCase());
}

/** A change and its percentage from a price and the one it is measured against. */
export function moveFrom(price: number, base: number | null): { change: number | null; pct: number | null } {
	if (base === null || !Number.isFinite(base)) return { change: null, pct: null };
	const change = price - base;
	return { change, pct: base === 0 ? null : (change / base) * 100 };
}

/**
 * Minor-unit currencies folded to their major unit. London quotes in pence
 * ("GBp"), Johannesburg in cents ("ZAc"), Tel Aviv in agorot ("ILA"); left as
 * they are, a portfolio would add pence to pounds.
 */
export function normalizeCurrency(raw: string): { code: string; factor: number } {
	const code = raw.trim();
	if (code === "GBp" || code === "GBX") return { code: "GBP", factor: 0.01 };
	if (code === "ZAc" || code === "ZAC") return { code: "ZAR", factor: 0.01 };
	if (code === "ILA") return { code: "ILS", factor: 0.01 };
	return { code: code.toUpperCase(), factor: 1 };
}

// ---- Resolving a symbol ---------------------------------------------------

const PREFIXES: Record<string, MarketProviderId> = {
	yahoo: "yahoo",
	y: "yahoo",
	tencent: "tencent",
	qq: "tencent",
	cn: "tencent",
	fund: "eastmoney",
	eastmoney: "eastmoney",
	em: "eastmoney",
	cg: "coingecko",
	coingecko: "coingecko",
	crypto: "coingecko",
	fx: "frankfurter",
	frankfurter: "frankfurter",
	ecb: "frankfurter",
};

/** The Chinese exchange a bare six-digit code most likely trades on. Shanghai
 * codes start 5 (funds), 6 (shares) or 9 (B shares); Beijing 4 and 8;
 * everything else is Shenzhen (0 and 3 shares, 15/16 funds, 399 indices).
 * A code that exists on both — 000001 is an index in Shanghai and a bank in
 * Shenzhen — is best picked from the search, which knows. */
export function cnExchange(code: string): "sh" | "sz" | "bj" {
	const first = code.charAt(0);
	if (first === "5" || first === "6" || first === "9") return "sh";
	if (first === "4" || first === "8") return "bj";
	return "sz";
}

const YAHOO_CN_SUFFIX = { sh: "SS", sz: "SZ", bj: "BJ" } as const;

function forexPair(base: string, quote: string): MarketTarget[] {
	const b = base.toUpperCase();
	const q = quote.toUpperCase();
	return [
		{ provider: "yahoo", symbol: `${b}${q}=X` },
		{ provider: "frankfurter", symbol: `${b}/${q}` },
	];
}

/**
 * The same instrument under the other sources that carry it, in the order
 * they are worth trying after `target` itself. Empty when nothing else does.
 */
export function alternates(target: MarketTarget): MarketTarget[] {
	const s = target.symbol;
	let m: RegExpMatchArray | null;
	switch (target.provider) {
		case "yahoo":
			if ((m = s.match(/^(\d{6})\.(SS|SZ|BJ)$/i))) {
				const ex = m[2].toUpperCase() === "SS" ? "sh" : m[2].toLowerCase();
				return [{ provider: "tencent", symbol: `${ex}${m[1]}` }];
			}
			if ((m = s.match(/^(\d{1,5})\.HK$/i))) {
				return [{ provider: "tencent", symbol: `hk${m[1].padStart(5, "0")}` }];
			}
			if ((m = s.match(/^([A-Z]{3})([A-Z]{3})=X$/i)) && isFiat(m[1]) && isFiat(m[2])) {
				return [{ provider: "frankfurter", symbol: `${m[1].toUpperCase()}/${m[2].toUpperCase()}` }];
			}
			if (/^[A-Z]{1,5}$/.test(s)) return [{ provider: "tencent", symbol: `us${s}` }];
			return [];
		case "tencent":
			if ((m = s.match(/^(sh|sz|bj)(\d{6})$/i))) {
				return [{ provider: "yahoo", symbol: `${m[2]}.${YAHOO_CN_SUFFIX[m[1].toLowerCase() as "sh"]}` }];
			}
			if ((m = s.match(/^hk(\d{1,5})$/i))) {
				return [{ provider: "yahoo", symbol: `${String(Number(m[1])).padStart(4, "0")}.HK` }];
			}
			if ((m = s.match(/^us([A-Z.]+)$/i))) {
				return [{ provider: "yahoo", symbol: m[1].toUpperCase().replace(/\./g, "-") }];
			}
			return [];
		case "frankfurter":
			if ((m = s.match(/^([A-Z]{3})\/([A-Z]{3})$/i))) {
				return [{ provider: "yahoo", symbol: `${m[1].toUpperCase()}${m[2].toUpperCase()}=X` }];
			}
			return [];
		default:
			return [];
	}
}

/**
 * Every target a card item can be fetched from, best first.
 *
 * An item picked from a search carries its source and is tried there first;
 * a typed one is read by shape:
 *
 * | typed                     | tried as                              |
 * | ------------------------- | ------------------------------------- |
 * | `yahoo:…`, `fund:…`, …    | that source only (see PREFIXES)       |
 * | `510300`, `sh510300`      | Tencent, then Yahoo `510300.SS`       |
 * | `510300.SS`, `0700.HK`    | Yahoo, then Tencent                   |
 * | `hk00700`                 | Tencent, then Yahoo `0700.HK`         |
 * | `EUR/USD`, `EURUSD=X`     | Yahoo, then the ECB via Frankfurter   |
 * | `BTC/USD`                 | Yahoo `BTC-USD`                       |
 * | anything else             | Yahoo, as typed (upper-cased)         |
 */
export function resolveSymbol(raw: string, provider?: MarketProviderId): MarketTarget[] {
	const typed = raw.trim();
	if (!typed) return [];
	if (provider) {
		const first: MarketTarget = { provider, symbol: typed };
		return [first, ...alternates(first)];
	}

	const prefixed = typed.match(/^([a-z]+):(.+)$/i);
	if (prefixed && PREFIXES[prefixed[1].toLowerCase()]) {
		const source = PREFIXES[prefixed[1].toLowerCase()];
		let symbol = prefixed[2].trim();
		if (!symbol) return [];
		if (source === "tencent" && /^\d{6}$/.test(symbol)) symbol = `${cnExchange(symbol)}${symbol}`;
		if (source === "frankfurter") {
			const pair = symbol.toUpperCase().replace(/[^A-Z]/g, "");
			if (pair.length !== 6) return [];
			symbol = `${pair.slice(0, 3)}/${pair.slice(3)}`;
		}
		if (source === "coingecko") symbol = symbol.toLowerCase();
		return [{ provider: source, symbol }];
	}

	let m: RegExpMatchArray | null;
	if ((m = typed.match(/^(sh|sz|bj)(\d{6})$/i))) {
		const first: MarketTarget = { provider: "tencent", symbol: `${m[1].toLowerCase()}${m[2]}` };
		return [first, ...alternates(first)];
	}
	if (/^\d{6}$/.test(typed)) {
		const first: MarketTarget = { provider: "tencent", symbol: `${cnExchange(typed)}${typed}` };
		return [first, ...alternates(first)];
	}
	if ((m = typed.match(/^(\d{6})\.(SS|SH|SZ|BJ)$/i))) {
		const suffix = m[2].toUpperCase() === "SH" ? "SS" : m[2].toUpperCase();
		const first: MarketTarget = { provider: "yahoo", symbol: `${m[1]}.${suffix}` };
		return [first, ...alternates(first)];
	}
	if ((m = typed.match(/^(\d{1,5})\.HK$/i))) {
		const first: MarketTarget = { provider: "yahoo", symbol: `${String(Number(m[1])).padStart(4, "0")}.HK` };
		return [first, ...alternates(first)];
	}
	if ((m = typed.match(/^hk(\d{1,5})$/i))) {
		const first: MarketTarget = { provider: "tencent", symbol: `hk${m[1].padStart(5, "0")}` };
		return [first, ...alternates(first)];
	}
	if ((m = typed.match(/^([A-Z]{3})\s*[/-]\s*([A-Z]{3,5})$/i))) {
		if (isFiat(m[1]) && isFiat(m[2])) return forexPair(m[1], m[2]);
		return [{ provider: "yahoo", symbol: `${m[1].toUpperCase()}-${m[2].toUpperCase()}` }];
	}
	if ((m = typed.match(/^([A-Z]{3})([A-Z]{3})=X$/i)) && isFiat(m[1]) && isFiat(m[2])) {
		return forexPair(m[1], m[2]);
	}
	const first: MarketTarget = { provider: "yahoo", symbol: typed.toUpperCase() };
	return [first, ...alternates(first)];
}

/** A stable cache key for one target. */
export function targetKey(target: MarketTarget): string {
	return `${target.provider}:${target.symbol}`;
}

/** The symbol a reader would recognize, without a source's decoration: the
 * code of a Chinese listing, a forex pair as "EUR/USD". */
export function displaySymbol(target: MarketTarget): string {
	const s = target.symbol;
	let m: RegExpMatchArray | null;
	if (target.provider === "tencent") {
		if ((m = s.match(/^(?:sh|sz|bj|hk)(\d+)$/i))) return m[1];
		if ((m = s.match(/^us(.+)$/i))) return m[1].toUpperCase();
	}
	if (target.provider === "yahoo" && (m = s.match(/^([A-Z]{3})([A-Z]{3})=X$/i))) {
		return `${m[1]}/${m[2]}`.toUpperCase();
	}
	if (target.provider === "coingecko") return s.split("/")[0];
	return s;
}

/** Where to read about an instrument on the web. */
export function quotePageUrl(target: MarketTarget): string {
	const s = target.symbol;
	switch (target.provider) {
		case "tencent": {
			const m = s.match(/^(sh|sz|bj|hk)(\d+)$/i);
			if (m) return `https://gu.qq.com/${m[1].toLowerCase()}${m[2]}`;
			return `https://gu.qq.com/${s}`;
		}
		case "eastmoney":
			return `https://fund.eastmoney.com/${encodeURIComponent(s)}.html`;
		case "coingecko":
			return `https://www.coingecko.com/en/coins/${encodeURIComponent(s.split("/")[0])}`;
		case "frankfurter": {
			const [b, q] = s.split("/");
			return `https://finance.yahoo.com/quote/${encodeURIComponent(`${b}${q}=X`)}`;
		}
		case "yahoo":
		default:
			return `https://finance.yahoo.com/quote/${encodeURIComponent(s)}`;
	}
}

// ---- Ranges -----------------------------------------------------------------

export const MARKET_RANGES: readonly MarketRange[] = ["1d", "5d", "1mo", "6mo", "1y", "5y"];

/** Yahoo's chart parameters for a range: its own range name and a bar size
 * fine enough to draw, coarse enough to stay small. */
export function yahooRange(range: MarketRange): { range: string; interval: string } {
	switch (range) {
		case "1d":
			return { range: "1d", interval: "5m" };
		case "5d":
			return { range: "5d", interval: "30m" };
		case "1mo":
			return { range: "1mo", interval: "1d" };
		case "6mo":
			return { range: "6mo", interval: "1d" };
		case "1y":
			return { range: "1y", interval: "1d" };
		case "5y":
			return { range: "5y", interval: "1wk" };
	}
}

/** Roughly how many days a range spans, for the sources that take a count. */
export function rangeDays(range: MarketRange): number {
	switch (range) {
		case "1d":
			return 1;
		case "5d":
			return 5;
		case "1mo":
			return 30;
		case "6mo":
			return 182;
		case "1y":
			return 365;
		case "5y":
			return 1826;
	}
}

// ---- Yahoo ------------------------------------------------------------------

function yahooType(raw: string): MarketAssetType {
	switch (raw.toUpperCase()) {
		case "EQUITY":
			return "equity";
		case "ETF":
			return "etf";
		case "MUTUALFUND":
			return "fund";
		case "INDEX":
			return "index";
		case "CURRENCY":
			return "currency";
		case "CRYPTOCURRENCY":
			return "crypto";
		case "FUTURE":
			return "future";
		default:
			return "other";
	}
}

/** Where `now` falls in a Yahoo `currentTradingPeriod`. */
export function yahooState(periods: unknown, now: number, type: MarketAssetType): MarketState | null {
	if (type === "crypto") return "open";
	const p = obj(periods);
	if (!p) return null;
	const secs = now / 1000;
	const within = (key: string): boolean => {
		const span = obj(p[key]);
		const start = num(span?.start);
		const end = num(span?.end);
		return start !== null && end !== null && secs >= start && secs < end;
	};
	if (within("regular")) return "open";
	if (within("pre")) return "pre";
	if (within("post")) return "post";
	return "closed";
}

/**
 * A Yahoo `v8/finance/chart` response: the quote from its `meta`, and the
 * bars as a series. `range` says what was asked for, because the meta's
 * `chartPreviousClose` is the close before the *range*: the day's previous
 * close only when the range is a day.
 */
export function parseYahooChart(
	json: unknown,
	target: MarketTarget,
	range: MarketRange,
	fetched: number,
): { quote: MarketQuote | null; series: MarketSeries | null } {
	const none = { quote: null, series: null };
	const chart = obj(obj(json)?.chart);
	const results = chart?.result;
	if (!Array.isArray(results) || !results.length) return none;
	const result = obj(results[0]);
	const meta = obj(result?.meta);
	if (!result || !meta) return none;

	const { code, factor } = normalizeCurrency(str(meta.currency) || "USD");
	const scale = (v: number | null): number | null => (v === null ? null : v * factor);

	// The bars, with the gaps (a minute nobody traded) left out.
	const stamps = Array.isArray(result.timestamp) ? result.timestamp : [];
	const quotes = obj(result.indicators)?.quote;
	const bars = obj(Array.isArray(quotes) ? quotes[0] : null);
	const closes = Array.isArray(bars?.close) ? bars.close : [];
	const opens = Array.isArray(bars?.open) ? bars.open : [];
	const points: { t: number; v: number }[] = [];
	stamps.forEach((stamp: unknown, i: number) => {
		const t = num(stamp);
		const v = num(closes[i]);
		if (t !== null && v !== null) points.push({ t: t * 1000, v: v * factor });
	});

	const rangeBase = scale(num(meta.chartPreviousClose));
	const series: MarketSeries | null = points.length ? { points, baseline: rangeBase } : null;

	const price = scale(num(meta.regularMarketPrice)) ?? (points.length ? points[points.length - 1].v : null);
	if (price === null) return { quote: null, series };

	const type = yahooType(str(meta.instrumentType));
	const prevClose = range === "1d" ? (scale(num(meta.previousClose)) ?? rangeBase) : scale(num(meta.previousClose));
	const move = moveFrom(price, prevClose);
	let open: number | null = null;
	if (range === "1d") {
		for (const o of opens) {
			const v = num(o);
			if (v !== null) {
				open = v * factor;
				break;
			}
		}
	}
	const time = num(meta.regularMarketTime);
	const quote: MarketQuote = {
		target,
		name: str(meta.longName) || str(meta.shortName) || str(meta.symbol) || target.symbol,
		currency: code,
		price,
		prevClose,
		change: move.change,
		changePct: move.pct,
		open,
		dayHigh: scale(num(meta.regularMarketDayHigh)),
		dayLow: scale(num(meta.regularMarketDayLow)),
		yearHigh: scale(num(meta.fiftyTwoWeekHigh)),
		yearLow: scale(num(meta.fiftyTwoWeekLow)),
		volume: num(meta.regularMarketVolume),
		exchange: str(meta.fullExchangeName) || str(meta.exchangeName),
		type,
		state: yahooState(meta.currentTradingPeriod, fetched, type),
		time: time === null ? fetched : time * 1000,
		fetched,
	};
	return { quote, series };
}

/** A Yahoo `v1/finance/search` response. */
export function parseYahooSearch(json: unknown): MarketSearchResult[] {
	const quotes = obj(json)?.quotes;
	if (!Array.isArray(quotes)) return [];
	const out: MarketSearchResult[] = [];
	for (const raw of quotes) {
		const q = obj(raw);
		const symbol = str(q?.symbol);
		if (!q || !symbol) continue;
		// News and "lists" ride along in the same array on some responses.
		if (q.isYahooFinance === false) continue;
		const target: MarketTarget = { provider: "yahoo", symbol };
		out.push({
			target,
			display: displaySymbol(target),
			name: str(q.longname) || str(q.shortname) || symbol,
			exchange: str(q.exchDisp) || str(q.exchange),
			type: yahooType(str(q.quoteType)),
		});
	}
	return out;
}

// ---- Tencent ----------------------------------------------------------------

/** Parse "20240926150003", "2024/09/26 16:08:01" or "2024-09-26 15:00:00" as a
 * time in UTC+8 (Beijing and Hong Kong), the zone Tencent stamps them in. */
export function parseChinaTime(raw: string): number | null {
	const digits = raw.replace(/\D/g, "");
	if (digits.length < 12) return null;
	const iso =
		`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` +
		`T${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.length >= 14 ? digits.slice(12, 14) : "00"}+08:00`;
	const ms = Date.parse(iso);
	return Number.isFinite(ms) ? ms : null;
}

function tencentMarket(symbol: string): "sh" | "sz" | "bj" | "hk" | "us" | null {
	const m = symbol.match(/^(sh|sz|bj|hk|us)/i);
	return m ? (m[1].toLowerCase() as "sh") : null;
}

function tencentType(symbol: string): MarketAssetType {
	const s = symbol.toLowerCase();
	if (/^sh000\d{3}$/.test(s) || /^sz399\d{3}$/.test(s)) return "index";
	if (/^sh5\d{5}$/.test(s) || /^sz1[5-8]\d{4}$/.test(s)) return "etf";
	return "equity";
}

const TENCENT_EXCHANGE: Record<string, string> = {
	sh: "SSE",
	sz: "SZSE",
	bj: "BSE",
	hk: "HKEX",
	us: "US",
};

const TENCENT_CURRENCY: Record<string, string> = {
	sh: "CNY",
	sz: "CNY",
	bj: "CNY",
	hk: "HKD",
	us: "USD",
};

/**
 * Tencent's `qt.gtimg.cn/q=…` text — one `v_<symbol>="…~…~…";` line per
 * symbol, fields separated by `~` (the text is GBK; decode it before this).
 * The fields read here have held their places for many years: 1 name, 3 price,
 * 4 previous close, 5 open, 6 volume (lots of 100 on the mainland), 30 time,
 * 31 change, 32 change %, 33 high, 34 low. A symbol Tencent doesn't know comes
 * back as `v_pv_none_match="1";` and is simply absent from the result.
 */
export function parseTencentQuotes(text: string, fetched: number): Map<string, MarketQuote> {
	const out = new Map<string, MarketQuote>();
	const re = /v_([a-z]{2}[A-Za-z0-9.]+)="([^"]*)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		const symbol = m[1];
		const market = tencentMarket(symbol);
		const f = m[2].split("~");
		if (!market || f.length < 35) continue;
		const price = num(f[3]);
		if (price === null) continue;
		const prevClose = num(f[4]);
		const move = moveFrom(price, prevClose);
		const volume = num(f[6]);
		const mainland = market === "sh" || market === "sz" || market === "bj";
		// A suspended listing reports a price of 0: no price at all.
		if (price === 0 && prevClose) continue;
		out.set(tencentKey(symbol), {
			target: { provider: "tencent", symbol },
			name: f[1] || symbol,
			currency: TENCENT_CURRENCY[market],
			price,
			prevClose,
			change: num(f[31]) ?? move.change,
			changePct: num(f[32]) ?? move.pct,
			open: num(f[5]),
			dayHigh: num(f[33]),
			dayLow: num(f[34]),
			yearHigh: null,
			yearLow: null,
			volume: volume === null ? null : mainland ? volume * 100 : volume,
			exchange: TENCENT_EXCHANGE[market],
			type: tencentType(symbol),
			state: null,
			time: parseChinaTime(f[30] ?? "") ?? fetched,
			fetched,
		});
	}
	return out;
}

/** Tencent's quote lines key US symbols in their own case; the card asks in
 * whatever case the reader typed. This is the key both agree on. */
export function tencentKey(symbol: string): string {
	return symbol.toLowerCase();
}

/**
 * Tencent's intraday minutes (`appstock/app/minute/query`): a JSON body whose
 * `data.<symbol>.data.data` is a list of "HHMM price volume amount" strings,
 * with the day in `data.<symbol>.data.date`.
 */
export function parseTencentMinutes(json: unknown, symbol: string, baseline: number | null): MarketSeries | null {
	const entry = obj(obj(obj(json)?.data)?.[symbol]);
	const day = obj(entry?.data);
	const rows = day?.data;
	const date = str(day?.date);
	if (!Array.isArray(rows) || date.length !== 8) return null;
	const points: { t: number; v: number }[] = [];
	for (const row of rows) {
		if (typeof row !== "string") continue;
		const [hhmm, price] = row.split(" ");
		const v = num(price);
		if (!hhmm || hhmm.length !== 4 || v === null) continue;
		const t = parseChinaTime(`${date}${hhmm}00`);
		if (t !== null) points.push({ t, v });
	}
	return points.length ? { points, baseline } : null;
}

/**
 * Tencent's daily or weekly bars (`appstock/app/fqkline/get`): rows of
 * [date, open, close, high, low, volume] under `data.<symbol>.<key>`, where
 * the key is `qfqday`/`qfqweek` for shares (adjusted) and `day`/`week` for
 * funds and indices. The first row is the baseline, not a point.
 */
export function parseTencentKline(json: unknown, symbol: string): MarketSeries | null {
	const entry = obj(obj(obj(json)?.data)?.[symbol]);
	if (!entry) return null;
	const rows = [entry.qfqday, entry.day, entry.qfqweek, entry.week].find(Array.isArray) as unknown[] | undefined;
	if (!rows || rows.length < 2) return null;
	const all: { t: number; v: number }[] = [];
	for (const raw of rows) {
		if (!Array.isArray(raw)) continue;
		const date = str(raw[0]);
		const close = num(raw[2]);
		// Daily bars close at 15:00 Beijing time; the hour only matters for
		// ordering, which the date already gives.
		const t = Date.parse(`${date}T15:00:00+08:00`);
		if (close !== null && Number.isFinite(t)) all.push({ t, v: close });
	}
	if (all.length < 2) return null;
	return { points: all.slice(1), baseline: all[0].v };
}

/** Tencent's smartbox search text: `v_hint="sh~510300~name~pinyin~ETF^…";`,
 * the names `\uXXXX`-escaped. A miss is `v_hint="N";`. */
export function parseTencentSearch(text: string): MarketSearchResult[] {
	const m = text.match(/v_hint="([^"]*)"/);
	if (!m || m[1] === "N" || !m[1]) return [];
	const body = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
		String.fromCharCode(parseInt(hex, 16)),
	);
	const out: MarketSearchResult[] = [];
	for (const entry of body.split("^")) {
		const [market, code, name, , kind = ""] = entry.split("~");
		if (!market || !code) continue;
		const upperKind = kind.toUpperCase();
		const type: MarketAssetType = upperKind.includes("ETF")
			? "etf"
			: upperKind.includes("LOF") || market === "jj"
				? "fund"
				: upperKind === "ZS"
					? "index"
					: upperKind.startsWith("GP")
						? "equity"
						: "other";
		let target: MarketTarget | null = null;
		if (market === "sh" || market === "sz" || market === "bj") {
			target = { provider: "tencent", symbol: `${market}${code}` };
		} else if (market === "hk") {
			target = { provider: "tencent", symbol: `hk${code.padStart(5, "0")}` };
		} else if (market === "us") {
			target = { provider: "tencent", symbol: `us${code.split(".")[0].toUpperCase()}` };
		} else if (market === "jj") {
			target = { provider: "eastmoney", symbol: code };
		}
		if (!target) continue;
		out.push({
			target,
			display: displaySymbol(target),
			name: name || code,
			exchange: market === "jj" ? "OTC" : (TENCENT_EXCHANGE[market] ?? market.toUpperCase()),
			type,
		});
	}
	return out;
}

// ---- Eastmoney (off-exchange funds) ----------------------------------------

/**
 * Eastmoney's intraday fund estimate (`fundgz.1234567.com.cn/js/<code>.js`):
 * `jsonpgz({...});` with the last published NAV (`dwjz`, dated `jzrq`), the
 * running estimate (`gsz`), its change (`gszzl`, %) and its time (`gztime`).
 * A fund without an estimate (a QDII fund, for one) answers `jsonpgz();`.
 */
export function parseEastmoneyEstimate(text: string, code: string, fetched: number): MarketQuote | null {
	const open = text.indexOf("(");
	const close = text.lastIndexOf(")");
	if (open < 0 || close <= open + 1) return null;
	let data: Record<string, unknown> | null;
	try {
		data = obj(JSON.parse(text.slice(open + 1, close)));
	} catch {
		return null;
	}
	if (!data) return null;
	const nav = num(data.dwjz);
	const estimate = num(data.gsz);
	const price = estimate ?? nav;
	if (price === null) return null;
	const move = moveFrom(price, nav);
	return {
		target: { provider: "eastmoney", symbol: code },
		name: str(data.name) || code,
		currency: "CNY",
		price,
		prevClose: nav,
		change: move.change,
		changePct: num(data.gszzl) ?? move.pct,
		open: null,
		dayHigh: null,
		dayLow: null,
		yearHigh: null,
		yearLow: null,
		volume: null,
		exchange: "OTC",
		type: "fund",
		state: null,
		time: parseChinaTime(str(data.gztime)) ?? fetched,
		fetched,
	};
}

/**
 * Eastmoney's fund history script (`fund.eastmoney.com/pingzhongdata/<code>.js`):
 * `var Data_netWorthTrend = [{"x": <ms>, "y": <nav>, …}, …];`. Only the last
 * `days` of it are kept; the NAV before them is the baseline.
 */
export function parseEastmoneyHistory(text: string, days: number, now: number): MarketSeries | null {
	const m = text.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
	if (!m) return null;
	let rows: unknown;
	try {
		rows = JSON.parse(m[1]);
	} catch {
		return null;
	}
	if (!Array.isArray(rows)) return null;
	const all: { t: number; v: number }[] = [];
	for (const raw of rows) {
		const r = obj(raw);
		const t = num(r?.x);
		const v = num(r?.y);
		if (t !== null && v !== null) all.push({ t, v });
	}
	const from = now - days * 86_400_000;
	const idx = all.findIndex((p) => p.t >= from);
	if (idx < 0) return null;
	const points = all.slice(idx);
	if (!points.length) return null;
	return { points, baseline: idx > 0 ? all[idx - 1].v : null };
}

// ---- CoinGecko ----------------------------------------------------------------

/** A CoinGecko target's coin id and the currency it is priced in. */
export function coinParts(symbol: string): { id: string; vs: string } {
	const [id, vs] = symbol.toLowerCase().split("/");
	return { id: id.trim(), vs: (vs ?? "usd").trim() || "usd" };
}

/** CoinGecko's `coins/markets` list, keyed by coin id. */
export function parseCoinGeckoMarkets(json: unknown, vs: string, fetched: number): Map<string, MarketQuote> {
	const out = new Map<string, MarketQuote>();
	if (!Array.isArray(json)) return out;
	for (const raw of json) {
		const c = obj(raw);
		const id = str(c?.id);
		const price = num(c?.current_price);
		if (!c || !id || price === null) continue;
		const change = num(c.price_change_24h);
		const updated = Date.parse(str(c.last_updated));
		out.set(id, {
			target: { provider: "coingecko", symbol: vs === "usd" ? id : `${id}/${vs}` },
			name: str(c.name) || id,
			currency: vs.toUpperCase(),
			price,
			prevClose: change === null ? null : price - change,
			change,
			changePct: num(c.price_change_percentage_24h),
			open: null,
			dayHigh: num(c.high_24h),
			dayLow: num(c.low_24h),
			yearHigh: null,
			yearLow: null,
			volume: num(c.total_volume),
			exchange: "CoinGecko",
			type: "crypto",
			state: "open",
			time: Number.isFinite(updated) ? updated : fetched,
			fetched,
		});
	}
	return out;
}

/** CoinGecko's `market_chart`: `prices` as [ms, price] pairs. */
export function parseCoinGeckoChart(json: unknown): MarketSeries | null {
	const prices = obj(json)?.prices;
	if (!Array.isArray(prices)) return null;
	const points: { t: number; v: number }[] = [];
	for (const pair of prices) {
		if (!Array.isArray(pair)) continue;
		const t = num(pair[0]);
		const v = num(pair[1]);
		if (t !== null && v !== null) points.push({ t, v });
	}
	if (points.length < 2) return null;
	return { points, baseline: points[0].v };
}

/** CoinGecko's `search`: `coins` with an id, a name and a ticker symbol. */
export function parseCoinGeckoSearch(json: unknown, limit = 4): MarketSearchResult[] {
	const coins = obj(json)?.coins;
	if (!Array.isArray(coins)) return [];
	const out: MarketSearchResult[] = [];
	for (const raw of coins) {
		const c = obj(raw);
		const id = str(c?.id);
		if (!c || !id) continue;
		out.push({
			target: { provider: "coingecko", symbol: id },
			display: (str(c.symbol) || id).toUpperCase(),
			name: str(c.name) || id,
			exchange: "CoinGecko",
			type: "crypto",
		});
		if (out.length >= limit) break;
	}
	return out;
}

// ---- Frankfurter (ECB) --------------------------------------------------------

/**
 * A Frankfurter time series (`/<start>..?from=EUR&to=USD`): `rates` keyed by
 * date, each holding the one quote currency. Daily, business days only.
 */
export function parseFrankfurterSeries(json: unknown, quoteCcy: string): MarketSeries | null {
	const rates = obj(obj(json)?.rates);
	if (!rates) return null;
	const all: { t: number; v: number }[] = [];
	for (const [date, day] of Object.entries(rates)) {
		const v = num(obj(day)?.[quoteCcy.toUpperCase()]);
		const t = Date.parse(`${date}T16:00:00Z`);
		if (v !== null && Number.isFinite(t)) all.push({ t, v });
	}
	all.sort((a, b) => a.t - b.t);
	if (all.length < 2) return null;
	return { points: all.slice(1), baseline: all[0].v };
}

/** The latest ECB fix of a pair and the one before it, as a quote. */
export function frankfurterQuote(series: MarketSeries, pair: string, fetched: number): MarketQuote | null {
	const pts = series.points;
	if (!pts.length) return null;
	const last = pts[pts.length - 1];
	const prev = pts.length > 1 ? pts[pts.length - 2].v : series.baseline;
	const move = moveFrom(last.v, prev);
	const [, quoteCcy = ""] = pair.split("/");
	return {
		target: { provider: "frankfurter", symbol: pair },
		name: pair,
		currency: quoteCcy.toUpperCase(),
		price: last.v,
		prevClose: prev,
		change: move.change,
		changePct: move.pct,
		open: null,
		dayHigh: null,
		dayLow: null,
		yearHigh: null,
		yearLow: null,
		volume: null,
		exchange: "ECB",
		type: "currency",
		state: null,
		time: last.t,
		fetched,
	};
}

// ---- Formatting ---------------------------------------------------------------

/** How many decimals a price is worth: a forex rate to the pip, a mainland
 * fund to the fen-tenth it trades in, a small coin until it shows. */
export function priceDecimals(value: number, type: MarketAssetType, currency: string): number {
	const abs = Math.abs(value);
	if (type === "currency") return abs >= 1000 ? 2 : abs >= 20 ? 3 : 4;
	if (abs === 0) return 2;
	if (abs < 0.01) return 6;
	if (abs < 1) return 4;
	if (currency === "CNY" && abs < 10) return 3;
	return 2;
}

/** A price in the reader's number format, without a currency sign. */
export function formatPrice(value: number | null, type: MarketAssetType = "equity", currency = ""): string {
	if (value === null) return "—";
	const d = priceDecimals(value, type, currency);
	return value.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** A signed amount: "+1.23", "−0.45" (a real minus sign), "0.00". */
export function formatSigned(value: number | null, decimals = 2): string {
	if (value === null) return "—";
	const rounded = Number(value.toFixed(decimals));
	const body = Math.abs(rounded).toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
	if (rounded > 0) return `+${body}`;
	if (rounded < 0) return `−${body}`;
	return body;
}

/** A signed percentage: "+1.23%". */
export function formatPct(value: number | null): string {
	return value === null ? "—" : `${formatSigned(value, 2)}%`;
}

/** A quote's move as the card is set to write it. */
export function formatMove(
	quote: Pick<MarketQuote, "change" | "changePct" | "price" | "type" | "currency">,
	mode: "percent" | "absolute" | "both",
): string {
	const d = priceDecimals(quote.price, quote.type, quote.currency);
	const abs = formatSigned(quote.change, d);
	const pct = formatPct(quote.changePct);
	if (mode === "percent") return pct;
	if (mode === "absolute") return abs;
	return quote.change === null ? pct : `${abs} (${pct})`;
}

/** Big numbers the short way: 1.2M, 34K. */
export function formatCompact(value: number | null): string {
	if (value === null) return "—";
	return value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}

/** An amount of money with its currency, in the reader's format. Falls back to
 * "1,234.56 XYZ" for a code Intl doesn't know. */
export function formatMoney(value: number | null, currency: string, decimals = 2): string {
	if (value === null) return "—";
	try {
		return value.toLocaleString(undefined, {
			style: "currency",
			currency: currency.toUpperCase(),
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	} catch {
		return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency.toUpperCase()}`;
	}
}

/** Which way a number went. */
export function direction(value: number | null): "up" | "down" | "flat" {
	if (value === null || Math.abs(value) < 1e-12) return "flat";
	return value > 0 ? "up" : "down";
}

/** Whether rises are drawn red for this interface language: the convention in
 * mainland China, Taiwan, Hong Kong, Japan and Korea. */
export function redUpForLanguage(lang: string): boolean {
	const base = lang.toLowerCase().split(/[-_]/)[0];
	return base === "zh" || base === "ja" || base === "ko";
}

/** Where `value` sits between `low` and `high`, 0–1; null without a span. */
export function rangePosition(value: number | null, low: number | null, high: number | null): number | null {
	if (value === null || low === null || high === null || high <= low) return null;
	return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

// ---- Portfolio ------------------------------------------------------------------

/** One holding's numbers in its own currency. */
export interface HoldingValue {
	value: number;
	/** Today's gain or loss on the position; null without a previous close. */
	day: number | null;
	/** Gain or loss against the cost; null without a cost. */
	gain: number | null;
	gainPct: number | null;
	costBasis: number | null;
}

/** A position's value, today's move and its gain against the cost. */
export function holdingValue(quote: Pick<MarketQuote, "price" | "change">, quantity: number, cost?: number): HoldingValue {
	const value = quote.price * quantity;
	const day = quote.change === null ? null : quote.change * quantity;
	const costBasis = cost === undefined || !Number.isFinite(cost) ? null : cost * quantity;
	const gain = costBasis === null ? null : value - costBasis;
	return {
		value,
		day,
		gain,
		gainPct: gain === null || !costBasis ? null : (gain / Math.abs(costBasis)) * 100,
		costBasis,
	};
}

/** Rates as currency.ts keeps them: units of each currency per one of `base`
 * (lowercase codes). */
export type RateTable = { rates: Record<string, number> } | null;

/** Convert an amount between currencies through a rate table; null when either
 * side is missing from it. The same currency needs no table. */
export function convert(amount: number, from: string, to: string, table: RateTable): number | null {
	const f = from.toLowerCase();
	const t = to.toLowerCase();
	if (f === t) return amount;
	const rf = table?.rates[f];
	const rt = table?.rates[t];
	if (!rf || !rt) return null;
	return (amount / rf) * rt;
}

/** Totals across holdings in one currency. `missing` counts the holdings that
 * couldn't be converted and are left out of every total. */
export interface PortfolioTotals {
	value: number;
	day: number;
	/** The day's move as a share of yesterday's value. */
	dayPct: number | null;
	gain: number | null;
	gainPct: number | null;
	missing: number;
	/** Each holding's converted value, in the order given; null where missing. */
	values: (number | null)[];
}

export function portfolioTotals(
	holdings: { quote: Pick<MarketQuote, "price" | "change" | "currency">; quantity: number; cost?: number }[],
	base: string,
	table: RateTable,
): PortfolioTotals {
	let value = 0;
	let day = 0;
	let gain = 0;
	let costTotal = 0;
	let anyCost = false;
	let missing = 0;
	const values: (number | null)[] = [];
	for (const h of holdings) {
		const v = holdingValue(h.quote, h.quantity, h.cost);
		const rate = convert(1, h.quote.currency, base, table);
		if (rate === null) {
			missing++;
			values.push(null);
			continue;
		}
		value += v.value * rate;
		values.push(v.value * rate);
		if (v.day !== null) day += v.day * rate;
		if (v.gain !== null && v.costBasis !== null) {
			anyCost = true;
			gain += v.gain * rate;
			costTotal += v.costBasis * rate;
		}
	}
	const yesterday = value - day;
	return {
		value,
		day,
		dayPct: yesterday ? (day / yesterday) * 100 : null,
		gain: anyCost ? gain : null,
		gainPct: anyCost && costTotal ? (gain / Math.abs(costTotal)) * 100 : null,
		missing,
		values,
	};
}

/** The currency most of the holdings are in, for a portfolio that names none. */
export function dominantCurrency(currencies: string[], fallback = "USD"): string {
	const counts = new Map<string, number>();
	for (const c of currencies) counts.set(c, (counts.get(c) ?? 0) + 1);
	let best = fallback;
	let bestCount = 0;
	for (const [c, n] of counts) {
		if (n > bestCount) {
			best = c;
			bestCount = n;
		}
	}
	return best;
}

/** Search results from several sources merged: first come first kept, and the
 * same instrument under another source's name counts as seen. */
export function mergeSearchResults(lists: MarketSearchResult[][], limit = 12): MarketSearchResult[] {
	const seen = new Set<string>();
	const out: MarketSearchResult[] = [];
	for (const list of lists) {
		for (const r of list) {
			const keys = [r.target, ...alternates(r.target)].map(targetKey);
			if (keys.some((k) => seen.has(k))) continue;
			keys.forEach((k) => seen.add(k));
			out.push(r);
			if (out.length >= limit) return out;
		}
	}
	return out;
}

/** Whether a search query should also go to the Chinese sources: it has CJK
 * characters, or it is a (part of a) mainland or Hong Kong code. */
export function wantsChineseSearch(query: string): boolean {
	return /[㐀-鿿]/.test(query) || /^\d{3,6}$/.test(query.trim());
}
