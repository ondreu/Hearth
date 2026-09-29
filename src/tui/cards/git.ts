/**
 * The Git card as text: the way `git status` and `git log --oneline` read.
 *
 * A status line (branch, what it tracks, how far ahead, the size of the
 * change), the card's buttons, the changed files with their status letters,
 * and the recent commits. Everything goes through obsidian-git, as on the
 * graphical card (src/git.ts): Space stages or unstages a file, Delete
 * discards it after asking, the menu offers its diff.
 *
 * The repository is read once per draw that didn't come from a read of its
 * own — a read redraws the card, and a redraw that read again would never
 * stop — and the card follows obsidian-git's events the way the graphical
 * card does.
 */
import { Notice, TFile } from "obsidian";
import { moment } from "../../cardbodies";
import {
	commitSummary,
	getGitPlugin,
	GIT_ACTION_DEFS,
	gitActionAvailable,
	gitActions,
	gitChangeCounts,
	gitChangeRows,
	gitSections,
	isGitPluginEnabled,
	onlyStagedFor,
	openGitDiff,
	openGitView,
	parseCommitDate,
	queueGitAction,
	queueGitFileAction,
	readGitSnapshot,
	shortHash,
	type GitAction,
	type GitChangeRow,
	type GitPlugin,
	type GitSnapshot,
} from "../../git";
import { t } from "../../i18n";
import { openFile } from "../../opener";
import { effectiveAutoRefreshMinutes } from "../../types";
import { confirmAction } from "../../ui";
import { hearthMenu } from "../../uidesign";
import type { TuiContext, TuiItem, TuiOutput, TuiRenderer } from "../card";
import { asciify, fit, padEnd, spread, strWidth, type Line, type TuiStyle } from "../text";
import { button, buttonGrid, message, showMenuFor } from "./common";

/** The style of each change's letter. */
const KIND_STYLE: Record<GitChangeRow["kind"], TuiStyle | TuiStyle[]> = {
	conflicted: ["red", "bold"],
	untracked: "dim",
	added: "green",
	modified: "yellow",
	deleted: "red",
	renamed: "cyan",
};

function relativeTime(ms: number): string {
	return (moment(new Date(ms)) as unknown as { fromNow(): string }).fromNow();
}

interface GitState {
	snapshot: GitSnapshot;
	loading: boolean;
	busy: boolean;
	/** Set by a read's own redraw, so that draw doesn't read again. */
	fresh: boolean;
	token: number;
	statusAt: number;
}

function gitState(ctx: TuiContext, plugin: GitPlugin): GitState {
	const cur = ctx.state.git as GitState | undefined;
	if (cur) return cur;
	const fresh: GitState = { snapshot: { status: plugin.cachedStatus }, loading: false, busy: false, fresh: false, token: 0, statusAt: 0 };
	ctx.state.git = fresh;
	return fresh;
}

/** Re-read the repository, then redraw with what was read. */
function read(ctx: TuiContext, plugin: GitPlugin, st: GitState): void {
	const cfg = ctx.card.git ?? {};
	const sections = gitSections(cfg.sections);
	const token = ++st.token;
	st.loading = true;
	void readGitSnapshot(plugin, {
		logLimit: sections.includes("log") ? Math.max(1, cfg.logLimit ?? 5) : 0,
		includeSync: sections.includes("status"),
	}).then((next) => {
		if (token !== st.token) return;
		st.snapshot = next;
		st.loading = false;
		st.fresh = true;
		ctx.redraw();
	});
}

/** Run a button's action, as the graphical card does: views open, the rest
 * go on obsidian-git's queue, a destructive one asks first. */
function runAction(ctx: TuiContext, plugin: GitPlugin, st: GitState, action: GitAction): void {
	const cfg = ctx.card.git ?? {};
	const def = GIT_ACTION_DEFS[action];
	if (def.view) {
		void openGitView(ctx.view.app, def.view);
		return;
	}
	if (st.busy) return;
	const start = () => {
		st.busy = true;
		st.fresh = true;
		ctx.redraw();
		const queued = queueGitAction(
			plugin,
			action,
			{
				commitMessage: cfg.commitMessage?.trim() || undefined,
				requestCustomMessage: cfg.askForMessage,
				onlyStaged: onlyStagedFor(cfg.commitScope, st.snapshot.status),
			},
			() => {
				st.busy = false;
				read(ctx, plugin, st);
			},
		);
		if (!queued) {
			st.busy = false;
			new Notice(t().cards.git.unsupported);
			st.fresh = true;
			ctx.redraw();
		}
	};
	if (def.destructive && !cfg.skipConfirm) {
		confirmAction(ctx.view.app, {
			title: t().cards.git.confirmTitle,
			message: t().cards.git.confirmDiscard,
			confirmText: t().cards.git.confirmDiscardButton,
			onConfirm: start,
		});
		return;
	}
	start();
}

function openChange(ctx: TuiContext, plugin: GitPlugin, row: GitChangeRow, evt?: MouseEvent | KeyboardEvent): void {
	const file = ctx.view.app.vault.getAbstractFileByPath(row.vaultPath);
	if (file instanceof TFile) {
		void openFile(ctx.view, file, "card", evt ?? null);
		return;
	}
	openGitDiff(plugin, row.path, evt instanceof MouseEvent ? evt : undefined);
}

function stageToggle(ctx: TuiContext, plugin: GitPlugin, st: GitState, row: GitChangeRow): void {
	queueGitFileAction(plugin, row.staged && !row.unstaged ? "unstage" : "stage", row.path, () => read(ctx, plugin, st));
}

function discard(ctx: TuiContext, plugin: GitPlugin, st: GitState, row: GitChangeRow): void {
	confirmAction(ctx.view.app, {
		title: t().cards.git.confirmTitle,
		message: t().cards.git.confirmDiscardFile(row.name),
		confirmText: t().cards.git.confirmDiscardButton,
		onConfirm: () => queueGitFileAction(plugin, "discard", row.path, () => read(ctx, plugin, st)),
	});
}

function changeMenu(ctx: TuiContext, plugin: GitPlugin, st: GitState, row: GitChangeRow, evt: MouseEvent | KeyboardEvent): void {
	const strings = t().cards.git;
	const menu = hearthMenu();
	menu.addItem((i) => i.setTitle(t().tui.open).setIcon("file").onClick(() => openChange(ctx, plugin, row)));
	if (plugin.tools?.openDiff) menu.addItem((i) => i.setTitle(strings.openDiff).setIcon("diff").onClick(() => openGitDiff(plugin, row.path)));
	if (row.staged) menu.addItem((i) => i.setTitle(strings.unstageFile).setIcon("minus").onClick(() => queueGitFileAction(plugin, "unstage", row.path, () => read(ctx, plugin, st))));
	if (row.unstaged || !row.staged) menu.addItem((i) => i.setTitle(strings.stageFile).setIcon("plus").onClick(() => queueGitFileAction(plugin, "stage", row.path, () => read(ctx, plugin, st))));
	menu.addSeparator();
	menu.addItem((i) => i.setTitle(strings.discardFile).setIcon("undo").setWarning(true).onClick(() => discard(ctx, plugin, st, row)));
	showMenuFor(menu, evt);
}

/** The status line, as `git branch` marks the current one: `* main → origin/main  ↑2  +1 ~3 !1  · last commit 3 minutes ago`. */
function statusLines(ctx: TuiContext, plugin: GitPlugin, st: GitState): Line[] {
	const strings = t().cards.git;
	const snap = st.snapshot;
	const branch = snap.branch?.current;
	const left: Line = [
		{ text: "* ", style: "accent" },
		{
			text: branch || strings.noBranch,
			style: ["bold", "accent"],
			onClick: branch ? () => runAction(ctx, plugin, st, "switchBranch") : undefined,
			label: strings.actions.switchBranch,
		},
	];
	if (snap.branch?.tracking) left.push({ text: ` → ${snap.branch.tracking}`, style: "dim" });
	const counts = gitChangeCounts(snap.status);
	const chips: Line = [];
	const chip = (n: number, text: string, style: TuiStyle | TuiStyle[], label: string) => {
		if (n <= 0) return;
		chips.push({ text: "  " }, { text: `${text}${n}`, style, label: `${n} ${label}` });
	};
	chip(snap.unpushed ?? 0, "↑", "cyan", strings.unpushed);
	chip(counts.conflicted, "!", ["red", "bold"], strings.conflicted);
	chip(counts.staged, "+", "green", strings.staged);
	chip(counts.unstaged, "~", "yellow", strings.unstaged);
	if (counts.total === 0 && !(snap.unpushed ?? 0)) chips.push({ text: "  " }, { text: strings.clean, style: "green" });
	const refresh: Line = [
		{ text: st.loading || st.busy ? " … " : "[r]", style: "dim", onClick: () => read(ctx, plugin, st), label: strings.refresh },
	];
	const lines: Line[] = [spread([...left, ...chips], refresh, ctx.cols)];
	if (snap.lastCommit) lines.push([{ text: strings.lastCommit(relativeTime(snap.lastCommit)), style: "faint" }]);
	return lines;
}

function gitOutput(ctx: TuiContext, plugin: GitPlugin, st: GitState): TuiOutput {
	const cfg = ctx.card.git ?? {};
	const strings = t().cards.git;
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	if (!plugin.gitReady) {
		const open = () => void openGitView(ctx.view.app, "sourceControl");
		lines.push(...message(t().cards.empty.gitNotReady, ctx.cols), []);
		items.push({ line: lines.length, activate: open });
		lines.push([button(strings.openSourceControl, open)]);
		return { lines, items };
	}
	const w = ctx.cols;
	for (const section of gitSections(cfg.sections)) {
		if (lines.length) lines.push([]);
		switch (section) {
			case "status":
				lines.push(...statusLines(ctx, plugin, st));
				break;
			case "actions": {
				const actions = gitActions(cfg.actions).filter((a) => gitActionAvailable(plugin, a));
				const grid = buttonGrid(
					ctx,
					actions.map((a) => ({
						label: strings.actions[a],
						style: st.busy ? "faint" : GIT_ACTION_DEFS[a].destructive ? "red" : "accent",
						activate: () => runAction(ctx, plugin, st, a),
					})),
					{ startLine: lines.length, startItem: items.length },
				);
				lines.push(...grid.lines);
				items.push(...grid.items);
				break;
			}
			case "changes": {
				const rows = gitChangeRows(st.snapshot.status);
				if (!rows.length) {
					lines.push([{ text: strings.noChanges, style: "dim" }]);
					break;
				}
				const limit = ctx.zoomed ? 0 : cfg.changeLimit ?? 8;
				const shown = limit > 0 ? rows.slice(0, limit) : rows;
				for (const row of shown) {
					// `XY name  folder`, the way `git status --short` prints it:
					// the index's letter, then the working tree's.
					const folder = row.path.includes("/") ? row.path.slice(0, row.path.lastIndexOf("/")) : "";
					const left: Line = [
						{ text: row.staged ? row.letter : " ", style: row.staged ? "green" : undefined },
						{ text: row.unstaged || !row.staged ? row.letter : " ", style: KIND_STYLE[row.kind] },
						{ text: " " },
						{ text: asciify(row.name), style: row.kind === "deleted" ? ["dim", "strike"] : undefined },
					];
					const right: Line = cfg.showPaths === true && folder && w > strWidth(row.name) + strWidth(folder) + 8 ? [{ text: ` ${asciify(folder)}`, style: "faint" }] : [];
					items.push({
						line: lines.length,
						activate: (evt) => openChange(ctx, plugin, row, evt),
						toggle: () => stageToggle(ctx, plugin, st, row),
						remove: () => discard(ctx, plugin, st, row),
						menu: (evt) => changeMenu(ctx, plugin, st, row, evt),
					});
					lines.push(spread(left, right, w));
				}
				if (rows.length > shown.length) {
					const open = () => void openGitView(ctx.view.app, "sourceControl");
					items.push({ line: lines.length, activate: open });
					lines.push([{ text: strings.more(rows.length - shown.length), style: "dim", onClick: open }]);
				}
				break;
			}
			case "log": {
				const entries = (st.snapshot.log ?? []).slice(0, ctx.zoomed ? 50 : Math.max(1, cfg.logLimit ?? 5));
				if (!entries.length) {
					lines.push([{ text: strings.noCommits, style: "dim" }]);
					break;
				}
				for (const entry of entries) {
					const when = parseCommitDate(entry.date);
					const meta = [entry.author?.name, when ? relativeTime(when) : ""].filter(Boolean).join(" · ");
					const open = () => void openGitView(ctx.view.app, "history");
					items.push({ line: lines.length, activate: open });
					lines.push(
						spread(
							[
								{ text: padEnd(shortHash(entry.hash), 8), style: "yellow" },
								{ text: asciify(commitSummary(entry.message) || strings.noMessage) },
							],
							meta && w >= 50 ? [{ text: `  ${meta}`, style: "faint" }] : [],
							w,
						),
					);
				}
				break;
			}
		}
	}
	return { lines: lines.map((l) => fit(l, w)), items, foot: t().tui.cards.gitFoot, hint: st.busy ? t().tui.cards.loading : undefined };
}

export const gitTui: TuiRenderer = {
	render(ctx) {
		const plugin = getGitPlugin(ctx.view.app);
		if (!plugin) {
			if (!isGitPluginEnabled(ctx.view.app)) return { lines: message(t().cards.empty.gitEnable, ctx.cols) };
			// obsidian-git is starting: look again shortly.
			ctx.component.registerInterval(window.setInterval(() => ctx.redraw(), 500));
			return { lines: message(t().cards.empty.gitNotReady, ctx.cols) };
		}
		const st = gitState(ctx, plugin);
		if (!st.fresh) read(ctx, plugin, st);
		st.fresh = false;

		const { workspace } = ctx.view.app;
		ctx.component.registerEvent(
			workspace.on("obsidian-git:status-changed", (status) => {
				st.statusAt = Date.now();
				st.snapshot = { ...st.snapshot, status };
				st.fresh = true;
				ctx.redraw();
			}),
		);
		ctx.component.registerEvent(
			workspace.on("obsidian-git:refreshed", () => {
				if (st.busy || Date.now() - st.statusAt < 2000) return;
				read(ctx, plugin, st);
			}),
		);
		ctx.component.registerEvent(workspace.on("obsidian-git:head-change", () => read(ctx, plugin, st)));
		const refreshMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, ctx.card.git?.refreshMin ?? 0);
		if (refreshMin > 0) ctx.component.registerInterval(window.setInterval(() => !st.busy && read(ctx, plugin, st), refreshMin * 60_000));
		return gitOutput(ctx, plugin, st);
	},
	key(ctx, evt) {
		if (evt.key !== "r" || evt.ctrlKey || evt.metaKey) return false;
		const plugin = getGitPlugin(ctx.view.app);
		if (!plugin) return false;
		read(ctx, plugin, gitState(ctx, plugin));
		return true;
	},
	menu(ctx, menu) {
		menu.addItem((i) => i.setTitle(t().cards.git.openSourceControl).setIcon("git-pull-request").onClick(() => void openGitView(ctx.view.app, "sourceControl")));
		menu.addItem((i) => i.setTitle(t().cards.git.openHistory).setIcon("history").onClick(() => void openGitView(ctx.view.app, "history")));
	},
};
