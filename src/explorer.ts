import { TFile } from "obsidian";
import type HearthPlugin from "./main";

/**
 * Enforce the "Open note from explorer" setting (#106) on Obsidian's own
 * native File Explorer pane — independent of, and never installed by, any of
 * Hearth's own cards.
 *
 * Obsidian's File Explorer isn't part of the public plugin API, so this
 * relies on its DOM structure (`.nav-file-title[data-path]` inside a
 * `[data-type="file-explorer"]` leaf) — a convention that's been stable for
 * years and widely relied on by community plugins/snippets, but not
 * guaranteed. A single capturing click listener is registered once, at
 * plugin load, and cleaned up automatically on unload via
 * `plugin.registerDomEvent`; it no-ops immediately whenever the setting is
 * "default", so nobody who hasn't opted in pays any cost or sees any
 * behaviour change.
 *
 * Only a plain, unmodified left click is intercepted — Ctrl/Cmd/Shift/Alt
 * clicks (and middle-click, which fires "auxclick" instead of "click") are
 * left to Obsidian's own handling so manual new-tab/split-pane gestures keep
 * working exactly as before.
 */
export function registerExplorerOpenOverride(plugin: HearthPlugin): void {
	plugin.registerDomEvent(
		document,
		"click",
		(evt: MouseEvent) => {
			const setting = plugin.settings.openNoteInExplorer;
			if (setting === "default") return;
			if (evt.defaultPrevented || evt.button !== 0) return;
			if (evt.ctrlKey || evt.metaKey || evt.shiftKey || evt.altKey) return;

			const target = evt.target as HTMLElement | null;
			const titleEl = target?.closest<HTMLElement>(".nav-file-title[data-path]");
			if (!titleEl || !titleEl.closest('[data-type="file-explorer"]')) return;

			const path = titleEl.dataset.path;
			if (!path) return;
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return;

			evt.preventDefault();
			evt.stopImmediatePropagation();
			void plugin.app.workspace.getLeaf(setting !== "current").openFile(file);
		},
		{ capture: true },
	);
}
