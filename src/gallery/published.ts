/**
 * What this vault has published, and what it said when it did.
 *
 * Two things are written down here, both learned at the moment a publish
 * succeeds, and both about a board this vault published rather than about the
 * gallery.
 *
 * **Which entry a board became.** A listing knows an entry by the host's own id
 * (`e1a2b3…`); a vault knows the board by `sourceId`, the identity it stamps
 * into `meta.id`. The two are the same board and nothing on screen connects
 * them, which is what "Update" in the gallery needs — otherwise the only way to
 * publish over an entry is to find the board yourself and publish it again,
 * which is precisely the step the button exists to remove. A host *can* answer
 * it, but only one new enough to send the field, to a vault it recognised, so
 * the vault keeps its own note and the button works against whatever gallery
 * somebody is actually pointed at.
 *
 * **What the listing said.** A board's name is not its listing's name, and its
 * description, category and tags exist nowhere else in the vault at all — they
 * are things somebody typed into the publish dialog, and a second publish that
 * opened with them blank would be asking for them to be typed again, or worse,
 * would quietly replace a written description with nothing.
 *
 * Kept per host: two galleries hand out ids from their own namespaces, and one
 * gallery's listing is not the other's.
 *
 * It is a *cache*, not a record. The worst a missing or stale note can do is
 * grey a button out or open a dialog with fields to fill in; the publish it
 * leads to is keyed by `sourceId` and carries what the dialog says at the time.
 * Nothing here decides what an update overwrites.
 */

import { asGalleryCategory, type GalleryCategory } from "./categories";
import type { HomeSettings } from "../types";

/** Most pairings a vault keeps. Well past the boards anybody publishes, and
 * there so a long-lived `data.json` cannot grow one line per entry ever
 * published. */
const MAX_REMEMBERED = 200;

/** What the publish dialog asks for that the board itself does not know. */
export interface PublishedListing {
	name?: string;
	description?: string;
	category?: GalleryCategory;
	/** The recommended theme, as `PackageMeta.theme`. */
	theme?: string;
	tags?: string[];
}

/** One board this vault published, as its entry on one host. */
export interface PublishedEntry {
	/** The board's `sourceId` — which board in this vault it is. */
	sourceId: string;
	/** What the listing said the last time this vault published it. */
	listing?: PublishedListing;
}

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
	return settings.galleryEntries?.[key(host, entryId)]?.sourceId;
}

/**
 * What this board's listing said when this vault last published it to this
 * host, so the publish dialog opens on the entry rather than on a blank form.
 *
 * Looked up by board rather than by entry, because that is what the dialog has:
 * it is opened on a dashboard, and may not know (or care) which entry that
 * dashboard is.
 */
export function rememberedListing(
	settings: HomeSettings,
	host: string,
	sourceId: string | undefined,
): PublishedListing | undefined {
	if (!sourceId) return undefined;
	const prefix = `${host}|`;
	for (const [k, entry] of Object.entries(settings.galleryEntries ?? {})) {
		if (k.startsWith(prefix) && entry.sourceId === sourceId) return entry.listing;
	}
	return undefined;
}

/**
 * Write down that this entry is that board, and what was said about it.
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
	listing?: PublishedListing,
): void {
	const kept: Record<string, PublishedEntry> = {};
	const live = new Set(settings.dashboards.map((d) => d.sourceId).filter(Boolean));
	for (const [k, entry] of Object.entries(settings.galleryEntries ?? {})) {
		if (live.has(entry.sourceId)) kept[k] = entry;
	}
	kept[key(host, entryId)] = listing ? { sourceId, listing } : { sourceId };
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
 * host chose and holds text that goes back into a form. Anything that is not
 * the shape above is dropped rather than carried into the settings object.
 */
export function readGalleryEntries(raw: unknown): Record<string, PublishedEntry> | undefined {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const out: Record<string, PublishedEntry> = {};
	let n = 0;
	for (const [k, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!k || k.length > 400 || !k.includes("|")) continue;
		const entry = readEntry(value);
		if (!entry) continue;
		out[k] = entry;
		if (++n >= MAX_REMEMBERED) break;
	}
	return n ? out : undefined;
}

function readEntry(value: unknown): PublishedEntry | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const src = value as Record<string, unknown>;
	const sourceId = str(src.sourceId, 64);
	if (!sourceId) return null;
	const listing = readListing(src.listing);
	return listing ? { sourceId, listing } : { sourceId };
}

function readListing(value: unknown): PublishedListing | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const src = value as Record<string, unknown>;
	const listing: PublishedListing = {};
	const name = str(src.name, 120);
	if (name) listing.name = name;
	const description = str(src.description, 1000);
	if (description) listing.description = description;
	// An unknown category files as `other` rather than being dropped, exactly as
	// one from a gallery does — this is a form's starting value, and a missing
	// one would mean the field silently resetting.
	if (typeof src.category === "string") listing.category = asGalleryCategory(src.category);
	const theme = str(src.theme, 60);
	if (theme) listing.theme = theme;
	if (Array.isArray(src.tags)) {
		const tags: string[] = [];
		for (const tag of src.tags.slice(0, 24)) {
			const value = str(tag, 32)?.toLowerCase();
			if (value && !tags.includes(value)) tags.push(value);
		}
		if (tags.length) listing.tags = tags;
	}
	return Object.keys(listing).length ? listing : undefined;
}

function str(value: unknown, max: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
