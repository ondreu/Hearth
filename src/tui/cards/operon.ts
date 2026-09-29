/**
 * The Operon cards as text: the list, the agenda, the board and the timer.
 *
 * Everything is read from Operon's Developer API, as on the graphical card
 * (src/cards/operon.ts), and written back through it: a board card moves to
 * the next column with Shift+→ (Operon decides whether the move is legal and
 * asks when it wants consent), and `+` adds a task through a field on the
 * card. The timer is drawn in big digits and counts on from Operon's reading.
 *
 * A read redraws the card, so a draw reads only when it wasn't a read's own —
 * one that read every time would never stop.
 */
import { t } from "../../i18n";
import { formatRelativeDate, localDayKey } from "../../dates";
import {
	ACCESS_RETRIES,
	BOARD_MAX_LIMIT,
	chipEnabled,
	confirmPlan,
	countOf,
	DEFAULT_AGENDA_DAYS,
	loadTasks,
	noticeCreateFailure,
	operonView,
	settleWrite,
	sortKeyOf,
	writesEnabled,
} from "../../cards/operon";
import {
	boardColumns,
	createTask,
	dueState,
	findPriority,
	findStatus,
	formatElapsed,
	groupByDay,
	isClosed,
	isMutable,
	isTransientAccessState,
	loadTaxonomy,
	openOperonTask,
	readTimer,
	retryDelayMs,
	sortTasks,
	taskDay,
	transitionTask,
	type OperonAccessState,
	type OperonResult,
	type OperonStatus,
	type OperonTask,
	type OperonTaskPage,
	type OperonTaxonomy,
	type OperonTimerState,
} from "../../operon";
import type { OperonConfig } from "../../types";
import { hearthMenu } from "../../uidesign";
import { bigLines, bigWidth, BIG_ROWS } from "../bigtext";
import type { TuiContext, TuiItem, TuiMount, TuiOutput, TuiRenderer } from "../card";
import { asciify, centerLine, fit, spread, type Line, type Seg } from "../text";
import { heading, message, showMenuFor } from "./common";

// ---- Reading ----------------------------------------------------------------------

type Loaded =
	| { kind: "tasks"; taxonomy: OperonTaxonomy | null; columns: OperonStatus[]; result: OperonResult<OperonTaskPage> }
	| { kind: "timer"; result: OperonResult<OperonTimerState>; at: number };

interface OperonState {
	loaded: Loaded | null;
	/** Set by a read's own redraw, so that draw doesn't read again. */
	fresh: boolean;
	generation: number;
	/** Where the board's cursor is: a column and a row in it. */
	col: number;
	row: number;
	/** The column a new task goes into while the add field is open, or
	 * `null` for a list's add; undefined when it is closed. */
	adding?: string | null;
	writing: boolean;
	retries: number;
}

function opState(ctx: TuiContext): OperonState {
	const cur = ctx.state.operon as OperonState | undefined;
	if (cur) return cur;
	const fresh: OperonState = { loaded: null, fresh: false, generation: 0, col: 0, row: 0, writing: false, retries: ACCESS_RETRIES };
	ctx.state.operon = fresh;
	return fresh;
}

function read(ctx: TuiContext, cfg: OperonConfig, st: OperonState): void {
	const view = ctx.view;
	const mine = ++st.generation;
	const today = localDayKey(Date.now());
	const mode = operonView(cfg);
	const load = async (): Promise<Loaded> => {
		if (mode === "timer") return { kind: "timer", result: await readTimer(view.plugin.operon), at: Date.now() };
		const taxonomy = await loadTaxonomy(view.plugin.operon);
		const columns = mode === "board" ? boardColumns(taxonomy, { pipelineIds: cfg.pipelineIds, order: cfg.boardOrder, hidden: cfg.boardHidden }) : [];
		const limit =
			mode === "board"
				? Math.min(countOf(cfg) * Math.max(1, columns.length), BOARD_MAX_LIMIT)
				: mode === "agenda"
					? countOf(cfg) * Math.max(1, cfg.agendaDays ?? DEFAULT_AGENDA_DAYS)
					: countOf(cfg);
		return { kind: "tasks", taxonomy, columns, result: await loadTasks(view, cfg, today, limit) };
	};
	void load()
		.then((loaded) => {
			if (mine !== st.generation) return;
			st.loaded = loaded;
			st.fresh = true;
			ctx.redraw();
		})
		.catch((err: unknown) => {
			if (mine !== st.generation) return;
			st.loaded = { kind: "tasks", taxonomy: null, columns: [], result: { ok: false, error: { code: "read", reason: err instanceof Error ? err.message : String(err) } } as OperonResult<OperonTaskPage> };
			st.fresh = true;
			ctx.redraw();
		});
}

function reload(ctx: TuiContext): void {
	const st = opState(ctx);
	st.fresh = false;
	st.writing = false;
	ctx.redraw();
}

// ---- Rows ---------------------------------------------------------------------------

/** A task as one line: its box, title, and the chips the card shows. */
function taskLine(cfg: OperonConfig, task: OperonTask, taxonomy: OperonTaxonomy | null, today: string, w: number, withStatus = true): Line {
	const closed = isClosed(task);
	const left: Line = [
		{ text: closed ? "[x]" : "[ ]", style: closed ? "green" : "accent" },
		{ text: " " },
		{ text: asciify(task.description || t().cards.operon.untitled), style: closed ? ["dim", "strike"] : undefined },
	];
	const chips: Line = [];
	const chip = (s: Seg) => chips.push({ text: " " }, s);
	if (withStatus && chipEnabled(cfg.showStatus) && task.workflow) {
		const status = findStatus(taxonomy, task.workflow.status.id);
		chip({ text: `[${asciify(status?.label ?? task.workflow.status.label)}]`, style: "dim", color: status?.color || undefined });
	}
	if (chipEnabled(cfg.showPriority)) {
		const pri = findPriority(taxonomy, task.priority?.id);
		const label = pri?.label ?? task.priority?.label;
		if (label) chip({ text: `!${asciify(label)}`, style: "yellow", color: pri?.color || undefined });
	}
	if (chipEnabled(cfg.showDue)) {
		const day = taskDay(task);
		if (day) {
			const state = dueState(task, today);
			chip({ text: formatRelativeDate(day), style: state === "overdue" ? ["red", "bold"] : state === "today" ? "yellow" : task.dates.due ? "dim" : "faint" });
		}
	}
	const flags: string[] = [];
	if (chipEnabled(cfg.showPinned) && task.pinned) flags.push("^");
	if (chipEnabled(cfg.showRecurrence) && task.recurrence.repeating) flags.push("~");
	if (chipEnabled(cfg.showTracker) && task.tracker.active) flags.push("*");
	if (task.relationships.blockedByOperonIds.length > 0) flags.push("#");
	if (flags.length) chip({ text: flags.join(""), style: "magenta", label: t().tui.cards.opFlags });
	if (chipEnabled(cfg.showFile) && w >= 50) {
		const name = task.locator.filePath.split("/").pop() ?? task.locator.filePath;
		chip({ text: name.replace(/\.md$/i, ""), style: "faint" });
	}
	return spread(left, chips, w);
}

/** A task's menu: open it, and on a board every other column to move it to. */
function taskMenu(ctx: TuiContext, task: OperonTask, columns: readonly OperonStatus[] | null, evt: MouseEvent | KeyboardEvent): void {
	const menu = hearthMenu();
	menu.addItem((i) => i.setTitle(t().tui.open).setIcon("file").onClick(() => void openOperonTask(ctx.view.app, task)));
	if (columns && writesEnabled(ctx.view) && isMutable(task)) {
		menu.addSeparator();
		menu.addItem((i) => i.setTitle(t().cards.operon.moveTo).setIsLabel(true));
		for (const status of columns) {
			if (status.id === task.workflow?.status.id) continue;
			menu.addItem((i) =>
				i
					.setTitle(status.label)
					.setIcon(status.isFinished ? "check" : status.isCancelled ? "x" : "circle")
					.onClick(() => moveTask(ctx, task, status.id)),
			);
		}
	}
	showMenuFor(menu, evt);
}

function moveTask(ctx: TuiContext, task: OperonTask, statusId: string): void {
	const st = opState(ctx);
	if (st.writing) return;
	st.writing = true;
	st.fresh = true;
	ctx.redraw();
	void transitionTask(ctx.view.plugin.operon, task, statusId, confirmPlan(ctx.view)).then((outcome) =>
		settleWrite(outcome, () => reload(ctx), () => {
			st.writing = false;
			st.fresh = true;
			ctx.redraw();
		}),
	);
}

/** The field a new task is typed into, mounted at `line`. */
function addField(ctx: TuiContext, cfg: OperonConfig, line: number, statusId: string | undefined): TuiMount {
	const st = opState(ctx);
	return {
		line,
		rows: 1,
		mount: (host) => {
			const prompt = host.createDiv("hearth-tui-line hearth-tui-calc-prompt");
			prompt.createSpan({ cls: "hearth-tui-accent hearth-tui-bold", text: "+ " });
			const input = prompt.createEl("input", {
				cls: "hearth-tui-calc-input",
				attr: { type: "text", spellcheck: "false", placeholder: t().cards.operon.addTaskPlaceholder, "aria-label": t().cards.operon.addTask },
			});
			const close = () => {
				st.adding = undefined;
				st.fresh = true;
				ctx.redraw();
				ctx.view.tuiBoard?.focus();
			};
			input.addEventListener("keydown", (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					close();
				} else if (e.key === "Enter") {
					e.preventDefault();
					e.stopPropagation();
					const text = input.value.trim();
					if (!text) return close();
					input.disabled = true;
					void createTask(ctx.view.plugin.operon, { description: text, statusId, createAs: cfg.createAs }, confirmPlan(ctx.view)).then((result) =>
						settleWrite(
							result,
							() => {
								st.adding = undefined;
								reload(ctx);
							},
							() => {
								input.disabled = false;
								input.focus();
							},
							(reason) => noticeCreateFailure(cfg, reason),
						),
					);
				}
			});
			window.requestAnimationFrame(() => input.focus());
		},
	};
}

function truncationLine(page: OperonTaskPage["page"]): Line[] {
	return page.truncated ? [[{ text: t().cards.operon.truncated(page.returnedCount, page.actualCount), style: "faint" }]] : [];
}

function stalenessLine(verified: boolean): Line[] {
	return verified ? [] : [[{ text: `~ ${t().cards.operon.settling}`, style: "faint" }]];
}

// ---- Views ----------------------------------------------------------------------------

function listOutput(ctx: TuiContext, cfg: OperonConfig, loaded: Extract<Loaded, { kind: "tasks" }>, agenda: boolean): TuiOutput {
	const st = opState(ctx);
	const today = localDayKey(Date.now());
	const w = ctx.cols;
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	const mounts: TuiMount[] = [];
	const result = loaded.result;
	if (!result.ok) return { lines: message(t().cards.operon.readFailed(result.error.reason), w) };
	lines.push(...stalenessLine(result.freshness.verified));
	const row = (task: OperonTask) => {
		items.push({ line: lines.length, activate: () => void openOperonTask(ctx.view.app, task), menu: (evt) => taskMenu(ctx, task, null, evt) });
		lines.push(taskLine(cfg, task, loaded.taxonomy, today, w));
	};
	if (agenda) {
		const days = Math.max(1, cfg.agendaDays ?? DEFAULT_AGENDA_DAYS);
		const groups = groupByDay(result.value.tasks, today, days);
		if (!groups.length) return { lines: message(t().cards.empty.operonNoAgenda, w) };
		for (const group of groups) {
			if (lines.length) lines.push([]);
			lines.push(spread(heading(formatRelativeDate(group.day)), [{ text: String(group.tasks.length), style: "dim" }], w));
			for (const task of sortTasks(group.tasks, sortKeyOf(cfg), !!cfg.sortReverse, loaded.taxonomy)) row(task);
		}
	} else {
		const tasks = sortTasks(result.value.tasks, sortKeyOf(cfg), !!cfg.sortReverse, loaded.taxonomy);
		if (!tasks.length) lines.push(...message(t().cards.empty.operonNoTasks, w));
		for (const task of tasks) row(task);
	}
	lines.push(...truncationLine(result.value.page));
	if (!agenda && writesEnabled(ctx.view)) {
		if (st.adding === null) {
			mounts.push(addField(ctx, cfg, lines.length, undefined));
			lines.push([]);
		} else {
			const open = () => {
				st.adding = null;
				st.fresh = true;
				ctx.redraw();
			};
			items.push({ line: lines.length, activate: open });
			lines.push([{ text: `+ ${t().cards.operon.addTask}`, style: "dim", onClick: open }]);
		}
	}
	return { lines, items, mounts, foot: agenda ? t().tui.cards.opAgendaFoot : writesEnabled(ctx.view) ? t().tui.cards.opListFoot : t().tui.cards.opReadFoot };
}

/** The board: a column per status, side by side, paged when they don't fit. */
function boardOutput(ctx: TuiContext, cfg: OperonConfig, loaded: Extract<Loaded, { kind: "tasks" }>): TuiOutput {
	const st = opState(ctx);
	const today = localDayKey(Date.now());
	const w = ctx.cols;
	const result = loaded.result;
	if (!result.ok) return { lines: message(t().cards.operon.readFailed(result.error.reason), w) };
	const columns = loaded.columns;
	if (!columns.length) return { lines: message(t().cards.empty.operonNoColumns, w) };
	const byStatus = new Map<string, OperonTask[]>();
	for (const task of result.value.tasks) {
		const id = task.workflow?.status.id;
		if (!id) continue;
		const bucket = byStatus.get(id);
		if (bucket) bucket.push(task);
		else byStatus.set(id, [task]);
	}
	const cols = columns.map((status) => ({
		status,
		tasks: sortTasks(byStatus.get(status.id) ?? [], sortKeyOf(cfg), !!cfg.sortReverse, loaded.taxonomy).slice(0, countOf(cfg)),
	}));
	st.col = Math.max(0, Math.min(cols.length - 1, st.col));
	st.row = Math.max(0, Math.min(Math.max(0, cols[st.col].tasks.length - 1), st.row));

	const gap = 2;
	const across = Math.max(1, Math.min(cols.length, Math.floor((w + gap) / (18 + gap))));
	const first = Math.max(0, Math.min(cols.length - across, st.col - Math.floor(across / 2)));
	const colW = Math.floor((w - gap * (across - 1)) / across);
	const shown = cols.slice(first, first + across);
	const lines: Line[] = [...stalenessLine(result.freshness.verified)];

	const head: Line = [];
	shown.forEach((c, i) => {
		const idx = first + i;
		if (i > 0) head.push({ text: " ".repeat(gap) });
		head.push(...fit([{ text: ` ${asciify(c.status.label)} `, style: ctx.focused && idx === st.col ? "header-sort" : "header" }, { text: ` ${c.tasks.length}`, style: "dim" }], colW));
	});
	lines.push(head);
	const sticky = lines.length;
	const rows = Math.max(1, ...shown.map((c) => c.tasks.length));
	for (let r = 0; r < rows; r++) {
		const line: Line = [];
		shown.forEach((c, i) => {
			const idx = first + i;
			if (i > 0) line.push({ text: " ".repeat(gap) });
			const task = c.tasks[r];
			if (!task) {
				line.push({ text: " ".repeat(colW) });
				return;
			}
			const open = () => {
				st.col = idx;
				st.row = r;
				void openOperonTask(ctx.view.app, task);
			};
			let cell: Line = taskLine(cfg, task, loaded.taxonomy, today, colW, false).map((s) => ({
				...s,
				onClick: s.onClick ?? open,
				onMenu: (evt: MouseEvent) => {
					st.col = idx;
					st.row = r;
					taskMenu(ctx, task, columns, evt);
				},
			}));
			cell = fit(cell, colW);
			if (ctx.focused && idx === st.col && r === st.row) cell = cell.map((s) => ({ ...s, style: [...(Array.isArray(s.style) ? s.style : s.style ? [s.style] : []), "reverse"] }));
			line.push(...cell);
		});
		lines.push(line);
	}
	if (cols.length > across) lines.push([{ text: `${first > 0 ? "◂ " : "  "}${t().tui.cards.boardHint(result.value.tasks.length, cols.length)}${first + across < cols.length ? " ▸" : ""}`, style: "faint" }]);
	lines.push(...truncationLine(result.value.page));
	const mounts: TuiMount[] = [];
	if (st.adding !== undefined && st.adding !== null) {
		const status = columns.find((c) => c.id === st.adding);
		lines.push([], [{ text: t().tui.cards.tasksAddTo(status?.label ?? ""), style: "dim" }]);
		mounts.push(addField(ctx, cfg, lines.length, st.adding));
		lines.push([]);
	}
	return {
		lines,
		mounts,
		sticky,
		hint: st.writing ? t().tui.cards.loading : undefined,
		foot: writesEnabled(ctx.view) ? t().tui.cards.opBoardFoot : t().tui.cards.opReadFoot,
	};
}

/** The timer: the elapsed time in big digits, counting on each second. */
function timerOutput(ctx: TuiContext, loaded: Extract<Loaded, { kind: "timer" }>): TuiOutput {
	const strings = t().cards.operon;
	const w = ctx.cols;
	const result = loaded.result;
	if (!result.ok) return { lines: message(strings.readFailed(result.error.reason), w) };
	const state = result.value;
	if (!state.active) {
		const lines: Line[] = [centerLine([{ text: "--:--", style: ["faint", "bold"] }], w), centerLine([{ text: strings.timerIdle, style: "dim" }], w)];
		if (state.transition) lines.push(centerLine([{ text: state.transition.kind === "starting" ? strings.timerStarting : strings.timerStopping, style: "faint" }], w));
		return { lines };
	}
	const elapsed = formatElapsed(state.active.elapsedSeconds + (Date.now() - loaded.at) / 1000);
	// Only the tick itself redraws the card; it is a read's redraw too.
	ctx.component.registerInterval(
		window.setInterval(() => {
			opState(ctx).fresh = true;
			ctx.redraw();
		}, 1000),
	);
	const lines: Line[] = [];
	if (bigWidth(elapsed) <= w && ctx.rows >= BIG_ROWS + 2) lines.push(...bigLines(elapsed).map((l) => centerLine(l, w)));
	else lines.push(centerLine([{ text: elapsed, style: ["bold", "accent"] }], w));
	lines.push(centerLine([{ text: asciify(state.active.isUnassigned ? strings.timerUnassigned : state.active.source), style: "dim" }], w));
	return { lines };
}

/** What stands in for the card when Operon can't be read. */
function accessMessage(state: OperonAccessState): string {
	const strings = t().cards.empty;
	const map: Record<OperonAccessState, string> = {
		error: strings.operonError,
		unsupported: strings.operonUnsupported,
		booting: strings.operonBooting,
		pending: strings.operonPending,
		suspended: strings.operonSuspended,
		revoked: strings.operonRevoked,
		absent: strings.operonEnable,
		ready: strings.operonEnable,
	};
	return map[state];
}

// ---- The renderer ------------------------------------------------------------------------

export const operonTui: TuiRenderer = {
	render(ctx) {
		const cfg = (ctx.card.operon ??= {});
		const view = ctx.view;
		if (!view.plugin.settings.operonIntegration) return { lines: message(t().cards.empty.operonDisabled, ctx.cols) };
		const st = opState(ctx);
		const access = view.plugin.operon.access();
		if (access.state !== "ready") {
			const lines = message(accessMessage(access.state), ctx.cols);
			if (access.error) lines.push([], ...message(t().cards.operon.errorDetail(access.error.reasonCode ?? access.error.code, access.error.reason), ctx.cols, "faint"));
			if (isTransientAccessState(access.state) && st.retries > 0) {
				const delay = retryDelayMs(ACCESS_RETRIES - st.retries, access.retryAfterMs);
				st.retries--;
				const timer = window.setTimeout(() => {
					view.plugin.operon.invalidate();
					ctx.redraw();
				}, delay);
				ctx.component.register(() => window.clearTimeout(timer));
			}
			return { lines };
		}
		st.retries = ACCESS_RETRIES;
		if (!st.fresh) read(ctx, cfg, st);
		st.fresh = false;
		const loaded = st.loaded;
		if (!loaded) return { lines: [[{ text: t().cards.operon.loading, style: "dim" }]] };
		if (loaded.kind === "timer") return operonView(cfg) === "timer" ? timerOutput(ctx, loaded) : { lines: [[{ text: t().cards.operon.loading, style: "dim" }]] };
		switch (operonView(cfg)) {
			case "board":
				return boardOutput(ctx, cfg, loaded);
			case "agenda":
				return listOutput(ctx, cfg, loaded, true);
			case "timer":
				return { lines: [[{ text: t().cards.operon.loading, style: "dim" }]] };
			default:
				return listOutput(ctx, cfg, loaded, false);
		}
	},
	key(ctx, evt) {
		const cfg = ctx.card.operon ?? {};
		const st = opState(ctx);
		const writes = writesEnabled(ctx.view);
		if (evt.key === "+" && writes && operonView(cfg) !== "agenda" && operonView(cfg) !== "timer") {
			const loaded = st.loaded;
			st.adding = operonView(cfg) === "board" && loaded?.kind === "tasks" ? loaded.columns[st.col]?.id ?? null : null;
			st.fresh = true;
			ctx.redraw();
			return true;
		}
		if (evt.key === "r" && !evt.ctrlKey && !evt.metaKey) {
			reload(ctx);
			return true;
		}
		if (operonView(cfg) !== "board") return false;
		const loaded = st.loaded;
		if (loaded?.kind !== "tasks" || !loaded.result.ok) return false;
		const columns = loaded.columns;
		const tasksIn = (i: number) => {
			const id = columns[i]?.id;
			const list = loaded.result.ok ? loaded.result.value.tasks.filter((task) => task.workflow?.status.id === id) : [];
			return sortTasks(list, sortKeyOf(cfg), !!cfg.sortReverse, loaded.taxonomy).slice(0, countOf(cfg));
		};
		const redraw = () => {
			st.fresh = true;
			ctx.redraw();
		};
		const current = tasksIn(st.col)[st.row];
		switch (evt.key) {
			case "ArrowLeft":
			case "ArrowRight": {
				const dir = evt.key === "ArrowRight" ? 1 : -1;
				const next = st.col + dir;
				if (next < 0 || next >= columns.length) return false;
				if (evt.shiftKey) {
					if (!writes || !current || !isMutable(current)) return true;
					moveTask(ctx, current, columns[next].id);
					st.col = next;
					return true;
				}
				st.col = next;
				st.row = Math.min(st.row, Math.max(0, tasksIn(next).length - 1));
				redraw();
				return true;
			}
			case "ArrowUp":
				if (st.row <= 0) return false;
				st.row--;
				redraw();
				return true;
			case "ArrowDown":
				if (st.row >= tasksIn(st.col).length - 1) return false;
				st.row++;
				redraw();
				return true;
			case "Enter":
				if (!current) return false;
				void openOperonTask(ctx.view.app, current);
				return true;
			case "ContextMenu":
				if (!current) return false;
				taskMenu(ctx, current, columns, evt);
				return true;
		}
		return false;
	},
	menu(ctx, menu) {
		menu.addItem((i) => i.setTitle(t().tui.cards.opReload).setIcon("refresh-cw").onClick(() => reload(ctx)));
	},
};
