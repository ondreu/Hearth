import { describe, expect, it } from "vitest";
import { type Dashboard, DEFAULT_SETTINGS, type HomeSettings } from "../src/types";
import { identityFromKey, newAuthorKey } from "../src/identity";
import {
	canonicalJson,
	captureDashboard,
	type HearthPackage,
	packageAuthor,
	readPackage,
	serializePackage,
	signPackage,
	signedBytes,
	stripReferences,
	verifyPackageSignature,
} from "../src/portable";

/**
 * Signing a package.
 *
 * A handle derived from a key cannot be doubled, but it is printed in every
 * package its owner publishes, so on its own it can still be *copied*. These
 * are the tests for the part that closes that: the file carries a signature
 * only the holder of the key can produce, and a reader who cannot verify it is
 * shown no author at all.
 *
 * The one that matters most is the round trip. A signature over a JSON document
 * is a signature over exact bytes, and this package gets serialized, written to
 * disk, read back and rebuilt field by field before anybody checks it — so
 * "signs and verifies in memory" proves almost nothing on its own.
 */

const KEY = "HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ";

function vault(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{
			id: "board-1",
			name: "Reading room",
			cards: [
				{ id: "c1", kind: "clock", x: 0, y: 0, w: 4, h: 2 },
				{ id: "c2", kind: "embed", target: "Notes/Journal.md", x: 4, y: 0, w: 4, h: 3 },
			],
		},
	];
	s.activeDashboardId = "board-1";
	return s;
}

function signedPackage(key = KEY): HearthPackage {
	const s = vault();
	const pkg = captureDashboard(s, s.dashboards[0]);
	expect(signPackage(pkg, key)).toBe(true);
	return pkg;
}

describe("a signed package", () => {
	it("verifies, and reports the handle its key derives to", () => {
		const pkg = signedPackage();
		expect(verifyPackageSignature(pkg)).toBe("valid");
		expect(packageAuthor(pkg)).toBe(identityFromKey(KEY)?.handle);
	});

	it("writes the public key and the handle beside the signature", () => {
		const identity = identityFromKey(KEY);
		const pkg = signedPackage();
		expect(pkg.meta?.authorPublicKey).toBe(identity?.publicKey);
		expect(pkg.meta?.author).toBe(identity?.handle);
		expect(pkg.meta?.signature).toMatch(/^[0-9a-f]{128}$/);
	});

	/**
	 * The test the whole scheme rests on: a file, not an object in memory.
	 */
	it("survives being written out and read back", () => {
		const json = serializePackage(signedPackage());
		const outcome = readPackage(json);
		expect(outcome.pkg).toBeDefined();
		expect(verifyPackageSignature(outcome.pkg!)).toBe("valid");
		expect(packageAuthor(outcome.pkg!)).toBe(identityFromKey(KEY)?.handle);
	});

	it("survives a reader that puts the fields back in a different order", () => {
		// `readPackage` rebuilds the envelope, and `JSON.stringify` preserves
		// insertion order — so without canonicalisation a rebuilt package would
		// hash differently from the one that was signed.
		const pkg = signedPackage();
		const reordered: HearthPackage = {
			payload: pkg.payload,
			requires: pkg.requires,
			meta: Object.fromEntries(Object.entries(pkg.meta ?? {}).reverse()),
			capture: pkg.capture,
			hearth: pkg.hearth,
		};
		expect(verifyPackageSignature(reordered)).toBe("valid");
	});

	/**
	 * Forward compatibility. A newer Hearth may add an envelope field this build
	 * does not know, and `readPackage` drops what it does not know — so a
	 * signature covering "everything" would fail on every such file and report
	 * a legitimate author as a forgery.
	 */
	it("still verifies when a newer Hearth's unknown fields have been dropped", () => {
		const pkg = signedPackage();
		const fromTheFuture = {
			...pkg,
			hearth: { ...pkg.hearth, somethingNewer: true },
			unknownTopLevel: { whatever: 1 },
		} as unknown as HearthPackage;
		expect(verifyPackageSignature(fromTheFuture)).toBe("valid");
	});
});

describe("a package nobody signed", () => {
	it("reads as unsigned, with no author", () => {
		const s = vault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		expect(verifyPackageSignature(pkg)).toBe("unsigned");
		expect(packageAuthor(pkg)).toBeNull();
	});

	it("reads as unsigned when only half the pair is there", () => {
		const pkg = signedPackage();
		expect(verifyPackageSignature({ ...pkg, meta: { ...pkg.meta, signature: undefined } })).toBe(
			"unsigned",
		);
		expect(
			verifyPackageSignature({ ...pkg, meta: { ...pkg.meta, authorPublicKey: undefined } }),
		).toBe("unsigned");
		expect(verifyPackageSignature({ ...pkg, meta: { ...pkg.meta, signature: "" } })).toBe(
			"unsigned",
		);
	});

	it("refuses a key that isn't one rather than signing badly", () => {
		const s = vault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		expect(signPackage(pkg, "ondreu")).toBe(false);
		expect(verifyPackageSignature(pkg)).toBe("unsigned");
	});
});

describe("a package somebody tampered with", () => {
	it("catches an edit to the board", () => {
		const pkg = signedPackage();
		(pkg.payload as { dashboard: Dashboard }).dashboard.name = "Not what was signed";
		expect(verifyPackageSignature(pkg)).toBe("invalid");
		expect(packageAuthor(pkg)).toBeNull();
	});

	it("catches an edit to a single card's target", () => {
		const pkg = signedPackage();
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;
		board.cards[1].target = "Notes/Somewhere else.md";
		expect(verifyPackageSignature(pkg)).toBe("invalid");
	});

	it("catches an edit to the description", () => {
		const pkg = signedPackage();
		pkg.meta = { ...pkg.meta, description: "A claim the author never made" };
		expect(verifyPackageSignature(pkg)).toBe("invalid");
	});

	/**
	 * The attack the keypair exists for. The victim's public key and handle are
	 * printed in everything they publish, so a forger can copy both; what they
	 * cannot do is sign for them.
	 */
	it("catches a handle copied from somebody else's package", () => {
		const victim = identityFromKey(KEY);
		const forgerKey = newAuthorKey();
		const forged = signedPackage(forgerKey);

		// Their own file, with the victim's identity pasted over it.
		forged.meta = {
			...forged.meta,
			authorPublicKey: victim?.publicKey,
			author: victim?.handle,
		};

		expect(verifyPackageSignature(forged)).toBe("invalid");
		expect(packageAuthor(forged)).toBeNull();
	});

	it("cannot be fixed by also copying the victim's signature", () => {
		// The obvious next move: take the victim's whole metadata block,
		// signature included. It fails because a signature is over a document,
		// and the forger's document is not the victim's — here they differ in
		// the board's name and in `createdAt`, and any one difference is enough.
		const victimPkg = signedPackage();
		const forged = signedPackage(newAuthorKey());
		(forged.payload as { dashboard: Dashboard }).dashboard.name = "The forger's board";
		forged.meta = { ...victimPkg.meta };

		expect(verifyPackageSignature(forged)).toBe("invalid");
		expect(packageAuthor(forged)).toBeNull();
	});

	/**
	 * The limit of what a signature can do, stated so nobody expects more of it.
	 *
	 * Copying a signed file *unchanged* verifies — and must, since that is what
	 * a signature means. That is redistribution, not forgery: the file really
	 * was made by the author it names, and no signature scheme distinguishes
	 * "the author sent me this" from "somebody passed it on". What is prevented
	 * is putting an author's name on a board they did not make.
	 */
	it("verifies a file that was passed along unchanged, which is not forgery", () => {
		const json = serializePackage(signedPackage());
		const passedAlong = readPackage(json).pkg;
		expect(verifyPackageSignature(passedAlong!)).toBe("valid");
	});
});

describe("what a signature deliberately does not cover", () => {
	it("ignores the handle written in the file", () => {
		// It is derived from the public key, not read, so an edit to it changes
		// nothing a reader looks at — and must not invalidate a good file.
		const pkg = signedPackage();
		pkg.meta = { ...pkg.meta, author: "ondreu" };
		expect(verifyPackageSignature(pkg)).toBe("valid");
		expect(packageAuthor(pkg)).toBe(identityFromKey(KEY)?.handle);
	});

	/**
	 * The consequence a gallery has to design around: a strip is an edit, so it
	 * invalidates the signature it just checked. Verification is an upload-time
	 * proof, and a gallery republishes under its own attestation.
	 */
	it("is invalidated by the gallery strip, as documented", () => {
		const pkg = signedPackage();
		expect(verifyPackageSignature(pkg)).toBe("valid");
		stripReferences(pkg, { paths: true, private: true, content: true });
		expect(verifyPackageSignature(pkg)).toBe("invalid");
	});
});

describe("the canonical form the signature is taken over", () => {
	it("puts object keys in one order whatever order they arrived in", () => {
		expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
		expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
		expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
	});

	it("keeps arrays in the order somebody arranged them", () => {
		// Cards, slides and calendar sources are sequences, not sets.
		expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
		expect(canonicalJson([3, 1, 2])).not.toBe(canonicalJson([1, 2, 3]));
	});

	it("treats an absent field and an undefined one as the same document", () => {
		expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
	});

	it("handles the values a package actually contains", () => {
		expect(canonicalJson(null)).toBe("null");
		expect(canonicalJson("Ondřej — 面板")).toBe(JSON.stringify("Ondřej — 面板"));
		expect(canonicalJson(0.5)).toBe("0.5");
		expect(canonicalJson(true)).toBe("true");
		expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
	});

	it("leaves the signature and the handle out of its own subject", () => {
		const pkg = signedPackage();
		const bytes = signedBytes(pkg);
		expect(bytes).not.toContain(pkg.meta?.signature);
		expect(bytes).not.toContain('"author"');
		// But not the public key, which is covered.
		expect(bytes).toContain(pkg.meta?.authorPublicKey ?? "");
	});
});
