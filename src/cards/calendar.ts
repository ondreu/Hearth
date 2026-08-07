import {
	Component,
	Menu,
	Modal,
	Notice,
	setIcon,
	Setting,
	TFile,
	TFolder,
	type App,
	type TAbstractFile,
} from "obsidian";
import {
	activityByDay,
	createDailyNoteAt,
	dailyNotePath,
	dailyNotesOptions,
	emptyState,
	feedHost,
	heatLevel,
	moment,
	type DailyNotesOptions,
	type Moment,
} from "../cardbodies";
import { formatRelativeDate } from "../dates";
import { moveItem } from "../editors";
import {
	buildEventNote,
	DEFAULT_EVENT_NOTE_FIELDS,
	type EventField,
	type EventFieldAction,
	type EventNoteConfig,
	type EventNoteInput,
} from "../eventnote";
import { t } from "../i18n";
import { cachedCalendar, eventsByDay, expandEvents, loadCalendar, type IcsOccurrence } from "../ics";
import { openFile } from "../opener";
import { FilePickerModal } from "../pickers";
import { type CalendarConfig, type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


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

	// The card needs a reason to exist: either daily notes (for the note grid) or
	// at least one external calendar to overlay.
	if (!options && sources.length === 0) {
		emptyState(body, "calendar-days", t().cards.empty.dailyEnable);
		return;
	}

	const wrap = body.createDiv("hearth-calendar");
	// Activity counts are only needed for the heatmap tint.
	const activity = cfg.heatmap ? activityByDay(view.app, cfg.heatmapMetric ?? "modified") : null;

	const ics = buildIcsContext(view, cfg, sources, component);
	if (cfg.view === "agenda") {
		const days = cfg.agendaDays && cfg.agendaDays > 0 ? Math.min(cfg.agendaDays, 60) : 14;
		const draw = () => {
			wrap.empty();
			const start = moment().startOf("day");
			ics.expand(start.valueOf(), start.clone().add(days, "days").valueOf());
			renderCalendarAgenda(view, wrap, options, cfg, activity, ics);
		};
		ics.onLoaded(draw);
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
		renderCalendarGrid(view, wrap, cursor, options, cfg, activity, ics);
	};
	ics.onLoaded(draw);
	draw();
	ics.start();
}


/** Per-render helper bundling the external-calendar state for a calendar card:
 * lazily fetches each ICS source, expands events for a given window, and hands
 * the card per-day occurrences plus each source's colour and label. When there
 * are no sources every method is a cheap no-op, so the note grid pays nothing. */
interface IcsContext {
	/** Recompute the day buckets for `[startMs, endMs)` from cached feeds. */
	expand(startMs: number, endMs: number): void;
	/** Occurrences on a given local day key (YYYY-MM-DD), already sorted. */
	on(dayKey: string): IcsOccurrence[];
	/** CSS colour for a source id. */
	color(sourceId: string | undefined): string;
	/** Friendly label for a source id. */
	label(sourceId: string | undefined): string;
	/** Whether any external calendars are configured. */
	readonly hasSources: boolean;
	/** Whether more than one external calendar is configured (badges shown only
	 * then, since with a single source the label is redundant). */
	readonly multiSource: boolean;
	/** The event → note configuration for the "Create note" modal action. */
	readonly eventNote: EventNoteConfig | undefined;
	/** Register a redraw to run after a background fetch resolves. */
	onLoaded(cb: () => void): void;
	/** Kick the initial fetch (and schedule auto-refresh). */
	start(): void;
}


function buildIcsContext(
	view: HomeView,
	cfg: NonNullable<DashboardCard["calendar"]>,
	sources: NonNullable<CalendarConfig["sources"]>,
	component: Component,
): IcsContext {
	const disabled = view.plugin.settings.disableExternalCalls;
	const refreshMin = cfg.refreshMin ?? 60;
	const ttlMs = Math.max(refreshMin, 1) * 60_000;
	let byDay = new Map<string, IcsOccurrence[]>();
	let redraw: (() => void) | null = null;
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});

	const src = (id: string | undefined) => sources.find((s) => s.id === id);
	const color = (id: string | undefined): string =>
		src(id)?.color || "var(--interactive-accent)";
	const label = (id: string | undefined): string => {
		const s = src(id);
		if (!s) return "";
		return s.name.trim() || cachedCalendar(s.url)?.name || feedHost(s.url);
	};

	const expand = (startMs: number, endMs: number): void => {
		const occ: IcsOccurrence[] = [];
		for (const s of sources) {
			const cal = cachedCalendar(s.url);
			if (!cal) continue;
			for (const o of expandEvents(cal.events, startMs, endMs)) {
				o.sourceId = s.id;
				occ.push(o);
			}
		}
		byDay = eventsByDay(occ);
	};

	const load = (force: boolean): void => {
		if (sources.length === 0) return;
		void Promise.all(
			sources.map((s) => loadCalendar(s.url, { ttlMs, disabled, force })),
		).then(() => {
			if (destroyed) return;
			redraw?.();
		});
	};

	return {
		expand,
		on: (key) => byDay.get(key) ?? [],
		color,
		label,
		hasSources: sources.length > 0,
		multiSource: sources.length > 1,
		eventNote: cfg.eventNote,
		onLoaded: (cb) => {
			redraw = cb;
		},
		start: () => {
			load(false);
			if (refreshMin > 0) {
				component.registerInterval(window.setInterval(() => load(true), refreshMin * 60_000));
			}
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


/** Open the daily note for `day` — the calendar's default click action. Opens
 * an existing note, runs the core "open today's note" command for today, or
 * offers to create the note for any other day. No-op when daily notes are off. */
function openDailyNote(
	view: HomeView,
	day: Moment,
	options: DailyNotesOptions | null,
	file: TAbstractFile | null,
	isToday: boolean,
): void {
	if (file instanceof TFile) {
		void openFile(view, file, "card");
	} else if (!options) {
		// Calendar-only card: nothing to open or create.
	} else if (isToday) {
		if (!view.app.commands.executeCommandById("daily-notes")) {
			new Notice(t().notices.couldNotOpenDaily);
		}
	} else {
		void createDailyNoteAt(view, day, options).then((created) => {
			if (created) void openFile(view, created, "newNote");
			else new Notice(t().notices.couldNotCreateNoteForDay(day.format("MMM D, YYYY")));
		});
	}
}


/** A one-line time label for an event: its start–end range, or "All day". */
function eventTimeLabel(ev: IcsOccurrence): string {
	if (ev.allDay) return t().cards.calendar.allDay;
	const start = moment(new Date(ev.start)).format("LT");
	if (ev.end === null) return start;
	return `${start} – ${moment(new Date(ev.end)).format("LT")}`;
}


/** Open the full event-details modal — the "view this event" action from the
 * day picker and the agenda. */
function showEventDetail(view: HomeView, ev: IcsOccurrence, ics: IcsContext): void {
	new EventDetailModal(view, ev, ics).open();
}


/** Human-readable date (or date range) for an event, spelled out for the modal:
 * a single day reads "Monday, July 20, 2026"; a span reads "Jul 20 – Jul 23". */
function eventDateLabel(ev: IcsOccurrence): string {
	const start = moment(new Date(ev.start));
	if (ev.allDay) {
		// All-day DTEND is exclusive: the last covered day is one ms earlier.
		const last = moment(new Date((ev.end ?? ev.start + 86400_000) - 1));
		if (last.format("YYYY-MM-DD") === start.format("YYYY-MM-DD")) return start.format("dddd, LL");
		return `${start.format("ll")} – ${last.format("ll")}`;
	}
	if (ev.end !== null) {
		const end = moment(new Date(ev.end));
		if (end.format("YYYY-MM-DD") !== start.format("YYYY-MM-DD")) {
			return `${start.format("ll")} – ${end.format("ll")}`;
		}
	}
	return start.format("dddd, LL");
}


/** A full modal with every field an ICS event carries: name, date, time,
 * location, notes, source calendar and any link. Fields that are absent are
 * simply skipped, so a bare event shows just its name and when. */
class EventDetailModal extends Modal {
	constructor(
		private readonly view: HomeView,
		private readonly ev: IcsOccurrence,
		private readonly ics: IcsContext,
	) {
		super(view.app);
	}

	onOpen(): void {
		const ev = this.ev;
		this.modalEl.addClass("hearth-event-modal");
		this.titleEl.setText(ev.summary || t().cards.calendar.untitledEvent);

		const rows = this.contentEl.createDiv("hearth-event-rows");
		this.row(rows, "calendar-days", eventDateLabel(ev));
		this.row(rows, "clock", eventTimeLabel(ev));
		if (ev.location) this.row(rows, "map-pin", ev.location);

		const label = this.ics.label(ev.sourceId);
		if (label) {
			const row = this.row(rows, null, label);
			// Fill the icon gutter with the source's colour dot.
			const dot = row.querySelector<HTMLElement>(".hearth-event-icon")!.createDiv(
				"hearth-event-caldot",
			);
			dot.style.setProperty("--ev-color", this.ics.color(ev.sourceId));
		}

		if (ev.description) {
			const block = this.contentEl.createDiv("hearth-event-desc");
			this.row(block, "align-left", t().cards.calendar.eventNotes).addClass(
				"hearth-event-desc-head",
			);
			block.createDiv({ cls: "hearth-event-desc-body", text: ev.description });
		}

		if (ev.url && /^https?:\/\//i.test(ev.url)) {
			const row = this.row(this.contentEl.createDiv("hearth-event-rows"), "link", "");
			row.createEl("a", {
				cls: "hearth-event-link",
				text: ev.url,
				href: ev.url,
				attr: { target: "_blank", rel: "noopener" },
			});
		}

		// "Create note" / "Open note" — the note-from-event action. Shown unless
		// explicitly disabled in the card's event-note config.
		if (this.ics.eventNote?.enabled !== false) this.renderNoteAction();
	}

	/** The footer button that creates the event's note (or opens it when one
	 * already exists, matched by the event UID in frontmatter). */
	private renderNoteAction(): void {
		const cfg = this.ics.eventNote ?? {};
		const linkKey = cfg.linkKey === undefined ? "event_uid" : cfg.linkKey.trim();
		const existing = findEventNote(this.app, this.ev.uid, linkKey);

		const footer = this.contentEl.createDiv("hearth-event-footer");
		const btn = footer.createEl("button", { cls: "mod-cta" });
		setIcon(btn.createSpan("hearth-event-btnicon"), existing ? "file-text" : "file-plus");
		btn.createSpan({
			text: existing
				? t().cards.calendar.openEventNote
				: t().cards.calendar.createEventNote,
		});
		btn.addEventListener("click", () => {
			if (existing instanceof TFile) {
				void openFile(this.view, existing, "card");
				this.close();
				return;
			}
			void createEventNote(this.app, this.ev, this.ics).then((file) => {
				if (file) {
					void openFile(this.view, file, "newNote");
					this.close();
				} else {
					new Notice(t().notices.couldNotCreateEventNote);
				}
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** One label row: an icon (or a blank gutter when null) plus its text. */
	private row(parent: HTMLElement, icon: string | null, text: string): HTMLElement {
		const row = parent.createDiv("hearth-event-row");
		const iconEl = row.createDiv("hearth-event-icon");
		if (icon) setIcon(iconEl, icon);
		if (text) row.createDiv({ cls: "hearth-event-text", text });
		return row;
	}
}


/** The event data the note builder consumes, resolved from an occurrence plus
 * its source calendar's display name. */
function toEventNoteInput(ev: IcsOccurrence, calendar: string): EventNoteInput {
	return {
		uid: ev.uid,
		summary: ev.summary,
		location: ev.location,
		description: ev.description,
		url: ev.url,
		start: ev.start,
		end: ev.end,
		allDay: ev.allDay,
		calendar,
	};
}


/** Find an existing note whose frontmatter link key holds this event's UID, so
 * the same event always maps to one note. Returns null when linking is off, the
 * event has no UID, or no note matches. */
function findEventNote(app: App, uid: string, linkKey: string): TFile | null {
	if (!uid || !linkKey) return null;
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm && String(fm[linkKey]) === uid) return file;
	}
	return null;
}


/** Create the note for an event from the card's event-note config: seed from a
 * template (if any), route each field to frontmatter or body per the rules,
 * write the file and its frontmatter. Returns the file, or null on failure. */
async function createEventNote(
	app: App,
	ev: IcsOccurrence,
	ics: IcsContext,
): Promise<TFile | null> {
	const cfg = ics.eventNote ?? {};
	let templateContent = "";
	const templatePath = (cfg.template || "").trim();
	if (templatePath) {
		const tpl =
			app.vault.getAbstractFileByPath(templatePath) ??
			app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				templateContent = await app.vault.read(tpl);
			} catch {
				templateContent = "";
			}
		}
	}

	const built = buildEventNote(toEventNoteInput(ev, ics.label(ev.sourceId)), cfg, templateContent);

	// Ensure the target folder exists.
	if (built.folder && !(app.vault.getAbstractFileByPath(built.folder) instanceof TFolder)) {
		try {
			await app.vault.createFolder(built.folder);
		} catch {
			// May have been created concurrently — proceed.
		}
	}
	const parent =
		(built.folder ? app.vault.getAbstractFileByPath(built.folder) : app.vault.getRoot()) ??
		app.vault.getRoot();
	if (!(parent instanceof TFolder)) return null;

	let file: TFile;
	try {
		file = await app.fileManager.createNewMarkdownFile(parent, built.filename);
	} catch {
		return null;
	}
	try {
		if (built.body) await app.vault.modify(file, `${built.body.replace(/\s+$/, "")}\n`);
		if (Object.keys(built.frontmatter).length) {
			await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				for (const [k, v] of Object.entries(built.frontmatter)) fm[k] = v;
			});
		}
	} catch {
		// The file exists even if body/frontmatter writes failed; return it.
	}
	return file;
}


/** When a day has external events, clicking it opens this picker rather than
 * jumping straight into the note: the daily note (open or create) sits at the
 * top, then each event — so notes and events are both reachable in one click. */
function showDayMenu(
	view: HomeView,
	day: Moment,
	options: DailyNotesOptions | null,
	file: TAbstractFile | null,
	isToday: boolean,
	events: IcsOccurrence[],
	ics: IcsContext,
	anchor: MouseEvent | HTMLElement,
): void {
	const menu = new Menu();
	if (options) {
		const exists = file instanceof TFile;
		menu.addItem((item) =>
			item
				.setTitle(
					exists ? t().cards.calendar.openDailyNote : t().cards.calendar.createDailyNote,
				)
				.setIcon(exists ? "file-text" : "file-plus")
				.onClick(() => openDailyNote(view, day, options, file, isToday)),
		);
		menu.addSeparator();
	}
	menu.addItem((item) => item.setTitle(t().cards.calendar.eventsHeading).setIsLabel(true));
	for (const ev of events) {
		const time = ev.allDay ? t().cards.calendar.allDay : moment(new Date(ev.start)).format("LT");
		menu.addItem((item) =>
			item
				.setTitle(`${time}  ${ev.summary || t().cards.calendar.untitledEvent}`)
				.setIcon("calendar-clock")
				.onClick(() => showEventDetail(view, ev, ics)),
		);
	}
	if (anchor instanceof MouseEvent) {
		menu.showAtMouseEvent(anchor);
	} else {
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}
}


function renderCalendarGrid(
	view: HomeView,
	wrap: HTMLElement,
	cursor: Moment,
	options: DailyNotesOptions | null,
	cfg: NonNullable<DashboardCard["calendar"]>,
	activity: Map<string, number> | null,
	ics: IcsContext,
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

		// Markers row: the daily-note dot, then one coloured dot per external
		// event (capped) so a busy day reads at a glance without overflowing.
		if (file instanceof TFile || events.length) {
			const dots = cell.createDiv("hearth-calendar-dots");
			if (file instanceof TFile) dots.createDiv("hearth-calendar-dot");
			for (const ev of events.slice(0, 3)) {
				const dot = dots.createDiv("hearth-calendar-evdot");
				dot.style.setProperty("--ev-color", ics.color(ev.sourceId));
			}
			if (events.length) {
				cell.setAttribute(
					"aria-label",
					t().cards.calendar.dayEvents(day.format("MMM D"), events.length),
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
			for (const ev of events) renderAgendaEvent(view, evList, ev, day, ics);
		}
	}
}


/** One external-calendar event line in the agenda: a coloured bullet, its time
 * (or "All day"), and the summary, with the source name as a trailing badge
 * when more than one calendar is subscribed. */
function renderAgendaEvent(
	view: HomeView,
	parent: HTMLElement,
	ev: IcsOccurrence,
	day: Moment,
	ics: IcsContext,
): void {
	const row = parent.createDiv("hearth-agenda-event");
	const bullet = row.createDiv("hearth-agenda-evbullet");
	bullet.style.setProperty("--ev-color", ics.color(ev.sourceId));

	const time = row.createDiv("hearth-agenda-evtime");
	time.setText(ev.allDay ? t().cards.calendar.allDay : moment(new Date(ev.start)).format("LT"));

	const body = row.createDiv("hearth-agenda-evbody");
	body.createSpan({ cls: "hearth-agenda-evtitle", text: ev.summary || t().cards.calendar.untitledEvent });
	if (ics.multiSource) {
		const label = ics.label(ev.sourceId);
		if (label) body.createSpan({ cls: "hearth-agenda-evbadge", text: label });
	}

	const open = () => showEventDetail(view, ev, ics);
	row.addEventListener("click", open);
	makeClickable(row, open, `${ev.summary || t().cards.calendar.untitledEvent} — ${day.format("MMM D")}`);
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

	calendarSourcesEditor(ctx, containerEl, cfg);
}


/** The "External calendars" section of the calendar editor: subscribe to one
 * or more ICS/iCal feeds (name, URL, colour, enable toggle) overlaid on the
 * card, plus their shared auto-refresh interval. */
export function calendarSourcesEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: CalendarConfig): void {
	const sources = (cfg.sources ??= []);

	new Setting(containerEl).setName(t().editors.calendar.externalCalendars).setHeading();
	new Setting(containerEl).setDesc(t().editors.calendar.externalCalendarsDesc);

	sources.forEach((source, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.calendar.sourceNamePlaceholder)
				.setValue(source.name)
				.onChange((v) => {
					source.name = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.calendar.sourceUrlPlaceholder)
				.setValue(source.url)
				.onChange((v) => {
					source.url = v.trim();
					ctx.opts.save();
					ctx.opts.rerender();
				});
			txt.inputEl.addClass("hearth-rss-url");
		});
		row.addColorPicker((c) =>
			c.setValue(source.color ?? "#7c6cff").onChange((v) => {
				source.color = v;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon(source.enabled === false ? "eye-off" : "eye")
				.setTooltip(
					source.enabled === false
						? t().editors.calendar.sourceShow
						: t().editors.calendar.sourceHide,
				)
				.onClick(() => {
					source.enabled = source.enabled === false ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, sources, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === sources.length - 1)
				.onClick(() => moveItem(ctx, sources, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.calendar.sourceRemove)
				.onClick(() => {
					sources.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.calendar.addCalendar).onClick(() => {
			sources.push({
				id: `ics-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
				name: "",
				url: "",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);

	if (sources.length === 0) return;

	const refresh = new Setting(containerEl)
		.setName(t().editors.calendar.refresh)
		.setDesc(t().editors.calendar.refreshDesc);
	refresh.addSlider((s) => {
		s.setLimits(0, 180, 5)
			.setValue(cfg.refreshMin ?? 60)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.refreshMin = v === 60 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	eventNoteEditor(ctx, containerEl, cfg);
}


/** The "Event notes" section: configure the modal's Create-note action —
 * template, folder, filename, link property, and per-field routing so the
 * user decides what each event value becomes in the new note. */
export function eventNoteEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: CalendarConfig): void {
	const note = (cfg.eventNote ??= {});

	new Setting(containerEl).setName(t().editors.calendar.eventNoteHeading).setHeading();
	new Setting(containerEl).setDesc(t().editors.calendar.eventNoteDesc);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteEnabled)
		.setDesc(t().editors.calendar.eventNoteEnabledDesc)
		.addToggle((tg) =>
			tg.setValue(note.enabled !== false).onChange((v) => {
				note.enabled = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (note.enabled === false) return;

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteFolder)
		.setDesc(t().editors.calendar.eventNoteFolderDesc)
		.addText((txt) =>
			txt.setValue(note.folder ?? "").onChange((v) => {
				note.folder = v.trim() || undefined;
				ctx.opts.save();
			}),
		);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteFilename)
		.setDesc(t().editors.calendar.eventNoteFilenameDesc)
		.addText((txt) =>
			txt
				.setPlaceholder("{{summary}}")
				.setValue(note.filename ?? "")
				.onChange((v) => {
					note.filename = v.trim() || undefined;
					ctx.opts.save();
				}),
		);

	const template = new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteTemplate)
		.setDesc(t().editors.calendar.eventNoteTemplateDesc);
	template.addText((txt) => {
		txt.setValue(note.template ?? "").onChange((v) => {
			note.template = v.trim() || undefined;
			ctx.opts.save();
		});
		txt.inputEl.addClass("hearth-rss-url");
	});
	template.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.calendar.eventNotePickTemplate)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					note.template = file.path;
					ctx.opts.save();
					ctx.requestRender();
				}).open();
			}),
	);
	template.addExtraButton((b) =>
		b
			.setIcon("x")
			.setTooltip(t().editors.calendar.eventNoteClearTemplate)
			.onClick(() => {
				note.template = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteLinkKey)
		.setDesc(t().editors.calendar.eventNoteLinkKeyDesc)
		.addText((txt) =>
			txt
				.setPlaceholder("event_uid")
				.setValue(note.linkKey ?? "")
				.onChange((v) => {
					// Distinguish "unset (use default)" from "explicitly empty".
					note.linkKey = v === "" ? undefined : v.trim();
					ctx.opts.save();
				}),
		);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteCustomize)
		.setDesc(t().editors.calendar.eventNoteCustomizeDesc)
		.addToggle((tg) =>
			tg.setValue(note.fields !== undefined).onChange((v) => {
				note.fields = v ? DEFAULT_EVENT_NOTE_FIELDS.map((f) => ({ ...f })) : undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	if (note.fields) eventNoteFieldsEditor(ctx, containerEl, note);
}


/** The editable list of per-field routing rules (field → action → key/format). */
export function eventNoteFieldsEditor(ctx: CardEditorContext, containerEl: HTMLElement, note: EventNoteConfig): void {
	const rules = (note.fields ??= []);
	const fieldNames = t().editors.calendar.eventFieldNames;
	const actionNames = t().editors.calendar.eventFieldActions;
	const fieldOrder: EventField[] = [
		"summary",
		"date",
		"start",
		"end",
		"location",
		"description",
		"url",
		"calendar",
	];

	new Setting(containerEl).setName(t().editors.calendar.eventNoteFieldsHeading).setHeading();

	rules.forEach((rule, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addDropdown((d) => {
			for (const f of fieldOrder) d.addOption(f, fieldNames[f]);
			d.setValue(rule.field).onChange((v) => {
				rule.field = v as EventField;
				ctx.opts.save();
			});
		});
		row.addDropdown((d) => {
			d.addOption("ignore", actionNames.ignore);
			d.addOption("frontmatter", actionNames.frontmatter);
			d.addOption("body", actionNames.body);
			d.setValue(rule.action).onChange((v) => {
				rule.action = v as EventFieldAction;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
		if (rule.action !== "ignore") {
			row.addText((txt) => {
				txt
					.setPlaceholder(
						rule.action === "frontmatter"
							? t().editors.calendar.eventNotePropertyPlaceholder
							: t().editors.calendar.eventNoteHeadingPlaceholder,
					)
					.setValue(rule.key ?? "")
					.onChange((v) => {
						rule.key = v.trim() || undefined;
						ctx.opts.save();
					});
			});
		}
		if (rule.action === "frontmatter" && ["date", "start", "end"].includes(rule.field)) {
			row.addText((txt) => {
				txt
					.setPlaceholder(t().editors.calendar.eventNoteFormatPlaceholder)
					.setValue(rule.format ?? "")
					.onChange((v) => {
						rule.format = v.trim() || undefined;
						ctx.opts.save();
					});
				txt.inputEl.addClass("hearth-event-format");
			});
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, rules, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === rules.length - 1)
				.onClick(() => moveItem(ctx, rules, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.calendar.eventNoteRemoveField)
				.onClick(() => {
					rules.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.calendar.eventNoteAddField).onClick(() => {
			rules.push({ field: "location", action: "frontmatter" });
			ctx.opts.save();
			ctx.requestRender();
		}),
	);
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
