/**
 * The Tasks card as text: an htop task table, or a board of columns.
 *
 * Everything a task can do on the graphical card it can do here, through the
 * same functions (src/cards/tasks.ts): the same sources (checkboxes, TaskNotes,
 * a Kanban board), filter and sort, the same completion rules for recurring
 * tasks, the same quick view on Enter and the same menu on a right-click.
 *
 * The list is a table — box, priority, due, task, and the card's fields at the
 * right — with the sorted column's header lit, the way htop marks its sort
 * column. The board is the card's columns side by side, a card per two lines;
 * the arrows move between cards, Shift+arrows (or `<` `>`) move a card to the
 * next column, and a column's header has its own menu.
 */
import { Notice } from "obsidian";
import { formatRelativeDate } from "../../dates";
import {
	addKanbanCard,
	boardTasks,
	checkboxStatuses,
	effectiveDate,
	listTasks,
	loadTasks,
	openTask,
	openTaskFilter,
	recurrenceLabel,
	taskBoard,
	type TaskBoard,
	type TaskBoardColumn,
	taskChecked,
	taskMenu,
	taskMetaEnabled,
	taskNotesCreateCommandId,
	taskSortMenu,
	taskSourceDate,
	toggleTask,
	type TaskHit,
	type TaskLoad,
	keyValues,
	matrixNames,
	matrixReadsPriorities,
	matrixTaskMenu,
	matrixTasks,
	moveTaskToQuadrant,
	resolvedMatrix,
} from "../../cards/tasks";
import { groupByQuadrant, matrixArrangement, matrixWriteValue } from "../../taskmatrix";
import { t } from "../../i18n";
import { openLink } from "../../opener";
import { priorityClass } from "../../priority";
import {
	activeTaskFields,
	dateDisplay,
	dateRelation,
	displayValue,
	fieldStyle,
	isAmbientStyle,
	isDateSource,
	isDescriptionSource,
	keyIsDate,
	sourceBuiltin,
} from "../../taskfields";
import { isTaskFilterActive } from "../../taskfilter";
import type { TaskMatrixQuadrant, TasksConfig } from "../../types";
import { PromptModal } from "../../ui";
import { hearthMenu } from "../../uidesign";
import type { HomeView } from "../../view";
import type { TuiContext, TuiItem, TuiOutput, TuiRenderer } from "../card";
import { asciify, centerLine, fit, padEnd, spread, styleLine, type Line, type Seg, type TuiStyle } from "../text";
import { showMenuFor } from "./common";

// ---- Loading --------------------------------------------------------------------

/**
 * The card's tasks, loaded into its state. Loading is asynchronous, so the
 * first draw starts it and shows the last result (or "loading"); its own
 * redraw picks the result up. Every other draw — a vault change, a board
 * rebuild, a tick — loads again.
 */
function loaded(ctx: TuiContext, cfg: TasksConfig): TaskLoad | null {
	if (ctx.state.fresh === true) {
		ctx.state.fresh = false;
	} else {
		void loadTasks(ctx.view, cfg).then((load) => {
			ctx.state.load = load;
			ctx.state.fresh = true;
			ctx.redraw();
		});
	}
	return (ctx.state.load as TaskLoad | undefined) ?? null;
}

// ---- A task's parts, as text --------------------------------------------------

/** A priority as the three-cell mark in the P column. */
function priorityMark(priority: string | undefined): { text: string; style: TuiStyle | TuiStyle[] } {
	if (!priority) return { text: "   ", style: "dim" };
	switch (priorityClass(priority)) {
		case "highest":
			return { text: "!!!", style: ["red", "bold"] };
		case "high":
			return { text: "!! ", style: "red" };
		case "medium":
			return { text: "!  ", style: "yellow" };
		case "low":
			return { text: "↓  ", style: "blue" };
		case "lowest":
			return { text: "↓↓ ", style: "blue" };
		default:
			return { text: "·  ", style: "dim" };
	}
}

/** The DUE column: the relative date, red when overdue, green when today;
 * `∞` marks a recurring task's next occurrence. */
function dueMark(hit: TaskHit, today: string, w: number): Seg {
	const date = effectiveDate(hit);
	const raw = hit.recurrence ? (hit.due ?? hit.scheduled) : hit.due;
	if (!raw) return { text: padEnd(hit.recurrence ? "∞" : "", w), style: "dim", label: hit.recurrence ? recurrenceLabel(hit.recurrence) ?? undefined : undefined };
	const text = `${formatRelativeDate(raw)}${hit.recurrence ? " ∞" : ""}`;
	const day = (date ?? "").slice(0, 10);
	const style: TuiStyle = hit.done ? "dim" : day < today ? "red" : day === today ? "green" : "yellow";
	return { text: padEnd(text, w), style, label: hit.recurrence ? recurrenceLabel(hit.recurrence) ?? raw : raw };
}

/** A task's title, its links clickable. */
function taskText(view: HomeView, hit: TaskHit, base: TuiStyle[], color?: string): Line {
	const text = hit.text || hit.file.basename;
	const segs: Line = [];
	const re = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]|\[([^\]]+?)\]\(([^)]+?)\)/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		if (m.index > last) segs.push({ text: asciify(text.slice(last, m.index)), style: base, color });
		const target = m[1] ?? m[4];
		const label = m[2] ?? m[1] ?? m[3];
		const external = !m[1] && /^[a-z][\w+.-]*:/i.test(target);
		segs.push({
			text: asciify(label),
			style: [...base, "cyan", "underline"],
			onClick: (evt) => {
				if (external) window.open(target, "_blank");
				else void openLink(view, target, hit.file.path, "card", evt instanceof MouseEvent ? evt : null);
			},
			label: target,
		});
		last = re.lastIndex;
	}
	if (last < text.length) segs.push({ text: asciify(text.slice(last)), style: base, color });
	return segs;
}

/** The chips at a task's right: status, board column, the other dates, tags —
 * or, with field customization on, the card's own fields in its order. Also
 * returns a row colour when an ambient field paints the whole task. */
function taskChips(view: HomeView, cfg: TasksConfig, hit: TaskHit, today: string): { chips: Line; ambient?: string } {
	const chips: Line = [];
	const add = (text: string, style: TuiStyle | TuiStyle[], color?: string | null, label?: string) => {
		if (!text) return;
		if (chips.length) chips.push({ text: " " });
		chips.push({ text: asciify(text), style, color: color ?? undefined, label });
	};
	const fields = activeTaskFields(cfg, view.plugin.settings);
	if (fields === null) {
		if (hit.status) add(hit.status, "magenta");
		if (hit.boardColumn && cfg.layout !== "kanban") add(hit.boardColumn, "cyan");
		if (hit.line >= 0) {
			const start = taskSourceDate(hit, "start");
			if (start) add(`start ${formatRelativeDate(start)}`, "dim", null, start);
			if (!hit.recurrence) {
				const scheduled = taskSourceDate(hit, "scheduled");
				if (scheduled) add(`sched ${formatRelativeDate(scheduled)}`, "dim", null, scheduled);
			}
			const doneDate = taskSourceDate(hit, "doneDate");
			if (doneDate) add(`done ${formatRelativeDate(doneDate)}`, "green", null, doneDate);
		}
		if (taskMetaEnabled(cfg, hit)) for (const tag of hit.tags ?? []) add(`#${tag}`, "magenta");
		return { chips };
	}
	let ambient: string | undefined;
	for (const field of fields) {
		const display = fieldStyle(field);
		const isAmbient = isAmbientStyle(display);
		const prefix = field.showName && field.name.trim() ? `${field.name.trim()}:` : "";
		for (const key of field.keys) {
			if (isDescriptionSource(key.source)) continue;
			const builtin = sourceBuiltin(key.source);
			// Priority and due have columns of their own; their colours still apply.
			if (builtin === "priority" || builtin === "due") {
				if (isAmbient) {
					const raw = builtin === "due" ? effectiveDate(hit) : hit.priority;
					if (raw) {
						const shown = builtin === "due" ? dateDisplay(key, dateRelation(raw, today)) : displayValue(key, raw);
						ambient = shown.color ?? ambient;
					}
				}
				continue;
			}
			if (keyIsDate(key)) {
				const dates = builtin && isDateSource(key.source) ? [taskSourceDate(hit, builtin)].filter((d): d is string => !!d) : keyValues(view, hit, key.source);
				for (const date of dates) {
					const shown = dateDisplay(key, dateRelation(date, today));
					if (isAmbient) ambient = shown.color ?? ambient;
					else add(`${prefix}${shown.label || formatRelativeDate(date)}`, "dim", shown.color, date);
				}
				continue;
			}
			for (const raw of keyValues(view, hit, key.source)) {
				const shown = displayValue(key, raw);
				if (isAmbient) ambient = shown.color ?? ambient;
				else add(`${prefix}${shown.label}`, builtin === "status" ? "magenta" : builtin === "column" ? "cyan" : "dim", shown.color);
			}
		}
	}
	return { chips, ambient };
}

/** The sorted column's index in the list header, or -1. */
function sortedColumn(cfg: TasksConfig): number {
	if (cfg.sortRules?.length) return -1;
	switch (cfg.sortKey) {
		case "priority":
			return 1;
		case "due":
			return 2;
		case "alpha":
			return 3;
		default:
			return -1;
	}
}

// ---- Actions --------------------------------------------------------------------

function refreshOf(ctx: TuiContext): () => void {
	return () => ctx.redraw();
}

/** Add a task where the card's source allows it: TaskNotes' own create
 * command, or a card at the end of a Kanban column. */
function addTask(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>, column?: TaskBoardColumn, board?: TaskBoard): void {
	const { view } = ctx;
	if (load.source === "tasknotes") {
		if (!view.app.commands.executeCommandById(taskNotesCreateCommandId(view))) new Notice(t().notices.taskNotesCreateFailed);
		return;
	}
	if (load.source !== "kanban" || !load.boardColumns?.length) {
		view.tuiSay?.(t().tui.cards.tasksNoAdd);
		return;
	}
	const heading = column?.label ?? load.boardColumns[0];
	const markDone = board ? board.doneColumns.has(heading.toLowerCase()) : (cfg.kanbanDoneColumns ?? []).includes(heading.toLowerCase());
	new PromptModal(view.app, {
		title: t().cards.tasks.addCard,
		label: t().tui.cards.tasksAddTo(heading),
		onDone: (text) => {
			if (!text?.trim()) return;
			const doneDate = markDone && (cfg.kanbanExtended ?? false) ? load.today : undefined;
			void addKanbanCard(view, cfg, heading, text, markDone || undefined, doneDate).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				ctx.redraw();
			});
		},
	}).open();
}

function showTaskMenu(ctx: TuiContext, cfg: TasksConfig, hit: TaskHit, evt: MouseEvent | KeyboardEvent): void {
	const menu = taskMenu(ctx.view, cfg, hit, refreshOf(ctx));
	if (menu) showMenuFor(menu, evt);
	else void openTask(ctx.view, cfg, hit, refreshOf(ctx));
}

// ---- List layout ----------------------------------------------------------------

function listOutputFor(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>): TuiOutput {
	const { view } = ctx;
	const { hits, today, openStatus } = load;
	const list = listTasks(cfg, hits, today);
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	const dueW = ctx.cols >= 60 ? 11 : 9;
	const fixed = 4 + 4 + dueW + 1;
	lines.push(
		fit(
			[
				...headerCells(
					[
						[" ", 4],
						["P", 4],
						[t().tui.cards.due, dueW + 1],
						[t().tui.cards.task, Math.max(4, ctx.cols - fixed)],
					],
					sortedColumn(cfg),
				),
			],
			ctx.cols,
		),
	);
	if (list.length === 0) {
		const empty = isTaskFilterActive(cfg.taskFilter) ? t().cards.empty.tasksNoMatch : t().cards.empty.tasksEmpty;
		lines.push([{ text: empty, style: "dim" }]);
		return { lines, hint: filterHint(cfg, 0), foot: t().tui.cards.tasksFoot, sticky: 1 };
	}
	for (const hit of list) {
		const checked = taskChecked(cfg, hit, today);
		const { chips, ambient } = taskChips(view, cfg, hit, today);
		const pri = priorityMark(hit.priority);
		const left: Line = [
			{
				text: checked ? "[x]" : "[ ]",
				style: checked ? "green" : "accent",
				onClick: () => toggleTask(view, cfg, hit, today, openStatus, refreshOf(ctx)),
				label: checked ? t().tui.cards.untick : t().tui.cards.tick,
			},
			{ text: " " },
			{ text: pri.text, style: pri.style },
			{ text: " " },
			dueMark(hit, today, dueW),
			{ text: " " },
			...taskText(view, hit, hit.done ? ["dim", "strike"] : [], ambient),
		];
		const row = spread(left, chips.length ? [{ text: "  " }, ...chips] : [], ctx.cols);
		const line = lines.length;
		lines.push(row);
		// The description, as the graphical list shows it: muted sub-bullets.
		const desc = (hit.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
		for (const d of desc.slice(0, ctx.zoomed ? 20 : 3)) lines.push([{ text: " ".repeat(fixed) }, { text: `• ${asciify(d)}`, style: "dim" }]);
		items.push({
			line,
			span: 1 + Math.min(desc.length, ctx.zoomed ? 20 : 3),
			activate: () => void openTask(view, cfg, hit, refreshOf(ctx)),
			toggle: () => toggleTask(view, cfg, hit, today, openStatus, refreshOf(ctx)),
			menu: (evt) => showTaskMenu(ctx, cfg, hit, evt),
		});
	}
	const open = list.filter((h) => !taskChecked(cfg, h, today)).length;
	return { lines, items, hint: filterHint(cfg, open), foot: t().tui.cards.tasksFoot, sticky: 1 };
}

function headerCells(cols: [string, number][], sorted: number): Line {
	return cols.map(([label, w], i) => ({ text: padEnd(label, w), style: i === sorted ? "header-sort" : "header" }));
}

function filterHint(cfg: TasksConfig, open: number): string {
	const base = t().tui.cards.tasksOpen(open);
	return isTaskFilterActive(cfg.taskFilter) ? `${base} · ${t().cards.tasks.filter.toLowerCase()}` : base;
}

// ---- Board layout ----------------------------------------------------------------

interface BoardSel {
	col: number;
	row: number;
}

function boardSel(ctx: TuiContext): BoardSel {
	const sel = (ctx.state.board ??= { col: 0, row: 0 }) as BoardSel;
	return sel;
}

/** Tick a board card the way its checkbox on the graphical board does: a
 * Kanban card or a recurring task toggles in place; a TaskNotes task steps to
 * the next column (and back to the first when unticked); a checkbox task on a
 * status board steps to the next status. */
function boardToggle(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>, board: TaskBoard, col: TaskBoardColumn, hit: TaskHit): void {
	const refresh = refreshOf(ctx);
	if (load.source === "kanban" || hit.recurrence) {
		toggleTask(ctx.view, cfg, hit, load.today, load.openStatus, refresh);
		return;
	}
	const i = board.visible.indexOf(col);
	const target = hit.done ? board.visible[0] : board.visible[i + 1] ?? board.visible[0];
	if (target && target !== col) board.moveTo(hit, target);
}

function columnMenu(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>, board: TaskBoard, col: TaskBoardColumn, evt: MouseEvent | KeyboardEvent): void {
	const menu = hearthMenu();
	const i = board.visible.indexOf(col);
	const left = board.visible[i - 1];
	const right = board.visible[i + 1];
	if (load.source === "kanban" || load.source === "tasknotes") {
		menu.addItem((it) => it.setTitle(t().cards.tasks.addCard).setIcon("plus").onClick(() => addTask(ctx, cfg, load, col, board)));
		menu.addSeparator();
	}
	const labels = t().cards.tasks.sortLabels;
	const current = board.columnSort(col);
	for (const key of ["smart", "due", "priority", "created", "alpha"] as const) {
		menu.addItem((it) =>
			it
				.setTitle(labels[key])
				.setChecked((current.key ?? "smart") === key)
				.onClick(() => board.setColumnSort(col, { key: key === "smart" ? undefined : key, reverse: current.reverse })),
		);
	}
	menu.addItem((it) =>
		it
			.setTitle(t().cards.tasks.sortReverse)
			.setChecked(!!current.reverse)
			.onClick(() => board.setColumnSort(col, { key: current.key, reverse: current.reverse ? undefined : true })),
	);
	menu.addSeparator();
	if (left) menu.addItem((it) => it.setTitle(t().tui.cards.columnLeft).setIcon("arrow-left").onClick(() => board.reorder(col.key, left.key)));
	if (right) menu.addItem((it) => it.setTitle(t().tui.cards.columnRight).setIcon("arrow-right").onClick(() => board.reorder(col.key, right.key)));
	if (load.source === "kanban") {
		const on = board.doneColumns.has(col.key);
		menu.addItem((it) =>
			it
				.setTitle(on ? t().cards.tasks.unsetDoneColumn(col.label) : t().cards.tasks.setDoneColumn(col.label))
				.setChecked(on)
				.onClick(() => board.toggleDoneColumn(col)),
		);
	}
	menu.addItem((it) => it.setTitle(t().cards.tasks.hideColumn(col.label)).setIcon("eye-off").onClick(() => board.hideColumn(col.key)));
	showMenuFor(menu, evt);
}

function boardOutputFor(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>): TuiOutput {
	const { view } = ctx;
	const board = taskBoard(view, cfg, boardTasks(cfg, load.hits, load.today), refreshOf(ctx), load.boardColumns);
	ctx.state.boardModel = board;
	const cols = board.visible;
	if (cols.length === 0) return { lines: [[{ text: t().tui.cards.boardNoColumns, style: "dim" }]], foot: t().tui.cards.boardFoot };
	const sel = boardSel(ctx);
	sel.col = Math.max(0, Math.min(cols.length - 1, sel.col));
	sel.row = Math.max(0, Math.min(Math.max(0, cols[sel.col].hits.length - 1), sel.row));

	// As many columns as fit at 18 cells or more; the rest scroll sideways,
	// keeping the selected one in view.
	const gap = 3;
	const across = Math.max(1, Math.min(cols.length, Math.floor((ctx.cols + gap) / (18 + gap))));
	let first = typeof ctx.state.boardFirst === "number" ? ctx.state.boardFirst : 0;
	if (sel.col < first) first = sel.col;
	if (sel.col >= first + across) first = sel.col - across + 1;
	first = Math.max(0, Math.min(first, cols.length - across));
	ctx.state.boardFirst = first;
	const shown = cols.slice(first, first + across);
	const w = Math.floor((ctx.cols - gap * (shown.length - 1)) / shown.length);

	const lines: Line[] = [];
	const header: Line = [];
	shown.forEach((col, i) => {
		const idx = first + i;
		const done = board.doneColumns.has(col.key) || !!col.statusDone;
		const label = ` ${asciify(col.label)} ${col.hits.length}${done ? " ✓" : ""}`;
		header.push({
			text: padEnd(label, w),
			style: ctx.focused && idx === sel.col ? "header-sort" : "header",
			onClick: () => {
				sel.col = idx;
				sel.row = 0;
				ctx.redraw();
			},
			onMenu: (evt) => columnMenu(ctx, cfg, load, board, col, evt),
			label: col.label,
		});
		if (i < shown.length - 1) header.push({ text: " ".repeat(gap) });
	});
	if (first > 0 || first + across < cols.length) {
		// Say that there are more columns off to the side.
		const more = `${first > 0 ? "◂" : " "}${first + across < cols.length ? "▸" : " "}`;
		lines.push(spread(fit(header, Math.max(0, ctx.cols - 3)), [{ text: ` ${more}`, style: "dim" }], ctx.cols));
	} else lines.push(header);

	const rows = Math.max(1, ...shown.map((c) => c.hits.length));
	for (let r = 0; r < rows; r++) {
		for (let sub = 0; sub < 2; sub++) {
			const line: Line = [];
			shown.forEach((col, i) => {
				const idx = first + i;
				const hit = col.hits[r];
				let cell: Line;
				if (!hit) cell = [{ text: " ".repeat(w) }];
				else if (sub === 0) {
					const checked = taskChecked(cfg, hit, load.today);
					const box: Seg = {
						text: checked ? "[x] " : "[ ] ",
						style: checked ? "green" : "accent",
						onClick: () => boardToggle(ctx, cfg, load, board, col, hit),
					};
					const text = taskText(view, hit, hit.done ? ["dim", "strike"] : []).map((s) => ({
						...s,
						onClick:
							s.onClick ??
							(() => {
								sel.col = idx;
								sel.row = r;
								void openTask(view, cfg, hit, refreshOf(ctx));
							}),
						onMenu: (evt: MouseEvent) => {
							sel.col = idx;
							sel.row = r;
							showTaskMenu(ctx, cfg, hit, evt);
						},
					}));
					cell = fit([box, ...text], w);
				} else {
					const pri = priorityMark(hit.priority);
					const due = dueMark(hit, load.today, 0);
					const { chips } = taskChips(view, cfg, hit, load.today);
					const meta: Line = [{ text: "    " }];
					if (hit.priority) meta.push({ text: pri.text.trim(), style: pri.style }, { text: " " });
					if (due.text.trim()) meta.push({ ...due, text: due.text.trim() }, { text: " " });
					meta.push(...chips);
					cell = fit(meta, w);
				}
				if (hit && ctx.focused && idx === sel.col && r === sel.row) cell = styleLine(cell, "reverse");
				line.push(...cell);
				if (i < shown.length - 1) line.push({ text: " ".repeat(gap) });
			});
			lines.push(line);
		}
	}
	const total = cols.reduce((n, c) => n + c.hits.length, 0);
	return { lines, hint: t().tui.cards.boardHint(total, cols.length), foot: t().tui.cards.boardFoot, sticky: 1 };
}

function boardKey(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>, evt: KeyboardEvent): boolean {
	const board = ctx.state.boardModel as TaskBoard | undefined;
	if (!board) return false;
	const cols = board.visible;
	const sel = boardSel(ctx);
	const col = cols[sel.col];
	const hit = col?.hits[sel.row];
	const move = (to: TaskBoardColumn | undefined) => {
		if (!hit || !to) return;
		board.moveTo(hit, to);
		sel.col = cols.indexOf(to);
	};
	switch (evt.key) {
		case "ArrowLeft":
		case "ArrowRight": {
			const d = evt.key === "ArrowLeft" ? -1 : 1;
			if (evt.shiftKey) move(cols[sel.col + d]);
			else {
				if (!cols[sel.col + d]) return false;
				sel.col += d;
				sel.row = Math.min(sel.row, Math.max(0, cols[sel.col].hits.length - 1));
			}
			ctx.redraw();
			return true;
		}
		case "<":
		case ">":
			move(cols[sel.col + (evt.key === "<" ? -1 : 1)]);
			ctx.redraw();
			return true;
		case "ArrowUp":
		case "ArrowDown": {
			if (!col) return false;
			const d = evt.key === "ArrowUp" ? -1 : 1;
			const next = sel.row + d;
			if (next < 0 || next >= col.hits.length) return false;
			sel.row = next;
			ctx.redraw();
			return true;
		}
		case "Enter":
			if (hit) void openTask(ctx.view, cfg, hit, refreshOf(ctx));
			return !!hit;
		case " ":
			if (hit && col) boardToggle(ctx, cfg, load, board, col, hit);
			return !!hit;
		case "ContextMenu":
			if (hit) showTaskMenu(ctx, cfg, hit, evt);
			else if (col) columnMenu(ctx, cfg, load, board, col, evt);
			return true;
		case "+":
			addTask(ctx, cfg, load, col, board);
			return true;
	}
	return false;
}

// ---- Matrix layout ---------------------------------------------------------------

/** One task drawn in the matrix: where it sits, for the arrow keys. */
interface MatrixSpot {
	hit: TaskHit;
	/** The quadrant, or null for the unsorted strip. */
	quadrant: TaskMatrixQuadrant | null;
	/** 0 or 1 for the quadrant's column; the strip spans both (-1). */
	col: number;
	/** 0 or 1 for the quadrant's row; 2 for the strip. */
	row: number;
}

/** The colour a quadrant's mark is drawn in, matching the card's tints. */
const QUADRANT_STYLE: Record<TaskMatrixQuadrant, TuiStyle> = {
	do: "red",
	schedule: "blue",
	delegate: "yellow",
	eliminate: "dim",
};

/**
 * The matrix as text: the axis names across the top, then each row of the
 * cross — its axis name, the two quadrants side by side split by a `│` — with
 * a `─┼─` line between the rows and the unsorted tasks under it all. A task is
 * one line (box, title, due); each is its own item, so the selection, Enter,
 * Space and the menu work as in the list, the arrows also step between the
 * columns, and Shift+arrows move a task into the neighbouring quadrant.
 */
function matrixOutputFor(ctx: TuiContext, cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>): TuiOutput {
	const { view } = ctx;
	const { today, openStatus } = load;
	if (!matrixReadsPriorities(cfg)) return { lines: [[{ text: t().cards.empty.matrixNeedsPriorities, style: "dim" }]], foot: t().tui.cards.matrixFoot };
	const refresh = refreshOf(ctx);
	const matrix = resolvedMatrix(view.app, cfg);
	const names = matrixNames(cfg);
	const arrangement = matrixArrangement(cfg.matrix);
	const { quadrants, unsorted } = groupByQuadrant(matrixTasks(cfg, load.hits, today), (h) => h.priority, matrix, cfg.source ?? "checkbox");
	const gap = 3;
	const w = Math.max(8, Math.floor((ctx.cols - gap) / 2));
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	const spots: MatrixSpot[] = [];
	// A quadrant shows this many tasks before "+ n more" (all when zoomed).
	const cap = ctx.zoomed ? Number.MAX_SAFE_INTEGER : Math.max(2, Math.floor((ctx.rows - 6) / 2) - 1);

	const taskCell = (hit: TaskHit, width: number): Line => {
		const checked = taskChecked(cfg, hit, today);
		// Measured wide and trimmed: the date takes the room it needs, no more.
		const due = dueMark(hit, today, 24);
		const box: Seg = {
			text: checked ? "[x] " : "[ ] ",
			style: checked ? "green" : "accent",
			onClick: () => toggleTask(view, cfg, hit, today, openStatus, refresh),
		};
		const right: Line = due.text.trim() ? [{ text: " " }, { ...due, text: due.text.trim() }] : [];
		return spread([box, ...taskText(view, hit, hit.done ? ["dim", "strike"] : [])], right, width);
	};
	const addItem = (spot: MatrixSpot, line: number, from: number, to: number) => {
		spots.push(spot);
		items.push({
			line,
			range: [from, to],
			activate: () => void openTask(view, cfg, spot.hit, refresh),
			toggle: () => toggleTask(view, cfg, spot.hit, today, openStatus, refresh),
			menu: (evt) => showMenuFor(matrixTaskMenu(view, cfg, matrix, spot.hit, refresh), evt),
		});
	};

	// The axis names across the top, each centred over its column.
	lines.push([
		...centerLine([{ text: names[arrangement.across[0]].toUpperCase(), style: "header" }], w),
		{ text: " ".repeat(gap) },
		...centerLine([{ text: names[arrangement.across[1]].toUpperCase(), style: "header" }], w),
	]);
	for (let r = 0; r < 2; r++) {
		if (r === 1) lines.push([{ text: "─".repeat(w + 1), style: "faint" }, { text: "┼", style: "faint" }, { text: "─".repeat(w + 1), style: "faint" }]);
		lines.push([{ text: `▸ ${names[arrangement.down[r]].toUpperCase()}`, style: "dim" }]);
		const pair = [arrangement.cells[r * 2], arrangement.cells[r * 2 + 1]];
		// The quadrant names, with the count and the mark in its colour.
		lines.push(
			pair.flatMap((id, c) => {
				const head = fit(
					[
						{ text: "● ", style: QUADRANT_STYLE[id] },
						{ text: asciify(matrix[id].label), style: "bold" },
						{ text: ` ${quadrants[id].length}`, style: "dim" },
						...(matrixWriteValue(matrix, id) === undefined ? [{ text: " -", style: "faint" as TuiStyle }] : []),
					],
					w,
				);
				return c === 0 ? [...head, { text: " │ ", style: "faint" }] : head;
			}),
		);
		const shown = pair.map((id) => quadrants[id].slice(0, cap));
		const more = pair.map((id) => quadrants[id].length - Math.min(cap, quadrants[id].length));
		const height = Math.max(1, ...shown.map((l, i) => l.length + (more[i] > 0 ? 1 : 0)));
		for (let k = 0; k < height; k++) {
			const line = lines.length;
			const row: Line = [];
			pair.forEach((id, c) => {
				const hit = shown[c][k];
				let cell: Line;
				if (hit) {
					cell = taskCell(hit, w);
					addItem({ hit, quadrant: id, col: c, row: r }, line, c * (w + gap), c * (w + gap) + w);
				} else if (k === shown[c].length && more[c] > 0) cell = fit([{ text: t().tui.cards.matrixMore(more[c]), style: "dim" }], w);
				else if (k === 0 && !quadrants[id].length) cell = fit([{ text: t().cards.tasks.matrix.empty, style: "faint" }], w);
				else cell = [{ text: " ".repeat(w) }];
				row.push(...cell);
				if (c === 0) row.push({ text: " │ ", style: "faint" });
			});
			lines.push(row);
		}
	}
	if (matrix.showUnsorted && unsorted.length) {
		lines.push([{ text: "┄".repeat(ctx.cols), style: "faint" }]);
		lines.push([{ text: asciify(names.unsorted), style: "bold" }, { text: ` ${unsorted.length}`, style: "dim" }]);
		for (const hit of unsorted.slice(0, ctx.zoomed ? unsorted.length : cap)) {
			addItem({ hit, quadrant: null, col: -1, row: 2 }, lines.length, 0, ctx.cols);
			lines.push(taskCell(hit, ctx.cols));
		}
		if (!ctx.zoomed && unsorted.length > cap) lines.push([{ text: t().tui.cards.matrixMore(unsorted.length - cap), style: "dim" }]);
	}
	ctx.state.matrixSpots = spots;
	const open = spots.filter((s) => !taskChecked(cfg, s.hit, today)).length;
	return { lines, items, hint: filterHint(cfg, open), foot: t().tui.cards.matrixFoot, sticky: 1 };
}

/** The matrix's arrow keys: left/right step to the other column (the task at
 * the same height there, or its last), Shift+arrows move the task into the
 * neighbouring quadrant — and Shift+down out of the bottom row, into the
 * unsorted strip. Up and down without Shift are the frame's own. */
function matrixKey(ctx: TuiContext, cfg: TasksConfig, evt: KeyboardEvent): boolean {
	const spots = ctx.state.matrixSpots as MatrixSpot[] | undefined;
	const spot = spots?.[ctx.selected];
	if (!spots || !spot) return false;
	const horizontal = evt.key === "ArrowLeft" || evt.key === "ArrowRight";
	const vertical = evt.key === "ArrowUp" || evt.key === "ArrowDown";
	if (!horizontal && !(vertical && evt.shiftKey)) return false;
	const arrangement = matrixArrangement(cfg.matrix);
	if (evt.shiftKey) {
		let col = spot.col;
		let row = spot.row;
		if (horizontal) col = evt.key === "ArrowLeft" ? 0 : 1;
		else row = evt.key === "ArrowUp" ? row - 1 : row + 1;
		// From the strip, up goes to the bottom row on the left.
		if (spot.row === 2 && evt.key === "ArrowUp") {
			row = 1;
			col = 0;
		}
		if (spot.row === 2 && horizontal) return true;
		if (row < 0) return true;
		const target = row >= 2 ? null : arrangement.cells[row * 2 + Math.max(0, col)];
		if (target === spot.quadrant) return true;
		const matrix = resolvedMatrix(ctx.view.app, cfg);
		if (target === null && !matrix.showUnsorted) return true;
		moveTaskToQuadrant(ctx.view, cfg, matrix, spot.hit, target, refreshOf(ctx));
		return true;
	}
	if (spot.row === 2) return false;
	const other = spot.col === 0 ? 1 : 0;
	if ((evt.key === "ArrowLeft" && spot.col === 0) || (evt.key === "ArrowRight" && spot.col === 1)) return true;
	const here = spots.filter((s) => s.row === spot.row && s.col === spot.col).indexOf(spot);
	const there = spots.filter((s) => s.row === spot.row && s.col === other);
	const pick = there[Math.min(here, there.length - 1)];
	if (pick) ctx.select(spots.indexOf(pick));
	return true;
}

// ---- The renderer ---------------------------------------------------------------

export const tasksTui: TuiRenderer = {
	render(ctx) {
		const cfg = (ctx.card.tasks ??= {});
		const load = loaded(ctx, cfg);
		if (!load) return { lines: [[{ text: t().tui.cards.loading, style: "dim" }]] };
		if (load.kind === "message") return { lines: [[{ text: load.text, style: "dim" }]] };
		if (cfg.layout === "matrix") return matrixOutputFor(ctx, cfg, load);
		return cfg.layout === "kanban" ? boardOutputFor(ctx, cfg, load) : listOutputFor(ctx, cfg, load);
	},
	key(ctx, evt) {
		const cfg = (ctx.card.tasks ??= {});
		const load = ctx.state.load as TaskLoad | undefined;
		if (!load || load.kind !== "ok") return false;
		if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;
		switch (evt.key) {
			case "f":
				openTaskFilter(ctx.view, cfg, load.filterChoices, refreshOf(ctx));
				return true;
			case "s":
				if (cfg.layout === "kanban") return false;
				showMenuFor(taskSortMenu(ctx.view, cfg, statusesOf(cfg, load), refreshOf(ctx)), evt);
				return true;
			case "b":
				// Switch between the list and the board — the same setting as the
				// card's Layout, saved.
				cfg.layout = cfg.layout === "kanban" ? undefined : "kanban";
				void ctx.view.plugin.saveData(ctx.view.plugin.settings);
				ctx.redraw();
				return true;
			case "m":
				// The same for the matrix.
				cfg.layout = cfg.layout === "matrix" ? undefined : "matrix";
				void ctx.view.plugin.saveData(ctx.view.plugin.settings);
				ctx.redraw();
				return true;
		}
		if (cfg.layout === "kanban") return boardKey(ctx, cfg, load, evt);
		if (cfg.layout === "matrix" && matrixKey(ctx, cfg, evt)) return true;
		if (evt.key === "+") {
			addTask(ctx, cfg, load);
			return true;
		}
		return false;
	},
	menu(ctx, menu) {
		const cfg = (ctx.card.tasks ??= {});
		const load = ctx.state.load as TaskLoad | undefined;
		if (!load || load.kind !== "ok") return;
		menu.addItem((i) => i.setTitle(t().cards.tasks.filter).setIcon("list-filter").onClick(() => openTaskFilter(ctx.view, cfg, load.filterChoices, refreshOf(ctx))));
		menu.addItem((i) =>
			i
				.setTitle(cfg.layout === "kanban" ? t().tui.cards.showList : t().tui.cards.showBoard)
				.setIcon("columns-3")
				.onClick(() => {
					cfg.layout = cfg.layout === "kanban" ? undefined : "kanban";
					void ctx.view.plugin.saveData(ctx.view.plugin.settings);
					ctx.redraw();
				}),
		);
		menu.addItem((i) =>
			i
				.setTitle(cfg.layout === "matrix" ? t().tui.cards.showList : t().tui.cards.showMatrix)
				.setIcon("grid-2x2")
				.onClick(() => {
					cfg.layout = cfg.layout === "matrix" ? undefined : "matrix";
					void ctx.view.plugin.saveData(ctx.view.plugin.settings);
					ctx.redraw();
				}),
		);
		if (load.source === "kanban" || load.source === "tasknotes") {
			menu.addItem((i) => i.setTitle(t().cards.tasks.addCard).setIcon("plus").onClick(() => addTask(ctx, cfg, load)));
		}
	},
};

/** The statuses the custom-sort dialog offers: the checkbox statuses of a
 * checkbox card, the status values present otherwise. */
function statusesOf(cfg: TasksConfig, load: Extract<TaskLoad, { kind: "ok" }>): string[] {
	return load.source === "checkbox" ? checkboxStatuses(cfg).map((s) => s.label) : load.filterChoices.statuses;
}
