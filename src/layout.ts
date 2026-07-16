import {
	type BackgroundConfig,
	type BackgroundKind,
	type CalculatorConfig,
	type CalendarConfig,
	type CardKind,
	type ClockConfig,
	type CommandItem,
	type Dashboard,
	type DashboardCard,
	type DataviewConfig,
	type HeatmapConfig,
	type HomeSettings,
	type LeafViewConfig,
	type LinkItem,
	type MobileActionButton,
	newDashboardId,
	type RssConfig,
	type RssSource,
	type SavedSearchConfig,
	type TaskFilterConfig,
	type TaskSortRule,
	type TasksConfig,
	activeDashboard,
	CARD_BORDER_WIDTH_MAX,
} from "./types";
import { isEmbeddableBaseViewName } from "./bases";
import { t } from "./i18n";

/** Current dashboard-layout export schema version. v2 carries every dashboard
 * (with per-board overrides and backgrounds) plus pinned cards and globals;
 * v1 (a single `cards` array) is still imported for backward compatibility. */
export const LAYOUT_SCHEMA = 2;

/** Current full-settings export schema version. A settings export is a superset
 * of a layout export: it embeds the whole layout (so it imports cleanly through
 * `importLayout` too) plus every other configurable Hearth setting. */
export const SETTINGS_SCHEMA = 1;

/** The portable subset of settings that describes the whole dashboard setup. */
export interface LayoutExport {
	hearthLayout: number;
	dashboards: Dashboard[];
	activeDashboardId: string;
	pinnedCards: DashboardCard[];
	gridColumns: number;
	rowHeight: number;
	fitToPage: boolean;
	maxWidth: number;
	favorites: string[];
}

/** Value ranges enforced on import so a malformed/hostile layout can't set
 * values the settings UI could never produce. Mirror the sliders in settings. */
const RANGE = {
	gridColumns: { min: 4, max: 16 },
	rowHeight: { min: 32, max: 160 },
	maxWidth: { min: 700, max: 1600 },
	cardW: { min: 1, max: 16 },
	cardH: { min: 1, max: 60 },
	cardBlur: { min: 0, max: 24 },
	cardRadius: { min: 0, max: 14 },
	cardBorderWidth: { min: 0, max: CARD_BORDER_WIDTH_MAX },
	headerScale: { min: 0.6, max: 1.8 },
	headerMarginTop: { min: 0, max: 96 },
	headerSpacingBelow: { min: 0, max: 96 },
};

const CARD_KINDS: CardKind[] = [
	"embed",
	"daily",
	"web",
	"bookmarks",
	"favorites",
	"text",
	"recent",
	"links",
	"commands",
	"clock",
	"tasks",
	"calendar",
	"stats",
	"search",
	"heatmap",
	"calculator",
	"dataview",
	"rss",
	"leaf",
];

/** Build the portable layout payload (the dashboard setup and its globals). */
function layoutPayload(s: HomeSettings): LayoutExport {
	return {
		hearthLayout: LAYOUT_SCHEMA,
		dashboards: s.dashboards,
		activeDashboardId: s.activeDashboardId,
		pinnedCards: s.pinnedCards,
		gridColumns: s.gridColumns,
		rowHeight: s.rowHeight,
		fitToPage: s.fitToPage,
		maxWidth: s.maxWidth,
		favorites: s.favorites,
	};
}

/** Serialize the whole dashboard setup to a pretty JSON string. */
export function exportLayout(s: HomeSettings): string {
	return JSON.stringify(layoutPayload(s), null, 2);
}

/** Serialize every configurable Hearth setting — the full layout plus header,
 * background, behaviour, appearance, filters and TaskNotes field mappings — to a
 * pretty JSON string. Internal bookkeeping (e.g. `lastSeenVersion`) is omitted
 * so a shared backup can't rewind another vault's "What's new" state. */
export function exportSettings(s: HomeSettings): string {
	const data = {
		hearthSettings: SETTINGS_SCHEMA,
		...layoutPayload(s),

		// Header
		title: s.title,
		showTitle: s.showTitle,
		logo: s.logo,
		searchPlaceholder: s.searchPlaceholder,
		showNewNoteButton: s.showNewNoteButton,
		newNoteButtonMode: s.newNoteButtonMode,
		searchContents: s.searchContents,
		searchEngine: s.searchEngine,

		// Background
		backgroundKind: s.backgroundKind,
		backgroundValue: s.backgroundValue,
		backgroundOpacity: s.backgroundOpacity,
		backgroundBlur: s.backgroundBlur,

		// Behaviour
		openOnStartup: s.openOnStartup,
		replaceNewTabs: s.replaceNewTabs,
		mobileSearchOnly: s.mobileSearchOnly,
		showMobileActionBar: s.showMobileActionBar,
		mobileActionButtons: s.mobileActionButtons,
		disableExternalCalls: s.disableExternalCalls,

		// Appearance
		compact: s.compact,
		cardOpacity: s.cardOpacity,
		cardBlur: s.cardBlur,
		cardRadius: s.cardRadius,
		cardBorderWidth: s.cardBorderWidth,

		// Search filters
		hiddenFilters: s.hiddenFilters,

		// Tasks / TaskNotes field mappings
		taskNotesStatusField: s.taskNotesStatusField,
		taskNotesDueField: s.taskNotesDueField,
		taskNotesPriorityField: s.taskNotesPriorityField,
		taskNotesDoneValue: s.taskNotesDoneValue,
	};
	return JSON.stringify(data, null, 2);
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNum(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	return Math.max(min, Math.min(max, Math.round(num(value, fallback))));
}

function clampFloat(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	return Math.max(min, Math.min(max, num(value, fallback)));
}

function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function sanitizeBaseViewName(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const name = raw.trim();
	return isEmbeddableBaseViewName(name) ? name : undefined;
}

function sanitizeEmbedView(
	raw: unknown,
): DashboardCard["secondView"] | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const target = str(r.target);
	if (target === undefined) return undefined;
	const view: NonNullable<DashboardCard["secondView"]> = { target };
	const baseView = sanitizeBaseViewName(r.baseView);
	if (baseView !== undefined) view.baseView = baseView;
	if (typeof r.scale === "number") view.scale = r.scale;
	if (typeof r.editable === "boolean") view.editable = r.editable;
	return view;
}

function sanitizeLink(raw: unknown): LinkItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const type = r.type === "url" || r.type === "command" ? r.type : "note";
	const link: LinkItem = {
		id: str(r.id) ?? `link-${Math.random().toString(36).slice(2)}`,
		label: str(r.label) ?? "",
		icon: str(r.icon) ?? "link",
		target: str(r.target) ?? "",
		type,
	};
	if (typeof r.size === "number") link.size = r.size;
	if (typeof r.sizeW === "number") link.sizeW = r.sizeW;
	if (typeof r.sizeH === "number") link.sizeH = r.sizeH;
	if (typeof r.col === "number" && r.col >= 0) link.col = r.col;
	if (typeof r.row === "number" && r.row >= 0) link.row = r.row;
	return link;
}

function sanitizeCard(raw: unknown, index: number): DashboardCard | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const kind = CARD_KINDS.includes(r.kind as CardKind)
		? (r.kind as CardKind)
		: null;
	if (!kind) return null;

	const card: DashboardCard = {
		id: str(r.id) ?? `card-${Date.now().toString(36)}-${index}`,
		kind,
		x: num(r.x, -1),
		y: num(r.y, -1),
		w: clampNum(r.w, RANGE.cardW.min, RANGE.cardW.max, 4),
		h: clampNum(r.h, RANGE.cardH.min, RANGE.cardH.max, 2),
	};

	// Preserve the live free-form geometry so an exported layout round-trips
	// faithfully between devices. Without this the coordinates the board actually
	// renders with (fx/fy/fw/fh) were dropped on import and re-derived from the
	// legacy x/y/w/h grid units — which go stale the moment a card is dragged —
	// so a shared/synced layout reverted to its pre-arrange positions.
	// fx/fw are board-width fractions (0..1); fy/fh are absolute pixels (>= 0).
	if (typeof r.fx === "number" && Number.isFinite(r.fx)) {
		card.fx = Math.max(0, Math.min(1, r.fx));
	}
	if (typeof r.fw === "number" && Number.isFinite(r.fw)) {
		card.fw = Math.max(0.02, Math.min(1, r.fw));
	}
	if (typeof r.fy === "number" && Number.isFinite(r.fy)) {
		card.fy = Math.max(0, r.fy);
	}
	if (typeof r.fh === "number" && Number.isFinite(r.fh)) {
		card.fh = Math.max(0, r.fh);
	}

	const title = str(r.title);
	if (title !== undefined) card.title = title;
	const target = str(r.target);
	if (target !== undefined) card.target = target;
	const baseView = sanitizeBaseViewName(r.baseView);
	if (baseView !== undefined) card.baseView = baseView;
	const secondView = sanitizeEmbedView(r.secondView);
	if (secondView) card.secondView = secondView;
	const url = str(r.url);
	if (url !== undefined) card.url = url;
	const text = str(r.text);
	if (text !== undefined) card.text = text;
	const accent = str(r.accent);
	if (accent !== undefined) card.accent = accent;
	const background = str(r.background);
	if (background !== undefined) card.background = background;
	if (typeof r.count === "number") card.count = r.count;
	if (typeof r.scale === "number") card.scale = r.scale;
	if (typeof r.refreshSec === "number") card.refreshSec = r.refreshSec;
	if (typeof r.editable === "boolean") card.editable = r.editable;
	if (typeof r.hideBaseHeader === "boolean")
		card.hideBaseHeader = r.hideBaseHeader;
	if (typeof r.tileSize === "number") card.tileSize = r.tileSize;
	if (typeof r.tileAutoFlow === "boolean") card.tileAutoFlow = r.tileAutoFlow;
	if (typeof r.showOpenButton === "boolean")
		card.showOpenButton = r.showOpenButton;
	if (typeof r.hideBaseHeader === "boolean")
		card.hideBaseHeader = r.hideBaseHeader;
	if (typeof r.sandboxTrusted === "boolean")
		card.sandboxTrusted = r.sandboxTrusted;
	if (typeof r.pinned === "boolean") card.pinned = r.pinned;
	if (typeof r.cardOpacity === "number") card.cardOpacity = r.cardOpacity;
	if (typeof r.cardBlur === "number") card.cardBlur = r.cardBlur;
	if (Array.isArray(r.links)) {
		card.links = r.links
			.map(sanitizeLink)
			.filter((l): l is LinkItem => l !== null);
	}
	if (Array.isArray(r.commands)) {
		card.commands = r.commands
			.map(sanitizeCommand)
			.filter((c): c is CommandItem => c !== null);
	}
	if (r.clock && typeof r.clock === "object") {
		card.clock = sanitizeClock(r.clock as Record<string, unknown>);
	}
	if (r.tasks && typeof r.tasks === "object") {
		card.tasks = sanitizeTasks(r.tasks as Record<string, unknown>);
	}
	if (r.calendar && typeof r.calendar === "object") {
		card.calendar = sanitizeCalendar(r.calendar as Record<string, unknown>);
	}
	if (r.savedSearch && typeof r.savedSearch === "object") {
		card.savedSearch = sanitizeSavedSearch(
			r.savedSearch as Record<string, unknown>,
		);
	}
	if (r.heatmap && typeof r.heatmap === "object") {
		card.heatmap = sanitizeHeatmap(r.heatmap as Record<string, unknown>);
	}
	if (r.calculator && typeof r.calculator === "object") {
		card.calculator = sanitizeCalculator(
			r.calculator as Record<string, unknown>,
		);
	}
	if (r.rss && typeof r.rss === "object") {
		card.rss = sanitizeRss(r.rss as Record<string, unknown>);
	}
	if (r.dataview && typeof r.dataview === "object") {
		card.dataview = sanitizeDataview(r.dataview as Record<string, unknown>);
	}
	if (r.leafView && typeof r.leafView === "object") {
		card.leafView = sanitizeLeafView(r.leafView as Record<string, unknown>);
	}
	if (r.secondView && typeof r.secondView === "object") {
		card.secondView = sanitizeEmbedView(r.secondView);
	}

	return card;
}

function sanitizeCommand(raw: unknown): CommandItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id);
	if (!id) return null;
	const cmd: CommandItem = { id, name: str(r.name) ?? id, icon: str(r.icon) };
	if (typeof r.size === "number") cmd.size = r.size;
	if (typeof r.sizeW === "number") cmd.sizeW = r.sizeW;
	if (typeof r.sizeH === "number") cmd.sizeH = r.sizeH;
	if (typeof r.col === "number" && r.col >= 0) cmd.col = r.col;
	if (typeof r.row === "number" && r.row >= 0) cmd.row = r.row;
	return cmd;
}

function sanitizeClock(r: Record<string, unknown>): ClockConfig {
	const clock: ClockConfig = {};
	if (r.mode === "digital" || r.mode === "analog") clock.mode = r.mode;
	if (typeof r.use24Hour === "boolean") clock.use24Hour = r.use24Hour;
	if (typeof r.showSeconds === "boolean") clock.showSeconds = r.showSeconds;
	if (typeof r.showGreeting === "boolean") clock.showGreeting = r.showGreeting;
	if (typeof r.playfulGreetings === "boolean")
		clock.playfulGreetings = r.playfulGreetings;
	const greeting = str(r.greetingText);
	if (greeting !== undefined) clock.greetingText = greeting;
	const dateFormat = str(r.dateFormat);
	if (dateFormat !== undefined) clock.dateFormat = dateFormat;
	const modes = ["full", "long", "short", "iso", "weekday", "custom", "none"];
	if (typeof r.dateMode === "string" && modes.includes(r.dateMode)) {
		clock.dateMode = r.dateMode as NonNullable<ClockConfig["dateMode"]>;
	}
	return clock;
}

/** Keep only the strings from an unknown array (dropping non-strings). */
function strArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.filter((v): v is string => typeof v === "string");
}

const TASK_SORT_KEYS = [
	"smart",
	"due",
	"priority",
	"created",
	"alpha",
] as const;
const TASK_SORT_FIELDS = [
	"due",
	"scheduled",
	"priority",
	"created",
	"alpha",
	"status",
] as const;
const TASK_PRIORITY_LEVELS = ["high", "medium", "low", "none"] as const;
const TASK_DUE_FILTERS = [
	"overdue",
	"today",
	"week",
	"hasDate",
	"noDate",
] as const;

function sanitizeCheckboxStatuses(
	value: unknown,
): NonNullable<TasksConfig["checkboxStatuses"]> | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = value
		.map((raw): { symbol: string; label: string; done?: boolean } | null => {
			if (!raw || typeof raw !== "object") return null;
			const r = raw as Record<string, unknown>;
			const symbol = str(r.symbol);
			const label = str(r.label);
			if (symbol === undefined || label === undefined) return null;
			const st: { symbol: string; label: string; done?: boolean } = {
				symbol,
				label,
			};
			if (typeof r.done === "boolean") st.done = r.done;
			return st;
		})
		.filter(
			(s): s is { symbol: string; label: string; done?: boolean } => s !== null,
		);
	return out;
}

function sanitizeSortRules(value: unknown): TaskSortRule[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value
		.map((raw): TaskSortRule | null => {
			if (!raw || typeof raw !== "object") return null;
			const r = raw as Record<string, unknown>;
			if (
				!TASK_SORT_FIELDS.includes(r.field as (typeof TASK_SORT_FIELDS)[number])
			)
				return null;
			const rule: TaskSortRule = { field: r.field as TaskSortRule["field"] };
			if (typeof r.reverse === "boolean") rule.reverse = r.reverse;
			return rule;
		})
		.filter((rule): rule is TaskSortRule => rule !== null);
}

function sanitizeKanbanColumnSort(
	value: unknown,
): NonNullable<TasksConfig["kanbanColumnSort"]> | undefined {
	if (!value || typeof value !== "object") return undefined;
	const out: NonNullable<TasksConfig["kanbanColumnSort"]> = {};
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (!raw || typeof raw !== "object") continue;
		const r = raw as Record<string, unknown>;
		const entry: { key?: (typeof TASK_SORT_KEYS)[number]; reverse?: boolean } =
			{};
		if (TASK_SORT_KEYS.includes(r.key as (typeof TASK_SORT_KEYS)[number])) {
			entry.key = r.key as (typeof TASK_SORT_KEYS)[number];
		}
		if (typeof r.reverse === "boolean") entry.reverse = r.reverse;
		out[key] = entry;
	}
	return out;
}

function sanitizeTaskFilter(value: unknown): TaskFilterConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const r = value as Record<string, unknown>;
	const cfg: TaskFilterConfig = {};
	const statuses = strArray(r.statuses);
	if (statuses) cfg.statuses = statuses;
	if (Array.isArray(r.priorities)) {
		cfg.priorities = r.priorities.filter(
			(p): p is (typeof TASK_PRIORITY_LEVELS)[number] =>
				TASK_PRIORITY_LEVELS.includes(
					p as (typeof TASK_PRIORITY_LEVELS)[number],
				),
		);
	}
	if (TASK_DUE_FILTERS.includes(r.due as (typeof TASK_DUE_FILTERS)[number])) {
		cfg.due = r.due as TaskFilterConfig["due"];
	}
	const text = str(r.text);
	if (text !== undefined) cfg.text = text;
	return cfg;
}

function sanitizeTasks(r: Record<string, unknown>): TasksConfig {
	const cfg: TasksConfig = {};
	if (
		r.source === "checkbox" ||
		r.source === "tasknotes" ||
		r.source === "kanban"
	) {
		cfg.source = r.source;
	}
	const kanbanFile = str(r.kanbanFile);
	if (kanbanFile !== undefined) cfg.kanbanFile = kanbanFile;
	if (typeof r.kanbanExtended === "boolean")
		cfg.kanbanExtended = r.kanbanExtended;
	if (typeof r.checkboxExtended === "boolean")
		cfg.checkboxExtended = r.checkboxExtended;
	if (typeof r.taskQuickView === "boolean") cfg.taskQuickView = r.taskQuickView;
	const convertNoteTemplate = str(r.convertNoteTemplate);
	if (convertNoteTemplate !== undefined)
		cfg.convertNoteTemplate = convertNoteTemplate;
	if (typeof r.convertMetadataToFrontmatter === "boolean") {
		cfg.convertMetadataToFrontmatter = r.convertMetadataToFrontmatter;
	}
	if (typeof r.newTaskAsNote === "boolean") cfg.newTaskAsNote = r.newTaskAsNote;
	const checkboxStatuses = sanitizeCheckboxStatuses(r.checkboxStatuses);
	if (checkboxStatuses) cfg.checkboxStatuses = checkboxStatuses;
	if (TASK_SORT_KEYS.includes(r.sortKey as (typeof TASK_SORT_KEYS)[number])) {
		cfg.sortKey = r.sortKey as TasksConfig["sortKey"];
	}
	if (typeof r.sortReverse === "boolean") cfg.sortReverse = r.sortReverse;
	const sortRules = sanitizeSortRules(r.sortRules);
	if (sortRules) cfg.sortRules = sortRules;
	const kanbanColumnSort = sanitizeKanbanColumnSort(r.kanbanColumnSort);
	if (kanbanColumnSort) cfg.kanbanColumnSort = kanbanColumnSort;
	if (
		r.folderScope === "all" ||
		r.folderScope === "whitelist" ||
		r.folderScope === "blacklist"
	) {
		cfg.folderScope = r.folderScope;
	}
	const folders = strArray(r.folders);
	if (folders) cfg.folders = folders;
	const taskNotesDoneStatuses = strArray(r.taskNotesDoneStatuses);
	if (taskNotesDoneStatuses) cfg.taskNotesDoneStatuses = taskNotesDoneStatuses;
	const taskFilter = sanitizeTaskFilter(r.taskFilter);
	if (taskFilter) cfg.taskFilter = taskFilter;
	if (typeof r.showCompleted === "boolean") cfg.showCompleted = r.showCompleted;
	if (typeof r.count === "number") cfg.count = r.count;
	if (r.layout === "list" || r.layout === "kanban") cfg.layout = r.layout;
	const kanbanOrder = strArray(r.kanbanOrder);
	if (kanbanOrder) cfg.kanbanOrder = kanbanOrder;
	const kanbanHidden = strArray(r.kanbanHidden);
	if (kanbanHidden) cfg.kanbanHidden = kanbanHidden;
	const kanbanDoneColumns = strArray(r.kanbanDoneColumns);
	if (kanbanDoneColumns) cfg.kanbanDoneColumns = kanbanDoneColumns;
	return cfg;
}

function sanitizeCalendar(r: Record<string, unknown>): CalendarConfig {
	const cfg: CalendarConfig = {};
	if (typeof r.showWeekNumbers === "boolean")
		cfg.showWeekNumbers = r.showWeekNumbers;
	if (typeof r.heatmap === "boolean") cfg.heatmap = r.heatmap;
	if (r.heatmapMetric === "modified" || r.heatmapMetric === "created") {
		cfg.heatmapMetric = r.heatmapMetric;
	}
	return cfg;
}

function sanitizeSavedSearch(r: Record<string, unknown>): SavedSearchConfig {
	const cfg: SavedSearchConfig = {};
	const query = str(r.query);
	if (query !== undefined) cfg.query = query;
	if (typeof r.count === "number") cfg.count = r.count;
	if (r.view === "list" || r.view === "tiles") cfg.view = r.view;
	return cfg;
}

function sanitizeHeatmap(r: Record<string, unknown>): HeatmapConfig {
	const cfg: HeatmapConfig = {};
	if (r.metric === "modified" || r.metric === "created") cfg.metric = r.metric;
	if (typeof r.weeks === "number") cfg.weeks = r.weeks;
	return cfg;
}

function sanitizeCalculator(r: Record<string, unknown>): CalculatorConfig {
	const cfg: CalculatorConfig = {};
	if (r.angleUnit === "deg" || r.angleUnit === "rad")
		cfg.angleUnit = r.angleUnit;
	if (r.keypad === "basic" || r.keypad === "scientific" || r.keypad === "none")
		cfg.keypad = r.keypad;
	const lastInput = str(r.lastInput);
	if (lastInput !== undefined) cfg.lastInput = lastInput;
	return cfg;
}

function sanitizeRssSource(raw: unknown): RssSource | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const url = str(r.url);
	if (url === undefined) return null;
	return {
		id: str(r.id) ?? `rss-${Math.random().toString(36).slice(2)}`,
		name: str(r.name) ?? "",
		url,
	};
}

function sanitizeRss(r: Record<string, unknown>): RssConfig {
	const cfg: RssConfig = {};
	if (Array.isArray(r.sources)) {
		cfg.sources = r.sources
			.map(sanitizeRssSource)
			.filter((s): s is RssSource => s !== null);
	}
	if (r.layout === "list" || r.layout === "cards" || r.layout === "compact") {
		cfg.layout = r.layout;
	}
	if (typeof r.refreshMin === "number" && r.refreshMin >= 0) {
		cfg.refreshMin = r.refreshMin;
	}
	if (typeof r.itemLimit === "number" && r.itemLimit > 0) {
		cfg.itemLimit = r.itemLimit;
	}
	if (typeof r.showImages === "boolean") cfg.showImages = r.showImages;
	if (typeof r.showExcerpt === "boolean") cfg.showExcerpt = r.showExcerpt;
	if (typeof r.showDate === "boolean") cfg.showDate = r.showDate;
	if (typeof r.mergeAll === "boolean") cfg.mergeAll = r.mergeAll;
	return cfg;
}

function sanitizeDataview(r: Record<string, unknown>): DataviewConfig {
	const cfg: DataviewConfig = {};
	const query = str(r.query);
	if (query !== undefined) cfg.query = query;
	if (r.language === "dql" || r.language === "js") cfg.language = r.language;
	if (Array.isArray(r.columnWidths)) {
		cfg.columnWidths = r.columnWidths.filter(
			(w): w is number => typeof w === "number" && Number.isFinite(w),
		);
	}
	return cfg;
}

function sanitizeLeafView(r: Record<string, unknown>): LeafViewConfig {
	const cfg: LeafViewConfig = {};
	const viewType = str(r.viewType);
	if (viewType !== undefined) cfg.viewType = viewType;
	return cfg;
}

function sanitizeBackground(raw: unknown): BackgroundConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const kinds: BackgroundKind[] = ["none", "color", "image", "url"];
	if (!kinds.includes(r.kind as BackgroundKind)) return undefined;
	return {
		kind: r.kind as BackgroundKind,
		value: str(r.value) ?? "",
		opacity: Math.max(0, Math.min(1, num(r.opacity, 0.15))),
		blur: Math.max(0, Math.min(40, num(r.blur, 0))),
	};
}

function sanitizeDashboard(
	raw: unknown,
	s: HomeSettings,
	index: number,
): Dashboard | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const cards = Array.isArray(r.cards)
		? r.cards
				.map((c, i) => sanitizeCard(c, i))
				.filter((c): c is DashboardCard => c !== null)
		: [];
	const dash: Dashboard = {
		id: str(r.id) ?? newDashboardId(),
		name: str(r.name) ?? `Dashboard ${index + 1}`,
		cards,
	};
	const icon = str(r.icon);
	if (icon !== undefined && icon.trim()) dash.icon = icon;
	const iconLucide = str(r.iconLucide);
	if (iconLucide !== undefined && iconLucide.trim())
		dash.iconLucide = iconLucide;
	if (typeof r.gridColumns === "number") {
		dash.gridColumns = clampNum(
			r.gridColumns,
			RANGE.gridColumns.min,
			RANGE.gridColumns.max,
			s.gridColumns,
		);
	}
	if (typeof r.rowHeight === "number") {
		dash.rowHeight = clampNum(
			r.rowHeight,
			RANGE.rowHeight.min,
			RANGE.rowHeight.max,
			s.rowHeight,
		);
	}
	if (typeof r.fitToPage === "boolean") dash.fitToPage = r.fitToPage;
	if (typeof r.showSearch === "boolean") dash.showSearch = r.showSearch;
	const rawHeader = r.header;
	if (rawHeader && typeof rawHeader === "object") {
		const h = rawHeader as Record<string, unknown>;
		const header: NonNullable<Dashboard["header"]> = {};
		if (typeof h.showTitle === "boolean") header.showTitle = h.showTitle;
		const title = str(h.title);
		if (title !== undefined) header.title = title;
		const logo = str(h.logo);
		if (logo !== undefined) header.logo = logo;
		if (h.align === "left" || h.align === "center" || h.align === "right") {
			header.align = h.align;
		}
		if (typeof h.titleScale === "number") {
			header.titleScale = clampFloat(
				h.titleScale,
				RANGE.headerScale.min,
				RANGE.headerScale.max,
				1,
			);
		}
		if (typeof h.logoScale === "number") {
			header.logoScale = clampFloat(
				h.logoScale,
				RANGE.headerScale.min,
				RANGE.headerScale.max,
				1,
			);
		}
		if (typeof h.marginTop === "number") {
			header.marginTop = clampNum(
				h.marginTop,
				RANGE.headerMarginTop.min,
				RANGE.headerMarginTop.max,
				0,
			);
		}
		if (typeof h.spacingBelow === "number") {
			header.spacingBelow = clampNum(
				h.spacingBelow,
				RANGE.headerSpacingBelow.min,
				RANGE.headerSpacingBelow.max,
				0,
			);
		}
		if (Object.keys(header).length > 0) dash.header = header;
	}
	if (typeof r.maxWidth === "number") {
		dash.maxWidth = clampNum(
			r.maxWidth,
			RANGE.maxWidth.min,
			RANGE.maxWidth.max,
			s.maxWidth,
		);
	}
	if (typeof r.cardOpacity === "number") {
		dash.cardOpacity = Math.max(0, Math.min(1, r.cardOpacity));
	}
	if (typeof r.cardBlur === "number") {
		dash.cardBlur = clampNum(
			r.cardBlur,
			RANGE.cardBlur.min,
			RANGE.cardBlur.max,
			s.cardBlur,
		);
	}
	if (typeof r.cardRadius === "number") {
		dash.cardRadius = clampNum(
			r.cardRadius,
			RANGE.cardRadius.min,
			RANGE.cardRadius.max,
			s.cardRadius,
		);
	}
	if (typeof r.cardBorderWidth === "number") {
		dash.cardBorderWidth = clampNum(
			r.cardBorderWidth,
			RANGE.cardBorderWidth.min,
			RANGE.cardBorderWidth.max,
			s.cardBorderWidth,
		);
	}
	const bg = sanitizeBackground(r.background);
	if (bg) dash.background = bg;
	return dash;
}

/**
 * Parse and sanitize an exported layout, applying it onto the given settings.
 * Returns an error message on failure, or null on success. Supports both the
 * v2 multi-dashboard format and the legacy v1 single-`cards` format.
 */
export function importLayout(s: HomeSettings, json: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return t().layout.invalidJson;
	}
	if (!parsed || typeof parsed !== "object") {
		return t().layout.notAnObject;
	}
	return applyLayout(s, parsed as Record<string, unknown>);
}

/** Apply the dashboard/layout portion of a parsed export onto `s`. Returns an
 * error message on failure, or null on success. Supports the v2 multi-dashboard
 * format and the legacy v1 single-`cards` format. */
function applyLayout(
	s: HomeSettings,
	data: Record<string, unknown>,
): string | null {
	// v2: a full multi-dashboard layout.
	if (Array.isArray(data.dashboards)) {
		const dashboards = data.dashboards
			.map((d, i) => sanitizeDashboard(d, s, i))
			.filter((d): d is Dashboard => d !== null);
		if (dashboards.length === 0) return t().layout.noValidDashboards;
		s.dashboards = dashboards;
		if (Array.isArray(data.pinnedCards)) {
			s.pinnedCards = data.pinnedCards
				.map((c, i) => sanitizeCard(c, i))
				.filter((c): c is DashboardCard => c !== null);
		}
		const activeId = str(data.activeDashboardId);
		s.activeDashboardId =
			activeId && dashboards.some((d) => d.id === activeId)
				? activeId
				: dashboards[0].id;
		applyGlobals(s, data);
		return null;
	}

	// v1 (legacy): a single active-board `cards` array.
	if (Array.isArray(data.cards)) {
		const cards = data.cards
			.map((c, i) => sanitizeCard(c, i))
			.filter((c): c is DashboardCard => c !== null);
		if (cards.length === 0) return t().layout.noValidCards;
		activeDashboard(s).cards = cards;
		applyGlobals(s, data);
		return null;
	}

	return t().layout.notAHearthLayout;
}

/**
 * Parse and apply a full settings export produced by {@link exportSettings}.
 * Returns an error message on failure, or null on success. A settings export
 * embeds the whole layout, so the dashboard portion is applied through the same
 * sanitizers as {@link importLayout}; every other setting is validated field by
 * field so a malformed/hostile backup can never write values the UI couldn't.
 */
export function importSettings(s: HomeSettings, json: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return t().layout.invalidJson;
	}
	if (!parsed || typeof parsed !== "object") {
		return t().layout.notAnObject;
	}
	const data = parsed as Record<string, unknown>;

	const hasLayout = Array.isArray(data.dashboards) || Array.isArray(data.cards);
	if (!hasLayout && typeof data.hearthSettings !== "number") {
		return t().layout.notHearthSettings;
	}

	// Apply the embedded layout first so any malformed dashboards abort before we
	// touch the rest of the settings, keeping the import all-or-nothing.
	if (hasLayout) {
		const err = applyLayout(s, data);
		if (err) return err;
	}
	applySettings(s, data);
	return null;
}

/** Apply the global (non-per-board) settings carried by a layout, clamped. */
function applyGlobals(s: HomeSettings, data: Record<string, unknown>): void {
	s.gridColumns = clampNum(
		data.gridColumns,
		RANGE.gridColumns.min,
		RANGE.gridColumns.max,
		s.gridColumns,
	);
	if (typeof data.rowHeight === "number") {
		s.rowHeight = clampNum(
			data.rowHeight,
			RANGE.rowHeight.min,
			RANGE.rowHeight.max,
			s.rowHeight,
		);
	}
	s.maxWidth = clampNum(
		data.maxWidth,
		RANGE.maxWidth.min,
		RANGE.maxWidth.max,
		s.maxWidth,
	);
	if (typeof data.fitToPage === "boolean") s.fitToPage = data.fitToPage;
	if (Array.isArray(data.favorites)) {
		s.favorites = data.favorites.filter(
			(p): p is string => typeof p === "string",
		);
	}
}

function sanitizeMobileActionButton(raw: unknown): MobileActionButton | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id);
	if (!id) return null;
	const btn: MobileActionButton = {
		id,
		label: str(r.label) ?? "",
		icon: str(r.icon) ?? "",
	};
	if (r.type === "command" || r.type === "note" || r.type === "url")
		btn.type = r.type;
	const target = str(r.target);
	if (target !== undefined) btn.target = target;
	// Fold a legacy `commandId` (from a pre-1.9.0 backup) into `target` rather
	// than re-persisting the deprecated field, using the same rule as
	// migrateSettings so an imported backup never reintroduces `commandId`.
	const commandId = str(r.commandId);
	if (
		(btn.target === undefined || btn.target === "") &&
		commandId !== undefined &&
		commandId !== ""
	) {
		btn.target = commandId;
	}
	return btn;
}

/** Apply the non-layout settings carried by a full settings export, each field
 * validated/clamped so an untrusted backup can only set values the UI could. */
function applySettings(s: HomeSettings, data: Record<string, unknown>): void {
	// Header
	const title = str(data.title);
	if (title !== undefined) s.title = title;
	if (typeof data.showTitle === "boolean") s.showTitle = data.showTitle;
	const logo = str(data.logo);
	if (logo !== undefined) s.logo = logo;
	const searchPlaceholder = str(data.searchPlaceholder);
	if (searchPlaceholder !== undefined) s.searchPlaceholder = searchPlaceholder;
	if (typeof data.showNewNoteButton === "boolean")
		s.showNewNoteButton = data.showNewNoteButton;
	if (
		data.newNoteButtonMode === "newNote" ||
		data.newNoteButtonMode === "searchOnline"
	) {
		s.newNoteButtonMode = data.newNoteButtonMode;
	}
	if (typeof data.searchContents === "boolean")
		s.searchContents = data.searchContents;
	if (data.searchEngine === "builtin" || data.searchEngine === "omnisearch") {
		s.searchEngine = data.searchEngine;
	}

	// Background
	const bgKinds: BackgroundKind[] = [
		"none",
		"default",
		"color",
		"image",
		"url",
	];
	if (bgKinds.includes(data.backgroundKind as BackgroundKind)) {
		s.backgroundKind = data.backgroundKind as BackgroundKind;
	}
	const backgroundValue = str(data.backgroundValue);
	if (backgroundValue !== undefined) s.backgroundValue = backgroundValue;
	if (typeof data.backgroundOpacity === "number") {
		s.backgroundOpacity = Math.max(0, Math.min(1, data.backgroundOpacity));
	}
	if (typeof data.backgroundBlur === "number") {
		s.backgroundBlur = Math.max(0, Math.min(40, data.backgroundBlur));
	}

	// Behaviour
	if (typeof data.openOnStartup === "boolean")
		s.openOnStartup = data.openOnStartup;
	if (typeof data.replaceNewTabs === "boolean")
		s.replaceNewTabs = data.replaceNewTabs;
	if (typeof data.mobileSearchOnly === "boolean")
		s.mobileSearchOnly = data.mobileSearchOnly;
	if (typeof data.showMobileActionBar === "boolean")
		s.showMobileActionBar = data.showMobileActionBar;
	if (Array.isArray(data.mobileActionButtons)) {
		s.mobileActionButtons = data.mobileActionButtons
			.map(sanitizeMobileActionButton)
			.filter((b): b is MobileActionButton => b !== null);
	}
	if (typeof data.disableExternalCalls === "boolean")
		s.disableExternalCalls = data.disableExternalCalls;

	// Appearance
	if (typeof data.compact === "boolean") s.compact = data.compact;
	if (typeof data.cardOpacity === "number") {
		s.cardOpacity = Math.max(0, Math.min(1, data.cardOpacity));
	}
	if (typeof data.cardBlur === "number") {
		s.cardBlur = clampNum(
			data.cardBlur,
			RANGE.cardBlur.min,
			RANGE.cardBlur.max,
			s.cardBlur,
		);
	}
	if (typeof data.cardRadius === "number") {
		s.cardRadius = clampNum(
			data.cardRadius,
			RANGE.cardRadius.min,
			RANGE.cardRadius.max,
			s.cardRadius,
		);
	}
	if (typeof data.cardBorderWidth === "number") {
		s.cardBorderWidth = clampNum(
			data.cardBorderWidth,
			RANGE.cardBorderWidth.min,
			RANGE.cardBorderWidth.max,
			s.cardBorderWidth,
		);
	}

	// Search filters
	if (Array.isArray(data.hiddenFilters)) {
		s.hiddenFilters = data.hiddenFilters.filter(
			(f): f is string => typeof f === "string",
		);
	}

	// Tasks / TaskNotes field mappings
	const statusField = str(data.taskNotesStatusField);
	if (statusField !== undefined) s.taskNotesStatusField = statusField;
	const dueField = str(data.taskNotesDueField);
	if (dueField !== undefined) s.taskNotesDueField = dueField;
	const priorityField = str(data.taskNotesPriorityField);
	if (priorityField !== undefined) s.taskNotesPriorityField = priorityField;
	const doneValue = str(data.taskNotesDoneValue);
	if (doneValue !== undefined) s.taskNotesDoneValue = doneValue;
}
