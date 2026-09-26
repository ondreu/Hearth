/**
 * The sky's clockwork, for the weather card's "moon" and "daylight" styles.
 *
 * Open-Meteo gives us sunrise and sunset but nothing about the moon, and the
 * moon is cheap to work out locally: its phase needs only the time, and its
 * rise and set only the time and the card's coordinates. So nothing here makes
 * a request, and every function is pure — the clock is always an argument — so
 * test/astro.test.ts can pin it.
 *
 * The positions use the low-precision series from Astronomy Answers
 * (https://aa.quae.nl/en/reken/hemelpositie.html), the same ones SunCalc is
 * built on. They are good to a fraction of a degree, which is minutes on a rise
 * time and an hour or two on the instant of a full moon — far finer than a card
 * that prints the day it falls on needs.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
/** Obliquity of the ecliptic. */
const OBLIQUITY = RAD * 23.4397;

/** The mean length of a lunar month (new moon to new moon), in days. */
export const SYNODIC_MONTH = 29.530588853;

/** Days since J2000.0 for an epoch-ms instant. */
function toDays(ms: number): number {
	return ms / DAY_MS - 0.5 + J1970 - J2000;
}

function rightAscension(l: number, b: number): number {
	return Math.atan2(
		Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
		Math.cos(l),
	);
}

function declination(l: number, b: number): number {
	return Math.asin(
		Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l),
	);
}

interface Coords {
	ra: number;
	dec: number;
	/** Distance in km; only the moon's is used. */
	dist: number;
}

function sunCoords(d: number): Coords {
	const m = RAD * (357.5291 + 0.98560028 * d);
	const centre = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
	const perihelion = RAD * 102.9372;
	const l = m + centre + perihelion + Math.PI;
	return { ra: rightAscension(l, 0), dec: declination(l, 0), dist: 149_598_000 };
}

function moonCoords(d: number): Coords {
	const meanLongitude = RAD * (218.316 + 13.176396 * d);
	const meanAnomaly = RAD * (134.963 + 13.064993 * d);
	const argLatitude = RAD * (93.272 + 13.22935 * d);
	const l = meanLongitude + RAD * 6.289 * Math.sin(meanAnomaly);
	const b = RAD * 5.128 * Math.sin(argLatitude);
	return {
		ra: rightAscension(l, b),
		dec: declination(l, b),
		dist: 385_001 - 20_905 * Math.cos(meanAnomaly),
	};
}

// ---- Phase --------------------------------------------------------------

/** The eight names a phase goes by; keys of `t().cards.weather.moon.phases`. */
export type MoonPhaseKey =
	| "new"
	| "waxingCrescent"
	| "firstQuarter"
	| "waxingGibbous"
	| "full"
	| "waningGibbous"
	| "lastQuarter"
	| "waningCrescent";

export interface MoonPhase {
	/** Position in the cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last
	 * quarter, back to 1 = new. */
	phase: number;
	/** Fraction of the disc that is lit, 0–1. */
	illumination: number;
	/** Days since the last new moon, on the mean month. */
	age: number;
	waxing: boolean;
	key: MoonPhaseKey;
}

/**
 * Name a phase. The four principal phases are instants, but a card that only
 * said "Full moon" at the one minute it happens would never say it at all — so
 * each owns a day either side of its instant, and the crescents and gibbouses
 * fill the rest.
 */
export function moonPhaseKey(phase: number): MoonPhaseKey {
	const p = ((phase % 1) + 1) % 1;
	const w = 1 / SYNODIC_MONTH;
	if (p < w || p > 1 - w) return "new";
	if (p < 0.25 - w) return "waxingCrescent";
	if (p <= 0.25 + w) return "firstQuarter";
	if (p < 0.5 - w) return "waxingGibbous";
	if (p <= 0.5 + w) return "full";
	if (p < 0.75 - w) return "waningGibbous";
	if (p <= 0.75 + w) return "lastQuarter";
	return "waningCrescent";
}

/** The moon's phase at an instant. */
export function moonPhase(ms: number): MoonPhase {
	const d = toDays(ms);
	const s = sunCoords(d);
	const m = moonCoords(d);

	// Elongation of the moon from the sun, then the phase angle seen from it.
	const phi = Math.acos(
		Math.sin(s.dec) * Math.sin(m.dec) +
			Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
	);
	const inc = Math.atan2(s.dist * Math.sin(phi), m.dist - s.dist * Math.cos(phi));
	const angle = Math.atan2(
		Math.cos(s.dec) * Math.sin(s.ra - m.ra),
		Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
	);

	const illumination = (1 + Math.cos(inc)) / 2;
	const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
	return {
		phase,
		illumination,
		age: phase * SYNODIC_MONTH,
		waxing: phase < 0.5,
		key: moonPhaseKey(phase),
	};
}

/**
 * The next instant the moon reaches `target` (0 = new, 0.5 = full) at or after
 * `fromMs`. A first guess from the mean month, then a few corrections against
 * the real phase — the moon's speed wobbles by a tenth across the month, and
 * the mean alone can land on the wrong day.
 */
export function nextMoonPhase(fromMs: number, target: 0 | 0.5): number {
	const ahead = (((target - moonPhase(fromMs).phase) % 1) + 1) % 1;
	let t = fromMs + ahead * SYNODIC_MONTH * DAY_MS;
	for (let i = 0; i < 6; i++) {
		let diff = target - moonPhase(t).phase;
		// Wrap to the nearer side: 0.98 → 0 is +0.02, not −0.98.
		diff -= Math.round(diff);
		const step = diff * SYNODIC_MONTH * DAY_MS;
		t += step;
		if (Math.abs(step) < 60_000) break;
	}
	return t;
}

// ---- Rise and set -------------------------------------------------------

function moonAltitude(ms: number, lat: number, lon: number): number {
	const d = toDays(ms);
	const c = moonCoords(d);
	const phi = RAD * lat;
	const siderealTime = RAD * (280.16 + 360.9856235 * d) + RAD * lon;
	const h = siderealTime - c.ra;
	let alt = Math.asin(
		Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(h),
	);
	// Atmospheric refraction lifts a body near the horizon by about half a degree.
	const a = Math.max(alt, 0);
	alt += 0.0002967 / Math.tan(a + 0.00312536 / (a + 0.08901179));
	return alt;
}

export interface MoonTimes {
	/** Epoch ms, or null when the moon doesn't rise (or set) that day. */
	rise: number | null;
	set: number | null;
}

/**
 * When the moon rises and sets during the 24 hours from `dayStartMs` — the
 * location's local midnight, so the times belong to the day the card shows.
 *
 * The altitude is sampled every hour and a parabola fitted through each
 * three-hour window; its roots are the horizon crossings. A day can have a rise
 * and no set, or neither: the moon runs about fifty minutes late each day, so
 * once a month one of the two slips into tomorrow.
 */
export function moonTimes(dayStartMs: number, lat: number, lon: number): MoonTimes {
	const hour = (h: number): number => dayStartMs + h * 3_600_000;
	// The altitude of the moon's upper limb at the horizon, below the centre.
	const limb = 0.133 * RAD;
	let h0 = moonAltitude(dayStartMs, lat, lon) - limb;
	let rise: number | null = null;
	let set: number | null = null;

	for (let i = 1; i <= 24; i += 2) {
		const h1 = moonAltitude(hour(i), lat, lon) - limb;
		const h2 = moonAltitude(hour(i + 1), lat, lon) - limb;
		const a = (h0 + h2) / 2 - h1;
		const b = (h2 - h0) / 2;
		const xe = -b / (2 * a);
		const ye = (a * xe + b) * xe + h1;
		const disc = b * b - 4 * a * h1;
		let roots = 0;
		let x1 = 0;
		let x2 = 0;
		if (disc >= 0) {
			const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
			x1 = xe - dx;
			x2 = xe + dx;
			if (Math.abs(x1) <= 1) roots++;
			if (Math.abs(x2) <= 1) roots++;
			if (x1 < -1) x1 = x2;
		}
		if (roots === 1) {
			if (h0 < 0) rise = hour(i + x1);
			else set = hour(i + x1);
		} else if (roots === 2) {
			rise = hour(i + (ye < 0 ? x2 : x1));
			set = hour(i + (ye < 0 ? x1 : x2));
		}
		if (rise !== null && set !== null) break;
		h0 = h2;
	}
	return { rise, set };
}

// ---- The location's clock ------------------------------------------------

/**
 * The wall clock at the location, as `"YYYY-MM-DDTHH:mm"` — the same shape
 * Open-Meteo writes its times in, so it compares against sunrise and sunset as
 * a string. `offsetSec` is the response's `utc_offset_seconds`.
 */
export function wallClockAt(ms: number, offsetSec: number): string {
	return new Date(ms + offsetSec * 1000).toISOString().slice(0, 16);
}

/** The instant a location wall clock stands for, given its UTC offset. The
 * inverse of {@link wallClockAt}; NaN for a string that isn't one. */
export function instantOf(wallClock: string, offsetSec: number): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(wallClock);
	if (!match) return NaN;
	const utc = Date.UTC(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		Number(match[4] ?? 0),
		Number(match[5] ?? 0),
	);
	return utc - offsetSec * 1000;
}

/**
 * Minutes from the start of `date` (a `YYYY-MM-DD`) to the wall clock `time`,
 * or null when either isn't one. Measured across the calendar rather than read
 * off the clock face, so a sunset that falls after midnight — a northern
 * summer — is 1470, not 30, and tomorrow's sunrise lands past 1440.
 */
export function minutesInto(date: string, time: string): number | null {
	if (!/T\d{2}:\d{2}/.test(time)) return null;
	const start = instantOf(date, 0);
	const at = instantOf(time, 0);
	if (!Number.isFinite(start) || !Number.isFinite(at)) return null;
	return Math.round((at - start) / 60_000);
}

// ---- The sun's arc ------------------------------------------------------

/**
 * Where the sun is on the daylight style's arc.
 *
 * The day is drawn as a parabola over the horizon from sunrise to sunset, and
 * the night as a shallower one under it from sunset to the next sunrise. All
 * values are minutes past the location's midnight; `nextSunrise` may run past
 * 1440 (tomorrow), and defaults to today's sunrise a day later.
 */
export interface SunArc {
	isDay: boolean;
	/** 0–1 along the arc the sun is on: the day's, or the night's. */
	progress: number;
	/** Minutes until the next horizon crossing: sunset by day, sunrise by night. */
	remaining: number;
	/** Minutes from sunrise to sunset. */
	dayLength: number;
}

export function sunArc(
	now: number,
	sunrise: number,
	sunset: number,
	nextSunrise = sunrise + 1440,
): SunArc {
	const dayLength = Math.max(sunset - sunrise, 0);
	if (now >= sunrise && now < sunset) {
		return {
			isDay: true,
			progress: dayLength ? (now - sunrise) / dayLength : 0,
			remaining: sunset - now,
			dayLength,
		};
	}
	// Before sunrise the night began at yesterday's sunset (taken a day back,
	// which is close enough for a drawing); after sunset it ends at the next.
	const from = now < sunrise ? sunset - 1440 : sunset;
	const to = now < sunrise ? sunrise : nextSunrise;
	const span = Math.max(to - from, 1);
	return {
		isDay: false,
		progress: Math.min(Math.max((now - from) / span, 0), 1),
		remaining: to - now,
		dayLength,
	};
}

/** A duration in minutes split into whole hours and the minutes left over,
 * which is how the card words it ("3 h 12 min"). */
export function splitMinutes(minutes: number): { h: number; m: number } {
	const total = Math.max(Math.round(minutes), 0);
	return { h: Math.floor(total / 60), m: total % 60 };
}
