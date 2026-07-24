import type { TFile } from "obsidian";
import type { HomeView } from "./view";

/**
 * Whether a note the user activated from a Hearth card should open in a new tab
 * or reuse the current (Hearth) tab. Central so every card obeys the one global
 * "Open notes in" setting (#106): "current" replaces the home view in place
 * (getLeaf(false) returns the active, navigable Hearth leaf); "tab" (the
 * default) spawns a new tab (getLeaf(true)).
 */
function wantNewLeaf(view: HomeView): boolean {
	return view.plugin.settings.openNoteIn !== "current";
}

/** Open a resolved note the user activated from a Hearth card, honoring the
 * global "Open notes in" setting. */
export function openNoteFromCard(view: HomeView, file: TFile): void {
	void view.app.workspace.getLeaf(wantNewLeaf(view)).openFile(file);
}

/** Open a link by its link text (used when a target isn't a resolved TFile),
 * honoring the global "Open notes in" setting. */
export function openLinkFromCard(view: HomeView, linktext: string, sourcePath = ""): void {
	void view.app.workspace.openLinkText(linktext, sourcePath, wantNewLeaf(view));
}
