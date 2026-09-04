/**
 * What a published dashboard is *for* — the left-hand rail of the gallery, and
 * the one field an export has to be asked for that isn't already on the board.
 *
 * A dashboard's card kinds are already known (`requires.cardKinds`), and so are
 * its tags, but neither answers the question somebody browsing actually has.
 * "Has a tasks card" is a fact about the file; "this is a board for getting
 * through a working day" is what a person is looking for, and only its author
 * can say it. So it is asked once, at publish, from a short closed list rather
 * than as free text — a facet has to be shared to be worth filtering by, and
 * tags already exist for everything a closed list can't hold.
 *
 * **The list is append-only, and its ids are stored.** A published entry keeps
 * the id it was filed under, in the gallery's database and inside every copy of
 * its package; renaming one orphans every entry that used it. Add to the end,
 * never reorder, never remove — {@link GALLERY_CATEGORIES} order is display
 * order and nothing else depends on it.
 *
 * This module is deliberately free of imports. The gallery server bundles it
 * verbatim (see `docs/gallery-hosting.md`), so the plugin offering a category
 * and the server accepting one cannot drift into disagreeing.
 */

/** A published dashboard's category id. */
export type GalleryCategory =
	| "productivity"
	| "planning"
	| "study"
	| "writing"
	| "work"
	| "personal"
	| "minimal"
	| "dense"
	| "other";

/**
 * Every category, in the order the rail lists them.
 *
 * `other` is last and is deliberately a real category rather than a fallback
 * for an unrecognised id: a board that doesn't fit is a normal thing to
 * publish, and a value the server has never heard of is a broken package rather
 * than a board to be quietly refiled.
 */
export const GALLERY_CATEGORIES: readonly GalleryCategory[] = [
	"productivity",
	"planning",
	"study",
	"writing",
	"work",
	"personal",
	"minimal",
	"dense",
	"other",
] as const;

/** The Lucide icon each category wears in the rail. */
export const GALLERY_CATEGORY_ICONS: Record<GalleryCategory, string> = {
	productivity: "zap",
	planning: "calendar-days",
	study: "graduation-cap",
	writing: "pen-line",
	work: "briefcase",
	personal: "home",
	minimal: "minus",
	dense: "layout-grid",
	other: "shapes",
};

/**
 * What a board is filed under when its author didn't say.
 *
 * A package written before categories existed, or by hand, has none — and
 * guessing one from its cards would file boards under a category their author
 * never chose, which is worse than the honest answer.
 */
export const DEFAULT_GALLERY_CATEGORY: GalleryCategory = "other";

/** Whether a value is one of the categories this build knows. */
export function isGalleryCategory(value: unknown): value is GalleryCategory {
	return typeof value === "string" && (GALLERY_CATEGORIES as readonly string[]).includes(value);
}

/** A category id, or {@link DEFAULT_GALLERY_CATEGORY} for anything else. */
export function asGalleryCategory(value: unknown): GalleryCategory {
	return isGalleryCategory(value) ? value : DEFAULT_GALLERY_CATEGORY;
}
