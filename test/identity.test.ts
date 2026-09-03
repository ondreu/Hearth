import { describe, expect, it } from "vitest";
import {
	handleFromPublicKey,
	identityFromKey,
	isAuthorKey,
	isPublicKey,
	newAuthorKey,
	normalizeAuthorKey,
	publicKeyFromAuthorKey,
	signMessage,
	verifiedAuthorName,
	verifyMessage,
} from "../src/identity";

/**
 * The export identity.
 *
 * Three separate properties, and the tests are grouped by which one they
 * protect, because they are easy to conflate and only the first comes free from
 * deriving a handle out of a key:
 *
 * - **stable** — the same key gives the same handle, in any vault, forever;
 * - **unique** — two different keys do not land on the same handle, which is a
 *   question about how many bits the handle has, not about how it is derived;
 * - **unforgeable** — nobody can publish under a handle they do not hold the
 *   key for, which needs the signature and cannot be had by hashing at all.
 */

const KEY = "HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ";

describe("the recovery key", () => {
	it("mints keys in the documented shape", () => {
		for (let i = 0; i < 20; i++) {
			const key = newAuthorKey();
			expect(key).toMatch(/^HEARTH(-[0-9A-HJKMNP-TV-Z]{5}){4}$/);
			expect(isAuthorKey(key)).toBe(true);
		}
	});

	it("mints a different key every time", () => {
		const keys = new Set(Array.from({ length: 50 }, () => newAuthorKey()));
		expect(keys.size).toBe(50);
	});

	it("reads a key back however it was written down", () => {
		for (const typed of [
			KEY,
			KEY.toLowerCase(),
			"  hearth-4kj2m-8xqp7-r3twd-n6vbz  ",
			"4KJ2M 8XQP7 R3TWD N6VBZ",
			"4KJ2M8XQP7R3TWDN6VBZ",
		]) {
			expect(normalizeAuthorKey(typed)).toBe(KEY);
		}
	});

	it("folds the characters an eye substitutes", () => {
		// Crockford's alphabet has no I, L, O or U precisely because a key gets
		// read off a screen and typed back in.
		expect(normalizeAuthorKey("HEARTH-4KJ2M-8XQP7-R3TWD-N6VBI")).toBe(
			"HEARTH-4KJ2M-8XQP7-R3TWD-N6VB1",
		);
		expect(normalizeAuthorKey("HEARTH-4KJ2M-8XQP7-R3TWD-N6VBO")).toBe(
			"HEARTH-4KJ2M-8XQP7-R3TWD-N6VB0",
		);
	});

	it("refuses anything that isn't a key", () => {
		for (const bad of ["", "ondreu", "HEARTH-4KJ2M", `${KEY}-EXTRA`]) {
			expect(normalizeAuthorKey(bad)).toBeNull();
			expect(identityFromKey(bad)).toBeNull();
			expect(publicKeyFromAuthorKey(bad)).toBeNull();
			expect(signMessage(bad, "hello")).toBeNull();
		}
	});
});

describe("stable: a handle comes back from its key alone", () => {
	it("gives the same key, handle and public key however it was typed", () => {
		const first = identityFromKey(KEY);
		const again = identityFromKey("  4kj2m 8xqp7 r3twd n6vbz ");
		expect(first).not.toBeNull();
		expect(again).toEqual(first);
	});

	it("derives the handle from the public key, not from anything else", () => {
		const identity = identityFromKey(KEY);
		expect(identity?.publicKey).toBe(publicKeyFromAuthorKey(KEY));
		expect(identity?.handle).toBe(handleFromPublicKey(identity?.publicKey ?? ""));
	});

	it("reads as a handle rather than as a hash", () => {
		// two words and six symbols of entropy: `quiet-lantern-4kj2m8`
		expect(identityFromKey(KEY)?.handle).toMatch(/^[a-z]+-[a-z]+-[0-9a-hjkmnp-tv-z]{6}$/);
	});

	it("mints a public key of the shape a package validates", () => {
		expect(identityFromKey(KEY)?.publicKey).toMatch(/^[0-9a-f]{64}$/);
		expect(isPublicKey(identityFromKey(KEY)?.publicKey ?? "")).toBe(true);
		expect(isPublicKey("ondreu")).toBe(false);
		expect(isPublicKey("")).toBe(false);
	});
});

describe("unique: two keys do not become one handle", () => {
	/**
	 * The property deriving-from-the-key does *not* give you on its own.
	 *
	 * A handle smaller than the key it comes from must collide eventually, so
	 * the handle carries its own entropy — 256 adjectives, 256 nouns and six
	 * base32 symbols, 46 bits. This checks the width is really there: a
	 * thousand keys through the derivation, no two the same, and every symbol
	 * position actually varying (a suffix accidentally derived from one byte
	 * would pass a smaller sample).
	 */
	it("gives a thousand keys a thousand handles", () => {
		const handles = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const identity = identityFromKey(newAuthorKey());
			expect(identity).not.toBeNull();
			handles.add(identity?.handle ?? "");
		}
		expect(handles.size).toBe(1000);
	});

	it("varies every part of the handle", () => {
		const parts = Array.from({ length: 200 }, () => {
			const handle = identityFromKey(newAuthorKey())?.handle ?? "";
			const [adjective, noun, suffix] = handle.split("-");
			return { adjective, noun, suffix };
		});
		// Word lists of 256 should show well over a hundred distinct values in
		// 200 draws; a list accidentally truncated to a handful would not.
		expect(new Set(parts.map((p) => p.adjective)).size).toBeGreaterThan(100);
		expect(new Set(parts.map((p) => p.noun)).size).toBeGreaterThan(100);
		for (let i = 0; i < 6; i++) {
			expect(new Set(parts.map((p) => p.suffix[i])).size).toBeGreaterThan(10);
		}
	});

	it("keeps every word list at the width the derivation assumes", () => {
		// One byte of the hash per word, so a list that is not exactly 256 long
		// either wastes entropy or renames handles. Read back off the handles
		// themselves rather than by exporting the lists, so the check is of
		// what the derivation actually reaches.
		const seen = { adjective: new Set<string>(), noun: new Set<string>() };
		for (let i = 0; i < 4000; i++) {
			const [adjective, noun] = (identityFromKey(newAuthorKey())?.handle ?? "").split("-");
			seen.adjective.add(adjective);
			seen.noun.add(noun);
		}
		expect(seen.adjective.size).toBe(256);
		expect(seen.noun.size).toBe(256);
	});
});

describe("unforgeable: a handle needs the key behind it", () => {
	it("verifies a signature made with the matching key", () => {
		const identity = identityFromKey(KEY);
		const signature = signMessage(KEY, "the package bytes");
		expect(signature).toMatch(/^[0-9a-f]{128}$/);
		expect(verifyMessage(identity?.publicKey ?? "", "the package bytes", signature ?? "")).toBe(
			true,
		);
	});

	it("refuses a signature over different bytes", () => {
		const identity = identityFromKey(KEY);
		const signature = signMessage(KEY, "the package bytes") ?? "";
		expect(verifyMessage(identity?.publicKey ?? "", "the package byteS", signature)).toBe(false);
	});

	/**
	 * The attack the whole keypair exists to stop: the handle and the public key
	 * are both printed in every package their owner publishes, so copying them
	 * is trivial. What cannot be copied is the ability to sign.
	 */
	it("refuses a signature from somebody who only copied the handle", () => {
		const victim = identityFromKey(KEY);
		const forger = identityFromKey(newAuthorKey());
		const message = "a board the forger made";
		const signature = signMessage(forger?.key ?? "", message) ?? "";

		// The forger writes the victim's public key into their file, which also
		// makes it display the victim's handle — and the signature they can
		// actually produce does not verify against it.
		expect(handleFromPublicKey(victim?.publicKey ?? "")).toBe(victim?.handle);
		expect(verifyMessage(victim?.publicKey ?? "", message, signature)).toBe(false);
	});

	it("treats malformed keys and signatures as a failed check, not a crash", () => {
		const identity = identityFromKey(KEY);
		const good = signMessage(KEY, "x") ?? "";
		expect(verifyMessage("", "x", good)).toBe(false);
		expect(verifyMessage("not-a-key", "x", good)).toBe(false);
		expect(verifyMessage(identity?.publicKey ?? "", "x", "")).toBe(false);
		expect(verifyMessage(identity?.publicKey ?? "", "x", "zz")).toBe(false);
		expect(verifyMessage(identity?.publicKey ?? "", "x", "f".repeat(128))).toBe(false);
	});

	it("signs text outside ASCII the same way twice", () => {
		const message = "Ondřej's board — 面板 🔥";
		const identity = identityFromKey(KEY);
		expect(signMessage(KEY, message)).toBe(signMessage(KEY, message));
		expect(verifyMessage(identity?.publicKey ?? "", message, signMessage(KEY, message) ?? "")).toBe(
			true,
		);
	});
});

describe("the name a reader shows", () => {
	it("is computed from the public key, never taken from the file", () => {
		const mine = identityFromKey(newAuthorKey());
		expect(verifiedAuthorName(mine?.publicKey)).toBe(mine?.handle);
	});

	it("is nothing at all when the package carries no key", () => {
		expect(verifiedAuthorName(undefined)).toBeNull();
		expect(verifiedAuthorName("")).toBeNull();
		expect(verifiedAuthorName("ondreu")).toBeNull();
		expect(verifiedAuthorName("z".repeat(64))).toBeNull();
	});

	it("ignores the casing and spacing of a key", () => {
		const key = identityFromKey(newAuthorKey())?.publicKey ?? "";
		expect(verifiedAuthorName(` ${key.toUpperCase()} `)).toBe(handleFromPublicKey(key));
	});
});
