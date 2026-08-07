import { describe, expect, it } from "vitest";
import { openTarget, resolveOpenIn } from "../src/opener";
import { DEFAULT_SETTINGS, type HomeSettings, type OpenIn, type OpenInRule } from "../src/types";

/**
 * The two pure halves of the open-behaviour setting (#106): which mode applies
 * to a click, and which destination that mode plus the held modifiers imply.
 * Actually reaching for a leaf needs a live workspace, so `targetLeaf`,
 * `openFile` and `openLink` are deliberately not covered here (no Obsidian API
 * mocks) — everything they decide happens in these two functions.
 */

function settings(openIn: OpenIn, overrides: Partial<Record<string, OpenInRule>> = {}): HomeSettings {
	return {
		...DEFAULT_SETTINGS,
		openIn,
		openInOverrides: { ...DEFAULT_SETTINGS.openInOverrides, ...overrides },
	};
}

describe("resolveOpenIn", () => {
	it("uses the global choice when a source has no rule of its own", () => {
		const s = settings("same");
		expect(resolveOpenIn(s, "link")).toBe("same");
		expect(resolveOpenIn(s, "search")).toBe("same");
		expect(resolveOpenIn(s, "card")).toBe("same");
		expect(resolveOpenIn(s, "newNote")).toBe("same");
	});

	it("lets a source override the global choice", () => {
		const s = settings("same", { newNote: "tab" });
		expect(resolveOpenIn(s, "newNote")).toBe("tab");
		expect(resolveOpenIn(s, "card")).toBe("same");
	});

	it('treats "default" as "follow the global choice"', () => {
		expect(resolveOpenIn(settings("split", { link: "default" }), "link")).toBe("split");
	});

	it("falls back to a new tab for a missing or unknown value", () => {
		const noMap = { ...DEFAULT_SETTINGS, openIn: "same" } as HomeSettings;
		// A settings file written before this feature has neither field.
		delete (noMap as Partial<HomeSettings>).openInOverrides;
		delete (noMap as Partial<HomeSettings>).openIn;
		expect(resolveOpenIn(noMap, "card")).toBe("tab");

		const bogus = settings("sidebar" as OpenIn, { link: "elsewhere" as OpenInRule });
		expect(resolveOpenIn(bogus, "card")).toBe("tab");
		expect(resolveOpenIn(bogus, "link")).toBe("tab");
	});

	it("ships defaulting to a new tab, so upgrades keep the old behaviour", () => {
		expect(resolveOpenIn(DEFAULT_SETTINGS, "link")).toBe("tab");
		expect(resolveOpenIn(DEFAULT_SETTINGS, "card")).toBe("tab");
	});
});

describe("openTarget", () => {
	it("maps each mode to its destination", () => {
		expect(openTarget("tab")).toEqual({ kind: "pane", pane: "tab" });
		expect(openTarget("split")).toEqual({ kind: "pane", pane: "split" });
		expect(openTarget("window")).toEqual({ kind: "pane", pane: "window" });
		expect(openTarget("same")).toEqual({ kind: "reuse" });
	});

	it("lets a modifier override the setting", () => {
		// A bare Mod-click means "new tab" everywhere else in Obsidian.
		expect(openTarget("same", true)).toEqual({ kind: "pane", pane: "tab" });
		// Modifier combinations that name a pane type are honoured as-is.
		expect(openTarget("same", "split")).toEqual({ kind: "pane", pane: "split" });
		expect(openTarget("tab", "window")).toEqual({ kind: "pane", pane: "window" });
	});

	it("ignores a plain click's absent modifiers", () => {
		expect(openTarget("same", false)).toEqual({ kind: "reuse" });
		expect(openTarget("tab", false)).toEqual({ kind: "pane", pane: "tab" });
	});
});
