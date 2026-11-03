/**
 * Reading the file explorer's order out of Obsidian's sidebar (#329).
 *
 * The folder card's default sort is "whatever the explorer shows", because that
 * is the order the user already arranged their vault into — and because a
 * plugin that reorders the explorer (Flexplorer, and friends) then reorders the
 * card too, which no sort of our own could reproduce.
 *
 * There is no API for this, so it is read in three steps, most faithful first:
 *
 *  1. **Ask the explorer to sort the folder.** `getSortedFolderItems(folder)`
 *     is the call the sidebar itself makes to put one folder's children in
 *     order, so its answer *is* what the sidebar shows — as far as the
 *     explorer has built that much of itself: it hands back the tree items it
 *     holds and drops the children it has none for. A sidebar that was never
 *     on screen holds almost none, so its answer covers the folder only
 *     sometimes (see {@link explorerChildOrder}). It is also the method a
 *     reordering plugin patches: Flexplorer replaces it on the view's
 *     prototype and returns its own custom order, which is how a drag in the
 *     sidebar reaches the card.
 *  2. **The explorer's own tree.** Failing that, each item in the `fileItems`
 *     map carries its children in display order (`vChildren`).
 *  3. **The rendered rows.** Failing that, the folder's `childrenEl` is scanned
 *     for the `data-path` Obsidian puts on every row — same order, but only for
 *     a folder that is currently expanded.
 *
 * And failing all three, {@link explorerSortAsFolderSort} maps the explorer's
 * `sortOrder` string onto one of the card's own sorts, so the card still agrees
 * with the sidebar's *rule* even when it cannot see its order.
 *
 * Every read is internals, so every read is guarded: a throw, a renamed field
 * or a sidebar that was never opened all come back as `null`, and the caller
 * falls through to the next step (and finally to alphabetical).
 *
 * What this cannot see is an item a plugin has *hidden* rather than moved:
 * Flexplorer hides by putting a class on the row it already sorted, so a hidden
 * file is still in the order and still on the card.
 */

import type { App, TAbstractFile, TFolder, WorkspaceLeaf } from "obsidian";
import { orderNamesEvery, type FolderSort } from "./foldercontents";

/** The view type Obsidian registers its file explorer under. */
const FILE_EXPLORER_VIEW = "file-explorer";

/** The key the explorer files the vault root under. */
const ROOT_KEY = "/";

/** The slice of an explorer tree item this module reads. All optional: it is
 * an internal, and a future Obsidian may not have any of it. */
interface ExplorerItem {
	file?: { path?: string };
	childrenEl?: HTMLElement;
	vChildren?: { children?: ExplorerItem[]; _children?: ExplorerItem[] };
}

interface ExplorerView {
	sortOrder?: string;
	fileItems?: Record<string, ExplorerItem>;
	/** How the explorer orders one folder's children — the method a reordering
	 * plugin patches. Returns its tree items, each wrapping a vault file. */
	getSortedFolderItems?: (folder: TAbstractFile) => { file?: { path?: string } }[];
}

/** The explorer's leaf in the sidebar — or a leaf holding a view Obsidian has
 * not built yet, see {@link explorerView}. */
function explorerLeaf(app: App): WorkspaceLeaf | null {
	try {
		return app.workspace.getLeavesOfType(FILE_EXPLORER_VIEW)[0] ?? null;
	} catch {
		return null;
	}
}

/**
 * The file explorer's view, or null when the sidebar has never held one.
 *
 * A collapsed sidebar holds a *deferred* view: Obsidian keeps the leaf and its
 * saved state but builds the explorer only once it is on screen, so what this
 * returns there is a placeholder with none of the fields below on it (#439).
 */
function explorerView(app: App): ExplorerView | null {
	try {
		const leaf = app.workspace.getLeavesOfType(FILE_EXPLORER_VIEW)[0];
		return (leaf?.view as unknown as ExplorerView) ?? null;
	} catch {
		return null;
	}
}

/** The explorer's item for a folder path ("" is the vault root). */
function explorerItem(view: ExplorerView, folderPath: string): ExplorerItem | null {
	const items = view.fileItems;
	if (!items) return null;
	return items[folderPath === "" ? ROOT_KEY : folderPath] ?? items[folderPath] ?? null;
}

/**
 * The paths of a folder's children, in the exact order the sidebar has them,
 * or null when the explorer can't be read.
 *
 * Only the folder's own level is returned; a descendant row of an expanded
 * subfolder is not, because the caller is ordering one level at a time.
 */
export function explorerChildOrder(app: App, folder: TFolder): string[] | null {
	const view = explorerView(app);
	if (!view) return null;
	try {
		const order = askedOrder(view, folder);
		// The explorer answers with the tree items it has built, so a sidebar
		// that was never on screen — or a folder never opened in it — answers
		// with nothing, or with the part of the list it has (#439). Taking
		// that as the order would leave the rest at the end, in whatever order
		// they arrived in, which is the sidebar's order in neither half.
		if (!order) return null;
		return orderNamesEvery(
			folder.children.map((child) => child.path),
			order,
		)
			? order
			: null;
	} catch {
		return null;
	}
}

/** The first of the three reads that answered, or null when none did. */
function askedOrder(view: ExplorerView, folder: TFolder): string[] | null {
	const asked = fromSortedFolderItems(view, folder);
	if (asked) return asked;
	const item = explorerItem(view, folder.path);
	if (!item) return null;
	return fromVirtualChildren(item) ?? fromRenderedRows(item);
}

/** Step 1: the explorer's own answer for this folder. */
function fromSortedFolderItems(view: ExplorerView, folder: TFolder): string[] | null {
	const sorted = view.getSortedFolderItems?.(folder);
	if (!Array.isArray(sorted) || sorted.length === 0) return null;
	return pathsOf(sorted);
}

/** Step 2: the explorer's own child list. */
function fromVirtualChildren(item: ExplorerItem): string[] | null {
	const children = item.vChildren?.children ?? item.vChildren?._children;
	if (!Array.isArray(children) || children.length === 0) return null;
	return pathsOf(children);
}

/** The vault paths out of a list of tree items, dropping anything shaped
 * unexpectedly rather than putting an empty string in the order. */
function pathsOf(items: { file?: { path?: string } }[]): string[] | null {
	const paths = items
		.map((item) => item?.file?.path)
		.filter((path): path is string => typeof path === "string" && path.length > 0);
	return paths.length > 0 ? paths : null;
}

/** Step 3: the rows Obsidian actually drew, read off their `data-path`. */
function fromRenderedRows(item: ExplorerItem): string[] | null {
	const container = item.childrenEl;
	if (!container) return null;
	const paths: string[] = [];
	for (const child of Array.from(container.children)) {
		// The first `data-path` inside a row is the row's own title; a nested
		// expanded folder's rows sit below it and are skipped by construction,
		// since only the direct children of `childrenEl` are walked.
		const titled = child.querySelector("[data-path]") ?? child;
		const path = titled.getAttribute?.("data-path");
		if (path) paths.push(path);
	}
	return paths.length > 0 ? paths : null;
}

/**
 * The sort the explorer is *set* to — from the view when Obsidian has built it,
 * else from the state the leaf still carries.
 *
 * A collapsed sidebar keeps the view deferred (see {@link explorerView}), so
 * asking the view alone answered "nothing" and the caller then assumed the
 * explorer's default — alphabetical — whatever the sidebar was actually set to
 * (#439). The view state is where the explorer saves its own setting, and a
 * deferred leaf still holds it.
 */
function explorerSortOrder(app: App): string | undefined {
	const live = explorerView(app)?.sortOrder;
	if (typeof live === "string") return live;
	try {
		const state = explorerLeaf(app)?.getViewState().state as { sortOrder?: unknown } | undefined;
		return typeof state?.sortOrder === "string" ? state.sortOrder : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The last resort: the explorer's sort setting, as one of the card's own sorts.
 *
 * Obsidian's ids are its own ("byModifiedTime" means newest first); an id this
 * doesn't know — a future Obsidian, or a plugin's own — maps to the
 * alphabetical order the explorer defaults to rather than to nothing, so the
 * card still shows a sensible list.
 */
export function explorerSortAsFolderSort(app: App): FolderSort {
	const raw = explorerSortOrder(app);
	switch (raw) {
		case "alphabeticalReverse":
			return "nameDesc";
		case "byModifiedTime":
			return "modified";
		case "byModifiedTimeReverse":
			return "modifiedAsc";
		case "byCreatedTime":
			return "created";
		case "byCreatedTimeReverse":
			return "createdAsc";
		default:
			return "name";
	}
}
