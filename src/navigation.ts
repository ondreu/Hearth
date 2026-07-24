import type { TFile } from "obsidian";
import type { HomeView } from "./view";

/**
 * Whether a note the user activated from a Hearth card should open in a new tab
 * or reuse the current (Hearth) tab. Central so every card obeys the one global
 * "Open note from link" setting (#106): "current" replaces the home view in
 * place (getLeaf(false) returns the active, navigable Hearth leaf); "tab" (the
 * default) spawns a new tab (getLeaf(true)).
 */
function wantNewLeaf(view: HomeView): boolean {
	return view.plugin.settings.openNoteInLink !== "current";
}

/** Open a resolved note the user activated from a Hearth card, honoring the
 * "Open note from link" setting. */
export function openNoteFromCard(view: HomeView, file: TFile): void {
	void view.app.workspace.getLeaf(wantNewLeaf(view)).openFile(file);
}

/** Open a link by its link text (used when a target isn't a resolved TFile),
 * honoring the "Open note from link" setting. */
export function openLinkFromCard(view: HomeView, linktext: string, sourcePath = ""): void {
	void view.app.workspace.openLinkText(linktext, sourcePath, wantNewLeaf(view));
}

/**
 * Internal id Obsidian registers its core "Web Viewer" plugin (and the view
 * type it hosts) under. Not part of the public API — inferred from Obsidian's
 * own hyphenated core-plugin naming convention (`file-explorer`,
 * `daily-notes`, `audio-recorder`, …) and the `help.obsidian.md/plugins/web-viewer`
 * slug. Unverified against a live install; if it's wrong, only the "current
 * tab" branch below silently falls back to the system browser (see catch).
 */
const WEB_VIEWER_ID = "web-viewer";

/** Open an external URL a user activated from a Hearth card (a URL-type
 * launchpad/mobile-action link), honoring the "Open URL" setting (#106). When
 * Obsidian's core Web Viewer plugin is enabled and the setting is "current",
 * the Hearth tab is replaced with a Web Viewer leaf showing the URL. Otherwise
 * the URL is handed to window.open exactly as before this setting existed —
 * if Web Viewer's own "open external links" option is on, Obsidian intercepts
 * that call itself and routes it into a Web Viewer tab; if Web Viewer isn't
 * enabled, it opens in the system browser. */
export function openUrlFromCard(view: HomeView, url: string): void {
	const wantsCurrentTab = view.plugin.settings.openUrlIn === "current";
	const webViewerEnabled = view.app.internalPlugins.getPluginById(WEB_VIEWER_ID)?.enabled ?? false;
	if (wantsCurrentTab && webViewerEnabled) {
		try {
			const leaf = view.app.workspace.getLeaf(false);
			void leaf.setViewState({ type: WEB_VIEWER_ID, active: true, state: { url } }).catch(() => {
				window.open(url, "_blank");
			});
			return;
		} catch {
			// Fall through to the system browser below.
		}
	}
	window.open(url, "_blank");
}
