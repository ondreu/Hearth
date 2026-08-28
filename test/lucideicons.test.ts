import { describe, expect, it } from "vitest";
import { bareIconName, pickIconId } from "../src/lucide";
import { HEARTH_ICON_ID, HEARTH_ICON_THEMED_ID, tabIconIdFor } from "../src/icon";

/**
 * Lucide icons reach Hearth from three directions — a picker, a hand-typed id
 * and an imported settings file — so what counts as "an icon" has to be decided
 * in one place. These tests pin that decision: which id `setIcon` is handed,
 * and what happens when the value names nothing. The title icon, which takes
 * more than a Lucide id, is covered in titleicon.test.ts.
 */

/** The registered ids Obsidian would report: the Lucide set is prefixed. */
const REGISTERED = new Set(["lucide-flame", "lucide-star", "hearth-crystal"]);
const isKnown = (id: string) => REGISTERED.has(id);

describe("pickIconId", () => {
	it("accepts a bare Lucide name and returns the registered id", () => {
		expect(pickIconId("flame", isKnown)).toBe("lucide-flame");
	});

	it("accepts an already-prefixed id unchanged", () => {
		expect(pickIconId("lucide-star", isKnown)).toBe("lucide-star");
	});

	it("accepts a plugin-registered id that carries no Lucide prefix", () => {
		expect(pickIconId("hearth-crystal", isKnown)).toBe("hearth-crystal");
	});

	it("trims what the user typed", () => {
		expect(pickIconId("  flame  ", isKnown)).toBe("lucide-flame");
	});

	it("rejects an empty value and one that names no icon", () => {
		expect(pickIconId("", isKnown)).toBeNull();
		expect(pickIconId(undefined, isKnown)).toBeNull();
		expect(pickIconId("   ", isKnown)).toBeNull();
		expect(pickIconId("not-an-icon", isKnown)).toBeNull();
	});

	it("trusts the value when the icon registry is unavailable", () => {
		// An unreadable registry must not make every icon vanish — that would be
		// indistinguishable from the user clearing them.
		expect(pickIconId("flame", () => false, false)).toBe("flame");
		expect(pickIconId("", () => false, false)).toBeNull();
	});
});

describe("bareIconName", () => {
	it("strips Obsidian's registration prefix and leaves anything else alone", () => {
		expect(bareIconName("lucide-flame")).toBe("flame");
		expect(bareIconName("hearth-crystal")).toBe("hearth-crystal");
	});
});

describe("tabIconIdFor", () => {
	it("falls back to the crystal — brand or themed — with no custom icon", () => {
		expect(tabIconIdFor("none", "")).toBe(HEARTH_ICON_ID);
		expect(tabIconIdFor("title", undefined)).toBe(HEARTH_ICON_ID);
		expect(tabIconIdFor("icon", "")).toBe(HEARTH_ICON_THEMED_ID);
		expect(tabIconIdFor("both", "   ")).toBe(HEARTH_ICON_THEMED_ID);
	});

	it("uses the custom icon when one is set", () => {
		// The icon registry is unavailable under vitest, so a set value is trusted
		// through — which is exactly the behaviour a user with a valid id sees.
		expect(tabIconIdFor("none", "flame")).toBe("flame");
		expect(tabIconIdFor("icon", " layout-dashboard ")).toBe("layout-dashboard");
	});
});
