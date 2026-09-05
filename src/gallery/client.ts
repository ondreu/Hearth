/**
 * Talking to a gallery server.
 *
 * One class, one host, and a hard line about what crosses it: Hearth sends a
 * package, a vote and a signature over a nonce. It never sends the recovery
 * key, and there is no code path here that could — `signMessage` takes the key
 * and returns a signature, and only the signature is ever put in a body. That
 * is the constraint `docs/dashboard-package.md` asks a gallery to honour, and
 * it is honoured on this side by not having the wire to send it down.
 *
 * Requests go through Obsidian's `requestUrl` rather than `fetch`, for the same
 * reason the RSS and weather cards do: it is not subject to the renderer's CORS
 * rules, so a self-hosted gallery does not have to grow an `Access-Control-*`
 * policy for a client that isn't a browser page. It also means a request cannot
 * be made to carry the vault's cookies, because there aren't any.
 *
 * Everything that comes back is read through `types.ts`. Nothing in this file
 * hands a raw response to a caller.
 */

import { requestUrl, type RequestUrlResponse } from "obsidian";
import { signMessage } from "../identity";
import {
	type GalleryComment,
	type GalleryCommentPage,
	type GalleryEntryDetail,
	type GalleryInfo,
	type GalleryListing,
	type GalleryProfile,
	type GallerySort,
	type VoteValue,
	num,
	readComment,
	readCommentPage,
	readEntryDetail,
	readEntrySummary,
	readInfo,
	readListing,
	readProfile,
} from "./types";

/** How long a request is given before it is treated as a host that isn't
 * there. Obsidian's `requestUrl` has no timeout of its own. */
const TIMEOUT_MS = 20_000;

/** A downloaded package is applied by the importer, which has its own caps; this
 * is the earlier line, so a host cannot make Hearth hold an arbitrary string in
 * memory before anything has looked at it. */
export const MAX_DOWNLOAD_BYTES = 24 * 1024 * 1024;

/** What went wrong, in the terms the UI needs to say something useful. */
export type GalleryErrorCode =
	/** No host configured. */
	| "noHost"
	/** The host isn't reachable, or didn't answer in time. */
	| "offline"
	/** The host answered, but not with a gallery API. */
	| "badResponse"
	/** The reader isn't signed in, or their token has expired. */
	| "unauthorized"
	/**
	 * Signed in, but not allowed to do that — publishing over somebody else's
	 * dashboard id, withdrawing an entry that isn't yours.
	 *
	 * Kept apart from {@link unauthorized} because the two need opposite
	 * handling: a 401 means the token is no good and should be dropped, while a
	 * 403 means the token is fine and the *request* was wrong — and the server's
	 * own sentence is the useful part, since the commonest 403 is "that
	 * dashboard id belongs to another author, duplicate the board first", which
	 * is the ordinary end of install → change → publish.
	 */
	| "forbidden"
	/** The host is rate-limiting this key or this address. */
	| "rateLimited"
	/** The host refused the upload: too large, or over a quota. */
	| "tooLarge"
	/** The host refused the content — a failed signature, a residual hold, a
	 * category it doesn't know. `message` carries its reason. */
	| "rejected"
	/** Nothing there. */
	| "notFound"
	/** Anything else the host said. */
	| "server";

export class GalleryError extends Error {
	readonly code: GalleryErrorCode;
	/** The host's own explanation, when it gave one. Displayed as text. */
	readonly detail?: string;
	readonly status?: number;

	constructor(code: GalleryErrorCode, detail?: string, status?: number) {
		super(detail ? `${code}: ${detail}` : code);
		this.name = "GalleryError";
		this.code = code;
		this.detail = detail;
		this.status = status;
	}
}

/** What a listing request asks for. */
export interface ListQuery {
	q?: string;
	category?: string;
	sort?: GallerySort;
	page?: number;
	perPage?: number;
	/** An author's public key, to list only their boards. */
	author?: string;
}

/** A signed-in session: a bearer token and when it stops working. */
interface Session {
	token: string;
	expiresAt: number;
	publicKey: string;
}

/**
 * The gallery Hearth points at out of the box.
 *
 * A default host means every install talks to it — so the setting stays a
 * setting: clearing the address in settings turns the gallery off entirely, and
 * a vault that has cleared it keeps it cleared across upgrades (see the
 * `galleryUrl` migration in `src/types.ts`, which is the half of this that makes
 * "off" stick).
 *
 * Nothing is fetched before somebody opens the gallery. The buttons are drawn
 * because a host is configured; no listing, no thumbnail and no request happens
 * until one of them is clicked.
 *
 * It lives beside {@link normalizeGalleryUrl} rather than in `index.ts` because
 * `src/types.ts` needs both to seed and sanitize the setting, and this module —
 * unlike the barrel — has no path back to the plugin object.
 */
export const DEFAULT_GALLERY_URL = "https://gallery.o-uhnavy.com";

/**
 * Normalise and vet a host.
 *
 * `https` everywhere except a loopback host, which is allowed plain so that
 * running the server from `docker compose up` and pointing Hearth at
 * `http://localhost:8787` works without a certificate. Anything else — a
 * `file:`, an `http:` host on the network, a URL with credentials in it — is
 * not a gallery Hearth will talk to.
 */
export function normalizeGalleryUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	const loopback =
		url.hostname === "localhost" ||
		url.hostname === "127.0.0.1" ||
		url.hostname === "[::1]" ||
		url.hostname === "::1";
	if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
	if (url.username || url.password) return null;
	// Keep any path prefix — a gallery may live under /gallery on a shared host
	// — but drop a trailing slash so joining is one rule everywhere below.
	const path = url.pathname.replace(/\/+$/, "");
	return `${url.origin}${path}`;
}

export class GalleryClient {
	private readonly base: string;
	private session: Session | null = null;
	private info: GalleryInfo | null = null;

	constructor(baseUrl: string) {
		const normalized = normalizeGalleryUrl(baseUrl);
		if (!normalized) throw new GalleryError("noHost", baseUrl);
		this.base = normalized;
	}

	/** The host this client talks to, normalised. */
	get host(): string {
		return this.base;
	}

	/** Whether there is a usable token in hand. */
	get signedIn(): boolean {
		return this.session !== null && this.session.expiresAt > Date.now();
	}

	/** Forget the token. Called when the vault's identity changes underneath
	 * the client, and when a request comes back unauthorized. */
	signOut(): void {
		this.session = null;
	}

	// ---- Reading --------------------------------------------------------

	/** What the host is and what it will accept. Fetched once per client. */
	async describe(): Promise<GalleryInfo> {
		if (this.info) return this.info;
		const info = readInfo(await this.get("/v1/info"));
		if (info.api !== 1) {
			throw new GalleryError("badResponse", info.api ? `api ${info.api}` : undefined);
		}
		this.info = info;
		return info;
	}

	async list(query: ListQuery = {}): Promise<GalleryListing> {
		const params = new URLSearchParams();
		if (query.q) params.set("q", query.q.slice(0, 120));
		if (query.category) params.set("category", query.category);
		if (query.sort) params.set("sort", query.sort);
		if (query.author) params.set("author", query.author);
		params.set("page", String(num(query.page, 1, 10000, 1)));
		params.set("perPage", String(num(query.perPage, 1, 60, 24)));
		return readListing(await this.get(`/v1/entries?${params.toString()}`));
	}

	async entry(id: string): Promise<GalleryEntryDetail> {
		const detail = readEntryDetail(await this.get(`/v1/entries/${encodeURIComponent(id)}`));
		if (!detail) throw new GalleryError("badResponse");
		return detail;
	}

	async profile(publicKey: string): Promise<GalleryProfile> {
		const profile = readProfile(
			await this.get(`/v1/authors/${encodeURIComponent(publicKey)}`),
		);
		if (!profile) throw new GalleryError("badResponse");
		return profile;
	}

	/**
	 * The package itself, as text, ready for `readPackage`.
	 *
	 * Returned as a string rather than parsed here: the importer's own reader is
	 * the one that decides whether a file is a package, and giving it the bytes
	 * means a downloaded board and one picked off disk go through exactly the
	 * same path — including the signature check, which has to run against what
	 * was actually served.
	 */
	async download(id: string): Promise<string> {
		const res = await this.request("GET", `/v1/entries/${encodeURIComponent(id)}/package`);
		const body = res.text ?? "";
		if (body.length > MAX_DOWNLOAD_BYTES) throw new GalleryError("tooLarge");
		return body;
	}

	/** Where the real wallpaper lives, for an entry that carries one. A URL
	 * rather than bytes: it goes straight into an `img.src`, which is how Hearth
	 * renders every other picture.
	 *
	 * `version` should be the entry's `updatedAt`. See {@link pictureVersion}:
	 * without it a republished board keeps showing the picture it had, because
	 * the address of the picture never changed. */
	wallpaperUrl(id: string, version?: string): string {
		return `${this.base}/v1/entries/${encodeURIComponent(id)}/wallpaper${pictureVersion(version)}`;
	}

	/** The author's redacted photograph of the board, for an entry that has one.
	 * Same shape and same reasoning as {@link wallpaperUrl}. */
	snapshotUrl(id: string, version?: string): string {
		return `${this.base}/v1/entries/${encodeURIComponent(id)}/snapshot${pictureVersion(version)}`;
	}

	// ---- Signing in -----------------------------------------------------

	/**
	 * Prove this vault holds the key behind its handle, and get a token.
	 *
	 * Challenge–response, exactly as `docs/dashboard-package.md` sets out: the
	 * host names a nonce, Hearth signs it, the host checks the signature against
	 * the public key. No password exists to be stolen and no account has to be
	 * created — a profile comes into being the first time a key publishes.
	 */
	async signIn(recoveryKey: string, publicKey: string): Promise<void> {
		if (this.signedIn && this.session?.publicKey === publicKey) return;
		const challenge = (await this.post("/v1/auth/challenge", { publicKey })) as {
			nonce?: unknown;
		};
		const nonce = typeof challenge?.nonce === "string" ? challenge.nonce : "";
		if (!nonce) throw new GalleryError("badResponse");
		const signature = signMessage(recoveryKey, nonce);
		if (!signature) throw new GalleryError("unauthorized", "unusable key");
		const granted = (await this.post("/v1/auth/token", {
			publicKey,
			nonce,
			signature,
		})) as { token?: unknown; expiresIn?: unknown };
		const token = typeof granted?.token === "string" ? granted.token : "";
		if (!token) throw new GalleryError("badResponse");
		this.session = {
			token,
			publicKey,
			// A minute short, so a token doesn't expire between the check and the
			// request it was checked for.
			expiresAt: Date.now() + num(granted.expiresIn, 60, 86_400 * 30, 3600) * 1000 - 60_000,
		};
	}

	// ---- Writing --------------------------------------------------------

	/**
	 * Publish a package.
	 *
	 * The package goes up as it stands — already stripped, already signed —
	 * because the signature covers the bytes and anything this client did to
	 * them on the way would invalidate it. The server derives the listing from
	 * the file rather than from anything said alongside it: the name, the
	 * category, the preview and the card list all come out of `meta` and the
	 * payload, so an entry cannot advertise a board it isn't.
	 */
	async publish(json: string): Promise<{ id: string; updated: boolean; held: boolean }> {
		const res = (await this.post("/v1/entries", { package: json }, true)) as {
			id?: unknown;
			updated?: unknown;
			held?: unknown;
		};
		const id = typeof res?.id === "string" ? res.id : "";
		if (!id) throw new GalleryError("badResponse");
		// A held entry was taken but is not in the listing until somebody has
		// looked at it. Saying "published" about one would be a lie the author
		// only discovers by going to look for it.
		return { id, updated: res.updated === true, held: res.held === true };
	}

	/** Withdraw one of the reader's own entries. */
	async unpublish(id: string): Promise<void> {
		await this.request("DELETE", `/v1/entries/${encodeURIComponent(id)}`, undefined, true);
	}

	/** Cast, change or clear a vote. Returns the entry's new tallies. */
	async vote(id: string, value: VoteValue): Promise<{
		score: number;
		upvotes: number;
		downvotes: number;
		myVote: VoteValue;
	}> {
		const res = (await this.post(
			`/v1/entries/${encodeURIComponent(id)}/vote`,
			{ value },
			true,
		)) as Record<string, unknown>;
		const entry = readEntrySummary({ id, name: "x", ...res });
		if (!entry) throw new GalleryError("badResponse");
		return {
			score: entry.score,
			upvotes: entry.upvotes,
			downvotes: entry.downvotes,
			myVote: entry.myVote,
		};
	}

	/** One page of an entry's comments, newest first. No token needed — a
	 * gallery is readable by anyone. */
	async comments(id: string, page = 1): Promise<GalleryCommentPage> {
		const params = new URLSearchParams({ page: String(num(page, 1, 10000, 1)) });
		return readCommentPage(
			await this.get(`/v1/entries/${encodeURIComponent(id)}/comments?${params.toString()}`),
		);
	}

	/** Leave a remark. Returns it as stored, since the server trims and bounds
	 * what it took. */
	async comment(id: string, body: string): Promise<GalleryComment> {
		const posted = readComment(
			await this.post(`/v1/entries/${encodeURIComponent(id)}/comments`, { body }, true),
		);
		if (!posted) throw new GalleryError("badResponse");
		return posted;
	}

	/** Remove one. The server allows it for the comment's author and for the
	 * owner of the entry it sits on. */
	async deleteComment(commentId: string): Promise<void> {
		await this.request("DELETE", `/v1/comments/${encodeURIComponent(commentId)}`, undefined, true);
	}

	// ---- Plumbing -------------------------------------------------------

	private async get(path: string): Promise<unknown> {
		return this.json(await this.request("GET", path));
	}

	private async post(path: string, body: unknown, auth = false): Promise<unknown> {
		return this.json(await this.request("POST", path, body, auth));
	}

	private json(res: RequestUrlResponse): unknown {
		try {
			return JSON.parse(res.text ?? "null");
		} catch {
			throw new GalleryError("badResponse", undefined, res.status);
		}
	}

	private async request(
		method: string,
		path: string,
		body?: unknown,
		auth = false,
	): Promise<RequestUrlResponse> {
		if (auth && !this.signedIn) throw new GalleryError("unauthorized");
		const headers: Record<string, string> = { Accept: "application/json" };
		if (body !== undefined) headers["Content-Type"] = "application/json";
		if (auth && this.session) headers.Authorization = `Bearer ${this.session.token}`;

		let res: RequestUrlResponse;
		try {
			res = await withTimeout(
				requestUrl({
					url: `${this.base}${path}`,
					method,
					headers,
					body: body === undefined ? undefined : JSON.stringify(body),
					// Errors are read rather than thrown, so a 429 can be told from
					// a host that isn't answering at all.
					throw: false,
				}),
			);
		} catch {
			throw new GalleryError("offline");
		}
		if (res.status >= 200 && res.status < 300) return res;
		throw this.errorFor(res);
	}

	/** Map a status onto something the UI can phrase, keeping the host's own
	 * message when it sent one. */
	private errorFor(res: RequestUrlResponse): GalleryError {
		let detail: string | undefined;
		try {
			const parsed = JSON.parse(res.text ?? "null") as { error?: unknown; message?: unknown };
			const said = typeof parsed?.message === "string" ? parsed.message : parsed?.error;
			if (typeof said === "string" && said.trim()) detail = said.trim().slice(0, 300);
		} catch {
			/* a host that answers an error with HTML has said nothing useful */
		}
		if (res.status === 401) {
			this.signOut();
			return new GalleryError("unauthorized", detail, res.status);
		}
		// Not a bad token — a request the holder of a good one may not make. The
		// session stays.
		if (res.status === 403) return new GalleryError("forbidden", detail, res.status);
		if (res.status === 404) return new GalleryError("notFound", detail, res.status);
		if (res.status === 413) return new GalleryError("tooLarge", detail, res.status);
		if (res.status === 422) return new GalleryError("rejected", detail, res.status);
		if (res.status === 429) return new GalleryError("rateLimited", detail, res.status);
		return new GalleryError("server", detail, res.status);
	}
}

/** `requestUrl` never gives up on its own; a host that accepts a connection and
 * then says nothing would otherwise leave the modal spinning forever. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = window.setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
		promise.then(
			(value) => {
				window.clearTimeout(timer);
				resolve(value);
			},
			(err: unknown) => {
				window.clearTimeout(timer);
				reject(err instanceof Error ? err : new Error(String(err)));
			},
		);
	});
}

/**
 * The `?v=` a picture's address carries, so a republished board shows its new
 * picture.
 *
 * A snapshot and a wallpaper live at an address made only of the entry's id,
 * and they are fetched by an `img.src` rather than through `request` — so they
 * go through the browser's cache, and the host serves them with a long
 * `max-age` because for a given version of an entry they really are immutable.
 * Publishing again replaces the bytes behind an address that did not change,
 * and every client that had already looked keeps drawing yesterday's picture
 * until its cache lets go. Stamping the entry's `updatedAt` into the query
 * makes a new version a new address, which is the only part of this the client
 * can decide on its own.
 *
 * Hashed rather than passed through: a timestamp is a short opaque token here,
 * and one that survives being put in a URL by construction.
 */
function pictureVersion(version?: string): string {
	if (!version) return "";
	let hash = 0;
	for (let i = 0; i < version.length; i++) hash = (hash * 31 + version.charCodeAt(i)) | 0;
	return `?v=${(hash >>> 0).toString(36)}`;
}
