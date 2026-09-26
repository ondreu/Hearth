import { setIcon } from "obsidian";
import {
	instantOf,
	minutesInto,
	moonPhase,
	type MoonPhase,
	moonTimes,
	nextMoonPhase,
	splitMinutes,
	sunArc,
	wallClockAt,
} from "../astro";
import { t } from "../i18n";
import { starField } from "../sky";
import {
	formatDayDate,
	formatHour,
	formatPercent,
	today,
	type WeatherDay,
	type WeatherSnapshot,
} from "../weather";


// ---- Moon and daylight --------------------------------------------------
//
// The weather card's two sky-clock styles. Neither needs anything the forecast
// doesn't already carry: the moon is computed from the clock and the card's
// coordinates (src/astro.ts), and the sun's arc from the day's sunrise and
// sunset. Both read the *location's* clock, not the reader's, so a card set to
// Tokyo shows Tokyo's moonrise and Tokyo's evening.
//
// They are drawn in the Material 3 Expressive manner rather than the painted
// sky's: flat tonal fills from one palette per style (declared as tokens in
// styles.css, light and dark), the shape library's soft polygons — a nine-lobed
// "cookie" behind the moon, an eight-pointed "sunny" for the sun — a thick wavy
// active track and a flat inactive one, and a slider with a pill handle. No
// gradients and no blur: every colour here is a class the stylesheet fills.


/** What both styles need from the card that paints them. */
export interface AstroOptions {
	lat: number;
	lon: number;
	/** The place name, or "" when the card is set not to show it. */
	place: string;
	hour12: boolean | undefined;
	/** Loop the motion: the turning shapes, the floating moon, the stars. */
	animate: boolean;
	/** Play the one-off entrance too — the moon rising, the slider filling,
	 * the sun walking up to the hour. Only on a card's first paint, so a
	 * refresh doesn't replay it. */
	intro: boolean;
	/** The moon style's pared-down layout: the moon and the month's slider, on
	 * the card's own surface, and nothing else. */
	clean: boolean;
	/** The current conditions as a glyph and a temperature, or null to leave
	 * them off. */
	now: { icon: string; temp: string } | null;
	/** "Updated 14:20", or "" to leave it off. */
	updated: string;
}

/** SVG `id`s must be unique in the document, and a board can hold two moons. */
let idSeq = 0;
function uid(prefix: string): string {
	idSeq += 1;
	return `hearth-${prefix}-${idSeq}`;
}

/** The location's UTC offset in seconds. Before a response carried it we fall
 * back to the reader's own — wrong for a faraway place, but only until the next
 * fetch. */
function offsetOf(snapshot: WeatherSnapshot, ms: number): number {
	return snapshot.utcOffset ?? -new Date(ms).getTimezoneOffset() * 60;
}

/** The location's wall clock right now. */
function wallNow(snapshot: WeatherSnapshot, ms: number): string {
	return wallClockAt(ms, offsetOf(snapshot, ms));
}

/** An instant, printed as a time on the location's clock. */
function timeAt(ms: number | null, snapshot: WeatherSnapshot, hour12: boolean | undefined): string {
	if (ms === null) return "—";
	return formatHour(wallClockAt(ms, offsetOf(snapshot, ms)), hour12) || "—";
}

/** Whole days from one `YYYY-MM-DD` to another. */
function daysBetween(from: string, to: string): number {
	return Math.round((instantOf(to, 0) - instantOf(from, 0)) / 86_400_000);
}

const SVG_NS = { xmlns: "http://www.w3.org/2000/svg" };

/** An `svg` element with a viewBox, in the SVG namespace. */
function svgRoot(
	parent: HTMLElement,
	// An array for more than one class: createSvg hands `cls` to classList.add(),
	// which rejects a token containing a space (see drawCloud in sky.ts).
	cls: string | string[],
	viewBox: string,
	aspect = "xMidYMid meet",
): SVGSVGElement {
	return parent.createSvg("svg", {
		cls,
		attr: { ...SVG_NS, viewBox, preserveAspectRatio: aspect, "aria-hidden": "true" },
	});
}


// ---- Shapes -------------------------------------------------------------

/**
 * A soft polygon from Material's shape library, as a path: a circle whose
 * radius swells and dips `lobes` times round, by `depth` of the radius. Nine
 * shallow lobes is the "cookie", eight deeper ones the "sunny". The first lobe
 * points straight up. Exported for the tests.
 */
export function shapePath(cx: number, cy: number, r: number, lobes: number, depth: number): string {
	const steps = Math.max(lobes, 3) * 12;
	const points: string[] = [];
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		const radius = r * (1 + depth * Math.cos(lobes * a));
		const x = cx + radius * Math.sin(a);
		const y = cy - radius * Math.cos(a);
		points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
	}
	return `M ${points.join(" L ")} Z`;
}

/**
 * A polyline as a wave that runs along it: every point pushed off the line
 * along its normal by a sine of the distance travelled. Material's wavy
 * progress track, bent to follow the sun's arc. Exported for the tests.
 */
export function wavePath(
	points: { x: number; y: number }[],
	amplitude: number,
	wavelength: number,
): string {
	if (points.length < 2) return "";
	let travelled = 0;
	const out: string[] = [];
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (i > 0) travelled += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
		// The normal from the neighbours on either side, so a bend doesn't kink.
		const a = points[Math.max(i - 1, 0)];
		const b = points[Math.min(i + 1, points.length - 1)];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const offset = amplitude * Math.sin((travelled / wavelength) * Math.PI * 2);
		const x = p.x + (-dy / len) * offset;
		const y = p.y + (dx / len) * offset;
		out.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	return `M ${out.join(" L ")}`;
}


// ---- The moon -----------------------------------------------------------

/**
 * The lit part of a moon disc centred on (cx, cy), as a path: the bright limb
 * as a half circle, closed by the terminator as a half ellipse whose width is
 * how far the lit fraction is from a half moon. Waxing moons are lit on the
 * right, as seen from the northern hemisphere; the caller mirrors it for the
 * southern one. Exported for the tests — the path is the drawing.
 */
export function litPath(phase: MoonPhase, cx: number, cy: number, r: number): string {
	const f = Math.min(Math.max(phase.illumination, 0), 1);
	const rx = Math.abs(1 - 2 * f) * r;
	const top = `${cx} ${cy - r}`;
	const bottom = `${cx} ${cy + r}`;
	// Screen coordinates, y down: sweep 1 turns clockwise. The limb runs top to
	// bottom round the lit side; the terminator comes back up, bulging *toward*
	// the lit side for a crescent and away from it for a gibbous moon.
	const crescent = f < 0.5;
	const limbSweep = phase.waxing ? 1 : 0;
	const termSweep = phase.waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
	return (
		`M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} ` +
		`A ${rx.toFixed(3)} ${r} 0 0 ${termSweep} ${top} Z`
	);
}

/** The seas and the craters, as circles in fractions of the radius — flat
 * spots in two tones, placed by hand after the near side's big patches: a
 * regular pattern reads as a golf ball, a random one as a rash. */
const MARIA: [number, number, number][] = [
	[-0.3, -0.3, 0.26],
	[0.14, -0.16, 0.22],
	[-0.12, 0.24, 0.17],
	[0.38, 0.14, 0.14],
	[-0.5, 0.14, 0.12],
];
const CRATERS: [number, number, number][] = [
	[0.12, 0.62, 0.09],
	[0.52, -0.42, 0.08],
	[-0.26, 0.58, 0.06],
	[0.62, 0.36, 0.05],
	[-0.6, -0.22, 0.05],
];

/** The moon itself, on a cookie that turns slowly behind it: the unlit disc,
 * the lit part with a crisp terminator, and its seas and craters on the lit
 * side only. Both layouts draw it the same. */
function drawMoonDisc(parent: HTMLElement, phase: MoonPhase, southern: boolean): void {
	const svg = svgRoot(parent, "hearth-moon-svg", "0 0 100 100");
	const defs = svg.createSvg("defs");
	const clip = uid("moon-clip");
	const litClip = uid("moon-litclip");
	const R = 33;

	// Its own group, so the turn and the entrance don't fight over transform.
	svg.createSvg("g", { cls: "hearth-moon-shape-wrap" }).createSvg("path", {
		cls: "hearth-moon-shape",
		attr: { d: shapePath(50, 50, 46, 9, 0.055) },
	});

	defs.createSvg("clipPath", { attr: { id: clip } }).createSvg("circle", {
		attr: { cx: "50", cy: "50", r: String(R) },
	});
	// South of the equator the moon is seen upside down: a waxing moon is lit
	// on the left, so the lit shape is mirrored.
	const mirror = southern ? "translate(100 0) scale(-1 1)" : null;
	const lit = litPath(phase, 50, 50, R);
	const litShape = defs.createSvg("clipPath", { attr: { id: litClip } }).createSvg("path", {
		attr: { d: lit },
	});
	if (mirror) litShape.setAttribute("transform", mirror);

	const body = svg.createSvg("g", { cls: "hearth-moon-body", attr: { "clip-path": `url(#${clip})` } });
	// A hair smaller than the lit part, so a full moon has no dark rim where
	// the two edges antialias over each other.
	body.createSvg("circle", { cls: "hearth-moon-dark", attr: { cx: "50", cy: "50", r: String(R - 0.4) } });
	const litEl = body.createSvg("path", { cls: "hearth-moon-lit", attr: { d: lit } });
	if (mirror) litEl.setAttribute("transform", mirror);

	const surface = body.createSvg("g", { attr: { "clip-path": `url(#${litClip})` } });
	const spots = (list: [number, number, number][], cls: string): void => {
		for (const [x, y, r] of list) {
			surface.createSvg("circle", {
				cls,
				attr: { cx: (50 + x * R).toFixed(2), cy: (50 + y * R).toFixed(2), r: (r * R).toFixed(2) },
			});
		}
	};
	spots(MARIA, "hearth-moon-mare");
	spots(CRATERS, "hearth-moon-crater");
}

/**
 * Where tonight sits between one new moon and the next, as Material's
 * expressive slider: a thick active track up to tonight, a pill handle with a
 * gap either side of it, the inactive track after, and stop dots at the first
 * quarter, the full moon and the last quarter.
 */
function cycleSlider(parent: HTMLElement, phase: MoonPhase): void {
	const pct = Math.min(Math.max(phase.phase, 0), 1) * 100;
	const slider = parent.createDiv({
		cls: "hearth-moon-slider",
		attr: { role: "img", "aria-label": `${t().cards.weather.moon.cycle}: ${moonSummary(Date.now())}` },
	});
	// The gap either side of the handle is the stylesheet's; see styles.css.
	slider.createDiv("hearth-moon-slider-active").style.width = `max(0px, calc(${pct.toFixed(2)}% - var(--hearth-slider-gap)))`;
	slider.createDiv("hearth-moon-slider-inactive").style.insetInlineStart =
		`min(100%, calc(${pct.toFixed(2)}% + var(--hearth-slider-gap)))`;
	for (const at of [0.25, 0.5, 0.75]) {
		// A stop that would sit in the handle's gap is the handle's to show.
		if (Math.abs(at * 100 - pct) < 3) continue;
		const stop = slider.createDiv("hearth-moon-slider-stop");
		stop.toggleClass("is-past", at * 100 < pct);
		stop.toggleClass("is-full", at === 0.5);
		stop.style.insetInlineStart = `${at * 100}%`;
	}
	slider.createDiv("hearth-moon-slider-handle").style.insetInlineStart = `${pct.toFixed(2)}%`;
}

/** One fact under the moon: an icon in a round tonal badge, a label, a value
 * and an optional note. */
function moonFact(
	parent: HTMLElement,
	icon: string,
	label: string,
	value: string,
	note = "",
	filled = false,
): void {
	const fact = parent.createDiv("hearth-moon-fact");
	const badge = fact.createDiv("hearth-moon-fact-icon");
	badge.toggleClass("is-filled", filled);
	setIcon(badge, icon);
	const text = fact.createDiv("hearth-moon-fact-text");
	text.createDiv({ cls: "hearth-moon-fact-label", text: label });
	const line = text.createDiv({ cls: "hearth-moon-fact-value", text: value });
	if (note) line.createSpan({ cls: "hearth-moon-fact-note", text: note });
}

/** The next full or new moon as a fact: its date, and how far off it is. */
function phaseFact(
	parent: HTMLElement,
	icon: string,
	label: string,
	at: number,
	todayDate: string,
	snapshot: WeatherSnapshot,
	filled: boolean,
): void {
	const date = wallClockAt(at, offsetOf(snapshot, at)).slice(0, 10);
	moonFact(
		parent,
		icon,
		label,
		formatDayDate(date),
		t().cards.weather.moon.inDays(daysBetween(todayDate, date)),
		filled,
	);
}

/**
 * Moon: tonight's moon in its real phase, what it is called and how much of it
 * is lit, where tonight sits in the month, and the next full and new moon with
 * today's moonrise and moonset. The clean layout keeps only the moon and the
 * month's slider, on the card's own surface.
 */
export function paintMoon(wrap: HTMLElement, snapshot: WeatherSnapshot, opts: AstroOptions): void {
	const strings = t().cards.weather.moon;
	const ms = Date.now();
	const wall = wallNow(snapshot, ms);
	const todayDate = wall.slice(0, 10);
	const offset = offsetOf(snapshot, ms);
	const phase = moonPhase(ms);

	wrap.toggleClass("is-animated", opts.animate);
	wrap.toggleClass("is-intro", opts.intro && opts.animate);
	wrap.toggleClass("is-clean", opts.clean);

	if (opts.clean) {
		// Nothing is written on the card, so the phase is the hover text: the
		// drawing says it, the tooltip names it.
		const disc = wrap.createDiv({ cls: "hearth-moon-disc", attr: { title: moonSummary(ms) } });
		drawMoonDisc(disc, phase, opts.lat < 0);
		cycleSlider(wrap, phase);
		return;
	}

	// A few stars behind everything, in the palette's own tone.
	const sky = svgRoot(wrap, ["hearth-moon-stars", "hearth-weather-stars"], "0 0 200 120", "xMidYMid slice");
	for (const star of starField(22, 200, 120, 0x3007, 0.5)) {
		const c = sky.createSvg("circle", {
			attr: { cx: String(star.x), cy: String(star.y), r: String(star.r * 0.6) },
		});
		c.style.animationDelay = `${star.delay}s`;
	}

	const main = wrap.createDiv("hearth-moon-main");
	drawMoonDisc(main.createDiv("hearth-moon-disc"), phase, opts.lat < 0);
	const text = main.createDiv("hearth-moon-text");
	if (opts.place) text.createDiv({ cls: "hearth-moon-place", text: opts.place });
	text.createDiv({ cls: "hearth-moon-name", text: strings.phases[phase.key] });
	text.createDiv({
		cls: "hearth-moon-sub",
		text: [
			strings.illuminated(formatPercent(Math.round(phase.illumination * 100))),
			strings.age(Math.max(Math.floor(phase.age), 0)),
		].join(" · "),
	});

	cycleSlider(wrap, phase);

	// Searched from the start of the location's day, so a full moon that fell
	// this morning still says "Today" rather than a month from now.
	const dayStart = instantOf(todayDate, offset);
	const facts = wrap.createDiv("hearth-moon-facts");
	phaseFact(facts, "circle", strings.nextFull, nextMoonPhase(dayStart, 0.5), todayDate, snapshot, true);
	phaseFact(facts, "circle", strings.nextNew, nextMoonPhase(dayStart, 0), todayDate, snapshot, false);
	const times = moonTimes(dayStart, opts.lat, opts.lon);
	moonFact(facts, "arrow-up", strings.moonrise, timeAt(times.rise, snapshot, opts.hour12));
	moonFact(facts, "arrow-down", strings.moonset, timeAt(times.set, snapshot, opts.hour12));

	if (opts.updated) wrap.createDiv({ cls: "hearth-moon-updated", text: opts.updated });
}

/** The moon's line in the full forecast: its phase and how much of it is lit. */
export function moonSummary(ms: number): string {
	const phase = moonPhase(ms);
	const strings = t().cards.weather.moon;
	return `${strings.phases[phase.key]} · ${formatPercent(Math.round(phase.illumination * 100))}`;
}


// ---- The sun's arc ------------------------------------------------------

/**
 * The arc's drawing box, in CSS pixels. It is laid out for the room the card
 * actually has rather than scaled from a fixed viewBox, so the horizon always
 * runs the card's full width and the sun stays round at any aspect. The
 * horizon sits low: the day's parabola gets the height, and the night's
 * shallower one just shows under it.
 */
interface ArcBox {
	w: number;
	h: number;
	pad: number;
	horizon: number;
	/** Height of the day's parabola over the horizon. */
	day: number;
	/** Depth of the night's under it. */
	night: number;
}

/** Lay the arc out in a `w` × `h` box. Exported for the tests. */
export function arcBox(w: number, h: number): ArcBox {
	const width = Math.max(w, 60);
	const height = Math.max(h, 36);
	const night = Math.min(Math.max(height * 0.14, 8), 18);
	const horizon = height - night - 6;
	// Clear of the top by the sun's points and a little of its glow.
	const day = Math.max(horizon - 20, 10);
	return { w: width, h: height, pad: 16, horizon, day, night };
}

/** Minutes past midnight to an x across the box. */
function arcX(box: ArcBox, minute: number): number {
	return box.pad + (minute / 1440) * (box.w - box.pad * 2);
}

/** The day's sunrise, sunset and the next sunrise as minutes into it. */
interface DayTimes {
	/** The daily entry the location's clock is in, and the one after it. */
	day: WeatherDay | null;
	next: WeatherDay | undefined;
	date: string;
	sunrise: number | null;
	sunset: number | null;
	nextSunrise: number | undefined;
}

function dayTimes(snapshot: WeatherSnapshot, wall: string): DayTimes {
	const date = wall.slice(0, 10);
	const days = snapshot.daily;
	const i = days.findIndex((d) => d.date === date);
	const day: WeatherDay | null = i >= 0 ? days[i] : today(snapshot);
	const dayDate = day?.date ?? date;
	const next = i >= 0 ? days[i + 1] : undefined;
	return {
		day,
		next,
		date: dayDate,
		sunrise: day ? minutesInto(dayDate, day.sunrise) : null,
		sunset: day ? minutesInto(dayDate, day.sunset) : null,
		nextSunrise: next ? (minutesInto(dayDate, next.sunrise) ?? undefined) : undefined,
	};
}

/** Ease out: quick off the mark, gentle into place. */
function easeOut(x: number): number {
	return 1 - Math.pow(1 - x, 3);
}

/** A pill with an icon and a label: the headline's kicker and the foot's ends. */
function chip(parent: HTMLElement, cls: string, icon: string, text: string): HTMLElement {
	const el = parent.createDiv(`hearth-sun-chip ${cls}`);
	setIcon(el.createSpan("hearth-sun-chip-icon"), icon);
	el.createSpan({ text });
	return el;
}

/**
 * Daylight: the sun on a parabola from sunrise to sunset, the stretch it has
 * already travelled drawn as a wave, and the time of the next sunset (or
 * sunrise, by night) above it with how long until it.
 *
 * Returns a tick: call it with the time to walk the sun on without rebuilding
 * the card. It answers false when the drawing can't follow — the sun has
 * crossed the horizon, or the day has turned — and the card should repaint.
 */
export function paintDaylight(
	wrap: HTMLElement,
	snapshot: WeatherSnapshot,
	opts: AstroOptions,
): (ms: number) => boolean {
	const strings = t().cards.weather;
	const ms0 = Date.now();
	const times = dayTimes(snapshot, wallNow(snapshot, ms0));
	const minuteAt = (ms: number): number => minutesInto(times.date, wallNow(snapshot, ms)) ?? 0;
	const { sunrise, sunset } = times;
	const polar = sunrise === null || sunset === null;
	const arcAt = (minute: number) =>
		polar ? null : sunArc(minute, sunrise, sunset, times.nextSunrise);
	const first = arcAt(minuteAt(ms0));
	const isDay = first ? first.isDay : snapshot.now.isDay;

	wrap.toggleClass("is-animated", opts.animate);
	wrap.toggleClass("is-night", !isDay);

	// ---- The headline: the next horizon crossing and how long until it ----
	const head = wrap.createDiv("hearth-sun-head");
	const lead = head.createDiv("hearth-sun-lead");
	chip(lead, "hearth-sun-kicker", isDay ? "sunset" : "sunrise", isDay ? strings.sunset : strings.sunrise);
	const day = times.day;
	const nextTime = (() => {
		if (polar || !day) return "";
		if (isDay) return formatHour(day.sunset, opts.hour12);
		// Before dawn the sunrise is today's; after dusk it is tomorrow's.
		if (minuteAt(ms0) < sunrise) return formatHour(day.sunrise, opts.hour12);
		return formatHour(times.next?.sunrise ?? day.sunrise, opts.hour12);
	})();
	lead.createDiv({
		cls: "hearth-sun-time",
		text: polar ? (isDay ? strings.daylight.polarDay : strings.daylight.polarNight) : nextTime,
	});
	const until = lead.createDiv("hearth-sun-until");

	if (opts.now || opts.place) {
		const side = head.createDiv("hearth-sun-side");
		if (opts.now) {
			const now = side.createDiv("hearth-sun-now");
			setIcon(now.createSpan("hearth-sun-now-icon"), opts.now.icon);
			now.createSpan({ cls: "hearth-sun-now-temp", text: opts.now.temp });
		}
		if (opts.place) side.createDiv({ cls: "hearth-sun-place", text: opts.place });
	}

	// ---- The arc ----
	const stage = wrap.createDiv("hearth-sun-stage");
	const svg = stage.createSvg("svg", {
		cls: "hearth-sun-arc",
		attr: { ...SVG_NS, role: "img", "aria-label": strings.daylight.arc },
	});
	const defs = svg.createSvg("defs");
	const doneClip = uid("sun-done");
	const aheadClip = uid("sun-ahead");
	// The wave is the track clipped to what lies behind the sun; the flat track
	// is clipped to what lies ahead, so the two never overlap.
	const doneRect = defs
		.createSvg("clipPath", { attr: { id: doneClip } })
		.createSvg("rect", { attr: { x: "0", y: "0", width: "0", height: "0" } });
	const aheadRect = defs
		.createSvg("clipPath", { attr: { id: aheadClip } })
		.createSvg("rect", { attr: { x: "0", y: "0", width: "0", height: "0" } });

	// Everything that depends on the box lives in here and is redrawn on resize.
	const layer = svg.createSvg("g");
	const sun = svg.createSvg("g", { cls: "hearth-sun-body" });
	sun.createSvg("circle", { cls: "hearth-sun-glow", attr: { r: "20" } });
	// The sunny shape turns in a group of its own; the body is moved by script.
	sun.createSvg("g", { cls: "hearth-sun-spin" }).createSvg("path", {
		cls: "hearth-sun-shape",
		attr: { d: shapePath(0, 0, 12.5, 8, 0.12) },
	});

	let box = arcBox(300, 112);

	/** Height of the sun over (negative: under) the horizon at `minute`. */
	const liftAt = (minute: number): number => {
		if (polar) return isDay ? box.day : -box.night;
		const arc = sunArc(minute, sunrise, sunset, times.nextSunrise);
		const lift = 4 * arc.progress * (1 - arc.progress);
		return arc.isDay ? box.day * lift : -box.night * lift;
	};

	/** Draw the ground, the tracks and the horizon for the current box. */
	const draw = (): void => {
		layer.empty();
		const { w, h, horizon } = box;
		for (const rect of [doneRect, aheadRect]) rect.setAttribute("height", String(h));
		layer.createSvg("rect", {
			cls: "hearth-sun-ground",
			attr: { x: "0", y: horizon.toFixed(1), width: String(w), height: (h - horizon).toFixed(1) },
		});
		if (!polar) {
			// The whole track, from yesterday's sunset to tomorrow's sunrise, a
			// point every couple of pixels: flat ahead of the sun, a wave behind.
			const from = sunset - 1440;
			const to = times.nextSunrise ?? sunrise + 1440;
			// Sampled finely: the wave is laid along the distance travelled, and
			// the arc's steep flanks cover far more of it per minute than its top.
			const step = 1440 / Math.max((w - box.pad * 2) * 3, 180);
			const points: { x: number; y: number }[] = [];
			for (let m = from; m <= to + step; m += step) {
				const minute = Math.min(m, to);
				points.push({ x: arcX(box, minute), y: horizon - liftAt(minute) });
			}
			const line = `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`;
			// The day already had, as a flat tonal field under the arc.
			const x1 = arcX(box, sunrise).toFixed(1);
			const x2 = arcX(box, sunset).toFixed(1);
			const top = (horizon - 2 * box.day).toFixed(1);
			layer.createSvg("path", {
				cls: "hearth-sun-area",
				attr: {
					d: `M ${x1} ${horizon} Q ${((arcX(box, sunrise) + arcX(box, sunset)) / 2).toFixed(1)} ${top} ${x2} ${horizon} Z`,
					"clip-path": `url(#${doneClip})`,
				},
			});
			layer.createSvg("path", {
				cls: "hearth-sun-track",
				attr: { d: line, "clip-path": `url(#${aheadClip})` },
			});
			layer.createSvg("path", {
				cls: "hearth-sun-trail",
				attr: { d: wavePath(points, 2.4, 26), "clip-path": `url(#${doneClip})` },
			});
		}
		layer.createSvg("line", {
			cls: "hearth-sun-horizon",
			attr: { x1: "0", y1: horizon.toFixed(1), x2: String(w), y2: horizon.toFixed(1) },
		});
		if (!polar) {
			for (const minute of [sunrise, sunset]) {
				layer.createSvg("circle", {
					cls: "hearth-sun-mark",
					attr: { cx: arcX(box, minute).toFixed(1), cy: horizon.toFixed(1), r: "4.5" },
				});
			}
		}
	};

	let shown = minuteAt(ms0);
	/** Stand the sun at `minute`, and draw the wave up to it. */
	const place = (minute: number): void => {
		shown = minute;
		const x = arcX(box, minute);
		const y = box.horizon - liftAt(minute);
		sun.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
		doneRect.setAttribute("width", x.toFixed(1));
		aheadRect.setAttribute("x", x.toFixed(1));
		aheadRect.setAttribute("width", Math.max(box.w - x, 0).toFixed(1));
	};

	/** The "in 3 h 12 min" under the headline. */
	const sayUntil = (minute: number): void => {
		const arc = arcAt(minute);
		if (!arc) {
			until.setText("");
			return;
		}
		const { h, m } = splitMinutes(arc.remaining);
		until.setText(strings.daylight.until(strings.duration(h, m)));
	};

	// Follow the stage's size: the arc is laid out in its pixels, not scaled.
	const observer = new ResizeObserver((entries) => {
		if (!wrap.isConnected) {
			observer.disconnect();
			return;
		}
		const rect = entries[entries.length - 1]?.contentRect;
		if (!rect || rect.width < 1 || rect.height < 1) return;
		box = arcBox(rect.width, rect.height);
		draw();
		place(shown);
	});
	observer.observe(stage);

	// ---- The foot: sunrise, the length of the day, sunset ----
	if (day && !polar) {
		const foot = wrap.createDiv("hearth-sun-foot");
		chip(foot, "hearth-sun-end", "sunrise", formatHour(day.sunrise, opts.hour12));
		const { h, m } = splitMinutes(sunset - sunrise);
		foot.createDiv({
			cls: "hearth-sun-length",
			text: strings.daylight.dayLength(strings.duration(h, m)),
		});
		chip(foot, "hearth-sun-end", "sunset", formatHour(day.sunset, opts.hour12));
	}
	if (opts.updated) wrap.createDiv({ cls: "hearth-weather-updated", text: opts.updated });

	draw();
	const target = minuteAt(ms0);
	sayUntil(target);
	// The entrance: the sun sets off from the horizon it last crossed and walks
	// the arc up to the hour, drawing its wave behind it.
	const start = polar ? target : isDay ? sunrise : target < sunrise ? sunset - 1440 : sunset;
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (opts.animate && opts.intro && !reduced && target - start > 1) {
		place(start);
		const began = performance.now();
		const duration = 1600;
		const step = (stamp: number): void => {
			if (!wrap.isConnected) return;
			const k = Math.min(Math.max((stamp - began) / duration, 0), 1);
			place(start + (target - start) * easeOut(k));
			if (k < 1) window.requestAnimationFrame(step);
		};
		window.requestAnimationFrame(step);
	} else {
		place(target);
	}

	return (ms: number): boolean => {
		if (!wrap.isConnected) {
			observer.disconnect();
			return true;
		}
		const minute = minuteAt(ms);
		const arc = arcAt(minute);
		if (minute >= 1440 || (arc ? arc.isDay : isDay) !== isDay) return false;
		place(minute);
		sayUntil(minute);
		return true;
	};
}
