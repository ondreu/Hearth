import { Notice, TFile, TFolder, type App, type Menu, type OpenViewState, type TAbstractFile } from "obsidian";
import { t } from "./i18n";
import { promptForText } from "./ui";
import { hearthMenu } from "./uidesign";

/**
 * The `source` the file explorer gives `file-menu` handlers. Core plugins
 * (Canvas, Bases, Search, Sync, Publish) and community ones (Git, say) add
 * their entries only for it, so a menu that is to offer what the explorer
 * offers has to say it comes from there (#389).
 */
export const EXPLORER_SOURCE = "file-explorer-context-menu";

/** The order the file explorer puts its menu's sections in; entries without
 * a section go where the empty one is. Without it, sections come in the
 * order their first entry was added. */
const SECTIONS = ["title", "open", "action-primary", "action", "info", "info.copy", "view", "system", "", "danger"];

/** What {@link showFileMenu} needs to build a vault item's menu. */
export interface FileMenuOptions {
	app: App;
	/** Who is asking, passed on to `file-menu` handlers as its `source`.
	 * {@link EXPLORER_SOURCE} also adds the entries the explorer draws itself,
	 * since the handlers given that source take those to be there already. */
	source: string;
	/** Open a file "here" — whatever that means where the menu was opened
	 * (the card's open-in setting, a dialog that closes behind it). */
	open: (file: TFile, state?: OpenViewState) => void;
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
	// Not public API; without it the sections fall in the order they were
	// first used, which still groups them.
	(menu as Menu & { addSections?: (sections: string[]) => Menu }).addSections?.(SECTIONS);
	if (file instanceof TFile) {
		menu.addItem((i) => i.setSection("open").setTitle(t().tui.open).setIcon("file").onClick(() => opts.open(file)));
		menu.addItem((i) =>
			i
				.setSection("open")
				.setTitle(t().tui.openNewTab)
				.setIcon("file-plus")
				.onClick(() => void app.workspace.getLeaf("tab").openFile(file)),
		);
		menu.addItem((i) =>
			i
				.setSection("open")
				.setTitle(t().tui.openSplit)
				.setIcon("columns-3")
				.onClick(() => void app.workspace.getLeaf("split").openFile(file)),
		);
	}
	opts.extend?.(menu);
	if (opts.source === EXPLORER_SOURCE) explorerEntries(menu, file, opts);
	app.workspace.trigger("file-menu", menu, file, opts.source);
	showMenuFor(menu, evt);
}

/**
 * What the file explorer adds to an item's menu itself, before it asks the
 * plugins: a new note or folder in a folder, and rename, copy and delete.
 * Done through the public API, so a few details differ from the explorer's:
 * a new folder and a rename ask for the name in a dialog rather than in the
 * tree, which a card hasn't got.
 */
function explorerEntries(menu: Menu, file: TAbstractFile, opts: FileMenuOptions): void {
	const s = t().fileMenu;
	const root = file instanceof TFolder && file.isRoot();
	if (file instanceof TFolder) {
		menu.addItem((i) =>
			i
				.setSection("action-primary")
				.setTitle(s.newNote)
				.setIcon("edit")
				.onClick(() => attempt(() => newNote(file, opts))),
		);
		menu.addItem((i) =>
			i
				.setSection("action-primary")
				.setTitle(s.newFolder)
				.setIcon("folder-open")
				.onClick(() => attempt(() => newFolder(opts.app, file))),
		);
	}
	if (root) return;
	menu.addItem((i) =>
		i
			.setSection("action")
			.setTitle(s.makeCopy)
			.setIcon("files")
			.onClick(() => attempt(() => makeCopy(file, opts))),
	);
	menu.addItem((i) =>
		i
			.setSection("danger")
			.setTitle(s.rename)
			.setIcon("edit-3")
			.onClick(() => attempt(() => rename(opts.app, file))),
	);
	menu.addItem((i) =>
		i
			.setSection("danger")
			.setTitle(s.delete)
			.setIcon("trash-2")
			.setWarning(true)
			.onClick(() => void opts.app.fileManager.promptForDeletion(file)),
	);
}

/** A file just made, opened the way the explorer opens one: in the editor,
 * with its title selected to be typed over. */
const FRESH: OpenViewState = { active: true, state: { mode: "source" }, eState: { rename: "all" } };

async function newNote(folder: TFolder, opts: FileMenuOptions): Promise<void> {
	const path = availablePath(dirPrefix(folder), t().fileMenu.untitled, "md", taken(opts.app));
	const file = await opts.app.vault.create(path, "");
	opts.open(file, FRESH);
}

async function newFolder(app: App, parent: TFolder): Promise<void> {
	const s = t().fileMenu;
	const name = cleanName(await promptForText(app, { title: s.newFolder, label: s.folderName }));
	if (name === null) return;
	const path = dirPrefix(parent) + name;
	if (app.vault.getAbstractFileByPath(path)) throw new Error(s.exists(name));
	await app.vault.createFolder(path);
}

async function makeCopy(file: TAbstractFile, opts: FileMenuOptions): Promise<void> {
	const dir = dirPrefix(file.parent);
	const path =
		file instanceof TFile
			? availablePath(dir, file.basename, file.extension, taken(opts.app))
			: availablePath(dir, file.name, "", taken(opts.app));
	const copy = await opts.app.vault.copy(file, path);
	if (copy instanceof TFile) opts.open(copy, FRESH);
}

async function rename(app: App, file: TAbstractFile): Promise<void> {
	const s = t().fileMenu;
	const ext = file instanceof TFile ? file.extension : "";
	const current = file instanceof TFile ? file.basename : file.name;
	let name = cleanName(await promptForText(app, { title: s.rename, label: s.newName, initial: current }));
	if (name === null || name === current) return;
	// Typed with its extension, the name keeps just the one.
	if (ext && name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) name = name.slice(0, -ext.length - 1);
	const path = dirPrefix(file.parent) + (ext ? `${name}.${ext}` : name);
	if (path === file.path) return;
	if (app.vault.getAbstractFileByPath(path)) throw new Error(s.exists(name));
	await app.fileManager.renameFile(file, path);
}

/** A typed name, trimmed; null for a cancelled or empty one. Throws for a
 * name that would be a path. */
function cleanName(typed: string | null): string | null {
	const name = typed?.trim() ?? "";
	if (!name) return null;
	if (/[/\\:]/.test(name)) throw new Error(t().fileMenu.invalidName);
	return name;
}

/** Run a menu action, saying what went wrong rather than dropping it. */
function attempt(run: () => Promise<void>): void {
	run().catch((err: unknown) => new Notice(err instanceof Error ? err.message : String(err)));
}

function taken(app: App): (path: string) => boolean {
	return (path) => app.vault.getAbstractFileByPath(path) !== null;
}

/** The prefix a child of `folder` has in its path: "" at the vault's root. */
function dirPrefix(folder: TFolder | null): string {
	return !folder || folder.isRoot() ? "" : `${folder.path}/`;
}

/**
 * The first free path for `base` in a folder, numbered the way Obsidian
 * numbers them: `Untitled`, `Untitled 1`, `Untitled 2`…
 */
export function availablePath(dir: string, base: string, ext: string, isTaken: (path: string) => boolean): string {
	const dot = ext ? `.${ext}` : "";
	for (let n = 0; ; n++) {
		const path = `${dir}${n === 0 ? base : `${base} ${n}`}${dot}`;
		if (!isTaken(path)) return path;
	}
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
