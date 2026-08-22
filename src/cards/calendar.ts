import { Component, setIcon, Setting, TFile } from "obsidian";
import {
	activityByDay,
	dailyNotePath,
	dailyNotesOptions,
	emptyState,
	heatLevel,
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
	taskNotesSourceEditor,
	type IcsContext,
} from "../calendarsource";
import { formatRelativeDate } from "../dates";
import { taskNotesEnabled, taskNotesMeta } from "../tasknotes";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";
import {
	isOperonAvailable,
	isOperonPlatformSupported,
	openOperonTask,
	queryTasks,
	taskDay,
	type OperonTask,
} from "../operon";

// ---- Mini calendar -------------------------------------------------------

/** A month grid resolved against the core Daily notes plugin's format/folder:
 * dots mark days with an existing note, clicking one opens it, clicking
 * today when it doesn't exist yet safely falls back to the core "Open
 * today's daily note" command (template-aware). Other empty days are left
 * alone rather than guessing at template handling for arbitrary dates. */
export function renderCalendar(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const options = dailyNotesOptions(view);
	const cfg = card.calendar ?? {};
	const sources = (cfg.sources ?? []).filter((s) => s.url.trim() && s.enabled !== false);
	const useTaskNotes = cfg.taskNotes?.enabled === true && taskNotesEnabled(view.app);

	// The card needs a reason to exist: daily notes (for the note grid), an
	// external calendar to overlay, or TaskNotes as a source.
	if (!options && sources.length === 0 && !useTaskNotes) {
		emptyState(body, "calendar-days", t().cards.empty.dailyEnable);
		return;
	}

	const wrap = body.createDiv("hearth-calendar");
	// Activity counts are only needed for the heatmap tint.
	const activity = cfg.heatmap ? activityByDay(view.app, cfg.heatmapMetric ?? "modified") : null;

	const ics = buildIcsContext(view, cfg, sources, component);
	const operon = buildOperonOverlay(view, cfg, component);
	if (cfg.view === "agenda") {
		const days = cfg.agendaDays && cfg.agendaDays > 0 ? Math.min(cfg.agendaDays, 60) : 14;
		const draw = () => {
			wrap.empty();
			const start = moment().startOf("day");
			ics.expand(start.valueOf(), start.clone().add(days, "days").valueOf());
			operon.expand(
				start.format("YYYY-MM-DD"),
				start.clone().add(days, "days").format("YYYY-MM-DD"),
			);
			renderCalendarAgenda(view, wrap, options, cfg, activity, ics, operon);
		};
		ics.onLoaded(draw);
		operon.onLoaded(draw);
		draw();
		ics.start();
		return;
	}

	let cursor: Moment = moment().startOf("month");
	const draw = () => {
		wrap.empty();
		renderCalendarHead(wrap, cursor, {
			onPrev: () => {
				cursor = cursor.clone().subtract(1, "month");
				draw();
			},
			onNext: () => {
				cursor = cursor.clone().add(1, "month");
				draw();
			},
			onToday: () => {
				cursor = moment().startOf("month");
				draw();
			},
		});
		// Expand events across a window comfortably covering the visible grid.
		ics.expand(
			cursor.clone().startOf("month").subtract(7, "days").valueOf(),
			cursor.clone().endOf("month").add(7, "days").valueOf(),
		);
		operon.expand(
			cursor.clone().startOf("month").subtract(7, "days").format("YYYY-MM-DD"),
			cursor.clone().endOf("month").add(7, "days").format("YYYY-MM-DD"),
		);
		renderCalendarGrid(view, wrap, cursor, options, cfg, activity, ics, operon);
	};
	ics.onLoaded(draw);
	operon.onLoaded(draw);
	draw();
	ics.start();
}




/**
 * The Operon half of a calendar card's overlay.
 *
 * Deliberately shaped like {@link IcsContext}: the grid and the agenda ask both
 * overlays the same three questions — what falls on this day, what colour is
 * it, tell me when you have more — so adding Operon needed no change to how a
 * day cell is drawn.
 *
 * One caveat worth knowing: Operon's query filters range over the due date, so
 * a task that is only *scheduled* is not returned by the window read and will
 * not appear on the grid.
 */
interface OperonOverlay {
	/** Load the tasks due in `[from, to]` (inclusive day keys). */
	expand(from: string, to: string): void;
	/** Tasks landing on a local day key (YYYY-MM-DD). */
	on(dayKey: string): OperonTask[];
	/** Whether the card asked for the overlay at all. */
	readonly enabled: boolean;
	/** CSS colour for the task markers. */
	readonly color: string;
	/** Register a redraw to run once a read resolves. */
	onLoaded(cb: () => void): void;
}

/** Cap on how many tasks one window read pulls back. A month of a busy vault
 * fits comfortably; beyond that the grid would be unreadable anyway. */
const OPERON_OVERLAY_LIMIT = 400;

function buildOperonOverlay(
	view: HomeView,
	cfg: NonNullable<DashboardCard["calendar"]>,
	component: Component,
): OperonOverlay {
	// Platform is checked here as well as in the session: on mobile the read
	// could only ever come back refused, so the overlay stays inert rather than
	// firing a query per month the user scrolls through.
	const enabled =
		!!cfg.operonTasks &&
		view.plugin.settings.operonIntegration &&
		isOperonAvailable(view.app) &&
		isOperonPlatformSupported();
	let byDay = new Map<string, OperonTask[]>();
	let redraw: (() => void) | null = null;
	let loadedWindow = "";
	/** Which read the buckets belong to. Flipping months faster than Operon
	 * answers would otherwise let an older month's response land last and
	 * overwrite the newer one — the same guard the Omnisearch integration uses
	 * for out-of-order results. */
	let generation = 0;
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});

	const expand = (from: string, to: string): void => {
		if (!enabled) return;
		// Navigating back to a month already read redraws from what we have
		// instead of asking Operon again.
		const key = `${from}..${to}`;
		if (key === loadedWindow) return;
		loadedWindow = key;
		const mine = ++generation;
		void queryTasks(view.plugin.operon, { due: { from, to } }, OPERON_OVERLAY_LIMIT).then(
			(result) => {
				if (destroyed || mine !== generation) return;
				if (!result.ok) {
					// Let a later visit to this window try again rather than
					// leaving it permanently marked as read.
					if (loadedWindow === key) loadedWindow = "";
					return;
				}
				const next = new Map<string, OperonTask[]>();
				for (const task of result.value.tasks) {
					const day = taskDay(task);
					if (!day) continue;
					const bucket = next.get(day);
					if (bucket) bucket.push(task);
					else next.set(day, [task]);
				}
				byDay = next;
				redraw?.();
			},
		);
	};

	return {
		expand,
		on: (key) => byDay.get(key) ?? [],
		enabled,
		color: cfg.operonTaskColor || "var(--interactive-accent)",
		onLoaded: (cb) => {
			redraw = cb;
		},
	};
}


function renderCalendarHead(
	wrap: HTMLElement,
	cursor: Moment,
	handlers: { onPrev: () => void; onNext: () => void; onToday: () => void },
): void {
	const head = wrap.createDiv("hearth-calendar-head");
	const prev = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": t().cards.calendar.previousMonth } });
	setIcon(prev, "chevron-left");
	prev.addEventListener("click", handlers.onPrev);

	const label = head.createDiv({ cls: "hearth-calendar-label", text: cursor.format("MMMM YYYY") });
	label.setAttribute("title", t().cards.calendar.backToToday);
	label.addEventListener("click", handlers.onToday);

	const next = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": t().cards.calendar.nextMonth } });
	setIcon(next, "chevron-right");
	next.addEventListener("click", handlers.onNext);
}



function renderCalendarGrid(
	view: HomeView,
	wrap: HTMLElement,
	cursor: Moment,
	options: DailyNotesOptions | null,
	cfg: NonNullable<DashboardCard["calendar"]>,
	activity: Map<string, number> | null,
	ics: IcsContext,
	operon: OperonOverlay,
): void {
	const grid = wrap.createDiv("hearth-calendar-grid");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const weekNumbers = cfg.showWeekNumbers === true;
	if (weekNumbers) {
		// One extra leading column for the week number.
		grid.addClass("has-week-numbers");
		grid.createDiv({ cls: "hearth-calendar-dow hearth-calendar-wk", text: "wk" });
	}

	for (let i = 0; i < 7; i++) {
		const dow = (startOfWeek + i) % 7;
		grid.createDiv({ cls: "hearth-calendar-dow", text: moment().day(dow).format("dd") });
	}

	const monthStart = cursor.clone().startOf("month");
	const monthEnd = cursor.clone().endOf("month");
	const gridStart = monthStart.clone().subtract((monthStart.day() - startOfWeek + 7) % 7, "days");
	const totalCells = Math.ceil((monthEnd.diff(gridStart, "days") + 1) / 7) * 7;

	// Highest edit count in the visible range, so the heatmap tint is relative.
	let peak = 1;
	if (activity) {
		for (let i = 0; i < totalCells; i++) {
			const key = gridStart.clone().add(i, "days").format("YYYY-MM-DD");
			peak = Math.max(peak, activity.get(key) ?? 0);
		}
	}

	const today: string = moment().format("YYYY-MM-DD");
	for (let i = 0; i < totalCells; i++) {
		const day = gridStart.clone().add(i, "days");
		if (weekNumbers && i % 7 === 0) {
			grid.createDiv({ cls: "hearth-calendar-wk", text: day.format("W") });
		}
		const dayKey = day.format("YYYY-MM-DD");
		const path = options ? dailyNotePath(day, options) : null;
		const file = path ? view.app.vault.getAbstractFileByPath(path) : null;
		const isToday = dayKey === today;
		const events = ics.on(dayKey);

		const cell = grid.createDiv("hearth-calendar-day");
		cell.toggleClass("is-outside", day.month() !== cursor.month());
		cell.toggleClass("is-today", isToday);
		cell.toggleClass("has-note", file instanceof TFile);
		if (activity) {
			const count = activity.get(dayKey) ?? 0;
			cell.style.setProperty("--heat", count > 0 ? String(heatLevel(count, peak)) : "0");
			cell.toggleClass("has-heat", count > 0);
			cell.setAttribute("aria-label", t().cards.calendar.dayEdited(day.format("MMM D"), count));
		}
		cell.createDiv({ cls: "hearth-calendar-daynum", text: String(day.date()) });

		const tasks = operon.on(dayKey);

		// Markers row: the daily-note dot, then one coloured dot per external
		// event (capped) so a busy day reads at a glance without overflowing,
		// then a single square for Operon tasks due that day — a different
		// shape, so a task is never mistaken for a calendar event.
		if (file instanceof TFile || events.length || tasks.length) {
			const dots = cell.createDiv("hearth-calendar-dots");
			if (file instanceof TFile) dots.createDiv("hearth-calendar-dot");
			for (const ev of events.slice(0, 3)) {
				const dot = dots.createDiv("hearth-calendar-evdot");
				dot.style.setProperty("--ev-color", ics.eventColor(ev));
				// A finished task's dot fades, so a busy day still reads as
				// "what's left" at a glance — the way TaskNotes shows it.
				dot.toggleClass("is-done", taskNotesMeta(ev)?.done === true);
			}
			if (tasks.length) {
				const mark = dots.createDiv("hearth-calendar-taskdot");
				mark.style.setProperty("--ev-color", operon.color);
				mark.setAttribute("aria-hidden", "true");
			}
			if (events.length) {
				cell.setAttribute(
					"aria-label",
					t().cards.calendar.dayEvents(day.format("MMM D"), events.length),
				);
			} else if (tasks.length) {
				cell.setAttribute(
					"aria-label",
					t().cards.calendar.dayTasks(day.format("MMM D"), tasks.length),
				);
			}
		}

		// A day with events opens the picker (note + events); a plain day opens
		// its note directly, exactly as before.
		const activate = (evt?: MouseEvent) => {
			if (events.length) {
				showDayMenu(view, day, options, file, isToday, events, ics, evt ?? cell);
			} else {
				openDailyNote(view, day, options, file, isToday);
			}
		};
		cell.addEventListener("click", (e) => activate(e));
		makeClickable(cell, () => activate(), day.format("MMMM D, YYYY"));
	}
}


/** The agenda layout of the calendar card: a chronological list of days from
 * today forward (`agendaDays`, default 14). Each day header opens its daily note
 * (or offers to create it, exactly like the month grid), and any external
 * calendar events for that day are listed beneath it, coloured by source. Days
 * with a note are emphasised with a dot; the optional heatmap tints each header
 * by that day's activity. Suits narrow or tall cards, and is the natural home
 * for subscribed ICS calendars. */
function renderCalendarAgenda(
	view: HomeView,
	wrap: HTMLElement,
	options: DailyNotesOptions | null,
	cfg: NonNullable<DashboardCard["calendar"]>,
	activity: Map<string, number> | null,
	ics: IcsContext,
	operon: OperonOverlay,
): void {
	wrap.addClass("is-agenda");
	const days = cfg.agendaDays && cfg.agendaDays > 0 ? Math.min(cfg.agendaDays, 60) : 14;
	const start = moment().startOf("day");

	// Highest edit count in the visible range, so the heatmap tint is relative.
	let peak = 1;
	if (activity) {
		for (let i = 0; i < days; i++) {
			const key = start.clone().add(i, "days").format("YYYY-MM-DD");
			peak = Math.max(peak, activity.get(key) ?? 0);
		}
	}

	const list = wrap.createDiv("hearth-agenda");
	let lastMonth = -1;
	for (let i = 0; i < days; i++) {
		const day = start.clone().add(i, "days");
		const dayKey = day.format("YYYY-MM-DD");
		// A light month separator whenever the agenda crosses into a new month.
		if (day.month() !== lastMonth) {
			list.createDiv({ cls: "hearth-agenda-month", text: day.format("MMMM YYYY") });
			lastMonth = day.month();
		}

		const path = options ? dailyNotePath(day, options) : null;
		const file = path ? view.app.vault.getAbstractFileByPath(path) : null;
		const hasNote = file instanceof TFile;
		const isToday = i === 0;
		const events = ics.on(dayKey);

		const row = list.createDiv("hearth-agenda-row");
		row.toggleClass("is-today", isToday);
		row.toggleClass("has-note", hasNote);

		const dateBox = row.createDiv("hearth-agenda-date");
		dateBox.createDiv({ cls: "hearth-agenda-dow", text: day.format("ddd") });
		dateBox.createDiv({ cls: "hearth-agenda-daynum", text: String(day.date()) });

		const main = row.createDiv("hearth-agenda-main");
		main.createDiv({ cls: "hearth-agenda-label", text: formatRelativeDate(dayKey) });
		// Faint "No note" hint only for truly empty days (no note, no events).
		if (!hasNote && events.length === 0 && options) {
			main.createDiv({ cls: "hearth-agenda-sub", text: t().cards.calendar.agendaNoNote });
		}

		if (activity) {
			const count = activity.get(dayKey) ?? 0;
			row.style.setProperty("--heat", count > 0 ? String(heatLevel(count, peak)) : "0");
			row.toggleClass("has-heat", count > 0);
			row.setAttribute("aria-label", t().cards.calendar.dayEdited(day.format("MMM D"), count));
		}
		if (hasNote) row.createDiv("hearth-calendar-dot hearth-agenda-dot");

		// The day header opens/creates the daily note (events are listed
		// separately below, each clickable); with no daily notes it's inert.
		if (options) {
			const activate = () => openDailyNote(view, day, options, file, isToday);
			row.addEventListener("click", activate);
			makeClickable(row, activate, day.format("MMMM D, YYYY"));
		} else {
			row.addClass("is-static");
		}

		// External calendar events for the day, listed under its header. Each is
		// clickable to view its details, so the day offers both note and events.
		if (events.length) {
			const evList = list.createDiv("hearth-agenda-events");
			for (const ev of events) renderEventRow(view, evList, ev, day, ics);
		}

		// Operon tasks due that day, listed after the events. Clicking one opens
		// its note at the task, the same as on an Operon card.
		const tasks = operon.on(dayKey);
		if (tasks.length) {
			const taskList = list.createDiv("hearth-agenda-events hearth-agenda-tasks");
			for (const task of tasks) renderAgendaTask(view, taskList, task, day, operon);
		}
	}
}


/** One event line in the agenda: a coloured bullet, its time (or "All day"),
 * and the summary, with the source name as a trailing badge when more than one
 * calendar is in play. A TaskNotes entry additionally carries a completion box,
 * its due/recurring markers, and strikes through once it's done — so the agenda
 * reads like TaskNotes' own list while staying a calendar. */

/** One Operon task line in the agenda: a coloured square (matching the grid
 * marker), the task's description, and a struck-through look when it is already
 * closed. */
function renderAgendaTask(
	view: HomeView,
	parent: HTMLElement,
	task: OperonTask,
	day: Moment,
	operon: OperonOverlay,
): void {
	const label = task.description || t().cards.operon.untitled;
	const row = parent.createDiv("hearth-agenda-event hearth-agenda-task");
	row.toggleClass("is-done", task.checkbox !== "open");
	const bullet = row.createDiv("hearth-agenda-evbullet hearth-agenda-taskbullet");
	bullet.style.setProperty("--ev-color", operon.color);

	const body = row.createDiv("hearth-agenda-evbody");
	body.createSpan({ cls: "hearth-agenda-evtitle", text: label });
	if (task.workflow) {
		body.createSpan({ cls: "hearth-agenda-evbadge", text: task.workflow.status.label });
	}

	const open = () => void openOperonTask(view.app, task);
	row.addEventListener("click", open);
	makeClickable(row, open, `${label} — ${day.format("MMM D")}`);
}






export function calendarEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.calendar ??= {});
	new Setting(containerEl)
		.setName(t().editors.calendar.view)
		.setDesc(t().editors.calendar.viewDesc)
		.addDropdown((d) => {
			d.addOption("month", t().editors.calendar.viewMonth);
			d.addOption("agenda", t().editors.calendar.viewAgenda);
			d.setValue(cfg.view ?? "month").onChange((v) => {
				cfg.view = v === "agenda" ? "agenda" : undefined;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
	if (cfg.view === "agenda") {
		const days = new Setting(containerEl)
			.setName(t().editors.calendar.agendaDays)
			.setDesc(t().editors.calendar.agendaDaysDesc);
		days.addSlider((s) => {
			s.setLimits(3, 60, 1)
				.setValue(cfg.agendaDays ?? 14)
				.setDynamicTooltip()
				.onChange((v) => {
					cfg.agendaDays = v === 14 ? undefined : v;
					ctx.opts.save();
				});
		});
		days.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					cfg.agendaDays = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	} else {
		new Setting(containerEl)
			.setName(t().editors.calendar.weekNumbers)
			.setDesc(t().editors.calendar.weekNumbersDesc)
			.addToggle((t) =>
				t.setValue(cfg.showWeekNumbers ?? false).onChange((v) => {
					cfg.showWeekNumbers = v || undefined;
					ctx.opts.save();
				}),
			);
	}
	new Setting(containerEl)
		.setName(t().editors.calendar.heatmap)
		.setDesc(t().editors.calendar.heatmapDesc)
		.addToggle((t) =>
			t.setValue(cfg.heatmap ?? false).onChange((v) => {
				cfg.heatmap = v || undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (cfg.heatmap) {
		new Setting(containerEl)
			.setName(t().editors.calendar.heatmapCounts)
			.addDropdown((d) => {
				d.addOption("modified", t().editors.metricOptions.modified);
				d.addOption("created", t().editors.metricOptions.created);
				d.setValue(cfg.heatmapMetric ?? "modified").onChange((v) => {
					cfg.heatmapMetric = v as NonNullable<typeof cfg.heatmapMetric>;
					ctx.opts.save();
				});
			});
	}

	// Only offered when Operon is actually installed — a toggle for a plugin
	// the vault doesn't have is noise, and the card would ignore it anyway.
	if (isOperonAvailable(ctx.app) && isOperonPlatformSupported()) {
		new Setting(containerEl)
			.setName(t().editors.calendar.operonTasks)
			.setDesc(t().editors.calendar.operonTasksDesc)
			.addToggle((tog) =>
				tog.setValue(cfg.operonTasks ?? false).onChange((v) => {
					cfg.operonTasks = v || undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
			);
		if (cfg.operonTasks) {
			new Setting(containerEl)
				.setName(t().editors.calendar.operonTaskColor)
				.setDesc(t().editors.calendar.operonTaskColorDesc)
				.addColorPicker((picker) =>
					picker.setValue(cfg.operonTaskColor || "#7c5cff").onChange((v) => {
						cfg.operonTaskColor = v;
						ctx.opts.save();
						ctx.opts.rerender();
					}),
				);
		}
	}

	// The chips ride on agenda entries; the month grid draws dots instead.
	if (cfg.view === "agenda") calendarChipsEditor(ctx, containerEl, cfg);
	taskNotesSourceEditor(ctx, containerEl, cfg);
	calendarSourcesEditor(ctx, containerEl, cfg);
}







/** A mini month calendar with an optional agenda and external ICS calendars. */
export const calendarCard: CardDefinition<"calendar"> = {
	kind: "calendar",
	templates: [
		{ id: "calendar", name: "Mini calendar", icon: "calendar-days", build: () => ({ kind: "calendar", title: "Calendar", w: 4, h: 4 }) },
	],
	render: (view, card, body, component) => renderCalendar(view, card, body, component),
	renderEditor: (container, ctx) => calendarEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.calendar)
			copy.calendar = {
				...source.calendar,
				sources: source.calendar.sources ? source.calendar.sources.map((s) => ({ ...s })) : undefined,
				taskNotes: source.calendar.taskNotes ? { ...source.calendar.taskNotes } : undefined,
				chips: source.calendar.chips ? { ...source.calendar.chips } : undefined,
				eventNote: source.calendar.eventNote
					? {
							...source.calendar.eventNote,
							fields: source.calendar.eventNote.fields
								? source.calendar.eventNote.fields.map((f) => ({ ...f }))
								: undefined,
						}
					: undefined,
			};
	},
	liveness: { mode: "vault" },
};
