import { readTaxonomy } from "./reads";
import type { OperonSession } from "./api";
import type { OperonTaxonomy } from "./types";

/**
 * A short-lived cache for Operon's taxonomy.
 *
 * Every status chip, priority dot and board column is labelled, ordered and
 * coloured from this snapshot, so an uncached read would fire once per card on
 * every dashboard redraw — and the dashboard redraws on every vault change.
 * The taxonomy only moves when the user edits Operon's settings, so a short TTL
 * plus in-flight sharing is enough; the shape follows `src/ics.ts`, which
 * solves the same problem for calendar feeds.
 */

const TTL_MS = 60_000;

interface CacheEntry {
	taxonomy: OperonTaxonomy;
	at: number;
}

let cached: CacheEntry | null = null;
let inFlight: Promise<OperonTaxonomy | null> | null = null;

/** The last taxonomy read, without waiting. Lets a card draw its known columns
 * immediately and fill in once the refresh lands, the way the calendar card
 * draws cached ICS events while fetching. */
export function cachedTaxonomy(): OperonTaxonomy | null {
	return cached?.taxonomy ?? null;
}

/**
 * The taxonomy, from cache when fresh. Returns null rather than throwing when
 * Operon is unreachable or hasn't granted `catalog.read` — a card without a
 * taxonomy falls back to raw ids, which is degraded but not broken.
 */
export function loadTaxonomy(session: OperonSession, force = false): Promise<OperonTaxonomy | null> {
	const now = Date.now();
	if (!force && cached && now - cached.at < TTL_MS) return Promise.resolve(cached.taxonomy);
	if (inFlight) return inFlight;

	inFlight = readTaxonomy(session)
		.then((result) => {
			if (!result.ok) return cached?.taxonomy ?? null;
			cached = { taxonomy: result.value, at: Date.now() };
			return result.value;
		})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

/** Drop the cache. Called when the Operon session is renegotiated, since a new
 * session may be looking at different settings. */
export function forgetTaxonomy(): void {
	cached = null;
}
