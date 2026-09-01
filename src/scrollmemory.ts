/**
 * Remembering where the board was scrolled to (#276).
 *
 * Hearth rebuilds the whole board on every render — and it renders whenever the
 * tab is focused again, so following a link out of a card and coming back used
 * to land at the top of a board the user had scrolled halfway down. The scroll
 * area is a fresh element each time, so there is nothing for the browser to
 * keep; the offset has to be recorded and put back deliberately.
 *
 * Three decisions shape what is stored and where:
 *
 *  - **Per tab, not per vault.** The offset lives in the leaf's own view state
 *    (`getState`/`setState`), not in settings. Settings are shared by every tab
 *    and synced between devices; a scroll offset belongs to one tab of one
 *    window. It also gives the asked-for asymmetry for free: a tab keeps its
 *    place across an app reload, because the layout is persisted with it, while
 *    a Hearth tab *replaced* by a note takes its state with it — so opening
 *    Hearth fresh afterwards starts at the top, as a newly opened board should.
 *  - **Per dashboard.** Switching boards is a re-render like any other, and the
 *    two boards share nothing but a scroll container. Keying the offset by
 *    dashboard means each board comes back where it was left instead of the
 *    switch dropping the tab at some arbitrary depth of a board it has never
 *    scrolled.
 *  - **Restoring takes a moment, not a frame.** Card bodies fill in after the
 *    render (embeds, rendered Markdown, lazily mounted card content), so the
 *    scroller is often shorter than the remembered offset for the first few
 *    frames — setting `scrollTop` once would silently clamp to whatever height
 *    existed at that instant. {@link createScrollRestore} is the small state
 *    machine that keeps reaching for the offset while the content is still
 *    growing, and gives up rather than fighting a board that genuinely got
 *    shorter.
 *
 * Everything here is pure except {@link driveScrollRestore}, which is the loop
 * that applies the machine's decisions to a real element.
 */

/** The key the offsets are stored under in the leaf's view state. */
export const SCROLL_STATE_KEY = "scroll";

/** How long a restore keeps reaching for its offset as content arrives. Past
 * this the board is taken as being as tall as it is going to get, and the
 * restore settles for how far it can actually scroll. */
export const RESTORE_WINDOW_MS = 2000;

/** How long the scroller's height has to hold still before the restore treats
 * the board as finished loading. Bounds the common case where the remembered
 * offset is simply deeper than this board now goes (a card was removed, a query
 * returns less) so the loop ends promptly instead of running the full window. */
export const RESTORE_SETTLE_MS = 400;

/** Most boards one tab keeps an offset for. Only a guard against junk arriving
 * in persisted state — in practice {@link pruneScrollMemory} holds the map to
 * the dashboards that exist. */
export const SCROLL_MEMORY_MAX = 64;

/** Remembered scroll offsets for one tab, keyed by dashboard id. */
export type ScrollMemory = Record<string, number>;

/** A restore in flight: what to apply, and when to stop. */
export interface ScrollRestore {
	/**
	 * The offset to apply now, given how far the scroller can currently scroll
	 * (`max`, i.e. `scrollHeight - clientHeight`) and the current clock reading.
	 * Returns `null` when there is nothing to do this tick — either the restore
	 * is over, or the offset it would apply is the one it applied last.
	 */
	step(max: number, now: number): number | null;
	/** True once the restore has reached its offset, given up, or been cancelled. */
	done(): boolean;
	/** The last offset this restore wrote, or `null` if it has written none.
	 * Lets the scroll listener tell the board moving itself from the user moving
	 * it — the `scroll` events from a restore's own writes can arrive after it
	 * has finished, and recording those would overwrite the offset it was
	 * reaching for with the shallower one it had to settle for. */
	applied(): number | null;
	/** Stop restoring: the user has taken the scroller over. */
	cancel(): void;
}

/** A finite, non-negative, whole-pixel offset, or 0 for anything else. */
function offset(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
	return Math.round(value);
}

/**
 * The offsets held in a leaf's persisted view state.
 *
 * Defensive by design: this is data written by an older (or newer) Hearth into
 * `workspace.json`, hand-editable, and merged by sync. Anything that isn't a
 * positive number under a non-empty key is dropped, and the result is capped —
 * a board that can't be scrolled to a remembered place is a triviality, a
 * malformed state that breaks the tab is not.
 */
export function readScrollMemory(state: unknown): ScrollMemory {
	const raw = (state as Record<string, unknown> | null | undefined)?.[SCROLL_STATE_KEY];
	if (!raw || typeof raw !== "object") return {};

	const memory: ScrollMemory = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!id) continue;
		const top = offset(value);
		if (top <= 0) continue;
		memory[id] = top;
		if (Object.keys(memory).length >= SCROLL_MEMORY_MAX) break;
	}
	return memory;
}

/**
 * Record where `dashboardId` is scrolled to, returning the updated map — or the
 * map it was given, unchanged, when the offset is the one already stored (so a
 * scroll handler can tell a real change from the flood of events that report
 * the same position).
 *
 * The top of a board is stored as *no* entry rather than a zero: a board sitting
 * at the top has nothing to restore, and that is also the state a fresh tab is
 * in, so the two should look the same.
 */
export function writeScrollMemory(
	memory: ScrollMemory,
	dashboardId: string,
	top: number,
): ScrollMemory {
	if (!dashboardId) return memory;
	const next = offset(top);
	const current = memory[dashboardId] ?? 0;
	if (next === current) return memory;

	const updated = { ...memory };
	if (next <= 0) delete updated[dashboardId];
	else updated[dashboardId] = next;
	return updated;
}

/**
 * Drop offsets for dashboards that no longer exist, returning the map unchanged
 * when there is nothing to drop. Run on the way into persisted state so a tab
 * that has outlived a few deleted boards doesn't carry their offsets in
 * `workspace.json` forever.
 */
export function pruneScrollMemory(
	memory: ScrollMemory,
	known: readonly string[],
): ScrollMemory {
	const live = new Set(known);
	const stale = Object.keys(memory).filter((id) => !live.has(id));
	if (stale.length === 0) return memory;

	const kept: ScrollMemory = {};
	for (const [id, top] of Object.entries(memory)) {
		if (live.has(id)) kept[id] = top;
	}
	return kept;
}

/**
 * The restore state machine: reach `target`, while the board is still growing
 * towards it.
 *
 * Each tick it is told how far the scroller can scroll right now. If that is
 * far enough, the offset is applied and the restore is done. If it isn't, the
 * scroller is put as deep as it currently goes — which is both a decent
 * approximation and what keeps the board pinned at the bottom while the
 * remaining cards fill in — and the machine waits for more content. It stops
 * waiting when the height has held still for {@link RESTORE_SETTLE_MS} or the
 * whole {@link RESTORE_WINDOW_MS} has passed, so a board that is simply shorter
 * than it was ends up at its own bottom rather than looping to no purpose.
 *
 * The clock is passed in rather than read, so the timing is testable without a
 * DOM or fake timers.
 */
export function createScrollRestore(target: number): ScrollRestore {
	const goal = offset(target);
	/** When the restore started; set on the first tick, since it is the render,
	 * not the construction, that the window should be measured from. */
	let start: number | null = null;
	/** The last height reported, and when it last changed. */
	let lastMax = -1;
	let grewAt = 0;
	/** The last offset handed out, so an unchanged decision is not re-applied. */
	let applied: number | null = null;
	let finished = goal <= 0;

	const apply = (top: number): number | null => {
		if (top === applied) return null;
		applied = top;
		return top;
	};

	return {
		done: () => finished,
		applied: () => applied,
		cancel: () => {
			finished = true;
		},
		step(max, now) {
			if (finished) return null;
			start ??= now;

			const reach = Math.max(0, Math.floor(max));
			if (reach !== lastMax) {
				lastMax = reach;
				grewAt = now;
			}

			if (reach >= goal) {
				finished = true;
				return apply(goal);
			}
			if (now - start >= RESTORE_WINDOW_MS || now - grewAt >= RESTORE_SETTLE_MS) {
				finished = true;
			}
			return apply(reach);
		},
	};
}

/**
 * Run a restore against a live scroller until it finishes.
 *
 * Polls on animation frames because what it is waiting for — card bodies
 * arriving and the scroller growing — has no single event to listen for. A
 * detached element ends the loop on the spot: that means the board has been
 * re-rendered, and the render that replaced it started a restore of its own.
 */
export function driveScrollRestore(el: HTMLElement, restore: ScrollRestore): void {
	const win = el.ownerDocument.defaultView ?? window;
	const tick = () => {
		if (!el.isConnected) return;
		const top = restore.step(el.scrollHeight - el.clientHeight, win.performance.now());
		if (top !== null) el.scrollTop = top;
		if (!restore.done()) win.requestAnimationFrame(tick);
	};
	tick();
}
