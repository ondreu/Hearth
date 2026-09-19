/**
 * The bookmarks card's pure logic (#327): what a bookmark *points at*, decided
 * from the bookmark alone.
 *
 * No Obsidian imports — the card module does the opening, and everything here
 * works on the plain item shape the core plugin stores, so the one rule that
 * actually had the bug in it (which kinds are followable, and how) is directly
 * testable. See the "one exception, for tests" note in `src/cards/README.md`.
 */

// Shape of an Obsidian core "Bookmarks" item we care about. `type` is one of
// "file" | "folder" | "search" | "group" | "graph" | "url" (and possibly
// others), kept as a plain string since the literals collapse into it anyway.
export interface BookmarkItem {
	type: string;
	title?: string;
	path?: string;
	/** A `file` bookmark may point *into* the note — "#Heading", "#^block-id" —
	 * which is often the whole point of bookmarking one. Stored the way it would
	 * appear after the path in a wikilink, leading `#` included. */
	subpath?: string;
	url?: string;
	query?: string;
	/** A `graph` bookmark carries the graph view's saved state (filters, forces,
	 * colour groups): opaque to us, handed straight back to the graph view. */
	options?: Record<string, unknown>;
	items?: BookmarkItem[];
}

/**
 * Where following a bookmark should lead.
 *
 * Obsidian bookmarks five things, and the card drew a clickable row for all
 * five while only ever opening two of them: a folder fell through an
 * `instanceof TFile` check, and a saved search or a graph never had a branch at
 * all (#327). A row that looks clickable and does nothing is worse than no row,
 * so every kind resolves to a destination — or explicitly to `none`, for a
 * bookmark missing the one field that makes it followable.
 */
export type BookmarkTarget =
	/** Nothing to open: a group header, or an item without its target. */
	| { kind: "none" }
	| { kind: "url"; url: string }
	| { kind: "search"; query: string }
	| { kind: "graph"; options: Record<string, unknown> }
	| { kind: "folder"; path: string }
	/** `subpath` is the heading or block the bookmark points *into*, kept apart
	 * from the path rather than joined into one linktext: Obsidian's link parser
	 * splits on `#` and `|`, so a file named from outside the app — `chart#1.png`,
	 * `C# notes.md` — would resolve to the wrong target, or to nothing. */
	| { kind: "file"; path: string; subpath?: string };

/**
 * Resolve a bookmark to its destination.
 *
 * `isFolder` is injected rather than looked up: the decision needs the vault
 * for exactly one thing — telling a folder from a note when the item's own
 * `type` does not already say — and passing that in keeps the rest of the rule
 * free of Obsidian.
 */
export function bookmarkTarget(
	item: BookmarkItem,
	isFolder: (path: string) => boolean,
): BookmarkTarget {
	switch (item.type) {
		case "group":
			return { kind: "none" };
		case "url":
			return item.url ? { kind: "url", url: item.url } : { kind: "none" };
		case "search":
			return item.query ? { kind: "search", query: item.query } : { kind: "none" };
		case "graph":
			return { kind: "graph", options: item.options ?? {} };
		case "folder":
			// Taken at its word even if the folder has since gone: the browser
			// shows the reader an empty folder and says which one, where falling
			// through to the file branch would leave the click silent again.
			return item.path ? { kind: "folder", path: item.path } : { kind: "none" };
		default: {
			const path = item.path;
			if (!path) return { kind: "none" };
			// A "file" bookmark on a folder is not a shape core produces, but the
			// type is a plain string out of the store and the row was drawn from
			// it — so trust the vault over the label rather than doing nothing.
			if (isFolder(path)) return { kind: "folder", path };
			return item.subpath ? { kind: "file", path, subpath: item.subpath } : { kind: "file", path };
		}
	}
}
