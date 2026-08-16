import { Component, type DropdownComponent, Setting } from "obsidian";
import { localDayKey } from "../dates";
import { t } from "../i18n";
import { type DashboardCard, type PetConfig, type PetSpecies, motionAllowed } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Pet ----------------------------------------------------------------
//
// A pixel-art companion that reacts to how much you write. Deliberately a
// one-way mood ladder: there is no hunger, no age, no illness and no way to
// lose the pet — a quiet vault only makes it bored and then sleepy, and any
// activity wakes it straight back up. Every mood is *derived* on render from
// vault timestamps rather than simulated on a timer, so closing Obsidian for a
// month, or syncing data.json between machines, cannot desynchronise anything.
//
// The sprites are 16×16 character grids (no image assets): one shared body plus
// a per-species head, painted with a face for the current mood and emitted as a
// run-length-encoded SVG of at most a few dozen rects.


/** The mood ladder, quietest first. Nothing below "sleepy" exists. */
export type PetMood = "sleepy" | "bored" | "content" | "happy" | "excited";

/** Every species, in the order the editor offers them. */
export const PET_SPECIES: PetSpecies[] = ["cat", "dog", "bird", "fox", "frog", "blob"];

/** Notes touched today that count as a good day, when the card doesn't say. */
export const PET_DEFAULT_GOAL = 3;

/** Notes touched today for "content", when the card doesn't say: any at all. */
export const PET_DEFAULT_CONTENT = 1;

/** How long a petting keeps the pet at least happy, when the card doesn't say. */
export const PET_PETTED_MS = 30 * 60 * 1000;

/** The pet dozes off once nothing in the vault has been touched for this long
 * — whatever its mood — and any activity wakes it again. */
export const PET_SLEEPY_AFTER_MS = 6 * 60 * 60 * 1000;

/** How often the card re-derives its mood without a vault event, so a pet left
 * on screen still drifts from bored to sleepy (and out of a petting). */
const PET_TICK_MS = 5 * 60 * 1000;


// ---- Mood ---------------------------------------------------------------

/** Where each rung of the ladder starts. Every one is settable per card. */
export interface PetThresholds {
	/** Notes today for "content". */
	content: number;
	/** Notes today for "happy". */
	happy: number;
	/** Notes today for "excited". */
	excited: number;
	/** Quiet vault, in any mood, before the pet falls asleep. */
	sleepyAfterMs: number;
	/** How long a petting holds the pet at happy. */
	pettedMs: number;
}

/**
 * Resolve a card's thresholds, filling in defaults and forcing the rungs into
 * order. Sliders can be dragged into nonsense (excited below happy, content
 * above both) and a card can arrive from an older version or a hand-edited
 * `data.json`; rather than produce an unreachable mood, each rung is raised to
 * at least the one below it, so the ladder always climbs.
 */
export function thresholdsFor(cfg: PetConfig): PetThresholds {
	const positive = (value: number | undefined, fallback: number) =>
		typeof value === "number" && value > 0 ? Math.floor(value) : fallback;
	const happy = positive(cfg.dailyGoal, PET_DEFAULT_GOAL);
	const content = Math.min(positive(cfg.contentAt, PET_DEFAULT_CONTENT), happy);
	const excited = Math.max(positive(cfg.excitedAt, happy * 2), happy);
	return {
		content,
		happy,
		excited,
		sleepyAfterMs: positive(cfg.sleepyAfterMin, PET_SLEEPY_AFTER_MS / 60000) * 60000,
		pettedMs: positive(cfg.pettedForMin, PET_PETTED_MS / 60000) * 60000,
	};
}

/** Default night window: 23:00 to 07:00. */
export const PET_DEFAULT_NIGHT: [number, number] = [23, 7];

/** Clamp an hour to a whole 0–23, falling back when it is missing or absurd. */
function hourOr(value: number | undefined, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const hour = Math.floor(value);
	return hour >= 0 && hour <= 23 ? hour : fallback;
}

/**
 * Is `date`'s local hour inside the card's night window? The window wraps
 * midnight (23 → 7 is the default and the normal case), and a window whose
 * ends are equal is treated as no window at all rather than as all day —
 * "from 9 to 9" is much more likely a half-set slider than a request for a pet
 * that sleeps around the clock.
 */
export function inNightWindow(date: Date, cfg: PetConfig): boolean {
	const from = hourOr(cfg.nightFrom, PET_DEFAULT_NIGHT[0]);
	const to = hourOr(cfg.nightTo, PET_DEFAULT_NIGHT[1]);
	if (from === to) return false;
	const hour = date.getHours();
	return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Everything the mood is derived from. Pure input, so the ladder below can be
 * unit-tested without a vault. */
export interface PetPulse {
	/** Notes touched (edited or created) today. */
	today: number;
	/** Where the rungs of the ladder sit for this card. */
	thresholds: PetThresholds;
	/** Age of the freshest note in the vault, or null for an empty vault. */
	sinceLastMs: number | null;
	/** Time since the pet was last petted, or null if it never was. */
	pettedMsAgo: number | null;
	/** What the clock is allowed to do, and whether it is night right now. */
	night?: { mode: NonNullable<PetConfig["nightSleep"]>; now: boolean };
}

/**
 * The mood ladder.
 *
 * How the day went sets the rung: excited, happy or content at the thresholds
 * the card holds, bored on a day with nothing on it yet.
 *
 * On top of that sits one rule that outranks the day entirely — the pet sleeps
 * once the vault has been quiet for the card's idle time, however brilliant
 * the day was, and any activity at all wakes it straight back up. A pet that
 * wrote twenty notes this morning and nothing since is asleep by evening, and
 * one keystroke in a note brings it back to the rung its day earned.
 *
 * Then the clock, if the card lets it speak, and finally a petting — which can
 * only ever lift the pet, so it is never unwakeable.
 */
export function moodFor(pulse: PetPulse): PetMood {
	const limits = pulse.thresholds;
	const petted =
		pulse.pettedMsAgo != null && pulse.pettedMsAgo >= 0 && pulse.pettedMsAgo < limits.pettedMs;
	let mood: PetMood;
	if (pulse.today >= limits.excited) mood = "excited";
	else if (pulse.today >= limits.happy) mood = "happy";
	else if (pulse.today >= limits.content) mood = "content";
	else mood = "bored";
	// Idleness beats the day: a quiet vault puts any pet to sleep, and only a
	// vault that has been touched recently keeps one awake. An empty vault has
	// no timestamp to be recent, so its pet sleeps.
	if (pulse.sinceLastMs == null || pulse.sinceLastMs >= limits.sleepyAfterMs) mood = "sleepy";
	// The clock, if the card lets it speak. "quiet" reaches a bored or content
	// pet: at two in the morning a thin day is the hour, not neglect. A good
	// day still shows as a good day. "always" puts the pet to bed regardless.
	if (pulse.night?.now) {
		if (pulse.night.mode === "always") mood = "sleepy";
		else if (pulse.night.mode === "quiet" && (mood === "bored" || mood === "content")) {
			mood = "sleepy";
		}
	}
	// Petting is the last word in every mode, so a pet is never unwakeable.
	if (petted && mood !== "excited") mood = "happy";
	return mood;
}

/**
 * Consecutive days with any activity, ending today. A day with nothing on it
 * yet doesn't break the streak — the count then runs back from yesterday, so
 * the number only ever drops once a whole day has passed unwritten.
 */
export function activityStreak(counts: Map<string, number>, today: Date): number {
	const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	// Skip today when it is still empty, so a morning with no notes yet doesn't
	// read as a broken streak.
	if (!counts.get(localDayKey(day.getTime()))) day.setDate(day.getDate() - 1);
	let streak = 0;
	// Bounded: a decade of daily writing is already an absurd streak, and the
	// cap keeps a corrupt clock from spinning here forever.
	for (let i = 0; i < 3660; i++) {
		if (!counts.get(localDayKey(day.getTime()))) break;
		streak++;
		day.setDate(day.getDate() - 1);
	}
	return streak;
}

/** What the vault says about today, in one pass over the markdown files. */
interface VaultPulse {
	today: number;
	streak: number;
	sinceLastMs: number | null;
}

function readVaultPulse(view: HomeView, metric: "modified" | "created"): VaultPulse {
	const counts = new Map<string, number>();
	let newest = 0;
	for (const file of view.app.vault.getMarkdownFiles()) {
		const ts = metric === "created" ? file.stat.ctime : file.stat.mtime;
		const key = localDayKey(ts);
		counts.set(key, (counts.get(key) ?? 0) + 1);
		// What wakes the pet is always the last *touch*, whatever the card
		// counts: a card scoring created notes should still wake when you spend
		// the afternoon editing the ones you already have.
		if (file.stat.mtime > newest) newest = file.stat.mtime;
	}
	const now = new Date();
	return {
		today: counts.get(localDayKey(now.getTime())) ?? 0,
		streak: activityStreak(counts, now),
		// A file timestamped in the future (bad clock, odd sync) would otherwise
		// read as negative age and count as "warm" forever; clamp at zero.
		sinceLastMs: newest > 0 ? Math.max(0, now.getTime() - newest) : null,
	};
}


// ---- Colors -------------------------------------------------------------

/** Body and accent color each species starts with. */
const SPECIES_COLORS: Record<PetSpecies, { body: string; accent: string }> = {
	cat: { body: "#e8a33d", accent: "#f7d9b8" },
	dog: { body: "#c08552", accent: "#f2ded0" },
	bird: { body: "#4fa3d9", accent: "#f2c14e" },
	fox: { body: "#e2703a", accent: "#f7efe6" },
	frog: { body: "#6fbf5a", accent: "#f4b8c4" },
	blob: { body: "#9b7bd4", accent: "#ffe08a" },
};

/** Parse `#rgb` / `#rrggbb` into 0–255 channels, or null if it isn't one. */
export function parseHex(hex: string): [number, number, number] | null {
	const text = hex.trim().replace(/^#/, "");
	const full = text.length === 3 ? text.replace(/./g, (c) => c + c) : text;
	if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
	return [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16),
	];
}

function toHex(r: number, g: number, b: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
	return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Move a color towards black (`amount` < 0) or white (`amount` > 0), by that
 * fraction of the distance. Used to derive the outline, the shading and the
 * belly from the one body color the user picks, so the palette always hangs
 * together whatever they choose. An unparseable color is returned untouched.
 */
export function shadeHex(hex: string, amount: number): string {
	const rgb = parseHex(hex);
	if (!rgb) return hex;
	const target = amount < 0 ? 0 : 255;
	const f = Math.min(1, Math.abs(amount));
	return toHex(...(rgb.map((c) => c + (target - c) * f) as [number, number, number]));
}

/** The four derived colors a sprite is drawn with. */
export interface PetPalette {
	outline: string;
	body: string;
	light: string;
	accent: string;
}

export function paletteFor(cfg: PetConfig): PetPalette {
	const species = cfg.species ?? "cat";
	const defaults = SPECIES_COLORS[species] ?? SPECIES_COLORS.cat;
	const body = parseHex(cfg.bodyColor ?? "") ? cfg.bodyColor! : defaults.body;
	const accent = parseHex(cfg.accentColor ?? "") ? cfg.accentColor! : defaults.accent;
	return { outline: shadeHex(body, -0.62), body, light: shadeHex(body, 0.45), accent };
}

/** The default colors offered when a species is picked or the colors reset. */
export function defaultColors(species: PetSpecies): { body: string; accent: string } {
	return SPECIES_COLORS[species] ?? SPECIES_COLORS.cat;
}


// ---- Sprites ------------------------------------------------------------
//
// Palette characters: `.` transparent, `o` outline, `b` body, `l` belly/light,
// `a` accent, `e` eye, `w` eye shine. Every row is exactly 16 characters (a
// unit test pins that, and that no stray character sneaks into the art).

export const PET_SPRITE_SIZE = 16;

/** The sitting body every species shares — rows 9–15. */
const PET_BODY: string[] = [
	"..obbbbbbbbbbo..",
	".obbllllllllbbo.",
	".obbllllllllbbo.",
	".obbllllllllbbo.",
	".obbbllllllbbbo.",
	".obaaobbbboaabo.",
	"..oooooooooooo..",
];

/** Where a species' face is painted. Eyes are drawn from their top-left pixel;
 * the mouth is centred on `mouthCol` and `mouthWidth` pixels wide. */
interface SpeciesArt {
	/** Rows 0–8: the head. */
	head: string[];
	eyeRow: number;
	eyeCols: [number, number];
	mouthRow: number;
	mouthCol: number;
	mouthWidth: number;
	/** Draw an accent nose just above the mouth (the muzzled species). */
	nose: boolean;
	/** Species whose beak is already in the art take no drawn mouth. */
	mouth: boolean;
}

const SPECIES_ART: Record<PetSpecies, SpeciesArt> = {
	cat: {
		head: [
			"...o........o...",
			"..oao......oao..",
			"..obao....oabo..",
			"..obbo....obbo..",
			"..obbboooobbbo..",
			"..obbbbbbbbbbo..",
			"..obbbbbbbbbbo..",
			"..obbbbbbbbbbo..",
			"...obbbbbbbbo...",
		],
		eyeRow: 5,
		eyeCols: [4, 9],
		mouthRow: 8,
		mouthCol: 7,
		mouthWidth: 2,
		nose: true,
		mouth: true,
	},
	dog: {
		head: [
			"....oooooooo....",
			"...obbbbbbbbo...",
			"...obbbbbbbbo...",
			"obaobbbbbbbboabo",
			"obaobbbbbbbboabo",
			"obaobbbbbbbboabo",
			".obobbbbbbbbobo.",
			"...obbbbbbbbo...",
			"....obbbbbbo....",
		],
		eyeRow: 4,
		eyeCols: [5, 9],
		mouthRow: 7,
		mouthCol: 7,
		mouthWidth: 2,
		nose: true,
		mouth: true,
	},
	bird: {
		head: [
			".....oooooo.....",
			"....obbbbbbo....",
			"...obbbbbbbbo...",
			"..obbbbbbbbbbo..",
			"..obbbbbbbbbbo..",
			"..obbbbbbbbbbo..",
			"..obbbbaabbbbo..",
			"...obbbaabbbo...",
			"....obbbbbbo....",
		],
		eyeRow: 3,
		eyeCols: [4, 9],
		mouthRow: 6,
		mouthCol: 7,
		mouthWidth: 2,
		nose: false,
		mouth: false,
	},
	fox: {
		head: [
			"..oo........oo..",
			"..oao......oao..",
			"..oabo....obao..",
			"..obbboooobbbo..",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obllbbbbbbllbo.",
			"..obbllllllbbo..",
			"...obllllllbo...",
		],
		eyeRow: 4,
		eyeCols: [4, 10],
		mouthRow: 7,
		mouthCol: 7,
		mouthWidth: 2,
		nose: true,
		mouth: true,
	},
	frog: {
		head: [
			"..oooo....oooo..",
			".obbbbo..obbbbo.",
			".obbbbboobbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			"..obbbbbbbbbbo..",
			"...obbbbbbbbo...",
		],
		eyeRow: 1,
		eyeCols: [3, 11],
		mouthRow: 6,
		mouthCol: 5,
		mouthWidth: 6,
		nose: false,
		mouth: true,
	},
	blob: {
		head: [
			"....oooooooo....",
			"..oobbbbbbbboo..",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			"..obbbbbbbbbbo..",
			"...obbbbbbbbo...",
		],
		eyeRow: 4,
		eyeCols: [4, 10],
		mouthRow: 7,
		mouthCol: 7,
		mouthWidth: 2,
		nose: false,
		mouth: true,
	},
};


/** Write one pixel, ignoring anything that would fall off the grid. */
function put(grid: string[][], row: number, col: number, ch: string): void {
	const line = grid[row];
	if (!line || col < 0 || col >= line.length) return;
	line[col] = ch;
}

/** Paint one eye in the style the mood calls for. `col` is its left pixel.
 *
 * - happy / excited — a `^` two rows tall;
 * - content — a 2×2 eye with a shine in the corner;
 * - bored — only the lower half, so the lids read as heavy;
 * - sleepy — a flat closed line. */
function paintEye(grid: string[][], row: number, col: number, mood: PetMood): void {
	if (mood === "happy" || mood === "excited") {
		put(grid, row + 1, col, "e");
		put(grid, row, col + 1, "e");
		put(grid, row + 1, col + 2, "e");
		return;
	}
	if (mood === "sleepy") {
		for (let i = 0; i < 3; i++) put(grid, row + 1, col + i, "e");
		return;
	}
	if (mood === "bored") {
		put(grid, row + 1, col, "e");
		put(grid, row + 1, col + 1, "e");
		return;
	}
	put(grid, row, col, "e");
	put(grid, row, col + 1, "e");
	put(grid, row + 1, col, "e");
	put(grid, row + 1, col + 1, "e");
	put(grid, row, col, "w");
}

function paintMouth(grid: string[][], art: SpeciesArt, mood: PetMood): void {
	if (mood === "sleepy") return;
	const { mouthRow: row, mouthCol: col, mouthWidth: width } = art;
	if (!art.mouth) {
		// The beak is already drawn in the art, so it takes no mouth — except
		// when excited, where a dark line splits it into an open beak.
		if (mood === "excited") for (let i = 0; i < width; i++) put(grid, row + 1, col + i, "o");
		return;
	}
	for (let i = 0; i < width; i++) put(grid, row, col + i, "o");
	// A smile turns the corners up one row.
	if (mood === "happy" || mood === "excited") {
		put(grid, row - 1, col - 1, "o");
		put(grid, row - 1, col + width, "o");
	}
	// An excited pet opens its mouth.
	if (mood === "excited") for (let i = 0; i < width; i++) put(grid, row + 1, col + i, "o");
}

/** The rows the head occupies before any posture is applied. */
const HEAD_ROWS = 9;

/**
 * Move a block of rows, dropping whatever falls off the grid and leaving the
 * rows it came from empty. Transparent pixels don't overwrite what they land
 * on, so a head moved down sinks *into* the body instead of punching a hole in
 * it — which is exactly the slouch the low moods want.
 */
function moveBlock(grid: string[][], from: number, to: number, dy: number, dx: number): void {
	const block = grid.slice(from, to + 1).map((row) => [...row]);
	for (let r = from; r <= to; r++) grid[r] = new Array<string>(PET_SPRITE_SIZE).fill(".");
	block.forEach((row, i) => {
		const target = grid[from + i + dy];
		if (!target) return;
		row.forEach((ch, c) => {
			const col = c + dx;
			if (ch !== "." && col >= 0 && col < PET_SPRITE_SIZE) target[col] = ch;
		});
	});
}

/** Compress the pet towards its feet by one pixel — the breath, and the squash
 * of a hop. Everything above the paws slides down over the belly. */
function squash(grid: string[][]): void {
	moveBlock(grid, 0, PET_SPRITE_SIZE - 4, 1, 0);
}

/** One drawn pose: the sprite with a face, a posture and an offset. */
function buildSprite(
	species: PetSpecies,
	face: PetMood,
	opts: { slouch?: number; lean?: number; squash?: boolean } = {},
): string[] {
	const art = SPECIES_ART[species] ?? SPECIES_ART.cat;
	const grid = [...art.head, ...PET_BODY].map((row) => row.split(""));
	for (const col of art.eyeCols) paintEye(grid, art.eyeRow, col, face);
	if (art.nose && face !== "sleepy") {
		put(grid, art.mouthRow - 1, art.mouthCol, "a");
		put(grid, art.mouthRow - 1, art.mouthCol + 1, "a");
	}
	paintMouth(grid, art, face);
	// The head is moved as a block, so a slouching pet keeps its proportions
	// instead of needing a second set of drawings per species.
	const slouch = opts.slouch ?? 0;
	const lean = opts.lean ?? 0;
	if (slouch || lean) moveBlock(grid, 0, HEAD_ROWS - 1, slouch, lean);
	if (opts.squash) squash(grid);
	return grid.map((row) => row.join(""));
}

/**
 * The finished 16×16 grid for a species in a mood — the first frame of its
 * animation, and the only one drawn when motion is suppressed.
 */
export function spriteFor(species: PetSpecies, mood: PetMood): string[] {
	return spriteFrames(species, mood)[0];
}

/** How many frames every mood is drawn in. Fixed, so the stylesheet can
 * schedule each mood's cycle without the two definitions drifting apart. */
export const PET_FRAME_COUNT = 3;

/**
 * The frames a mood animates through. Real drawn animation rather than a
 * transform on one picture: the pet blinks, wags its head, squashes as it
 * lands and breathes in its sleep, because those are things a CSS transform on
 * a single sprite cannot say. The stylesheet gives each mood the schedule that
 * suits it — a blink is a sixteenth of the cycle, a hop is a third.
 *
 * Every frame is generated from the one drawing per species by moving the head
 * block and repainting the face, so a new species is still a single 9-row head.
 */
export function spriteFrames(species: PetSpecies, mood: PetMood): string[][] {
	switch (mood) {
		case "excited":
			// Mid-air, stretched, and squashed on the landing.
			return [
				buildSprite(species, "excited"),
				buildSprite(species, "excited", { slouch: -1 }),
				buildSprite(species, "excited", { squash: true }),
			];
		case "happy":
			// A head wagging side to side.
			return [
				buildSprite(species, "happy"),
				buildSprite(species, "happy", { lean: -1 }),
				buildSprite(species, "happy", { lean: 1 }),
			];
		case "content":
			// Mostly still, with a blink and a glance to one side.
			return [
				buildSprite(species, "content"),
				buildSprite(species, "sleepy"),
				buildSprite(species, "content", { lean: 1 }),
			];
		case "bored":
			// Slouched, with a long slow blink and a head that lolls sideways.
			return [
				buildSprite(species, "bored", { slouch: 1 }),
				buildSprite(species, "sleepy", { slouch: 1 }),
				buildSprite(species, "bored", { slouch: 1, lean: -1 }),
			];
		default:
			// Curled down into the body, breathing, with a slow roll of the head.
			// The slouch stops at two: a third row would push the shorter-headed
			// species (the frog's eye bumps) clean off the top of the grid.
			return [
				buildSprite(species, "sleepy", { slouch: 2 }),
				buildSprite(species, "sleepy", { slouch: 2, squash: true }),
				buildSprite(species, "sleepy", { slouch: 2, lean: 1 }),
			];
	}
}

/** One horizontal run of same-colored pixels. */
export interface SpriteRun {
	row: number;
	col: number;
	len: number;
	ch: string;
}

/** Collapse a sprite into horizontal runs, so a 256-pixel grid draws as a few
 * dozen `<rect>`s instead of one per pixel. */
export function spriteRuns(rows: string[]): SpriteRun[] {
	const runs: SpriteRun[] = [];
	rows.forEach((row, y) => {
		let start = -1;
		let ch = "";
		const flush = (end: number) => {
			if (start >= 0) runs.push({ row: y, col: start, len: end - start, ch });
			start = -1;
			ch = "";
		};
		for (let x = 0; x < row.length; x++) {
			const c = row[x];
			if (c === ".") {
				flush(x);
				continue;
			}
			if (c !== ch) {
				flush(x);
				start = x;
				ch = c;
			}
		}
		flush(row.length);
	});
	return runs;
}

const RUN_FILL: Record<string, string> = {
	o: "var(--hearth-pet-outline)",
	b: "var(--hearth-pet-body)",
	l: "var(--hearth-pet-light)",
	a: "var(--hearth-pet-accent)",
	e: "var(--hearth-pet-eye)",
	w: "var(--hearth-pet-shine)",
};

/**
 * Draw the sprite: every frame of the mood, stacked as sibling groups in one
 * SVG. Which one shows is entirely the stylesheet's business — it fades all
 * but one out on the mood's own schedule — so the card draws once per vault
 * event and never again to animate. `still` collapses that to frame 0.
 */
function drawSprite(parent: HTMLElement, species: PetSpecies, mood: PetMood, still: boolean): void {
	const svg = parent.createSvg("svg", {
		cls: "hearth-pet-sprite",
		attr: {
			viewBox: `0 0 ${PET_SPRITE_SIZE} ${PET_SPRITE_SIZE}`,
			"shape-rendering": "crispEdges",
			focusable: "false",
			"aria-hidden": "true",
		},
	});
	const paintRuns = (parent: SVGElement, runs: SpriteRun[]) => {
		for (const run of runs) {
			parent.createSvg("rect", {
				attr: {
					x: String(run.col),
					y: String(run.row),
					width: String(run.len),
					height: "1",
					fill: RUN_FILL[run.ch] ?? RUN_FILL.b,
				},
			});
		}
	};

	const frames = still ? spriteFrames(species, mood).slice(0, 1) : spriteFrames(species, mood);
	frames.forEach((frame, index) => {
		const group = svg.createSvg("g", { cls: "hearth-pet-frame", attr: { "data-f": String(index) } });
		// Two layers per frame. The face is drawn *whole* underneath, with the
		// eye pixels filled in as skin, and the eyes go on top in their own
		// group — so the stylesheet can shift them a pixel towards the pointer
		// without leaving holes in the head where they used to be, and without
		// the card being redrawn on every mouse move.
		paintRuns(group, spriteRuns(frame.map((row) => row.replace(/[ew]/g, "b"))));
		paintRuns(
			group.createSvg("g", { cls: "hearth-pet-eyes" }),
			spriteRuns(frame).filter((run) => run.ch === "e" || run.ch === "w"),
		);
	});
}


// ---- Render -------------------------------------------------------------

/** The pet's display name: what it was called, or the species' own name. */
export function petName(cfg: PetConfig): string {
	const named = cfg.name?.trim();
	if (named) return named;
	return t().cards.pet.species[cfg.species ?? "cat"];
}

function moodLabel(mood: PetMood): string {
	const s = t().cards.pet;
	switch (mood) {
		case "excited":
			return s.moodExcited;
		case "happy":
			return s.moodHappy;
		case "content":
			return s.moodContent;
		case "bored":
			return s.moodBored;
		default:
			return s.moodSleepy;
	}
}

/** A short burst of hearts when the pet is petted. Each element removes itself
 * when its animation ends, so nothing accumulates however often it's clicked. */
function burstHearts(stage: HTMLElement): void {
	for (let i = 0; i < 3; i++) {
		const heart = stage.createDiv("hearth-pet-heart");
		heart.setText("♥");
		heart.style.setProperty("--i", String(i));
		heart.addEventListener("animationend", () => heart.remove());
	}
}

export function renderPet(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = (card.pet ??= {});
	const species = cfg.species ?? "cat";
	const palette = paletteFor(cfg);
	const still = !motionAllowed(view.plugin.settings);

	const wrap = body.createDiv("hearth-pet");
	wrap.addClass(`is-${cfg.size ?? "md"}`);
	wrap.style.setProperty("--hearth-pet-outline", palette.outline);
	wrap.style.setProperty("--hearth-pet-body", palette.body);
	wrap.style.setProperty("--hearth-pet-light", palette.light);
	wrap.style.setProperty("--hearth-pet-accent", palette.accent);

	const stage = wrap.createDiv("hearth-pet-stage");
	const name = wrap.createDiv("hearth-pet-name");
	const moodEl = wrap.createDiv("hearth-pet-mood");
	const activity = wrap.createDiv("hearth-pet-activity");

	/** Re-derive everything from the vault and repaint. Cheap enough to run on
	 * every vault event: one pass over the file list plus a few dozen rects. */
	/** The mood on screen right now, so the pointer tracking can tell whether
	 * the eyes it would move are open. */
	let shown: PetMood = "content";

	/** Put the eyes back to centre. Called whenever the pointer leaves, and on
	 * every repaint — the fresh sprite starts centred and the variables that
	 * moved the old one must not outlive it. */
	const lookAway = () => {
		stage.style.removeProperty("--hearth-pet-look-x");
		stage.style.removeProperty("--hearth-pet-look-y");
	};

	/**
	 * Follow the pointer with the eyes. The whole effect is two custom
	 * properties read by a transform on the eye group, so a mouse move costs a
	 * compositor transform and nothing else — no redraw, no layout, and the
	 * sprite's own animations keep running underneath. Coalesced into an
	 * animation frame, since pointermove fires far faster than the screen.
	 *
	 * A sleeping pet has its eyes shut, so it never looks; low power mode and
	 * a reduced-motion preference skip the listener entirely.
	 */
	const wireEyes = () => {
		const follow = cfg.eyesFollow ?? "card";
		if (follow === "off" || still) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		// "board" watches the whole dashboard, so the pet notices a pointer that
		// never comes near it; "card" only looks up when you are on its card.
		// "card" watches the card body rather than the sprite alone, so the pet
		// looks up as soon as the pointer is anywhere on its card.
		const surface: HTMLElement = follow === "board" ? (body.closest(".hearth-grid") ?? body) : body;

		let queued = false;
		let pending: { x: number; y: number } | null = null;
		const apply = () => {
			queued = false;
			if (!pending) return;
			const box = stage.getBoundingClientRect();
			if (!box.width || !box.height) return;
			// Normalised offset from the pet's centre, clamped to ±1, then scaled
			// to a pixel of the 16×16 grid. crispEdges rounds the result, so the
			// pupils snap between pixels the way pixel art should.
			const dx = Math.max(-1, Math.min(1, (pending.x - (box.left + box.width / 2)) / (box.width / 2)));
			const dy = Math.max(-1, Math.min(1, (pending.y - (box.top + box.height / 2)) / (box.height / 2)));
			stage.style.setProperty("--hearth-pet-look-x", `${(dx * 0.9).toFixed(2)}px`);
			stage.style.setProperty("--hearth-pet-look-y", `${(dy * 0.6).toFixed(2)}px`);
		};
		component.registerDomEvent(surface, "pointermove", (ev: PointerEvent) => {
			if (shown === "sleepy") return;
			pending = { x: ev.clientX, y: ev.clientY };
			if (queued) return;
			queued = true;
			window.requestAnimationFrame(apply);
		});
		component.registerDomEvent(surface, "pointerleave", lookAway);
	};

	const paint = () => {
		const pulse = readVaultPulse(view, cfg.metric ?? "modified");
		const nightMode = cfg.nightSleep ?? "quiet";
		const night = nightMode !== "off" && inNightWindow(new Date(), cfg);
		const mood = moodFor({
			today: pulse.today,
			thresholds: thresholdsFor(cfg),
			sinceLastMs: pulse.sinceLastMs,
			pettedMsAgo: cfg.lastPlayedAt ? Date.now() - cfg.lastPlayedAt : null,
			night: { mode: nightMode, now: night },
		});
		shown = mood;

		stage.empty();
		for (const m of ["sleepy", "bored", "content", "happy", "excited"]) stage.removeClass(`is-${m}`);
		stage.addClass(`is-${mood}`);
		stage.toggleClass("is-still", still);
		// Asleep because of the hour rather than the vault: a moon instead of
		// the z's, so the card says "it is night" and not "you did nothing".
		stage.toggleClass("is-night", night && mood === "sleepy");
		lookAway();
		drawSprite(stage, species, mood, still);
		// Sleeping pets get their z's — but not while animation is suppressed,
		// since they are nothing but a float animation.
		if (mood === "sleepy" && !still) {
			const zzz = stage.createDiv(night ? "hearth-pet-zzz is-moon" : "hearth-pet-zzz");
			for (let i = 0; i < (night ? 1 : 3); i++) {
				// The glyph itself is drawn in CSS (::after) — it is decoration,
				// not text, and must not be picked up as a translatable string.
				const z = zzz.createDiv("hearth-pet-z");
				z.style.setProperty("--i", String(i));
			}
		}

		name.setText(petName(cfg));
		name.toggle(cfg.showName !== false);
		moodEl.setText(night && mood === "sleepy" ? t().cards.pet.moodNight : moodLabel(mood));
		moodEl.toggle(cfg.showMood !== false);
		const parts = [t().cards.pet.todayCount(pulse.today, cfg.metric ?? "modified")];
		if (pulse.streak > 1) parts.push(t().cards.pet.streak(pulse.streak));
		activity.setText(parts.join(" · "));
		activity.toggle(cfg.showActivity !== false);

		stage.setAttribute("aria-label", `${petName(cfg)} — ${moodEl.getText()}. ${t().cards.pet.petHint}`);
		stage.setAttribute("title", t().cards.pet.petHint);
	};

	wireEyes();

	const pet = () => {
		cfg.lastPlayedAt = Date.now();
		void view.plugin.saveData(view.plugin.settings);
		paint();
		if (!still) burstHearts(stage);
	};
	makeClickable(stage, pet, t().cards.pet.petHint);
	stage.addEventListener("click", pet);

	paint();
	// The vault-event redraw covers everything the pet reacts to *except* the
	// passage of time (bored → sleepy, and a petting wearing off), so re-derive
	// on a slow timer too. Low power mode keeps the first paint and drops the
	// timer, like the web card's refresh.
	if (!still) component.registerInterval(window.setInterval(paint, PET_TICK_MS));
}


// ---- Editor -------------------------------------------------------------

export function petEditor(container: HTMLElement, ctx: CardEditorContext): void {
	const cfg = (ctx.card.pet ??= {});
	const strings = t().editors.pet;

	new Setting(container).setName(strings.species).addDropdown((d) => {
		for (const species of PET_SPECIES) d.addOption(species, t().cards.pet.species[species]);
		d.setValue(cfg.species ?? "cat").onChange((v) => {
			cfg.species = v as PetSpecies;
			// The colors are per-species defaults until the user picks their own,
			// so a species swap on untouched colors brings that animal's palette.
			ctx.opts.save();
			ctx.requestRender();
		});
	});

	new Setting(container).setName(strings.name).setDesc(strings.nameDesc).addText((txt) =>
		txt
			.setPlaceholder(t().cards.pet.species[cfg.species ?? "cat"])
			.setValue(cfg.name ?? "")
			.onChange((v) => {
				cfg.name = v.trim() || undefined;
				ctx.opts.save();
			}),
	);

	const colors = defaultColors(cfg.species ?? "cat");
	new Setting(container)
		.setName(strings.colors)
		.setDesc(strings.colorsDesc)
		.addColorPicker((picker) =>
			picker.setValue(cfg.bodyColor ?? colors.body).onChange((v) => {
				cfg.bodyColor = v;
				ctx.opts.save();
			}),
		)
		.addColorPicker((picker) =>
			picker.setValue(cfg.accentColor ?? colors.accent).onChange((v) => {
				cfg.accentColor = v;
				ctx.opts.save();
			}),
		)
		.addExtraButton((btn) =>
			btn
				.setIcon("rotate-ccw")
				.setTooltip(strings.colorsReset)
				.onClick(() => {
					cfg.bodyColor = undefined;
					cfg.accentColor = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);

	new Setting(container).setName(strings.size).addDropdown((d) => {
		d.addOption("sm", strings.sizeSmall);
		d.addOption("md", strings.sizeMedium);
		d.addOption("lg", strings.sizeLarge);
		d.setValue(cfg.size ?? "md").onChange((v) => {
			cfg.size = v as NonNullable<PetConfig["size"]>;
			ctx.opts.save();
		});
	});

	new Setting(container).setName(strings.metric).setDesc(strings.metricDesc).addDropdown((d) => {
		d.addOption("modified", strings.metricModified);
		d.addOption("created", strings.metricCreated);
		d.setValue(cfg.metric ?? "modified").onChange((v) => {
			cfg.metric = v as NonNullable<PetConfig["metric"]>;
			ctx.opts.save();
		});
	});

	// ---- Where each mood starts ----
	//
	// Every rung is settable. They are read back through thresholdsFor(), which
	// forces them into order, so no combination of sliders can produce a mood
	// the pet is unable to reach.
	const limits = thresholdsFor(cfg);
	new Setting(container).setName(strings.moods).setDesc(strings.moodsDesc).setHeading();

	const rung = (
		name: string,
		desc: string,
		value: number,
		max: number,
		apply: (v: number) => void,
	) =>
		new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) =>
				slider
					.setLimits(1, max, 1)
					.setValue(Math.min(value, max))
					.onChange((v) => {
						apply(v);
						ctx.opts.save();
						// Redraw the card, not the panel: a threshold change can move
						// the pet to another mood, and seeing that happen is the whole
						// point of setting it.
						ctx.opts.rerender();
					}),
			);

	rung(strings.excitedAt, strings.excitedAtDesc, limits.excited, 60, (v) => (cfg.excitedAt = v));
	rung(strings.happyAt, strings.happyAtDesc, limits.happy, 40, (v) => (cfg.dailyGoal = v));
	rung(strings.contentAt, strings.contentAtDesc, limits.content, 20, (v) => (cfg.contentAt = v));
	new Setting(container)
		.setName(strings.sleepyAfter)
		.setDesc(strings.sleepyAfterDesc)
		.addSlider((slider) =>
			slider
				.setLimits(15, 1440, 15)
				.setValue(Math.min(1440, Math.round(limits.sleepyAfterMs / 60000)))
				.onChange((v) => {
					cfg.sleepyAfterMin = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
	new Setting(container)
		.setName(strings.pettedFor)
		.setDesc(strings.pettedForDesc)
		.addSlider((slider) =>
			slider
				.setLimits(5, 240, 5)
				.setValue(Math.min(240, Math.round(limits.pettedMs / 60000)))
				.onChange((v) => {
					cfg.pettedForMin = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
	new Setting(container).addExtraButton((btn) =>
		btn
			.setIcon("rotate-ccw")
			.setTooltip(strings.moodsReset)
			.onClick(() => {
				cfg.dailyGoal = undefined;
				cfg.excitedAt = undefined;
				cfg.contentAt = undefined;
				cfg.sleepyAfterMin = undefined;
				cfg.pettedForMin = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);

	// ---- Night, and where the eyes look ----
	new Setting(container).setName(strings.nightSleep).setDesc(strings.nightSleepDesc).addDropdown((d) => {
		d.addOption("off", strings.nightOff);
		d.addOption("quiet", strings.nightQuiet);
		d.addOption("always", strings.nightAlways);
		d.setValue(cfg.nightSleep ?? "quiet").onChange((v) => {
			cfg.nightSleep = v as NonNullable<PetConfig["nightSleep"]>;
			ctx.opts.save();
			ctx.requestRender();
			ctx.opts.rerender();
		});
	});

	if ((cfg.nightSleep ?? "quiet") !== "off") {
		const hours = new Setting(container).setName(strings.nightWindow).setDesc(strings.nightWindowDesc);
		const hourPicker = (value: number, apply: (hour: number) => void) => (d: DropdownComponent) => {
			for (let hour = 0; hour < 24; hour++) d.addOption(String(hour), `${String(hour).padStart(2, "0")}:00`);
			d.setValue(String(value)).onChange((v) => {
				apply(Number(v));
				ctx.opts.save();
				ctx.opts.rerender();
			});
		};
		hours.addDropdown(hourPicker(cfg.nightFrom ?? PET_DEFAULT_NIGHT[0], (h) => (cfg.nightFrom = h)));
		hours.addDropdown(hourPicker(cfg.nightTo ?? PET_DEFAULT_NIGHT[1], (h) => (cfg.nightTo = h)));
	}

	new Setting(container).setName(strings.eyesFollow).setDesc(strings.eyesFollowDesc).addDropdown((d) => {
		d.addOption("off", strings.eyesOff);
		d.addOption("card", strings.eyesCard);
		d.addOption("board", strings.eyesBoard);
		d.setValue(cfg.eyesFollow ?? "card").onChange((v) => {
			cfg.eyesFollow = v as NonNullable<PetConfig["eyesFollow"]>;
			ctx.opts.save();
			ctx.opts.rerender();
		});
	});

	new Setting(container).setName(strings.showName).addToggle((toggle) =>
		toggle.setValue(cfg.showName !== false).onChange((v) => {
			cfg.showName = v ? undefined : false;
			ctx.opts.save();
		}),
	);
	new Setting(container).setName(strings.showMood).addToggle((toggle) =>
		toggle.setValue(cfg.showMood !== false).onChange((v) => {
			cfg.showMood = v ? undefined : false;
			ctx.opts.save();
		}),
	);
	new Setting(container).setName(strings.showActivity).addToggle((toggle) =>
		toggle.setValue(cfg.showActivity !== false).onChange((v) => {
			cfg.showActivity = v ? undefined : false;
			ctx.opts.save();
		}),
	);
}


/** A pixel-art companion whose mood follows how much you write. */
export const petCard: CardDefinition<"pet"> = {
	kind: "pet",
	templates: [
		{ id: "pet", name: "Pet", icon: "cat", build: () => ({ kind: "pet", title: "Pet", pet: {}, w: 3, h: 4 }) },
	],
	render: (view, card, body, component) => renderPet(view, card, body, component),
	renderEditor: (container, ctx) => petEditor(container, ctx),
	cloneConfig: (source, copy) => {
		if (source.pet) copy.pet = { ...source.pet };
	},
	// Vault events are what the pet actually reacts to; the slow timer inside
	// render covers the rest (bored → sleepy).
	liveness: { mode: "vault" },
};
