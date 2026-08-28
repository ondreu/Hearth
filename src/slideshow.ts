import type { VaultEvent } from "./cardevents";
import type {
	DashboardCard,
	SlideshowAdvance,
	SlideshowConfig,
	SlideshowFit,
	SlideshowOrder,
	SlideshowSource,
	SlideshowTransition,
} from "./types";

/**
 * The slideshow card's pure half: which pictures a card shows, in
 * what order, how fast (or on which day), where it left off, and which vault
 * events are worth a redraw. Data in, data out — no vault, no DOM, no Obsidian
 * imports at all — so all of it is unit-tested in test/slideshow.test.ts.
 *
 * It lives here rather than in `src/cards/slideshow.ts` for the same reason
 * `taskscope.ts` does: the card module imports the settings-modal helpers, which
 * import the card registry, which imports the card module — a cycle that a test
 * importing the card module directly walks straight into. Everything that
 * touches the vault or draws anything stays in the card module.
 */

/** Seconds a picture is held when the card doesn't say. */
export const SLIDESHOW_DEFAULT_INTERVAL_SEC = 8;
/** Longest hold a card can be configured with (an hour) — a guard against a
 * hand-edited data.json, not a limit anyone reaches through the editor. */
export const SLIDESHOW_MAX_INTERVAL_SEC = 3600;
/** Days one picture is held in the daily advance when the card doesn't say. */
export const SLIDESHOW_DEFAULT_DAY_COUNT = 1;
/** Longest daily hold a card can be configured with — a year, past which the
 * card is a fixed picture with extra steps. */
export const SLIDESHOW_MAX_DAY_COUNT = 365;
/** Transition length when the card doesn't say, in milliseconds. */
export const SLIDESHOW_DEFAULT_TRANSITION_MS = 700;
/** Longest transition a card can be configured with. */
export const SLIDESHOW_MAX_TRANSITION_MS = 3000;

/** The orders offered in the editor, in dropdown order. */
export const SLIDESHOW_ORDERS: SlideshowOrder[] = [
	"manual",
	"name",
	"nameDesc",
	"created",
	"createdDesc",
	"modified",
	"modifiedDesc",
	"random",
];

/** The advances offered in the editor, in dropdown order. */
export const SLIDESHOW_ADVANCES: SlideshowAdvance[] = ["timer", "daily", "manual"];

/** The transitions offered in the editor, in dropdown order. */
export const SLIDESHOW_TRANSITIONS: SlideshowTransition[] = ["none", "fade", "slide", "zoom"];

/** The fit modes offered in the editor, in dropdown order. */
export const SLIDESHOW_FITS: SlideshowFit[] = ["cover", "contain"];

/**
 * One picture, reduced to what ordering and drawing need. Deliberately plain
 * data — no `TFile` — so the ordering below is testable without a vault.
 */
export interface SlideshowPicture {
	/** Vault path of the image. */
	path: string;
	/** Basename: the sort key of the by-name orders. */
	name: string;
	/** Vault ctime in ms, or 0 when unknown. */
	created: number;
	/** Vault mtime in ms, or 0 when unknown. */
	modified: number;
	/** Caption from the card's list, when the entry carries one. */
	caption?: string;
}

/** Where a card takes its pictures from, defaulting to the hand-picked list. */
export function slideshowSource(cfg: SlideshowConfig): SlideshowSource {
	return cfg.source === "folder" ? "folder" : "list";
}

/**
 * The order a card actually shows its pictures in. "manual" means "the order the
 * list is in", which a folder has none of — a folder source resolves it to
 * by-name instead, so such a card never falls back to the vault's own arbitrary
 * child order.
 */
export function slideshowOrder(cfg: SlideshowConfig): SlideshowOrder {
	const order = cfg.order ?? "manual";
	if (order === "manual" && slideshowSource(cfg) === "folder") return "name";
	return order;
}

/**
 * What moves the card on to the next picture.
 *
 * Cards saved before this setting existed carry no `advance`, and for them an
 * interval of 0 was the only way to say "stay put" — so those read as "manual"
 * (which is what they already behaved like, and now also remember where they
 * were left). Everything else keeps rotating on its timer.
 */
export function slideshowAdvance(cfg: SlideshowConfig): SlideshowAdvance {
	const advance = cfg.advance;
	if (advance === "timer" || advance === "daily" || advance === "manual") return advance;
	return slideshowIntervalMs(cfg) === 0 ? "manual" : "timer";
}

/** How many days one picture is held in the daily advance. Always at least one
 * day: a "0-day" picture would be a rotation with no clock to drive it. */
export function slideshowDayCount(cfg: SlideshowConfig): number {
	const days = cfg.dayCount ?? SLIDESHOW_DEFAULT_DAY_COUNT;
	if (!Number.isFinite(days)) return SLIDESHOW_DEFAULT_DAY_COUNT;
	return Math.min(Math.max(Math.floor(days), 1), SLIDESHOW_MAX_DAY_COUNT);
}

/**
 * The local calendar day as a whole number of days since the epoch — the unit
 * the daily advance counts in.
 *
 * Deliberately built from the *local* year/month/day rather than from the
 * timestamp: a picture changes at the viewer's own midnight, and the difference
 * between two of these numbers is a count of calendar days even across a
 * daylight-saving change, which dividing milliseconds is not.
 */
export function slideshowDayNumber(at: number | Date = Date.now()): number {
	const date = typeof at === "number" ? new Date(at) : at;
	return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * Which slot of `dayCount` days a moment falls in. Slots are counted from the
 * epoch, not from when the card was made, so every card with the same day count
 * turns over on the same day and the changeover never drifts.
 */
export function slideshowPeriod(at: number | Date, dayCount: number): number {
	const days = Number.isFinite(dayCount) ? Math.max(1, Math.floor(dayCount)) : 1;
	return Math.floor(slideshowDayNumber(at) / days);
}

/** Milliseconds until just after the next local midnight — when a daily card
 * has to look at the calendar again. A second past it, so a wake-up that fires
 * a hair early doesn't read the day it was already on. */
export function msUntilNextDay(at: number | Date = Date.now()): number {
	const date = typeof at === "number" ? new Date(at) : at;
	const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 1, 0);
	return Math.max(1000, midnight.getTime() - date.getTime());
}

/**
 * Where a card was left: the picture it was showing and — for the daily
 * advance — the day slot that picture was chosen for.
 *
 * This is the whole of what a slideshow remembers between sessions. It is
 * stored per card outside the layout (see `src/cards/slideshow.ts`), because
 * which picture this machine is looking at is not a setting worth syncing.
 */
export interface SlideshowPosition {
	/** Vault path of the picture the card was left on. */
	path?: string;
	/** The day slot `path` was chosen for (daily advance only). */
	period?: number;
}

/**
 * The picture a daily card should be showing now.
 *
 * The remembered position is an anchor — "this picture, on that day" — and the
 * card walks one picture forward for each day slot that has passed since. So
 * the answer depends only on the calendar and on where the card was last left:
 * redrawing the board, switching dashboards or restarting Obsidian all land on
 * the same picture, and stepping by hand simply re-anchors the walk.
 *
 * A clock that went backwards (or a position from a card whose day count has
 * since grown) yields no steps rather than a jump backwards, and a card with no
 * anchor yet starts at the first picture.
 */
export function dailySlideIndex(
	paths: readonly string[],
	position: SlideshowPosition | undefined,
	period: number,
): number {
	const count = paths.length;
	if (count === 0) return 0;
	const anchored = position?.path ? paths.indexOf(position.path) : -1;
	// A picture that has since left the set takes its place in the walk with it;
	// the card restarts from the top rather than guessing at a replacement.
	const base = anchored >= 0 ? anchored : 0;
	const from = position?.period;
	if (typeof from !== "number" || !Number.isFinite(from)) return base;
	const steps = Math.floor(period) - Math.floor(from);
	if (steps <= 0) return base;
	return (base + steps) % count;
}

/** How long one picture is held, in milliseconds. 0 means "don't rotate" —
 * either the card asked for it (interval 0) or the stored value is unusable. */
export function slideshowIntervalMs(cfg: SlideshowConfig): number {
	const seconds = cfg.intervalSec ?? SLIDESHOW_DEFAULT_INTERVAL_SEC;
	if (!Number.isFinite(seconds) || seconds <= 0) return 0;
	return Math.min(seconds, SLIDESHOW_MAX_INTERVAL_SEC) * 1000;
}

/** How long one picture takes to give way to the next, in milliseconds. */
export function slideshowTransitionMs(cfg: SlideshowConfig): number {
	const ms = cfg.transitionMs ?? SLIDESHOW_DEFAULT_TRANSITION_MS;
	if (!Number.isFinite(ms) || ms < 0) return SLIDESHOW_DEFAULT_TRANSITION_MS;
	return Math.min(ms, SLIDESHOW_MAX_TRANSITION_MS);
}

/** A folder path in the form the scope test wants: no leading or trailing
 * slash, with the vault root as the empty string. */
export function normalizeFolderPath(folder: string | undefined): string {
	return (folder ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Whether `path` is inside the card's folder scope. Without `includeSubfolders`
 * only direct children count, so a folder of albums doesn't silently pull in
 * every album. An empty (or "/") scope is the vault root.
 */
export function inSlideshowFolder(
	folder: string | undefined,
	path: string,
	includeSubfolders = false,
): boolean {
	const scope = normalizeFolderPath(folder);
	const prefix = scope === "" ? "" : `${scope}/`;
	if (!path.startsWith(prefix)) return false;
	const rest = path.slice(prefix.length);
	if (rest === "") return false;
	return includeSubfolders || !rest.includes("/");
}

/** Whether `path` is the scope folder itself or one of its ancestors — the
 * shapes a rename can take that move the whole scope somewhere else. */
function holdsFolderScope(folder: string | undefined, path: string): boolean {
	const scope = normalizeFolderPath(folder);
	if (scope === "") return false;
	return scope === path || scope.startsWith(`${path}/`);
}

/** Whether a listed path is, or lives under, an event's path. Covers a folder
 * rename, which arrives as one event for the folder rather than one per file. */
function pathTouches(listed: string, path: string): boolean {
	return listed === path || listed.startsWith(`${path}/`);
}

/**
 * Whether a vault event can change what a slideshow card shows.
 *
 * Only existence events can: a file edit or a metadata reparse never adds or
 * removes a picture, and redrawing on either would restart the rotation from the
 * first slide every time an unrelated note was saved. Beyond that the test is
 * deliberately generous — a needless redraw costs one image decode, while a
 * missed one leaves a folder card blind to the photo just dropped into it.
 */
export function slideshowReactsTo(card: DashboardCard, ev: VaultEvent): boolean {
	if (ev.kind === "modify" || ev.kind === "meta") return false;
	const cfg = card.slideshow ?? {};
	const paths = ev.oldPath ? [ev.file.path, ev.oldPath] : [ev.file.path];
	if (slideshowSource(cfg) === "folder") {
		return paths.some(
			(path) =>
				inSlideshowFolder(cfg.folder, path, cfg.includeSubfolders === true) ||
				holdsFolderScope(cfg.folder, path),
		);
	}
	const listed = (cfg.slides ?? []).map((slide) => slide.path);
	return paths.some((path) => listed.some((entry) => pathTouches(entry, path)));
}

/** Fisher-Yates, in place — the shuffle behind the "random" order. */
export function shufflePictures<T>(items: T[]): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

/** FNV-1a over the seed string — small, fast, and stable across sessions,
 * which `Math.random()` is precisely not. */
function hashSeed(seed: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * The same shuffle, but reproducible: the same seed always deals the same
 * order. A daily card needs one — it has to show the same picture all day
 * however many times the board is redrawn, and a fresh `Math.random()` shuffle
 * on every redraw would make "random" mean "a different picture every time the
 * board so much as blinks". Seeded with the card's id, so two random cards over
 * the same folder still differ. In place, like its sibling above.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
	// mulberry32: one multiply-xor round per number, plenty for dealing an order.
	let state = hashSeed(seed) || 1;
	const random = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

/**
 * The pictures in display order. Every comparison falls back to the path, so two
 * files sharing a name or a timestamp keep a stable order instead of reshuffling
 * themselves on every redraw. "manual" is the input order; "random" is a fresh
 * shuffle. Never mutates its input.
 */
export function orderPictures(
	pictures: SlideshowPicture[],
	order: SlideshowOrder,
	seed?: string,
): SlideshowPicture[] {
	const sorted = [...pictures];
	const byPath = (a: SlideshowPicture, b: SlideshowPicture) => a.path.localeCompare(b.path);
	switch (order) {
		case "manual":
			return sorted;
		case "random":
			// With a seed the deal is fixed (see seededShuffle): the caller needs the
			// same order back on every redraw, not a new one.
			return seed === undefined ? shufflePictures(sorted) : seededShuffle(sorted, seed);
		case "name":
			return sorted.sort((a, b) => a.name.localeCompare(b.name) || byPath(a, b));
		case "nameDesc":
			return sorted.sort((a, b) => b.name.localeCompare(a.name) || byPath(a, b));
		case "created":
			return sorted.sort((a, b) => a.created - b.created || byPath(a, b));
		case "createdDesc":
			return sorted.sort((a, b) => b.created - a.created || byPath(a, b));
		case "modified":
			return sorted.sort((a, b) => a.modified - b.modified || byPath(a, b));
		case "modifiedDesc":
			return sorted.sort((a, b) => b.modified - a.modified || byPath(a, b));
	}
}

/** What a picture is called on screen: its own caption, or the file's basename. */
export function pictureLabel(picture: SlideshowPicture): string {
	return picture.caption?.trim() || picture.name;
}


// ---- Remembered positions ------------------------------------------------

/** How many cards' positions the store keeps. A ceiling, not a target: cards
 * are deleted without telling anyone, so the store is bounded rather than
 * cleaned. Well past any believable number of slideshow cards in one vault. */
export const SLIDESHOW_POSITIONS_MAX = 200;

/** The stored positions of every card, keyed by card id. */
export type SlideshowPositions = Record<string, SlideshowPosition>;

/** Read a stored blob back into positions, dropping anything that isn't one —
 * the value comes from local storage, which nothing guarantees the shape of. */
export function sanitizeSlideshowPositions(raw: unknown): SlideshowPositions {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const positions: SlideshowPositions = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!value || typeof value !== "object") continue;
		const entry = value as Record<string, unknown>;
		const position: SlideshowPosition = {};
		if (typeof entry.path === "string" && entry.path) position.path = entry.path;
		if (typeof entry.period === "number" && Number.isFinite(entry.period)) {
			position.period = Math.floor(entry.period);
		}
		if (position.path !== undefined || position.period !== undefined) positions[id] = position;
	}
	return positions;
}

/**
 * The store with one card's position written into it, oldest entries dropped
 * once it is over the cap. Re-inserting the key rather than assigning it moves
 * the card to the end, so "oldest" means "least recently seen" — a card that is
 * still on a board is written every time it is drawn and never ages out.
 */
export function rememberSlideshowPosition(
	store: SlideshowPositions,
	cardId: string,
	position: SlideshowPosition,
	max = SLIDESHOW_POSITIONS_MAX,
): SlideshowPositions {
	const next: SlideshowPositions = {};
	for (const [id, value] of Object.entries(store)) {
		if (id !== cardId) next[id] = value;
	}
	next[cardId] = position;
	const ids = Object.keys(next);
	for (const id of ids.slice(0, Math.max(0, ids.length - Math.max(1, max)))) delete next[id];
	return next;
}
