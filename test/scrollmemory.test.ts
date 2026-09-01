import { describe, expect, it } from "vitest";
import {
	createScrollRestore,
	pruneScrollMemory,
	readScrollMemory,
	RESTORE_SETTLE_MS,
	RESTORE_WINDOW_MS,
	SCROLL_MEMORY_MAX,
	SCROLL_STATE_KEY,
	writeScrollMemory,
} from "../src/scrollmemory";

/**
 * The dashboard's scroll memory (#276): what a tab remembers about where each
 * board was scrolled to, and how a remembered offset is put back on a board
 * whose content is still arriving.
 *
 * The DOM half — the scroll listener and the animation-frame loop — is
 * deliberately untested per the no-Obsidian-API-mocks rule; everything that
 * decides *what* to store and *when* to stop reaching for an offset lives here
 * as pure functions.
 */

describe("readScrollMemory", () => {
	it("returns nothing for a state with no scroll memory in it", () => {
		expect(readScrollMemory(undefined)).toEqual({});
		expect(readScrollMemory(null)).toEqual({});
		expect(readScrollMemory({})).toEqual({});
		expect(readScrollMemory({ [SCROLL_STATE_KEY]: null })).toEqual({});
		// A string or a number under the key is not a map of offsets, however a
		// hand-edited workspace.json came to hold one.
		expect(readScrollMemory({ [SCROLL_STATE_KEY]: 420 })).toEqual({});
		expect(readScrollMemory({ [SCROLL_STATE_KEY]: "420" })).toEqual({});
	});

	it("keeps whole-pixel positive offsets and drops everything else", () => {
		const memory = readScrollMemory({
			[SCROLL_STATE_KEY]: {
				a: 420,
				// Sub-pixel offsets come out of a real scroller (zoom, HiDPI).
				b: 120.6,
				// The top of a board is the absence of a memory, not a zero.
				c: 0,
				d: -40,
				e: Number.NaN,
				f: Number.POSITIVE_INFINITY,
				g: "300",
				h: null,
				"": 500,
			},
		});
		expect(memory).toEqual({ a: 420, b: 121 });
	});

	it("caps how many boards one tab can carry offsets for", () => {
		const raw: Record<string, number> = {};
		for (let i = 0; i < SCROLL_MEMORY_MAX + 20; i++) raw[`d${i}`] = i + 1;
		const memory = readScrollMemory({ [SCROLL_STATE_KEY]: raw });
		expect(Object.keys(memory)).toHaveLength(SCROLL_MEMORY_MAX);
	});
});

describe("writeScrollMemory", () => {
	it("records an offset for the board being scrolled", () => {
		expect(writeScrollMemory({}, "d1", 300)).toEqual({ d1: 300 });
		expect(writeScrollMemory({ d1: 300 }, "d2", 40)).toEqual({ d1: 300, d2: 40 });
	});

	it("returns the same map when the offset is the one already stored", () => {
		// The identity is the point: a scroll handler fires far more often than the
		// position actually changes, and only a real change should cost a layout
		// save.
		const memory = { d1: 300 };
		expect(writeScrollMemory(memory, "d1", 300)).toBe(memory);
		expect(writeScrollMemory(memory, "d1", 300.2)).toBe(memory);
		expect(writeScrollMemory(memory, "d2", 0)).toBe(memory);
		expect(writeScrollMemory(memory, "", 900)).toBe(memory);
	});

	it("forgets a board scrolled back to the top instead of storing a zero", () => {
		expect(writeScrollMemory({ d1: 300, d2: 40 }, "d1", 0)).toEqual({ d2: 40 });
		// Same for an offset that isn't a usable number at all.
		expect(writeScrollMemory({ d1: 300 }, "d1", Number.NaN)).toEqual({});
	});

	it("never mutates the map it was given", () => {
		const memory = { d1: 300 };
		writeScrollMemory(memory, "d1", 500);
		writeScrollMemory(memory, "d1", 0);
		expect(memory).toEqual({ d1: 300 });
	});
});

describe("pruneScrollMemory", () => {
	it("drops offsets for dashboards that no longer exist", () => {
		expect(pruneScrollMemory({ d1: 300, gone: 40, d2: 10 }, ["d1", "d2"])).toEqual({
			d1: 300,
			d2: 10,
		});
		expect(pruneScrollMemory({ gone: 40 }, [])).toEqual({});
	});

	it("returns the same map when every board is still there", () => {
		const memory = { d1: 300, d2: 10 };
		expect(pruneScrollMemory(memory, ["d1", "d2", "d3"])).toBe(memory);
		expect(pruneScrollMemory({}, [])).toEqual({});
	});
});

/**
 * The restore machine. `step(max, now)` is told how far the scroller can
 * currently scroll and what time it is, and answers with the offset to apply —
 * or `null` for "nothing to do this tick".
 */
describe("createScrollRestore", () => {
	it("has nothing to do when the board is remembered at the top", () => {
		const restore = createScrollRestore(0);
		expect(restore.done()).toBe(true);
		expect(restore.step(2000, 0)).toBeNull();
	});

	it("applies the offset immediately when the board is already tall enough", () => {
		const restore = createScrollRestore(400);
		expect(restore.step(1200, 0)).toBe(400);
		expect(restore.done()).toBe(true);
		// And then stays out of the way, however long the loop runs.
		expect(restore.step(1200, 16)).toBeNull();
	});

	it("keeps reaching while the content is still growing", () => {
		const restore = createScrollRestore(400);
		// Card bodies are still filling in: scroll as deep as the board currently
		// goes, which also keeps it pinned to the growing bottom.
		expect(restore.step(100, 0)).toBe(100);
		expect(restore.done()).toBe(false);
		expect(restore.step(250, 16)).toBe(250);
		expect(restore.done()).toBe(false);
		// Tall enough at last: the exact offset, and done.
		expect(restore.step(900, 32)).toBe(400);
		expect(restore.done()).toBe(true);
	});

	it("does not re-apply an offset it already applied", () => {
		const restore = createScrollRestore(400);
		expect(restore.step(100, 0)).toBe(100);
		// Same height, next frame — writing scrollTop again would be pointless
		// work and another scroll event.
		expect(restore.step(100, 16)).toBeNull();
		expect(restore.step(180, 32)).toBe(180);
	});

	it("settles at the bottom once the height holds still", () => {
		// The board is simply shorter than it was — a card removed, a query with
		// fewer results. There is nothing left to wait for, so stop promptly
		// rather than running the whole window.
		const restore = createScrollRestore(400);
		expect(restore.step(120, 0)).toBe(120);
		expect(restore.step(120, RESTORE_SETTLE_MS - 1)).toBeNull();
		expect(restore.done()).toBe(false);
		expect(restore.step(120, RESTORE_SETTLE_MS)).toBeNull();
		expect(restore.done()).toBe(true);
	});

	it("restarts the settle wait every time the board grows", () => {
		const restore = createScrollRestore(400);
		restore.step(100, 0);
		// A slow embed lands just before the wait would have run out.
		expect(restore.step(200, RESTORE_SETTLE_MS - 1)).toBe(200);
		expect(restore.done()).toBe(false);
		expect(restore.step(200, RESTORE_SETTLE_MS + 100)).toBeNull();
		expect(restore.done()).toBe(false);
		expect(restore.step(200, RESTORE_SETTLE_MS * 2)).toBeNull();
		expect(restore.done()).toBe(true);
	});

	it("gives up at the end of the window even if content keeps arriving", () => {
		const restore = createScrollRestore(10_000);
		let now = 0;
		// A board that grows a little on every frame but never far enough: the
		// window, not the settle wait, is what ends this.
		for (let max = 100; now < RESTORE_WINDOW_MS; max += 100) {
			expect(restore.done()).toBe(false);
			restore.step(max, now);
			now += 100;
		}
		restore.step(9000, now);
		expect(restore.done()).toBe(true);
	});

	it("reports the offset it last wrote, so its own scroll events can be told apart", () => {
		const restore = createScrollRestore(400);
		expect(restore.applied()).toBeNull();
		restore.step(100, 0);
		expect(restore.applied()).toBe(100);
		restore.step(100, 16);
		expect(restore.applied()).toBe(100);
		restore.step(900, 32);
		expect(restore.applied()).toBe(400);
	});

	it("stops for good once the user takes the scroller over", () => {
		const restore = createScrollRestore(400);
		expect(restore.step(100, 0)).toBe(100);
		restore.cancel();
		expect(restore.done()).toBe(true);
		// The board has grown tall enough by now, but the position is the user's.
		expect(restore.step(900, 16)).toBeNull();
	});

	it("measures its window from the first tick, not from construction", () => {
		// Renders are built before the loop starts, and a restore created while
		// the board was being assembled must still get its full window.
		const restore = createScrollRestore(400);
		expect(restore.step(100, 10_000)).toBe(100);
		expect(restore.done()).toBe(false);
		expect(restore.step(900, 10_000 + RESTORE_WINDOW_MS - 1)).toBe(400);
	});

	it("rounds a fractional remembered offset to a whole pixel", () => {
		const restore = createScrollRestore(399.6);
		expect(restore.step(1200, 0)).toBe(400);
	});

	it("ignores a nonsense target rather than scrolling somewhere odd", () => {
		expect(createScrollRestore(Number.NaN).done()).toBe(true);
		expect(createScrollRestore(-200).done()).toBe(true);
	});
});
