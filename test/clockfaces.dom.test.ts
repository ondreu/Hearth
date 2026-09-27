/**
 * @vitest-environment jsdom
 *
 * Every clock face, actually drawn in both designs, under jsdom with Obsidian's
 * DOM helpers as its type definitions describe them (test/support) — createSvg
 * there rejects two classes in one string exactly as Obsidian does. Covers the
 * Expressive-only faces falling back on a Classic card, and the hands and
 * numbers moving with the time.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import { CLOCK_FACES, type ClockConfig, type DashboardCard, resolveClockFace } from "../src/types";

let renderClock: typeof import("../src/cards/clock").renderClock;
let wavyPath: typeof import("../src/cards/clock").wavyPath;

beforeAll(async () => {
	installObsidianDom();
	({ renderClock, wavyPath } = await import("../src/cards/clock"));
});

afterEach(() => {
	vi.useRealTimers();
	document.body.empty();
});

function draw(clock: ClockConfig, design: "classic" | "expressive"): HTMLElement {
	vi.useFakeTimers();
	// 13:07:30 local time.
	vi.setSystemTime(new Date(2026, 8, 27, 13, 7, 30));
	const view = {
		plugin: { settings: { dashboards: [{ id: "a", cards: [] }], activeDashboardId: "a", cardDesign: design } },
	};
	const card = { id: "c", kind: "clock", clock } as unknown as DashboardCard;
	const body = document.body.createDiv("hearth-card-body");
	const component = { registerInterval: (id: number) => id };
	renderClock(view as never, card, body, component as never);
	return body;
}

describe("resolveClockFace", () => {
	it("keeps every face in the Expressive design", () => {
		for (const face of CLOCK_FACES) expect(resolveClockFace(face, true)).toBe(face);
	});

	it("gives the Expressive-only faces a Classic stand-in", () => {
		expect(resolveClockFace("shapes", false)).toBe("stacked");
		expect(resolveClockFace("orbit", false)).toBe("analog");
		expect(resolveClockFace("flip", false)).toBe("flip");
		expect(resolveClockFace(undefined, false)).toBe("digital");
	});
});

describe("the clock faces", () => {
	it("draws every face in both designs, with and without seconds", () => {
		for (const face of CLOCK_FACES) {
			for (const design of ["classic", "expressive"] as const) {
				for (const showSeconds of [false, true]) {
					const body = draw({ mode: face, showSeconds, hourFormat: "24" }, design);
					const drawn = resolveClockFace(face, design === "expressive");
					expect(body.querySelector(`.hearth-clock.is-face-${drawn}`)).not.toBeNull();
					expect(body.hasClass("hearth-clock-host")).toBe(drawn !== "digital" && drawn !== "analog");
				}
			}
		}
	});

	it("shows the time's pieces on the text faces", () => {
		const stacked = draw({ mode: "stacked", hourFormat: "24" }, "classic");
		expect(stacked.querySelector(".hearth-clock-stack-h")?.textContent).toBe("13");
		expect(stacked.querySelector(".hearth-clock-stack-m")?.textContent).toBe("07");

		const flip = draw({ mode: "flip", hourFormat: "24", showSeconds: true }, "expressive");
		const nums = Array.from(flip.querySelectorAll(".hearth-clock-flip-num")).map((n) => n.textContent);
		expect(nums).toEqual(["13", "07", "30"]);

		const shapes = draw({ mode: "shapes", hourFormat: "24" }, "expressive");
		const digits = Array.from(shapes.querySelectorAll(".hearth-clock-shape-num")).map((n) => n.textContent);
		expect(digits).toEqual(["1", "3", "0", "7"]);

		const orbit = draw({ mode: "orbit", hourFormat: "12" }, "expressive");
		expect(orbit.querySelector(".hearth-clock-orbit-h")?.textContent).toBe("1");
		expect(orbit.querySelector(".hearth-clock-orbit-p")?.textContent).not.toBe("");
	});

	it("fills the rings with the time and moves them as it passes", () => {
		const body = draw({ mode: "ring", hourFormat: "24" }, "expressive");
		const minutes = body.querySelector(".hearth-clock-ring-bar.is-minutes");
		const before = minutes?.getAttribute("stroke-dasharray");
		// 7.5 minutes of 60.
		expect(before?.startsWith("12.5 ")).toBe(true);
		vi.advanceTimersByTime(60_000);
		expect(minutes?.getAttribute("stroke-dasharray")).not.toBe(before);
		expect(body.querySelector(".hearth-clock-ring-time")?.textContent).toBe("13:08");
	});

	it("turns a flip tile over only when its number changes", () => {
		const body = draw({ mode: "flip", hourFormat: "24" }, "classic");
		const [hours, minutes] = Array.from(body.querySelectorAll(".hearth-clock-flip-tile"));
		expect(minutes.hasClass("is-turning")).toBe(false);
		vi.advanceTimersByTime(30_000);
		expect(minutes.hasClass("is-turning")).toBe(true);
		expect(hours.hasClass("is-turning")).toBe(false);
	});
});

describe("wavyPath", () => {
	it("closes a circle when flat and stays inside its swing when wavy", () => {
		const flat = wavyPath(50, 50, 40, 0, 1);
		expect(flat.startsWith("M50.00 10.00")).toBe(true);
		expect(flat.endsWith("Z")).toBe(true);
		const points = wavyPath(50, 50, 40, 3, 12)
			.slice(1, -1)
			.split("L")
			.map((p) => p.split(" ").map(Number));
		for (const [x, y] of points) {
			const r = Math.hypot(x - 50, y - 50);
			expect(r).toBeGreaterThan(36.9);
			expect(r).toBeLessThan(43.1);
		}
	});
});
