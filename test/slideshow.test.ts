import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import {
	SLIDESHOW_DEFAULT_DAY_COUNT,
	SLIDESHOW_DEFAULT_INTERVAL_SEC,
	SLIDESHOW_DEFAULT_TRANSITION_MS,
	SLIDESHOW_MAX_DAY_COUNT,
	SLIDESHOW_MAX_INTERVAL_SEC,
	SLIDESHOW_MAX_TRANSITION_MS,
	dailySlideIndex,
	inSlideshowFolder,
	msUntilNextDay,
	normalizeFolderPath,
	orderPictures,
	pictureLabel,
	rememberSlideshowPosition,
	sanitizeSlideshowPositions,
	seededShuffle,
	shufflePictures,
	slideshowAdvance,
	slideshowDayCount,
	slideshowDayNumber,
	slideshowIntervalMs,
	slideshowOrder,
	slideshowPeriod,
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

describe("what moves the card on", () => {
	it("rotates on a timer unless told otherwise", () => {
		expect(slideshowAdvance({})).toBe("timer");
		expect(slideshowAdvance({ intervalSec: 20 })).toBe("timer");
		expect(slideshowAdvance({ advance: "daily" })).toBe("daily");
		expect(slideshowAdvance({ advance: "manual" })).toBe("manual");
		// An explicit choice wins over the interval it was saved next to.
		expect(slideshowAdvance({ advance: "timer", intervalSec: 0 })).toBe("timer");
	});

	// Before this setting existed, an interval of 0 was the only way to say
	// "don't rotate" — which is what "manual" means now.
	it("reads a pre-existing interval of 0 as manual", () => {
		expect(slideshowAdvance({ intervalSec: 0 })).toBe("manual");
		expect(slideshowAdvance({ intervalSec: -5 })).toBe("manual");
	});

	it("holds a picture for at least a day, and at most a year", () => {
		expect(slideshowDayCount({})).toBe(SLIDESHOW_DEFAULT_DAY_COUNT);
		expect(slideshowDayCount({ dayCount: 7 })).toBe(7);
		expect(slideshowDayCount({ dayCount: 0 })).toBe(1);
		expect(slideshowDayCount({ dayCount: -3 })).toBe(1);
		expect(slideshowDayCount({ dayCount: 2.7 })).toBe(2);
		expect(slideshowDayCount({ dayCount: 10_000 })).toBe(SLIDESHOW_MAX_DAY_COUNT);
		expect(slideshowDayCount({ dayCount: Number.NaN })).toBe(SLIDESHOW_DEFAULT_DAY_COUNT);
	});
});

describe("the calendar behind a daily card", () => {
	it("counts local calendar days, not milliseconds", () => {
		const morning = slideshowDayNumber(new Date(2026, 2, 14, 8, 30));
		const night = slideshowDayNumber(new Date(2026, 2, 14, 23, 59, 59));
		expect(night).toBe(morning);
		expect(slideshowDayNumber(new Date(2026, 2, 15, 0, 0, 1))).toBe(morning + 1);
		// Across a month end, and across a year end.
		expect(slideshowDayNumber(new Date(2026, 2, 1))).toBe(
			slideshowDayNumber(new Date(2026, 1, 28)) + 1,
		);
		expect(slideshowDayNumber(new Date(2027, 0, 1))).toBe(
			slideshowDayNumber(new Date(2026, 11, 31)) + 1,
		);
	});

	it("groups days into slots of the configured length", () => {
		const day = (d: number) => new Date(2026, 2, d, 12);
		// One-day slots step every day.
		expect(slideshowPeriod(day(15), 1)).toBe(slideshowPeriod(day(14), 1) + 1);
		// A week-long slot holds for seven days and then steps once. Slots are
		// counted from the epoch, so find where one starts rather than assuming a
		// date does.
		let first = 9;
		while (slideshowDayNumber(day(first)) % 7 !== 0) first++;
		const start = slideshowPeriod(day(first), 7);
		for (let i = 0; i < 7; i++) expect(slideshowPeriod(day(first + i), 7)).toBe(start);
		expect(slideshowPeriod(day(first + 7), 7)).toBe(start + 1);
		// A nonsense day count is treated as one day rather than dividing by zero.
		expect(slideshowPeriod(day(14), 0)).toBe(slideshowDayNumber(day(14)));
	});

	it("wakes just after the next local midnight", () => {
		const at = new Date(2026, 2, 14, 23, 30);
		expect(msUntilNextDay(at)).toBe(30 * 60 * 1000 + 1000);
		// Never zero (or negative): a wake-up now would spin.
		expect(msUntilNextDay(new Date(2026, 2, 14, 23, 59, 59, 999))).toBeGreaterThanOrEqual(1000);
	});
});

describe("the picture a daily card shows", () => {
	const paths = ["a.png", "b.png", "c.png"];

	it("starts at the first picture with nothing remembered", () => {
		expect(dailySlideIndex(paths, undefined, 100)).toBe(0);
		expect(dailySlideIndex(paths, {}, 100)).toBe(0);
		expect(dailySlideIndex([], { path: "a.png", period: 1 }, 100)).toBe(0);
	});

	// The whole point of #249: the same day gives the same picture, however many
	// times the board is redrawn.
	it("holds the remembered picture for the rest of the slot", () => {
		const position = { path: "b.png", period: 100 };
		expect(dailySlideIndex(paths, position, 100)).toBe(1);
		expect(dailySlideIndex(paths, position, 100)).toBe(1);
	});

	it("steps one picture per slot passed, wrapping round", () => {
		expect(dailySlideIndex(paths, { path: "a.png", period: 100 }, 101)).toBe(1);
		expect(dailySlideIndex(paths, { path: "a.png", period: 100 }, 102)).toBe(2);
		// Past the end it wraps, and a long absence catches up rather than drifting.
		expect(dailySlideIndex(paths, { path: "a.png", period: 100 }, 103)).toBe(0);
		expect(dailySlideIndex(paths, { path: "c.png", period: 100 }, 108)).toBe(1);
	});

	it("never steps backwards when the clock does", () => {
		expect(dailySlideIndex(paths, { path: "b.png", period: 100 }, 99)).toBe(1);
		expect(dailySlideIndex(paths, { path: "b.png", period: 100 }, 0)).toBe(1);
	});

	// A remembered picture that has since been deleted takes its place in the
	// walk with it, so the card restarts from the top of the (new) order.
	it("falls back to the first picture when the remembered one is gone", () => {
		expect(dailySlideIndex(paths, { path: "gone.png", period: 100 }, 101)).toBe(1);
		expect(dailySlideIndex(paths, { path: "gone.png", period: 100 }, 100)).toBe(0);
	});

	// A position written by an older build, or hand-edited, carries no slot.
	it("holds still for a position with no slot", () => {
		expect(dailySlideIndex(paths, { path: "c.png" }, 100)).toBe(2);
	});
});

describe("the seeded shuffle", () => {
	const paths = () => ["a", "b", "c", "d", "e", "f", "g", "h"];

	it("deals the same order for the same seed, and a different one for another", () => {
		expect(seededShuffle(paths(), "card-1")).toEqual(seededShuffle(paths(), "card-1"));
		expect(seededShuffle(paths(), "card-1")).not.toEqual(seededShuffle(paths(), "card-2"));
	});

	it("keeps every item exactly once", () => {
		expect([...seededShuffle(paths(), "card-1")].sort()).toEqual(paths().sort());
		expect(seededShuffle([], "card-1")).toEqual([]);
		expect(seededShuffle(["only"], "card-1")).toEqual(["only"]);
	});

	// A daily card's random order has to survive a redraw, which an unseeded
	// shuffle deliberately doesn't.
	it("makes the random order reproducible through orderPictures", () => {
		const pictures = ["a", "b", "c", "d", "e", "f"].map((n) => picture(`${n}.png`));
		const once = orderPictures(pictures, "random", "card-1").map((p) => p.path);
		const twice = orderPictures(pictures, "random", "card-1").map((p) => p.path);
		expect(twice).toEqual(once);
		expect([...once].sort()).toEqual(pictures.map((p) => p.path).sort());
		// And leaves the caller's array alone, as the unseeded path does.
		expect(pictures.map((p) => p.path)).toEqual([
			"a.png",
			"b.png",
			"c.png",
			"d.png",
			"e.png",
			"f.png",
		]);
	});
});

describe("remembered positions", () => {
	it("reads back only what looks like a position", () => {
		expect(
			sanitizeSlideshowPositions({
				keep: { path: "a.png", period: 100 },
				pathOnly: { path: "b.png" },
				slotOnly: { period: 7 },
				emptyish: {},
				wrongTypes: { path: 3, period: "soon" },
				notAnObject: "nope",
				nulled: null,
			}),
		).toEqual({
			keep: { path: "a.png", period: 100 },
			pathOnly: { path: "b.png" },
			slotOnly: { period: 7 },
		});
	});

	it("shrugs off a stored blob of the wrong shape", () => {
		expect(sanitizeSlideshowPositions(undefined)).toEqual({});
		expect(sanitizeSlideshowPositions(null)).toEqual({});
		expect(sanitizeSlideshowPositions("{}")).toEqual({});
		expect(sanitizeSlideshowPositions([{ path: "a.png" }])).toEqual({});
	});

	it("rounds a fractional slot rather than dropping it", () => {
		expect(sanitizeSlideshowPositions({ c: { period: 100.9 } })).toEqual({ c: { period: 100 } });
	});

	it("writes one card's position without touching the others", () => {
		const store = { a: { path: "a.png" }, b: { path: "b.png" } };
		expect(rememberSlideshowPosition(store, "b", { path: "z.png", period: 3 })).toEqual({
			a: { path: "a.png" },
			b: { path: "z.png", period: 3 },
		});
		// Never in place: the caller's store is the one that was read from storage.
		expect(store.b).toEqual({ path: "b.png" });
	});

	// Cards are deleted without telling anyone, so the store is bounded — and the
	// cards still being drawn are the ones that stay.
	it("drops the least recently seen cards over the cap", () => {
		let store = {};
		for (const id of ["a", "b", "c"]) {
			store = rememberSlideshowPosition(store, id, { path: id }, 2);
		}
		expect(Object.keys(store)).toEqual(["b", "c"]);
		// Touching "b" again moves it to the newest end, so "c" ages out next.
		store = rememberSlideshowPosition(store, "b", { path: "b2" }, 2);
		store = rememberSlideshowPosition(store, "d", { path: "d" }, 2);
		expect(Object.keys(store)).toEqual(["b", "d"]);
	});
});
