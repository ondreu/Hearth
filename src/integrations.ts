/**
 * The catalogue of everything Hearth talks to: community plugins, Obsidian's
 * own core plugins, and the external services a few cards fetch from.
 *
 * Why a catalogue at all — Hearth's integrations are, by nature, scattered.
 * Some carry global settings (TaskNotes' field names, the Iconic/Iconize
 * switch), some are a single option on a different tab (Omnisearch is a choice
 * in the search-engine dropdown), and most are configured per-card on the board
 * or need no configuration whatsoever. Before this, that meant the Integrations
 * tab showed only the two integrations that happened to have settings, and
 * there was nowhere to answer "what does Hearth work with, and is it working
 * right now?".
 *
 * So the catalogue is deliberately *complete and static*: every entry is listed
 * whether or not the plugin is installed and whether or not Hearth has a
 * setting for it. Status is resolved live at render time; the row says where
 * the setting lives (or that there isn't one) either way.
 *
 * Everything here is pure data plus one resolver, so it is unit-testable and
 * carries no rendering concerns — {@link HomeSettingTab} renders it.
 */
import type { App } from "obsidian";
import { DATACORE_PLUGIN_ID } from "./datacore";
import { DATAVIEW_PLUGIN_ID } from "./dataview";
import { ICONIC_PLUGIN_ID, ICONIZE_PLUGIN_ID } from "./fileicons";
import { EXCALIDRAW_PLUGIN_ID } from "./filetypes";
import { OMNISEARCH_PLUGIN_ID } from "./omnisearch";
import { TASKNOTES_PLUGIN_ID } from "./tasknotes";

/**
 * Ids of the settings ribbon tabs.
 *
 * Declared here rather than in `settings.ts` so a catalogue entry can point at
 * the tab that holds its setting without `integrations.ts` and `settings.ts`
 * importing each other.
 */
export type SettingsTabId =
	| "appearance"
	| "search"
	| "dashboard"
	| "behaviour"
	| "integrations"
	| "backup"
	| "about";

/** The collapsible sections of the Integrations tab that hold real settings.
 * A catalogue entry names one so its row can expand and scroll to it. */
export type IntegrationSectionId = "tasks" | "fileIcons";

/** How an integration is grouped in the list. */
export type IntegrationGroup = "plugin" | "core" | "service";

/** Where an integration's settings live — which is often nowhere, and that is
 * worth saying out loud rather than leaving the row looking unfinished. */
export type IntegrationWhere =
	/** A settings section further down the Integrations tab. */
	| { kind: "section"; section: IntegrationSectionId }
	/** A setting on another tab of Hearth's settings. */
	| { kind: "tab"; tab: SettingsTabId }
	/** Configured per-card, in that card's own settings on the board. */
	| { kind: "card" }
	/** Hearth reads the other plugin's own settings; nothing to set here. */
	| { kind: "pluginSettings" }
	/** Nothing to configure anywhere. */
	| { kind: "none" };

/** Ids of the catalogue entries; also the keys of
 * `t().settings.integrations.items`, so a missing translation is a build
 * error rather than an empty row. */
export type IntegrationId =
	| "omnisearch"
	| "tasknotes"
	| "dataview"
	| "datacore"
	| "iconic"
	| "iconize"
	| "excalidraw"
	| "bases"
	| "canvas"
	| "dailyNotes"
	| "bookmarks"
	| "globalSearch"
	| "fileExplorer"
	| "workspaces"
	| "audioRecorder"
	| "leafViews"
	| "jira"
	| "rss"
	| "ics"
	| "currency"
	| "weather"
	| "webSearch";

export interface IntegrationEntry {
	id: IntegrationId;
	group: IntegrationGroup;
	/** The community-plugin id whose presence decides this row's status. */
	pluginId?: string;
	/** The core (internal) plugin id whose presence decides this row's status. */
	corePluginId?: string;
	where: IntegrationWhere;
}

/**
 * Every integration Hearth has, in the order they're listed.
 *
 * Adding one here is all it takes to have it appear — add the matching strings
 * under `settings.integrations.items` and TypeScript will point at the gap if
 * you forget.
 */
export const INTEGRATIONS: readonly IntegrationEntry[] = [
	// ---- Community plugins ------------------------------------------------
	{
		id: "omnisearch",
		group: "plugin",
		pluginId: OMNISEARCH_PLUGIN_ID,
		where: { kind: "tab", tab: "search" },
	},
	{
		id: "tasknotes",
		group: "plugin",
		pluginId: TASKNOTES_PLUGIN_ID,
		where: { kind: "section", section: "tasks" },
	},
	{
		id: "dataview",
		group: "plugin",
		pluginId: DATAVIEW_PLUGIN_ID,
		where: { kind: "card" },
	},
	{
		id: "datacore",
		group: "plugin",
		pluginId: DATACORE_PLUGIN_ID,
		where: { kind: "card" },
	},
	{
		id: "iconic",
		group: "plugin",
		pluginId: ICONIC_PLUGIN_ID,
		where: { kind: "section", section: "fileIcons" },
	},
	{
		id: "iconize",
		group: "plugin",
		pluginId: ICONIZE_PLUGIN_ID,
		where: { kind: "section", section: "fileIcons" },
	},
	{
		id: "excalidraw",
		group: "plugin",
		pluginId: EXCALIDRAW_PLUGIN_ID,
		where: { kind: "card" },
	},

	// ---- Obsidian core plugins --------------------------------------------
	{ id: "bases", group: "core", corePluginId: "bases", where: { kind: "card" } },
	{ id: "canvas", group: "core", corePluginId: "canvas", where: { kind: "card" } },
	{
		id: "dailyNotes",
		group: "core",
		corePluginId: "daily-notes",
		where: { kind: "pluginSettings" },
	},
	{ id: "bookmarks", group: "core", corePluginId: "bookmarks", where: { kind: "card" } },
	{
		id: "globalSearch",
		group: "core",
		corePluginId: "global-search",
		where: { kind: "none" },
	},
	{
		id: "fileExplorer",
		group: "core",
		corePluginId: "file-explorer",
		where: { kind: "none" },
	},
	{ id: "workspaces", group: "core", corePluginId: "workspaces", where: { kind: "card" } },
	{
		id: "audioRecorder",
		group: "core",
		corePluginId: "audio-recorder",
		where: { kind: "tab", tab: "behaviour" },
	},
	// Not tied to any one plugin: the Plugin view card (`leaf` internally) hosts
	// whichever side-panel views happen to be registered, core or community.
	{ id: "leafViews", group: "core", where: { kind: "card" } },

	// ---- External services -------------------------------------------------
	{ id: "jira", group: "service", where: { kind: "card" } },
	{ id: "rss", group: "service", where: { kind: "card" } },
	{ id: "ics", group: "service", where: { kind: "card" } },
	{ id: "currency", group: "service", where: { kind: "none" } },
	{ id: "weather", group: "service", where: { kind: "card" } },
	{ id: "webSearch", group: "service", where: { kind: "tab", tab: "search" } },
];

/** The live state of an integration.
 *
 * - `enabled`  — the plugin is on right now and Hearth can use it.
 * - `disabled` — installed (or, for a core plugin, always present) but off.
 * - `missing`  — not installed at all.
 * - `external` — an outbound service rather than a plugin.
 * - `always`   — nothing to install; it works with whatever is there.
 */
export type IntegrationStatus =
	| "enabled"
	| "disabled"
	| "missing"
	| "external"
	| "always";

/**
 * Resolve an entry's status against the running app.
 *
 * Every read is defensive: `plugins.manifests` is an Obsidian internal (it's
 * how "installed but disabled" is told apart from "never installed") and
 * `internalPlugins.getPluginById` returns null for an id a given Obsidian
 * version doesn't know — Bases, for instance, only exists in 1.9+. Neither may
 * throw here: this runs while the settings pane is being built.
 */
export function integrationStatus(app: App, entry: IntegrationEntry): IntegrationStatus {
	if (entry.group === "service") return "external";

	if (entry.pluginId) {
		try {
			if (app.plugins?.enabledPlugins?.has(entry.pluginId)) return "enabled";
			return app.plugins?.manifests?.[entry.pluginId] ? "disabled" : "missing";
		} catch {
			return "missing";
		}
	}

	if (entry.corePluginId) {
		try {
			const plugin = app.internalPlugins?.getPluginById(entry.corePluginId);
			if (!plugin) return "missing";
			return plugin.enabled ? "enabled" : "disabled";
		} catch {
			return "missing";
		}
	}

	return "always";
}

/** Entries of one group, in catalogue order. */
export function integrationsInGroup(group: IntegrationGroup): IntegrationEntry[] {
	return INTEGRATIONS.filter((entry) => entry.group === group);
}
