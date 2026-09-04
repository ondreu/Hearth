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
				cards: [
					{ id: "c1", kind: "clock", x: 0, y: 0, w: 4, h: 2 },
					{ id: "c2", kind: "tasks", x: 4, y: 0, w: 8, h: 5 },
					{ id: "c3", kind: "text", x: 0, y: 2, w: 4, h: 3 },
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

console.log(
	JSON.stringify({
		key,
		run,
		publicKey: id.publicKey,
		handle: id.handle,
		a: build(`hd-smoke-${run}-a`, `Reading room ${run}`, "writing"),
		b: build(`hd-smoke-${run}-b`, `Sprint board ${run}`, "work"),
		leaky: leaky(),
		unsigned: JSON.stringify({
			hearth: { format: 3, kind: "dashboard" },
			meta: { id: "hd-smoke-0004", name: "Unsigned" },
			payload: { dashboard: { id: "x", name: "Unsigned", cards: [] } },
		}),
	}),
);
