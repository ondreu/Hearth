import { Notice, TFile, type App } from "obsidian";
import {
	moment,
	createDailyNoteAt,
	dailyNoteFinder,
	dailyNotesOptions,
	type DailyNotesOptions,
} from "./cardbodies";
import { parseNaturalDate } from "./dates";
import { t } from "./i18n";
import { inlineTags, stripInlineTags } from "./taskfilter";
import { readPriorityEmoji } from "./priority";
import { readEmojiField, stripTaskMetadata } from "./checkboxtasks";
import type { TasksConfig } from "./types";
import type { CardHost } from "./cardhost";

/**
 * The obsidian-tasks community plugin as a tasks-card source.
 *
 * Hearth draws this source itself — the card's normal rows/board/matrix with
 * its own chips, dots and colours — but everything it draws is what the Tasks
 * plugin says is a task:
 *
 *   - what counts as a task is any checkbox line whose status symbol the
 *     plugin knows (its built-ins plus the user's custom statuses, read live
 *     from its status registry);
 *   - whether it is done is the plugin's own notion (its DONE/CANCELLED types,
 *     not Hearth's checkbox config);
 *   - the vault's task format is honoured on write: ticking goes through the
 *     plugin's own toggle command (which rolls recurrence and stamps done
 *     dates the way the plugin does), editing and creating go through its own
 *     modals, so the note is never converted to another format.
 *
 * The query building of the previous version is gone: the card filters, sorts,
 * caps and fields Hearth's own way, over the tasks collected here.
 */


/** Community plugin id for obsidian-tasks. */
export const TASKS_PLUGIN_ID = "obsidian-tasks-plugin";

/** Workspace event the plugin fires after its task cache has been rebuilt —
 * including the first build after Obsidian starts. Hearth listens so a Tasks
 * card drawn during that build redraws once the cache is ready. */
export const TASKS_CACHE_UPDATE_EVENT = "obsidian-tasks-plugin:cache-update";


/** Whether obsidian-tasks is installed and enabled in this vault. */
export function tasksPluginEnabled(app: App): boolean {
	try {
		return !!app?.plugins?.enabledPlugins?.has(TASKS_PLUGIN_ID);
	} catch {
		return false;
	}
}


/** The slice of the Tasks API v1 this card uses. Tasks documents these three
 * methods as its integration surface for other plugins
 * (`app.plugins.plugins['obsidian-tasks-plugin'].apiV1`). */
export interface TasksPluginApiV1 {
	/** Opens the Tasks create modal; resolves to the entered task's Markdown
	 * line, or "" when cancelled. */
	createTaskLineModal(): Promise<string>;
	/** Opens the Tasks edit modal prefilled with `taskLine`; resolves to the
	 * edited Markdown line, or "" when cancelled. */
	editTaskLineModal(taskLine: string): Promise<string>;
	/** Toggles a task line the way the plugin's own command does, honouring
	 * recurrence; returns the updated line (two lines for a completed
	 * recurring task). */
	executeToggleTaskDoneCommand(line: string, path: string): string;
}


/** The loaded Tasks plugin instance, or null when it isn't enabled. */
function tasksPlugin(app: App): { apiV1?: unknown; getTasks?: unknown; getState?: unknown } | null {
	try {
		if (!tasksPluginEnabled(app)) return null;
		const plugin = app.plugins.plugins[TASKS_PLUGIN_ID] as
			| { apiV1?: unknown; getTasks?: unknown; getState?: unknown }
			| undefined;
		return plugin ?? null;
	} catch {
		return null;
	}
}


/** Tasks' integration API, or null when the plugin is missing, disabled, or
 * doesn't expose the documented surface (probed, never assumed: each method
 * is checked before it is handed out). */
export function tasksPluginApi(app: App): TasksPluginApiV1 | null {
	const api = tasksPlugin(app)?.apiV1 as Partial<TasksPluginApiV1> | undefined;
	if (!api) return null;
	if (
		typeof api.createTaskLineModal !== "function" ||
		typeof api.editTaskLineModal !== "function" ||
		typeof api.executeToggleTaskDoneCommand !== "function"
	) {
		return null;
	}
	return api as TasksPluginApiV1;
}


// ---- Custom statuses ---------------------------------------------------------

/** One Tasks-plugin status: the symbol inside `- [ ]`, its display name, and
 * whether the plugin counts it as finished. */
export interface TasksPluginStatus {
	symbol: string;
	label: string;
	done: boolean;
}


/** Fallback statuses when the registry can't be read: the plugin's own
 * defaults (Todo, In Progress, Done, Cancelled). */
const FALLBACK_STATUSES: TasksPluginStatus[] = [
	{ symbol: " ", label: "Todo", done: false },
	{ symbol: "/", label: "In Progress", done: false },
	{ symbol: "x", label: "Done", done: true },
	{ symbol: "X", label: "Done", done: true },
	{ symbol: "-", label: "Cancelled", done: true },
];


/** Try to read the plugin's status registry in any of its known shapes. The
 * registry has moved between Tasks versions (a `StatusRegistry` instance with
 * a `getStatus`/`bySymbol` lookup, a plain array on the plugin, or status
 * settings), so every shape is probed defensively and anything unrecognised
 * is ignored rather than throwing. */
function readRegistryStatuses(plugin: Record<string, unknown>): TasksPluginStatus[] | null {
	const out: TasksPluginStatus[] = [];
	const push = (symbol: unknown, name: unknown, done: unknown): void => {
		if (typeof symbol !== "string" || symbol.length !== 1) return;
		const label = typeof name === "string" && name.trim() ? name.trim() : symbol;
		out.push({ symbol, label, done: done === true });
	};
	try {
		const rawReg = plugin["statusRegistry"];
		const reg =
			rawReg && typeof rawReg === "object" ? (rawReg as Record<string, unknown>) : undefined;
		if (reg) {
			// Newer versions: registry with registeredStatuses[] of
			// StatusConfiguration { symbol, name, type }.
			const list: unknown = reg["registeredStatuses"];
			if (Array.isArray(list) && list.length) {
				for (const entry of list) {
					if (!entry || typeof entry !== "object") continue;
					const rec = entry as Record<string, unknown>;
					const symbol = rec["symbol"];
					const name = rec["name"] ?? rec["label"];
					const type = typeof rec["type"] === "string" ? rec["type"].toUpperCase() : "";
					push(symbol, name, type === "DONE" || type === "CANCELLED");
				}
				if (out.length) return out;
			}
			// Older versions: bySymbol map symbol -> Status.
			const rawBySymbol = reg["bySymbol"];
			const bySymbol = rawBySymbol && typeof rawBySymbol === "object" ? rawBySymbol : null;
			if (bySymbol) {
				for (const [symbol, entry] of Object.entries(bySymbol as Record<string, unknown>)) {
					if (!entry || typeof entry !== "object") continue;
					const rec = entry as Record<string, unknown>;
					const name = rec["name"] ?? rec["label"];
					const type = typeof rec["type"] === "string" ? rec["type"].toUpperCase() : "";
					push(symbol, name, type === "DONE" || type === "CANCELLED");
				}
				if (out.length) return out;
			}
		}
		// Status settings array on the plugin settings.
		const settings = plugin["settings"] as Record<string, unknown> | undefined;
		const candidates = settings ? [settings["statuses"], settings["statusSettings"]] : [];
		for (const candidate of candidates) {
			if (!Array.isArray(candidate) || !candidate.length) continue;
			const before = out.length;
			for (const entry of candidate) {
				if (!entry || typeof entry !== "object") continue;
				const rec = entry as Record<string, unknown>;
				const symbol = rec["symbol"];
				const name = rec["name"] ?? rec["label"];
				const type = typeof rec["type"] === "string" ? rec["type"].toUpperCase() : "";
				push(symbol, name, type === "DONE" || type === "CANCELLED");
			}
			if (out.length > before) return out;
		}
	} catch {
		return null;
	}
	return null;
}


/**
 * The lines the plugin itself treats as tasks, as `path:line` keys, or null
 * when its cache cannot be read (an older build without the accessor).
 *
 * Scanning checkbox lines is cheap, but only the plugin knows which of them
 * pass its global filter: a vault that treats just `#task` lines as tasks must
 * not show every other checkbox. The cache is where that answer is public.
 */
export function tasksPluginTaskIndex(app: App): Set<string> | null {
	const plugin = tasksPlugin(app);
	const getTasks = plugin?.getTasks;
	if (!plugin || typeof getTasks !== "function") return null;
	// The cache builds asynchronously: getTasks() is empty until the plugin's
	// state reaches "Warm". An empty Set is not "unknown" to the caller — it says
	// "the plugin considers no line a task" and filters the whole list out — so a
	// cache that is still loading must be answered as null (fall back to the
	// status registry) rather than as an empty answer (#510).
	const getState = plugin.getState;
	if (typeof getState === "function") {
		let phase: unknown;
		try {
			phase = Reflect.apply(getState, plugin, []);
		} catch {
			phase = undefined;
		}
		if (typeof phase === "string" && phase !== "Warm") return null;
	}
	let tasks: unknown;
	try {
		tasks = Reflect.apply(getTasks, plugin, []);
	} catch {
		return null;
	}
	if (!Array.isArray(tasks)) return null;
	const index = new Set<string>();
	for (const task of tasks) {
		if (!task || typeof task !== "object") continue;
		// Obsidian Tasks 7.x exposes the line number on the task's location.
		const entry = task as {
			path?: unknown;
			lineNumber?: unknown;
			taskLocation?: { path?: unknown; lineNumber?: unknown };
		};
		const path = entry.taskLocation?.path ?? entry.path;
		const line = entry.taskLocation?.lineNumber ?? entry.lineNumber;
		if (typeof path === "string" && typeof line === "number" && Number.isInteger(line)) {
			index.add(`${path}:${line}`);
		}
	}
	return index;
}


/**
 * The statuses the Tasks plugin knows, in its own order: its registry when it
 * can be read, otherwise the plugin's defaults. Always non-empty, so a card
 * never ends up with nowhere to put a task.
 */
export function tasksPluginStatuses(app: App): TasksPluginStatus[] {
	try {
		const plugin: unknown = tasksPlugin(app);
		if (plugin && typeof plugin === "object") {
			const read = readRegistryStatuses(plugin as Record<string, unknown>);
			if (read?.length) return read;
		}
	} catch {
		// Fall through to the defaults.
	}
	return [...FALLBACK_STATUSES];
}


// ---- Reading a task line -----------------------------------------------------

/** A Dataview-style inline field `[key:: value]` (the vault's alternative task
 * format) — e.g. `[due:: 2024-01-15]` or `[priority:: high]`. */
const DATAVIEW_FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]+?)\]/g;


/** Read a Dataview inline field from a task line, case-insensitively. Returns
 * the trimmed value, or null when absent. */
function readDataviewField(text: string, key: string): string | null {
	DATAVIEW_FIELD_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = DATAVIEW_FIELD_RE.exec(text)) !== null) {
		if (m[1].trim().toLowerCase() === key) {
			const value = m[2].trim();
			if (value) return value;
		}
	}
	return null;
}


/** Strip Dataview inline fields (`[key:: value]`) from a task's display text,
 * collapsing leftover whitespace. Idempotent. */
function stripDataviewFields(text: string): string {
	return text
		.replace(DATAVIEW_FIELD_RE, "")
		.replace(/\s+/g, " ")
		.trim();
}


/** Resolve a raw date expression — an ISO date or natural language ("today",
 * "next friday") — to YYYY-MM-DD, or null when it isn't a real date. */
function resolveDate(expr: string): string | null {
	return parseNaturalDate(expr);
}


/** One task line as the Tasks plugin means it, in both of the vault's task
 * formats: the Emoji format (`📅 2024-01-15 ⏫ 🔁 every week`) and the Dataview
 * format (`[due:: 2024-01-15] [priority:: high]`). Emoji markers win when both
 * are present on one line; Dataview fields fill whatever the emoji leave out.
 * Tags are the line's inline hashtags either way. */
export interface ParsedTasksPluginLine {
	/** Display title: metadata and tags stripped. */
	text: string;
	/** Raw priority value (an emoji like "⏫" or a word like "high"), or "" when none. */
	priority: string;
	due: string | null;
	dueRaw: string | null;
	scheduled: string | null;
	start: string | null;
	doneDate: string | null;
	recurrence: string | null;
	tags: string[];
}


/** Parse one task line's metadata in the vault's task format. Pure, so it is
 * unit-tested without Obsidian. */
export function parseTasksPluginLine(raw: string): ParsedTasksPluginLine {
	// Emoji markers are read off the line with Dataview fields removed, so a
	// trailing `[due:: …]` never leaks into an emoji value (readEmojiField only
	// stops at the next emoji marker, not at a bracket).
	const emojiSource = raw.replace(DATAVIEW_FIELD_RE, " ");
	DATAVIEW_FIELD_RE.lastIndex = 0;
	// An emoji value runs to the next marker — but a trailing hashtag is a tag,
	// not metadata ("🔁 every week #home" repeats weekly; "#home" is a tag).
	const cleanMeta = (value: string | null): string | null => {
		if (!value) return null;
		const cut = value.split("#")[0].trim();
		return cut || null;
	};
	const dueExpr = cleanMeta(readEmojiField(emojiSource, "📅")) ?? readDataviewField(raw, "due");
	const scheduledExpr = cleanMeta(readEmojiField(emojiSource, "⏳")) ?? readDataviewField(raw, "scheduled");
	const startExpr = cleanMeta(readEmojiField(emojiSource, "🛫")) ?? readDataviewField(raw, "start");
	const doneExpr =
		cleanMeta(readEmojiField(emojiSource, "✅")) ??
		readDataviewField(raw, "completion") ??
		readDataviewField(raw, "done");
	const recurrenceExpr =
		cleanMeta(readEmojiField(emojiSource, "🔁")) ??
		readDataviewField(raw, "recurrence") ??
		readDataviewField(raw, "repeat") ??
		readDataviewField(raw, "repeating");
	const priorityEmoji = readPriorityEmoji(raw) ?? "";
	const priorityWord = readDataviewField(raw, "priority") ?? "";
	// An emoji priority is the plugin's own level; a Dataview word ("high") is
	// kept verbatim so Hearth's priority colours and sorts still apply.
	const priority = priorityEmoji || priorityWord.trim();
	let due: string | null = null;
	let dueRaw: string | null = null;
	if (dueExpr) {
		dueRaw = dueExpr.trim();
		due = resolveDate(dueExpr.trim());
	}
	const scheduled = scheduledExpr ? (resolveDate(scheduledExpr.trim()) ?? null) : null;
	const start = startExpr ? (resolveDate(startExpr.trim()) ?? null) : null;
	const doneDate = doneExpr ? (resolveDate(doneExpr.trim()) ?? null) : null;
	const text = stripInlineTags(stripDataviewFields(stripTaskMetadata(raw))).replace(/\s+/g, " ").trim();
	return {
		text,
		priority,
		due,
		dueRaw,
		scheduled,
		start,
		doneDate,
		recurrence: recurrenceExpr?.trim() || null,
		tags: inlineTags(raw),
	};
}


// ---- Creating a task ----------------------------------------------------------

/** Where a new Tasks-plugin task goes: today's daily note (created when
 * missing), or one specific note. The default is the daily note. */
export function tasksCreateInDailyNote(cfg: TasksConfig): boolean {
	// An explicit choice wins either way; without one the named note wins
	// when set (legacy configs predate the flag) and the daily note is the
	// default. An explicit note with no path yet resolves here (false), so
	// the target lookup reports "no target" instead of using the daily note.
	if (cfg.tasksPluginDailyNote === true) return true;
	if (cfg.tasksPluginDailyNote === false) return false;
	return (cfg.tasksPluginNote?.trim() ?? "") === "";
}


/**
 * Resolve the note a newly created task is appended to, creating today's
 * daily note when that is the destination and it doesn't exist yet. Returns
 * null (after telling the user why) when there is nowhere to put it: no note
 * picked and Daily notes off, an unreadable target, or a daily note that
 * couldn't be made.
 */
export async function ensureTasksPluginTarget(view: CardHost, cfg: TasksConfig): Promise<TFile | null> {
	const notices = t().notices;
	if (tasksCreateInDailyNote(cfg)) {
		const options: DailyNotesOptions | null = dailyNotesOptions(view);
		if (!options) {
			new Notice(notices.tasksPluginNoDailyNotes);
			return null;
		}
		const today = moment();
		const existing = dailyNoteFinder(view, options)(today);
		if (existing) return existing;
		const made = await createDailyNoteAt(view, today, options);
		if (!made) {
			new Notice(notices.couldNotCreateNoteForDay(today.format("YYYY-MM-DD")));
		}
		return made;
	}
	const path = (cfg.tasksPluginNote ?? "").trim();
	if (!path) {
		new Notice(notices.tasksPluginNoTarget);
		return null;
	}
	const direct = view.app.vault.getAbstractFileByPath(path);
	const suffixed =
		direct == null ? view.app.vault.getAbstractFileByPath(`${path}.md`) : null;
	const file = (direct ?? suffixed) as TFile | null;
	if (!(file instanceof TFile)) {
		new Notice(notices.tasksPluginNoteMissing(path));
		return null;
	}
	return file;
}


/**
 * Create a task the way the Tasks plugin does: its own create modal for the
 * line (in the vault's configured task format), appended verbatim to the
 * card's destination note. Returns true when a task was created.
 */
export async function createTasksPluginTask(view: CardHost, cfg: TasksConfig): Promise<boolean> {
	const notices = t().notices;
	const api = tasksPluginApi(view.app);
	if (!api) {
		new Notice(notices.tasksPluginCreateFailed);
		return false;
	}
	let line: string;
	try {
		line = await api.createTaskLineModal();
	} catch {
		new Notice(notices.tasksPluginCreateFailed);
		return false;
	}
	if (!line?.trim()) return false; // cancelled in the modal
	const target = await ensureTasksPluginTarget(view, cfg);
	if (!target) return false;
	try {
		const content = await view.app.vault.read(target);
		const next = content.length && !content.endsWith("\n") ? `${content}\n${line.trim()}\n` : `${content}${line.trim()}\n`;
		await view.app.vault.modify(target, next);
		return true;
	} catch {
		new Notice(notices.tasksPluginCreateFailed);
		return false;
	}
}


// ---- Toggling / editing / deleting through the plugin ------------------------

/** Whether an on-disk line is still the task that was read: only the leading
 * checkbox marker may have changed underneath us (a toggle from elsewhere);
 * the rest of the line — modulo the plugin's own metadata and tags, which
 * Hearth rewrites through the card — must match. */
function samePluginLine(lineText: string, hitText: string): boolean {
	const norm = (v: string): string => stripInlineTags(stripDataviewFields(stripTaskMetadata(v)));
	return norm(lineText) === norm(hitText);
}


/** The vault write behind a toggle/edit: replace `line` in `file` with
 * `nextLines` (one line, or two when completing a recurring task splits it). */
async function replacePluginLines(file: TFile, view: CardHost, line: number, nextLines: string[]): Promise<boolean> {
	try {
		const content = await view.app.vault.read(file);
		const lines = content.split("\n");
		if (line < 0 || line >= lines.length) return false;
		lines.splice(line, 1, ...nextLines);
		await view.app.vault.modify(file, lines.join("\n"));
		return true;
	} catch {
		return false;
	}
}


/**
 * Tick or untick a task exactly the way the Tasks plugin's own toggle command
 * does — recurrence rolls, done dates stamp — so the note keeps the vault's
 * task format. Returns false when the write couldn't be made.
 */
export async function toggleTasksPluginTask(
	view: CardHost,
	file: TFile,
	line: number,
	rawText: string,
): Promise<boolean> {
	const api = tasksPluginApi(view.app);
	if (!api) {
		new Notice(t().notices.tasksPluginCreateFailed);
		return false;
	}
	let current: string;
	try {
		current = (await view.app.vault.read(file)).split("\n")[line] ?? "";
	} catch {
		return false;
	}
	const match = /^\s*[-*+]\s\[(.)\]\s*(.*)$/.exec(current);
	if (!match || !samePluginLine(match[2], rawText)) return false;
	let next: string;
	try {
		next = api.executeToggleTaskDoneCommand(current, file.path);
	} catch {
		new Notice(t().notices.tasksPluginCreateFailed);
		return false;
	}
	if (!next?.trim()) return false;
	return replacePluginLines(
		file,
		view,
		line,
		next.split("\n").map((l) => l.replace(/\s+$/, "")),
	);
}


/**
 * Edit a task in the Tasks plugin's own edit modal (prefilled with the line as
 * it stands), writing the plugin's returned line back verbatim. Returns false
 * when cancelled or when the write couldn't be made.
 */
export async function editTasksPluginTask(
	view: CardHost,
	file: TFile,
	line: number,
	rawText: string,
): Promise<boolean> {
	const api = tasksPluginApi(view.app);
	if (!api) {
		new Notice(t().notices.tasksPluginCreateFailed);
		return false;
	}
	let current: string;
	try {
		current = (await view.app.vault.read(file)).split("\n")[line] ?? "";
	} catch {
		return false;
	}
	const match = /^\s*[-*+]\s\[(.)\]\s*(.*)$/.exec(current);
	if (!match || !samePluginLine(match[2], rawText)) {
		new Notice(t().notices.taskChangedOnDisk);
		return false;
	}
	let next: string;
	try {
		next = await api.editTaskLineModal(current);
	} catch {
		new Notice(t().notices.tasksPluginCreateFailed);
		return false;
	}
	if (!next?.trim()) return false; // cancelled in the modal
	return replacePluginLines(file, view, line, [next.trimEnd()]);
}


/** Delete a task's line (plus any nested continuation lines, so no orphaned
 * description is left behind). Format-agnostic: only lines are removed. */
export async function deleteTasksPluginTask(
	view: CardHost,
	file: TFile,
	line: number,
	rawText: string,
): Promise<boolean> {
	let content: string;
	try {
		content = await view.app.vault.read(file);
	} catch {
		return false;
	}
	const lines = content.split("\n");
	const cur = lines[line];
	const match = cur != null ? /^\s*[-*+]\s\[(.)\]\s*(.*)$/.exec(cur) : null;
	if (!match || !samePluginLine(match[2], rawText)) return false;
	const indent = (/^(\s*)/.exec(cur)?.[1] ?? "").length;
	let end = line + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		// A nested task is a task of its own — stop there rather than
		// swallowing it.
		if (/^\s*[-*+]\s\[(.)\]/.test(l)) break;
		end++;
	}
	let removeEnd = end;
	if (lines[removeEnd]?.trim() === "") removeEnd++;
	lines.splice(line, removeEnd - line);
	try {
		await view.app.vault.modify(file, lines.join("\n"));
		return true;
	} catch {
		return false;
	}
}
