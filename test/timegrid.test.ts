import { describe, expect, it } from "vitest";
import {
	blockLines,
	dayWindow,
	daySpan,
	MIN_BLOCK_PX,
	overlapColumns,
	scrollHour,
	weekdayColumns,
} from "../src/timegrid";

/**
 * The Calendar card's time-grid geometry. Vitest forces TZ=UTC (see
 * vitest.config.ts), so "local midnight" below is simply a UTC midnight and
 * every offset is exact.
 */

/** Local midnight of 2026-08-10 (a Monday), the day every span is placed in. */
const DAY = new Date(2026, 7, 10).getTime();
/** Epoch ms for a time on that day. */
const at = (hour: number, minute = 0): number => DAY + (hour * 60 + minute) * 60_000;
const FULL = dayWindow(undefined, undefined);

describe("daySpan", () => {
	it("places an event at its minutes from midnight", () => {
		expect(daySpan(at(9), at(10, 30), DAY, FULL)).toEqual({
			startMin: 540,
			endMin: 630,
			clippedStart: false,
			clippedEnd: false,
		});
	});

	it("clips an event that started yesterday to the top of the day", () => {
		const span = daySpan(at(-3), at(2), DAY, FULL);
		expect(span).toMatchObject({ startMin: 0, endMin: 120, clippedStart: true, clippedEnd: false });
	});

	it("clips an event running into tomorrow to the bottom of the day", () => {
		const span = daySpan(at(22), at(26), DAY, FULL);
		expect(span).toMatchObject({ startMin: 1320, endMin: 1440, clippedEnd: true });
	});

	it("gives an event with no end, and a hairline event, a minimum height", () => {
		expect(daySpan(at(9), null, DAY, FULL)?.endMin).toBe(560);
		expect(daySpan(at(9), at(9, 5), DAY, FULL)?.endMin).toBe(560);
	});

	it("keeps a minimum-height block inside the window by growing it upwards", () => {
		const span = daySpan(at(23, 55), at(23, 58), DAY, FULL);
		expect(span).toMatchObject({ startMin: 1435, endMin: 1440 });
	});

	it("drops an event that falls entirely outside the drawn window", () => {
		const work = dayWindow(9, 17);
		expect(daySpan(at(7), at(8), DAY, work)).toBeNull();
		expect(daySpan(at(18), at(19), DAY, work)).toBeNull();
		expect(daySpan(at(8), at(10), DAY, work)).toMatchObject({ startMin: 540, clippedStart: true });
	});

	it("drops an event that only touches the window's edges", () => {
		const work = dayWindow(9, 17);
		expect(daySpan(at(8), at(9), DAY, work)).toBeNull();
		expect(daySpan(at(17), at(18), DAY, work)).toBeNull();
	});
});

describe("overlapColumns", () => {
	it("leaves a non-overlapping day in one full-width column", () => {
		const blocks = [
			{ startMin: 540, endMin: 600 },
			{ startMin: 600, endMin: 660 },
		];
		expect(overlapColumns(blocks)).toEqual([
			{ column: 0, columns: 1 },
			{ column: 0, columns: 1 },
		]);
	});

	it("splits two overlapping events side by side", () => {
		const blocks = [
			{ startMin: 540, endMin: 660 },
			{ startMin: 600, endMin: 720 },
		];
		expect(overlapColumns(blocks)).toEqual([
			{ column: 0, columns: 2 },
			{ column: 1, columns: 2 },
		]);
	});

	it("gives every event in a cluster the same width", () => {
		// One long block spanning two shorter ones that don't overlap each other:
		// all three belong to one cluster, so all three are half-width.
		const blocks = [
			{ startMin: 540, endMin: 780 },
			{ startMin: 560, endMin: 600 },
			{ startMin: 660, endMin: 700 },
		];
		const cols = overlapColumns(blocks);
		expect(cols.map((c) => c.columns)).toEqual([2, 2, 2]);
		expect(cols.map((c) => c.column)).toEqual([0, 1, 1]);
	});

	it("reuses a freed column and starts a new cluster after a gap", () => {
		const blocks = [
			{ startMin: 0, endMin: 60 },
			{ startMin: 30, endMin: 90 },
			{ startMin: 200, endMin: 260 },
		];
		const cols = overlapColumns(blocks);
		expect(cols[2]).toEqual({ column: 0, columns: 1 });
		expect(cols[0].columns).toBe(2);
	});

	it("returns results in input order regardless of chronology", () => {
		const blocks = [
			{ startMin: 600, endMin: 660 },
			{ startMin: 540, endMin: 700 },
		];
		const cols = overlapColumns(blocks);
		// The earlier, longer event takes column 0 even though it is listed last.
		expect(cols).toEqual([
			{ column: 1, columns: 2 },
			{ column: 0, columns: 2 },
		]);
	});

	it("handles an empty day", () => {
		expect(overlapColumns([])).toEqual([]);
	});
});

describe("weekdayColumns", () => {
	it("runs seven days from the first day of the week", () => {
		expect(weekdayColumns(1, false)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(weekdayColumns(0, false)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(weekdayColumns(6, false)).toEqual([6, 0, 1, 2, 3, 4, 5]);
	});

	it("drops Saturday and Sunday while keeping the start day's order", () => {
		expect(weekdayColumns(1, true)).toEqual([1, 2, 3, 4, 5]);
		expect(weekdayColumns(0, true)).toEqual([1, 2, 3, 4, 5]);
		expect(weekdayColumns(3, true)).toEqual([3, 4, 5, 1, 2]);
	});

	it("normalises an out-of-range first day", () => {
		expect(weekdayColumns(7, false)).toEqual(weekdayColumns(0, false));
		expect(weekdayColumns(-1, false)).toEqual(weekdayColumns(6, false));
	});
});

describe("scrollHour", () => {
	it("opens on the preferred hour when the day is empty", () => {
		expect(scrollHour([], DAY, FULL)).toBe(8);
		expect(scrollHour([], DAY, FULL, 6)).toBe(6);
	});

	it("opens an hour above the earliest event", () => {
		expect(scrollHour([at(14), at(10, 30)], DAY, FULL)).toBe(9);
	});

	it("never scrolls past the drawn window", () => {
		expect(scrollHour([at(0, 10)], DAY, FULL)).toBe(0);
		expect(scrollHour([], DAY, dayWindow(9, 17))).toBe(9);
		expect(scrollHour([], DAY, dayWindow(0, 6))).toBe(5);
	});

	it("ignores events outside the window", () => {
		expect(scrollHour([at(3)], DAY, dayWindow(9, 18), 12)).toBe(12);
	});
});

describe("dayWindow", () => {
	it("defaults to the whole day", () => {
		expect(dayWindow(undefined, undefined)).toEqual({ startHour: 0, endHour: 24 });
	});

	it("keeps a valid configured range", () => {
		expect(dayWindow(7, 22)).toEqual({ startHour: 7, endHour: 22 });
	});

	it("falls back to the whole day for an inverted or empty range", () => {
		expect(dayWindow(18, 9)).toEqual({ startHour: 0, endHour: 24 });
		expect(dayWindow(9, 9)).toEqual({ startHour: 0, endHour: 24 });
	});

	it("clamps hours to a real time of day", () => {
		expect(dayWindow(-4, 48)).toEqual({ startHour: 0, endHour: 24 });
	});
});

describe("blockLines", () => {
	it("gives a one-line block to anything that can't hold two", () => {
		// A half-hour event at the default 44px zoom is 22px tall.
		expect(blockLines(22)).toBe(1);
		expect(blockLines(MIN_BLOCK_PX)).toBe(1);
	});

	it("adds the time line once there is room for it", () => {
		// An hour at the default zoom.
		expect(blockLines(44)).toBe(2);
	});

	it("adds the location line only on a block tall enough for three", () => {
		expect(blockLines(51)).toBe(2);
		expect(blockLines(52)).toBe(3);
		expect(blockLines(200)).toBe(3);
	});
});
