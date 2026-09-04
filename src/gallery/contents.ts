/**
 * What is on a board, by card kind.
 *
 * The detail view's "what's on this board" list, derived from the package
 * rather than from anything the uploader said alongside it — an entry should
 * not be able to advertise cards it does not contain.
 *
 * Lives apart from the rest of the gallery client because the server runs it
 * too (see `docs/gallery-hosting.md`): keep it free of Obsidian imports.
 */

import type { HearthPackage } from "../portable/schema";

/** One line of the detail view's contents list. */
export interface PackageCardCount {
	kind: string;
	count: number;
}

/** A kind id, or "" for anything that isn't one. Held to the shape Hearth's own
 * kinds have, so a listing can't be made to look up something strange. */
function safeKind(value: unknown): string {
	return typeof value === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(value) ? value : "";
}

/**
 * Count the cards by kind.
 *
 * Counted rather than listed one by one: "4 × tasks" is what somebody deciding
 * whether to install this wants, and a board's fourteenth link card is not.
 * Sorted by count, then by kind, so the same board always reads the same way.
 */
export function cardCountsFromPackage(pkg: HearthPackage): PackageCardCount[] {
	if (pkg.hearth.kind !== "dashboard") return [];
	const payload = pkg.payload as { dashboard?: { cards?: unknown } } | undefined;
	const cards = payload?.dashboard?.cards;
	if (!Array.isArray(cards)) return [];
	const counts = new Map<string, number>();
	for (const card of cards as Record<string, unknown>[]) {
		const kind = safeKind(card?.kind);
		if (!kind) continue;
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	return Array.from(counts, ([kind, count]) => ({ kind, count })).sort(
		(a, b) => b.count - a.count || (a.kind < b.kind ? -1 : 1),
	);
}
