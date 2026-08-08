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
import {
	applyCompletion,
	cachedLocalCalendar,
	collectTaskNotesTasks,
	collectTimeblockOccurrences,
	dailyNoteDayKey,
	loadLocalCalendar,
	loadTaskNotesSubscriptions,
	openInTaskNotes,
	readTaskAt,
	readTaskNotesSetup,
	subscriptionStatus,
	taskNotesEnabled,
	taskNotesEvents,
	taskNotesMeta,
	taskNotesSubscriptions,
	type TaskNotesLayerOptions,
	type TaskNotesMeta,
	type TaskNotesSetup,
	type TaskNotesSubscription,
} from "../tasknotes";
import {
	calendarChips,
	type CalendarChipConfig,
	type CalendarConfig,
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	type ResolvedChips,
	type TaskNotesSourceConfig,
} from "../types";
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


/** Per-render helper bundling the event state for a calendar card: lazily
 * fetches each ICS source, reads the TaskNotes source when it's switched on,
 * expands everything for a given window, and hands the card per-day
 * occurrences plus each source's colour and label. When there are no sources
 * every method is a cheap no-op, so the note grid pays nothing. */
interface IcsContext {
	/** Recompute the day buckets for `[startMs, endMs)` from cached feeds. */
	expand(startMs: number, endMs: number): void;
	/** Occurrences on a given local day key (YYYY-MM-DD), already sorted. */
	on(dayKey: string): IcsOccurrence[];
	/** CSS colour for a source id. */
	color(sourceId: string | undefined): string;
	/** CSS colour for one occurrence: a TaskNotes entry carries its own status/
	 * priority colour, anything else takes its source's. */
	eventColor(ev: IcsOccurrence): string;
	/** Friendly label for a source id. */
	label(sourceId: string | undefined): string;
	/** Whether any event source (ICS feed or TaskNotes) is configured. */
	readonly hasSources: boolean;
	/** Whether more than one source is configured (badges shown only then,
	 * since with a single source the label is redundant). */
	readonly multiSource: boolean;
	/** The event → note configuration for the "Create note" modal action. */
	readonly eventNote: EventNoteConfig | undefined;
	/** The live TaskNotes source, or null when it's off/unavailable. */
	readonly taskNotes: TaskNotesSource | null;
	/** Which chips an entry may show, resolved from the card's config. */
	readonly chips: ResolvedChips;
	/** Register a redraw to run after a background fetch (or a write) resolves. */
	onLoaded(cb: () => void): void;
	/** Redraw now — used after a task is completed from the event popup. */
	refresh(): void;
	/** Kick the initial fetch (and schedule auto-refresh). */
	start(): void;
}


/** The resolved TaskNotes source for one card render. */
interface TaskNotesSource {
	setup: TaskNotesSetup;
	layers: TaskNotesLayerOptions;
	/** Offer a complete/reopen action in the event popup. */
	allowComplete: boolean;
}


/** Source id given to every TaskNotes task/timeblock entry, so it resolves a
 * label and colour through the same lookup as an ICS feed. */
const TASKNOTES_SOURCE_ID = "hearth:tasknotes";

/** Source id prefix for a calendar subscribed inside TaskNotes. */
const TASKNOTES_SUB_PREFIX = "hearth:tnsub:";


/** Resolve the card's TaskNotes source: its live settings plus the layers to
 * draw. Each layer follows TaskNotes' own calendar settings unless this card
 * overrides it, so switching the source on mirrors TaskNotes as configured. */
function buildTaskNotesSource(view: HomeView, cfg: TaskNotesSourceConfig | undefined): TaskNotesSource | null {
	if (cfg?.enabled !== true || !taskNotesEnabled(view.app)) return null;
	const setup = readTaskNotesSetup(view.app);
	const pick = (own: boolean | undefined, mirrored: boolean): boolean => own ?? mirrored;
	return {
		setup,
		layers: {
			scheduled: pick(cfg.scheduled, setup.calendar.scheduled),
			due: pick(cfg.due, setup.calendar.due),
			recurring: pick(cfg.recurring, setup.calendar.recurring),
			timeblocks: pick(cfg.timeblocks, setup.calendar.timeblocks),
			completed: cfg.completed ?? true,
			archived: cfg.archived ?? false,
			colorBy: cfg.colorBy ?? "status",
			fallbackColor: cfg.color || "var(--interactive-accent)",
			dueColor: cfg.dueColor || "",
		},
		allowComplete: cfg.allowComplete !== false,
	};
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

	const taskNotes = buildTaskNotesSource(view, cfg.taskNotes);
	// TaskNotes' own calendar subscriptions, mirrored onto this card unless the
	// user turned that off. They keep their TaskNotes colour and name. The list
	// is re-read on every load: TaskNotes keeps it in its plugin data, which
	// only the asynchronous read can reach (see loadTaskNotesSubscriptions).
	const mirrorSubs = taskNotes !== null && cfg.taskNotes?.subscriptions !== false;
	let subs: TaskNotesSubscription[] =
		mirrorSubs && taskNotes
			? taskNotesSubscriptions(view.app, taskNotes.setup).filter((s) => s.enabled)
			: [];

	// The vault is read once per render: the card is rebuilt wholesale on any
	// vault change (liveness: "vault"), so month navigation costs nothing extra.
	let tasksCache: ReturnType<typeof collectTaskNotesTasks> | null = null;
	let timeblockCache: IcsOccurrence[] | null = null;
	const invalidate = (): void => {
		tasksCache = null;
		timeblockCache = null;
	};

	const src = (id: string | undefined) => sources.find((s) => s.id === id);
	const sub = (id: string | undefined) =>
		id?.startsWith(TASKNOTES_SUB_PREFIX)
			? subs.find((s) => `${TASKNOTES_SUB_PREFIX}${s.id}` === id)
			: undefined;
	const color = (id: string | undefined): string => {
		if (id === TASKNOTES_SOURCE_ID) return taskNotes?.layers.fallbackColor || "var(--interactive-accent)";
		return sub(id)?.color || src(id)?.color || "var(--interactive-accent)";
	};
	const eventColor = (ev: IcsOccurrence): string =>
		taskNotesMeta(ev)?.color || color(ev.sourceId);
	const label = (id: string | undefined): string => {
		if (id === TASKNOTES_SOURCE_ID) return t().cards.calendar.taskNotesSource;
		const subscription = sub(id);
		if (subscription) {
			return (
				subscription.name ||
				(subscription.type === "local"
					? subscription.filePath
					: cachedCalendar(subscription.url)?.name || feedHost(subscription.url))
			);
		}
		const s = src(id);
		if (!s) return "";
		return s.name.trim() || cachedCalendar(s.url)?.name || feedHost(s.url);
	};

	/** Every TaskNotes entry inside the window: tasks (scheduled / due /
	 * recurring occurrences) plus timeblocks from daily notes. */
	const taskNotesOccurrences = (startMs: number, endMs: number): IcsOccurrence[] => {
		if (!taskNotes) return [];
		tasksCache ??= collectTaskNotesTasks(view.app, taskNotes.setup);
		const out = taskNotesEvents(tasksCache, taskNotes.setup, taskNotes.layers, startMs, endMs);
		if (taskNotes.layers.timeblocks) {
			const options = dailyNotesOptions(view);
			timeblockCache ??= collectTimeblockOccurrences(
				view.app,
				(path) =>
					dailyNoteDayKey(path, (options?.format || "YYYY-MM-DD").trim(), (input, fmt) =>
						moment(input, fmt, true),
					),
				cfg.taskNotes?.timeblockColor || taskNotes.layers.fallbackColor,
			);
			for (const o of timeblockCache) {
				const end = o.end ?? o.start;
				if (o.start < endMs && end >= startMs) out.push(o);
			}
		}
		for (const o of out) o.sourceId = TASKNOTES_SOURCE_ID;
		return out;
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
		for (const s of subs) {
			const cal = s.type === "local" ? cachedLocalCalendar(s.filePath) : cachedCalendar(s.url);
			if (!cal) continue;
			for (const o of expandEvents(cal.events, startMs, endMs)) {
				o.sourceId = `${TASKNOTES_SUB_PREFIX}${s.id}`;
				occ.push(o);
			}
		}
		occ.push(...taskNotesOccurrences(startMs, endMs));
		byDay = eventsByDay(occ);
	};

	const load = (force: boolean): void => {
		if (sources.length === 0 && !mirrorSubs) return;
		void (async () => {
			// Re-read TaskNotes' subscription list first: it lives in TaskNotes'
			// plugin data, so the synchronous list above can be empty on the very
			// first render even when subscriptions exist.
			if (mirrorSubs && taskNotes) {
				subs = (await loadTaskNotesSubscriptions(view.app, taskNotes.setup)).filter(
					(s) => s.enabled,
				);
			}
			if (destroyed) return;
			const pending: Promise<unknown>[] = sources.map((s) =>
				loadCalendar(s.url, { ttlMs, disabled, force }),
			);
			for (const s of subs) {
				pending.push(
					s.type === "local"
						? loadLocalCalendar(view.app, s.filePath)
						: loadCalendar(s.url, { ttlMs, disabled, force }),
				);
			}
			await Promise.all(pending);
			if (destroyed) return;
			redraw?.();
		})();
	};

	return {
		expand,
		on: (key) => byDay.get(key) ?? [],
		color,
		eventColor,
		label,
		hasSources: sources.length > 0 || taskNotes !== null,
		multiSource: sources.length + subs.length + (taskNotes ? 1 : 0) > 1,
		eventNote: cfg.eventNote,
		taskNotes,
		chips: calendarChips(cfg.chips),
		onLoaded: (cb) => {
			redraw = cb;
		},
		refresh: () => {
			invalidate();
			if (!destroyed) redraw?.();
		},
		start: () => {
			load(false);
			// ttlMs above keeps using the configured interval; low power mode only
			// drops the timer, so subscriptions still load on render and on an
			// explicit refresh.
			const autoRefreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, refreshMin);
			if (autoRefreshMin > 0) {
				component.registerInterval(
					window.setInterval(() => load(true), autoRefreshMin * 60_000),
				);
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

		const task = taskNotesMeta(ev);
		const rows = this.contentEl.createDiv("hearth-event-rows");
		this.row(rows, "calendar-days", eventDateLabel(ev));
		this.row(rows, "clock", eventTimeLabel(ev));
		if (ev.location) this.row(rows, "map-pin", ev.location);
		if (task) this.renderTaskRows(rows, task);

		const label = this.ics.label(ev.sourceId);
		if (label) {
			const row = this.row(rows, null, label);
			// Fill the icon gutter with the source's colour dot.
			const dot = row.querySelector<HTMLElement>(".hearth-event-icon")!.createDiv(
				"hearth-event-caldot",
			);
			dot.style.setProperty("--ev-color", this.ics.eventColor(ev));
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

		// A TaskNotes entry already *is* a note, so it gets its own actions
		// (open it where TaskNotes would, complete this occurrence) instead of
		// the create-a-note-from-this-event action an ICS event gets.
		if (task) this.renderTaskActions(task);
		else if (this.ics.eventNote?.enabled !== false) this.renderNoteAction();
	}

	/** The TaskNotes-specific detail rows: status, priority, contexts, projects,
	 * time estimate and the recurring marker — everything the task carries, so
	 * the popup shows what TaskNotes itself would. */
	private renderTaskRows(rows: HTMLElement, task: TaskNotesMeta): void {
		const strings = t().cards.calendar;
		if (task.statusLabel) {
			const row = this.row(rows, null, task.statusLabel);
			const dot = row.querySelector<HTMLElement>(".hearth-event-icon")!.createDiv(
				"hearth-event-caldot",
			);
			dot.style.setProperty("--ev-color", task.color || "var(--interactive-accent)");
		}
		if (task.priorityLabel) this.row(rows, "flag", task.priorityLabel);
		if (task.contexts.length) this.row(rows, "at-sign", task.contexts.join(", "));
		if (task.projects.length) {
			// Project values are often wikilinks — show them as plain names.
			this.row(rows, "folder", task.projects.map((p) => p.replace(/^\[\[|\]\]$/g, "")).join(", "));
		}
		if (task.timeEstimate) this.row(rows, "hourglass", strings.taskEstimate(task.timeEstimate));
		if (task.recurring) this.row(rows, "repeat", t().cards.tasks.recurring);
		if (task.kind === "due") this.row(rows, "target", strings.taskDue);
		if (task.kind === "timeblock") this.row(rows, "layout-grid", strings.taskTimeblock);
	}

	/** Footer actions for a TaskNotes entry: open it (in TaskNotes' own editor
	 * when it can be, otherwise the note), and complete/reopen this occurrence. */
	private renderTaskActions(task: TaskNotesMeta): void {
		const footer = this.contentEl.createDiv("hearth-event-footer");
		const open = footer.createEl("button", { cls: "mod-cta" });
		setIcon(open.createSpan("hearth-event-btnicon"), "file-text");
		open.createSpan({
			text: task.kind === "timeblock"
				? t().cards.calendar.openDailyNote
				: t().cards.calendar.openTaskNote,
		});
		open.addEventListener("click", () => {
			void this.openTaskTarget(task);
		});

		if (task.kind === "timeblock" || !this.ics.taskNotes?.allowComplete) return;
		const toggle = footer.createEl("button");
		setIcon(toggle.createSpan("hearth-event-btnicon"), task.done ? "rotate-ccw" : "check");
		toggle.createSpan({
			text: task.done ? t().cards.calendar.taskReopen : t().cards.calendar.taskComplete,
		});
		toggle.addEventListener("click", () => {
			void toggleTaskCompletion(this.view, task, !task.done, this.ics).then(() => this.close());
		});
	}

	/** Open the note behind a TaskNotes entry: a task opens in TaskNotes' edit
	 * modal when the plugin can resolve it, a timeblock (and any task TaskNotes
	 * won't open) falls back to the note itself. */
	private async openTaskTarget(task: TaskNotesMeta): Promise<void> {
		if (task.kind !== "timeblock" && (await openInTaskNotes(this.app, task.path))) {
			this.close();
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			void openFile(this.view, file, "card");
			this.close();
		} else {
			new Notice(t().notices.couldNotOpenTaskNote);
		}
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
		// TaskNotes entries are recognisable in the picker too: a checked circle
		// for a finished task, a target for a deadline, a block for a timeblock.
		const task = taskNotesMeta(ev);
		const icon = !task
			? "calendar-clock"
			: task.kind === "timeblock"
				? "layout-grid"
				: task.done
					? "check-circle-2"
					: task.kind === "due"
						? "target"
						: "circle";
		menu.addItem((item) =>
			item
				.setTitle(`${time}  ${ev.summary || t().cards.calendar.untitledEvent}`)
				.setIcon(icon)
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
				dot.style.setProperty("--ev-color", ics.eventColor(ev));
				// A finished task's dot fades, so a busy day still reads as
				// "what's left" at a glance — the way TaskNotes shows it.
				dot.toggleClass("is-done", taskNotesMeta(ev)?.done === true);
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


/** One event line in the agenda: a coloured bullet, its time (or "All day"),
 * and the summary, with the source name as a trailing badge when more than one
 * calendar is in play. A TaskNotes entry additionally carries a completion box,
 * its due/recurring markers, and strikes through once it's done — so the agenda
 * reads like TaskNotes' own list while staying a calendar. */
function renderAgendaEvent(
	view: HomeView,
	parent: HTMLElement,
	ev: IcsOccurrence,
	day: Moment,
	ics: IcsContext,
): void {
	const task = taskNotesMeta(ev);
	const chips = ics.chips;
	const row = parent.createDiv("hearth-agenda-event");
	row.toggleClass("is-task", task !== null);
	row.toggleClass("is-done", task?.done === true);

	// A completable task swaps the bullet for a checkbox that writes straight
	// back to the note (the whole occurrence for a recurring task).
	if (task && task.kind !== "timeblock" && ics.taskNotes?.allowComplete) {
		renderTaskCompleteBox(view, row, task, ics);
	} else {
		const bullet = row.createDiv("hearth-agenda-evbullet");
		bullet.style.setProperty("--ev-color", ics.eventColor(ev));
	}

	if (chips.time) {
		const time = row.createDiv("hearth-agenda-evtime");
		time.setText(ev.allDay ? t().cards.calendar.allDay : moment(new Date(ev.start)).format("LT"));
	}

	const body = row.createDiv("hearth-agenda-evbody");
	body.createSpan({ cls: "hearth-agenda-evtitle", text: ev.summary || t().cards.calendar.untitledEvent });
	if (task) {
		if (chips.due && task.kind === "due") {
			const badge = body.createSpan({
				cls: "hearth-agenda-evbadge is-due",
				text: t().cards.calendar.taskDue,
			});
			badge.style.setProperty("--ev-color", ics.eventColor(ev));
		}
		if (chips.timeblock && task.kind === "timeblock") {
			body.createSpan({
				cls: "hearth-agenda-evbadge is-timeblock",
				text: t().cards.calendar.taskTimeblock,
			});
		}
		if (chips.recurring && task.recurring) {
			body.createSpan({ cls: "hearth-agenda-evbadge", text: t().cards.tasks.recurring });
		}
		if (chips.status && task.statusLabel) {
			body.createSpan({ cls: "hearth-agenda-evbadge", text: task.statusLabel });
		}
		if (chips.priority && task.priorityLabel) {
			body.createSpan({ cls: "hearth-agenda-evbadge", text: task.priorityLabel });
		}
	}
	if (chips.source && ics.multiSource) {
		const label = ics.label(ev.sourceId);
		if (label) body.createSpan({ cls: "hearth-agenda-evbadge", text: label });
	}

	const open = () => showEventDetail(view, ev, ics);
	row.addEventListener("click", open);
	makeClickable(row, open, `${ev.summary || t().cards.calendar.untitledEvent} — ${day.format("MMM D")}`);
}


/** The completion checkbox on a TaskNotes agenda row. Writes exactly what
 * TaskNotes writes — this day's entry in `complete_instances` for a recurring
 * task, the status for a one-off — then redraws the card. */
function renderTaskCompleteBox(
	view: HomeView,
	row: HTMLElement,
	task: TaskNotesMeta,
	ics: IcsContext,
): void {
	const box = row.createEl("input", {
		cls: "hearth-agenda-evcheck",
		attr: { type: "checkbox", "aria-label": t().cards.calendar.taskComplete },
	});
	box.checked = task.done;
	box.style.setProperty("--ev-color", task.color || "var(--interactive-accent)");
	// The row itself opens the event popup; the box must not.
	box.addEventListener("click", (e) => e.stopPropagation());
	box.addEventListener("change", () => {
		void toggleTaskCompletion(view, task, box.checked, ics);
	});
}


/** Complete (or reopen) one TaskNotes occurrence from the calendar. */
async function toggleTaskCompletion(
	view: HomeView,
	task: TaskNotesMeta,
	complete: boolean,
	ics: IcsContext,
): Promise<void> {
	const source = ics.taskNotes;
	if (!source) return;
	const current = readTaskAt(view.app, source.setup, task.path);
	if (!current || !(await applyCompletion(view.app, source.setup, current, task.dayKey, complete))) {
		new Notice(t().notices.couldNotUpdateTaskStatus);
	}
	ics.refresh();
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

	calendarChipsEditor(ctx, containerEl, cfg);
	taskNotesSourceEditor(ctx, containerEl, cfg);
	calendarSourcesEditor(ctx, containerEl, cfg);
}


/** The "Entry details" section: pick which chips each agenda entry carries.
 * On a narrow card the markers can crowd out the title, and not every vault
 * wants a priority or a calendar name on every line — so each is switchable.
 * The task-only chips are offered only when TaskNotes is a source, since
 * nothing else produces them. */
export function calendarChipsEditor(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	cfg: CalendarConfig,
): void {
	const strings = t().editors.calendar;
	// The chips only appear in the agenda layout; the month grid draws dots.
	if (cfg.view !== "agenda") return;

	new Setting(containerEl).setName(strings.chipsHeading).setHeading();
	new Setting(containerEl).setDesc(strings.chipsDesc);

	const chips = (cfg.chips ??= {});
	const toggle = (
		name: string,
		desc: string,
		read: () => boolean,
		write: (on: boolean) => void,
	): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((tg) =>
				tg.setValue(read()).onChange((v) => {
					write(v);
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	};

	toggle(
		strings.chipTime,
		strings.chipTimeDesc,
		() => chips.time !== false,
		(on) => (chips.time = on ? undefined : false),
	);
	toggle(
		strings.chipSource,
		strings.chipSourceDesc,
		() => chips.source !== false,
		(on) => (chips.source = on ? undefined : false),
	);

	if (cfg.taskNotes?.enabled !== true) return;

	toggle(
		strings.chipStatus,
		strings.chipStatusDesc,
		() => chips.status === true,
		(on) => (chips.status = on || undefined),
	);
	toggle(
		strings.chipPriority,
		strings.chipPriorityDesc,
		() => chips.priority !== false,
		(on) => (chips.priority = on ? undefined : false),
	);
	toggle(
		strings.chipDue,
		strings.chipDueDesc,
		() => chips.due !== false,
		(on) => (chips.due = on ? undefined : false),
	);
	toggle(
		strings.chipRecurring,
		strings.chipRecurringDesc,
		() => chips.recurring !== false,
		(on) => (chips.recurring = on ? undefined : false),
	);
	toggle(
		strings.chipTimeblock,
		strings.chipTimeblockDesc,
		() => chips.timeblock !== false,
		(on) => (chips.timeblock = on ? undefined : false),
	);
}


/** The "TaskNotes" section of the calendar editor: switch TaskNotes on as an
 * event source and choose which of its layers this card mirrors. Each layer
 * toggle starts from TaskNotes' own calendar settings, so a card that is simply
 * switched on already shows what TaskNotes shows. */
export function taskNotesSourceEditor(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	cfg: CalendarConfig,
): void {
	const strings = t().editors.calendar;
	const installed = taskNotesEnabled(ctx.app);

	new Setting(containerEl).setName(strings.taskNotesHeading).setHeading();
	new Setting(containerEl).setDesc(
		installed ? strings.taskNotesDesc : strings.taskNotesMissing,
	);
	// Nothing is written into the card until TaskNotes is actually there to
	// configure, so a vault without it keeps a clean card config.
	if (!installed) return;
	const tn = (cfg.taskNotes ??= {});

	new Setting(containerEl)
		.setName(strings.taskNotesEnabled)
		.setDesc(strings.taskNotesEnabledDesc)
		.addToggle((tg) =>
			tg.setValue(tn.enabled === true).onChange((v) => {
				tn.enabled = v || undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (tn.enabled !== true) return;

	// The live TaskNotes settings the unset toggles inherit from, so each row
	// can say what "follow TaskNotes" currently means.
	const setup = readTaskNotesSetup(ctx.app);
	const layer = (
		name: string,
		desc: string,
		read: () => boolean | undefined,
		write: (v: boolean | undefined) => void,
		mirrored: boolean,
	): void => {
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(`${desc} ${strings.taskNotesFollows(mirrored)}`);
		setting.addToggle((tg) =>
			tg.setValue(read() ?? mirrored).onChange((v) => {
				write(v === mirrored ? undefined : v);
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(strings.taskNotesFollowReset)
				.onClick(() => {
					write(undefined);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	};

	layer(
		strings.taskNotesScheduled,
		strings.taskNotesScheduledDesc,
		() => tn.scheduled,
		(v) => (tn.scheduled = v),
		setup.calendar.scheduled,
	);
	layer(
		strings.taskNotesDue,
		strings.taskNotesDueDesc,
		() => tn.due,
		(v) => (tn.due = v),
		setup.calendar.due,
	);
	layer(
		strings.taskNotesRecurring,
		strings.taskNotesRecurringDesc,
		() => tn.recurring,
		(v) => (tn.recurring = v),
		setup.calendar.recurring,
	);
	layer(
		strings.taskNotesTimeblocks,
		strings.taskNotesTimeblocksDesc,
		() => tn.timeblocks,
		(v) => (tn.timeblocks = v),
		setup.calendar.timeblocks,
	);

	new Setting(containerEl)
		.setName(strings.taskNotesCompleted)
		.setDesc(strings.taskNotesCompletedDesc)
		.addToggle((tg) =>
			tg.setValue(tn.completed !== false).onChange((v) => {
				tn.completed = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	new Setting(containerEl)
		.setName(strings.taskNotesArchived)
		.setDesc(strings.taskNotesArchivedDesc)
		.addToggle((tg) =>
			tg.setValue(tn.archived === true).onChange((v) => {
				tn.archived = v || undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	new Setting(containerEl)
		.setName(strings.taskNotesComplete)
		.setDesc(strings.taskNotesCompleteDesc)
		.addToggle((tg) =>
			tg.setValue(tn.allowComplete !== false).onChange((v) => {
				tn.allowComplete = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	// TaskNotes keeps its subscriptions in its plugin data, so the count may only
	// be known after an async read — rebuild the editor once when that lands.
	const known = taskNotesSubscriptions(ctx.app, setup);
	if (!known.length && ctx.session.tnSubsProbed !== true) {
		ctx.session.tnSubsProbed = true;
		void loadTaskNotesSubscriptions(ctx.app, setup).then((found) => {
			if (found.length) ctx.requestRender();
		});
	}
	new Setting(containerEl)
		.setName(strings.taskNotesSubscriptions)
		.setDesc(
			known.length
				? strings.taskNotesSubscriptionsDesc(known.length)
				: strings.taskNotesSubscriptionsNone,
		)
		.addToggle((tg) =>
			tg.setValue(tn.subscriptions !== false).onChange((v) => {
				tn.subscriptions = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (tn.subscriptions !== false && known.length) {
		subscriptionStatusList(ctx, containerEl, known);
	}

	new Setting(containerEl)
		.setName(strings.taskNotesColorBy)
		.setDesc(strings.taskNotesColorByDesc)
		.addDropdown((d) => {
			d.addOption("status", strings.taskNotesColorStatus);
			d.addOption("priority", strings.taskNotesColorPriority);
			d.addOption("fixed", strings.taskNotesColorFixed);
			d.setValue(tn.colorBy ?? "status").onChange((v) => {
				tn.colorBy = v === "status" ? undefined : (v as NonNullable<typeof tn.colorBy>);
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	const colorRow = (name: string, desc: string, read: () => string | undefined, write: (v: string | undefined) => void): void => {
		const setting = new Setting(containerEl).setName(name).setDesc(desc);
		setting.addColorPicker((c) =>
			c.setValue(read() || "#7c6cff").onChange((v) => {
				write(v);
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					write(undefined);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	};

	colorRow(
		strings.taskNotesColor,
		strings.taskNotesColorDesc,
		() => tn.color,
		(v) => (tn.color = v),
	);
	colorRow(
		strings.taskNotesDueColor,
		strings.taskNotesDueColorDesc,
		() => tn.dueColor,
		(v) => (tn.dueColor = v),
	);
	colorRow(
		strings.taskNotesTimeblockColor,
		strings.taskNotesTimeblockColorDesc,
		() => tn.timeblockColor,
		(v) => (tn.timeblockColor = v),
	);
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


/**
 * One row per TaskNotes subscription, each reporting what actually happened to
 * it: how many events came through, that it was blocked by the "disable
 * external calls" setting, or why it failed. A feed that can't be fetched
 * otherwise just shows nothing on the card, with no way to tell it apart from
 * an empty calendar — which is exactly the case where a user sees only some of
 * their subscribed calendars.
 */
function subscriptionStatusList(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	subs: TaskNotesSubscription[],
): void {
	const strings = t().editors.calendar;
	for (const sub of subs) {
		const status = subscriptionStatus(sub);
		const where = sub.type === "local" ? sub.filePath : feedHost(sub.url);
		const state = !sub.enabled
			? strings.taskNotesSubDisabled
			: status.blocked
				? strings.taskNotesSubBlocked
				: status.error
					? strings.taskNotesSubFailed(subscriptionError(status.error))
					: status.loaded
						? strings.taskNotesSubLoaded(status.events)
						: strings.taskNotesSubPending;
		new Setting(containerEl)
			.setName(sub.name || where)
			.setDesc(`${where} — ${state}`)
			.setClass("hearth-rss-setting");
	}

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(strings.taskNotesSubRefresh).onClick(() => {
			void refreshSubscriptions(ctx, subs).then(() => ctx.requestRender());
		}),
	);
}


/** A failure reason in the user's language, falling back to whatever the
 * network/vault layer reported. */
function subscriptionError(error: string): string {
	const strings = t().editors.calendar;
	if (error === "not-calendar") return strings.taskNotesSubNotCalendar;
	if (error === "missing-file") return strings.taskNotesSubMissingFile;
	return error;
}


/** Re-fetch every TaskNotes subscription now, bypassing the freshness window,
 * so the rows above report a fresh verdict. */
async function refreshSubscriptions(
	ctx: CardEditorContext,
	subs: TaskNotesSubscription[],
): Promise<void> {
	const disabled = ctx.opts.externalCallsDisabled;
	await Promise.all(
		subs.map((s) =>
			s.type === "local"
				? loadLocalCalendar(ctx.app, s.filePath)
				: loadCalendar(s.url, { ttlMs: 0, disabled, force: true }),
		),
	);
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
