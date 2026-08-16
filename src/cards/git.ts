import { Component, Menu, Notice, setIcon, Setting, TFile } from "obsidian";
import { emptyState, moment } from "../cardbodies";
import { addResetButton, moveItem } from "../editors";
import {
	GIT_ACTION_DEFS,
	GIT_PLUGIN_ID,
	GIT_ACTION_STYLES,
	GIT_ACTIONS,
	GIT_COMMIT_SCOPES,
	GIT_SECTIONS,
	commitSummary,
	gitActionAvailable,
	gitActions,
	gitChangeCounts,
	gitChangeRows,
	gitSections,
	getGitPlugin,
	isGitAvailable,
	onlyStagedFor,
	openGitDiff,
	openGitView,
	parseCommitDate,
	queueGitAction,
	queueGitFileAction,
	readGitSnapshot,
	shortHash,
	type GitAction,
	type GitActionStyle,
	type GitChangeRow,
	type GitCommitScope,
	type GitPlugin,
	type GitSnapshot,
} from "../git";
import { t } from "../i18n";
import { openFile } from "../opener";
import { effectiveAutoRefreshMinutes, type DashboardCard } from "../types";
import { confirmAction, makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Git (obsidian-git) -------------------------------------------------

/**
 * A card showing the state of the vault's git repository — branch, ahead
 * count, what has changed, recent commits — with buttons that commit, sync,
 * push, pull and stage.
 *
 * Every one of those is a call into the obsidian-git plugin (see `src/git.ts`),
 * queued on that plugin's own task queue: the card is a view onto obsidian-git,
 * not a second git client. That is also why it needs no settings of its own for
 * remotes, credentials or commit-message templates — those live in obsidian-git
 * and apply here unchanged.
 *
 * It stays current by following obsidian-git's workspace events rather than
 * polling, so it updates in step with that plugin's own source-control view,
 * including after an automatic backup. Optional polling exists for the rare
 * case of a repo changed from outside Obsidian.
 */
export function renderGit(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const plugin = getGitPlugin(view.app);
	if (!plugin) {
		emptyState(body, "git-branch", t().cards.empty.gitEnable);
		return;
	}

	const cfg = card.git ?? {};
	const sections = gitSections(cfg.sections);
	const wantsLog = sections.includes("log");
	const logLimit = wantsLog ? Math.max(1, cfg.logLimit ?? 5) : 0;
	// The ahead-count and last-commit time are only drawn by the status line, and
	// both cost a git call, so a card without it doesn't pay for them.
	const includeSync = sections.includes("status");
	const changeLimit = cfg.changeLimit ?? 8;

	// Async reads can land after the card was torn down and rebuilt; drop them.
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});

	const wrap = body.createDiv("hearth-git");
	let snapshot: GitSnapshot = { status: plugin.cachedStatus };
	let loading = false;
	let busy = false;
	/** Bumped per read so a slow one that finishes after a newer one is dropped. */
	let readToken = 0;

	/** Re-read the repo through obsidian-git, then repaint. */
	const refresh = (): void => {
		const token = ++readToken;
		loading = true;
		paint();
		void readGitSnapshot(plugin, { logLimit, includeSync }).then((next) => {
			if (destroyed || token !== readToken) return;
			snapshot = next;
			loading = false;
			paint();
		});
	};

	/** Run an action, then re-read. `busy` disables the buttons meanwhile, so a
	 * double-click can't queue the same commit twice. */
	const run = (action: GitAction): void => {
		const def = GIT_ACTION_DEFS[action];
		if (def.view) {
			void openGitView(view.app, def.view);
			return;
		}
		const start = (): void => {
			busy = true;
			paint();
			const queued = queueGitAction(
				plugin,
				action,
				{
					commitMessage: cfg.commitMessage?.trim() || undefined,
					requestCustomMessage: cfg.askForMessage,
					onlyStaged: onlyStagedFor(cfg.commitScope, snapshot.status),
				},
				() => {
					if (destroyed) return;
					busy = false;
					refresh();
				},
			);
			if (!queued) {
				busy = false;
				new Notice(t().cards.git.unsupported);
				paint();
			}
		};
		if (def.destructive && !cfg.skipConfirm) {
			confirmAction(view.app, {
				title: t().cards.git.confirmTitle,
				message: t().cards.git.confirmDiscard,
				confirmText: t().cards.git.confirmDiscardButton,
				onConfirm: start,
			});
			return;
		}
		start();
	};

	/** Rebuild the whole body from the current snapshot. */
	const paint = (): void => {
		wrap.empty();
		wrap.toggleClass("is-busy", busy || loading);

		if (!plugin.gitReady) {
			// The plugin is loaded but has no repository open — either it is still
			// starting up, or this vault isn't a repo. Both are worth saying, and
			// both are fixed from obsidian-git's own view.
			const empty = wrap.createDiv("hearth-git-notready");
			emptyState(empty, "git-branch", t().cards.empty.gitNotReady);
			const button = empty.createEl("button", {
				cls: "hearth-git-notready-button",
				text: t().cards.git.openSourceControl,
			});
			button.addEventListener("click", () => void openGitView(view.app, "sourceControl"));
			return;
		}

		for (const section of sections) {
			switch (section) {
				case "status":
					paintStatus(wrap, snapshot, loading, () => run("switchBranch"), refresh);
					break;
				case "actions":
					paintActions(wrap, plugin, cfg.actions, cfg.actionStyle, busy, run);
					break;
				case "changes":
					paintChanges(view, plugin, wrap, snapshot, changeLimit, cfg.showPaths, refresh);
					break;
				case "log":
					paintLog(view, wrap, snapshot, logLimit);
					break;
			}
		}
	};

	paint();
	refresh();

	// Follow obsidian-git rather than poll it: it refreshes after every
	// operation of its own (including the automatic backup), and repainting
	// from the status it hands us costs nothing.
	/** When the plugin last handed us a status, so the `refreshed` handler below
	 * can tell "the plugin already read it" from "the plugin skipped the read". */
	let statusEventAt = 0;
	component.registerEvent(
		view.app.workspace.on("obsidian-git:status-changed", (status) => {
			if (destroyed) return;
			statusEventAt = Date.now();
			snapshot = { ...snapshot, status };
			paint();
		}),
	);
	// The plugin finished a refresh cycle — but it only re-reads the status
	// during one when its own status bar or one of its views needs it, and a
	// Hearth card is neither. So when that cycle produced no status event, the
	// card reads for itself; when it did, the paint above already happened and
	// there is nothing left to do.
	component.registerEvent(
		view.app.workspace.on("obsidian-git:refreshed", () => {
			if (destroyed || busy) return;
			if (Date.now() - statusEventAt < 2000) return;
			refresh();
		}),
	);
	// HEAD moved (a commit, a checkout, a pull): the branch, the ahead count and
	// the log are all stale, so this one needs a full re-read.
	component.registerEvent(
		view.app.workspace.on("obsidian-git:head-change", () => {
			if (!destroyed) refresh();
		}),
	);

	// Polling is off by default; the events above already cover everything done
	// inside Obsidian. It earns its keep for a repo also being changed from a
	// terminal or another device. The minimal tier suppresses the timer entirely.
	const refreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, cfg.refreshMin ?? 0);
	if (refreshMin > 0) {
		component.registerInterval(
			window.setInterval(() => {
				if (!destroyed && !busy) refresh();
			}, refreshMin * 60_000),
		);
	}
}


/** The status line: branch, what it tracks, how far ahead, and the size of the
 * working tree's changes. */
function paintStatus(
	wrap: HTMLElement,
	snapshot: GitSnapshot,
	loading: boolean,
	onBranch: () => void,
	onRefresh: () => void,
): void {
	const strings = t().cards.git;
	const row = wrap.createDiv("hearth-git-status");

	const branchName = snapshot.branch?.current;
	const branch = row.createDiv("hearth-git-branch");
	setIcon(branch.createDiv("hearth-git-branch-icon"), "git-branch");
	branch.createSpan({
		cls: "hearth-git-branch-name",
		text: branchName || strings.noBranch,
	});
	if (branchName) {
		branch.setAttribute("title", snapshot.branch?.tracking ?? strings.noUpstream);
		makeClickable(branch, onBranch, strings.actions.switchBranch);
		branch.addEventListener("click", onBranch);
	}

	const counts = gitChangeCounts(snapshot.status);
	const chips = row.createDiv("hearth-git-chips");
	/** One count chip; drawn only when it has something to say. */
	const chip = (
		value: number,
		icon: string,
		label: string,
		cls: string,
	): void => {
		if (value <= 0) return;
		const el = chips.createDiv(`hearth-git-chip ${cls}`);
		setIcon(el.createSpan("hearth-git-chip-icon"), icon);
		el.createSpan({ cls: "hearth-git-chip-value", text: String(value) });
		el.setAttribute("title", label);
		el.setAttribute("aria-label", `${value} ${label}`);
	};
	chip(counts.conflicted, "alert-triangle", strings.conflicted, "is-conflicted");
	chip(counts.staged, "check", strings.staged, "is-staged");
	chip(counts.unstaged, "pencil", strings.unstaged, "is-unstaged");
	chip(snapshot.unpushed ?? 0, "upload", strings.unpushed, "is-unpushed");

	if (counts.total === 0 && !(snapshot.unpushed ?? 0)) {
		chips.createSpan({ cls: "hearth-git-clean", text: strings.clean });
	}

	const last = snapshot.lastCommit;
	if (last) {
		row.createDiv({
			cls: "hearth-git-lastcommit",
			text: strings.lastCommit(relativeTime(last)),
		});
	}
	// The refresh control doubles as the busy indicator: it spins while a read is
	// in flight, which is also when pressing it again would be pointless.
	const refresh = row.createEl("button", {
		cls: "hearth-git-refresh",
		attr: { "aria-label": strings.refresh },
		title: strings.refresh,
	});
	setIcon(refresh, "refresh-cw");
	if (loading) refresh.addClass("is-loading");
	refresh.addEventListener("click", onRefresh);
}


/** The button row. Unavailable actions are drawn disabled rather than hidden,
 * so a card configured against a newer obsidian-git doesn't silently lose the
 * button the user put there. */
function paintActions(
	wrap: HTMLElement,
	plugin: GitPlugin,
	configured: readonly GitAction[] | undefined,
	style: GitActionStyle | undefined,
	busy: boolean,
	run: (action: GitAction) => void,
): void {
	const actions = gitActions(configured);
	if (actions.length === 0) return;
	const labelled = style === "labelled";
	const row = wrap.createDiv("hearth-git-actions");
	row.toggleClass("is-labelled", labelled);
	for (const action of actions) {
		const def = GIT_ACTION_DEFS[action];
		const label = t().cards.git.actions[action];
		const button = row.createEl("button", { cls: "hearth-git-action" });
		button.addClass(`is-${action}`);
		if (def.destructive) button.addClass("is-destructive");
		setIcon(button.createSpan("hearth-git-action-icon"), def.icon);
		if (labelled) button.createSpan({ cls: "hearth-git-action-label", text: label });
		button.setAttribute("aria-label", label);
		button.setAttribute("title", label);
		const available = gitActionAvailable(plugin, action);
		button.disabled = busy || !available;
		if (!available) button.setAttribute("title", t().cards.git.unsupported);
		button.addEventListener("click", () => run(action));
	}
}


/** The changed-files list. */
function paintChanges(
	view: HomeView,
	plugin: GitPlugin,
	wrap: HTMLElement,
	snapshot: GitSnapshot,
	limit: number,
	showPaths: boolean | undefined,
	refresh: () => void,
): void {
	const rows = gitChangeRows(snapshot.status);
	const section = wrap.createDiv("hearth-git-changes");
	if (rows.length === 0) {
		section.createDiv({ cls: "hearth-git-none", text: t().cards.git.noChanges });
		return;
	}
	const shown = limit > 0 ? rows.slice(0, limit) : rows;
	const list = section.createDiv("hearth-list hearth-git-list");
	for (const row of shown) paintChangeRow(view, plugin, list, row, showPaths, refresh);
	if (rows.length > shown.length) {
		const more = section.createDiv({
			cls: "hearth-git-more",
			text: t().cards.git.more(rows.length - shown.length),
		});
		const open = (): void => void openGitView(view.app, "sourceControl");
		makeClickable(more, open, t().cards.git.openSourceControl);
		more.addEventListener("click", open);
	}
}


/** One file row: status letter, name, and (optionally) its folder. Clicking
 * opens the note; the context menu offers what obsidian-git can do to it. */
function paintChangeRow(
	view: HomeView,
	plugin: GitPlugin,
	list: HTMLElement,
	row: GitChangeRow,
	showPaths: boolean | undefined,
	refresh: () => void,
): void {
	const el = list.createDiv("hearth-list-item hearth-git-file");
	el.addClass(`is-${row.kind}`);
	if (row.staged) el.addClass("is-staged");
	el.createDiv({ cls: "hearth-git-letter", text: row.letter });

	const main = el.createDiv("hearth-git-file-main");
	main.createDiv({ cls: "hearth-list-label", text: row.name });
	if (showPaths) {
		const folder = row.path.includes("/")
			? row.path.slice(0, row.path.lastIndexOf("/"))
			: "";
		if (folder) main.createDiv({ cls: "hearth-git-file-path", text: folder });
	}
	el.setAttribute("title", row.path);

	/** Open the note the row points at, when the vault still has it — a deleted
	 * file has nothing to open, so its diff is the only useful destination. */
	const open = (evt?: MouseEvent): void => {
		const file = view.app.vault.getAbstractFileByPath(row.vaultPath);
		if (file instanceof TFile) {
			void openFile(view, file, "card", evt);
			return;
		}
		openGitDiff(plugin, row.path, evt);
	};
	el.addEventListener("click", (evt) => open(evt));
	makeClickable(el, () => open(), row.name);

	el.addEventListener("contextmenu", (evt) => {
		evt.preventDefault();
		const menu = new Menu();
		const strings = t().cards.git;
		if (plugin.tools?.openDiff) {
			menu.addItem((item) =>
				item
					.setTitle(strings.openDiff)
					.setIcon("diff")
					.onClick(() => openGitDiff(plugin, row.path)),
			);
		}
		if (row.staged) {
			menu.addItem((item) =>
				item
					.setTitle(strings.unstageFile)
					.setIcon("minus")
					.onClick(() => {
						queueGitFileAction(plugin, "unstage", row.path, refresh);
					}),
			);
		}
		if (row.unstaged || !row.staged) {
			menu.addItem((item) =>
				item
					.setTitle(strings.stageFile)
					.setIcon("plus")
					.onClick(() => {
						queueGitFileAction(plugin, "stage", row.path, refresh);
					}),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle(strings.discardFile)
				.setIcon("undo")
				.onClick(() => {
					confirmAction(view.app, {
						title: t().cards.git.confirmTitle,
						message: t().cards.git.confirmDiscardFile(row.name),
						confirmText: t().cards.git.confirmDiscardButton,
						onConfirm: () => {
							queueGitFileAction(plugin, "discard", row.path, refresh);
						},
					});
				}),
		);
		menu.showAtMouseEvent(evt);
	});
}


/** The recent-commits list. */
function paintLog(
	view: HomeView,
	wrap: HTMLElement,
	snapshot: GitSnapshot,
	limit: number,
): void {
	const entries = (snapshot.log ?? []).slice(0, limit);
	const section = wrap.createDiv("hearth-git-log");
	if (entries.length === 0) {
		section.createDiv({ cls: "hearth-git-none", text: t().cards.git.noCommits });
		return;
	}
	for (const entry of entries) {
		const el = section.createDiv("hearth-git-commit");
		el.createDiv({ cls: "hearth-git-commit-hash", text: shortHash(entry.hash) });
		const main = el.createDiv("hearth-git-commit-main");
		main.createDiv({
			cls: "hearth-git-commit-message",
			text: commitSummary(entry.message) || t().cards.git.noMessage,
		});
		const when = parseCommitDate(entry.date);
		const meta = [entry.author?.name, when ? relativeTime(when) : ""].filter(Boolean);
		if (meta.length) {
			main.createDiv({ cls: "hearth-git-commit-meta", text: meta.join(" · ") });
		}
		const open = (): void => void openGitView(view.app, "history");
		el.setAttribute("title", entry.hash ?? "");
		makeClickable(el, open, t().cards.git.openHistory);
		el.addEventListener("click", open);
	}
}


/** "3 minutes ago", in the user's locale — the same moment shim the rest of the
 * card bodies use. */
function relativeTime(ms: number): string {
	return (moment(new Date(ms)) as unknown as { fromNow(): string }).fromNow();
}


// ---- Editor -------------------------------------------------------------

export function gitEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.git ??= {});
	const strings = t().editors.git;

	if (!isGitAvailable(ctx.app)) {
		new Setting(containerEl).setName(strings.missing).setDesc(strings.missingDesc);
	}

	// ---- Sections ----
	new Setting(containerEl).setName(strings.sections).setHeading();
	const sections = gitSections(cfg.sections);
	for (const section of GIT_SECTIONS) {
		new Setting(containerEl)
			.setName(t().cards.git.sections[section])
			.addToggle((toggle) =>
				toggle.setValue(sections.includes(section)).onChange((on) => {
					const next = on
						? [...sections, section]
						: sections.filter((id) => id !== section);
					// Persist in canonical order so the card always stacks the same
					// way regardless of the order the toggles were flipped in.
					cfg.sections = GIT_SECTIONS.filter((id) => next.includes(id));
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
			);
	}

	// ---- Buttons ----
	new Setting(containerEl).setName(strings.actions).setHeading();
	const actions = gitActions(cfg.actions);
	actions.forEach((action, index) => {
		const row = new Setting(containerEl).setName(t().cards.git.actions[action]);
		if (GIT_ACTION_DEFS[action].destructive) row.setDesc(strings.destructive);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => {
					cfg.actions = [...actions];
					moveItem(ctx, cfg.actions, index, index - 1);
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === actions.length - 1)
				.onClick(() => {
					cfg.actions = [...actions];
					moveItem(ctx, cfg.actions, index, index + 1);
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.removeAction)
				.onClick(() => {
					cfg.actions = actions.filter((id) => id !== action);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	const remaining = GIT_ACTIONS.filter((action) => !actions.includes(action));
	if (remaining.length > 0) {
		new Setting(containerEl).setName(strings.addAction).addDropdown((d) => {
			d.addOption("", strings.addActionPlaceholder);
			for (const action of remaining) d.addOption(action, t().cards.git.actions[action]);
			d.setValue("").onChange((value) => {
				if (!value) return;
				cfg.actions = [...actions, value as GitAction];
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});
	}

	new Setting(containerEl)
		.setName(strings.actionStyle)
		.setDesc(strings.actionStyleDesc)
		.addDropdown((d) => {
			for (const style of GIT_ACTION_STYLES) {
				d.addOption(style, t().editors.git.actionStyles[style]);
			}
			d.setValue(cfg.actionStyle ?? "icon").onChange((value) => {
				cfg.actionStyle = value === "icon" ? undefined : (value as GitActionStyle);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	// ---- Committing ----
	new Setting(containerEl).setName(strings.committing).setHeading();

	new Setting(containerEl)
		.setName(strings.commitScope)
		.setDesc(strings.commitScopeDesc)
		.addDropdown((d) => {
			for (const scope of GIT_COMMIT_SCOPES) {
				d.addOption(scope, strings.commitScopes[scope]);
			}
			d.setValue(cfg.commitScope ?? "smart").onChange((value) => {
				cfg.commitScope = value === "smart" ? undefined : (value as GitCommitScope);
				ctx.opts.save();
			});
		});

	new Setting(containerEl)
		.setName(strings.askForMessage)
		.setDesc(strings.askForMessageDesc)
		.addToggle((toggle) =>
			toggle.setValue(cfg.askForMessage ?? false).onChange((on) => {
				cfg.askForMessage = on || undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	if (!cfg.askForMessage) {
		new Setting(containerEl)
			.setName(strings.commitMessage)
			.setDesc(strings.commitMessageDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(strings.commitMessagePlaceholder)
					.setValue(cfg.commitMessage ?? "")
					.onChange((value) => {
						cfg.commitMessage = value.trim() || undefined;
						ctx.opts.save();
					}),
			);
	}

	new Setting(containerEl)
		.setName(strings.skipConfirm)
		.setDesc(strings.skipConfirmDesc)
		.addToggle((toggle) =>
			toggle.setValue(cfg.skipConfirm ?? false).onChange((on) => {
				cfg.skipConfirm = on || undefined;
				ctx.opts.save();
			}),
		);

	// ---- Display ----
	new Setting(containerEl).setName(strings.display).setHeading();

	const changeLimit = new Setting(containerEl)
		.setName(strings.changeLimit)
		.setDesc(strings.changeLimitDesc);
	changeLimit.addSlider((s) =>
		s
			.setLimits(0, 50, 1)
			.setValue(cfg.changeLimit ?? 8)
			.setDynamicTooltip()
			.onChange((value) => {
				cfg.changeLimit = value === 8 ? undefined : value;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	addResetButton(ctx, changeLimit, t().settings.resetSlider, () => {
		cfg.changeLimit = undefined;
	});

	new Setting(containerEl)
		.setName(strings.showPaths)
		.setDesc(strings.showPathsDesc)
		.addToggle((toggle) =>
			toggle.setValue(cfg.showPaths ?? false).onChange((on) => {
				cfg.showPaths = on || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	if (gitSections(cfg.sections).includes("log")) {
		const logLimit = new Setting(containerEl)
			.setName(strings.logLimit)
			.setDesc(strings.logLimitDesc);
		logLimit.addSlider((s) =>
			s
				.setLimits(1, 25, 1)
				.setValue(cfg.logLimit ?? 5)
				.setDynamicTooltip()
				.onChange((value) => {
					cfg.logLimit = value === 5 ? undefined : value;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		addResetButton(ctx, logLimit, t().settings.resetSlider, () => {
			cfg.logLimit = undefined;
		});
	}

	const refresh = new Setting(containerEl)
		.setName(strings.refresh)
		.setDesc(strings.refreshDesc);
	refresh.addSlider((s) =>
		s
			.setLimits(0, 60, 5)
			.setValue(cfg.refreshMin ?? 0)
			.setDynamicTooltip()
			.onChange((value) => {
				cfg.refreshMin = value > 0 ? value : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	addResetButton(ctx, refresh, t().settings.resetSlider, () => {
		cfg.refreshMin = undefined;
	});
}


/** The repository's state and controls, driven by the obsidian-git plugin. */
export const gitCard: CardDefinition<"git"> = {
	kind: "git",
	templates: [
		{
			id: "git",
			name: "Git",
			icon: "git-branch",
			build: () => ({ kind: "git", title: "Git", git: {}, w: 4, h: 4 }),
			requires: {
				name: "Git",
				pluginId: GIT_PLUGIN_ID,
				satisfied: (app) => isGitAvailable(app),
			},
		},
	],
	render: (view, card, body, component) => renderGit(view, card, body, component),
	renderEditor: (container, ctx) => gitEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.git)
			copy.git = {
				...source.git,
				sections: source.git.sections ? [...source.git.sections] : undefined,
				actions: source.git.actions ? [...source.git.actions] : undefined,
			};
	},
	// The card drives its own updates off obsidian-git's events, which say far
	// more precisely than a vault event whether anything git-visible changed.
	liveness: { mode: "static" },
};
