import { describe, expect, it } from "vitest";
import { hearthLeafIsNavigable, internalLinkText, openTarget, resolveOpenIn } from "../src/opener";
import { DEFAULT_SETTINGS, type HomeSettings, type OpenIn, type OpenInRule } from "../src/types";

/**
 * The pure decisions behind the open-behaviour setting (#106): which mode
 * applies to a click, which destination that mode plus the held modifiers
 * imply, whether the Hearth tab is there to be taken over by an open it never
 * sees, and which anchors count as links to a note.
 *
 * Actually reaching for a leaf needs a live workspace, so `targetLeaf`,
 * `openFile` and `openLink` are deliberately not covered here (no Obsidian API
 * mocks) — everything they decide happens in these functions.
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

describe("hearthLeafIsNavigable", () => {
	it("defaults to navigable, so the file explorer keeps behaving as it did (#84)", () => {
		expect(hearthLeafIsNavigable(DEFAULT_SETTINGS)).toBe(true);
		// Even with everything else pointed at a new tab.
		expect(hearthLeafIsNavigable(settings("tab"))).toBe(true);
	});

	it("stops outside opens taking over the Hearth tab when asked", () => {
		expect(hearthLeafIsNavigable({ ...settings("tab"), openFromOutside: "tab" })).toBe(false);
		// An explicit "current tab" wins even when the global says otherwise.
		expect(hearthLeafIsNavigable({ ...settings("window"), openFromOutside: "same" })).toBe(true);
	});

	it('follows the global choice on "default" — and only "same" is a takeover', () => {
		expect(hearthLeafIsNavigable({ ...settings("same"), openFromOutside: "default" })).toBe(true);
		expect(hearthLeafIsNavigable({ ...settings("tab"), openFromOutside: "default" })).toBe(false);
		// Split and window can't be expressed here; they mean "not this tab".
		expect(hearthLeafIsNavigable({ ...settings("split"), openFromOutside: "default" })).toBe(false);
	});
});

describe("internalLinkText", () => {
	it("prefers data-href, which is what Obsidian's renderer emits", () => {
		expect(internalLinkText("Some Note", "Some%20Note")).toBe("Some Note");
		expect(internalLinkText("Note#^block-ref", "Note")).toBe("Note#^block-ref");
	});

	it("takes a plain href for content rendered without the class or data-href", () => {
		// An embedded Bases table's note column, which is what #106's follow-up
		// was about.
		expect(internalLinkText(null, "Projects/Alpha.md")).toBe("Projects/Alpha.md");
	});

	it("ignores anything that isn't a link to a note", () => {
		expect(internalLinkText(null, null)).toBeNull();
		expect(internalLinkText(null, "")).toBeNull();
		// Footnote and heading jumps within the rendered content.
		expect(internalLinkText(null, "#fnref-1")).toBeNull();
		// Anything with a URL scheme belongs to the external-link path.
		expect(internalLinkText(null, "https://example.com")).toBeNull();
		expect(internalLinkText(null, "mailto:me@example.com")).toBeNull();
		expect(internalLinkText(null, "obsidian://open?vault=x")).toBeNull();
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
