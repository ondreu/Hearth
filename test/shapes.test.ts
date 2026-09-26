import { describe, expect, it } from "vitest";
import { boltShape, shapePath, sparklePath, wavePath } from "../src/shapes";

/**
 * Material 3 Expressive's shapes (src/shapes.ts): the soft polygons, the
 * sparkle, the bolt and the wave every expressive drawing is built from.
 */

/** Every point of a path written as "M x y L x y … [Z]". */
function pointsOf(d: string): { x: number; y: number }[] {
	const nums = d.replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number);
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] });
	return out;
}

describe("shapePath", () => {
	it("swells and dips around the radius by the depth, and closes", () => {
		const d = shapePath(50, 50, 40, 9, 0.05);
		expect(d.endsWith("Z")).toBe(true);
		const radii = pointsOf(d).map((p) => Math.hypot(p.x - 50, p.y - 50));
		expect(Math.max(...radii)).toBeCloseTo(42, 1);
		expect(Math.min(...radii)).toBeGreaterThanOrEqual(37.9);
	});

	it("points its first lobe straight up", () => {
		const [first] = pointsOf(shapePath(0, 0, 10, 8, 0.1));
		expect(first.x).toBeCloseTo(0, 5);
		expect(first.y).toBeCloseTo(-11, 5);
	});
});

describe("wavePath", () => {
	it("waves a straight line by no more than the amplitude, across it", () => {
		const line = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 10 }));
		const wave = pointsOf(wavePath(line, 3, 20));
		expect(wave).toHaveLength(101);
		const offsets = wave.map((p) => p.y - 10);
		expect(Math.max(...offsets)).toBeCloseTo(3, 1);
		expect(Math.min(...offsets)).toBeCloseTo(-3, 1);
		// Across the line, never along it.
		wave.forEach((p, i) => expect(p.x).toBeCloseTo(i, 5));
	});

	it("draws nothing for fewer than two points", () => {
		expect(wavePath([{ x: 0, y: 0 }], 3, 20)).toBe("");
	});
});

describe("sparklePath", () => {
	it("reaches its radius at the four points and pinches in between", () => {
		const d = sparklePath(10, 10, 5);
		expect(d.startsWith("M 10.00 5.00")).toBe(true);
		for (const point of ["15.00 10.00", "10.00 15.00", "5.00 10.00"]) expect(d).toContain(point);
		expect(d.endsWith("Z")).toBe(true);
	});
});

describe("boltShape", () => {
	it("hangs from its top and ends at its height", () => {
		const ys = pointsOf(boltShape(20, 4, 30)).map((p) => p.y);
		expect(Math.min(...ys)).toBeCloseTo(4, 5);
		expect(Math.max(...ys)).toBeCloseTo(34, 5);
	});
});
