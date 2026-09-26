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
	formatWeekday,
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


/** What both styles need from the card that paints them. */
export interface AstroOptions {
	lat: number;
	lon: number;
	/** The place name, or "" when the card is set not to show it. */
	place: string;
	hour12: boolean | undefined;
	/** Loop the glow, the stars and the rays. */
	animate: boolean;
	/** Play the one-off entrance too — the sun walking up to the hour. Only on a
	 * card's first paint, so a refresh doesn't replay it. */
	intro: boolean;
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
function svgRoot(parent: HTMLElement, cls: string, viewBox: string, aspect = "xMidYMid meet"): SVGSVGElement {
	return parent.createSvg("svg", {
		cls,
		attr: { ...SVG_NS, viewBox, preserveAspectRatio: aspect, "aria-hidden": "true" },
	});
}

/** A two-stop-or-more gradient in `defs`. */
function gradient(
	defs: SVGElement,
	kind: "linearGradient" | "radialGradient",
	id: string,
	attr: Record<string, string>,
	stops: [string, string, number?][],
): void {
	const g = defs.createSvg(kind, { attr: { id, ...attr } });
	for (const [offset, color, opacity] of stops) {
		g.createSvg("stop", {
			attr: {
				offset,
				"stop-color": color,
				...(opacity === undefined ? {} : { "stop-opacity": String(opacity) }),
			},
		});
	}
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

/** The seas (maria) as ellipses in fractions of the radius — cx, cy, rx, ry,
 * tilt — placed by hand after the near side's big dark patches: a regular
 * pattern reads as a golf ball, a random one as a rash. */
const MARIA: [number, number, number, number, number][] = [
	[-0.28, -0.34, 0.3, 0.22, -20],
	[0.12, -0.18, 0.24, 0.3, 15],
	[0.36, 0.08, 0.18, 0.16, 0],
	[-0.08, 0.2, 0.2, 0.14, 30],
	[-0.46, 0.12, 0.14, 0.26, 10],
	[0.2, 0.46, 0.12, 0.09, 0],
];

/** Craters, cx, cy, r in fractions of the radius. Tycho's bright one sits low. */
const CRATERS: [number, number, number][] = [
	[0.1, 0.66, 0.07],
	[-0.55, -0.1, 0.05],
	[0.52, -0.42, 0.06],
	[-0.2, 0.52, 0.045],
	[0.6, 0.3, 0.04],
];

/** The moon itself: halo, the dark disc under earthshine, the lit part with a
 * soft terminator, and its seas and craters over both. */
function drawMoonDisc(parent: HTMLElement, phase: MoonPhase, southern: boolean): void {
	const svg = svgRoot(parent, "hearth-moon-svg", "0 0 100 100");
	const defs = svg.createSvg("defs");
	const lit = uid("moon-lit");
	const halo = uid("moon-halo");
	const soft = uid("moon-soft");
	const blur = uid("moon-blur");
	const shade = uid("moon-shade");
	const clip = uid("moon-clip");
	const litClip = uid("moon-litclip");
	const R = 36;

	gradient(defs, "radialGradient", lit, { cx: "40%", cy: "36%", r: "72%" }, [
		["0%", "#fffdf6"],
		["60%", "#efe8d4"],
		["100%", "#cbc1a7"],
	]);
	gradient(defs, "radialGradient", halo, { cx: "50%", cy: "50%", r: "50%" }, [
		["55%", "#fff6d8", 0.35],
		["100%", "#fff6d8", 0],
	]);
	// Limb darkening: the disc is a ball, so its edge is dimmer than its face.
	gradient(defs, "radialGradient", shade, { cx: "50%", cy: "50%", r: "50%" }, [
		["70%", "#000", 0],
		["100%", "#000", 0.28],
	]);
	const soften = (id: string, deviation: string): void => {
		defs.createSvg("filter", {
			attr: { id, x: "-20%", y: "-20%", width: "140%", height: "140%" },
		}).createSvg("feGaussianBlur", { attr: { stdDeviation: deviation } });
	};
	soften(soft, "0.9");
	soften(blur, "1.6");
	defs.createSvg("clipPath", { attr: { id: clip } }).createSvg("circle", {
		attr: { cx: "50", cy: "50", r: String(R) },
	});
	// The seas and craters show on the lit part only; the rest is earthshine.
	// South of the equator the moon is seen upside down: a waxing moon is lit
	// on the left, so the lit shape is mirrored.
	const mirror = southern ? "translate(100 0) scale(-1 1)" : null;
	const litShape = defs.createSvg("clipPath", { attr: { id: litClip } }).createSvg("path", {
		attr: { d: litPath(phase, 50, 50, R) },
	});
	if (mirror) litShape.setAttribute("transform", mirror);

	// The halo brightens with the moon: a new moon has none to speak of.
	const glow = svg.createSvg("circle", {
		cls: "hearth-moon-halo",
		attr: { cx: "50", cy: "50", r: "50", fill: `url(#${halo})` },
	});
	glow.style.opacity = String(0.2 + phase.illumination * 0.8);

	const body = svg.createSvg("g", { cls: "hearth-moon-body", attr: { "clip-path": `url(#${clip})` } });
	body.createSvg("circle", { cls: "hearth-moon-dark", attr: { cx: "50", cy: "50", r: String(R) } });
	const litEl = body.createSvg("path", {
		cls: "hearth-moon-lit",
		attr: { d: litPath(phase, 50, 50, R), fill: `url(#${lit})`, filter: `url(#${soft})` },
	});
	if (mirror) litEl.setAttribute("transform", mirror);

	const surface = body.createSvg("g", { attr: { "clip-path": `url(#${litClip})` } });
	const maria = surface.createSvg("g", { cls: "hearth-moon-maria", attr: { filter: `url(#${blur})` } });
	for (const [x, y, rx, ry, tilt] of MARIA) {
		const cx = 50 + x * R;
		const cy = 50 + y * R;
		maria.createSvg("ellipse", {
			attr: {
				cx: cx.toFixed(2),
				cy: cy.toFixed(2),
				rx: (rx * R).toFixed(2),
				ry: (ry * R).toFixed(2),
				transform: `rotate(${tilt} ${cx.toFixed(2)} ${cy.toFixed(2)})`,
			},
		});
	}
	const craters = surface.createSvg("g", { cls: "hearth-moon-craters" });
	for (const [x, y, r] of CRATERS) {
		craters.createSvg("circle", {
			attr: { cx: (50 + x * R).toFixed(2), cy: (50 + y * R).toFixed(2), r: (r * R).toFixed(2) },
		});
	}
	body.createSvg("circle", { attr: { cx: "50", cy: "50", r: String(R), fill: `url(#${shade})` } });
	svg.createSvg("circle", { cls: "hearth-moon-rim", attr: { cx: "50", cy: "50", r: String(R) } });
}

/** One fact under the moon: a label, a value and an optional note. */
function moonFact(parent: HTMLElement, icon: string, label: string, value: string, note = ""): void {
	const fact = parent.createDiv("hearth-moon-fact");
	setIcon(fact.createDiv("hearth-moon-fact-icon"), icon);
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
): void {
	const date = wallClockAt(at, offsetOf(snapshot, at)).slice(0, 10);
	const strings = t().cards.weather.moon;
	moonFact(
		parent,
		icon,
		label,
		`${formatWeekday(date)} ${formatDayDate(date)}`,
		strings.inDays(daysBetween(todayDate, date)),
	);
}

/**
 * Moon: tonight's moon in its real phase on a night sky, what it is called and
 * how much of it is lit, where tonight sits in the month, and the next full and
 * new moon with today's moonrise and moonset.
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

	// The stars sit behind everything, over the whole card.
	const sky = svgRoot(wrap, "hearth-moon-stars hearth-weather-stars", "0 0 200 120", "xMidYMid slice");
	for (const star of starField(28, 200, 120, 0x3007, 0.5)) {
		const c = sky.createSvg("circle", {
			attr: { cx: String(star.x), cy: String(star.y), r: String(star.r * 0.55) },
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

	// Where tonight sits between one new moon and the next, with full in the
	// middle: the track is dark at both ends and bright at its centre.
	const cycle = wrap.createDiv({ cls: "hearth-moon-cycle", attr: { "aria-label": strings.cycle } });
	const track = cycle.createDiv("hearth-moon-track");
	for (const at of [0.25, 0.5, 0.75]) {
		track.createDiv("hearth-moon-tick").style.insetInlineStart = `${at * 100}%`;
	}
	track.createDiv("hearth-moon-marker").style.insetInlineStart = `${phase.phase * 100}%`;

	// Searched from the start of the location's day, so a full moon that fell
	// this morning still says "Today" rather than a month from now.
	const dayStart = instantOf(todayDate, offset);
	const facts = wrap.createDiv("hearth-moon-facts");
	phaseFact(facts, "circle", strings.nextFull, nextMoonPhase(dayStart, 0.5), todayDate, snapshot);
	phaseFact(facts, "circle-dashed", strings.nextNew, nextMoonPhase(dayStart, 0), todayDate, snapshot);
	const times = moonTimes(dayStart, opts.lat, opts.lon);
	moonFact(facts, "arrow-up-right", strings.moonrise, timeAt(times.rise, snapshot, opts.hour12));
	moonFact(facts, "arrow-down-right", strings.moonset, timeAt(times.set, snapshot, opts.hour12));

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
	const horizon = height - night - 5;
	// Clear of the top by the sun's radius and most of its glow.
	const day = Math.max(horizon - 20, 10);
	return { w: width, h: height, pad: 14, horizon, day, night };
}

/** Minutes past midnight to an x across the box. */
function arcX(box: ArcBox, minute: number): number {
	return box.pad + (minute / 1440) * (box.w - box.pad * 2);
}

/** A parabola over (or, with a negative height, under) the horizon between two
 * minutes, as a quadratic Bézier: a control point at twice the height puts the
 * vertex at the height. */
function parabola(box: ArcBox, from: number, to: number, height: number): string {
	const x1 = arcX(box, from);
	const x2 = arcX(box, to);
	const cy = box.horizon - 2 * height;
	return `M ${x1.toFixed(1)} ${box.horizon.toFixed(1)} Q ${((x1 + x2) / 2).toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${box.horizon.toFixed(1)}`;
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

/**
 * Daylight: the sun on a parabola from sunrise to sunset, the stretch it has
 * already travelled drawn in, and the time of the next sunset (or sunrise, by
 * night) above it with how long until it.
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
	const kicker = lead.createDiv("hearth-sun-kicker");
	setIcon(kicker.createSpan("hearth-sun-kicker-icon"), isDay ? "sunset" : "sunrise");
	kicker.createSpan({ text: isDay ? strings.sunset : strings.sunrise });
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
			const chip = side.createDiv("hearth-sun-now");
			setIcon(chip.createSpan("hearth-sun-now-icon"), opts.now.icon);
			chip.createSpan({ cls: "hearth-sun-now-temp", text: opts.now.temp });
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
	const areaGrad = uid("sun-area");
	const trailGrad = uid("sun-trail");
	const coreGrad = uid("sun-core");
	const glowGrad = uid("sun-glow");
	const doneClip = uid("sun-done");
	const aheadClip = uid("sun-ahead");
	gradient(defs, "linearGradient", areaGrad, { x1: "0", y1: "0", x2: "0", y2: "1" }, [
		["0%", "#ffb347", 0.38],
		["100%", "#ffb347", 0.02],
	]);
	gradient(defs, "linearGradient", trailGrad, { x1: "0", y1: "0", x2: "1", y2: "0" }, [
		["0%", "#ff8a3d"],
		["50%", "#ffc247"],
		["100%", "#ff7a59"],
	]);
	gradient(defs, "radialGradient", coreGrad, { cx: "40%", cy: "38%", r: "65%" }, [
		["0%", "#fff6c9"],
		["60%", "#ffd257"],
		["100%", "#ff9f2e"],
	]);
	gradient(defs, "radialGradient", glowGrad, { cx: "50%", cy: "50%", r: "50%" }, [
		["0%", "#ffc54d", 0.55],
		["100%", "#ffc54d", 0],
	]);
	// The trail is the track clipped to what lies behind the sun; the dashed
	// track is clipped to what lies ahead, so the two never overlap.
	const doneRect = defs
		.createSvg("clipPath", { attr: { id: doneClip } })
		.createSvg("rect", { attr: { x: "0", y: "0", width: "0", height: "0" } });
	const aheadRect = defs
		.createSvg("clipPath", { attr: { id: aheadClip } })
		.createSvg("rect", { attr: { x: "0", y: "0", width: "0", height: "0" } });

	// Everything that depends on the box lives in here and is redrawn on resize.
	const layer = svg.createSvg("g");
	// A plumb line from the sun to the horizon marks "now" on the clock.
	const plumb = svg.createSvg("line", { cls: "hearth-sun-plumb" });
	const sun = svg.createSvg("g", { cls: "hearth-sun-body" });
	sun.createSvg("circle", { cls: "hearth-sun-glow", attr: { r: "20", fill: `url(#${glowGrad})` } });
	const rays = sun.createSvg("g", { cls: "hearth-sun-rays" });
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		rays.createSvg("line", {
			attr: {
				x1: (Math.cos(a) * 10).toFixed(2),
				y1: (Math.sin(a) * 10).toFixed(2),
				x2: (Math.cos(a) * 13.5).toFixed(2),
				y2: (Math.sin(a) * 13.5).toFixed(2),
			},
		});
	}
	sun.createSvg("circle", { cls: "hearth-sun-core", attr: { r: "7", fill: `url(#${coreGrad})` } });

	let box = arcBox(300, 112);

	/** Draw the horizon, the ground and the arcs for the current box. */
	const draw = (): void => {
		layer.empty();
		const { w, h, horizon } = box;
		for (const rect of [doneRect, aheadRect]) rect.setAttribute("height", String(h));
		layer.createSvg("rect", {
			cls: "hearth-sun-ground",
			attr: { x: "0", y: horizon.toFixed(1), width: String(w), height: (h - horizon).toFixed(1) },
		});
		if (!polar) {
			const nextSunrise = times.nextSunrise ?? sunrise + 1440;
			const dayPath = parabola(box, sunrise, sunset, box.day);
			const track = [
				parabola(box, sunset - 1440, sunrise, -box.night),
				dayPath,
				parabola(box, sunset, nextSunrise, -box.night),
			].join(" ");
			layer.createSvg("path", {
				cls: "hearth-sun-area",
				attr: { d: `${dayPath} Z`, fill: `url(#${areaGrad})`, "clip-path": `url(#${doneClip})` },
			});
			layer.createSvg("path", {
				cls: "hearth-sun-track",
				attr: { d: track, "clip-path": `url(#${aheadClip})` },
			});
			layer.createSvg("path", {
				cls: "hearth-sun-trail",
				attr: { d: track, stroke: `url(#${trailGrad})`, "clip-path": `url(#${doneClip})` },
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
					attr: { cx: arcX(box, minute).toFixed(1), cy: horizon.toFixed(1), r: "3" },
				});
			}
		}
	};

	let shown = minuteAt(ms0);
	/** Stand the sun at `minute`, and draw the trail up to it. */
	const place = (minute: number): void => {
		shown = minute;
		let y = box.horizon;
		if (polar) y = isDay ? box.horizon - box.day : box.horizon + box.night;
		else {
			const arc = sunArc(minute, sunrise, sunset, times.nextSunrise);
			const lift = 4 * arc.progress * (1 - arc.progress);
			y = arc.isDay ? box.horizon - box.day * lift : box.horizon + box.night * lift;
		}
		const x = arcX(box, minute);
		sun.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
		doneRect.setAttribute("width", x.toFixed(1));
		aheadRect.setAttribute("x", x.toFixed(1));
		aheadRect.setAttribute("width", Math.max(box.w - x, 0).toFixed(1));
		plumb.setAttribute("x1", x.toFixed(1));
		plumb.setAttribute("x2", x.toFixed(1));
		plumb.setAttribute("y1", y.toFixed(1));
		plumb.setAttribute("y2", box.horizon.toFixed(1));
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
		const end = (icon: string, text: string): void => {
			const el = foot.createDiv("hearth-sun-foot-end");
			setIcon(el.createSpan("hearth-sun-foot-icon"), icon);
			el.createSpan({ text });
		};
		end("sunrise", formatHour(day.sunrise, opts.hour12));
		const { h, m } = splitMinutes(sunset - sunrise);
		foot.createDiv({
			cls: "hearth-sun-length",
			text: strings.daylight.dayLength(strings.duration(h, m)),
		});
		end("sunset", formatHour(day.sunset, opts.hour12));
	}
	if (opts.updated) wrap.createDiv({ cls: "hearth-weather-updated", text: opts.updated });

	draw();
	const target = minuteAt(ms0);
	sayUntil(target);
	// The entrance: the sun sets off from the horizon it last crossed and walks
	// the arc up to the hour, drawing its trail behind it.
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
