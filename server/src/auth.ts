/**
 * Who is calling, proved rather than claimed.
 *
 * There are no accounts and no passwords. An identity is an ed25519 key pair
 * that lives in somebody's vault, and signing in is the obvious thing to do
 * with one: the server names a nonce, the client signs it, the server checks
 * the signature against the public key. What the server stores is a public key,
 * so a breach of this database leaks keys that were already public.
 *
 * Two consequences worth being explicit about, because they shape everything
 * above this file:
 *
 * - **A profile exists before anybody signs up.** A public key becomes an
 *   author the first time it publishes; there is no registration step to build,
 *   and no way to reserve a handle you don't hold the key for.
 * - **Keys are free to mint, so identities are free to mint.** Nothing in this
 *   scheme is Sybil-resistant and nothing added to it here would be. That is
 *   priced in `ratelimit.ts` and in the vote-age dial, not pretended away.
 *
 * The verification itself is the plugin's own `verifyMessage`, imported rather
 * than reimplemented — a server that checks signatures its own way is a server
 * that will one day disagree with the client about a valid one.
 */

import { randomBytes } from "node:crypto";
import { handleFromPublicKey, isPublicKey, verifyMessage } from "../../src/identity.js";
import { config } from "./config.js";
import type { Db } from "./db.js";
import { badRequest, unauthorized, type RequestContext } from "./http.js";

/** A random opaque token. 32 bytes is well past anything guessable. */
function secret(): string {
	return randomBytes(32).toString("hex");
}

/** Hand out a challenge for a key. Cheap on purpose: it proves nothing and
 * commits nothing, so it can be rate-limited as an ordinary write rather than
 * defended as an account operation. */
export function issueChallenge(db: Db, publicKey: string): { nonce: string; expiresIn: number } {
	if (!isPublicKey(publicKey)) throw badRequest("not a public key");
	const nonce = secret();
	db.prepare("INSERT INTO nonces (nonce, public_key, expires_at) VALUES (?, ?, ?)").run(
		nonce,
		publicKey.toLowerCase(),
		Date.now() + config.nonceTtlSeconds * 1000,
	);
	return { nonce, expiresIn: config.nonceTtlSeconds };
}

/**
 * Answer a challenge and get a token.
 *
 * The nonce is deleted whether or not the signature checks out, so a failed
 * attempt cannot be retried against the same challenge — which is the whole
 * point of it being a nonce.
 */
export function redeemChallenge(
	db: Db,
	publicKey: string,
	nonce: string,
	signature: string,
): { token: string; expiresIn: number; handle: string } {
	if (!isPublicKey(publicKey)) throw badRequest("not a public key");
	if (typeof nonce !== "string" || typeof signature !== "string") throw badRequest("malformed");

	const key = publicKey.toLowerCase();
	const row = db
		.prepare("SELECT public_key, expires_at FROM nonces WHERE nonce = ?")
		.get(nonce) as { public_key?: string; expires_at?: number } | undefined;
	db.prepare("DELETE FROM nonces WHERE nonce = ?").run(nonce);

	if (!row || row.public_key !== key) throw unauthorized("unknown challenge");
	if (Number(row.expires_at) < Date.now()) throw unauthorized("challenge expired");
	if (!verifyMessage(key, nonce, signature)) throw unauthorized("signature does not verify");

	const token = secret();
	db.prepare("INSERT INTO tokens (token, public_key, expires_at) VALUES (?, ?, ?)").run(
		token,
		key,
		Date.now() + config.tokenTtlSeconds * 1000,
	);
	// Signing in is enough to have been seen: it proves the key exists and is
	// held, which is what the vote-age dial wants to measure, and it means a
	// key's clock starts before its first upload rather than at it.
	touchAuthor(db, key);
	// The handle is computed, never stored: it is a function of the key, so
	// there is nothing to keep in sync and no way for a stored one to be wrong.
	return { token, expiresIn: config.tokenTtlSeconds, handle: handleFromPublicKey(key) };
}

/** Record a key as seen, if it is new. The timestamp is what
 * `VOTE_MIN_KEY_AGE_HOURS` measures against and what a profile shows as "first
 * published". */
export function touchAuthor(db: Db, publicKey: string): void {
	db.prepare(
		"INSERT INTO authors (public_key, first_seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING",
	).run(publicKey, new Date().toISOString());
}

/** When a key was first seen, in ms since the epoch, or null. */
export function authorAge(db: Db, publicKey: string): number | null {
	const row = db.prepare("SELECT first_seen_at FROM authors WHERE public_key = ?").get(publicKey) as
		| { first_seen_at?: string }
		| undefined;
	if (!row?.first_seen_at) return null;
	const ms = Date.parse(row.first_seen_at);
	return Number.isNaN(ms) ? null : ms;
}

/** The signed-in key for a request, or null. */
export function currentKey(db: Db, ctx: RequestContext): string | null {
	const header = ctx.req.headers.authorization;
	if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
	const token = header.slice(7).trim();
	if (!token) return null;
	const row = db
		.prepare("SELECT public_key, expires_at FROM tokens WHERE token = ?")
		.get(token) as { public_key?: string; expires_at?: number } | undefined;
	if (!row?.public_key || Number(row.expires_at) < Date.now()) return null;
	return row.public_key;
}

/** The signed-in key, or a 401. */
export function requireKey(db: Db, ctx: RequestContext): string {
	const key = currentKey(db, ctx);
	if (!key) throw unauthorized();
	return key;
}
