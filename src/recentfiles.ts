import { type App, TFile } from "obsidian";

/**
 * Hearth's own recent-file history (#228).
 *
 * Obsidian's `workspace.getLastOpenFiles()` is documented as returning only the
 * ten most recently opened files, so a Recent files card asking for fifteen
 * could never get more than ten no matter what it did with the answer. Hearth
 * therefore keeps its own history alongside it: every file open appends a path,
 * deduplicated, most-recent-first and capped at {@link RECENT_HISTORY_MAX}.
 *
 * It lives in Obsidian's per-vault local storage rather than in the plugin's
 * settings, for the same reason Obsidian's own list lives in `workspace.json`:
 * which files this machine opened is not a setting, and writing one on every
 * file open would put a stream of sync traffic (and merge conflicts) through
 * `data.json` for something no other device wants.
 *
 * The stored history is a supplement, never the authority. Reads start from
 * Obsidian's list — it also covers opens from before Hearth was installed, and
 * from other plugins' vault windows — and only then append the older tail this
 * module remembers.
 */

/** localStorage key for the path history, per vault. */
const HISTORY_KEY = "hearth:recent-files";

/** How many paths the history keeps, and so the most a Recent files card can
 * ever show. A ceiling, not a target: it bounds both the stored value and the
 * work a "fit to height" card does when the card is tall. */
export const RECENT_HISTORY_MAX = 50;

/** Smallest honourable "Number of files". */
export const RECENT_COUNT_MIN = 1;

/** Default number of files a Recent files card lists. */
export const RECENT_COUNT_DEFAULT = 8;

/**
 * Clamp a configured file count into the range Hearth can actually honour.
 * `undefined` (the field was cleared) falls back to the default rather than to
 * zero, which would render an empty card that looks broken.
 */
export function clampRecentCount(count: number | undefined): number {
	if (count == null || Number.isNaN(count)) return RECENT_COUNT_DEFAULT;
	return Math.min(Math.max(Math.floor(count), RECENT_COUNT_MIN), RECENT_HISTORY_MAX);
}

/**
 * Merge Obsidian's recent-files list with Hearth's stored history, most recent
 * first and with no path twice. Obsidian's list wins on order: it is the live
 * truth for the last ten opens, and the history's own first entries mirror it.
 */
export function mergeRecentPaths(recent: readonly string[], history: readonly string[]): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const path of [...recent, ...history]) {
		if (!path || seen.has(path)) continue;
		seen.add(path);
		merged.push(path);
	}
	return merged;
}

/** Prepend `path`, dropping any earlier occurrence and anything past the cap. */
export function pushRecentPath(history: readonly string[], path: string): string[] {
	return [path, ...history.filter((p) => p !== path)].slice(0, RECENT_HISTORY_MAX);
}

function readHistory(app: App): string[] {
	const raw: unknown = app.loadLocalStorage(HISTORY_KEY);
	return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
}

function writeHistory(app: App, history: string[]): void {
	app.saveLocalStorage(HISTORY_KEY, history);
}

/** Note an opened file. Cheap no-op when it is already the newest entry, so
 * re-focusing the same tab doesn't rewrite the list. */
export function recordRecentFile(app: App, file: TFile | null): void {
	if (!(file instanceof TFile)) return;
	const history = readHistory(app);
	if (history[0] === file.path) return;
	writeHistory(app, pushRecentPath(history, file.path));
}

/** Follow a rename so a moved file keeps its place in the history instead of
 * silently dropping out of it (the path is all that is stored). */
export function renameRecentFile(app: App, oldPath: string, newPath: string): void {
	const history = readHistory(app);
	if (!history.includes(oldPath)) return;
	writeHistory(
		app,
		history.map((p) => (p === oldPath ? newPath : p)),
	);
}

/** Recently opened vault paths, most recent first. Paths only — callers resolve
 * them, so files deleted since are dropped by that lookup. */
export function recentFilePaths(app: App): string[] {
	return mergeRecentPaths(app.workspace.getLastOpenFiles(), readHistory(app));
}

/**
 * How many rows of `rowHeight` (separated by `gap`) fit into `available`
 * pixels. Used by the card's "fit to card height" mode, where the row count
 * follows the card's size instead of a number typed into the editor.
 *
 * Always at least one: a card too short for a single row shows one clipped row
 * rather than an empty body that reads as "no recent files".
 */
export function rowsThatFit(available: number, rowHeight: number, gap: number): number {
	if (!(rowHeight > 0)) return 1;
	// The last row carries no trailing gap, so lend one to the measurement and
	// charge every row for it.
	return Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
}
