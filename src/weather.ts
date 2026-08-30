/**
 * Forecast fetching and parsing for the "weather" card.
 *
 * The source is [Open-Meteo](https://open-meteo.com) — free, key-less and with
 * no account or attribution requirement, which is what lets the weather card
 * work out of the box like the calculator's exchange rates do. Two endpoints
 * are used: the forecast API for the numbers, and the geocoding API to turn a
 * typed place name into coordinates once, in the card editor. Nothing but
 * latitude and longitude ever leaves the vault, and the card stores the
 * resolved place so an offline board still knows where it points.
 *
 * Responses are cached in memory per (location + units) for a card-configurable
 * window, so a board with several weather cards — and Hearth's frequent full
 * re-renders — makes at most one request per window. Everything degrades
 * gracefully: a failed fetch keeps the last good snapshot, and the request is
 * skipped entirely when the user has disabled external calls.
 *
 * The parsing and formatting helpers here are deliberately pure (they take a
 * decoded response and return plain data) so the card's behaviour can be tested
 * without a network or a DOM — see test/weather.test.ts.
 */
import { requestUrl } from "obsidian";
import type {
	PrecipitationUnit,
	TemperatureUnit,
	WeatherPlace,
	WindUnit,
} from "./types";

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

/** How many days of daily forecast to request. The card shows at most 7. */
const FORECAST_DAYS = 7;

/** How many geocoder matches to offer in the editor's place picker. */
const GEOCODING_LIMIT = 8;

// ---- Weather codes ------------------------------------------------------

/**
 * The WMO weather code, collapsed to the handful of buckets the card actually
 * draws differently — one glyph and one painted sky each.
 */
export type WeatherGroup =
	| "clear"
	| "partly"
	| "cloudy"
	| "fog"
	| "drizzle"
	| "rain"
	| "snow"
	| "thunder";

/**
 * Bucket a [WMO 4677 code](https://open-meteo.com/en/docs) as Open-Meteo
 * reports it. Unknown codes fall back to "cloudy" — a neutral sky rather than a
 * missing one.
 */
export function weatherGroup(code: number): WeatherGroup {
	if (code === 0) return "clear";
	if (code === 1 || code === 2) return "partly";
	if (code === 3) return "cloudy";
	if (code === 45 || code === 48) return "fog";
	if (code >= 51 && code <= 57) return "drizzle";
	if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
	if (code >= 95 && code <= 99) return "thunder";
	return "cloudy";
}

/** Keys of `t().cards.weather.conditions`; the label shown for a code. */
export type WeatherLabelKey =
	| "clear"
	| "mainlyClear"
	| "partlyCloudy"
	| "overcast"
	| "fog"
	| "rimeFog"
	| "drizzle"
	| "freezingDrizzle"
	| "rain"
	| "heavyRain"
	| "freezingRain"
	| "showers"
	| "snow"
	| "heavySnow"
	| "snowGrains"
	| "snowShowers"
	| "thunderstorm"
	| "thunderstormHail"
	| "unknown";

/** The condition label for a WMO code — finer-grained than {@link weatherGroup}
 * because "Heavy rain" and "Light drizzle" are worth telling apart in words even
 * when they share a glyph. */
export function weatherLabelKey(code: number): WeatherLabelKey {
	switch (code) {
		case 0:
			return "clear";
		case 1:
			return "mainlyClear";
		case 2:
			return "partlyCloudy";
		case 3:
			return "overcast";
		case 45:
			return "fog";
		case 48:
			return "rimeFog";
		case 51:
		case 53:
		case 55:
			return "drizzle";
		case 56:
		case 57:
			return "freezingDrizzle";
		case 61:
		case 63:
			return "rain";
		case 65:
			return "heavyRain";
		case 66:
		case 67:
			return "freezingRain";
		case 80:
		case 81:
		case 82:
			return "showers";
		case 71:
		case 73:
			return "snow";
		case 75:
			return "heavySnow";
		case 77:
			return "snowGrains";
		case 85:
		case 86:
			return "snowShowers";
		case 95:
			return "thunderstorm";
		case 96:
		case 99:
			return "thunderstormHail";
		default:
			return "unknown";
	}
}

/** The Lucide icon for a condition. Clear and partly-cloudy skies get their
 * night variants, which is most of what makes a night card read as night. */
export function weatherIcon(code: number, isDay: boolean): string {
	switch (weatherGroup(code)) {
		case "clear":
			return isDay ? "sun" : "moon";
		case "partly":
			return isDay ? "cloud-sun" : "cloud-moon";
		case "cloudy":
			return "cloud";
		case "fog":
			return "cloud-fog";
		case "drizzle":
			return "cloud-drizzle";
		case "rain":
			return "cloud-rain";
		case "snow":
			return "cloud-snow";
		case "thunder":
			return "cloud-lightning";
	}
}

// ---- The parsed forecast -------------------------------------------------

/**
 * Times throughout this module are the location's own wall clock, exactly as
 * Open-Meteo returns them under `timezone=auto`: `"YYYY-MM-DDTHH:mm"`, with no
 * offset. They are deliberately *not* converted to Date objects — a card
 * showing Tokyo's forecast should say Tokyo's hours, not the reader's — and
 * because the format is fixed-width they also sort and compare as plain
 * strings, which is how {@link upcomingHours} finds "now".
 */
export interface WeatherNow {
	/** Local wall clock of the observation. */
	time: string;
	temp: number | null;
	/** "Feels like" temperature. */
	apparent: number | null;
	/** Relative humidity, percent. */
	humidity: number | null;
	/** Precipitation in the last hour, in the configured unit. */
	precip: number | null;
	/** Surface pressure, hPa. */
	pressure: number | null;
	windSpeed: number | null;
	/** Direction the wind blows *from*, in degrees clockwise from north. */
	windDir: number | null;
	gust: number | null;
	/** Cloud cover, percent. */
	cloudCover: number | null;
	code: number;
	isDay: boolean;
	/** UV index at the current hour, taken from the hourly series. */
	uv: number | null;
}

export interface WeatherHour {
	/** Local wall clock, on the hour. */
	time: string;
	temp: number | null;
	/** "Feels like" temperature. */
	apparent: number | null;
	code: number;
	isDay: boolean;
	/** Chance of precipitation, percent. */
	precipChance: number | null;
	/** Precipitation expected in this hour, in the configured unit. */
	precip: number | null;
	/** Relative humidity, percent. */
	humidity: number | null;
	windSpeed: number | null;
	/** Direction the wind blows *from*, in degrees clockwise from north. */
	windDir: number | null;
	/** UV index for this hour. */
	uv: number | null;
}

export interface WeatherDay {
	/** Local calendar date, `YYYY-MM-DD`. */
	date: string;
	code: number;
	max: number | null;
	min: number | null;
	/** Local wall clock. */
	sunrise: string;
	sunset: string;
	precipChance: number | null;
	/** Total precipitation expected over the day, in the configured unit. */
	precipSum: number | null;
	uvMax: number | null;
	/** The day's strongest wind, in the configured unit. */
	windMax: number | null;
}

/** A whole forecast, normalised. */
export interface WeatherSnapshot {
	now: WeatherNow;
	/** Every hour the API returned, oldest first — trimmed to what is still
	 * ahead by {@link upcomingHours}. */
	hourly: WeatherHour[];
	daily: WeatherDay[];
	/** The IANA zone the times above are in. */
	timezone: string;
	/** Epoch ms when this snapshot was fetched. */
	fetched: number;
}

/** A number from a decoded JSON response, or null when it is missing or not
 * finite (Open-Meteo writes `null` for gaps in a series). */
function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A wall-clock string from a decoded response, or "" when absent. */
function str(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** Read index `i` of a response array, tolerating a missing or short series. */
function at(series: unknown, i: number): unknown {
	return Array.isArray(series) ? series[i] : undefined;
}

/** Shape of the bits of an Open-Meteo forecast response we read. Everything is
 * `unknown` below the top level: the response is untrusted input and each field
 * is narrowed by `num`/`str` as it is used. */
interface RawForecast {
	timezone?: unknown;
	current?: Record<string, unknown>;
	hourly?: Record<string, unknown>;
	daily?: Record<string, unknown>;
}

/**
 * Normalise a decoded Open-Meteo forecast response, or return null when it
 * isn't one (an error payload, or a body that lost its `current` block).
 *
 * Pure: no clock, no network, no module state — the snapshot's `fetched` stamp
 * is supplied by the caller so tests can pin it.
 */
export function parseForecast(json: unknown, fetched: number): WeatherSnapshot | null {
	if (!json || typeof json !== "object") return null;
	const raw = json as RawForecast;
	const current = raw.current;
	if (!current || typeof current !== "object") return null;

	const code = num(current.weather_code);
	if (code === null) return null;

	const hourlyRaw = raw.hourly ?? {};
	const hourTimes = Array.isArray(hourlyRaw.time) ? hourlyRaw.time : [];
	const hourly: WeatherHour[] = hourTimes.map((time, i) => ({
		time: str(time),
		temp: num(at(hourlyRaw.temperature_2m, i)),
		apparent: num(at(hourlyRaw.apparent_temperature, i)),
		code: num(at(hourlyRaw.weather_code, i)) ?? code,
		// The hourly `is_day` flag is 1/0, not a boolean.
		isDay: num(at(hourlyRaw.is_day, i)) !== 0,
		precipChance: num(at(hourlyRaw.precipitation_probability, i)),
		precip: num(at(hourlyRaw.precipitation, i)),
		humidity: num(at(hourlyRaw.relative_humidity_2m, i)),
		windSpeed: num(at(hourlyRaw.wind_speed_10m, i)),
		windDir: num(at(hourlyRaw.wind_direction_10m, i)),
		uv: num(at(hourlyRaw.uv_index, i)),
	}));

	const dailyRaw = raw.daily ?? {};
	const dayTimes = Array.isArray(dailyRaw.time) ? dailyRaw.time : [];
	const daily: WeatherDay[] = dayTimes.map((date, i) => ({
		date: str(date),
		code: num(at(dailyRaw.weather_code, i)) ?? code,
		max: num(at(dailyRaw.temperature_2m_max, i)),
		min: num(at(dailyRaw.temperature_2m_min, i)),
		sunrise: str(at(dailyRaw.sunrise, i)),
		sunset: str(at(dailyRaw.sunset, i)),
		precipChance: num(at(dailyRaw.precipitation_probability_max, i)),
		precipSum: num(at(dailyRaw.precipitation_sum, i)),
		uvMax: num(at(dailyRaw.uv_index_max, i)),
		windMax: num(at(dailyRaw.wind_speed_10m_max, i)),
	}));

	const time = str(current.time);
	const now: WeatherNow = {
		time,
		temp: num(current.temperature_2m),
		apparent: num(current.apparent_temperature),
		humidity: num(current.relative_humidity_2m),
		precip: num(current.precipitation),
		pressure: num(current.surface_pressure) ?? num(current.pressure_msl),
		windSpeed: num(current.wind_speed_10m),
		windDir: num(current.wind_direction_10m),
		gust: num(current.wind_gusts_10m),
		cloudCover: num(current.cloud_cover),
		code,
		isDay: num(current.is_day) !== 0,
		// The current block carries no UV index, so it comes from the hourly
		// series at the hour we are in.
		uv: hourAt(hourly, time)?.uv ?? null,
	};

	return { now, hourly, daily, timezone: str(raw.timezone) || "auto", fetched };
}

/** The hourly entry covering `time`, matched on the wall clock down to the
 * hour. Undefined when the series doesn't reach it. */
function hourAt(hourly: WeatherHour[], time: string): WeatherHour | undefined {
	const hour = time.slice(0, 13);
	if (!hour) return undefined;
	return hourly.find((h) => h.time.slice(0, 13) === hour);
}

/**
 * The next `count` hourly entries, starting with the hour the snapshot's
 * observation falls in. Both sides are the location's wall clock in the same
 * fixed-width format, so the "is this hour still ahead" test is a string
 * comparison — no Date, no zone maths, and correct across a DST change because
 * the API has already applied it.
 */
export function upcomingHours(snapshot: WeatherSnapshot, count: number): WeatherHour[] {
	if (count <= 0) return [];
	const hour = snapshot.now.time.slice(0, 13);
	const from = hour ? snapshot.hourly.findIndex((h) => h.time.slice(0, 13) >= hour) : 0;
	if (from < 0) return [];
	return snapshot.hourly.slice(from, from + count);
}

/** The next `count` days, starting with today. */
export function upcomingDays(snapshot: WeatherSnapshot, count: number): WeatherDay[] {
	if (count <= 0) return [];
	const today = snapshot.now.time.slice(0, 10);
	const from = today ? snapshot.daily.findIndex((d) => d.date >= today) : 0;
	if (from < 0) return [];
	return snapshot.daily.slice(from, from + count);
}

/**
 * Every hourly entry that falls on `date` (a `YYYY-MM-DD` as the daily series
 * writes it). Today is trimmed to the hours still ahead, by the same wall-clock
 * string comparison {@link upcomingHours} makes, so the full forecast never
 * opens on hours that have already been and gone.
 */
export function hoursOn(snapshot: WeatherSnapshot, date: string): WeatherHour[] {
	if (!date) return [];
	// "" sorts below every wall clock, so a day that isn't today keeps all 24.
	const from = date === snapshot.now.time.slice(0, 10) ? snapshot.now.time.slice(0, 13) : "";
	return snapshot.hourly.filter(
		(h) => h.time.slice(0, 10) === date && h.time.slice(0, 13) >= from,
	);
}

/** Today's entry in the daily series, or null when it isn't in the response. */
export function today(snapshot: WeatherSnapshot): WeatherDay | null {
	const date = snapshot.now.time.slice(0, 10);
	return snapshot.daily.find((d) => d.date === date) ?? snapshot.daily[0] ?? null;
}

// ---- Formatting ---------------------------------------------------------

/** The unit suffix Open-Meteo (and the card) uses for each wind unit. */
const WIND_SUFFIX: Record<WindUnit, string> = {
	kmh: "km/h",
	ms: "m/s",
	mph: "mph",
	kn: "kn",
};

/** The unit suffix for each precipitation unit. */
const PRECIP_SUFFIX: Record<PrecipitationUnit, string> = {
	mm: "mm",
	inch: "in",
};

/** A temperature as the card prints it: rounded to whole degrees, with the
 * degree sign and — when asked — the scale letter. Null renders as an em dash so
 * a gap in the series never shows up as "NaN°". */
export function formatTemp(value: number | null, unit: TemperatureUnit, withScale = false): string {
	if (value === null) return "—";
	const rounded = Math.round(value);
	return withScale ? `${rounded}°${unit === "f" ? "F" : "C"}` : `${rounded}°`;
}

/** A wind speed with its unit, rounded to whole units. */
export function formatWind(value: number | null, unit: WindUnit): string {
	// m/s is the one unit where a whole number is too coarse to be useful.
	if (value === null) return "—";
	const rounded = unit === "ms" ? Math.round(value * 10) / 10 : Math.round(value);
	return `${rounded} ${WIND_SUFFIX[unit]}`;
}

/** A precipitation amount with its unit. Inches need a decimal to say anything
 * at all, millimetres read better with one too below 10. */
export function formatPrecip(value: number | null, unit: PrecipitationUnit): string {
	if (value === null) return "—";
	const decimals = unit === "inch" ? 2 : value < 10 ? 1 : 0;
	return `${value.toFixed(decimals)} ${PRECIP_SUFFIX[unit]}`;
}

/** A percentage, rounded. */
export function formatPercent(value: number | null): string {
	return value === null ? "—" : `${Math.round(value)}%`;
}

/** The eighth of the compass a bearing falls in, as an index into
 * `t().cards.weather.compass` (0 = N, 1 = NE, … 7 = NW). Bearings are the
 * direction the wind blows *from*, matching how forecasts are read aloud. */
export function compassIndex(degrees: number | null): number | null {
	if (degrees === null) return null;
	// +22.5 puts the boundary between sectors, not their centre, on the wrap.
	return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}

/**
 * Print an `"…THH:mm"` wall clock as a time of day.
 *
 * `hour12` chooses the format: undefined follows the reader's locale, true and
 * false force a 12- or 24-hour clock (see the h23 note below). The string is formatted through the
 * locale rather than sliced so a 12-hour reader gets "3 PM", but the *value* is
 * always the location's own wall clock — the placeholder date below is fixed and
 * only exists to give Intl something to format.
 */
export function formatHour(time: string, hour12: boolean | undefined): string {
	const match = /T(\d{2}):(\d{2})/.exec(time);
	if (!match) return "";
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	// `hour12: false` is NOT a 24-hour clock: it selects the h24 cycle on some
	// ICU builds, which prints midnight as "24:15". Ask for the h23 cycle by
	// name instead — that is the one that starts the day at 00.
	const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
	if (hour12 === true) opts.hour12 = true;
	else if (hour12 === false) opts.hourCycle = "h23";
	// Local midnight of a fixed day + the wall-clock offset: no zone conversion
	// can move it, because both sides are the runtime's own local time.
	const stamp = new Date(2000, 0, 1, hour, minute);
	return stamp.toLocaleTimeString(undefined, opts);
}

/** Print a `YYYY-MM-DD` local date as a short weekday ("Mon"). */
export function formatWeekday(date: string, style: "short" | "long" = "short"): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) return "";
	const stamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return stamp.toLocaleDateString(undefined, { weekday: style });
}

/** Print a `YYYY-MM-DD` local date as a day and month ("1 Sep"), for the day
 * headings in the full forecast. */
export function formatDayDate(date: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) return "";
	const stamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return stamp.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ---- Fetching -----------------------------------------------------------

/** Everything that decides which forecast a card wants. Units are part of it
 * because Open-Meteo converts server-side, so two cards on different units are
 * two different responses. */
export interface WeatherRequest {
	lat: number;
	lon: number;
	tempUnit: TemperatureUnit;
	windUnit: WindUnit;
	precipUnit: PrecipitationUnit;
}

/** The cache key for a request: coordinates rounded to ~10 m (any finer is
 * meaningless for a forecast, and it keeps two hand-typed near-identical
 * locations on one request) plus the units. */
export function weatherKey(req: WeatherRequest): string {
	return [
		req.lat.toFixed(4),
		req.lon.toFixed(4),
		req.tempUnit,
		req.windUnit,
		req.precipUnit,
	].join("|");
}

/** The forecast URL for a request. Exported for testing — it is the one place
 * that decides exactly which fields leave the vault. */
export function forecastUrl(req: WeatherRequest): string {
	const params = new URLSearchParams({
		latitude: String(req.lat),
		longitude: String(req.lon),
		current: [
			"temperature_2m",
			"apparent_temperature",
			"relative_humidity_2m",
			"is_day",
			"precipitation",
			"weather_code",
			"cloud_cover",
			"surface_pressure",
			"wind_speed_10m",
			"wind_direction_10m",
			"wind_gusts_10m",
		].join(","),
		hourly: [
			"temperature_2m",
			"apparent_temperature",
			"relative_humidity_2m",
			"weather_code",
			"precipitation",
			"precipitation_probability",
			"wind_speed_10m",
			"wind_direction_10m",
			"uv_index",
			"is_day",
		].join(","),
		daily: [
			"weather_code",
			"temperature_2m_max",
			"temperature_2m_min",
			"sunrise",
			"sunset",
			"precipitation_sum",
			"precipitation_probability_max",
			"wind_speed_10m_max",
			"uv_index_max",
		].join(","),
		timezone: "auto",
		forecast_days: String(FORECAST_DAYS),
		temperature_unit: req.tempUnit === "f" ? "fahrenheit" : "celsius",
		wind_speed_unit: req.windUnit,
		precipitation_unit: req.precipUnit === "inch" ? "inch" : "mm",
	});
	return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

interface CacheEntry {
	snapshot: WeatherSnapshot | null;
	inflight: Promise<WeatherSnapshot | null> | null;
}

const cache = new Map<string, CacheEntry>();

/** The last-fetched snapshot for a request (possibly stale), or null if none
 * was ever loaded. */
export function cachedWeather(req: WeatherRequest): WeatherSnapshot | null {
	return cache.get(weatherKey(req))?.snapshot ?? null;
}

/**
 * Return a forecast, fetching only when the cache is missing or older than
 * `ttlMs`. Concurrent callers for the same request share one in-flight fetch.
 * Never throws: on failure it returns whatever was cached (possibly null).
 *
 * When `disabled` is true (the "disable external calls" setting) no request is
 * made — only an already-cached snapshot, if any, is returned. Set `force` to
 * bypass the freshness check for an explicit manual refresh.
 */
export async function loadWeather(
	req: WeatherRequest,
	opts: { ttlMs: number; disabled?: boolean; force?: boolean } = { ttlMs: 0 },
): Promise<WeatherSnapshot | null> {
	const key = weatherKey(req);
	let entry = cache.get(key);
	if (!entry) {
		entry = { snapshot: null, inflight: null };
		cache.set(key, entry);
	}
	if (opts.disabled) return entry.snapshot;
	const fresh = entry.snapshot && Date.now() - entry.snapshot.fetched < opts.ttlMs;
	if (fresh && !opts.force) return entry.snapshot;
	if (entry.inflight) return entry.inflight;

	const current = entry;
	current.inflight = (async () => {
		try {
			const res = await requestUrl({ url: forecastUrl(req) });
			const parsed = parseForecast(res.json, Date.now());
			// Keep the prior snapshot when a response is unparseable.
			if (parsed) current.snapshot = parsed;
			return current.snapshot;
		} catch {
			// Offline or blocked — keep whatever we had.
			return current.snapshot;
		} finally {
			current.inflight = null;
		}
	})();
	return current.inflight;
}

/** Drop cached data so the next load refetches. Used when a card's place or
 * units change. */
export function forgetWeather(req: WeatherRequest): void {
	cache.delete(weatherKey(req));
}

// ---- Geocoding ----------------------------------------------------------

/** One match from the place search, ready to be stored as a `WeatherPlace`. */
export interface GeoResult {
	name: string;
	/** Admin area and country, joined for display; "" when the API gives none. */
	region: string;
	lat: number;
	lon: number;
	timezone: string;
}

/** Shape of the bits of a geocoding response we read. */
interface RawGeo {
	results?: unknown;
}

/** Normalise a decoded geocoding response into matches. Pure; a body with no
 * `results` (which is what "no matches" looks like) yields an empty list. */
export function parsePlaces(json: unknown): GeoResult[] {
	if (!json || typeof json !== "object") return [];
	const results = (json as RawGeo).results;
	if (!Array.isArray(results)) return [];
	const out: GeoResult[] = [];
	for (const entry of results) {
		if (!entry || typeof entry !== "object") continue;
		const row = entry as Record<string, unknown>;
		const lat = num(row.latitude);
		const lon = num(row.longitude);
		const name = str(row.name);
		if (lat === null || lon === null || !name) continue;
		// admin1 is the state/region, country the nation; either may be absent.
		const region = [str(row.admin1), str(row.country)].filter(Boolean).join(", ");
		out.push({ name, region, lat, lon, timezone: str(row.timezone) });
	}
	return out;
}

// ---- Packing a place into one string ------------------------------------

/**
 * A place, packed for somewhere that only has a string to store it in — the
 * background config, whose `value` field is already a colour, a vault path or a
 * URL depending on the kind, and which is copied around (per dashboard, through
 * layout export/import) as a flat record.
 *
 * The format is `lat,lon[,name]`. The name goes last and may itself contain
 * commas ("Praha, Czechia"), so the parser takes the first two fields as
 * numbers and the whole remainder as the name.
 */
export function formatPlaceValue(place: WeatherPlace): string {
	// Four decimals is ~10 m: past the point a forecast distinguishes, and it
	// keeps the stored value short and readable.
	const head = `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
	const name = place.name.trim();
	return name ? `${head},${name}` : head;
}

/** Unpack a place written by {@link formatPlaceValue}. Returns null for
 * anything that isn't one — an empty value, a leftover colour from a previous
 * background kind, coordinates off the globe. */
export function parsePlaceValue(value: string): WeatherPlace | null {
	const parts = value.split(",");
	if (parts.length < 2) return null;
	const lat = Number(parts[0]);
	const lon = Number(parts[1]);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
	const name = parts.slice(2).join(",").trim();
	return { name, lat, lon };
}

/**
 * Look a place name up in Open-Meteo's key-less geocoder. Used only from the
 * card editor, when the user asks for it — never during a render.
 *
 * Never throws: an empty query, a disabled-external-calls setting, or a failed
 * request all return an empty list, and the editor says it found nothing.
 */
export async function searchPlaces(
	query: string,
	opts: { disabled?: boolean; language?: string } = {},
): Promise<GeoResult[]> {
	const name = query.trim();
	if (!name || opts.disabled) return [];
	const params = new URLSearchParams({
		name,
		count: String(GEOCODING_LIMIT),
		format: "json",
	});
	if (opts.language) params.set("language", opts.language);
	try {
		const res = await requestUrl({ url: `${GEOCODING_ENDPOINT}?${params.toString()}` });
		return parsePlaces(res.json);
	} catch {
		return [];
	}
}
