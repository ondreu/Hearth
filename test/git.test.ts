import { describe, expect, it, vi } from "vitest";
import {
	GIT_DEFAULT_ACTIONS,
	GIT_DEFAULT_SECTIONS,
	commitSummary,
	gitActionAvailable,
	gitActionTask,
	gitActions,
	gitChangeCounts,
	gitChangeKind,
	gitChangeRows,
	gitFileName,
	gitSections,
	onlyStagedFor,
	parseCommitDate,
	queueGitAction,
	queueGitFileAction,
	readGitSnapshot,
	shortHash,
	type GitFileStatus,
	type GitPlugin,
	type GitStatus,
} from "../src/git";

/**
 * The Git card is a window onto the obsidian-git plugin, so the logic worth
 * testing here is the part that stands between the two: how obsidian-git's raw
 * status letters become the card's rows, and how carefully the card treats a
 * plugin whose methods it cannot assume exist.
 *
 * Running git itself needs the plugin, which tests don't have; every plugin
 * below is a hand-built stand-in shaped like the real one.
 */

/** One status entry, defaulting to "unchanged" on both sides. */
function file(path: string, index = " ", workingDir = " "): GitFileStatus {
	return { path, vaultPath: path, index, workingDir };
}

/** A status built from its files, with the derived groups obsidian-git fills
 * in — the same rules its two backends use. */
function status(files: GitFileStatus[], conflicted: string[] = []): GitStatus {
	return {
		all: files,
		changed: files.filter((f) => f.workingDir !== " "),
		staged: files.filter((f) => f.index !== " " && f.index !== "U"),
		conflicted,
	};
}

describe("gitChangeKind", () => {
	it("prefers the staged letter, which is what the next commit would carry", () => {
		// Added to the index, then deleted on disk: what is staged is the addition.
		expect(gitChangeKind(file("a.md", "A", "D"), new Set())).toBe("added");
		expect(gitChangeKind(file("b.md", "M", " "), new Set())).toBe("modified");
		expect(gitChangeKind(file("c.md", "R", " "), new Set())).toBe("renamed");
	});

	it("falls back to the working-tree letter for an unstaged change", () => {
		expect(gitChangeKind(file("a.md", " ", "M"), new Set())).toBe("modified");
		expect(gitChangeKind(file("b.md", " ", "D"), new Set())).toBe("deleted");
	});

	it("reads obsidian-git's 'U' as untracked", () => {
		// Both backends rewrite git's "?" to "U" before Hearth ever sees it.
		expect(gitChangeKind(file("new.md", "U", "U"), new Set())).toBe("untracked");
	});

	it("lets the conflicted list win over the letters", () => {
		// An unmerged file also carries "U", so the letters alone cannot tell a
		// conflict from an untracked file — only the conflicted list can.
		const conflict = file("both.md", "U", "U");
		expect(gitChangeKind(conflict, new Set(["both.md"]))).toBe("conflicted");
	});

	it("treats an unknown letter as a modification", () => {
		expect(gitChangeKind(file("x.md", " ", "Z"), new Set())).toBe("modified");
	});
});

describe("gitChangeRows", () => {
	it("lists a file staged and then edited again exactly once", () => {
		// This file is in both status.staged and status.changed; concatenating the
		// two groups (the obvious implementation) would show it twice.
		const rows = gitChangeRows(status([file("note.md", "M", "M")]));
		expect(rows).toHaveLength(1);
		expect(rows[0].staged).toBe(true);
		expect(rows[0].unstaged).toBe(true);
	});

	it("orders conflicts first, then staged, then the rest", () => {
		const rows = gitChangeRows(
			status(
				[
					file("dirty.md", " ", "M"),
					file("staged.md", "A", " "),
					file("clash.md", "U", "U"),
					file("new.md", "U", "U"),
				],
				["clash.md"],
			),
		);
		expect(rows.map((r) => r.path)).toEqual([
			"clash.md",
			"staged.md",
			"dirty.md",
			"new.md",
		]);
	});

	it("keeps git's own ordering within a group", () => {
		const rows = gitChangeRows(
			status([file("b.md", " ", "M"), file("a.md", " ", "M"), file("c.md", " ", "M")]),
		);
		expect(rows.map((r) => r.path)).toEqual(["b.md", "a.md", "c.md"]);
	});

	it("carries the badge letter, the file name and both paths", () => {
		const entry = file("notes/deep/one.md", " ", "D");
		entry.vaultPath = "vault/notes/deep/one.md";
		const [row] = gitChangeRows(status([entry]));
		expect(row).toMatchObject({
			path: "notes/deep/one.md",
			vaultPath: "vault/notes/deep/one.md",
			name: "one.md",
			kind: "deleted",
			letter: "D",
		});
	});

	it("falls back to the repo path when a backend reports no vault path", () => {
		const entry = { ...file("a.md", " ", "M"), vaultPath: "" };
		expect(gitChangeRows(status([entry]))[0].vaultPath).toBe("a.md");
	});

	it("is empty for a missing status rather than throwing", () => {
		expect(gitChangeRows(undefined)).toEqual([]);
	});
});

describe("gitChangeCounts", () => {
	it("counts each file once per group it belongs to", () => {
		const counts = gitChangeCounts(
			status(
				[
					file("staged.md", "M", " "),
					file("both.md", "M", "M"),
					file("dirty.md", " ", "M"),
					file("clash.md", "U", "U"),
				],
				["clash.md"],
			),
		);
		// both.md is staged *and* dirty, so it shows in two counts but once in the
		// total, which counts files rather than changes.
		expect(counts).toEqual({ staged: 2, unstaged: 2, conflicted: 1, total: 4 });
	});

	it("reports nothing for a clean tree", () => {
		expect(gitChangeCounts(status([]))).toEqual({
			staged: 0,
			unstaged: 0,
			conflicted: 0,
			total: 0,
		});
	});
});

describe("onlyStagedFor", () => {
	const staged = status([file("a.md", "M", " ")]);
	const dirty = status([file("a.md", " ", "M")]);

	it("commits only what is staged when something is (smart, the default)", () => {
		expect(onlyStagedFor(undefined, staged)).toBe(true);
		expect(onlyStagedFor("smart", staged)).toBe(true);
	});

	it("commits everything when nothing is staged", () => {
		expect(onlyStagedFor(undefined, dirty)).toBe(false);
		expect(onlyStagedFor("smart", undefined)).toBe(false);
	});

	it("honours the explicit scopes regardless of the status", () => {
		expect(onlyStagedFor("all", staged)).toBe(false);
		expect(onlyStagedFor("staged", dirty)).toBe(true);
	});
});

describe("commit formatting", () => {
	it("takes the first non-empty line as a commit's subject", () => {
		expect(commitSummary("\n\n  vault backup  \n\nlong body here")).toBe("vault backup");
		expect(commitSummary("")).toBe("");
		expect(commitSummary(undefined)).toBe("");
	});

	it("abbreviates a hash like git does", () => {
		expect(shortHash("0123456789abcdef")).toBe("0123456");
		expect(shortHash(undefined)).toBe("");
	});

	it("parses dates from both obsidian-git backends", () => {
		// Desktop (SimpleGit) hands through git's ISO string...
		expect(parseCommitDate("2025-08-04T10:30:00+02:00")).toBe(
			new Date("2025-08-04T10:30:00+02:00").getTime(),
		);
		// ...while mobile (isomorphic-git) formats a Date.toDateString().
		expect(parseCommitDate("Mon Aug 04 2025")).toBe(new Date("Mon Aug 04 2025").getTime());
	});

	it("returns null rather than NaN for something unparseable", () => {
		expect(parseCommitDate("not a date")).toBeNull();
		expect(parseCommitDate(undefined)).toBeNull();
		expect(parseCommitDate("")).toBeNull();
	});
});

describe("gitFileName", () => {
	it("takes the last path segment", () => {
		expect(gitFileName("a/b/c.md")).toBe("c.md");
		expect(gitFileName("c.md")).toBe("c.md");
		expect(gitFileName("")).toBe("");
	});
});

describe("section and action normalization", () => {
	it("uses the defaults when nothing is configured", () => {
		expect(gitSections(undefined)).toEqual([...GIT_DEFAULT_SECTIONS]);
		expect(gitActions(undefined)).toEqual([...GIT_DEFAULT_ACTIONS]);
	});

	it("keeps the configured order and drops duplicates", () => {
		expect(gitActions(["push", "commit", "push"])).toEqual(["push", "commit"]);
		expect(gitSections(["log", "status", "log"])).toEqual(["log", "status"]);
	});

	it("drops ids this build doesn't know", () => {
		// A layout exported by a newer Hearth, or hand-edited.
		expect(gitActions(["push", "teleport"])).toEqual(["push"]);
		expect(gitSections(["changes", "graph"])).toEqual(["changes"]);
	});

	it("respects an explicitly empty list but not an all-junk one", () => {
		// Turning every section off is a real choice; a list where nothing survives
		// validation is a broken import and falls back to the defaults.
		expect(gitSections([])).toEqual([]);
		expect(gitSections(["graph"])).toEqual([...GIT_DEFAULT_SECTIONS]);
		expect(gitActions([])).toEqual([]);
		expect(gitActions(["teleport"])).toEqual([...GIT_DEFAULT_ACTIONS]);
	});
});

/** A plugin stand-in with only the members a test asks for. */
function fakePlugin(overrides: Partial<GitPlugin> = {}): GitPlugin {
	return {
		gitReady: true,
		gitManager: {},
		...overrides,
	};
}

describe("gitActionTask / gitActionAvailable", () => {
	it("refuses an action this obsidian-git build doesn't expose", () => {
		// The whole point of the optional-member typing: a renamed or removed
		// method disables one button instead of throwing on click.
		const bare = fakePlugin();
		expect(gitActionTask(bare, "commit")).toBeNull();
		expect(gitActionAvailable(bare, "push")).toBe(false);
	});

	it("treats the view-opening actions as always available", () => {
		expect(gitActionAvailable(fakePlugin(), "sourceControl")).toBe(true);
		expect(gitActionAvailable(fakePlugin(), "history")).toBe(true);
	});

	it("passes the card's commit options straight through to the plugin", async () => {
		const commit = vi.fn().mockResolvedValue(true);
		const plugin = fakePlugin({ commit });
		await gitActionTask(plugin, "commit", {
			commitMessage: "vault backup",
			onlyStaged: true,
		})?.();
		expect(commit).toHaveBeenCalledWith({
			fromAuto: false,
			requestCustomMessage: undefined,
			commitMessage: "vault backup",
			onlyStaged: true,
		});
	});

	it("marks a card commit as manual, never as an automatic backup", () => {
		// fromAuto/fromAutoBackup change how obsidian-git reports and messages the
		// commit; a button press is a manual one.
		const commitAndSync = vi.fn().mockResolvedValue(undefined);
		void gitActionTask(fakePlugin({ commitAndSync }), "commitAndSync", {})?.();
		expect(commitAndSync).toHaveBeenCalledWith(
			expect.objectContaining({ fromAutoBackup: false }),
		);
	});

	it("hands the cached status to a stage-all so the backend needn't re-read it", async () => {
		const stageAll = vi.fn().mockResolvedValue(undefined);
		const cached = status([file("a.md", " ", "M")]);
		const plugin = fakePlugin({ gitManager: { stageAll }, cachedStatus: cached });
		await gitActionTask(plugin, "stageAll")?.();
		expect(stageAll).toHaveBeenCalledWith({ status: cached });
	});
});

describe("queueGitAction", () => {
	it("goes through obsidian-git's own queue, so it serializes with its backups", () => {
		const addTask = vi.fn();
		const push = vi.fn().mockResolvedValue(true);
		const queued = queueGitAction(
			fakePlugin({ push, promiseQueue: { addTask } }),
			"push",
			{},
		);
		expect(queued).toBe(true);
		expect(addTask).toHaveBeenCalledTimes(1);
		// The task itself is deferred to the queue rather than run here.
		expect(push).not.toHaveBeenCalled();
	});

	it("reports failure for an unsupported action instead of queueing a no-op", () => {
		const addTask = vi.fn();
		expect(
			queueGitAction(fakePlugin({ promiseQueue: { addTask } }), "push", {}),
		).toBe(false);
		expect(addTask).not.toHaveBeenCalled();
	});

	it("still runs when a build has no queue", async () => {
		const push = vi.fn().mockResolvedValue(true);
		expect(queueGitAction(fakePlugin({ push }), "push", {})).toBe(true);
		await vi.waitFor(() => expect(push).toHaveBeenCalled());
	});
});

describe("queueGitFileAction", () => {
	it("stages one file by its repo-relative path", () => {
		const stage = vi.fn().mockResolvedValue(undefined);
		const addTask = vi.fn((task: () => Promise<unknown>) => void task());
		const plugin = fakePlugin({ gitManager: { stage }, promiseQueue: { addTask } });
		expect(queueGitFileAction(plugin, "stage", "notes/a.md")).toBe(true);
		// `false` is "this path is relative to the repo, not the vault" — status
		// paths already are, so no conversion should happen on the way in.
		expect(stage).toHaveBeenCalledWith("notes/a.md", false);
	});

	it("reports failure when the backend can't do it", () => {
		expect(queueGitFileAction(fakePlugin(), "discard", "a.md")).toBe(false);
	});
});

describe("readGitSnapshot", () => {
	it("reads nothing at all before the plugin has a repository", async () => {
		const updateCachedStatus = vi.fn();
		const snapshot = await readGitSnapshot(
			fakePlugin({ gitReady: false, updateCachedStatus }),
		);
		expect(snapshot).toEqual({});
		expect(updateCachedStatus).not.toHaveBeenCalled();
	});

	it("refreshes through the plugin's cache, so its own views update too", async () => {
		const fresh = status([file("a.md", " ", "M")]);
		const updateCachedStatus = vi.fn().mockResolvedValue(fresh);
		const gitStatus = vi.fn();
		const snapshot = await readGitSnapshot(
			fakePlugin({ updateCachedStatus, gitManager: { status: gitStatus } }),
		);
		expect(snapshot.status).toBe(fresh);
		// Never a second `git status` alongside the plugin's own.
		expect(gitStatus).not.toHaveBeenCalled();
	});

	it("falls back to the last cached status when the read fails", async () => {
		const cached = status([file("old.md", " ", "M")]);
		const snapshot = await readGitSnapshot(
			fakePlugin({
				cachedStatus: cached,
				updateCachedStatus: vi.fn().mockRejectedValue(new Error("locked")),
			}),
		);
		expect(snapshot.status).toBe(cached);
	});

	it("survives a repo with no branch, no upstream and no commits", async () => {
		// A freshly initialized repo fails all three of these reads; the card must
		// still get a usable snapshot rather than an exception.
		const snapshot = await readGitSnapshot(
			fakePlugin({
				updateCachedStatus: vi.fn().mockResolvedValue(status([])),
				gitManager: {
					branchInfo: vi.fn().mockRejectedValue(new Error("no HEAD")),
					getUnpushedCommits: vi.fn().mockRejectedValue(new Error("no upstream")),
					getLastCommitTime: vi.fn().mockRejectedValue(new Error("no commits")),
				},
			}),
			{ logLimit: 5 },
		);
		expect(snapshot.status?.all).toEqual([]);
		expect(snapshot.branch).toBeUndefined();
		expect(snapshot.unpushed).toBeUndefined();
		expect(snapshot.lastCommit).toBeUndefined();
	});

	it("only runs git log for a card that shows the log", async () => {
		const log = vi.fn().mockResolvedValue([]);
		const plugin = fakePlugin({
			updateCachedStatus: vi.fn().mockResolvedValue(status([])),
			gitManager: { log },
		});
		await readGitSnapshot(plugin);
		expect(log).not.toHaveBeenCalled();
		await readGitSnapshot(plugin, { logLimit: 3 });
		expect(log).toHaveBeenCalledWith(undefined, false, 3);
	});
});
