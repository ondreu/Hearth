import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, retuneBackground } from "../src/types";

/**
 * Opacity and blur mean different things to a photo, which is dimmed until text
 * reads over it, and to a drawn backdrop, which is already calm. A switch
 * between the two families moves them once; the sliders do the rest.
 */
describe("retuneBackground", () => {
	it("starts Hearth's own wallpaper unblurred and barely dimmed", () => {
		expect(DEFAULT_SETTINGS.backgroundOpacity).toBe(0.8);
		expect(DEFAULT_SETTINGS.backgroundBlur).toBe(0);
	});

	it("lifts a photo's dimming off the drawn wallpaper", () => {
		expect(retuneBackground("image", "default", { opacity: 0.35, blur: 2 })).toEqual({
			opacity: 0.8,
			blur: 0,
		});
	});

	it("keeps an opacity already chosen for a drawn backdrop", () => {
		expect(retuneBackground("weather", "default", { opacity: 0.6, blur: 0 })).toEqual({
			opacity: 0.6,
			blur: 0,
		});
	});

	it("dims and softens a photo arriving from a drawn backdrop", () => {
		expect(retuneBackground("default", "image", { opacity: 0.8, blur: 0 })).toEqual({
			opacity: 0.35,
			blur: 2,
		});
		expect(retuneBackground("weather", "url", { opacity: 1, blur: 0 })).toEqual({
			opacity: 0.35,
			blur: 2,
		});
	});

	it("leaves a photo's own tuning alone when switching between photos", () => {
		expect(retuneBackground("image", "url", { opacity: 0.9, blur: 0 })).toEqual({
			opacity: 0.9,
			blur: 0,
		});
	});

	it("still lifts the weather sky, and leaves its blur", () => {
		expect(retuneBackground("image", "weather", { opacity: 0.35, blur: 2 })).toEqual({
			opacity: 1,
			blur: 2,
		});
	});

	it("leaves a flat colour as it is", () => {
		expect(retuneBackground("default", "color", { opacity: 0.8, blur: 0 })).toEqual({
			opacity: 0.8,
			blur: 0,
		});
	});
});
