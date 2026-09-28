/**
 * The Weather card as text.
 *
 * The conditions are drawn as five rows of ASCII art — a sun, a cloud, rain
 * slanting out of it — the way terminal weather tools draw them, with the
 * reading beside it. Each of the graphical card's styles has a text form: the
 * minimal one a big temperature, the forecast one a bar chart of the hours,
 * the moon one a disc lit to tonight's phase, the daylight one the sun on a
 * dotted arc. What the card shows is decided by the same "what to display"
 * toggles.
 *
 * Zoomed (Enter, or `z`), the card is the full forecast the graphical card
 * opens in a dialog: every reading, the week as a list to pick a day from, and
 * the picked day hour by hour.
 */
import type { Menu } from "obsidian";
import { minutesInto, moonPhase, splitMinutes, sunArc } from "../../astro";
import {
	conditionText,
	daySummary,
	defaultHourlyCount,
	detailMetrics,
	formatUv,
	headlineBits,
	metricsFor,
	precipText,
	requestFor,
	resolveConfig,
	updatedText,
	windText,
	type Resolved,
} from "../../cards/weather";
import { dayTimes, moonSummary, wallNow } from "../../cards/weatherastro";
import { t } from "../../i18n";
import { effectiveAutoRefreshMinutes, type WeatherConfig } from "../../types";
import {
	cachedWeather,
	formatDayDate,
	formatHour,
	formatPercent,
	formatTemp,
	formatWeekday,
	hoursOn,
	loadWeather,
	upcomingDays,
	upcomingHours,
	weatherGroup,
	type WeatherDay,
	type WeatherHour,
	type WeatherRequest,
	type WeatherSnapshot,
} from "../../weather";
import { bigLines, bigWidth, BIG_ROWS, hasBigGlyphs } from "../bigtext";
import type { TuiContext, TuiItem, TuiOutput, TuiRenderer } from "../card";
import { BLOCKS, blockRow, centerLine, fit, padEnd, padStart, strWidth, truncate, wrap, type Line, type TuiStyle } from "../text";
import { button, heading, message, rule, tableHeader } from "./common";

// ---- The art --------------------------------------------------------------------

/** Five rows of a condition, and a mask of the same shape saying how each
 * character is drawn: `y` sun, `c` cloud, `d` grey cloud, `b` rain, `w` snow
 * and moon, `f` faint (stars, fog); a space is plain. */
interface Art {
	rows: readonly string[];
	mask: readonly string[];
}

/** How wide every piece of art is. */
export const ART_W = 13;

const CLOUD = ["     .--.    ", "  .-(    ).  ", " (___.__)__) "];

const ART: Record<string, Art> = {
	clear: {
		rows: ["    \\   /    ", "     .-.     ", "  - (   ) -  ", "     `-'     ", "    /   \\    "],
		mask: ["yyyyyyyyyyyyy", "yyyyyyyyyyyyy", "yyyyyyyyyyyyy", "yyyyyyyyyyyyy", "yyyyyyyyyyyyy"],
	},
	night: {
		rows: ["   *    _    ", "       ( `.  ", "  .     )  ) ", "       (_.'  ", "    *        "],
		mask: ["fffffffffffff", "wwwwwwwwwwwww", "fffffffwwwwww", "wwwwwwwwwwwww", "fffffffffffff"],
	},
	partly: {
		rows: ["   \\ | /     ", "  -- .--.    ", "  .-(    ).  ", " (___.__)__) ", "             "],
		mask: ["yyyyyyyyyyyyy", "yyyyccccccccc", "ccccccccccccc", "ccccccccccccc", "             "],
	},
	partlyNight: {
		rows: ["   *     *   ", "  )  .--.    ", "  .-(    ).  ", " (___.__)__) ", "             "],
		mask: ["fffffffffffff", "wwwwccccccccc", "ccccccccccccc", "ccccccccccccc", "             "],
	},
	cloudy: {
		rows: ["             ", ...CLOUD, "             "],
		mask: ["             ", "ddddddddddddd", "ddddddddddddd", "ddddddddddddd", "             "],
	},
	fog: {
		rows: ["             ", " _ - _ - _ - ", "  _ - _ - _  ", " _ - _ - _ - ", "             "],
		mask: ["             ", "fffffffffffff", "fffffffffffff", "fffffffffffff", "             "],
	},
	drizzle: {
		rows: [...CLOUD, "   '  '  '   ", "  '  '  '    "],
		mask: ["ddddddddddddd", "ddddddddddddd", "ddddddddddddd", "bbbbbbbbbbbbb", "bbbbbbbbbbbbb"],
	},
	rain: {
		rows: [...CLOUD, "   / / / /   ", "  / / / /    "],
		mask: ["ddddddddddddd", "ddddddddddddd", "ddddddddddddd", "bbbbbbbbbbbbb", "bbbbbbbbbbbbb"],
	},
	snow: {
		rows: [...CLOUD, "   *  *  *   ", "  *  *  *    "],
		mask: ["ddddddddddddd", "ddddddddddddd", "ddddddddddddd", "wwwwwwwwwwwww", "wwwwwwwwwwwww"],
	},
	thunder: {
		rows: [...CLOUD, "    /_ /_    ", "     /  /    "],
		mask: ["ddddddddddddd", "ddddddddddddd", "ddddddddddddd", "yyyyyyyyyyyyy", "yyyyyyyyyyyyy"],
	},
};

const MASK_STYLE: Record<string, TuiStyle | TuiStyle[] | undefined> = {
	y: ["yellow", "bold"],
	c: undefined,
	d: "dim",
	b: "blue",
	w: "bold",
	f: "faint",
};

function artKey(code: number, isDay: boolean): string {
	const group = weatherGroup(code);
	if (group === "clear") return isDay ? "clear" : "night";
	if (group === "partly") return isDay ? "partly" : "partlyNight";
	return group;
}

/** The condition's five rows as lines. */
export function conditionArt(code: number, isDay: boolean): Line[] {
	const art = ART[artKey(code, isDay)] ?? ART.cloudy;
	return art.rows.map((row, r) => {
		const mask = art.mask[r] ?? "";
		const line: Line = [];
		let run = "";
		let key = "";
		const flush = () => {
			if (run) line.push({ text: run, style: MASK_STYLE[key] });
			run = "";
		};
		for (let i = 0; i < row.length; i++) {
			const k = row[i] === " " ? " " : mask[i] ?? " ";
			if (k !== key) {
				flush();
				key = k;
			}
			run += row[i];
		}
		flush();
		return line;
	});
}

/** A condition in two cells, for the hourly strip and the day rows. */
function conditionMark(code: number, isDay: boolean): Line {
	switch (artKey(code, isDay)) {
		case "clear":
			return [{ text: "* ", style: ["yellow", "bold"] }];
		case "night":
			return [{ text: ") ", style: "bold" }];
		case "partly":
			return [{ text: "*", style: ["yellow", "bold"] }, { text: "~" }];
		case "partlyNight":
			return [{ text: ")", style: "bold" }, { text: "~" }];
		case "fog":
			return [{ text: "==", style: "faint" }];
		case "drizzle":
			return [{ text: "''", style: "blue" }];
		case "rain":
			return [{ text: "//", style: "blue" }];
		case "snow":
			return [{ text: "**", style: "bold" }];
		case "thunder":
			return [{ text: "/_", style: ["yellow", "bold"] }];
		default:
			return [{ text: "~~", style: "dim" }];
	}
}

/** `left` art beside `right` text, as many rows as the taller of the two. */
function beside(left: Line[], leftW: number, right: Line[], w: number): Line[] {
	const out: Line[] = [];
	const n = Math.max(left.length, right.length);
	for (let i = 0; i < n; i++) {
		out.push([...fit(left[i] ?? [], leftW), { text: "  " }, ...fit(right[i] ?? [], Math.max(0, w - leftW - 2))]);
	}
	return out;
}

/** An hour as short as it can be said: "3 PM" rather than "3:00 PM", which
 * doesn't fit a strip's column. A 24-hour clock keeps its ":00" — "15" alone
 * reads as a number, not a time. */
function shortHour(time: string, hour12: boolean | undefined): string {
	const full = formatHour(time, hour12);
	return /\d:00\s*\D/.test(full) ? full.replace(":00", "") : full;
}

// ---- Loading ----------------------------------------------------------------------

interface Loaded {
	req: WeatherRequest;
	snapshot: WeatherSnapshot | null;
	/** Whether a first load is still on its way. */
	loading: boolean;
	disabled: boolean;
	ttlMs: number;
}

/**
 * The card's forecast. Draws what is cached at once and asks for a fresher
 * one, which is cheap while the cache is within its time to live. The load
 * redraws the card only when it brought something new — a redraw that asked
 * again and got the same answer would otherwise never stop.
 */
function loadFor(ctx: TuiContext, cfg: WeatherConfig, r: Resolved, req: WeatherRequest): Loaded {
	const disabled = ctx.view.plugin.settings.disableExternalCalls;
	const refreshMin = cfg.refreshMin ?? 30;
	const ttlMs = Math.max(refreshMin, 10) * 60_000;
	const snapshot = cachedWeather(req);
	const shown = snapshot?.fetched ?? 0;
	if (snapshot) ctx.state.wxFailed = false;
	void loadWeather(req, { ttlMs, disabled }).then((next) => {
		if ((next?.fetched ?? 0) !== shown) ctx.redraw();
		else if (!snapshot && ctx.state.wxFailed !== true) {
			ctx.state.wxFailed = true;
			ctx.redraw();
		}
	});
	const autoMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, refreshMin);
	if (autoMin > 0) {
		ctx.component.registerInterval(window.setInterval(() => void refresh(ctx, req, ttlMs, disabled), autoMin * 60_000));
	}
	// The sun moves between fetches.
	if (r.style === "daylight") ctx.component.registerInterval(window.setInterval(() => ctx.redraw(), 60_000));
	return { req, snapshot, loading: !snapshot && ctx.state.wxFailed !== true, disabled, ttlMs };
}

async function refresh(ctx: TuiContext, req: WeatherRequest, ttlMs: number, disabled: boolean): Promise<void> {
	if (disabled || ctx.state.wxRefreshing === true) return;
	ctx.state.wxRefreshing = true;
	ctx.redraw();
	try {
		await loadWeather(req, { ttlMs, disabled, force: true });
	} finally {
		ctx.state.wxRefreshing = false;
		ctx.redraw();
	}
}

// ---- The card -------------------------------------------------------------------

/** The reading beside the art: temperature and condition, place, the
 * headline readings, the metrics. */
function readingLines(snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved, w: number, withMetrics: boolean): Line[] {
	const now = snapshot.now;
	const lines: Line[] = [];
	const head: Line = [{ text: formatTemp(now.temp, r.tempUnit, true), style: ["bold", "accent"] }];
	if (r.showCondition) head.push({ text: "  " }, { text: conditionText(now.code), style: "bold" });
	lines.push(head);
	const place = cfg.place?.name?.trim();
	if (r.showLocation && place) lines.push([{ text: place, style: "dim" }]);
	const bits = headlineBits(snapshot, r);
	if (bits.length) lines.push([{ text: bits.join(" · ") }]);
	if (withMetrics) {
		const metrics = metricsFor(snapshot, r).map((m) => `${m.label} ${m.value}`);
		for (const l of wrap(metrics.join(" · "), Math.max(8, w))) if (l) lines.push([{ text: l, style: "dim" }]);
	}
	return lines;
}

/** The metrics as a table of `label  value`, as many columns as fit. */
function metricTable(metrics: readonly { label: string; value: string }[], w: number): Line[] {
	if (!metrics.length) return [];
	const labelW = Math.min(16, Math.max(...metrics.map((m) => strWidth(m.label))) + 1);
	const valueW = Math.min(24, Math.max(...metrics.map((m) => strWidth(m.value))));
	const cellW = labelW + valueW + 3;
	const across = Math.max(1, Math.floor((w + 3) / cellW));
	const lines: Line[] = [];
	for (let i = 0; i < metrics.length; i += across) {
		const line: Line = [];
		metrics.slice(i, i + across).forEach((m, j) => {
			if (j > 0) line.push({ text: "   " });
			line.push({ text: padEnd(truncate(m.label, labelW - 1), labelW), style: "dim" }, { text: padEnd(truncate(m.value, valueW), valueW), style: "bold" });
		});
		lines.push(line);
	}
	return lines;
}

/** The hourly strip: a column per hour, six cells each. */
function hourlyStrip(hours: readonly WeatherHour[], r: Resolved, w: number): Line[] {
	const cellW = 6;
	const shown = hours.slice(0, Math.max(1, Math.floor(w / cellW)));
	if (!shown.length) return [];
	const time: Line = [];
	const mark: Line = [];
	const temp: Line = [];
	const rain: Line = [];
	shown.forEach((h, i) => {
		time.push({ text: padEnd(i === 0 ? t().cards.weather.now : shortHour(h.time, r.hour12), cellW), style: i === 0 ? ["bold", "accent"] : "dim" });
		mark.push(...fit(conditionMark(h.code, h.isDay), cellW));
		temp.push({ text: padEnd(formatTemp(h.temp, r.tempUnit), cellW), style: "bold" });
		rain.push({ text: padEnd(h.precipChance === null ? "" : formatPercent(h.precipChance), cellW), style: "blue" });
	});
	const lines = [time, mark, temp];
	if (r.showPrecip) lines.push(rain);
	return lines;
}

/**
 * The forecast style's curve, as a bar chart: a column per hour, as tall as
 * the hour is warm against the others, topped in eighths.
 */
function temperatureChart(hours: readonly WeatherHour[], r: Resolved, w: number, height: number): Line[] {
	const cellW = Math.max(3, Math.min(6, Math.floor(w / Math.max(1, hours.length))));
	const shown = hours.slice(0, Math.max(2, Math.floor(w / cellW)));
	const temps = shown.map((h) => h.temp).filter((v): v is number => v !== null);
	if (temps.length < 2) return [];
	const lo = Math.min(...temps);
	const hi = Math.max(...temps);
	const span = hi - lo || 1;
	// Every bar keeps at least one eighth, so the coldest hour still shows.
	const eighths = shown.map((h) => (h.temp === null ? 0 : 1 + Math.round(((h.temp - lo) / span) * (height * 8 - 1))));
	const lines: Line[] = [[]];
	for (let row = height - 1; row >= 0; row--) {
		const line: Line = [];
		eighths.forEach((e) => {
			const inRow = Math.max(0, Math.min(8, e - row * 8));
			const ch = inRow === 0 ? " " : inRow >= 8 ? "█" : BLOCKS[inRow - 1];
			const bar = ch.repeat(Math.max(1, cellW - 1));
			line.push(...blockRow(bar, "accent"), { text: " " });
		});
		lines.push(line);
	}
	// The hours under the bars: every one when they fit, else every second or
	// third, each label spanning the columns it stands for. The temperatures
	// over them thin out the same way.
	const labelOf = (i: number) => (i === 0 ? t().cards.weather.now : shortHour(shown[i].time, r.hour12));
	const widest = Math.max(...shown.map((_, i) => strWidth(labelOf(i)))) + 1;
	const every = Math.max(1, Math.ceil(widest / cellW));
	const tempsLine: Line = [];
	const hoursLine: Line = [];
	for (let i = 0; i < shown.length; i += every) {
		const span = cellW * Math.min(every, shown.length - i);
		tempsLine.push({ text: padEnd(formatTemp(shown[i].temp, r.tempUnit), span), style: "bold" });
		hoursLine.push({ text: padEnd(labelOf(i), span), style: i === 0 ? ["bold", "accent"] : "dim" });
	}
	lines[0] = tempsLine;
	lines.push(hoursLine);
	return lines;
}

/** A day's high and low against the whole list's range. */
function rangeBar(day: WeatherDay, floor: number, span: number, w: number): Line {
	if (w < 3) return [];
	const from = day.min === null ? floor : day.min;
	const to = day.max === null ? floor + span : day.max;
	const a = Math.round(((from - floor) / span) * (w - 1));
	const b = Math.max(a + 1, Math.round(((to - floor) / span) * (w - 1)) + 1);
	return [
		{ text: "─".repeat(a), style: "faint" },
		{ text: "━".repeat(Math.min(w, b) - a), style: ["yellow", "bold"] },
		{ text: "─".repeat(Math.max(0, w - Math.min(w, b))), style: "faint" },
	];
}

interface DayRowOpts {
	long: boolean;
	condition: boolean;
	precip: boolean;
}

/** One day of the forecast as a row: its name, its sky, its chance of rain and
 * its range. */
function dayRow(day: WeatherDay, i: number, days: readonly WeatherDay[], r: Resolved, w: number, opts: DayRowOpts): Line {
	const lows = days.map((d) => d.min).filter((v): v is number => v !== null);
	const highs = days.map((d) => d.max).filter((v): v is number => v !== null);
	const floor = lows.length ? Math.min(...lows) : 0;
	const ceiling = highs.length ? Math.max(...highs) : 1;
	const name = i === 0 ? t().cards.weather.todayLabel : formatWeekday(day.date, opts.long ? "long" : "short");
	const line: Line = [{ text: padEnd(truncate(name, opts.long ? 10 : 6), opts.long ? 11 : 7), style: i === 0 ? ["bold", "accent"] : "bold" }];
	if (opts.long) line.push({ text: padEnd(formatDayDate(day.date), 8), style: "dim" });
	line.push(...fit(conditionMark(day.code, true), 3));
	if (opts.condition) line.push({ text: padEnd(truncate(conditionText(day.code), 16), 17) });
	if (opts.precip) line.push({ text: padStart(day.precipChance === null ? "" : formatPercent(day.precipChance), 4), style: "blue" }, { text: " " });
	const low = padStart(formatTemp(day.min, r.tempUnit), 4);
	const high = padStart(formatTemp(day.max, r.tempUnit), 4);
	const used = line.reduce((n, s) => n + strWidth(s.text), 0);
	const barW = Math.max(0, Math.min(24, w - used - 10));
	line.push({ text: low, style: "blue" }, { text: " " }, ...rangeBar(day, floor, ceiling - floor || 1, barW), { text: " " }, { text: high, style: "red" });
	return line;
}

/** The minimal style: the temperature, big, and the words under it. */
function minimalLines(snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved, ctx: TuiContext): Line[] {
	const temp = formatTemp(snapshot.now.temp, r.tempUnit);
	const lines: Line[] = [];
	if (hasBigGlyphs(temp) && bigWidth(temp) <= ctx.cols && ctx.rows >= BIG_ROWS + 1) {
		lines.push(...bigLines(temp).map((l) => centerLine(l, ctx.cols)));
	} else {
		lines.push(centerLine([...conditionMark(snapshot.now.code, snapshot.now.isDay), { text: ` ${temp}`, style: ["bold", "accent"] }], ctx.cols));
	}
	const bits: string[] = [];
	if (r.showCondition) bits.push(conditionText(snapshot.now.code));
	if (r.showLocation && cfg.place?.name) bits.push(cfg.place.name);
	if (bits.length) lines.push(centerLine([{ text: bits.join(" · "), style: "dim" }], ctx.cols));
	return lines;
}

/** Tonight's moon as a disc, lit to its phase. */
function moonDisc(ms: number, southern: boolean): Line[] {
	const phase = moonPhase(ms);
	const rows = 5;
	const cols = 11;
	const lines: Line[] = [];
	// Lit on the right while waxing in the north; the south sees it mirrored.
	const litRight = phase.waxing !== southern;
	const edge = 1 - 2 * phase.illumination;
	for (let r = 0; r < rows; r++) {
		const ny = ((r + 0.5) / rows) * 2 - 1;
		const half = Math.sqrt(Math.max(0, 1 - ny * ny));
		let text = "";
		const line: Line = [];
		let lit: boolean | null = null;
		const flush = () => {
			if (text) line.push({ text, style: lit ? ["bold", "yellow"] : "faint" });
			text = "";
		};
		for (let c = 0; c < cols; c++) {
			const nx = ((c + 0.5) / cols) * 2 - 1;
			if (Math.abs(nx) > half) {
				if (lit !== null) flush();
				lit = null;
				line.push({ text: " " });
				continue;
			}
			const x = litRight ? nx : -nx;
			const on = x > half * edge;
			if (lit !== null && on !== lit) flush();
			lit = on;
			text += on ? "█" : "·";
		}
		flush();
		lines.push(line);
	}
	return lines;
}

/** The daylight style: the sun on a dotted arc from sunrise to sunset. */
function daylightLines(snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved, w: number): Line[] {
	const strings = t().cards.weather;
	const ms = Date.now();
	const wall = wallNow(snapshot, ms);
	const times = dayTimes(snapshot, wall);
	const lines: Line[] = [];
	const minute = minutesInto(times.date, wall) ?? 0;
	const { sunrise, sunset } = times;
	if (sunrise === null || sunset === null || !times.day) {
		lines.push([{ text: snapshot.now.isDay ? strings.daylight.polarDay : strings.daylight.polarNight, style: "bold" }]);
		return lines;
	}
	const arc = sunArc(minute, sunrise, sunset, times.nextSunrise);
	const next = arc.isDay ? times.day.sunset : minute < sunrise ? times.day.sunrise : times.next?.sunrise ?? times.day.sunrise;
	const { h, m } = splitMinutes(arc.remaining);
	lines.push([
		{ text: arc.isDay ? strings.sunset : strings.sunrise, style: "dim" },
		{ text: " " },
		{ text: formatHour(next, r.hour12), style: ["bold", "accent"] },
		{ text: `  ${strings.daylight.until(strings.duration(h, m))}`, style: "dim" },
	]);
	const place = cfg.place?.name?.trim();
	const side: string[] = [];
	if (r.showCondition) side.push(`${formatTemp(snapshot.now.temp, r.tempUnit)} ${conditionText(snapshot.now.code)}`);
	if (r.showLocation && place) side.push(place);
	if (side.length) lines.push([{ text: side.join(" · "), style: "dim" }]);
	lines.push([]);

	// The arc: a parabola of dots over the horizon, the stretch the sun has
	// travelled in its colour.
	const height = 4;
	const width = Math.max(10, w);
	const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill(" "));
	const done: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
	let sunAt: [number, number] | null = null;
	for (let x = 0; x < width; x++) {
		const f = width > 1 ? x / (width - 1) : 0;
		const lift = 4 * f * (1 - f);
		const row = height - 1 - Math.round(lift * (height - 1));
		grid[row][x] = "·";
		done[row][x] = arc.isDay && f <= arc.progress;
	}
	if (arc.isDay) {
		const x = Math.round(arc.progress * (width - 1));
		const f = width > 1 ? x / (width - 1) : 0;
		sunAt = [height - 1 - Math.round(4 * f * (1 - f) * (height - 1)), x];
	}
	for (let y = 0; y < height; y++) {
		const line: Line = [];
		for (let x = 0; x < width; x++) {
			if (sunAt && sunAt[0] === y && sunAt[1] === x) line.push({ text: "O", style: ["yellow", "bold"] });
			else line.push({ text: grid[y][x], style: done[y][x] ? "yellow" : "faint" });
		}
		lines.push(line);
	}
	const rise = formatHour(times.day.sunrise, r.hour12);
	const set = formatHour(times.day.sunset, r.hour12);
	lines.push([{ text: "─".repeat(width), style: "dim" }]);
	lines.push([{ text: padEnd(rise, width - strWidth(set)), style: "dim" }, { text: set, style: "dim" }]);
	const len = splitMinutes(arc.dayLength);
	lines.push(centerLine([{ text: strings.daylight.dayLength(strings.duration(len.h, len.m)), style: "faint" }], width));
	return lines;
}

function cardLines(ctx: TuiContext, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): Line[] {
	const w = ctx.cols;
	const lines: Line[] = [];
	switch (r.style) {
		case "minimal":
			lines.push(...minimalLines(snapshot, cfg, r, ctx));
			break;
		case "moon": {
			const disc = moonDisc(Date.now(), (cfg.place?.lat ?? 0) < 0);
			const text: Line[] = [[{ text: moonSummary(Date.now()), style: "bold" }]];
			const place = cfg.place?.name?.trim();
			if (r.showLocation && place) text.push([{ text: place, style: "dim" }]);
			if (r.showCondition) text.push([...conditionMark(snapshot.now.code, snapshot.now.isDay), { text: ` ${formatTemp(snapshot.now.temp, r.tempUnit)}` }]);
			lines.push(...(w >= 11 + 2 + 12 ? beside(disc, 11, text, w) : [...disc, ...text]));
			break;
		}
		case "daylight":
			lines.push(...daylightLines(snapshot, cfg, r, w));
			break;
		default: {
			const detailed = r.style === "detailed" || r.style === "forecast";
			const art = conditionArt(snapshot.now.code, snapshot.now.isDay);
			const text = readingLines(snapshot, cfg, r, w - ART_W - 2, !detailed);
			if (w >= ART_W + 2 + 14 && ctx.rows >= 5) lines.push(...beside(art, ART_W, text, w));
			else lines.push([...conditionMark(snapshot.now.code, snapshot.now.isDay), { text: " " }, ...(text[0] ?? [])], ...text.slice(1));
			if (detailed) {
				const table = metricTable(metricsFor(snapshot, r), w);
				if (table.length) lines.push([], ...table);
			}
			if (r.style === "forecast") {
				const hours = upcomingHours(snapshot, r.hourlyCount || defaultHourlyCount("forecast"));
				const chart = temperatureChart(hours, r, w, 3);
				if (chart.length) lines.push([], ...chart);
			} else {
				const strip = hourlyStrip(upcomingHours(snapshot, r.hourlyCount), r, w);
				if (strip.length) lines.push([], ...strip);
			}
			const days = upcomingDays(snapshot, r.dailyCount);
			if (days.length) {
				lines.push([]);
				days.forEach((d, i) => lines.push(dayRow(d, i, days, r, w, { long: false, condition: w >= 56, precip: r.showPrecip })));
			}
		}
	}
	if (r.showUpdated) lines.push([], [{ text: updatedText(snapshot, r), style: "faint" }]);
	return lines;
}

// ---- The full forecast -------------------------------------------------------------

function detailOutput(ctx: TuiContext, loaded: Loaded, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): TuiOutput {
	const strings = t().cards.weather;
	const detail = strings.detail;
	const w = ctx.cols;
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	const now = snapshot.now;

	// The headline.
	const text: Line[] = [
		[{ text: formatTemp(now.temp, r.tempUnit, true), style: ["bold", "accent"] }, { text: "  " }, { text: conditionText(now.code), style: "bold" }],
	];
	const head = headlineBits(snapshot, { ...r, showFeelsLike: true, showHighLow: true });
	if (head.length) text.push([{ text: head.join(" · ") }]);
	const place = [cfg.place?.name?.trim(), cfg.place?.region?.trim()].filter(Boolean).join(", ");
	if (place) text.push([{ text: place, style: "dim" }]);
	lines.push(...beside(conditionArt(now.code, now.isDay), ART_W, text, w));

	// Every reading.
	lines.push([], heading(detail.now), rule(w));
	lines.push(...metricTable(detailMetrics(snapshot, r), w));

	// The week, each day a row that shows it hour by hour below.
	const days = upcomingDays(snapshot, snapshot.daily.length);
	const picked = typeof ctx.state.wxDay === "string" && days.some((d) => d.date === ctx.state.wxDay) ? (ctx.state.wxDay) : days[0]?.date;
	if (days.length) {
		lines.push([], heading(detail.days), rule(w));
		days.forEach((day, i) => {
			const label = i === 0 ? strings.todayLabel : formatWeekday(day.date, "long");
			const pick = () => {
				ctx.state.wxDay = day.date;
				ctx.redraw();
			};
			const row: Line = [{ text: day.date === picked ? "▸ " : "  ", style: "accent" }, ...dayRow(day, i, days, r, w - 2, { long: true, condition: w >= 70, precip: true })];
			items.push({ line: lines.length, activate: pick });
			lines.push(row.map((s) => ({ ...s, onClick: s.onClick ?? pick, label: s.label ?? detail.selectDay(label) })));
		});
	}

	// The picked day, hour by hour.
	const day = days.find((d) => d.date === picked);
	if (day) {
		const isToday = days[0]?.date === day.date;
		const label = isToday ? strings.todayLabel : formatWeekday(day.date, "long");
		lines.push([], heading(detail.hoursFor(`${label}, ${formatDayDate(day.date)}`)), rule(w));
		for (const l of wrap(daySummary(day, r).join(" · "), w)) lines.push([{ text: l, style: "dim" }]);
		const hours = hoursOn(snapshot, day.date);
		if (!hours.length) lines.push([{ text: detail.noHours, style: "faint" }]);
		else {
			const cols: [string, number][] = [
				[detail.columnTime, 7],
				["", 3],
				...(w >= 76 ? ([[detail.columnCondition, 17]] as [string, number][]) : []),
				[detail.columnTemp, 6],
				[detail.columnFeels, 6],
				[detail.columnPrecip, 13],
				[detail.columnWind, 13],
				...(w >= 62 ? ([[detail.columnHumidity, 9]] as [string, number][]) : []),
				[detail.columnUv, 3],
			];
			lines.push(tableHeader(cols, w));
			const nowHour = now.time.slice(0, 13);
			for (const hour of hours) {
				const isNow = hour.time.slice(0, 13) === nowHour;
				const cells: Line = [
					{ text: padEnd(isNow ? strings.now : formatHour(hour.time, r.hour12), 7), style: isNow ? ["bold", "accent"] : "dim" },
					...fit(conditionMark(hour.code, hour.isDay), 3),
				];
				if (w >= 76) cells.push({ text: padEnd(truncate(conditionText(hour.code), 16), 17) });
				cells.push(
					{ text: padEnd(formatTemp(hour.temp, r.tempUnit), 6), style: "bold" },
					{ text: padEnd(formatTemp(hour.apparent, r.tempUnit), 6), style: "dim" },
					{ text: padEnd(truncate(precipText(hour, r), 12), 13), style: "blue" },
					{ text: padEnd(truncate(windText(hour.windSpeed, hour.windDir, r), 12), 13) },
				);
				if (w >= 62) cells.push({ text: padEnd(formatPercent(hour.humidity), 9), style: "dim" });
				cells.push({ text: formatUv(hour.uv), style: "dim" });
				lines.push(isNow ? cells.map((s) => ({ ...s, style: s.style ?? "bold" })) : cells);
			}
		}
	}

	// When it was fetched, where from, and a way to ask again.
	lines.push([], rule(w));
	const foot: Line = [{ text: `${updatedText(snapshot, r)} · ${detail.source}`, style: "faint" }];
	if (!loaded.disabled) {
		const again = () => void refresh(ctx, loaded.req, loaded.ttlMs, loaded.disabled);
		const refreshing = ctx.state.wxRefreshing === true;
		items.push({ line: lines.length, activate: again });
		foot.push({ text: "  " }, refreshing ? { text: t().tui.cards.loading, style: "dim" } : button(detail.refresh, again));
	}
	lines.push(foot);
	return { lines, items, foot: t().tui.cards.weatherFoot };
}

// ---- The renderer ---------------------------------------------------------------------

export const weatherTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.weather ?? {};
		const r = resolveConfig(cfg);
		const req = requestFor(cfg, r);
		if (!req) return { lines: message(t().cards.empty.weatherNoLocation, ctx.cols) };
		const loaded = loadFor(ctx, cfg, r, req);
		const snapshot = loaded.snapshot;
		const strings = t().cards.weather;
		if (!snapshot) {
			const text = loaded.loading ? strings.loading : loaded.disabled ? strings.disabled : strings.error;
			return { lines: message(text, ctx.cols) };
		}
		if (ctx.zoomed) return detailOutput(ctx, loaded, snapshot, cfg, r);
		const lines = cardLines(ctx, snapshot, cfg, r);
		const place = cfg.place?.name?.trim();
		return {
			lines,
			hint: ctx.state.wxRefreshing === true ? t().tui.cards.loading : place ? truncate(place, 20) : undefined,
			foot: t().tui.cards.weatherCardFoot,
		};
	},
	menu(ctx, menu: Menu) {
		const cfg = ctx.card.weather ?? {};
		const req = requestFor(cfg, resolveConfig(cfg));
		if (!req || ctx.view.plugin.settings.disableExternalCalls) return;
		const ttlMs = Math.max(cfg.refreshMin ?? 30, 10) * 60_000;
		menu.addItem((i) =>
			i
				.setTitle(t().cards.weather.detail.refresh)
				.setIcon("refresh-cw")
				.onClick(() => void refresh(ctx, req, ttlMs, false)),
		);
	},
};
