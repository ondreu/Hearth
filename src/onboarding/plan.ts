/**
 * Turning the wizard's answers into a dashboard.
 *
 * Everything here is pure: answers plus a detection snapshot go in, a board
 * comes out. The wizard (`wizard.ts`) only collects the answers and draws the
 * result — none of the decisions below depend on Obsidian, so all of them are
 * unit-testable, which matters because this is the one code path a new user's
 * very first impression of Hearth is built by.
 *
 * The two halves are deliberately separate:
 *
 *  - {@link planCards} decides *what board to build* — which cards, configured
 *    how, laid out where.
 *  - {@link applySetup} installs that board and writes the look onto it.
 *
 * so the review step can show the first without committing the second.
 *
 * ⚠️ **The wizard never writes a global setting.** Every answer it collects
 * lands on the dashboard it builds — as a per-dashboard override (the header,
 * the card surface, the background, compact spacing) or in a card's own config
 * (the TaskNotes field mapping) — so running setup, or re-running it later,
 * cannot change how any *other* board looks or how Hearth behaves vault-wide.
 * The only fields of {@link HomeSettings} touched here are the structural ones
 * that installing a board *is*: the `dashboards` list, `activeDashboardId`, and
 * the `setupStatus` flag that stops the wizard offering itself twice. Anything
 * the wizard cannot express as a board-level override is therefore not asked
 * about at all — it belongs in Settings → Hearth, where it applies to
 * everything by design.
 */
import { ensureLayout } from "../grid";
import {
	type BackgroundConfig,
	type BackgroundLayout,
	type DashboardCard,
	type Dashboard,
	type HomeSettings,
	type TemplaterItem,
	newDashboardId,
} from "../types";
import { templateDisplayName } from "../templater";
import type { SetupDetection, SetupIntegrationId } from "./detect";
import { taskNotesImport } from "./detect";

/**
 * What a user says they want Hearth *for*.
 *
 * The wizard asks this instead of asking which cards to add, because a new user
 * has no idea what a "heatmap card" is and every idea of whether they journal.
 * Each purpose maps to a small, opinionated group of cards below.
 */
export type SetupPurpose =
	| "daily"
	| "tasks"
	| "planning"
	| "browsing"
	| "capture"
	| "insights"
	| "reading"
	| "ambience";

/** Every purpose, in the order the wizard lists them. */
export const SETUP_PURPOSES: readonly SetupPurpose[] = [
	"daily",
	"tasks",
	"planning",
	"browsing",
	"capture",
	"insights",
	"reading",
	"ambience",
];

/** The Lucide icon shown on each purpose tile. */
export const PURPOSE_ICONS: Record<SetupPurpose, string> = {
	daily: "sun",
	tasks: "list-todo",
	planning: "calendar-range",
	browsing: "compass",
	capture: "zap",
	insights: "bar-chart-3",
	reading: "rss",
	ambience: "sparkles",
};

/** How much chrome the cards wear. Three named looks rather than four sliders:
 * the sliders all still exist in settings, this just picks a coherent set. */
export type SetupSurface = "glass" | "solid" | "minimal";

/** Every surface, in the order the wizard lists them. */
export const SETUP_SURFACES: readonly SetupSurface[] = ["glass", "solid", "minimal"];

/** The card-surface settings each named look resolves to. */
export const SURFACE_PRESETS: Record<
	SetupSurface,
	Pick<HomeSettings, "cardOpacity" | "cardBlur" | "cardRadius" | "cardBorderWidth">
> = {
	// Hearth's signature: translucent cards over the wallpaper, frosted.
	glass: { cardOpacity: 0.5, cardBlur: 7, cardRadius: 14, cardBorderWidth: 1 },
	// Opaque panels. Reads best against a busy photograph, and costs no blur.
	solid: { cardOpacity: 1, cardBlur: 0, cardRadius: 12, cardBorderWidth: 1 },
	// No card surface at all: content floating straight on the background.
	minimal: { cardOpacity: 0, cardBlur: 0, cardRadius: 8, cardBorderWidth: 0 },
};

/** What the wizard offers as a backdrop. A vault image and a custom URL are
 * deliberately absent — both need a path the wizard can't guess, and both are
 * one dropdown away in settings afterwards. */
export type SetupBackground = "default" | "weather" | "color" | "none";

/** Every background choice, in wizard order. */
export const SETUP_BACKGROUNDS: readonly SetupBackground[] = [
	"default",
	"weather",
	"color",
	"none",
];

/**
 * The backdrop's opacity and blur per choice.
 *
 * Not one set of numbers for all of them: a photograph needs to be pushed well
 * back to keep text legible, while a flat colour is *already* legible and
 * fading it only makes it muddy.
 */
const BACKGROUND_TUNING: Record<SetupBackground, { opacity: number; blur: number }> = {
	default: { opacity: 0.35, blur: 2 },
	weather: { opacity: 0.6, blur: 0 },
	color: { opacity: 1, blur: 0 },
	none: { opacity: 0.35, blur: 2 },
};

/** Where the built board goes. */
export type SetupTarget = "replace" | "new";

/** Everything the wizard collects, in one object. Seeded by
 * {@link defaultAnswers} and mutated in place as the user moves through the
 * steps, so going back never loses an answer. */
export interface SetupAnswers {
	// ---- Step: your vault ----
	title: string;
	showTitle: boolean;
	/** The mark beside the title: emoji/text, a Lucide id, a vault image path or
	 * an image URL — see `titleicon.ts`. Empty = the Hearth crystal. */
	titleIcon: string;
	themeColorTarget: HomeSettings["themeColorTarget"];
	/** Whether the built board shows the search/command section. Stored as the
	 * board's own {@link Dashboard.showSearch} override, not the global one. */
	showSearch: boolean;

	// ---- Step: the look ----
	surface: SetupSurface;
	compact: boolean;
	background: SetupBackground;
	/** CSS colour used when `background` is "color". */
	backgroundColor: string;
	/** Packed sky value used when `background` is "weather" (see sky.ts). Empty
	 * until a place or a fixed condition is picked. */
	skyValue: string;
	backgroundLayout: BackgroundLayout;

	// ---- Step: what for ----
	purposes: SetupPurpose[];

	// ---- Step: integrations ----
	integrations: SetupIntegrationId[];

	// ---- Step: finish ----
	target: SetupTarget;
	dashboardName: string;
}

/**
 * The answers a vault starts the wizard with.
 *
 * Every default is either Hearth's own default or something the detection pass
 * discovered, so a user who clicks straight through to the end still gets a
 * sensible, working board rather than an empty one.
 */
export function defaultAnswers(
	settings: HomeSettings,
	detection: SetupDetection,
): SetupAnswers {
	const has = (id: SetupIntegrationId): boolean =>
		detection.integrations.some((i) => i.id === id);

	const purposes: SetupPurpose[] = ["daily", "browsing"];
	// Someone who already runs a task plugin is telling us what they use their
	// vault for more clearly than any question could.
	if (has("tasknotes") || has("kanban")) purposes.push("tasks");

	return {
		title: detection.vaultName || settings.title,
		showTitle: true,
		titleIcon: "",
		themeColorTarget: "none",
		showSearch: true,

		surface: "glass",
		compact: false,
		background: "default",
		backgroundColor: "#1e1b2e",
		skyValue: "",
		backgroundLayout: "full",

		purposes,

		integrations: detection.integrations.filter((i) => i.recommended).map((i) => i.id),

		target: "replace",
		dashboardName: "Home",
	};
}

/** Whether an integration was accepted. */
function accepted(answers: SetupAnswers, id: SetupIntegrationId): boolean {
	return answers.integrations.includes(id);
}

/** Whether a purpose was chosen. */
function wants(answers: SetupAnswers, purpose: SetupPurpose): boolean {
	return answers.purposes.includes(purpose);
}

/**
 * One card the plan may include: what it is, how big it starts, and why.
 *
 * `reason` is not decoration — the review step lists it, so the board arrives
 * explained rather than merely arrived. It names the answer that put the card
 * there, keyed into the locale table.
 */
export interface PlannedCard {
	/** Stable blueprint id, unique within a plan. Used to dedupe and to key the
	 * review list; not the card's own id. */
	id: string;
	/** Locale key under `setup.plan.reasons` explaining why it's here. */
	reason: string;
	/** The card itself, id assigned and position packed. */
	card: DashboardCard;
}

/** A planned card before it has an id or a packed position. */
type CardDraft = Omit<DashboardCard, "id">;

/** The default grid width a plan lays out against — Hearth's own default, so a
 * board built here lines up with one built by hand. */
const PLAN_COLUMNS = 12;

/**
 * Decide which cards the board gets, configured and laid out.
 *
 * Order matters twice over: it is the order the review step lists them in, and
 * — because the packer is a left-to-right shelf fill — it is what puts the
 * clock across the top and the big working cards on the second row.
 *
 * `newId` is injectable so tests get stable ids; it defaults to the same
 * scheme the card picker uses.
 */
export function planCards(
	answers: SetupAnswers,
	detection: SetupDetection,
	newId: (index: number) => string = defaultCardId,
): PlannedCard[] {
	const drafts: { id: string; reason: string; card: CardDraft }[] = [];
	const add = (id: string, reason: string, card: CardDraft): void => {
		if (drafts.some((p) => p.id === id)) return;
		drafts.push({ id, reason, card });
	};

	// The clock spans the top on every board the wizard builds. It is the one
	// card that is unambiguously good on a home screen regardless of what the
	// vault is for, and a full-width strip is what makes the board read as a
	// home screen rather than a grid of widgets.
	add("clock", "always", { kind: "clock", title: "", x: -1, y: -1, w: 12, h: 2 });

	if (wants(answers, "daily") || accepted(answers, "dailyNotes")) {
		add("daily", wants(answers, "daily") ? "daily" : "dailyNotes", {
			kind: "daily",
			title: "Today",
			x: -1,
			y: -1,
			w: 6,
			h: 5,
		});
	}

	if (wants(answers, "tasks") || accepted(answers, "tasknotes") || accepted(answers, "kanban")) {
		add("tasks", taskReason(answers), {
			kind: "tasks",
			title: "Tasks",
			x: -1,
			y: -1,
			w: 6,
			h: 5,
			tasks: planTasksConfig(answers, detection),
		});
	}

	if (wants(answers, "planning")) {
		add("schedule", "planning", {
			kind: "schedule",
			title: "Calendar",
			x: -1,
			y: -1,
			w: 8,
			h: 6,
			schedule: accepted(answers, "tasknotes")
				? { taskNotes: { enabled: true } }
				: {},
		});
	} else if (wants(answers, "daily")) {
		// No full calendar, but a board with a daily note on it still wants a
		// month at a glance to move between days.
		add("calendar", "daily", {
			kind: "calendar",
			title: "Calendar",
			x: -1,
			y: -1,
			w: 4,
			h: 4,
		});
	}

	if (wants(answers, "browsing")) {
		add("recent", "browsing", {
			kind: "recent",
			title: "Recent",
			count: 8,
			x: -1,
			y: -1,
			w: 4,
			h: 4,
		});
		add("favorites", "browsing", {
			kind: "favorites",
			title: "Favorites",
			x: -1,
			y: -1,
			w: 4,
			h: 3,
		});
	}

	if (accepted(answers, "bookmarks")) {
		add("bookmarks", "bookmarks", {
			kind: "bookmarks",
			title: "Bookmarks",
			x: -1,
			y: -1,
			w: 4,
			h: 3,
		});
	}

	if (wants(answers, "capture")) {
		// Both launchpads are new cards, so their buttons scale with the card
		// (see `tileSizing` in types.ts).
		add("links", "capture", {
			kind: "links",
			title: "Links",
			links: [],
			tileSizing: "scale",
			x: -1,
			y: -1,
			w: 6,
			h: 2,
		});
		add("commands", "capture", {
			kind: "commands",
			title: "Commands",
			commands: [],
			tileSizing: "scale",
			x: -1,
			y: -1,
			w: 6,
			h: 2,
		});
	}

	if (wants(answers, "insights")) {
		add("stats", "insights", { kind: "stats", title: "Vault", x: -1, y: -1, w: 4, h: 2 });
		add("heatmap", "insights", {
			kind: "heatmap",
			title: "Activity",
			heatmap: {},
			x: -1,
			y: -1,
			w: 8,
			h: 3,
		});
	}

	if (wants(answers, "reading")) {
		add("rss", "reading", {
			kind: "rss",
			title: "Reading",
			rss: { sources: [] },
			x: -1,
			y: -1,
			w: 4,
			h: 5,
		});
	}

	if (wants(answers, "ambience")) {
		add("weather", "ambience", {
			kind: "weather",
			title: "Weather",
			weather: {},
			x: -1,
			y: -1,
			w: 4,
			h: 3,
		});
		add("pet", "ambience", { kind: "pet", title: "Pet", pet: {}, x: -1, y: -1, w: 3, h: 4 });
	}

	if (accepted(answers, "dataview")) {
		add("dataview", "dataview", {
			kind: "dataview",
			title: "Dataview",
			// Seeded with a query rather than left blank: an empty Dataview card
			// is indistinguishable from a broken one, and "the notes I touched
			// most recently" is both obviously useful and obviously editable.
			dataview: { query: "LIST\nSORT file.mtime DESC\nLIMIT 10", language: "dql" },
			x: -1,
			y: -1,
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "datacore")) {
		add("datacore", "datacore", {
			kind: "datacore",
			title: "Datacore",
			datacore: {},
			x: -1,
			y: -1,
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "templater") && detection.templaterTemplates.length > 0) {
		add("templater", "templater", {
			kind: "templater",
			title: "New note",
			// Seeded with the vault's own templates rather than left blank: an
			// empty launchpad is indistinguishable from a broken one, and the
			// destination is the one thing the user still has to fill in — which
			// they can only do once there is a tile to fill it in on.
			templater: { items: detection.templaterTemplates.map(templaterTile) },
			x: -1,
			y: -1,
			w: 6,
			h: 2,
		});
	}

	if (accepted(answers, "operon")) {
		// The list view, not the board: it is the one Operon view that reads
		// correctly at any size, needs no pipeline chosen for it, and asks only
		// for the read capabilities Hearth requests by default. A board seeded
		// with someone else's idea of which pipeline matters is a worse first
		// impression than a list of what is due.
		add("operon", "operon", {
			kind: "operon",
			title: "Operon",
			operon: { view: "list" },
			x: -1,
			y: -1,
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "git")) {
		add("git", "git", { kind: "git", title: "Git", git: {}, x: -1, y: -1, w: 4, h: 4 });
	}

	if (accepted(answers, "bases") && detection.basePath) {
		add("base", "bases", {
			kind: "embed",
			title: baseTitle(detection.basePath),
			target: detection.basePath,
			x: -1,
			y: -1,
			w: 6,
			h: 5,
		});
	}

	// Pack once, over the whole plan, so the geometry the review step previews
	// is exactly the geometry the board is saved with.
	const cards: DashboardCard[] = drafts.map((draft, i) => ({ ...draft.card, id: newId(i) }));
	ensureLayout(cards, PLAN_COLUMNS);
	return drafts.map((draft, i) => ({ id: draft.id, reason: draft.reason, card: cards[i] }));
}

/**
 * One seeded Templater tile: the template, named after itself, with no
 * destination.
 *
 * No folder and no filename pattern on purpose. Both are choices only the user
 * can make, and both have a sane fallback — the note lands wherever Obsidian
 * puts new notes and Templater names it — so a tile works on the first click
 * and is *improved*, not *fixed*, by opening the card's settings.
 *
 * Ids are derived from the path rather than generated, so a plan previewed and
 * then committed produces the same board (nothing in planCards may depend on
 * the clock or the random seed — the review step renders it twice).
 */
function templaterTile(path: string, index: number): TemplaterItem {
	return {
		id: `templater-${index}`,
		label: templateDisplayName(path),
		icon: "file-plus-2",
		template: path,
	};
}

/** Why the Tasks card is on the board — the integration that asked for it takes
 * precedence over the generic purpose, since it is the more specific answer. */
function taskReason(answers: SetupAnswers): string {
	if (accepted(answers, "tasknotes")) return "tasknotes";
	if (accepted(answers, "kanban")) return "kanban";
	return "tasks";
}

/**
 * Configure the Tasks card for whichever source the vault actually has.
 *
 * The TaskNotes branch is the reason this feature exists: switching the source
 * is one line, but a card pointed at TaskNotes without its *completed* statuses
 * shows every cancelled task as outstanding, and one pointed at a vault that
 * renamed its fields shows nothing at all. Both are read from the plugin — and
 * both are stored *on the card*, not in the vault-wide TaskNotes mapping in
 * Settings → Hearth, so a wizard run configures this board's card and leaves
 * every other card reading whatever it read before.
 */
function planTasksConfig(
	answers: SetupAnswers,
	detection: SetupDetection,
): DashboardCard["tasks"] {
	if (accepted(answers, "tasknotes") && detection.taskNotes) {
		const imported = taskNotesImport(detection.taskNotes);
		return {
			source: "tasknotes",
			taskNotesStatusField: imported.statusField,
			taskNotesDueField: imported.dueField,
			taskNotesPriorityField: imported.priorityField,
			// The single done-value is the fallback for a vault that marks no
			// status complete; a vault that does gets the full list, which wins.
			taskNotesDoneValue: imported.doneValue,
			...(imported.doneStatuses.length
				? { taskNotesDoneStatuses: imported.doneStatuses }
				: {}),
		};
	}
	if (accepted(answers, "kanban") && detection.kanbanPath) {
		return { source: "kanban", kanbanFile: detection.kanbanPath, layout: "kanban" };
	}
	return {};
}

/** A readable title for an embedded base: its file name without the extension. */
function baseTitle(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.base$/i, "") || "Base";
}

/** Card ids in the same shape the card picker mints them. */
function defaultCardId(index: number): string {
	return `card-${Date.now().toString(36)}-${index}-${Math.floor(Math.random() * 1e4)}`;
}

/** What {@link applySetup} did, so the wizard can report it. */
export interface SetupOutcome {
	/** Id of the dashboard the board landed on. */
	dashboardId: string;
	/** How many cards it holds. */
	cardCount: number;
	/** True when an existing board's cards were replaced rather than a new
	 * dashboard created. */
	replaced: boolean;
}

/**
 * Install the planned board and write the wizard's answers onto it.
 *
 * Mutates `settings` in place — the same contract `migrateSettings` has — and
 * leaves persisting to the caller, so the wizard saves once at the end rather
 * than after every step.
 *
 * The board is installed *first* and every answer is then written onto that
 * dashboard as an override, which is the whole shape of this function: there is
 * no path here that assigns to a look-or-behaviour field of `settings`, so a
 * setup run cannot change any other board or any vault-wide preference. See the
 * module comment for why the wizard asks only about things that can be said
 * per-board.
 */
export function applySetup(
	settings: HomeSettings,
	answers: SetupAnswers,
	detection: SetupDetection,
	planned: PlannedCard[] = planCards(answers, detection),
): SetupOutcome {
	const cards = planned.map((p) => p.card);
	const { dashboard, outcome } = installBoard(settings, answers, cards);

	applyHeader(dashboard, answers);
	applyLook(dashboard, answers);

	settings.setupStatus = "done";
	return outcome;
}

/** The title block: this board's own text, visibility, icon and accent, none of
 * which touches the vault-wide header. */
function applyHeader(dashboard: Dashboard, answers: SetupAnswers): void {
	const header: NonNullable<Dashboard["header"]> = {
		...(dashboard.header ?? {}),
		showTitle: answers.showTitle,
		// An empty title icon is a real override: this board shows the Hearth
		// crystal even in a vault whose global mark is an emoji.
		titleIcon: answers.titleIcon.trim(),
		themeColorTarget: answers.themeColorTarget,
	};
	// A blank title is not an override — it is a user who left the field alone,
	// and a board with an empty title override would show no heading at all.
	const title = answers.title.trim();
	if (title) header.title = title;
	else delete header.title;

	dashboard.header = header;
	dashboard.showSearch = answers.showSearch;
}

/** The look: card surface, spacing and backdrop, all as overrides on the board
 * the wizard just built. */
function applyLook(dashboard: Dashboard, answers: SetupAnswers): void {
	const surface = SURFACE_PRESETS[answers.surface];
	dashboard.cardOpacity = surface.cardOpacity;
	dashboard.cardBlur = surface.cardBlur;
	dashboard.cardRadius = surface.cardRadius;
	dashboard.cardBorderWidth = surface.cardBorderWidth;
	dashboard.compact = answers.compact;

	dashboard.background = plannedBackground(answers);
	dashboard.backgroundLayout = answers.backgroundLayout;
}

/**
 * The backdrop this board wears, as a complete per-dashboard override.
 *
 * All four fields at once, because a board's background override is
 * all-or-nothing (see {@link BannerOverrides}) — and the tuning differs per
 * choice: a photograph needs pushing well back to keep text legible, while a
 * flat colour is *already* legible and fading it only makes it muddy.
 */
function plannedBackground(answers: SetupAnswers): BackgroundConfig {
	const tuning = BACKGROUND_TUNING[answers.background];
	switch (answers.background) {
		case "color":
			return { kind: "color", value: answers.backgroundColor, ...tuning };
		case "weather":
			// A weather background with no place picked would paint nothing at
			// all, which reads as a broken setup rather than a deliberate one —
			// so an unfinished sky falls back to the bundled image.
			return answers.skyValue
				? { kind: "weather", value: answers.skyValue, ...tuning }
				: { kind: "default", value: "", ...BACKGROUND_TUNING.default };
		case "none":
			return { kind: "none", value: "", ...tuning };
		default:
			return { kind: "default", value: "", ...tuning };
	}
}

/**
 * How many grid rows a board may occupy and still be worth squeezing onto one
 * screen.
 *
 * Fit-to-page is Hearth's default and is what makes a board read as a *home
 * screen* rather than a page — but it works by scaling the whole layout down
 * until it fits, so a board twice as tall as the viewport renders every card at
 * half height. The starter board is thirteen rows and squeezes comfortably; a
 * wizard board that picked every purpose can be twice that, and the honest
 * answer for one of those is to let it scroll at its natural size.
 */
const FIT_TO_PAGE_ROW_LIMIT = 16;

/** How many grid rows a set of cards occupies. */
export function boardRows(cards: DashboardCard[]): number {
	return cards.reduce((max, card) => Math.max(max, card.y + card.h), 0);
}

/**
 * Put the cards somewhere: over the active board, or on a new one.
 *
 * "Replace" is offered because the very first run lands on the untouched
 * starter board, where replacing is obviously right; "new dashboard" exists so
 * a later re-run can't destroy a board somebody has spent an evening
 * arranging. The wizard defaults between them on exactly that basis.
 */
function installBoard(
	settings: HomeSettings,
	answers: SetupAnswers,
	cards: DashboardCard[],
): { dashboard: Dashboard; outcome: SetupOutcome } {
	// A tall board scrolls rather than being scaled down to nothing. Stored as a
	// per-dashboard override rather than by changing the global setting, so it
	// only affects the board the wizard built.
	const tall = boardRows(cards) > FIT_TO_PAGE_ROW_LIMIT;

	if (answers.target === "replace") {
		const active =
			settings.dashboards.find((d) => d.id === settings.activeDashboardId) ??
			settings.dashboards[0];
		if (active) {
			active.cards = cards;
			if (answers.dashboardName.trim()) active.name = answers.dashboardName.trim();
			// Only ever *relax* the fit: a board that comfortably fits keeps
			// whatever the user (or the global default) already had.
			if (tall) active.fitToPage = false;
			settings.activeDashboardId = active.id;
			return {
				dashboard: active,
				outcome: { dashboardId: active.id, cardCount: cards.length, replaced: true },
			};
		}
		// No dashboards at all (a hand-emptied data.json); fall through and make
		// one rather than dropping the board on the floor.
	}

	const dashboard: Dashboard = {
		id: newDashboardId(),
		name: answers.dashboardName.trim() || "Home",
		cards,
		...(tall ? { fitToPage: false } : {}),
	};
	settings.dashboards.push(dashboard);
	settings.activeDashboardId = dashboard.id;
	return {
		dashboard,
		outcome: { dashboardId: dashboard.id, cardCount: cards.length, replaced: false },
	};
}

/**
 * The ids of the cards a brand-new vault is seeded with (see `starterCards` in
 * types.ts).
 *
 * Used to tell an untouched starter board from one the user has made their
 * own, which is what decides whether the wizard offers to replace it or to add
 * a dashboard beside it.
 */
const STARTER_CARD_IDS = ["card-clock", "card-daily", "card-calendar", "card-recent", "card-stats"];

/**
 * Whether the active board is still exactly the starter set — same cards, none
 * added, none removed. Card *positions* are ignored: someone who dragged the
 * starter cards around has still not invested anything the wizard would be
 * destroying, and the wizard is about to lay out a new board anyway.
 */
export function isUntouchedStarterBoard(settings: HomeSettings): boolean {
	const active =
		settings.dashboards.find((d) => d.id === settings.activeDashboardId) ??
		settings.dashboards[0];
	if (!active) return true;
	if (active.cards.length !== STARTER_CARD_IDS.length) return false;
	return active.cards.every((card) => STARTER_CARD_IDS.includes(card.id));
}
