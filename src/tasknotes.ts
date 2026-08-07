/**
 * TaskNotes integration.
 *
 * TaskNotes stores everything it knows in note frontmatter and in its own
 * plugin settings — it ships no stable public API and no published types, so
 * every accessor here is duck-typed and defensive: a missing, renamed or
 * reshaped field falls back to the documented default rather than throwing.
 *
 * Two consumers use this module:
 *
 *   - "tasks" cards, for opening a task in TaskNotes' own edit modal.
 *   - "calendar" cards, which can take TaskNotes as an event source and mirror
 *     what TaskNotes' own calendar view shows: scheduled tasks (with their time
 *     estimate as the event length), due dates, recurring instances expanded
 *     per occurrence, timeblocks from daily notes, and the ICS subscriptions
 *     configured inside TaskNotes itself.
 *
 * Because TaskNotes' field names, statuses, priorities and identification rule
 * are all user-configurable, the card reads them from TaskNotes' settings
 * instead of hard-coding them: a vault that renamed `due` to `deadline`, or
 * marks tasks with a property instead of a tag, still resolves correctly.
 *
 * Everything below the "Reading the vault" divider needs the Obsidian runtime;
 * everything above it is pure, so the resolution rules are unit-tested.
 */
import { TFile, type App } from "obsidian";
import { localDayKey } from "./dates";
import {
	calendarStatus,
	expandEvents,
	parseIcs,
	type IcsCalendar,
	type IcsEvent,
	type IcsOccurrence,
	type IcsStatus,
} from "./ics";


/** Community plugin id for TaskNotes. */
export const TASKNOTES_PLUGIN_ID = "tasknotes";


/** Whether TaskNotes is installed and enabled in this vault. */
export function taskNotesEnabled(app: App): boolean {
	return app.plugins.enabledPlugins.has(TASKNOTES_PLUGIN_ID);
}


// ---- TaskNotes settings ---------------------------------------------------

/** The frontmatter property each TaskNotes value lives in. TaskNotes lets the
 * user remap every one of them (Settings → TaskNotes → Field mapping), so the
 * names below are only the defaults. */
export interface TaskNotesFieldMapping {
	title: string;
	status: string;
	priority: string;
	due: string;
	scheduled: string;
	contexts: string;
	projects: string;
	timeEstimate: string;
	recurrence: string;
	completeInstances: string;
	completedDate: string;
	/** Tag marking an archived task (stored without the leading "#"). */
	archiveTag: string;
}


export const DEFAULT_TASKNOTES_FIELDS: TaskNotesFieldMapping = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	timeEstimate: "timeEstimate",
	recurrence: "recurrence",
	completeInstances: "complete_instances",
	completedDate: "completedDate",
	archiveTag: "archived",
};


/** One of TaskNotes' configurable statuses: the raw frontmatter value, how it
 * reads, the colour its dot/chip takes, and whether it counts as complete. */
export interface TaskNotesStatus {
	value: string;
	label: string;
	color: string;
	isCompleted: boolean;
}


/** One of TaskNotes' configurable priorities. */
export interface TaskNotesPriority {
	value: string;
	label: string;
	color: string;
	weight: number;
}


/** An ICS calendar subscribed inside TaskNotes (Settings → TaskNotes →
 * Calendar subscriptions). Either a remote feed (`url`) or a `.ics` file in
 * the vault (`filePath`). */
export interface TaskNotesSubscription {
	id: string;
	name: string;
	type: "remote" | "local";
	url: string;
	filePath: string;
	color: string;
	enabled: boolean;
}


/** Which layers TaskNotes' own calendar view is showing. Used as the default
 * for the card's per-layer toggles, so an unconfigured Hearth calendar mirrors
 * whatever the user already set up inside TaskNotes. */
export interface TaskNotesCalendarDefaults {
	scheduled: boolean;
	due: boolean;
	recurring: boolean;
	timeblocks: boolean;
}


/** Everything the calendar card needs to read a vault the way TaskNotes does. */
export interface TaskNotesSetup {
	fields: TaskNotesFieldMapping;
	statuses: TaskNotesStatus[];
	priorities: TaskNotesPriority[];
	/** How TaskNotes decides a note is a task. */
	identify: { method: "tag" | "property"; tag: string; property: string; value: string };
	/** Minutes a scheduled task occupies when it carries no time estimate. */
	defaultTimeEstimate: number;
	calendar: TaskNotesCalendarDefaults;
	subscriptions: TaskNotesSubscription[];
}


/** A record-ish view of an unknown value, or null when it isn't an object. */
function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}


/** A trimmed string from an unknown value, or "" when it isn't usable text. */
function str(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}


/** A finite number from an unknown value, or null. Strings are accepted since
 * frontmatter often carries `timeEstimate: "45"`. */
function num(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const n = Number(value.trim());
		if (Number.isFinite(n)) return n;
	}
	return null;
}


/** A boolean from an unknown value, or the fallback when it isn't one. */
function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}


/** A string list from an unknown value: a YAML list becomes its entries, a
 * scalar becomes a single entry, anything else becomes nothing. */
function strList(value: unknown): string[] {
	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const v of value) {
			const s = str(v);
			if (s && !out.includes(s)) out.push(s);
		}
		return out;
	}
	const s = str(value);
	return s ? [s] : [];
}


/**
 * Read TaskNotes' settings object into the shape this module works with.
 * Pure, so the (necessarily loose) duck-typing is testable: every field is
 * probed and falls back to TaskNotes' own documented default when absent.
 */
export function parseTaskNotesSettings(raw: unknown): TaskNotesSetup {
	const s = asRecord(raw) ?? {};

	const mapping = asRecord(s.fieldMapping) ?? {};
	const fields: TaskNotesFieldMapping = { ...DEFAULT_TASKNOTES_FIELDS };
	for (const key of Object.keys(fields) as (keyof TaskNotesFieldMapping)[]) {
		const mapped = str(mapping[key]);
		if (mapped) fields[key] = mapped;
	}

	const statuses: TaskNotesStatus[] = [];
	for (const entry of Array.isArray(s.customStatuses) ? s.customStatuses : []) {
		const rec = asRecord(entry);
		const value = str(rec?.value);
		if (!value) continue;
		statuses.push({
			value,
			label: str(rec?.label) || value,
			color: str(rec?.color),
			isCompleted: bool(rec?.isCompleted, false),
		});
	}

	const priorities: TaskNotesPriority[] = [];
	for (const entry of Array.isArray(s.customPriorities) ? s.customPriorities : []) {
		const rec = asRecord(entry);
		const value = str(rec?.value);
		if (!value) continue;
		priorities.push({
			value,
			label: str(rec?.label) || value,
			color: str(rec?.color),
			weight: num(rec?.weight) ?? 0,
		});
	}

	// TaskNotes' calendar view settings live under one of a couple of keys
	// depending on version; both are read, the first that exists wins.
	const calendarSettings =
		asRecord(s.calendarViewSettings) ?? asRecord(s.advancedCalendarViewSettings) ?? {};
	const calendar: TaskNotesCalendarDefaults = {
		scheduled: bool(calendarSettings.defaultShowScheduled ?? calendarSettings.showScheduled, true),
		due: bool(calendarSettings.defaultShowDue ?? calendarSettings.showDue, true),
		recurring: bool(
			calendarSettings.defaultShowRecurring ?? calendarSettings.showRecurring,
			true,
		),
		timeblocks: bool(
			calendarSettings.defaultShowTimeblocks ?? calendarSettings.showTimeblocks,
			bool(s.enableTimeblocking, true),
		),
	};

	// Calendar subscriptions normally live in TaskNotes' plugin *data* rather
	// than its settings (see `loadTaskNotesSubscriptions`); these two keys are
	// only the fallback for versions that do keep them in settings.
	const ics = asRecord(s.icsIntegration) ?? {};
	const subscriptions = parseSubscriptions(ics.subscriptions ?? s.icsSubscriptions);

	const method = str(s.taskIdentificationMethod).toLowerCase() === "property" ? "property" : "tag";
	return {
		fields,
		statuses,
		priorities,
		identify: {
			method,
			tag: str(s.taskTag).replace(/^#/, "") || "task",
			property: str(s.taskPropertyName),
			value: str(s.taskPropertyValue),
		},
		defaultTimeEstimate: Math.max(0, num(s.defaultTimeEstimate) ?? 60),
		calendar,
		subscriptions,
	};
}


/** Read a list of TaskNotes calendar subscriptions from whatever shape it
 * arrives in (its settings, its plugin data, or its subscription service).
 * Entries with neither a URL nor a file path are dropped — there is nothing to
 * fetch — and a missing `type` is inferred from which of the two is set. */
export function parseSubscriptions(raw: unknown): TaskNotesSubscription[] {
	if (!Array.isArray(raw)) return [];
	const out: TaskNotesSubscription[] = [];
	for (const entry of raw) {
		const rec = asRecord(entry);
		if (!rec) continue;
		const url = str(rec.url);
		const filePath = str(rec.filePath);
		if (!url && !filePath) continue;
		const type = str(rec.type).toLowerCase() === "local" || (!url && filePath) ? "local" : "remote";
		out.push({
			id: str(rec.id) || url || filePath,
			name: str(rec.name),
			type,
			url,
			filePath,
			color: str(rec.color),
			enabled: bool(rec.enabled, true),
		});
	}
	return out;
}


/** The colour TaskNotes draws a status value in, or "" when it defines none. */
export function statusColor(setup: TaskNotesSetup, value: string): string {
	return statusDef(setup, value)?.color ?? "";
}


/** The status definition matching a raw frontmatter value (case-insensitive). */
export function statusDef(setup: TaskNotesSetup, value: string): TaskNotesStatus | null {
	const needle = value.trim().toLowerCase();
	if (!needle) return null;
	return (
		setup.statuses.find((s) => s.value.trim().toLowerCase() === needle) ??
		setup.statuses.find((s) => s.label.trim().toLowerCase() === needle) ??
		null
	);
}


/** The priority definition matching a raw frontmatter value. */
export function priorityDef(setup: TaskNotesSetup, value: string): TaskNotesPriority | null {
	const needle = value.trim().toLowerCase();
	if (!needle) return null;
	return (
		setup.priorities.find((p) => p.value.trim().toLowerCase() === needle) ??
		setup.priorities.find((p) => p.label.trim().toLowerCase() === needle) ??
		null
	);
}


/** Whether a status value counts as complete. TaskNotes marks that on the
 * status itself (`isCompleted`); with no matching definition — a vault that
 * never customised its statuses — the conventional "done"/"completed"/
 * "cancelled" wording is used. */
export function isCompletedStatus(setup: TaskNotesSetup, value: string): boolean {
	const def = statusDef(setup, value);
	if (def) return def.isCompleted;
	const v = value.trim().toLowerCase();
	return v === "done" || v === "complete" || v === "completed" || v === "cancelled" || v === "canceled";
}


// ---- Tasks ----------------------------------------------------------------

/** A TaskNotes task, as read from one note's frontmatter. */
export interface TaskNotesTask {
	path: string;
	title: string;
	status: string;
	priority: string;
	/** Raw frontmatter dates, date-only or with a time component. */
	due: string | null;
	scheduled: string | null;
	recurrence: string | null;
	completeInstances: string[];
	contexts: string[];
	projects: string[];
	/** Minutes, when the task carries an estimate. */
	timeEstimate: number | null;
	archived: boolean;
	done: boolean;
}


/**
 * Read one note's frontmatter as a TaskNotes task, or null when the note isn't
 * one. Identification mirrors TaskNotes' own rule: either the task tag (the
 * default) or a property/value pair. `tags` should hold the note's tags without
 * their leading "#".
 */
export function readTaskNotesTask(
	setup: TaskNotesSetup,
	path: string,
	frontmatter: Record<string, unknown> | undefined,
	tags: string[],
): TaskNotesTask | null {
	if (!frontmatter) return null;
	const f = setup.fields;
	if (!isTaskNote(setup, frontmatter, tags)) return null;

	const status = str(frontmatter[f.status]);
	const projects = strList(frontmatter[f.projects]);
	const title = str(frontmatter[f.title]) || basename(path);
	return {
		path,
		title,
		status,
		priority: str(frontmatter[f.priority]),
		due: str(frontmatter[f.due]) || null,
		scheduled: str(frontmatter[f.scheduled]) || null,
		recurrence: str(frontmatter[f.recurrence]) || null,
		completeInstances: strList(frontmatter[f.completeInstances]).map((d) => d.slice(0, 10)),
		contexts: strList(frontmatter[f.contexts]),
		projects,
		timeEstimate: num(frontmatter[f.timeEstimate]),
		archived: tags.some((t) => t.toLowerCase() === f.archiveTag.toLowerCase()),
		done: isCompletedStatus(setup, status),
	};
}


/** Whether a note is one of TaskNotes' task notes. */
function isTaskNote(
	setup: TaskNotesSetup,
	frontmatter: Record<string, unknown>,
	tags: string[],
): boolean {
	const { method, tag, property, value } = setup.identify;
	if (method === "property" && property) {
		const held = frontmatter[property];
		if (held === undefined || held === null) return false;
		if (!value) return true;
		const needle = value.trim().toLowerCase();
		return strList(held).some((v) => v.trim().toLowerCase() === needle);
	}
	if (tag && tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return true;
	// A vault whose tag/property rule doesn't match still yields tasks when the
	// note carries TaskNotes' status field — the same fallback the tasks card
	// has always used, so a hand-rolled setup isn't silently empty.
	return setup.fields.status in frontmatter;
}


function basename(path: string): string {
	const name = path.slice(path.lastIndexOf("/") + 1);
	return name.replace(/\.md$/i, "");
}


// ---- Calendar entries -----------------------------------------------------

/** What a calendar entry produced from TaskNotes represents. */
export type TaskNotesEntryKind = "scheduled" | "due" | "timeblock";


/** The TaskNotes payload carried on an occurrence, so the calendar card can
 * style the entry, open the right note and complete the right occurrence. */
export interface TaskNotesMeta {
	kind: TaskNotesEntryKind;
	/** The note the entry lives in: the task note, or the daily note holding
	 * the timeblock. */
	path: string;
	title: string;
	status: string;
	statusLabel: string;
	priority: string;
	priorityLabel: string;
	contexts: string[];
	projects: string[];
	/** Whether the task carries a recurrence rule. */
	recurring: boolean;
	/** Whether this occurrence is complete: a done task, or a recurring task
	 * whose `complete_instances` already lists this day. */
	done: boolean;
	/** The occurrence's local day (YYYY-MM-DD), the key recurring completion
	 * is recorded under. */
	dayKey: string;
	/** Colour TaskNotes would draw this entry in, when it defines one. */
	color: string;
	/** Minutes the task estimates, when it carries an estimate. */
	timeEstimate: number | null;
}


/** The TaskNotes payload on an occurrence, or null for an ordinary ICS event. */
export function taskNotesMeta(ev: IcsOccurrence): TaskNotesMeta | null {
	const meta = ev.meta;
	if (!meta || typeof meta !== "object") return null;
	const candidate = meta as Partial<TaskNotesMeta>;
	return typeof candidate.kind === "string" && typeof candidate.path === "string"
		? (meta as TaskNotesMeta)
		: null;
}


/** Which TaskNotes layers a calendar card draws, and how it colours them.
 * Every flag is resolved by the caller (card config → TaskNotes' own calendar
 * settings → the defaults here), so this stays a plain data input. */
export interface TaskNotesLayerOptions {
	scheduled: boolean;
	due: boolean;
	recurring: boolean;
	timeblocks: boolean;
	/** Include tasks whose status counts as complete. */
	completed: boolean;
	/** Include tasks tagged with TaskNotes' archive tag. */
	archived: boolean;
	/** Where an entry's colour comes from. */
	colorBy: "status" | "priority" | "fixed";
	/** Colour used when `colorBy` is "fixed", or when the chosen source
	 * defines none. */
	fallbackColor: string;
	/** Colour for due-date entries, when set (they read differently from a
	 * scheduled block, so TaskNotes colours them separately too). */
	dueColor?: string;
}


export const DEFAULT_TASKNOTES_LAYERS: TaskNotesLayerOptions = {
	scheduled: true,
	due: true,
	recurring: true,
	timeblocks: true,
	completed: true,
	archived: false,
	colorBy: "status",
	fallbackColor: "",
	dueColor: "",
};


/** Parse a TaskNotes date value (`YYYY-MM-DD`, or with a time component) into
 * epoch ms plus whether it is date-only. Null when unparseable. Times are read
 * as local wall-clock, matching how TaskNotes writes and shows them. */
export function parseTaskDate(value: string): { ms: number; allDay: boolean } | null {
	const v = value.trim();
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
	if (!m) return null;
	const [, y, mo, d, h, mi, s] = m;
	if (h === undefined) return { ms: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
	return { ms: new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)).getTime(), allDay: false };
}


/**
 * Normalise a TaskNotes recurrence value into an RRULE body (no `RRULE:`
 * prefix), or null when it says nothing. TaskNotes writes real RRULEs, but
 * older notes (and its own legacy `recurrence: {frequency: weekly, days: […]}`
 * form) use plain words, which map onto the same FREQ values.
 */
export function normalizeRecurrence(rule: string): string | null {
	const raw = rule.trim();
	if (!raw) return null;
	const body = raw.replace(/^RRULE:/i, "").trim();
	if (/FREQ=/i.test(body)) return body;
	const word = body.toLowerCase();
	const simple: Record<string, string> = {
		daily: "FREQ=DAILY",
		weekly: "FREQ=WEEKLY",
		biweekly: "FREQ=WEEKLY;INTERVAL=2",
		fortnightly: "FREQ=WEEKLY;INTERVAL=2",
		monthly: "FREQ=MONTHLY",
		yearly: "FREQ=YEARLY",
		annually: "FREQ=YEARLY",
	};
	return simple[word] ?? null;
}


/** The colour an entry takes, per the card's colouring rule. */
function entryColor(
	setup: TaskNotesSetup,
	task: TaskNotesTask,
	opts: TaskNotesLayerOptions,
	kind: TaskNotesEntryKind,
): string {
	if (kind === "due" && opts.dueColor) return opts.dueColor;
	if (opts.colorBy === "fixed") return opts.fallbackColor;
	const primary =
		opts.colorBy === "priority"
			? priorityDef(setup, task.priority)?.color
			: statusDef(setup, task.status)?.color;
	if (primary) return primary;
	const secondary =
		opts.colorBy === "priority"
			? statusDef(setup, task.status)?.color
			: priorityDef(setup, task.priority)?.color;
	return secondary || opts.fallbackColor;
}


/** The base (occurrence-independent) meta for one task entry. */
function baseMeta(
	setup: TaskNotesSetup,
	task: TaskNotesTask,
	opts: TaskNotesLayerOptions,
	kind: TaskNotesEntryKind,
): TaskNotesMeta {
	return {
		kind,
		path: task.path,
		title: task.title,
		status: task.status,
		statusLabel: statusDef(setup, task.status)?.label || task.status,
		priority: task.priority,
		priorityLabel: priorityDef(setup, task.priority)?.label || task.priority,
		contexts: task.contexts,
		projects: task.projects,
		recurring: !!task.recurrence,
		done: task.done,
		dayKey: "",
		color: entryColor(setup, task, opts, kind),
		timeEstimate: task.timeEstimate,
	};
}


/**
 * Build the calendar occurrences a set of TaskNotes tasks produces inside
 * `[windowStart, windowEnd)`: one entry per scheduled date, one per due date,
 * and — for a recurring task — one per occurrence of its rule, each carrying
 * whether that specific day is already complete.
 *
 * Recurrence is unrolled by the same RRULE engine the ICS feeds use, so a
 * TaskNotes task and a subscribed calendar event expand identically.
 */
export function taskNotesEvents(
	tasks: TaskNotesTask[],
	setup: TaskNotesSetup,
	opts: TaskNotesLayerOptions,
	windowStart: number,
	windowEnd: number,
): IcsOccurrence[] {
	const events: IcsEvent[] = [];
	for (const task of tasks) {
		if (task.archived && !opts.archived) continue;
		if (task.done && !opts.completed) continue;
		const rrule = task.recurrence ? normalizeRecurrence(task.recurrence) : null;
		// A recurring task is a series; with the recurring layer off only its
		// anchor date is drawn, exactly as a one-off would be.
		const rule = opts.recurring ? rrule : null;

		if (opts.scheduled && task.scheduled) {
			const at = parseTaskDate(task.scheduled);
			if (at) {
				const minutes = task.timeEstimate ?? setup.defaultTimeEstimate;
				events.push({
					uid: `tasknotes:${task.path}:scheduled`,
					summary: task.title,
					location: "",
					description: "",
					url: "",
					start: at.ms,
					end: at.allDay
						? at.ms + 86400_000
						: minutes > 0
							? at.ms + minutes * 60_000
							: null,
					allDay: at.allDay,
					rrule: rule,
					exdates: [],
					meta: baseMeta(setup, task, opts, "scheduled"),
				});
			}
		}

		if (opts.due && task.due) {
			const at = parseTaskDate(task.due);
			// A task with the same scheduled and due date would otherwise draw
			// twice on the same day; TaskNotes shows the block once.
			const sameAsScheduled =
				opts.scheduled && task.scheduled ? task.due.slice(0, 10) === task.scheduled.slice(0, 10) : false;
			if (at && !sameAsScheduled) {
				events.push({
					uid: `tasknotes:${task.path}:due`,
					summary: task.title,
					location: "",
					description: "",
					url: "",
					start: at.ms,
					end: at.allDay ? at.ms + 86400_000 : null,
					allDay: at.allDay,
					// Only the scheduled series recurs; the due date of a recurring
					// task follows its scheduled roll-forward, so it isn't unrolled.
					rrule: task.scheduled ? null : rule,
					exdates: [],
					meta: baseMeta(setup, task, opts, "due"),
				});
			}
		}
	}

	const done = new Map<string, Set<string>>();
	for (const task of tasks) {
		if (task.completeInstances.length) done.set(task.path, new Set(task.completeInstances));
	}

	const out = expandEvents(events, windowStart, windowEnd);
	for (const occ of out) {
		const meta = taskNotesMeta(occ);
		if (!meta) continue;
		const dayKey = localDayKey(occ.start);
		// The shared base meta is one object per event; each occurrence needs its
		// own day and completion state.
		occ.meta = {
			...meta,
			dayKey,
			done: meta.recurring ? (done.get(meta.path)?.has(dayKey) ?? false) : meta.done,
		} satisfies TaskNotesMeta;
	}
	return out;
}


// ---- Timeblocks -----------------------------------------------------------

/** A TaskNotes timeblock, stored in a daily note's `timeblocks` frontmatter. */
export interface TaskNotesTimeblock {
	id: string;
	title: string;
	/** Local wall-clock "HH:mm". */
	startTime: string;
	endTime: string;
	color: string;
	attachments: string[];
	description: string;
}


/** Read a daily note's `timeblocks` frontmatter value into timeblocks,
 * skipping entries with no usable start time. */
export function readTimeblocks(raw: unknown): TaskNotesTimeblock[] {
	if (!Array.isArray(raw)) return [];
	const out: TaskNotesTimeblock[] = [];
	for (const entry of raw) {
		const rec = asRecord(entry);
		if (!rec) continue;
		const startTime = normalizeClock(str(rec.startTime));
		if (!startTime) continue;
		out.push({
			id: str(rec.id),
			title: str(rec.title) || str(rec.name),
			startTime,
			endTime: normalizeClock(str(rec.endTime)),
			color: str(rec.color),
			attachments: strList(rec.attachments),
			description: str(rec.description),
		});
	}
	return out;
}


/** Normalise an "H:mm"/"HH:mm"/"HH:mm:ss" clock value to "HH:mm", or "". */
function normalizeClock(value: string): string {
	const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
	if (!m) return "";
	const h = Math.min(23, +m[1]);
	return `${String(h).padStart(2, "0")}:${m[2]}`;
}


/** Turn one day's timeblocks into calendar occurrences. `dayKey` is the daily
 * note's date (YYYY-MM-DD) and `path` the note holding them, so clicking a
 * block opens the day it belongs to. */
export function timeblockOccurrences(
	dayKey: string,
	blocks: TaskNotesTimeblock[],
	path: string,
	fallbackColor: string,
): IcsOccurrence[] {
	const day = parseTaskDate(dayKey);
	if (!day) return [];
	const out: IcsOccurrence[] = [];
	for (const block of blocks) {
		const start = clockMs(day.ms, block.startTime);
		if (start === null) continue;
		const end = block.endTime ? clockMs(day.ms, block.endTime) : null;
		const meta: TaskNotesMeta = {
			kind: "timeblock",
			path,
			title: block.title,
			status: "",
			statusLabel: "",
			priority: "",
			priorityLabel: "",
			contexts: [],
			projects: [],
			recurring: false,
			done: false,
			dayKey,
			color: block.color || fallbackColor,
			timeEstimate: null,
		};
		out.push({
			uid: `tasknotes:timeblock:${path}:${block.id || block.startTime}`,
			summary: block.title,
			location: "",
			description: block.description,
			url: "",
			start,
			// An end before the start (a block crossing midnight was written the
			// other way round) is dropped rather than drawn backwards.
			end: end !== null && end > start ? end : null,
			allDay: false,
			meta,
		});
	}
	return out;
}


/** Epoch ms of "HH:mm" on the local day starting at `dayMs`. */
function clockMs(dayMs: number, clock: string): number | null {
	const m = /^(\d{2}):(\d{2})$/.exec(clock);
	if (!m) return null;
	const d = new Date(dayMs);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]).getTime();
}


/** The day a daily note covers, resolved from its basename against the core
 * Daily notes format. Falls back to any `YYYY-MM-DD` in the name, so a note
 * whose format is unknown (or non-standard) still places its timeblocks. */
export function dailyNoteDayKey(
	basenameOrPath: string,
	format: string,
	parse: (input: string, format: string) => { isValid(): boolean; format(f: string): string },
): string | null {
	const name = basename(basenameOrPath);
	if (format) {
		const m = parse(name, format);
		if (m.isValid()) return m.format("YYYY-MM-DD");
	}
	return /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? null;
}


// ---- Completion -----------------------------------------------------------

/**
 * The frontmatter edit that toggles one occurrence's completion, mirroring what
 * TaskNotes writes:
 *
 *   - a recurring task records each finished day in `complete_instances`
 *     (deduped and sorted) and keeps its status untouched;
 *   - a one-off task moves its status to a complete value (and back to an open
 *     one when un-completed).
 *
 * Returns the properties to write. Pure, so the rules are testable; the caller
 * applies them through `processFrontMatter`.
 */
export function completionEdit(
	setup: TaskNotesSetup,
	task: TaskNotesTask,
	dayKey: string,
	complete: boolean,
): Record<string, unknown> {
	const f = setup.fields;
	if (task.recurrence) {
		const days = new Set(task.completeInstances);
		if (complete) days.add(dayKey);
		else days.delete(dayKey);
		return { [f.completeInstances]: [...days].sort() };
	}
	const target = complete ? completeStatusValue(setup) : openStatusValue(setup);
	const edit: Record<string, unknown> = { [f.status]: target };
	// TaskNotes stamps the completion date alongside the status.
	edit[f.completedDate] = complete ? dayKey : "";
	return edit;
}


/** The status value a finished task takes: TaskNotes' first completed status,
 * or plain "done" when none is configured. */
export function completeStatusValue(setup: TaskNotesSetup): string {
	return setup.statuses.find((s) => s.isCompleted)?.value ?? "done";
}


/** The status value a reopened task takes: TaskNotes' first open status, or
 * "open". */
export function openStatusValue(setup: TaskNotesSetup): string {
	return setup.statuses.find((s) => !s.isCompleted)?.value ?? "open";
}


// ---- Reading the vault ----------------------------------------------------

/** The slice of TaskNotes' plugin surface this uses. All optional and
 * duck-typed: TaskNotes ships no stable public types, so each accessor is
 * probed before use and may be absent or reshaped between versions. */
export interface TaskNotesLike {
	settings?: unknown;
	openTaskEditModal?: (task: unknown) => unknown;
	cacheManager?: { getTaskInfo?: (path: string) => unknown };
	api?: { tasks?: { get?: (path: string) => unknown } };
	/** TaskNotes' calendar-subscription service. Its `getSubscriptions()` is the
	 * live list, including any added since the plugin loaded. */
	icsSubscriptionService?: { getSubscriptions?: () => unknown };
	/** Obsidian's own plugin-data reader. TaskNotes persists its subscriptions
	 * under `icsSubscriptions` in that data, *outside* its settings object. */
	loadData?: () => Promise<unknown>;
}


/** The loaded TaskNotes plugin instance, or null when it isn't enabled. */
export function taskNotesPlugin(app: App): TaskNotesLike | null {
	if (!taskNotesEnabled(app)) return null;
	return (app.plugins.plugins[TASKNOTES_PLUGIN_ID] as TaskNotesLike | undefined) ?? null;
}


/** TaskNotes' live configuration, or the documented defaults when the plugin
 * isn't installed (so callers never branch on null). */
export function readTaskNotesSetup(app: App): TaskNotesSetup {
	return parseTaskNotesSettings(taskNotesPlugin(app)?.settings);
}


/** Last list read from TaskNotes' plugin data, so a synchronous caller (a card
 * render, the editor) can show subscriptions the async read already found. */
let dataSubscriptions: TaskNotesSubscription[] | null = null;


/**
 * TaskNotes' calendar subscriptions, read synchronously.
 *
 * They are *not* part of TaskNotes' settings object: its subscription service
 * persists them under `icsSubscriptions` in the plugin's own data file. So the
 * live service is asked first, then whatever the last async read of that data
 * found, and only then the settings — which older versions did use.
 */
export function taskNotesSubscriptions(app: App, setup: TaskNotesSetup): TaskNotesSubscription[] {
	const service = taskNotesPlugin(app)?.icsSubscriptionService;
	if (typeof service?.getSubscriptions === "function") {
		try {
			const live = parseSubscriptions(service.getSubscriptions());
			if (live.length) return live;
		} catch {
			// Service present but unhappy — fall through to the cached data.
		}
	}
	if (dataSubscriptions?.length) return dataSubscriptions;
	return setup.subscriptions;
}


/** Re-read TaskNotes' subscriptions, including the asynchronous plugin-data
 * path the synchronous reader can't take. Call it alongside a feed refresh;
 * the result is cached for `taskNotesSubscriptions`. */
export async function loadTaskNotesSubscriptions(
	app: App,
	setup: TaskNotesSetup,
): Promise<TaskNotesSubscription[]> {
	const plugin = taskNotesPlugin(app);
	const service = plugin?.icsSubscriptionService;
	if (typeof service?.getSubscriptions === "function") {
		try {
			const live = parseSubscriptions(service.getSubscriptions());
			if (live.length) {
				dataSubscriptions = live;
				return live;
			}
		} catch {
			// Fall through to the plugin data.
		}
	}
	if (typeof plugin?.loadData === "function") {
		try {
			const data = await plugin.loadData();
			const stored = parseSubscriptions(
				(data && typeof data === "object" ? (data as Record<string, unknown>) : {}).icsSubscriptions,
			);
			if (stored.length) {
				dataSubscriptions = stored;
				return stored;
			}
		} catch {
			// Unreadable data — fall back to the settings copy.
		}
	}
	return taskNotesSubscriptions(app, setup);
}


/** The tags on a note (frontmatter and inline), without their leading "#". */
function noteTags(app: App, file: TFile): string[] {
	const cache = app.metadataCache.getFileCache(file);
	const out: string[] = [];
	for (const tag of cache?.tags ?? []) {
		const t = tag.tag.replace(/^#/, "");
		if (t && !out.includes(t)) out.push(t);
	}
	for (const t of strList(cache?.frontmatter?.tags)) {
		const clean = t.replace(/^#/, "");
		if (clean && !out.includes(clean)) out.push(clean);
	}
	return out;
}


/** Every TaskNotes task in the vault. */
export function collectTaskNotesTasks(app: App, setup: TaskNotesSetup): TaskNotesTask[] {
	const out: TaskNotesTask[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		const task = readTaskNotesTask(setup, file.path, fm, noteTags(app, file));
		if (task) out.push(task);
	}
	return out;
}


/** Every timeblock in the vault, as calendar occurrences. Timeblocks live in
 * daily-note frontmatter, so the day comes from the note's own name via
 * `resolveDayKey` (the caller supplies the daily-notes format). */
export function collectTimeblockOccurrences(
	app: App,
	resolveDayKey: (path: string) => string | null,
	fallbackColor: string,
): IcsOccurrence[] {
	const out: IcsOccurrence[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		const raw: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.timeblocks;
		if (!Array.isArray(raw) || raw.length === 0) continue;
		const dayKey = resolveDayKey(file.path);
		if (!dayKey) continue;
		out.push(...timeblockOccurrences(dayKey, readTimeblocks(raw), file.path, fallbackColor));
	}
	return out;
}


/** Apply a completion toggle to a task note. Best-effort: a failed write
 * leaves the note untouched and reports false. */
export async function applyCompletion(
	app: App,
	setup: TaskNotesSetup,
	task: TaskNotesTask,
	dayKey: string,
	complete: boolean,
): Promise<boolean> {
	const file = app.vault.getAbstractFileByPath(task.path);
	if (!(file instanceof TFile)) return false;
	const edit = completionEdit(setup, task, dayKey, complete);
	try {
		await app.fileManager.processFrontMatter(file, (fm) => {
			for (const [key, value] of Object.entries(edit)) {
				// An empty completion date means "clear it" rather than "store ''".
				if (value === "") delete fm[key];
				else fm[key] = value;
			}
		});
		return true;
	} catch {
		return false;
	}
}


/** Read one task straight from a note path (used after a completion toggle, so
 * the next render sees fresh frontmatter). */
export function readTaskAt(app: App, setup: TaskNotesSetup, path: string): TaskNotesTask | null {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return null;
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	return readTaskNotesTask(setup, file.path, fm, noteTags(app, file));
}


// ---- TaskNotes' own ICS subscriptions --------------------------------------

/** Cache for local (in-vault) .ics subscriptions, keyed by path and
 * invalidated by the file's mtime — the remote ones are cached by ics.ts. */
const localCache = new Map<string, { mtime: number; cal: IcsCalendar | null; error: string | null }>();


/** The parsed calendar for an in-vault .ics file, re-read only when the file
 * changed. Never throws: an unreadable or unparseable file yields null, with
 * the reason kept for `subscriptionStatus`. */
export async function loadLocalCalendar(app: App, path: string): Promise<IcsCalendar | null> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		localCache.set(path, { mtime: 0, cal: null, error: "missing-file" });
		return null;
	}
	const cached = localCache.get(path);
	if (cached && cached.mtime === file.stat.mtime) return cached.cal;
	try {
		const cal = parseIcs(await app.vault.cachedRead(file));
		localCache.set(path, {
			mtime: file.stat.mtime,
			cal,
			error: cal ? null : "not-calendar",
		});
		return cal;
	} catch (e) {
		localCache.set(path, {
			mtime: file.stat.mtime,
			cal: null,
			error: e instanceof Error ? e.message : String(e),
		});
		return null;
	}
}


/** The last-read calendar for an in-vault .ics file, without touching disk. */
export function cachedLocalCalendar(path: string): IcsCalendar | null {
	return localCache.get(path)?.cal ?? null;
}


/** How the last load of one subscription went, whichever kind it is — so the
 * editor can say which calendar didn't come through, and why, instead of the
 * card silently showing nothing for it. */
export function subscriptionStatus(sub: TaskNotesSubscription): IcsStatus {
	if (sub.type !== "local") return calendarStatus(sub.url);
	const entry = localCache.get(sub.filePath);
	return {
		loaded: !!entry?.cal,
		events: entry?.cal?.events.length ?? 0,
		fetched: entry?.cal?.fetched ?? null,
		error: entry?.error ?? null,
		blocked: false,
	};
}


/** Open a TaskNotes task in TaskNotes' own edit modal rather than the raw
 * Markdown note. TaskNotes exposes no stable public API, so this resolves the
 * plugin's own task object for the file and hands it to `openTaskEditModal`,
 * returning whether it handled the open; the caller falls back to opening the
 * file when it didn't.
 *
 * The modal requires TaskNotes' `TaskInfo` (title/status/priority/…), not a
 * `TFile`: passing the file leaves the modal with a broken change-detection
 * baseline that traps every button but Delete (see issue #72).
 * `openTaskEditModal` is async, so a bad argument never throws synchronously —
 * resolving the info up front (and awaiting the open) is the only way to know
 * we really handled it. */
export async function openInTaskNotes(app: App, path: string): Promise<boolean> {
	const plugin = taskNotesPlugin(app);
	if (!plugin || typeof plugin.openTaskEditModal !== "function") return false;
	const task = await resolveTaskNotesInfo(plugin, path);
	if (!task) return false;
	try {
		await plugin.openTaskEditModal(task);
		return true;
	} catch {
		// Internal error — fall through to a plain file open.
		return false;
	}
}


/** Resolve TaskNotes' `TaskInfo` for a note path via whichever accessor the
 * installed version exposes: the cache manager first, then the public runtime
 * API (`api.tasks.get`). Both are best-effort and may be absent or reshaped
 * between TaskNotes versions, so failures fall through to the next. */
async function resolveTaskNotesInfo(plugin: TaskNotesLike, path: string): Promise<unknown> {
	const cache = plugin.cacheManager;
	if (typeof cache?.getTaskInfo === "function") {
		try {
			const info = await cache.getTaskInfo(path);
			if (info) return info;
		} catch {
			// Fall through to the public API.
		}
	}
	const get = plugin.api?.tasks?.get;
	if (typeof get === "function") {
		try {
			const info = await get(path);
			if (info) return info;
		} catch {
			// No resolver worked.
		}
	}
	return null;
}
