import { Component, Notice, setIcon, Setting } from "obsidian";
import { emptyState } from "../cardbodies";
import { t } from "../i18n";
import {
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	lowPowerActive,
	type PrecipitationUnit,
	type TemperatureUnit,
	type WeatherConfig,
	type WeatherStyle,
	type WindUnit,
} from "../types";
import { type HomeView } from "../view";
import {
	cachedWeather,
	compassIndex,
	formatHour,
	formatPercent,
	formatPrecip,
	formatTemp,
	formatWeekday,
	formatWind,
	type GeoResult,
	loadWeather,
	searchPlaces,
	today,
	upcomingDays,
	upcomingHours,
	type WeatherDay,
	type WeatherHour,
	weatherIcon,
	weatherLabelKey,
	type WeatherRequest,
	type WeatherSnapshot,
} from "../weather";
import { configuredPlaces, renderPlacePicker } from "../placepicker";
import { drawSky } from "../sky";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Weather ------------------------------------------------------------
//
// One card, five styles, from a single number on a transparent card to a
// painted sky that follows the real conditions. They all draw the same
// snapshot (src/weather.ts) and honour the same "what to display" toggles;
// what changes is how much of it reaches the surface. See `paintStyle` for the
// dispatch and the `paint*` functions under it for each style.


/** Every config value a render needs, with the defaults applied once so the
 * paint functions never repeat a `?? true` dance. */
interface Resolved {
	style: WeatherStyle;
	tempUnit: TemperatureUnit;
	windUnit: WindUnit;
	precipUnit: PrecipitationUnit;
	/** undefined = follow the locale (see resolveHour12). */
	hour12: boolean | undefined;
	showLocation: boolean;
	showCondition: boolean;
	showFeelsLike: boolean;
	showHighLow: boolean;
	showHumidity: boolean;
	showWind: boolean;
	showPrecip: boolean;
	showUv: boolean;
	showPressure: boolean;
	showSun: boolean;
	showUpdated: boolean;
	hourlyCount: number;
	dailyCount: number;
	animate: boolean;
}

/** Default hourly-strip length per style: the forecast style is built around
 * the strip and shows twice as much of it as the styles where it is a garnish. */
function defaultHourlyCount(style: WeatherStyle): number {
	switch (style) {
		case "forecast":
			return 12;
		case "detailed":
			return 6;
		case "artistic":
			// The painted sky is the point; a strip is opt-in, so the default
			// card is a place, a condition and a temperature over the weather.
			return 0;
		default:
			// minimal and compact are single-glance styles; no strip unless asked.
			return 0;
	}
}

/** Default daily-strip length per style. */
function defaultDailyCount(style: WeatherStyle): number {
	switch (style) {
		case "forecast":
			return 4;
		case "detailed":
			return 3;
		default:
			return 0;
	}
}

/** Resolve the card's `hourFormat` the way the clock card does: undefined
 * follows the reader's locale, true/false force a 12- or 24-hour clock. */
function resolveHour12(cfg: WeatherConfig): boolean | undefined {
	if (cfg.hourFormat === "24") return false;
	if (cfg.hourFormat === "12") return true;
	return undefined;
}

/** Apply every default, so the paint functions read one flat object. */
export function resolveConfig(cfg: WeatherConfig, lowPower = false): Resolved {
	const style = cfg.style ?? "compact";
	return {
		style,
		tempUnit: cfg.tempUnit ?? "c",
		windUnit: cfg.windUnit ?? "kmh",
		precipUnit: cfg.precipUnit ?? "mm",
		hour12: resolveHour12(cfg),
		showLocation: cfg.showLocation !== false,
		showCondition: cfg.showCondition !== false,
		showFeelsLike: cfg.showFeelsLike !== false,
		showHighLow: cfg.showHighLow !== false,
		showHumidity: cfg.showHumidity ?? false,
		showWind: cfg.showWind ?? false,
		showPrecip: cfg.showPrecip ?? false,
		showUv: cfg.showUv ?? false,
		showPressure: cfg.showPressure ?? false,
		showSun: cfg.showSun ?? false,
		showUpdated: cfg.showUpdated ?? false,
		hourlyCount: cfg.hourlyCount ?? defaultHourlyCount(style),
		dailyCount: cfg.dailyCount ?? defaultDailyCount(style),
		// Low power stops every animation Hearth runs; the painted sky is no
		// exception, and it is the most expensive one on the board.
		animate: (cfg.animate ?? true) && !lowPower,
	};
}

/** The forecast request a card's config asks for. */
function requestFor(cfg: WeatherConfig, r: Resolved): WeatherRequest | null {
	const place = cfg.place;
	if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
	return {
		lat: place.lat,
		lon: place.lon,
		tempUnit: r.tempUnit,
		windUnit: r.windUnit,
		precipUnit: r.precipUnit,
	};
}

/** The localized condition text for a WMO code. */
function conditionText(code: number): string {
	return t().cards.weather.conditions[weatherLabelKey(code)];
}

/** A Lucide glyph as its own element, sized by CSS. */
function glyph(parent: HTMLElement, icon: string, cls: string): HTMLElement {
	const el = parent.createDiv(cls);
	setIcon(el, icon);
	return el;
}

/** One labelled value — the unit of the meta lines and the metric grid. */
interface Metric {
	icon: string;
	label: string;
	value: string;
}

/**
 * The metrics the card is configured to show, in a fixed order so toggling one
 * on never reshuffles the others. Everything here is opt-in: a fresh card shows
 * the conditions and nothing else.
 */
function metricsFor(snapshot: WeatherSnapshot, r: Resolved): Metric[] {
	const strings = t().cards.weather;
	const now = snapshot.now;
	const day = today(snapshot);
	const out: Metric[] = [];

	if (r.showHumidity) {
		out.push({ icon: "droplets", label: strings.humidity, value: formatPercent(now.humidity) });
	}
	if (r.showWind) {
		const compass = compassIndex(now.windDir);
		const speed = formatWind(now.windSpeed, r.windUnit);
		out.push({
			icon: "wind",
			label: strings.wind,
			value: compass === null ? speed : `${speed} ${strings.compass[compass]}`,
		});
	}
	if (r.showPrecip) {
		// Today's chance of rain says more at a glance than the last hour's
		// millimetres, so the amount plays second fiddle to it.
		const chance = day?.precipChance ?? null;
		const amount = formatPrecip(now.precip, r.precipUnit);
		out.push({
			icon: "cloud-rain",
			label: strings.precip,
			value: chance === null ? amount : `${formatPercent(chance)} · ${amount}`,
		});
	}
	if (r.showUv) {
		const uv = now.uv ?? day?.uvMax ?? null;
		out.push({
			icon: "sun-medium",
			label: strings.uv,
			value: uv === null ? "—" : String(Math.round(uv)),
		});
	}
	if (r.showPressure) {
		out.push({
			icon: "gauge",
			label: strings.pressure,
			value: now.pressure === null ? "—" : `${Math.round(now.pressure)} hPa`,
		});
	}
	if (r.showSun && day) {
		out.push({
			icon: "sunrise",
			label: strings.sunrise,
			value: formatHour(day.sunrise, r.hour12) || "—",
		});
		out.push({
			icon: "sunset",
			label: strings.sunset,
			value: formatHour(day.sunset, r.hour12) || "—",
		});
	}
	return out;
}

/** "Feels like 19°" and "H 24° L 12°" — the two readings that ride along with
 * the current temperature rather than sitting in the metric grid. */
function headlineBits(snapshot: WeatherSnapshot, r: Resolved): string[] {
	const strings = t().cards.weather;
	const bits: string[] = [];
	if (r.showFeelsLike && snapshot.now.apparent !== null) {
		bits.push(strings.feelsLike(formatTemp(snapshot.now.apparent, r.tempUnit)));
	}
	const day = today(snapshot);
	if (r.showHighLow && day && (day.max !== null || day.min !== null)) {
		bits.push(
			strings.highLow(formatTemp(day.max, r.tempUnit), formatTemp(day.min, r.tempUnit)),
		);
	}
	return bits;
}

/** A bullet-separated line of small text, or nothing when there is nothing to
 * say. */
function metaLine(parent: HTMLElement, bits: string[], cls = "hearth-weather-meta"): void {
	if (!bits.length) return;
	parent.createDiv({ cls, text: bits.join(" · ") });
}

/** The place name (and, where there is room, its region). */
function placeLine(parent: HTMLElement, cfg: WeatherConfig, cls: string): void {
	const name = cfg.place?.name?.trim();
	if (!name) return;
	parent.createDiv({ cls, text: name });
}

/** The hourly strip: one column per hour, each with its time, glyph,
 * temperature and — when precipitation is on — its chance of rain. */
function hourlyStrip(parent: HTMLElement, hours: WeatherHour[], r: Resolved): void {
	if (!hours.length) return;
	const strip = parent.createDiv("hearth-weather-hours");
	hours.forEach((hour, i) => {
		const col = strip.createDiv("hearth-weather-hour");
		col.createDiv({
			cls: "hearth-weather-hour-label",
			// The first column is "now" rather than a time the reader has to
			// compare against their own clock.
			text: i === 0 ? t().cards.weather.now : formatHour(hour.time, r.hour12),
		});
		glyph(col, weatherIcon(hour.code, hour.isDay), "hearth-weather-hour-icon");
		col.createDiv({
			cls: "hearth-weather-hour-temp",
			text: formatTemp(hour.temp, r.tempUnit),
		});
		if (r.showPrecip && hour.precipChance !== null) {
			col.createDiv({
				cls: "hearth-weather-hour-precip",
				text: formatPercent(hour.precipChance),
			});
		}
	});
}

/**
 * The hourly temperature curve used by the forecast style.
 *
 * The viewBox is stretched to the card width (`preserveAspectRatio="none"`) so
 * each point lands in the centre of the matching label column below, and the
 * stroke is drawn with `vector-effect` so that stretch doesn't turn a 2 px line
 * into a wedge. A flat series (every hour the same temperature) would divide by
 * zero, so it is drawn down the middle instead.
 */
function temperatureCurve(parent: HTMLElement, hours: WeatherHour[]): void {
	const temps = hours.map((h) => h.temp).filter((v): v is number => v !== null);
	if (temps.length < 2) return;

	const min = Math.min(...temps);
	const max = Math.max(...temps);
	const span = max - min || 1;
	const flat = max === min;

	const width = 100;
	const height = 40;
	// Keep the curve off the edges so the dots and the stroke aren't clipped.
	const pad = 6;

	const points = hours.map((hour, i) => {
		const x = ((i + 0.5) / hours.length) * width;
		const y = flat
			? height / 2
			: height - pad - ((hour.temp ?? min) - min) / span * (height - pad * 2);
		return { x, y, temp: hour.temp };
	});

	const svg = parent.createSvg("svg", {
		cls: "hearth-weather-curve",
		attr: { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" },
	});
	const line = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
	// Fill under the curve first, so the stroke sits on top of it. The area
	// starts and ends under the outer points rather than at the card's edges,
	// which would add a wedge the data doesn't support.
	const first = points[0];
	const last = points[points.length - 1];
	svg.createSvg("polygon", {
		cls: "hearth-weather-curve-fill",
		attr: {
			points: `${first.x.toFixed(2)},${height} ${line} ${last.x.toFixed(2)},${height}`,
		},
	});
	svg.createSvg("polyline", {
		cls: "hearth-weather-curve-line",
		attr: { points: line, "vector-effect": "non-scaling-stroke" },
	});
	for (const point of points) {
		if (point.temp === null) continue;
		svg.createSvg("circle", {
			cls: "hearth-weather-curve-dot",
			attr: {
				cx: point.x.toFixed(2),
				cy: point.y.toFixed(2),
				// Stretched horizontally with the viewBox, so the radius is given
				// in the vertical unit and squashed back by CSS.
				r: "1.6",
				"vector-effect": "non-scaling-stroke",
			},
		});
	}
}

/** The daily forecast: one row per day, with a range bar that places each day's
 * high and low against the whole strip's span, so a cold snap reads as a bar
 * that has slid left rather than as three numbers to compare by eye. */
function dailyList(parent: HTMLElement, days: WeatherDay[], r: Resolved): void {
	if (!days.length) return;
	const lows = days.map((d) => d.min).filter((v): v is number => v !== null);
	const highs = days.map((d) => d.max).filter((v): v is number => v !== null);
	const floor = lows.length ? Math.min(...lows) : 0;
	const ceiling = highs.length ? Math.max(...highs) : 1;
	const span = ceiling - floor || 1;

	const list = parent.createDiv("hearth-weather-days");
	days.forEach((day, i) => {
		const row = list.createDiv("hearth-weather-day");
		row.createDiv({
			cls: "hearth-weather-day-label",
			text: i === 0 ? t().cards.weather.todayLabel : formatWeekday(day.date),
		});
		glyph(row, weatherIcon(day.code, true), "hearth-weather-day-icon");
		if (r.showPrecip) {
			row.createDiv({
				cls: "hearth-weather-day-precip",
				text: day.precipChance === null ? "" : formatPercent(day.precipChance),
			});
		}
		row.createDiv({
			cls: "hearth-weather-day-low",
			text: formatTemp(day.min, r.tempUnit),
		});
		const track = row.createDiv("hearth-weather-day-track");
		const bar = track.createDiv("hearth-weather-day-bar");
		const from = day.min === null ? floor : day.min;
		const to = day.max === null ? ceiling : day.max;
		bar.style.insetInlineStart = `${((from - floor) / span) * 100}%`;
		// A degree-wide range would otherwise vanish; keep a sliver visible.
		bar.style.width = `${Math.max(((to - from) / span) * 100, 6)}%`;
		row.createDiv({
			cls: "hearth-weather-day-high",
			text: formatTemp(day.max, r.tempUnit),
		});
	});
}

/** The metric grid used by the detailed style. */
function metricGrid(parent: HTMLElement, metrics: Metric[]): void {
	if (!metrics.length) return;
	const grid = parent.createDiv("hearth-weather-metrics");
	for (const metric of metrics) {
		const tile = grid.createDiv("hearth-weather-metric");
		glyph(tile, metric.icon, "hearth-weather-metric-icon");
		const text = tile.createDiv("hearth-weather-metric-text");
		text.createDiv({ cls: "hearth-weather-metric-label", text: metric.label });
		text.createDiv({ cls: "hearth-weather-metric-value", text: metric.value });
	}
}

/** "Updated 14:20", when the card is set to show it. */
function updatedLine(parent: HTMLElement, snapshot: WeatherSnapshot, r: Resolved): void {
	if (!r.showUpdated) return;
	const stamp = new Date(snapshot.fetched);
	// h23 rather than `hour12: false` — see formatHour in ../weather.ts.
	const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
	if (r.hour12 === true) opts.hour12 = true;
	else if (r.hour12 === false) opts.hourCycle = "h23";
	parent.createDiv({
		cls: "hearth-weather-updated",
		text: t().cards.weather.updated(stamp.toLocaleTimeString(undefined, opts)),
	});
}


// ---- Styles -------------------------------------------------------------

/** Minimal: one glyph, one temperature. Anything else is opt-in. */
function paintMinimal(wrap: HTMLElement, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): void {
	const hero = wrap.createDiv("hearth-weather-hero");
	glyph(hero, weatherIcon(snapshot.now.code, snapshot.now.isDay), "hearth-weather-glyph");
	hero.createDiv({
		cls: "hearth-weather-temp",
		text: formatTemp(snapshot.now.temp, r.tempUnit),
	});

	const bits: string[] = [];
	if (r.showCondition) bits.push(conditionText(snapshot.now.code));
	if (r.showLocation && cfg.place?.name) bits.push(cfg.place.name);
	metaLine(wrap, bits);
	updatedLine(wrap, snapshot, r);
}

/** Compact: a single row — glyph, temperature, and the words beside them. */
function paintCompact(wrap: HTMLElement, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): void {
	const row = wrap.createDiv("hearth-weather-row");
	glyph(row, weatherIcon(snapshot.now.code, snapshot.now.isDay), "hearth-weather-glyph");
	row.createDiv({
		cls: "hearth-weather-temp",
		text: formatTemp(snapshot.now.temp, r.tempUnit),
	});

	const text = row.createDiv("hearth-weather-rowtext");
	if (r.showCondition) {
		text.createDiv({
			cls: "hearth-weather-condition",
			text: conditionText(snapshot.now.code),
		});
	}
	if (r.showLocation) placeLine(text, cfg, "hearth-weather-place");
	metaLine(text, headlineBits(snapshot, r));

	const metrics = metricsFor(snapshot, r);
	metaLine(
		wrap,
		metrics.map((m) => `${m.label} ${m.value}`),
		"hearth-weather-meta hearth-weather-meta-wrap",
	);
	hourlyStrip(wrap, upcomingHours(snapshot, r.hourlyCount), r);
	dailyList(wrap, upcomingDays(snapshot, r.dailyCount), r);
	updatedLine(wrap, snapshot, r);
}

/** Detailed: the current conditions, then every metric that is switched on, then
 * the forecast strips. The weather-station layout. */
function paintDetailed(wrap: HTMLElement, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): void {
	const head = wrap.createDiv("hearth-weather-head");
	glyph(head, weatherIcon(snapshot.now.code, snapshot.now.isDay), "hearth-weather-glyph");
	const headText = head.createDiv("hearth-weather-headtext");
	headText.createDiv({
		cls: "hearth-weather-temp",
		text: formatTemp(snapshot.now.temp, r.tempUnit),
	});
	if (r.showCondition) {
		headText.createDiv({
			cls: "hearth-weather-condition",
			text: conditionText(snapshot.now.code),
		});
	}
	if (r.showLocation) placeLine(headText, cfg, "hearth-weather-place");
	metaLine(headText, headlineBits(snapshot, r));

	metricGrid(wrap, metricsFor(snapshot, r));
	hourlyStrip(wrap, upcomingHours(snapshot, r.hourlyCount), r);
	dailyList(wrap, upcomingDays(snapshot, r.dailyCount), r);
	updatedLine(wrap, snapshot, r);
}

/** Forecast: the curve is the point. The current conditions shrink to one line
 * above it and the daily strip sits below. */
function paintForecast(wrap: HTMLElement, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): void {
	const row = wrap.createDiv("hearth-weather-row hearth-weather-row-tight");
	glyph(row, weatherIcon(snapshot.now.code, snapshot.now.isDay), "hearth-weather-glyph");
	row.createDiv({
		cls: "hearth-weather-temp",
		text: formatTemp(snapshot.now.temp, r.tempUnit),
	});
	const text = row.createDiv("hearth-weather-rowtext");
	if (r.showCondition) {
		text.createDiv({
			cls: "hearth-weather-condition",
			text: conditionText(snapshot.now.code),
		});
	}
	if (r.showLocation) placeLine(text, cfg, "hearth-weather-place");
	metaLine(text, headlineBits(snapshot, r));

	const hours = upcomingHours(snapshot, r.hourlyCount || defaultHourlyCount("forecast"));
	if (hours.length >= 2) {
		const chart = wrap.createDiv("hearth-weather-chart");
		temperatureCurve(chart, hours);
		const labels = chart.createDiv("hearth-weather-chart-labels");
		hours.forEach((hour, i) => {
			const col = labels.createDiv("hearth-weather-chart-label");
			col.createDiv({
				cls: "hearth-weather-chart-temp",
				text: formatTemp(hour.temp, r.tempUnit),
			});
			col.createDiv({
				cls: "hearth-weather-chart-hour",
				text: i === 0 ? t().cards.weather.now : formatHour(hour.time, r.hour12),
			});
		});
	}

	metricGrid(wrap, metricsFor(snapshot, r));
	dailyList(wrap, upcomingDays(snapshot, r.dailyCount), r);
	updatedLine(wrap, snapshot, r);
}


/** Artistic: an edge-to-edge painted sky with the reading laid over it. */
function paintArtistic(wrap: HTMLElement, snapshot: WeatherSnapshot, cfg: WeatherConfig, r: Resolved): void {
	const now = snapshot.now;
	const sky = drawSky(wrap, { code: now.code, isDay: now.isDay, animate: r.animate });
	const content = sky.createDiv("hearth-weather-art-content");

	const top = content.createDiv("hearth-weather-art-top");
	if (r.showLocation) placeLine(top, cfg, "hearth-weather-art-place");
	if (r.showCondition) {
		top.createDiv({
			cls: "hearth-weather-art-condition",
			text: conditionText(now.code),
		});
	}

	const bottom = content.createDiv("hearth-weather-art-bottom");
	bottom.createDiv({
		cls: "hearth-weather-art-temp",
		text: formatTemp(now.temp, r.tempUnit),
	});
	metaLine(bottom, headlineBits(snapshot, r), "hearth-weather-art-meta");
	const metrics = metricsFor(snapshot, r);
	metaLine(
		bottom,
		metrics.map((m) => `${m.label} ${m.value}`),
		"hearth-weather-art-meta hearth-weather-meta-wrap",
	);
	hourlyStrip(bottom, upcomingHours(snapshot, r.hourlyCount), r);
	dailyList(bottom, upcomingDays(snapshot, r.dailyCount), r);
	updatedLine(bottom, snapshot, r);
}

/** Dispatch to the configured style. */
function paintStyle(
	wrap: HTMLElement,
	snapshot: WeatherSnapshot,
	cfg: WeatherConfig,
	r: Resolved,
): void {
	switch (r.style) {
		case "minimal":
			paintMinimal(wrap, snapshot, cfg, r);
			break;
		case "detailed":
			paintDetailed(wrap, snapshot, cfg, r);
			break;
		case "forecast":
			paintForecast(wrap, snapshot, cfg, r);
			break;
		case "artistic":
			paintArtistic(wrap, snapshot, cfg, r);
			break;
		case "compact":
		default:
			paintCompact(wrap, snapshot, cfg, r);
			break;
	}
}


// ---- Render -------------------------------------------------------------

export function renderWeather(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.weather ?? {};
	const r = resolveConfig(cfg, lowPowerActive(view.plugin.settings));
	const req = requestFor(cfg, r);
	if (!req) {
		emptyState(body, "cloud-sun", t().cards.empty.weatherNoLocation);
		return;
	}

	const disabled = view.plugin.settings.disableExternalCalls;
	const refreshMin = cfg.refreshMin ?? 30;
	// A forecast is published hourly at best, so the cache floor is generous
	// even when the card is set to "manual only" — it stops Hearth's frequent
	// full re-renders from turning into requests.
	const ttlMs = Math.max(refreshMin, 10) * 60_000;

	// The card body is the size container every style measures itself against,
	// so a reading scales to the card's height as well as its width instead of
	// being cut in half on a short card.
	body.addClass("hearth-weather-host");
	// The artistic sky is edge-to-edge; the others keep the card's own padding.
	if (r.style === "artistic") body.addClass("hearth-weather-flush");

	// Async loads may resolve after the card is torn down and rebuilt; ignore them.
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});
	let loading = false;

	const wrap = body.createDiv(`hearth-weather is-${r.style}`);

	/** Paint the snapshot, or the loading / offline / error state standing in
	 * for it. A stale snapshot always beats a placeholder: yesterday's sky is
	 * more use than a spinner. */
	const paint = (): void => {
		wrap.empty();
		const snapshot = cachedWeather(req);
		if (snapshot) {
			paintStyle(wrap, snapshot, cfg, r);
			return;
		}
		if (loading) emptyState(wrap, "cloud-sun", t().cards.weather.loading);
		else if (disabled) emptyState(wrap, "wifi-off", t().cards.weather.disabled);
		else emptyState(wrap, "cloud-off", t().cards.weather.error);
	};

	/** Show what is cached immediately, then fetch and repaint. `force` bypasses
	 * the cache TTL (the manual refresh button and the auto-refresh timer). */
	const load = (force: boolean): void => {
		loading = !cachedWeather(req);
		paint();
		void loadWeather(req, { ttlMs, disabled, force }).then(() => {
			if (destroyed) return;
			loading = false;
			paint();
		});
	};

	load(false);

	// The TTL above still uses the configured interval; only the timer is
	// suppressed in low power mode, so the card loads on open but never wakes
	// the app up on a clock.
	const autoRefreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, refreshMin);
	if (autoRefreshMin > 0) {
		component.registerInterval(
			window.setInterval(() => load(true), autoRefreshMin * 60_000),
		);
	}
}


// ---- Editor -------------------------------------------------------------

/** A 0-means-off count slider with a reset button, shared by the hourly and
 * daily strip lengths. */
function countSlider(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	opts: {
		name: string;
		desc: string;
		max: number;
		value: number;
		fallback: number;
		set: (value: number | undefined) => void;
	},
): void {
	const setting = new Setting(containerEl).setName(opts.name).setDesc(opts.desc);
	setting.addSlider((s) =>
		s
			.setLimits(0, opts.max, 1)
			.setValue(opts.value)
			.onChange((v) => {
				opts.set(v === opts.fallback ? undefined : v);
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	setting.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				opts.set(undefined);
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
}

export function weatherEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.weather ??= {});
	const strings = t().editors.weather;
	const style = cfg.style ?? "compact";

	// ---- Location ----
	new Setting(containerEl).setName(strings.location).setHeading();
	renderPlacePicker(containerEl, {
		current: cfg.place,
		onPick: (place) => {
			cfg.place = place;
			ctx.opts.save();
			ctx.opts.rerender();
		},
		rerender: () => ctx.requestRender(),
		disabled: ctx.opts.externalCallsDisabled,
		session: ctx.session,
		suggestions: configuredPlaces(ctx.opts.settings),
	});

	// ---- Style ----
	new Setting(containerEl).setName(strings.appearance).setHeading();
	new Setting(containerEl)
		.setName(strings.style)
		.setDesc(strings.styleDesc)
		.addDropdown((d) => {
			d.addOption("minimal", strings.styleMinimal);
			d.addOption("compact", strings.styleCompact);
			d.addOption("detailed", strings.styleDetailed);
			d.addOption("forecast", strings.styleForecast);
			d.addOption("artistic", strings.styleArtistic);
			d.setValue(style).onChange((v) => {
				cfg.style = v as WeatherStyle;
				ctx.opts.save();
				ctx.opts.rerender();
				// The strip defaults and the animation toggle differ per style.
				ctx.requestRender();
			});
		});

	if (style === "artistic") {
		new Setting(containerEl)
			.setName(strings.animate)
			.setDesc(strings.animateDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.animate !== false).onChange((v) => {
					cfg.animate = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	// ---- Units ----
	new Setting(containerEl).setName(strings.units).setHeading();
	new Setting(containerEl)
		.setName(strings.tempUnit)
		.addDropdown((d) => {
			d.addOption("c", strings.tempUnitC);
			d.addOption("f", strings.tempUnitF);
			d.setValue(cfg.tempUnit ?? "c").onChange((v) => {
				cfg.tempUnit = v === "c" ? undefined : (v as TemperatureUnit);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(strings.windUnit)
		.addDropdown((d) => {
			d.addOption("kmh", strings.windUnitKmh);
			d.addOption("ms", strings.windUnitMs);
			d.addOption("mph", strings.windUnitMph);
			d.addOption("kn", strings.windUnitKn);
			d.setValue(cfg.windUnit ?? "kmh").onChange((v) => {
				cfg.windUnit = v === "kmh" ? undefined : (v as WindUnit);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(strings.precipUnit)
		.addDropdown((d) => {
			d.addOption("mm", strings.precipUnitMm);
			d.addOption("inch", strings.precipUnitInch);
			d.setValue(cfg.precipUnit ?? "mm").onChange((v) => {
				cfg.precipUnit = v === "mm" ? undefined : (v as PrecipitationUnit);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(strings.hourFormat)
		.addDropdown((d) => {
			d.addOption("auto", strings.hourFormatAuto);
			d.addOption("12", strings.hourFormat12);
			d.addOption("24", strings.hourFormat24);
			d.setValue(cfg.hourFormat ?? "auto").onChange((v) => {
				cfg.hourFormat = v === "auto" ? undefined : (v as WeatherConfig["hourFormat"]);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});

	// ---- What to display ----
	new Setting(containerEl).setName(strings.display).setHeading();

	/** One display toggle. `defaultOn` decides which way the stored value is
	 * flipped, so the config only ever holds the non-default. */
	const toggle = (
		name: string,
		desc: string,
		get: () => boolean | undefined,
		set: (v: boolean | undefined) => void,
		defaultOn: boolean,
	): void => {
		const setting = new Setting(containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addToggle((tg) =>
			tg.setValue(get() ?? defaultOn).onChange((v) => {
				set(v === defaultOn ? undefined : v);
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
	};

	toggle(strings.showLocation, "", () => cfg.showLocation, (v) => (cfg.showLocation = v), true);
	toggle(strings.showCondition, "", () => cfg.showCondition, (v) => (cfg.showCondition = v), true);
	if (style !== "minimal") {
		toggle(strings.showFeelsLike, "", () => cfg.showFeelsLike, (v) => (cfg.showFeelsLike = v), true);
		toggle(strings.showHighLow, "", () => cfg.showHighLow, (v) => (cfg.showHighLow = v), true);
		toggle(strings.showHumidity, "", () => cfg.showHumidity, (v) => (cfg.showHumidity = v), false);
		toggle(strings.showWind, "", () => cfg.showWind, (v) => (cfg.showWind = v), false);
		toggle(strings.showPrecip, strings.showPrecipDesc, () => cfg.showPrecip, (v) => (cfg.showPrecip = v), false);
		toggle(strings.showUv, "", () => cfg.showUv, (v) => (cfg.showUv = v), false);
		toggle(strings.showPressure, "", () => cfg.showPressure, (v) => (cfg.showPressure = v), false);
		toggle(strings.showSun, "", () => cfg.showSun, (v) => (cfg.showSun = v), false);
	}
	toggle(strings.showUpdated, "", () => cfg.showUpdated, (v) => (cfg.showUpdated = v), false);

	if (style !== "minimal") {
		countSlider(ctx, containerEl, {
			name: strings.hourlyCount,
			desc: strings.hourlyCountDesc,
			max: 24,
			value: cfg.hourlyCount ?? defaultHourlyCount(style),
			fallback: defaultHourlyCount(style),
			set: (v) => (cfg.hourlyCount = v),
		});
		countSlider(ctx, containerEl, {
			name: strings.dailyCount,
			desc: strings.dailyCountDesc,
			max: 7,
			value: cfg.dailyCount ?? defaultDailyCount(style),
			fallback: defaultDailyCount(style),
			set: (v) => (cfg.dailyCount = v),
		});
	}

	// ---- Refresh ----
	const refresh = new Setting(containerEl)
		.setName(strings.refresh)
		.setDesc(strings.refreshDesc);
	refresh.addSlider((s) =>
		s
			.setLimits(0, 180, 5)
			.setValue(cfg.refreshMin ?? 30)
			.onChange((v) => {
				cfg.refreshMin = v === 30 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
}

/** Current conditions and a forecast, from the free key-less Open-Meteo API. */
export const weatherCard: CardDefinition<"weather"> = {
	kind: "weather",
	templates: [
		{
			id: "weather",
			name: "Weather",
			icon: "cloud-sun",
			build: () => ({ kind: "weather", title: "Weather", weather: {}, w: 4, h: 3 }),
		},
	],
	render: (view, card, body, component) => renderWeather(view, card, body, component),
	renderEditor: (container, ctx) => weatherEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.weather) {
			copy.weather = {
				...source.weather,
				place: source.weather.place ? { ...source.weather.place } : undefined,
			};
		}
	},
	liveness: { mode: "static" },
};
