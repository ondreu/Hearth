import { describe, expect, it } from "vitest";
import {
	daySummary,
	detailMetrics,
	formatUv,
	precipText,
	resolveConfig,
} from "../src/cards/weather";
import { parseForecast, type WeatherDay, type WeatherHour, type WeatherSnapshot } from "../src/weather";

/**
 * The full-forecast dialog's pure half: what it lists, and how it words a
 * reading. The drawing itself is DOM and stays untested, like every other
 * card's, but the promise the dialog makes — *every* reading, whatever the card
 * is configured to show — is a list, and lists can be pinned.
 */

/** A card with everything switched off: the dialog must ignore all of it. */
const OFF = resolveConfig({
	showFeelsLike: false,
	showHighLow: false,
	showHumidity: false,
	showWind: false,
	showPrecip: false,
	showUv: false,
	showPressure: false,
	showSun: false,
	hourFormat: "24",
});

function snapshot(): WeatherSnapshot {
	const parsed = parseForecast(
		{
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
				time: ["2026-08-08T14:00"],
				temperature_2m: [21.4],
				uv_index: [3.8],
			},
			daily: {
				time: ["2026-08-08"],
				weather_code: [61],
				temperature_2m_max: [24.1],
				temperature_2m_min: [13.2],
				sunrise: ["2026-08-08T05:39"],
				sunset: ["2026-08-08T20:30"],
				precipitation_sum: [4.6],
				precipitation_probability_max: [75],
				wind_speed_10m_max: [22.1],
				uv_index_max: [4.4],
			},
		},
		1_000,
	);
	if (!parsed) throw new Error("fixture failed to parse");
	return parsed;
}

/** An hourly entry with only the fields a case is about. */
function hour(overrides: Partial<WeatherHour> = {}): WeatherHour {
	return {
		time: "2026-08-08T15:00",
		temp: 22,
		apparent: 21,
		humidity: 70,
		code: 61,
		isDay: true,
		precipChance: null,
		precip: null,
		windSpeed: 14,
		windDir: 255,
		uv: 2.1,
		...overrides,
	};
}

describe("detailMetrics", () => {
	it("lists every current reading, whatever the card was told to show", () => {
		const values = new Map(detailMetrics(snapshot(), OFF).map((m) => [m.label, m.value]));
		expect([...values.keys()]).toEqual([
			"Feels like",
			"Humidity",
			"Wind",
			"Gusts",
			"Chance of rain",
			"Rain this hour",
			"Cloud cover",
			"Pressure",
			"UV",
			"Sunrise",
			"Sunset",
		]);
		expect(values.get("Feels like")).toBe("20°C");
		expect(values.get("Humidity")).toBe("62%");
		expect(values.get("Wind")).toBe("13 km/h SW");
		expect(values.get("Gusts")).toBe("25 km/h");
		// The chance is today's; the amount is what has already fallen.
		expect(values.get("Chance of rain")).toBe("75%");
		expect(values.get("Rain this hour")).toBe("0.2 mm");
		expect(values.get("Cloud cover")).toBe("88%");
		expect(values.get("Pressure")).toBe("1011 hPa");
		// From the hourly series at 14:00, not the day's maximum of 4.4.
		expect(values.get("UV")).toBe("4");
		expect(values.get("Sunrise")).toBe("05:39");
		expect(values.get("Sunset")).toBe("20:30");
	});

	it("shows a dash for a reading the response left out, never a gap", () => {
		const snap = snapshot();
		snap.now.pressure = null;
		snap.now.gust = null;
		snap.now.cloudCover = null;
		const values = new Map(detailMetrics(snap, OFF).map((m) => [m.label, m.value]));
		expect(values.get("Pressure")).toBe("—");
		expect(values.get("Gusts")).toBe("—");
		expect(values.get("Cloud cover")).toBe("—");
	});
});

describe("daySummary", () => {
	const day = (overrides: Partial<WeatherDay> = {}): WeatherDay => ({
		date: "2026-08-08",
		code: 61,
		max: 24.1,
		min: 13.2,
		sunrise: "2026-08-08T05:39",
		sunset: "2026-08-08T20:30",
		precipChance: 75,
		precipSum: 4.6,
		uvMax: 4.4,
		windMax: 22.1,
		...overrides,
	});

	it("says what the whole day adds up to", () => {
		expect(daySummary(day(), OFF)).toEqual([
			"H 24° · L 13°",
			"Chance of rain 75%",
			"Total rain 4.6 mm",
			"Strongest wind 22 km/h",
			"UV max 4",
			"05:39 – 20:30",
		]);
	});

	it("leaves out what the day doesn't have", () => {
		expect(
			daySummary(
				day({ precipChance: null, precipSum: null, windMax: null, uvMax: null, sunrise: "", sunset: "" }),
				OFF,
			),
		).toEqual(["H 24° · L 13°"]);
	});

	it("keeps a dry day's total out of the line rather than printing 0", () => {
		expect(daySummary(day({ precipSum: 0 }), OFF)).not.toContain("Total rain 0.0 mm");
	});
});

describe("precipText", () => {
	it("pairs the chance with the amount", () => {
		expect(precipText(hour({ precipChance: 70, precip: 1.4 }), OFF)).toBe("70% · 1.4 mm");
	});

	it("drops a dry hour's amount, which the chance already carries", () => {
		expect(precipText(hour({ precipChance: 10, precip: 0 }), OFF)).toBe("10%");
	});

	it("falls back to whichever side the response has", () => {
		expect(precipText(hour({ precipChance: null, precip: 2 }), OFF)).toBe("2.0 mm");
		expect(precipText(hour({ precipChance: 40, precip: null }), OFF)).toBe("40%");
		expect(precipText(hour(), OFF)).toBe("—");
	});
});

describe("formatUv", () => {
	it("rounds to the whole index the scale is read in", () => {
		expect(formatUv(4.4)).toBe("4");
		expect(formatUv(0)).toBe("0");
		expect(formatUv(null)).toBe("—");
	});
});
