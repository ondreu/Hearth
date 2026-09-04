/**
 * Rate limits, which are the whole of this gallery's anti-abuse story.
 *
 * Voting is open — any key that can sign may cast one — and the honest thing to
 * say about that is that it is not Sybil-resistant and cannot be made so here:
 * keys are free to mint, so identities are free to mint, so votes are free to
 * mint. What limits do is make it *tedious* rather than free, and they are
 * applied on two axes because the two have different costs to the attacker:
 *
 * - **per key**, which is cheap to get around by minting another;
 * - **per address**, which is not free, and is the one that actually bites.
 *
 * Both are fixed windows in SQLite rather than a token bucket in memory,
 * because the server is expected to be restarted by whoever runs it and a limit
 * that resets on deploy is a limit anybody can wait out.
 *
 * The dial to reach for when a gallery does get a vote ring is
 * `VOTE_MIN_KEY_AGE_HOURS` (see `votes.ts`): it costs an attacker a day per
 * identity and costs a legitimate first-time voter one, which is why it ships
 * off rather than on.
 */

import type { Db } from "./db.js";
import { rateLimited } from "./http.js";

/**
 * Count one hit against a bucket, and refuse when it is full.
 *
 * `limit` of 0 means "no limit" rather than "nothing allowed": these come from
 * environment variables, and an operator who sets one to 0 means to turn it
 * off, not to close the gallery.
 */
export function consume(db: Db, bucket: string, limit: number, windowMs: number): void {
	if (limit <= 0) return;
	const now = Date.now();
	const start = Math.floor(now / windowMs) * windowMs;
	const row = db
		.prepare("SELECT count, window_start FROM rate_buckets WHERE bucket = ?")
		.get(bucket) as { count?: number; window_start?: number } | undefined;

	if (!row || Number(row.window_start) !== start) {
		db.prepare(
			`INSERT INTO rate_buckets (bucket, count, window_start) VALUES (?, 1, ?)
			 ON CONFLICT (bucket) DO UPDATE SET count = 1, window_start = excluded.window_start`,
		).run(bucket, start);
		return;
	}
	if (Number(row.count) >= limit) throw rateLimited();
	db.prepare("UPDATE rate_buckets SET count = count + 1 WHERE bucket = ?").run(bucket);
}

export const MINUTE = 60_000;
export const DAY = 86_400_000;
