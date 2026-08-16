/**
 * The painted sky: an SVG backdrop that follows the real weather and the real
 * time of day.
 *
 * It started as the weather card's "artistic" style and is now shared, because
 * the same sky can fill the whole board as its background (see background.ts).
 * The two differ only in *spread*: a card-sized sky wants a few large shapes, a
 * window-sized one wants many smaller ones, or a single cloud ends up the size
 * of a note. Everything else — the palettes, the drifting, the falling — is the
 * same code and the same CSS.
 *
 * The gradient itself lives in styles.css (`.sky-<group>`, plus `.is-night`);
 * this module draws what moves in front of it. Nothing here reacts to a
 * pointer, holds state, or survives a redraw: a sky is rebuilt wholesale each
 * time and the caller owns when that happens.
 */
import type { WeatherPlace } from "./types";
import { parsePlaceValue, type WeatherGroup, weatherGroup } from "./weather";

/** How much sky there is to fill. */
export type SkySpread = "card" | "board";

// ---- Choosing which sky to paint ----------------------------------------

/** Whether a sky is lit by the clock or pinned to one half of the day. */
export type SkyDaylight = "auto" | "day" | "night";

/**
 * What a weather background is set to: the live sky over a place, or one
 * condition chosen and kept.
 *
 * A fixed sky is not a lesser version of the live one — it is the reason to
 * pick "always clear night" and keep it, and it makes the backdrop entirely
 * offline: no place, no request, nothing to send.
 */
export type SkyBackground =
	| { mode: "live"; place: WeatherPlace }
	| { mode: "fixed"; group: WeatherGroup; daylight: SkyDaylight };

/** The WMO code that stands in for a whole group when the reader picked the
 * group rather than a forecast. Any code in the group draws the same sky; these
 * are simply the plainest member of each. */
const GROUP_CODES: Record<WeatherGroup, number> = {
	clear: 0,
	partly: 2,
	cloudy: 3,
	fog: 45,
	drizzle: 53,
	rain: 63,
	snow: 73,
	thunder: 95,
};

/** Every condition a fixed sky can be pinned to, in the order they're offered
 * — clearest first, wildest last. */
export const SKY_GROUPS: readonly WeatherGroup[] = [
	"clear",
	"partly",
	"cloudy",
	"fog",
	"drizzle",
	"rain",
	"snow",
	"thunder",
];

/** The code to draw a fixed group with. */
export function skyGroupCode(group: WeatherGroup): number {
	return GROUP_CODES[group];
}

/** Is it daytime, for a sky that follows the clock? The reader's own clock —
 * a fixed sky has no location to ask about sunrise. */
export function daylightFromHour(hour: number): boolean {
	return hour >= 7 && hour < 20;
}

/** Resolve a fixed sky's day/night flag. */
export function resolveDaylight(daylight: SkyDaylight, hour: number): boolean {
	if (daylight === "day") return true;
	if (daylight === "night") return false;
	return daylightFromHour(hour);
}

/**
 * Pack a weather background into the one string a `BackgroundConfig` has for it
 * (`value`, which for the other kinds is a colour, a vault path or a URL).
 *
 * A live sky is stored as its packed place; a fixed one as
 * `fixed:<group>:<daylight>`, which no place format can be mistaken for since
 * a place starts with a number.
 */
export function formatSkyValue(sky: SkyBackground): string {
	if (sky.mode === "fixed") return `fixed:${sky.group}:${sky.daylight}`;
	const { lat, lon, name } = sky.place;
	const head = `${lat.toFixed(4)},${lon.toFixed(4)}`;
	return name.trim() ? `${head},${name.trim()}` : head;
}

/** Unpack a weather background. Returns null when the value is neither — an
 * empty setting, or a colour left behind by a previous background kind. */
export function parseSkyValue(value: string): SkyBackground | null {
	const trimmed = value.trim();
	if (trimmed.startsWith("fixed:")) {
		const [, rawGroup, rawDaylight] = trimmed.split(":");
		const group = SKY_GROUPS.find((g) => g === rawGroup);
		if (!group) return null;
		const daylight: SkyDaylight =
			rawDaylight === "day" || rawDaylight === "night" ? rawDaylight : "auto";
		return { mode: "fixed", group, daylight };
	}
	const place = parsePlaceValue(trimmed);
	return place ? { mode: "live", place } : null;
}

/** One twinkling star. */
interface Star {
	x: number;
	y: number;
	r: number;
	/** Seconds, staggering the twinkle so the field doesn't pulse in unison. */
	delay: number;
}

/** One cloud: a centre, a size, and which of the three drift lanes it rides. */
interface Cloud {
	x: number;
	y: number;
	scale: number;
	lane: number;
}

/**
 * Everything that changes between a card-sized sky and a board-sized one.
 *
 * The shapes are drawn at a fixed size in user units, so widening the viewBox
 * is what makes them relatively smaller — the board then adds more of them to
 * fill the extra room. The two boxes have different aspects, chosen for the
 * shape each one usually ends up in (see BOARD_FIELD).
 */
interface SkyField {
	width: number;
	height: number;
	stars: readonly Star[];
	clouds: readonly Cloud[];
	/** Drops in the heaviest precipitation; lighter kinds scale off it. */
	drops: number;
	/** How far a cloud travels, in user units, before it wraps. */
	driftFrom: number;
	driftTo: number;
	/** How far a drop falls before it fades out, in user units. */
	fall: number;
}

/**
 * A tiny deterministic generator (mulberry32).
 *
 * The board's star and cloud fields are too big to write out by hand, but they
 * must not be *random*: `Math.random()` would deal a new sky on every redraw —
 * every forecast refresh, every dashboard switch — and the constellation would
 * visibly reshuffle behind the reader. Seeded once at module load, the field is
 * fixed for the life of the process and identical between runs, which also
 * makes it testable.
 */
function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Scatter `count` stars over the top `band` (0–1) of a `width`×`height` sky. */
export function starField(
	count: number,
	width: number,
	height: number,
	seed: number,
	band = 0.55,
): Star[] {
	const rand = seeded(seed);
	const out: Star[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			// Rounded to a tenth: the full float would only bloat the markup.
			x: Math.round(rand() * width * 10) / 10,
			// On a card the stars stay up top, clear of the reading laid over
			// them; a backdrop has nothing on it, so its band reaches further down.
			y: Math.round(rand() * height * band * 10) / 10,
			r: Math.round((0.6 + rand() * 0.7) * 10) / 10,
			delay: Math.round(rand() * 30) / 10,
		});
	}
	return out;
}

/** Scatter `count` clouds across a `width`×`height` sky, spread over three
 * drift lanes so the bank never moves as one slab. `top`/`depth` (both 0–1)
 * bound the band they hang in. */
export function cloudField(
	count: number,
	width: number,
	height: number,
	seed: number,
	top = 0.16,
	depth = 0.45,
): Cloud[] {
	const rand = seeded(seed);
	const out: Cloud[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			x: Math.round(rand() * width),
			y: Math.round(height * top + rand() * height * depth),
			scale: Math.round((0.7 + rand() * 0.9) * 100) / 100,
			lane: (i % 3) + 1,
		});
	}
	return out;
}

/** The card sky: hand-placed, because at three clouds and ten stars the
 * placement is a composition rather than a scatter. */
const CARD_FIELD: SkyField = {
	width: 200,
	height: 120,
	stars: [
		{ x: 18, y: 22, r: 1.1, delay: 0 },
		{ x: 40, y: 12, r: 0.8, delay: 1.4 },
		{ x: 62, y: 30, r: 1.0, delay: 0.7 },
		{ x: 88, y: 16, r: 0.7, delay: 2.1 },
		{ x: 112, y: 26, r: 1.2, delay: 0.3 },
		{ x: 134, y: 10, r: 0.8, delay: 1.8 },
		{ x: 152, y: 34, r: 0.9, delay: 1.1 },
		{ x: 176, y: 20, r: 1.1, delay: 2.6 },
		{ x: 28, y: 44, r: 0.7, delay: 2.3 },
		{ x: 104, y: 48, r: 0.8, delay: 0.9 },
	],
	clouds: [
		{ x: 40, y: 44, scale: 1.5, lane: 1 },
		{ x: 130, y: 32, scale: 1.1, lane: 2 },
		{ x: 90, y: 58, scale: 0.85, lane: 3 },
	],
	drops: 20,
	driftFrom: -60,
	driftTo: 260,
	fall: 140,
};

/**
 * The board sky: the same shapes over several times the area, so the field is
 * generated rather than written out.
 *
 * The box is 2:1 rather than the card's 5:3 because a window is wider than a
 * card is. `slice` crops whichever axis is in surplus, and at 5:3 a wide
 * monitor loses a third of the height — which is exactly the band the clouds
 * hang in, so they'd sit off the top of the screen. The field also spreads
 * further down its box than the card's: a backdrop has no reading laid over it
 * to keep clear of.
 */
const BOARD_FIELD: SkyField = {
	width: 400,
	height: 200,
	stars: starField(38, 400, 200, 0x5eed, 0.85),
	clouds: cloudField(9, 400, 200, 0xc10d, 0.08, 0.62),
	drops: 52,
	driftFrom: -80,
	driftTo: 500,
	fall: 240,
};

function fieldFor(spread: SkySpread): SkyField {
	return spread === "board" ? BOARD_FIELD : CARD_FIELD;
}

/** How long one cloud takes to cross, by lane. Three speeds, so the bank never
 * reads as a single sliding slab. */
function driftSeconds(lane: number): number {
	return 46 + lane * 20;
}

/**
 * Draw one cloud as three overlapping discs on a slab — the shape reads as a
 * cloud at any size, and it costs four nodes instead of a path.
 *
 * It comes in two nested groups, and that nesting is load-bearing. A CSS
 * animation sets the transform *property*, which wholly replaces an element's
 * transform *attribute* — so a cloud that carried its position in the attribute
 * and its drift in the animation lost its position the moment it started
 * moving, and the whole bank collapsed to the top-left corner and marched
 * across in a row. The outer group therefore owns the horizontal drift and
 * nothing else; the inner one owns where the cloud sits and how big it is.
 */
function drawCloud(svg: SVGElement, cloud: Cloud, field: SkyField): void {
	const drift = svg.createSvg("g", {
		// An array, not "a b": createSvg hands `cls` to classList.add(), which
		// rejects a token containing a space. (createDiv sets the class
		// attribute instead, which is why a two-class string is fine there.)
		cls: ["hearth-weather-cloud", `is-lane-${cloud.lane}`],
	});
	const seconds = driftSeconds(cloud.lane);
	// Same two mechanisms as the raindrops: a static offset so a still sky still
	// has its clouds spread out, and a negative delay so a moving one starts
	// mid-crossing rather than with every cloud queued off the left edge. The
	// running animation overrides the inline transform, so they never fight.
	drift.style.transform = `translateX(${cloud.x}px)`;
	drift.style.animationDuration = `${seconds}s`;
	drift.style.animationDelay = `${(-(cloud.x / field.width) * seconds).toFixed(1)}s`;

	const group = drift.createSvg("g", {
		attr: { transform: `translate(0 ${cloud.y}) scale(${cloud.scale})` },
	});
	group.createSvg("ellipse", { attr: { cx: "-14", cy: "4", rx: "16", ry: "10" } });
	group.createSvg("ellipse", { attr: { cx: "2", cy: "-2", rx: "18", ry: "13" } });
	group.createSvg("ellipse", { attr: { cx: "18", cy: "5", rx: "15", ry: "9" } });
	group.createSvg("rect", { attr: { x: "-28", y: "4", width: "58", height: "11", rx: "5.5" } });
}

/** Falling precipitation: slanted streaks for rain and drizzle, drifting discs
 * for snow. Positions are evenly spread with a per-drop delay so the fall never
 * looks like a marching row. */
function drawPrecipitation(svg: SVGElement, group: WeatherGroup, field: SkyField): void {
	const snow = group === "snow";
	const count = Math.round(field.drops * (group === "drizzle" ? 0.7 : snow ? 0.8 : 1));
	// Two classes, so an array — see drawCloud.
	const layer = svg.createSvg("g", { cls: ["hearth-weather-fall", `is-${group}`] });
	const span = field.width - 10;
	for (let i = 0; i < count; i++) {
		// A prime-ish stride spreads the drops across the width without clumping
		// into visible columns the way `i * width / count` would.
		const x = ((i * 37) % span) + 5;
		const duration = (snow ? 3.4 : 1.1) + (i % 5) * 0.18;
		const drop = snow
			? layer.createSvg("circle", { attr: { cx: String(x), cy: "0", r: "1.6" } })
			: layer.createSvg("line", {
					attr: {
						x1: String(x),
						y1: "0",
						x2: String(x - 3),
						y2: group === "drizzle" ? "7" : "11",
					},
			  });
		// Spread the field down the sky. Two mechanisms, because the sky can be
		// drawn either way: a static offset for a still sky (low power, motion
		// off), and a *negative* delay for a moving one — every drop starts
		// partway through its own fall, so the first frame is already a shower
		// rather than a row of drops queued at the top. A running animation
		// overrides the inline transform, so the two never fight.
		const progress = i / count;
		drop.style.transform = `translate(${-progress * 24}px, ${progress * field.fall - 10}px)`;
		drop.style.animationDelay = `${(-progress * duration).toFixed(2)}s`;
		// Staggering the duration too keeps the field from pulsing in unison.
		drop.style.animationDuration = `${duration}s`;
	}
}

/** Where the sun or moon hangs: up and to the right, in both spreads. */
function celestialCentre(field: SkyField): { cx: number; cy: number } {
	return { cx: Math.round(field.width * 0.79), cy: Math.round(field.height * 0.233) };
}

/** The sun, with a soft corona. */
function drawSun(svg: SVGElement, field: SkyField): void {
	const { cx, cy } = celestialCentre(field);
	const group = svg.createSvg("g", { cls: "hearth-weather-sun" });
	group.createSvg("circle", {
		cls: "hearth-weather-sun-glow",
		attr: { cx: String(cx), cy: String(cy), r: "30" },
	});
	group.createSvg("circle", {
		cls: "hearth-weather-sun-disc",
		attr: { cx: String(cx), cy: String(cy), r: "15" },
	});
}

/** The moon: two arcs meeting where the lit disc and the shadow circle cross.
 * Two overlapping circles filled `evenodd` would be the obvious shortcut and is
 * wrong — that fills their symmetric difference, so the shadow's own outer lobe
 * lights up too. A `<mask>` draws it correctly but needs a `<defs>` and a
 * document-unique id: state to keep correct across every sky and every redraw,
 * in exchange for nothing visible. */
function drawMoon(svg: SVGElement, field: SkyField): void {
	const { cx, cy } = celestialCentre(field);
	const group = svg.createSvg("g", {
		cls: "hearth-weather-moon",
		// The crescent path below is written for the card's centre (158,28), so
		// the whole group is translated rather than the path re-derived.
		attr: { transform: `translate(${cx - 158} ${cy - 28})` },
	});
	group.createSvg("circle", {
		cls: "hearth-weather-moon-glow",
		attr: { cx: "158", cy: "28", r: "26" },
	});
	group.createSvg("path", {
		cls: "hearth-weather-moon-disc",
		attr: {
			// Disc centred (158,28) r15; shadow centred (149,19) r17. The major
			// arc of the disc out round the lit side, then the shadow's minor arc
			// back along the terminator.
			d: "M165.53,15.03 A15,15 0 1 1 145.03,35.53 A17,17 0 0 0 165.53,15.03 Z",
		},
	});
}

/**
 * Fog: overlapping wisps of different sizes, drifting past each other at
 * different speeds and depths.
 *
 * Three flat bands — which is what this was — read as three lines drawn across
 * the sky, because that is what they are. Fog has no edges: what sells it is
 * many soft shapes at low opacity, sliding over one another so the density
 * keeps changing. The whole bank is faded as a group, so the overlaps merge
 * into one body of haze instead of stacking into visible seams.
 */
function drawFog(svg: SVGElement, field: SkyField, seed = 0xf066): void {
	const layer = svg.createSvg("g", { cls: "hearth-weather-fogbank" });
	const rand = seeded(seed);
	const count = Math.round(field.width / 26);
	for (let i = 0; i < count; i++) {
		// Spread down the whole sky, thickening towards the bottom the way fog
		// actually sits: the lower half gets the bigger, denser wisps.
		const depth = rand();
		const y = Math.round(field.height * (0.18 + depth * 0.72));
		const rx = Math.round(field.width * (0.12 + rand() * 0.22));
		const ry = Math.round(field.height * (0.03 + depth * 0.055));
		const wisp = layer.createSvg("ellipse", {
			attr: { cx: "0", cy: String(y), rx: String(rx), ry: String(ry) },
		});
		// Nearer wisps (lower down) are denser and slide past faster, which is
		// the whole parallax cue that makes a flat gradient read as depth.
		wisp.style.opacity = (0.25 + depth * 0.45).toFixed(2);
		const seconds = 34 + (1 - depth) * 46;
		const x = Math.round(rand() * (field.width + rx * 2) - rx);
		wisp.style.transform = `translateX(${x}px)`;
		wisp.style.animationDuration = `${seconds.toFixed(1)}s`;
		wisp.style.animationDelay = `${(-(x / field.width) * seconds).toFixed(1)}s`;
	}
}

/**
 * One jagged discharge, as a path: a stroke that walks down the sky, wandering
 * sideways as it goes, with a chance of throwing off a short fork.
 *
 * Generated rather than drawn, because a hand-drawn bolt is a *shape* — the eye
 * learns it in one flash and every strike after that is the same cartoon in the
 * same place. A walk gives each strike its own crooked line, and three of them
 * on coprime timers means the storm rarely repeats itself.
 */
function boltPath(rand: () => number, x: number, top: number, bottom: number): string {
	const steps = 5 + Math.floor(rand() * 3);
	const dy = (bottom - top) / steps;
	let cx = x;
	let cy = top;
	const points = [`M${cx.toFixed(1)},${cy.toFixed(1)}`];
	let fork = "";
	for (let i = 0; i < steps; i++) {
		// Each segment leans one way or the other, and the lean grows as the
		// discharge travels — a bolt frays as it descends.
		cx += (rand() - 0.5) * 14 * (1 + i / steps);
		cy += dy;
		points.push(`L${cx.toFixed(1)},${cy.toFixed(1)}`);
		// One branch, from somewhere in the middle of the run.
		if (!fork && i > 1 && rand() < 0.45) {
			const fx = cx + (rand() - 0.5) * 26;
			const fy = cy + dy * (0.7 + rand());
			fork = ` M${cx.toFixed(1)},${cy.toFixed(1)} L${fx.toFixed(1)},${fy.toFixed(1)}`;
		}
	}
	return points.join(" ") + fork;
}

/**
 * The storm: a few discharges over a sheet flash.
 *
 * Each bolt runs on its own timer, and the durations are coprime-ish so they
 * drift out of phase rather than striking together on a loop. The sheet flash
 * behind them is what actually reads as lightning at a glance — a whole sky
 * momentarily going pale — with the bolts as the detail inside it.
 */
function drawStorm(svg: SVGElement, field: SkyField, seed = 0xb017): void {
	const rand = seeded(seed);
	// Behind everything: the sky itself going pale for an instant.
	svg.createSvg("rect", {
		cls: "hearth-weather-flash",
		attr: { x: "0", y: "0", width: String(field.width), height: String(field.height) },
	});

	const layer = svg.createSvg("g", { cls: "hearth-weather-bolts" });
	const durations = [7.3, 11.1, 13.7];
	const count = field.width > 300 ? 3 : 2;
	for (let i = 0; i < count; i++) {
		// One discharge per band of the sky, jittered inside it. Drawing all of
		// them from one unconstrained roll let the seed put three strikes on top
		// of each other, which reads as a scribble rather than a storm.
		const band = (i + 0.5) / count;
		const x = field.width * (0.12 + band * 0.76 + (rand() - 0.5) * 0.14);
		const top = field.height * (0.1 + rand() * 0.12);
		const bottom = field.height * (0.55 + rand() * 0.3);
		const bolt = layer.createSvg("path", {
			cls: "hearth-weather-bolt",
			attr: { d: boltPath(rand, x, top, bottom) },
		});
		bolt.style.animationDuration = `${durations[i % durations.length]}s`;
		bolt.style.animationDelay = `${(-rand() * 9).toFixed(1)}s`;
	}
}

/** How many of the cloud bank a condition puts on screen — what separates
 * "partly cloudy" from "overcast". */
function cloudCount(group: WeatherGroup, total: number): number {
	if (group === "clear") return 0;
	if (group === "partly") return Math.max(1, Math.round(total / 3));
	if (group === "fog") return Math.max(2, Math.round(total * 0.6));
	return total;
}

export interface SkyOptions {
	/** WMO weather code — what the sky is doing. */
	code: number;
	/** Daylight at the location, not at the reader's desk. */
	isDay: boolean;
	/** Drift, fall and twinkle. Callers switch this off from the `reduced` tier
	 * down, and while the focus/visibility gate says nobody is looking. */
	animate: boolean;
	/** How much sky there is to fill. Default "card". */
	spread?: SkySpread;
}

/**
 * Paint a sky into `parent` and return the element it created, so a caller can
 * lay its own content over the top.
 */
export function drawSky(parent: HTMLElement, opts: SkyOptions): HTMLElement {
	const group = weatherGroup(opts.code);
	const field = fieldFor(opts.spread ?? "card");

	const sky = parent.createDiv(`hearth-weather-sky sky-${group}`);
	sky.toggleClass("is-night", !opts.isDay);
	sky.toggleClass("is-animated", opts.animate);
	// The drift and fall distances are the one part of the animation that has to
	// know how big the box is, so they cross into CSS as variables rather than
	// being baked into the keyframes.
	sky.style.setProperty("--sky-drift-from", `${field.driftFrom}px`);
	sky.style.setProperty("--sky-drift-to", `${field.driftTo}px`);
	sky.style.setProperty("--sky-fall", `${field.fall}px`);

	const svg = sky.createSvg("svg", {
		cls: "hearth-weather-art",
		attr: {
			viewBox: `0 0 ${field.width} ${field.height}`,
			// `slice` fills the box at any aspect ratio, cropping rather than
			// letterboxing — a sky with bars around it isn't a sky.
			preserveAspectRatio: "xMidYMid slice",
			"aria-hidden": "true",
		},
	});

	const celestial = group === "clear" || group === "partly";
	if (celestial) {
		if (opts.isDay) drawSun(svg, field);
		else drawMoon(svg, field);
	}
	if (celestial && !opts.isDay) {
		const stars = svg.createSvg("g", { cls: "hearth-weather-stars" });
		for (const star of field.stars) {
			const dot = stars.createSvg("circle", {
				attr: { cx: String(star.x), cy: String(star.y), r: String(star.r) },
			});
			dot.style.animationDelay = `${star.delay}s`;
		}
	}

	if (group === "fog") drawFog(svg, field);

	const clouds = cloudCount(group, field.clouds.length);
	for (let i = 0; i < clouds; i++) drawCloud(svg, field.clouds[i], field);

	if (group === "rain" || group === "drizzle" || group === "snow") {
		drawPrecipitation(svg, group, field);
	}
	if (group === "thunder") {
		drawPrecipitation(svg, "rain", field);
		drawStorm(svg, field);
	}

	return sky;
}
