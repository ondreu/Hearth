import { describe, expect, it } from "vitest";
import { bookmarkTarget, type BookmarkItem } from "../src/bookmarks";

/**
 * Where each kind of bookmark leads (#327).
 *
 * The card used to draw a clickable row for all five kinds while only opening
 * two of them, so the interesting assertions here are the ones that say a kind
 * resolves to *something*. Pure throughout: the vault is present only as the
 * injected `isFolder` predicate, and the actual opening (the note, the folder
 * browser, the search pane, the graph view) is Obsidian API work the card
 * module does and no test mocks.
 */

/** No path in the vault is a folder — the common case for these items. */
const noFolders = () => false;

/** Every path is a folder. */
const allFolders = () => true;

function item(type: string, extra: Partial<BookmarkItem> = {}): BookmarkItem {
	return { type, ...extra };
}

describe("bookmarkTarget", () => {
	it("sends a url bookmark to its url", () => {
		expect(bookmarkTarget(item("url", { url: "https://example.com" }), noFolders)).toEqual({
			kind: "url",
			url: "https://example.com",
		});
	});

	it("sends a file bookmark to its note", () => {
		expect(bookmarkTarget(item("file", { path: "Notes/Ideas.md" }), noFolders)).toEqual({
			kind: "file",
			path: "Notes/Ideas.md",
		});
	});

	it("keeps a file bookmark's subpath, so it lands on the heading", () => {
		expect(
			bookmarkTarget(item("file", { path: "Notes/Ideas.md", subpath: "#Later" }), noFolders),
		).toEqual({ kind: "file", path: "Notes/Ideas.md", subpath: "#Later" });
	});

	it("keeps a block reference the same way", () => {
		expect(
			bookmarkTarget(item("file", { path: "Log.md", subpath: "#^a1b2c3" }), noFolders),
		).toEqual({ kind: "file", path: "Log.md", subpath: "#^a1b2c3" });
	});

	it("leaves a hash in the file's own name alone", () => {
		// The path and the subpath stay apart precisely so this one survives:
		// joined into a linktext, "#1" would be re-parsed as a heading jump.
		expect(bookmarkTarget(item("file", { path: "Attachments/chart#1.png" }), noFolders)).toEqual({
			kind: "file",
			path: "Attachments/chart#1.png",
		});
	});

	it("sends a folder bookmark to the folder, not the file opener", () => {
		// The regression: a folder used to fall through an `instanceof TFile`
		// check and the click did nothing at all.
		expect(bookmarkTarget(item("folder", { path: "Projects" }), allFolders)).toEqual({
			kind: "folder",
			path: "Projects",
		});
	});

	it("keeps a folder bookmark a folder even when the folder has gone", () => {
		// Deleted between the render and the click: the browser can show that,
		// where the file branch would leave the click silent again.
		expect(bookmarkTarget(item("folder", { path: "Projects" }), noFolders)).toEqual({
			kind: "folder",
			path: "Projects",
		});
	});

	it("trusts the vault over a file label on a folder path", () => {
		expect(bookmarkTarget(item("file", { path: "Projects" }), allFolders)).toEqual({
			kind: "folder",
			path: "Projects",
		});
	});

	it("sends a search bookmark to its query", () => {
		expect(bookmarkTarget(item("search", { query: "tag:#todo" }), noFolders)).toEqual({
			kind: "search",
			query: "tag:#todo",
		});
	});

	it("sends a graph bookmark to the graph, carrying its saved state", () => {
		const options = { search: "tag:#map", showTags: true };
		expect(bookmarkTarget(item("graph", { options }), noFolders)).toEqual({
			kind: "graph",
			options,
		});
	});

	it("opens a graph bookmark that saved no state", () => {
		// The state is what was bookmarked, but its absence is not a reason to
		// refuse the click: an empty graph view is still the right destination.
		expect(bookmarkTarget(item("graph"), noFolders)).toEqual({ kind: "graph", options: {} });
	});

	it("has nowhere to send a group", () => {
		// Groups are collapsible headers; the card toggles them instead.
		expect(bookmarkTarget(item("group", { items: [] }), noFolders)).toEqual({ kind: "none" });
	});

	it.each([
		["url", item("url")],
		["file", item("file")],
		["folder", item("folder")],
		["search", item("search")],
	])("has nowhere to send a %s bookmark missing its target", (_label, missing) => {
		expect(bookmarkTarget(missing, noFolders)).toEqual({ kind: "none" });
	});

	it("treats an unknown type with a path as a file", () => {
		// `type` is a plain string out of the store, and a future kind that names
		// a note should still open it rather than do nothing.
		expect(bookmarkTarget(item("canvas-node", { path: "Board.canvas" }), noFolders)).toEqual({
			kind: "file",
			path: "Board.canvas",
		});
	});
});
