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
 *  1. **The explorer's own tree.** Each item in the explorer's `fileItems` map
 *     carries its children in display order (`vChildren`). This is the real
 *     answer — it is what the sidebar would draw — and it survives a collapsed
 *     folder, whose rows aren't in the DOM at all.
 *  2. **The rendered rows.** Failing that, the folder's `childrenEl` is scanned
 *     for the `data-path` Obsidian puts on every row. Same order, but only for
 *     a folder that is currently expanded.
 *  3. **The sort setting.** Failing both, the explorer's `sortOrder` string is
 *     mapped onto one of the card's own sorts, so the card still agrees with
 *     the sidebar's *rule* even when it can't see its rows.
 *
 * Every read is internals, so every read is guarded: a throw, a renamed field
 * or a sidebar that was never opened all come back as `null`, and the caller
 * falls through to the next step (and finally to alphabetical).
 */

import type { App } from "obsidian";
import type { FolderSort } from "./foldercontents";

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
}

/** The file explorer's view, or null when the sidebar has never held one. */
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
export function explorerChildOrder(app: App, folderPath: string): string[] | null {
	const view = explorerView(app);
	if (!view) return null;
	try {
		const item = explorerItem(view, folderPath);
		if (!item) return null;
		return fromVirtualChildren(item) ?? fromRenderedRows(item);
	} catch {
		return null;
	}
}

/** Step 1: the explorer's own child list. */
function fromVirtualChildren(item: ExplorerItem): string[] | null {
	const children = item.vChildren?.children ?? item.vChildren?._children;
	if (!Array.isArray(children) || children.length === 0) return null;
	const paths = children
		.map((child) => child?.file?.path)
		.filter((path): path is string => typeof path === "string" && path.length > 0);
	return paths.length > 0 ? paths : null;
}

/** Step 2: the rows Obsidian actually drew, read off their `data-path`. */
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
 * Step 3: the explorer's sort setting, as one of the card's own sorts.
 *
 * Obsidian's ids are its own ("byModifiedTime" means newest first); an id this
 * doesn't know — a future Obsidian, or a plugin's own — maps to the
 * alphabetical order the explorer defaults to rather than to nothing, so the
 * card still shows a sensible list.
 */
export function explorerSortAsFolderSort(app: App): FolderSort {
	const raw = explorerView(app)?.sortOrder;
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
