import { moment } from "./cardbodies";
import { priorityLevel } from "./priority";
import type { TaskDueFilter, TaskFilterConfig, TaskPriorityLevel } from "./types";

/** The slice of a task row the list filter reads. Kept separate from the full
 * card hit so the matching rules stay pure and testable. */
export interface TaskFilterHit {
	text: string;
	fileBasename: string;
	done: boolean;
	due: string | null;
	scheduled: string | null;
	status?: string;
	boardColumn?: string;
	priority?: string;
	contexts?: string[];
	projects?: string[];
}

/** Strip wikilink brackets and an optional display alias (`[[path|Alias]]`). */
function bareFilterTag(value: string): string {
	return value
		.trim()
		.replace(/^\[\[/, "")
		.replace(/\]\]$/, "")
		.split("|")[0]
		.trim();
}

/** Normalize a TaskNotes context or project for comparison. Wikilink brackets
 * are stripped and casing is folded so `[[Work]]` matches a filter chip "work". */
export function normalizeFilterTag(value: string): string {
	return bareFilterTag(value).toLowerCase();
}

/** A chip label for contexts/projects: show the note name, not `[[folder/Note]]`.
 * TaskNotes often stores projects as path wikilinks; the last segment is what
 * users recognize (e.g. Dropzone, not Noting/TaskNotes/Projects/Dropzone). */
export function filterTagLabel(value: string): string {
	const bare = bareFilterTag(value);
	const slash = bare.lastIndexOf("/");
	return slash >= 0 ? bare.slice(slash + 1) : bare;
}

export function hitStatusValue(hit: Pick<TaskFilterHit, "status" | "boardColumn">): string | null {
	return hit.status ?? hit.boardColumn ?? null;
}

export function hitPriorityLevel(hit: Pick<TaskFilterHit, "priority">): TaskPriorityLevel {
	if (!hit.priority?.trim()) return "none";
	const lvl = priorityLevel(hit.priority);
	return lvl === "other" ? "none" : lvl;
}

function effectiveDate(hit: TaskFilterHit): string | null {
	return hit.due ?? hit.scheduled ?? null;
}

/** Whether a filter constrains anything. An all-empty filter is inactive. */
export function isTaskFilterActive(f: TaskFilterConfig | undefined): boolean {
	if (!f) return false;
	return !!(
		f.statuses?.length ||
		f.priorities?.length ||
		f.contexts?.length ||
		f.projects?.length ||
		f.due ||
		(f.text && f.text.trim())
	);
}

function taskMatchesDue(hit: TaskFilterHit, due: TaskDueFilter, today: string): boolean {
	const raw = effectiveDate(hit);
	const d = raw ? raw.slice(0, 10) : null;
	switch (due) {
		case "hasDate":
			return !!d;
		case "noDate":
			return !d;
		case "overdue":
			return !!d && d < today && !hit.done;
		case "today":
			return d === today;
		case "week": {
			if (!d) return false;
			const end = moment(today).add(7, "day").format("YYYY-MM-DD");
			return d >= today && d <= end;
		}
	}
	return true;
}

/** True when the task carries at least one of the selected tags (OR within the
 * dimension). Used for TaskNotes contexts and projects, which are multi-valued. */
function tagListMatches(selected: string[], values: string[] | undefined): boolean {
	if (!selected.length) return true;
	const held = new Set((values ?? []).map(normalizeFilterTag));
	return selected.some((s) => held.has(normalizeFilterTag(s)));
}

/** Whether a task passes an active filter: every set criterion must match. */
export function taskMatchesFilter(hit: TaskFilterHit, f: TaskFilterConfig, today: string): boolean {
	if (f.statuses?.length) {
		const v = (hitStatusValue(hit) ?? "").trim().toLowerCase();
		if (!f.statuses.some((s) => s.trim().toLowerCase() === v)) return false;
	}
	if (f.priorities?.length && !f.priorities.includes(hitPriorityLevel(hit))) return false;
	if (f.contexts?.length && !tagListMatches(f.contexts, hit.contexts)) return false;
	if (f.projects?.length && !tagListMatches(f.projects, hit.projects)) return false;
	if (f.due && !taskMatchesDue(hit, f.due, today)) return false;
	if (f.text?.trim()) {
		const needle = f.text.trim().toLowerCase();
		if (!(hit.text || hit.fileBasename).toLowerCase().includes(needle)) return false;
	}
	return true;
}
