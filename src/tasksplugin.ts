import { Notice, TFile, type App } from "obsidian";
import {
	moment,
	createDailyNoteAt,
	dailyNoteFinder,
	dailyNotesOptions,
	type DailyNotesOptions,
} from "./cardbodies";
import { t } from "./i18n";
import type { TasksConfig } from "./types";
import type { HomeView } from "./view";

/**
 * The obsidian-tasks community plugin as a tasks-card source.
 *
 * Unlike the checkbox, TaskNotes and Kanban sources — which Hearth parses
 * itself — this source defers to the Tasks plugin wherever it can:
 *
 *   - what counts as a task (and in which format: the Emoji or Dataview task
 *     format the vault is configured for) is the plugin's own notion, because
 *     the card renders the plugin's own `tasks` query block rather than
 *     re-reading notes;
 *   - ticking and editing happen in the plugin's own rendered rows (its toggle
 *     handling and its edit modal), so Hearth never re-interprets a state,
 *     priority, date, repeat rule, tag or status;
 *   - creating a task opens the plugin's own create modal
 *     (`apiV1.createTaskLineModal`), and the returned line — written by the
 *     plugin, in the vault's configured format — is appended verbatim to the
 *     destination note, never converted.
 *
 * The query building and the API probing are pure, so they are unit-tested;
 * everything touching the vault is async and defensive.
 */


/** Community plugin id for obsidian-tasks. */
export const TASKS_PLUGIN_ID = "obsidian-tasks-plugin";


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
function tasksPlugin(app: App): { apiV1?: unknown } | null {
	try {
		if (!tasksPluginEnabled(app)) return null;
		return (app.plugins.plugins[TASKS_PLUGIN_ID] as { apiV1?: unknown } | undefined) ?? null;
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


// ---- The query ---------------------------------------------------------------

/**
 * Build the `tasks` query block this card renders: the plugin's own filter
 * language, so scope, completion and the cap are the plugin's to apply.
 *
 * Only Hearth controls with a direct Tasks equivalent are translated (folder
 * scope → `path includes`, hidden completed → `not done`, max tasks →
 * `limit`); everything finer-grained is the user's own `tasksQuery` text,
 * appended verbatim. Hearth's own filter/sort dialogs have no equivalent
 * here and are not offered for this source, so they are deliberately not
 * translated.
 */
export function buildTasksPluginQuery(cfg: TasksConfig): string {
	const lines: string[] = [];

	const folders = (cfg.folders ?? []).map((f) => f.trim().replace(/\/+$/, "")).filter(Boolean);
	if ((cfg.folderScope ?? "all") === "whitelist") {
		if (!folders.length) {
			// An empty whitelist matches nothing in Hearth — and must match
			// nothing here too, rather than falling through to the whole vault.
			lines.push("path regex matches /^$/");
		} else if (folders.length === 1) {
			lines.push(`path includes ${folders[0]}`);
		} else {
			// Several `path includes` lines would AND (matching nothing); one
			// function filter ORs them, mirroring `inTaskScope`.
			lines.push(`filter by function ${whitelistPredicate(folders)}`);
		}
	} else if ((cfg.folderScope ?? "all") === "blacklist") {
		// Exclusions AND: a task counts when none of them match.
		for (const folder of folders) lines.push(`path does not include ${folder}`);
	}

	if (cfg.showCompleted !== true) lines.push("not done");

	const count = cfg.count && cfg.count > 0 ? Math.floor(cfg.count) : 10;
	lines.push(`limit ${count}`);

	const extra = (cfg.tasksQuery ?? "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	lines.push(...extra);

	return lines.join("\n");
}


/** A `filter by function` predicate matching Hearth's folder-scope rule for a
 * whitelist: the note is the folder, or lives under it. Quoted safely, since
 * a folder name may hold quotes or backslashes. */
function whitelistPredicate(folders: string[]): string {
	const list = folders.map((f) => JSON.stringify(f)).join(",");
	return `(task) => { const scope = ${list}; const p = task.file.path; return scope.some((f) => p === f || p.startsWith(f + "/")); }`;
}


/** The fenced block the card hands to `MarkdownRenderer.render`, so the Tasks
 * plugin draws its own results. */
export function tasksPluginQueryFence(cfg: TasksConfig): string {
	return `\`\`\`tasks\n${buildTasksPluginQuery(cfg)}\n\`\`\``;
}


// ---- Creating a task ----------------------------------------------------------

/** Where a new Tasks-plugin task goes: today's daily note (created when
 * missing), or one specific note. The default is the daily note. */
export function tasksCreateInDailyNote(cfg: TasksConfig): boolean {
	return (cfg.tasksPluginNote?.trim() ?? "") === "" || cfg.tasksPluginDailyNote === true;
}


/**
 * Resolve the note a newly created task is appended to, creating today's
 * daily note when that is the destination and it doesn't exist yet. Returns
 * null (after telling the user why) when there is nowhere to put it: no note
 * picked and Daily notes off, an unreadable target, or a daily note that
 * couldn't be made.
 */
export async function ensureTasksPluginTarget(view: HomeView, cfg: TasksConfig): Promise<TFile | null> {
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
export async function createTasksPluginTask(view: HomeView, cfg: TasksConfig): Promise<boolean> {
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
