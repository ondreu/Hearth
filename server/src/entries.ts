/**
 * Entries: listing them, describing one, publishing, withdrawing, downloading.
 *
 * Two things here are decisions rather than plumbing.
 *
 * **The listing is built from stored derivations, not from the package.** Every
 * row a client draws — the preview, the card counts, the requirements — was
 * computed from the uploaded file at publish time (`upload.ts`) and written
 * into columns. A listing that parsed a 12 MB package per row would be a
 * listing that fell over on its first busy afternoon, and one that trusted
 * fields the uploader supplied alongside the file would be a listing that could
 * be made to advertise a board it isn't.
 *
 * **Trending is a decayed score, not a window.** "Top this week" hides a board
 * published eight days ago that everybody likes; a decay lets an old board with
 * a lot of votes and a new board with a few stand next to each other. The shape
 * is the usual one — score over age to a power — and the constants are in the
 * SQL, where somebody running a gallery can see and change them.
 */

import { createHmac, randomBytes } from "node:crypto";
import { handleFromPublicKey } from "../../src/identity.js";
import { isGalleryCategory } from "../../src/gallery/categories.js";
import { type Db, serverSecret } from "./db.js";
import { config } from "./config.js";
import { forbidden, notFound, unprocessable } from "./http.js";
import { touchAuthor } from "./auth.js";
import type { AcceptedUpload } from "./upload.js";

/** A row as the tables hold it. */
interface EntryRow {
	id: string;
	source_id: string;
	author_key: string;
	name: string;
	description: string | null;
	category: string;
	tags: string;
	version: string | null;
	theme: string | null;
	plugin_version: string | null;
	preview: string | null;
	cards: string;
	requires: string;
	remote_refs: number;
	size_bytes: number;
	wallpaper_mime: string | null;
	downloads: number;
	upvotes: number;
	downvotes: number;
	published_at: string;
	updated_at: string;
	status: string;
	has_wallpaper?: number;
	has_snapshot?: number;
	my_vote?: number;
}

/** Columns every listing needs, minus the two big ones (`package`, `wallpaper`)
 * — a row must never carry a megabyte it isn't going to use. */
const SUMMARY_COLUMNS = `
	e.id, e.source_id, e.author_key, e.name, e.description, e.category, e.tags,
	e.version, e.theme, e.plugin_version, e.preview, e.cards, e.requires, e.remote_refs,
	e.size_bytes, e.downloads, e.upvotes, e.downvotes, e.published_at,
	e.updated_at, e.status,
	(e.wallpaper IS NOT NULL) AS has_wallpaper,
	(e.snapshot IS NOT NULL) AS has_snapshot
`;

/** How each sort orders the listing. Fixed strings chosen by a closed set —
 * nothing from a query string ever reaches the SQL, and a `Map` rather than an
 * object so nothing from one can reach `Object.prototype` either. */
const ORDER_BY = new Map<string, string>(Object.entries({
	new: "e.published_at DESC, e.id DESC",
	top: "(e.upvotes - e.downvotes) DESC, e.downloads DESC, e.id DESC",
	downloads: "e.downloads DESC, (e.upvotes - e.downvotes) DESC, e.id DESC",
	// Score over age: a board with ten votes today outranks one with twelve from
	// last month, and one with two hundred still holds its place for a while.
	// `+ 1` so a board with no votes yet has an age-ordered position rather than
	// a flat zero, and `+ 2` hours so the first minutes aren't a divide by ~0.
	trending: `
		((e.upvotes - e.downvotes) + 1.0) /
		POWER((julianday('now') - julianday(e.published_at)) * 24.0 + 2.0, 1.5) DESC,
		e.id DESC
	`,
}));

export interface ListParams {
	q?: string;
	category?: string;
	sort?: string;
	author?: string;
	page: number;
	perPage: number;
	/** The reader, so each row can carry how they voted. */
	viewer: string | null;
}

export function listEntries(db: Db, params: ListParams): unknown {
	const where: string[] = ["e.status = 'live'"];
	const args: unknown[] = [];

	if (params.category && isGalleryCategory(params.category)) {
		where.push("e.category = ?");
		args.push(params.category);
	}
	if (params.author && /^[0-9a-f]{64}$/.test(params.author)) {
		where.push("e.author_key = ?");
		args.push(params.author);
	}
	if (params.q) {
		// A LIKE across three columns rather than an FTS index: a gallery of a
		// few thousand boards is well inside what this costs, and it keeps the
		// schema to something an operator can read. Swap in FTS5 when a listing
		// stops being instant, not before.
		//
		// Words are matched independently and all of them have to hit
		// *somewhere* — so "reading room" and "room reading" find the same
		// board, and "minimal writing" finds a board tagged `minimal` and
		// described as being for writing. A single LIKE over the whole phrase
		// would find neither, which is the behaviour people read as "the search
		// is broken".
		const words = params.q.toLowerCase().slice(0, 120).split(/\s+/).filter(Boolean).slice(0, 6);
		for (const word of words) {
			where.push(
				"(LOWER(e.name) LIKE ? OR LOWER(e.description) LIKE ? OR LOWER(e.tags) LIKE ?)",
			);
			const needle = `%${word}%`;
			args.push(needle, needle, needle);
		}
	}

	const clause = where.join(" AND ");
	const total = Number(
		(db.prepare(`SELECT COUNT(*) AS n FROM entries e WHERE ${clause}`).get(...args) as {
			n: number;
		}).n,
	);
	// A Map, not an object: `?sort=toString` would otherwise resolve through
	// `Object.prototype` and interpolate a function into the SQL, which SQLite
	// answers with an error and the caller with a 500.
	const order = ORDER_BY.get(params.sort ?? "") ?? (ORDER_BY.get("trending") as string);
	const rows = db
		.prepare(
			`SELECT ${SUMMARY_COLUMNS} FROM entries e WHERE ${clause}
			 ORDER BY ${order} LIMIT ? OFFSET ?`,
		)
		.all(...args, params.perPage, (params.page - 1) * params.perPage) as unknown as EntryRow[];

	return {
		entries: rows.map((row) => summaryOf(db, row, params.viewer)),
		total,
		page: params.page,
		perPage: params.perPage,
	};
}

export function entryDetail(db: Db, id: string, viewer: string | null): unknown {
	const row = db
		.prepare(`SELECT ${SUMMARY_COLUMNS} FROM entries e WHERE e.id = ? AND e.status = 'live'`)
		.get(id) as unknown as EntryRow | undefined;
	if (!row) throw notFound();
	return {
		...summaryOf(db, row, viewer),
		cards: parseJson(row.cards, []),
		requires: parseJson(row.requires, {}),
		version: row.version ?? undefined,
		theme: row.theme ?? undefined,
		remoteRefs: row.remote_refs,
		sizeBytes: row.size_bytes,
	};
}

/** An author's page: what they published, and what it adds up to. */
export function authorProfile(db: Db, publicKey: string, viewer: string | null): unknown {
	if (!/^[0-9a-f]{64}$/.test(publicKey)) throw notFound();
	const rows = db
		.prepare(
			`SELECT ${SUMMARY_COLUMNS} FROM entries e
			 WHERE e.author_key = ? AND e.status = 'live'
			 ORDER BY e.published_at DESC`,
		)
		.all(publicKey) as unknown as EntryRow[];
	const seen = db
		.prepare("SELECT first_seen_at FROM authors WHERE public_key = ?")
		.get(publicKey) as { first_seen_at?: string } | undefined;
	if (rows.length === 0 && !seen) throw notFound();

	// Summed across their whole shelf, which is the number a profile exists to
	// show: it describes a maker rather than a board.
	let upvotes = 0;
	let downvotes = 0;
	let downloads = 0;
	for (const row of rows) {
		upvotes += row.upvotes;
		downvotes += row.downvotes;
		downloads += row.downloads;
	}
	return {
		author: { publicKey, handle: handleFromPublicKey(publicKey) },
		entries: rows.map((row) => summaryOf(db, row, viewer)),
		totalScore: upvotes - downvotes,
		totalUpvotes: upvotes,
		totalDownvotes: downvotes,
		totalDownloads: downloads,
		firstSeenAt: seen?.first_seen_at,
	};
}

/**
 * Store an accepted upload, as a new entry or as a new version of one.
 *
 * "The same entry" is `meta.id`, which is unique across the gallery rather than
 * per author — see the note at the top of `upload.ts`. An id already held by
 * somebody else is refused, and the refusal names the fix, because the case it
 * catches is a real and reasonable thing to have done: installed a board,
 * changed it, tried to publish the result.
 */
export function publishEntry(
	db: Db,
	upload: AcceptedUpload,
	authorKey: string,
): { id: string; updated: boolean; held: boolean } {
	if (upload.authorKey !== authorKey) {
		throw forbidden("the package is signed by a different key than the one signed in");
	}

	const existing = db
		.prepare("SELECT id, author_key, status FROM entries WHERE source_id = ?")
		.get(upload.sourceId) as
		| { id: string; author_key: string; status: string }
		| undefined;

	if (existing && existing.author_key !== authorKey) {
		throw forbidden(
			"that dashboard id already belongs to another author — duplicate the board first, which gives it an identity of its own, then publish that",
		);
	}
	// A takedown has to stick. Without this, republishing the identical package
	// sets `status` back to 'live' from the upload alone, and an entry an
	// operator removed is back under the same id — which makes moderation
	// something the author can simply undo.
	if (existing?.status === "removed") {
		throw forbidden("that dashboard was removed from this gallery and cannot be republished");
	}

	const now = new Date().toISOString();
	const status = upload.holdReason ? "held" : "live";
	touchAuthor(db, authorKey);

	if (existing) {
		db.prepare(
			`UPDATE entries SET
				name = ?, description = ?, category = ?, tags = ?, version = ?, theme = ?,
				plugin_version = ?, preview = ?, cards = ?, requires = ?,
				remote_refs = ?, size_bytes = ?, wallpaper = ?, wallpaper_mime = ?,
				snapshot = ?, snapshot_mime = ?,
				package = ?, updated_at = ?, status = ?, hold_reason = ?
			 WHERE id = ?`,
		).run(
			upload.name,
			upload.description,
			upload.category,
			JSON.stringify(upload.tags),
			upload.version,
			upload.theme,
			upload.pluginVersion,
			upload.preview,
			upload.cards,
			upload.requires,
			upload.remoteRefs,
			upload.sizeBytes,
			upload.wallpaper,
			upload.wallpaperMime,
			upload.snapshot,
			upload.snapshotMime,
			upload.json,
			now,
			status,
			upload.holdReason,
			existing.id,
		);
		return { id: existing.id, updated: true, held: status === "held" };
	}

	const live = Number(
		(db
			.prepare("SELECT COUNT(*) AS n FROM entries WHERE author_key = ? AND status != 'removed'")
			.get(authorKey) as { n: number }).n,
	);
	if (config.maxEntriesPerAuthor > 0 && live >= config.maxEntriesPerAuthor) {
		throw unprocessable("this gallery's limit of published dashboards for one author is reached");
	}

	const id = newEntryId();
	db.prepare(
		`INSERT INTO entries (
			id, source_id, author_key, name, description, category, tags, version,
			theme, plugin_version, preview, cards, requires, remote_refs, size_bytes,
			wallpaper, wallpaper_mime, snapshot, snapshot_mime, package,
			published_at, updated_at, status, hold_reason
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		upload.sourceId,
		authorKey,
		upload.name,
		upload.description,
		upload.category,
		JSON.stringify(upload.tags),
		upload.version,
		upload.theme,
		upload.pluginVersion,
		upload.preview,
		upload.cards,
		upload.requires,
		upload.remoteRefs,
		upload.sizeBytes,
		upload.wallpaper,
		upload.wallpaperMime,
		upload.snapshot,
		upload.snapshotMime,
		upload.json,
		now,
		now,
		status,
		upload.holdReason,
	);
	return { id, updated: false, held: status === "held" };
}

/**
 * Withdraw an entry.
 *
 * Marked rather than deleted, so its id and its `source_id` are never handed to
 * something else: an id that could be reused is an id that could be made to
 * point at a different board than the one somebody installed.
 */
export function withdrawEntry(db: Db, id: string, authorKey: string): void {
	const row = db.prepare("SELECT author_key FROM entries WHERE id = ?").get(id) as
		| { author_key: string }
		| undefined;
	if (!row) throw notFound();
	if (row.author_key !== authorKey) throw forbidden();
	db.prepare(
		`UPDATE entries SET status = 'removed', package = '', wallpaper = NULL,
		   wallpaper_mime = NULL, snapshot = NULL, snapshot_mime = NULL, updated_at = ?
		 WHERE id = ?`,
	).run(new Date().toISOString(), id);
}

/** The package, as uploaded. Counts one download per address per day. */
export function downloadEntry(db: Db, id: string, ip: string): string {
	const row = db
		.prepare("SELECT package FROM entries WHERE id = ? AND status = 'live'")
		.get(id) as { package?: string } | undefined;
	if (!row?.package) throw notFound();

	// The day key mixes the address in, so the mark is per address rather than
	// global. It is a *keyed* hash: a plain one over IPv4 would be a four-
	// billion-value space anybody holding the file could walk, which is not
	// anonymisation, and this table has no reason to be a log of who fetched
	// what.
	const dayKey = `${new Date().toISOString().slice(0, 10)}:${hashIp(db, ip)}`;
	const marked = db
		.prepare("INSERT INTO download_marks (entry_id, day_key) VALUES (?, ?) ON CONFLICT DO NOTHING")
		.run(id, dayKey);
	if (Number(marked.changes) > 0) {
		db.prepare("UPDATE entries SET downloads = downloads + 1 WHERE id = ?").run(id);
	}
	return row.package;
}

/** The author's redacted photograph of the board, for a listing thumbnail. */
export function entrySnapshot(db: Db, id: string): { bytes: Buffer; mime: string } {
	const row = db
		.prepare("SELECT snapshot, snapshot_mime FROM entries WHERE id = ? AND status = 'live'")
		.get(id) as { snapshot?: Uint8Array; snapshot_mime?: string } | undefined;
	if (!row?.snapshot || !row.snapshot_mime) throw notFound();
	return { bytes: Buffer.from(row.snapshot), mime: row.snapshot_mime };
}

/** The board's wallpaper, for a listing thumbnail. */
export function entryWallpaper(db: Db, id: string): { bytes: Buffer; mime: string } {
	const row = db
		.prepare("SELECT wallpaper, wallpaper_mime FROM entries WHERE id = ? AND status = 'live'")
		.get(id) as { wallpaper?: Uint8Array; wallpaper_mime?: string } | undefined;
	if (!row?.wallpaper || !row.wallpaper_mime) throw notFound();
	return { bytes: Buffer.from(row.wallpaper), mime: row.wallpaper_mime };
}

// ---- Shaping -----------------------------------------------------------

function summaryOf(db: Db, row: EntryRow, viewer: string | null): Record<string, unknown> {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		category: row.category,
		tags: parseJson<string[]>(row.tags, []),
		author: {
			publicKey: row.author_key,
			// Derived on the way out rather than stored: the handle is a function
			// of the key, so there is no second copy to fall out of step.
			handle: handleFromPublicKey(row.author_key),
		},
		score: row.upvotes - row.downvotes,
		upvotes: row.upvotes,
		downvotes: row.downvotes,
		downloads: row.downloads,
		publishedAt: row.published_at,
		updatedAt: row.updated_at,
		myVote: viewer ? voteOf(db, row.id, viewer) : 0,
		preview: row.preview ? parseJson(row.preview, null) : null,
		pluginVersion: row.plugin_version ?? undefined,
		hasWallpaper: Number(row.has_wallpaper ?? 0) === 1,
		hasSnapshot: Number(row.has_snapshot ?? 0) === 1,
	};
}

function voteOf(db: Db, entryId: string, voter: string): number {
	const row = db
		.prepare("SELECT value FROM votes WHERE entry_id = ? AND voter_key = ?")
		.get(entryId, voter) as { value?: number } | undefined;
	return Number(row?.value ?? 0);
}

function parseJson<T>(text: string | null, fallback: T): T {
	if (!text) return fallback;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}

/** A short, opaque, URL-safe id. Random rather than sequential: an id anybody
 * can count up to is an invitation to enumerate a gallery. */
function newEntryId(): string {
	return randomBytes(9).toString("base64url");
}

/** An address, one way, keyed with this installation's own secret — enough to
 * tell two visitors apart for a day, and not reversible by somebody who has
 * only the addresses. Truncated because the whole digest is more than a
 * day-scoped dedup key needs. */
function hashIp(db: Db, ip: string): string {
	return createHmac("sha256", serverSecret(db)).update(ip).digest("hex").slice(0, 16);
}
