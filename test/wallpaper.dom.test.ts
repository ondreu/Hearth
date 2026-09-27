/**
 * @vitest-environment jsdom
 *
 * Hearth's own wallpaper, actually drawn: both designs under jsdom with
 * Obsidian's DOM helpers as its type definitions describe them (test/support),
 * whose createSvg rejects two classes in one string exactly as Obsidian does.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { sanitizeDashboard } from "../src/layout";
import { DEFAULT_SETTINGS } from "../src/types";
import { installObsidianDom } from "./support/obsidian-dom";

let drawWallpaper: typeof import("../src/wallpaper").drawWallpaper;

beforeAll(async () => {
	installObsidianDom();
	({ drawWallpaper } = await import("../src/wallpaper"));
});

describe("the classic wallpaper", () => {
	it("draws the hills, the sun and the cabin in one sliced picture", () => {
		const host = document.body.createDiv();
		const wp = drawWallpaper(host, "classic");
		expect(wp.classList.contains("is-classic")).toBe(true);
		expect(wp.querySelectorAll(".hearth-wallpaper-ridge")).toHaveLength(5);
		expect(wp.querySelector(".hearth-wallpaper-sun")).not.toBeNull();
		expect(wp.querySelectorAll(".hearth-wallpaper-window")).toHaveLength(2);
		expect(wp.querySelector("svg")?.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
	});

	it("gives every drawing's glow an id of its own", () => {
		const host = document.body.createDiv();
		const a = drawWallpaper(host, "classic").querySelector("radialGradient")?.id;
		const b = drawWallpaper(host, "classic").querySelector("radialGradient")?.id;
		expect(a).toBeTruthy();
		expect(a).not.toBe(b);
		expect(document.querySelectorAll(`[fill="url(#${a})"]`)).toHaveLength(1);
	});

	it("comes out the same every time", () => {
		const host = document.body.createDiv();
		const strip = (el: HTMLElement): string => el.innerHTML.replace(/hearth-wallpaper-glow-\d+/g, "");
		expect(strip(drawWallpaper(host, "classic"))).toBe(strip(drawWallpaper(host, "classic")));
	});
});

describe("the expressive wallpaper", () => {
	it("gathers its shapes in the four corners", () => {
		const host = document.body.createDiv();
		const wp = drawWallpaper(host, "expressive");
		expect(wp.classList.contains("is-expressive")).toBe(true);
		const corners = Array.from(wp.querySelectorAll(".hearth-wallpaper-corner"));
		expect(corners.map((c) => Array.from(c.classList).find((k) => k.startsWith("is-")))).toEqual([
			"is-tl",
			"is-tr",
			"is-bl",
			"is-br",
		]);
		for (const c of corners) expect(c.childElementCount).toBeGreaterThan(0);
	});

	it("names parts only, leaving every colour to the stylesheet", () => {
		const host = document.body.createDiv();
		const wp = drawWallpaper(host, "expressive");
		expect(wp.querySelector("[fill], [stroke], [style]")).toBeNull();
	});
});

describe("a board's own Hearth wallpaper", () => {
	const load = (kind: string) =>
		sanitizeDashboard(
			{ id: "b", name: "B", cards: [], background: { kind, value: "", opacity: 0.4, blur: 0 } },
			structuredClone(DEFAULT_SETTINGS),
			0,
		)?.background?.kind;

	it("survives a saved layout", () => {
		expect(load("default")).toBe("default");
	});

	it("reads the key the board settings once stored for it", () => {
		expect(load("hdefault")).toBe("default");
	});
});
