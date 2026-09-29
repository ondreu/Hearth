import { describe, expect, it } from "vitest";
import { tabWindow } from "../src/tui/layout";

/**
 * Terminal mode's tab bar with more boards than fit on the line: a window of
 * tabs around the active one, with room for a marker on each side that has
 * more. Every board has to stay reachable, so the active one is always in it.
 */
describe("tabWindow", () => {
	const ten = Array.from({ length: 10 }, () => 8);

	it("shows every tab when they all fit", () => {
		expect(tabWindow([8, 8, 8], 1, 40, 3)).toEqual({ from: 0, to: 3 });
	});

	it("keeps the active tab in the window, however far along it is", () => {
		for (let active = 0; active < ten.length; active++) {
			const { from, to } = tabWindow(ten, active, 30, 3);
			expect(from).toBeLessThanOrEqual(active);
			expect(to).toBeGreaterThan(active);
		}
	});

	it("leaves room for the markers on the sides it cuts", () => {
		for (let active = 0; active < ten.length; active++) {
			const { from, to } = tabWindow(ten, active, 30, 3);
			const used = ten.slice(from, to).reduce((a, b) => a + b, 0);
			const markers = (from > 0 ? 3 : 0) + (to < ten.length ? 3 : 0);
			expect(used + markers).toBeLessThanOrEqual(30);
		}
	});

	it("stays put while the active tab is among the first that fit", () => {
		expect(tabWindow(ten, 0, 30, 3)).toEqual({ from: 0, to: 3 });
		expect(tabWindow(ten, 2, 30, 3)).toEqual({ from: 0, to: 3 });
	});

	it("otherwise ends at the active tab, so stepping slides it a tab at a time", () => {
		expect(tabWindow(ten, 5, 30, 3)).toEqual({ from: 3, to: 6 });
		expect(tabWindow(ten, 6, 30, 3)).toEqual({ from: 4, to: 7 });
		expect(tabWindow(ten, 9, 30, 3)).toEqual({ from: 7, to: 10 });
	});

	it("still shows the active tab when even it alone is too wide", () => {
		expect(tabWindow([40, 40, 40], 1, 20, 3)).toEqual({ from: 1, to: 2 });
	});
});
