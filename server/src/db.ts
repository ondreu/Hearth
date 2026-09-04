/**
 * The database: `node:sqlite`, one file, no driver to install.
 *
 * SQLite because a dashboard gallery is a read-mostly catalogue that will be
 * measured in thousands of rows for a long time, and because "the data is one
 * file you can copy" is worth more to somebody self-hosting than any amount of
 * horizontal scale they will never need. `node:sqlite` because it ships with
 * Node, which is what lets the whole server be one bundled file with nothing
 * installed beside it.
 *
 * Migrations are a numbered list applied in order inside a transaction, with
 * the number kept in SQLite's own `user_version`. Add to the end; never edit a
 * migration that has shipped.
 */

import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Each migration is the SQL to get from version N-1 to version N.
 *
 * Notes on the shape, since a few columns are decisions rather than storage:
 *
 * - `package` holds the uploaded file **byte for byte**. It is served back
 *   unchanged, which is the only way the author's signature still verifies in
 *   the vault that installs it — see `upload.ts`.
 * - `source_id` is the uploader's `meta.id`: which published dashboard this is,
 *   across vaults and versions. It is unique on its own rather than per author,
 *   so a fork cannot be offered to readers as an update to the board it was
 *   forked from.
 * - `wallpaper` is a decoded copy of the board's own embedded wallpaper, so a
 *   listing can show the real picture without downloading the whole package.
 *   Raster types only; the format's allowlist already excludes SVG.
 * - `status` is one of four, and the last two are deliberately different things:
 *   `live`; `held` (something needs a look before it is listed); `withdrawn`
 *   (its author took it down, and may put it back); and `removed` (an operator
 *   took it down, and its author may not undo that). Both keep the row so an id
 *   is never reused. Conflating them makes moderation something the moderated
 *   party can reverse.
 */
const MIGRATIONS: string[] = [
	`
	CREATE TABLE entries (
		id              TEXT PRIMARY KEY,
		source_id       TEXT NOT NULL UNIQUE,
		author_key      TEXT NOT NULL,
		name            TEXT NOT NULL,
		description     TEXT,
		category        TEXT NOT NULL,
		tags            TEXT NOT NULL DEFAULT '[]',
		version         TEXT,
		plugin_version  TEXT,
		preview         TEXT,
		cards           TEXT NOT NULL DEFAULT '[]',
		requires        TEXT NOT NULL DEFAULT '{}',
		remote_refs     INTEGER NOT NULL DEFAULT 0,
		size_bytes      INTEGER NOT NULL DEFAULT 0,
		wallpaper       BLOB,
		wallpaper_mime  TEXT,
		package         TEXT NOT NULL,
		downloads       INTEGER NOT NULL DEFAULT 0,
		upvotes         INTEGER NOT NULL DEFAULT 0,
		downvotes       INTEGER NOT NULL DEFAULT 0,
		published_at    TEXT NOT NULL,
		updated_at      TEXT NOT NULL,
		status          TEXT NOT NULL DEFAULT 'live',
		hold_reason     TEXT
	);
	CREATE INDEX entries_author ON entries (author_key);
	CREATE INDEX entries_category ON entries (status, category);
	CREATE INDEX entries_published ON entries (status, published_at DESC);

	CREATE TABLE authors (
		public_key    TEXT PRIMARY KEY,
		first_seen_at TEXT NOT NULL
	);

	CREATE TABLE votes (
		entry_id   TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
		voter_key  TEXT NOT NULL,
		value      INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		PRIMARY KEY (entry_id, voter_key)
	);

	CREATE TABLE nonces (
		nonce      TEXT PRIMARY KEY,
		public_key TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);

	CREATE TABLE tokens (
		token      TEXT PRIMARY KEY,
		public_key TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);

	-- One download counted per entry per address per day. A counter anybody can
	-- run up in a loop is not a number worth sorting by.
	CREATE TABLE download_marks (
		entry_id TEXT NOT NULL,
		day_key  TEXT NOT NULL,
		PRIMARY KEY (entry_id, day_key)
	);

	-- Small, long-lived facts about this installation. Holds the salt the
	-- download counter hashes addresses with, which has to survive a restart or
	-- every restart double-counts a day's downloads.
	CREATE TABLE server_meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE rate_buckets (
		bucket       TEXT PRIMARY KEY,
		count        INTEGER NOT NULL,
		window_start INTEGER NOT NULL
	);
	`,

	// 2 — comments.
	//
	// `body` is text somebody typed, and it is served to other people's vaults.
	// Nothing here interprets it and nothing downstream renders it as markup:
	// the client puts it in a text node. Length is capped on the way in, because
	// a comment is a paragraph and a megabyte of one is an attack.
	//
	// Deleting is a status change, like an entry's, so a reply that answers a
	// comment still has something to have answered. A removed comment keeps its
	// row and loses its body.
	`
	CREATE TABLE comments (
		id         TEXT PRIMARY KEY,
		entry_id   TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
		author_key TEXT NOT NULL,
		body       TEXT NOT NULL,
		created_at TEXT NOT NULL,
		status     TEXT NOT NULL DEFAULT 'live'
	);
	CREATE INDEX comments_entry ON comments (entry_id, status, created_at DESC);
	CREATE INDEX comments_author ON comments (author_key);
	`,

	// 3 — the theme an author recommends their board be seen under. Advisory,
	// displayed and never acted on; nothing here installs a theme.
	`
	ALTER TABLE entries ADD COLUMN theme TEXT;
	`,

	// 4 — the author's own redacted photograph of the board, decoded out of the
	// package so a listing can show it without downloading the whole file.
	`
	ALTER TABLE entries ADD COLUMN snapshot BLOB;
	ALTER TABLE entries ADD COLUMN snapshot_mime TEXT;
	`,

	// 5 — `withdrawn`, for an author's own takedown, told apart from `removed`.
	//
	// **Nothing is relabelled.** The obvious migration — turn every existing
	// `removed` into `withdrawn`, since only the withdraw route wrote that
	// status — is wrong, because `docs/gallery-hosting.md` has been telling
	// operators to take entries down with exactly `UPDATE … SET
	// status='removed'` since before the split existed. Relabelling would
	// reverse every takedown a gallery had actually performed, and hand the
	// board back to whoever it was taken from.
	//
	// So old rows keep `removed` and stay unrepublishable. The cost is a few
	// authors who withdrew a board before this build and now have to ask; the
	// alternative cost is undoing moderation, silently, on upgrade. The
	// hosting guide says how to release one by hand.
	`
	SELECT 1;
	`,
];

export type Db = DatabaseSync;

/** Open the database, applying any migration it hasn't had yet. */
export function openDatabase(path: string): Db {
	if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	// WAL so a long read (somebody downloading a 12 MB package) doesn't block
	// the write behind it; `foreign_keys` so a withdrawn entry takes its votes.
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec("PRAGMA busy_timeout = 5000");
	migrate(db);
	return db;
}

function migrate(db: Db): void {
	const row = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
	const current = Number(row?.user_version ?? 0);
	for (let version = current; version < MIGRATIONS.length; version++) {
		db.exec("BEGIN");
		try {
			db.exec(MIGRATIONS[version]);
			// `user_version` takes no parameter binding, and the value is a loop
			// index rather than anything that came in over a socket.
			db.exec(`PRAGMA user_version = ${version + 1}`);
			db.exec("COMMIT");
		} catch (err) {
			db.exec("ROLLBACK");
			throw err;
		}
	}
}

/**
 * A per-installation secret, minted once and kept.
 *
 * Used to key the hash the download counter dedupes addresses with. A plain
 * hash of an IPv4 address is not anonymisation — the whole space is four
 * billion values and anybody holding the file can walk it in seconds — so the
 * hash is keyed with something that only exists inside this database.
 */
export function serverSecret(db: Db): string {
	const row = db.prepare("SELECT value FROM server_meta WHERE key = 'ip_salt'").get() as
		| { value?: string }
		| undefined;
	if (row?.value) return row.value;
	const salt = randomBytes(32).toString("hex");
	db.prepare("INSERT INTO server_meta (key, value) VALUES ('ip_salt', ?)").run(salt);
	return salt;
}

/** Drop the rows that only ever mattered for a few minutes. Called on a timer
 * rather than on every request: it is bookkeeping, not correctness — every
 * reader of these tables checks the expiry itself. */
export function sweepExpired(db: Db): void {
	const now = Date.now();
	db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(now);
	db.prepare("DELETE FROM tokens WHERE expires_at < ?").run(now);
	db.prepare("DELETE FROM rate_buckets WHERE window_start < ?").run(now - 7 * 24 * 3600_000);
	// Yesterday's download marks have done their job.
	db.prepare("DELETE FROM download_marks WHERE day_key < ?").run(
		new Date(now - 2 * 86_400_000).toISOString().slice(0, 10),
	);
}
