/**
 * The folder card's pure logic (#329): what one folder's immediate contents
 * are, in what order they sit, and how they group on the browser's detail
 * page.
 *
 * No Obsidian imports — the card module turns `TFolder`/`TFile` into the flat
 * {@link FolderEntry} shape below and everything here works on that, so the
 * ordering and grouping rules are directly testable (see the "one exception,
 * for tests" note in `src/cards/README.md`).
 */

/**
 * How a folder's contents are ordered.
 *
 * `explorer` is the odd one out: it isn't an order of its own but "whatever the
 * file explorer in the sidebar is showing", resolved at render time by
 * `src/explorerorder.ts`. It is the default, so a card matches the sidebar the
 * user already arranged — including a plugin that reorders it (the issue's
 * reporter uses Flexplorer).
 */
export type FolderSort =
	| "explorer"
	| "name"
	| "nameDesc"
	| "modified"
	| "modifiedAsc"
	| "created"
	| "createdAsc";

/** Every sort, in the order the editor and the browser offer them. */
export const FOLDER_SORTS: readonly FolderSort[] = [
	"explorer",
	"name",
	"nameDesc",
	"modified",
	"modifiedAsc",
	"created",
	"createdAsc",
] as const;

/** The sort a card uses when it names none. */
export const FOLDER_SORT_DEFAULT: FolderSort = "explorer";

/** Narrow an unknown (persisted, imported) value to a sort. */
export function asFolderSort(value: unknown): FolderSort | undefined {
	return FOLDER_SORTS.includes(value as FolderSort) ? (value as FolderSort) : undefined;
}

/** Which of a folder's children a card lists. */
export type FolderShow = "all" | "folders" | "files";

/** One thing inside a folder — a subfolder or a file — flattened off the
 * vault's own objects so the ordering rules can be tested without them. */
export interface FolderEntry {
	/** Vault-relative path. The identity of the entry. */
	path: string;
	/** What the row says: a file's basename (no extension), a folder's name. */
	name: string;
	isFolder: boolean;
	/** Epoch ms from the vault's stat. Both are 0 for a folder, which has no
	 * stat of its own — see {@link sortFolderEntries} for what that means. */
	mtime: number;
	ctime: number;
	/** Lowercase extension for a file, "" for a folder. */
	extension: string;
}

/**
 * Compare two names the way a file list should: "note 2" before "note 10", and
 * case ignored, which is `localeCompare` with `numeric`. The same collation
 * Obsidian's own explorer uses for its alphabetical order.
 */
export function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Order a folder's children.
 *
 * Folders lead and are sorted among themselves by name, whatever the sort —
 * which is not an omission but what Obsidian's file explorer does: a folder has
 * no modification time of its own (the vault stats files, not directories), so
 * "newest first" can only mean something for the files. A name sort's direction
 * does carry to the folders, since that one is about names.
 *
 * `explorer` is resolved before this is reached (the caller applies the
 * sidebar's own order with {@link orderByPaths}); asking for it here falls back
 * to the alphabetical order the explorer starts life with.
 */
export function sortFolderEntries(entries: FolderEntry[], sort: FolderSort): FolderEntry[] {
	const byName = (a: FolderEntry, b: FolderEntry) => naturalCompare(a.name, b.name);
	const rank = (e: FolderEntry) => (e.isFolder ? 0 : 1);
	const compare = (a: FolderEntry, b: FolderEntry): number => {
		const byKind = rank(a) - rank(b);
		if (byKind !== 0) return byKind;
		if (a.isFolder) return sort === "nameDesc" ? -byName(a, b) : byName(a, b);
		switch (sort) {
			case "nameDesc":
				return -byName(a, b);
			case "modified":
				return b.mtime - a.mtime || byName(a, b);
			case "modifiedAsc":
				return a.mtime - b.mtime || byName(a, b);
			case "created":
				return b.ctime - a.ctime || byName(a, b);
			case "createdAsc":
				return a.ctime - b.ctime || byName(a, b);
			default:
				return byName(a, b);
		}
	};
	return [...entries].sort(compare);
}

/**
 * Put `entries` into the order `paths` gives, which is how the sidebar's own
 * order reaches the card.
 *
 * An entry the sidebar didn't name — the explorer hides it, or the order was
 * read while the folder was collapsed and only partly built — keeps its
 * incoming relative order and goes last rather than being dropped: the card
 * lists a folder's contents, so the one thing it must not do is quietly leave
 * something out.
 */
export function orderByPaths(entries: FolderEntry[], paths: readonly string[]): FolderEntry[] {
	const rank = new Map<string, number>();
	paths.forEach((path, i) => rank.set(path, i));
	return [...entries].sort((a, b) => {
		const ra = rank.get(a.path);
		const rb = rank.get(b.path);
		if (ra === undefined && rb === undefined) return 0;
		if (ra === undefined) return 1;
		if (rb === undefined) return -1;
		return ra - rb;
	});
}

/** Keep only what the card is set to show. */
export function filterFolderEntries(entries: FolderEntry[], show: FolderShow): FolderEntry[] {
	if (show === "folders") return entries.filter((e) => e.isFolder);
	if (show === "files") return entries.filter((e) => !e.isFolder);
	return entries;
}

/** A run of the browser's detail page: either a block of files or one
 * subfolder shown with its own children. */
export type FolderGroup =
	| { kind: "files"; entries: FolderEntry[] }
	| { kind: "folder"; folder: FolderEntry; children: FolderEntry[] };

/**
 * Cut an ordered listing into the detail page's sections, by the rule the issue
 * asks for: each subfolder is a section of its own, and the files between them
 * fall together into one block per run.
 *
 * Grouping by adjacency rather than by kind is the point — it keeps the page in
 * the sidebar's order, so a folder that sits between two files on the left
 * sits between them here too. Under a plain alphabetical sort (folders first)
 * that degenerates to the obvious thing: the folders, then one block of files.
 *
 * `childrenOf` supplies the extra level each folder section shows. It is passed
 * in rather than read off the vault so this stays pure.
 */
export function groupFolderEntries(
	entries: readonly FolderEntry[],
	childrenOf: (folder: FolderEntry) => FolderEntry[],
): FolderGroup[] {
	const groups: FolderGroup[] = [];
	let run: FolderEntry[] | null = null;
	for (const entry of entries) {
		if (entry.isFolder) {
			run = null;
			groups.push({ kind: "folder", folder: entry, children: childrenOf(entry) });
			continue;
		}
		if (!run) {
			run = [];
			groups.push({ kind: "files", entries: run });
		}
		run.push(entry);
	}
	return groups;
}

/** The trail from the vault root down to `path`, as `[name, path]` steps. The
 * root itself is never in it — the browser draws that crumb from the vault's
 * own name. */
export function folderTrail(path: string): { name: string; path: string }[] {
	const trail: { name: string; path: string }[] = [];
	const parts = path.split("/").filter(Boolean);
	let walked = "";
	for (const part of parts) {
		walked = walked ? `${walked}/${part}` : part;
		trail.push({ name: part, path: walked });
	}
	return trail;
}

/** The folder holding `path`, as a vault path ("" for a top-level item). */
export function parentPath(path: string): string {
	const cut = path.lastIndexOf("/");
	return cut === -1 ? "" : path.slice(0, cut);
}

/**
 * Whether a change at `path` can alter what a card rooted at `folder` shows.
 *
 * Direct children always count. Anything deeper only counts while the card
 * shows per-folder counts, which are the one thing that reads below the first
 * level. A card rooted at the vault root ("") sees every direct child of the
 * root, not the whole vault.
 */
export function folderTouches(folder: string, path: string, deep: boolean): boolean {
	if (path === folder) return true;
	if (parentPath(path) === folder) return true;
	if (!deep) return false;
	return folder === "" ? true : path.startsWith(`${folder}/`);
}
