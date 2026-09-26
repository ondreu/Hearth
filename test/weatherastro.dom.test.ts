/**
 * @vitest-environment jsdom
 *
 * The moon and daylight styles, actually drawn — under jsdom with Obsidian's
 * DOM helpers as its type definitions describe them (test/support).
 *
 * The drawing is otherwise untested, and that is how 3.1.1's moon card shipped
 * unable to render at all: it asked `createSvg` for two classes in one string,
 * which Obsidian passes to `classList.add()` and the DOM rejects. A preview
 * harness that split the string on spaces drew it fine. These cases draw every
 * layout of both styles, day and night, and fail on exactly that.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { AstroOptions } from "../src/cards/weatherastro";
import type { WeatherSnapshot } from "../src/weather";

let paintMoon: typeof import("../src/cards/weatherastro").paintMoon;
let paintDaylight: typeof import("../src/cards/weatherastro").paintDaylight;

beforeAll(async () => {
	installObsidianDom();
	// jsdom has neither; the daylight style asks both.
	window.matchMedia ??= ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
	(window as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class {
		observe(): void {}
		disconnect(): void {}
	};
	({ paintMoon, paintDaylight } = await import("../src/cards/weatherastro"));
});

function snapshot(isDay: boolean): WeatherSnapshot {
	return {
		now: {
			time: "2026-09-26T21:30",
			temp: 17,
			apparent: 16,
			humidity: 60,
			precip: 0,
			pressure: 1012,
			windSpeed: 8,
			windDir: 200,
			gust: 14,
			cloudCover: 30,
			code: 0,
			isDay,
			uv: 0,
		},
		hourly: [],
		daily: [
			{
				date: "2026-09-26",
				code: 0,
				max: 19,
				min: 9,
				sunrise: "2026-09-26T06:52",
				sunset: "2026-09-26T18:49",
				precipChance: 0,
				precipSum: 0,
				uvMax: 3,
				windMax: 10,
			},
		],
		timezone: "Europe/Prague",
		utcOffset: 7200,
		fetched: Date.UTC(2026, 8, 26, 19, 30),
	};
}

function options(extra: Partial<AstroOptions> = {}): AstroOptions {
	return {
		lat: 50.08,
		lon: 14.44,
		place: "Prague",
		hour12: false,
		animate: true,
		intro: true,
		clean: false,
		now: { icon: "moon", temp: "17°" },
		updated: "Updated 21:30",
		...extra,
	};
}

describe("drawing the moon", () => {
	it("draws the full layout: stars, the moon, the slider and the facts", () => {
		const wrap = document.body.createDiv("hearth-weather is-moon");
		expect(() => paintMoon(wrap, snapshot(false), options())).not.toThrow();
		const stars = wrap.querySelector("svg.hearth-moon-stars");
		expect(stars?.classList.contains("hearth-weather-stars")).toBe(true);
		expect(wrap.querySelector(".hearth-moon-lit")).not.toBeNull();
		expect(wrap.querySelectorAll(".hearth-moon-fact")).toHaveLength(4);
		expect(wrap.querySelector(".hearth-moon-slider-handle")).not.toBeNull();
	});

	it("draws the clean layout: the moon and the slider, nothing written", () => {
		const wrap = document.body.createDiv("hearth-weather is-moon");
		expect(() => paintMoon(wrap, snapshot(false), options({ clean: true }))).not.toThrow();
		expect(wrap.querySelector(".hearth-moon-lit")).not.toBeNull();
		// The same turning cookie behind the moon as the full layout's.
		expect(wrap.querySelector(".hearth-moon-shape-wrap .hearth-moon-shape")).not.toBeNull();
		expect(wrap.querySelector(".hearth-moon-slider")).not.toBeNull();
		expect(wrap.querySelector(".hearth-moon-name")).toBeNull();
		expect(wrap.querySelector(".hearth-moon-facts")).toBeNull();
	});
});

describe("drawing the sun's arc", () => {
	it("draws by night and by day without throwing", () => {
		for (const isDay of [false, true]) {
			const wrap = document.body.createDiv("hearth-weather is-daylight");
			expect(() => paintDaylight(wrap, snapshot(isDay), options({ intro: false }))).not.toThrow();
			expect(wrap.querySelector(".hearth-sun-arc")).not.toBeNull();
			expect(wrap.querySelector(".hearth-sun-body")).not.toBeNull();
		}
	});
});
