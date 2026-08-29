import { Platform } from "obsidian";
import type { DatacoreLanguage } from "./datacore";
import type { EventNoteConfig } from "./eventnote";
import type { Granularity } from "./periodic";
import type {
	GitAction,
	GitActionStyle,
	GitCommitScope,
	GitSection,
} from "./git";

/** The kind of content a dashboard card renders. */
export type CardKind =
	| "embed"
	| "slideshow"
	| "daily"
	| "periodic"
	| "web"
	| "bookmarks"
	| "favorites"
	| "text"
	| "recent"
	| "links"
	| "commands"
	| "templater"
	| "clock"
	| "tasks"
	| "calendar"
	| "schedule"
	| "stats"
	| "search"
	| "searchbar"
	| "heatmap"
	| "calculator"
	| "dataview"
	| "datacore"
	| "rss"
	| "jira"
	| "weather"
	| "git"
	| "operon"
	| "leaf"
	| "pet";

/** A refinement control available on a Jira saved-filter card. */
export type JiraControl =
	| "status"
	| "assignee"
	| "priority"
	| "issueType"
	| "sprint"
	| "fixVersion";

/** Selected values for each Jira refinement control. Missing keys are unfiltered. */
export type JiraSelections = Partial<Record<JiraControl, string[]>>;

/** Per-card connection, saved-filter, refinement, and refresh settings for Jira. */
export interface JiraConfig {
	/** Jira origin, including http(s) scheme but no API path. */
	host?: string;
	/** Bearer personal access token. Stored in Obsidian plugin data. */
	pat?: string;
	/** Relative Jira REST base path. Default `/rest/api/latest`. */
	apiBasePath?: string;
	/** Jira saved-filter id. */
	filterId?: string;
	/** Saved display name for the chosen filter. */
	filterName?: string;
	/** Refinement controls shown above the issue list. */
	controls?: JiraControl[];
	/** Persisted multi-select refinements. */
	selections?: JiraSelections;
	/** Maximum issues shown by the refined query. Default 50. */
	maxResults?: number;
	/** Automatic refresh interval in minutes. 0 disables it. */
	refreshMin?: number;
	/** In-memory request cache interval in minutes. Default 5. */
	cacheMin?: number;
}

/** A single command tile inside a "commands" card. */
/**
 * The size and position a single button carries inside a launchpad-like card
 * (Links, Commands, Templater). Shared by every tile item type, because the
 * three cards run the same grid, the same drag and the same resize.
 *
 * There are two generations of sizing, kept side by side so a card can switch
 * between them without losing either:
 *
 * - **Fixed (legacy).** `sizeW`/`sizeH` are pixels: the button is that big
 *   whatever the card's size, so widening the card only fits more buttons in.
 * - **Scaled.** `spanW`/`spanH` count cells of the card's own grid (see
 *   `DashboardCard.tileCols`), so a button is a *fraction of the card* and
 *   grows with it — the way a card grows with the dashboard. They move in
 *   halves, since the grid is drawn at half-cell resolution, so a button can be
 *   half a cell wide, half a cell tall, or both.
 *
 * Which pair is read is decided by the card's `tileSizing`; the other is left
 * untouched, so turning the legacy style back on restores the old sizes
 * exactly. A tile with no `spanW`/`spanH` yet derives them from its pixel size
 * on read, so a card flipped to the scaled style keeps its rough proportions;
 * free-form positions, which mean different places on the two grids, start
 * afresh instead (`col`/`row` vs `scaleCol`/`scaleRow`).
 */
export interface TileGeometry {
	/** Fixed sizing: per-tile width in pixels, overriding the card's default. */
	sizeW?: number;
	/** Fixed sizing: per-tile height in pixels, overriding the card's default. */
	sizeH?: number;
	/** Legacy single per-tile pixel size (drove width and height together).
	 * Migrated to sizeW/sizeH on first read; new code writes those instead. */
	size?: number;
	/** Scaled sizing: per-tile width in grid cells, in steps of a half. Default
	 * 1. */
	spanW?: number;
	/** Scaled sizing: per-tile height in grid cells, in steps of a half. Default
	 * 1. */
	spanH?: number;
	/** Fixed sizing: free-form grid position (1-based grid line). When omitted
	 * the tile auto-flows into the first available cell. Set explicitly when a
	 * tile is dragged to a spot so it stays there. */
	col?: number;
	/** Fixed sizing: free-form grid row (1-based). See `col`. */
	row?: number;
	/** Scaled sizing: free-form grid position (1-based grid line). Separate from
	 * `col` because the two styles' cells are different sizes — one scaled cell
	 * is a whole button, one fixed cell half of one — so the same number means
	 * two different places and each style keeps its own arrangement. Halves are
	 * allowed, like the spans: 2.5 is the half step between the second cell and
	 * the third. */
	scaleCol?: number;
	/** Scaled sizing: free-form grid row (1-based, halves allowed). See
	 * `scaleCol`. */
	scaleRow?: number;
}

export interface CommandItem extends TileGeometry {
	/** Obsidian command id, e.g. "editor:toggle-bold". */
	id: string;
	/** Display name (captured when the command was picked). */
	name: string;
	/** Optional Lucide icon id; falls back to a generic command icon. */
	icon?: string;
}

/**
 * A single tile inside a "templater" card: one template, one destination.
 *
 * Deliberately shaped like {@link LinkItem} and {@link CommandItem} — same
 * label/icon/size/position fields — because the three render through the same
 * tile machinery and share their arrange-mode drag and resize. What differs is
 * only what a click *does*.
 */
export interface TemplaterItem extends TileGeometry {
	id: string;
	label: string;
	/** Lucide icon id, or the vault path of an image (see `applyTileVisual`). */
	icon: string;
	/** Vault path of the Templater template file. */
	template: string;
	/** Vault-relative destination folder. Empty means Templater decides, which
	 * in practice is Obsidian's "Default location for new notes". */
	folder?: string;
	/** Filename pattern, without extension. Supports `{{date}}`, `{{date:FMT}}`,
	 * `{{time}}`, `{{time:FMT}}` and `{{prompt}}` (which asks before creating).
	 * Empty means Templater names it "Untitled". */
	filename?: string;
	/** Open the new note after creating it. Default true; turn it off for tiles
	 * that only file something away (a log entry, an inbox capture). */
	open?: boolean;
}

/** Per-card configuration for a "templater" card. */
export interface TemplaterConfig {
	/** The tiles, in order. */
	items?: TemplaterItem[];
}

/** The Tasks-plugin metadata Hearth's Kanban editor reads and writes on a card.
 * Dates are YYYY-MM-DD or ""; `priority` is a key ("highest".."lowest") or "";
 * `recurrence` is the raw text written after 🔁 (e.g. "every week") or "". */
export interface TaskMeta {
	priority: string;
	recurrence: string;
	start: string;
	scheduled: string;
	due: string;
}

/** Per-card configuration for a "tasks" card. */
/** A coarse priority bucket used by task filters ("none" = no priority set). */
export type TaskPriorityLevel = "high" | "medium" | "low" | "none";

/** A due-date constraint used by task filters. Compared against each task's
 * effective date (due, or the next scheduled occurrence for recurring tasks). */
export type TaskDueFilter = "overdue" | "today" | "week" | "hasDate" | "noDate";

/** A single field a custom task sort can order by. Mirrors the simple sort
 * keys but adds `scheduled` and `status`, and drops the composite "smart"
 * (which is only meaningful as the whole default chain, not one rule level). */
export type TaskSortField = "due" | "scheduled" | "priority" | "created" | "alpha" | "status";

/** One level of a custom task sort: a field and a direction. Rules apply in
 * order — the first is the primary sort and each following rule breaks ties. */
export interface TaskSortRule {
	field: TaskSortField;
	/** Reverse this level's natural (ascending) direction. */
	reverse?: boolean;
}

/** A list-layout task filter: only tasks matching every set criterion are
 * shown. Every field is optional; an empty/absent field imposes no constraint,
 * so an all-empty filter is inactive and shows everything. */
export interface TaskFilterConfig {
	/** Only tasks whose status/column value is in this list (case-insensitive).
	 * The compared value is the TaskNotes status, the Kanban column, or the
	 * checkbox state label, whichever the source provides. */
	statuses?: string[];
	/** Only tasks at one of these coarse priority levels. */
	priorities?: TaskPriorityLevel[];
	/** TaskNotes only: task must carry at least one of these contexts
	 * (case-insensitive; wikilink brackets ignored). */
	contexts?: string[];
	/** TaskNotes only: task must carry at least one of these projects
	 * (case-insensitive; wikilink brackets ignored). */
	projects?: string[];
	/** A due-date constraint (see {@link TaskDueFilter}). */
	due?: TaskDueFilter;
	/** Case-insensitive substring the task text must contain. */
	text?: string;
}

/**
 * How a value is drawn on a task.
 *
 * The first three put something on the row: a filled chip, a bare coloured dot
 * (the value moves to the tooltip), or plain text. `dotlabel` is the dot and the
 * label together — the form a priority has always been drawn in, and offered
 * only to a field that reads one. The last two put nothing on the row at all and
 * colour the whole task instead — `hue` tints its background, `glow` rings it —
 * so a board can be read at a glance without any single row having to be read at
 * all.
 */
export type TaskFieldStyle = "pill" | "dot" | "dotlabel" | "text" | "hue" | "glow";

/** One value → what to show for it. Matching is case-insensitive on the
 * trimmed raw value. A value with no entry here still renders — as itself,
 * uncoloured — so a status nobody mapped yet is visible rather than lost. */
export interface TaskValueMap {
	/** The raw value to match (a frontmatter value, a status, a priority key). */
	match: string;
	/** Shown instead of the raw value. Empty shows the raw value. */
	label?: string;
	/** Any CSS colour for this value's chip or dot. */
	color?: string;
}

/** One source a field reads. `source` is either `fm:<property>` for a
 * frontmatter property or `builtin:<id>` for something Hearth parses itself
 * (see `TASK_BUILTIN_SOURCES`). Every key with a value renders. */
export interface TaskFieldKey {
	source: string;
	/** Per-value display overrides.
	 *
	 * A date key stores its three relations here instead of literal values —
	 * `<today`, `today` and `>today` — because a date has no discrete values to
	 * enumerate, only a position relative to now. */
	values?: TaskValueMap[];
	/** Treat this key's value as a date: show it as a relative label
	 * ("Tomorrow"), colour it by its relation to today, and edit it with a
	 * calendar rather than a list. Implied for the built-in date sources; a
	 * frontmatter property has to say so, since Hearth can't know a property
	 * holds a date rather than text that looks like one. */
	isDate?: boolean;
}

/**
 * A field on a task, defined entirely by the user: what it is called, how it is
 * drawn, and which keys feed it. Fields render in list order, and within a
 * field each key renders in its own order.
 *
 * Only used while task-field customization is on; with it off the card falls
 * back to the fixed metadata it has always rendered (see `src/taskfields.ts`).
 */
export interface TaskFieldDef {
	/** Stable id, so the editor can address a field while it is renamed. */
	id: string;
	/** The user's name for the field. Shown in the editor, and on the task
	 * itself only when `showName` is on. */
	name: string;
	/** Prefix each of this field's chips with the field name. */
	showName?: boolean;
	/** How this field's values are drawn. Default "pill". */
	display?: TaskFieldStyle;
	/** For the `hue` and `glow` styles: how strongly the colour is applied, 1-100.
	 * Unset uses a subdued default — strong enough to read across a board,
	 * light enough to leave the text legible. Ignored by the other styles. */
	opacity?: number;
	keys: TaskFieldKey[];
}

export interface TasksConfig {
	/** "checkbox" (default) scans plain Markdown `- [ ]` checkboxes anywhere
	 * in scope. "tasknotes" reads frontmatter from the TaskNotes community
	 * plugin's task notes instead, using the field-name mapping configured in
	 * Settings → Hearth (TaskNotes has no stable public API to query, so this
	 * reads its files the same way TaskNotes itself does: frontmatter).
	 * "kanban" reads a single Kanban-plugin board note, where each `##` heading
	 * is a column and the checkbox items beneath it are that column's cards. */
	source?: "checkbox" | "tasknotes" | "kanban";
	/** Kanban source: path to the board note. When empty, Hearth auto-detects
	 * the first note in scope whose frontmatter carries `kanban-plugin`. */
	kanbanFile?: string;
	/** Kanban source: when true, parse the Tasks-plugin emoji metadata written
	 * inside each card (📅 due, ⏫/🔼/🔽 priority, 🔁 recurrence) so due dates and
	 * priorities show and sort — interoperable with the obsidian-tasks plugin.
	 * When false (default) cards are read as-is (plain text). */
	kanbanExtended?: boolean;
	/** Checkbox source: when true (default), parse the Tasks-plugin emoji
	 * metadata written inline on each `- [ ]` item (📅 due, ⏳ scheduled, 🛫 start,
	 * ⏫/🔼/🔽 priority, 🔁 recurrence, ✅ done) so dates and priorities show as
	 * indicators, sort the list, and can be edited from the item's right-click
	 * menu. When false, checkboxes are read as plain text (the emoji stay in the
	 * visible text and no metadata is written on completion). Mirrors
	 * `kanbanExtended` for the Kanban source. */
	checkboxExtended?: boolean;
	/** Clicking a line-based task (a checkbox or Kanban card) opens a compact
	 * quick-view popover — the task's metadata and description, editable in place,
	 * with actions to open the full note or delete the task — instead of jumping
	 * straight into the file. On by default; storing `false` restores the old
	 * open-the-note-on-click behaviour. TaskNotes tasks always open in their own
	 * editor and ignore this. */
	taskQuickView?: boolean;
	/** Convert-to-note (Kanban cards): vault path of a template note whose body
	 * seeds the created note. Supports {{title}}, {{date}}, {{time}} and their
	 * {{date:FMT}}/{{time:FMT}} formatted variants. Empty creates a blank note. */
	convertNoteTemplate?: string;
	/** Convert-to-note (Kanban cards): scrape the card's Tasks-plugin metadata
	 * (priority, dates, recurrence) into the created note's YAML frontmatter
	 * instead of trailing the emoji markers on the board link. Default false. */
	convertMetadataToFrontmatter?: boolean;
	/** Kanban: create new cards as their own note right away (a link on the
	 * board) instead of an inline checkbox — applying the same convert-to-note
	 * template / metadata-to-frontmatter options. Default false. */
	newTaskAsNote?: boolean;
	/** Checkbox source: the task states shown as Kanban columns, each a checkbox
	 * symbol (the char inside `- [ ]`) with a label and an optional "done" flag.
	 * Dragging a card between columns writes that symbol. When unset, a sensible
	 * default set is used (To do ` `, In progress `/`, Done `x`). */
	checkboxStatuses?: { symbol: string; label: string; done?: boolean }[];
	/** Persistent sort order for the list/board, chosen from the card's own sort
	 * control. "smart" (default) is the due → scheduled → priority → created
	 * chain; the others sort by a single field. Incomplete tasks always sort
	 * before completed ones regardless of key. */
	sortKey?: "smart" | "due" | "priority" | "created" | "alpha";
	/** Reverse the chosen sort direction. */
	sortReverse?: boolean;
	/** List/board custom multi-level sort: an ordered list of field+direction
	 * rules applied in sequence (the first is primary, later rules break ties).
	 * When set (non-empty) it supersedes the single `sortKey`/`sortReverse`, the
	 * same way `taskFilter` supersedes the filter presets. Chosen from the sort
	 * control's "Custom…" option. Incomplete tasks still sort before completed
	 * ones regardless of the rules. */
	sortRules?: TaskSortRule[];
	/** Kanban: per-column sort, keyed by column key. Each column sorts
	 * independently from its own header; a column with no entry falls back to the
	 * card's global `sortKey`/`sortReverse`. */
	kanbanColumnSort?: Record<string, { key?: "smart" | "due" | "priority" | "created" | "alpha"; reverse?: boolean }>;
	/** How `folders` is applied. "all" (default) scans the whole vault. */
	folderScope?: "all" | "whitelist" | "blacklist";
	folders?: string[];
	/** TaskNotes source: the status values counted as "complete" (case-insensitive).
	 * When set and non-empty, a task is done when its status is in this list — so,
	 * e.g., both "done" and "canceled" can be treated as complete. When unset, the
	 * single global `taskNotesDoneValue` from Settings → Hearth is used. */
	taskNotesDoneStatuses?: string[];
	/** TaskNotes source: this card's own frontmatter field names, overriding the
	 * global mapping in Settings → Hearth. Set by the setup wizard, which reads
	 * them from TaskNotes itself — a vault that renamed its fields gets a card
	 * that works on the first render without the wizard reaching into a global
	 * setting every other card and board also follows. Undefined = follow the
	 * global mapping. */
	taskNotesStatusField?: string;
	taskNotesDueField?: string;
	taskNotesPriorityField?: string;
	/** TaskNotes source: this card's own single "complete" status, overriding the
	 * global `taskNotesDoneValue`. Only consulted when
	 * {@link taskNotesDoneStatuses} is unset — a card that lists its complete
	 * statuses has already answered this. */
	taskNotesDoneValue?: string;
	/** List layout: an active filter narrowing which tasks appear. Presets in the
	 * filter modal are conveniences that fill in these concrete criteria; the
	 * filter is "active" (and applied) when any field below is set. */
	taskFilter?: TaskFilterConfig;
	/** Give this card its own field list instead of following the global one
	 * from Settings → Hearth → Integrations. Off by default: a card follows the
	 * global list. Only consulted while the global `taskFieldsEnabled` master
	 * switch is on. */
	taskFieldsEnabled?: boolean;
	/** This card's own fields, replacing the global list. Only used when
	 * `taskFieldsEnabled` is on for the card. An empty list is meaningful — it
	 * shows tasks with no metadata at all. */
	taskFields?: TaskFieldDef[];
	/** Include already-completed tasks. Default false (hide done). */
	showCompleted?: boolean;
	/** Max tasks shown, soonest/overdue due date first. Default 10. */
	count?: number;
	/** "list" (default) renders a flat list; "kanban" groups tasks into status
	 * columns that tasks can be dragged between. */
	layout?: "list" | "kanban";
	/** Kanban: explicit left-to-right order of column keys (drag to reorder).
	 * Columns not listed keep their default order after the listed ones. */
	kanbanOrder?: string[];
	/** Kanban: column keys the user has hidden. */
	kanbanHidden?: string[];
	/** Kanban: column keys that mark a card done when it lands in them (dragged
	 * or added). Toggled per column from the board header. */
	kanbanDoneColumns?: string[];
}

/**
 * Per-card configuration for an "operon" card.
 *
 * Every field maps onto something Operon's Developer API already understands —
 * its pipelines, statuses, priorities and finder scopes — so the card asks
 * Operon for a set of tasks rather than filtering a vault scan of its files.
 * Ids are Operon's; the card resolves them to labels and colors through its
 * taxonomy at render time, and shows the raw id if one has been deleted.
 */
export interface OperonConfig {
	/** What the card draws. "list" is a flat task list, "board" groups tasks
	 * into pipeline-status columns, "agenda" lists the next few days, "timer"
	 * shows the running time tracker. */
	view?: "list" | "board" | "agenda" | "timer";
	/** List view: which of Operon's own scoped views to read. "query" (default)
	 * applies the filters below instead; the rest delegate the definition of
	 * "overdue" or "happening today" to Operon. */
	scope?: "query" | "normal" | "overdue" | "happens-today" | "recent";
	/** Restrict to these Operon pipelines. Empty means all. */
	pipelineIds?: string[];
	/** Restrict to these Operon status ids. Empty means all. */
	statusIds?: string[];
	/** Restrict to these Operon priority ids. Empty means all. */
	priorityIds?: string[];
	/** Which checkbox states to include. Unset shows open tasks only. */
	checkbox?: ("open" | "done" | "cancelled")[];
	/** Restrict to tasks living in this note. */
	filePath?: string;
	/** Free-text match on the task description. */
	text?: string;
	/** Agenda view: how many days ahead to list, including today. Default 7. */
	agendaDays?: number;
	/** Max tasks shown. Default 10. */
	count?: number;
	/** Board view: explicit left-to-right order of status ids (drag to
	 * reorder). Statuses not listed keep their Operon order after the listed
	 * ones, so a status added upstream still appears. */
	boardOrder?: string[];
	/** Board view: status ids the user has hidden. */
	boardHidden?: string[];
	/** Where the card's "+" asks Operon to put a new task: unset follows
	 * Operon's own default, "inline" forces its configured inline target (daily
	 * note, a specific file, the active file), "file" forces a task note in its
	 * configured folder. The path is always Operon's — this only picks which of
	 * its two configured targets to use, which is the way past an inline target
	 * Operon can't currently resolve. */
	createAs?: "inline" | "file";
	/** Sort order for the list and each board column. Default "smart"
	 * (date → priority → age). Open tasks always sort before closed ones. */
	sortKey?: "smart" | "due" | "priority" | "created" | "alpha";
	/** Reverse the chosen sort direction. */
	sortReverse?: boolean;
	/** Which metadata chips each row shows. All on by default. */
	showDue?: boolean;
	showPriority?: boolean;
	showStatus?: boolean;
	showRecurrence?: boolean;
	showTracker?: boolean;
	showPinned?: boolean;
	showFile?: boolean;
}

/** An external calendar (ICS/iCal) subscription a "calendar" card overlays on
 * top of its daily-note grid. `url` is an http(s)/webcal `.ics` address; `color`
 * tints the source's event dots and chips; `name` labels it in the editor. */
export interface IcsSource {
	id: string;
	/** Display label for the source (editor list + agenda badges). */
	name: string;
	/** ICS feed URL (http/https/webcal). */
	url: string;
	/** CSS color for this source's events. Falls back to the accent color. */
	color?: string;
	/** Temporarily hide this source's events without deleting it. */
	enabled?: boolean;
}

/**
 * Where a calendar-style card gets its events, and what it does with one.
 *
 * Shared by the mini calendar and the full Calendar card so both subscribe to
 * feeds, mirror TaskNotes and create event notes through exactly the same
 * config and the same editor sections — a user who has set one up knows the
 * other.
 */
export interface CalendarSourcesConfig {
	/** External ICS calendars overlaid on the card. */
	sources?: IcsSource[];
	/** Auto-refresh interval for external calendars, in minutes. 0 (or omitted →
	 * default 60) refreshes only when the card is (re)opened or manually. */
	refreshMin?: number;
	/** How the "Create note" action in the event modal builds a note from an
	 * event (template, filename, per-field routing). */
	eventNote?: EventNoteConfig;
	/** TaskNotes as an event source: scheduled tasks, due dates, recurring
	 * instances, timeblocks and TaskNotes' own calendar subscriptions, drawn on
	 * this card alongside any ICS feeds. Off unless `enabled`. */
	taskNotes?: TaskNotesSourceConfig;
	/** Which chips each listed entry shows. Omitted (or an omitted field) keeps
	 * the default set. */
	chips?: CalendarChipConfig;
}


/** Per-card configuration for a "calendar" card. */
export interface CalendarConfig extends CalendarSourcesConfig {
	/** Layout: "month" (default) renders the month grid; "agenda" renders a
	 * chronological list of upcoming days. */
	view?: "month" | "agenda";
	/** Agenda view only: how many days ahead to list (including today).
	 * Default 14. */
	agendaDays?: number;
	/** Show an ISO week-number column down the left edge. */
	showWeekNumbers?: boolean;
	/** Tint each day by note activity that day (a heatmap). */
	heatmap?: boolean;
	/** Which timestamp the heatmap counts. Default "modified". */
	heatmapMetric?: "modified" | "created";
	/** Overlay Operon tasks with a due date on the grid and agenda, the same
	 * way external calendars are overlaid. Requires the Operon integration to
	 * be available and approved. */
	operonTasks?: boolean;
	/** CSS color for the Operon task markers. Falls back to the accent color. */
	operonTaskColor?: string;
}


/** The layouts a "schedule" (Calendar) card can draw. */
export type ScheduleView = "month" | "week" | "day" | "list";


/**
 * Per-card configuration for a "schedule" card — the full Calendar.
 *
 * Everything here is optional and every default is the one a calendar should
 * have without being configured: a month grid with named events, the locale's
 * own week start and clock, the whole day drawn in the time grid (so nothing
 * can hide outside the visible hours), and the four views reachable from the
 * toolbar.
 */
export interface ScheduleConfig extends CalendarSourcesConfig {
	/** The view the card opens in. Default "month". */
	view?: ScheduleView;
	/** Which views the toolbar's switcher offers. Omitted means all of them; a
	 * single view hides the switcher. */
	views?: ScheduleView[];
	/** Hide the toolbar (period label, navigation and view switcher). The card
	 * then always shows `view` around today. */
	hideToolbar?: boolean;
	/** First day of the week, 0 = Sunday. Omitted follows the locale. */
	firstDay?: number;
	/** Leave Saturday and Sunday out of the month and week grids. */
	hideWeekends?: boolean;
	/** Show a week-number column down the left edge (month and week). */
	weekNumbers?: boolean;
	/** First hour drawn in the week/day time grid. Default 0. */
	dayStart?: number;
	/** Hour the week/day time grid ends at, exclusive. Default 24. */
	dayEnd?: number;
	/** Height of one hour in the time grid, in pixels. Default 44. */
	hourHeight?: number;
	/** Clock used for event times. Omitted follows the locale. */
	clock?: "12" | "24";
	/** Month view: how many events a day cell lists before "+N more".
	 * Default 3; 0 draws every event the cell has room for. */
	maxPerDay?: number;
	/** Month view: draw events as named chips (default) or as bare dots, the
	 * way the mini calendar does. */
	monthStyle?: "chips" | "dots";
	/** List view: how many days ahead to list, including today. Default 14. */
	listDays?: number;
	/** Draw the current-time line across the week/day grid. Default true. */
	nowLine?: boolean;
	/** Mark days that have a daily note, and open (or create) it on click.
	 * Default true; off makes the card purely an event calendar. */
	dailyNotes?: boolean;
}


/**
 * The chips an agenda entry can carry beside its title, each switchable so a
 * narrow card can show only what earns its space.
 *
 * Every field is `false`-to-hide: undefined means "default", which is on for
 * everything the card has always shown, and off for `status` (a chip that only
 * exists because it can be asked for).
 */
export interface CalendarChipConfig {
	/** The entry's start time (or "All day") in the left column. */
	time?: boolean;
	/** The source calendar's name — only ever shown with more than one source. */
	source?: boolean;
	/** A TaskNotes task's status, e.g. "In progress". Off by default. */
	status?: boolean;
	/** A TaskNotes task's priority, e.g. "High". */
	priority?: boolean;
	/** The "Due" marker on a due-date entry. */
	due?: boolean;
	/** The "Timeblock" marker on a timeblock. */
	timeblock?: boolean;
	/** The "Recurring" marker on a repeating task. */
	recurring?: boolean;
}


/**
 * Per-card configuration for the TaskNotes calendar source.
 *
 * Every layer toggle is tri-state on purpose: left undefined it follows
 * TaskNotes' own calendar settings, so a card that was simply switched on
 * mirrors whatever the user already configured inside TaskNotes. Setting one
 * here overrides that for this card only.
 */
export interface TaskNotesSourceConfig {
	/** Master switch. Off (the default) means the card reads no TaskNotes data
	 * at all — not even the plugin's settings. */
	enabled?: boolean;
	/** Draw tasks on their `scheduled` date, sized by their time estimate. */
	scheduled?: boolean;
	/** Draw tasks on their `due` date. */
	due?: boolean;
	/** Unroll recurring tasks into one entry per occurrence. Off draws only the
	 * task's anchor date. */
	recurring?: boolean;
	/** Draw timeblocks written into daily-note frontmatter. */
	timeblocks?: boolean;
	/** Include tasks whose status counts as complete (shown struck through).
	 * Default true — TaskNotes shows them too. */
	completed?: boolean;
	/** Include tasks carrying TaskNotes' archive tag. Default false. */
	archived?: boolean;
	/** Also overlay the ICS calendars subscribed inside TaskNotes, so both
	 * plugins show the same feeds without re-entering the URLs. Default true. */
	subscriptions?: boolean;
	/** Where an entry's colour comes from: its TaskNotes status colour
	 * (default), its priority colour, or the fixed colour below. */
	colorBy?: "status" | "priority" | "fixed";
	/** Colour used when `colorBy` is "fixed", and whenever the chosen source
	 * defines none. */
	color?: string;
	/** Separate colour for due-date entries, so a deadline reads differently
	 * from a scheduled block. */
	dueColor?: string;
	/** Colour for timeblocks that don't carry their own. */
	timeblockColor?: string;
	/** Offer completing a task straight from the event popup. Default true. */
	allowComplete?: boolean;
}

/** Every chip an agenda entry can carry, resolved to a plain on/off. */
export type ResolvedChips = Required<CalendarChipConfig>;


/** Which chips a calendar card's agenda entries show. Everything the agenda has
 * always shown defaults to on; `status` is a chip that only exists because it
 * can be asked for, so it defaults to off and an existing card is unchanged. */
export function calendarChips(cfg: CalendarChipConfig | undefined): ResolvedChips {
	const c = cfg ?? {};
	return {
		time: c.time !== false,
		source: c.source !== false,
		status: c.status === true,
		priority: c.priority !== false,
		due: c.due !== false,
		timeblock: c.timeblock !== false,
		recurring: c.recurring !== false,
	};
}


/** Per-card configuration for a "search" (query) card. */
export interface SavedSearchConfig {
	/** The query, using the same syntax as the top search bar (plain text,
	 * a leading "#" for tags, or "key:value" for frontmatter). */
	query?: string;
	/** Max results shown. Default 12. */
	count?: number;
	/** Display layout: "list" (default) renders a vertical list; "tiles"
	 * renders results as a grid of icon tiles (like the links card). */
	view?: "list" | "tiles";
}

/** Per-card configuration for a "searchbar" (live search field) card. */
export interface SearchBarConfig {
	/** Show the auto-detected file-type filter chips under the field, exactly as
	 * the header search bar does. Default false — the chips are the opt-in
	 * extra here, and they need a taller card to sit in. */
	filters?: boolean;
	/** File-type group ids (see FILE_TYPE_GROUPS) this card leaves out of its
	 * chip row, on top of the ones hidden vault-wide in Settings → Filters. */
	hiddenFilters?: string[];
	/** Placeholder shown in the empty field. Blank or omitted falls back to the
	 * global one (Settings → Appearance → Search placeholder). */
	placeholder?: string;
	/** The action button beside the field, or "none" (the default). Same two
	 * modes as the header's button. */
	button?: "none" | "newNote" | "searchOnline";
	/** Drop the card's frame — no border, background, shadow or title row — so
	 * the field reads as a standalone search bar placed on the board rather than
	 * as a card. Default false. */
	seamless?: boolean;
}

/** Per-card configuration for a "heatmap" (activity) card. */
export interface HeatmapConfig {
	/** Which timestamp to count. Default "modified". */
	metric?: "modified" | "created";
	/** How many weeks back to show. Default 26. */
	weeks?: number;
}

/** The built-in vault statistics a "stats" card can show. */
export type StatId =
	| "notes"
	| "attachments"
	| "folders"
	| "tags"
	| "dayStreak"
	| "daysUsing";

/** The built-in stats in their default display order — the fixed layout a
 * "stats" card has always shown, kept in one place so a card with no advanced
 * config renders exactly as before. Newer optional stats (see ALL_STATS) are
 * deliberately excluded so the default card is unchanged. */
export const DEFAULT_STATS: StatId[] = [
	"notes",
	"attachments",
	"folders",
	"tags",
	"dayStreak",
];

/** Every selectable built-in stat, in editor/display order. Extends
 * DEFAULT_STATS with opt-in stats a user can turn on in advanced mode. Must
 * begin with DEFAULT_STATS in the same order so "all defaults selected" round
 * trips back to the unconfigured (undefined) state. */
export const ALL_STATS: StatId[] = [...DEFAULT_STATS, "daysUsing"];

/** Lucide icon id (Obsidian setIcon) for each built-in stat. Shared by the card
 * renderer and its editor so the tile icon and the editor chip never drift. */
export const STAT_ICONS: Record<StatId, string> = {
	notes: "file-text",
	attachments: "paperclip",
	folders: "folder",
	tags: "tag",
	dayStreak: "flame",
	daysUsing: "calendar-clock",
};

/** A user-defined stat tile that counts the files matching a query. */
export interface StatsQuery {
	/** Stable id, used by the editor to reorder/remove without index churn. */
	id: string;
	/** Label under the count. Falls back to the query text when empty. */
	label?: string;
	/** Lucide icon id (Obsidian setIcon). Defaults to "hash". */
	icon?: string;
	/** The query, same syntax as the search bar: `#tag`, `key:value`, or plain
	 * text for names/paths. */
	query: string;
}

/** Per-card configuration for a "stats" (vault statistics) card. The card shows
 * its default fixed set of tiles until `advanced` is turned on, which unlocks
 * choosing which built-in stats appear, breaking attachments out into per
 * file-type tiles (images, PDFs, …), and adding custom query counts. */
export interface StatsConfig {
	/** Opt into the advanced controls. Off (default) => the fixed default set,
	 * ignoring every other field here. */
	advanced?: boolean;
	/** Which built-in stats to show, in order. Undefined => DEFAULT_STATS. Only
	 * consulted when `advanced` is on. */
	builtins?: StatId[];
	/** File-type group ids (see FILE_TYPE_GROUPS) to show as their own count
	 * tiles — the attachment breakdown. Only consulted when `advanced` is on. */
	attachmentTypes?: string[];
	/** User-defined query-count tiles. Only consulted when `advanced` is on. */
	queries?: StatsQuery[];
}

/** On-screen keypad tier for a calculator card. "none" hides the pad (just the
 * text field); "basic" is digits + arithmetic; "scientific" adds functions,
 * constants and powers. */
export type CalculatorKeypad = "none" | "basic" | "scientific";

/** Per-card configuration for a "calculator" card. */
export interface CalculatorConfig {
	/** Angle unit assumed by trig functions. Default "deg". */
	angleUnit?: "deg" | "rad";
	/** On-screen keypad tier. Default "none". */
	keypad?: CalculatorKeypad;
	/** The last query typed, restored when the board reloads. */
	lastInput?: string;
}

/** Per-card configuration for a "dataview" card. Renders a Dataview query
 * through Dataview's own renderers, so results (tables, lists, task lists) look
 * exactly as they do inside a note. The card is only offered by the "Add card"
 * picker when the Dataview community plugin is installed and enabled. */
export interface DataviewConfig {
	/** The query text. For "dql" (default) this is a Dataview Query Language
	 * block (TABLE / LIST / TASK / CALENDAR); for "js" it is DataviewJS code
	 * with the `dv` API in scope. */
	query?: string;
	/** How `query` is interpreted. "dql" (default) runs it as a Dataview query;
	 * "js" runs it as DataviewJS (arbitrary JavaScript). */
	language?: "dql" | "js";
	/** Manual per-column pixel widths for a rendered TABLE, in column order.
	 * When set (non-empty), the table renders with a fixed layout at these
	 * widths — drag a column's right edge to resize. Absent/empty keeps the
	 * auto-fit layout (columns sized to content). Ignored and reset when the
	 * table's column count no longer matches the array length (e.g. the query
	 * changed), so a stale layout never mangles a different result. */
	columnWidths?: number[];
}

/** Per-card configuration for a "datacore" card. Datacore is Dataview's
 * successor, and this card is the Dataview card's: it renders a Datacore query
 * or script through Datacore's own Preact renderer, live-updating as the index
 * changes. Only offered by the "Add card" picker when the Datacore community
 * plugin is installed and enabled. */
export interface DatacoreConfig {
	/** The query text. For "query" (default) this is a Datacore query, e.g.
	 * `@page and #project`; for the script languages it is the script source,
	 * exactly as inside the matching `datacore…` codeblock. */
	query?: string;
	/** How `query` is interpreted. "query" (default) renders the query as a live
	 * link list; "js" / "jsx" / "ts" / "tsx" run it as a Datacore script, which
	 * is arbitrary code. */
	language?: DatacoreLanguage;
	/** "query" mode only: rows per page in the generated list. Absent or 0
	 * renders every result unpaged. Ignored by the script languages, which draw
	 * their own views. */
	pageSize?: number;
}

/**
 * Per-card configuration for a "git" card, which shows the state of the vault's
 * repository and runs git operations through the obsidian-git community plugin.
 *
 * Hearth performs no git work of its own — every button is a call into that
 * plugin, so its remote, credentials and commit-message template all apply. See
 * `src/git.ts`. Only offered by the "Add card" picker when obsidian-git is
 * installed and enabled.
 */
export interface GitConfig {
	/** Which sections the card stacks, top to bottom. Absent means the defaults
	 * (status, actions, changes); an explicitly empty list means none. */
	sections?: GitSection[];
	/** Which action buttons the "actions" section offers, in order. Absent means
	 * the defaults (commit-and-sync, commit, push, pull). */
	actions?: GitAction[];
	/** Whether buttons show their label next to the icon. Default: icon only. */
	actionStyle?: GitActionStyle;
	/** Max rows in the changed-files list; 0 shows every changed file. Default 8. */
	changeLimit?: number;
	/** Max commits in the log section. Default 5. */
	logLimit?: number;
	/** Show each changed file's folder under its name. Default: name only. */
	showPaths?: boolean;
	/** Which files a commit from this card includes. Default: "smart". */
	commitScope?: GitCommitScope;
	/** The message the card's commit buttons use. Empty hands the decision to
	 * obsidian-git's own commit-message template. */
	commitMessage?: string;
	/** Have obsidian-git prompt for a message on every commit, as its
	 * "…with specific message" commands do. Wins over `commitMessage`. */
	askForMessage?: boolean;
	/** Re-read the repo every N minutes on top of following obsidian-git's own
	 * events. 0 (the default) means events only — the plugin already refreshes
	 * after every change, so polling mostly costs `git status` calls. */
	refreshMin?: number;
	/** Skip the confirmation dialog before a destructive action (discard all).
	 * Off by default: the confirmation is there for a reason. */
	skipConfirm?: boolean;
}

/** Per-card configuration for a "leaf" card, which hosts another plugin's (or a
 * core) registered side-panel view inside the dashboard. Beta. */
export interface LeafViewConfig {
	/** The registered view type to host, e.g. "calendar", "outline",
	 * "tag-pane". This is the id a plugin passes to `registerView`. Empty means
	 * the card hasn't been pointed at a view yet and shows an empty state. */
	viewType?: string;
	/** Optional vault path of a specific file to open in the hosted view, e.g. an
	 * Excalidraw drawing or a Canvas. File-backed views (Excalidraw, canvas, …)
	 * otherwise mount detached from any file and show their "new/empty" screen;
	 * pointing them at a file renders that document instead. Empty means the view
	 * is hosted without a file, as before. */
	file?: string;
	/** Hide the hosted view's own header (breadcrumbs, back/forward arrows and the
	 * kebab menu). For a single-file card that chrome is just noise; default
	 * (false/undefined) keeps it. */
	hideHeader?: boolean;
}

/** A single feed a "rss" card can subscribe to. Each source becomes a tab in
 * the card header; `name` labels the tab (falling back to the feed's own title
 * when blank) and `url` is the RSS/Atom feed address. */
export interface RssSource {
	id: string;
	/** Tab label; when empty the feed's own <title> is shown instead. */
	name: string;
	/** RSS 2.0 or Atom feed URL (http/https). */
	url: string;
}

/** How a "rss" card lays out its items. "list" is a title + meta line per item;
 * "cards" adds an excerpt and (when present) a thumbnail; "compact" is just the
 * headlines. */
export type RssLayout = "list" | "cards" | "compact";

/** Per-card configuration for a "rss" card — a lightweight feed reader. All
 * fields are optional; omitted fields use the defaults noted below. */
export interface RssConfig {
	/** The subscribed feeds, one tab each. */
	sources?: RssSource[];
	/** Item layout. Default "list". */
	layout?: RssLayout;
	/** Auto-refresh interval in minutes. 0 (or omitted → default 30) with 0
	 * meaning "refresh only when opened / manually". */
	refreshMin?: number;
	/** Max items shown per feed. Default 15. */
	itemLimit?: number;
	/** Show item thumbnails when the feed provides them (cards layout). Default true. */
	showImages?: boolean;
	/** Show a short text excerpt under each item. Default true. */
	showExcerpt?: boolean;
	/** Show each item's publish date. Default true. */
	showDate?: boolean;
	/** Add a leading "All" tab that merges every source, newest first. Default false. */
	mergeAll?: boolean;
}

/** A place a "weather" card shows the forecast for.
 *
 * Resolved once — either picked from the key-less Open-Meteo geocoder in the
 * card editor, or typed in as raw coordinates — and then stored on the card, so
 * drawing the card never needs a name lookup and an offline vault still knows
 * where it is pointing. */
export interface WeatherPlace {
	/** Display name, e.g. "Prague". */
	name: string;
	/** Admin area and/or country shown under the name, e.g. "Praha, Czechia". */
	region?: string;
	/** Decimal degrees, north positive. */
	lat: number;
	/** Decimal degrees, east positive. */
	lon: number;
	/** IANA zone the geocoder reported. Only used as a label — forecast times
	 * always come back in the location's own zone (`timezone=auto`). */
	timezone?: string;
}

/**
 * How a "weather" card draws itself, from the plainest to the most decorated:
 *
 * - `minimal`  — one glyph and one temperature, nothing else.
 * - `compact`  — a single row: glyph, temperature, condition, place.
 * - `detailed` — the current conditions plus a grid of the metrics you enabled.
 * - `forecast` — an hourly temperature curve with a daily strip under it.
 * - `artistic` — an edge-to-edge painted sky that follows the real conditions
 *   and the time of day, with drifting clouds, rain, snow and stars.
 */
export type WeatherStyle =
	| "minimal"
	| "compact"
	| "detailed"
	| "forecast"
	| "artistic";

/** Temperature unit for a weather card. Default "c". */
export type TemperatureUnit = "c" | "f";

/** Wind speed unit for a weather card. Default "kmh". */
export type WindUnit = "kmh" | "ms" | "mph" | "kn";

/** Precipitation unit for a weather card. Default "mm". */
export type PrecipitationUnit = "mm" | "inch";

/**
 * Per-card configuration for a "weather" card.
 *
 * All fields are optional and every default is the value that renders the card
 * the way it looks straight out of the "Add card" menu. The `show*` flags are
 * deliberately fine-grained: which of them a given style honours is documented
 * on each one, so the same forecast can be a bare number on one board and a
 * full weather station on another.
 */
export interface WeatherConfig {
	/** Where the forecast is for. Without it the card asks to be configured. */
	place?: WeatherPlace;
	/** Visual style. Default "compact". */
	style?: WeatherStyle;

	// ---- Units ----
	/** Temperature unit. Default "c". */
	tempUnit?: TemperatureUnit;
	/** Wind speed unit. Default "kmh". */
	windUnit?: WindUnit;
	/** Precipitation unit. Default "mm". */
	precipUnit?: PrecipitationUnit;
	/** Clock format for hourly and sunrise/sunset times: "auto" follows the
	 * locale, "12"/"24" force it. Default "auto". */
	hourFormat?: "auto" | "12" | "24";

	// ---- What to display ----
	/** Show the place name. Default true. */
	showLocation?: boolean;
	/** Show the condition text ("Partly cloudy"). Default true. */
	showCondition?: boolean;
	/** Show the "feels like" temperature. Default true (ignored by "minimal"). */
	showFeelsLike?: boolean;
	/** Show today's high / low. Default true (ignored by "minimal"). */
	showHighLow?: boolean;
	/** Metric tiles, all shown in "detailed" and as a meta line elsewhere. */
	showHumidity?: boolean;
	showWind?: boolean;
	showPrecip?: boolean;
	showUv?: boolean;
	showPressure?: boolean;
	/** Show sunrise and sunset. Default false. */
	showSun?: boolean;
	/** Show when the data was last fetched. Default false. */
	showUpdated?: boolean;
	/** How many hours the hourly strip covers. 0 hides it. Default 6 (12 in the
	 * "forecast" style, which is built around it). */
	hourlyCount?: number;
	/** How many days the daily strip covers. 0 hides it. Default 4. */
	dailyCount?: number;

	// ---- Artistic style ----
	/** Animate the painted sky (drifting clouds, falling rain, twinkling stars).
	 * Default true; forced off from the `reduced` tier down. */
	animate?: boolean;

	// ---- Refresh ----
	/** Auto-refresh interval in minutes. 0 means "only when opened or refreshed
	 * by hand". Default 30. */
	refreshMin?: number;
}

/** Per-card configuration for a "clock" card. All fields are optional; omitted
 * fields fall back to the defaults that match the original clock behaviour. */
export interface ClockConfig {
	/** Digital (default) or analogue clock face. */
	mode?: "digital" | "analog";
	/** Time format: "auto" follows the locale default, "12"/"24" force a
	 * 12- or 24-hour clock regardless of locale. Default "auto". */
	hourFormat?: "auto" | "12" | "24";
	/** @deprecated Superseded by `hourFormat`. Kept for migration only:
	 * `true` maps to `hourFormat: "24"`. */
	use24Hour?: boolean;
	/** Show seconds in the time. */
	showSeconds?: boolean;
	/** Show the greeting line (default true). */
	showGreeting?: boolean;
	/** Override the auto greeting. */
	greetingText?: string;
	/** Use the playful, slightly cheeky greetings instead of the plain ones. */
	playfulGreetings?: boolean;
	/** How much of the date to show. Default "full". */
	dateMode?: "full" | "long" | "short" | "iso" | "weekday" | "custom" | "none";
	/** moment.js format string used when dateMode is "custom". */
	dateFormat?: string;
}

/** The animals a "pet" card can keep. Each is one 16×16 pixel sprite recolored
 * from the card's two colors — no image assets are shipped. */
export type PetSpecies = "cat" | "dog" | "bird" | "fox" | "frog" | "blob";

/** Per-card configuration for a "pet" card.
 *
 * The pet has no hunger, no age and no way to lose it: its mood is derived,
 * on every render, from how much of the vault you have touched *today* against
 * `dailyGoal`. A quiet vault makes it bored and then sleepy; a busy one makes
 * it happy and then excited. Nothing here is a simulation that ticks in the
 * background — `lastPlayedAt` is the only mutable state, and everything else is
 * recomputed from vault timestamps, so a week with Obsidian closed, or a
 * `data.json` synced between devices, cannot put the pet in a wrong state. */
export interface PetConfig {
	/** Which animal to draw. Default "cat". */
	species?: PetSpecies;
	/** The pet's name, shown under the sprite. Empty means the species name. */
	name?: string;
	/** Main body color (hex). The outline, belly and shading are derived from
	 * it, so two colors define the whole palette. Omitted means the species'
	 * own default. */
	bodyColor?: string;
	/** Accent color (hex) — ears, nose, paws, beak. */
	accentColor?: string;
	/** Which vault activity feeds the pet: notes edited (default) or created. */
	metric?: "modified" | "created";
	/** Notes a day that make the pet happy — the card's "good day". Default 3. */
	dailyGoal?: number;
	/** Notes a day that make the pet excited. Default: twice `dailyGoal`. */
	excitedAt?: number;
	/** Notes a day that make the pet content. Default 1 — any activity at all. */
	contentAt?: number;
	/** Minutes with nothing touched anywhere in the vault before the pet falls
	 * asleep — whatever its mood, however good the day was. Any activity wakes
	 * it again at the rung the day earned. Default 360 (six hours). */
	sleepyAfterMin?: number;
	/** How many minutes a petting keeps the pet happy. Default 30. */
	pettedForMin?: number;

	/** Whose pointer the pet's eyes follow: nobody, only while the pointer is
	 * over its own card (default), or anywhere on the dashboard. A sleeping pet
	 * never looks — its eyes are shut. */
	eyesFollow?: "off" | "card" | "board";

	/** What the clock does to the pet at night:
	 * - "off" — nothing, the vault is the only thing that matters;
	 * - "quiet" (default) — a bored or content pet sleeps instead, so a thin
	 *   small hour reads as night rather than as neglect (a good day still
	 *   shows as one);
	 * - "always" — the pet sleeps through the window whatever the vault says.
	 * Petting still wakes it in every mode. */
	nightSleep?: "off" | "quiet" | "always";
	/** Hour (0–23, local) the night window opens. Default 23. */
	nightFrom?: number;
	/** Hour (0–23, local) the night window closes. Default 7. */
	nightTo?: number;
	/** Sprite size. Default "md". */
	size?: "sm" | "md" | "lg";
	/** Show the name line (default true). */
	showName?: boolean;
	/** Show the mood line (default true). */
	showMood?: boolean;
	/** Show the "N notes today · M-day streak" line (default true). */
	showActivity?: boolean;
	/** Epoch ms of the last time the pet was petted (clicked). For half an hour
	 * afterwards the pet is at least happy, whatever the vault is doing. This is
	 * the card's only mutable state. */
	lastPlayedAt?: number;
}

/** A single button in the mobile action bar (shown under the search bar and
 * filters in Mobile mode). Like a launchpad tile, a button can run an Obsidian
 * command, open a vault note/file, or open a URL — chosen by `type`. Hearth's
 * own defaults (new note, new drawing, record voice, open daily note) are
 * registered as ordinary commands too, so any button can be replaced with any
 * command from any plugin. */
export interface MobileActionButton {
	id: string;
	label: string;
	icon: string;
	/** What the button does. Defaults to "command" when absent (older buttons
	 * stored only `commandId`). */
	type?: "command" | "note" | "url";
	/** Command id, vault path, or URL depending on `type`. */
	target?: string;
	/** @deprecated Legacy command id from before `type`/`target` existed.
	 * `migrateSettings` folds it into `target` on load (one-way); the fallback
	 * read in `actionTarget` is a transitional safety net.
	 * Remove in 1.11.0 or later — two minor releases after 1.9.0, once the
	 * migration has run for everyone — together with that fallback. */
	commandId?: string;
}

/**
 * How an embedded picture fills its card.
 *
 * "natural" is the original behaviour and stays the default: Obsidian's own
 * transclusion, the picture at its natural size in a scrolling box. The rest
 * hand the picture the whole card body and differ in what gives — the crop
 * ("cover"), the empty space ("contain"), the aspect ratio ("stretch") or the
 * height ("width", which fills the width and scrolls).
 */
export type EmbedImageFit = "natural" | "contain" | "cover" | "stretch" | "width";

/** Where a formatted picture sits in its card — and, when it is cropped, which
 * part of it survives the crop. The nine points of a 3×3 grid. */
export type EmbedImagePosition =
	| "top-left"
	| "top"
	| "top-right"
	| "left"
	| "center"
	| "right"
	| "bottom-left"
	| "bottom"
	| "bottom-right";

/** A secondary embed a card can switch to. Only `target` is required; `scale`
 * and `editable` mirror the primary embed's fields and default to that view's
 * behaviour when omitted. A card with a valid second view shows a switcher —
 * inline in the header when the card has a title, or as a floating
 * mouseover-only control when it's untitled (headerless). */
export interface EmbedView {
	/** Vault path of the file to embed (.md, image, .base, ...). */
	target?: string;
	/** Bases view name to embed when target is a .base file; omitted means default view. */
	baseView?: string;
	/** Zoom factor for the embedded content (1 = 100%); omitted means no scaling. */
	scale?: number;
	/** How an embedded picture fills the card; omitted means "natural" (the
	 * picture at its own size). Ignored by every other file type. */
	imageFit?: EmbedImageFit;
	/** Where a formatted picture sits, and which part of it a crop keeps;
	 * omitted means "center". Only read when `imageFit` frames the picture. */
	imagePosition?: EmbedImagePosition;
	/** Edit the embedded note's text in place instead of read-only (Markdown only). */
	editable?: boolean;
	/** Edit through Obsidian's own Live Preview editor rather than Hearth's plain
	 * raw-Markdown box. Only meaningful together with `editable`. */
	livePreview?: boolean;
}

/** One hand-picked picture in a "slideshow" card. Kept as its own object (rather
 * than a bare path) so a picture can carry a caption and keep a stable identity
 * while the list is reordered. */
export interface SlideshowSlide {
	id: string;
	/** Vault path of the image file. */
	path: string;
	/** Caption shown over the picture; falls back to the file's basename. */
	caption?: string;
}

/** Where a "slideshow" card takes its pictures from: the hand-picked `slides`
 * list, or every image inside a folder. */
export type SlideshowSource = "list" | "folder";

/**
 * The order a slideshow shows its pictures in.
 *
 * "manual" is the `slides` list's own order — the only order a folder source
 * cannot honour, so it resolves to "name" there (see `slideshowOrder`).
 * "random" reshuffles after every full pass, so nothing repeats until every
 * picture has been shown.
 */
export type SlideshowOrder =
	| "manual"
	| "name"
	| "nameDesc"
	| "created"
	| "createdDesc"
	| "modified"
	| "modifiedDesc"
	| "random";

/**
 * What moves a slideshow on to the next picture.
 *
 * - "timer" — a clock, every `intervalSec` seconds. The original behaviour.
 * - "daily" — the calendar: one picture per `dayCount` days, worked out from
 *   today's date rather than from a timer, so a redraw, a board switch or an
 *   Obsidian restart all land on the same picture (#249).
 * - "manual" — nothing but the controls; the card stays where you left it.
 */
export type SlideshowAdvance = "timer" | "daily" | "manual";

/** How one picture gives way to the next. "none" is a cut. */
export type SlideshowTransition = "none" | "fade" | "slide" | "zoom";

/** How a picture fills the card: cropped to fill it edge to edge ("cover"), or
 * scaled down whole with letterboxing ("contain"). */
export type SlideshowFit = "cover" | "contain";

/** Per-card configuration for a "slideshow" card — a picture embed that
 * rotates. All fields are optional; the defaults noted below are the ones a
 * freshly added card runs with. */
/** What a Periodic note card shows: always the *current* note of one period,
 * resolved through the Periodic Notes plugin (issue #116). Which folder, name
 * and template that note has is Periodic Notes' business, not Hearth's. */
export interface PeriodicCardConfig {
	/** The period the card tracks. Omitted means weekly — the daily note has a
	 * card of its own. */
	granularity?: Granularity;
}

export interface SlideshowConfig {
	/** Where the pictures come from. Default "list". */
	source?: SlideshowSource;
	/** The hand-picked pictures, in list order (source "list"). */
	slides?: SlideshowSlide[];
	/** Vault folder every image is taken from (source "folder"). */
	folder?: string;
	/** Also take images from subfolders of `folder`. Default false. */
	includeSubfolders?: boolean;
	/** Display order. Default "manual" (a folder source: "name"). */
	order?: SlideshowOrder;
	/** What moves the card on to the next picture. Default "timer" — except on
	 * a card saved before this field existed with `intervalSec: 0`, which was
	 * the only way to say "don't rotate" and so reads as "manual". */
	advance?: SlideshowAdvance;
	/** Seconds each picture is shown (advance "timer"). Default 8; 0 holds the
	 * first picture. */
	intervalSec?: number;
	/** Days each picture is shown (advance "daily"). Default 1, at most 365. */
	dayCount?: number;
	/** How one picture gives way to the next. Default "fade". */
	transition?: SlideshowTransition;
	/** Transition length in milliseconds. Default 700. */
	transitionMs?: number;
	/** Slowly zoom the picture while it is shown (the "Ken Burns" effect).
	 * Default false. */
	kenBurns?: boolean;
	/** How the picture fills the card. Default "cover". */
	fit?: SlideshowFit;
	/** Show the previous/pause/next controls on hover. Default true. */
	controls?: boolean;
	/** Show the picture's caption (or file name) over it. Default false. */
	showCaption?: boolean;
	/** Hold the current picture while the pointer is over the card. Default false. */
	pauseOnHover?: boolean;
}

/** A single tile inside a "links" (launchpad) card. */
export interface LinkItem extends TileGeometry {
	id: string;
	label: string;
	/** Lucide icon id. */
	icon: string;
	/** Vault path, URL, or command id depending on type. */
	target: string;
	type: "note" | "url" | "command";
}

export interface DashboardCard {
	id: string;
	kind: CardKind;
	/** Optional custom title shown in the card header. */
	title?: string;

	// ---- Content (per kind) ----
	/** kind === "embed": vault path of the file to embed (.md, image, .base, ...). */
	target?: string;
	/** kind === "embed": Bases view name to embed when target is a .base file;
	 * omitted means the default view. */
	baseView?: string;
	/** kind === "slideshow": the pictures, where they come from, and how they
	 * rotate. */
	slideshow?: SlideshowConfig;
	/** kind === "periodic": which period's note the card follows. */
	periodic?: PeriodicCardConfig;
	/** kind === "web": the web page URL to embed in an iframe. */
	url?: string;
	/** kind === "web": allow the framed page same-origin access. Off by default
	 * (the safer sandbox); enable only for sites you trust that need cookies or
	 * local storage to render. */
	sandboxTrusted?: boolean;
	/** kind === "text": the jotted-down content. */
	text?: string;
	/** kind === "links": the launchpad tiles. */
	links?: LinkItem[];
	/** kind === "commands": command-palette tiles. */
	commands?: CommandItem[];
	/** kind === "templater": the new-note-from-template tiles. */
	templater?: TemplaterConfig;
	/** kind === "recent": how many recent files to show. Clamped to what Hearth's
	 * own recent-file history can hold (see RECENT_HISTORY_MAX); ignored when
	 * `recentAuto` is on. */
	count?: number;
	/** kind === "recent": show as many files as fit the card's height instead of
	 * a fixed count. Undefined/false is the fixed-count behaviour. */
	recentAuto?: boolean;
	/** kind === "recent": file-type group ids (see FILE_TYPE_GROUPS) to include.
	 * Any combination of the search filter's types; undefined or empty means all
	 * types are shown. */
	recentTypes?: string[];
	/** kind === "clock": time/greeting/date display options. */
	clock?: ClockConfig;
	/** kind === "tasks": source, folder scope and display options. */
	tasks?: TasksConfig;
	/** kind === "calendar": week-number and heatmap display options. */
	calendar?: CalendarConfig;
	/** kind === "schedule": view, grid and event-source options for the full
	 * Calendar card. */
	schedule?: ScheduleConfig;
	/** kind === "search": the saved query and result count. */
	savedSearch?: SavedSearchConfig;
	/** kind === "searchbar": filter row and seamless (frameless) display. */
	searchBar?: SearchBarConfig;
	/** kind === "heatmap": metric and range. */
	heatmap?: HeatmapConfig;
	/** kind === "stats": which stats to show, attachment breakdown and custom
	 * query counts (all gated behind the config's `advanced` flag). */
	stats?: StatsConfig;
	/** kind === "calculator": angle unit, last input and history. */
	calculator?: CalculatorConfig;
	/** kind === "dataview": the query text and language. */
	dataview?: DataviewConfig;
	/** kind === "datacore": the query/script text, language and paging. */
	datacore?: DatacoreConfig;
	/** kind === "rss": feed sources, layout and refresh options. */
	rss?: RssConfig;
	/** kind === "jira": connection, saved filter, and refinement options. */
	jira?: JiraConfig;
	/** kind === "weather": place, style, units and what to display. */
	weather?: WeatherConfig;
	/** kind === "git": sections, action buttons and commit behaviour. */
	git?: GitConfig;
	/** kind === "operon": view, Operon filters and display options. */
	operon?: OperonConfig;
	/** kind === "leaf": the registered view type to host. */
	leafView?: LeafViewConfig;
	/** kind === "pet": species, colors, name and what feeds its mood. */
	pet?: PetConfig;

	// ---- Live content ----
	/** Auto-refresh interval in seconds for live content (embed / web). 0 or
	 * omitted means the card is rendered once and never refreshed. */
	refreshSec?: number;

	/** kind === "embed": zoom factor for the embedded content (1 = 100%).
	 * Omitted means no scaling. */
	scale?: number;

	/** kind === "embed": edit the embedded note's text in place instead of
	 * rendering it read-only. Only applies to Markdown notes. */
	editable?: boolean;

	/** kind === "embed" / "daily" / "periodic": when editing in place, use Obsidian's own
	 * Live Preview editor (hosted in the card) instead of Hearth's plain
	 * raw-Markdown box. Only meaningful together with `editable`. */
	livePreview?: boolean;

	/** kind === "embed": how an embedded picture fills the card. Omitted means
	 * "natural" — the picture at its own size, as Obsidian renders it. Ignored
	 * for every other file type. */
	imageFit?: EmbedImageFit;

	/** kind === "embed": where a formatted picture sits in the card, and which
	 * part of it survives a crop. Omitted means "center". Only read when
	 * `imageFit` frames the picture. */
	imagePosition?: EmbedImagePosition;

	/** kind === "embed": an optional second view the card can switch to. When it
	 * carries a target, a switcher toggles the body between the primary embed
	 * (`target`/`scale`/`editable`) and this one — shown in the card header when
	 * the card has a title, or as a floating mouseover-only control otherwise. */
	secondView?: EmbedView;

	/** kind === "embed": hide the Bases view's own toolbar/header (the view
	 * switcher and filter/property controls) when embedding a `.base` file, so
	 * only the results show. No effect on non-base embeds. */
	hideBaseHeader?: boolean;

	/** kind === "links" / "commands" / "templater": how the card's buttons are
	 * sized.
	 *
	 * - `"fixed"` (the default when absent) — the original behaviour: a button
	 *   is a fixed number of pixels, so a wider card fits more buttons rather
	 *   than bigger ones.
	 * - `"scale"` — the buttons fill the card: it is divided into `tileCols`
	 *   columns and as many rows as the buttons need, the rows sharing the
	 *   card's height between them, and a button spans cells of that grid —
	 *   whole ones or halves.
	 *   So every button grows and shrinks with the card the same way a card
	 *   grows with the dashboard, and every one of them stays visible whatever
	 *   size the card is — until a cell would fall below `tileMinSize` on either
	 *   axis, where the card scrolls rather than drawing buttons too small to
	 *   use. Buttons stay on the grid: they are sized in cells (down to a half),
	 *   not freely in pixels.
	 *
	 * Cards created before this existed carry no value and so keep the fixed
	 * style; every card added since asks for `"scale"` in its template, and the
	 * card's own settings switch either way at any time. */
	tileSizing?: "fixed" | "scale";

	/** kind === "links" / "commands" / "templater": with `tileSizing: "scale"`,
	 * how many cells wide the card's button grid is — so a one-cell button is
	 * this fraction of the card. Omitted means TILE_COLS_DEFAULT. Ignored by the
	 * fixed style. */
	tileCols?: number;

	/** kind === "links" / "commands" / "templater": with `tileSizing: "scale"`,
	 * how small a cell may get (px) before the card scrolls instead of shrinking
	 * its buttons any further. Omitted means TILE_MIN_DEFAULT; clamped to
	 * [TILE_MIN_MIN, TILE_MIN_MAX] on read. Ignored by the fixed style. */
	tileMinSize?: number;

	/** kind === "commands" / "templater": pixel size of the tiles (min column
	 * width) in the fixed style. Omitted means the default tile size. Ignored by
	 * the scaled style, which sizes buttons from `tileCols`. */
	tileSize?: number;

	/** kind === "links" / "commands" / "templater" (beta): when true, tiles auto-shift out
	 * of the way (swap with a placeholder) as one is dragged, so the layout
	 * reorders live like phone widgets. Default off — tiles are pure
	 * free-form and may overlap. */
	tileAutoFlow?: boolean;

	/** Show a button that opens the card's file in the editor.
	 *
	 * The two cards that offer it default differently, because one of them
	 * predates the other: on `kind === "daily"` and `kind === "periodic"` the
	 * button is shown unless this is `false`, while on `kind === "embed"` (added
	 * for #144) it is hidden unless this is `true`, so no existing embed card
	 * sprouts a new control. */
	showOpenButton?: boolean;

	/** Show this card on every dashboard, sharing one definition and position
	 * across boards ("synced"). Stored once in settings.pinnedCards. */
	pinned?: boolean;

	// ---- Appearance ----
	/** Optional accent color (CSS color) for the card header/border. */
	accent?: string;
	/** Optional background color/tint (CSS color) for the card body. */
	background?: string;
	/** Override the card surface opacity for this card (undefined = dashboard
	 * / global). 0 = fully transparent, 1 = fully opaque. */
	cardOpacity?: number;
	/** Override the card surface backdrop blur (frosted glass) for this card, in
	 * pixels (undefined = dashboard / global). 0 = no blur. */
	cardBlur?: number;
	/** Override the card border width for this card, in pixels (undefined =
	 * dashboard / global). 0 removes the visible border and the header rule. */
	cardBorderWidth?: number;

	// ---- Layout (legacy grid cell units) ----
	// Kept as the seed for the free-form coordinates below: older layouts (and
	// freshly added cards, which are packed on a reference grid) store their
	// placement here, and it is converted to fx/fy/fw/fh once on first render.
	x: number;
	y: number;
	w: number;
	h: number;

	// ---- Layout (free-form) ----
	// The live layout is continuous, not grid-locked. Horizontal position/size
	// are fractions of the board width (0..1) so the board stays responsive when
	// the pane is resized; vertical position/size are absolute pixels. Undefined
	// until derived from the grid units above.
	fx?: number;
	fy?: number;
	fw?: number;
	fh?: number;

	// ---- Layout (stacked / narrow) ----
	/** How this card behaves in the stacked layout a narrow board reflows to
	 * (see src/narrow.ts). Every field is optional and absent means "derive it
	 * from the free-form layout above", so no existing card changes behaviour
	 * and a board only carries what someone actually tuned. */
	mobile?: MobileCardOptions;
}

/**
 * A card's overrides for the stacked layout used on a narrow board.
 *
 * The stacked layout derives everything it needs from the free-form geometry —
 * cards run top-to-bottom in reading order at the height they already have —
 * so this exists purely for the cases where the derivation is wrong. Deliberately
 * four hints on the stacked layout rather than a second set of coordinates: a
 * card has one layout to maintain, and a board that has never been opened on a
 * phone still stacks sensibly.
 */
export interface MobileCardOptions {
	/** Leave the card out of the stacked layout entirely. For the cards that
	 * genuinely can't work at phone width (a wide Dataview table, a Jira board)
	 * — hiding beats squeezing. The card is untouched on a wide board. */
	hidden?: boolean;
	/** Sort key overriding the derived reading order. Cards carrying one are
	 * ordered by it and come first; the rest follow in reading order. Reading
	 * order is a desktop *layout* fact, and it is rarely the same as what you
	 * want first on a phone. */
	order?: number;
	/** Height in pixels in the stacked layout, instead of the height derived
	 * from `fh`. A card is full-width when stacked, which is usually much wider
	 * than it is on the board, so the desktop height can be far more than its
	 * content now needs. */
	height?: number;
	/** Render as a tappable title row that expands on demand, rather than at
	 * full height. What makes an expensive card worth keeping on a phone: it
	 * costs one row until someone asks for it. */
	collapsed?: boolean;
}

/** Background mode for the home view. "default" uses Hearth's bundled
 * background (a curated image shipped with a release); "weather" paints the
 * live sky for a place (see sky.ts); the other kinds use the user's own
 * value. */
export type BackgroundKind =
	| "none"
	| "default"
	| "color"
	| "image"
	| "url"
	| "weather";

/** The flat backdrop the `minimal` tier paints instead of the wallpaper: a muted
 * grey-purple that sits close to Hearth's brand colour without any image
 * decode, opacity layer or blur behind it. */
export const LOW_POWER_BACKGROUND = "#4a4459";

/**
 * How much of the home view's decoration to pay for, as a ladder rather than a
 * switch.
 *
 * Each step is a measured cost, not a taste: see
 * docs/performance/macos-power-investigation.md. The old boolean low power mode
 * was only ever the bottom rung — it fixed the power draw by removing the
 * wallpaper, the frosted glass, the animation *and* every refresh timer at
 * once, which is far more than most people need to give up.
 *
 * - `full` — everything on.
 * - `balanced` — the painted sky is drawn at half density (fewer drops, stars,
 *   clouds and fog wisps). Nothing is switched off; there is simply less of it.
 *   Worth about a third of the sky's main-thread cost, not half: the per-frame
 *   layout the sky forces has a fixed component that no amount of thinning
 *   removes. Measured at 168.9ms -> 120.0ms per 4s for a board-spread rain
 *   field. Only `reduced` and below remove the cost rather than trimming it.
 * - `reduced` — no animation anywhere, and no frosted glass. The wallpaper and
 *   every refresh timer stay, so the board still looks like itself and still
 *   updates; it just holds still.
 * - `minimal` — the former low power mode: a flat colour instead of the
 *   wallpaper, opaque cards, no animation, and no timer-driven refresh.
 */
export type PerformanceTier = "full" | "balanced" | "reduced" | "minimal";

/** Every tier, richest first — the order the settings dropdown offers them. */
export const PERFORMANCE_TIERS: readonly PerformanceTier[] = [
	"full",
	"balanced",
	"reduced",
	"minimal",
];

/**
 * Where the background is painted.
 *
 * "full" is the classic Hearth board: the backdrop fills the whole view and the
 * cards float on top of it. "banner" turns the same backdrop into a strip
 * across the top of the content — a cover image, the way a note's banner works
 * — and leaves the rest of the board on the theme's own surface, so the cards
 * read against a plain background instead of a picture.
 *
 * Both modes share one background configuration: the kind, value, opacity and
 * blur mean exactly the same thing in each, so switching between them is a
 * single dropdown and never loses what was set up.
 */
export type BackgroundLayout = "full" | "banner";

/** How tall a banner is by default, in pixels: big enough to read as a cover
 * image, short enough that the first row of cards is still on screen. */
export const BANNER_HEIGHT_DEFAULT = 220;
/** Banner height bounds. The floor keeps a banner from collapsing into a line;
 * the ceiling keeps it from pushing the whole board off the fold. */
export const BANNER_HEIGHT_MIN = 60;
export const BANNER_HEIGHT_MAX = 600;

/** Clamp a banner height to {@link BANNER_HEIGHT_MIN}..{@link BANNER_HEIGHT_MAX},
 * falling back to the default for a missing or non-numeric value. */
export function clampBannerHeight(h: number | undefined): number {
	if (typeof h !== "number" || Number.isNaN(h)) return BANNER_HEIGHT_DEFAULT;
	return Math.max(BANNER_HEIGHT_MIN, Math.min(BANNER_HEIGHT_MAX, Math.round(h)));
}

/** A self-contained background configuration (used for per-dashboard overrides
 * as well as the global default).
 *
 * This is *what the backdrop is* and nothing else. How a board wears it — full
 * view or banner, and the banner's shape — is deliberately not in here: those
 * are their own per-dashboard overrides ({@link BannerOverrides}) so a board can
 * turn the vault's background into a banner without having to restate the
 * picture. {@link effectiveBackground} joins the two. */
export interface BackgroundConfig {
	kind: BackgroundKind;
	/** A CSS colour, a vault image path, a URL, or — for "weather" — a packed
	 * place (see formatPlaceValue in weather.ts), depending on `kind`. */
	value: string;
	opacity: number;
	blur: number;
}

/**
 * How a board wears its background, as *overrides*: every field is optional and
 * falls back to the global setting, the same way `gridColumns`, `maxWidth` and
 * `cardOpacity` already do.
 *
 * Kept separate from {@link BackgroundConfig} on purpose. A board's background
 * override is all-or-nothing — take it and you restate the kind, the value, the
 * opacity and the blur — and making the banner part of it would have meant a
 * board could only have a banner by re-specifying the whole picture. These
 * override independently, so "the vault's background, but as a banner on this
 * board" is one dropdown.
 */
export interface BannerOverrides {
	/** Full-view wallpaper or a banner strip at the top. */
	backgroundLayout?: BackgroundLayout;
	/** Banner height in pixels; only read when the layout resolves to "banner". */
	bannerHeight?: number;
	/** Fade the banner's lower edge into the page instead of cutting it off with
	 * a hard line. */
	bannerFade?: boolean;
	/** Let the banner run edge to edge instead of lining up with the content
	 * column. */
	bannerFullWidth?: boolean;
}

/** A background resolved for painting: what the backdrop is, plus how this
 * board wears it, with every fallback already applied. What
 * {@link effectiveBackground} hands to the renderer. */
export interface ResolvedBackground extends BackgroundConfig {
	layout: BackgroundLayout;
	bannerHeight: number;
	bannerFade: boolean;
	bannerFullWidth: boolean;
}

/** A named dashboard: one arrangeable board of cards. The vault can hold several
 * and switch between them from the top-left switcher. */
export type HeaderAlign = "left" | "center" | "right";

export interface DashboardHeaderConfig {
	/** Override the global title visibility (undefined = use global). */
	showTitle?: boolean;
	/** Override the global title text for this dashboard. */
	title?: string;
	/** Override the global title icon for this dashboard: a Lucide id, an emoji
	 * or short text, a vault image path, or an image URL (see `titleicon.ts`).
	 * An empty string is a real override meaning "the Hearth crystal on this
	 * board"; undefined follows {@link HomeSettings.titleIcon}. */
	titleIcon?: string;
	/** Override which parts of this board's brand mark follow the theme's icon
	 * colour (undefined = use the global {@link HomeSettings.themeColorTarget}).
	 * Scoped to the board's own title block; Hearth's tab and ribbon icons are
	 * app-level and keep following the global setting. */
	themeColorTarget?: HomeSettings["themeColorTarget"];
	/** Align only the title block; the search section below has its own
	 * layout. */
	align?: HeaderAlign;
	/** Title size multiplier, clamped to a conservative range. */
	titleScale?: number;
	/** Title icon size multiplier, clamped to a conservative range. The key
	 * keeps its pre-2.2 name so no board's sizing needs migrating. */
	logoScale?: number;
	/** Title block top margin in pixels. Undefined keeps the stylesheet default. */
	marginTop?: number;
	/** Spacing below the whole header block in pixels. Undefined keeps the
	 * stylesheet default. */
	spacingBelow?: number;
}

export interface Dashboard extends BannerOverrides {
	id: string;
	name: string;
	/** Optional emoji/short text shown on the switcher button instead of its
	 * 1-based number. */
	icon?: string;
	/** Optional Lucide icon id shown on the switcher button instead of the
	 * emoji/number (takes precedence over `icon`). */
	iconLucide?: string;
	cards: DashboardCard[];
	/** Optional overrides; when omitted the global setting is used. */
	gridColumns?: number;
	rowHeight?: number;
	/** Override *what* the backdrop is for this board. Independent of the
	 * banner overrides inherited from {@link BannerOverrides}, which say how it
	 * is worn — a board can override either, both, or neither. */
	background?: BackgroundConfig;
	/** Override "fit to page" for this board (undefined = use global). */
	fitToPage?: boolean;
	/** Override the content max-width (px) for this board (undefined = global). */
	maxWidth?: number;
	/** Override "full width" for this board (undefined = global). When true the
	 * board's content fills the pane and {@link maxWidth} is ignored. */
	fullWidth?: boolean;
	/** Override compact spacing for this board (undefined = global). */
	compact?: boolean;
	/** Override the card surface opacity for this board (undefined = global). */
	cardOpacity?: number;
	/** Override the card surface backdrop blur (px) for this board (undefined =
	 * global). */
	cardBlur?: number;
	/** Override the card corner radius (px) for this board (undefined = global). */
	cardRadius?: number;
	/** Override the card border width (px) for this board (undefined = global). */
	cardBorderWidth?: number;
	/** Per-dashboard overrides for the title block. */
	header?: DashboardHeaderConfig;
	/** Override the global search/command section visibility for this board
	 * (undefined = follow {@link HomeSettings.showSearch}). */
	showSearch?: boolean;
	/** Name of a core-Workspace; loading that workspace auto-switches to this
	 * dashboard (one-way, workspace → dashboard). Undefined = not linked. */
	linkedWorkspace?: string;
	/** Marks this board as the one to open on phones/tablets. When Hearth loads
	 * on mobile it switches to the first dashboard with this flag, so a board
	 * tuned for a small screen can be the mobile default without being the
	 * desktop default. Undefined/false = not a mobile default. */
	mobileDefault?: boolean;
}

export type ChromeVisibility = "always" | "hover";

/**
 * Where Hearth puts a note when you open one from the home view.
 *
 * `"same"` reuses the tab Hearth itself is in, so the note replaces the home
 * view exactly like clicking a link inside a normal editor tab (#106). The
 * other three map straight onto Obsidian's own pane types — a new tab (the
 * historical behaviour, and still the default), a split beside the current
 * pane, or a separate window.
 */
export type OpenIn = "tab" | "same" | "split" | "window";

/** Every {@link OpenIn} value, in the order the settings dropdown lists them. */
export const OPEN_IN_MODES: readonly OpenIn[] = ["tab", "same", "split", "window"];

/**
 * The kinds of click that open a note, each of which can override the global
 * choice:
 *
 * - `link` — a link inside a rendered note, a task, or the Links card
 * - `search` — a result from the search bar or the Search card
 * - `card` — a note listed by a card (Recent, Bookmarks, Favourites, Calendar,
 *   Heatmap, Tasks) or by a mobile action button
 * - `newNote` — a note Hearth has just created (new note, daily note, event
 *   note), which is opened for editing straight away
 */
export type OpenSource = "link" | "search" | "card" | "newNote";

/** Every {@link OpenSource}, in the order the settings tab lists them. */
export const OPEN_SOURCES: readonly OpenSource[] = ["link", "search", "card", "newNote"];

/** A per-source rule: an explicit destination, or `"default"` to follow the
 * global {@link HomeSettings.openIn} choice. */
export type OpenInRule = OpenIn | "default";

/**
 * What happens to a focused Hearth tab when a note is opened by something
 * Hearth doesn't control — the file explorer, the quick switcher, the graph, or
 * a view embedded in a card that opens links itself (an embedded Bases table).
 *
 * Obsidian makes that call, not Hearth: it reuses the focused tab when the view
 * in it reports itself navigable, so this is expressed by flipping
 * `View.navigation` rather than by picking a leaf. Only two outcomes are
 * possible — Hearth is taken over (`"same"`) or it is left alone and the note
 * goes to another tab (`"tab"`) — plus `"default"` to follow
 * {@link HomeSettings.openIn}, where anything but "same tab" counts as leaving
 * Hearth alone.
 */
export type OpenOutsideRule = "default" | "same" | "tab";

/** Every {@link OpenOutsideRule}, in the order the settings dropdown lists. */
export const OPEN_OUTSIDE_RULES: readonly OpenOutsideRule[] = ["default", "same", "tab"];

export interface HomeSettings {
	// ---- Header ----
	title: string;
	showTitle: boolean;
	/** The mark drawn beside the title. One field holding any of five things —
	 * a Lucide id (`"flame"`), an emoji or short text, a vault image path, an
	 * image URL, or empty for the Hearth crystal; `titleicon.ts` decides which
	 * a value is. Each dashboard can override it — see
	 * {@link DashboardHeaderConfig.titleIcon}. */
	titleIcon: string;
	/** A Lucide icon id used for Hearth's tab header and ribbon button instead of
	 * the Hearth crystal. Empty = the crystal. */
	tabIcon: string;
	/** What follows the theme's icon color: nothing (brand-purple crystal and
	 * normal title text, the historical look), the crystal icon, the title
	 * text, or both. */
	themeColorTarget: "none" | "icon" | "title" | "both";
	/** Show the search/command section on every board that doesn't override it
	 * (see {@link Dashboard.showSearch}). */
	showSearch: boolean;
	searchPlaceholder: string;
	showNewNoteButton: boolean;
	/** What the single button beside the search bar does: create a new note, or
	 * run a web search for the current search-field contents. */
	newNoteButtonMode: "newNote" | "searchOnline";
	/** Text on the New-note button. Empty means the built-in "New note". */
	newNoteButtonLabel: string;
	/** Vault path of a Templater template the New-note button runs instead of
	 * making a blank note. Empty (or Templater missing) means a blank note. */
	newNoteTemplate: string;
	/** Destination folder for the notes the New-note button makes. Empty hands
	 * the choice back to Obsidian's "Default location for new notes". */
	newNoteFolder: string;
	/** Filename pattern for those notes, without the extension. Supports the
	 * same `{{date}}` / `{{time}}` / `{{prompt}}` tokens as the Templater card;
	 * empty keeps Obsidian's "Untitled" (or lets Templater name it). */
	newNoteFilename: string;
	/** Also search inside note bodies (full-text), not just names/tags/properties. */
	searchContents: boolean;
	/** Which engine powers the search bar: Hearth's built-in vault search, or the
	 * Omnisearch community plugin (only usable when Omnisearch is installed and
	 * enabled — Hearth falls back to the built-in engine otherwise). */
	searchEngine: "builtin" | "omnisearch";

	// ---- Background ----
	backgroundKind: BackgroundKind;
	/** A CSS colour, a vault image path, a URL, or a packed weather place
	 * depending on backgroundKind. */
	backgroundValue: string;
	backgroundOpacity: number;
	backgroundBlur: number;
	/** Paint the background across the whole view, or as a banner strip at the
	 * top of the content. See {@link BackgroundLayout}. */
	backgroundLayout: BackgroundLayout;
	/** Banner height in pixels; only used when `backgroundLayout` is "banner". */
	bannerHeight: number;
	/** Fade the banner's lower edge into the page. Default true. */
	bannerFade: boolean;
	/** Run the banner edge to edge rather than aligning it with the content
	 * column. Default false. */
	bannerFullWidth: boolean;
	/** Let the "weather" background drift, fall and twinkle. Default true; low
	 * power mode replaces the whole background anyway, and a reader who has
	 * asked their OS for reduced motion gets a still sky regardless. */
	backgroundSkyAnimate?: boolean;

	// ---- Behaviour ----
	openOnStartup: boolean;
	replaceNewTabs: boolean;
	/** Place keyboard focus in the search field whenever a home view opens, so a
	 * new Hearth tab can be typed into straight away without reaching for the
	 * mouse. Desktop only — auto-focusing on mobile would pop the on-screen
	 * keyboard on every open. */
	focusSearchOnOpen: boolean;
	/** Live-refresh open home views when the vault changes (files created,
	 * modified, deleted or renamed), so cards like Recent, Bookmarks and saved
	 * queries update without reopening the tab. Debounced, and skipped while a
	 * board is being arranged. Off by default; a home view already refreshes
	 * whenever the user switches back to its tab regardless of this setting. */
	liveRefresh: boolean;
	/** On mobile, show only the search field and hide the dashboard. Has no
	 * effect on desktop, where the full dashboard is always shown. */
	mobileSearchOnly: boolean;
	/** In Mobile mode, show the customizable action button row under the
	 * search bar and filters instead of the "New note" button beside search. */
	showMobileActionBar: boolean;
	/** Buttons shown in the mobile action bar. */
	mobileActionButtons: MobileActionButton[];
	/** Reflow the board into a single full-width column once it is narrower
	 * than {@link NARROW_MAX_WIDTH} — a phone, but equally a narrow desktop
	 * pane. On by default: the free-form layout has no meaning at that width
	 * (a quarter-width card is ~90px on a phone), so the alternative is a board
	 * nobody can read. Turn it off to keep the scaled free-form layout. */
	stackOnNarrow: boolean;
	/** Block all outbound network requests Hearth would otherwise make. The only
	 * requests are configured live-content cards (including Jira) and the
	 * calculator's key-less, ECB-backed currency-rate fetch. */
	disableExternalCalls: boolean;

	// ---- Opening notes ----
	/** Where every note Hearth opens goes by default (#106). `"tab"` is the
	 * historical behaviour. */
	openIn: OpenIn;
	/** Per-source exceptions to {@link openIn}. Every source defaults to
	 * `"default"` (follow the global choice), so the single dropdown above is
	 * enough for anyone who doesn't want the detail. */
	openInOverrides: Record<OpenSource, OpenInRule>;
	/** Whether a note opened from outside Hearth may take over a focused Hearth
	 * tab. Defaults to `"same"` — the behaviour Hearth has had since #84, where
	 * the dashboard acts like an ordinary tab and the file explorer's selection
	 * tracks what you open. Deliberately *not* `"default"`: following the global
	 * choice would flip this for everyone on upgrade. */
	openFromOutside: OpenOutsideRule;

	// ---- Performance ----
	/**
	 * How much of the home view's decoration to pay for. See
	 * {@link PerformanceTier} for what each step drops.
	 *
	 * Deliberately an *override*, not a bulk edit of the settings below: nothing
	 * else in this object is touched by the tier, and every resolver
	 * (`effectiveBackground`, `effectiveCardBlur`, …) simply reports the tier's
	 * value instead. Moving back up a tier therefore restores the previous look
	 * exactly — including per-dashboard and per-card overrides — with no snapshot
	 * to keep in sync and nothing to lose if the vault is synced or the settings
	 * file is edited by hand while a lower tier is selected.
	 */
	performanceTier: PerformanceTier;
	/**
	 * The performance tier to use on mobile, where {@link performanceTier} is
	 * ignored. `"match"` follows the desktop tier instead of overriding it.
	 *
	 * Separate because the trade-off genuinely differs by device rather than by
	 * taste: the animated sky and the frosted glass are the two most expensive
	 * things Hearth draws, and a phone pays for them out of a battery while
	 * showing them on the smallest screen Hearth runs on. Defaults to
	 * `"balanced"`, which thins the sky and changes nothing else.
	 */
	mobilePerformanceTier: PerformanceTier | "match";
	/** The flat background colour used on the "minimal" tier. Any CSS colour;
	 * defaults to {@link LOW_POWER_BACKGROUND}. */
	lowPowerBackgroundColor: string;
	/**
	 * Hold every animation while the Obsidian window is not the one being used.
	 *
	 * A Hearth tab the workspace has hidden already costs nothing — Obsidian
	 * takes an inactive leaf out of layout, and the browser stops animating a
	 * subtree that isn't laid out. A *visible* Hearth tab in an unfocused window
	 * is the gap this closes: side by side with a browser, or on a second
	 * monitor, the board keeps animating at the full frame rate for nobody.
	 *
	 * On by default because the animation it pauses is one nobody is looking at;
	 * off for anyone who wants the board live on a second screen.
	 */
	pauseWhenUnfocused: boolean;

	// ---- Appearance (layout density) ----
	/** Tighten card and top-of-page spacing to enlarge the usable area. */
	compact: boolean;
	/** Visibility for the arrange/edit mode entry button. */
	arrangeButtonVisibility: ChromeVisibility;
	/** Visibility for the top-left dashboard switcher buttons. */
	dashboardSwitcherVisibility: ChromeVisibility;
	/** Card background opacity (0 = fully transparent, 1 = fully opaque). */
	cardOpacity: number;
	/** Card surface backdrop blur in pixels — the frosted-glass strength behind
	 * translucent cards. 0 = no blur. */
	cardBlur: number;
	/** Card corner radius in pixels. Ranges from 0 (sharp corners) up to the
	 * design default of 14; larger is disallowed so nothing that assumes the
	 * baseline rounding (merged-edge sharpening, the frost mask) breaks. */
	cardRadius: number;
	/** Card border width in pixels. 0 removes the visible card border and the
	 * header divider line. */
	cardBorderWidth: number;

	// ---- Search filters ----
	/** Group ids the user has hidden from the auto-detected filter row. */
	hiddenFilters: string[];

	// ---- Dashboard ----
	/** All dashboards. Always has at least one entry after migration. */
	dashboards: Dashboard[];
	/** Id of the dashboard currently shown. */
	activeDashboardId: string;
	/** Cards pinned to every dashboard (rendered on top of each board's cards). */
	pinnedCards: DashboardCard[];
	gridColumns: number;
	/** Height of one grid row in pixels. Lower = finer vertical sizing. */
	rowHeight: number;
	/** Curated note paths shown by "favorites" cards. */
	favorites: string[];
	/** Fit the dashboard to one screen (no scroll) vs. allow scrolling. */
	fitToPage: boolean;

	// ---- Tasks / TaskNotes ----
	/** Frontmatter property names read by "tasks" cards in TaskNotes mode.
	 * TaskNotes has no stable API for other plugins, and its own field names
	 * are user-remappable, so these mirror its defaults and can be adjusted
	 * to match whatever the vault has them set to. */
	taskNotesStatusField: string;
	taskNotesDueField: string;
	/** Frontmatter field read for a task's priority (shown as an indicator). */
	taskNotesPriorityField: string;
	/** The status value that counts as "done". */
	taskNotesDoneValue: string;
	/** Master switch for task-field customization (off by default). While it is
	 * off, every "tasks" card draws the fixed metadata it always has and the
	 * per-card Fields controls stay hidden — so a vault that never goes looking
	 * for this never sees it. Turning it on *replaces* that fixed rendering with
	 * the fields defined below, which start empty: metadata is then shown only
	 * because it was asked for. See `src/taskfields.ts`. */
	taskFieldsEnabled: boolean;
	/** The fields every "tasks" card shows, unless the card defines its own
	 * (`TasksConfig.taskFieldsEnabled`). */
	taskFields: TaskFieldDef[];

	// ---- File icons / Iconic / Iconize ----
	/** Show the per-file icons set with the Iconic or Iconize community plugins
	 * wherever Hearth draws a file icon, instead of Hearth's file-type icon.
	 * Harmless with neither plugin installed — there is simply nothing to read,
	 * and every file keeps its type icon. */
	customFileIcons: boolean;
	/** Frontmatter property Iconize stores a note's icon in. Iconize lets the
	 * user rename it, so — as with the TaskNotes fields above — this mirrors its
	 * default rather than assuming nobody changed it. */
	iconizeIconProperty: string;

	// ---- Operon ----
	/** Let Hearth talk to the Operon plugin's Developer API. Turning this off
	 * is a kill switch: Operon cards stop reading and no capability grant is
	 * ever requested. On by default, but nothing happens until an Operon card
	 * is added — the session is only opened when one renders. */
	operonIntegration: boolean;

	/** Let Hearth *change* Operon tasks: dragging a card between board columns,
	 * and the card's "+". Off by default, and separate from the switch above
	 * because Operon's grant is all-or-nothing — turning this on widens what
	 * Hearth asks for and needs a fresh approval in Operon's settings, so it is
	 * never done on a vault's behalf. */
	operonWrites: boolean;

	// ---- Layout ----
	/** The widest the content column may grow, in pixels. It is a ceiling, not a
	 * width: the column is fluid and shrinks to fit a narrower pane. Ignored
	 * entirely while {@link fullWidth} is on. */
	maxWidth: number;
	/** Drop the ceiling and let the content column fill the pane at any size.
	 * Off by default: card geometry scales with the column but type does not, so
	 * an unbounded column turns a board on a wide monitor sparse. */
	fullWidth: boolean;

	// ---- Internal bookkeeping ----
	/** The plugin version whose release notes the user last saw. Used to decide
	 * when to pop the "What's new" dialog after an update. Empty on a fresh
	 * install (which is seeded silently, without showing the dialog). */
	lastSeenVersion: string;
	/** How far the first-run setup wizard has got. See {@link SetupStatus}. */
	setupStatus: SetupStatus;
}

/**
 * Whether the first-run setup wizard still has something to do.
 *
 * - `pending` — a fresh install that hasn't been offered the wizard yet. The
 *   only value that pops it automatically.
 * - `done` — the wizard was completed, *or* this is a vault that predates it
 *   (see `migrateSettings`): an existing dashboard must never be interrupted by
 *   a wizard offering to rebuild it.
 * - `skipped` — the wizard was offered and dismissed. Behaves like `done`, but
 *   is kept distinct so "Set up Hearth" in settings can still read as an
 *   invitation rather than a redo.
 */
export type SetupStatus = "pending" | "done" | "skipped";

export const DEFAULT_SETTINGS: HomeSettings = {
	title: "Obsidian",
	showTitle: true,
	// Empty => the Hearth crystal icon is shown as the brand mark.
	titleIcon: "",
	// Empty => the Hearth crystal is the tab and ribbon icon.
	tabIcon: "",
	themeColorTarget: "none",
	showSearch: true,
	searchPlaceholder: "Search or command",
	showNewNoteButton: true,
	newNoteButtonMode: "newNote",
	newNoteButtonLabel: "",
	newNoteTemplate: "",
	newNoteFolder: "",
	newNoteFilename: "",
	searchContents: true,
	searchEngine: "builtin",

	backgroundKind: "default",
	backgroundValue: "",
	/* Ambient: the background is visible but doesn't compete with content.
	 * Opacity is low enough that foreground reads clearly; blur is gentle so
	 * the image is still recognizable, not a wash of colour. */
	backgroundOpacity: 0.35,
	backgroundBlur: 2,
	/* The wallpaper board is what Hearth has always been, so it stays the
	 * default; the banner is a choice, not an upgrade. */
	backgroundLayout: "full",
	bannerHeight: BANNER_HEIGHT_DEFAULT,
	bannerFade: true,
	bannerFullWidth: false,

	openOnStartup: true,
	replaceNewTabs: true,
	focusSearchOnOpen: false,
	liveRefresh: false,
	mobileSearchOnly: false,
	showMobileActionBar: true,
	// Backfilled by migrateSettings so a fresh install gets the defaults below
	// and existing vaults aren't silently reset if the list is emptied.
	mobileActionButtons: [],
	stackOnNarrow: true,
	disableExternalCalls: false,

	// A new tab is what Hearth has always done; existing vaults must not change
	// behaviour on upgrade, so both the global default and every per-source rule
	// start out as "open a new tab".
	openIn: "tab",
	openInOverrides: { link: "default", search: "default", card: "default", newNote: "default" },
	openFromOutside: "same",

	performanceTier: "full",
	mobilePerformanceTier: "balanced",
	lowPowerBackgroundColor: LOW_POWER_BACKGROUND,
	// On by default: it pauses animation nobody is looking at (see the field's
	// own note for why a hidden tab is already free but an unfocused window is
	// not), and anyone running the board on a second screen can turn it off.
	pauseWhenUnfocused: true,

	compact: false,
	arrangeButtonVisibility: "always",
	dashboardSwitcherVisibility: "always",
	cardOpacity: 0.5,
	// Frosted glass is off by default, and is the one default that changed for
	// power rather than for looks. Every blurred card is a backdrop-filter layer
	// the compositor re-evaluates whenever anything behind it changes, so on a
	// board with a moving wallpaper it is re-blurred every frame at the display's
	// full pixel density. Translucency (above) is kept: alpha compositing is
	// cheap, so the cards still read as glass over the wallpaper.
	//
	// Existing vaults are unaffected — `cardBlur` is already present in their
	// data.json, so loadSettings keeps whatever they chose.
	cardBlur: 0,
	// The design baseline corner radius; also the maximum (only sharper is
	// allowed) so it matches the hardcoded 14 the layout was tuned around.
	cardRadius: 14,
	// Default card border width preserves the classic 1px look.
	cardBorderWidth: 1,

	hiddenFilters: [],

	// Built by migration from STARTER_CARDS (fresh install) or the legacy
	// top-level `cards` array (upgrade). Left empty here so migration always runs.
	dashboards: [],
	activeDashboardId: "",
	pinnedCards: [],
	gridColumns: 12,
	rowHeight: 92,
	favorites: [],
	fitToPage: true,

	taskNotesStatusField: "status",
	taskNotesDueField: "due",
	taskNotesPriorityField: "priority",
	taskNotesDoneValue: "done",
	taskFieldsEnabled: false,
	taskFields: [],

	// On by default: with neither icon plugin installed this changes nothing,
	// and with one installed the icons the user already set are what they expect
	// to see. "icon" is Iconize's own default property name.
	customFileIcons: true,
	iconizeIconProperty: "icon",

	// On by default, but inert until an Operon card exists: no session is
	// opened — and so no grant is requested — until one renders.
	operonIntegration: true,
	// Reading is the default; writing is a decision, since it widens the grant
	// the user has to approve in Operon.
	operonWrites: false,

	maxWidth: 1600,
	fullWidth: false,

	lastSeenVersion: "",
	// Fresh installs start out owing the wizard a run; `migrateSettings` marks
	// every *existing* vault as done, so nobody is offered a rebuild of a
	// dashboard they already have.
	setupStatus: "pending",
};

/** The cards a brand-new vault starts with. Coordinates and sizes are taken
 * directly from a hand-tuned fit-to-page layout so cards land correctly on
 * first render without depending on the grid conversion. */
function starterCards(): DashboardCard[] {
	return [
		{
			id: "card-clock",
			kind: "clock",
			title: "",
			x: 0, y: 0, w: 12, h: 3,
			fx: 0,
			fw: 0.2845744680851064,
			fy: 0,
			fh: 145,
		},
		{
			id: "card-daily",
			kind: "daily",
			title: "Today",
			x: 0, y: 3, w: 7, h: 6,
			fx: 0.6309840425531915,
			fw: 0.3690159574468085,
			fy: 0,
			fh: 512,
		},
		{
			id: "card-calendar",
			kind: "calendar",
			title: "Calendar",
			x: 7, y: 3, w: 5, h: 6,
			fx: 0,
			fw: 0.2845744680851064,
			fy: 159,
			fh: 353,
		},
		{
			id: "card-recent",
			kind: "recent",
			title: "Recent",
			x: 0, y: 9, w: 7, h: 4,
			count: 8,
			fx: 0.29521276595744683,
			fw: 0.32513297872340424,
			fy: 143,
			fh: 369,
		},
		{
			id: "card-stats",
			kind: "stats",
			title: "Vault",
			x: 7, y: 9, w: 5, h: 4,
			fx: 0.29521276595744683,
			fw: 0.32513297872340424,
			fy: 0,
			fh: 133,
		},
	];
}

/** The mobile action bar's default buttons. Each `target` is a command Hearth
 * registers itself, so replacing one via the command picker works exactly like
 * swapping in any other plugin's command. */
export function defaultMobileActionButtons(): MobileActionButton[] {
	return [
		{ id: "action-new-note", label: "New note", icon: "plus", type: "command", target: "hearth:new-note" },
		{ id: "action-new-drawing", label: "New drawing", icon: "pen-tool", type: "command", target: "hearth:new-drawing" },
		{ id: "action-record-voice", label: "Record voice", icon: "mic", type: "command", target: "hearth:record-voice" },
		{ id: "action-daily-note", label: "Daily note", icon: "calendar", type: "command", target: "hearth:open-daily-note" },
	];
}

/** Generate a unique dashboard id. */
export function newDashboardId(): string {
	return `dash-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** The dashboard currently selected (falls back to the first one). */
export function activeDashboard(s: HomeSettings): Dashboard {
	return s.dashboards.find((d) => d.id === s.activeDashboardId) ?? s.dashboards[0];
}

/** Cards of the currently selected dashboard (its own cards only). */
export function activeCards(s: HomeSettings): DashboardCard[] {
	return activeDashboard(s).cards;
}

/** Cards to render on the active board: its own cards plus every pinned card. */
export function renderCards(s: HomeSettings): DashboardCard[] {
	return [...activeDashboard(s).cards, ...s.pinnedCards];
}

/** Effective grid columns for the active board (per-dashboard override or global). */
export function effectiveColumns(s: HomeSettings): number {
	return activeDashboard(s).gridColumns ?? s.gridColumns;
}

/** Effective row height for the active board (per-dashboard override or global). */
export function effectiveRowHeight(s: HomeSettings): number {
	return activeDashboard(s).rowHeight ?? s.rowHeight;
}

/** Effective "fit to page" for the active board (per-dashboard override or global). */
export function effectiveFitToPage(s: HomeSettings): boolean {
	return activeDashboard(s).fitToPage ?? s.fitToPage;
}

/** Whether the active board should show the search/command section
 * (per-dashboard override or global). */
export function effectiveShowSearch(s: HomeSettings): boolean {
	return activeDashboard(s).showSearch ?? s.showSearch;
}

export const HEADER_SCALE_MIN = 0.6;
export const HEADER_SCALE_MAX = 1.8;
export const HEADER_MARGIN_TOP_MIN = 0;
export const HEADER_MARGIN_TOP_MAX = 96;
export const HEADER_SPACING_BELOW_MIN = 0;
export const HEADER_SPACING_BELOW_MAX = 96;

function clampHeaderScale(v: unknown): number {
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(HEADER_SCALE_MIN, Math.min(HEADER_SCALE_MAX, v))
		: 1;
}

function clampHeaderMarginTop(v: unknown): number | undefined {
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(HEADER_MARGIN_TOP_MIN, Math.min(HEADER_MARGIN_TOP_MAX, Math.round(v)))
		: undefined;
}

function clampHeaderSpacingBelow(v: unknown): number | undefined {
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(
				HEADER_SPACING_BELOW_MIN,
				Math.min(HEADER_SPACING_BELOW_MAX, Math.round(v)),
			)
		: undefined;
}

/** Whether the active board should show the title block. */
export function effectiveShowTitle(s: HomeSettings): boolean {
	return activeDashboard(s).header?.showTitle ?? s.showTitle;
}

/** Title text for the active board's title block. */
export function effectiveTitle(s: HomeSettings): string {
	return activeDashboard(s).header?.title ?? s.title;
}

/** The title icon for the active board — a Lucide id, emoji/text, a vault image
 * path or an image URL; `titleicon.ts` decides which. Empty = the Hearth
 * crystal, and a board's own empty string wins over a global icon: that is how
 * a single board opts back out of it. */
export function effectiveTitleIcon(s: HomeSettings): string {
	return activeDashboard(s).header?.titleIcon ?? s.titleIcon;
}

/** Alignment for the active board's title block; search layout is separate. */
export function effectiveHeaderAlign(s: HomeSettings): HeaderAlign {
	const align = activeDashboard(s).header?.align;
	return align === "left" || align === "right" ? align : "center";
}

/** Title size multiplier for the active board's title block. */
export function effectiveHeaderTitleScale(s: HomeSettings): number {
	return clampHeaderScale(activeDashboard(s).header?.titleScale);
}

/** Title icon size multiplier for the active board's title block. */
export function effectiveHeaderLogoScale(s: HomeSettings): number {
	return clampHeaderScale(activeDashboard(s).header?.logoScale);
}

/** Optional title block top margin override in pixels. Undefined keeps CSS default. */
export function effectiveHeaderMarginTop(s: HomeSettings): number | undefined {
	return clampHeaderMarginTop(activeDashboard(s).header?.marginTop);
}

/** Optional spacing below the whole header block in pixels. Undefined keeps CSS default. */
export function effectiveHeaderSpacingBelow(s: HomeSettings): number | undefined {
	return clampHeaderSpacingBelow(activeDashboard(s).header?.spacingBelow);
}

/** Whether the active board draws with compact spacing (per-dashboard override
 * or global). */
export function effectiveCompact(s: HomeSettings): boolean {
	return activeDashboard(s).compact ?? s.compact;
}

/** Which parts of the active board's brand mark follow the theme's icon colour
 * (per-dashboard override or global). The board's title block only — the tab
 * and ribbon icons are app-level and read {@link HomeSettings.themeColorTarget}
 * directly. */
export function effectiveThemeColorTarget(s: HomeSettings): HomeSettings["themeColorTarget"] {
	return activeDashboard(s).header?.themeColorTarget ?? s.themeColorTarget;
}

/** Content-width bounds, in pixels. The floor keeps the column wide enough for
 * a readable multi-column board; the ceiling reaches the full width of a 4K
 * panel, past which a fixed number stops meaning anything and "full width" is
 * the honest answer. The settings sliders, the per-board override and the
 * clamp applied to an imported layout all read these, so the range has exactly
 * one definition. */
export const CONTENT_WIDTH_MIN = 700;
export const CONTENT_WIDTH_MAX = 3840;
export const CONTENT_WIDTH_STEP = 20;

/** Effective content max-width for the active board (per-dashboard override or global). */
export function effectiveMaxWidth(s: HomeSettings): number {
	return activeDashboard(s).maxWidth ?? s.maxWidth;
}

/** Whether the active board ignores its width ceiling and fills the pane
 * (per-dashboard override or global). */
export function effectiveFullWidth(s: HomeSettings): boolean {
	return activeDashboard(s).fullWidth ?? s.fullWidth;
}

/**
 * The selected tier, repaired on read.
 *
 * Every predicate below funnels through this, so the ladder has exactly one
 * definition and an unknown value (a hand-edited data.json, a newer tier synced
 * back from a future version) can only ever read as `full` rather than as
 * something arbitrary.
 */
export function performanceTier(s: HomeSettings): PerformanceTier {
	// On a phone or tablet the mobile tier answers instead, unless it is set to
	// follow the desktop one. Resolved here rather than at each call site so
	// every predicate below (motion, frost, refresh timers) picks it up for
	// free, and so the desktop tier is never overwritten to express a mobile
	// preference — both are stored, and the device decides which is read.
	//
	// Repaired in two steps rather than one so an unreadable mobile value falls
	// back to the desktop tier the user actually chose, not to `full`.
	const mobile = Platform.isMobile ? s.mobilePerformanceTier : "match";
	const tier = mobile !== "match" && PERFORMANCE_TIERS.includes(mobile)
		? mobile
		: s.performanceTier;
	return PERFORMANCE_TIERS.includes(tier) ? tier : "full";
}

/** Rank on the ladder, so the predicates below can say "at least this frugal"
 * without spelling out every tier. */
function tierRank(s: HomeSettings): number {
	return PERFORMANCE_TIERS.indexOf(performanceTier(s));
}

/**
 * Whether the board may animate at all: the painted sky's drift and fall, the
 * pet's moods, slideshow transitions, the clock's second hand, and every CSS
 * transition and hover lift.
 *
 * False from `reduced` down. This is the predicate that matters for power —
 * animation is the single most expensive thing Hearth does.
 */
export function motionAllowed(s: HomeSettings): boolean {
	return tierRank(s) < PERFORMANCE_TIERS.indexOf("reduced");
}

/**
 * How much of the painted sky's field to draw, as a fraction.
 *
 * The `balanced` tier's whole content: the sky keeps drifting and falling, there
 * is simply less of it to move, and a sky at half density still reads as rain
 * rather than as a broken effect.
 *
 * Buys about a third, not a half. Cost scales with the number of animated shapes
 * but not only with it — the per-frame layout an animated SVG forces has a fixed
 * component too — so thinning trims the bill rather than halving it. Measured at
 * 168.9ms -> 120.0ms per 4s for a board-spread rain field.
 */
export function skyDensity(s: HomeSettings): number {
	if (!motionAllowed(s)) return 1; // A still sky costs nothing; keep it whole.
	return performanceTier(s) === "balanced" ? 0.5 : 1;
}

/** Whether the frosted-glass blur behind cards may be built. False from
 * `reduced` down: each layer is a backdrop-filter the compositor has to
 * re-evaluate whenever anything behind it changes. */
export function frostAllowed(s: HomeSettings): boolean {
	return tierRank(s) < PERFORMANCE_TIERS.indexOf("reduced");
}

/** Whether timer-driven work may run at all: card auto-refresh and the
 * vault-driven live rebuild. False only on `minimal`. */
export function timersAllowed(s: HomeSettings): boolean {
	return performanceTier(s) !== "minimal";
}

/** The bottom rung — what used to be "low power mode". Replaces the wallpaper
 * with a flat colour and makes cards opaque, on top of everything the tiers
 * above it already drop. */
export function lowPowerActive(s: HomeSettings): boolean {
	return performanceTier(s) === "minimal";
}

/** The background the `minimal` tier substitutes for whatever is configured: a
 * flat colour at full opacity with no blur, so there is no image to fetch/decode
 * and no filtered layer to composite. */
export function lowPowerBackground(s: HomeSettings): BackgroundConfig {
	const value = s.lowPowerBackgroundColor?.trim() || LOW_POWER_BACKGROUND;
	return { kind: "color", value, opacity: 1, blur: 0 };
}

/**
 * Timer-driven auto-refresh interval a live card should actually use, in
 * minutes. The `minimal` tier reports 0 (manual refresh only) so no card wakes
 * the app up on a timer; the configured value is left untouched and comes back
 * the moment a higher tier is selected.
 *
 * Only the *timer* is suppressed — callers that also derive a cache TTL from
 * the configured interval must keep using the raw value for that.
 */
export function effectiveAutoRefreshMinutes(s: HomeSettings, minutes: number): number {
	return timersAllowed(s) ? minutes : 0;
}

/** Effective card surface opacity for the active board (per-dashboard override
 * or global). 0 = fully transparent, 1 = fully opaque. */
export function effectiveCardOpacity(s: HomeSettings): number {
	// Low power: opaque cards. Translucency has to composite the card over the
	// backdrop on every paint, and without the frost blur below it reads as a
	// wash rather than glass.
	if (lowPowerActive(s)) return 1;
	const v = activeDashboard(s).cardOpacity ?? s.cardOpacity;
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** Resolve the per-card opacity override, falling back to the board/global
 * value from effectiveCardOpacity. */
export function resolveCardOpacity(s: HomeSettings, card: DashboardCard): number {
	if (lowPowerActive(s)) return 1;
	const v = card.cardOpacity ?? effectiveCardOpacity(s);
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** Effective card backdrop blur (px) for the active board (per-dashboard
 * override or global). 0 = no frosted-glass blur. Clamped to a sane range. */
export function effectiveCardBlur(s: HomeSettings): number {
	// From `reduced` down: no frosted glass. Reporting 0 here (and in
	// resolveCardBlur) is enough to switch it off wholesale — no card is marked
	// .has-blur, so updateFrostLayers never builds a backdrop-filter layer or its
	// SVG mask.
	if (!frostAllowed(s)) return 0;
	const v = activeDashboard(s).cardBlur ?? s.cardBlur;
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(40, v)) : 0;
}

/** Resolve the per-card blur override (px), falling back to the board/global
 * value from effectiveCardBlur. */
export function resolveCardBlur(s: HomeSettings, card: DashboardCard): number {
	if (!frostAllowed(s)) return 0;
	const v = card.cardBlur ?? effectiveCardBlur(s);
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(40, v)) : 0;
}

/** The design baseline card corner radius (px). Also the maximum the setting
 * allows: rounding beyond this was never tuned for (merged-edge sharpening, the
 * frosted-glass mask, arrange outlines) so only sharper is offered. */
export const CARD_RADIUS_MAX = 14;
export const CARD_BORDER_WIDTH_MAX = 8;

/** Effective card corner radius (px) for the active board (per-dashboard
 * override or global), clamped to [0, CARD_RADIUS_MAX]. Applied board-wide via
 * the --hearth-card-radius CSS variable so every card (and the frost mask)
 * rounds by the same amount. */
export function effectiveCardRadius(s: HomeSettings): number {
	const v = activeDashboard(s).cardRadius ?? s.cardRadius;
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(0, Math.min(CARD_RADIUS_MAX, v))
		: CARD_RADIUS_MAX;
}

/** Effective card border width (px) for the active board (per-dashboard
 * override or global), clamped to [0, CARD_BORDER_WIDTH_MAX]. */
export function effectiveCardBorderWidth(s: HomeSettings): number {
	const v = activeDashboard(s).cardBorderWidth ?? s.cardBorderWidth;
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(0, Math.min(CARD_BORDER_WIDTH_MAX, Math.round(v)))
		: 1;
}

/** Resolve the per-card border width override (px), falling back to the
 * board/global value from effectiveCardBorderWidth. */
export function resolveCardBorderWidth(s: HomeSettings, card: DashboardCard): number {
	const v = card.cardBorderWidth;
	return typeof v === "number" && !Number.isNaN(v)
		? Math.max(0, Math.min(CARD_BORDER_WIDTH_MAX, Math.round(v)))
		: effectiveCardBorderWidth(s);
}

/** Remove a card from whichever list holds it (a board or the pinned set). */
export function removeCard(s: HomeSettings, card: DashboardCard): void {
	for (const d of s.dashboards) {
		const i = d.cards.indexOf(card);
		if (i >= 0) {
			d.cards.splice(i, 1);
			return;
		}
	}
	const p = s.pinnedCards.indexOf(card);
	if (p >= 0) s.pinnedCards.splice(p, 1);
}

/** Pin/unpin a card: move it between its board and the shared pinned set. */
export function setCardPinned(s: HomeSettings, card: DashboardCard, pinned: boolean): void {
	const alreadyPinned = s.pinnedCards.includes(card);
	if (pinned === alreadyPinned) {
		card.pinned = pinned;
		return;
	}
	if (pinned) {
		for (const d of s.dashboards) {
			const i = d.cards.indexOf(card);
			if (i >= 0) {
				d.cards.splice(i, 1);
				break;
			}
		}
		card.pinned = true;
		s.pinnedCards.push(card);
	} else {
		const i = s.pinnedCards.indexOf(card);
		if (i >= 0) s.pinnedCards.splice(i, 1);
		card.pinned = false;
		activeDashboard(s).cards.push(card);
	}
}

/**
 * Effective background for the active board: what the backdrop is, and how the
 * board wears it, with every fallback applied.
 *
 * The two halves resolve *separately*, which is the whole point of splitting
 * them. A board can override the picture and keep the global layout, override
 * the layout and keep the global picture, or override both — so "the vault's
 * wallpaper, but as a banner on this one board" needs no picture restated.
 */
export function effectiveBackground(s: HomeSettings): ResolvedBackground {
	const dash = activeDashboard(s);
	// Low power replaces the backdrop — and only the backdrop. The layout is not
	// a paint cost, and swapping it would move every card on the board the
	// moment the mode is toggled, which is exactly what the mode promises not to
	// do. So a bannered board keeps its banner and simply fills it with the flat
	// colour. The per-dashboard background is overridden along with the global
	// one: no board may pull in a wallpaper while the mode is on.
	const source = lowPowerActive(s)
		? lowPowerBackground(s)
		: (dash.background ?? {
				kind: s.backgroundKind,
				value: s.backgroundValue,
				opacity: s.backgroundOpacity,
				blur: s.backgroundBlur,
			});

	return {
		...source,
		layout: dash.backgroundLayout ?? s.backgroundLayout ?? "full",
		bannerHeight: clampBannerHeight(dash.bannerHeight ?? s.bannerHeight),
		bannerFade: (dash.bannerFade ?? s.bannerFade) !== false,
		bannerFullWidth: (dash.bannerFullWidth ?? s.bannerFullWidth) === true,
	};
}

/** Whether the active board paints its backdrop as a banner rather than as a
 * full-view wallpaper. A "none" background has nothing to put in a banner, so
 * it reports false and the board is drawn without one. Low power mode does not
 * change the answer — it swaps what fills the banner, not whether there is one
 * (see {@link effectiveBackground}). */
export function bannerActive(s: HomeSettings): boolean {
	const bg = effectiveBackground(s);
	return bg.layout === "banner" && bg.kind !== "none";
}

/**
 * Recursively backfill any keys missing from `target` using `defaults`, for
 * plain objects only (arrays and primitives are left as loaded). A top-level
 * Object.assign only backfills top-level keys; this also fills nested config
 * objects (backgrounds, clocks…) added in newer versions, so loaded settings
 * are never missing a nested default that the code assumes is present.
 */
export function fillMissingDefaults(
	target: Record<string, unknown>,
	defaults: Record<string, unknown>,
): void {
	for (const [key, dv] of Object.entries(defaults)) {
		const tv = target[key];
		if (tv === undefined) {
			target[key] = Array.isArray(dv)
				? [...(dv as unknown[])]
				: isPlainObject(dv)
					? { ...dv }
					: dv;
		} else if (isPlainObject(dv) && isPlainObject(tv)) {
			fillMissingDefaults(tv, dv);
		}
	}
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Bring loaded settings up to date: wrap the legacy single-board `cards` array
 * (or the starter set) into the multi-dashboard model and backfill any new
 * fields. Idempotent — safe to run on every load.
 *
 * Returns `true` when it performed a destructive/one-way migration whose result
 * must be flushed back to storage (the `commandId` → `target` fold, the
 * `lowPower` → performance tier fold, and the `logo`/`logoIcon` → `titleIcon`
 * fold), so the caller knows to persist. The purely additive back-fills above
 * remain in-memory until the next ordinary save, exactly as before.
 */
export function migrateSettings(s: HomeSettings, raw: Record<string, unknown>): boolean {
	if (!Array.isArray(s.dashboards) || s.dashboards.length === 0) {
		const legacy = Array.isArray(raw.cards) ? (raw.cards as DashboardCard[]) : null;
		s.dashboards = [
			{ id: newDashboardId(), name: "Dashboard 1", cards: legacy ?? starterCards() },
		];
	}
	if (!s.activeDashboardId || !s.dashboards.some((d) => d.id === s.activeDashboardId)) {
		s.activeDashboardId = s.dashboards[0].id;
	}
	if (typeof s.rowHeight !== "number" || s.rowHeight <= 0) s.rowHeight = 92;
	if (typeof s.cardOpacity !== "number") s.cardOpacity = 0.5;
	if (typeof s.cardBlur !== "number") s.cardBlur = DEFAULT_SETTINGS.cardBlur;
	if (typeof s.cardRadius !== "number") s.cardRadius = CARD_RADIUS_MAX;
	if (typeof s.cardBorderWidth !== "number") s.cardBorderWidth = 1;
	// ---- Performance tier (replaced the boolean low power mode) ----
	//
	// One-way: the old `lowPower` flag is folded into the tier and the key is
	// dropped, so it cannot linger and then contradict the tier once someone
	// changes it. Keyed off `raw` rather than `s`, because loadSettings has
	// already merged DEFAULT_SETTINGS over the persisted data by the time this
	// runs — `s.performanceTier` is therefore always populated, and testing it
	// would mean never seeing the legacy flag at all.
	let migratedLowPower = false;
	if (!PERFORMANCE_TIERS.includes(raw.performanceTier as PerformanceTier)) {
		// No tier persisted. If the legacy flag is there, honour it; otherwise
		// leave whatever is already in memory (a valid tier set by a caller, or
		// the default) rather than stamping over it.
		if ("lowPower" in raw) {
			s.performanceTier = raw.lowPower === true ? "minimal" : "full";
			migratedLowPower = true;
		} else if (!PERFORMANCE_TIERS.includes(s.performanceTier)) {
			s.performanceTier = "full";
		}
	} else {
		s.performanceTier = raw.performanceTier as PerformanceTier;
	}
	if ("lowPower" in (s as object)) {
		delete (s as Partial<HomeSettings> & { lowPower?: unknown }).lowPower;
		migratedLowPower = true;
	}
	if (typeof s.pauseWhenUnfocused !== "boolean") s.pauseWhenUnfocused = true;
	if (typeof s.lowPowerBackgroundColor !== "string" || !s.lowPowerBackgroundColor.trim()) {
		s.lowPowerBackgroundColor = LOW_POWER_BACKGROUND;
	}
	if (typeof s.backgroundOpacity !== "number") s.backgroundOpacity = 0.35;
	if (typeof s.backgroundBlur !== "number") s.backgroundBlur = 2;
	// Banner mode is purely additive: settings saved before it existed have none
	// of these keys, and defaulting them to the full-view wallpaper leaves every
	// existing board looking exactly as it did.
	if (s.backgroundLayout !== "banner") s.backgroundLayout = "full";
	s.bannerHeight = clampBannerHeight(s.bannerHeight);
	if (typeof s.bannerFade !== "boolean") s.bannerFade = true;
	if (typeof s.bannerFullWidth !== "boolean") s.bannerFullWidth = false;
	// Additive too: a vault saved before the content column could go unbounded
	// has no key here, and false leaves it drawing at exactly the width it did.
	if (typeof s.fullWidth !== "boolean") s.fullWidth = false;
	// Fit-to-page is the default for fresh installs; existing users keep their
	// choice (only backfill when the field is missing entirely).
	if (typeof raw.fitToPage !== "boolean") s.fitToPage = true;
	// Migrate pre-1.4.1 "none" defaults to "default" so existing users see the
	// bundled background unless they explicitly turned it off (kept as "none").
	// Only kick in when the field is missing (very old installs); otherwise
	// respect whatever the user chose.
	if (typeof raw.backgroundKind !== "string") s.backgroundKind = "default";
	if (!Array.isArray(s.pinnedCards)) s.pinnedCards = [];
	// Seed the default buttons only if the field was never persisted, so an
	// intentionally emptied list (all buttons removed) isn't reset on reload.
	if (!Array.isArray(raw.mobileActionButtons)) {
		s.mobileActionButtons = defaultMobileActionButtons();
	}
	// One-way migration (added 1.9.0): fold the legacy per-button `commandId`
	// into the unified `target` field so the deprecated fallback can be retired.
	// This does NOT round-trip — a user who upgrades and then downgrades below
	// 1.9.0 loses any button whose action was stored only as `commandId`. See
	// CHANGELOG.
	// Remove in 1.11.0 or later — two minor releases after 1.9.0, once the
	// migration has run for everyone — together with the `commandId` field on
	// MobileActionButton and the fallback read in actionTarget().
	let migratedCommandId = false;
	if (Array.isArray(s.mobileActionButtons)) {
		for (const btn of s.mobileActionButtons) {
			// Reading (and below, deleting) `commandId` intentionally trips
			// no-deprecated — the repo forbids silencing that rule, so the
			// warnings stay visible until the field is removed in 1.11.0. That is
			// expected: a migration must touch the field it is retiring.
			const legacy = btn.commandId;
			if (legacy === undefined) continue;
			// Only lift the value into `target` when `target` is unset: a button
			// that already carries a `target` (a newer version or a manual edit)
			// is authoritative, so its stale `commandId` is dropped without loss.
			// We do NOT check whether the command still resolves — at load time
			// other plugins' commands may not be registered yet, so a "missing"
			// command can simply be not-yet-loaded, and deleting the value would
			// be data loss. Preserving the string verbatim keeps exactly today's
			// fallback behaviour.
			if ((btn.target === undefined || btn.target === "") && legacy !== "") {
				btn.target = legacy;
			}
			// Guard (never lose the value): drop `commandId` only once `target`
			// actually holds the button's action — or the legacy value was empty,
			// so there is nothing to preserve. This also lets the migration fully
			// converge, so it stops re-firing (and re-saving) on later loads.
			if ((btn.target !== undefined && btn.target !== "") || legacy === "") {
				delete btn.commandId;
				migratedCommandId = true;
			}
		}
	}
	// The first-run wizard is for first runs. A vault that has any persisted
	// settings at all already has a dashboard — possibly one it has been using
	// for a year — so it is marked done rather than being offered a rebuild.
	// Mirrors how `lastSeenVersion` tells a fresh install from an upgrade: no
	// persisted keys whatsoever is the only signal that means "brand new".
	if (typeof raw.setupStatus !== "string") {
		s.setupStatus = Object.keys(raw).length === 0 ? "pending" : "done";
	} else if (s.setupStatus !== "pending" && s.setupStatus !== "done" && s.setupStatus !== "skipped") {
		// A hand-edited or partially-synced data.json; anything unrecognised is
		// treated as done, which is the outcome that never surprises anyone.
		s.setupStatus = "done";
	}
	// The short-lived "split" pill mode was replaced by a plain single button
	// whose action is chosen here; fall back to the original New-note behaviour.
	if ((s.newNoteButtonMode as string) === "split") s.newNoteButtonMode = "newNote";
	const migratedTitleIcon = migrateTitleIcon(s, raw);
	// Drop the obsolete single-board field so it can't shadow the dashboards.
	delete (s as unknown as { cards?: unknown }).cards;
	return migratedCommandId || migratedLowPower || migratedTitleIcon;
}

/** The pre-2.2 title mark: an emoji/text `logo` beside a Lucide `logoIcon` that
 * won whenever it held anything (#252). Both are read off persisted data, so
 * neither is typed as a string until it has been checked. */
interface LegacyTitleFields {
	logo?: unknown;
	logoIcon?: unknown;
}

function trimmedString(v: unknown): string | undefined {
	return typeof v === "string" ? v.trim() : undefined;
}

/**
 * The one value the legacy `logo`/`logoIcon` pair actually drew.
 *
 * `own` is the pair being folded and `inherited` the pair it fell back to field
 * by field — for a board that is the vault-wide pair, for the vault-wide pair
 * itself there is none. The precedence is the header's own, from before the
 * merge: a Lucide icon beat the logo text, and the text was drawn only when no
 * icon was set. Both sides are consulted independently, because a board that
 * overrode only one of the two inherited the other.
 */
export function legacyTitleIcon(
	own: LegacyTitleFields,
	inherited: LegacyTitleFields = {},
): string {
	const icon = trimmedString(own.logoIcon) ?? trimmedString(inherited.logoIcon) ?? "";
	if (icon) return icon;
	return trimmedString(own.logo) ?? trimmedString(inherited.logo) ?? "";
}

/**
 * One-way migration (added 2.2.0): fold `logo` + `logoIcon` into the single
 * `titleIcon`, vault-wide and on every board that overrode either (#252).
 *
 * The merged value is what the pair *drew*, not a preference for one field over
 * the other — a board keeps exactly the mark it had, even where that means its
 * own logo text was being hidden by a global Lucide icon all along. A board
 * whose merged value matches the vault-wide one loses the override entirely
 * rather than freezing a copy of it, so a later change to the global icon still
 * reaches it.
 *
 * This does NOT round-trip: downgrading below 2.2.0 after it has run shows the
 * Hearth crystal again until the logo fields are set anew. See CHANGELOG.
 */
function migrateTitleIcon(s: HomeSettings, raw: Record<string, unknown>): boolean {
	let migrated = false;
	const legacy = raw as LegacyTitleFields;
	// Keyed off `raw`: loadSettings has already merged DEFAULT_SETTINGS over the
	// persisted data, so `s.titleIcon` is always a string by now and testing it
	// would mean never seeing the legacy fields at all.
	if (typeof raw.titleIcon !== "string") s.titleIcon = legacyTitleIcon(legacy);
	for (const key of ["logo", "logoIcon"] as const) {
		if (key in (s as object)) {
			delete (s as Partial<HomeSettings> & LegacyTitleFields)[key];
			migrated = true;
		}
	}
	for (const dash of s.dashboards) {
		const header: (DashboardHeaderConfig & LegacyTitleFields) | undefined = dash.header;
		if (!header) continue;
		const hadLegacy = "logo" in header || "logoIcon" in header;
		if (hadLegacy && typeof header.titleIcon !== "string") {
			const folded = legacyTitleIcon(header, legacy);
			// An override that resolves to the vault-wide mark is not an override:
			// dropping it keeps the board following the global setting.
			if (folded !== s.titleIcon) header.titleIcon = folded;
		}
		if (!hadLegacy) continue;
		delete header.logo;
		delete header.logoIcon;
		migrated = true;
		// A header left with nothing in it would still read as "this board
		// overrides its header" everywhere that checks for the object.
		if (Object.keys(header).length === 0) delete dash.header;
	}
	return migrated;
}
