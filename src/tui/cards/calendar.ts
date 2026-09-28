/**
 * The calendar cards as text: the mini Calendar (a month like `cal`, or an
 * agenda) and the full Calendar (month, week, day and list views).
 *
 * Both read the same event sources the graphical cards do — subscribed ICS
 * feeds, TaskNotes, checkbox tasks, Operon — through the same context
 * (src/calendarsource.ts), and act the same: a day opens (or offers to
 * create) its daily note, a day with events offers them in a menu, an event
 * opens its details, a completable task ticks off.
 *
 * The event feeds load asynchronously and redraw the card when they land. The
 * context is kept across those redraws (see {@link eventsFor}) — rebuilding it
 * on every draw would start another load each time, and the card would never
 * stop redrawing.
 */
import { Component, type TFile } from "obsidian";
import { dailyNoteFinder, dailyNotesOptions, heatLevel, moment, activityByDay, type DailyNotesOptions, type Moment } from "../../cardbodies";
import {
	buildIcsContext,
	canComplete,
	openDailyNote,
	showDayMenu,
	showEventDetail,
	toggleTaskCompletion,
	type IcsContext,
} from "../../calendarsource";
import { buildOperonOverlay, type OperonOverlay } from "../../cards/calendar";
import {
	firstDay,
	hourLabel,
	listDays,
	offeredViews,
	scheduleState,
	step,
	timeFormat,
	viewRange,
	weekStart,
	type ScheduleState,
} from "../../cards/schedule";
import { formatRelativeDate } from "../../dates";
import { t } from "../../i18n";
import type { IcsOccurrence } from "../../ics";
import { openOperonTask } from "../../operon";
import { taskNotesEnabled, taskNotesMeta } from "../../tasknotes";
import { dayWindow, daySpan, overlapColumns, scrollHour, weekdayColumns } from "../../timegrid";
import type { CalendarSourcesConfig, DashboardCard, ScheduleConfig } from "../../types";
import type { TuiContext, TuiOutput, TuiRenderer } from "../card";
import { asciify, centerLine, fit, padEnd, padStart, spread, type Line, type Seg, type TuiStyle } from "../text";
import { listOutput, message, type Row } from "./common";

// ---- Event feeds, kept across redraws -------------------------------------------

interface Feeds {
	ics: IcsContext;
	operon: OperonOverlay | null;
}

/**
 * The card's event context. A redraw the feeds asked for themselves (a load
 * landed, a task was ticked) reuses the context it came from; any other draw —
 * a vault change, a board rebuild — builds a fresh one and starts it, exactly
 * as the graphical card builds one per draw.
 */
function eventsFor(
	ctx: TuiContext,
	cfg: CalendarSourcesConfig,
	sources: NonNullable<CalendarSourcesConfig["sources"]>,
	withOperon: boolean,
): Feeds {
	const own = ctx.state.feeds as Feeds | undefined;
	if (ctx.state.feedsSelf === true && own && ctx.state.feedsOwner === ctx.persistent) {
		ctx.state.feedsSelf = false;
		return own;
	}
	const old = ctx.state.feedsComponent as Component | undefined;
	if (old && ctx.state.feedsOwner === ctx.persistent) ctx.persistent.removeChild(old);
	const component = ctx.persistent.addChild(new Component());
	const ics = buildIcsContext(ctx.view, cfg, sources, component, false);
	const operon = withOperon ? buildOperonOverlay(ctx.view, cfg, component) : null;
	const again = () => {
		ctx.state.feedsSelf = true;
		ctx.redraw();
	};
	ics.onLoaded(again);
	operon?.onLoaded(again);
	const feeds: Feeds = { ics, operon };
	ctx.state.feeds = feeds;
	ctx.state.feedsComponent = component;
	ctx.state.feedsOwner = ctx.persistent;
	ics.start();
	return feeds;
}

// ---- Shared pieces ----------------------------------------------------------------

const untitled = () => t().cards.calendar.untitledEvent;

/** An event's colour bar, its time, its title and its chips — the agenda row
 * of the graphical card, as one line. A completable task leads with a box. */
function eventLine(ctx: TuiContext, ev: IcsOccurrence, ics: IcsContext, timeFmt: string, timeW: number): Line {
	const task = taskNotesMeta(ev);
	const chips = ics.chips;
	const line: Line = [];
	if (task && canComplete(task, ics)) {
		line.push({
			text: task.done ? "[x]" : "[ ]",
			style: task.done ? "green" : "accent",
			onClick: () => void toggleTaskCompletion(ctx.view, task, !task.done, ics),
			label: t().cards.calendar.taskComplete,
		});
	} else line.push({ text: " ▌ ", color: ics.eventColor(ev) });
	line.push({ text: " " });
	if (chips.time) {
		const time = ev.allDay ? t().cards.calendar.allDay : moment(new Date(ev.start)).format(timeFmt);
		line.push({ text: padEnd(time, timeW), style: "dim" });
	}
	line.push({
		text: asciify(ev.summary || untitled()),
		style: task?.done ? ["dim", "strike"] : undefined,
		onClick: () => showEventDetail(ctx.view, ev, ics),
		label: ev.summary || untitled(),
	});
	const badge = (text: string, color?: string) => line.push({ text: " " }, { text: asciify(text), style: "dim", color });
	if (task) {
		if (chips.due && task.kind === "due") badge(t().cards.calendar.taskDue, ics.eventColor(ev));
		if (chips.timeblock && task.kind === "timeblock") badge(t().cards.calendar.taskTimeblock);
		if (chips.recurring && task.recurring) badge(t().cards.tasks.recurring);
		if (chips.status && task.statusLabel) badge(task.statusLabel);
		if (chips.priority && task.priorityLabel) badge(task.priorityLabel);
	}
	if (chips.source && ics.multiSource) {
		const label = ics.label(ev.sourceId);
		if (label) badge(label);
	}
	return line;
}

/** The row for an event: its line, opening its details, ticking a task. */
function eventRow(ctx: TuiContext, ev: IcsOccurrence, ics: IcsContext, timeFmt: string, timeW: number): Row {
	const task = taskNotesMeta(ev);
	return {
		lines: eventLine(ctx, ev, ics, timeFmt, timeW),
		activate: () => showEventDetail(ctx.view, ev, ics),
		toggle: task && canComplete(task, ics) ? () => void toggleTaskCompletion(ctx.view, task, !task.done, ics) : undefined,
	};
}

/** Whether the card has anything to draw at all: daily notes, a feed, or a
 * task source. */
function hasSomething(ctx: TuiContext, cfg: CalendarSourcesConfig, options: DailyNotesOptions | null, sources: unknown[]): boolean {
	const useTasks = (cfg.taskNotes?.enabled === true && taskNotesEnabled(ctx.view.app)) || cfg.checkboxTasks?.enabled === true;
	return !!options || sources.length > 0 || useTasks;
}

const isTodayKey = (key: string) => key === moment().format("YYYY-MM-DD");

// ---- Mini calendar -------------------------------------------------------------------

function cursorOf(ctx: TuiContext): Moment {
	const at = ctx.state.day;
	return typeof at === "number" ? moment(at).startOf("day") : moment().startOf("day");
}

function setCursor(ctx: TuiContext, day: Moment): void {
	ctx.state.day = day.clone().startOf("day").valueOf();
}

/** Open a day the way the graphical grid does: its events in a menu when it
 * has any, else its daily note. */
function activateDay(ctx: TuiContext, day: Moment, ics: IcsContext, options: DailyNotesOptions | null, evt?: MouseEvent | KeyboardEvent, forceMenu = false): void {
	const key = day.format("YYYY-MM-DD");
	const events = ics.on(key);
	const file = options ? dailyNoteFinder(ctx.view, options)(day) : null;
	if (events.length || forceMenu) {
		const anchor = evt instanceof MouseEvent && (evt.clientX || evt.clientY) ? evt : (ctx.view.contentEl.querySelector<HTMLElement>(`.hearth-tui-body[data-card="${ctx.card.id}"]`) ?? ctx.view.contentEl);
		showDayMenu(ctx.view, day, options, file, isTodayKey(key), events, ics, anchor);
	} else openDailyNote(ctx.view, day, options, file, isTodayKey(key));
}

function miniGrid(ctx: TuiContext, cfg: NonNullable<DashboardCard["calendar"]>, feeds: Feeds, options: DailyNotesOptions | null): TuiOutput {
	const { ics, operon } = feeds;
	const cursor = cursorOf(ctx);
	const month = cursor.clone().startOf("month");
	ics.expand(month.clone().subtract(7, "days").valueOf(), month.clone().endOf("month").add(7, "days").valueOf());
	operon?.expand(month.clone().subtract(7, "days").format("YYYY-MM-DD"), month.clone().endOf("month").add(7, "days").format("YYYY-MM-DD"));
	const noteAt = options ? dailyNoteFinder(ctx.view, options) : null;
	const activity = cfg.heatmap ? activityByDay(ctx.view.app, cfg.heatmapMetric ?? "modified") : null;
	const weekNumbers = cfg.showWeekNumbers === true;
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const gridStart = month.clone().subtract((month.day() - startOfWeek + 7) % 7, "days");
	const cells = Math.ceil((month.clone().endOf("month").diff(gridStart, "days") + 1) / 7) * 7;
	// Four cells a day when the card has room (number, marker, a space), three
	// when it doesn't.
	const cellW = ctx.cols >= 28 + (weekNumbers ? 4 : 0) ? 4 : 3;
	const width = cellW * 7 + (weekNumbers ? cellW : 0);
	const pad = Math.max(0, Math.floor((ctx.cols - width) / 2));
	const lead: Seg = { text: " ".repeat(pad) };

	let peak = 1;
	if (activity) for (let i = 0; i < cells; i++) peak = Math.max(peak, activity.get(gridStart.clone().add(i, "days").format("YYYY-MM-DD")) ?? 0);

	const lines: Line[] = [];
	const prev: Seg = {
		text: "◂",
		style: "accent",
		onClick: () => {
			setCursor(ctx, cursor.clone().subtract(1, "month"));
			ctx.redraw();
		},
		label: t().cards.calendar.previousMonth,
	};
	const next: Seg = {
		text: "▸",
		style: "accent",
		onClick: () => {
			setCursor(ctx, cursor.clone().add(1, "month"));
			ctx.redraw();
		},
		label: t().cards.calendar.nextMonth,
	};
	const title = month.format("MMMM YYYY");
	lines.push([
		lead,
		prev,
		...fit(
			centerLine(
				[
					{
						text: title,
						style: "bold",
						onClick: () => {
							setCursor(ctx, moment());
							ctx.redraw();
						},
						label: t().cards.calendar.backToToday,
					},
				],
				Math.max(1, width - 2),
			),
			Math.max(1, width - 2),
		),
		next,
	]);
	const dow: Line = [lead];
	if (weekNumbers) dow.push({ text: padStart("wk", cellW - 1) + " ", style: "faint" });
	for (let i = 0; i < 7; i++) dow.push({ text: padStart(moment().day((startOfWeek + i) % 7).format("dd"), cellW - 1) + (cellW === 4 ? " " : ""), style: "dim" });
	lines.push(dow);

	const todayKey = moment().format("YYYY-MM-DD");
	const cursorKey = cursor.format("YYYY-MM-DD");
	for (let w = 0; w < cells / 7; w++) {
		const line: Line = [lead];
		if (weekNumbers) line.push({ text: padStart(gridStart.clone().add(w * 7, "days").format("W"), cellW - 1) + " ", style: "faint" });
		for (let d = 0; d < 7; d++) {
			const day = gridStart.clone().add(w * 7 + d, "days");
			const key = day.format("YYYY-MM-DD");
			const events = ics.on(key);
			const tasks = operon?.on(key) ?? [];
			const note = noteAt?.(day) ?? null;
			const style: TuiStyle[] = [];
			if (day.month() !== month.month()) style.push("faint");
			else if (activity) {
				const count = activity.get(key) ?? 0;
				const level = count > 0 ? heatLevel(count, peak) : 0;
				if (level > 0) style.push(`heat${level}` as TuiStyle);
			}
			if (note) style.push("bold");
			if (key === todayKey) style.push("reverse");
			if (ctx.focused && key === cursorKey) style.push("underline", "accent");
			line.push({
				text: padStart(String(day.date()), 2),
				style,
				onClick: (evt) => {
					setCursor(ctx, day);
					activateDay(ctx, day, ics, options, evt);
				},
				onMenu: (evt) => {
					setCursor(ctx, day);
					activateDay(ctx, day, ics, options, evt, true);
				},
				label: day.format("LL"),
			});
			const ev = events[0];
			if (ev) line.push({ text: "•", color: ics.eventColor(ev), style: taskNotesMeta(ev)?.done ? "faint" : undefined });
			else if (tasks.length && operon) line.push({ text: "▪", color: operon.color });
			else line.push({ text: " " });
			if (cellW === 4) line.push({ text: " " });
		}
		lines.push(line);
	}

	// The cursor day's agenda below the grid.
	const events = ics.on(cursorKey);
	const tasks = operon?.on(cursorKey) ?? [];
	lines.push([]);
	lines.push([
		{ text: cursor.format("ddd D MMM"), style: "bold" },
		{ text: `  ${formatRelativeDate(cursorKey)}`, style: "dim" },
	]);
	const rows: Row[] = events.map((ev) => eventRow(ctx, ev, ics, "LT", 9));
	for (const task of tasks) {
		rows.push({
			lines: [{ text: " ▪ ", color: operon?.color }, { text: asciify(task.description || t().cards.operon.untitled), style: task.checkbox !== "open" ? ["dim", "strike"] : undefined }],
			activate: () => void openOperonTask(ctx.view.app, task),
		});
	}
	if (!rows.length) lines.push([{ text: options ? t().tui.cards.calNothing : t().tui.cards.calNothingNoNotes, style: "faint" }]);
	const out = listOutput(rows, { lines });
	return { ...out, hint: events.length ? t().tui.cards.calEvents(events.length) : undefined, foot: t().tui.cards.calFoot };
}

function miniAgenda(ctx: TuiContext, cfg: NonNullable<DashboardCard["calendar"]>, feeds: Feeds, options: DailyNotesOptions | null): TuiOutput {
	const { ics, operon } = feeds;
	const days = cfg.agendaDays && cfg.agendaDays > 0 ? Math.min(cfg.agendaDays, 60) : 14;
	const start = moment().startOf("day");
	ics.expand(start.valueOf(), start.clone().add(days, "days").valueOf());
	operon?.expand(start.format("YYYY-MM-DD"), start.clone().add(days, "days").format("YYYY-MM-DD"));
	const noteAt = options ? dailyNoteFinder(ctx.view, options) : null;
	const rows: Row[] = [];
	let lastMonth = -1;
	for (let i = 0; i < days; i++) {
		const day = start.clone().add(i, "days");
		const key = day.format("YYYY-MM-DD");
		if (day.month() !== lastMonth) {
			lastMonth = day.month();
			rows.push({ lines: [{ text: day.format("MMMM YYYY"), style: "faint" }], inert: true });
		}
		const file = noteAt?.(day) ?? null;
		const events = ics.on(key);
		const head: Line = [
			{ text: padEnd(day.format("ddd D"), 7), style: i === 0 ? ["bold", "accent"] : "bold" },
			{ text: formatRelativeDate(key), style: i === 0 ? "accent" : undefined },
		];
		if (file) head.push({ text: " ·", style: "accent" });
		else if (!events.length && options) head.push({ text: `  ${t().cards.calendar.agendaNoNote}`, style: "faint" });
		rows.push({
			lines: head,
			activate: options ? () => openDailyNote(ctx.view, day, options, file, i === 0) : undefined,
			inert: !options,
		});
		for (const ev of events) rows.push(eventRow(ctx, ev, ics, "LT", 9));
		for (const task of operon?.on(key) ?? []) {
			rows.push({
				lines: [{ text: " ▪ ", color: operon?.color }, { text: " " }, { text: asciify(task.description || t().cards.operon.untitled), style: task.checkbox !== "open" ? ["dim", "strike"] : undefined }],
				activate: () => void openOperonTask(ctx.view.app, task),
			});
		}
	}
	return { ...listOutput(rows), foot: t().tui.cards.agendaFoot };
}

export const calendarTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.calendar ?? {};
		const options = dailyNotesOptions(ctx.view);
		const sources = (cfg.sources ?? []).filter((s) => s.url.trim() && s.enabled !== false);
		if (!hasSomething(ctx, cfg, options, sources)) return { lines: message(t().cards.empty.dailyEnable, ctx.cols) };
		const feeds = eventsFor(ctx, cfg, sources, true);
		return cfg.view === "agenda" ? miniAgenda(ctx, cfg, feeds, options) : miniGrid(ctx, cfg, feeds, options);
	},
	key(ctx, evt) {
		const cfg = ctx.card.calendar ?? {};
		if (cfg.view === "agenda") return false;
		const feeds = ctx.state.feeds as Feeds | undefined;
		const cursor = cursorOf(ctx);
		const move: Record<string, [number, "days" | "months"]> = {
			ArrowLeft: [-1, "days"],
			ArrowRight: [1, "days"],
			ArrowUp: [-7, "days"],
			ArrowDown: [7, "days"],
			PageUp: [-1, "months"],
			PageDown: [1, "months"],
		};
		const m = move[evt.key];
		if (m) {
			setCursor(ctx, cursor.clone().add(m[0], m[1]));
			ctx.state.feedsSelf = true;
			ctx.redraw();
			return true;
		}
		if (evt.key === "Home") {
			setCursor(ctx, moment());
			ctx.state.feedsSelf = true;
			ctx.redraw();
			return true;
		}
		if ((evt.key === "Enter" || evt.key === "ContextMenu") && feeds) {
			activateDay(ctx, cursor, feeds.ics, dailyNotesOptions(ctx.view), evt, evt.key === "ContextMenu");
			return true;
		}
		return false;
	},
};

// ---- Full calendar ------------------------------------------------------------------

interface SchedCtx {
	ctx: TuiContext;
	cfg: ScheduleConfig;
	state: ScheduleState;
	ics: IcsContext;
	options: DailyNotesOptions | null;
	noteAt: ((day: Moment) => TFile | null) | null;
}

function redrawSelf(ctx: TuiContext): void {
	ctx.state.feedsSelf = true;
	ctx.redraw();
}

function toolbar(s: SchedCtx, label: string): Line {
	const { ctx, cfg, state } = s;
	const strings = t().cards.schedule;
	const nav: Line = [
		{ text: "◂", style: "accent", onClick: () => { step(state, cfg, -1); redrawSelf(ctx); }, label: strings.previous },
		{ text: " " },
		{ text: `[${strings.today}]`, style: "accent", onClick: () => { state.anchor = moment().startOf("day").valueOf(); redrawSelf(ctx); } },
		{ text: " " },
		{ text: "▸", style: "accent", onClick: () => { step(state, cfg, 1); redrawSelf(ctx); }, label: strings.next },
		{ text: "  " },
		{ text: asciify(label), style: "bold" },
	];
	const views = offeredViews(cfg);
	if (views.length < 2) return fit(nav, ctx.cols);
	const right: Line = [];
	for (const v of views) {
		right.push({ text: " " });
		right.push({
			text: ` ${t().cards.schedule.views[v]} `,
			style: v === state.view ? ["reverse", "bold"] : "dim",
			onClick: () => {
				state.view = v;
				redrawSelf(ctx);
			},
		});
	}
	return spread(nav, right, ctx.cols);
}

function dayCursor(s: SchedCtx): Moment {
	const at = s.ctx.state.day;
	const anchor = moment(s.state.anchor).startOf("day");
	if (typeof at !== "number") return anchor;
	const day = moment(at).startOf("day");
	const range = viewRange(s.state, s.cfg);
	return day.valueOf() >= range.start.valueOf() && day.valueOf() < range.end.valueOf() ? day : anchor;
}

function zoomToDay(s: SchedCtx, day: Moment): void {
	if (!offeredViews(s.cfg).includes("day")) {
		openDailyNote(s.ctx.view, day, s.options, s.noteAt?.(day) ?? null, isTodayKey(day.format("YYYY-MM-DD")));
		return;
	}
	s.state.view = "day";
	s.state.anchor = day.clone().startOf("day").valueOf();
	redrawSelf(s.ctx);
}

function monthView(s: SchedCtx): Line[] {
	const { ctx, cfg, ics, state } = s;
	const first = firstDay(cfg);
	const columns = weekdayColumns(first, cfg.hideWeekends === true);
	const anchor = moment(state.anchor).startOf("month");
	const gridStart = weekStart(anchor, cfg);
	const weeks = Math.ceil((anchor.clone().endOf("month").diff(gridStart, "days") + 1) / 7);
	const wk = cfg.weekNumbers === true ? 3 : 0;
	const cw = Math.max(4, Math.floor((ctx.cols - wk - (columns.length - 1)) / columns.length));
	const max = cfg.maxPerDay === undefined ? 3 : Math.max(0, Math.round(cfg.maxPerDay));
	const cursorKey = dayCursor(s).format("YYYY-MM-DD");
	const lines: Line[] = [];

	const head: Line = wk ? [{ text: "   " }] : [];
	columns.forEach((dow, i) => {
		head.push({ text: padEnd(moment().day(dow).format("ddd"), cw), style: "header" });
		if (i < columns.length - 1) head.push({ text: " ", style: "header" });
	});
	lines.push(head);

	for (let w = 0; w < weeks; w++) {
		const weekFirst = gridStart.clone().add(w * 7, "days");
		const days = columns.map((dow) => weekFirst.clone().add((dow - first + 7) % 7, "days"));
		const perDay = days.map((d) => ics.on(d.format("YYYY-MM-DD")));
		const shownN = Math.max(1, ...perDay.map((ev) => Math.min(max > 0 ? max : ev.length, ev.length) + (max > 0 && ev.length > max ? 1 : 0)));
		for (let r = 0; r <= shownN; r++) {
			const line: Line = wk ? [{ text: r === 0 ? padStart(weekFirst.format("W"), 2) + " " : "   ", style: "faint" }] : [];
			days.forEach((day, i) => {
				const key = day.format("YYYY-MM-DD");
				const events = perDay[i];
				let cell: Line;
				if (r === 0) {
					const style: TuiStyle[] = day.month() !== anchor.month() ? ["faint"] : ["bold"];
					if (isTodayKey(key)) style.push("reverse");
					if (ctx.focused && key === cursorKey) style.push("underline", "accent");
					const note = s.noteAt?.(day) ?? null;
					const date = String(day.date());
					const mark = note ? " ·" : "";
					cell = [
						{
							text: date,
							style,
							onClick: () => (s.options ? openDailyNote(ctx.view, day, s.options, note, isTodayKey(key)) : zoomToDay(s, day)),
							label: day.format("dddd, LL"),
						},
						{ text: mark, style: "accent" },
					];
					// The rest of the day's first row zooms to the day.
					const rest = cw - date.length - mark.length;
					if (rest > 0) cell.push({ text: " ".repeat(rest), onClick: () => zoomToDay(s, day), label: day.format("dddd, LL") });
				} else {
					const limit = max > 0 ? max : events.length;
					const ev = events[r - 1];
					if (ev && r - 1 < limit) {
						if (cfg.monthStyle === "dots") {
							cell = r === 1 ? events.slice(0, limit).map((e) => ({ text: "•", color: ics.eventColor(e), onClick: () => showEventDetail(ctx.view, e, ics), label: e.summary || untitled() })) : [];
						} else {
							const time = ev.allDay ? "" : moment(new Date(ev.start)).format(timeFormat(cfg));
							cell = [
								{ text: "▌", color: ics.eventColor(ev) },
								{
									text: asciify(`${time ? time + " " : ""}${ev.summary || untitled()}`),
									style: taskNotesMeta(ev)?.done ? ["dim", "strike"] : undefined,
									onClick: () => showEventDetail(ctx.view, ev, ics),
									label: ev.summary || untitled(),
								},
							];
						}
					} else if (max > 0 && r - 1 === limit && events.length > limit) {
						cell = [
							{
								text: t().cards.schedule.more(events.length - limit),
								style: "dim",
								onClick: (evt) => showDayMenu(ctx.view, day, s.options, s.noteAt?.(day) ?? null, isTodayKey(key), events, ics, evt instanceof MouseEvent ? evt : ctx.view.contentEl),
							},
						];
					} else cell = [];
				}
				line.push(...fit(cell, cw));
				if (i < days.length - 1) line.push({ text: " " });
			});
			lines.push(line);
		}
		if (w < weeks - 1) lines.push([{ text: "─".repeat(ctx.cols), style: "rule" }]);
	}
	return lines;
}

function timeGrid(s: SchedCtx): { lines: Line[]; scrollTo: number; top: number } {
	const { ctx, cfg, ics, state } = s;
	const anchor = moment(state.anchor).startOf("day");
	const days =
		state.view === "day"
			? [anchor]
			: weekdayColumns(firstDay(cfg), cfg.hideWeekends === true).map((dow) => weekStart(anchor, cfg).add((dow - firstDay(cfg) + 7) % 7, "days"));
	const win = dayWindow(cfg.dayStart, cfg.dayEnd);
	const gutter = 6;
	const cw = Math.max(4, Math.floor((ctx.cols - gutter - (days.length - 1)) / days.length));
	// Two rows an hour when the card is tall enough to show a working day that
	// way, one otherwise.
	const perHour = ctx.zoomed || ctx.rows >= 2 * 10 + 3 ? 2 : 1;
	const slotMin = 60 / perHour;
	const cursorKey = dayCursor(s).format("YYYY-MM-DD");
	const lines: Line[] = [];

	const head: Line = [{ text: " ".repeat(gutter) }];
	days.forEach((day, i) => {
		const key = day.format("YYYY-MM-DD");
		const style: TuiStyle[] = ["header"];
		if (isTodayKey(key)) style.push("bold");
		if (ctx.focused && key === cursorKey && days.length > 1) style[0] = "header-sort";
		const note = s.noteAt?.(day) ? " ·" : "";
		head.push({ text: padEnd(`${day.format("ddd D")}${note}`, cw), style, onClick: () => zoomToDay(s, day), label: day.format("dddd, LL") });
		if (i < days.length - 1) head.push({ text: " ", style: "header" });
	});
	lines.push(head);

	// Everything without an hour of its own: all-day events, and timed ones
	// outside the drawn window.
	const allDay = days.map((day) => {
		const start = day.clone().startOf("day").valueOf();
		return ics.on(day.format("YYYY-MM-DD")).filter((ev) => ev.allDay || daySpan(ev.start, ev.end, start, win) === null);
	});
	if (allDay.some((a) => a.length)) {
		const n = Math.max(...allDay.map((a) => a.length));
		for (let r = 0; r < Math.min(n, 3); r++) {
			const line: Line = [{ text: r === 0 ? padEnd(t().tui.cards.allDayShort, gutter) : " ".repeat(gutter), style: "dim" }];
			allDay.forEach((events, i) => {
				const ev = events[r];
				const cell: Line = ev
					? [{ text: "▌", color: ics.eventColor(ev) }, { text: asciify(ev.summary || untitled()), onClick: () => showEventDetail(ctx.view, ev, ics) }]
					: [];
				line.push(...fit(r === 2 && events.length > 3 ? [{ text: t().cards.schedule.more(events.length - 2), style: "dim" }] : cell, cw));
				if (i < allDay.length - 1) line.push({ text: " " });
			});
			lines.push(line);
		}
	}
	const gridTop = lines.length;

	// Place every timed event in its column, overlapping ones side by side.
	type Placed = { ev: IcsOccurrence; start: number; end: number; col: number; cols: number };
	const placed: Placed[][] = days.map((day) => {
		const start = day.clone().startOf("day").valueOf();
		const spans = ics
			.on(day.format("YYYY-MM-DD"))
			.filter((ev) => !ev.allDay)
			.map((ev) => ({ ev, span: daySpan(ev.start, ev.end, start, win, slotMin) }))
			.filter((p): p is { ev: IcsOccurrence; span: NonNullable<ReturnType<typeof daySpan>> } => p.span !== null);
		const cols = overlapColumns(spans.map((p) => p.span));
		return spans.map((p, i) => ({ ev: p.ev, start: p.span.startMin, end: p.span.endMin, col: cols[i].column, cols: cols[i].columns }));
	});

	const nowMin = moment().hours() * 60 + moment().minutes();
	for (let h = win.startHour; h < win.endHour; h++) {
		for (let k = 0; k < perHour; k++) {
			const slotStart = h * 60 + k * slotMin;
			const slotEnd = slotStart + slotMin;
			const nowHere = nowMin >= slotStart && nowMin < slotEnd && days.some((d) => isTodayKey(d.format("YYYY-MM-DD")));
			const label = k === 0 ? padEnd(hourLabel(h, cfg), gutter - 1) + (nowHere ? "▶" : " ") : " ".repeat(gutter - 1) + (nowHere ? "▶" : " ");
			const line: Line = [{ text: label, style: nowHere ? "red" : "faint" }];
			days.forEach((day, i) => {
				const today = isTodayKey(day.format("YYYY-MM-DD"));
				const inSlot = placed[i].filter((p) => p.start < slotEnd && p.end > slotStart);
				let cell: Line;
				if (!inSlot.length) {
					cell = [{ text: (k === 0 ? "·" : " ").padEnd(cw, " "), style: today && nowHere ? "red" : "faint" }];
				} else {
					const maxCols = Math.max(...inSlot.map((p) => p.cols));
					const sub = Math.max(1, Math.floor(cw / maxCols));
					cell = [];
					for (let c = 0; c < maxCols; c++) {
						const p = inSlot.find((x) => x.col === c);
						const w = c === maxCols - 1 ? cw - sub * (maxCols - 1) : sub;
						if (!p) {
							cell.push({ text: " ".repeat(w) });
							continue;
						}
						const startsHere = p.start >= slotStart && p.start < slotEnd;
						const text = startsHere ? `${moment(new Date(p.ev.start)).format(timeFormat(cfg))} ${p.ev.summary || untitled()}` : "";
						cell.push(
							...fit(
								[
									{ text: "▌", color: ics.eventColor(p.ev) },
									{
										text: asciify(text),
										style: taskNotesMeta(p.ev)?.done ? ["dim", "strike"] : startsHere ? "bold" : undefined,
										onClick: () => showEventDetail(ctx.view, p.ev, ics),
										label: p.ev.summary || untitled(),
									},
								],
								w,
							),
						);
					}
				}
				line.push(...fit(cell, cw));
				if (i < days.length - 1) line.push({ text: " " });
			});
			lines.push(line);
		}
	}

	// Open on the earliest event (or the morning), like the graphical grid.
	const ruler = days[0].clone().startOf("day").valueOf();
	const starts = days.flatMap((d) => {
		const shift = ruler - d.clone().startOf("day").valueOf();
		return ics.on(d.format("YYYY-MM-DD")).filter((ev) => !ev.allDay).map((ev) => ev.start + shift);
	});
	const firstHour = scrollHour(starts, ruler, win);
	return { lines, scrollTo: Math.max(0, gridTop + (firstHour - win.startHour) * perHour - 1), top: gridTop };
}

function listView(s: SchedCtx): Row[] {
	const { ctx, cfg, ics, state } = s;
	const start = moment(state.anchor).startOf("day");
	const days = listDays(cfg);
	const rows: Row[] = [];
	for (let i = 0; i < days; i++) {
		const day = start.clone().add(i, "days");
		const key = day.format("YYYY-MM-DD");
		const events = ics.on(key);
		const note = s.noteAt?.(day) ?? null;
		if (!events.length && !note) continue;
		rows.push({
			lines: [
				{ text: padEnd(day.format("ddd D MMM"), 12), style: isTodayKey(key) ? ["bold", "accent"] : "bold" },
				{ text: formatRelativeDate(key), style: "dim" },
				{ text: note ? " ·" : "", style: "accent" },
			],
			activate: s.options ? () => openDailyNote(ctx.view, day, s.options, note, isTodayKey(key)) : undefined,
			inert: !s.options,
		});
		for (const ev of events) rows.push(eventRow(ctx, ev, ics, timeFormat(cfg), 9));
	}
	if (!rows.length) rows.push({ lines: [{ text: t().cards.schedule.listEmpty(days), style: "dim" }], inert: true });
	return rows;
}

export const scheduleTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.schedule ?? {};
		const sources = (cfg.sources ?? []).filter((s) => s.url.trim() && s.enabled !== false);
		const options = cfg.dailyNotes === false ? null : dailyNotesOptions(ctx.view);
		if (!hasSomething(ctx, cfg, options, sources)) return { lines: message(t().cards.empty.scheduleNoSources, ctx.cols) };
		const { ics } = eventsFor(ctx, cfg, sources, false);
		const state = scheduleState(ctx.card, cfg);
		const range = viewRange(state, cfg);
		ics.expand(range.start.clone().subtract(7, "days").valueOf(), range.end.clone().add(7, "days").valueOf());
		const s: SchedCtx = { ctx, cfg, state, ics, options, noteAt: options ? dailyNoteFinder(ctx.view, options) : null };
		const head: Line[] = cfg.hideToolbar === true ? [] : [toolbar(s, range.label)];
		const foot = t().tui.cards.schedFoot;
		if (state.view === "list") return { ...listOutput(listView(s), { lines: head }), foot, sticky: head.length };
		// The toolbar and the weekday header stay put while the grid scrolls.
		if (state.view === "month") return { lines: [...head, ...monthView(s)], foot, sticky: head.length + 1 };
		const grid = timeGrid(s);
		return { lines: [...head, ...grid.lines], scrollTo: grid.scrollTo + head.length, foot, sticky: head.length + grid.top };
	},
	key(ctx, evt) {
		const cfg = ctx.card.schedule ?? {};
		const state = scheduleState(ctx.card, cfg);
		const views = offeredViews(cfg);
		switch (evt.key) {
			case "PageUp":
			case "[":
				step(state, cfg, -1);
				redrawSelf(ctx);
				return true;
			case "PageDown":
			case "]":
				step(state, cfg, 1);
				redrawSelf(ctx);
				return true;
			case "Home":
				state.anchor = moment().startOf("day").valueOf();
				ctx.state.day = state.anchor;
				redrawSelf(ctx);
				return true;
			case "v": {
				const i = views.indexOf(state.view);
				state.view = views[(i + 1) % views.length];
				redrawSelf(ctx);
				return true;
			}
		}
		if (state.view === "list") return false;
		const feeds = ctx.state.feeds as Feeds | undefined;
		const options = cfg.dailyNotes === false ? null : dailyNotesOptions(ctx.view);
		const at = typeof ctx.state.day === "number" ? moment(ctx.state.day).startOf("day") : moment(state.anchor).startOf("day");
		const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: state.view === "month" ? -7 : 0, ArrowDown: state.view === "month" ? 7 : 0 };
		const d = delta[evt.key];
		if (d) {
			const next = at.clone().add(d, "days");
			ctx.state.day = next.valueOf();
			const range = viewRange(state, cfg);
			if (next.valueOf() < range.start.valueOf() || next.valueOf() >= range.end.valueOf()) state.anchor = next.valueOf();
			redrawSelf(ctx);
			return true;
		}
		if (evt.key === "Enter" && feeds) {
			if (state.view === "day") activateDay(ctx, at, feeds.ics, options, evt);
			else if (offeredViews(cfg).includes("day")) {
				state.view = "day";
				state.anchor = at.valueOf();
				redrawSelf(ctx);
			} else activateDay(ctx, at, feeds.ics, options, evt);
			return true;
		}
		if (evt.key === "ContextMenu" && feeds) {
			activateDay(ctx, at, feeds.ics, options, evt, true);
			return true;
		}
		return false;
	},
};
