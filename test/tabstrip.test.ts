import { describe, expect, it } from "vitest";
import { hiddenTabs } from "../src/tabstrip";

/** The feed tab row's overflow count (src/tabstrip.ts): which chips are not
 * fully in view. */
describe("hiddenTabs", () => {
	const view = { start: 100, end: 300 };
	it("counts chips cut at either edge or wholly outside", () => {
		const items = [
			{ start: 60, end: 120 }, // cut on the left
			{ start: 124, end: 200 },
			{ start: 204, end: 299.5 }, // within the pixel's slack
			{ start: 290, end: 360 }, // cut on the right
			{ start: 364, end: 420 }, // beyond
		];
		expect(hiddenTabs(view, items)).toEqual([0, 3, 4]);
	});
	it("is empty when everything fits", () => {
		expect(hiddenTabs(view, [{ start: 100, end: 180 }, { start: 184, end: 260 }])).toEqual([]);
	});
});
