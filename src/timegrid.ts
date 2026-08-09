/**
 * Geometry for the Calendar card's time grid — the week and day views.
 *
 * Pure arithmetic on minutes and weekday indices, deliberately free of moment,
 * Obsidian and the DOM so it can be unit-tested (test/timegrid.test.ts): where
 * an event sits in a day column, how overlapping events share the width, and
 * which weekday columns a grid draws. The card module turns the numbers into
 * pixels.
 */

/** Minutes in a day. */
export const DAY_MINUTES = 1440;

/** An event's vertical extent in one day column, in minutes from midnight. */
export interface DaySpan {
	/** Minutes from midnight where the block starts (clamped to the window). */
	startMin: number;
	/** Minutes from midnight where it ends (clamped, always > `startMin`). */
	endMin: number;
	/** The event began before the drawn window (or on an earlier day). */
	clippedStart: boolean;
	/** The event runs past the drawn window (or into the next day). */
	clippedEnd: boolean;
}

/** The drawn hour window of a time grid, as whole hours in `[0, 24]`. */
export interface DayWindow {
	/** First hour drawn. Default 0. */
	startHour: number;
	/** Hour the grid ends at, exclusive. Default 24. */
	endHour: number;
}

/**
 * Where one event sits inside a single day column.
 *
 * `dayStartMs` is local midnight of the column's day, so an event that starts
 * the previous evening or runs into tomorrow is clipped to this day rather than
 * drawn off the ends. Returns null when nothing of the event falls inside the
 * drawn window — the caller then leaves it out of the grid entirely (the card
 * lists those in the day's all-day row instead of hiding them).
 *
 * `minMinutes` gives a very short (or instantaneous) event a floor height so it
 * stays clickable; it never pushes the block past the end of the window.
 */
export function daySpan(
	startMs: number,
	endMs: number | null,
	dayStartMs: number,
	window: DayWindow,
	minMinutes = 20,
): DaySpan | null {
	const windowStart = clampHour(window.startHour) * 60;
	const windowEnd = clampHour(window.endHour) * 60;
	if (windowEnd <= windowStart) return null;

	const rawStart = (startMs - dayStartMs) / 60_000;
	// A missing end is an instantaneous event: give it the minimum height.
	const rawEnd = endMs === null ? rawStart + minMinutes : (endMs - dayStartMs) / 60_000;
	if (rawEnd <= windowStart || rawStart >= windowEnd) return null;

	const startMin = Math.max(rawStart, windowStart);
	let endMin = Math.min(Math.max(rawEnd, startMin), windowEnd);
	// Grow a hairline block downwards, then upwards if it would leave the window.
	if (endMin - startMin < minMinutes) {
		endMin = Math.min(startMin + minMinutes, windowEnd);
	}
	return {
		startMin,
		endMin,
		clippedStart: rawStart < windowStart,
		clippedEnd: rawEnd > windowEnd,
	};
}


/** How one block shares its horizontal space with the blocks it overlaps. */
export interface Column {
	/** 0-based column this block occupies. */
	column: number;
	/** How many columns the block's overlap cluster was split into. */
	columns: number;
}

/**
 * Split overlapping blocks into side-by-side columns, the way every calendar
 * draws a double-booked morning.
 *
 * Blocks are grouped into clusters of transitively overlapping events; inside a
 * cluster each block takes the first column still free at its start time, and
 * every block in the cluster reports the cluster's total column count so they
 * all end up the same width. Returns one entry per input block, in input order.
 *
 * Touching blocks (one ends exactly where the next starts) do not overlap.
 */
export function overlapColumns(blocks: readonly { startMin: number; endMin: number }[]): Column[] {
	const order = blocks
		.map((b, index) => ({ ...b, index }))
		// Earliest first; longer first on a tie, so the big block takes column 0.
		.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.index - b.index);

	const out: Column[] = blocks.map(() => ({ column: 0, columns: 1 }));
	let cluster: number[] = [];
	let clusterEnd = -Infinity;
	let columnEnds: number[] = [];

	const closeCluster = (): void => {
		for (const index of cluster) out[index].columns = columnEnds.length || 1;
		cluster = [];
		columnEnds = [];
		clusterEnd = -Infinity;
	};

	for (const block of order) {
		// A gap ends the cluster: nothing after it can overlap anything in it.
		if (block.startMin >= clusterEnd) closeCluster();

		let column = columnEnds.findIndex((end) => end <= block.startMin);
		if (column === -1) {
			column = columnEnds.length;
			columnEnds.push(block.endMin);
		} else {
			columnEnds[column] = block.endMin;
		}
		out[block.index].column = column;
		cluster.push(block.index);
		clusterEnd = Math.max(clusterEnd, block.endMin);
	}
	closeCluster();
	return out;
}


/**
 * The weekday numbers a grid draws, left to right: seven days from `firstDay`
 * (0 = Sunday, as moment counts them), minus the weekend when it is hidden.
 * Always returns at least one column — hiding the weekend when the week is
 * already only a weekend would otherwise draw nothing.
 */
export function weekdayColumns(firstDay: number, hideWeekends: boolean): number[] {
	const start = ((firstDay % 7) + 7) % 7;
	const all = Array.from({ length: 7 }, (_, i) => (start + i) % 7);
	if (!hideWeekends) return all;
	const weekdays = all.filter((d) => d !== 0 && d !== 6);
	return weekdays.length ? weekdays : all;
}


/**
 * The hour the time grid should be scrolled to on open: the earliest event of
 * the day, one hour of context above it, clamped to the drawn window. With no
 * events it falls back to `preferred` (the start of a typical day) so an empty
 * grid opens on the morning rather than on midnight.
 */
export function scrollHour(
	startsMs: readonly number[],
	dayStartMs: number,
	window: DayWindow,
	preferred = 8,
): number {
	const windowStart = clampHour(window.startHour);
	const windowEnd = clampHour(window.endHour);
	const minutes = startsMs
		.map((ms) => (ms - dayStartMs) / 60_000)
		.filter((m) => m >= windowStart * 60 && m < windowEnd * 60);
	const hour = minutes.length ? Math.floor(Math.min(...minutes) / 60) - 1 : preferred;
	return Math.min(Math.max(hour, windowStart), Math.max(windowEnd - 1, windowStart));
}


/** Whole hours, clamped to a real time of day. */
function clampHour(hour: number): number {
	if (!Number.isFinite(hour)) return 0;
	return Math.min(Math.max(Math.round(hour), 0), 24);
}


/** The drawn window from a card's configured hours, with the full day as the
 * default and an inverted or empty range falling back to it. */
export function dayWindow(startHour: number | undefined, endHour: number | undefined): DayWindow {
	const start = clampHour(startHour ?? 0);
	const end = clampHour(endHour ?? 24);
	return end > start ? { startHour: start, endHour: end } : { startHour: 0, endHour: 24 };
}
