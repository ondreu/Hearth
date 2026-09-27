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
 * ⚠️ **The wizard writes one global setting, once.** Every other answer it
 * collects lands on the dashboard it builds — as a per-dashboard override (the
 * header, the card surface, the background, compact spacing) or in a card's
 * own config (the TaskNotes field mapping) — so running setup, or re-running
 * it later, cannot change how any *other* board looks or how Hearth behaves
 * vault-wide. The only fields of {@link HomeSettings} touched here are the
 * structural ones that installing a board *is*: the `dashboards` list,
 * `activeDashboardId`, and the `setupStatus` flag that stops the wizard
 * offering itself twice.
 *
 * The exception is the Design (Classic or Expressive), because it is not only
 * a board's look: in Expressive it dresses all of Hearth's interface — its
 * dialogs, menus and settings pane (see src/uidesign.ts) — which no board-level
 * override can reach. So the *first* setup (the one a new vault gets, or the
 * first one a user who skipped it runs) writes it vault-wide, with the drawn
 * background's design alongside; any later run writes both onto the board it
 * builds, like every other answer. See {@link applyDesign}.
 */
import { ensureLayout } from "../grid";
import {
	type BackgroundConfig,
	type BackgroundLayout,
	type CardDesign,
	type DashboardCard,
	type Dashboard,
	type HomeSettings,
	type TemplaterItem,
	type WeatherPlace,
	newDashboardId,
} from "../types";
import { parseSkyValue } from "../sky";
import { templateDisplayName } from "../templater";
import { t } from "../i18n";
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
export type SetupBackground = "default" | "harbour" | "weather" | "color" | "none";

/** Every background choice, in wizard order. */
export const SETUP_BACKGROUNDS: readonly SetupBackground[] = [
	"default",
	"harbour",
	"weather",
	"color",
	"none",
];

/**
 * The backdrop's opacity and blur per choice.
 *
 * Not one set of numbers for all of them: a photograph needs to be pushed well
 * back to keep text legible, while a flat colour — or Hearth's own flat, muted
 * wallpaper — is *already* legible and fading it only makes it muddy.
 */
const BACKGROUND_TUNING: Record<SetupBackground, { opacity: number; blur: number }> = {
	default: { opacity: 0.8, blur: 0 },
	harbour: { opacity: 0.8, blur: 0 },
	weather: { opacity: 0.6, blur: 0 },
	color: { opacity: 1, blur: 0 },
	none: { opacity: 0.35, blur: 2 },
};

/** The backdrop's opacity and blur for a background choice. */
export function backgroundTuning(background: SetupBackground): { opacity: number; blur: number } {
	return BACKGROUND_TUNING[background];
}

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
	/** Classic or Expressive — for the cards, the drawn background and, on a
	 * first setup, all of Hearth's interface (see {@link applyDesign}). */
	design: CardDesign;
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
	/** Feed for the Reading card. The card is only planned once there is one:
	 * an RSS card with no feed is an empty box on a brand-new board. */
	feedUrl: string;
	/** Where the Weather card forecasts for. Same rule as the feed — no place,
	 * no card. A live-sky background's place stands in when this is unset. */
	weatherPlace?: WeatherPlace;
	/** Whether the board gets a clock. A small card in the side column, not the
	 * full-width strip every board used to open with. */
	clock: boolean;

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

		design: settings.cardDesign ?? "classic",
		surface: "glass",
		compact: false,
		background: "default",
		backgroundColor: "#1e1b2e",
		skyValue: "",
		backgroundLayout: "full",

		purposes,
		feedUrl: "",
		clock: true,

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

/** The two columns a planned board is laid out in: the working cards on the
 * left, small at-a-glance cards (the clock, a mini calendar, the weather) down
 * the right. */
const MAIN_COLUMNS = 8;
const SIDE_COLUMNS = PLAN_COLUMNS - MAIN_COLUMNS;

/** Which column a planned card belongs in. */
type PlanSlot = "main" | "side";

/** Main-column cards that read as well in the narrow side column, and so may
 * move there to even the columns out. The day's note and the task list stay
 * where the eye lands first. */
const MOVABLE = new Set([
	"recent",
	"favorites",
	"bookmarks",
	"rss",
	"dataview",
	"datacore",
	"operon",
	"git",
]);

/**
 * Decide which cards the board gets, configured and laid out.
 *
 * Two rules shape every board built here:
 *
 *  - **No card arrives empty.** A card that opens on "Add a feed in card
 *    settings" reads as broken, and on a first board it reads as Hearth being
 *    broken. So a card that needs something only the user can give (a feed, a
 *    place) is planned only once it has it, and a launchpad is seeded with
 *    actions that work on any vault.
 *  - **The layout has no holes.** Working cards fill a main column, glanceable
 *    ones a side column, and each card then stretches into any space beside or
 *    just below it — so the result reads as a designed home screen rather than
 *    a shelf of widgets.
 *
 * `newId` is injectable so tests get stable ids; it defaults to the same
 * scheme the card picker uses.
 */
export function planCards(
	answers: SetupAnswers,
	detection: SetupDetection,
	newId: (index: number) => string = defaultCardId,
): PlannedCard[] {
	const drafts: { id: string; reason: string; slot: PlanSlot; card: CardDraft }[] = [];
	const add = (
		id: string,
		reason: string,
		slot: PlanSlot,
		card: Omit<CardDraft, "x" | "y">,
	): void => {
		if (drafts.some((p) => p.id === id)) return;
		drafts.push({ id, reason, slot, card: { ...card, x: -1, y: -1 } });
	};

	if (answers.clock) {
		add("clock", "clock", "side", { kind: "clock", title: "", w: 4, h: 2 });
	}

	if (wants(answers, "daily") || accepted(answers, "dailyNotes")) {
		add("daily", wants(answers, "daily") ? "daily" : "dailyNotes", "main", {
			kind: "daily",
			title: "Today",
			w: 4,
			h: 5,
		});
	}

	if (wants(answers, "tasks") || accepted(answers, "tasknotes") || accepted(answers, "kanban")) {
		add("tasks", taskReason(answers), "main", {
			kind: "tasks",
			title: "Tasks",
			w: 4,
			h: 5,
			tasks: planTasksConfig(answers, detection),
		});
	}

	if (wants(answers, "planning")) {
		add("schedule", "planning", "main", {
			kind: "schedule",
			title: "Calendar",
			w: 8,
			h: 6,
			schedule: accepted(answers, "tasknotes") ? { taskNotes: { enabled: true } } : {},
		});
	} else if (wants(answers, "daily")) {
		// No full calendar, but a board with a daily note on it still wants a
		// month at a glance to move between days.
		add("calendar", "daily", "side", { kind: "calendar", title: "Calendar", w: 4, h: 4 });
	}

	const place = weatherPlace(answers);
	if (wants(answers, "ambience") && place) {
		add("weather", "ambience", "side", {
			kind: "weather",
			title: "Weather",
			weather: { place },
			w: 4,
			h: 3,
		});
	}

	if (wants(answers, "insights")) {
		add("stats", "insights", "side", { kind: "stats", title: "Vault", w: 4, h: 2 });
	}

	if (wants(answers, "capture")) {
		// One launchpad of actions every vault has, rather than two empty ones
		// waiting to be filled: it works on the first click and shows what the
		// card is for, and adding your own is then an edit, not a chore.
		add("commands", "capture", "main", {
			kind: "commands",
			title: "Quick actions",
			commands: quickActions(detection),
			tileSizing: "scale",
			w: 8,
			h: 2,
		});
	}

	if (accepted(answers, "templater") && detection.templaterTemplates.length > 0) {
		add("templater", "templater", "main", {
			kind: "templater",
			title: "New note",
			// Seeded with the vault's own templates rather than left blank: an
			// empty launchpad is indistinguishable from a broken one, and the
			// destination is the one thing the user still has to fill in — which
			// they can only do once there is a tile to fill it in on.
			templater: { items: detection.templaterTemplates.map(templaterTile) },
			w: 8,
			h: 2,
		});
	}

	if (wants(answers, "browsing")) {
		add("recent", "browsing", "main", { kind: "recent", title: "Recent", count: 8, w: 4, h: 4 });
		add("favorites", "browsing", "main", { kind: "favorites", title: "Favorites", fileView: "list", w: 4, h: 4 });
	}

	if (accepted(answers, "bookmarks")) {
		add("bookmarks", "bookmarks", "main", { kind: "bookmarks", title: "Bookmarks", w: 4, h: 4 });
	}

	if (wants(answers, "insights")) {
		add("heatmap", "insights", "main", {
			kind: "heatmap",
			title: "Activity",
			heatmap: {},
			w: 8,
			h: 3,
		});
	}

	const feed = feedUrl(answers);
	if (wants(answers, "reading") && feed) {
		add("rss", "reading", "main", {
			kind: "rss",
			title: "Reading",
			rss: { sources: [{ id: "feed-1", name: "", url: feed }] },
			w: 4,
			h: 5,
		});
	}

	if (accepted(answers, "dataview")) {
		add("dataview", "dataview", "main", {
			kind: "dataview",
			title: "Dataview",
			// Seeded with a query rather than left blank: an empty Dataview card
			// is indistinguishable from a broken one, and "the notes I touched
			// most recently" is both obviously useful and obviously editable.
			dataview: { query: "LIST\nSORT file.mtime DESC\nLIMIT 10", language: "dql" },
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "datacore")) {
		add("datacore", "datacore", "main", {
			kind: "datacore",
			title: "Datacore",
			datacore: {},
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "operon")) {
		// The list view, not the board: it is the one Operon view that reads
		// correctly at any size, needs no pipeline chosen for it, and asks only
		// for the read capabilities Hearth requests by default. A board seeded
		// with someone else's idea of which pipeline matters is a worse first
		// impression than a list of what is due.
		add("operon", "operon", "main", {
			kind: "operon",
			title: "Operon",
			operon: { view: "list" },
			w: 4,
			h: 4,
		});
	}

	if (accepted(answers, "git")) {
		add("git", "git", "main", { kind: "git", title: "Git", git: {}, w: 4, h: 4 });
	}

	if (accepted(answers, "bases") && detection.basePath) {
		add("base", "bases", "main", {
			kind: "embed",
			title: baseTitle(detection.basePath),
			target: detection.basePath,
			w: 8,
			h: 5,
		});
	}

	if (wants(answers, "ambience")) {
		add("pet", "ambience", "side", { kind: "pet", title: "Pet", pet: {}, w: 4, h: 3 });
	}

	// Lay out once, over the whole plan, so the geometry the review step
	// previews is exactly the geometry the board is saved with.
	const cards: DashboardCard[] = drafts.map((draft, i) => ({ ...draft.card, id: newId(i) }));
	layoutPlan(
		cards,
		drafts.map((d) => d.slot),
		drafts.map((d) => MOVABLE.has(d.id)),
	);
	return drafts.map((draft, i) => ({ id: draft.id, reason: draft.reason, card: cards[i] }));
}

/** The place the Weather card forecasts for: the one picked for it, else the
 * live sky's, so a user who has just told the background where they are isn't
 * asked again. */
export function weatherPlace(answers: SetupAnswers): WeatherPlace | undefined {
	if (answers.weatherPlace) return answers.weatherPlace;
	if (answers.background !== "weather") return undefined;
	const sky = parseSkyValue(answers.skyValue);
	return sky?.mode === "live" ? sky.place : undefined;
}

/** The feed URL, when it is one an RSS card can fetch. */
export function feedUrl(answers: SetupAnswers): string {
	const url = answers.feedUrl.trim();
	return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

/** The Quick actions card's buttons: core commands present in every vault,
 * plus today's note when Daily notes is on. */
function quickActions(detection: SetupDetection): NonNullable<DashboardCard["commands"]> {
	const names = t().setup.plan.actions;
	const actions: NonNullable<DashboardCard["commands"]> = [
		{ id: "file-explorer:new-file", name: names.newNote, icon: "file-plus-2" },
	];
	if (detection.integrations.some((i) => i.id === "dailyNotes")) {
		actions.push({ id: "daily-notes", name: names.today, icon: "calendar-check" });
	}
	actions.push(
		{ id: "switcher:open", name: names.switcher, icon: "file-search" },
		{ id: "global-search:open", name: names.search, icon: "search" },
		{ id: "command-palette:open", name: names.palette, icon: "terminal-square" },
	);
	return actions;
}

/**
 * Place the planned cards: the working cards in a main column, the glanceable
 * ones down a side column beside it.
 *
 * A side column needs at least two cards to be worth its width — one lone
 * clock beside a tall column of work is a strip of empty board — so with fewer
 * everything shares one full-width grid instead, the working cards widened to
 * match. With many cards the main column runs long, so narrow cards that can
 * live anywhere move across while that makes the board shorter.
 */
function layoutPlan(cards: DashboardCard[], slots: PlanSlot[], movable: boolean[]): void {
	const sizes = cards.map((card) => ({ w: card.w, h: card.h }));

	const place = (side: Set<number>): number => {
		cards.forEach((card, i) => {
			card.x = -1;
			card.y = -1;
			card.w = sizes[i].w;
			card.h = sizes[i].h;
		});
		const main = cards.filter((_, i) => !side.has(i));
		const aside = cards.filter((_, i) => side.has(i));
		if (main.length > 0 && aside.length >= 2) {
			packColumn(main, MAIN_COLUMNS, 0);
			packColumn(aside, SIDE_COLUMNS, MAIN_COLUMNS);
		} else {
			// Side cards first, so the clock still leads the board.
			for (const card of main) card.w = Math.min(PLAN_COLUMNS, Math.round(card.w * 1.5));
			packColumn([...aside, ...main], PLAN_COLUMNS, 0);
		}
		settleBottoms(cards);
		return boardRows(cards);
	};

	let side = new Set(slots.flatMap((slot, i) => (slot === "side" ? [i] : [])));
	let rows = place(side);
	if (side.size >= 2) {
		// Latest first: the cards a purpose adds last are the least central.
		for (let i = cards.length - 1; i >= 0; i--) {
			if (side.has(i) || !movable[i] || sizes[i].w > SIDE_COLUMNS) continue;
			const trial = new Set(side).add(i);
			const trialRows = place(trial);
			if (trialRows < rows) {
				side = trial;
				rows = trialRows;
			}
		}
	}
	place(side);
}

/** Pack `cards` into a column `columns` wide starting at grid column `offset`,
 * then let each card widen into free space on its right and grow down into a
 * hole beside a taller neighbour. */
function packColumn(cards: DashboardCard[], columns: number, offset: number): void {
	ensureLayout(cards, columns);
	const taken = occupancy(cards, columns);
	for (const card of cards) {
		while (card.x + card.w < columns && free(taken, card.x + card.w, card.y, 1, card.h)) {
			mark(taken, card.x + card.w, card.y, 1, card.h);
			card.w += 1;
		}
	}
	for (const card of [...cards].sort((p, q) => p.y - q.y)) {
		for (;;) {
			const row = card.y + card.h;
			// Only into a row something else in this column already uses: that
			// is a hole, where an empty row is simply the end of the column.
			const inUse = taken[row]?.some(Boolean) ?? false;
			if (!inUse || !free(taken, card.x, row, card.w, 1)) break;
			mark(taken, card.x, row, card.w, 1);
			card.h += 1;
		}
	}
	for (const card of cards) card.x += offset;
}

/** The most rows a card is stretched down to meet the board's bottom edge —
 * enough to square off a ragged edge, not so many that a clock becomes a
 * tower. */
const SETTLE_ROWS = 3;

/** Stretch the lowest card of each column down to the board's bottom edge when
 * the gap is small, so the columns end level. */
function settleBottoms(cards: DashboardCard[]): void {
	const bottom = boardRows(cards);
	const taken = occupancy(cards, PLAN_COLUMNS);
	// Lowest cards first: a card can only grow into rows nothing sits in.
	const order = [...cards].sort((a, b) => b.y + b.h - (a.y + a.h));
	for (const card of order) {
		const gap = bottom - (card.y + card.h);
		if (gap <= 0 || gap > SETTLE_ROWS) continue;
		if (!free(taken, card.x, card.y + card.h, card.w, gap)) continue;
		mark(taken, card.x, card.y + card.h, card.w, gap);
		card.h += gap;
	}
}

/** Which cells of a `columns`-wide grid the cards cover, row by row. */
function occupancy(cards: DashboardCard[], columns: number): boolean[][] {
	const taken: boolean[][] = [];
	for (const card of cards) mark(taken, card.x, card.y, Math.min(card.w, columns - card.x), card.h);
	return taken;
}

function free(taken: boolean[][], x: number, y: number, w: number, h: number): boolean {
	for (let r = y; r < y + h; r++) {
		for (let c = x; c < x + w; c++) if (taken[r]?.[c]) return false;
	}
	return true;
}

function mark(taken: boolean[][], x: number, y: number, w: number, h: number): void {
	for (let r = y; r < y + h; r++) {
		taken[r] ??= [];
		for (let c = x; c < x + w; c++) taken[r][c] = true;
	}
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
	// Read before anything is installed: this run is the first setup unless
	// one has already finished.
	const firstSetup = settings.setupStatus !== "done";
	const cards = planned.map((p) => p.card);
	const { dashboard, outcome } = installBoard(settings, answers, cards);

	applyHeader(dashboard, answers);
	applyLook(dashboard, answers);
	applyDesign(settings, dashboard, answers.design, firstSetup);

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
 * the wizard just built. The surface is Classic's only — an Expressive card
 * has its own opaque tonal frame that none of the four shape — so an
 * Expressive board is left following the vault's values rather than given a
 * preset the wizard never offered. */
function applyLook(dashboard: Dashboard, answers: SetupAnswers): void {
	if (answers.design === "classic") {
		const surface = SURFACE_PRESETS[answers.surface];
		dashboard.cardOpacity = surface.cardOpacity;
		dashboard.cardBlur = surface.cardBlur;
		dashboard.cardRadius = surface.cardRadius;
		dashboard.cardBorderWidth = surface.cardBorderWidth;
	}
	dashboard.compact = answers.compact;

	dashboard.background = plannedBackground(answers);
	dashboard.backgroundLayout = answers.backgroundLayout;
}

/**
 * Classic or Expressive, for the cards and the drawn background (Hearth's
 * wallpaper, the harbour, the weather sky).
 *
 * On the first setup it is the vault's Design and background design, and the
 * board keeps no override of either — so the board, the settings pane and
 * every dialog agree, and the one switch in Settings changes them all
 * afterwards. On any later run it is written onto the new board only, which
 * is then Expressive or Classic whatever the vault is.
 */
export function applyDesign(
	settings: HomeSettings,
	dashboard: Dashboard,
	design: CardDesign,
	firstSetup: boolean,
): void {
	if (firstSetup) {
		// Classic, the default, is stored as absence — as the settings do.
		settings.cardDesign = design === "expressive" ? "expressive" : undefined;
		settings.backgroundSkyDesign = design === "expressive" ? "expressive" : undefined;
		delete dashboard.cardDesign;
		delete dashboard.backgroundSkyDesign;
		return;
	}
	dashboard.cardDesign = design;
	dashboard.backgroundSkyDesign = design;
}

/**
 * The backdrop this board wears, as a complete per-dashboard override.
 *
 * All four fields at once, because a board's background override is
 * all-or-nothing (see {@link BannerOverrides}) — and the tuning differs per
 * choice: a photograph needs pushing well back to keep text legible, while a
 * flat colour is *already* legible and fading it only makes it muddy.
 */
export function plannedBackground(answers: SetupAnswers): BackgroundConfig {
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
		case "harbour":
			return { kind: "harbour", value: "", ...tuning };
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
