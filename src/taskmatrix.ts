import { PRIORITY_EMOJI, priorityKey } from "./priority";
import type { TaskMatrixAxisLabel, TaskMatrixConfig, TaskMatrixQuadrant, TaskMatrixQuadrantConfig } from "./types";

/**
 * The tasks card's Eisenhower matrix: four quadrants laid out as a cross
 * (urgent / not urgent across, important / not important down), each holding
 * the tasks of the priorities assigned to it.
 *
 * The matrix stores nothing of its own on a task. It reads the priority every
 * source already has and maps it to a quadrant, and dropping a task into a
 * quadrant writes that quadrant's priority back — so the matrix, the list and
 * the board always agree, and a vault without Hearth keeps the meaning. Which
 * priorities belong to which quadrant is the user's choice
 * (`TasksConfig.matrix`); a task whose priority no quadrant claims sits in the
 * "unsorted" strip under the cross.
 *
 * Everything here is pure (no Obsidian, no DOM), so it is unit tested.
 */

/** The quadrants in reading order: left-to-right, then top-to-bottom. */
export const TASK_MATRIX_QUADRANTS: readonly TaskMatrixQuadrant[] = ["do", "schedule", "delegate", "eliminate"];

/** The value a quadrant lists for "no priority at all". Never written to a
 * task: dropping into a quadrant whose first value is this clears the
 * priority. */
export const MATRIX_NO_PRIORITY = "none";

/** One priority a quadrant can be given: the value written to the task and the
 * name the editor shows. */
export interface MatrixPriorityOption {
	value: string;
	label: string;
}

/** A source's priorities, as the matrix compares them. */
export type MatrixSource = "checkbox" | "kanban" | "tasknotes";

/** The five Tasks-plugin priority keys, highest first. */
const LINE_PRIORITIES = Object.keys(PRIORITY_EMOJI);

/** The quadrants with every default filled in. */
export type ResolvedTaskMatrix = Record<TaskMatrixQuadrant, { label: string; priorities: string[] }> & {
	showUnsorted: boolean;
};

/**
 * The key a priority value is compared by. A checkbox or Kanban task keeps one
 * of the Tasks plugin's five levels however it is spelt (emoji, word or a
 * synonym like "urgent"), so it compares on that level. TaskNotes priorities
 * are the user's own words ("normal" is not "medium" there), so they compare
 * as written, ignoring case. Nothing at all is {@link MATRIX_NO_PRIORITY}.
 */
export function matrixPriorityKey(value: string | undefined | null, source: MatrixSource): string {
	const raw = (value ?? "").trim();
	if (!raw) return MATRIX_NO_PRIORITY;
	if (source === "tasknotes") return raw.toLowerCase();
	return priorityKey(raw) || raw.toLowerCase();
}

/**
 * The default assignment for a list of priority values, highest first: one
 * each to Do, Schedule and Delegate, and the rest to Eliminate. With fewer
 * than four values, Eliminate takes the tasks with no priority — otherwise it
 * would be a quadrant nothing could ever land in.
 */
export function defaultMatrixPriorities(values: readonly string[]): Record<TaskMatrixQuadrant, string[]> {
	const real = values.filter((v) => v && v !== MATRIX_NO_PRIORITY);
	const out: Record<TaskMatrixQuadrant, string[]> = {
		do: real.slice(0, 1),
		schedule: real.slice(1, 2),
		delegate: real.slice(2, 3),
		eliminate: real.slice(3),
	};
	if (out.eliminate.length === 0) out.eliminate = [MATRIX_NO_PRIORITY];
	return out;
}

/** The priority values a line-based source offers, highest first. */
export function linePriorityValues(): string[] {
	return [...LINE_PRIORITIES];
}

/**
 * The card's quadrants, defaults filled in. `values` are the priorities the
 * source offers, highest first: they seed a quadrant the user has not
 * configured. A configured quadrant keeps exactly what was chosen, an empty
 * list included — that is a quadrant deliberately left empty.
 *
 * A value claimed by two quadrants (a hand-edited settings file) belongs to
 * the first, so a task never shows twice.
 */
export function resolveTaskMatrix(
	cfg: TaskMatrixConfig | undefined,
	values: readonly string[],
	labels: Record<TaskMatrixQuadrant, string>,
	source: MatrixSource,
): ResolvedTaskMatrix {
	const defaults = defaultMatrixPriorities(values);
	const claimed = new Set<string>();
	const out = { showUnsorted: cfg?.showUnsorted !== false } as ResolvedTaskMatrix;
	for (const id of TASK_MATRIX_QUADRANTS) {
		const own: TaskMatrixQuadrantConfig | undefined = cfg?.quadrants?.[id];
		const list = own?.priorities ?? defaults[id];
		const priorities: string[] = [];
		for (const value of list) {
			const key = matrixPriorityKey(value, source);
			if (claimed.has(key)) continue;
			claimed.add(key);
			priorities.push(value);
		}
		out[id] = { label: own?.label?.trim() || labels[id], priorities };
	}
	return out;
}

/** The quadrant a priority value falls in, or null when none claims it (the
 * task goes to the unsorted strip). */
export function matrixQuadrantFor(
	priority: string | undefined | null,
	matrix: ResolvedTaskMatrix,
	source: MatrixSource,
): TaskMatrixQuadrant | null {
	const key = matrixPriorityKey(priority, source);
	for (const id of TASK_MATRIX_QUADRANTS) {
		if (matrix[id].priorities.some((p) => matrixPriorityKey(p, source) === key)) return id;
	}
	return null;
}

/**
 * The priority to write onto a task dropped into `id`: the quadrant's first
 * value, or null to clear the priority (the quadrant's first value is "no
 * priority"). Undefined when the quadrant has no priorities, which means the
 * drop can't be expressed and does nothing.
 */
export function matrixWriteValue(matrix: ResolvedTaskMatrix, id: TaskMatrixQuadrant): string | null | undefined {
	const first = matrix[id].priorities[0];
	if (first === undefined) return undefined;
	return first === MATRIX_NO_PRIORITY ? null : first;
}

/** Whether dropping a task with `priority` into `id` changes anything: a task
 * already in that quadrant keeps its priority, even when it is not the one a
 * drop would write ("lowest" stays "lowest" in a low + lowest quadrant). */
export function matrixMoveNeeded(
	priority: string | undefined | null,
	matrix: ResolvedTaskMatrix,
	id: TaskMatrixQuadrant | null,
	source: MatrixSource,
): boolean {
	return matrixQuadrantFor(priority, matrix, source) !== id;
}

/** Group tasks into quadrants (and the unsorted rest), keeping their order. */
export function groupByQuadrant<T>(
	items: readonly T[],
	priorityOf: (item: T) => string | undefined | null,
	matrix: ResolvedTaskMatrix,
	source: MatrixSource,
): { quadrants: Record<TaskMatrixQuadrant, T[]>; unsorted: T[] } {
	const quadrants: Record<TaskMatrixQuadrant, T[]> = { do: [], schedule: [], delegate: [], eliminate: [] };
	const unsorted: T[] = [];
	for (const item of items) {
		const id = matrixQuadrantFor(priorityOf(item), matrix, source);
		(id ? quadrants[id] : unsorted).push(item);
	}
	return { quadrants, unsorted };
}

/**
 * Toggle `value` in quadrant `id`, returning the new per-quadrant lists. A
 * value turned on is taken off every other quadrant, since a priority can only
 * mean one place; the lists keep the order of `options` so the value a drop
 * writes (the first) is always the highest one chosen.
 */
export function toggleMatrixPriority(
	current: Record<TaskMatrixQuadrant, string[]>,
	id: TaskMatrixQuadrant,
	value: string,
	options: readonly string[],
	source: MatrixSource,
): Record<TaskMatrixQuadrant, string[]> {
	const key = matrixPriorityKey(value, source);
	const has = (list: string[]) => list.some((p) => matrixPriorityKey(p, source) === key);
	const turningOn = !has(current[id]);
	const next = {} as Record<TaskMatrixQuadrant, string[]>;
	for (const q of TASK_MATRIX_QUADRANTS) {
		const without = current[q].filter((p) => matrixPriorityKey(p, source) !== key);
		next[q] = q === id && turningOn ? [...without, value] : without;
	}
	const rank = (p: string) => {
		const i = options.findIndex((o) => matrixPriorityKey(o, source) === matrixPriorityKey(p, source));
		return i < 0 ? options.length : i;
	};
	for (const q of TASK_MATRIX_QUADRANTS) next[q].sort((a, b) => rank(a) - rank(b));
	return next;
}

// ---- Where the quadrants sit ---------------------------------------------------

/** The axis ends a label can be given, in the editor's order. */
export const MATRIX_AXIS_LABELS: readonly TaskMatrixAxisLabel[] = ["urgent", "notUrgent", "important", "notImportant", "unsorted"];

/** The quadrant at the meeting of an urgency end and an importance end. */
function quadrantAt(urgent: boolean, important: boolean): TaskMatrixQuadrant {
	if (important) return urgent ? "do" : "schedule";
	return urgent ? "delegate" : "eliminate";
}

/**
 * How the cross is laid out: which axis end heads each column (`across`, left
 * to right) and each row (`down`, top to bottom), and the quadrants in reading
 * order (`cells`: top-left, top-right, bottom-left, bottom-right). The default
 * is the classic matrix — urgent on the left, important on top — and each of
 * the three settings flips one thing: urgency down the side instead of across,
 * urgent second, important second.
 */
export function matrixArrangement(cfg: TaskMatrixConfig | undefined): {
	across: [TaskMatrixAxisLabel, TaskMatrixAxisLabel];
	down: [TaskMatrixAxisLabel, TaskMatrixAxisLabel];
	cells: [TaskMatrixQuadrant, TaskMatrixQuadrant, TaskMatrixQuadrant, TaskMatrixQuadrant];
} {
	const urgency: [TaskMatrixAxisLabel, TaskMatrixAxisLabel] =
		cfg?.urgentFirst === false ? ["notUrgent", "urgent"] : ["urgent", "notUrgent"];
	const importance: [TaskMatrixAxisLabel, TaskMatrixAxisLabel] =
		cfg?.importantFirst === false ? ["notImportant", "important"] : ["important", "notImportant"];
	const byRows = cfg?.urgency === "rows";
	const across = byRows ? importance : urgency;
	const down = byRows ? urgency : importance;
	const at = (row: TaskMatrixAxisLabel, col: TaskMatrixAxisLabel) => {
		const ends = [row, col];
		return quadrantAt(ends.includes("urgent"), ends.includes("important"));
	};
	return {
		across,
		down,
		cells: [at(down[0], across[0]), at(down[0], across[1]), at(down[1], across[0]), at(down[1], across[1])],
	};
}

/** The axis names with the user's own filled in over `defaults`. */
export function matrixAxisLabels(
	cfg: TaskMatrixConfig | undefined,
	defaults: Record<TaskMatrixAxisLabel, string>,
): Record<TaskMatrixAxisLabel, string> {
	const out = { ...defaults };
	for (const id of MATRIX_AXIS_LABELS) {
		const own = cfg?.axisLabels?.[id]?.trim();
		if (own) out[id] = own;
	}
	return out;
}

/** Set (or, when blank, clear) quadrant `id`'s own name, returning the new
 * config. Clearing the last setting of a quadrant drops its entry. */
export function withQuadrantLabel(
	cfg: TaskMatrixConfig | undefined,
	id: TaskMatrixQuadrant,
	label: string,
): TaskMatrixConfig {
	const quadrants = { ...(cfg?.quadrants ?? {}) };
	const own: TaskMatrixQuadrantConfig = { ...(quadrants[id] ?? {}) };
	if (label.trim()) own.label = label.trim();
	else delete own.label;
	if (Object.keys(own).length) quadrants[id] = own;
	else delete quadrants[id];
	const out: TaskMatrixConfig = { ...(cfg ?? {}), quadrants };
	if (!Object.keys(quadrants).length) delete out.quadrants;
	return out;
}

/** Validate a persisted matrix configuration, keeping only known shapes.
 * Undefined when nothing is left, so a card doesn't carry an empty object. */
export function sanitizeTaskMatrix(raw: unknown): TaskMatrixConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const out: TaskMatrixConfig = {};
	if (typeof r.showUnsorted === "boolean") out.showUnsorted = r.showUnsorted;
	if (r.urgency === "columns" || r.urgency === "rows") out.urgency = r.urgency;
	if (typeof r.urgentFirst === "boolean") out.urgentFirst = r.urgentFirst;
	if (typeof r.importantFirst === "boolean") out.importantFirst = r.importantFirst;
	if (r.axisLabels && typeof r.axisLabels === "object") {
		const labels: TaskMatrixConfig["axisLabels"] = {};
		for (const id of MATRIX_AXIS_LABELS) {
			const v = (r.axisLabels as Record<string, unknown>)[id];
			if (typeof v === "string" && v.trim()) labels[id] = v.trim();
		}
		if (Object.keys(labels).length) out.axisLabels = labels;
	}
	const q = r.quadrants;
	if (q && typeof q === "object") {
		const quadrants: TaskMatrixConfig["quadrants"] = {};
		for (const id of TASK_MATRIX_QUADRANTS) {
			const entry = (q as Record<string, unknown>)[id];
			if (!entry || typeof entry !== "object") continue;
			const e = entry as Record<string, unknown>;
			const one: TaskMatrixQuadrantConfig = {};
			if (typeof e.label === "string" && e.label.trim()) one.label = e.label.trim();
			if (Array.isArray(e.priorities)) {
				one.priorities = e.priorities.filter((p): p is string => typeof p === "string" && p.trim() !== "").map((p) => p.trim());
			}
			if (Object.keys(one).length) quadrants[id] = one;
		}
		if (Object.keys(quadrants).length) out.quadrants = quadrants;
	}
	return Object.keys(out).length ? out : undefined;
}

/** A deep copy, for cloning a card. */
export function cloneTaskMatrix(cfg: TaskMatrixConfig | undefined): TaskMatrixConfig | undefined {
	if (!cfg) return undefined;
	const out: TaskMatrixConfig = { ...cfg };
	if (cfg.axisLabels) out.axisLabels = { ...cfg.axisLabels };
	if (cfg.quadrants) {
		out.quadrants = {};
		for (const id of TASK_MATRIX_QUADRANTS) {
			const q = cfg.quadrants[id];
			if (q) out.quadrants[id] = { ...q, priorities: q.priorities ? [...q.priorities] : undefined };
		}
	}
	return out;
}
