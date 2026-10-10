import { Component, debounce, getLinkpath, Keymap, Setting, TAbstractFile, TFile, TFolder, type App, type EventRef } from "obsidian";
import { setIcon } from "../glyphs";
import { currentUiDesign, DESIGN_ATTR, HearthModal } from "../uidesign";
import { cardOverlayButton, emptyState, redrawCard, resetCardBody } from "../cardbodies";
import { addResetButton } from "../editors";
import { explorerChildOrder, explorerSortAsFolderSort } from "../explorerorder";
import { wireFileMenu, type FileMenuOptions } from "../filemenu";
import { applyFileIcon, fileIconOptions, resolveFileIcon, type FileIconOptions } from "../fileicons";
import { isImageFile } from "../filetypes";
import {
	asFolderSort,
	browserTouches,
	filterFolderEntries,
	FOLDER_SORT_DEFAULT,
	FOLDER_SORTS,
	folderTouches,
	folderTrail,
	groupFolderEntries,
	orderByPaths,
	parentPath,
	pathWithin,
	sortFolderEntries,
	type FolderEntry,
	type FolderShow,
	type FolderSort,
} from "../foldercontents";
import {
	browseStateFor,
	folderPath,
	picturesAllowed,
	readBrowseState,
	ROOT,
	type FolderBrowseState,
} from "../folderbrowse";
import { explorerTitles, type TitleOf } from "../frontmattertitle";
import { t } from "../i18n";
import { notePreviewText, PREVIEW_SIZE, previewSize } from "../notepreview";
import { openFile, type OpenFrom } from "../opener";
import { FolderPickerModal } from "../pickers";
import { type DashboardCard, effectiveCardDesign, type FolderCardConfig, type HomeSettings, performanceTier } from "../types";
import { dressModal, makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";

// The browse state and the path rules are pure, so they live where a test can
// reach them; re-exported for everything that has always imported them here.
export { browseStateFor, defaultBrowseState, folderPath, picturesAllowed, readBrowseState, ROOT } from "../folderbrowse";
export type { BrowserLayout, FolderBrowseState } from "../folderbrowse";


// ---- Folder contents ----------------------------------------------------

/** Rows on the card when the config names no count. The browser the card opens
 * is the place for the whole folder, so the card itself stays a glance. */
export const CARD_COUNT_DEFAULT = 12;

/** The folder a path names, or null when it names nothing (or names a file —
 * a card whose folder was replaced by a note must say so, not list the note's
 * siblings). */
export function folderAt(app: App, path: string): TFolder | null {
	if (path === ROOT) return app.vault.getRoot();
	const found = app.vault.getAbstractFileByPath(path);
	return found instanceof TFolder ? found : null;
}

/** One vault child, flattened onto the shape the ordering rules work on.
 * A file's name is the title the explorer shows for it when Front Matter
 * Title gives it one (#375), so the orders by name sort what the row says. */
function toEntry(file: TAbstractFile, titles: TitleOf | null): FolderEntry {
	if (file instanceof TFolder) {
		return { path: file.path, name: file.name, isFolder: true, mtime: 0, ctime: 0, extension: "" };
	}
	if (file instanceof TFile) {
		return {
			path: file.path,
			name: titles?.(file.path) ?? file.basename,
			isFolder: false,
			mtime: file.stat?.mtime ?? 0,
			ctime: file.stat?.ctime ?? 0,
			extension: (file.extension ?? "").toLowerCase(),
		};
	}
	// Neither a folder nor a file: not a shape the vault produces, but the
	// listing is drawn from `children` and must not lose an entry to it.
	return { path: file.path, name: file.name, isFolder: false, mtime: 0, ctime: 0, extension: "" };
}

/**
 * A folder's immediate children, filtered and ordered — the one place the card,
 * the browser and the folder sections all get their listing from.
 *
 * `explorer` is resolved here: the sidebar's own order when it can be read,
 * and otherwise the sort the sidebar is set to, so the card agrees with the
 * explorer's rule even when the explorer isn't open to be read.
 *
 * `titles` names the files the way the explorer does (see
 * `frontmattertitle.ts`); left out, every file is listed by its file name.
 */
export function folderEntries(
	app: App,
	folder: TFolder,
	sort: FolderSort,
	show: FolderShow,
	titles: TitleOf | null = null,
): FolderEntry[] {
	const kept = filterFolderEntries(
		folder.children.map((child) => toEntry(child, titles)),
		show,
	);
	if (sort !== "explorer") return sortFolderEntries(kept, sort);
	const order = explorerChildOrder(app, folder);
	return order
		? orderByPaths(kept, order)
		: sortFolderEntries(kept, explorerSortAsFolderSort(app));
}

/** The children of a listed subfolder, for the extra level the browser shows
 * under each folder section. An unreadable path yields nothing rather than
 * throwing mid-draw. */
function childEntries(
	app: App,
	entry: FolderEntry,
	sort: FolderSort,
	show: FolderShow,
	titles: TitleOf | null,
): FolderEntry[] {
	const folder = folderAt(app, entry.path);
	return folder ? folderEntries(app, folder, sort, show, titles) : [];
}

/** How many things a subfolder holds, for the optional count badge. Its own
 * level only — a number that counted the whole subtree would say something the
 * row it sits on doesn't. */
export function childCount(app: App, path: string): number {
	return folderAt(app, path)?.children.length ?? 0;
}


// ---- Where the card is looking ------------------------------------------

/**
 * The folder each card has been walked into, keyed by the card object.
 *
 * Transient on purpose, the way the embed card remembers which of its two views
 * is showing (`activeEmbedView`): the card objects live in settings and are
 * reused across redraws and view rebuilds, so a step into a subfolder survives
 * arranging, a dashboard switch and a tab reopen — and resets to the card's own
 * folder when Obsidian reloads. Writing it to the config instead would mean
 * every click into a subfolder rewrote the board, synced it to the user's other
 * devices, and shipped someone else's reading position in a shared dashboard.
 *
 * One entry serves both ways of browsing: the card's own position when it
 * navigates in place, and where the browser dialog reopens otherwise.
 */
export const browsedPath = new WeakMap<DashboardCard, string>();

/**
 * Where this card is looking now: the folder it was walked into, as long as
 * that is still the card's own folder or somewhere under it and still exists.
 * Anything else — the configured folder was changed, or the one being read was
 * deleted or renamed away — falls back to the card's own folder rather than
 * leaving the card pointed somewhere it was never set to.
 */
export function currentPath(app: App, card: DashboardCard, root: string): string {
	const at = browsedPath.get(card);
	if (at === undefined || at === root) return root;
	if (!pathWithin(at, root) || !folderAt(app, at)) {
		browsedPath.delete(card);
		return root;
	}
	return at;
}


// ---- The card -----------------------------------------------------------

export function renderFolder(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.folder ?? {};
	const root = folderPath(cfg.path);
	const inCard = cfg.navigate === "card";
	// Only a card that navigates in place shows where it was walked to; one that
	// browses in the dialog always draws its own folder, and the walked-to path
	// is only where that dialog reopens.
	const path = inCard ? currentPath(view.app, card, root) : root;
	const folder = folderAt(view.app, path);
	if (!folder) {
		emptyState(body, "folder-x", t().cards.empty.folderMissing(cfg.path ?? ""));
		return;
	}

	const sort = cfg.sort ?? FOLDER_SORT_DEFAULT;
	const show = cfg.show ?? "all";
	const entries = folderEntries(view.app, folder, sort, show, explorerTitles(view.app, view.plugin.settings));
	const browse = cfg.browse !== false;
	/** Redraw through the board, so the previous draw's component and its
	 * overlay button go with it; off the board (a preview) there is no
	 * registered redraw, so the body is reset and repainted by hand. */
	const refresh = () => {
		if (redrawCard(body)) return;
		resetCardBody(body, body.className);
		renderFolder(view, card, body);
	};
	const walkTo = (at: string) => {
		browsedPath.set(card, at);
		refresh();
	};
	const open = (at: string) =>
		openFolderBrowser(view, {
			...browseStateFor(cfg, at),
			inTab: cfg.browseIn === "tab",
			expressive: effectiveCardDesign(view.plugin.settings, card.design) === "expressive",
			// The dialog is the same reader in the same card: where they walk to
			// there is where the card reopens, and where an in-card card is.
			remember: (to) => {
				browsedPath.set(card, to);
				if (inCard) refresh();
			},
		});

	if (browse) {
		// The click target for the browser is the body's empty space, which a
		// full card hasn't got — so the affordance is also a button, the way the
		// daily and embed cards offer theirs.
		cardOverlayButton(body, "folder-tree", t().cards.folder.browse, (evt) => {
			evt.stopPropagation();
			open(path);
		});
		body.addEventListener("click", (evt) => {
			const target = evt.target;
			// Everything the body draws that handles its own click — a row, a
			// tile, the path row, the "N more" footer — is left to it, or the
			// browser would open twice on the footer and over the note on a row.
			const own = ".hearth-list-item, .hearth-link-tile, .hearth-folder-more, .hearth-folder-nav";
			if (target instanceof HTMLElement && target.closest(own)) return;
			open(path);
		});
	}

	if (inCard && path !== root) drawCardNav(body, path, root, walkTo);

	if (entries.length === 0) {
		emptyState(body, "folder-open", t().cards.empty.folderEmpty);
		return;
	}

	const limit = cfg.count && cfg.count > 0 ? cfg.count : CARD_COUNT_DEFAULT;
	const shown = entries.slice(0, limit);
	const activate = (entry: FolderEntry, evt?: MouseEvent) => {
		if (entry.isFolder) {
			if (inCard) walkTo(entry.path);
			else open(entry.path);
			return;
		}
		const file = view.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) void openFile(view, file, "card", evt);
	};

	if ((cfg.view ?? "list") === "tiles") renderFolderTiles(view, body, shown, cfg, activate);
	else renderFolderList(view, body, shown, cfg, activate);

	// What the card is not showing — otherwise a folder of 300 notes looks like
	// a folder of 12. Said even with the browser turned off, where it is the
	// only thing that can say it; it just isn't a way in then.
	const rest = entries.length - shown.length;
	if (rest > 0) {
		const more = body.createDiv({ cls: "hearth-folder-more", text: t().cards.folder.more(rest) });
		more.toggleClass("is-static", !browse);
		if (browse) {
			makeClickable(more, () => open(path), t().cards.folder.browse);
			more.addEventListener("click", () => open(path));
		}
	}
}


/**
 * The path row a card grows once it has been walked below its own folder: where
 * you are, and the way back up.
 *
 * Only the arrow acts — the text beside it says where the card is, and a label
 * that navigated somewhere other than where it points would be a trap. The
 * whole trail is the row's tooltip, since a narrow card has room for one line.
 */
function drawCardNav(
	body: HTMLElement,
	path: string,
	root: string,
	walkTo: (at: string) => void,
): void {
	const nav = body.createDiv("hearth-folder-nav");
	// Never above the card's own folder: the card is that folder, and a reader
	// who could climb out of it would be looking at a card that isn't this one.
	const up = path === root ? root : maxPath(parentPath(path), root);
	const upName = up === ROOT ? t().cards.folder.vaultRoot : (up.split("/").pop() ?? up);
	const button = nav.createDiv("hearth-folder-up");
	setIcon(button, "chevron-left");
	const go = () => walkTo(up);
	button.addEventListener("click", go);
	makeClickable(button, go, t().cards.folder.up(upName));

	// The path from the card's own folder down, which is the part the card's
	// title doesn't already say.
	const here = root === ROOT ? path : path.slice(root.length + 1);
	nav.createDiv({ cls: "hearth-folder-here", text: here, attr: { title: path } });
}

/** `path` unless it has climbed above `root`, which it must not. */
export function maxPath(path: string, root: string): string {
	return pathWithin(path, root) ? path : root;
}


function renderFolderList(
	view: HomeView,
	body: HTMLElement,
	entries: FolderEntry[],
	cfg: FolderCardConfig,
	activate: (entry: FolderEntry, evt?: MouseEvent) => void,
): void {
	const list = body.createDiv("hearth-list");
	const icons = fileIconOptions(view.plugin.settings);
	for (const entry of entries) {
		const row = list.createDiv("hearth-list-item");
		row.toggleClass("is-folder", entry.isFolder);
		applyFileIcon(row.createDiv("hearth-list-icon"), entryIcon(view.app, entry, icons));
		row.createDiv({ cls: "hearth-list-label", text: entry.name });
		if (entry.isFolder && cfg.counts === true) {
			row.createDiv({ cls: "hearth-folder-count", text: String(childCount(view.app, entry.path)) });
		}
		row.addEventListener("click", (evt) => activate(entry, evt));
		makeClickable(row, () => activate(entry), entry.name);
		wireFileMenu(row, entry.path, cardFileMenu(view));
	}
}


function renderFolderTiles(
	view: HomeView,
	body: HTMLElement,
	entries: FolderEntry[],
	cfg: FolderCardConfig,
	activate: (entry: FolderEntry, evt?: MouseEvent) => void,
): void {
	// Not the links card's grid: those tiles carry a user-chosen span in its
	// fine 44×34 cells, and a folder tile has none to carry — it is sized by
	// what is in it (see the CSS). Only the tile's own look is shared.
	const grid = body.createDiv("hearth-folder-tiles");
	const icons = fileIconOptions(view.plugin.settings);
	for (const entry of entries) {
		const tile = grid.createDiv("hearth-link-tile");
		tile.toggleClass("is-folder", entry.isFolder);
		applyFileIcon(tile.createDiv("hearth-link-icon"), entryIcon(view.app, entry, icons));
		tile.createDiv({ cls: "hearth-link-label", text: entry.name });
		if (entry.isFolder && cfg.counts === true) {
			tile.createDiv({ cls: "hearth-folder-count", text: String(childCount(view.app, entry.path)) });
		}
		tile.addEventListener("click", (evt) => activate(entry, evt));
		makeClickable(tile, () => activate(entry), entry.name);
		wireFileMenu(tile, entry.path, cardFileMenu(view));
	}
}


/** What a right-click on a card's row offers (#389): the file opens the way
 * the card opens notes. */
function cardFileMenu(view: HomeView): FileMenuOptions {
	return {
		app: view.app,
		source: FILE_MENU_SOURCE,
		open: (file) => void openFile(view, file, "card"),
	};
}

/** The `source` the folder card and its browser give `file-menu` handlers. */
const FILE_MENU_SOURCE = "hearth-folder";


/** The icon a row shows. Resolved from the vault's own object, so a folder the
 * user gave an icon (Iconic and Iconize both do folders) keeps it here. The
 * plain glyph is the fallback for a path that went away between the listing
 * and the draw. */
function entryIcon(app: App, entry: FolderEntry, icons: FileIconOptions) {
	const file = app.vault.getAbstractFileByPath(entry.path);
	if (file) return resolveFileIcon(app, file, icons);
	return entry.isFolder ? "folder" : "file";
}


// ---- The browser (the folder's own page) --------------------------------

/** The view type the folder browser registers under when it opens in a tab
 * (`folderview.ts`). Declared here so the card can open one without importing
 * the view, which imports this module. */
export const VIEW_TYPE_FOLDER = "hearth-folder-view";

interface BrowseOptions extends FolderBrowseState {
	/** Open in a tab of its own instead of the dialog. */
	inTab?: boolean;
	/** Told where the reader walked to, so the card it came from reopens there
	 * (and follows along when it navigates in place). The dialog only: a tab
	 * is a page of its own, and walking it must not move the card. */
	remember?: (path: string) => void;
	/** Draw the dialog in the Expressive design (see dressModal). Left out, it
	 * takes the design of wherever it was opened from (src/uidesign.ts). */
	expressive?: boolean;
}

/** Open the folder browser at a path — in the dialog, or in a tab when the
 * options ask for one. Exported for the card and for anything else that
 * wants to hand the user a folder. */
export function openFolderBrowser(view: HomeView, opts: BrowseOptions): void {
	if (opts.inTab) {
		// The tab is drawn in the design of what opened it, as the dialog
		// would have been: the card's when it says, else the press's.
		const design =
			opts.expressive === undefined ? currentUiDesign() : opts.expressive ? "expressive" : "classic";
		void openFolderTab(view.app, { ...stateOf(opts), design });
		return;
	}
	const modal = new FolderBrowserModal(view, opts);
	if (opts.expressive !== undefined) dressModal(modal, opts.expressive);
	modal.open();
}

/** Just the state out of a set of options, for a tab to persist — the
 * callbacks and the design are the dialog's. */
function stateOf(opts: FolderBrowseState): FolderBrowseState {
	const { path, sort, show, counts, layout, preview, previewSize, images, design } = opts;
	return { path, sort, show, counts, layout, preview, previewSize, images, design };
}

/**
 * Open the browser in a tab. A tab already showing the same folder is brought
 * forward rather than joined by a second one, so a card clicked twice doesn't
 * leave two identical tabs behind.
 */
export async function openFolderTab(app: App, state: FolderBrowseState): Promise<void> {
	const existing = app.workspace
		.getLeavesOfType(VIEW_TYPE_FOLDER)
		.find((leaf) => readBrowseState(leaf.getViewState().state).path === state.path);
	if (existing) {
		await app.workspace.revealLeaf(existing);
		return;
	}
	const leaf = app.workspace.getLeaf("tab");
	await leaf.setViewState({
		type: VIEW_TYPE_FOLDER,
		state: { ...state },
		active: true,
	});
}

/**
 * The subfolder sections the reader has folded, by path — in every browser,
 * the dialog and the tabs alike, so a folder folded in one is folded in the
 * next. For the session only, like where a card has been walked to: folding a
 * section is how you are reading the folder now, not something the board or
 * the vault should carry (and a folded section is one click from open).
 */
const foldedSections = new Set<string>();

/** What the browser needs from whatever holds it: the dialog or the tab. */
export interface BrowserHost {
	app: App;
	settings: HomeSettings;
	/** Where a note opened from the browser goes from (see `opener.ts`). */
	opener: OpenFrom;
	/** Name the page: the dialog's title, the tab's header. */
	setTitle(text: string): void;
	/** A plain click opened a note. The dialog closes, so the note it opened
	 * isn't hidden behind it; a tab has nothing to get out of the way of. */
	opened?(): void;
	/** Take over navigation. A tab routes each step through its view state,
	 * which is what puts it in the tab's back/forward history; the dialog
	 * leaves it to the browser. */
	navigate?(path: string): void;
	/** Something the reader changed — the folder, the sort, the layout. */
	changed?(state: FolderBrowseState): void;
	/** Move the browser to a tab, offered by the dialog only. */
	popOut?(state: FolderBrowseState): void;
}

/**
 * A folder, in full: the trail down to it, then its contents with every
 * subfolder opened one extra level (#329).
 *
 * The card can only be a glance — it is a few rows on a board — so this is
 * where a folder is actually browsed. Two things make it a browser rather than
 * a bigger card: the breadcrumb, and the fact that every folder on the page,
 * heading or row, navigates the same page to itself. Walking into a subfolder
 * and back out never touches the board or the card's settings; the sort picker
 * and the layout switch are the browser's own, for the same reason.
 *
 * It draws into a host — the dialog over the board, or a tab of its own
 * (#375) — and the two differ only in what {@link BrowserHost} says.
 */
export class FolderBrowser {
	state: FolderBrowseState;
	private previews: PreviewLoader | null = null;
	/** Whether this draw puts pictures on the tiles (see picturesAllowed). */
	private pictures = false;
	/** The subfolder sections on the page, by path, and the bar button that
	 * folds or opens them all. */
	private sections: string[] = [];
	private foldAllButton: HTMLElement | null = null;

	constructor(
		private readonly host: BrowserHost,
		private readonly el: HTMLElement,
		state: FolderBrowseState,
	) {
		this.state = { ...state };
		el.addClass("hearth-folder-browser");
	}

	/** Show another state — the tab's history moving, say. */
	setState(state: FolderBrowseState): void {
		const moved = state.path !== this.state.path;
		this.state = { ...state };
		// A step into a deep folder starts where the last one left off, which is
		// rarely what you want to read.
		if (moved) this.el.scrollTop = 0;
		this.draw();
	}

	/** Stop loading previews; the page is going away. */
	destroy(): void {
		this.previews?.disconnect();
		this.previews = null;
	}

	/** Repaint from scratch on every navigation and sort change: at a folder's
	 * size this costs nothing, and it keeps one drawing path for the first open,
	 * a step into a subfolder and a step back out. */
	draw(): void {
		const app = this.host.app;
		const { path, sort, show } = this.state;
		this.destroy();
		this.host.setTitle(folderTitle(app, path));
		this.el.empty();
		this.el.toggleClass("is-tiles", this.state.layout === "tiles");
		this.el.style.setProperty("--hearth-folder-preview-size", `${this.state.previewSize}px`);
		const folder = folderAt(app, path);
		const titles = explorerTitles(app, this.host.settings);
		const entries = folder ? folderEntries(app, folder, sort, show, titles) : [];
		const groups = groupFolderEntries(entries, (entry) =>
			childEntries(app, entry, sort, show, titles),
		);
		this.sections = groups.flatMap((group) => (group.kind === "folder" ? [group.folder.path] : []));
		this.drawTrail();
		if (!folder) {
			this.el.createDiv({ cls: "hearth-folder-empty", text: t().cards.folder.missing });
			return;
		}
		if (entries.length === 0) {
			this.el.createDiv({ cls: "hearth-folder-empty", text: t().cards.empty.folderEmpty });
			return;
		}
		this.pictures = picturesAllowed(this.state, performanceTier(this.host.settings));
		if (this.state.layout === "tiles" && (this.state.preview || this.pictures)) {
			this.previews = new PreviewLoader(this.el);
		}
		const host = this.el.createDiv("hearth-folder-groups");
		for (const group of groups) {
			if (group.kind === "files") this.drawFiles(host, group.entries);
			else this.drawFolder(host, group.folder, group.children);
		}
	}

	/** The breadcrumb, and the controls that sit with it: all of them are
	 * "where am I looking and how", which is one row's worth of question. */
	private drawTrail(): void {
		const bar = this.el.createDiv("hearth-folder-bar");
		const trail = bar.createDiv("hearth-folder-trail");
		const crumb = (name: string, path: string, last: boolean) => {
			if (last) {
				trail.createDiv({ cls: "hearth-folder-crumb is-current", text: name });
				return;
			}
			const el = trail.createDiv({ cls: "hearth-folder-crumb", text: name });
			const go = () => this.navigate(path);
			el.addEventListener("click", go);
			makeClickable(el, go, name);
			setIcon(trail.createDiv("hearth-folder-crumb-sep"), "chevron-right");
		};
		const steps = folderTrail(this.state.path);
		crumb(this.host.app.vault.getName(), ROOT, steps.length === 0);
		steps.forEach((step, i) => crumb(step.name, step.path, i === steps.length - 1));

		const strings = t().cards.folder;
		const tiles = this.state.layout === "tiles";
		this.barButton(bar, tiles ? "list" : "layout-grid", tiles ? strings.showList : strings.showTiles, () =>
			this.change({ layout: tiles ? "list" : "tiles" }),
		);

		this.foldAllButton = null;
		if (this.sections.length > 0) {
			this.foldAllButton = this.barButton(bar, "", "", () => this.foldAll());
			this.syncFoldAll();
		}

		const picker = bar.createEl("select", { cls: "dropdown hearth-folder-sort" });
		for (const sort of FOLDER_SORTS) {
			picker.createEl("option", { value: sort, text: t().editors.folder.sorts[sort] });
		}
		picker.value = this.state.sort;
		picker.addEventListener("change", () => {
			this.change({ sort: asFolderSort(picker.value) ?? this.state.sort });
		});

		if (this.host.popOut) {
			this.barButton(bar, "square-arrow-out-up-right", strings.openInTab, () =>
				this.host.popOut?.({ ...this.state }),
			);
		}
	}

	private barButton(bar: HTMLElement, icon: string, label: string, run: () => void): HTMLElement {
		const button = bar.createDiv({ cls: "clickable-icon hearth-folder-bar-button" });
		if (icon) setIcon(button, icon);
		button.setAttr("title", label);
		button.addEventListener("click", run);
		makeClickable(button, run, label);
		return button;
	}

	/** Whether every section on the page is folded, which is when the bar's
	 * button opens them all rather than folding them. */
	private allFolded(): boolean {
		return this.sections.length > 0 && this.sections.every((path) => foldedSections.has(path));
	}

	/** Fold every section on the page, or open them all once they all are. */
	private foldAll(): void {
		const open = this.allFolded();
		for (const path of this.sections) {
			if (open) foldedSections.delete(path);
			else foldedSections.add(path);
		}
		this.draw();
	}

	/** The fold-all button says what it will do next. */
	private syncFoldAll(): void {
		const button = this.foldAllButton;
		if (!button) return;
		const strings = t().cards.folder;
		const open = this.allFolded();
		const label = open ? strings.expandAll : strings.collapseAll;
		button.empty();
		setIcon(button, open ? "chevrons-up-down" : "chevrons-down-up");
		button.setAttr("title", label);
		button.setAttr("aria-label", label);
	}

	/** A change of how the page is drawn, not of where it is. */
	private change(patch: Partial<FolderBrowseState>): void {
		this.state = { ...this.state, ...patch };
		this.host.changed?.({ ...this.state });
		this.draw();
	}

	/** A run of files between two folders: one block, no heading — the files
	 * are the page's own contents, not a section of it. */
	private drawFiles(host: HTMLElement, entries: FolderEntry[]): void {
		const list = host.createDiv(this.blockClass());
		for (const entry of entries) this.drawEntry(list, entry);
	}

	/**
	 * One subfolder: its own heading, then the level below it — or, folded,
	 * only the heading. The chevron folds it; the rest of the heading steps
	 * into the folder, as it always has. A folded section draws nothing below
	 * its heading, so it reads no previews either.
	 */
	private drawFolder(host: HTMLElement, folder: FolderEntry, children: FolderEntry[]): void {
		const section = host.createDiv("hearth-folder-section");
		const head = section.createDiv("hearth-folder-head");
		const toggle = head.createDiv("hearth-folder-head-toggle");
		setIcon(head.createDiv("hearth-folder-head-icon"), "folder");
		head.createDiv({ cls: "hearth-folder-head-name", text: folder.name });
		head.createDiv({
			cls: "hearth-folder-count",
			text: String(childCount(this.host.app, folder.path)),
		});
		const go = () => this.navigate(folder.path);
		head.addEventListener("click", go);
		makeClickable(head, go, folder.name);
		wireFileMenu(head, folder.path, this.fileMenu());

		let body: HTMLElement | null = null;
		const show = () => {
			const folded = foldedSections.has(folder.path);
			section.toggleClass("is-folded", folded);
			const strings = t().cards.folder;
			toggle.empty();
			setIcon(toggle, folded ? "chevron-right" : "chevron-down");
			toggle.setAttr("aria-expanded", String(!folded));
			toggle.setAttr("aria-label", folded ? strings.expand(folder.name) : strings.collapse(folder.name));
			body?.remove();
			body = null;
			if (folded) return;
			body = section.createDiv(this.blockClass());
			if (children.length === 0) {
				body.createDiv({ cls: "hearth-folder-empty", text: t().cards.empty.folderEmpty });
				return;
			}
			for (const entry of children) this.drawEntry(body, entry);
		};
		const flip = (evt?: Event) => {
			// The heading's own click steps into the folder; this one mustn't.
			evt?.stopPropagation();
			if (foldedSections.has(folder.path)) foldedSections.delete(folder.path);
			else foldedSections.add(folder.path);
			show();
			this.syncFoldAll();
		};
		toggle.addEventListener("click", flip);
		toggle.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" || evt.key === " ") {
				evt.preventDefault();
				flip(evt);
			}
		});
		toggle.tabIndex = 0;
		toggle.setAttr("role", "button");
		show();
	}

	private blockClass(): string {
		return this.state.layout === "tiles" ? "hearth-folder-browser-tiles" : "hearth-folder-files";
	}

	private drawEntry(list: HTMLElement, entry: FolderEntry): void {
		if (this.state.layout === "tiles") this.drawTile(list, entry);
		else this.drawRow(list, entry);
	}

	private drawRow(list: HTMLElement, entry: FolderEntry): void {
		const icons = fileIconOptions(this.host.settings);
		const row = list.createDiv("hearth-list-item");
		row.toggleClass("is-folder", entry.isFolder);
		applyFileIcon(row.createDiv("hearth-list-icon"), entryIcon(this.host.app, entry, icons));
		row.createDiv({ cls: "hearth-list-label", text: entry.name });
		if (entry.isFolder) {
			row.createDiv({
				cls: "hearth-folder-count",
				text: String(childCount(this.host.app, entry.path)),
			});
		}
		this.wire(row, entry);
	}

	/**
	 * One entry as a tile: its icon and name, then — for a note, with previews
	 * on — the first lines of its text, small, read only once the tile is near
	 * the screen (see {@link PreviewLoader}).
	 */
	private drawTile(grid: HTMLElement, entry: FolderEntry): void {
		const icons = fileIconOptions(this.host.settings);
		const tile = grid.createDiv("hearth-folder-tile");
		tile.toggleClass("is-folder", entry.isFolder);
		const head = tile.createDiv("hearth-folder-tile-head");
		applyFileIcon(head.createDiv("hearth-folder-tile-icon"), entryIcon(this.host.app, entry, icons));
		head.createDiv({ cls: "hearth-folder-tile-name", text: entry.name });
		if (entry.isFolder) {
			head.createDiv({
				cls: "hearth-folder-count",
				text: String(childCount(this.host.app, entry.path)),
			});
		} else {
			this.drawTileContent(tile, entry);
		}
		this.wire(tile, entry);
	}

	/**
	 * What a file's tile shows under its name, each part filled in only once the
	 * tile comes near the screen: an image file shows itself; a note shows its
	 * first embedded image as a cover above the name, and the first lines of
	 * its text below it.
	 */
	private drawTileContent(tile: HTMLElement, entry: FolderEntry): void {
		const loader = this.previews;
		if (!loader) return;
		const file = this.host.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return;
		if (isImageFile(file)) {
			if (!this.pictures) return;
			tile.addClass("has-picture");
			const frame = tile.createDiv("hearth-folder-tile-picture");
			loader.watch(frame, () => this.showPicture(frame, file));
			return;
		}
		if (entry.extension !== "md") return;
		if (this.pictures) {
			// Watched through the tile: the frame stays hidden until there is a
			// cover to put in it, and a hidden element never comes into view.
			const cover = tile.createDiv("hearth-folder-tile-cover");
			loader.watch(tile, () => {
				const image = noteCover(this.host.app, file);
				if (image) {
					tile.addClass("has-cover");
					this.showPicture(cover, image);
				} else {
					cover.addClass("is-empty");
				}
			});
		}
		if (this.state.preview) {
			const text = tile.createDiv("hearth-folder-tile-preview");
			loader.watch(text, () => fillPreview(this.host.app, loader, text, entry.path));
		}
	}

	/** Put a picture in its frame. Decoded off the main thread where the
	 * browser can; a file it can't show takes its frame away again. */
	private showPicture(frame: HTMLElement, file: TFile): void {
		const img = frame.createEl("img", {
			attr: { alt: "", decoding: "async", loading: "lazy", draggable: "false" },
		});
		img.addEventListener(
			"error",
			() => {
				frame.addClass("is-empty");
				frame.parentElement?.removeClass("has-cover");
			},
			{ once: true },
		);
		img.src = this.host.app.vault.getResourcePath(file);
	}

	private wire(el: HTMLElement, entry: FolderEntry): void {
		const activate = (evt?: MouseEvent) => {
			if (entry.isFolder) {
				this.navigate(entry.path);
				return;
			}
			const file = this.host.app.vault.getAbstractFileByPath(entry.path);
			if (!(file instanceof TFile)) return;
			// A plain click is the end of browsing — leaving the dialog over the
			// note it just opened would hide the thing the click asked for. A
			// modifier is the opposite: the reader is collecting notes into tabs
			// and wants the list they are picking from to still be there. Either
			// way the dialog reopens where it left off, so closing it is never
			// the loss of a place in a deep folder.
			if (!keepsBrowsingOpen(evt)) this.host.opened?.();
			void openFile(this.host.opener, file, "card", evt);
		};
		el.addEventListener("click", (evt) => activate(evt));
		makeClickable(el, () => activate(), entry.name);
		wireFileMenu(el, entry.path, this.fileMenu());
	}

	/** What a right-click on an entry or a section heading offers (#389). Its
	 * Open is a plain click's: the note opens and the dialog gets out of the
	 * way; the new-tab and split entries leave it open, as a modifier does. */
	private fileMenu(): FileMenuOptions {
		return {
			app: this.host.app,
			source: FILE_MENU_SOURCE,
			open: (file) => {
				this.host.opened?.();
				void openFile(this.host.opener, file, "card");
			},
		};
	}

	private navigate(path: string): void {
		if (this.host.navigate) {
			this.host.navigate(path);
			return;
		}
		this.setState({ ...this.state, path });
		this.host.changed?.({ ...this.state });
	}
}

/** What a page showing `path` is called: the folder's name, the vault's at
 * the root. */
export function folderTitle(app: App, path: string): string {
	return path === ROOT ? app.vault.getName() : path.split("/").pop() || path;
}

/**
 * Redraw `browser` when something on its page — the folder shown, and the
 * levels below it the page draws — is added, removed, renamed or re-titled.
 * The events to register with whatever holds the browser, so they go when it
 * does.
 */
export function watchBrowsedFolder(app: App, browser: () => FolderBrowser | null): EventRef[] {
	const redraw = debounce(() => browser()?.draw(), 300, true);
	const check = (file: TAbstractFile, oldPath?: string) => {
		const at = browser()?.state.path;
		if (at === undefined) return;
		if (browserTouches(at, file.path) || (oldPath !== undefined && browserTouches(at, oldPath))) {
			redraw();
		}
	};
	return [
		app.vault.on("create", (file) => check(file)),
		app.vault.on("delete", (file) => check(file)),
		app.vault.on("rename", (file, oldPath) => check(file, oldPath)),
		// A note's title (Front Matter Title) and its preview come from its
		// content, which a metadata update follows.
		app.metadataCache.on("changed", (file) => check(file)),
	];
}

/** The dialog the browser opens in by default. */
class FolderBrowserModal extends HearthModal {
	private browser: FolderBrowser | null = null;
	/** Holds the vault watch for as long as the dialog is open. */
	private watch: Component | null = null;

	constructor(private readonly view: HomeView, private readonly opts: BrowseOptions) {
		super(view.app);
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-folder-modal");
		// Reopen where the reader left off, even if they never stepped
		// anywhere: a dialog opened on a subfolder row is already somewhere
		// worth returning to. Set on open rather than only on navigation.
		this.opts.remember?.(this.opts.path);
		const host: BrowserHost = {
			app: this.app,
			settings: this.view.plugin.settings,
			opener: this.view,
			setTitle: (text) => this.titleEl.setText(text),
			opened: () => this.close(),
			changed: (state) => this.opts.remember?.(state.path),
			popOut: (state) => {
				// The tab keeps the dialog's design: it is the same page, moved.
				const stated = this.modalEl.getAttribute(DESIGN_ATTR);
				const design = stated === "expressive" || stated === "classic" ? stated : undefined;
				this.close();
				void openFolderTab(this.app, { ...state, design });
			},
		};
		this.browser = new FolderBrowser(host, this.contentEl.createDiv(), stateOf(this.opts));
		this.browser.draw();
		// The dialog used to be a moment's look, but what its entries' menus
		// offer — rename, move, delete — changes the page under it (#389).
		this.watch = new Component();
		this.watch.load();
		for (const ref of watchBrowsedFolder(this.app, () => this.browser)) this.watch.registerEvent(ref);
	}

	onClose(): void {
		this.watch?.unload();
		this.watch = null;
		this.browser?.destroy();
		this.browser = null;
		this.contentEl.empty();
	}
}


// ---- Previews ------------------------------------------------------------

/** Previews already made, by path, with the modification time they were made
 * at — so walking back into a folder doesn't read its notes again, and an
 * edited note is read afresh. Bounded: a long browse through a large vault
 * must not keep every note's preview alive. */
const previewCache = new Map<string, { mtime: number; text: string }>();
const PREVIEW_CACHE_MAX = 400;

/** A note's preview, from the cache when the note hasn't changed since. */
async function notePreview(app: App, path: string): Promise<string> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return "";
	const mtime = file.stat?.mtime ?? 0;
	const cached = previewCache.get(path);
	if (cached && cached.mtime === mtime) return cached.text;
	const text = notePreviewText(await app.vault.cachedRead(file));
	previewCache.delete(path);
	previewCache.set(path, { mtime, text });
	if (previewCache.size > PREVIEW_CACHE_MAX) {
		const [oldest] = previewCache.keys();
		previewCache.delete(oldest);
	}
	return text;
}

/** Fill a tile's text preview, unless the page was redrawn while the note
 * was being read. */
function fillPreview(app: App, loader: PreviewLoader, el: HTMLElement, path: string): void {
	notePreview(app, path).then(
		(text) => {
			if (!loader.live) return;
			if (text) el.setText(text);
			else el.addClass("is-empty");
		},
		() => {
			if (loader.live) el.addClass("is-empty");
		},
	);
}

/**
 * A note's cover: the first image it embeds (`![[photo.jpg]]` or
 * `![](photo.jpg)`) that resolves to a picture in the vault. Read from the
 * metadata cache, so finding it reads no file; a picture on the web is not a
 * cover, since showing one would be a request the vault never made.
 */
function noteCover(app: App, file: TFile): TFile | null {
	const embeds = app.metadataCache.getFileCache(file)?.embeds ?? [];
	for (const embed of embeds.slice(0, 20)) {
		const target = app.metadataCache.getFirstLinkpathDest(getLinkpath(embed.link), file.path);
		if (target && isImageFile(target)) return target;
	}
	return null;
}

/**
 * Fills each tile's previews — its text, its picture — once the tile comes
 * near the screen. A folder of three hundred notes opened in tiles reads the
 * dozen in view, not all three hundred; the rest are read as they are
 * scrolled to.
 *
 * Without an IntersectionObserver (a test environment) everything is filled
 * straight away.
 */
class PreviewLoader {
	private readonly observer: IntersectionObserver | null;
	private readonly jobs = new Map<Element, () => void>();
	/** False once the page has been redrawn or closed: a read that finishes
	 * after that has nowhere to go. */
	live = true;

	constructor(root: HTMLElement) {
		this.observer =
			typeof IntersectionObserver === "function"
				? new IntersectionObserver((entries) => this.seen(entries), {
						root,
						rootMargin: "300px 0px",
					})
				: null;
	}

	watch(el: HTMLElement, run: () => void): void {
		if (!this.observer) {
			run();
			return;
		}
		this.jobs.set(el, run);
		this.observer.observe(el);
	}

	disconnect(): void {
		this.live = false;
		this.observer?.disconnect();
		this.jobs.clear();
	}

	private seen(entries: IntersectionObserverEntry[]): void {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			const run = this.jobs.get(entry.target);
			if (!run) continue;
			this.jobs.delete(entry.target);
			this.observer?.unobserve(entry.target);
			run();
		}
	}
}


/** Whether the click that opened a note should leave the browser open: a
 * modifier means the reader is sending notes to other tabs, not leaving. Never
 * throws — `isModEvent` reads Obsidian's own key state, and a browser that
 * closed on an error would be the same as no modifier at all. */
function keepsBrowsingOpen(evt?: MouseEvent): boolean {
	if (!evt) return false;
	try {
		return Keymap.isModEvent(evt) !== false;
	} catch {
		return false;
	}
}


// ---- Editor -------------------------------------------------------------

export function folderEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.folder ??= {});
	const strings = t().editors.folder;

	const folder = new Setting(containerEl)
		.setName(strings.folder)
		.setDesc(strings.folderDesc);
	folder.addText((txt) =>
		txt
			.setPlaceholder(strings.folderPlaceholder)
			.setValue(cfg.path ?? "")
			.onChange((v) => {
				cfg.path = v.trim() || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	folder.addButton((b) =>
		b.setButtonText(strings.pickFolder).onClick(() => {
			new FolderPickerModal(ctx.app, (picked) => {
				cfg.path = picked.isRoot() ? undefined : picked.path;
				ctx.opts.save();
				ctx.requestRender();
				ctx.opts.rerender();
			}).open();
		}),
	);

	new Setting(containerEl)
		.setName(strings.sort)
		.setDesc(strings.sortDesc)
		.addDropdown((d) => {
			for (const sort of FOLDER_SORTS) d.addOption(sort, strings.sorts[sort]);
			d.setValue(cfg.sort ?? FOLDER_SORT_DEFAULT).onChange((v) => {
				const sort = asFolderSort(v) ?? FOLDER_SORT_DEFAULT;
				cfg.sort = sort === FOLDER_SORT_DEFAULT ? undefined : sort;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	new Setting(containerEl)
		.setName(strings.show)
		.setDesc(strings.showDesc)
		.addDropdown((d) => {
			d.addOption("all", strings.showAll);
			d.addOption("folders", strings.showFolders);
			d.addOption("files", strings.showFiles);
			d.setValue(cfg.show ?? "all").onChange((v) => {
				cfg.show = v === "all" ? undefined : (v as FolderShow);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	// Terminal mode draws the folder as a tree either way.
	if (!ctx.terminal) {
		new Setting(containerEl)
			.setName(strings.display)
			.setDesc(strings.displayDesc)
			.addDropdown((d) => {
				d.addOption("list", strings.displayList);
				d.addOption("tiles", strings.displayTiles);
				d.setValue(cfg.view ?? "list").onChange((v) => {
					cfg.view = v === "list" ? undefined : (v as "tiles");
					ctx.opts.save();
					ctx.opts.rerender();
				});
			});
	}

	const count = new Setting(containerEl).setName(strings.count).setDesc(strings.countDesc);
	count.addText((txt) => {
		txt.setValue(String(cfg.count ?? CARD_COUNT_DEFAULT)).onChange((v) => {
			const n = parseInt(v, 10);
			cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
			ctx.opts.rerender();
		});
		txt.inputEl.type = "number";
		txt.inputEl.min = "1";
		txt.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, count, t().settings.resetField, () => {
		cfg.count = undefined;
	});

	new Setting(containerEl)
		.setName(strings.counts)
		.setDesc(strings.countsDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.counts === true).onChange((v) => {
				cfg.counts = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	new Setting(containerEl)
		.setName(strings.navigate)
		.setDesc(strings.navigateDesc)
		.addDropdown((d) => {
			d.addOption("modal", strings.navigateModal);
			d.addOption("card", strings.navigateCard);
			d.setValue(cfg.navigate === "card" ? "card" : "modal").onChange((v) => {
				cfg.navigate = v === "card" ? "card" : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	new Setting(containerEl)
		.setName(strings.browse)
		.setDesc(strings.browseDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.browse !== false).onChange((v) => {
				cfg.browse = v ? undefined : false;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	// The browser's own settings. Terminal mode opens it as a list in a
	// terminal dialog either way.
	if (ctx.terminal) return;

	new Setting(containerEl)
		.setName(strings.browseIn)
		.setDesc(strings.browseInDesc)
		.addDropdown((d) => {
			d.addOption("modal", strings.browseInModal);
			d.addOption("tab", strings.browseInTab);
			d.setValue(cfg.browseIn === "tab" ? "tab" : "modal").onChange((v) => {
				cfg.browseIn = v === "tab" ? "tab" : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	new Setting(containerEl)
		.setName(strings.browserView)
		.setDesc(strings.browserViewDesc)
		.addDropdown((d) => {
			d.addOption("list", strings.displayList);
			d.addOption("tiles", strings.displayTiles);
			d.setValue(cfg.browserView === "tiles" ? "tiles" : "list").onChange((v) => {
				cfg.browserView = v === "tiles" ? "tiles" : undefined;
				ctx.opts.save();
				// The preview settings below only apply to tiles.
				ctx.requestRender();
			});
		});

	if (cfg.browserView !== "tiles") return;

	new Setting(containerEl)
		.setName(strings.preview)
		.setDesc(strings.previewDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.preview !== false).onChange((v) => {
				cfg.preview = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	new Setting(containerEl)
		.setName(strings.images)
		.setDesc(strings.imagesDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.images !== false).onChange((v) => {
				cfg.images = v ? undefined : false;
				ctx.opts.save();
			}),
		);

	if (cfg.preview === false) return;

	const size = new Setting(containerEl)
		.setName(strings.previewSize)
		.setDesc(strings.previewSizeDesc);
	size.addSlider((sl) => {
		sl.setLimits(PREVIEW_SIZE.min, PREVIEW_SIZE.max, 1)
			.setValue(previewSize(cfg.previewSize))
			.onChange((v) => {
				cfg.previewSize = v === PREVIEW_SIZE.default ? undefined : v;
				ctx.opts.save();
			});
	});
	size.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.previewSize = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);
}


/** One folder's contents, one level down, with a browser behind them. */
export const folderCard: CardDefinition<"folder"> = {
	kind: "folder",
	templates: [
		{
			id: "folder",
			name: "Folder",
			icon: "folder-tree",
			build: () => ({ kind: "folder", title: "Folder", folder: {}, w: 4, h: 4 }),
		},
	],
	render: (view, card, body) => renderFolder(view, card, body),
	renderEditor: (container, ctx) => folderEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.folder) copy.folder = { ...source.folder };
	},
	// A folder card is about the folder, not the vault: a note edited three
	// folders away can't change what it lists, and redrawing on it would mean
	// rebuilding every folder card in the vault on every keystroke elsewhere.
	expressive: true,
	liveness: { mode: "vault", shouldRedraw: (card, ev) => folderReactsTo(card, ev) },
};


/** Whether a vault event can change what this card shows. */
export function folderReactsTo(
	card: DashboardCard,
	ev: { file: { path: string }; oldPath?: string },
): boolean {
	const cfg = card.folder ?? {};
	const root = folderPath(cfg.path);
	// Two things make a card care below its own level: counts, which read the
	// level under each row, and in-card navigation, which can have walked the
	// card to any folder beneath its own.
	const deep = cfg.counts === true || cfg.navigate === "card";
	if (folderTouches(root, ev.file.path, deep)) return true;
	return ev.oldPath !== undefined && folderTouches(root, ev.oldPath, deep);
}
