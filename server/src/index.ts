/**
 * The gallery server: eleven routes over a SQLite file.
 *
 * Start here. What it is, in one paragraph: a catalogue of Hearth dashboard
 * packages that anybody can browse, that a holder of a signing key can publish
 * to and vote in, and that stores each package exactly as it was uploaded so
 * the author's signature still verifies in the vault that installs it.
 *
 * Three properties are worth knowing before reading the rest:
 *
 * - **It reuses the plugin's own package engine.** `readPackage`,
 *   `verifyPackageSignature`, `describeReferences` and `previewFromPackage` are
 *   imported from `src/`, not reimplemented — a gallery that decides for itself
 *   what a package is will disagree with the plugin exactly where it matters.
 *   `server/esbuild.config.mjs` explains how that import works.
 * - **It never edits an uploaded package.** See the long note at the top of
 *   `upload.ts`; it is the one place this server departs from the pipeline
 *   sketched in `docs/dashboard-package.md`, and the reason is that the
 *   sketched version would invalidate every signature it had just checked.
 * - **It has no accounts.** An identity is an ed25519 key in somebody's vault
 *   and signing in is a challenge-response against it (`auth.ts`), so there is
 *   no password to store and nothing to leak but public keys.
 *
 * `docs/gallery-api.md` is the wire contract; `docs/gallery-hosting.md` is how
 * to run it.
 */

import { createServer } from "node:http";
import { GALLERY_CATEGORIES } from "../../src/gallery/categories.js";
import { currentKey, issueChallenge, redeemChallenge, requireKey } from "./auth.js";
import { config } from "./config.js";
import { openDatabase, sweepExpired } from "./db.js";
import {
	authorProfile,
	downloadEntry,
	entryDetail,
	entrySnapshot,
	entryWallpaper,
	listEntries,
	publishEntry,
	withdrawEntry,
} from "./entries.js";
import {
	badRequest,
	createRouter,
	noContent,
	RawResponse,
	readJson,
	route,
	type RequestContext,
} from "./http.js";
import { consume, DAY, MINUTE } from "./ratelimit.js";
import { acceptUpload } from "./upload.js";
import { castVote } from "./votes.js";
import { deleteComment, listComments, postComment } from "./comments.js";

const db = openDatabase(config.dbPath);

/** Read limits are per address and generous: browsing is the thing this server
 * is for, and a limit that bites a person scrolling is a bug. */
function limitRead(ctx: RequestContext): void {
	consume(db, `read:${ctx.ip}`, config.readsPerMinute, MINUTE);
}

/** Writes are per address too, before any per-key limit — a limit that only
 * counts keys is a limit anybody gets around by minting one. */
function limitWrite(ctx: RequestContext): void {
	consume(db, `write:${ctx.ip}`, config.writesPerMinute, MINUTE);
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
	// An absent parameter is not a zero. `searchParams.get` returns null for one
	// and `Number(null)` is 0, which is finite — so without this check a missing
	// `perPage` clamped to the minimum and every listing came back one row long.
	const raw = url.searchParams.get(name);
	if (raw === null || raw.trim() === "") return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

const routes = [
	// ---- Public ------------------------------------------------------
	route("GET", "/v1/info", () => ({
		name: config.name,
		api: 1,
		limits: {
			maxPackageBytes: config.maxPackageBytes,
			maxNameLength: config.maxNameLength,
			maxDescriptionLength: config.maxDescriptionLength,
			maxTags: config.maxTags,
			uploadsPerDay: config.uploadsPerDay,
		},
		termsUrl: config.termsUrl || undefined,
	})),

	// The taxonomy this host actually files boards under, with counts. Served
	// rather than assumed so a client a version behind still draws a rail that
	// matches what it can filter by.
	route("GET", "/v1/categories", (ctx) => {
		limitRead(ctx);
		const rows = db
			.prepare(
				"SELECT category, COUNT(*) AS n FROM entries WHERE status = 'live' GROUP BY category",
			)
			.all() as unknown as { category: string; n: number }[];
		const counts = new Map(rows.map((row) => [row.category, Number(row.n)]));
		return GALLERY_CATEGORIES.map((id) => ({ id, count: counts.get(id) ?? 0 }));
	}),

	route("GET", "/v1/entries", (ctx) => {
		limitRead(ctx);
		return listEntries(db, {
			q: ctx.url.searchParams.get("q") ?? undefined,
			category: ctx.url.searchParams.get("category") ?? undefined,
			sort: ctx.url.searchParams.get("sort") ?? undefined,
			author: ctx.url.searchParams.get("author")?.toLowerCase() ?? undefined,
			page: intParam(ctx.url, "page", 1, 1, 10_000),
			perPage: intParam(ctx.url, "perPage", 24, 1, 60),
			viewer: currentKey(db, ctx),
		});
	}),

	route("GET", "/v1/entries/:id", (ctx) => {
		limitRead(ctx);
		return entryDetail(db, ctx.params[0], currentKey(db, ctx));
	}),

	route("GET", "/v1/entries/:id/package", (ctx) => {
		limitRead(ctx);
		return new RawResponse(
			downloadEntry(db, ctx.params[0], ctx.ip),
			"application/json; charset=utf-8",
		);
	}),

	route("GET", "/v1/entries/:id/wallpaper", (ctx) => {
		limitRead(ctx);
		const { bytes, mime } = entryWallpaper(db, ctx.params[0]);
		// A raster type from the format's own allowlist, and never SVG — this
		// is a picture a client puts in an `img.src`, and the one image type
		// that is really a document has no business being one.
		return new RawResponse(bytes, mime, { "Cache-Control": "public, max-age=86400" });
	}),

	route("GET", "/v1/entries/:id/snapshot", (ctx) => {
		limitRead(ctx);
		const { bytes, mime } = entrySnapshot(db, ctx.params[0]);
		return new RawResponse(bytes, mime, { "Cache-Control": "public, max-age=86400" });
	}),

	route("GET", "/v1/authors/:key", (ctx) => {
		limitRead(ctx);
		return authorProfile(db, ctx.params[0].toLowerCase(), currentKey(db, ctx));
	}),

	// ---- Signing in --------------------------------------------------
	route("POST", "/v1/auth/challenge", async (ctx) => {
		limitWrite(ctx);
		const body = (await readJson(ctx.req, 4096)) as { publicKey?: unknown };
		if (typeof body?.publicKey !== "string") throw badRequest("publicKey required");
		return issueChallenge(db, body.publicKey);
	}),

	route("POST", "/v1/auth/token", async (ctx) => {
		limitWrite(ctx);
		const body = (await readJson(ctx.req, 4096)) as {
			publicKey?: unknown;
			nonce?: unknown;
			signature?: unknown;
		};
		return redeemChallenge(
			db,
			String(body?.publicKey ?? ""),
			String(body?.nonce ?? ""),
			String(body?.signature ?? ""),
		);
	}),

	// ---- Publishing --------------------------------------------------
	route("POST", "/v1/entries", async (ctx) => {
		limitWrite(ctx);
		const key = requireKey(db, ctx);
		// The cap is applied while the body is read, not after — see `readJson`.
		const body = (await readJson(ctx.req, config.maxPackageBytes + 4096)) as {
			package?: unknown;
		};
		const upload = acceptUpload(body?.package);
		const result = publishEntry(db, upload, key);
		// Counted *after* the publish succeeds. A daily quota is a quota on
		// published dashboards, and spending it on refusals means an author who
		// hits the "duplicate the board first" 403 ten times has used up their
		// day without publishing anything. The flood case is already covered:
		// `limitWrite` above is per address and runs first.
		consume(db, `upload:${key}`, config.uploadsPerDay, DAY);
		return result;
	}),

	route("DELETE", "/v1/entries/:id", (ctx) => {
		limitWrite(ctx);
		withdrawEntry(db, ctx.params[0], requireKey(db, ctx));
		return noContent;
	}),

	// ---- Comments ----------------------------------------------------
	route("GET", "/v1/entries/:id/comments", (ctx) => {
		limitRead(ctx);
		return listComments(db, ctx.params[0], intParam(ctx.url, "page", 1, 1, 10_000));
	}),

	route("POST", "/v1/entries/:id/comments", async (ctx) => {
		limitWrite(ctx);
		const key = requireKey(db, ctx);
		// A comment is a paragraph; the cap here is the outer bound on the
		// request, and `postComment` holds the text itself to its own.
		const body = (await readJson(ctx.req, 16 * 1024)) as { body?: unknown };
		const posted = postComment(db, ctx.params[0], key, body?.body);
		// After, like the upload above: a rejected empty comment is not one of
		// somebody's sixty for the day.
		consume(db, `comment:${key}`, config.commentsPerDay, DAY);
		consume(db, `comment-ip:${ctx.ip}`, config.commentsPerIpPerDay, DAY);
		return posted;
	}),

	route("DELETE", "/v1/comments/:id", (ctx) => {
		limitWrite(ctx);
		deleteComment(db, ctx.params[0], requireKey(db, ctx));
		return noContent;
	}),

	// ---- Voting ------------------------------------------------------
	route("POST", "/v1/entries/:id/vote", async (ctx) => {
		limitWrite(ctx);
		const key = requireKey(db, ctx);
		const body = (await readJson(ctx.req, 1024)) as { value?: unknown };
		const tallies = castVote(db, ctx.params[0], key, Number(body?.value ?? 0));
		consume(db, `vote:${key}`, config.votesPerDay, DAY);
		consume(db, `vote-ip:${ctx.ip}`, config.votesPerIpPerDay, DAY);
		return tallies;
	}),
];

const server = createServer(createRouter(routes));

// Nonces, tokens and yesterday's download marks are bookkeeping — every reader
// of them checks expiry itself, so this is housekeeping rather than
// correctness, and once an hour is plenty.
const sweeper = setInterval(() => sweepExpired(db), 3600_000);
sweeper.unref();
sweepExpired(db);

server.listen(config.port, config.host, () => {
	console.log(`[gallery] ${config.name} listening on ${config.host}:${config.port}`);
	console.log(`[gallery] database: ${config.dbPath}`);
	if (!config.trustProxy) {
		console.log("[gallery] TRUST_PROXY is off; per-address limits use the socket address");
	}
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
	process.on(signal, () => {
		server.close(() => {
			db.close();
			process.exit(0);
		});
	});
}
