import { beforeEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { DEFAULT_SETTINGS, frostAllowed, frostSuppressedByVibrancy, type HomeSettings, type PerformanceTier, translucentWindowActive } from "../src/types";

/** A settings object at the given tier, otherwise untouched. */
function at(tier: PerformanceTier): HomeSettings {
	return { ...DEFAULT_SETTINGS, performanceTier: tier };
}

/** The minimum of a Document these predicates read: a body with a class list.
 * Built by hand because the suite runs without a DOM. */
function doc(...classes: string[]): Document {
	const set = new Set(classes);
	return { body: { classList: { contains: (c: string) => set.has(c) } } } as unknown as Document;
}

describe("translucent window (#272)", () => {
	beforeEach(() => {
		Platform.isMacOS = false;
	});

	it("is off when the body class is absent", () => {
		Platform.isMacOS = true;
		expect(translucentWindowActive(doc())).toBe(false);
	});

	it("is on when macOS carries the class", () => {
		Platform.isMacOS = true;
		expect(translucentWindowActive(doc("is-translucent"))).toBe(true);
	});

	it("stays off away from macOS, class or no class", () => {
		expect(translucentWindowActive(doc("is-translucent"))).toBe(false);
	});
});

describe("frostSuppressedByVibrancy", () => {
	beforeEach(() => {
		Platform.isMacOS = true;
	});

	it("withholds the frost at the tiers that build it", () => {
		for (const tier of ["full", "balanced"] as const) {
			expect(frostAllowed(at(tier))).toBe(true);
			expect(frostSuppressedByVibrancy(at(tier), doc("is-translucent"))).toBe(true);
		}
	});

	it("stays quiet where the tier already dropped the frost, so the two notes never double up", () => {
		for (const tier of ["reduced", "minimal"] as const) {
			expect(frostAllowed(at(tier))).toBe(false);
			expect(frostSuppressedByVibrancy(at(tier), doc("is-translucent"))).toBe(false);
		}
	});

	it("leaves the frost alone with the translucent window off", () => {
		expect(frostSuppressedByVibrancy(at("full"), doc())).toBe(false);
	});

	it("changes no setting — the configured blur is what comes back", () => {
		const s = { ...at("full"), cardBlur: 18 };
		frostSuppressedByVibrancy(s, doc("is-translucent"));
		expect(s.cardBlur).toBe(18);
	});
});
