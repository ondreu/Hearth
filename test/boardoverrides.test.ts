import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	effectiveArrangeButtonVisibility,
	effectiveCompact,
	effectiveHiddenFilters,
	effectiveNewNoteButtonLabel,
	effectiveNewNoteButtonMode,
	effectiveSearchPlaceholder,
	effectiveShowNewNoteButton,
	effectiveSkyAnimate,
	effectiveStackOnNarrow,
	effectiveSwitcherVisibility,
	effectiveThemeColorTarget,
	type HomeSettings,
} from "../src/types";

/**
 * The two overrides the setup wizard needed in order to stop writing global
 * settings: compact spacing and the title's accent target.
 *
 * Both follow the same contract every other per-dashboard override has — a
 * board that sets nothing keeps following the global setting *as it changes
 * later*, which is exactly what a stored copy of the global value would
 * silently break.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Dashboard 1", cards: [] },
		{ id: "d2", name: "Dashboard 2", cards: [] },
	];
	s.activeDashboardId = "d1";
	return s;
}

describe("effectiveCompact", () => {
	it("follows the global setting when the board sets no override", () => {
		const s = settings();
		expect(effectiveCompact(s)).toBe(false);
		s.compact = true;
		expect(effectiveCompact(s)).toBe(true);
	});

	it("lets one board tighten up while the vault stays roomy", () => {
		const s = settings();
		s.dashboards[0].compact = true;
		expect(effectiveCompact(s)).toBe(true);
		s.activeDashboardId = "d2";
		expect(effectiveCompact(s)).toBe(false);
	});

	it("lets one board stay roomy while the vault is compact", () => {
		const s = settings();
		s.compact = true;
		s.dashboards[0].compact = false;
		expect(effectiveCompact(s)).toBe(false);
	});
});

describe("effectiveThemeColorTarget", () => {
	it("follows the global setting when the board's header sets no override", () => {
		const s = settings();
		expect(effectiveThemeColorTarget(s)).toBe("none");
		s.themeColorTarget = "both";
		expect(effectiveThemeColorTarget(s)).toBe("both");
	});

	it("takes the board's override over the global one", () => {
		const s = settings();
		s.themeColorTarget = "both";
		s.dashboards[0].header = { themeColorTarget: "icon" };
		expect(effectiveThemeColorTarget(s)).toBe("icon");
		s.activeDashboardId = "d2";
		expect(effectiveThemeColorTarget(s)).toBe("both");
	});

	it("treats a header override of \"none\" as a real answer, not as absent", () => {
		const s = settings();
		s.themeColorTarget = "title";
		s.dashboards[0].header = { themeColorTarget: "none" };
		expect(effectiveThemeColorTarget(s)).toBe("none");
	});
});

/**
 * The nine overrides added so a board could carry its own look into another
 * vault (see the resolver block in types.ts).
 *
 * Each is checked against the same contract the two above have — unset follows
 * the vault, *as it changes later* — because that contract is what makes the
 * overrides safe for an importer to write: it only ever writes the ones the
 * exported board actually had, and everything else stays free to follow the
 * vault it lands in.
 */
describe("the search row's per-board overrides", () => {
	it("follows the vault's placeholder until the board states one", () => {
		const s = settings();
		s.searchPlaceholder = "Search the vault";
		expect(effectiveSearchPlaceholder(s)).toBe("Search the vault");
		s.dashboards[0].searchPlaceholder = "Find a recipe";
		expect(effectiveSearchPlaceholder(s)).toBe("Find a recipe");
		s.activeDashboardId = "d2";
		expect(effectiveSearchPlaceholder(s)).toBe("Search the vault");
	});

	it("treats a board's empty placeholder as a real override", () => {
		const s = settings();
		s.searchPlaceholder = "Search the vault";
		s.dashboards[0].searchPlaceholder = "";
		// Empty means "the built-in wording on this board", which every call
		// site reads as its own fallback — not "follow the vault".
		expect(effectiveSearchPlaceholder(s)).toBe("");
	});

	it("lets one board hide the button beside search", () => {
		const s = settings();
		expect(effectiveShowNewNoteButton(s)).toBe(true);
		s.dashboards[0].showNewNoteButton = false;
		expect(effectiveShowNewNoteButton(s)).toBe(false);
		s.activeDashboardId = "d2";
		expect(effectiveShowNewNoteButton(s)).toBe(true);
	});

	it("lets one board change what that button does and says", () => {
		const s = settings();
		s.newNoteButtonLabel = "Capture";
		s.dashboards[0].newNoteButtonMode = "searchOnline";
		s.dashboards[0].newNoteButtonLabel = "Look it up";
		expect(effectiveNewNoteButtonMode(s)).toBe("searchOnline");
		expect(effectiveNewNoteButtonLabel(s)).toBe("Look it up");
		s.activeDashboardId = "d2";
		expect(effectiveNewNoteButtonMode(s)).toBe("newNote");
		expect(effectiveNewNoteButtonLabel(s)).toBe("Capture");
	});

	it("ignores a board's unreadable button mode rather than guessing", () => {
		const s = settings();
		s.newNoteButtonMode = "searchOnline";
		// What a hand-edited data.json or a newer Hearth could leave behind.
		(s.dashboards[0] as { newNoteButtonMode?: unknown }).newNoteButtonMode = "sideways";
		expect(effectiveNewNoteButtonMode(s)).toBe("searchOnline");
	});

	it("lets one board show every filter chip while the vault hides some", () => {
		const s = settings();
		s.hiddenFilters = ["images", "audio"];
		expect(effectiveHiddenFilters(s)).toEqual(["images", "audio"]);
		// An empty array is a real override: this board hides none.
		s.dashboards[0].hiddenFilters = [];
		expect(effectiveHiddenFilters(s)).toEqual([]);
		s.activeDashboardId = "d2";
		expect(effectiveHiddenFilters(s)).toEqual(["images", "audio"]);
	});
});

describe("the chrome and stacking overrides", () => {
	it("lets one board keep its layout while the vault stacks when narrow", () => {
		const s = settings();
		expect(effectiveStackOnNarrow(s)).toBe(true);
		s.dashboards[0].stackOnNarrow = false;
		expect(effectiveStackOnNarrow(s)).toBe(false);
		s.activeDashboardId = "d2";
		expect(effectiveStackOnNarrow(s)).toBe(true);
	});

	it("lets one board auto-hide the arrange button and the switcher", () => {
		const s = settings();
		expect(effectiveArrangeButtonVisibility(s)).toBe("always");
		expect(effectiveSwitcherVisibility(s)).toBe("always");
		s.dashboards[0].arrangeButtonVisibility = "hover";
		s.dashboards[0].dashboardSwitcherVisibility = "hover";
		expect(effectiveArrangeButtonVisibility(s)).toBe("hover");
		expect(effectiveSwitcherVisibility(s)).toBe("hover");
		s.activeDashboardId = "d2";
		expect(effectiveArrangeButtonVisibility(s)).toBe("always");
	});

	it("reads an unknown visibility as the vault's choice, never as hidden", () => {
		const s = settings();
		s.arrangeButtonVisibility = "hover";
		(s.dashboards[0] as { arrangeButtonVisibility?: unknown }).arrangeButtonVisibility =
			"sometimes";
		expect(effectiveArrangeButtonVisibility(s)).toBe("hover");
	});
});

describe("effectiveSkyAnimate", () => {
	it("is on when neither the vault nor the board says otherwise", () => {
		const s = settings();
		expect(effectiveSkyAnimate(s)).toBe(true);
	});

	it("lets a board hold the sky still in a vault that animates it", () => {
		const s = settings();
		s.dashboards[0].backgroundSkyAnimate = false;
		expect(effectiveSkyAnimate(s)).toBe(false);
		s.activeDashboardId = "d2";
		expect(effectiveSkyAnimate(s)).toBe(true);
	});

	it("lets a board animate the sky in a vault that holds it still", () => {
		const s = settings();
		s.backgroundSkyAnimate = false;
		expect(effectiveSkyAnimate(s)).toBe(false);
		s.dashboards[0].backgroundSkyAnimate = true;
		expect(effectiveSkyAnimate(s)).toBe(true);
	});
});
