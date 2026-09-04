/**
 * What the gallery server says, and how Hearth reads it.
 *
 * The wire contract is written down in `docs/gallery-api.md`; this module is
 * the client's half of it. Two rules run through the whole file and are the
 * reason it exists rather than a set of `as` casts:
 *
 * - **A gallery is a stranger.** Someone running Hearth points it at a host,
 *   and everything that comes back is text of unknown provenance — including
 *   the handle and description of a board somebody else uploaded. So every
 *   field is read through a validator that bounds its length and its shape, and
 *   anything unrecognised is dropped rather than carried into the UI. Numbers
 *   are clamped, ids are held to a plain shape, and no field here is ever
 *   interpolated into markup: the modals build text nodes.
 * - **A missing field is not an error.** A gallery running a newer or older
 *   build than the plugin should still list. Readers fill in what they can and
 *   leave the rest absent, so one added field on the server does not blank a
 *   listing on every older Hearth.
 */

import { asGalleryCategory, type GalleryCategory } from "./categories";

/** How a listing is ordered. Kept as a closed set: it goes into a query
 * string, and it is what the browse modal's sort control offers. */
export type GallerySort = "trending" | "top" | "new" | "downloads";

/** Every sort, in the order the control lists them. */
export const GALLERY_SORTS: readonly GallerySort[] = ["trending", "top", "new", "downloads"];

/** A reader's vote on an entry: up, none, down. Reddit-style — the score a
 * listing shows is `up - down`. */
export type VoteValue = 1 | 0 | -1;

/** An author, as a listing names them. */
export interface GalleryAuthor {
	/** The full handle, `quiet-lantern-4kj2m8`. Shown whole, never truncated to
	 * its words — see the identity notes in `docs/dashboard-package.md`. */
	handle: string;
	/** The ed25519 public key it derives from, lower-case hex. The key is the
	 * identity; the handle is a rendering of it, and this is what a profile is
	 * actually fetched by. */
	publicKey: string;
}

/** One entry as a listing row shows it. */
export interface GalleryEntrySummary {
	id: string;
	name: string;
	description?: string;
	category: GalleryCategory;
	tags: string[];
	author: GalleryAuthor | null;
	/** Reddit-style: ups minus downs. Can be negative. */
	score: number;
	upvotes: number;
	downvotes: number;
	downloads: number;
	/** ISO 8601, as the server wrote it. Parsed for display only. */
	publishedAt?: string;
	updatedAt?: string;
	/** How the reader has voted, when the client is signed in. */
	myVote: VoteValue;
	/** The Hearth version that wrote the package. */
	pluginVersion?: string;
	/** True when the package carries its wallpaper, so the row can ask the
	 * server for the picture. */
	hasWallpaper: boolean;
	/**
	 * True when the author published a redacted photograph of the board.
	 *
	 * When there is one it is what a listing shows, because it is the board as
	 * it really looks. An entry without one — published from a phone, or before
	 * pictures existed — falls back to its wallpaper, and then to saying so.
	 */
	hasSnapshot: boolean;
}

/** Everything the detail view shows, on top of the row. */
export interface GalleryEntryDetail extends GalleryEntrySummary {
	/** What is on the board, by kind. Derived by the server from the package
	 * rather than supplied by the uploader. */
	cards: { kind: string; count: number }[];
	/** What the board wants installed, from the package's own `requires`. */
	requires: {
		plugins: string[];
		cardKinds: string[];
		viewTypes: string[];
		settings: string[];
	};
	/** The author's own version string, when they keep one. */
	version?: string;
	/** The Obsidian theme its author recommends it be seen under, by name.
	 * Advisory: shown as text, and nothing installs or changes a theme. */
	theme?: string;
	/** How many things on this board are fetched from the internet. The import
	 * dialog says this too; saying it *before* the download is the point. */
	remoteRefs: number;
	/** Bytes of the package file, so a 14 MB wallpaper is not a surprise. */
	sizeBytes: number;
}

/**
 * The longest comment a gallery will take.
 *
 * The same figure the server enforces (`server/src/comments.ts`), applied on
 * this side too so the compose box stops at it rather than letting somebody
 * write four paragraphs and be told no afterwards. A comment is a remark; past
 * this it is a document, and a document about somebody else's dashboard belongs
 * in an issue tracker.
 */
export const MAX_COMMENT_LENGTH = 1000;

/** One remark on an entry. */
export interface GalleryComment {
	id: string;
	/**
	 * What somebody typed.
	 *
	 * Prose from a stranger, and the only free text in this API that isn't a
	 * field the uploader chose about their own board. It reaches the DOM as a
	 * text node — never as markup — and arrives bounded, because a comment is a
	 * paragraph and a megabyte of one is an attack rather than a remark.
	 */
	body: string;
	author: GalleryAuthor | null;
	createdAt?: string;
}

/** One page of comments. */
export interface GalleryCommentPage {
	comments: GalleryComment[];
	total: number;
	page: number;
	perPage: number;
}

/** One page of a listing. */
export interface GalleryListing {
	entries: GalleryEntrySummary[];
	total: number;
	page: number;
	perPage: number;
}

/** An author's page: everything they have published, and what it adds up to. */
export interface GalleryProfile {
	author: GalleryAuthor;
	entries: GalleryEntrySummary[];
	/**
	 * Every upvote across every entry, minus every downvote — the number the
	 * profile leads with, shown as **karma**.
	 *
	 * Named for the person rather than the arithmetic: a board has a score, and
	 * somebody who has published eight of them has something the sum of those
	 * scores is a worse name for.
	 */
	totalScore: number;
	totalUpvotes: number;
	totalDownvotes: number;
	totalDownloads: number;
	/** When this key was first seen publishing. There is no registration step,
	 * so this is as close to "joined" as the format allows. */
	firstSeenAt?: string;
}

/** What the server will accept, so the publish dialog can say no before the
 * upload rather than after it. */
export interface GalleryLimits {
	maxPackageBytes: number;
	maxNameLength: number;
	maxDescriptionLength: number;
	maxTags: number;
	/** Uploads allowed per key per day; 0 means the server didn't say. */
	uploadsPerDay: number;
	/** How many boards one identity may have in the gallery at once; 0 means no
	 * limit, or that the server didn't say. */
	maxEntriesPerAuthor: number;
}

/** What a gallery says about itself. Fetched once when a host is first used,
 * so the client can refuse politely instead of failing oddly. */
export interface GalleryInfo {
	name: string;
	/** The API version this host speaks. Hearth requires 1. */
	api: number;
	limits: GalleryLimits;
	/** Where the host's terms live, if it has any. Shown as text, never opened
	 * without the reader clicking it. */
	termsUrl?: string;
}

// ---- Readers ---------------------------------------------------------

/** Text, trimmed and bounded, or undefined. The single funnel every string
 * from a gallery passes through. */
export function text(value: unknown, max: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** A whole number in range, or the fallback. */
export function num(value: unknown, min: number, max: number, fallback = 0): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/** An entry or author id: the servers' own namespace, held to a plain shape so
 * it can be put in a URL path without escaping questions. */
export function readId(value: unknown): string | null {
	return typeof value === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}

/** Lower-case hex of the right width for an ed25519 public key. */
function readPublicKey(value: unknown): string | null {
	return typeof value === "string" && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

/** A handle, held to the shape `src/identity.ts` derives. A server that sends
 * anything else has sent a name somebody typed, which is the thing this format
 * exists not to have. */
function readHandle(value: unknown): string | null {
	return typeof value === "string" && /^[a-z]+-[a-z]+-[0-9a-z]{4,10}$/.test(value) ? value : null;
}

function readAuthor(raw: unknown): GalleryAuthor | null {
	if (!raw || typeof raw !== "object") return null;
	const src = raw as Record<string, unknown>;
	const publicKey = readPublicKey(src.publicKey);
	const handle = readHandle(src.handle);
	if (!publicKey || !handle) return null;
	return { publicKey, handle };
}

function readTags(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const tag of raw.slice(0, 24)) {
		const value = text(tag, 32)?.toLowerCase();
		if (value && !out.includes(value)) out.push(value);
	}
	return out;
}

function readVote(raw: unknown): VoteValue {
	return raw === 1 ? 1 : raw === -1 ? -1 : 0;
}

/** ISO 8601, or undefined. Held to a parseable date so the UI's formatter is
 * never handed something it will render as "Invalid Date". */
function readDate(raw: unknown): string | undefined {
	const value = text(raw, 40);
	if (!value) return undefined;
	return Number.isNaN(Date.parse(value)) ? undefined : value;
}

/** One row of a listing, or null when it is missing the two fields a row
 * cannot be drawn without. */
export function readEntrySummary(raw: unknown): GalleryEntrySummary | null {
	if (!raw || typeof raw !== "object") return null;
	const src = raw as Record<string, unknown>;
	const id = readId(src.id);
	const name = text(src.name, 120);
	if (!id || !name) return null;
	const upvotes = num(src.upvotes, 0, 1e9);
	const downvotes = num(src.downvotes, 0, 1e9);
	return {
		id,
		name,
		description: text(src.description, 1000),
		category: asGalleryCategory(src.category),
		tags: readTags(src.tags),
		author: readAuthor(src.author),
		// Taken from the server rather than recomputed: a host may weight or age
		// its score, and second-guessing it here would show a number that
		// disagrees with the order the rows arrived in.
		score: num(src.score, -1e9, 1e9, upvotes - downvotes),
		upvotes,
		downvotes,
		downloads: num(src.downloads, 0, 1e9),
		publishedAt: readDate(src.publishedAt),
		updatedAt: readDate(src.updatedAt),
		myVote: readVote(src.myVote),
		pluginVersion: text(src.pluginVersion, 24),
		hasWallpaper: src.hasWallpaper === true,
		hasSnapshot: src.hasSnapshot === true,
	};
}

function readStringList(raw: unknown, max: number, each: number): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw.slice(0, max)) {
		const value = text(item, each);
		if (value && !out.includes(value)) out.push(value);
	}
	return out;
}

export function readEntryDetail(raw: unknown): GalleryEntryDetail | null {
	const summary = readEntrySummary(raw);
	if (!summary) return null;
	const src = raw as Record<string, unknown>;
	const requires = (src.requires ?? {}) as Record<string, unknown>;
	const cards: { kind: string; count: number }[] = [];
	if (Array.isArray(src.cards)) {
		for (const card of src.cards.slice(0, 80)) {
			if (!card || typeof card !== "object") continue;
			const kind = text((card as Record<string, unknown>).kind, 32);
			if (!kind) continue;
			cards.push({ kind, count: num((card as Record<string, unknown>).count, 1, 10000, 1) });
		}
	}
	return {
		...summary,
		cards,
		requires: {
			plugins: readStringList(requires.plugins, 40, 80),
			cardKinds: readStringList(requires.cardKinds, 60, 32),
			viewTypes: readStringList(requires.viewTypes, 40, 80),
			settings: readStringList(requires.settings, 40, 60),
		},
		version: text(src.version, 32),
		theme: text(src.theme, 60),
		remoteRefs: num(src.remoteRefs, 0, 10000),
		sizeBytes: num(src.sizeBytes, 0, 1e10),
	};
}

export function readComment(raw: unknown): GalleryComment | null {
	if (!raw || typeof raw !== "object") return null;
	const src = raw as Record<string, unknown>;
	const id = readId(src.id);
	// The same bound the server applies on the way in, applied again on the way
	// out: a host that has been persuaded to store more must not be able to make
	// one comment fill a modal.
	const body = text(src.body, MAX_COMMENT_LENGTH);
	if (!id || !body) return null;
	return { id, body, author: readAuthor(src.author), createdAt: readDate(src.createdAt) };
}

export function readCommentPage(raw: unknown): GalleryCommentPage {
	const src = (raw ?? {}) as Record<string, unknown>;
	const comments: GalleryComment[] = [];
	if (Array.isArray(src.comments)) {
		for (const item of src.comments.slice(0, 100)) {
			const comment = readComment(item);
			if (comment) comments.push(comment);
		}
	}
	return {
		comments,
		total: num(src.total, 0, 1e9, comments.length),
		page: num(src.page, 1, 1e6, 1),
		perPage: num(src.perPage, 1, 200, comments.length || 50),
	};
}

export function readListing(raw: unknown): GalleryListing {
	const src = (raw ?? {}) as Record<string, unknown>;
	const entries: GalleryEntrySummary[] = [];
	if (Array.isArray(src.entries)) {
		for (const item of src.entries.slice(0, 200)) {
			const entry = readEntrySummary(item);
			if (entry) entries.push(entry);
		}
	}
	return {
		entries,
		total: num(src.total, 0, 1e9, entries.length),
		page: num(src.page, 1, 1e6, 1),
		perPage: num(src.perPage, 1, 200, entries.length || 24),
	};
}

export function readProfile(raw: unknown): GalleryProfile | null {
	if (!raw || typeof raw !== "object") return null;
	const src = raw as Record<string, unknown>;
	const author = readAuthor(src.author);
	if (!author) return null;
	const entries: GalleryEntrySummary[] = [];
	if (Array.isArray(src.entries)) {
		for (const item of src.entries.slice(0, 200)) {
			const entry = readEntrySummary(item);
			if (entry) entries.push(entry);
		}
	}
	const totalUpvotes = num(src.totalUpvotes, 0, 1e9);
	const totalDownvotes = num(src.totalDownvotes, 0, 1e9);
	return {
		author,
		entries,
		totalScore: num(src.totalScore, -1e9, 1e9, totalUpvotes - totalDownvotes),
		totalUpvotes,
		totalDownvotes,
		totalDownloads: num(src.totalDownloads, 0, 1e9),
		firstSeenAt: readDate(src.firstSeenAt),
	};
}

/** The server's own limits, with Hearth's defaults for anything it left out. */
export function readInfo(raw: unknown): GalleryInfo {
	const src = (raw ?? {}) as Record<string, unknown>;
	const limits = (src.limits ?? {}) as Record<string, unknown>;
	return {
		name: text(src.name, 60) ?? "",
		api: num(src.api, 0, 1000, 0),
		limits: {
			maxPackageBytes: num(limits.maxPackageBytes, 1024, 64 * 1024 * 1024, 16 * 1024 * 1024),
			maxNameLength: num(limits.maxNameLength, 8, 200, 80),
			maxDescriptionLength: num(limits.maxDescriptionLength, 40, 4000, 600),
			maxTags: num(limits.maxTags, 0, 24, 8),
			uploadsPerDay: num(limits.uploadsPerDay, 0, 10000, 0),
			maxEntriesPerAuthor: num(limits.maxEntriesPerAuthor, 0, 100000, 0),
		},
		termsUrl: httpsUrl(src.termsUrl),
	};
}

/** A URL the client would put in front of a reader. `https` only, and only
 * ever as the target of something they click. */
export function httpsUrl(value: unknown): string | undefined {
	const raw = text(value, 400);
	if (!raw) return undefined;
	try {
		const url = new URL(raw);
		return url.protocol === "https:" ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}
