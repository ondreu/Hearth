/**
 * @vitest-environment jsdom
 *
 * The Expressive design, actually drawn: the flat sky and the weather glyphs,
 * for every condition by day and by night, under jsdom with Obsidian's DOM
 * helpers as its type definitions describe them (test/support). createSvg
 * there rejects two classes in one string exactly as Obsidian does — the
 * mistake that once left the moon card blank.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

let drawSky: typeof import("../src/sky").drawSky;
let skyGroupCode: typeof import("../src/sky").skyGroupCode;
let SKY_GROUPS: typeof import("../src/sky").SKY_GROUPS;
let drawWeatherIcon: typeof import("../src/weathericons").drawWeatherIcon;

beforeAll(async () => {
	installObsidianDom();
	({ drawSky, skyGroupCode, SKY_GROUPS } = await import("../src/sky"));
	({ drawWeatherIcon } = await import("../src/weathericons"));
});

describe("the flat sky", () => {
	it("draws every condition, day and night, on a card and on a board", () => {
		for (const group of SKY_GROUPS) {
			for (const isDay of [true, false]) {
				for (const spread of ["card", "board"] as const) {
					const host = document.body.createDiv();
					const sky = drawSky(host, {
						code: skyGroupCode(group),
						isDay,
						animate: true,
						spread,
						design: "expressive",
					});
					expect(sky.classList.contains("is-expressive")).toBe(true);
					// Every expressive sky stands on its hills.
					expect(sky.querySelectorAll(".hearth-weather-hills ellipse")).toHaveLength(3);
				}
			}
		}
	});

	it("leaves the classic sky as it was", () => {
		const sky = drawSky(document.body.createDiv(), { code: 0, isDay: true, animate: false });
		expect(sky.classList.contains("is-expressive")).toBe(false);
		expect(sky.querySelector(".hearth-weather-hills")).toBeNull();
	});
});

describe("the weather glyphs", () => {
	it("draw every condition, day and night, with and without the cookie", () => {
		for (const group of SKY_GROUPS) {
			for (const isDay of [true, false]) {
				for (const backdrop of [false, true]) {
					const icon = drawWeatherIcon(
						document.body.createDiv(),
						skyGroupCode(group),
						isDay,
						"hearth-weather-glyph",
						backdrop,
					);
					expect(icon.querySelector("svg")?.childElementCount).toBeGreaterThan(0);
					expect(icon.querySelector(".hearth-wx-backdrop") !== null).toBe(backdrop);
				}
			}
		}
	});
});
