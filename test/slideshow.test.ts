import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import {
	SLIDESHOW_DEFAULT_INTERVAL_SEC,
	SLIDESHOW_DEFAULT_TRANSITION_MS,
	SLIDESHOW_MAX_INTERVAL_SEC,
	SLIDESHOW_MAX_TRANSITION_MS,
	inSlideshowFolder,
	normalizeFolderPath,
	orderPictures,
	pictureLabel,
	shufflePictures,
	slideshowIntervalMs,
	slideshowOrder,
	slideshowReactsTo,
	slideshowSource,
	slideshowTransitionMs,
	type SlideshowPicture,
} from "../src/slideshow";
import type { VaultEvent } from "../src/cardevents";
import type { DashboardCard, SlideshowConfig } from "../src/types";

/**
 * The slideshow card's pure half: which pictures a card shows, in what order,
 * and which vault events are worth a redraw. Everything here is data in, data
 * out — the vault reads and the DOM work around it are deliberately untested,
 * per the "no Obsidian API mocks" rule.
 */

function picture(
	path: string,
	extra: Partial<SlideshowPicture> = {},
): SlideshowPicture {
	return {
		path,
		name: path.split("/").pop()!.replace(/\.[^.]+$/, ""),
		created: 0,
		modified: 0,
		...extra,
	};
}

/** A vault event carrying just the path(s) the predicate reads. */
function event(kind: VaultEvent["kind"], path: string, oldPath?: string): VaultEvent {
	return { kind, file: Object.assign(new TFile(), { path }), oldPath };
}

function card(slideshow: SlideshowConfig): DashboardCard {
	return { id: "c", kind: "slideshow", x: 0, y: 0, w: 4, h: 3, slideshow };
}

describe("slideshow config resolution", () => {
	it("defaults to the hand-picked list", () => {
		expect(slideshowSource({})).toBe("list");
		expect(slideshowSource({ source: "list" })).toBe("list");
		expect(slideshowSource({ source: "folder" })).toBe("folder");
	});

	// "manual" means "the order the list is in", which a folder has none of — it
	// would otherwise fall through to the vault's arbitrary child order.
	it("resolves the list-only 'manual' order to by-name for a folder", () => {
		expect(slideshowOrder({})).toBe("manual");
		expect(slideshowOrder({ order: "manual" })).toBe("manual");
		expect(slideshowOrder({ source: "folder" })).toBe("name");
		expect(slideshowOrder({ source: "folder", order: "manual" })).toBe("name");
		expect(slideshowOrder({ source: "folder", order: "random" })).toBe("random");
	});

	it("resolves the hold time, with 0 meaning 'do not rotate'", () => {
		expect(slideshowIntervalMs({})).toBe(SLIDESHOW_DEFAULT_INTERVAL_SEC * 1000);
		expect(slideshowIntervalMs({ intervalSec: 3 })).toBe(3000);
		expect(slideshowIntervalMs({ intervalSec: 0 })).toBe(0);
		// Nonsense from a hand-edited data.json must not produce a runaway timer.
		expect(slideshowIntervalMs({ intervalSec: -5 })).toBe(0);
		expect(slideshowIntervalMs({ intervalSec: Number.NaN })).toBe(0);
		expect(slideshowIntervalMs({ intervalSec: 1e9 })).toBe(SLIDESHOW_MAX_INTERVAL_SEC * 1000);
	});

	it("resolves the transition length", () => {
		expect(slideshowTransitionMs({})).toBe(SLIDESHOW_DEFAULT_TRANSITION_MS);
		expect(slideshowTransitionMs({ transitionMs: 250 })).toBe(250);
		expect(slideshowTransitionMs({ transitionMs: 0 })).toBe(0);
		expect(slideshowTransitionMs({ transitionMs: -1 })).toBe(SLIDESHOW_DEFAULT_TRANSITION_MS);
		expect(slideshowTransitionMs({ transitionMs: 99999 })).toBe(SLIDESHOW_MAX_TRANSITION_MS);
	});

	it("labels a picture with its caption, then its file name", () => {
		expect(pictureLabel(picture("Photos/beach.jpg"))).toBe("beach");
		expect(pictureLabel(picture("Photos/beach.jpg", { caption: "Sardinia" }))).toBe("Sardinia");
		// A caption of only spaces is not a caption.
		expect(pictureLabel(picture("Photos/beach.jpg", { caption: "   " }))).toBe("beach");
	});
});

describe("folder scope", () => {
	it("normalizes a folder path, with the vault root as the empty string", () => {
		expect(normalizeFolderPath(undefined)).toBe("");
		expect(normalizeFolderPath("/")).toBe("");
		expect(normalizeFolderPath("  Photos/Trips/  ")).toBe("Photos/Trips");
		expect(normalizeFolderPath("/Photos/")).toBe("Photos");
	});

	it("takes only direct children unless subfolders are asked for", () => {
		expect(inSlideshowFolder("Photos", "Photos/a.png")).toBe(true);
		expect(inSlideshowFolder("Photos", "Photos/Trips/a.png")).toBe(false);
		expect(inSlideshowFolder("Photos", "Photos/Trips/a.png", true)).toBe(true);
	});

	it("does not mistake a sibling folder for the scope", () => {
		// "PhotosOld/a.png" starts with "Photos" as a *string*, not as a folder.
		expect(inSlideshowFolder("Photos", "PhotosOld/a.png", true)).toBe(false);
		expect(inSlideshowFolder("Photos", "Photos", true)).toBe(false);
	});

	it("treats an empty scope as the vault root", () => {
		expect(inSlideshowFolder(undefined, "a.png")).toBe(true);
		expect(inSlideshowFolder("", "a.png")).toBe(true);
		expect(inSlideshowFolder("/", "a.png")).toBe(true);
		// Without subfolders, the root means the root only.
		expect(inSlideshowFolder("", "Photos/a.png")).toBe(false);
		expect(inSlideshowFolder("", "Photos/a.png", true)).toBe(true);
	});
});

describe("orderPictures", () => {
	const pictures = [
		picture("Photos/c.png", { created: 300, modified: 100 }),
		picture("Photos/a.png", { created: 200, modified: 300 }),
		picture("Photos/b.png", { created: 100, modified: 200 }),
	];
	const paths = (list: SlideshowPicture[]) => list.map((p) => p.name);

	it("keeps the list's own order for 'manual'", () => {
		expect(paths(orderPictures(pictures, "manual"))).toEqual(["c", "a", "b"]);
	});

	it("sorts by name, both ways", () => {
		expect(paths(orderPictures(pictures, "name"))).toEqual(["a", "b", "c"]);
		expect(paths(orderPictures(pictures, "nameDesc"))).toEqual(["c", "b", "a"]);
	});

	it("sorts by creation and modification date, both ways", () => {
		expect(paths(orderPictures(pictures, "created"))).toEqual(["b", "a", "c"]);
		expect(paths(orderPictures(pictures, "createdDesc"))).toEqual(["c", "a", "b"]);
		expect(paths(orderPictures(pictures, "modified"))).toEqual(["c", "b", "a"]);
		expect(paths(orderPictures(pictures, "modifiedDesc"))).toEqual(["a", "b", "c"]);
	});

	// Two photos exported in the same second are common; without the path
	// tie-break their order would depend on the engine's sort and could differ
	// between redraws of the same card.
	it("breaks ties on the path so the order is stable", () => {
		const sameTime = [
			picture("Photos/b.png", { created: 5 }),
			picture("Photos/a.png", { created: 5 }),
			picture("Album/a.png", { created: 5 }),
		];
		expect(orderPictures(sameTime, "created").map((p) => p.path)).toEqual([
			"Album/a.png",
			"Photos/a.png",
			"Photos/b.png",
		]);
		// Same names, different folders: still deterministic.
		expect(orderPictures(sameTime, "name").map((p) => p.path)).toEqual([
			"Album/a.png",
			"Photos/a.png",
			"Photos/b.png",
		]);
	});

	it("never mutates its input", () => {
		const input = [...pictures];
		orderPictures(input, "name");
		orderPictures(input, "random");
		expect(paths(input)).toEqual(["c", "a", "b"]);
	});

	it("shuffles every picture exactly once for 'random'", () => {
		const shuffled = orderPictures(pictures, "random");
		expect(shuffled).toHaveLength(pictures.length);
		expect(paths(shuffled).sort()).toEqual(["a", "b", "c"]);
	});

	it("shuffles in place, keeping the same set", () => {
		const items = [1, 2, 3, 4, 5];
		expect(shufflePictures(items)).toBe(items);
		expect([...items].sort()).toEqual([1, 2, 3, 4, 5]);
	});
});

describe("slideshowReactsTo", () => {
	// A slideshow redraw restarts the rotation, so the events that can't change
	// which pictures exist must not trigger one — this is the whole reason the
	// card has its own predicate instead of redrawing on every vault event.
	it("ignores content edits and metadata reparses", () => {
		const folderCard = card({ source: "folder", folder: "Photos" });
		expect(slideshowReactsTo(folderCard, event("modify", "Photos/a.png"))).toBe(false);
		expect(slideshowReactsTo(folderCard, event("meta", "Photos/a.png"))).toBe(false);
		expect(slideshowReactsTo(folderCard, event("create", "Photos/a.png"))).toBe(true);
		expect(slideshowReactsTo(folderCard, event("delete", "Photos/a.png"))).toBe(true);
	});

	it("watches the scope of a folder card", () => {
		const shallow = card({ source: "folder", folder: "Photos" });
		expect(slideshowReactsTo(shallow, event("create", "Photos/a.png"))).toBe(true);
		expect(slideshowReactsTo(shallow, event("create", "Notes/a.png"))).toBe(false);
		expect(slideshowReactsTo(shallow, event("create", "Photos/Trips/a.png"))).toBe(false);

		const deep = card({ source: "folder", folder: "Photos", includeSubfolders: true });
		expect(slideshowReactsTo(deep, event("create", "Photos/Trips/a.png"))).toBe(true);
	});

	// A folder rename arrives as one event for the folder, not one per file, so
	// the card has to recognise its own scope moving out from under it.
	it("notices its folder (or an ancestor) being renamed", () => {
		const folderCard = card({ source: "folder", folder: "Photos/Trips" });
		expect(slideshowReactsTo(folderCard, event("rename", "Trips", "Photos/Trips"))).toBe(true);
		expect(slideshowReactsTo(folderCard, event("rename", "Album", "Photos"))).toBe(true);
		expect(slideshowReactsTo(folderCard, event("rename", "Other", "Elsewhere"))).toBe(false);
	});

	it("watches only the listed pictures of a list card", () => {
		const listCard = card({
			slides: [
				{ id: "1", path: "Photos/a.png" },
				{ id: "2", path: "Album/b.png" },
			],
		});
		expect(slideshowReactsTo(listCard, event("delete", "Photos/a.png"))).toBe(true);
		expect(slideshowReactsTo(listCard, event("delete", "Photos/z.png"))).toBe(false);
		// Renaming a listed picture: both the new and the old path count.
		expect(slideshowReactsTo(listCard, event("rename", "Photos/c.png", "Album/b.png"))).toBe(true);
		// Renaming a folder a listed picture lives in moves that picture too.
		expect(slideshowReactsTo(listCard, event("rename", "Pics", "Photos"))).toBe(true);
	});

	it("stays quiet for a card with nothing configured", () => {
		expect(slideshowReactsTo(card({}), event("create", "Photos/a.png"))).toBe(false);
		expect(slideshowReactsTo({ id: "c", kind: "slideshow", x: 0, y: 0, w: 4, h: 3 }, event("create", "a.png"))).toBe(false);
	});
});
