/**
 * Voting, Reddit-style: up, down, or neither, and the score is the difference.
 *
 * One vote per key per entry, changeable and clearable — pressing the arrow you
 * already chose takes it back, which is what every control shaped like this
 * does. The tallies are kept on the entry rather than counted from the votes
 * table on read: a listing sorts by them, and a `COUNT` per row per sort is the
 * thing that makes a catalogue slow.
 *
 * What this is **not** is Sybil-resistant, and it is worth saying plainly
 * rather than implying otherwise with mechanism. Keys are free to mint, so
 * identities are free to mint, so votes are free to mint; nothing available on
 * this side of the wire fixes that. What is here is what makes it tedious:
 * per-key and per-address limits, and an optional minimum age on a key before
 * its votes count — the dial to turn first, and off by default because a
 * gallery with nobody in it should not tell its first ten users to come back
 * tomorrow.
 *
 * An author voting on their own board is allowed. It is one vote, it is
 * visible, and stopping it would only teach people to keep a second key.
 */

import { config } from "./config.js";
import type { Db } from "./db.js";
import { authorAge } from "./auth.js";
import { badRequest, notFound, unprocessable } from "./http.js";

export function castVote(
	db: Db,
	entryId: string,
	voter: string,
	value: number,
): { score: number; upvotes: number; downvotes: number; myVote: number } {
	if (value !== 1 && value !== 0 && value !== -1) throw badRequest("vote must be 1, 0 or -1");

	const entry = db
		.prepare("SELECT id FROM entries WHERE id = ? AND status = 'live'")
		.get(entryId) as { id?: string } | undefined;
	if (!entry?.id) throw notFound();

	if (config.voteMinKeyAgeHours > 0) {
		const seen = authorAge(db, voter);
		const age = seen === null ? 0 : Date.now() - seen;
		if (age < config.voteMinKeyAgeHours * 3600_000) {
			throw unprocessable(
				`this gallery asks that an identity be ${config.voteMinKeyAgeHours} hours old before its votes count`,
			);
		}
	}

	const previous = Number(
		(db.prepare("SELECT value FROM votes WHERE entry_id = ? AND voter_key = ?").get(
			entryId,
			voter,
		) as { value?: number } | undefined)?.value ?? 0,
	);

	if (previous !== value) {
		if (value === 0) {
			db.prepare("DELETE FROM votes WHERE entry_id = ? AND voter_key = ?").run(entryId, voter);
		} else {
			db.prepare(
				`INSERT INTO votes (entry_id, voter_key, value, created_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT (entry_id, voter_key) DO UPDATE SET value = excluded.value`,
			).run(entryId, voter, value, new Date().toISOString());
		}
		// The tallies move by the difference between the old vote and the new
		// one, which handles every transition — including up straight to down —
		// without a second read of the votes table.
		db.prepare(
			`UPDATE entries SET
				upvotes = upvotes + ? ,
				downvotes = downvotes + ?
			 WHERE id = ?`,
		).run(
			(value === 1 ? 1 : 0) - (previous === 1 ? 1 : 0),
			(value === -1 ? 1 : 0) - (previous === -1 ? 1 : 0),
			entryId,
		);
	}

	const row = db.prepare("SELECT upvotes, downvotes FROM entries WHERE id = ?").get(entryId) as {
		upvotes: number;
		downvotes: number;
	};
	return {
		score: row.upvotes - row.downvotes,
		upvotes: row.upvotes,
		downvotes: row.downvotes,
		myVote: value,
	};
}
