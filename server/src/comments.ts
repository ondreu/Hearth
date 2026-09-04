/**
 * Comments on an entry.
 *
 * The smallest thing that is actually useful: a flat list, newest first, one
 * body of text per comment, no threading and no editing. Threading is a
 * different feature with its own problems (collapsing, ordering, orphans) and a
 * board's comments are "does this work with Dataview 0.5" and "the third card
 * needs a folder set" — remarks, not a discussion.
 *
 * Two things this file is careful about, both because a comment is the first
 * thing in this server that is *prose from a stranger*:
 *
 * - **It is never interpreted.** Stored as typed, served as typed, and rendered
 *   by the client into a text node. Nothing here or downstream treats it as
 *   markup, and the length cap is applied on the way in so a megabyte of it
 *   cannot be stored in the first place.
 * - **Deleting keeps the row.** An author can remove their own comment, and an
 *   entry's owner can remove one from their board — moderation somebody can do
 *   without an admin login. Both clear the body and mark it, rather than
 *   dropping the row, so a count stays stable and an id is never reused.
 */

import { randomBytes } from "node:crypto";
import { handleFromPublicKey } from "../../src/identity.js";
import type { Db } from "./db.js";
import { badRequest, forbidden, notFound } from "./http.js";
import { touchAuthor } from "./auth.js";

/** A comment is a remark. Past this it is a document, and a document about
 * somebody else's dashboard belongs in an issue tracker. */
export const MAX_COMMENT_LENGTH = 1000;

/** How many a page holds. */
const PAGE_SIZE = 50;

interface CommentRow {
	id: string;
	entry_id: string;
	author_key: string;
	body: string;
	created_at: string;
}

export function listComments(db: Db, entryId: string, page: number): unknown {
	const entry = db
		.prepare("SELECT id FROM entries WHERE id = ? AND status = 'live'")
		.get(entryId) as { id?: string } | undefined;
	if (!entry?.id) throw notFound();

	const total = Number(
		(db
			.prepare("SELECT COUNT(*) AS n FROM comments WHERE entry_id = ? AND status = 'live'")
			.get(entryId) as { n: number }).n,
	);
	const rows = db
		.prepare(
			`SELECT id, entry_id, author_key, body, created_at FROM comments
			 WHERE entry_id = ? AND status = 'live'
			 ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
		)
		.all(entryId, PAGE_SIZE, (page - 1) * PAGE_SIZE) as unknown as CommentRow[];

	return {
		comments: rows.map((row) => ({
			id: row.id,
			body: row.body,
			createdAt: row.created_at,
			author: {
				publicKey: row.author_key,
				// Derived on the way out, like every other handle here.
				handle: handleFromPublicKey(row.author_key),
			},
		})),
		total,
		page,
		perPage: PAGE_SIZE,
	};
}

export function postComment(db: Db, entryId: string, authorKey: string, raw: unknown): unknown {
	const entry = db
		.prepare("SELECT id FROM entries WHERE id = ? AND status = 'live'")
		.get(entryId) as { id?: string } | undefined;
	if (!entry?.id) throw notFound();

	if (typeof raw !== "string") throw badRequest("body required");
	// Collapsed rather than rejected: a wall of blank lines is a formatting
	// trick to make one comment fill a page, and it is not what anybody meant to
	// type. Runs of three or more newlines become two.
	const body = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	if (!body) throw badRequest("empty comment");
	if (body.length > MAX_COMMENT_LENGTH) throw badRequest("comment is too long");

	const id = randomBytes(9).toString("base64url");
	const now = new Date().toISOString();
	touchAuthor(db, authorKey);
	db.prepare(
		"INSERT INTO comments (id, entry_id, author_key, body, created_at) VALUES (?, ?, ?, ?, ?)",
	).run(id, entryId, authorKey, body, now);

	return {
		id,
		body,
		createdAt: now,
		author: { publicKey: authorKey, handle: handleFromPublicKey(authorKey) },
	};
}

/**
 * Remove a comment.
 *
 * Its author may, and so may the owner of the entry it is on — which is the
 * whole of moderation for a gallery with no admin interface, and the right
 * person to have it: somebody publishing a board can clear something off it
 * without waiting for whoever runs the server.
 */
export function deleteComment(db: Db, commentId: string, actorKey: string): void {
	const row = db
		.prepare(
			`SELECT c.author_key, e.author_key AS entry_author
			 FROM comments c JOIN entries e ON e.id = c.entry_id
			 WHERE c.id = ? AND c.status = 'live'`,
		)
		.get(commentId) as { author_key?: string; entry_author?: string } | undefined;
	if (!row?.author_key) throw notFound();
	if (row.author_key !== actorKey && row.entry_author !== actorKey) throw forbidden();
	db.prepare("UPDATE comments SET status = 'removed', body = '' WHERE id = ?").run(commentId);
}
