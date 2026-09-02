import { describe, expect, it } from "vitest";
import {
	adoptSettings,
	isPluginDataPath,
	looksLikeSavedSettings,
	pluginDataPath,
	sameSettings,
} from "../src/settingssync";
import { DEFAULT_SETTINGS, HomeSettings } from "../src/types";

/**
 * Picking up settings another device synced in.
 *
 * These cover the decisions the watcher makes before it touches anything: which
 * file it is looking at, whether what it read is safe to act on, whether it is
 * actually different from what is already loaded, and what adopting it does to
 * the settings object every card is holding. The wiring around them — the vault
 * event, the debounce, the re-render — is Obsidian API and stays untested, per
 * the no-mocks rule.
 */

const manifest = { id: "hearth", dir: ".obsidian/plugins/hearth" };

/** Settings as they would be after loading, with one recognisable board. */
function settings(name = "Work"): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [{ id: "d1", name, cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

describe("pluginDataPath", () => {
	it("uses the directory Obsidian actually loaded the plugin from", () => {
		expect(pluginDataPath(".obsidian", manifest)).toBe(".obsidian/plugins/hearth/data.json");
	});

	it("follows a vault with a renamed config folder", () => {
		expect(pluginDataPath(".config", { id: "hearth", dir: ".config/plugins/hearth" })).toBe(
			".config/plugins/hearth/data.json",
		);
	});

	it("falls back to the conventional location when the manifest has no dir", () => {
		expect(pluginDataPath(".obsidian", { id: "hearth" })).toBe(
			".obsidian/plugins/hearth/data.json",
		);
	});
});

describe("isPluginDataPath", () => {
	const path = pluginDataPath(".obsidian", manifest);

	it("recognises its own data file", () => {
		expect(isPluginDataPath(path, ".obsidian/plugins/hearth/data.json")).toBe(true);
	});

	it("ignores every other file the vault reports", () => {
		expect(isPluginDataPath(path, ".obsidian/plugins/dataview/data.json")).toBe(false);
		expect(isPluginDataPath(path, ".obsidian/workspace.json")).toBe(false);
		expect(isPluginDataPath(path, "notes/data.json")).toBe(false);
		expect(isPluginDataPath(path, ".obsidian/plugins/hearth/main.js")).toBe(false);
	});

	it("matches however the filesystem spelled the path", () => {
		// Windows separators, and the case-insensitive volumes on Windows and
		// macOS — the event carries the path as the OS reported it.
		expect(isPluginDataPath(path, ".obsidian\\plugins\\hearth\\data.json")).toBe(true);
		expect(isPluginDataPath(path, ".Obsidian/Plugins/Hearth/data.json")).toBe(true);
	});
});

describe("looksLikeSavedSettings", () => {
	it("accepts a file carrying boards", () => {
		expect(looksLikeSavedSettings({ dashboards: [{ id: "d1", name: "Home", cards: [] }] })).toBe(
			true,
		);
	});

	it("accepts a pre-3.0 single-board file", () => {
		expect(looksLikeSavedSettings({ cards: [] })).toBe(true);
	});

	it("refuses a file with no boards in it", () => {
		// The dangerous case: a sync client writing the file, caught before it is
		// complete. `{}` parses fine and would hydrate into a brand-new starter
		// dashboard — replacing the user's boards in memory, and on disk at the
		// next save.
		expect(looksLikeSavedSettings({})).toBe(false);
		expect(looksLikeSavedSettings({ dashboards: [] })).toBe(false);
		expect(looksLikeSavedSettings({ liveRefresh: true })).toBe(false);
	});

	it("refuses anything that isn't a settings object", () => {
		expect(looksLikeSavedSettings(null)).toBe(false);
		expect(looksLikeSavedSettings("{}")).toBe(false);
		expect(looksLikeSavedSettings([])).toBe(false);
		expect(looksLikeSavedSettings(42)).toBe(false);
	});
});

describe("sameSettings", () => {
	it("reads identical settings as unchanged", () => {
		expect(sameSettings(settings(), settings())).toBe(true);
	});

	it("ignores the order two versions happened to write their keys in", () => {
		const a = settings();
		// Same configuration, rebuilt with the keys in reverse — what a peer
		// running a different Hearth version can easily send.
		const reversed = Object.fromEntries(
			Object.entries(a as unknown as Record<string, unknown>).reverse(),
		) as unknown as HomeSettings;
		expect(sameSettings(a, reversed)).toBe(true);
	});

	it("sees a board renamed on another device", () => {
		expect(sameSettings(settings("Work"), settings("Home"))).toBe(false);
	});

	it("sees a card added, and does not confuse it with a reorder", () => {
		const a = settings();
		const b = settings();
		b.dashboards[0].cards = [{ id: "c1", kind: "clock" as const, x: 0, y: 0, w: 2, h: 2 }];
		expect(sameSettings(a, b)).toBe(false);

		const first = settings();
		first.dashboards[0].cards = [
			{ id: "c1", kind: "clock" as const, x: 0, y: 0, w: 2, h: 2 },
			{ id: "c2", kind: "search" as const, x: 2, y: 0, w: 2, h: 2 },
		];
		const swapped = settings();
		swapped.dashboards[0].cards = [...first.dashboards[0].cards].reverse();
		expect(sameSettings(first, swapped)).toBe(false);
	});

	it("treats a key set to undefined as absent, the way JSON does", () => {
		const a = settings();
		const b = settings() as unknown as Record<string, unknown>;
		b.somethingUnset = undefined;
		expect(sameSettings(a, b as unknown as HomeSettings)).toBe(true);
	});
});

describe("adoptSettings", () => {
	it("updates the object every card is already holding", () => {
		const current = settings("Work");
		const held = current;
		adoptSettings(current, settings("Home"));
		// Same object, new contents: a card that captured `plugin.settings` sees
		// the synced board, and its next save writes that rather than the stale one.
		expect(held).toBe(current);
		expect(held.dashboards[0].name).toBe("Home");
	});

	it("takes on values the incoming settings changed", () => {
		const current = settings();
		const next = settings();
		next.liveRefresh = !current.liveRefresh;
		next.rowHeight = 120;
		adoptSettings(current, next);
		expect(current.liveRefresh).toBe(next.liveRefresh);
		expect(current.rowHeight).toBe(120);
	});

	it("drops a field the incoming settings no longer carry", () => {
		// A field retired by a migration must not survive here, or this window
		// would write it straight back.
		const current = settings() as unknown as Record<string, unknown>;
		current.legacyField = "gone";
		adoptSettings(current as unknown as HomeSettings, settings());
		expect("legacyField" in current).toBe(false);
	});

	it("leaves the two objects independent afterwards", () => {
		const current = settings();
		const next = settings("Home");
		adoptSettings(current, next);
		expect(sameSettings(current, next)).toBe(true);
	});
});
