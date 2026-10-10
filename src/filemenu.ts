import { TFile, type App, type Menu, type TAbstractFile } from "obsidian";
import { t } from "./i18n";
import { hearthMenu } from "./uidesign";

/** What {@link showFileMenu} needs to build a vault item's menu. */
export interface FileMenuOptions {
	app: App;
	/** Who is asking, passed on to `file-menu` handlers as its `source`. */
	source: string;
	/** Open a file "here" — whatever that means where the menu was opened
	 * (the card's open-in setting, a dialog that closes behind it). Left out
	 * for a menu that only ever shows folders. */
	open?: (file: TFile) => void;
	/** The caller's own entries, after the open ones. */
	extend?: (menu: Menu) => void;
}

/**
 * A file's or a folder's menu: for a file, open it here, in a new tab or to
 * the right; then whatever Obsidian and other plugins add to a vault item's
 * menu — so an item on a card offers what it offers anywhere else in the
 * vault (#389).
 */
export function showFileMenu(
	file: TAbstractFile,
	evt: MouseEvent | KeyboardEvent,
	opts: FileMenuOptions,
): void {
	const { app } = opts;
	const menu = hearthMenu();
	if (file instanceof TFile) {
		const open = opts.open;
		if (open) menu.addItem((i) => i.setTitle(t().tui.open).setIcon("file").onClick(() => open(file)));
		menu.addItem((i) =>
			i.setTitle(t().tui.openNewTab).setIcon("file-plus").onClick(() => void app.workspace.getLeaf("tab").openFile(file)),
		);
		menu.addItem((i) =>
			i.setTitle(t().tui.openSplit).setIcon("columns-3").onClick(() => void app.workspace.getLeaf("split").openFile(file)),
		);
	}
	opts.extend?.(menu);
	menu.addSeparator();
	app.workspace.trigger("file-menu", menu, file, opts.source);
	showMenuFor(menu, evt);
}

/**
 * Give `el` the menu of the vault item at `path` on a right-click (a long
 * press on touch, the menu key from the keyboard). Looked up when asked, not
 * when drawn, so an item renamed or removed since the draw opens nothing.
 */
export function wireFileMenu(el: HTMLElement, path: string, opts: FileMenuOptions): void {
	el.addEventListener("contextmenu", (evt) => {
		const file = opts.app.vault.getAbstractFileByPath(path);
		if (!file) return;
		evt.preventDefault();
		// A row sits inside a card or a section heading that may want the
		// event for itself; this one is the item's.
		evt.stopPropagation();
		showFileMenu(file, evt, opts);
	});
}

/** Show a menu at the pointer, or beside the focused element when it was
 * opened from the keyboard. */
export function showMenuFor(menu: Menu, evt: MouseEvent | KeyboardEvent): void {
	if (evt instanceof MouseEvent && (evt.clientX || evt.clientY)) {
		menu.showAtMouseEvent(evt);
		return;
	}
	const el = evt.target instanceof HTMLElement ? evt.target : document.activeElement;
	const box = el instanceof HTMLElement ? el.getBoundingClientRect() : { left: 0, bottom: 0 };
	menu.showAtPosition({ x: box.left + 16, y: box.bottom });
}
