import type { TaskDueRangeV1 } from "@stratejya/operon-cli/contracts/v1";
import type { OperonPriority, OperonStatus, OperonTask, OperonTaxonomy } from "./types";

/**
 * Pure shaping of Operon's read DTOs into what a card draws: due buckets, day
 * grouping, board columns, sort order, elapsed time.
 *
 * Deliberately free of Obsidian imports — Hearth's Vitest setup runs in a node
 * environment with no Obsidian API mocks, so the logic worth testing has to
 * live somewhere it can be imported directly. Nothing here re-derives anything
 * Operon already decided: statuses, priorities and recurrence come from its
 * taxonomy and its task DTO; this module only orders and groups them.
 */

/** Sort keys a card offers, mirroring the tasks card's vocabulary. */
export type OperonSortKey = "smart" | "due" | "priority" | "created" | "alpha";

/** How urgent a task's date makes it, relative to a given day. */
export type OperonDueState = "overdue" | "today" | "soon" | "later" | "none";

/** The day part of an Operon date or datetime. Operon writes dates as
 * `YYYY-MM-DD` and datetimes as ISO strings, and both start with the day. */
export function dayKey(value: string | undefined): string | null {
	if (!value || value.length < 10) return null;
	const day = value.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** The date a task should be filed under: its due date, or its scheduled date
 * when it has no due date. Matches how the tasks card falls back for TaskNotes
 * and keeps scheduled-only tasks from disappearing out of an agenda. */
export function taskDay(task: OperonTask): string | null {
	return dayKey(task.dates.due) ?? dayKey(task.dates.scheduled);
}

/** Whether Operon considers this task finished or cancelled. Read off the DTO's
 * own checkbox state rather than inferred from a status name. */
export function isClosed(task: OperonTask): boolean {
	return task.checkbox !== "open";
}

/** How urgent `task` is on `today` (a `YYYY-MM-DD` day key). `soon` covers the
 * next `soonDays` days so a card can tint the near future differently. */
export function dueState(task: OperonTask, today: string, soonDays = 3): OperonDueState {
	const day = taskDay(task);
	if (!day) return "none";
	if (day < today) return isClosed(task) ? "later" : "overdue";
	if (day === today) return "today";
	return day <= addDays(today, soonDays) ? "soon" : "later";
}

/** `day` shifted by `count` days, as a `YYYY-MM-DD` key. Uses UTC arithmetic on
 * a date-only value, so it never drifts across a local DST boundary. */
export function addDays(day: string, count: number): string {
	const at = Date.parse(`${day}T00:00:00Z`);
	if (Number.isNaN(at)) return day;
	return new Date(at + count * 86_400_000).toISOString().slice(0, 10);
}

/** One agenda row: a day and the tasks landing on it. */
export interface OperonDayGroup {
	day: string;
	tasks: OperonTask[];
}

/**
 * Tasks bucketed into `days` consecutive days from `from`, plus everything
 * already overdue collected into the first bucket. Days with no tasks are
 * dropped, so an agenda shows what is happening rather than a wall of blanks.
 */
export function groupByDay(tasks: readonly OperonTask[], from: string, days: number): OperonDayGroup[] {
	const last = addDays(from, Math.max(0, days - 1));
	const buckets = new Map<string, OperonTask[]>();
	for (const task of tasks) {
		const day = taskDay(task);
		if (!day) continue;
		// Overdue work belongs at the top of today, not on a date already gone.
		const bucket = day < from ? from : day;
		if (bucket > last) continue;
		const existing = buckets.get(bucket);
		if (existing) existing.push(task);
		else buckets.set(bucket, [task]);
	}
	return [...buckets.entries()]
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
		.map(([day, group]) => ({ day, tasks: group }));
}

/** Look up a status across every pipeline. Operon's status ids are unique per
 * pipeline, so a card that filters across pipelines still resolves labels. */
export function findStatus(taxonomy: OperonTaxonomy | null, id: string | undefined): OperonStatus | null {
	if (!taxonomy || !id) return null;
	for (const pipeline of taxonomy.pipelines) {
		for (const status of pipeline.statuses) {
			if (status.id === id) return status;
		}
	}
	return null;
}

export function findPriority(
	taxonomy: OperonTaxonomy | null,
	id: string | undefined,
): OperonPriority | null {
	if (!taxonomy || !id) return null;
	return taxonomy.priorities.find((priority) => priority.id === id) ?? null;
}

/**
 * The statuses a board shows, left to right: every status of the selected
 * pipelines in Operon's own order, then the card's explicit ordering applied on
 * top and its hidden columns removed. Columns the card has never seen keep
 * their Operon position after the ones it has, so a status added upstream shows
 * up instead of silently vanishing.
 */
export function boardColumns(
	taxonomy: OperonTaxonomy | null,
	opts: { pipelineIds?: string[]; order?: string[]; hidden?: string[] } = {},
): OperonStatus[] {
	if (!taxonomy) return [];
	const wanted = new Set(opts.pipelineIds ?? []);
	const columns: OperonStatus[] = [];
	const seen = new Set<string>();
	const pipelines = [...taxonomy.pipelines].sort((a, b) => a.order - b.order);
	for (const pipeline of pipelines) {
		if (wanted.size && !wanted.has(pipeline.id)) continue;
		for (const status of [...pipeline.statuses].sort((a, b) => a.order - b.order)) {
			if (seen.has(status.id)) continue;
			seen.add(status.id);
			columns.push(status);
		}
	}

	const hidden = new Set(opts.hidden ?? []);
	const visible = columns.filter((status) => !hidden.has(status.id));
	const order = opts.order ?? [];
	if (order.length === 0) return visible;

	const rank = new Map(order.map((id, index) => [id, index]));
	return visible.sort((a, b) => {
		const ra = rank.get(a.id);
		const rb = rank.get(b.id);
		if (ra === undefined && rb === undefined) return 0;
		if (ra === undefined) return 1;
		if (rb === undefined) return -1;
		return ra - rb;
	});
}

/** Priority rank for sorting: Operon's own `order`, with unprioritised tasks
 * last. Nothing here guesses what "high" means — the taxonomy already says. */
function priorityRank(taxonomy: OperonTaxonomy | null, task: OperonTask): number {
	const priority = findPriority(taxonomy, task.priority?.id);
	return priority ? priority.order : Number.MAX_SAFE_INTEGER;
}

function compareDay(a: OperonTask, b: OperonTask): number {
	const da = taskDay(a);
	const db = taskDay(b);
	if (da === db) return 0;
	// A dated task outranks an undated one, whichever direction we sort.
	if (!da) return 1;
	if (!db) return -1;
	return da < db ? -1 : 1;
}

function createdAt(task: OperonTask): number {
	const created = task.datetimes.created;
	const at = created ? Date.parse(created) : Number.NaN;
	return Number.isNaN(at) ? 0 : at;
}

/**
 * Sort a task list. Open tasks always come before closed ones regardless of the
 * key or direction — the same rule the tasks card applies, so a board and a
 * list read consistently.
 */
export function sortTasks(
	tasks: readonly OperonTask[],
	key: OperonSortKey,
	reverse: boolean,
	taxonomy: OperonTaxonomy | null,
): OperonTask[] {
	const sorted = [...tasks];
	sorted.sort((a, b) => {
		const closed = Number(isClosed(a)) - Number(isClosed(b));
		if (closed !== 0) return closed;

		let cmp = 0;
		switch (key) {
			case "due":
				cmp = compareDay(a, b);
				break;
			case "priority":
				cmp = priorityRank(taxonomy, a) - priorityRank(taxonomy, b);
				break;
			case "created":
				cmp = createdAt(a) - createdAt(b);
				break;
			case "alpha":
				cmp = a.description.localeCompare(b.description);
				break;
			case "smart":
			default:
				// Date first, then how urgent Operon rates it, then age — the
				// chain the tasks card uses, so the two cards agree on order.
				cmp = compareDay(a, b);
				if (cmp === 0) cmp = priorityRank(taxonomy, a) - priorityRank(taxonomy, b);
				if (cmp === 0) cmp = createdAt(a) - createdAt(b);
				break;
		}
		return reverse ? -cmp : cmp;
	});
	return sorted;
}

/** A running timer's elapsed time as `H:MM:SS`, or `M:SS` under an hour. */
export function formatElapsed(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
	return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(secs).padStart(2, "0")}`;
}

/** The due window a card asks Operon for, as an inclusive day range. `back`
 * days of history keeps overdue work in view. */
export function dueRange(today: string, days: number, back = 365): TaskDueRangeV1 {
	return { from: addDays(today, -Math.max(0, back)), to: addDays(today, Math.max(0, days - 1)) };
}
