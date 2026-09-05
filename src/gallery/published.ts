/**
 * Which gallery entry each published board became.
 *
 * A listing knows an entry by the host's own id (`e1a2b3…`); a vault knows the
 * board by `sourceId`, the identity it stamps into `meta.id`. The two are the
 * same board and nothing on screen connects them, which is what "Update" in the
 * gallery needs — otherwise the only way to publish over an entry is to find
 * the board yourself and publish it again, which is precisely the step the
 * button exists to remove.
 *
 * A host *can* answer it: it files an entry under the uploader's `meta.id` and
 * tells the author which. But that answer needs a host new enough to send it
 * and a vault signed in to be recognised, and neither is true of a board
 * published to a gallery running last month's build. So the vault writes the
 * pairing down at the moment it learns it — a publish response names the entry,
 * and the board it just published is in hand — and the button works against any
 * host, including one that has never heard of the field.
 *
 * Kept per host: two galleries hand out ids from their own namespaces, and an
 * id that means one board here would otherwise claim an unrelated entry there.
 *
 * It is a *cache*, not a record: the worst a missing or stale pairing can do is
 * grey the button out or point it at a board whose own `sourceId` no longer
 * matches, and the publish it opens is keyed by `sourceId` regardless. Nothing
 * here decides what an update overwrites.
 */

import type { HomeSettings } from "../types";

/** Most pairings a vault keeps. Well past the boards anybody publishes, and
 * there so a long-lived `data.json` cannot grow one line per entry ever
 * opened. */
const MAX_REMEMBERED = 200;

/**
 * One key, from a host and an entry id.
 *
 * `|` as the separator because neither half can contain one: a host is a
 * normalised URL and an entry id is the servers' own `[A-Za-z0-9._-]`
 * namespace. A flat map rather than a map of maps keeps the sanitizer and the
 * pruning to one loop each.
 */
function key(host: string, entryId: string): string {
	return `${host}|${entryId}`;
}

/** The board a published entry came from, as this vault last saw it. */
export function galleryEntrySourceId(
	settings: HomeSettings,
	host: string,
	entryId: string,
): string | undefined {
	return settings.galleryEntries?.[key(host, entryId)];
}

/**
 * Write down that this entry is that board.
 *
 * Called on a successful publish, for a new entry and for an update alike —
 * the second one matters too, since it is how a vault that published before
 * this existed picks the pairing up.
 *
 * Prunes as it writes: a pairing whose board is no longer in the vault is a
 * pairing that can never match again, and dropping it here means the list
 * cannot outgrow the boards without anybody having to tidy it.
 */
export function rememberGalleryEntry(
	settings: HomeSettings,
	host: string,
	entryId: string,
	sourceId: string,
): void {
	const kept: Record<string, string> = {};
	const live = new Set(settings.dashboards.map((d) => d.sourceId).filter(Boolean));
	for (const [k, v] of Object.entries(settings.galleryEntries ?? {})) {
		if (live.has(v)) kept[k] = v;
	}
	kept[key(host, entryId)] = sourceId;
	// Only if it somehow still ran long: oldest first, which for an object is
	// insertion order, and the pairing just written is the last one in.
	const overflow = Object.keys(kept).length - MAX_REMEMBERED;
	if (overflow > 0) for (const k of Object.keys(kept).slice(0, overflow)) delete kept[k];
	settings.galleryEntries = kept;
}

/** Forget one pairing — the entry has been withdrawn, so there is nothing for
 * it to name any more. */
export function forgetGalleryEntry(settings: HomeSettings, host: string, entryId: string): void {
	if (!settings.galleryEntries) return;
	delete settings.galleryEntries[key(host, entryId)];
}

/**
 * What a persisted `galleryEntries` is allowed to be.
 *
 * Read defensively like everything else that comes off disk: `data.json` is a
 * file people edit and sync clients merge, and this one is keyed by strings a
 * host chose. Anything that isn't a plain string pair is dropped rather than
 * carried into the settings object.
 */
export function readGalleryEntries(raw: unknown): Record<string, string> | undefined {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const out: Record<string, string> = {};
	let n = 0;
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof v !== "string" || !v || v.length > 64) continue;
		if (!k || k.length > 400 || !k.includes("|")) continue;
		out[k] = v;
		if (++n >= MAX_REMEMBERED) break;
	}
	return n ? out : undefined;
}
