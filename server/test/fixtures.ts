/**
 * Signed dashboard packages to test a running gallery against.
 *
 * Real files rather than fixtures typed by hand: they are built with the
 * plugin's own `signPackage`, so a server that accepts one has accepted
 * something Hearth would actually have produced — and the two deliberately
 * broken ones (unsigned, and one still naming its author's vault) are broken in
 * the ways a real upload can be.
 *
 * Prints one JSON object on stdout; `smoke.ts` reads it.
 */
import { identityFromKey, newAuthorKey } from "../../src/identity";
import { signPackage } from "../../src/portable/signature";
import type { HearthPackage } from "../../src/portable/schema";

// A fresh identity per run, and dashboard ids to match. That is what makes the
// test idempotent against a gallery that already has things in it: every
// assertion is about this key's own boards, and a second run collides with
// nothing — including its own previous one.
/** A 1×1 JPEG, so the snapshot path is exercised with real bytes rather than
 * with a string that merely happens to be base64. */
const TINY_JPEG =
	"/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
	"HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
	"AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const key = process.env.KEY || newAuthorKey();
const run = Math.random().toString(36).slice(2, 10);
const id = identityFromKey(key)!;

function build(sourceId: string, name: string, category: string, extra: Record<string, unknown> = {}): string {
	const pkg = {
		hearth: { format: 3, kind: "dashboard", plugin: "3.1.0", createdAt: new Date().toISOString() },
		meta: {
			id: sourceId,
			name,
			description: "A board for the smoke test.",
			category,
			tags: ["test", "minimal"],
			authorPublicKey: id.publicKey,
			author: id.handle,
			...extra,
		},
		payload: {
			dashboard: {
				id: "board-1",
				name,
				gridColumns: 12,
				maxWidth: 1100,
				// `fx`/`fw` as fractions of the width and `fy`/`fh` in pixels —
				// the coordinates the board actually renders from, which is what
				// a real export carries. The grid units beside them are the
				// legacy seed nothing reads.
				cards: [
					{ id: "c1", kind: "clock", x: 0, y: 0, w: 4, h: 2, fx: 0, fy: 0, fw: 0.33, fh: 200 },
					{ id: "c2", kind: "tasks", x: 4, y: 0, w: 8, h: 5, fx: 0.34, fy: 0, fw: 0.66, fh: 500 },
					{ id: "c3", kind: "text", x: 0, y: 2, w: 4, h: 3, fx: 0, fy: 210, fw: 0.33, fh: 290 },
				],
				background: { kind: "color", value: "#1e1e2e", opacity: 1, blur: 0 },
			},
		},
	} as unknown as HearthPackage;
	if (!signPackage(pkg, key)) throw new Error("could not sign");
	return JSON.stringify(pkg);
}

/** A package that still names its author's vault — the server must refuse it. */
function leaky(): string {
	const pkg = JSON.parse(build(`hd-smoke-${run}-c`, `Leaky ${run}`, "other")) as HearthPackage;
	(pkg.payload as { dashboard: { cards: Record<string, unknown>[] } }).dashboard.cards.push({
		id: "c4", kind: "embed", x: 0, y: 5, w: 4, h: 2, target: "Private/Therapy/Notes.md",
	});
	if (!signPackage(pkg, key)) throw new Error("could not sign");
	return JSON.stringify(pkg);
}

const forkKey = newAuthorKey();

/** The same dashboard id, signed by somebody else's key. */
function fork(): string {
	const other = identityFromKey(forkKey)!;
	const pkg = JSON.parse(build(`hd-smoke-${run}-a`, `Fork ${run}`, "other")) as HearthPackage;
	pkg.meta!.authorPublicKey = other.publicKey;
	pkg.meta!.author = other.handle;
	if (!signPackage(pkg, forkKey)) throw new Error("could not sign");
	return JSON.stringify(pkg);
}

console.log(
	JSON.stringify({
		key,
		run,
		publicKey: id.publicKey,
		handle: id.handle,
		a: build(`hd-smoke-${run}-a`, `Reading room ${run}`, "writing", {
			theme: "Minimal",
			snapshot: {
				data: TINY_JPEG,
				mime: "image/jpeg",
				bytes: 300,
				width: 1,
				height: 1,
			},
		}),
		b: build(`hd-smoke-${run}-b`, `Sprint board ${run}`, "work"),
		leaky: leaky(),
		// A third clean board, for the per-author limit check.
		third: build(`hd-smoke-${run}-e`, `Third ${run}`, "other"),
		// A *second* identity publishing the same dashboard id — the shape of
		// "installed a board, changed it, tried to publish it" — which the
		// gallery has to refuse rather than let overwrite somebody's entry.
		fork: fork(),
		forkPublicKey: identityFromKey(forkKey)!.publicKey,
		forkKey,
		unsigned: JSON.stringify({
			hearth: { format: 3, kind: "dashboard" },
			meta: { id: "hd-smoke-0004", name: "Unsigned" },
			payload: { dashboard: { id: "x", name: "Unsigned", cards: [] } },
		}),
	}),
);
