/**
 * Exchange-rate support for the calculator card's currency conversions
 * (e.g. `10 € to USD`) and for currency answers in the search bar.
 *
 * The rates are the ECB's daily reference rates. The ECB publishes them itself
 * as a 1.5 kB XML file, which is what we ask first; Frankfurter's JSON mirror of
 * the same table is the second attempt, for networks where `ecb.europa.eu`
 * cannot be reached. Neither needs a key or an account, and both live on hosts
 * listed in the privacy guide.
 *
 * Rates are cached in memory for a few hours so a board full of calculator cards
 * makes at most one request per refresh window, and the last good table is kept
 * in this device's localStorage, so a restart or an offline session starts from
 * the rates it already had instead of reporting that none exist. Everything
 * degrades gracefully offline: if every source fails the last good rates are
 * kept, and if none were ever fetched a currency query just reports that rates
 * are unavailable.
 */
import { requestUrl } from "obsidian";

export interface CurrencyRates {
	/** Base currency code the rates are relative to (lowercase, e.g. "eur"). */
	base: string;
	/** Units of each currency per 1 unit of base; includes the base itself = 1. */
	rates: Record<string, number>;
	/** Epoch milliseconds when these rates were fetched. */
	fetched: number;
}

/** How long a fetched rate table is considered fresh. */
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** The ECB's own daily reference rates — the table Frankfurter mirrors. */
const ECB_ENDPOINT = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
/** Frankfurter's JSON mirror of the same table, asked only if the ECB fails.
 * The old `api.frankfurter.app` host only redirects here now. */
const FRANKFURTER_ENDPOINT = "https://api.frankfurter.dev/v1/latest";
/** localStorage key for the last good table (device-local, never synced). */
const STORE_KEY = "hearth-currency-rates";

/** ISO 4217 codes the ECB publishes a reference rate for (also what we
 * recognise as units). EUR is the base and isn't returned in the rate table, so
 * it's listed here too. BGN is gone: Bulgaria adopted the euro in January 2026
 * and the ECB stopped publishing a rate for the lev. */
export const CURRENCY_CODES: readonly string[] = [
	"eur", "usd", "gbp", "jpy", "chf", "cad", "aud", "nzd", "cny", "hkd",
	"sgd", "sek", "nok", "dkk", "pln", "czk", "huf", "ron", "try",
	"ils", "inr", "krw", "mxn", "brl", "zar", "isk", "php", "myr", "thb",
	"idr",
];

/** Common currency signs mapped to their ISO code. Only unambiguous single
 * glyphs are included (multi-letter symbols like "Kč"/"zł" collide with codes
 * and are typed as codes instead). */
export const CURRENCY_SYMBOLS: Record<string, string> = {
	"€": "eur",
	"$": "usd",
	"£": "gbp",
	"¥": "jpy",
	"₹": "inr",
	"₩": "krw",
	"₺": "try",
};

/** Currency names as they're typed in the languages Hearth speaks (English,
 * German, French, Chinese), mapped to their ISO code: `20 euros to dollars`,
 * `100 美元换成人民币`. Only names that belong to one currency are listed —
 * "pound" is a unit of mass to the calculator, and "Krone" (French "couronne")
 * is four currencies. */
export const CURRENCY_NAMES: Record<string, string> = {
	euro: "eur",
	euros: "eur",
	dollar: "usd",
	dollars: "usd",
	yen: "jpy",
	yuan: "cny",
	renminbi: "cny",
	franc: "chf",
	francs: "chf",
	franken: "chf",
	rupee: "inr",
	rupees: "inr",
	rupie: "inr",
	rupien: "inr",
	zloty: "pln",
	forint: "huf",
	yens: "jpy",
	yuans: "cny",
	roupie: "inr",
	roupies: "inr",
	zlotys: "pln",
	forints: "huf",
	美元: "usd",
	美金: "usd",
	欧元: "eur",
	人民币: "cny",
	日元: "jpy",
	英镑: "gbp",
	港币: "hkd",
	港元: "hkd",
	瑞士法郎: "chf",
	瑞郎: "chf",
	加元: "cad",
	澳元: "aud",
	新西兰元: "nzd",
	新加坡元: "sgd",
	新元: "sgd",
	韩元: "krw",
	卢比: "inr",
	泰铢: "thb",
	捷克克朗: "czk",
	波兰兹罗提: "pln",
};

/** A positive, finite rate, or null — filters out junk from either source. */
function usable(rate: unknown): number | null {
	return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Read the ECB's daily reference-rate XML into a table of units per 1 EUR.
 * `null` when the document carries no usable rate: a truncated or replaced file
 * should fall through to the second source, not become an empty cache.
 *
 * Pure — takes the response text, returns plain numbers.
 */
export function parseEcbRates(xml: string): Record<string, number> | null {
	if (!xml) return null;
	const rates: Record<string, number> = { eur: 1 };
	// Each rate sits on its own <Cube currency='USD' rate='1.1172'/>; the
	// attribute order isn't ours to assume, so each one is picked out alone.
	for (const [, attributes] of xml.matchAll(/<Cube\b([^>]*)>/g)) {
		const code = /currency='([A-Za-z]{3})'/.exec(attributes)?.[1];
		if (!code) continue;
		const rate = usable(Number(/rate='([0-9.]+)'/.exec(attributes)?.[1]));
		if (rate !== null) rates[code.toLowerCase()] = rate;
	}
	return Object.keys(rates).length > 1 ? rates : null;
}

/** Read Frankfurter's JSON (`{ base, rates }`) into the same shape. Pure. */
export function parseFrankfurterRates(data: unknown): Record<string, number> | null {
	if (!data || typeof data !== "object") return null;
	const { base, rates } = data as { base?: unknown; rates?: unknown };
	if (!rates || typeof rates !== "object") return null;
	const code = typeof base === "string" && base ? base.toLowerCase() : "eur";
	const table: Record<string, number> = { [code]: 1 };
	for (const [unit, raw] of Object.entries(rates)) {
		const rate = usable(raw);
		if (rate !== null) table[unit.toLowerCase()] = rate;
	}
	return Object.keys(table).length > 1 ? table : null;
}

let cache: CurrencyRates | null = null;
let inflight: Promise<CurrencyRates | null> | null = null;
let restored = false;

/** The last-fetched rates — possibly stale, possibly restored from the last
 * session — or null if none were ever loaded. */
export function cachedRates(): CurrencyRates | null {
	if (!cache && !restored) {
		restored = true;
		cache = restoreRates();
	}
	return cache;
}

/** Read the table stored by the last successful fetch, if there is one. */
function restoreRates(): CurrencyRates | null {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as { base?: unknown; fetched?: unknown };
		const table = parseFrankfurterRates(data);
		if (!table) return null;
		return {
			base: typeof data.base === "string" && data.base ? data.base : "eur",
			rates: table,
			fetched: typeof data.fetched === "number" ? data.fetched : 0,
		};
	} catch {
		// Junk in storage, or no storage at all (private mode) — no worse than a
		// first run.
		return null;
	}
}

/** Remember a good table for the next start. Failure is not an error: a full
 * quota or a locked-down browser leaves the in-memory cache working as before. */
function storeRates(rates: CurrencyRates): void {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(rates));
	} catch {
		/* nothing worth telling anyone about */
	}
}

async function fetchEcb(): Promise<CurrencyRates | null> {
	try {
		const res = await requestUrl({ url: ECB_ENDPOINT });
		if (res.status >= 400) return null;
		const rates = parseEcbRates(res.text);
		return rates ? { base: "eur", rates, fetched: Date.now() } : null;
	} catch {
		return null;
	}
}

async function fetchFrankfurter(): Promise<CurrencyRates | null> {
	try {
		const res = await requestUrl({ url: FRANKFURTER_ENDPOINT });
		if (res.status >= 400) return null;
		const rates = parseFrankfurterRates(res.json);
		return rates ? { base: "eur", rates, fetched: Date.now() } : null;
	} catch {
		return null;
	}
}

/**
 * Return fresh rates, fetching if the cache is missing or expired. Concurrent
 * callers share a single in-flight request. Never throws: on failure it returns
 * whatever is cached (possibly null).
 *
 * When `disabled` is true (the "disable external calls" setting), neither
 * source is asked — only already-cached rates, including the table restored from
 * the last session, are returned.
 */
export async function loadRates(disabled = false): Promise<CurrencyRates | null> {
	const current = cachedRates();
	if (disabled) return current;
	if (current && Date.now() - current.fetched < TTL_MS) return current;
	if (inflight) return inflight;
	inflight = (async () => {
		try {
			const fresh = (await fetchEcb()) ?? (await fetchFrankfurter());
			if (!fresh) return cache;
			cache = fresh;
			storeRates(fresh);
			return cache;
		} catch {
			// Offline or blocked — keep any prior rates.
			return cache;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}
