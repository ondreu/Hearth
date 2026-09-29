/**
 * Kagi News' World Tension index: the data behind the "tension" card.
 *
 * Kagi News (kite.kagi.com) reads the day's world headlines with a language
 * model and scores global stability from 0 (calm) to 100 (on fire), with a
 * paragraph saying why. It is a model's reading of the news, not a measurement;
 * the card says so. The API is free and key-less; this module is the only place
 * that talks to it.
 *
 * Two endpoints, the same ones Kagi's open-source client (kagisearch/kite-public)
 * calls:
 *
 * - `GET /batches/latest/chaos?lang=en` → `{ chaosIndex, chaosDescription,
 *   chaosLastUpdated }`, 404 while no index is published;
 * - `GET /chaos/history?lang=en&days=N` → `[{ date, score, summary }, …]`.
 *
 * Only English is asked for: Kagi stopped translating its batches into other
 * languages, so any other code would get English back or nothing at all.
 *
 * Everything that reads a response is pure and exported, so the shape the card
 * relies on is pinned by test/tension.test.ts. Fetching is cached in memory per
 * history length, shared by every card on the board, and never throws: a failed
 * fetch keeps the last good reading.
 */
import { requestUrl } from "obsidian";

/** Where the API lives. */
export const TENSION_API = "https://kite.kagi.com/api";

/** Where the reader goes to see the index for themselves. */
export const TENSION_SITE = "https://kite.kagi.com/?view=chaos";

/** The five bands Kagi names the score by, calmest first. */
export type TensionBand = "cool" | "mild" | "warm" | "hot" | "burning";

export const TENSION_BANDS: readonly TensionBand[] = ["cool", "mild", "warm", "hot", "burning"];

/** The band a score falls in — Kagi's own cut-offs: up to 20 is cool, up to
 * 40 mild, up to 60 warm, up to 80 hot, and anything over burning. */
export function tensionBand(score: number): TensionBand {
	if (score <= 20) return "cool";
	if (score <= 40) return "mild";
	if (score <= 60) return "warm";
	if (score <= 80) return "hot";
	return "burning";
}

/** The current reading. */
export interface TensionReading {
	/** 0–100, clamped. */
	score: number;
	/** The model's explanation; may be empty. */
	summary: string;
	/** When Kagi last scored it, as epoch ms, or null when it didn't say. */
	updated: number | null;
}

/** One day of the history. */
export interface TensionPoint {
	/** The day as Kagi sent it (an ISO date or timestamp). */
	date: string;
	/** Epoch ms of `date`, for sorting and labelling. */
	time: number;
	score: number;
	summary: string;
}

/** Everything a card draws. */
export interface TensionSnapshot {
	/** Null when Kagi has no index published right now (a 404). */
	now: TensionReading | null;
	/** Oldest first; empty when no history was asked for or none came back. */
	history: TensionPoint[];
	/** Epoch ms of the fetch. */
	fetched: number;
}

/** A score as a number in 0–100, or null when it is not one. */
export function clampScore(raw: unknown): number | null {
	const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
	if (typeof n !== "number" || !Number.isFinite(n)) return null;
	return Math.min(100, Math.max(0, n));
}

function parseTime(raw: unknown): number | null {
	if (typeof raw === "number" && Number.isFinite(raw)) {
		// Seconds or milliseconds; nothing Kagi scored predates 2001.
		return raw < 1e11 ? raw * 1000 : raw;
	}
	if (typeof raw !== "string" || !raw.trim()) return null;
	const ms = Date.parse(raw);
	return Number.isFinite(ms) ? ms : null;
}

function text(raw: unknown): string {
	return typeof raw === "string" ? raw.trim() : "";
}

/** The current reading from `/batches/latest/chaos`, or null when the body
 * doesn't carry a score. Reads the documented field names and, defensively,
 * the history's (`score`, `summary`) in case the two are ever unified. */
export function parseReading(raw: unknown): TensionReading | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const score = clampScore(o.chaosIndex ?? o.score);
	if (score === null) return null;
	return {
		score,
		summary: text(o.chaosDescription ?? o.summary),
		updated: parseTime(o.chaosLastUpdated ?? o.lastUpdated ?? o.date),
	};
}

/** The history from `/chaos/history`, oldest first, one point per day (the
 * last one wins when a day comes twice). Entries without a date or a score are
 * dropped rather than drawn at zero. */
export function parseHistory(raw: unknown): TensionPoint[] {
	const list = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object" && Array.isArray((raw as { history?: unknown }).history)
			? (raw as { history: unknown[] }).history
			: [];
	const byDay = new Map<string, TensionPoint>();
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		const score = clampScore(o.score ?? o.chaosIndex);
		const time = parseTime(o.date ?? o.chaosLastUpdated);
		if (score === null || time === null) continue;
		const date = typeof o.date === "string" ? o.date : new Date(time).toISOString();
		const day = new Date(time).toISOString().slice(0, 10);
		byDay.set(day, { date, time, score, summary: text(o.summary ?? o.chaosDescription) });
	}
	return [...byDay.values()].sort((a, b) => a.time - b.time);
}

/** The first sentence of the model's explanation — what a small card has room
 * for. Splits on a full stop, question or exclamation mark followed by a space
 * and a capital (or the end), so "U.S." and "3.5%" don't cut it short. */
export function firstSentence(summary: string): string {
	const s = summary.trim();
	const m = /^(.+?[.!?])(?=\s+["'“‘(]?[A-Z]|\s*$)/su.exec(s);
	return (m ? m[1] : s).trim();
}

/** How the score moved against the day before, rounded: positive when tension
 * rose. Null when the history can't say. */
export function tensionDelta(snapshot: TensionSnapshot): number | null {
	const now = snapshot.now;
	const h = snapshot.history;
	if (!now || h.length === 0) return null;
	// The history's last day is usually today's reading itself; compare with
	// the day before it then.
	const today = new Date(now.updated ?? snapshot.fetched).toISOString().slice(0, 10);
	const prior = [...h].reverse().find((p) => new Date(p.time).toISOString().slice(0, 10) < today);
	if (!prior) return null;
	return Math.round(now.score - prior.score);
}

// ---- Fetching ---------------------------------------------------------------

/** What a card asks for: how many days of history, 0 for none. */
export interface TensionRequest {
	historyDays: number;
}

export interface LoadOptions {
	/** How long a fetched snapshot is fresh. */
	ttlMs: number;
	/** "Disable external calls": only what is cached is returned. */
	disabled: boolean;
	/** Skip the TTL (the refresh button, the auto-refresh timer). */
	force?: boolean;
}

const cache = new Map<number, TensionSnapshot>();
const inflight = new Map<number, Promise<TensionSnapshot | null>>();

/** A request's cache key. Every card with the same history length shares one. */
function keyOf(req: TensionRequest): number {
	return Math.max(0, Math.round(req.historyDays));
}

/** The last snapshot fetched for a request (possibly stale), or null. */
export function cachedTension(req: TensionRequest): TensionSnapshot | null {
	return cache.get(keyOf(req)) ?? null;
}

async function getJson(url: string): Promise<{ status: number; json: unknown }> {
	const res = await requestUrl({ url, throw: false, headers: { Accept: "application/json" } });
	let json: unknown = null;
	if (res.status >= 200 && res.status < 300) {
		try {
			json = res.json as unknown;
		} catch {
			json = null;
		}
	}
	return { status: res.status, json };
}

/**
 * A fresh snapshot, fetched when the cache is missing, stale or `force`d.
 * Concurrent callers share one request. Never throws: on failure the last good
 * snapshot is returned, or null when there never was one.
 */
export async function loadTension(req: TensionRequest, opts: LoadOptions): Promise<TensionSnapshot | null> {
	const key = keyOf(req);
	const cached = cache.get(key) ?? null;
	if (opts.disabled) return cached;
	if (cached && !opts.force && Date.now() - cached.fetched < opts.ttlMs) return cached;
	const pending = inflight.get(key);
	if (pending) return pending;
	const run = (async (): Promise<TensionSnapshot | null> => {
		try {
			const [current, past] = await Promise.all([
				getJson(`${TENSION_API}/batches/latest/chaos?lang=en`),
				key > 0 ? getJson(`${TENSION_API}/chaos/history?lang=en&days=${key}`) : Promise.resolve(null),
			]);
			// A 404 is Kagi saying there is no index right now — an answer, not
			// a failure. Anything else that isn't a reading is a failure.
			const now = parseReading(current.json);
			if (!now && current.status !== 404) return cached;
			const history = past ? parseHistory(past.json) : [];
			const next: TensionSnapshot = {
				now,
				// A failed history keeps the previous one rather than wiping the
				// chart under a fresh reading.
				history: history.length || !cached ? history : cached.history,
				fetched: Date.now(),
			};
			cache.set(key, next);
			return next;
		} catch {
			return cached;
		} finally {
			inflight.delete(key);
		}
	})();
	inflight.set(key, run);
	return run;
}
