/**
 * The Git integration: everything Hearth knows about the
 * [obsidian-git](https://github.com/Vinzent03/obsidian-git) community plugin.
 *
 * The rule here is the same one the Dataview, Datacore and Omnisearch modules
 * follow: **Hearth never does the work itself.** It does not shell out to
 * `git`, it does not bundle a git implementation, and it does not read
 * `.git/`. Every operation the card offers is a call into the running
 * obsidian-git plugin instance, so whichever backend the user has configured
 * (`SimpleGit` on desktop, `isomorphic-git` on mobile), whichever remote,
 * credentials, commit-message template, submodule and line-author settings they
 * have — all of it applies exactly as it does everywhere else in that plugin.
 * The card is a window onto obsidian-git, not a second implementation of it.
 *
 * Two consequences shape this file:
 *
 * 1. **Everything is optional.** obsidian-git exposes no versioned `api`
 *    object the way Omnisearch and Datacore do; what Hearth calls are the
 *    plugin instance's own public members. They are stable in practice (its
 *    own commands and views call the same ones) but they are not a contract,
 *    so every member is declared optional and every call site checks for the
 *    function before using it. A build of obsidian-git that renamed something
 *    disables one button; it never throws inside a dashboard render.
 * 2. **Writes go through obsidian-git's own queue.** The plugin serializes
 *    every repo-touching operation on `promiseQueue` so an automatic backup
 *    can't interleave with a manual commit. Hearth pushes its actions onto the
 *    same queue rather than calling the methods directly, which is why a card
 *    button behaves identically to the matching command in the palette —
 *    including its error reporting, which `promiseQueue` routes to the
 *    plugin's own `displayError`.
 *
 * The pure helpers at the bottom (status classification, commit formatting)
 * carry no Obsidian dependency and are unit-tested in `test/git.test.ts`.
 */
import type { App } from "obsidian";

/** The community-plugin id obsidian-git registers itself under. */
export const GIT_PLUGIN_ID = "obsidian-git";

/** obsidian-git's source-control view type (its "Source control" side panel). */
export const GIT_SOURCE_CONTROL_VIEW = "git-view";

/** obsidian-git's history view type (its commit log side panel). */
export const GIT_HISTORY_VIEW = "git-history-view";

/*
 * The workspace events obsidian-git fires (typed for listening in
 * `src/obsidian-ext.d.ts`). Hearth follows them rather than polling: the plugin
 * already watches the vault, runs the automatic-backup timer and refreshes
 * after every operation of its own, so listening keeps a card in step with its
 * source-control view for free.
 *
 * - `obsidian-git:refresh` — *ask* the plugin to refresh (Hearth triggers this
 *   one when revealing a view, exactly as its own commands do).
 * - `obsidian-git:refreshed` — the plugin finished a refresh cycle.
 * - `obsidian-git:status-changed` — a fresh Status was computed; the status is
 *   the event's payload, so a listener needs no read of its own.
 * - `obsidian-git:head-change` — HEAD moved (commit, checkout, pull), which
 *   invalidates the branch, the ahead count and the log.
 * - `obsidian-git:loading-status` — a status read started.
 */


// ---- The slice of obsidian-git Hearth talks to --------------------------

/** One entry of obsidian-git's status: a file with its index (staged) and
 * working-directory state as single letters. `path` is relative to the repo
 * root, `vaultPath` to the vault root — they differ when the repo sits above
 * the vault. */
export interface GitFileStatus {
	path: string;
	vaultPath: string;
	/** Original path of a rename, when the backend reports one. */
	from?: string;
	/** Index state: " " unchanged, "M", "A", "D", "R", or "U" for untracked. */
	index: string;
	/** Working-directory state, same letters. */
	workingDir: string;
}

/** obsidian-git's status snapshot. `conflicted` is only populated by the
 * desktop (SimpleGit) backend; the mobile one always reports none. */
export interface GitStatus {
	all: GitFileStatus[];
	changed: GitFileStatus[];
	staged: GitFileStatus[];
	conflicted: string[];
}

/** The current branch and what it tracks. */
export interface GitBranchInfo {
	current?: string;
	tracking?: string;
	branches: string[];
}

/** One commit from obsidian-git's log. */
export interface GitLogEntry {
	hash: string;
	/** ISO-ish on desktop, a `Date.toDateString()` on mobile — parse leniently
	 * with {@link parseCommitDate}. */
	date: string;
	message: string;
	refs: string[];
	author: { name: string; email: string };
}

/** The read side of obsidian-git's git backend. Every member is optional: a
 * given backend or plugin version may not have it, and the card degrades
 * rather than throwing. */
interface GitManagerLike {
	status?(opts?: { path?: string }): Promise<GitStatus>;
	branchInfo?(): Promise<GitBranchInfo>;
	getUnpushedCommits?(): Promise<number>;
	log?(
		file: string | undefined,
		relativeToVault?: boolean,
		limit?: number,
		ref?: string,
	): Promise<GitLogEntry[]>;
	stageAll?(opts: { dir?: string; status?: GitStatus }): Promise<void>;
	unstageAll?(opts: { dir?: string; status?: GitStatus }): Promise<void>;
	stage?(filepath: string, relativeToVault: boolean): Promise<void>;
	unstage?(filepath: string, relativeToVault: boolean): Promise<void>;
	discard?(filepath: string): Promise<void>;
	getLastCommitTime?(): Promise<Date | undefined>;
}

/**
 * The obsidian-git plugin instance, as far as Hearth is concerned. Reachable
 * at `app.plugins.plugins["obsidian-git"]` once the plugin is enabled.
 *
 * Only `gitReady` and `gitManager` are required to consider the plugin usable
 * — everything else is probed per call.
 */
export interface GitPlugin {
	/** False until the plugin has found and opened a repository. */
	gitReady: boolean;
	/** The last status the plugin computed, if any. */
	cachedStatus?: GitStatus;
	gitManager: GitManagerLike;
	/** obsidian-git's serial task queue; see the file header. */
	promiseQueue?: {
		addTask<T>(task: () => Promise<T>, onFinished?: (res: T | undefined) => void): void;
	};
	tools?: {
		/** Open obsidian-git's own diff view for a repo-relative path. `aRef`
		 * empty means "the working tree against HEAD". */
		openDiff(opts: {
			aFile: string;
			bFile?: string;
			aRef: string;
			bRef?: string;
			event?: MouseEvent;
		}): void;
	};
	/** Recompute the status and fire `obsidian-git:status-changed`. */
	updateCachedStatus?(): Promise<GitStatus>;
	commit?(opts: {
		fromAuto: boolean;
		requestCustomMessage?: boolean;
		onlyStaged?: boolean;
		commitMessage?: string;
		amend?: boolean;
	}): Promise<boolean>;
	commitAndSync?(opts: {
		fromAutoBackup: boolean;
		requestCustomMessage?: boolean;
		commitMessage?: string;
		onlyStaged?: boolean;
	}): Promise<void>;
	push?(): Promise<boolean>;
	pullChangesFromRemote?(): Promise<void>;
	fetch?(): Promise<void>;
	discardAll?(path?: string): Promise<unknown>;
	switchBranch?(): Promise<string | undefined>;
	displayError?(data: unknown, timeout?: number): void;
}

/**
 * Reach the obsidian-git plugin instance, or null when it isn't installed,
 * isn't enabled, or is too old to look like the plugin Hearth knows.
 *
 * Note this returns the plugin even when `gitReady` is false — "the plugin is
 * there but has no repository yet" is a state the card reports rather than one
 * it hides, since it usually means the repo is still being found on startup.
 */
export function getGitPlugin(app: App): GitPlugin | null {
	const plugin = app.plugins.plugins[GIT_PLUGIN_ID] as
		| { gitManager?: unknown; gitReady?: unknown }
		| undefined;
	if (!plugin) return null;
	if (typeof plugin.gitReady !== "boolean") return null;
	if (!plugin.gitManager || typeof plugin.gitManager !== "object") return null;
	return plugin as GitPlugin;
}

/** Whether obsidian-git is enabled and reachable right now. Used to gate the
 * Git card in the "Add card" picker. */
export function isGitAvailable(app: App): boolean {
	return getGitPlugin(app) !== null;
}


// ---- Card configuration vocabulary --------------------------------------

/** A stacked section of the Git card, in the order they are drawn. */
export type GitSection = "status" | "actions" | "changes" | "log";

/** Every section, in the order the editor lists them. Doubles as the
 * allow-list an imported layout is validated against. */
export const GIT_SECTIONS: readonly GitSection[] = ["status", "actions", "changes", "log"];

/** The sections a fresh card shows: the state of the repo, the buttons, and
 * what's currently changed. The log is opt-in — it costs an extra `git log`
 * per refresh and most dashboards want "is my vault saved?", not history. */
export const GIT_DEFAULT_SECTIONS: readonly GitSection[] = ["status", "actions", "changes"];

/** One button the Git card can offer. Each maps to a single obsidian-git
 * entry point — see {@link gitActionTask} and {@link openGitView}. */
export type GitAction =
	| "commitAndSync"
	| "commit"
	| "push"
	| "pull"
	| "fetch"
	| "stageAll"
	| "unstageAll"
	| "discardAll"
	| "switchBranch"
	| "sourceControl"
	| "history";

/** Every action, in the order the editor lists them. */
export const GIT_ACTIONS: readonly GitAction[] = [
	"commitAndSync",
	"commit",
	"push",
	"pull",
	"fetch",
	"stageAll",
	"unstageAll",
	"discardAll",
	"switchBranch",
	"sourceControl",
	"history",
];

/** The buttons a fresh card offers: the one-click "save my vault" action, plus
 * the three halves of it for anyone who wants the steps apart. Staging,
 * discarding and branch switching are opt-in — they are either destructive or
 * better served by obsidian-git's own source-control view. */
export const GIT_DEFAULT_ACTIONS: readonly GitAction[] = [
	"commitAndSync",
	"commit",
	"push",
	"pull",
];

/** Which files a commit from this card includes.
 *
 * - `smart` — staged files only if anything is staged, otherwise everything.
 *   This is what obsidian-git's own "Commit" command does, and it is the
 *   default here for the same reason: it does what you meant.
 * - `all` — always commit every change, staged or not.
 * - `staged` — only ever commit what is staged. */
export type GitCommitScope = "smart" | "all" | "staged";

/** Every commit scope, in editor order. */
export const GIT_COMMIT_SCOPES: readonly GitCommitScope[] = ["smart", "all", "staged"];

/** How the action buttons are drawn. */
export type GitActionStyle = "icon" | "labelled";

/** Every button style, in editor order. */
export const GIT_ACTION_STYLES: readonly GitActionStyle[] = ["icon", "labelled"];

/** How an action is dispatched and drawn. */
interface GitActionDef {
	/** Lucide icon id. Chosen from the set obsidian-git's own UI uses, so they
	 * read as the same vocabulary. */
	icon: string;
	/** Opens one of obsidian-git's views instead of touching the repo — never
	 * queued, never confirmed. */
	view?: "sourceControl" | "history";
	/** Irreversible: the card asks before running it. */
	destructive?: boolean;
}

/** The static description of every action. */
export const GIT_ACTION_DEFS: Record<GitAction, GitActionDef> = {
	commitAndSync: { icon: "arrow-up-circle" },
	commit: { icon: "check" },
	push: { icon: "upload" },
	pull: { icon: "download" },
	fetch: { icon: "refresh-cw" },
	stageAll: { icon: "plus" },
	unstageAll: { icon: "minus" },
	discardAll: { icon: "undo", destructive: true },
	switchBranch: { icon: "git-branch" },
	sourceControl: { icon: "git-pull-request", view: "sourceControl" },
	history: { icon: "history", view: "history" },
};


// ---- Running actions ----------------------------------------------------

/** What a commit from this card should say and cover. */
export interface GitCommitOptions {
	/** The message to commit with. Undefined hands the decision back to
	 * obsidian-git, which applies its own commit-message template (date
	 * placeholders, changed-file counts and all). */
	commitMessage?: string;
	/** Let obsidian-git prompt for a message, exactly as its "…with specific
	 * message" commands do. Wins over `commitMessage`. */
	requestCustomMessage?: boolean;
	/** Commit only what is staged. Resolved from the card's scope by
	 * {@link onlyStagedFor}. */
	onlyStaged?: boolean;
}

/**
 * Build the thunk that performs `action`, or null when this obsidian-git build
 * doesn't expose what it needs — which is how the card knows to disable the
 * button rather than fail on click.
 *
 * View-opening actions return null here on purpose: they aren't repo work and
 * are handled by {@link openGitView}.
 */
export function gitActionTask(
	plugin: GitPlugin,
	action: GitAction,
	opts: GitCommitOptions = {},
): (() => Promise<void>) | null {
	const manager = plugin.gitManager;
	switch (action) {
		case "commitAndSync":
			if (typeof plugin.commitAndSync !== "function") return null;
			return async () => {
				await plugin.commitAndSync?.({
					fromAutoBackup: false,
					requestCustomMessage: opts.requestCustomMessage,
					commitMessage: opts.commitMessage,
					onlyStaged: opts.onlyStaged,
				});
			};
		case "commit":
			if (typeof plugin.commit !== "function") return null;
			return async () => {
				await plugin.commit?.({
					fromAuto: false,
					requestCustomMessage: opts.requestCustomMessage,
					commitMessage: opts.commitMessage,
					onlyStaged: opts.onlyStaged,
				});
			};
		case "push":
			if (typeof plugin.push !== "function") return null;
			return async () => {
				await plugin.push?.();
			};
		case "pull":
			if (typeof plugin.pullChangesFromRemote !== "function") return null;
			return async () => {
				await plugin.pullChangesFromRemote?.();
			};
		case "fetch":
			if (typeof plugin.fetch !== "function") return null;
			return async () => {
				await plugin.fetch?.();
			};
		case "stageAll":
			if (typeof manager.stageAll !== "function") return null;
			return async () => {
				await manager.stageAll?.({ status: plugin.cachedStatus });
			};
		case "unstageAll":
			if (typeof manager.unstageAll !== "function") return null;
			return async () => {
				await manager.unstageAll?.({ status: plugin.cachedStatus });
			};
		case "discardAll":
			if (typeof plugin.discardAll !== "function") return null;
			return async () => {
				await plugin.discardAll?.();
			};
		case "switchBranch":
			if (typeof plugin.switchBranch !== "function") return null;
			return async () => {
				await plugin.switchBranch?.();
			};
		default:
			return null;
	}
}

/** Whether `action` can run against the plugin as it is right now. Drives the
 * disabled state of the card's buttons. */
export function gitActionAvailable(plugin: GitPlugin, action: GitAction): boolean {
	if (GIT_ACTION_DEFS[action]?.view) return true;
	return gitActionTask(plugin, action) !== null;
}

/**
 * Queue `action` on obsidian-git's own task queue and call `onFinished` when it
 * settles (successfully or not — the queue reports failures through the
 * plugin's error handling, which is where a user expects to see them).
 *
 * Returns false when the action isn't available, so a caller can leave the UI
 * untouched instead of showing a spinner that never ends.
 */
export function queueGitAction(
	plugin: GitPlugin,
	action: GitAction,
	opts: GitCommitOptions,
	onFinished?: () => void,
): boolean {
	const task = gitActionTask(plugin, action, opts);
	if (!task) return false;
	const queue = plugin.promiseQueue;
	if (queue && typeof queue.addTask === "function") {
		queue.addTask(task, () => onFinished?.());
		return true;
	}
	// No queue on this build: still run the action, just unserialized.
	task()
		.catch((err: unknown) => plugin.displayError?.(err))
		.finally(() => onFinished?.());
	return true;
}

/**
 * Reveal one of obsidian-git's side-panel views, reusing an open one if there
 * is one — the same sequence its own "Open source control view" command runs,
 * including the closing refresh so an already-open panel updates too.
 */
export async function openGitView(
	app: App,
	which: "sourceControl" | "history",
): Promise<void> {
	const type = which === "history" ? GIT_HISTORY_VIEW : GIT_SOURCE_CONTROL_VIEW;
	const open = app.workspace.getLeavesOfType(type);
	const leaf = open[0] ?? app.workspace.getRightLeaf(false);
	if (!leaf) return;
	if (open.length === 0) await leaf.setViewState({ type, active: true });
	await app.workspace.revealLeaf(leaf);
	app.workspace.trigger("obsidian-git:refresh");
}

/** Open obsidian-git's diff view for one repo-relative path, comparing the
 * working tree against HEAD. No-op on a build without `tools.openDiff`. */
export function openGitDiff(plugin: GitPlugin, path: string, event?: MouseEvent): void {
	plugin.tools?.openDiff({ aFile: path, aRef: "", event });
}

/** Stage or unstage a single file through the plugin's queue. Returns false
 * when this build can't (the caller then hides the menu item). */
export function queueGitFileAction(
	plugin: GitPlugin,
	action: "stage" | "unstage" | "discard",
	path: string,
	onFinished?: () => void,
): boolean {
	const manager = plugin.gitManager;
	// Checked in place rather than by pulling the method off the manager: these
	// are bound methods on obsidian-git's own object, and detaching one to probe
	// it loses that binding.
	const supported =
		action === "stage"
			? typeof manager.stage === "function"
			: action === "unstage"
				? typeof manager.unstage === "function"
				: typeof manager.discard === "function";
	if (!supported) return false;
	const task = async (): Promise<void> => {
		// Paths come straight from the status, so they are repo-relative.
		if (action === "discard") await manager.discard?.(path);
		else if (action === "stage") await manager.stage?.(path, false);
		else await manager.unstage?.(path, false);
	};
	const queue = plugin.promiseQueue;
	if (queue && typeof queue.addTask === "function") {
		queue.addTask(task, () => onFinished?.());
		return true;
	}
	task()
		.catch((err: unknown) => plugin.displayError?.(err))
		.finally(() => onFinished?.());
	return true;
}


// ---- Reading the repo ---------------------------------------------------

/** Everything the card draws in one round. Each field is independently
 * optional: one failing read (an old backend without `getUnpushedCommits`, a
 * repo with no upstream) must not blank the rest of the card. */
export interface GitSnapshot {
	status?: GitStatus;
	branch?: GitBranchInfo;
	/** Commits on the local branch that the remote doesn't have. */
	unpushed?: number;
	log?: GitLogEntry[];
	lastCommit?: number;
}

/** What a snapshot read should include, so a card that shows no log never
 * pays for `git log`. */
export interface GitSnapshotOptions {
	/** Read the commit log, at most this many entries. */
	logLimit?: number;
	/** Read the ahead-count and the last commit time. */
	includeSync?: boolean;
}

/**
 * Read the repo through obsidian-git.
 *
 * The status goes through `updateCachedStatus()` rather than
 * `gitManager.status()` so the plugin's own cache — and every other listener,
 * including its source-control view and status bar — is updated by the same
 * read, instead of Hearth running a second `git status` alongside it.
 *
 * Every individual read is caught: the result is "what could be read", and the
 * card shows what it got.
 */
export async function readGitSnapshot(
	plugin: GitPlugin,
	opts: GitSnapshotOptions = {},
): Promise<GitSnapshot> {
	const snapshot: GitSnapshot = {};
	if (!plugin.gitReady) return snapshot;
	const manager = plugin.gitManager;

	if (typeof plugin.updateCachedStatus === "function") {
		try {
			snapshot.status = await plugin.updateCachedStatus();
		} catch {
			snapshot.status = plugin.cachedStatus;
		}
	} else if (typeof manager.status === "function") {
		try {
			snapshot.status = await manager.status();
		} catch {
			snapshot.status = plugin.cachedStatus;
		}
	} else {
		snapshot.status = plugin.cachedStatus;
	}

	if (typeof manager.branchInfo === "function") {
		try {
			snapshot.branch = await manager.branchInfo();
		} catch {
			// A repo with no commits yet has no branch to report.
		}
	}

	if (opts.includeSync !== false && typeof manager.getUnpushedCommits === "function") {
		try {
			snapshot.unpushed = await manager.getUnpushedCommits();
		} catch {
			// No upstream configured: there is nothing to be ahead of.
		}
	}

	if (opts.includeSync !== false && typeof manager.getLastCommitTime === "function") {
		try {
			snapshot.lastCommit = (await manager.getLastCommitTime())?.getTime();
		} catch {
			// Empty repo.
		}
	}

	const limit = opts.logLimit ?? 0;
	if (limit > 0 && typeof manager.log === "function") {
		try {
			snapshot.log = await manager.log(undefined, false, limit);
		} catch {
			// Empty repo, or a backend that can't log without a file.
		}
	}

	return snapshot;
}


// ---- Pure helpers (unit-tested) -----------------------------------------

/** What happened to a file, as the card labels it. */
export type GitChangeKind =
	| "conflicted"
	| "untracked"
	| "added"
	| "modified"
	| "deleted"
	| "renamed";

/** One row of the card's changed-files list. */
export interface GitChangeRow {
	/** Repo-relative path — what obsidian-git's own APIs take. */
	path: string;
	/** Vault-relative path, for opening the note in Obsidian. */
	vaultPath: string;
	/** File name, for the row's label. */
	name: string;
	kind: GitChangeKind;
	/** Single-letter badge: U, A, M, D, R, or ! for a conflict. */
	letter: string;
	/** The index has changes for this file. */
	staged: boolean;
	/** The working tree has changes the index doesn't. */
	unstaged: boolean;
}

/** The badge letter for each kind. */
const KIND_LETTERS: Record<GitChangeKind, string> = {
	conflicted: "!",
	untracked: "U",
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
};

/** Classify one status letter. `" "` and anything unrecognized read as a
 * modification, which is what git means by an unlabelled change. */
function kindForLetter(letter: string): GitChangeKind {
	switch (letter) {
		case "U":
			return "untracked";
		case "A":
			return "added";
		case "D":
			return "deleted";
		case "R":
			return "renamed";
		default:
			return "modified";
	}
}

/**
 * Classify one file from a status.
 *
 * A conflict wins over everything: obsidian-git reports an unmerged file with
 * the same `"U"` it uses for untracked ones, so the conflicted list — not the
 * letters — is what tells them apart.
 *
 * Otherwise the *staged* letter is preferred when there is one, because that is
 * the change that would go into the next commit; the working-tree letter is the
 * fallback for a file that is only changed on disk.
 */
export function gitChangeKind(file: GitFileStatus, conflicted: ReadonlySet<string>): GitChangeKind {
	if (conflicted.has(file.path)) return "conflicted";
	const staged = file.index !== " " && file.index !== "U" ? file.index : "";
	if (staged) return kindForLetter(staged);
	return kindForLetter(file.workingDir);
}

/** The last path segment of a repo path, for a readable row label. */
export function gitFileName(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] || path;
}

/**
 * Turn a status into the card's rows: conflicts first, then staged changes,
 * then everything else, each group keeping git's own ordering.
 *
 * Built from `status.all` rather than by concatenating `staged` and `changed`,
 * which overlap — a file edited, staged, then edited again appears in both, and
 * that must be one row flagged as both, not two rows.
 */
export function gitChangeRows(status: GitStatus | undefined): GitChangeRow[] {
	if (!status) return [];
	const conflicted = new Set(status.conflicted ?? []);
	const rows: GitChangeRow[] = (status.all ?? []).map((file) => {
		const kind = gitChangeKind(file, conflicted);
		return {
			path: file.path,
			vaultPath: file.vaultPath || file.path,
			name: gitFileName(file.path),
			kind,
			letter: KIND_LETTERS[kind],
			staged: file.index !== " " && file.index !== "U",
			unstaged: file.workingDir !== " ",
		};
	});
	const rank = (row: GitChangeRow): number =>
		row.kind === "conflicted" ? 0 : row.staged ? 1 : 2;
	// Stable sort: rows within a group keep the order git listed them in.
	return rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
		.map((entry) => entry.row);
}

/** The headline numbers of a status: how many files are staged, how many are
 * only changed on disk, and how many are conflicted. */
export interface GitChangeCounts {
	staged: number;
	unstaged: number;
	conflicted: number;
	total: number;
}

/** Count a status by group. `total` counts files, not changes, so a file that
 * is both staged and dirty counts once. */
export function gitChangeCounts(status: GitStatus | undefined): GitChangeCounts {
	const rows = gitChangeRows(status);
	let staged = 0;
	let unstaged = 0;
	let conflicted = 0;
	for (const row of rows) {
		if (row.kind === "conflicted") conflicted++;
		else if (row.staged) staged++;
		if (row.unstaged && row.kind !== "conflicted") unstaged++;
	}
	return { staged, unstaged, conflicted, total: rows.length };
}

/** Resolve a card's commit scope against the status at the moment of the
 * click. `smart` mirrors obsidian-git's own "Commit" command: staged files if
 * anything is staged, everything otherwise. */
export function onlyStagedFor(
	scope: GitCommitScope | undefined,
	status: GitStatus | undefined,
): boolean {
	if (scope === "all") return false;
	if (scope === "staged") return true;
	return (status?.staged?.length ?? 0) > 0;
}

/**
 * Parse a commit date from either backend.
 *
 * The desktop backend hands through git's own ISO-8601 string; the mobile one
 * formats a `Date.toDateString()` ("Mon Aug 04 2025"). Both parse with the
 * platform `Date`, so this is really about returning null instead of `NaN` for
 * the third case: a backend that returned something else entirely.
 */
export function parseCommitDate(raw: string | undefined): number | null {
	if (!raw) return null;
	const ms = new Date(raw).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/** The abbreviated commit hash git itself shows. */
export function shortHash(hash: string | undefined, length = 7): string {
	return (hash ?? "").slice(0, length);
}

/** A commit's subject: its first non-empty line, whitespace-trimmed. Commit
 * bodies are frequently several paragraphs, and a row shows one line. */
export function commitSummary(message: string | undefined): string {
	if (!message) return "";
	for (const line of message.split("\n")) {
		const trimmed = line.trim();
		if (trimmed) return trimmed;
	}
	return "";
}

/** Normalize a persisted section list: known ids only, no duplicates, and the
 * defaults when nothing usable survives. Shared by the card and the layout
 * importer so a hand-edited layout can't produce an empty card. */
export function gitSections(raw: readonly string[] | undefined): GitSection[] {
	if (!raw) return [...GIT_DEFAULT_SECTIONS];
	const seen = new Set<string>();
	const out: GitSection[] = [];
	for (const id of raw) {
		if (!GIT_SECTIONS.includes(id as GitSection) || seen.has(id)) continue;
		seen.add(id);
		out.push(id as GitSection);
	}
	// An explicitly empty list is a real choice (a card that is only a title);
	// only a list with nothing recognizable falls back to the defaults.
	return raw.length > 0 && out.length === 0 ? [...GIT_DEFAULT_SECTIONS] : out;
}

/** The same for the action list. */
export function gitActions(raw: readonly string[] | undefined): GitAction[] {
	if (!raw) return [...GIT_DEFAULT_ACTIONS];
	const seen = new Set<string>();
	const out: GitAction[] = [];
	for (const id of raw) {
		if (!GIT_ACTIONS.includes(id as GitAction) || seen.has(id)) continue;
		seen.add(id);
		out.push(id as GitAction);
	}
	return raw.length > 0 && out.length === 0 ? [...GIT_DEFAULT_ACTIONS] : out;
}
