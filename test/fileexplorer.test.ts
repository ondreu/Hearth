import { describe, expect, it } from "vitest";
import type { TAbstractFile } from "obsidian";
import { folderDestination, revealInFolderFn } from "../src/fileexplorer";
import { sanitizeCard } from "../src/layout";

/**
 * Revealing a folder in Obsidian's own file explorer (#448).
 *
 * The reveal itself is an internal of the core plugin, so what can be pinned
 * here is the part that decides: whether an object holds a reveal at all (and
 * that it is called on the object it came from), what a stored choice means,
 * and that the new choices survive a board being sanitized — the spot where a
 * missing allowlist entry loses a setting quietly, with no typecheck to catch
 * it.
 */

const aFolder = { path: "Projects" } as unknown as TAbstractFile;

describe("revealInFolderFn", () => {
	it("calls the holder's reveal on the holder itself", () => {
		const calls: unknown[] = [];
		const view = {
			revealInFolder(file: TAbstractFile): void {
				calls.push([this, file]);
			},
		};
		const reveal = revealInFolderFn(view);
		expect(reveal).not.toBeNull();
		reveal?.(aFolder);
		expect(calls).toEqual([[view, aFolder]]);
	});

	it("has nothing for a holder without a reveal", () => {
		expect(revealInFolderFn({})).toBeNull();
		expect(revealInFolderFn(undefined)).toBeNull();
		expect(revealInFolderFn(null)).toBeNull();
	});

	it("ignores a field that is not a function", () => {
		// An internal that changed shape must not be called.
		expect(revealInFolderFn({ revealInFolder: "yes" })).toBeNull();
		expect(revealInFolderFn({ revealInFolder: 42 })).toBeNull();
	});
});

describe("folderDestination", () => {
	it("browses by default, which is what a folder click always did", () => {
		expect(folderDestination(undefined)).toBe("browser");
	});

	it("goes to the sidebar when the card asks for it", () => {
		expect(folderDestination("explorer")).toBe("explorer");
	});
});

describe("sanitizing the sidebar choices", () => {
	const card = (extra: Record<string, unknown>) =>
		sanitizeCard({ id: "c1", kind: "folder", x: 0, y: 0, w: 4, h: 3, ...extra }, 0);

	it("keeps a folder card's sidebar destination", () => {
		expect(card({ folder: { navigate: "explorer" } })?.folder?.navigate).toBe("explorer");
	});

	it("keeps the two older destinations", () => {
		expect(card({ folder: { navigate: "card" } })?.folder?.navigate).toBe("card");
		expect(card({ folder: {} })?.folder?.navigate).toBeUndefined();
	});

	it("drops a destination it does not know", () => {
		expect(card({ folder: { navigate: "sidebar" } })?.folder?.navigate).toBeUndefined();
	});

	it("keeps a bookmarks card's sidebar destination", () => {
		expect(card({ kind: "bookmarks", folderTarget: "explorer" })?.folderTarget).toBe(
			"explorer",
		);
	});

	it("drops a bookmarks destination it does not know", () => {
		expect(card({ kind: "bookmarks", folderTarget: "browser" })?.folderTarget).toBeUndefined();
	});

	it("keeps a launchpad's sidebar destination", () => {
		// One field serves both kinds: a folder bookmark and a folder button
		// answer the same question.
		expect(card({ kind: "links", folderTarget: "explorer" })?.folderTarget).toBe("explorer");
	});
});

describe("a launchpad folder tile", () => {
	it("survives sanitizing as a folder, target and all", () => {
		const card = sanitizeCard(
			{
				id: "c1",
				kind: "links",
				x: 0,
				y: 0,
				w: 4,
				h: 3,
				links: [
					{
						id: "link-1",
						label: "Projects",
						icon: "folder",
						target: "Projects",
						type: "folder",
					},
				],
			},
			0,
		);
		expect(card?.links?.[0]).toEqual({
			id: "link-1",
			label: "Projects",
			icon: "folder",
			target: "Projects",
			type: "folder",
		});
	});

	it("still reads an unknown type as a note, so an old board is unchanged", () => {
		const card = sanitizeCard(
			{
				id: "c1",
				kind: "links",
				x: 0,
				y: 0,
				w: 4,
				h: 3,
				links: [{ id: "link-1", label: "", icon: "", target: "Notes/A.md", type: "nonsense" }],
			},
			0,
		);
		expect(card?.links?.[0]?.type).toBe("note");
	});
});
