/**
 * A very small HTTP layer: a router, JSON in and out, and the two limits that
 * have to be enforced before anything else looks at a request.
 *
 * No framework, because the whole server is eleven routes and a framework would
 * be the only thing in here that needed installing. What it does have is the
 * parts a framework would otherwise be relied on for and that are easy to get
 * wrong:
 *
 * - **A body cap enforced while reading**, not after. Checking
 *   `Content-Length` alone trusts a number the client supplied; the bytes are
 *   counted as they arrive and the socket is destroyed the moment they exceed
 *   the cap, so a hostile upload cannot be held in memory first.
 * - **An error shape that never leaks a stack.** A thrown `HttpError` becomes
 *   its own status and message; anything else becomes a 500 saying nothing,
 *   with the detail going to the log where it belongs.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config.js";

/** An error with a status. Anything thrown that isn't one of these is a bug,
 * and is reported as a bare 500. */
export class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "HttpError";
		this.status = status;
	}
}

export const badRequest = (m: string): HttpError => new HttpError(400, m);
export const unauthorized = (m = "not signed in"): HttpError => new HttpError(401, m);
export const forbidden = (m = "not yours"): HttpError => new HttpError(403, m);
export const notFound = (m = "not found"): HttpError => new HttpError(404, m);
export const tooLarge = (m = "too large"): HttpError => new HttpError(413, m);
/** 422 is the gallery refusing the *content* — a bad signature, a package that
 * still names somebody's folders. The client phrases these to the reader. */
export const unprocessable = (m: string): HttpError => new HttpError(422, m);
export const rateLimited = (m = "slow down"): HttpError => new HttpError(429, m);

export interface RequestContext {
	req: IncomingMessage;
	res: ServerResponse;
	url: URL;
	/** Path segments after `/v1/`, already percent-decoded. */
	params: string[];
	/** The caller's address, for the per-address limits. See `clientIp`. */
	ip: string;
}

export type Handler = (ctx: RequestContext) => unknown;

/** `METHOD /v1/path/:x` → handler. `:x` matches one segment. */
export interface Route {
	method: string;
	pattern: string[];
	handler: Handler;
}

export function route(method: string, path: string, handler: Handler): Route {
	return { method, pattern: path.split("/").filter(Boolean), handler };
}

function match(route: Route, method: string, segments: string[]): string[] | null {
	if (route.method !== method) return null;
	if (route.pattern.length !== segments.length) return null;
	const params: string[] = [];
	for (let i = 0; i < route.pattern.length; i++) {
		const part = route.pattern[i];
		if (part.startsWith(":")) params.push(segments[i]);
		else if (part !== segments[i]) return null;
	}
	return params;
}

/**
 * The caller's address.
 *
 * `X-Forwarded-For` is read **only** when `TRUST_PROXY=1`, because the header
 * is set by whoever is talking to the socket. Believing it on a directly
 * exposed server turns every per-address limit into a per-string limit, which
 * is no limit at all.
 */
export function clientIp(req: IncomingMessage): string {
	if (config.trustProxy) {
		const forwarded = req.headers["x-forwarded-for"];
		const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
		const value = first?.split(",")[0]?.trim();
		if (value) return value;
	}
	return req.socket.remoteAddress ?? "unknown";
}

/** Read a JSON body, refusing to hold more than `limit` bytes of it. */
export async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
	const declared = Number(req.headers["content-length"] ?? 0);
	if (Number.isFinite(declared) && declared > limit) throw tooLarge();

	const chunks: Buffer[] = [];
	let size = 0;
	await new Promise<void>((resolve, reject) => {
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			// Counted as it arrives: `Content-Length` is a claim, this is the
			// only figure about a body that cannot lie.
			if (size > limit) {
				req.destroy();
				reject(tooLarge());
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve());
		req.on("error", (err) => reject(err));
	});
	if (size === 0) return undefined;
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw badRequest("body is not JSON");
	}
}

/** What a handler returns when it is sending something other than JSON. */
export class RawResponse {
	constructor(
		readonly body: Buffer | string,
		readonly contentType: string,
		readonly headers: Record<string, string> = {},
	) {}
}

/** Nothing to say, and a status that says so. */
export const noContent = Symbol("noContent");

export function createRouter(routes: Route[]): (req: IncomingMessage, res: ServerResponse) => void {
	return (req, res) => {
		void handle(routes, req, res);
	};
}

async function handle(
	routes: Route[],
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	// Every response, whatever it is: this API is consumed by a plugin, never
	// by a page, so nothing here should ever be framed, sniffed or cached into
	// somebody's browser.
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("Referrer-Policy", "no-referrer");
	// No `Access-Control-Allow-Origin`. Hearth talks to this through Obsidian's
	// `requestUrl`, which is not subject to CORS, and a gallery that opened
	// itself to any web page would be one a page could vote from with the
	// reader's token.
	try {
		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
		// `decodeURIComponent` throws on a malformed escape (`%E0%A4%A`), and an
		// unhandled throw here would be a 500 with a stack in the log for what is
		// simply a path that names nothing.
		let segments: string[];
		try {
			segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
		} catch {
			send(res, notFound());
			return;
		}
		for (const candidate of routes) {
			const params = match(candidate, req.method ?? "GET", segments);
			if (!params) continue;
			const result = await candidate.handler({
				req,
				res,
				url,
				params,
				ip: clientIp(req),
			});
			send(res, result);
			return;
		}
		send(res, notFound());
	} catch (err) {
		send(res, err);
	}
}

function send(res: ServerResponse, result: unknown): void {
	if (res.writableEnded) return;
	if (result instanceof HttpError) {
		writeJson(res, result.status, { error: result.message });
		return;
	}
	if (result instanceof Error) {
		// A bug, not a refusal. The caller gets nothing; the operator gets the
		// stack, which is the only place it belongs.
		console.error("[gallery] unhandled", result);
		writeJson(res, 500, { error: "server error" });
		return;
	}
	if (result === noContent) {
		res.writeHead(204).end();
		return;
	}
	if (result instanceof RawResponse) {
		res.writeHead(200, {
			"Content-Type": result.contentType,
			"Content-Length": Buffer.byteLength(result.body),
			...result.headers,
		});
		res.end(result.body);
		return;
	}
	writeJson(res, 200, result);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
	const text = JSON.stringify(body ?? null);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(text),
	});
	res.end(text);
}
