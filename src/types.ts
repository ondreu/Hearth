/** The kind of content a dashboard card renders. */
export type CardKind =
	| "embed"
	| "daily"
	| "web"
	| "bookmarks"
	| "favorites"
	| "text"
	| "recent"
	| "links"
	| "commands"
	| "clock"
	| "tasks"
	| "calendar"
	| "stats"
	| "search"
	| "heatmap"
	| "calculator"
	| "dataview"
	| "leaf";

/** A single command tile inside a "commands" card. */
export interface CommandItem {
	/** Obsidian command id, e.g. "editor:toggle-bold". */
	id: string;
	/** Display name (captured when the command was picked). */
	name: string;
	/** Optional Lucide icon id; falls back to a generic command icon. */
	icon?: string;
	/** Optional per-tile width in pixels, overriding the card's default. */
	sizeW?: number;
	/** Optional per-tile height in pixels, overriding the card's default. */
	sizeH?: number;
	/** Legacy single per-tile pixel size (drove width and height together).
	 * Migrated to sizeW/sizeH on first read; new code writes those instead. */
	size?: number;
	/** Free-form grid position (1-based grid line). See LinkItem.col. */
	col?: number;
	/** Free-form grid row (1-based). See LinkItem.row. */
	row?: number;
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
	/** A due-date constraint (see {@link TaskDueFilter}). */
	due?: TaskDueFilter;
	/** Case-insensitive substring the task text must contain. */
	text?: string;
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
	/** List layout: an active filter narrowing which tasks appear. Presets in the
	 * filter modal are conveniences that fill in these concrete criteria; the
	 * filter is "active" (and applied) when any field below is set. */
	taskFilter?: TaskFilterConfig;
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

/** Per-card configuration for a "calendar" card. */
export interface CalendarConfig {
	/** Show an ISO week-number column down the left edge. */
	showWeekNumbers?: boolean;
	/** Tint each day by note activity that day (a heatmap). */
	heatmap?: boolean;
	/** Which timestamp the heatmap counts. Default "modified". */
	heatmapMetric?: "modified" | "created";
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

/** Per-card configuration for a "heatmap" (activity) card. */
export interface HeatmapConfig {
	/** Which timestamp to count. Default "modified". */
	metric?: "modified" | "created";
	/** How many weeks back to show. Default 26. */
	weeks?: number;
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

/** Per-card configuration for a "leaf" card, which hosts another plugin's (or a
 * core) registered side-panel view inside the dashboard. Beta. */
export interface LeafViewConfig {
	/** The registered view type to host, e.g. "calendar", "outline",
	 * "tag-pane". This is the id a plugin passes to `registerView`. Empty means
	 * the card hasn't been pointed at a view yet and shows an empty state. */
	viewType?: string;
}

/** Per-card configuration for a "clock" card. All fields are optional; omitted
 * fields fall back to the defaults that match the original clock behaviour. */
export interface ClockConfig {
	/** Digital (default) or analogue clock face. */
	mode?: "digital" | "analog";
	/** Use 24-hour time instead of the locale default. */
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
	/** Edit the embedded note's text in place instead of read-only (Markdown only). */
	editable?: boolean;
}

/** A single tile inside a "links" (launchpad) card. */
export interface LinkItem {
	id: string;
	label: string;
	/** Lucide icon id. */
	icon: string;
	/** Vault path, URL, or command id depending on type. */
	target: string;
	type: "note" | "url" | "command";
	/** Optional per-tile width in pixels, overriding the card's default. */
	sizeW?: number;
	/** Optional per-tile height in pixels, overriding the card's default. */
	sizeH?: number;
	/** Legacy single per-tile pixel size (drove width and height together).
	 * Migrated to sizeW/sizeH on first read; new code writes those instead. */
	size?: number;
	/** Free-form grid position (1-based grid line). When omitted the tile
	 * auto-flows into the first available cell. Set explicitly when a tile is
	 * dragged to a spot so it stays there. */
	col?: number;
	/** Free-form grid row (1-based). See `col`. */
	row?: number;
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
	/** kind === "recent": how many recent files to show. */
	count?: number;
	/** kind === "clock": time/greeting/date display options. */
	clock?: ClockConfig;
	/** kind === "tasks": source, folder scope and display options. */
	tasks?: TasksConfig;
	/** kind === "calendar": week-number and heatmap display options. */
	calendar?: CalendarConfig;
	/** kind === "search": the saved query and result count. */
	savedSearch?: SavedSearchConfig;
	/** kind === "heatmap": metric and range. */
	heatmap?: HeatmapConfig;
	/** kind === "calculator": angle unit, last input and history. */
	calculator?: CalculatorConfig;
	/** kind === "dataview": the query text and language. */
	dataview?: DataviewConfig;
	/** kind === "leaf": the registered view type to host. */
	leafView?: LeafViewConfig;

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

	/** kind === "embed": an optional second view the card can switch to. When it
	 * carries a target, a switcher toggles the body between the primary embed
	 * (`target`/`scale`/`editable`) and this one — shown in the card header when
	 * the card has a title, or as a floating mouseover-only control otherwise. */
	secondView?: EmbedView;

	/** kind === "embed": hide the Bases view's own toolbar/header (the view
	 * switcher and filter/property controls) when embedding a `.base` file, so
	 * only the results show. No effect on non-base embeds. */
	hideBaseHeader?: boolean;

	/** kind === "commands": pixel size of the command tiles (min column width).
	 * Omitted means the default tile size. */
	tileSize?: number;

	/** kind === "links" / "commands" (beta): when true, tiles auto-shift out
	 * of the way (swap with a placeholder) as one is dragged, so the layout
	 * reorders live like phone widgets. Default off — tiles are pure
	 * free-form and may overlap. */
	tileAutoFlow?: boolean;

	/** kind === "daily": show a button that opens today's note in the editor.
	 * Defaults to shown; set false to hide. */
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
}

/** Background mode for the home view. "default" uses Hearth's bundled
 * background (a curated image shipped with a release); the other kinds use the
 * user's own value. */
export type BackgroundKind = "none" | "default" | "color" | "image" | "url";

/** A self-contained background configuration (used for per-dashboard overrides
 * as well as the global default). */
export interface BackgroundConfig {
	kind: BackgroundKind;
	value: string;
	opacity: number;
	blur: number;
}

/** A named dashboard: one arrangeable board of cards. The vault can hold several
 * and switch between them from the top-left switcher. */
export interface Dashboard {
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
	background?: BackgroundConfig;
	/** Override "fit to page" for this board (undefined = use global). */
	fitToPage?: boolean;
	/** Override the content max-width (px) for this board (undefined = global). */
	maxWidth?: number;
	/** Override the card surface opacity for this board (undefined = global). */
	cardOpacity?: number;
	/** Override the card surface backdrop blur (px) for this board (undefined =
	 * global). */
	cardBlur?: number;
	/** Show the dashboard search/command section (undefined = visible). */
	showSearch?: boolean;
}

export type ChromeVisibility = "always" | "hover";

export interface HomeSettings {
	// ---- Header ----
	title: string;
	showTitle: boolean;
	/** Emoji or short text shown as a logo next to the title. */
	logo: string;
	searchPlaceholder: string;
	showNewNoteButton: boolean;
	/** What the single button beside the search bar does: create a new note, or
	 * run a web search for the current search-field contents. */
	newNoteButtonMode: "newNote" | "searchOnline";
	/** Also search inside note bodies (full-text), not just names/tags/properties. */
	searchContents: boolean;
	/** Which engine powers the search bar: Hearth's built-in vault search, or the
	 * Omnisearch community plugin (only usable when Omnisearch is installed and
	 * enabled — Hearth falls back to the built-in engine otherwise). */
	searchEngine: "builtin" | "omnisearch";

	// ---- Background ----
	backgroundKind: BackgroundKind;
	/** A CSS color, a vault image path, or a URL depending on backgroundKind. */
	backgroundValue: string;
	backgroundOpacity: number;
	backgroundBlur: number;

	// ---- Behaviour ----
	openOnStartup: boolean;
	replaceNewTabs: boolean;
	/** On mobile, show only the search field and hide the dashboard. Has no
	 * effect on desktop, where the full dashboard is always shown. */
	mobileSearchOnly: boolean;
	/** In Mobile mode, show the customizable action button row under the
	 * search bar and filters instead of the "New note" button beside search. */
	showMobileActionBar: boolean;
	/** Buttons shown in the mobile action bar. */
	mobileActionButtons: MobileActionButton[];
	/** Block all outbound network requests Hearth would otherwise make. The only
	 * such request is the calculator's currency-rate fetch (the key-less,
	 * ECB-backed Frankfurter API); with this on, currency conversions report that
	 * rates are unavailable instead of reaching out. */
	disableExternalCalls: boolean;

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

	// ---- Layout ----
	maxWidth: number;

	// ---- Internal bookkeeping ----
	/** The plugin version whose release notes the user last saw. Used to decide
	 * when to pop the "What's new" dialog after an update. Empty on a fresh
	 * install (which is seeded silently, without showing the dialog). */
	lastSeenVersion: string;
}

export const DEFAULT_SETTINGS: HomeSettings = {
	title: "Obsidian",
	showTitle: true,
	// Empty => the Hearth crystal icon is shown as the brand mark.
	logo: "",
	searchPlaceholder: "Search or command",
	showNewNoteButton: true,
	newNoteButtonMode: "newNote",
	searchContents: true,
	searchEngine: "builtin",

	backgroundKind: "default",
	backgroundValue: "",
	/* Ambient: the background is visible but doesn't compete with content.
	 * Opacity is low enough that foreground reads clearly; blur is gentle so
	 * the image is still recognizable, not a wash of colour. */
	backgroundOpacity: 0.35,
	backgroundBlur: 2,

	openOnStartup: true,
	replaceNewTabs: true,
	mobileSearchOnly: false,
	showMobileActionBar: true,
	// Backfilled by migrateSettings so a fresh install gets the defaults below
	// and existing vaults aren't silently reset if the list is emptied.
	mobileActionButtons: [],
	disableExternalCalls: false,

	compact: false,
	arrangeButtonVisibility: "always",
	dashboardSwitcherVisibility: "always",
	cardOpacity: 0.5,
	// Frosted glass on by default: a translucent card surface with a gentle blur
	// of the background behind it. Pairs with the 0.5 opacity above.
	cardBlur: 7,

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

	maxWidth: 1600,

	lastSeenVersion: "",
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

/** Deep-clone a card with a fresh id, so the copy can be added to a dashboard
 * (or a different one) without colliding with the original. */
export function cloneCard(card: DashboardCard): DashboardCard {
	const copy: DashboardCard = {
		...card,
		id: `card-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
	};
	if (card.links) copy.links = card.links.map((l) => ({ ...l }));
	if (card.commands) copy.commands = card.commands.map((c) => ({ ...c }));
	if (card.secondView) copy.secondView = { ...card.secondView };
	if (card.tasks) copy.tasks = { ...card.tasks, folders: card.tasks.folders ? [...card.tasks.folders] : undefined, kanbanOrder: card.tasks.kanbanOrder ? [...card.tasks.kanbanOrder] : undefined, kanbanHidden: card.tasks.kanbanHidden ? [...card.tasks.kanbanHidden] : undefined, kanbanDoneColumns: card.tasks.kanbanDoneColumns ? [...card.tasks.kanbanDoneColumns] : undefined, kanbanColumnSort: card.tasks.kanbanColumnSort ? Object.fromEntries(Object.entries(card.tasks.kanbanColumnSort).map(([k, v]) => [k, { ...v }])) : undefined, sortRules: card.tasks.sortRules ? card.tasks.sortRules.map((r) => ({ ...r })) : undefined };
	if (card.calendar) copy.calendar = { ...card.calendar };
	if (card.savedSearch) copy.savedSearch = { ...card.savedSearch };
	if (card.heatmap) copy.heatmap = { ...card.heatmap };
	if (card.clock) copy.clock = { ...card.clock };
	if (card.calculator) copy.calculator = { ...card.calculator };
	if (card.dataview) copy.dataview = { ...card.dataview, columnWidths: card.dataview.columnWidths ? [...card.dataview.columnWidths] : undefined };
	return copy;
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

/** Whether the active board should show the search/command section. */
export function effectiveShowSearch(s: HomeSettings): boolean {
	return activeDashboard(s).showSearch ?? true;
}

/** Effective content max-width for the active board (per-dashboard override or global). */
export function effectiveMaxWidth(s: HomeSettings): number {
	return activeDashboard(s).maxWidth ?? s.maxWidth;
}

/** Effective card surface opacity for the active board (per-dashboard override
 * or global). 0 = fully transparent, 1 = fully opaque. */
export function effectiveCardOpacity(s: HomeSettings): number {
	const v = activeDashboard(s).cardOpacity ?? s.cardOpacity;
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** Resolve the per-card opacity override, falling back to the board/global
 * value from effectiveCardOpacity. */
export function resolveCardOpacity(s: HomeSettings, card: DashboardCard): number {
	const v = card.cardOpacity ?? effectiveCardOpacity(s);
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** Effective card backdrop blur (px) for the active board (per-dashboard
 * override or global). 0 = no frosted-glass blur. Clamped to a sane range. */
export function effectiveCardBlur(s: HomeSettings): number {
	const v = activeDashboard(s).cardBlur ?? s.cardBlur;
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(40, v)) : 0;
}

/** Resolve the per-card blur override (px), falling back to the board/global
 * value from effectiveCardBlur. */
export function resolveCardBlur(s: HomeSettings, card: DashboardCard): number {
	const v = card.cardBlur ?? effectiveCardBlur(s);
	return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(40, v)) : 0;
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

/** Effective background for the active board (per-dashboard override or global). */
export function effectiveBackground(s: HomeSettings): BackgroundConfig {
	return (
		activeDashboard(s).background ?? {
			kind: s.backgroundKind,
			value: s.backgroundValue,
			opacity: s.backgroundOpacity,
			blur: s.backgroundBlur,
		}
	);
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
 * must be flushed back to storage (currently only the `commandId` → `target`
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
	if (typeof s.cardBlur !== "number") s.cardBlur = 7;
	if (typeof s.backgroundOpacity !== "number") s.backgroundOpacity = 0.35;
	if (typeof s.backgroundBlur !== "number") s.backgroundBlur = 2;
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
	// The short-lived "split" pill mode was replaced by a plain single button
	// whose action is chosen here; fall back to the original New-note behaviour.
	if ((s.newNoteButtonMode as string) === "split") s.newNoteButtonMode = "newNote";
	// Drop the obsolete single-board field so it can't shadow the dashboards.
	delete (s as unknown as { cards?: unknown }).cards;
	return migratedCommandId;
}
