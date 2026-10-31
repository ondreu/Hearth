/**
 * Revealing a folder in Obsidian's own file explorer (#448).
 *
 * There is no API for this: the call is the core file-explorer's
 * `revealInFolder`, the same one the search pane makes for a folder result. So
 * every step here is duck-typed and every failure is quiet — the caller falls
 * back to Hearth's own folder browser, which is exactly what the click did
 * before the option existed.
 *
 * Two objects carry the reveal — the core plugin's instance and its view — and
 * either may be the one a future build keeps, so both are asked.
 */

import type { App, TAbstractFile, WorkspaceLeaf } from "obsidian";

/** The view type Obsidian registers its file explorer under. */
const FILE_EXPLORER_VIEW = "file-explorer";

/** Where a click that opens a folder sends it: Hearth's own browser, or
 * Obsidian's file explorer in the sidebar (#448). */
export type FolderDestination = "browser" | "explorer";

/** The destination a card's stored choice means. Undefined is the browser,
 * which is what every folder click did before the choice existed — so a card
 * with no preference keeps behaving exactly as it did. Pure, so the cards that
 * read it and the tests that pin it need no vault. */
export function folderDestination(choice: "explorer" | undefined): FolderDestination {
	return choice === "explorer" ? "explorer" : "browser";
}

/** The slice of an object that can reveal a folder: an internal, all optional. */
interface RevealHolder {
	revealInFolder?: (file: TAbstractFile) => void;
}

/**
 * The reveal an object holds, bound to it, or null when it holds none.
 *
 * Pure — it takes a plain object — so the duck check is testable without
 * Obsidian. The binding matters: the method is called on the view or plugin it
 * came from, and a bare reference would lose its `this`.
 */
export function revealInFolderFn(holder: unknown): ((file: TAbstractFile) => void) | null {
	if (!holder || typeof holder !== "object") return null;
	const fn = (holder as RevealHolder).revealInFolder;
	if (typeof fn !== "function") return null;
	return (file) => {
		fn.call(holder, file);
	};
}

/** The explorer's leaf in the sidebar, opened there first if the user has none.
 *
 * The point of the click is to land in the sidebar, and a reveal into a view
 * that isn't on screen does nothing visible — so a closed explorer is opened
 * rather than silently ignored. A second explorer is never opened: an existing
 * one anywhere is reused. */
async function explorerLeaf(app: App): Promise<WorkspaceLeaf | null> {
	const open = app.workspace.getLeavesOfType(FILE_EXPLORER_VIEW)[0];
	if (open) return open;
	const leaf = app.workspace.getLeftLeaf(false);
	if (!leaf) return null;
	await leaf.setViewState({ type: FILE_EXPLORER_VIEW, active: false });
	return leaf;
}

/**
 * Reveal `path` in the sidebar's file explorer.
 *
 * Resolves false when it could not be done — the core plugin is off, the
 * internal has changed shape, or the folder is gone — and the caller then does
 * what it did before. Never throws: a card that threw on click would be worse
 * than one that opened its browser instead.
 */
export async function revealInExplorer(app: App, path: string): Promise<boolean> {
	try {
		const plugin = app.internalPlugins.getPluginById(FILE_EXPLORER_VIEW);
		if (!plugin || plugin.enabled === false) return false;
		const file = path === "" ? app.vault.getRoot() : app.vault.getAbstractFileByPath(path);
		if (!file) return false;
		const leaf = await explorerLeaf(app);
		const reveal = revealInFolderFn(leaf?.view) ?? revealInFolderFn(plugin.instance);
		if (!reveal) return false;
		reveal(file);
		return true;
	} catch {
		return false;
	}
}
