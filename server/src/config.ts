/**
 * Everything the server reads from its environment, in one place, with a
 * default for all of it.
 *
 * A gallery that needs a configuration file before it will start is a gallery
 * nobody stands up to try. `docker compose up` with no `.env` gives a working
 * host on port 8787 with a SQLite file beside it; every dial below exists so a
 * gallery that outgrows those defaults doesn't need a code change.
 */

function str(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value ? value : fallback;
}

function int(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export const config = {
	port: int("PORT", 8787),
	host: str("HOST", "0.0.0.0"),
	/** Where the database lives. `:memory:` is understood, for tests. */
	dbPath: str("DB_PATH", "./data/gallery.db"),
	/** Shown by `/v1/info`, so a client can name the gallery it is talking to. */
	name: str("GALLERY_NAME", "A Hearth gallery"),
	/** Optional; shown as text and only opened if the reader clicks it. */
	termsUrl: str("TERMS_URL", ""),

	/**
	 * Caps on what an upload may be. The per-package one is the outer bound —
	 * the format's own asset caps (4 MiB per picture, 16 MiB per package) still
	 * apply inside it, and both are checked.
	 */
	maxPackageBytes: int("MAX_PACKAGE_BYTES", 16 * 1024 * 1024),
	maxNameLength: int("MAX_NAME_LENGTH", 80),
	maxDescriptionLength: int("MAX_DESCRIPTION_LENGTH", 600),
	maxTags: int("MAX_TAGS", 8),
	/** How many entries one key may hold. A gallery is not a backup service. */
	maxEntriesPerAuthor: int("MAX_ENTRIES_PER_AUTHOR", 50),

	/**
	 * Rate limits, per rolling window.
	 *
	 * Votes are open — any key that can sign may cast one — so these are the
	 * whole of the anti-abuse story, and they are deliberately per-address as
	 * well as per-key: keys are free to mint, addresses are not quite. The
	 * dial to reach for first if a gallery gets a vote ring is
	 * `VOTE_MIN_KEY_AGE_HOURS`, which makes a freshly minted key wait before it
	 * counts for anything.
	 */
	uploadsPerDay: int("UPLOADS_PER_DAY", 10),
	votesPerDay: int("VOTES_PER_DAY", 200),
	votesPerIpPerDay: int("VOTES_PER_IP_PER_DAY", 400),
	readsPerMinute: int("READS_PER_MINUTE", 300),
	writesPerMinute: int("WRITES_PER_MINUTE", 30),
	/**
	 * How old a key must be, in hours, before its votes count. 0 is off, which
	 * is the shipped default: a gallery with nobody in it should not tell its
	 * first ten users to come back tomorrow.
	 */
	voteMinKeyAgeHours: int("VOTE_MIN_KEY_AGE_HOURS", 0),

	/** How long a sign-in token lasts. */
	tokenTtlSeconds: int("TOKEN_TTL_SECONDS", 24 * 3600),
	/** How long a challenge nonce stays answerable. */
	nonceTtlSeconds: int("NONCE_TTL_SECONDS", 300),

	/**
	 * Trust `X-Forwarded-For` for the client address.
	 *
	 * Off by default and that is not a formality: with it on, anybody can set
	 * the header and every per-address limit becomes per-whatever-they-typed.
	 * Turn it on only when the server is behind a proxy you run, which is the
	 * only arrangement in which the header means anything.
	 */
	trustProxy: str("TRUST_PROXY", "") === "1",
} as const;

export type Config = typeof config;
