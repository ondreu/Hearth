/**
 * The Folder and Bookmarks cards as text: trees, the way `tree` prints them.
 *
 * A folder's subfolders open in place (Space, or the `▸` beside one) instead
 * of in a dialog, so the card can be walked without leaving the board; a card
 * set to navigate in place still steps into the folder on Enter, with a
 * `◂ ..` row back up. `o` opens the folder browser, the graphical card's
 * larger view, dressed as a terminal dialog.
 *
 * Bookmarks draw their groups the same way, open at first like the core
 * pane's, and follow every kind of bookmark the graphical card follows.
 */
import { TFile, TFolder, type Menu, type TAbstractFile } from "obsidian";
import { bookmarkPathName, openBookmark, pruneBookmarks } from "../../cards/bookmarks";
import {
	browsedPath,
	browseStateFor,
	CARD_COUNT_DEFAULT,
	childCount,
	currentPath,
	folderAt,
	folderEntries,
	folderPath,
	maxPath,
	openFolderBrowser,
	ROOT,
} from "../../cards/folder";
import type { BookmarkItem } from "../../bookmarks";
import { showFileMenu } from "../../filemenu";
import { FOLDER_SORT_DEFAULT, parentPath, type FolderEntry } from "../../foldercontents";
import { explorerTitles } from "../../frontmattertitle";
import { t } from "../../i18n";
import type { BookmarksInstance } from "../../obsidian-ext";
import type { TuiContext, TuiRenderer } from "../card";
import { asciify, type Line } from "../text";
import { hearthMenu } from "../../uidesign";
import { fileMenu, fileTag, fileTagStyle, listOutput, message, openCardFile, showMenuFor, treeRows, type Row, type TreeNode } from "./common";

// ---- Folder -------------------------------------------------------------------------

function openKey(ctx: TuiContext, id: string): string {
	return `${ctx.card.id}:${id}`;
}

function isOpen(ctx: TuiContext, node: TreeNode): boolean {
	return ctx.view.tui.expanded.has(openKey(ctx, node.id));
}

function setOpen(ctx: TuiContext, node: TreeNode, open: boolean): void {
	const key = openKey(ctx, node.id);
	if (open) ctx.view.tui.expanded.add(key);
	else ctx.view.tui.expanded.delete(key);
	ctx.redraw();
}

function browse(ctx: TuiContext, path: string): void {
	const cfg = ctx.card.folder ?? {};
	openFolderBrowser(ctx.view, {
		// A list, whatever the graphical card's browser is set to: the dialog
		// is dressed as a terminal one, and tiles are not a terminal's shape.
		...browseStateFor(cfg, path),
		layout: "list",
		remember: (to) => {
			browsedPath.set(ctx.card, to);
			if (cfg.navigate === "card") ctx.redraw();
		},
	});
}

/** A folder's entries as tree nodes, each subfolder a branch. */
function folderNodes(ctx: TuiContext, folder: TFolder, limit: number): TreeNode[] {
	const cfg = ctx.card.folder ?? {};
	const inCard = cfg.navigate === "card";
	const titles = explorerTitles(ctx.view.app, ctx.view.plugin.settings);
	const entries = folderEntries(ctx.view.app, folder, cfg.sort ?? FOLDER_SORT_DEFAULT, cfg.show ?? "all", titles);
	const shown = limit > 0 ? entries.slice(0, limit) : entries;
	const nodes = shown.map((entry) => entryNode(ctx, entry, inCard));
	if (entries.length > shown.length) {
		nodes.push({
			id: `${folder.path}:more`,
			label: [{ text: t().cards.folder.more(entries.length - shown.length), style: "dim" }],
			activate: () => browse(ctx, folder.path),
		});
	}
	return nodes;
}

function entryNode(ctx: TuiContext, entry: FolderEntry, inCard: boolean): TreeNode {
	const app = ctx.view.app;
	const file = app.vault.getAbstractFileByPath(entry.path);
	if (entry.isFolder) {
		const folder = folderAt(app, entry.path);
		const counts = ctx.card.folder?.counts === true;
		return {
			id: entry.path,
			label: [{ text: `${asciify(entry.name)}/`, style: ["bold", "blue"] }],
			right: counts ? [{ text: ` ${childCount(app, entry.path)}`, style: "faint" }] : undefined,
			// Children are shown to one level less than the card's count, so a
			// deep tree doesn't bury the card's own rows.
			children: () => (folder ? folderNodes(ctx, folder, ctx.zoomed ? 0 : CARD_COUNT_DEFAULT) : []),
			activate: inCard
				? () => {
						browsedPath.set(ctx.card, entry.path);
						ctx.select(0);
						ctx.redraw();
					}
				: undefined,
			menu: (evt) => {
				const own = (menu: Menu) => {
					menu.addItem((i) => i.setTitle(t().cards.folder.browse).setIcon("folder-tree").onClick(() => browse(ctx, entry.path)));
					if (inCard) {
						menu.addItem((i) =>
							i
								.setTitle(t().tui.open)
								.setIcon("folder-open")
								.onClick(() => {
									browsedPath.set(ctx.card, entry.path);
									ctx.redraw();
								}),
						);
					}
				};
				// The folder's own entries first, then what the vault offers
				// for a folder anywhere else (#389).
				if (folder) {
					showFileMenu(folder, evt, { app, source: "hearth-terminal", extend: own });
					return;
				}
				const menu = hearthMenu();
				own(menu);
				showMenuFor(menu, evt);
			},
		};
	}
	return {
		id: entry.path,
		label: [{ text: asciify(entry.name) }],
		right: file ? [{ text: ` ${fileTag(file)}`, style: fileTagStyle(file) }] : undefined,
		activate: (evt) => {
			if (file instanceof TFile) openCardFile(ctx.view, file, evt);
		},
		menu: (evt) => {
			if (file instanceof TFile) fileMenu(ctx.view, file, evt);
		},
	};
}

export const folderTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.folder ?? {};
		const root = folderPath(cfg.path);
		const inCard = cfg.navigate === "card";
		const path = inCard ? currentPath(ctx.view.app, ctx.card, root) : root;
		const folder = folderAt(ctx.view.app, path);
		if (!folder) return { lines: message(t().cards.empty.folderMissing(cfg.path ?? ""), ctx.cols) };
		const limit = ctx.zoomed ? 0 : cfg.count && cfg.count > 0 ? cfg.count : CARD_COUNT_DEFAULT;
		const nodes = folderNodes(ctx, folder, limit);
		const rows: Row[] = [];
		// Where the card has been walked to, and the way back up.
		if (inCard && path !== root) {
			const up = maxPath(parentPath(path), root);
			const here = root === ROOT ? path : path.slice(root.length + 1);
			rows.push({
				lines: [{ text: "◂ ..", style: "accent" }, { text: `  ${asciify(here)}`, style: "dim" }],
				activate: () => {
					browsedPath.set(ctx.card, up);
					ctx.redraw();
				},
			});
		}
		const label = path === ROOT ? ctx.view.app.vault.getName() : folder.name;
		rows.push({ lines: [{ text: `${asciify(label)}/`, style: ["bold", "blue"] }], activate: cfg.browse !== false ? () => browse(ctx, path) : undefined });
		if (!nodes.length) rows.push({ lines: [{ text: t().cards.empty.folderEmpty, style: "dim" }], inert: true });
		rows.push(...treeRows(ctx, nodes, (n) => isOpen(ctx, n), (n, open) => setOpen(ctx, n, open)));
		return { ...listOutput(rows), foot: t().tui.cards.folderFoot };
	},
	detail(ctx) {
		const cfg = ctx.card.folder ?? {};
		const root = folderPath(cfg.path);
		browse(ctx, cfg.navigate === "card" ? currentPath(ctx.view.app, ctx.card, root) : root);
	},
};

// ---- Bookmarks ------------------------------------------------------------------------

function bookmarkLabel(ctx: TuiContext, item: BookmarkItem): string {
	return item.title || (item.path ? bookmarkPathName(ctx.view, item.path) : undefined) || item.url || item.query || t().cards.bookmarks.untitled;
}

/** A bookmark's kind as a tag: what Enter will do with it. */
function bookmarkTag(item: BookmarkItem, target: TAbstractFile | null): Line {
	if (target instanceof TFile) return [{ text: ` ${fileTag(target)}`, style: fileTagStyle(target) }];
	const tag = item.type === "folder" ? "dir" : item.type === "url" ? "url" : item.type === "search" ? "find" : item.type === "graph" ? "graph" : "";
	return tag ? [{ text: ` ${tag}`, style: "yellow" }] : [];
}

function bookmarkNodes(ctx: TuiContext, items: readonly BookmarkItem[], path: string): TreeNode[] {
	return items.map((item, i) => {
		const id = `${path}/${i}:${item.title ?? item.path ?? ""}`;
		if (item.type === "group") {
			return {
				id,
				label: [{ text: asciify(item.title || t().cards.bookmarks.untitled), style: ["bold", "blue"] }],
				children: () => bookmarkNodes(ctx, item.items ?? [], id),
			};
		}
		const target = (item.type === "file" || item.type === "folder") && item.path ? ctx.view.app.vault.getAbstractFileByPath(item.path) : null;
		return {
			id,
			label: [{ text: asciify(bookmarkLabel(ctx, item)) }],
			right: bookmarkTag(item, target),
			activate: () => openBookmark(ctx.view, item, false),
			menu: target instanceof TFile ? (evt) => fileMenu(ctx.view, target, evt) : undefined,
		};
	});
}

export const bookmarksTui: TuiRenderer = {
	render(ctx) {
		const plugin = ctx.view.app.internalPlugins.getPluginById("bookmarks");
		const instance = plugin?.instance as BookmarksInstance | undefined;
		if (!plugin?.enabled || !instance) return { lines: message(t().cards.empty.bookmarksEnable, ctx.cols) };
		// The store is a config file no vault event sees; the plugin announces
		// its own writes.
		if (typeof instance.on === "function") {
			try {
				const ref = instance.on("changed", () => ctx.redraw());
				if (ref) ctx.component.registerEvent(ref);
			} catch {
				// An internal that changed shape: the card stays as it is.
			}
		}
		const roots = Array.isArray(instance.items) ? instance.items : (instance.getBookmarks?.() ?? []).filter((i) => i.type !== "group");
		const tree = pruneBookmarks(roots, ctx.view);
		if (!tree.length) return { lines: message(t().cards.empty.bookmarksEmpty, ctx.cols) };
		// Groups start open, like the core pane's; closing one is remembered.
		const closedKey = (n: TreeNode) => `${ctx.card.id}:closed:${n.id}`;
		const rows = treeRows(
			ctx,
			bookmarkNodes(ctx, tree, ""),
			(n) => !ctx.view.tui.expanded.has(closedKey(n)),
			(n, open) => {
				if (open) ctx.view.tui.expanded.delete(closedKey(n));
				else ctx.view.tui.expanded.add(closedKey(n));
				ctx.redraw();
			},
		);
		return { ...listOutput(rows), foot: t().tui.cards.bookmarksFoot };
	},
};
