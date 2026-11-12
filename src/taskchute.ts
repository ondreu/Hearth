/**
 * Everything Hearth knows about TaskChute Plus.
 *
 * Two very different sources, deliberately kept in one module:
 *
 * 1. **The plugin's live model** (`taskChuteSession`). TaskChute exposes its
 *    day view's model and its execution services publicly on the view instance
 *    — `taskInstances`, `startInstance`, `stopInstance` — so Hearth can start
 *    and stop a task through the plugin that owns the timer, the log, the
 *    heatmap and the reminders instead of writing any of that itself. A hidden
 *    detached leaf keeps one such session alive while a TaskChute card is on a
 *    board; it is the same workspace view the plugin would open, just never
 *    shown.
 *
 * 2. **The plugin's own records** (`taskChuteActivity`). The overview and
 *    heatmap views are pure reads of `<log>/<YYYY-MM>-tasks.json`, the snapshot
 *    TaskChute writes after every execution. No view, no polling, no writes —
 *    which is why those two views stay light even on a board full of cards.
 *
 * Nothing here reimplements TaskChute's rules: routines, moves, deletions and
 * the running state all come from the plugin's model or its snapshot.
 */
import { App, TFile, WorkspaceLeaf } from "obsidian";

/** Community-plugin id of TaskChute Plus. */
export const TASKCHUTE_PLUGIN_ID = "taskchute-plus";

/** The view TaskChute Plus registers for its day-execution screen. */
export const TASKCHUTE_VIEW = "taskchute-view";

/** Folders the card falls back to when the plugin's own path manager is not
 * reachable (plugin disabled, or a future release that renames the field). */
export const TASKCHUTE_DEFAULT_TASK_FOLDER = "TaskChute/Task";
export const TASKCHUTE_DEFAULT_LOG_FOLDER = "TaskChute/Log";

/** The three states a task instance can be in that the card draws. */
export type TaskChuteState = "idle" | "running" | "done" | "paused";

/** One row of the plugin's day model, as far as the card reads it. */
export interface TaskChuteInstance {
	instanceId: string;
	state: TaskChuteState;
	task?: {
		path?: string;
		name?: string;
		displayTitle?: string;
		scheduledTime?: string;
		isRoutine?: boolean;
	};
	/** The time-of-day section the plugin sorts the task into, e.g.
	 * `"8:00-12:00"`, or `"none"` for an unscheduled task. */
	slotKey?: string;
	startTime?: Date;
	stopTime?: Date;
	actualMinutes?: number;
	executedTitle?: string;
	/** Sort key within the day, as the plugin stores it in its day state. */
	order?: number | null;
}

/** The slice of `TaskChuteView` Hearth drives. Structural, so a plugin update
 * that keeps these members working keeps the card working; a missing member is
 * detected before anything is drawn. The optional services are the card's
 * create/organise actions: each is offered only while the plugin exposes it. */
export interface TaskChuteView {
	taskInstances: TaskChuteInstance[];
	startInstance(inst: TaskChuteInstance): Promise<void>;
	stopInstance(inst: TaskChuteInstance, stopTime?: Date): Promise<void>;
	renderTaskList?(): void;
	saveTaskOrders?(): Promise<void>;
	taskCreationController?: {
		showAddTaskModal?: () => void;
	};
	taskMutationService?: {
		duplicateInstance(inst: TaskChuteInstance): Promise<unknown>;
		deleteTask(inst: TaskChuteInstance): Promise<boolean>;
		/** Move an instance into another time section — TaskChute's own drop
		 * handler, including the slot's persisted schedule. */
		moveInstanceToSlot(inst: TaskChuteInstance, slot: string, index?: number): Promise<void>;
	};
	/** The plugin's own "edit start time" dialog, so a reschedule goes through
	 * the same slot/day-state path as editing it in TaskChute. */
	taskTimeController?: {
		showScheduledTimeEditModal(inst: TaskChuteInstance): void;
	};
	/** The day the view is showing, and the state it loads it into. */
	currentDate?: Date;
	currentDayStateKey?: string | null;
	currentDayState?: unknown;
	reloadTasksAndRestore?: (options?: {
		runBoundaryCheck?: boolean;
		clearDayStateCache?: "all";
	}) => Promise<void>;
	/** The plugin's time-slot configuration, used to keep sections in the
	 * day's order even when the tasks arrive in another. */
	sectionConfig?: {
		getSlotKeys?: () => string[];
	};
	taskScheduleController?: {
		moveTaskToDate(
			inst: TaskChuteInstance,
			date: string,
			options?: { quiet?: boolean },
		): Promise<boolean>;
	};
}

/** The plugin's own settings surface, used to respect a custom storage folder. */
interface TaskChutePluginLike {
	pathManager?: {
		getTaskFolderPath?: () => string;
		getLogDataPath?: () => string;
	};
}

/** One execution the plugin recorded for a day. */
export interface TaskChuteLogEntry {
	taskTitle?: string;
	taskName?: string;
	taskPath?: string;
	startTime?: string;
	stopTime?: string;
	durationSec?: number;
	duration?: number;
}

/** A day's totals, as the plugin's snapshot keeps them. */
export interface TaskChuteDaySummary {
	totalMinutes?: number;
	totalTasks?: number;
	completedTasks?: number;
}

/** The persisted snapshot for one month (`<log>/<YYYY-MM>-tasks.json`). */
export interface TaskChuteLogSnapshot {
	taskExecutions?: Record<string, TaskChuteLogEntry[]>;
	dailySummary?: Record<string, TaskChuteDaySummary>;
}

/** Whether TaskChute Plus is loaded right now. */
export function isTaskChuteAvailable(app: App): boolean {
	try {
		return !!app.plugins?.plugins?.[TASKCHUTE_PLUGIN_ID];
	} catch {
		return false;
	}
}

/** The plugin's task and log folders, honouring its `specifiedFolder` setting
 * when its path manager is reachable. */
export function taskChuteFolders(app: App): { tasks: string; log: string } {
	let plugin: TaskChutePluginLike | undefined;
	try {
		plugin = app.plugins?.plugins?.[TASKCHUTE_PLUGIN_ID] as TaskChutePluginLike | undefined;
	} catch {
		plugin = undefined;
	}
	return {
		tasks: plugin?.pathManager?.getTaskFolderPath?.() ?? TASKCHUTE_DEFAULT_TASK_FOLDER,
		log: plugin?.pathManager?.getLogDataPath?.() ?? TASKCHUTE_DEFAULT_LOG_FOLDER,
	};
}

/** The title a row shows: the plugin's executed title first (a task renamed
 * after it ran keeps the name it ran under), then the note name. */
export function taskChuteTitle(inst: TaskChuteInstance): string {
	for (const candidate of [inst.executedTitle, inst.task?.displayTitle, inst.task?.name]) {
		const trimmed = candidate?.trim();
		if (trimmed) return trimmed;
	}
	return "";
}

/** The time a row shows: the scheduled slot, or the moment it was started when
 * the task has no schedule. */
export function taskChuteTime(inst: TaskChuteInstance): string {
	const scheduled = inst.task?.scheduledTime?.trim();
	if (scheduled) return scheduled;
	const start = inst.startTime;
	if (start instanceof Date && !Number.isNaN(start.getTime())) {
		return `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
	}
	return "";
}

/** `HH:mm` for a date, or "" when there is none. */
export function taskChuteClock(date: Date | undefined): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** The range a task actually ran, `19:16 → 19:45`, or "" while it has no
 * times. TaskChute's own row shows this rather than the scheduled slot. */
export function taskChuteRange(inst: TaskChuteInstance): string {
	const start = taskChuteClock(inst.startTime);
	const stop = taskChuteClock(inst.stopTime);
	if (start && stop) return `${start} → ${stop}`;
	return "";
}

/** One time-of-day section of the day, as the plugin groups it. */
export interface TaskChuteSection {
	key: string;
	rows: TaskChuteInstance[];
}

/** Rows grouped by the plugin's own time section, in the order the sections
 * first appear. `none` (unscheduled) keeps its place at the end, which is where
 * the plugin puts it. */
export function taskChuteSections(
	instances: readonly TaskChuteInstance[],
	slotOrder: readonly string[] = [],
): TaskChuteSection[] {
	// Chronological, not "running first": a section is a part of the day, and
	// lifting the running task's section above the morning would misread the
	// board. Order inside a section still follows the plugin's `order` keys.
	const rows = instances
		.filter((inst) => taskChuteTitle(inst).length > 0)
		.slice()
		.sort((a, b) => {
			const aOrder = typeof a.order === "number" ? a.order : null;
			const bOrder = typeof b.order === "number" ? b.order : null;
			if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
			return 0;
		});
	const sections = new Map<string, TaskChuteInstance[]>();
	for (const inst of rows) {
		const key = inst.slotKey?.trim() || "none";
		const bucket = sections.get(key);
		if (bucket) bucket.push(inst);
		else sections.set(key, [inst]);
	}
	// Every configured window is drawn, empty or not: an empty section is a
	// drop target, and a day with nothing in the afternoon still has an
	// afternoon.
	const keys = [...slotOrder];
	for (const key of sections.keys()) {
		if (key !== "none" && !keys.includes(key)) keys.push(key);
	}
	if (sections.has("none")) keys.push("none");
	return keys.map((key) => ({ key, rows: sections.get(key) ?? [] }));
}

/** `8:00-12:00` → `8:00 – 12:00`, and `none` → the caller's own label. */
export function taskChuteSectionLabel(key: string, noTime: string): string {
	if (!key || key === "none") return noTime;
	const dash = key.indexOf("-");
	if (dash < 0) return key;
	return `${key.slice(0, dash)} – ${key.slice(dash + 1)}`;
}

/** How long a running task has been running, in seconds. */
export function taskChuteElapsed(inst: TaskChuteInstance, now = Date.now()): number {
	const start = inst.startTime;
	if (!(start instanceof Date) || Number.isNaN(start.getTime())) return 0;
	return Math.max(0, Math.floor((now - start.getTime()) / 1000));
}

/** `03:07` under an hour, `1:03:07` above it. */
export function formatTaskChuteDuration(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** `45 min` / `1 h 20 min` — how the overview states a day's total. */
export function formatTaskChuteMinutes(minutes: number): string {
	const total = Math.max(0, Math.round(minutes));
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Rows in the order the plugin keeps them, with the running task pulled to the
 * top: the card's whole job is "what am I doing now", and a running task can
 * sit far down a long list. Within a state band the plugin's own `order` wins,
 * which is what makes the card's up/down moves stick. */
export function taskChuteRows(instances: readonly TaskChuteInstance[]): TaskChuteInstance[] {
	const rows = instances.filter((inst) => taskChuteTitle(inst).length > 0);
	return rows.slice().sort((a, b) => {
		const aRunning = a.state === "running" ? 0 : 1;
		const bRunning = b.state === "running" ? 0 : 1;
		if (aRunning !== bRunning) return aRunning - bRunning;
		const aOrder = typeof a.order === "number" ? a.order : null;
		const bOrder = typeof b.order === "number" ? b.order : null;
		if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
		return 0;
	});
}

/** Move one row one place up or down among the rows in the same state, by
 * rewriting the plugin's own `order` keys. Mutates the instances (they are the
 * plugin's objects) and returns whether anything moved; the caller persists with
 * `saveTaskOrders()` and repaints.
 *
 * Only neighbours in the same state are swapped: the plugin sorts by state
 * first, so an order swap across states would be undone by its next render. */
export function taskChuteReorder(
	instances: readonly TaskChuteInstance[],
	instanceId: string,
	direction: -1 | 1,
): boolean {
	const rows = taskChuteRows(instances);
	const index = rows.findIndex((row) => row.instanceId === instanceId);
	if (index < 0) return false;
	const target = rows[index + direction];
	if (!target || target.state !== rows[index].state) return false;
	// Normalise first so rows the plugin never ordered (a routine instance, a
	// fresh duplicate) get a key and the swap has something to trade.
	rows.forEach((row, position) => {
		row.order = position;
	});
	const moved = rows[index];
	const order = moved.order;
	moved.order = target.order;
	target.order = order;
	return true;
}

/** `4/9` — finished over all. "Done" counts only tasks that actually ran or
 * were checked off, which is what the plugin's own state means. */
export function taskChuteProgress(instances: readonly TaskChuteInstance[]): { done: number; total: number } {
	let done = 0;
	let total = 0;
	for (const inst of instances) {
		if (!taskChuteTitle(inst)) continue;
		total += 1;
		if (inst.state === "done") done += 1;
	}
	return { done, total };
}

// ---- Records (overview + heatmap) ----------------------------------------

function monthKeyOf(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKeyOf(date: Date): string {
	return `${monthKeyOf(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Read one month's snapshot, or null when it isn't there (a vault that never
 * used TaskChute on that month) or isn't readable. */
export async function readTaskChuteSnapshot(app: App, monthKey: string): Promise<TaskChuteLogSnapshot | null> {
	const path = `${taskChuteFolders(app).log}/${monthKey}-tasks.json`;
	try {
		const file = app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		const raw = await app.vault.read(file);
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
}

/** The minutes a day actually took: the snapshot's own total when it has one,
 * otherwise the sum of its recorded executions. */
export function taskChuteDayMinutes(snapshot: TaskChuteLogSnapshot, dayKey: string): number {
	const summary = snapshot.dailySummary?.[dayKey];
	if (typeof summary?.totalMinutes === "number" && Number.isFinite(summary.totalMinutes)) {
		return Math.max(0, summary.totalMinutes);
	}
	const entries = snapshot.taskExecutions?.[dayKey] ?? [];
	let seconds = 0;
	for (const entry of entries) {
		if (typeof entry.durationSec === "number" && Number.isFinite(entry.durationSec)) {
			seconds += entry.durationSec;
		} else if (typeof entry.duration === "number" && Number.isFinite(entry.duration)) {
			seconds += entry.duration;
		}
	}
	return seconds / 60;
}

/** A day's finished/total counts. The snapshot's summary wins; a day with only
 * raw executions falls back to counting them. */
export function taskChuteDayCounts(snapshot: TaskChuteLogSnapshot, dayKey: string): { done: number; total: number } {
	const summary = snapshot.dailySummary?.[dayKey];
	const done = typeof summary?.completedTasks === "number" ? summary.completedTasks : (snapshot.taskExecutions?.[dayKey]?.length ?? 0);
	const total = typeof summary?.totalTasks === "number" ? summary.totalTasks : done;
	return { done: Math.max(0, done), total: Math.max(done, total) };
}

/** One cell of the heatmap: a day, its minutes and its counts. */
export interface TaskChuteActivityDay {
	dayKey: string;
	minutes: number;
	done: number;
	total: number;
}

/** Activity for the last `days` days, oldest first, read from the month
 * snapshots that span the range (one or two files in practice). */
export async function taskChuteActivity(app: App, days: number, today = new Date()): Promise<TaskChuteActivityDay[]> {
	const span = Math.max(1, Math.floor(days));
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (span - 1));
	const monthKeys: string[] = [];
	for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= today; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
		monthKeys.push(monthKeyOf(cursor));
	}
	const snapshots = new Map<string, TaskChuteLogSnapshot>();
	await Promise.all(
		monthKeys.map(async (key) => {
			const snapshot = await readTaskChuteSnapshot(app, key);
			if (snapshot) snapshots.set(key, snapshot);
		}),
	);
	const result: TaskChuteActivityDay[] = [];
	for (let offset = 0; offset < span; offset += 1) {
		const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
		const key = dayKeyOf(day);
		const snapshot = snapshots.get(monthKeyOf(day));
		if (!snapshot) {
			result.push({ dayKey: key, minutes: 0, done: 0, total: 0 });
			continue;
		}
		const counts = taskChuteDayCounts(snapshot, key);
		result.push({
			dayKey: key,
			minutes: Math.round(taskChuteDayMinutes(snapshot, key)),
			done: counts.done,
			total: counts.total,
		});
	}
	return result;
}

// ---- The live session ----------------------------------------------------

/** One hidden TaskChute view per app. It is deliberately *not* the user's open
 * tab: driving that would move the tab's date under them. A detached leaf is
 * outside the workspace layout, so this one never shows up in `workspace.json`
 * and never steals focus. */
interface TaskChuteSession {
	container: HTMLElement;
	leaf: WorkspaceLeaf;
	view: TaskChuteView;
}

let session: TaskChuteSession | null = null;
/** A failed attempt is remembered for the lifetime of the page: a plugin that
 * refused to build its view once will refuse again, and retrying on every
 * render would spin up a leaf per redraw. */
let sessionUnavailable = false;

/** Whether `view` has the members the card drives. Checked structurally
 * because this is another plugin's object, not an interface of ours. */
function asTaskChuteView(view: unknown): TaskChuteView | null {
	const candidate = view as Partial<TaskChuteView> | null | undefined;
	if (!candidate || !Array.isArray(candidate.taskInstances)) return null;
	if (typeof candidate.startInstance !== "function") return null;
	if (typeof candidate.stopInstance !== "function") return null;
	return candidate as TaskChuteView;
}

function disposeSession(): void {
	if (!session) return;
	const current = session;
	session = null;
	try {
		void Promise.resolve(current.leaf.setViewState({ type: "empty" })).then(
			() => current.container.remove(),
			() => current.container.remove(),
		);
	} catch {
		current.container.remove();
	}
}

/** The hidden TaskChute view the cards drive, created on first use.
 *
 * Returns null when TaskChute is missing, refuses to build a view, or the view
 * no longer has the members the card needs — every caller draws a named
 * empty state rather than an empty card. */
export async function taskChuteSession(app: App): Promise<TaskChuteView | null> {
	if (session) return session.view;
	if (sessionUnavailable) return null;
	if (!isTaskChuteAvailable(app)) return null;
	try {
		const container = document.body.createDiv("hearth-taskchute-session");
		const LeafCtor = WorkspaceLeaf as unknown as { new (app: App): WorkspaceLeaf };
		const leaf = new LeafCtor(app);
		container.appendChild(leaf.containerEl);
		await leaf.setViewState({ type: TASKCHUTE_VIEW, active: false });
		const view = asTaskChuteView(leaf.view);
		if (!view) {
			throw new Error("TaskChute view does not expose taskInstances/startInstance/stopInstance");
		}
		session = { container, leaf, view };
		return view;
	} catch (error) {
		sessionUnavailable = true;
		console.warn("[Hearth] TaskChute session unavailable", error);
		return null;
	}
}

/** The day the card is showing. One TaskChute view means one day across the
 * board: two TaskChute cards are two windows onto the same day, which is how
 * the plugin itself behaves. */
let sessionDay: Date | null = null;

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The day the TaskChute cards are showing, defaulting to today. */
export function taskChuteDay(): Date {
	return sessionDay ?? startOfDay(new Date());
}

/** `Today`, or a short localized date such as `Mon 3 Nov`. */
export function formatTaskChuteDay(date: Date, todayLabel: string, now = new Date()): string {
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	if (sameDay) return todayLabel;
	return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Show another day in the live TaskChute view. Resolves false when the session
 * (or the plugin method it needs) isn't there, so the caller keeps its old
 * header instead of claiming a move that did not happen. */
export async function setTaskChuteDay(app: App, date: Date): Promise<boolean> {
	const view = await taskChuteSession(app);
	if (!view) return false;
	const day = startOfDay(date);
	try {
		view.currentDate = day;
		// The view caches the day state per date; without dropping it the reload
		// would show the previous day's orders, hidden routines and duplicates.
		view.currentDayStateKey = null;
		view.currentDayState = null;
		if (typeof view.reloadTasksAndRestore === "function") {
			await view.reloadTasksAndRestore({ runBoundaryCheck: true, clearDayStateCache: "all" });
		} else {
			view.renderTaskList?.();
		}
		sessionDay = day;
		return true;
	} catch (error) {
		console.warn("[Hearth] TaskChute could not switch day", error);
		return false;
	}
}

/** Move the shown day by `days` (yesterday, tomorrow…). */
export async function shiftTaskChuteDay(app: App, days: number): Promise<boolean> {
	const base = taskChuteDay();
	return setTaskChuteDay(app, new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

/** Drop the hidden view. Called when Hearth unloads, so an unloaded Hearth does
 * not leave another plugin's whole view (and its timers) running. */
export function disposeTaskChuteSession(): void {
	disposeSession();
	sessionUnavailable = false;
	sessionDay = null;
}

/** Bring TaskChute's own tab forward, opening one when it isn't there. The
 * card is deliberately not a full UI — creation, comments, projects and the
 * log stay in the plugin, and this is the way in. */
export async function openTaskChute(app: App): Promise<void> {
	const existing = app.workspace.getLeavesOfType(TASKCHUTE_VIEW)[0];
	if (existing) {
		await app.workspace.revealLeaf(existing);
		return;
	}
	const leaf = app.workspace.getLeaf("tab");
	await leaf.setViewState({ type: TASKCHUTE_VIEW, active: true });
	await app.workspace.revealLeaf(leaf);
}
