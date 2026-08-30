import { describe, expect, it } from "vitest";
import {
	compassIndex,
	forecastUrl,
	formatHour,
	formatPercent,
	formatPrecip,
	formatTemp,
	formatDayDate,
	formatWeekday,
	formatWind,
	hoursOn,
	parseForecast,
	parsePlaces,
	today,
	upcomingDays,
	upcomingHours,
	weatherGroup,
	weatherIcon,
	weatherKey,
	weatherLabelKey,
	type WeatherSnapshot,
} from "../src/weather";

/**
 * The weather card's pure half: WMO code classification, response parsing,
 * the "what is still ahead" slicing, and formatting. The fetching itself is
 * network + module cache + wall clock and stays untested, like currency.ts —
 * but everything it hands the card is checked here.
 */

/** A forecast response in the shape Open-Meteo returns under `timezone=auto`:
 * local wall clock throughout, no offsets. */
function response(overrides: Record<string, unknown> = {}): unknown {
	return {
		timezone: "Europe/Prague",
		current: {
			time: "2026-08-08T14:30",
			temperature_2m: 21.4,
			apparent_temperature: 19.8,
			relative_humidity_2m: 62,
			is_day: 1,
			precipitation: 0.2,
			weather_code: 3,
			cloud_cover: 88,
			surface_pressure: 1011.3,
			wind_speed_10m: 12.6,
			wind_direction_10m: 240,
			wind_gusts_10m: 25.2,
		},
		hourly: {
			time: [
				"2026-08-08T13:00",
				"2026-08-08T14:00",
				"2026-08-08T15:00",
				"2026-08-08T16:00",
			],
			temperature_2m: [20.1, 21.4, 22.0, 21.2],
			apparent_temperature: [18.9, 19.8, 20.4, 19.6],
			relative_humidity_2m: [65, 62, 71, 78],
			weather_code: [2, 3, 61, 61],
			precipitation: [0, 0.2, 1.4, 0.8],
			precipitation_probability: [10, 20, 70, 65],
			wind_speed_10m: [11.2, 12.6, 14.0, 13.1],
			wind_direction_10m: [230, 240, 255, 260],
			uv_index: [4.2, 3.8, 2.1, 1.4],
			is_day: [1, 1, 1, 1],
		},
		daily: {
			time: ["2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"],
			weather_code: [1, 61, 3, 0],
			temperature_2m_max: [26.2, 24.1, 22.8, 27.5],
			temperature_2m_min: [14.0, 13.2, 12.6, 15.1],
			sunrise: [
				"2026-08-07T05:38",
				"2026-08-08T05:39",
				"2026-08-09T05:41",
				"2026-08-10T05:42",
			],
			sunset: [
				"2026-08-07T20:32",
				"2026-08-08T20:30",
				"2026-08-09T20:28",
				"2026-08-10T20:27",
			],
			precipitation_sum: [0, 4.6, 1.2, 0],
			precipitation_probability_max: [15, 75, 40, 5],
			wind_speed_10m_max: [18.4, 22.1, 16.9, 12.0],
			uv_index_max: [6.1, 4.4, 5.0, 7.2],
		},
		...overrides,
	};
}

/** The parsed fixture, with a fixed fetch stamp. */
function snapshot(overrides: Record<string, unknown> = {}): WeatherSnapshot {
	const parsed = parseForecast(response(overrides), 1_000);
	if (!parsed) throw new Error("fixture failed to parse");
	return parsed;
}

describe("weatherGroup", () => {
	it("buckets every documented WMO code", () => {
		expect(weatherGroup(0)).toBe("clear");
		expect(weatherGroup(1)).toBe("partly");
		expect(weatherGroup(2)).toBe("partly");
		expect(weatherGroup(3)).toBe("cloudy");
		expect(weatherGroup(45)).toBe("fog");
		expect(weatherGroup(48)).toBe("fog");
		expect(weatherGroup(51)).toBe("drizzle");
		expect(weatherGroup(57)).toBe("drizzle");
		expect(weatherGroup(61)).toBe("rain");
		expect(weatherGroup(67)).toBe("rain");
		expect(weatherGroup(80)).toBe("rain");
		expect(weatherGroup(82)).toBe("rain");
		expect(weatherGroup(71)).toBe("snow");
		expect(weatherGroup(77)).toBe("snow");
		expect(weatherGroup(85)).toBe("snow");
		expect(weatherGroup(86)).toBe("snow");
		expect(weatherGroup(95)).toBe("thunder");
		expect(weatherGroup(99)).toBe("thunder");
	});

	it("falls back to a neutral sky for a code it doesn't know", () => {
		// The API is free to add codes; an unknown one must not blank the card.
		expect(weatherGroup(4)).toBe("cloudy");
		expect(weatherGroup(-1)).toBe("cloudy");
		expect(weatherGroup(1000)).toBe("cloudy");
	});
});

describe("weatherLabelKey", () => {
	it("distinguishes intensities that share a glyph", () => {
		expect(weatherLabelKey(61)).toBe("rain");
		expect(weatherLabelKey(65)).toBe("heavyRain");
		expect(weatherLabelKey(71)).toBe("snow");
		expect(weatherLabelKey(75)).toBe("heavySnow");
		expect(weatherLabelKey(80)).toBe("showers");
		expect(weatherLabelKey(96)).toBe("thunderstormHail");
	});

	it("labels an unrecognised code rather than returning nothing", () => {
		expect(weatherLabelKey(4)).toBe("unknown");
	});
});

describe("weatherIcon", () => {
	it("swaps in the night glyph only where the sky itself is visible", () => {
		expect(weatherIcon(0, true)).toBe("sun");
		expect(weatherIcon(0, false)).toBe("moon");
		expect(weatherIcon(2, true)).toBe("cloud-sun");
		expect(weatherIcon(2, false)).toBe("cloud-moon");
		// Under a full cloud deck there is no sun or moon to draw either way.
		expect(weatherIcon(3, true)).toBe(weatherIcon(3, false));
		expect(weatherIcon(61, true)).toBe(weatherIcon(61, false));
	});
});

describe("parseForecast", () => {
	it("normalises a full response", () => {
		const snap = snapshot();
		expect(snap.timezone).toBe("Europe/Prague");
		expect(snap.fetched).toBe(1_000);
		expect(snap.now).toMatchObject({
			time: "2026-08-08T14:30",
			temp: 21.4,
			apparent: 19.8,
			humidity: 62,
			precip: 0.2,
			pressure: 1011.3,
			windSpeed: 12.6,
			windDir: 240,
			gust: 25.2,
			cloudCover: 88,
			code: 3,
			isDay: true,
		});
		expect(snap.hourly).toHaveLength(4);
		expect(snap.daily).toHaveLength(4);
		expect(snap.daily[1]).toEqual({
			date: "2026-08-08",
			code: 61,
			max: 24.1,
			min: 13.2,
			sunrise: "2026-08-08T05:39",
			sunset: "2026-08-08T20:30",
			precipChance: 75,
			precipSum: 4.6,
			windMax: 22.1,
			uvMax: 4.4,
		});
	});

	it("keeps every hourly series the full forecast reads", () => {
		// The card paints three of these; the forecast dialog shows them all, so
		// a series quietly dropped here empties a column there.
		expect(snapshot().hourly[1]).toEqual({
			time: "2026-08-08T14:00",
			temp: 21.4,
			apparent: 19.8,
			humidity: 62,
			code: 3,
			isDay: true,
			precip: 0.2,
			precipChance: 20,
			windSpeed: 12.6,
			windDir: 240,
			uv: 3.8,
		});
	});

	it("reads the UV index from the hourly series at the current hour", () => {
		// The `current` block carries no UV, so 14:30 has to resolve to the
		// 14:00 hourly entry — not the first one, and not the daily maximum.
		expect(snapshot().now.uv).toBe(3.8);
	});

	it("leaves UV null when the hourly series doesn't cover the current hour", () => {
		const snap = snapshot({
			hourly: { time: ["2026-08-09T00:00"], uv_index: [1.0] },
		});
		expect(snap.now.uv).toBeNull();
	});

	it("reads is_day as the 1/0 flag it is", () => {
		expect(snapshot({ current: { ...(response() as { current: object }).current, is_day: 0 } }).now.isDay).toBe(
			false,
		);
	});

	it("turns gaps in a series into nulls rather than NaN", () => {
		const base = response() as { current: Record<string, unknown> };
		const snap = snapshot({
			current: { ...base.current, temperature_2m: null, wind_speed_10m: "12" },
		});
		expect(snap.now.temp).toBeNull();
		expect(snap.now.windSpeed).toBeNull();
	});

	it("falls back to mean-sea-level pressure when surface pressure is absent", () => {
		const base = response() as { current: Record<string, unknown> };
		const current: Record<string, unknown> = { ...base.current, pressure_msl: 1015.5 };
		delete current.surface_pressure;
		expect(snapshot({ current }).now.pressure).toBe(1015.5);
	});

	it("survives a response with no hourly or daily block", () => {
		const base = response() as { current: Record<string, unknown> };
		const snap = parseForecast({ current: base.current }, 1);
		expect(snap).not.toBeNull();
		expect(snap!.hourly).toEqual([]);
		expect(snap!.daily).toEqual([]);
		expect(snap!.timezone).toBe("auto");
	});

	it("rejects anything that isn't a forecast", () => {
		// An API error body, a truncated response, or plain nonsense — all of
		// which must leave the last good snapshot in place rather than replace it.
		expect(parseForecast(null, 1)).toBeNull();
		expect(parseForecast("not json", 1)).toBeNull();
		expect(parseForecast({ error: true, reason: "bad latitude" }, 1)).toBeNull();
		expect(parseForecast({ current: {} }, 1)).toBeNull();
	});
});

describe("upcomingHours", () => {
	it("starts at the hour the observation falls in, not at the series start", () => {
		// 14:30 belongs to the 14:00 hour; 13:00 is behind us.
		const hours = upcomingHours(snapshot(), 3);
		expect(hours.map((h) => h.time)).toEqual([
			"2026-08-08T14:00",
			"2026-08-08T15:00",
			"2026-08-08T16:00",
		]);
	});

	it("returns at most the requested count, and nothing for a count of zero", () => {
		expect(upcomingHours(snapshot(), 2)).toHaveLength(2);
		expect(upcomingHours(snapshot(), 0)).toEqual([]);
		// Asking for more hours than the API returned is not an error.
		expect(upcomingHours(snapshot(), 99)).toHaveLength(3);
	});

	it("returns nothing when the whole series is already behind us", () => {
		const snap = snapshot({
			current: {
				...(response() as { current: object }).current,
				time: "2026-08-09T09:00",
			},
		});
		expect(upcomingHours(snap, 6)).toEqual([]);
	});
});

describe("upcomingDays", () => {
	it("skips yesterday and starts at today", () => {
		expect(upcomingDays(snapshot(), 2).map((d) => d.date)).toEqual([
			"2026-08-08",
			"2026-08-09",
		]);
	});

	it("returns nothing for a count of zero", () => {
		expect(upcomingDays(snapshot(), 0)).toEqual([]);
	});
});

describe("today", () => {
	it("finds the day matching the observation, not simply the first one", () => {
		expect(today(snapshot())?.date).toBe("2026-08-08");
	});

	it("falls back to the first day when the series doesn't reach today", () => {
		const snap = snapshot({
			daily: { time: ["2026-08-11"], weather_code: [0] },
		});
		expect(today(snap)?.date).toBe("2026-08-11");
	});

	it("is null when there is no daily series at all", () => {
		const base = response() as { current: Record<string, unknown> };
		expect(today(parseForecast({ current: base.current }, 1)!)).toBeNull();
	});
});

describe("hoursOn", () => {
	it("gives today only the hours still ahead", () => {
		// The observation is 14:30, so 13:00 has been and gone.
		expect(hoursOn(snapshot(), "2026-08-08").map((h) => h.time)).toEqual([
			"2026-08-08T14:00",
			"2026-08-08T15:00",
			"2026-08-08T16:00",
		]);
	});

	it("gives a later day every hour it has", () => {
		const snap = snapshot({
			hourly: {
				time: ["2026-08-08T14:00", "2026-08-09T00:00", "2026-08-09T01:00"],
				temperature_2m: [21.4, 15.0, 14.6],
			},
		});
		expect(hoursOn(snap, "2026-08-09").map((h) => h.time)).toEqual([
			"2026-08-09T00:00",
			"2026-08-09T01:00",
		]);
	});

	it("is empty for a day the series doesn't reach, or no day at all", () => {
		expect(hoursOn(snapshot(), "2026-08-20")).toEqual([]);
		expect(hoursOn(snapshot(), "")).toEqual([]);
	});
});

describe("formatDayDate", () => {
	it("prints the day and month a local date falls on", () => {
		// Locale-formatted, so assert on the parts rather than the exact string.
		const label = formatDayDate("2026-08-08");
		expect(label).toMatch(/8/);
		expect(label).toMatch(/aug/i);
	});

	it("is empty for anything that isn't a plain date", () => {
		expect(formatDayDate("2026-08-08T14:00")).toBe("");
		expect(formatDayDate("")).toBe("");
	});
});

describe("formatting", () => {
	it("rounds temperatures and can name the scale", () => {
		expect(formatTemp(21.4, "c")).toBe("21°");
		expect(formatTemp(21.6, "c")).toBe("22°");
		expect(formatTemp(-0.4, "c")).toBe("0°");
		expect(formatTemp(70.2, "f", true)).toBe("70°F");
		expect(formatTemp(21, "c", true)).toBe("21°C");
	});

	it("keeps a decimal for m/s, where whole units are too coarse", () => {
		expect(formatWind(12.64, "kmh")).toBe("13 km/h");
		expect(formatWind(3.42, "ms")).toBe("3.4 m/s");
		expect(formatWind(8.6, "mph")).toBe("9 mph");
		expect(formatWind(5.2, "kn")).toBe("5 kn");
	});

	it("scales precipitation precision to the unit and the amount", () => {
		expect(formatPrecip(0.24, "inch")).toBe("0.24 in");
		expect(formatPrecip(2.35, "mm")).toBe("2.4 mm");
		expect(formatPrecip(12.4, "mm")).toBe("12 mm");
	});

	it("renders a missing reading as a dash rather than NaN", () => {
		expect(formatTemp(null, "c")).toBe("—");
		expect(formatWind(null, "kmh")).toBe("—");
		expect(formatPrecip(null, "mm")).toBe("—");
		expect(formatPercent(null)).toBe("—");
	});

	it("rounds percentages", () => {
		expect(formatPercent(62.4)).toBe("62%");
		expect(formatPercent(0)).toBe("0%");
	});
});

describe("compassIndex", () => {
	it("maps a bearing to its eighth of the compass", () => {
		expect(compassIndex(0)).toBe(0); // N
		expect(compassIndex(45)).toBe(1); // NE
		expect(compassIndex(90)).toBe(2); // E
		expect(compassIndex(180)).toBe(4); // S
		expect(compassIndex(270)).toBe(6); // W
		expect(compassIndex(315)).toBe(7); // NW
	});

	it("rounds to the nearest sector and wraps around north", () => {
		expect(compassIndex(20)).toBe(0);
		expect(compassIndex(25)).toBe(1);
		expect(compassIndex(350)).toBe(0);
		expect(compassIndex(360)).toBe(0);
		// Bearings outside 0–360 are normalised rather than dropped.
		expect(compassIndex(-90)).toBe(6);
		expect(compassIndex(450)).toBe(2);
	});

	it("is null for a missing bearing", () => {
		expect(compassIndex(null)).toBeNull();
	});
});

describe("formatHour", () => {
	it("prints the location's own wall clock, forced to 24 hours", () => {
		expect(formatHour("2026-08-08T14:00", false)).toBe("14:00");
		expect(formatHour("2026-08-08T05:39", false)).toBe("05:39");
	});

	it("starts the forced 24-hour day at 00, not 24", () => {
		// `hour12: false` picks the h24 cycle on some ICU builds, which prints
		// midnight as "24:15" — the hour a night-shift reader is most likely to
		// be looking at the card. Pinned because it varies by platform.
		expect(formatHour("2026-08-08T00:15", false)).toBe("00:15");
		expect(formatHour("2026-08-08T00:00", false)).toBe("00:00");
	});

	it("forces a 12-hour clock when asked", () => {
		// Intl inserts a narrow no-break space before the day period in some
		// versions, so compare on the parts that matter.
		const noon = formatHour("2026-08-08T12:30", true);
		expect(noon).toMatch(/12:30/);
		expect(noon).toMatch(/PM/i);
		expect(formatHour("2026-08-08T00:05", true)).toMatch(/12:05/);
	});

	it("is empty for a string that carries no time", () => {
		expect(formatHour("2026-08-08", false)).toBe("");
		expect(formatHour("", false)).toBe("");
	});
});

describe("formatWeekday", () => {
	it("names the day a local date falls on", () => {
		// 2026-08-08 is a Saturday.
		expect(formatWeekday("2026-08-08")).toBe("Sat");
		expect(formatWeekday("2026-08-08", "long")).toBe("Saturday");
	});

	it("is empty for anything that isn't a plain date", () => {
		expect(formatWeekday("2026-08-08T14:00")).toBe("");
		expect(formatWeekday("")).toBe("");
	});
});

describe("weatherKey", () => {
	const base = {
		lat: 50.0755,
		lon: 14.4378,
		tempUnit: "c",
		windUnit: "kmh",
		precipUnit: "mm",
	} as const;

	it("shares one cache entry between coordinates that round together", () => {
		// ~10 m apart: the same forecast, and one request instead of two.
		expect(weatherKey({ ...base, lat: 50.07551 })).toBe(weatherKey(base));
	});

	it("separates different units, which are different responses", () => {
		expect(weatherKey({ ...base, tempUnit: "f" })).not.toBe(weatherKey(base));
		expect(weatherKey({ ...base, windUnit: "mph" })).not.toBe(weatherKey(base));
		expect(weatherKey({ ...base, precipUnit: "inch" })).not.toBe(weatherKey(base));
		expect(weatherKey({ ...base, lon: 15 })).not.toBe(weatherKey(base));
	});
});

describe("forecastUrl", () => {
	const url = forecastUrl({
		lat: 50.08,
		lon: 14.44,
		tempUnit: "f",
		windUnit: "mph",
		precipUnit: "inch",
	});

	it("asks Open-Meteo to do the unit conversion", () => {
		expect(url).toContain("temperature_unit=fahrenheit");
		expect(url).toContain("wind_speed_unit=mph");
		expect(url).toContain("precipitation_unit=inch");
	});

	it("asks for times in the location's own zone", () => {
		expect(url).toContain("timezone=auto");
	});

	it("sends the coordinates and nothing else identifying", () => {
		const query = new URLSearchParams(url.split("?")[1]);
		expect(query.get("latitude")).toBe("50.08");
		expect(query.get("longitude")).toBe("14.44");
		expect([...query.keys()].sort()).toEqual([
			"current",
			"daily",
			"forecast_days",
			"hourly",
			"latitude",
			"longitude",
			"precipitation_unit",
			"temperature_unit",
			"timezone",
			"wind_speed_unit",
		]);
	});

	it("requests the fields every style draws", () => {
		const query = new URLSearchParams(url.split("?")[1]);
		expect(query.get("current")?.split(",")).toContain("weather_code");
		expect(query.get("current")?.split(",")).toContain("is_day");
		expect(query.get("hourly")?.split(",")).toContain("uv_index");
		expect(query.get("daily")?.split(",")).toContain("sunrise");
	});

	it("requests the series only the full forecast reads", () => {
		// The card never draws these; the dialog behind a click does, and it has
		// no request of its own — it shows whatever this one brought back.
		const query = new URLSearchParams(url.split("?")[1]);
		const hourly = query.get("hourly")?.split(",");
		expect(hourly).toContain("apparent_temperature");
		expect(hourly).toContain("relative_humidity_2m");
		expect(hourly).toContain("precipitation");
		expect(hourly).toContain("wind_speed_10m");
		expect(hourly).toContain("wind_direction_10m");
		const daily = query.get("daily")?.split(",");
		expect(daily).toContain("precipitation_sum");
		expect(daily).toContain("wind_speed_10m_max");
	});
});

describe("parsePlaces", () => {
	it("normalises geocoder matches and joins the region label", () => {
		expect(
			parsePlaces({
				results: [
					{
						name: "Prague",
						latitude: 50.0755,
						longitude: 14.4378,
						admin1: "Praha",
						country: "Czechia",
						timezone: "Europe/Prague",
					},
				],
			}),
		).toEqual([
			{
				name: "Prague",
				region: "Praha, Czechia",
				lat: 50.0755,
				lon: 14.4378,
				timezone: "Europe/Prague",
			},
		]);
	});

	it("copes with matches missing an admin area or a country", () => {
		const [only] = parsePlaces({
			results: [{ name: "Nowhere", latitude: 1, longitude: 2, country: "Iceland" }],
		});
		expect(only.region).toBe("Iceland");
		expect(only.timezone).toBe("");
	});

	it("drops entries with no usable coordinates or name", () => {
		expect(
			parsePlaces({
				results: [
					{ name: "No coords" },
					{ latitude: 1, longitude: 2 },
					{ name: "Bad", latitude: "1", longitude: 2 },
					null,
				],
			}),
		).toEqual([]);
	});

	it("treats a response with no results as no matches", () => {
		// Open-Meteo omits `results` entirely rather than sending an empty array.
		expect(parsePlaces({ generationtime_ms: 0.4 })).toEqual([]);
		expect(parsePlaces(null)).toEqual([]);
		expect(parsePlaces("nope")).toEqual([]);
	});
});
