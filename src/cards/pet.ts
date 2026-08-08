import { Component, Setting } from "obsidian";
import { localDayKey } from "../dates";
import { t } from "../i18n";
import { type DashboardCard, type PetConfig, type PetSpecies, lowPowerActive } from "../types";
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

/** How long a petting keeps the pet at least happy. */
export const PET_PETTED_MS = 30 * 60 * 1000;

/** With nothing written today, the pet dozes off once the freshest note in the
 * vault is this old; until then it is merely bored. */
export const PET_SLEEPY_AFTER_MS = 6 * 60 * 60 * 1000;

/** How often the card re-derives its mood without a vault event, so a pet left
 * on screen still drifts from bored to sleepy (and out of a petting). */
const PET_TICK_MS = 5 * 60 * 1000;


// ---- Mood ---------------------------------------------------------------

/** Everything the mood is derived from. Pure input, so the ladder below can be
 * unit-tested without a vault. */
export interface PetPulse {
	/** Notes touched (edited or created) today. */
	today: number;
	/** Notes a day that count as a good day. */
	goal: number;
	/** Age of the freshest note in the vault, or null for an empty vault. */
	sinceLastMs: number | null;
	/** Time since the pet was last petted, or null if it never was. */
	pettedMsAgo: number | null;
}

/**
 * The mood ladder. Activity today is the whole story: at the goal the pet is
 * happy, at twice it excited, at anything above zero content. With nothing
 * today it is bored while the vault is still warm and asleep once the freshest
 * note is `PET_SLEEPY_AFTER_MS` old. A recent petting floors the mood at happy
 * — it can only ever lift the pet, never lower it.
 */
export function moodFor(pulse: PetPulse): PetMood {
	const goal = pulse.goal > 0 ? pulse.goal : PET_DEFAULT_GOAL;
	const petted = pulse.pettedMsAgo != null && pulse.pettedMsAgo >= 0 && pulse.pettedMsAgo < PET_PETTED_MS;
	let mood: PetMood;
	if (pulse.today >= goal * 2) mood = "excited";
	else if (pulse.today >= goal) mood = "happy";
	else if (pulse.today > 0) mood = "content";
	else if (pulse.sinceLastMs != null && pulse.sinceLastMs < PET_SLEEPY_AFTER_MS) mood = "bored";
	else mood = "sleepy";
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
		if (ts > newest) newest = ts;
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

/**
 * The finished 16×16 grid for a species in a mood: the shared body under the
 * species head, with the face painted on top.
 */
export function spriteFor(species: PetSpecies, mood: PetMood): string[] {
	const art = SPECIES_ART[species] ?? SPECIES_ART.cat;
	const grid = [...art.head, ...PET_BODY].map((row) => row.split(""));
	for (const col of art.eyeCols) paintEye(grid, art.eyeRow, col, mood);
	if (art.nose && mood !== "sleepy") {
		put(grid, art.mouthRow - 1, art.mouthCol, "a");
		put(grid, art.mouthRow - 1, art.mouthCol + 1, "a");
	}
	paintMouth(grid, art, mood);
	return grid.map((row) => row.join(""));
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

function drawSprite(parent: HTMLElement, species: PetSpecies, mood: PetMood): void {
	const svg = parent.createSvg("svg", {
		cls: "hearth-pet-sprite",
		attr: {
			viewBox: `0 0 ${PET_SPRITE_SIZE} ${PET_SPRITE_SIZE}`,
			"shape-rendering": "crispEdges",
			focusable: "false",
			"aria-hidden": "true",
		},
	});
	for (const run of spriteRuns(spriteFor(species, mood))) {
		svg.createSvg("rect", {
			attr: {
				x: String(run.col),
				y: String(run.row),
				width: String(run.len),
				height: "1",
				fill: RUN_FILL[run.ch] ?? RUN_FILL.b,
			},
		});
	}
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
	const still = lowPowerActive(view.plugin.settings);

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
	const paint = () => {
		const pulse = readVaultPulse(view, cfg.metric ?? "modified");
		const goal = cfg.dailyGoal && cfg.dailyGoal > 0 ? cfg.dailyGoal : PET_DEFAULT_GOAL;
		const mood = moodFor({
			today: pulse.today,
			goal,
			sinceLastMs: pulse.sinceLastMs,
			pettedMsAgo: cfg.lastPlayedAt ? Date.now() - cfg.lastPlayedAt : null,
		});

		stage.empty();
		for (const m of ["sleepy", "bored", "content", "happy", "excited"]) stage.removeClass(`is-${m}`);
		stage.addClass(`is-${mood}`);
		stage.toggleClass("is-still", still);
		drawSprite(stage, species, mood);
		// Sleeping pets get their z's — but not while animation is suppressed,
		// since they are nothing but a float animation.
		if (mood === "sleepy" && !still) {
			const zzz = stage.createDiv("hearth-pet-zzz");
			for (let i = 0; i < 3; i++) {
				// The glyph itself is drawn in CSS (::after) — it is decoration,
				// not text, and must not be picked up as a translatable string.
				const z = zzz.createDiv("hearth-pet-z");
				z.style.setProperty("--i", String(i));
			}
		}

		name.setText(petName(cfg));
		name.toggle(cfg.showName !== false);
		moodEl.setText(moodLabel(mood));
		moodEl.toggle(cfg.showMood !== false);
		const parts = [t().cards.pet.todayCount(pulse.today, cfg.metric ?? "modified")];
		if (pulse.streak > 1) parts.push(t().cards.pet.streak(pulse.streak));
		activity.setText(parts.join(" · "));
		activity.toggle(cfg.showActivity !== false);

		stage.setAttribute("aria-label", `${petName(cfg)} — ${moodLabel(mood)}. ${t().cards.pet.petHint}`);
		stage.setAttribute("title", t().cards.pet.petHint);
	};

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

	new Setting(container)
		.setName(strings.goal)
		.setDesc(strings.goalDesc)
		.addSlider((slider) =>
			slider
				.setLimits(1, 20, 1)
				.setValue(cfg.dailyGoal && cfg.dailyGoal > 0 ? cfg.dailyGoal : PET_DEFAULT_GOAL)
				.onChange((v) => {
					cfg.dailyGoal = v;
					ctx.opts.save();
				}),
		);

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
