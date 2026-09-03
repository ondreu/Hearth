/**
 * Proving who made a package.
 *
 * A handle derived from a key (see `src/identity.ts`) cannot be *doubled* — two
 * vaults will not land on the same one — but on its own it can still be
 * *copied*: it is printed in every package its owner publishes, and anybody who
 * has read one can type it into a file of their own. Hashing cannot close that,
 * because a package is a static file and any proof it carries, its reader now
 * has. "Prove you know the secret" has no answer that consists of writing the
 * secret down.
 *
 * A signature has an answer. The file carries the author's public key and a
 * signature over its own contents; the private half never leaves their vault.
 * A reader recomputes the handle from the public key — so the name still cannot
 * disagree with the key — and then checks the signature, which says that
 * whoever holds that key produced *these exact bytes*. Copying a handle now
 * produces a package that fails to verify, and Hearth shows it as unsigned.
 *
 * **What is signed, and what that costs.** Everything in the package except the
 * two fields that cannot be: `meta.signature` itself, and `meta.author`, which
 * is a convenience copy of a value the reader derives rather than trusts. So
 * the signature covers the payload, the assets, the header and the rest of the
 * metadata — which means *any* edit breaks it. That is the signature working,
 * not failing, and it has one consequence worth designing around: a gallery
 * that strips an author's paths or overwrites `meta.id` on publish invalidates
 * the signature it just checked. Verification is therefore an **upload-time**
 * proof — the gallery verifies, then republishes under its own attestation —
 * and end-to-end verification only survives a file passed along untouched.
 *
 * Two people trading files directly get the full thing, and what they get is
 * trust on first use: "the same hand made this and that", not "this is
 * Ondřej". Binding a handle to a person needs someone to vouch for it, which
 * is a gallery's job and not a file format's.
 */

import {
	handleFromPublicKey,
	publicKeyFromAuthorKey,
	signMessage,
	verifyMessage,
} from "../identity";
import type { HearthPackage } from "./schema";

/** What a reader can conclude about a package's authorship. */
export type SignatureState =
	/** Signed, and the signature is this public key's over these bytes. */
	| "valid"
	/** No public key or no signature: an unattributed package. Not an error —
	 * a hand-written package, a backup of your own vault and a gallery download
	 * whose file was rewritten are all legitimately unsigned. */
	| "unsigned"
	/** A signature that does not check out. Either the file was edited after it
	 * was signed, or somebody copied an author's key without their signing
	 * half. Never shown as an author. */
	| "invalid";

/**
 * The exact bytes a signature covers.
 *
 * Canonical means object keys in code-unit order at every level and no
 * whitespace, so two implementations reach the same string from the same
 * document. Arrays keep their order, because in a package order is meaning —
 * cards, slides and calendar sources are all sequences somebody arranged.
 *
 * The subject is built field by field rather than by copying the package and
 * deleting two things, and that is the load-bearing decision here. `readPackage`
 * rebuilds the envelope from the fields it knows, so a package written by a
 * *newer* Hearth carrying a header field this build has never heard of arrives
 * with that field gone. Signing "everything" would make every such file fail
 * verification — reported to the reader as a forged author, which is both
 * alarming and wrong. Signing exactly the fields that survive a round trip
 * means a newer package's extra fields simply are not covered, and its author
 * still checks out.
 *
 * Two fields are left out on purpose:
 *
 * - `meta.signature`, which cannot sign itself;
 * - `meta.author`, which a reader derives from the public key rather than
 *   reading, so covering it would only add a way for an edit nobody looks at to
 *   invalidate a good file.
 *
 * **Adding a field to the format?** Add it here too, or it travels unsigned.
 */
export function signedBytes(pkg: HearthPackage): string {
	const meta = { ...pkg.meta };
	delete meta.signature;
	delete meta.author;
	return canonicalJson({
		// Spelled out to match what `readPackage` reconstructs, in the same
		// shape: an absent optional field and one set to undefined have to reach
		// the hash identically, which `canonicalJson` guarantees by dropping
		// undefined exactly as JSON does.
		hearth: {
			format: pkg.hearth.format,
			kind: pkg.hearth.kind,
			plugin: pkg.hearth.plugin,
			createdAt: pkg.hearth.createdAt,
		},
		meta: Object.keys(meta).length > 0 ? meta : undefined,
		capture: pkg.capture,
		requires: pkg.requires,
		// An empty asset list and no asset list are the same package, and
		// `readPackage` normalises one into the other.
		assets: pkg.assets?.length ? pkg.assets : undefined,
		payload: pkg.payload,
	});
}

/**
 * JSON with every object's keys in a fixed order.
 *
 * `JSON.stringify` preserves insertion order, which is a property of how an
 * object was built rather than of what it holds — so a package that has been
 * parsed and re-serialized, or assembled field by field in a different order,
 * would produce different bytes and break its own signature. Sorting removes
 * that. `undefined` is dropped exactly as `JSON.stringify` drops it, so a
 * field explicitly set to undefined and one never set are the same document.
 */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, item]) => item !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	const body = entries
		.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
		.join(",");
	return `{${body}}`;
}

/**
 * Sign a package in place, with the vault's recovery key.
 *
 * Must be the **last** step of an export: it covers the whole document, so
 * embedding the pictures and stripping the author's private references both
 * have to have happened already. Returns false when the key isn't one, leaving
 * the package unsigned rather than half-signed.
 */
export function signPackage(pkg: HearthPackage, recoveryKey: string): boolean {
	const publicKey = publicKeyFromAuthorKey(recoveryKey);
	if (!publicKey) return false;
	pkg.meta = {
		...pkg.meta,
		authorPublicKey: publicKey,
		// Written for anything reading the file without Hearth's derivation, and
		// not part of what is signed. A reader with the derivation ignores it.
		author: handleFromPublicKey(publicKey),
	};
	const signature = signMessage(recoveryKey, signedBytes(pkg));
	if (signature === null) return false;
	pkg.meta.signature = signature;
	return true;
}

/** What this package's signature says, without changing it. */
export function verifyPackageSignature(pkg: HearthPackage): SignatureState {
	const publicKey = pkg.meta?.authorPublicKey;
	const signature = pkg.meta?.signature;
	if (typeof publicKey !== "string" || typeof signature !== "string") return "unsigned";
	if (publicKey === "" || signature === "") return "unsigned";
	return verifyMessage(publicKey, signedBytes(pkg), signature) ? "valid" : "invalid";
}

/**
 * The author to show for a package: a handle, or nothing.
 *
 * Nothing is the answer for an unsigned package *and* for a package whose
 * signature fails, and deliberately the same answer — an unattributed board and
 * a board attributed by somebody who could not sign for it are equally not
 * evidence of who made it. The distinction is worth telling the reader about
 * (the import dialog does), but it is not a distinction between two authors.
 */
export function packageAuthor(pkg: HearthPackage): string | null {
	if (verifyPackageSignature(pkg) !== "valid") return null;
	const publicKey = pkg.meta?.authorPublicKey;
	return typeof publicKey === "string" ? handleFromPublicKey(publicKey) : null;
}
