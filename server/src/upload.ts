/**
 * What a gallery does with a package somebody uploads.
 *
 * `docs/dashboard-package.md` sketches a pipeline for this, and this file
 * follows it with **one deliberate change**, which is worth setting out because
 * it is the difference between a signature that means something and one that
 * doesn't.
 *
 * The sketch has the gallery strip the package and overwrite `meta.id` with its
 * own entry id. Both are edits, and the signature covers the whole document —
 * so a gallery that does either serves a file whose signature no longer
 * verifies. The importing vault would then read every downloaded board as
 * *invalid*, which is not "unattributed": it is the exact state a forged file
 * produces, reported to the reader as an alarm, on every legitimate board in
 * the gallery. Making the author's signature an upload-time proof that the
 * reader can never check again throws away the one property the whole keypair
 * exists for.
 *
 * So this server **never edits an uploaded package**. It stores and serves the
 * bytes exactly as they arrived, and instead of stripping, it *checks* the
 * strip: a package that still names its author's folders or private feeds is
 * refused, with the reason, rather than quietly cleaned up. Hearth's publish
 * path always strips before signing, so a well-behaved client never sees the
 * refusal; a client that skipped it gets told to stop, which is better than a
 * gallery that silently launders bad uploads.
 *
 * Not overwriting `meta.id` leaves one hazard the sketch was trying to solve:
 * somebody installs a board, changes it, and republishes, and their fork still
 * carries the original's id — so an importer holding the original would be
 * offered the fork as an update to it. That is closed here by making `meta.id`
 * unique **across the gallery** rather than per author: a fork's upload is
 * refused, naming the fix, and duplicating a board (which does not inherit
 * `sourceId`) mints a fresh identity for it.
 */

import { Buffer } from "node:buffer";
import {
	describeReferences,
	type HearthPackage,
	readPackage,
	residualPaths,
	verifyPackageSignature,
} from "../../src/portable/index.js";
import { asGalleryCategory } from "../../src/gallery/categories.js";
import { cardCountsFromPackage, previewFromPackage } from "../../src/gallery/preview.js";
import { config } from "./config.js";
import { unprocessable } from "./http.js";

/** Picture types a package may carry, matching the format's own allowlist.
 * SVG is not among them and must never be: it is a document that can carry
 * script, and this server serves these bytes back to clients. */
const ASSET_MIME = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/bmp",
	"image/avif",
]);

/** The format's own caps, re-checked here because they are the uploader's
 * claims until somebody else measures them. */
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ASSETS_TOTAL = 16 * 1024 * 1024;

/** Everything the listing needs, derived from the package rather than taken
 * from what the uploader said about it. */
export interface AcceptedUpload {
	pkg: HearthPackage;
	/** The bytes as uploaded. Stored and served unchanged. */
	json: string;
	sourceId: string;
	authorKey: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	version: string | null;
	pluginVersion: string | null;
	/** The theme its author recommends, by name. Advisory. */
	theme: string | null;
	preview: string | null;
	cards: string;
	requires: string;
	remoteRefs: number;
	sizeBytes: number;
	wallpaper: Buffer | null;
	wallpaperMime: string | null;
	/** The author's redacted photograph of the board, decoded. */
	snapshot: Buffer | null;
	snapshotMime: string | null;
	/** Non-empty when the strip's own backstop still sees something path-shaped.
	 * The entry is taken but held out of the listing until somebody looks. */
	holdReason: string | null;
}

/**
 * Read, verify and describe an upload, or refuse it with a reason.
 *
 * Every refusal is a 422 with a sentence the client shows verbatim, because
 * each of them is something the person publishing can actually act on.
 */
export function acceptUpload(json: unknown): AcceptedUpload {
	if (typeof json !== "string" || json.length === 0) throw unprocessable("no package");
	if (Buffer.byteLength(json) > config.maxPackageBytes) {
		throw unprocessable("package is larger than this gallery accepts");
	}

	const parsed = readPackage(json);
	if (!parsed.pkg) throw unprocessable(parsed.error ?? "not a Hearth package");
	const pkg = parsed.pkg;

	if (pkg.hearth.kind !== "dashboard") {
		throw unprocessable("a gallery entry is one dashboard, not a whole vault");
	}

	// Before anything else looks at it, and before anything is stored: a
	// signature is the only evidence there is about who wrote this file.
	const signature = verifyPackageSignature(pkg);
	if (signature === "unsigned") throw unprocessable("the package is not signed");
	if (signature !== "valid") throw unprocessable("the package's signature does not verify");
	const authorKey = pkg.meta?.authorPublicKey?.toLowerCase();
	if (!authorKey) throw unprocessable("the package names no author key");

	const sourceId = typeof pkg.meta?.id === "string" ? pkg.meta.id.trim() : "";
	if (!sourceId || sourceId.length > 64 || !/^[A-Za-z0-9._-]+$/.test(sourceId)) {
		throw unprocessable("the package has no usable dashboard id");
	}

	const name = trimTo(pkg.meta?.name, config.maxNameLength);
	if (!name) throw unprocessable("the package has no name");

	// The strip, checked rather than performed — see the module comment.
	const references = describeReferences(pkg);
	const leaked =
		references.byScope.vaultPath.length +
		references.byScope.asset.length +
		references.byScope.privateUrl.length +
		references.byScope.privateHost.length +
		references.byScope.place.length;
	if (leaked > 0) {
		throw unprocessable(
			`the package still names ${leaked} thing${leaked === 1 ? "" : "s"} from its author's vault — publish it with "leave out my private information" on`,
		);
	}

	checkAssets(pkg);

	const preview = previewFromPackage(pkg);
	const cards = cardCountsFromPackage(pkg);
	// The backstop the reference table admits it needs. Not a refusal: it is a
	// heuristic, and a false positive costs a look while a false negative
	// publishes somebody's folder tree.
	const residual = residualPaths(pkg);

	return {
		pkg,
		json,
		sourceId,
		authorKey,
		name,
		description: trimTo(pkg.meta?.description, config.maxDescriptionLength) || null,
		category: asGalleryCategory(pkg.meta?.category),
		tags: readTags(pkg.meta?.tags),
		version: trimTo(pkg.meta?.version, 32) || null,
		theme: trimTo(pkg.meta?.theme, 60) || null,
		pluginVersion: trimTo(pkg.hearth.plugin, 24) || null,
		preview: preview ? JSON.stringify(preview) : null,
		cards: JSON.stringify(cards),
		requires: JSON.stringify({
			plugins: pkg.requires?.plugins ?? [],
			cardKinds: pkg.requires?.cardKinds ?? [],
			viewTypes: pkg.requires?.viewTypes ?? [],
			settings: pkg.requires?.settings ?? [],
		}),
		// What this board will fetch from the internet once it is on somebody
		// else's screen. Shown in the listing, because it is a thing to know
		// before installing rather than after.
		remoteRefs: references.byScope.publicUrl.length,
		sizeBytes: Buffer.byteLength(json),
		...wallpaperOf(pkg),
		...snapshotOf(pkg),
		holdReason: residual.length
			? `${residual.length} value(s) still look like vault paths: ${residual.slice(0, 5).join(", ")}`
			: null,
	};
}

/**
 * Re-check every embedded picture.
 *
 * `bytes` is a number the file supplies, so the encoded length is measured
 * first — the same order `assets.ts` uses on the way in, and for the same
 * reason: a package claiming ten bytes over a hundred-megabyte payload must not
 * get that payload decoded before anything checks.
 */
function checkAssets(pkg: HearthPackage): void {
	const assets = pkg.assets ?? [];
	let total = 0;
	for (const asset of assets) {
		if (!ASSET_MIME.has(asset.mime)) {
			throw unprocessable(`a picture in the package is a ${asset.mime}, which is not carried`);
		}
		// base64 is 4 characters per 3 bytes; this bounds the decoded size
		// without decoding anything.
		const encoded = asset.data?.length ?? 0;
		const decoded = Math.floor((encoded * 3) / 4);
		if (decoded > MAX_ASSET_BYTES) throw unprocessable("a picture in the package is too large");
		total += decoded;
		if (total > MAX_ASSETS_TOTAL) throw unprocessable("the package's pictures are too large");
	}
}

/**
 * The board's own wallpaper, decoded, so a listing can show the real picture
 * without pulling the whole package down for every row.
 *
 * Only the asset the board actually points its background at — the other
 * embedded pictures belong to cards and are not what a thumbnail is of.
 */
function wallpaperOf(pkg: HearthPackage): {
	wallpaper: Buffer | null;
	wallpaperMime: string | null;
} {
	const payload = pkg.payload as { dashboard?: { background?: { value?: unknown } } } | undefined;
	const value = payload?.dashboard?.background?.value;
	if (typeof value !== "string" || !value.startsWith("hearth:asset/")) {
		return { wallpaper: null, wallpaperMime: null };
	}
	const id = value.slice("hearth:asset/".length);
	const asset = pkg.assets?.find((a) => a.id === id);
	if (!asset || !ASSET_MIME.has(asset.mime)) return { wallpaper: null, wallpaperMime: null };
	const bytes = Buffer.from(asset.data, "base64");
	if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
		return { wallpaper: null, wallpaperMime: null };
	}
	return { wallpaper: bytes, wallpaperMime: asset.mime };
}

/** Widest a stored snapshot may be, in bytes. The client writes ~900px JPEGs at
 * quality 70, which land well under this; the cap is here because `meta` is
 * passed through `readPackage` as a bag and this is the one field in it that is
 * measured in kilobytes rather than characters. */
const MAX_SNAPSHOT_BYTES = 1024 * 1024;

/** The raster types a screenshot may be written as. Never SVG, for the reason
 * no picture in this pipeline is ever SVG: it is a document that can carry
 * script, and this one is served back to clients. */
const SNAPSHOT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * The author's own picture of the board.
 *
 * Taken as given, because it is theirs and the signature covers it — but
 * measured rather than believed: the decoded length is checked against the cap
 * before the base64 is decoded, the same order every other picture in this
 * pipeline is checked in.
 */
function snapshotOf(pkg: HearthPackage): {
	snapshot: Buffer | null;
	snapshotMime: string | null;
} {
	const shot = pkg.meta?.snapshot;
	if (!shot || typeof shot !== "object") return { snapshot: null, snapshotMime: null };
	if (typeof shot.mime !== "string" || !SNAPSHOT_MIME.has(shot.mime)) {
		return { snapshot: null, snapshotMime: null };
	}
	if (typeof shot.data !== "string") return { snapshot: null, snapshotMime: null };
	const decoded = Math.floor((shot.data.length * 3) / 4);
	// An empty one is a malformed field, like every other shape this function
	// declines: ignored, so the board publishes without a picture. Only an
	// oversized one is refused, because that is a claim on the server rather
	// than a missing value.
	if (decoded === 0) return { snapshot: null, snapshotMime: null };
	if (decoded > MAX_SNAPSHOT_BYTES) {
		throw unprocessable("the picture of the board is too large");
	}
	const bytes = Buffer.from(shot.data, "base64");
	if (bytes.length === 0) return { snapshot: null, snapshotMime: null };
	return { snapshot: bytes, snapshotMime: shot.mime };
}

function trimTo(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	const trimmed = value.trim();
	return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function readTags(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const tag of raw) {
		const value = trimTo(tag, 32).toLowerCase();
		if (value && !out.includes(value)) out.push(value);
		if (out.length >= config.maxTags) break;
	}
	return out;
}
