import { parseNaturalDate } from "./dates";
import { type IcsOccurrence } from "./ics";
import { priorityDisplayLabel, readPriorityEmoji } from "./priority";
import { stripInlineTags } from "./taskfilter";
import { type TaskNotesMeta } from "./tasknotes";

/**
 * Markdown checkbox tasks (`- [ ] Pay rent 📅 2026-10-01`) as a calendar
 * source, the same way TaskNotes tasks are one.
 *
 * The tasks card has always read these lines in the Tasks-plugin emoji format;
 * the calendar cards read them through the same helpers here, so a date means
 * the same thing on both. Everything in this module is pure string logic —
 * the vault walk lives in `calendarsource.ts` — so it is tested without
 * Obsidian.
 */


/** Every Tasks-plugin metadata emoji marker, used to strip metadata from a
 * task's display text and to find where one field's value ends. */
export const TASK_EMOJI_CLASS = "📅⏳🛫🔁✅❌➕⏫🔼🔽🔺⏬";


/** Read the value of a Tasks-plugin emoji field from a checkbox line, e.g.
 * `📅 tomorrow` or `📅 2024-01-15`. Returns the trimmed value up to the next
 * known emoji marker or end of line, or null when the marker isn't present. */
export function readEmojiField(text: string, emoji: string): string | null {
	const idx = text.indexOf(emoji);
	if (idx < 0) return null;
	let rest = text.slice(idx + emoji.length);
	// Stop at the next emoji marker (any of the Tasks-plugin conventions).
	const next = rest.search(new RegExp(`[${TASK_EMOJI_CLASS}]`, "u"));
	if (next >= 0) rest = rest.slice(0, next);
	const value = rest.trim();
	return value || null;
}


/** Strip all Tasks-plugin emoji metadata (each marker and its trailing value up
 * to the next marker) from a task's text, collapsing leftover whitespace.
 * Idempotent, so a raw and an already-stripped text compare equal. */
export function stripTaskMetadata(text: string): string {
	const re = new RegExp(`[${TASK_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	return text.replace(re, "").replace(/\s+/g, " ").trim();
}


/** A checkbox list item: bullet, the status character and the text after the
 * brackets — the same lines the tasks card reads and writes back to. */
const CHECKBOX_LINE_RE = /^\s*[-*+]\s\[(.)\]\s*(.*)$/;


/** One dated checkbox task, as read from a note line. */
export interface CheckboxTask {
	path: string;
	/** 0-based line index in the note. */
	line: number;
	/** The line's text after the checkbox, metadata included — what a write
	 * back compares against to make sure the line hasn't moved. */
	raw: string;
	/** Display title: metadata, tags and link syntax stripped. */
	title: string;
	/** The status character inside `[ ]`. */
	status: string;
	/** Whether the status counts as finished (`x`, `X` or cancelled `-`). */
	done: boolean;
	/** Resolved YYYY-MM-DD dates, or null when absent/unparseable. */
	due: string | null;
	scheduled: string | null;
	doneDate: string | null;
	/** The Tasks-plugin recurrence wording (🔁 every week), when present. */
	recurrence: string | null;
	/** Raw priority emoji, when present. */
	priority: string;
}


/** Turn `[[Note|alias]]`, `[[Note]]` and `[label](url)` into their visible
 * text, so a calendar chip reads like the rendered line. */
function plainLinks(text: string): string {
	return text
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[\[([^\]]+)\]\]/g, (_m, target: string) => target.split("/").pop() ?? target)
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}


/** Parse one note line into a checkbox task, or null when it isn't a task or
 * carries neither a due (📅) nor a scheduled (⏳) date — an undated task has
 * no day to be drawn on. */
export function parseCheckboxTask(path: string, line: number, text: string): CheckboxTask | null {
	const match = CHECKBOX_LINE_RE.exec(text);
	if (!match) return null;
	const raw = match[2].trim();
	if (!raw) return null;
	const date = (emoji: string): string | null => {
		const expr = readEmojiField(raw, emoji);
		return expr ? parseNaturalDate(expr) : null;
	};
	const due = date("📅");
	const scheduled = date("⏳");
	if (!due && !scheduled) return null;
	const status = match[1];
	return {
		path,
		line,
		raw,
		title: plainLinks(stripInlineTags(stripTaskMetadata(raw))).replace(/\s+/g, " ").trim(),
		status,
		done: /[xX-]/.test(status),
		due,
		scheduled,
		doneDate: date("✅"),
		recurrence: readEmojiField(raw, "🔁"),
		priority: readPriorityEmoji(raw) ?? "",
	};
}


/** Every dated checkbox task in a note, in document order, skipping fenced
 * code blocks (they render as text, not tasks). */
export function parseCheckboxTasks(path: string, content: string): CheckboxTask[] {
	const out: CheckboxTask[] = [];
	let fence: string | null = null;
	content.split("\n").forEach((text, i) => {
		const f = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
		if (f) {
			if (fence === null) fence = f[1];
			else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
			return;
		}
		if (fence !== null) return;
		const task = parseCheckboxTask(path, i, text);
		if (task) out.push(task);
	});
	return out;
}


/** Which checkbox layers a calendar card draws, and how it colours them. */
export interface CheckboxLayerOptions {
	scheduled: boolean;
	due: boolean;
	/** Include finished tasks (drawn struck through). */
	completed: boolean;
	color: string;
	dueColor: string;
}


/** The calendar payload of a checkbox entry: TaskNotes' meta shape (so the
 * shared agenda rows, chips and popup draw it unchanged) plus the line it
 * lives on, which is what marks it as a checkbox task. */
export interface CheckboxTaskMeta extends TaskNotesMeta {
	line: number;
	raw: string;
}


/** The checkbox payload on an occurrence, or null for anything else. */
export function checkboxTaskMeta(meta: TaskNotesMeta | null): CheckboxTaskMeta | null {
	return meta && typeof (meta as Partial<CheckboxTaskMeta>).line === "number"
		? (meta as CheckboxTaskMeta)
		: null;
}


/** Local midnight of a YYYY-MM-DD date, as epoch ms. */
function dayStart(iso: string): number {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).getTime();
}


/**
 * The all-day occurrences a set of checkbox tasks produces inside
 * `[windowStart, windowEnd)`: one per scheduled date and one per due date (a
 * task scheduled and due the same day is drawn once, as TaskNotes does).
 *
 * A recurring checkbox task isn't unrolled: the Tasks plugin keeps one line
 * whose date rolls forward on completion, so its current date is the only
 * occurrence there is. It counts as done for the day it was last completed on.
 */
export function checkboxTaskEvents(
	tasks: CheckboxTask[],
	opts: CheckboxLayerOptions,
	windowStart: number,
	windowEnd: number,
): IcsOccurrence[] {
	const out: IcsOccurrence[] = [];
	for (const task of tasks) {
		if (task.done && !opts.completed) continue;
		const entry = (kind: "scheduled" | "due", iso: string): void => {
			const start = dayStart(iso);
			const end = start + 86400_000;
			if (start >= windowEnd || end <= windowStart) return;
			const meta: CheckboxTaskMeta = {
				kind,
				path: task.path,
				line: task.line,
				raw: task.raw,
				title: task.title,
				status: task.status,
				statusLabel: "",
				priority: task.priority,
				priorityLabel: task.priority ? priorityDisplayLabel(task.priority) : "",
				contexts: [],
				projects: [],
				recurring: task.recurrence !== null,
				done: task.recurrence !== null ? task.doneDate === iso : task.done,
				dayKey: iso,
				color: (kind === "due" && opts.dueColor) || opts.color,
				timeEstimate: null,
			};
			out.push({
				uid: `checkbox:${task.path}:${task.line}:${kind}`,
				summary: task.title,
				location: "",
				description: "",
				url: "",
				start,
				end,
				allDay: true,
				meta,
			});
		};
		if (opts.scheduled && task.scheduled) entry("scheduled", task.scheduled);
		if (opts.due && task.due && !(opts.scheduled && task.scheduled === task.due)) entry("due", task.due);
	}
	return out;
}
