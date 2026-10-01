import { asFolderSort, FOLDER_SORT_DEFAULT, type FolderShow, type FolderSort } from "./foldercontents";
import { previewSize } from "./notepreview";
import type { CardDesign, FolderCardConfig, PerformanceTier } from "./types";

/**
 * The folder browser's state — what it shows and how — and the path rules the
 * folder card and the browser share. Pure, so a test can reach it; the card
 * and the browser that draw it are in `cards/folder.ts`.
 */

/** The vault root, as this module spells it. Obsidian's own root folder has
 * path "/", which is not a path anything else here would accept. */
export const ROOT = "";

/** A config path as a folder path: trimmed, unslashed, root as `ROOT`. */
export function folderPath(raw: string | undefined): string {
	const clean = (raw ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
	return clean === "" || clean === "/" ? ROOT : clean;
}

/** The browser's own layouts. */
export type BrowserLayout = "list" | "tiles";

/**
 * Everything the browser shows, and how: what a tab persists so it reopens on
 * the same folder after a reload, and what the dialog starts from.
 */
export interface FolderBrowseState {
	path: string;
	sort: FolderSort;
	show: FolderShow;
	counts: boolean;
	layout: BrowserLayout;
	/** Note previews on the tiles. */
	preview: boolean;
	/** The previews' text size, in pixels. */
	previewSize: number;
	/** Pictures on the tiles: an image file's own, a note's first embedded
	 * image as its cover. Only drawn on the Full performance tier — see
	 * {@link picturesAllowed}. */
	images: boolean;
	/** The design the page is drawn in, when it was opened from somewhere that
	 * has one (a card, a dialog). A tab keeps it; left out, it takes the
	 * vault's. Terminal mode is vault-wide and overrides either. */
	design?: CardDesign;
}

/** The browser's state from a card's config, opened on `path`. */
export function browseStateFor(cfg: FolderCardConfig, path: string): FolderBrowseState {
	return {
		path,
		sort: cfg.sort ?? FOLDER_SORT_DEFAULT,
		show: cfg.show ?? "all",
		counts: cfg.counts === true,
		layout: cfg.browserView === "tiles" ? "tiles" : "list",
		preview: cfg.preview !== false,
		previewSize: previewSize(cfg.previewSize),
		images: cfg.images !== false,
	};
}

/**
 * A browse state read back from wherever it was stored — a tab's persisted
 * state, which is `workspace.json` and so anything at all. Every field falls
 * back on its own, so a damaged one costs that field, not the tab.
 */
export function readBrowseState(raw: unknown): FolderBrowseState {
	const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const show = r.show === "folders" || r.show === "files" ? r.show : "all";
	return {
		path: folderPath(typeof r.path === "string" ? r.path : ROOT),
		sort: asFolderSort(r.sort) ?? FOLDER_SORT_DEFAULT,
		show,
		counts: r.counts === true,
		layout: r.layout === "tiles" ? "tiles" : "list",
		preview: r.preview !== false,
		previewSize: previewSize(r.previewSize),
		images: r.images !== false,
		...(r.design === "classic" || r.design === "expressive" ? { design: r.design } : {}),
	};
}

/** The browser's state with nothing but a folder to go on — a bookmark, say:
 * the explorer's order, everything shown, no counts, a list. */
export function defaultBrowseState(path: string): FolderBrowseState {
	return browseStateFor({}, path);
}

/**
 * Whether the browser draws pictures on its tiles: in tiles, with pictures on,
 * and only on the Full performance tier.
 *
 * Obsidian has no thumbnails, so a picture on a tile is the whole file decoded
 * — a phone photo is tens of megapixels — and a folder of them held in memory
 * for as long as the page is open. That is the kind of cost the tiers below
 * Full exist to keep off a machine that can't afford it, and Balanced is the
 * phone's default tier, where it would hurt most. So it is Full only: a tier
 * that has asked for everything gets this too.
 */
export function picturesAllowed(state: FolderBrowseState, tier: PerformanceTier): boolean {
	return state.layout === "tiles" && state.images && tier === "full";
}
