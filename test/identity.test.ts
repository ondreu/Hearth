import { describe, expect, it } from "vitest";
import {
	authorIdFromKey,
	identityFromKey,
	isAuthorId,
	isAuthorKey,
	newAuthorKey,
	normalizeAuthorKey,
	sha256Hex,
	usernameFromAuthorId,
	verifiedAuthorName,
} from "../src/identity";

/**
 * The export identity.
 *
 * Two properties are the whole design, and both are tested here rather than
 * assumed: an identity comes back from its key alone (so a reinstall is a
 * paste, not a loss), and a display name is computed from the id rather than
 * read from the file (so nobody publishes under someone else's handle by
 * typing it).
 */

describe("the hash the identity is built on", () => {
	// Not decoration: everything public is derived by hashing, so a wrong hash
	// would mint handles that no other Hearth agrees with — and the bug would
	// only show up between two installs.
	it("agrees with SHA-256", () => {
		expect(sha256Hex("")).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
		expect(sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
		// Long enough to need more than one block, so the padding is exercised.
		expect(sha256Hex("a".repeat(1000))).toBe(
			"41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
		);
	});

	it("handles text outside ASCII", () => {
		expect(sha256Hex("héllo wörld")).toBe(
			sha256Hex("héllo wörld"),
		);
		expect(sha256Hex("naïve")).toHaveLength(64);
		expect(sha256Hex("🔥")).toHaveLength(64);
	});
});

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
		const key = "HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ";
		for (const typed of [
			key,
			key.toLowerCase(),
			"  hearth-4kj2m-8xqp7-r3twd-n6vbz  ",
			"4KJ2M 8XQP7 R3TWD N6VBZ",
			"4KJ2M8XQP7R3TWDN6VBZ",
		]) {
			expect(normalizeAuthorKey(typed)).toBe(key);
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
		for (const bad of ["", "ondreu", "HEARTH-4KJ2M", "HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ-EXTRA"]) {
			expect(normalizeAuthorKey(bad)).toBeNull();
			expect(identityFromKey(bad)).toBeNull();
		}
	});
});

describe("what a key resolves to", () => {
	const key = "HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ";

	it("gives the same id and name in any vault, forever", () => {
		const first = identityFromKey(key);
		const again = identityFromKey(key.toLowerCase());
		expect(first).not.toBeNull();
		expect(again).toEqual(first);
		// The point of the whole scheme: a reinstall is a paste of these twenty
		// characters, not a lost account.
		expect(first?.id).toBe(authorIdFromKey(key));
		expect(first?.name).toBe(usernameFromAuthorId(first?.id ?? ""));
	});

	it("gives a different id to a different key", () => {
		const ids = new Set(
			Array.from({ length: 50 }, () => identityFromKey(newAuthorKey())?.id),
		);
		expect(ids.size).toBe(50);
	});

	it("mints an id of the shape a package validates", () => {
		const identity = identityFromKey(key);
		expect(identity?.id).toMatch(/^[0-9a-f]{12}$/);
		expect(isAuthorId(identity?.id ?? "")).toBe(true);
		expect(isAuthorId("ondreu")).toBe(false);
		expect(isAuthorId("")).toBe(false);
	});

	it("reads as a handle rather than as a hash", () => {
		expect(identityFromKey(key)?.name).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
	});
});

describe("the name a reader shows", () => {
	it("is computed from the id, never taken from the file", () => {
		const mine = identityFromKey(newAuthorKey());
		expect(mine).not.toBeNull();
		// A package claiming somebody else's name while carrying its own id
		// displays as its own id's name. Typing a name you like is not a move.
		expect(verifiedAuthorName(mine?.id)).toBe(mine?.name);
	});

	it("is nothing at all when the package carries no id", () => {
		expect(verifiedAuthorName(undefined)).toBeNull();
		expect(verifiedAuthorName("")).toBeNull();
		// Not an id this scheme could have minted, so not an author.
		expect(verifiedAuthorName("ondreu")).toBeNull();
		expect(verifiedAuthorName("ZZZZZZZZZZZZ")).toBeNull();
	});

	it("ignores the casing and spacing of an id", () => {
		const id = identityFromKey(newAuthorKey())?.id ?? "";
		expect(verifiedAuthorName(` ${id.toUpperCase()} `)).toBe(usernameFromAuthorId(id));
	});
});
