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
	type DatacoreConfig,
	type DataviewConfig,
	type EmbedImageFit,
	type EmbedImagePosition,
	type GitConfig,
	type HeatmapConfig,
	type HomeSettings,
	type LeafViewConfig,
	legacyTitleIcon,
	type LinkItem,
	type MobileActionButton,
	type OperonConfig,
	type JiraConfig,
	type JiraControl,
	newDashboardId,
	OPEN_IN_MODES,
	OPEN_OUTSIDE_RULES,
	OPEN_SOURCES,
	type OpenIn,
	type OpenInRule,
	type OpenOutsideRule,
	type RssConfig,
	type RssSource,
	type SavedSearchConfig,
	type SlideshowAdvance,
	type SlideshowConfig,
	type SlideshowOrder,
	type SlideshowSlide,
	type SlideshowTransition,
	type TaskFieldDef,
	type TaskFieldKey,
	type TaskValueMap,
	type TaskFilterConfig,
	type TaskSortRule,
	type TasksConfig,
	activeDashboard,
	CARD_BORDER_WIDTH_MAX,
	CONTENT_WIDTH_MAX,
	CONTENT_WIDTH_MIN,
	clampBannerHeight,
	PERFORMANCE_TIERS,
	type PerformanceTier,
} from "./types";
import { CARD_KINDS } from "./cards";
import { isEmbeddableBaseViewName } from "./bases";
import { EMBED_IMAGE_FITS, EMBED_IMAGE_POSITIONS } from "./embedimage";
import {
	SLIDESHOW_ADVANCES,
	SLIDESHOW_MAX_DAY_COUNT,
	SLIDESHOW_MAX_INTERVAL_SEC,
	SLIDESHOW_MAX_TRANSITION_MS,
	SLIDESHOW_ORDERS,
	SLIDESHOW_TRANSITIONS,
} from "./slideshow";
import { DATACORE_LANGUAGES, type DatacoreLanguage } from "./datacore";
import {
	GIT_ACTION_STYLES,
	GIT_COMMIT_SCOPES,
	gitActions,
	gitSections,
	type GitActionStyle,
	type GitCommitScope,
} from "./git";
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
	fullWidth: boolean;
	favorites: string[];
}

/** Value ranges enforced on import so a malformed/hostile layout can't set
 * values the settings UI could never produce. Mirror the sliders in settings. */
const RANGE = {
	gridColumns: { min: 4, max: 16 },
	rowHeight: { min: 32, max: 160 },
	maxWidth: { min: CONTENT_WIDTH_MIN, max: CONTENT_WIDTH_MAX },
	cardW: { min: 1, max: 16 },
	cardH: { min: 1, max: 60 },
	cardBlur: { min: 0, max: 24 },
	cardRadius: { min: 0, max: 14 },
	cardBorderWidth: { min: 0, max: CARD_BORDER_WIDTH_MAX },
	headerScale: { min: 0.6, max: 1.8 },
	headerMarginTop: { min: 0, max: 96 },
	headerSpacingBelow: { min: 0, max: 96 },
};

/** Build the portable layout payload (the dashboard setup and its globals). */
function layoutPayload(s: HomeSettings): LayoutExport {
	// SECURITY-REVIEW: Jira PATs authenticate outbound requests and must never be
	// copied into portable layout/settings artifacts. Clone only the affected
	// card/config objects so live settings retain their credentials unchanged.
	const scrubCard = (card: DashboardCard): DashboardCard =>
		card.jira?.pat === undefined
			? card
			: { ...card, jira: { ...card.jira, pat: undefined } };
	const dashboards = s.dashboards.map((dashboard) => ({
		...dashboard,
		cards: dashboard.cards.map(scrubCard),
	}));
	return {
		hearthLayout: LAYOUT_SCHEMA,
		dashboards,
		activeDashboardId: s.activeDashboardId,
		pinnedCards: s.pinnedCards.map(scrubCard),
		gridColumns: s.gridColumns,
		rowHeight: s.rowHeight,
		fitToPage: s.fitToPage,
		maxWidth: s.maxWidth,
		fullWidth: s.fullWidth,
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
		titleIcon: s.titleIcon,
		tabIcon: s.tabIcon,
		showSearch: s.showSearch,
		searchPlaceholder: s.searchPlaceholder,
		showNewNoteButton: s.showNewNoteButton,
		newNoteButtonMode: s.newNoteButtonMode,
		newNoteButtonLabel: s.newNoteButtonLabel,
		newNoteTemplate: s.newNoteTemplate,
		newNoteFolder: s.newNoteFolder,
		newNoteFilename: s.newNoteFilename,
		searchContents: s.searchContents,
		searchEngine: s.searchEngine,

		// Background
		backgroundKind: s.backgroundKind,
		backgroundValue: s.backgroundValue,
		backgroundOpacity: s.backgroundOpacity,
		backgroundBlur: s.backgroundBlur,
		backgroundLayout: s.backgroundLayout,
		bannerHeight: s.bannerHeight,
		bannerFade: s.bannerFade,
		bannerFullWidth: s.bannerFullWidth,
		// The performance tier overrides the four above rather than replacing
		// them, so it has to travel with them — otherwise an export taken on a
		// lower tier would describe a look the importing vault doesn't show.
		performanceTier: s.performanceTier,
		lowPowerBackgroundColor: s.lowPowerBackgroundColor,
		pauseWhenUnfocused: s.pauseWhenUnfocused,

		// Behaviour
		openOnStartup: s.openOnStartup,
		replaceNewTabs: s.replaceNewTabs,
		mobileSearchOnly: s.mobileSearchOnly,
		showMobileActionBar: s.showMobileActionBar,
		mobileActionButtons: s.mobileActionButtons,
		disableExternalCalls: s.disableExternalCalls,
		openIn: s.openIn,
		openInOverrides: s.openInOverrides,
		openFromOutside: s.openFromOutside,

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
		taskFieldsEnabled: s.taskFieldsEnabled,
		taskFields: s.taskFields,

		// Operon
		operonIntegration: s.operonIntegration,
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

/** An embed's picture-fit mode, or undefined when the import names one Hearth
 * doesn't have (a newer file, or a hand-edited one). */
function sanitizeImageFit(raw: unknown): EmbedImageFit | undefined {
	return EMBED_IMAGE_FITS.includes(raw as EmbedImageFit)
		? (raw as EmbedImageFit)
		: undefined;
}

/** An embed's picture anchor point, or undefined when it isn't one of the nine. */
function sanitizeImagePosition(raw: unknown): EmbedImagePosition | undefined {
	return EMBED_IMAGE_POSITIONS.includes(raw as EmbedImagePosition)
		? (raw as EmbedImagePosition)
		: undefined;
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
	const imageFit = sanitizeImageFit(r.imageFit);
	if (imageFit !== undefined) view.imageFit = imageFit;
	const imagePosition = sanitizeImagePosition(r.imagePosition);
	if (imagePosition !== undefined) view.imagePosition = imagePosition;
	if (typeof r.editable === "boolean") view.editable = r.editable;
	if (typeof r.livePreview === "boolean") view.livePreview = r.livePreview;
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
	if (typeof r.recentAuto === "boolean") card.recentAuto = r.recentAuto;
	if (typeof r.scale === "number") card.scale = r.scale;
	const cardImageFit = sanitizeImageFit(r.imageFit);
	if (cardImageFit !== undefined) card.imageFit = cardImageFit;
	const cardImagePosition = sanitizeImagePosition(r.imagePosition);
	if (cardImagePosition !== undefined) card.imagePosition = cardImagePosition;
	if (typeof r.refreshSec === "number") card.refreshSec = r.refreshSec;
	if (typeof r.editable === "boolean") card.editable = r.editable;
	if (typeof r.livePreview === "boolean") card.livePreview = r.livePreview;
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
	if (typeof r.cardBorderWidth === "number") {
		card.cardBorderWidth = clampNum(
			r.cardBorderWidth,
			RANGE.cardBorderWidth.min,
			RANGE.cardBorderWidth.max,
			RANGE.cardBorderWidth.min,
		);
	}
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
	if (r.slideshow && typeof r.slideshow === "object") {
		card.slideshow = sanitizeSlideshow(r.slideshow as Record<string, unknown>);
	}
	if (r.jira !== undefined) {
		card.jira = sanitizeJira(r.jira);
	}
	if (r.dataview && typeof r.dataview === "object") {
		card.dataview = sanitizeDataview(r.dataview as Record<string, unknown>);
	}
	if (r.datacore && typeof r.datacore === "object") {
		card.datacore = sanitizeDatacore(r.datacore as Record<string, unknown>);
	}
	if (r.git && typeof r.git === "object") {
		card.git = sanitizeGit(r.git as Record<string, unknown>);
	}
	if (r.operon && typeof r.operon === "object") {
		card.operon = sanitizeOperon(r.operon as Record<string, unknown>);
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
	if (r.hourFormat === "auto" || r.hourFormat === "12" || r.hourFormat === "24") {
		clock.hourFormat = r.hourFormat;
	} else if (typeof r.use24Hour === "boolean") {
		// Migrate the pre-hourFormat boolean: true forced 24-hour, false meant
		// "follow the locale default" (now "auto").
		clock.hourFormat = r.use24Hour ? "24" : "auto";
	}
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

const TASK_FIELD_STYLES = ["pill", "dot", "dotlabel", "text", "hue", "glow"] as const;

/** One key's value mappings. A mapping with no `match` matches nothing, so it
 * is dropped rather than kept as a row that can never fire. */
function sanitizeValueMaps(value: unknown): TaskValueMap[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out: TaskValueMap[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== "object") continue;
		const r = raw as Record<string, unknown>;
		const match = str(r.match)?.trim();
		if (!match) continue;
		const mapping: TaskValueMap = { match };
		const label = str(r.label);
		if (label !== undefined) mapping.label = label;
		const color = str(r.color);
		if (color !== undefined) mapping.color = color;
		out.push(mapping);
	}
	return out.length ? out : undefined;
}

/** A field's keys. Which sources are meaningful is `resolveTaskFields`' job at
 * render time; this only checks the shape, so a key written by a newer version
 * survives a round-trip through an older one. */
function sanitizeFieldKeys(value: unknown): TaskFieldKey[] {
	if (!Array.isArray(value)) return [];
	const out: TaskFieldKey[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== "object") continue;
		const r = raw as Record<string, unknown>;
		const source = str(r.source)?.trim();
		if (!source) continue;
		const key: TaskFieldKey = { source };
		if (r.isDate === true) key.isDate = true;
		const values = sanitizeValueMaps(r.values);
		if (values) key.values = values;
		out.push(key);
	}
	return out;
}

/** The user-defined field list. An empty result is returned as an empty array
 * rather than undefined: "show nothing" is a real configuration and must not
 * be mistaken for "not configured". */
function sanitizeTaskFields(value: unknown): TaskFieldDef[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out: TaskFieldDef[] = [];
	value.forEach((raw, index) => {
		if (!raw || typeof raw !== "object") return;
		const r = raw as Record<string, unknown>;
		const field: TaskFieldDef = {
			id: str(r.id)?.trim() || `f-${index}`,
			name: str(r.name) ?? "",
			keys: sanitizeFieldKeys(r.keys),
		};
		if (r.showName === true) field.showName = true;
		if (typeof r.opacity === "number" && Number.isFinite(r.opacity)) {
			field.opacity = Math.max(1, Math.min(100, Math.round(r.opacity)));
		}
		if (
			TASK_FIELD_STYLES.includes(r.display as (typeof TASK_FIELD_STYLES)[number])
		) {
			field.display = r.display as TaskFieldDef["display"];
		}
		out.push(field);
	});
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
	const contexts = strArray(r.contexts);
	if (contexts) cfg.contexts = contexts;
	const projects = strArray(r.projects);
	if (projects) cfg.projects = projects;
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
	const taskNotesStatusField = str(r.taskNotesStatusField);
	if (taskNotesStatusField !== undefined) cfg.taskNotesStatusField = taskNotesStatusField;
	const taskNotesDueField = str(r.taskNotesDueField);
	if (taskNotesDueField !== undefined) cfg.taskNotesDueField = taskNotesDueField;
	const taskNotesPriorityField = str(r.taskNotesPriorityField);
	if (taskNotesPriorityField !== undefined)
		cfg.taskNotesPriorityField = taskNotesPriorityField;
	const taskNotesDoneValue = str(r.taskNotesDoneValue);
	if (taskNotesDoneValue !== undefined) cfg.taskNotesDoneValue = taskNotesDoneValue;
	const taskFilter = sanitizeTaskFilter(r.taskFilter);
	if (taskFilter) cfg.taskFilter = taskFilter;
	if (typeof r.taskFieldsEnabled === "boolean")
		cfg.taskFieldsEnabled = r.taskFieldsEnabled;
	const taskFields = sanitizeTaskFields(r.taskFields);
	if (taskFields) cfg.taskFields = taskFields;
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
	if (typeof r.operonTasks === "boolean") cfg.operonTasks = r.operonTasks;
	const operonTaskColor = str(r.operonTaskColor);
	if (operonTaskColor !== undefined) cfg.operonTaskColor = operonTaskColor;
	return cfg;
}

const OPERON_VIEWS = ["list", "board", "agenda", "timer"] as const;
const OPERON_SCOPES = ["query", "normal", "overdue", "happens-today", "recent"] as const;
const OPERON_CHECKBOX_STATES = ["open", "done", "cancelled"] as const;

/**
 * Operon card config. Everything here is either a fixed enum or a list of
 * Operon's own ids, so the whitelist copies ids through verbatim without
 * checking them against a taxonomy: an imported layout may well land in a vault
 * whose Operon is configured differently, and the card already falls back to
 * showing an id it can't resolve rather than dropping the filter silently.
 */
function sanitizeOperon(r: Record<string, unknown>): OperonConfig {
	const cfg: OperonConfig = {};
	if (OPERON_VIEWS.includes(r.view as (typeof OPERON_VIEWS)[number])) {
		cfg.view = r.view as OperonConfig["view"];
	}
	if (OPERON_SCOPES.includes(r.scope as (typeof OPERON_SCOPES)[number])) {
		cfg.scope = r.scope as OperonConfig["scope"];
	}
	const pipelineIds = strArray(r.pipelineIds);
	if (pipelineIds?.length) cfg.pipelineIds = pipelineIds;
	const statusIds = strArray(r.statusIds);
	if (statusIds?.length) cfg.statusIds = statusIds;
	const priorityIds = strArray(r.priorityIds);
	if (priorityIds?.length) cfg.priorityIds = priorityIds;
	const boardOrder = strArray(r.boardOrder);
	if (boardOrder?.length) cfg.boardOrder = boardOrder;
	const boardHidden = strArray(r.boardHidden);
	if (boardHidden?.length) cfg.boardHidden = boardHidden;
	const checkbox = strArray(r.checkbox)?.filter((v): v is (typeof OPERON_CHECKBOX_STATES)[number] =>
		OPERON_CHECKBOX_STATES.includes(v as (typeof OPERON_CHECKBOX_STATES)[number]),
	);
	if (checkbox?.length) cfg.checkbox = checkbox;
	const filePath = str(r.filePath);
	if (filePath !== undefined) cfg.filePath = filePath;
	const text = str(r.text);
	if (text !== undefined) cfg.text = text;
	if (typeof r.agendaDays === "number") cfg.agendaDays = r.agendaDays;
	if (typeof r.count === "number") cfg.count = r.count;
	if (TASK_SORT_KEYS.includes(r.sortKey as (typeof TASK_SORT_KEYS)[number])) {
		cfg.sortKey = r.sortKey as OperonConfig["sortKey"];
	}
	if (typeof r.sortReverse === "boolean") cfg.sortReverse = r.sortReverse;
	if (r.createAs === "inline" || r.createAs === "file") cfg.createAs = r.createAs;
	for (const key of [
		"showDue",
		"showPriority",
		"showStatus",
		"showRecurrence",
		"showTracker",
		"showPinned",
		"showFile",
	] as const) {
		if (typeof r[key] === "boolean") cfg[key] = r[key];
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

function sanitizeSlide(raw: unknown): SlideshowSlide | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const path = str(r.path);
	if (path === undefined) return null;
	const slide: SlideshowSlide = {
		id: str(r.id) ?? `slide-${Math.random().toString(36).slice(2)}`,
		path,
	};
	const caption = str(r.caption);
	if (caption !== undefined) slide.caption = caption;
	return slide;
}

/** Allowlist and clamp an imported slideshow card configuration. The numeric
 * fields are clamped to the same bounds the card itself enforces, so an imported
 * layout can't schedule a runaway timer or a minute-long transition. */
function sanitizeSlideshow(r: Record<string, unknown>): SlideshowConfig {
	const cfg: SlideshowConfig = {};
	if (r.source === "folder") cfg.source = "folder";
	if (Array.isArray(r.slides)) {
		cfg.slides = r.slides
			.map(sanitizeSlide)
			.filter((s): s is SlideshowSlide => s !== null);
	}
	const folder = str(r.folder);
	if (folder !== undefined) cfg.folder = folder;
	if (typeof r.includeSubfolders === "boolean") cfg.includeSubfolders = r.includeSubfolders;
	if (SLIDESHOW_ORDERS.includes(r.order as SlideshowOrder)) {
		cfg.order = r.order as SlideshowOrder;
	}
	if (SLIDESHOW_ADVANCES.includes(r.advance as SlideshowAdvance)) {
		cfg.advance = r.advance as SlideshowAdvance;
	}
	if (typeof r.intervalSec === "number" && Number.isFinite(r.intervalSec)) {
		cfg.intervalSec = clampNum(r.intervalSec, 0, SLIDESHOW_MAX_INTERVAL_SEC, 0);
	}
	if (typeof r.dayCount === "number" && Number.isFinite(r.dayCount)) {
		cfg.dayCount = clampNum(r.dayCount, 1, SLIDESHOW_MAX_DAY_COUNT, 0);
	}
	if (SLIDESHOW_TRANSITIONS.includes(r.transition as SlideshowTransition)) {
		cfg.transition = r.transition as SlideshowTransition;
	}
	if (typeof r.transitionMs === "number" && Number.isFinite(r.transitionMs)) {
		cfg.transitionMs = clampNum(r.transitionMs, 0, SLIDESHOW_MAX_TRANSITION_MS, 0);
	}
	if (typeof r.kenBurns === "boolean") cfg.kenBurns = r.kenBurns;
	if (r.fit === "contain" || r.fit === "cover") cfg.fit = r.fit;
	if (typeof r.controls === "boolean") cfg.controls = r.controls;
	if (typeof r.showCaption === "boolean") cfg.showCaption = r.showCaption;
	if (typeof r.pauseOnHover === "boolean") cfg.pauseOnHover = r.pauseOnHover;
	return cfg;
}

const JIRA_CONTROLS: JiraControl[] = [
	"status",
	"assignee",
	"priority",
	"issueType",
	"sprint",
	"fixVersion",
];

/** Allowlist and clamp an imported Jira card configuration. */
export function sanitizeJira(raw: unknown): JiraConfig {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const r = raw as Record<string, unknown>;
	const cfg: JiraConfig = {};
	const host = str(r.host)?.trim().replace(/\/+$/, "");
	if (host !== undefined) cfg.host = host;
	const pat = str(r.pat);
	if (pat !== undefined) cfg.pat = pat;
	const apiBasePath = str(r.apiBasePath);
	if (apiBasePath !== undefined) cfg.apiBasePath = apiBasePath;
	const filterId = str(r.filterId);
	if (filterId !== undefined) cfg.filterId = filterId;
	const filterName = str(r.filterName);
	if (filterName !== undefined) cfg.filterName = filterName;
	if (Array.isArray(r.controls)) {
		cfg.controls = r.controls.filter(
			(control): control is JiraControl =>
				typeof control === "string" &&
				JIRA_CONTROLS.includes(control as JiraControl),
		);
	}
	if (r.selections && typeof r.selections === "object" && !Array.isArray(r.selections)) {
		const rawSelections = r.selections as Record<string, unknown>;
		cfg.selections = {};
		for (const control of JIRA_CONTROLS) {
			const values = rawSelections[control];
			if (!Array.isArray(values)) continue;
			cfg.selections[control] = values.filter(
				(value): value is string => typeof value === "string",
			);
		}
	}
	if (typeof r.maxResults === "number" && Number.isFinite(r.maxResults)) {
		cfg.maxResults = Math.max(1, Math.min(200, Math.round(r.maxResults)));
	}
	if (typeof r.refreshMin === "number" && Number.isFinite(r.refreshMin)) {
		cfg.refreshMin = Math.max(0, Math.min(1440, Math.round(r.refreshMin)));
	}
	if (typeof r.cacheMin === "number" && Number.isFinite(r.cacheMin)) {
		cfg.cacheMin = Math.max(0, Math.min(1440, Math.round(r.cacheMin)));
	}
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

function sanitizeDatacore(r: Record<string, unknown>): DatacoreConfig {
	const cfg: DatacoreConfig = {};
	const query = str(r.query);
	if (query !== undefined) cfg.query = query;
	if (DATACORE_LANGUAGES.includes(r.language as DatacoreLanguage)) {
		cfg.language = r.language as DatacoreLanguage;
	}
	if (typeof r.pageSize === "number" && Number.isFinite(r.pageSize)) {
		cfg.pageSize = Math.max(0, Math.min(100, Math.round(r.pageSize)));
	}
	return cfg;
}

/** An imported Git card. The section and action lists are run through the same
 * normalizers the card uses, so an unknown id from a newer Hearth (or a hand
 * edit) is dropped rather than rendered as a dead button. */
function sanitizeGit(r: Record<string, unknown>): GitConfig {
	const cfg: GitConfig = {};
	if (Array.isArray(r.sections)) {
		cfg.sections = gitSections(r.sections.filter((v): v is string => typeof v === "string"));
	}
	if (Array.isArray(r.actions)) {
		cfg.actions = gitActions(r.actions.filter((v): v is string => typeof v === "string"));
	}
	if (GIT_ACTION_STYLES.includes(r.actionStyle as GitActionStyle)) {
		cfg.actionStyle = r.actionStyle as GitActionStyle;
	}
	if (GIT_COMMIT_SCOPES.includes(r.commitScope as GitCommitScope)) {
		cfg.commitScope = r.commitScope as GitCommitScope;
	}
	if (typeof r.changeLimit === "number" && Number.isFinite(r.changeLimit)) {
		cfg.changeLimit = Math.max(0, Math.min(50, Math.round(r.changeLimit)));
	}
	if (typeof r.logLimit === "number" && Number.isFinite(r.logLimit)) {
		cfg.logLimit = Math.max(1, Math.min(25, Math.round(r.logLimit)));
	}
	if (typeof r.refreshMin === "number" && Number.isFinite(r.refreshMin)) {
		cfg.refreshMin = Math.max(0, Math.min(180, Math.round(r.refreshMin)));
	}
	const message = str(r.commitMessage);
	if (message !== undefined) cfg.commitMessage = message;
	if (typeof r.showPaths === "boolean") cfg.showPaths = r.showPaths;
	if (typeof r.askForMessage === "boolean") cfg.askForMessage = r.askForMessage;
	if (typeof r.skipConfirm === "boolean") cfg.skipConfirm = r.skipConfirm;
	return cfg;
}

function sanitizeLeafView(r: Record<string, unknown>): LeafViewConfig {
	const cfg: LeafViewConfig = {};
	const viewType = str(r.viewType);
	if (viewType !== undefined) cfg.viewType = viewType;
	const file = str(r.file);
	if (file !== undefined) cfg.file = file;
	if (typeof r.hideHeader === "boolean") cfg.hideHeader = r.hideHeader;
	return cfg;
}

function sanitizeBackground(raw: unknown): BackgroundConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const kinds: BackgroundKind[] = ["none", "color", "image", "url", "weather"];
	if (!kinds.includes(r.kind as BackgroundKind)) return undefined;
	return {
		kind: r.kind as BackgroundKind,
		value: str(r.value) ?? "",
		opacity: Math.max(0, Math.min(1, num(r.opacity, 0.15))),
		blur: Math.max(0, Math.min(40, num(r.blur, 0))),
	};
}

/** Read a board's banner overrides off an imported dashboard. Each stays absent
 * when the file has nothing for it, so an imported board falls back to the
 * global setting exactly as an unset override should. */
function applyBannerOverrides(dash: Dashboard, r: Record<string, unknown>): void {
	if (r.backgroundLayout === "banner" || r.backgroundLayout === "full") {
		dash.backgroundLayout = r.backgroundLayout;
	}
	if (typeof r.bannerHeight === "number") {
		dash.bannerHeight = clampBannerHeight(r.bannerHeight);
	}
	if (typeof r.bannerFade === "boolean") dash.bannerFade = r.bannerFade;
	if (typeof r.bannerFullWidth === "boolean") {
		dash.bannerFullWidth = r.bannerFullWidth;
	}
}

function sanitizeDashboard(
	raw: unknown,
	s: HomeSettings,
	index: number,
	/** The export's vault-wide keys, so a board that overrode only one half of
	 * the pre-2.2.0 `logo`/`logoIcon` pair folds against the same fallback the
	 * settings migration uses (#252). Empty for a layout-only export, which
	 * carries no vault-wide header fields at all. */
	globals: Record<string, unknown> = {},
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
	if (typeof r.compact === "boolean") dash.compact = r.compact;
	const linkedWorkspace = str(r.linkedWorkspace);
	if (linkedWorkspace !== undefined && linkedWorkspace.trim())
		dash.linkedWorkspace = linkedWorkspace;
	const rawHeader = r.header;
	if (rawHeader && typeof rawHeader === "object") {
		const h = rawHeader as Record<string, unknown>;
		const header: NonNullable<Dashboard["header"]> = {};
		if (typeof h.showTitle === "boolean") header.showTitle = h.showTitle;
		const title = str(h.title);
		if (title !== undefined) header.title = title;
		// Kept even when empty: an empty override is a board that deliberately
		// wears the Hearth crystal, which is not the same as no override. An
		// export taken before 2.2.0 carries the old `logo`/`logoIcon` pair
		// instead, folded here the same way the settings migration folds it.
		const hadLegacy = typeof h.logo === "string" || typeof h.logoIcon === "string";
		const titleIcon =
			str(h.titleIcon) ?? (hadLegacy ? legacyTitleIcon(h, globals) : undefined);
		if (titleIcon !== undefined) header.titleIcon = titleIcon.trim();
		if (
			h.themeColorTarget === "none" ||
			h.themeColorTarget === "icon" ||
			h.themeColorTarget === "title" ||
			h.themeColorTarget === "both"
		) {
			header.themeColorTarget = h.themeColorTarget;
		}
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
	if (typeof r.fullWidth === "boolean") dash.fullWidth = r.fullWidth;
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
	applyBannerOverrides(dash, r);
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
			.map((d, i) => sanitizeDashboard(d, s, i, data))
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
	// Absent from layouts exported before full width existed, and left alone
	// rather than defaulted so importing an old layout can't quietly re-impose a
	// ceiling the vault has already dropped.
	if (typeof data.fullWidth === "boolean") s.fullWidth = data.fullWidth;
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
/** Where notes open (#106). The global choice and each per-source rule are
 * validated on their own, so a file from another version — or one hand-edited
 * into a partial map — imports what it can and leaves the rest alone. */
function applyOpenIn(s: HomeSettings, data: Record<string, unknown>): void {
	if (OPEN_IN_MODES.includes(data.openIn as OpenIn)) s.openIn = data.openIn as OpenIn;
	if (OPEN_OUTSIDE_RULES.includes(data.openFromOutside as OpenOutsideRule)) {
		s.openFromOutside = data.openFromOutside as OpenOutsideRule;
	}
	const raw = data.openInOverrides;
	if (!raw || typeof raw !== "object") return;
	const map = raw as Record<string, unknown>;
	const overrides = { ...s.openInOverrides };
	for (const source of OPEN_SOURCES) {
		const rule = map[source];
		if (rule === "default" || OPEN_IN_MODES.includes(rule as OpenIn)) {
			overrides[source] = rule as OpenInRule;
		}
	}
	s.openInOverrides = overrides;
}


function applySettings(s: HomeSettings, data: Record<string, unknown>): void {
	// Header
	const title = str(data.title);
	if (title !== undefined) s.title = title;
	if (typeof data.showTitle === "boolean") s.showTitle = data.showTitle;
	// A pre-2.2.0 export carries `logo` and `logoIcon` rather than the merged
	// `titleIcon`; fold the pair exactly as the settings migration does (#252).
	const hadLegacyIcon = typeof data.logo === "string" || typeof data.logoIcon === "string";
	const titleIcon =
		str(data.titleIcon) ?? (hadLegacyIcon ? legacyTitleIcon(data) : undefined);
	if (titleIcon !== undefined) s.titleIcon = titleIcon.trim();
	const tabIcon = str(data.tabIcon);
	if (tabIcon !== undefined) s.tabIcon = tabIcon.trim();
	if (typeof data.showSearch === "boolean") s.showSearch = data.showSearch;
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
	const newNoteButtonLabel = str(data.newNoteButtonLabel);
	if (newNoteButtonLabel !== undefined) s.newNoteButtonLabel = newNoteButtonLabel;
	const newNoteTemplate = str(data.newNoteTemplate);
	if (newNoteTemplate !== undefined) s.newNoteTemplate = newNoteTemplate.trim();
	const newNoteFolder = str(data.newNoteFolder);
	if (newNoteFolder !== undefined) s.newNoteFolder = newNoteFolder.trim();
	const newNoteFilename = str(data.newNoteFilename);
	if (newNoteFilename !== undefined) s.newNoteFilename = newNoteFilename;
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
	if (data.backgroundLayout === "full" || data.backgroundLayout === "banner") {
		s.backgroundLayout = data.backgroundLayout;
	}
	if (typeof data.bannerHeight === "number") {
		s.bannerHeight = clampBannerHeight(data.bannerHeight);
	}
	if (typeof data.bannerFade === "boolean") s.bannerFade = data.bannerFade;
	if (typeof data.bannerFullWidth === "boolean") {
		s.bannerFullWidth = data.bannerFullWidth;
	}
	// A layout exported before the tiers carries the old boolean; fold it the
	// same way migrateSettings does so an old export still lands somewhere sane.
	const tier = str(data.performanceTier);
	if (PERFORMANCE_TIERS.includes(tier as PerformanceTier)) {
		s.performanceTier = tier as PerformanceTier;
	} else if (typeof data.lowPower === "boolean") {
		s.performanceTier = data.lowPower ? "minimal" : "full";
	}
	const lowPowerColor = str(data.lowPowerBackgroundColor)?.trim();
	if (lowPowerColor) s.lowPowerBackgroundColor = lowPowerColor;
	if (typeof data.pauseWhenUnfocused === "boolean") {
		s.pauseWhenUnfocused = data.pauseWhenUnfocused;
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
	applyOpenIn(s, data);

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

	// Task field customization (the global list every card follows).
	if (typeof data.taskFieldsEnabled === "boolean")
		s.taskFieldsEnabled = data.taskFieldsEnabled;
	const taskFields = sanitizeTaskFields(data.taskFields);
	if (taskFields) s.taskFields = taskFields;
	// Operon
	if (typeof data.operonIntegration === "boolean") {
		s.operonIntegration = data.operonIntegration;
	}
}
