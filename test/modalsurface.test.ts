import { describe, expect, it } from "vitest";
import { isOpaqueSurfaceColor } from "../src/tabbedmodal";

/**
 * The tabbed modals' sticky tab ribbon paints itself with the modal's own
 * background so it doesn't read as a slab in a different shade on themes that
 * style modals apart from notes. Which measured colour counts as "the surface"
 * is the one piece of that with no DOM in it, so it is pinned here.
 */
describe("isOpaqueSurfaceColor", () => {
	it("accepts a solid colour in either computed form", () => {
		expect(isOpaqueSurfaceColor("rgb(30, 30, 30)")).toBe(true);
		expect(isOpaqueSurfaceColor("rgb(30 30 30)")).toBe(true);
		expect(isOpaqueSurfaceColor("rgba(30, 30, 30, 1)")).toBe(true);
		expect(isOpaqueSurfaceColor("rgb(30 30 30 / 1)")).toBe(true);
	});

	it("accepts a fill that rounds just short of solid", () => {
		expect(isOpaqueSurfaceColor("rgba(30, 30, 30, 0.98)")).toBe(true);
		expect(isOpaqueSurfaceColor("rgb(30 30 30 / 95%)")).toBe(true);
	});

	it("rejects a translucent frame and the washes themes lay over one", () => {
		expect(isOpaqueSurfaceColor("rgba(30, 30, 30, 0.7)")).toBe(false);
		expect(isOpaqueSurfaceColor("rgba(255, 255, 255, 0.03)")).toBe(false);
		expect(isOpaqueSurfaceColor("rgb(255 255 255 / 3%)")).toBe(false);
	});

	it("rejects the unpainted element the walk starts on", () => {
		expect(isOpaqueSurfaceColor("rgba(0, 0, 0, 0)")).toBe(false);
		expect(isOpaqueSurfaceColor("transparent")).toBe(false);
		expect(isOpaqueSurfaceColor("")).toBe(false);
	});

	it("rejects anything it cannot read an alpha out of", () => {
		expect(isOpaqueSurfaceColor("color(srgb 0.1 0.1 0.1)")).toBe(false);
		expect(isOpaqueSurfaceColor("rgb(30, 30)")).toBe(false);
		expect(isOpaqueSurfaceColor("rgba(30, 30, 30, none)")).toBe(false);
	});
});
