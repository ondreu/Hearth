import { Notice, setIcon, type Component, TFile, TFolder } from "obsidian";
import { bookmarkTarget, type BookmarkItem } from "../bookmarks";
import { emptyState, redrawCard } from "../cardbodies";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { FOLDER_SORT_DEFAULT } from "../foldercontents";
import { t } from "../i18n";
import { type BookmarksInstance } from "../obsidian-ext";
import { openFile, openSearch, targetLeaf } from "../opener";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";
import { openFolderBrowser } from "./folder";


// ---- Bookmarks (Obsidian core) -----------------------------------------

/** Recursively drop bookmarks whose target no longer exists and groups left with
 * nothing live inside them, returning a fresh, pruned copy of the tree.
 *
 * Obsidian keeps a file/folder bookmark in its store even after the target is
 * deleted (the entry only goes away if the bookmark itself is removed), but its
 * native pane hides those orphans. We mirror that so the card never shows dead,
 * unclickable rows (see issue #41). A group whose whole subtree prunes away is
 * dropped too, rather than leaving an empty folder in the card. */
function pruneBookmarks(items: BookmarkItem[], view: HomeView): BookmarkItem[] {
	const out: BookmarkItem[] = [];
	for (const item of items) {
		if (item.type === "group") {
			const children = pruneBookmarks(item.items ?? [], view);
			if (children.length > 0) out.push({ ...item, items: children });
			continue;
		}
		if ((item.type === "file" || item.type === "folder") && item.path) {
			if (view.app.vault.getAbstractFileByPath(item.path) === null) continue;
		}
		out.push(item);
	}
	return out;
}


export function renderBookmarks(
	view: HomeView,
	body: HTMLElement,
	component?: Component,
): void {
	const plugin = view.app.internalPlugins.getPluginById("bookmarks");
	const instance = plugin?.instance as BookmarksInstance | undefined;

	if (!plugin?.enabled || !instance) {
		emptyState(body, "bookmark", t().cards.empty.bookmarksEnable);
		return;
	}

	watchBookmarks(instance, body, component);

	// `instance.items` is the *nested* bookmark tree: a group holds its children
	// under `items`. `getBookmarks()`, by contrast, returns a flat list that
	// promotes every grouped bookmark to the top level while the group node keeps
	// its own children — so walking that as a tree renders grouped bookmarks
	// twice (issue #82). Use the tree; fall back to the flat list (leaves only)
	// on the off chance an older build doesn't expose `items`.
	const roots = Array.isArray(instance.items)
		? instance.items
		: (instance.getBookmarks?.() ?? []).filter((i) => i.type !== "group");
	const tree = pruneBookmarks(roots, view);

	if (tree.length === 0) {
		emptyState(body, "bookmark", t().cards.empty.bookmarksEmpty);
		return;
	}

	renderBookmarkItems(view, body.createDiv("hearth-list"), tree);
}


/** Render a level of the bookmark tree into `container`, recursing into groups
 * so the card mirrors Obsidian's own collapsible folder layout. */
function renderBookmarkItems(
	view: HomeView,
	container: HTMLElement,
	items: BookmarkItem[],
): void {
	for (const item of items) {
		if (item.type === "group") {
			renderBookmarkGroup(view, container, item);
		} else {
			renderBookmarkLeaf(view, container, item);
		}
	}
}


/** A collapsible folder: a header row that toggles its nested children, which
 * are themselves rendered recursively so sub-groups nest to any depth. */
function renderBookmarkGroup(
	view: HomeView,
	container: HTMLElement,
	group: BookmarkItem,
): void {
	const label = group.title || t().cards.bookmarks.untitled;
	const wrap = container.createDiv("hearth-bookmark-group");
	const header = wrap.createDiv("hearth-list-item hearth-bookmark-group-header");
	setIcon(header.createDiv("hearth-list-icon hearth-bookmark-chevron"), "chevron-right");
	setIcon(header.createDiv("hearth-list-icon"), "folder");
	header.createDiv({ cls: "hearth-list-label", text: label });

	const children = wrap.createDiv("hearth-bookmark-group-children");
	renderBookmarkItems(view, children, group.items ?? []);

	const toggle = () => wrap.classList.toggle("is-collapsed");
	header.addEventListener("click", toggle);
	makeClickable(header, toggle, label);
}


/** The name Obsidian shows for an unnamed file/folder bookmark: the target's
 * basename, not its full path. Resolving through the vault strips the `.md`
 * extension from notes (like Obsidian) and keeps the extension on other files;
 * if the target can't be resolved we fall back to the last path segment. */
function bookmarkPathName(view: HomeView, path: string): string {
	const file = view.app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) return file.basename;
	if (file instanceof TFolder) return file.name;
	return path.split("/").pop() || path;
}


/** A single (non-group) bookmark row: file, folder, url, search or graph. */
function renderBookmarkLeaf(
	view: HomeView,
	container: HTMLElement,
	item: BookmarkItem,
): void {
	const label =
		item.title ||
		(item.path ? bookmarkPathName(view, item.path) : undefined) ||
		item.url ||
		item.query ||
		t().cards.bookmarks.untitled;
	const row = container.createDiv("hearth-list-item");
	const iconEl = row.createDiv("hearth-list-icon");
	// A bookmark that points at a vault file or folder gets that target's icon —
	// its Iconize/Iconic icon when one is set, otherwise its file-type icon — so
	// the same note looks the same here as in Recent or Favorites (#132). Every
	// other bookmark kind describes a destination rather than a file and keeps
	// its own fixed icon.
	const target =
		(item.type === "file" || item.type === "folder") && item.path
			? view.app.vault.getAbstractFileByPath(item.path)
			: null;
	if (item.type === "url" && item.url) {
		renderFavicon(iconEl, item.url);
	} else if (target) {
		applyFileIcon(iconEl, resolveFileIcon(view.app, target, fileIconOptions(view.plugin.settings)));
	} else {
		const icon =
			item.type === "folder" ? "folder" :
			item.type === "search" ? "search" :
			item.type === "graph" ? "git-fork" : "file-text";
		setIcon(iconEl, icon);
	}
	row.createDiv({ cls: "hearth-list-label", text: label });
	const open = () => openBookmark(view, item);
	row.addEventListener("click", open);
	makeClickable(row, open, label);
}


/** Show a site favicon for a URL bookmark, falling back to the globe icon if the
 * URL can't be parsed or the favicon fails to load (e.g. offline). */
function renderFavicon(iconEl: HTMLElement, url: string): void {
	let host: string;
	try {
		host = new URL(url).hostname;
	} catch {
		setIcon(iconEl, "globe");
		return;
	}
	const img = iconEl.createEl("img", { cls: "hearth-favicon" });
	img.setAttribute("loading", "lazy");
	img.setAttribute("referrerpolicy", "no-referrer");
	img.addEventListener("error", () => {
		img.remove();
		setIcon(iconEl, "globe");
	});
	img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}


/**
 * Follow a bookmark — every kind of one.
 *
 * Which destination a bookmark has is {@link bookmarkTarget}'s decision (and
 * the part with #327 in it); this is only the doing of it. The two kinds that
 * need a core plugin say so when it is switched off, because silence is exactly
 * what the bug looked like.
 */
function openBookmark(view: HomeView, item: BookmarkItem): void {
	const target = bookmarkTarget(
		item,
		(path) => view.app.vault.getAbstractFileByPath(path) instanceof TFolder,
	);
	switch (target.kind) {
		case "none":
			return;
		case "url":
			window.open(target.url, "_blank");
			return;
		case "search":
			// The same hand-off a tag click makes: Obsidian's own search pane.
			if (!openSearch(view.app, target.query)) new Notice(t().cards.bookmarks.needsSearch);
			return;
		case "graph":
			void openGraph(view, target.options);
			return;
		case "folder":
			// Hearth's own folder browser (#329) rather than core's reveal in the
			// sidebar: the plugin already has its own answer to "show me this
			// folder", and it is a better one on a board.
			openFolder(view, target.path);
			return;
		case "file":
			openNote(view, target.path, target.subpath);
			return;
	}
}


/**
 * Open a bookmarked note, at the heading or block the bookmark points into.
 *
 * The subpath rides along as ephemeral state — the same thing Obsidian's own
 * link resolution ends up handing the view — rather than being spliced back
 * onto the path as a linktext. A linktext would be re-parsed, and the parser
 * splits on `#` and `|`, so a file named from outside Obsidian (`chart#1.png`)
 * would resolve to the wrong target or to nothing at all.
 *
 * The path is still resolved through the vault first, and a path that is no
 * longer a note opens nothing. `pruneBookmarks` hides those rows, but a note
 * deleted *after* the card drew leaves one behind, and the one thing a stale
 * row must not do is create an empty note where the old one was.
 */
function openNote(view: HomeView, path: string, subpath?: string): void {
	const file = view.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return;
	void openFile(view, file, "card", null, subpath ? { eState: { subpath } } : undefined);
}


/** Hand a bookmarked folder to the folder browser. There is no card config to
 * read here — a bookmark is a path and nothing else — so the browser opens on
 * its own defaults: the explorer's order, everything shown, no counts. */
function openFolder(view: HomeView, path: string): void {
	openFolderBrowser(view, {
		path,
		sort: FOLDER_SORT_DEFAULT,
		show: "all",
		counts: false,
	});
}


/** Open the graph view carrying the bookmark's saved state — the filters,
 * groups and forces that *are* what was bookmarked. Goes wherever the user's
 * "open in" setting sends a card's click, like every other row. */
async function openGraph(view: HomeView, options: Record<string, unknown>): Promise<void> {
	if (!view.app.internalPlugins.getPluginById("graph")?.enabled) {
		new Notice(t().cards.bookmarks.needsGraph);
		return;
	}
	await targetLeaf(view, "card").setViewState({ type: "graph", state: options, active: true });
}


/**
 * Redraw the card when the bookmark store changes.
 *
 * The card was `static`: adding, renaming, removing or reordering a bookmark
 * left it showing the old list until something unrelated rebuilt the board. No
 * liveness mode covers this, because the store is a file in the config folder
 * and none of the vault events see it — but the plugin instance announces its
 * own writes, so the card listens to those instead.
 *
 * Defensive throughout: `on` is an internal, and a build without it should
 * leave the card exactly as stale as it was before, never broken. Off the board
 * (a preview, a test) there is no component to unregister with and nothing to
 * redraw, so there is nothing to subscribe to either.
 */
function watchBookmarks(
	instance: BookmarksInstance,
	body: HTMLElement,
	component?: Component,
): void {
	if (!component || typeof instance.on !== "function") return;
	try {
		const ref = instance.on("changed", () => {
			redrawCard(body);
		});
		if (ref) component.registerEvent(ref);
	} catch {
		// An internal that changed shape. The card simply stays static.
	}
}

/** The core Bookmarks plugin's entries, grouped. No settings. */
export const bookmarksCard: CardDefinition<"bookmarks"> = {
	kind: "bookmarks",
	templates: [
		{ id: "bookmarks", name: "Bookmarks", icon: "bookmark", build: () => ({ kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 }) },
	],
	render: (view, _card, body, component) => renderBookmarks(view, body, component),
	// Not `static` any more in spirit — the card follows the bookmark store
	// itself (see `watchBookmarks`), which no liveness mode can express.
	liveness: { mode: "static" },
};
