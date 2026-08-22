import { readCatalog } from "./reads";
import type { OperonSession } from "./api";
import type { OperonCatalog, OperonPolicies, OperonTaxonomy } from "./types";

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
	catalog: OperonCatalog;
	at: number;
}

let cached: CacheEntry | null = null;
let inFlight: Promise<OperonCatalog | null> | null = null;
/** The session the last read went through. The card editor needs a taxonomy but
 * only receives an `App` — it has no route to the plugin — so the render path,
 * which does hold the session, leaves one here for it. Cleared with the cache. */
let lastSession: OperonSession | null = null;

/** The last taxonomy read, without waiting. Lets a card draw its known columns
 * immediately and fill in once the refresh lands, the way the calendar card
 * draws cached ICS events while fetching. */
export function cachedTaxonomy(): OperonTaxonomy | null {
	return cached?.catalog.taxonomy ?? null;
}

/** Operon's own creation rules from the last catalog read, without waiting.
 * Used to explain a refused create in terms of the setting that caused it. */
export function cachedPolicies(): OperonPolicies | null {
	return cached?.catalog.policies ?? null;
}

/**
 * The taxonomy, from cache when fresh. Returns null rather than throwing when
 * Operon is unreachable or hasn't granted `catalog.read` — a card without a
 * taxonomy falls back to raw ids, which is degraded but not broken.
 */
export function loadTaxonomy(session: OperonSession, force = false): Promise<OperonTaxonomy | null> {
	return loadCatalog(session, force).then((catalog) => catalog?.taxonomy ?? null);
}

/** The whole snapshot — taxonomy and policies — from cache when fresh. */
export function loadCatalog(session: OperonSession, force = false): Promise<OperonCatalog | null> {
	const now = Date.now();
	if (!force && cached && now - cached.at < TTL_MS) return Promise.resolve(cached.catalog);
	// A forced refresh starts its own read: joining one already in flight could
	// hand back a snapshot taken before whatever prompted the refresh.
	if (inFlight && !force) return inFlight;
	lastSession = session;

	const request: Promise<OperonCatalog | null> = readCatalog(session)
		.then((result) => {
			// A failed read keeps whatever was cached: a card drawing slightly
			// stale labels beats one that suddenly shows raw ids.
			if (!result.ok) return cached?.catalog ?? null;
			cached = { catalog: result.value, at: Date.now() };
			return result.value;
		})
		.finally(() => {
			// Only clear the slot if it is still ours — a forced read started
			// alongside this one owns it now.
			if (inFlight === request) inFlight = null;
		});
	inFlight = request;
	return request;
}

/**
 * Fill the cache from whichever session last used it, for a caller that needs a
 * taxonomy but has no session of its own. Resolves to null when nothing has
 * read one yet — which is exactly when there is genuinely nothing to show.
 */
export function warmTaxonomy(): Promise<OperonTaxonomy | null> {
	if (cached) return Promise.resolve(cached.catalog.taxonomy);
	if (!lastSession) return Promise.resolve(null);
	return loadTaxonomy(lastSession);
}

/** Drop the cache. Called when the Operon session is renegotiated, since a new
 * session may be looking at different settings. */
export function forgetTaxonomy(): void {
	cached = null;
	lastSession = null;
}
