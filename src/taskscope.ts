import { TFile, type TAbstractFile } from "obsidian";
import type { TasksConfig } from "./types";

/**
 * Folder-scope logic for "tasks" cards, split into its own module so the
 * render-time collectors (cards.ts) and the event-time relevance gate
 * (dashboard.ts) provably share one predicate — and so the pure logic is
 * testable without the Obsidian runtime.
 */

/** Whether `path` is in scope per the card's folder whitelist/blacklist. An
 * empty whitelist matches nothing; an empty blacklist excludes nothing. */
export function inTaskScope(path: string, cfg: TasksConfig): boolean {
	const mode = cfg.folderScope ?? "all";
	if (mode === "all") return true;
	const folders = (cfg.folders ?? [])
		.map((f) => f.trim().replace(/\/+$/, ""))
		.filter(Boolean);
	if (folders.length === 0) return mode === "blacklist";
	const matches = folders.some((f) => path === f || path.startsWith(`${f}/`));
	return mode === "whitelist" ? matches : !matches;
}

/**
 * Whether a vault/metadata event can affect what a tasks card renders — the
 * gate that lets a folder-scoped card skip redraws for provably unrelated
 * changes. Deliberately conservative: anything not *provably* irrelevant
 * reports true.
 *
 * - "all" scope (the default) reads the whole vault, so everything is
 *   relevant.
 * - The kanban source is never filtered: an explicit `kanbanFile` may sit
 *   outside the folder scope, and board cards can link to notes anywhere in
 *   the vault whose frontmatter/body feed the rendered metadata.
 * - Folder events always pass: renaming an ancestor of a scoped folder moves
 *   the whole subtree in or out of scope without the folder's own path ever
 *   matching the scope, so a folder change can't be ruled out by path alone.
 * - A file event is irrelevant only when its path and (for renames) its old
 *   path both fall outside the folders the checkbox/tasknotes collectors
 *   read — those collectors touch nothing but in-scope files (content,
 *   frontmatter, stat), so an out-of-scope file cannot change their output.
 */
export function tasksEventRelevant(
	cfg: TasksConfig | undefined,
	file: TAbstractFile,
	oldPath?: string,
): boolean {
	const c = cfg ?? {};
	if ((c.folderScope ?? "all") === "all") return true;
	if ((c.source ?? "checkbox") === "kanban") return true;
	if (!(file instanceof TFile)) return true;
	return inTaskScope(file.path, c) || (oldPath != null && inTaskScope(oldPath, c));
}
