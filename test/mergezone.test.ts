import { describe, expect, it } from "vitest";
import { mergeZoneHit } from "../src/grid";

/** Drop-to-merge (#385) arms only over the middle of a card, so dragging a card
 * up against another's edge — the usual reason to drag — never merges them. */
describe("mergeZoneHit", () => {
	const rect = { left: 100, top: 200, width: 400, height: 200 };

	it("takes the central half of the card on both axes", () => {
		expect(mergeZoneHit(rect, 300, 300)).toBe(true);
		expect(mergeZoneHit(rect, 200, 250)).toBe(true);
		expect(mergeZoneHit(rect, 400, 350)).toBe(true);
	});

	it("leaves the edges free", () => {
		expect(mergeZoneHit(rect, 150, 300)).toBe(false);
		expect(mergeZoneHit(rect, 450, 300)).toBe(false);
		expect(mergeZoneHit(rect, 300, 210)).toBe(false);
		expect(mergeZoneHit(rect, 300, 390)).toBe(false);
	});

	it("misses outside the card", () => {
		expect(mergeZoneHit(rect, 50, 300)).toBe(false);
		expect(mergeZoneHit(rect, 300, 500)).toBe(false);
	});
});
