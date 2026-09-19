import { Keymap, Modal, Setting, TAbstractFile, TFile, TFolder, setIcon, type App } from "obsidian";
import { cardOverlayButton, emptyState, redrawCard, resetCardBody } from "../cardbodies";
import { addResetButton } from "../editors";
import { explorerChildOrder, explorerSortAsFolderSort } from "../explorerorder";
import { applyFileIcon, fileIconOptions, resolveFileIcon, type FileIconOptions } from "../fileicons";
import {
	asFolderSort,
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
import { t } from "../i18n";
import { openFile } from "../opener";
import { FolderPickerModal } from "../pickers";
import { type DashboardCard, type FolderCardConfig } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Folder contents ----------------------------------------------------

/** Rows on the card when the config names no count. The browser the card opens
 * is the place for the whole folder, so the card itself stays a glance. */
const CARD_COUNT_DEFAULT = 12;

/** The vault root, as this module spells it. Obsidian's own root folder has
 * path "/", which is not a path anything else here would accept. */
const ROOT = "";

/** A config path as a folder path: trimmed, unslashed, root as `ROOT`. */
export function folderPath(raw: string | undefined): string {
	const clean = (raw ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
	return clean === "" || clean === "/" ? ROOT : clean;
}

/** The folder a path names, or null when it names nothing (or names a file —
 * a card whose folder was replaced by a note must say so, not list the note's
 * siblings). */
function folderAt(app: App, path: string): TFolder | null {
	if (path === ROOT) return app.vault.getRoot();
	const found = app.vault.getAbstractFileByPath(path);
	return found instanceof TFolder ? found : null;
}

/** One vault child, flattened onto the shape the ordering rules work on. */
function toEntry(file: TAbstractFile): FolderEntry {
	if (file instanceof TFolder) {
		return { path: file.path, name: file.name, isFolder: true, mtime: 0, ctime: 0, extension: "" };
	}
	if (file instanceof TFile) {
		return {
			path: file.path,
			name: file.basename,
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
 */
export function folderEntries(
	app: App,
	folder: TFolder,
	sort: FolderSort,
	show: FolderShow,
): FolderEntry[] {
	const kept = filterFolderEntries(folder.children.map(toEntry), show);
	if (sort !== "explorer") return sortFolderEntries(kept, sort);
	const order = explorerChildOrder(app, folder);
	return order
		? orderByPaths(kept, order)
		: sortFolderEntries(kept, explorerSortAsFolderSort(app));
}

/** The children of a listed subfolder, for the extra level the browser shows
 * under each folder section. An unreadable path yields nothing rather than
 * throwing mid-draw. */
function childEntries(app: App, entry: FolderEntry, sort: FolderSort, show: FolderShow): FolderEntry[] {
	const folder = folderAt(app, entry.path);
	return folder ? folderEntries(app, folder, sort, show) : [];
}

/** How many things a subfolder holds, for the optional count badge. Its own
 * level only — a number that counted the whole subtree would say something the
 * row it sits on doesn't. */
function childCount(app: App, path: string): number {
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
const browsedPath = new WeakMap<DashboardCard, string>();

/**
 * Where this card is looking now: the folder it was walked into, as long as
 * that is still the card's own folder or somewhere under it and still exists.
 * Anything else — the configured folder was changed, or the one being read was
 * deleted or renamed away — falls back to the card's own folder rather than
 * leaving the card pointed somewhere it was never set to.
 */
function currentPath(app: App, card: DashboardCard, root: string): string {
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
	const entries = folderEntries(view.app, folder, sort, show);
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
			path: at,
			sort,
			show,
			counts: cfg.counts === true,
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
function maxPath(path: string, root: string): string {
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
	}
}


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

interface BrowseOptions {
	path: string;
	sort: FolderSort;
	show: FolderShow;
	counts: boolean;
	/** Told where the reader walked to, so the card it came from reopens there
	 * (and follows along when it navigates in place). */
	remember?: (path: string) => void;
}

/** Open the folder browser at a path. Exported for the card and for anything
 * else that wants to hand the user a folder. */
export function openFolderBrowser(view: HomeView, opts: BrowseOptions): void {
	new FolderBrowserModal(view, opts).open();
}

/**
 * A folder, in full: the trail down to it, then its contents with every
 * subfolder opened one extra level (#329).
 *
 * The card can only be a glance — it is a few rows on a board — so this is
 * where a folder is actually browsed. Two things make it a browser rather than
 * a bigger card: the breadcrumb, and the fact that every folder on the page,
 * heading or row, navigates the same dialog to itself. Walking into a subfolder
 * and back out never touches the board or the card's settings; the sort picker
 * is the dialog's own, for the same reason.
 */
class FolderBrowserModal extends Modal {
	private path: string;
	private sort: FolderSort;
	private body!: HTMLElement;

	constructor(private readonly view: HomeView, private readonly opts: BrowseOptions) {
		super(view.app);
		this.path = opts.path;
		this.sort = opts.sort;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-folder-modal");
		this.body = this.contentEl.createDiv("hearth-folder-browser");
		this.remember();
		this.draw();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Reopen where the reader left off, even if they never stepped anywhere:
	 * a dialog opened on a subfolder row is already somewhere worth returning
	 * to. Set on open rather than only on navigation. */
	private remember(): void {
		this.opts.remember?.(this.path);
	}

	/** Repaint from scratch on every navigation and sort change: at a folder's
	 * size this costs nothing, and it keeps one drawing path for the first open,
	 * a step into a subfolder and a step back out. */
	private draw(): void {
		const folder = folderAt(this.app, this.path);
		this.titleEl.setText(
			this.path === ROOT ? this.app.vault.getName() : this.path.split("/").pop() || this.path,
		);
		this.body.empty();
		this.drawTrail();
		if (!folder) {
			this.body.createDiv({ cls: "hearth-folder-empty", text: t().cards.folder.missing });
			return;
		}
		const entries = folderEntries(this.app, folder, this.sort, this.opts.show);
		if (entries.length === 0) {
			this.body.createDiv({ cls: "hearth-folder-empty", text: t().cards.empty.folderEmpty });
			return;
		}
		const groups = groupFolderEntries(entries, (entry) =>
			childEntries(this.app, entry, this.sort, this.opts.show),
		);
		const host = this.body.createDiv("hearth-folder-groups");
		for (const group of groups) {
			if (group.kind === "files") this.drawFiles(host, group.entries);
			else this.drawFolder(host, group.folder, group.children);
		}
	}

	/** The breadcrumb, and the sort picker that sits with it: both are "where am
	 * I looking and how", which is one row's worth of question. */
	private drawTrail(): void {
		const bar = this.body.createDiv("hearth-folder-bar");
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
		const steps = folderTrail(this.path);
		crumb(this.app.vault.getName(), ROOT, steps.length === 0);
		steps.forEach((step, i) => crumb(step.name, step.path, i === steps.length - 1));

		const picker = bar.createEl("select", { cls: "dropdown hearth-folder-sort" });
		for (const sort of FOLDER_SORTS) {
			picker.createEl("option", { value: sort, text: t().editors.folder.sorts[sort] });
		}
		picker.value = this.sort;
		picker.addEventListener("change", () => {
			this.sort = asFolderSort(picker.value) ?? this.sort;
			this.draw();
		});
	}

	/** A run of files between two folders: one block, no heading — the files
	 * are the page's own contents, not a section of it. */
	private drawFiles(host: HTMLElement, entries: FolderEntry[]): void {
		const list = host.createDiv("hearth-folder-files");
		for (const entry of entries) this.drawRow(list, entry);
	}

	/** One subfolder: its own heading, then the level below it. */
	private drawFolder(host: HTMLElement, folder: FolderEntry, children: FolderEntry[]): void {
		const section = host.createDiv("hearth-folder-section");
		const head = section.createDiv("hearth-folder-head");
		setIcon(head.createDiv("hearth-folder-head-icon"), "folder");
		head.createDiv({ cls: "hearth-folder-head-name", text: folder.name });
		head.createDiv({
			cls: "hearth-folder-count",
			text: String(childCount(this.app, folder.path)),
		});
		const go = () => this.navigate(folder.path);
		head.addEventListener("click", go);
		makeClickable(head, go, folder.name);

		const list = section.createDiv("hearth-folder-files");
		if (children.length === 0) {
			list.createDiv({ cls: "hearth-folder-empty", text: t().cards.empty.folderEmpty });
			return;
		}
		for (const entry of children) this.drawRow(list, entry);
	}

	private drawRow(list: HTMLElement, entry: FolderEntry): void {
		const icons = fileIconOptions(this.view.plugin.settings);
		const row = list.createDiv("hearth-list-item");
		row.toggleClass("is-folder", entry.isFolder);
		applyFileIcon(row.createDiv("hearth-list-icon"), entryIcon(this.app, entry, icons));
		row.createDiv({ cls: "hearth-list-label", text: entry.name });
		if (entry.isFolder) {
			row.createDiv({
				cls: "hearth-folder-count",
				text: String(childCount(this.app, entry.path)),
			});
		}
		const activate = (evt?: MouseEvent) => {
			if (entry.isFolder) {
				this.navigate(entry.path);
				return;
			}
			const file = this.app.vault.getAbstractFileByPath(entry.path);
			if (!(file instanceof TFile)) return;
			// A plain click is the end of browsing — leaving the dialog over the
			// note it just opened would hide the thing the click asked for. A
			// modifier is the opposite: the reader is collecting notes into tabs
			// and wants the list they are picking from to still be there. Either
			// way the dialog reopens where it left off, so closing it is never
			// the loss of a place in a deep folder.
			if (!keepsBrowsingOpen(evt)) this.close();
			void openFile(this.view, file, "card", evt);
		};
		row.addEventListener("click", (evt) => activate(evt));
		makeClickable(row, () => activate(), entry.name);
	}

	private navigate(path: string): void {
		this.path = path;
		this.opts.remember?.(path);
		// A step into a deep folder starts where the last one left off, which is
		// rarely what you want to read.
		this.body.scrollTop = 0;
		this.draw();
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
