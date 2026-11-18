/**
 * The tab rows above a Tasks card (#481): what each row's tabs are, what they
 * would show, and how a choice narrows the list.
 *
 * Everything here is pure — no Obsidian, no DOM — so the model is unit tested
 * without a vault. The card hands in the tasks it already loaded, reduced to
 * {@link TaskTabFacts}; a row never loads anything of its own.
 *
 * Rows cascade: a row's tabs are made of what the rows above it left, and a
 * task must match what every row shows. That is what makes "project, then
 * priority within that project" work without any hierarchy in the card's
 * configuration — the hierarchy is the row order.
 */

import { priorityDisplayLabel, priorityRank, priorityKey } from "./priority";
import { filterTagLabel, hitStatusValue, normalizeFilterTag } from "./taskfilter";
import type { TaskTabFacet, TaskTabRow } from "./types";

/** The tab that undoes a row's choice. */
export const TASK_TAB_ALL = "";
/** The tab holding what none of a row's tabs match. */
export const TASK_TAB_OTHER = "\u0000other";
/** How many rows a card may hold before the strip stops being a strip. */
export const TASK_TAB_MAX_ROWS = 4;

/** One task, as a row of tabs sees it. Built by the card from its own hits, so
 * this module never needs a TFile or a metadata cache. */
export interface TaskTabFacts {
	tags?: readonly string[];
	projects?: readonly string[];
	contexts?: readonly string[];
	priority?: string;
	status?: string | null;
}

/** Which facets a source can actually answer. A checkbox task has no
 * projects, and saying so here keeps the editor from offering a row that can
 * only ever hold one "Other" tab. */
const FACETS_BY_SOURCE: Record<string, readonly TaskTabFacet[]> = {
	checkbox: ["tag", "status", "priority"],
	tasknotes: ["tag", "project", "context", "priority", "status"],
	kanban: ["tag", "status", "priority"],
	"obsidian-tasks": ["tag", "status", "priority"],
};

/** The facets a card reading `source` may build tab rows from. */
export function taskTabFacets(source: string | undefined): readonly TaskTabFacet[] {
	return FACETS_BY_SOURCE[source ?? "checkbox"] ?? FACETS_BY_SOURCE.checkbox;
}

/** One tab of one row, as the strip draws it. */
export interface TaskTabValue {
	/** What the row's choice stores: the normalized value, or a sentinel. */
	id: string;
	/** "all" and "other" are named by the caller (translated); "none" is a
	 * task with no value for the facet (a priority-less task in a priority
	 * row), which the caller may draw as a dash. */
	kind: "all" | "value" | "none" | "other";
	/** The value as written ("#work/urgent", "Dropzone", "High"), or "" for
	 * the sentinels. */
	label: string;
	/** How many tasks the card would show with this tab picked, the other
	 * rows' choices and the card's own base narrowing already applied. */
	count: number;
}

/** One row, resolved against the tasks on the card. */
export interface ResolvedTaskTabRow {
	row: TaskTabRow;
	/** The row's position on the card, top to bottom. */
	index: number;
	values: TaskTabValue[];
	/** The tab on show: the remembered choice when it still exists, else the
	 * first tab (normally "All"). */
	active: string;
}

/** A task's values for one facet, as `{key, label}`: `key` is what a choice
 * stores and compares, `label` what the tab reads. */
interface FacetValue {
	key: string;
	label: string;
}

/** Dedupe by key, keeping the first label seen. */
function uniqueValues(values: readonly FacetValue[]): FacetValue[] {
	const seen = new Set<string>();
	const out: FacetValue[] = [];
	for (const v of values) {
		if (!v.key || seen.has(v.key)) continue;
		seen.add(v.key);
		out.push(v);
	}
	return out;
}

/** The values one task carries for `facet`. Tasks with no value at all
 * produce nothing here — except priority and status, whose "none" is a real
 * state a tab can show rather than an absence of tabs. */
export function taskFacetValues(facts: TaskTabFacts, facet: TaskTabFacet): FacetValue[] {
	switch (facet) {
		case "tag":
			return uniqueValues(
				(facts.tags ?? []).map((tag) => ({
					key: normalizeFilterTag(tag),
					label: `#${normalizeFilterTag(tag)}`,
				})),
			);
		case "project":
			return uniqueValues(
				(facts.projects ?? []).map((p) => ({
					key: normalizeFilterTag(p),
					label: filterTagLabel(p),
				})),
			);
		case "context":
			return uniqueValues(
				(facts.contexts ?? []).map((c) => ({
					key: normalizeFilterTag(c),
					label: filterTagLabel(c),
				})),
			);
		case "priority": {
			const raw = facts.priority?.trim();
			if (!raw) return [{ key: "none", label: "" }];
			return [{ key: priorityKey(raw) || raw.toLowerCase(), label: priorityDisplayLabel(raw) }];
		}
		case "status": {
			const raw = (hitStatusValue({ status: facts.status ?? undefined }) ?? "").trim();
			return [{ key: raw ? raw.toLowerCase() : "none", label: raw }];
		}
	}
}

// ---- The choice a row remembers ------------------------------------------------

/** Which tab each row shows. Keyed by the row object, like the folder card's
 * browsed path: the row lives in the card's settings and is reused across
 * redraws, so the choice survives them, and a reload starts on the first tab.
 * Nothing is written to data.json — switching a tab must not hand a synced
 * vault a change. */
const chosen = new WeakMap<TaskTabRow, string>();

/** The tab `row` shows, or undefined before anything was picked. */
export function taskTabChoice(row: TaskTabRow): string | undefined {
	return chosen.get(row);
}

/** Show `id` in `row`. Unknown ids simply fall back on the next resolve. */
export function setTaskTabChoice(row: TaskTabRow, id: string): void {
	chosen.set(row, id);
}

// ---- Resolving a row against the card's tasks -----------------------------------

/** Values a facet shows on a row, in the order the facet implies: priorities
 * highest first, statuses in the card's own order, everything else by name. */
function orderValues(
	values: FacetValue[],
	facet: TaskTabFacet,
	seen: Map<string, number>,
	statusOrder: readonly string[],
): FacetValue[] {
	const sorted = [...values];
	if (facet === "priority") {
		sorted.sort((a, b) => priorityRank(a.key) - priorityRank(b.key));
	} else if (facet === "status") {
		const rank = (v: FacetValue): number => {
			const i = statusOrder.findIndex((s) => s.toLowerCase() === v.key);
			return i === -1 ? statusOrder.length : i;
		};
		sorted.sort((a, b) => rank(a) - rank(b) || (seen.get(a.key) ?? 0) - (seen.get(b.key) ?? 0));
	} else {
		sorted.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
	}
	return sorted;
}

/** Collect one row's value tabs across `facts`, in facet order. */
function collectValues(
	facts: readonly TaskTabFacts[],
	row: TaskTabRow,
	statusOrder: readonly string[],
): FacetValue[] {
	const seen = new Map<string, number>();
	const found = new Map<string, FacetValue>();
	facts.forEach((f, i) => {
		for (const v of taskFacetValues(f, row.facet)) {
			if (!found.has(v.key)) found.set(v.key, v);
			if (!seen.has(v.key)) seen.set(v.key, i);
		}
	});
	return orderValues([...found.values()], row.facet, seen, statusOrder);
}

/** Whether a task carries `key` on `facet`. */
function carries(facts: TaskTabFacts, facet: TaskTabFacet, key: string): boolean {
	return taskFacetValues(facts, facet).some((v) => v.key === key);
}

/** How one task reads against one tab of one row. */
function matchesTab(facts: TaskTabFacts, row: TaskTabRow, id: string, listed: readonly string[]): boolean {
	if (id === TASK_TAB_ALL) return true;
	if (id === TASK_TAB_OTHER) return !listed.some((key) => carries(facts, row.facet, key));
	const values = taskFacetValues(facts, row.facet);
	// A tab for a priority-less task ("none") matches only tasks without one.
	if (id === "none") return values.every((v) => v.key === "none");
	return values.some((v) => v.key === id);
}

/** Resolve every row against `facts`: the tabs each row offers, their counts,
 * and the tab on show. `base` marks the tasks the card would show at all
 * (its own Filter button, completed tasks in a list), so a count matches what
 * picking that tab would actually leave. */
export function resolveTaskTabRows(
	facts: readonly TaskTabFacts[],
	rows: readonly TaskTabRow[],
	base?: readonly boolean[],
	statusOrder: readonly string[] = [],
): ResolvedTaskTabRow[] {
	const inBase = (i: number): boolean => base?.[i] ?? true;
	const resolved: ResolvedTaskTabRow[] = [];
	// Rows above narrow what the rows below are made of, so values are
	// collected top-down against everything above them.
	const above = facts.map((_, i) => inBase(i));

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const scoped = facts.filter((_, i) => above[i]);
		const values =
			row.mode === "fixed"
				? (row.values ?? []).map((v) => ({
						key: fixedKey(row.facet, v),
						label: fixedLabel(row.facet, v),
					}))
				: collectValues(scoped, row, statusOrder);

		const listed = values.map((v) => v.key);
		const tabs: TaskTabValue[] = [];
		if (row.all !== false) tabs.push({ id: TASK_TAB_ALL, kind: "all", label: "", count: 0 });
		for (const v of values) {
			tabs.push({
				id: v.key,
				kind: v.key === "none" && v.label === "" ? "none" : "value",
				label: v.label,
				count: 0,
			});
		}
		if (row.other === true) tabs.push({ id: TASK_TAB_OTHER, kind: "other", label: "", count: 0 });

		// Remembered choice, clamped onto what this row offers now.
		const remembered = chosen.get(row);
		const active = tabs.some((t) => t.id === remembered) ? (remembered as string) : tabs[0].id;
		if (remembered !== active) chosen.set(row, active);

		resolved.push({ row, index, values: tabs, active });
		// This row's values feed the rows below: only tasks it lets through.
		for (let i = 0; i < facts.length; i++) {
			if (above[i]) above[i] = matchesTab(facts[i], row, active, listed);
		}
	}

	// Counts need every other row's choice, so they come after all rows have
	// settled their active tab.
	for (const entry of resolved) {
		const listed = entry.values
			.filter((t) => t.kind === "value" || t.kind === "none")
			.map((t) => t.id);
		const masks = resolved.map((other) =>
			facts.map((f) =>
				other === entry ? true : matchesTab(f, other.row, other.active, listedIds(other)),
			),
		);
		for (const tab of entry.values) {
			let n = 0;
			for (let i = 0; i < facts.length; i++) {
				if (!inBase(i)) continue;
				if (!masks.every((m) => m[i])) continue;
				if (!matchesTab(facts[i], entry.row, tab.id, listed)) continue;
				n++;
			}
			tab.count = n;
		}
	}
	return resolved;
}

/** The value keys a resolved row lists, for "other" and "none" matching. */
function listedIds(entry: ResolvedTaskTabRow): string[] {
	return entry.values.filter((t) => t.kind === "value" || t.kind === "none").map((t) => t.id);
}

/** The value key a fixed value compares as. */
function fixedKey(facet: TaskTabFacet, value: string): string {
	if (facet === "priority") return priorityKey(value) || value.toLowerCase();
	return normalizeFilterTag(value);
}

/** What a fixed value reads as on its tab: a tag gets its "#" back, a
 * context/project its note name, anything else is shown as typed. */
function fixedLabel(facet: TaskTabFacet, value: string): string {
	if (facet === "tag") return `#${normalizeFilterTag(value)}`;
	if (facet === "project" || facet === "context") return filterTagLabel(value);
	return value;
}

/** Keep only the tasks every resolved row lets through, as a mask parallel to
 * the `facts` the rows were resolved against. */
export function taskTabMask(
	facts: readonly TaskTabFacts[],
	rows: readonly ResolvedTaskTabRow[],
): boolean[] {
	const mask = facts.map(() => true);
	for (const entry of rows) {
		const listed = listedIds(entry);
		for (let i = 0; i < facts.length; i++) {
			if (mask[i]) mask[i] = matchesTab(facts[i], entry.row, entry.active, listed);
		}
	}
	return mask;
}

// ---- Configuration ---------------------------------------------------------------

/** Validate a persisted row list, keeping only what this version understands. */
export function sanitizeTaskTabRows(raw: unknown): TaskTabRow[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const facets: TaskTabFacet[] = ["tag", "project", "context", "priority", "status"];
	const out: TaskTabRow[] = [];
	for (const item of raw.slice(0, TASK_TAB_MAX_ROWS)) {
		if (!item || typeof item !== "object") continue;
		const r = item as Record<string, unknown>;
		const facet = facets.includes(r.facet as TaskTabFacet) ? (r.facet as TaskTabFacet) : "tag";
		const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : `row-${out.length}`;
		const row: TaskTabRow = {
			id,
			facet,
			mode: r.mode === "fixed" ? "fixed" : "auto",
		};
		if (Array.isArray(r.values)) {
			const values = r.values
				.filter((v): v is string => typeof v === "string")
				.map((v) => v.trim())
				.filter(Boolean);
			if (values.length) row.values = values;
		}
		if (row.mode === "fixed" && !row.values?.length) continue;
		if (r.other === true) row.other = true;
		if (r.all === false) row.all = false;
		if (typeof r.label === "string" && r.label.trim()) row.label = r.label.trim();
		out.push(row);
	}
	return out.length ? out : undefined;
}
