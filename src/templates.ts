import { App } from "obsidian";
import { DashboardCard } from "./types";
import { isDataviewAvailable } from "./dataview";
import { isLeafViewAvailable } from "./leafview";
import { t } from "./i18n";

/** A ready-made card preset offered by the "Add card" picker. */
export interface CardTemplate {
	id: string;
	name: string;
	/** Lucide icon id shown in the picker menu. */
	icon: string;
	/** Builds the card content/size (id and coordinates are assigned later). */
	build: () => Omit<DashboardCard, "id" | "x" | "y">;
	/** When set, the template is only offered by the "Add card" picker if this
	 * returns true — used to hide cards that depend on a community plugin (e.g.
	 * the Dataview card) until that plugin is installed and enabled. */
	available?: (app: App) => boolean;
}

export const CARD_TEMPLATES: CardTemplate[] = [
	{
		id: "note",
		name: "Embedded note",
		icon: "file-text",
		build: () => ({ kind: "embed", title: "Note", target: "", w: 6, h: 3 }),
	},
	{
		id: "image",
		name: "Embedded image",
		icon: "image",
		build: () => ({ kind: "embed", title: "Image", target: "", w: 4, h: 3 }),
	},
	{
		id: "base",
		name: "Embedded base",
		icon: "database",
		build: () => ({ kind: "embed", title: "Base", target: "", w: 6, h: 4 }),
	},
	{
		id: "excalidraw",
		name: "Excalidraw drawing",
		icon: "pen-tool",
		build: () => ({ kind: "embed", title: "Drawing", target: "", w: 6, h: 4 }),
	},
	{
		id: "canvas",
		name: "Embedded canvas",
		icon: "layout-dashboard",
		build: () => ({ kind: "embed", title: "Canvas", target: "", w: 6, h: 4 }),
	},
	{
		id: "daily",
		name: "Daily note (today)",
		icon: "calendar",
		build: () => ({ kind: "daily", w: 6, h: 4 }),
	},
	{
		id: "web",
		name: "Web page (iframe)",
		icon: "globe",
		build: () => ({ kind: "web", title: "Web", url: "", w: 6, h: 4 }),
	},
	{
		id: "bookmarks",
		name: "Bookmarks",
		icon: "bookmark",
		build: () => ({ kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 }),
	},
	{
		id: "favorites",
		name: "Favorites",
		icon: "star",
		build: () => ({ kind: "favorites", title: "Favorites", w: 4, h: 3 }),
	},
	{
		id: "recent",
		name: "Recent files",
		icon: "history",
		build: () => ({ kind: "recent", title: "Recent", count: 8, w: 4, h: 3 }),
	},
	{
		id: "links",
		name: "Links / launchpad",
		icon: "layout-grid",
		build: () => ({ kind: "links", title: "Links", links: [], w: 6, h: 2 }),
	},
	{
		id: "commands",
		name: "Commands",
		icon: "terminal-square",
		build: () => ({ kind: "commands", title: "Commands", commands: [], w: 6, h: 2 }),
	},
	{
		id: "clock",
		name: "Clock & greeting",
		icon: "clock",
		build: () => ({ kind: "clock", title: "", w: 4, h: 2 }),
	},
	{
		id: "tasks",
		name: "Tasks",
		icon: "list-todo",
		build: () => ({ kind: "tasks", title: "Tasks", tasks: {}, w: 4, h: 4 }),
	},
	{
		id: "calendar",
		name: "Mini calendar",
		icon: "calendar-days",
		build: () => ({ kind: "calendar", title: "Calendar", w: 4, h: 4 }),
	},
	{
		id: "stats",
		name: "Vault statistics",
		icon: "bar-chart-3",
		build: () => ({ kind: "stats", title: "Stats", w: 4, h: 2 }),
	},
	{
		id: "search",
		name: "Query",
		icon: "search",
		build: () => ({ kind: "search", title: "Query", savedSearch: { query: "" }, w: 4, h: 4 }),
	},
	{
		id: "heatmap",
		name: "Activity heatmap",
		icon: "activity",
		build: () => ({ kind: "heatmap", title: "Activity", heatmap: {}, w: 6, h: 3 }),
	},
	{
		id: "text",
		name: "Text / jot-down",
		icon: "pencil",
		build: () => ({ kind: "text", title: "Notes", text: "", w: 4, h: 2 }),
	},
	{
		id: "calculator",
		name: "Calculator",
		icon: "calculator",
		build: () => ({ kind: "calculator", title: "Calculator", calculator: {}, w: 4, h: 3 }),
	},
	{
		id: "dataview",
		name: "Dataview query",
		icon: "database",
		build: () => ({ kind: "dataview", title: "Dataview", dataview: {}, w: 6, h: 4 }),
		available: (app) => isDataviewAvailable(app),
	},
	{
		id: "rss",
		name: "RSS feed",
		icon: "rss",
		build: () => ({ kind: "rss", title: "RSS", rss: { sources: [] }, w: 4, h: 5 }),
	},
	{
		id: "leaf",
		name: "Plugin view (beta)",
		icon: "layout-panel-left",
		build: () => ({ kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 }),
		available: (app) => isLeafViewAvailable(app),
	},
];

/** The template's localized display name for the "Add card" menu. Falls back to
 * the English `name` baked into the template if a locale is missing the key. */
export function templateName(template: CardTemplate): string {
	const names = t().templates as Record<string, string>;
	return names[template.id] ?? template.name;
}

export function cardFromTemplate(template: CardTemplate): DashboardCard {
	return {
		id: `card-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
		x: -1,
		y: -1,
		...template.build(),
	};
}
