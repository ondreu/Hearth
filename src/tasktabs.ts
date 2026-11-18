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
	/** Whether the task is complete. Only status rows need it, to tell a
	 * "Done" tab from a "To do" one and to let that tab reach the tasks the
	 * card hides by default. */
	done?: boolean;
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
 * stores and compares, `label` what the tab reads. `raw` keeps the value as
 * written when the label is derived from it (a project's path), so a collision
 * can be told apart in the user's own casing. */
interface FacetValue {
	key: string;
	label: string;
	raw?: string;
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
					raw: p,
				})),
			);
		case "context":
			return uniqueValues(
				(facts.contexts ?? []).map((c) => ({
					key: normalizeFilterTag(c),
					label: filterTagLabel(c),
					raw: c,
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

/** Forget `row`'s choice — for when what its tabs are made of changes (the
 * facet switched), so an id that happens to exist under the new facet does not
 * come back as a selection the user never made. */
export function clearTaskTabChoice(row: TaskTabRow): void {
	chosen.delete(row);
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

/** Two projects can share a note name in different folders; their tabs would
 * read identically. Append the parent segment to the ones that collide, so the
 * strip still says which is which. */
function disambiguateLabels(values: FacetValue[], facet: TaskTabFacet): FacetValue[] {
	if (facet !== "project" && facet !== "context") return values;
	const byLabel = new Map<string, FacetValue[]>();
	for (const v of values) {
		const group = byLabel.get(v.label) ?? [];
		group.push(v);
		byLabel.set(v.label, group);
	}
	for (const group of byLabel.values()) {
		if (group.length < 2) continue;
		for (const v of group) {
			const written = (v.raw ?? v.key).replace(/^\[\[|\]\]$/g, "");
			const parts = written.split("/");
			const parent = parts.length > 1 ? parts[parts.length - 2]?.trim() : "";
			if (parent) v.label = `${v.label} · ${parent}`;
		}
	}
	return values;
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
	return disambiguateLabels(orderValues([...found.values()], row.facet, seen, statusOrder), row.facet);
}

/** The last path segment of a normalized project/context key: TaskNotes stores
 * projects as path wikilinks, and a user typing the note name in a fixed row
 * means the same thing as the full path. */
function basenameOf(key: string): string {
	const slash = key.lastIndexOf("/");
	return slash >= 0 ? key.slice(slash + 1) : key;
}

/** A status value whose tasks are all complete — "Done", "Canceled" and any
 * other status a source treats as finished. Computed from the tasks rather
 * than from per-source config, so it holds for every source. */
function statusNamesDone(facts: readonly TaskTabFacts[], key: string): boolean {
	const carrying = facts.filter((f) =>
		taskFacetValues(f, "status").some((v) => v.key === key),
	);
	return carrying.length > 0 && carrying.every((f) => f.done === true);
}

/** Whether the row's tabs should reach completed tasks: a status row showing a
 * done status is an explicit request for them, so the card stops hiding them
 * for as long as that tab is picked. */
export function taskTabRevealsDone(
	facts: readonly TaskTabFacts[],
	rows: readonly ResolvedTaskTabRow[],
): boolean {
	return rows.some(
		(entry) =>
			entry.row.facet === "status" &&
			entry.active !== TASK_TAB_ALL &&
			entry.active !== TASK_TAB_OTHER &&
			statusNamesDone(facts, entry.active),
	);
}

/** Drop auto values every task in scope already carries: a tab that would
 * show exactly what the rows above left narrows nothing — after picking
 * "Rondo" in a tag row, a second tag row has no business offering "Rondo". */
function dropUniversalValues(
	values: FacetValue[],
	scoped: readonly TaskTabFacts[],
	facet: TaskTabFacet,
): FacetValue[] {
	if (!scoped.length) return values;
	return values.filter((v) => !scoped.every((f) => carries(f, facet, v.key)));
}

/** Whether a task carries `key` on `facet`. Projects and contexts also match on
 * their last path segment, so a fixed value written as the note name finds a
 * task whose frontmatter holds the full path (and two same-named notes in
 * different folders both match — the label is the same either way). */
function carries(facts: TaskTabFacts, facet: TaskTabFacet, key: string): boolean {
	return taskFacetValues(facts, facet).some(
		(v) => v.key === key || (facet !== "tag" && facet !== "priority" && facet !== "status" && basenameOf(v.key) === key),
	);
}

/** How one task reads against one tab of one row. */
function matchesTab(facts: TaskTabFacts, row: TaskTabRow, id: string, listed: readonly string[]): boolean {
	if (id === TASK_TAB_ALL) return true;
	if (id === TASK_TAB_OTHER) return !listed.some((key) => carries(facts, row.facet, key));
	const values = taskFacetValues(facts, row.facet);
	// A tab for a priority-less task ("none") matches only tasks without one.
	if (id === "none") return values.every((v) => v.key === "none");
	return carries(facts, row.facet, id);
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
	/** The card shows completed tasks anyway (its Show completed setting), so
	 * every tab counts them. */
	includeDone = false,
): ResolvedTaskTabRow[] {
	const inBase = (i: number): boolean => base?.[i] ?? true;
	const resolved: ResolvedTaskTabRow[] = [];
	// Rows above narrow what the rows below are made of, so values are
	// collected top-down against everything above them.
	const above = facts.map((_, i) => inBase(i));

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const scoped = facts.filter((_, i) => above[i]);
		// A fixed row with nothing listed behaves like an auto one rather than
		// an empty strip: the editor lets the field be cleared, and a row that
		// silently vanished on the next load would be worse than one that
		// falls back to every value the card carries.
		const fixed = row.mode === "fixed" && (row.values?.length ?? 0) > 0;
		const values = fixed
			? uniqueValues(
					(row.values ?? []).map((v) => ({
						key: fixedKey(row.facet, v),
						label: fixedLabel(row.facet, v),
					})),
				)
			: dropUniversalValues(collectValues(scoped, row, statusOrder), scoped, row.facet);

		// A row with nothing left to choose between cannot filter anything, so
		// it is not drawn at all (its config stays, it comes back when it can).
		if (!values.length && row.mode === "auto") continue;

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
		// A row can legitimately offer no tabs (an auto row on a card with no
		// tasks carrying that facet, with "All" turned off). It still needs one
		// tab to show and one id to be active, so it falls back on "All".
		if (!tabs.length) tabs.push({ id: TASK_TAB_ALL, kind: "all", label: "", count: 0 });

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

	// Done-status tabs reach the tasks the card hides; every other tab counts
	// only what the list would show.
	const revealDone = taskTabRevealsDone(facts, resolved);

	// Counts are what the row would leave, given the rows above it — and only
	// them. A row never counts against a row below, so clicking a tab down
	// there cannot make the tabs above it look emptier than they are.
	const scope = facts.map((_, i) => inBase(i));
	for (const entry of resolved) {
		const listed = listedIds(entry);
		for (const tab of entry.values) {
			// A tab naming a done status counts the completed tasks it exists
			// for, even before it is picked — a "Done" tab reading 0 would
			// never be clicked.
			const doneTab =
				entry.row.facet === "status" &&
				tab.kind === "value" &&
				statusNamesDone(facts, tab.id);
			let n = 0;
			for (let i = 0; i < facts.length; i++) {
				if (!scope[i]) continue;
				if (facts[i].done === true && !revealDone && !includeDone && !doneTab) continue;
				if (!matchesTab(facts[i], entry.row, tab.id, listed)) continue;
				n++;
			}
			tab.count = n;
		}
		// What this row shows narrows the scope the next row counts in.
		for (let i = 0; i < facts.length; i++) {
			if (scope[i]) scope[i] = matchesTab(facts[i], entry.row, entry.active, listed);
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
		// A fixed row with nothing listed falls back to auto on load instead of
		// disappearing, so a cleared values field cannot lose the row.
		if (row.mode === "fixed" && !row.values?.length) row.mode = "auto";
		if (r.other === true) row.other = true;
		if (r.all === false) row.all = false;
		if (typeof r.label === "string" && r.label.trim()) row.label = r.label.trim();
		out.push(row);
	}
	return out.length ? out : undefined;
}
