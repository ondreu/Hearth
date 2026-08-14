import type { VaultEvent } from "./cardevents";
import type {
	DashboardCard,
	SlideshowConfig,
	SlideshowFit,
	SlideshowOrder,
	SlideshowSource,
	SlideshowTransition,
} from "./types";

/**
 * The slideshow card's pure half (issue #211): which pictures a card shows, in
 * what order, how fast, and which vault events are worth a redraw. Data in, data
 * out — no vault, no DOM, no Obsidian imports at all — so all of it is
 * unit-tested in test/slideshow.test.ts.
 *
 * It lives here rather than in `src/cards/slideshow.ts` for the same reason
 * `taskscope.ts` does: the card module imports the settings-modal helpers, which
 * import the card registry, which imports the card module — a cycle that a test
 * importing the card module directly walks straight into. Everything that
 * touches the vault or draws anything stays in the card module.
 */

/** Seconds a picture is held when the card doesn't say. */
export const SLIDESHOW_DEFAULT_INTERVAL_SEC = 8;
/** Longest hold a card can be configured with (an hour) — a guard against a
 * hand-edited data.json, not a limit anyone reaches through the editor. */
export const SLIDESHOW_MAX_INTERVAL_SEC = 3600;
/** Transition length when the card doesn't say, in milliseconds. */
export const SLIDESHOW_DEFAULT_TRANSITION_MS = 700;
/** Longest transition a card can be configured with. */
export const SLIDESHOW_MAX_TRANSITION_MS = 3000;

/** The orders offered in the editor, in dropdown order. */
export const SLIDESHOW_ORDERS: SlideshowOrder[] = [
	"manual",
	"name",
	"nameDesc",
	"created",
	"createdDesc",
	"modified",
	"modifiedDesc",
	"random",
];

/** The transitions offered in the editor, in dropdown order. */
export const SLIDESHOW_TRANSITIONS: SlideshowTransition[] = ["none", "fade", "slide", "zoom"];

/** The fit modes offered in the editor, in dropdown order. */
export const SLIDESHOW_FITS: SlideshowFit[] = ["cover", "contain"];

/**
 * One picture, reduced to what ordering and drawing need. Deliberately plain
 * data — no `TFile` — so the ordering below is testable without a vault.
 */
export interface SlideshowPicture {
	/** Vault path of the image. */
	path: string;
	/** Basename: the sort key of the by-name orders. */
	name: string;
	/** Vault ctime in ms, or 0 when unknown. */
	created: number;
	/** Vault mtime in ms, or 0 when unknown. */
	modified: number;
	/** Caption from the card's list, when the entry carries one. */
	caption?: string;
}

/** Where a card takes its pictures from, defaulting to the hand-picked list. */
export function slideshowSource(cfg: SlideshowConfig): SlideshowSource {
	return cfg.source === "folder" ? "folder" : "list";
}

/**
 * The order a card actually shows its pictures in. "manual" means "the order the
 * list is in", which a folder has none of — a folder source resolves it to
 * by-name instead, so such a card never falls back to the vault's own arbitrary
 * child order.
 */
export function slideshowOrder(cfg: SlideshowConfig): SlideshowOrder {
	const order = cfg.order ?? "manual";
	if (order === "manual" && slideshowSource(cfg) === "folder") return "name";
	return order;
}

/** How long one picture is held, in milliseconds. 0 means "don't rotate" —
 * either the card asked for it (interval 0) or the stored value is unusable. */
export function slideshowIntervalMs(cfg: SlideshowConfig): number {
	const seconds = cfg.intervalSec ?? SLIDESHOW_DEFAULT_INTERVAL_SEC;
	if (!Number.isFinite(seconds) || seconds <= 0) return 0;
	return Math.min(seconds, SLIDESHOW_MAX_INTERVAL_SEC) * 1000;
}

/** How long one picture takes to give way to the next, in milliseconds. */
export function slideshowTransitionMs(cfg: SlideshowConfig): number {
	const ms = cfg.transitionMs ?? SLIDESHOW_DEFAULT_TRANSITION_MS;
	if (!Number.isFinite(ms) || ms < 0) return SLIDESHOW_DEFAULT_TRANSITION_MS;
	return Math.min(ms, SLIDESHOW_MAX_TRANSITION_MS);
}

/** A folder path in the form the scope test wants: no leading or trailing
 * slash, with the vault root as the empty string. */
export function normalizeFolderPath(folder: string | undefined): string {
	return (folder ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Whether `path` is inside the card's folder scope. Without `includeSubfolders`
 * only direct children count, so a folder of albums doesn't silently pull in
 * every album. An empty (or "/") scope is the vault root.
 */
export function inSlideshowFolder(
	folder: string | undefined,
	path: string,
	includeSubfolders = false,
): boolean {
	const scope = normalizeFolderPath(folder);
	const prefix = scope === "" ? "" : `${scope}/`;
	if (!path.startsWith(prefix)) return false;
	const rest = path.slice(prefix.length);
	if (rest === "") return false;
	return includeSubfolders || !rest.includes("/");
}

/** Whether `path` is the scope folder itself or one of its ancestors — the
 * shapes a rename can take that move the whole scope somewhere else. */
function holdsFolderScope(folder: string | undefined, path: string): boolean {
	const scope = normalizeFolderPath(folder);
	if (scope === "") return false;
	return scope === path || scope.startsWith(`${path}/`);
}

/** Whether a listed path is, or lives under, an event's path. Covers a folder
 * rename, which arrives as one event for the folder rather than one per file. */
function pathTouches(listed: string, path: string): boolean {
	return listed === path || listed.startsWith(`${path}/`);
}

/**
 * Whether a vault event can change what a slideshow card shows.
 *
 * Only existence events can: a file edit or a metadata reparse never adds or
 * removes a picture, and redrawing on either would restart the rotation from the
 * first slide every time an unrelated note was saved. Beyond that the test is
 * deliberately generous — a needless redraw costs one image decode, while a
 * missed one leaves a folder card blind to the photo just dropped into it.
 */
export function slideshowReactsTo(card: DashboardCard, ev: VaultEvent): boolean {
	if (ev.kind === "modify" || ev.kind === "meta") return false;
	const cfg = card.slideshow ?? {};
	const paths = ev.oldPath ? [ev.file.path, ev.oldPath] : [ev.file.path];
	if (slideshowSource(cfg) === "folder") {
		return paths.some(
			(path) =>
				inSlideshowFolder(cfg.folder, path, cfg.includeSubfolders === true) ||
				holdsFolderScope(cfg.folder, path),
		);
	}
	const listed = (cfg.slides ?? []).map((slide) => slide.path);
	return paths.some((path) => listed.some((entry) => pathTouches(entry, path)));
}

/** Fisher-Yates, in place — the shuffle behind the "random" order. */
export function shufflePictures<T>(items: T[]): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

/**
 * The pictures in display order. Every comparison falls back to the path, so two
 * files sharing a name or a timestamp keep a stable order instead of reshuffling
 * themselves on every redraw. "manual" is the input order; "random" is a fresh
 * shuffle. Never mutates its input.
 */
export function orderPictures(
	pictures: SlideshowPicture[],
	order: SlideshowOrder,
): SlideshowPicture[] {
	const sorted = [...pictures];
	const byPath = (a: SlideshowPicture, b: SlideshowPicture) => a.path.localeCompare(b.path);
	switch (order) {
		case "manual":
			return sorted;
		case "random":
			return shufflePictures(sorted);
		case "name":
			return sorted.sort((a, b) => a.name.localeCompare(b.name) || byPath(a, b));
		case "nameDesc":
			return sorted.sort((a, b) => b.name.localeCompare(a.name) || byPath(a, b));
		case "created":
			return sorted.sort((a, b) => a.created - b.created || byPath(a, b));
		case "createdDesc":
			return sorted.sort((a, b) => b.created - a.created || byPath(a, b));
		case "modified":
			return sorted.sort((a, b) => a.modified - b.modified || byPath(a, b));
		case "modifiedDesc":
			return sorted.sort((a, b) => b.modified - a.modified || byPath(a, b));
	}
}

/** What a picture is called on screen: its own caption, or the file's basename. */
export function pictureLabel(picture: SlideshowPicture): string {
	return picture.caption?.trim() || picture.name;
}
