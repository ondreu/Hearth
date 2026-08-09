import { Component, setIcon, setTooltip, Setting, TFile } from "obsidian";
import {
	dailyNotePath,
	dailyNotesOptions,
	emptyState,
	moment,
	type DailyNotesOptions,
	type Moment,
} from "../cardbodies";
import {
	buildIcsContext,
	calendarChipsEditor,
	calendarSourcesEditor,
	openDailyNote,
	renderEventRow,
	showDayMenu,
	showEventDetail,
	taskNotesSourceEditor,
	type IcsContext,
} from "../calendarsource";
import { formatRelativeDate } from "../dates";
import { addResetButton } from "../editors";
import { t } from "../i18n";
import { type IcsOccurrence } from "../ics";
import { taskNotesEnabled, taskNotesMeta } from "../tasknotes";
import {
	blockLines,
	dayWindow,
	daySpan,
	MIN_BLOCK_PX,
	overlapColumns,
	scrollHour,
	weekdayColumns,
	type DaySpan,
	type DayWindow,
} from "../timegrid";
import { type DashboardCard, type ScheduleConfig, type ScheduleView } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Calendar (full) -----------------------------------------------------

/**
 * The Calendar card: a real month / week / day / list calendar over the same
 * event sources the mini calendar uses (ICS feeds, TaskNotes, daily notes).
 *
 * Where the mini calendar is a month at a glance — dots on a small grid — this
 * one is the calendar you look at to plan a day: named events in the month
 * cells, a scrolling time grid for the week and the day with overlapping
 * events side by side and a current-time line, and a grouped list of what's
 * coming. Everything else is deliberately defaulted rather than asked for: the
 * locale's week start and clock, the whole day drawn in the time grid so
 * nothing can hide outside the visible hours, four views in the toolbar, and
 * today's daily note one click away.
 */
export function renderSchedule(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.schedule ?? {};
	const sources = (cfg.sources ?? []).filter((s) => s.url.trim() && s.enabled !== false);
	const useTaskNotes = cfg.taskNotes?.enabled === true && taskNotesEnabled(view.app);
	const options = cfg.dailyNotes === false ? null : dailyNotesOptions(view);

	// Same rule as the mini calendar: the card needs at least one thing to draw
	// — daily notes, a subscribed calendar, or TaskNotes.
	if (!options && sources.length === 0 && !useTaskNotes) {
		emptyState(body, "calendar-range", t().cards.empty.scheduleNoSources);
		return;
	}

	const state = scheduleState(card, cfg);
	const ics = buildIcsContext(view, cfg, sources, component);
	const wrap = body.createDiv("hearth-sched");

	const draw = (): void => {
		wrap.empty();
		// The live view, exposed for user CSS snippets ([data-view="week"]).
		wrap.dataset.view = state.view;
		const range = viewRange(state, cfg);
		// One window per draw, padded by a week each way: the month grid draws
		// the tail of the previous month and the head of the next, and those
		// days carry events too.
		ics.expand(
			range.start.clone().subtract(7, "days").valueOf(),
			range.end.clone().add(7, "days").valueOf(),
		);
		if (cfg.hideToolbar !== true) renderToolbar(wrap, state, cfg, range.label, draw);
		const main = wrap.createDiv("hearth-sched-body");
		const ctx: ViewContext = { view, cfg, options, ics, component, redraw: draw };
		if (state.view === "month") renderMonth(main, state, ctx);
		else if (state.view === "list") renderList(main, state, ctx);
		else renderTimeGrid(main, state, ctx);
	};

	ics.onLoaded(draw);
	draw();
	ics.start();
}


/** Everything a view renderer needs beyond its own layout maths. */
interface ViewContext {
	view: HomeView;
	cfg: ScheduleConfig;
	/** Daily-notes settings, or null when the card doesn't touch daily notes. */
	options: DailyNotesOptions | null;
	ics: IcsContext;
	component: Component;
	/** Redraw the whole card (after navigating or switching view). */
	redraw: () => void;
}


// ---- Navigation state ----------------------------------------------------

/** Which view a card is on and which period it is looking at. */
interface ScheduleState {
	view: ScheduleView;
	/** Any day inside the shown period, as epoch ms of its local midnight. */
	anchor: number;
}

/**
 * Where each card is parked, keyed by card id.
 *
 * The card is rebuilt wholesale on every vault change (liveness: "vault"), and
 * its Component — the only thing with a lifecycle — is replaced on each of
 * those redraws. Keeping the cursor there would snap the calendar back to this
 * month the moment any note was saved, so it lives here instead: navigation
 * survives redraws, and resets when Obsidian reloads. Two numbers per card ever
 * opened, so there is nothing to reclaim.
 */
const SCHEDULE_STATE = new Map<string, ScheduleState>();

/** The card's live state, seeded from its configured default view. Also
 * re-seeds when the configured view changes under a card that was never
 * navigated, so editing the setting shows its effect immediately. */
function scheduleState(card: DashboardCard, cfg: ScheduleConfig): ScheduleState {
	const configured = offeredViews(cfg);
	const preferred = configured.includes(cfg.view ?? "month") ? (cfg.view ?? "month") : configured[0];
	const existing = SCHEDULE_STATE.get(card.id);
	if (existing && configured.includes(existing.view)) return existing;
	const state: ScheduleState = { view: preferred, anchor: moment().startOf("day").valueOf() };
	SCHEDULE_STATE.set(card.id, state);
	return state;
}

/** Forget a card's cursor, so the editor's "opens in" setting takes effect on
 * the next draw rather than being overridden by where the user had navigated. */
function resetScheduleState(cardId: string): void {
	SCHEDULE_STATE.delete(cardId);
}

/** Every view, in toolbar order. */
const ALL_VIEWS: ScheduleView[] = ["month", "week", "day", "list"];

/** The views this card offers, always at least one. */
function offeredViews(cfg: ScheduleConfig): ScheduleView[] {
	const picked = ALL_VIEWS.filter((v) => cfg.views?.includes(v));
	return picked.length ? picked : ALL_VIEWS;
}


// ---- Period maths --------------------------------------------------------

/** The days a view covers, plus the label the toolbar shows for them. */
interface ViewRange {
	start: Moment;
	/** Exclusive end. */
	end: Moment;
	label: string;
}

/** The first day of the week containing `day`, honouring the card's week start. */
function weekStart(day: Moment, cfg: ScheduleConfig): Moment {
	const first = firstDay(cfg);
	const back = (day.day() - first + 7) % 7;
	return day.clone().startOf("day").subtract(back, "days");
}

/** The configured week start, or the locale's when unset. */
function firstDay(cfg: ScheduleConfig): number {
	const configured = cfg.firstDay;
	if (configured === undefined || !Number.isFinite(configured)) {
		return moment.localeData().firstDayOfWeek();
	}
	return ((Math.round(configured) % 7) + 7) % 7;
}

function viewRange(state: ScheduleState, cfg: ScheduleConfig): ViewRange {
	const anchor = moment(state.anchor).startOf("day");
	if (state.view === "month") {
		const start = anchor.clone().startOf("month");
		return { start, end: start.clone().add(1, "month"), label: start.format("MMMM YYYY") };
	}
	if (state.view === "day") {
		return { start: anchor, end: anchor.clone().add(1, "day"), label: anchor.format("dddd, LL") };
	}
	if (state.view === "list") {
		const days = listDays(cfg);
		const end = anchor.clone().add(days, "days");
		return {
			start: anchor,
			end,
			label: `${anchor.format("ll")} – ${end.clone().subtract(1, "day").format("ll")}`,
		};
	}
	const start = weekStart(anchor, cfg);
	const end = start.clone().add(7, "days");
	const last = end.clone().subtract(1, "day");
	// "1 – 7 September 2026" when the week sits in one month, spelled out on
	// both sides when it straddles two.
	const label =
		start.month() === last.month()
			? `${start.format("D")} – ${last.format("D MMMM YYYY")}`
			: `${start.format("D MMM")} – ${last.format("D MMM YYYY")}`;
	return { start, end, label };
}

/** Move the cursor one period in either direction. */
function step(state: ScheduleState, cfg: ScheduleConfig, delta: number): void {
	const anchor = moment(state.anchor).startOf("day");
	const moved =
		state.view === "month"
			? anchor.add(delta, "month")
			: state.view === "week"
				? anchor.add(delta * 7, "days")
				: state.view === "day"
					? anchor.add(delta, "day")
					: anchor.add(delta * listDays(cfg), "days");
	state.anchor = moved.valueOf();
}

/** How many days the list view spans. */
function listDays(cfg: ScheduleConfig): number {
	const days = cfg.listDays;
	return days && days > 0 ? Math.min(Math.round(days), 90) : 14;
}


// ---- Toolbar -------------------------------------------------------------

/** The card's one navigation surface: back / today / forward, the period it is
 * showing, and the view switcher. Every view uses it, so moving between them
 * never moves the controls. */
function renderToolbar(
	wrap: HTMLElement,
	state: ScheduleState,
	cfg: ScheduleConfig,
	label: string,
	redraw: () => void,
): void {
	const strings = t().cards.schedule;
	const bar = wrap.createDiv("hearth-sched-toolbar");

	const nav = bar.createDiv("hearth-sched-nav");
	const navButton = (icon: string, aria: string, onClick: () => void): void => {
		const btn = nav.createEl("button", { cls: "hearth-sched-navbtn", attr: { "aria-label": aria } });
		setIcon(btn, icon);
		btn.addEventListener("click", onClick);
	};
	navButton("chevron-left", strings.previous, () => {
		step(state, cfg, -1);
		redraw();
	});
	const today = nav.createEl("button", { cls: "hearth-sched-today", text: strings.today });
	today.addEventListener("click", () => {
		state.anchor = moment().startOf("day").valueOf();
		redraw();
	});
	navButton("chevron-right", strings.next, () => {
		step(state, cfg, 1);
		redraw();
	});

	bar.createDiv({ cls: "hearth-sched-title", text: label });

	const views = offeredViews(cfg);
	// One view on offer is not a choice — the label alone says where you are.
	if (views.length < 2) return;
	const switcher = bar.createDiv("hearth-sched-views");
	for (const v of views) {
		const btn = switcher.createEl("button", { cls: "hearth-sched-view", text: viewName(v) });
		btn.toggleClass("is-active", v === state.view);
		btn.setAttribute("aria-pressed", String(v === state.view));
		btn.addEventListener("click", () => {
			if (v === state.view) return;
			state.view = v;
			redraw();
		});
	}
}

function viewName(view: ScheduleView): string {
	return t().cards.schedule.views[view];
}


// ---- Shared day helpers --------------------------------------------------

/** The daily note for a day, when the card is showing daily notes at all. */
function noteFor(ctx: ViewContext, day: Moment): TFile | null {
	if (!ctx.options) return null;
	const file = ctx.view.app.vault.getAbstractFileByPath(dailyNotePath(day, ctx.options));
	return file instanceof TFile ? file : null;
}

/** Clicking a day's number: its daily note, opened or offered for creation.
 * With daily notes off there is no note to open, so it zooms in instead. */
function openDayNote(ctx: ViewContext, state: ScheduleState, day: Moment): void {
	if (!ctx.options) {
		zoomToDay(ctx, state, day);
		return;
	}
	openDailyNote(ctx.view, day, ctx.options, noteFor(ctx, day), isToday(day));
}


/** Clicking a day's empty space or its column header: zoom into the day view —
 * what every calendar does. A card that doesn't offer the day view falls back
 * to the day's note, so the click is never inert. */
function zoomToDay(ctx: ViewContext, state: ScheduleState, day: Moment): void {
	if (!offeredViews(ctx.cfg).includes("day")) {
		if (ctx.options) openDayNote(ctx, state, day);
		return;
	}
	state.view = "day";
	state.anchor = day.clone().startOf("day").valueOf();
	ctx.redraw();
}

function isToday(day: Moment): boolean {
	return day.format("YYYY-MM-DD") === moment().format("YYYY-MM-DD");
}

/** The moment format for an event's time, honouring the card's clock setting
 * and otherwise the locale's own. */
function timeFormat(cfg: ScheduleConfig): string {
	if (cfg.clock === "24") return "HH:mm";
	if (cfg.clock === "12") return "h:mm A";
	return "LT";
}

/** An event's start time, as the card writes it on a chip. */
function chipTime(ev: IcsOccurrence, cfg: ScheduleConfig): string {
	return ev.allDay ? "" : moment(new Date(ev.start)).format(timeFormat(cfg));
}

/** One event chip — the shared building block of the month cells and the
 * all-day rows: a colour, an optional time, and the title. Clicking it opens
 * the same event popup the mini calendar uses. */
function eventChip(parent: HTMLElement, ev: IcsOccurrence, ctx: ViewContext): void {
	const task = taskNotesMeta(ev);
	const chip = parent.createDiv("hearth-sched-chip");
	chip.style.setProperty("--ev-color", ctx.ics.eventColor(ev));
	chip.toggleClass("is-allday", ev.allDay);
	chip.toggleClass("is-done", task?.done === true);
	if (!ev.allDay) {
		chip.createSpan({ cls: "hearth-sched-chiptime", text: chipTime(ev, ctx.cfg) });
	}
	chip.createSpan({
		cls: "hearth-sched-chiptitle",
		text: ev.summary || t().cards.calendar.untitledEvent,
	});
	const open = (e?: MouseEvent) => {
		e?.stopPropagation();
		showEventDetail(ctx.view, ev, ctx.ics);
	};
	chip.addEventListener("click", open);
	makeClickable(chip, () => open(), ev.summary || t().cards.calendar.untitledEvent);
}


// ---- Month view ----------------------------------------------------------

/** The month grid: one cell per day, each listing its events by name. Days
 * outside the month are dimmed but drawn, so the weeks either side stay
 * readable — the ones you actually plan across. */
function renderMonth(main: HTMLElement, state: ScheduleState, ctx: ViewContext): void {
	const cfg = ctx.cfg;
	const first = firstDay(cfg);
	const columns = weekdayColumns(first, cfg.hideWeekends === true);
	const anchor = moment(state.anchor).startOf("month");
	const grid = main.createDiv("hearth-sched-month");
	grid.style.setProperty("--sched-cols", String(columns.length));
	grid.toggleClass("has-week-numbers", cfg.weekNumbers === true);
	grid.toggleClass("is-dots", cfg.monthStyle === "dots");

	if (cfg.weekNumbers) grid.createDiv({ cls: "hearth-sched-dow hearth-sched-wk", text: "" });
	for (const dow of columns) {
		grid.createDiv({ cls: "hearth-sched-dow", text: moment().day(dow).format("ddd") });
	}

	// Whole weeks covering the month, so every cell sits under its weekday.
	const gridStart = weekStart(anchor, cfg);
	const monthEnd = anchor.clone().endOf("month");
	const weeks = Math.ceil((monthEnd.diff(gridStart, "days") + 1) / 7);
	grid.style.setProperty("--sched-rows", String(weeks));
	const max = cfg.maxPerDay === undefined ? 3 : Math.max(0, Math.round(cfg.maxPerDay));

	for (let w = 0; w < weeks; w++) {
		const weekFirst = gridStart.clone().add(w * 7, "days");
		if (cfg.weekNumbers) {
			grid.createDiv({ cls: "hearth-sched-wk", text: weekFirst.format("W") });
		}
		for (const dow of columns) {
			// The offset of this weekday within the week being drawn.
			const day = weekFirst.clone().add((dow - first + 7) % 7, "days");
			renderMonthCell(grid, day, anchor, max, state, ctx);
		}
	}
}


function renderMonthCell(
	grid: HTMLElement,
	day: Moment,
	month: Moment,
	max: number,
	state: ScheduleState,
	ctx: ViewContext,
): void {
	const dayKey = day.format("YYYY-MM-DD");
	const events = ctx.ics.on(dayKey);
	const note = noteFor(ctx, day);

	const cell = grid.createDiv("hearth-sched-cell");
	cell.toggleClass("is-outside", day.month() !== month.month());
	cell.toggleClass("is-today", isToday(day));
	cell.toggleClass("has-note", note !== null);

	const head = cell.createDiv("hearth-sched-cellhead");
	const num = head.createDiv({ cls: "hearth-sched-daynum", text: String(day.date()) });
	if (note) head.createDiv("hearth-sched-notedot");
	const openNote = () => openDayNote(ctx, state, day);
	num.addEventListener("click", (e) => {
		e.stopPropagation();
		openNote();
	});
	makeClickable(num, openNote, day.format("dddd, LL"));

	if (events.length) {
		const list = cell.createDiv("hearth-sched-cellevents");
		const shown = max > 0 ? events.slice(0, max) : events;
		for (const ev of shown) {
			if (ctx.cfg.monthStyle === "dots") {
				const dot = list.createDiv("hearth-sched-dot");
				dot.style.setProperty("--ev-color", ctx.ics.eventColor(ev));
				dot.toggleClass("is-done", taskNotesMeta(ev)?.done === true);
				dot.setAttribute("aria-label", ev.summary || t().cards.calendar.untitledEvent);
				dot.addEventListener("click", (e) => {
					e.stopPropagation();
					showEventDetail(ctx.view, ev, ctx.ics);
				});
			} else {
				eventChip(list, ev, ctx);
			}
		}
		if (shown.length < events.length) {
			const more = list.createDiv({
				cls: "hearth-sched-more",
				text: t().cards.schedule.more(events.length - shown.length),
			});
			const open = (e?: MouseEvent) => {
				e?.stopPropagation();
				showDayMenu(ctx.view, day, ctx.options, note, isToday(day), events, ctx.ics, e ?? more);
			};
			more.addEventListener("click", open);
			makeClickable(more, () => open());
		}
	}

	// The cell's empty space zooms into the day; its number opens the note.
	cell.addEventListener("click", () => zoomToDay(ctx, state, day));
	cell.setAttribute("aria-label", day.format("dddd, LL"));
}


// ---- Week and day views --------------------------------------------------

/** The time grid: an hour ruler down the left, one column per day, all-day
 * events in a band across the top, and every timed event as a block at its own
 * hour — overlapping ones side by side, with a line across the current time. */
function renderTimeGrid(main: HTMLElement, state: ScheduleState, ctx: ViewContext): void {
	const cfg = ctx.cfg;
	const days = gridDays(state, ctx);
	const win = dayWindow(cfg.dayStart, cfg.dayEnd);
	const hourHeight = clampHourHeight(cfg.hourHeight);
	const hours = win.endHour - win.startHour;

	const frame = main.createDiv("hearth-sched-timegrid");
	frame.style.setProperty("--sched-cols", String(days.length));
	frame.style.setProperty("--sched-hour", `${hourHeight}px`);

	renderGridHeader(frame, days, state, ctx);
	renderAllDayRow(frame, days, win, ctx);

	const scroller = frame.createDiv("hearth-sched-scroll");
	const canvas = scroller.createDiv("hearth-sched-canvas");
	canvas.style.setProperty("--sched-height", `${hours * hourHeight}px`);

	const gutter = canvas.createDiv("hearth-sched-gutter");
	for (let h = win.startHour; h < win.endHour; h++) {
		const cell = gutter.createDiv("hearth-sched-hour");
		cell.createSpan({ cls: "hearth-sched-hourlabel", text: hourLabel(h, cfg) });
	}

	const columns = canvas.createDiv("hearth-sched-cols");
	for (const day of days) renderDayColumn(columns, day, win, hourHeight, ctx);

	if (cfg.nowLine !== false) mountNowLine(columns, days, win, ctx);

	// Open on the earliest event of the shown days (or the morning), so a full
	// 24-hour grid lands where the day actually happens instead of at midnight.
	// Every start is expressed against the first column's midnight, since all
	// the columns share one vertical ruler.
	const ruler = days[0].clone().startOf("day").valueOf();
	const starts = days.flatMap((d) => {
		const shift = ruler - d.clone().startOf("day").valueOf();
		return ctx.ics
			.on(d.format("YYYY-MM-DD"))
			.filter((ev) => !ev.allDay)
			.map((ev) => ev.start + shift);
	});
	const top = (scrollHour(starts, ruler, win) - win.startHour) * hourHeight;
	scroller.scrollTop = top;
	// A card drawn before the board has been sized (fit-to-page measures on the
	// next frame) has nothing to scroll yet and clamps this to 0 — so do it
	// again once the layout is real.
	window.requestAnimationFrame(() => {
		if (scroller.isConnected) scroller.scrollTop = top;
	});
}


/** The days a time grid draws: the anchored day, or its week minus any hidden
 * weekend. */
function gridDays(state: ScheduleState, ctx: ViewContext): Moment[] {
	const anchor = moment(state.anchor).startOf("day");
	if (state.view === "day") return [anchor];
	const start = weekStart(anchor, ctx.cfg);
	const first = firstDay(ctx.cfg);
	return weekdayColumns(first, ctx.cfg.hideWeekends === true).map((dow) =>
		start.clone().add((dow - first + 7) % 7, "days"),
	);
}


/** The sticky day headers above the grid: weekday, date, and the daily-note
 * dot, each opening its day. */
function renderGridHeader(
	frame: HTMLElement,
	days: Moment[],
	state: ScheduleState,
	ctx: ViewContext,
): void {
	const head = frame.createDiv("hearth-sched-gridhead");
	head.createDiv("hearth-sched-gutterhead");
	const cols = head.createDiv("hearth-sched-headcols");
	for (const day of days) {
		const cell = cols.createDiv("hearth-sched-headday");
		cell.toggleClass("is-today", isToday(day));
		cell.createDiv({ cls: "hearth-sched-headdow", text: day.format("ddd") });
		cell.createDiv({ cls: "hearth-sched-headnum", text: String(day.date()) });
		if (noteFor(ctx, day)) cell.createDiv("hearth-sched-notedot");
		const activate = () => zoomToDay(ctx, state, day);
		cell.addEventListener("click", activate);
		makeClickable(cell, activate, day.format("dddd, LL"));
	}
}


/** The band above the grid for everything that has no hour of its own: all-day
 * events, and any timed event that falls outside the drawn window — those would
 * otherwise vanish silently, which is the one thing a calendar must never do. */
function renderAllDayRow(
	frame: HTMLElement,
	days: Moment[],
	win: DayWindow,
	ctx: ViewContext,
): void {
	const rows = days.map((day) => {
		const dayStart = day.clone().startOf("day").valueOf();
		return ctx.ics
			.on(day.format("YYYY-MM-DD"))
			.filter((ev) => ev.allDay || daySpan(ev.start, ev.end, dayStart, win) === null);
	});
	if (!rows.some((r) => r.length)) return;

	const band = frame.createDiv("hearth-sched-allday");
	const label = band.createDiv("hearth-sched-alldaylabel");
	setIcon(label, "sun");
	label.setAttribute("aria-label", t().cards.calendar.allDay);
	const cols = band.createDiv("hearth-sched-alldaycols");
	for (const events of rows) {
		const col = cols.createDiv("hearth-sched-alldaycol");
		for (const ev of events) eventChip(col, ev, ctx);
	}
}


/** One day's column of timed blocks. */
function renderDayColumn(
	parent: HTMLElement,
	day: Moment,
	win: DayWindow,
	hourHeight: number,
	ctx: ViewContext,
): void {
	const col = parent.createDiv("hearth-sched-col");
	col.toggleClass("is-today", isToday(day));
	const dayStart = day.clone().startOf("day").valueOf();

	const placed: { ev: IcsOccurrence; span: DaySpan }[] = [];
	for (const ev of ctx.ics.on(day.format("YYYY-MM-DD"))) {
		if (ev.allDay) continue;
		// Floor every block at one line of text, so a ten-minute stand-up is
		// still readable and clickable.
		const span = daySpan(ev.start, ev.end, dayStart, win, (MIN_BLOCK_PX / hourHeight) * 60);
		if (span) placed.push({ ev, span });
	}

	const columns = overlapColumns(placed.map((p) => p.span));
	const total = (win.endHour - win.startHour) * 60;
	const top = win.startHour * 60;
	placed.forEach((p, i) => {
		const { column, columns: count } = columns[i];
		const block = col.createDiv("hearth-sched-block");
		const task = taskNotesMeta(p.ev);
		block.toggleClass("is-done", task?.done === true);
		block.toggleClass("is-clipped-start", p.span.clippedStart);
		block.toggleClass("is-clipped-end", p.span.clippedEnd);
		block.style.setProperty("--ev-color", ctx.ics.eventColor(p.ev));
		block.style.setProperty("--ev-top", `${((p.span.startMin - top) / total) * 100}%`);
		block.style.setProperty("--ev-height", `${((p.span.endMin - p.span.startMin) / total) * 100}%`);
		block.style.setProperty("--ev-left", `${(column / count) * 100}%`);
		block.style.setProperty("--ev-width", `${(1 / count) * 100}%`);

		const title = p.ev.summary || t().cards.calendar.untitledEvent;
		const time = chipTime(p.ev, ctx.cfg);
		// How much the block can actually say is decided by how tall it is, not
		// by what the event carries: a half-hour meeting at the default zoom has
		// room for three lines, a ten-minute one for a single line — and text
		// that doesn't fit used to spill out through the block's bottom edge.
		const lines = blockLines((p.span.endMin - p.span.startMin) * (hourHeight / 60));
		block.toggleClass("is-inline", lines === 1);
		block.createDiv({ cls: "hearth-sched-blocktitle", text: title });
		if (lines === 1) {
			// One line: the time trails the title on the same row, and drops out
			// entirely when the block is too narrow for both.
			if (time) block.createSpan({ cls: "hearth-sched-blocktime", text: time });
		} else {
			if (time) block.createDiv({ cls: "hearth-sched-blocktime", text: time });
			if (lines >= 3 && p.ev.location) {
				block.createDiv({ cls: "hearth-sched-blockplace", text: p.ev.location });
			}
		}
		// Whatever didn't fit is one hover away, without opening the event.
		setTooltip(block, [title, time, p.ev.location].filter(Boolean).join(" · "));

		const open = () => showEventDetail(ctx.view, p.ev, ctx.ics);
		block.addEventListener("click", (e) => {
			e.stopPropagation();
			open();
		});
		makeClickable(
			block,
			open,
			`${p.ev.summary || t().cards.calendar.untitledEvent} — ${day.format("MMM D")}`,
		);
	});
}


/** The line across now, on today's column only, nudged onto the right minute
 * every minute while the card is on screen. */
function mountNowLine(
	columns: HTMLElement,
	days: Moment[],
	win: DayWindow,
	ctx: ViewContext,
): void {
	const index = days.findIndex((d) => isToday(d));
	if (index === -1) return;
	const col = columns.children[index];
	if (!col?.instanceOf(HTMLElement)) return;

	const line = col.createDiv("hearth-sched-now");
	const total = (win.endHour - win.startHour) * 60;
	const place = (): void => {
		const now = moment();
		const minutes = now.hours() * 60 + now.minutes() - win.startHour * 60;
		const inside = minutes >= 0 && minutes <= total;
		line.toggleClass("is-hidden", !inside);
		if (inside) line.style.setProperty("--now-top", `${(minutes / total) * 100}%`);
	};
	place();
	// Tied to the card's component, so it stops with the card rather than
	// ticking on for every redraw the board has ever done.
	ctx.component.registerInterval(window.setInterval(place, 60_000));
}


/** An hour ruler label, in the card's clock: "9 AM" on a 12-hour clock, "09:00"
 * on a 24-hour one, and whichever of the two the locale itself uses when the
 * card doesn't say. */
function hourLabel(hour: number, cfg: ScheduleConfig): string {
	const at = moment().startOf("day").add(hour % 24, "hours");
	return twelveHour(cfg) ? at.format("h A") : at.format("HH:mm");
}


/** Whether times are drawn on a 12-hour clock. */
function twelveHour(cfg: ScheduleConfig): boolean {
	if (cfg.clock) return cfg.clock === "12";
	return /a/i.test(moment.localeData().longDateFormat("LT"));
}


/** Pixels per hour, clamped to what stays legible and to what a card can hold. */
function clampHourHeight(value: number | undefined): number {
	const height = value === undefined || !Number.isFinite(value) ? 44 : Math.round(value);
	return Math.min(Math.max(height, 20), 160);
}


// ---- List view -----------------------------------------------------------

/** The list: every day in the range that has something on it, in order, with
 * its events beneath it. Days with nothing are skipped rather than padded out —
 * the point of the list is what is coming, not the calendar's shape. */
function renderList(main: HTMLElement, state: ScheduleState, ctx: ViewContext): void {
	const start = moment(state.anchor).startOf("day");
	const days = listDays(ctx.cfg);
	const list = main.createDiv("hearth-sched-list");

	let drawn = 0;
	for (let i = 0; i < days; i++) {
		const day = start.clone().add(i, "days");
		const dayKey = day.format("YYYY-MM-DD");
		const events = ctx.ics.on(dayKey);
		const note = noteFor(ctx, day);
		if (!events.length && !note) continue;
		drawn++;

		const head = list.createDiv("hearth-sched-listday");
		head.toggleClass("is-today", isToday(day));
		head.createSpan({ cls: "hearth-sched-listdate", text: day.format("ddd D MMM") });
		head.createSpan({ cls: "hearth-sched-listrel", text: formatRelativeDate(dayKey) });
		if (note) head.createDiv("hearth-sched-notedot");
		if (ctx.options) {
			const activate = () =>
				openDailyNote(ctx.view, day, ctx.options, note, isToday(day));
			head.addEventListener("click", activate);
			makeClickable(head, activate, day.format("dddd, LL"));
		} else {
			head.addClass("is-static");
		}

		const rows = list.createDiv("hearth-sched-listevents");
		for (const ev of events) renderEventRow(ctx.view, rows, ev, day, ctx.ics);
	}

	if (drawn === 0) {
		emptyState(main, "calendar-check", t().cards.schedule.listEmpty(days));
	}
}


// ---- Editor --------------------------------------------------------------

export function scheduleEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.schedule ??= {});
	const strings = t().editors.schedule;
	// Every change persists and redraws the card behind the dialog, so the
	// effect is visible while configuring; `rebuild` also rebuilds the dialog
	// for the settings whose presence depends on another one.
	const save = (rebuild = false): void => {
		ctx.opts.save();
		ctx.opts.rerender();
		if (rebuild) ctx.requestRender();
	};

	new Setting(containerEl)
		.setName(strings.view)
		.setDesc(strings.viewDesc)
		.addDropdown((d) => {
			for (const v of ALL_VIEWS) d.addOption(v, viewName(v));
			d.setValue(cfg.view ?? "month").onChange((v) => {
				cfg.view = v === "month" ? undefined : (v as ScheduleView);
				// The card remembers where it was navigated to; picking a view here
				// is an instruction to go there now.
				resetScheduleState(ctx.card.id);
				save(true);
			});
		});

	new Setting(containerEl).setName(strings.views).setDesc(strings.viewsDesc);
	for (const v of ALL_VIEWS) {
		const offered = offeredViews(cfg);
		const on = offered.includes(v);
		new Setting(containerEl)
			.setName(viewName(v))
			.setClass("hearth-sched-viewtoggle")
			.addToggle((tg) =>
				tg
					// The last one standing can't be switched off: a card with no view
					// has nothing to draw.
					.setDisabled(on && offered.length === 1)
					.setValue(on)
					.onChange(() => {
						const next = ALL_VIEWS.filter((x) => (x === v ? !on : offered.includes(x)));
						if (!next.length) return;
						cfg.views = next.length === ALL_VIEWS.length ? undefined : next;
						save(true);
					}),
			);
	}

	new Setting(containerEl)
		.setName(strings.toolbar)
		.setDesc(strings.toolbarDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.hideToolbar !== true).onChange((v) => {
				cfg.hideToolbar = v ? undefined : true;
				save();
			}),
		);

	new Setting(containerEl)
		.setName(strings.dailyNotes)
		.setDesc(strings.dailyNotesDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.dailyNotes !== false).onChange((v) => {
				cfg.dailyNotes = v ? undefined : false;
				save();
			}),
		);

	// ---- Week shape ----
	new Setting(containerEl).setName(strings.weekHeading).setHeading();

	const week = new Setting(containerEl).setName(strings.firstDay).setDesc(strings.firstDayDesc);
	week.addDropdown((d) => {
		d.addOption("", strings.firstDayLocale(moment().day(moment.localeData().firstDayOfWeek()).format("dddd")));
		for (let i = 0; i < 7; i++) d.addOption(String(i), moment().day(i).format("dddd"));
		d.setValue(cfg.firstDay === undefined ? "" : String(cfg.firstDay)).onChange((v) => {
			cfg.firstDay = v === "" ? undefined : Number(v);
			save();
		});
	});

	new Setting(containerEl)
		.setName(strings.hideWeekends)
		.setDesc(strings.hideWeekendsDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.hideWeekends === true).onChange((v) => {
				cfg.hideWeekends = v || undefined;
				save();
			}),
		);

	new Setting(containerEl)
		.setName(strings.weekNumbers)
		.setDesc(strings.weekNumbersDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.weekNumbers === true).onChange((v) => {
				cfg.weekNumbers = v || undefined;
				save();
			}),
		);

	new Setting(containerEl)
		.setName(strings.clock)
		.setDesc(strings.clockDesc)
		.addDropdown((d) => {
			d.addOption("", strings.clockLocale);
			d.addOption("12", strings.clock12);
			d.addOption("24", strings.clock24);
			d.setValue(cfg.clock ?? "").onChange((v) => {
				cfg.clock = v === "" ? undefined : (v as "12" | "24");
				save();
			});
		});

	// ---- Month ----
	new Setting(containerEl).setName(strings.monthHeading).setHeading();

	new Setting(containerEl)
		.setName(strings.monthStyle)
		.setDesc(strings.monthStyleDesc)
		.addDropdown((d) => {
			d.addOption("chips", strings.monthStyleChips);
			d.addOption("dots", strings.monthStyleDots);
			d.setValue(cfg.monthStyle ?? "chips").onChange((v) => {
				cfg.monthStyle = v === "chips" ? undefined : "dots";
				save();
			});
		});

	const perDay = new Setting(containerEl).setName(strings.maxPerDay).setDesc(strings.maxPerDayDesc);
	perDay.addSlider((s) =>
		s
			.setLimits(0, 10, 1)
			.setValue(cfg.maxPerDay ?? 3)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.maxPerDay = v === 3 ? undefined : v;
				save();
			}),
	);
	addResetButton(ctx, perDay, t().settings.resetSlider, () => {
		cfg.maxPerDay = undefined;
	});

	// ---- Time grid ----
	new Setting(containerEl).setName(strings.gridHeading).setHeading();
	new Setting(containerEl).setDesc(strings.gridDesc);

	const hours = new Setting(containerEl).setName(strings.hours).setDesc(strings.hoursDesc);
	hours.addDropdown((d) => {
		for (let h = 0; h <= 23; h++) d.addOption(String(h), hourLabel(h, cfg));
		d.setValue(String(cfg.dayStart ?? 0)).onChange((v) => {
			cfg.dayStart = Number(v) === 0 ? undefined : Number(v);
			save();
		});
	});
	hours.addDropdown((d) => {
		for (let h = 1; h <= 24; h++) {
			d.addOption(String(h), h === 24 ? strings.hoursMidnight : hourLabel(h, cfg));
		}
		d.setValue(String(cfg.dayEnd ?? 24)).onChange((v) => {
			cfg.dayEnd = Number(v) === 24 ? undefined : Number(v);
			save();
		});
	});
	addResetButton(ctx, hours, t().settings.resetSlider, () => {
		cfg.dayStart = undefined;
		cfg.dayEnd = undefined;
	});

	const zoom = new Setting(containerEl).setName(strings.hourHeight).setDesc(strings.hourHeightDesc);
	zoom.addSlider((s) =>
		s
			.setLimits(20, 160, 4)
			.setValue(clampHourHeight(cfg.hourHeight))
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.hourHeight = v === 44 ? undefined : v;
				save();
			}),
	);
	addResetButton(ctx, zoom, t().settings.resetSlider, () => {
		cfg.hourHeight = undefined;
	});

	new Setting(containerEl)
		.setName(strings.nowLine)
		.setDesc(strings.nowLineDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.nowLine !== false).onChange((v) => {
				cfg.nowLine = v ? undefined : false;
				save();
			}),
		);

	// ---- List ----
	new Setting(containerEl).setName(strings.listHeading).setHeading();

	const listRange = new Setting(containerEl).setName(strings.listDays).setDesc(strings.listDaysDesc);
	listRange.addSlider((s) =>
		s
			.setLimits(3, 90, 1)
			.setValue(listDays(cfg))
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.listDays = v === 14 ? undefined : v;
				save();
			}),
	);
	addResetButton(ctx, listRange, t().settings.resetSlider, () => {
		cfg.listDays = undefined;
	});

	// The event sources and everything done with an event are shared with the
	// mini calendar, down to the wording — see src/calendarsource.ts.
	calendarChipsEditor(ctx, containerEl, cfg);
	taskNotesSourceEditor(ctx, containerEl, cfg);
	calendarSourcesEditor(ctx, containerEl, cfg);
}


/** A full month / week / day / list calendar over ICS feeds, TaskNotes and the
 * vault's daily notes. */
export const scheduleCard: CardDefinition<"schedule"> = {
	kind: "schedule",
	templates: [
		{
			id: "schedule",
			name: "Calendar",
			icon: "calendar-range",
			build: () => ({ kind: "schedule", title: "Calendar", schedule: {}, w: 8, h: 6 }),
		},
	],
	render: (view, card, body, component) => renderSchedule(view, card, body, component),
	renderEditor: (container, ctx) => scheduleEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.schedule)
			copy.schedule = {
				...source.schedule,
				views: source.schedule.views ? [...source.schedule.views] : undefined,
				sources: source.schedule.sources ? source.schedule.sources.map((s) => ({ ...s })) : undefined,
				taskNotes: source.schedule.taskNotes ? { ...source.schedule.taskNotes } : undefined,
				chips: source.schedule.chips ? { ...source.schedule.chips } : undefined,
				eventNote: source.schedule.eventNote
					? {
							...source.schedule.eventNote,
							fields: source.schedule.eventNote.fields
								? source.schedule.eventNote.fields.map((f) => ({ ...f }))
								: undefined,
						}
					: undefined,
			};
	},
	liveness: { mode: "vault" },
};
