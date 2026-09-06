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
	tags?: string[];
}

/** Strip wikilink brackets, a leading "#", and an optional display alias
 * (`[[path|Alias]]`). The hash goes so a chip built from `#work` still matches
 * a value stored as `work` — the two are the same tag written two ways. */
function bareFilterTag(value: string): string {
	return value
		.trim()
		.replace(/^#/, "")
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

/** A chip label for a tag: the whole tag with its "#" back on. Unlike a
 * context or project, a nested tag's leading segments carry meaning
 * (`#work/urgent` is not `#home/urgent`), so nothing is trimmed away. */
export function filterHashtagLabel(value: string): string {
	return `#${bareFilterTag(value)}`;
}


/** Inline hashtags written in a task's own line (`#work`, `#work/urgent`), in
 * order and without their leading "#". A tag has to start at the line's start or
 * after whitespace, so a URL fragment (`…/page#top`) and a Markdown heading
 * inside a description are not mistaken for one, and it must hold at least one
 * non-digit — `#1` is an issue number, not a tag, which is the same rule
 * Obsidian applies. */
export function inlineTags(text: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const re = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		const tag = m[1].replace(/\/+$/, "");
		if (!tag || !/[^\d/]/.test(tag)) continue;
		const key = tag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(tag);
	}
	return out;
}


export function hitStatusValue(hit: Pick<TaskFilterHit, "status" | "boardColumn">): string | null {
	return hit.status ?? hit.boardColumn ?? null;
}

export function hitPriorityLevel(hit: Pick<TaskFilterHit, "priority">): TaskPriorityLevel {
	if (!hit.priority?.trim()) return "none";
	const lvl = priorityLevel(hit.priority);
	return lvl === "other" ? "none" : lvl;
}

/** Every day a task is pinned to: its due date and its scheduled date. Both
 * count for the date filter — TaskNotes treats "due" (when it must be done)
 * and "scheduled" (when you plan to do it) as independent, and its own date
 * views honour either, so a task due next week but scheduled for today has to
 * pass a "Today" filter. Dates are compared as plain YYYY-MM-DD days. */
function hitDates(hit: TaskFilterHit): string[] {
	return [hit.due, hit.scheduled].filter((d): d is string => !!d).map((d) => d.slice(0, 10));
}

/** Whether a filter constrains anything. An all-empty filter is inactive. */
export function isTaskFilterActive(f: TaskFilterConfig | undefined): boolean {
	if (!f) return false;
	return !!(
		f.statuses?.length ||
		f.priorities?.length ||
		f.contexts?.length ||
		f.projects?.length ||
		f.tags?.length ||
		f.due ||
		(f.text && f.text.trim())
	);
}

function taskMatchesDue(hit: TaskFilterHit, due: TaskDueFilter, today: string): boolean {
	const dates = hitDates(hit);
	switch (due) {
		case "hasDate":
			return dates.length > 0;
		case "noDate":
			return dates.length === 0;
		case "overdue":
			return !hit.done && dates.some((d) => d < today);
		case "today":
			return dates.some((d) => d === today);
		case "week": {
			const end = moment(today).add(7, "day").format("YYYY-MM-DD");
			return dates.some((d) => d >= today && d <= end);
		}
	}
	return true;
}

/** True when the task carries at least one of the selected tags (OR within the
 * dimension). Used for TaskNotes contexts and projects and for tags, all of
 * which are multi-valued. */
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
	if (f.tags?.length && !tagListMatches(f.tags, hit.tags)) return false;
	if (f.due && !taskMatchesDue(hit, f.due, today)) return false;
	if (f.text?.trim()) {
		const needle = f.text.trim().toLowerCase();
		if (!(hit.text || hit.fileBasename).toLowerCase().includes(needle)) return false;
	}
	return true;
}
