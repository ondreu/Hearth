import { setIcon, TFile, TFolder } from "obsidian";
import { emptyState } from "../cardbodies";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { t } from "../i18n";
import { type BookmarkItem } from "../obsidian-ext";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


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


export function renderBookmarks(view: HomeView, body: HTMLElement): void {
	const plugin = view.app.internalPlugins.getPluginById("bookmarks");
	const instance = plugin?.instance as
		| { items?: BookmarkItem[]; getBookmarks?: () => BookmarkItem[] }
		| undefined;

	if (!plugin?.enabled || !instance) {
		emptyState(body, "bookmark", t().cards.empty.bookmarksEnable);
		return;
	}

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


function openBookmark(view: HomeView, item: BookmarkItem): void {
	if (item.type === "url" && item.url) {
		window.open(item.url, "_blank");
		return;
	}
	if (item.path) {
		const file = view.app.vault.getAbstractFileByPath(item.path);
		if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
	}
}

/** The core Bookmarks plugin's entries, grouped. No settings. */
export const bookmarksCard: CardDefinition<"bookmarks"> = {
	kind: "bookmarks",
	templates: [
		{ id: "bookmarks", name: "Bookmarks", icon: "bookmark", build: () => ({ kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 }) },
	],
	render: (view, _card, body) => renderBookmarks(view, body),
	liveness: { mode: "static" },
};
