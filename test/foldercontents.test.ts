import { describe, expect, it } from "vitest";
import {
	asFolderSort,
	filterFolderEntries,
	folderTouches,
	folderTrail,
	groupFolderEntries,
	naturalCompare,
	orderByPaths,
	parentPath,
	pathWithin,
	sortFolderEntries,
	type FolderEntry,
} from "../src/foldercontents";

/**
 * The folder card's ordering and grouping rules (#329). Everything here is
 * pure: the card module turns the vault's own objects into `FolderEntry`
 * values, and reading the explorer's order is `explorerorder.ts`'s job (all
 * Obsidian internals, so deliberately untested).
 */

function file(name: string, extra: Partial<FolderEntry> = {}): FolderEntry {
	return {
		path: extra.path ?? `${name}.md`,
		name,
		isFolder: false,
		mtime: 0,
		ctime: 0,
		extension: "md",
		...extra,
	};
}

function folder(name: string, extra: Partial<FolderEntry> = {}): FolderEntry {
	return {
		path: extra.path ?? name,
		name,
		isFolder: true,
		mtime: 0,
		ctime: 0,
		extension: "",
		...extra,
	};
}

const names = (entries: FolderEntry[]) => entries.map((e) => e.name);

describe("naturalCompare", () => {
	it("orders embedded numbers as numbers, not as text", () => {
		expect(["note 10", "note 2"].sort()).not.toEqual(["note 2", "note 10"]);
		expect(["note 10", "note 2"].sort(naturalCompare)).toEqual(["note 2", "note 10"]);
	});

	it("ignores case", () => {
		expect(naturalCompare("apple", "Banana")).toBeLessThan(0);
	});
});

describe("sortFolderEntries", () => {
	const entries = [
		file("beta", { mtime: 300, ctime: 100 }),
		folder("Zulu"),
		file("alpha", { mtime: 100, ctime: 300 }),
		folder("apex"),
	];

	it("puts folders first and sorts each side by name", () => {
		expect(names(sortFolderEntries(entries, "name"))).toEqual(["apex", "Zulu", "alpha", "beta"]);
	});

	it("reverses both sides for a descending name sort", () => {
		expect(names(sortFolderEntries(entries, "nameDesc"))).toEqual(["Zulu", "apex", "beta", "alpha"]);
	});

	it("keeps folders first and alphabetical under a time sort", () => {
		// A folder has no modification time of its own, so ordering them by one
		// would be ordering them by nothing — the file explorer does the same.
		expect(names(sortFolderEntries(entries, "modified"))).toEqual(["apex", "Zulu", "beta", "alpha"]);
		expect(names(sortFolderEntries(entries, "modifiedAsc"))).toEqual(["apex", "Zulu", "alpha", "beta"]);
		expect(names(sortFolderEntries(entries, "created"))).toEqual(["apex", "Zulu", "alpha", "beta"]);
		expect(names(sortFolderEntries(entries, "createdAsc"))).toEqual(["apex", "Zulu", "beta", "alpha"]);
	});

	it("falls back to alphabetical when asked for the explorer's order", () => {
		// `explorer` is resolved before this is reached; arriving here means the
		// sidebar couldn't be read, and the explorer's own default is A–Z.
		expect(names(sortFolderEntries(entries, "explorer"))).toEqual(["apex", "Zulu", "alpha", "beta"]);
	});

	it("does not mutate the list it was given", () => {
		const input = [...entries];
		sortFolderEntries(input, "nameDesc");
		expect(input).toEqual(entries);
	});
});

describe("orderByPaths", () => {
	const entries = [file("a", { path: "a.md" }), file("b", { path: "b.md" }), folder("C", { path: "C" })];

	it("follows the given order exactly, folders and files interleaved", () => {
		expect(names(orderByPaths(entries, ["b.md", "C", "a.md"]))).toEqual(["b", "C", "a"]);
	});

	it("keeps an unlisted entry, at the end, in its incoming order", () => {
		// A folder the explorer hides (or hasn't built while collapsed) must not
		// drop out of a listing whose whole job is to show the folder.
		expect(names(orderByPaths(entries, ["C"]))).toEqual(["C", "a", "b"]);
	});

	it("ignores paths that name nothing here", () => {
		expect(names(orderByPaths(entries, ["gone.md", "b.md"]))).toEqual(["b", "a", "C"]);
	});
});

describe("filterFolderEntries", () => {
	const entries = [folder("Notes"), file("a")];

	it("keeps everything by default, or one kind on request", () => {
		expect(names(filterFolderEntries(entries, "all"))).toEqual(["Notes", "a"]);
		expect(names(filterFolderEntries(entries, "folders"))).toEqual(["Notes"]);
		expect(names(filterFolderEntries(entries, "files"))).toEqual(["a"]);
	});
});

describe("groupFolderEntries", () => {
	const children = (entry: FolderEntry) => [file(`${entry.name} child`)];

	it("gives each folder its own group and gathers the files between them", () => {
		const groups = groupFolderEntries(
			[file("a"), file("b"), folder("One"), file("c"), folder("Two")],
			children,
		);
		expect(groups.map((g) => (g.kind === "files" ? names(g.entries) : g.folder.name))).toEqual([
			["a", "b"],
			"One",
			["c"],
			"Two",
		]);
	});

	it("hangs each folder's own level under it", () => {
		const groups = groupFolderEntries([folder("One")], children);
		expect(groups[0].kind === "folder" && names(groups[0].children)).toEqual(["One child"]);
	});

	it("makes one block of a listing with no folders in it, and nothing of an empty one", () => {
		const flat = groupFolderEntries([file("a"), file("b")], children);
		expect(flat).toHaveLength(1);
		expect(groupFolderEntries([], children)).toEqual([]);
	});
});

describe("folderTrail and parentPath", () => {
	it("walks the path down from the root, which it never includes", () => {
		expect(folderTrail("A/B/C")).toEqual([
			{ name: "A", path: "A" },
			{ name: "B", path: "A/B" },
			{ name: "C", path: "A/B/C" },
		]);
		expect(folderTrail("")).toEqual([]);
	});

	it("reads the holding folder off a path, the root as an empty string", () => {
		expect(parentPath("A/B/note.md")).toBe("A/B");
		expect(parentPath("note.md")).toBe("");
	});
});

describe("pathWithin", () => {
	it("holds for the folder itself and anything under it", () => {
		expect(pathWithin("A", "A")).toBe(true);
		expect(pathWithin("A/B", "A")).toBe(true);
		expect(pathWithin("A/B/c.md", "A")).toBe(true);
	});

	it("does not hold for a sibling whose name merely starts the same", () => {
		expect(pathWithin("Archive", "A")).toBe(false);
		expect(pathWithin("B/A", "A")).toBe(false);
	});

	it("holds for everything under the vault root", () => {
		expect(pathWithin("A/B", "")).toBe(true);
		expect(pathWithin("", "")).toBe(true);
	});
});

describe("folderTouches", () => {
	it("counts the folder itself and its direct children", () => {
		expect(folderTouches("A", "A", false)).toBe(true);
		expect(folderTouches("A", "A/note.md", false)).toBe(true);
		expect(folderTouches("A", "A/Sub/note.md", false)).toBe(false);
		expect(folderTouches("A", "B/note.md", false)).toBe(false);
	});

	it("counts anything below the folder once counts are being shown", () => {
		expect(folderTouches("A", "A/Sub/note.md", true)).toBe(true);
		expect(folderTouches("A", "B/note.md", true)).toBe(false);
	});

	it("treats the vault root as holding its own children, not the whole vault", () => {
		expect(folderTouches("", "note.md", false)).toBe(true);
		expect(folderTouches("", "A/note.md", false)).toBe(false);
		expect(folderTouches("", "A/note.md", true)).toBe(true);
	});
});

describe("asFolderSort", () => {
	it("passes a known sort through and rejects anything else", () => {
		expect(asFolderSort("modified")).toBe("modified");
		expect(asFolderSort("explorer")).toBe("explorer");
		expect(asFolderSort("byModifiedTime")).toBeUndefined();
		expect(asFolderSort(undefined)).toBeUndefined();
		expect(asFolderSort(7)).toBeUndefined();
	});
});
