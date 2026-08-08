import { describe, expect, it } from "vitest";
// The assertions below are the frozen "before" behavior and must not change
// across the refactor; only these import paths moved to the registry barrel.
import {
	CARD_DEFINITIONS,
	CARD_TEMPLATES,
	TEMPLATE_MENU_ORDER,
	cardDefinition,
	cloneCard,
} from "../src/cards";
import type { DashboardCard } from "../src/types";

/**
 * Characterization tests for the card registry refactor (issue #103).
 *
 * They pin two behaviors that the refactor dismantles and must reproduce byte
 * for byte:
 *   1. the "Add card" menu — every template's id, icon and build() output, in
 *      the exact order they are offered today;
 *   2. cloneCard() deep-clones every nested config array/object, so mutating a
 *      copy never reaches the original. (The RSS config is the one addition
 *      over the old cloner, which missed it — a clone shared `rss.sources`
 *      with its original.)
 */

describe("CARD_TEMPLATES (add-card menu)", () => {
	it("offers the same templates, in the same order, with the same build output", () => {
		const snapshot = CARD_TEMPLATES.map((tpl) => ({
			id: tpl.id,
			icon: tpl.icon,
			gated: typeof tpl.available === "function",
			build: tpl.build(),
		}));
		expect(snapshot).toEqual([
			{ id: "note", icon: "file-text", gated: false, build: { kind: "embed", title: "Note", target: "", w: 6, h: 3 } },
			{ id: "image", icon: "image", gated: false, build: { kind: "embed", title: "Image", target: "", w: 4, h: 3 } },
			{ id: "base", icon: "database", gated: false, build: { kind: "embed", title: "Base", target: "", w: 6, h: 4 } },
			{ id: "excalidraw", icon: "pen-tool", gated: false, build: { kind: "embed", title: "Drawing", target: "", w: 6, h: 4 } },
			{ id: "canvas", icon: "layout-dashboard", gated: false, build: { kind: "embed", title: "Canvas", target: "", w: 6, h: 4 } },
			{ id: "daily", icon: "calendar", gated: false, build: { kind: "daily", w: 6, h: 4 } },
			{ id: "web", icon: "globe", gated: false, build: { kind: "web", title: "Web", url: "", w: 6, h: 4 } },
			{ id: "bookmarks", icon: "bookmark", gated: false, build: { kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 } },
			{ id: "favorites", icon: "star", gated: false, build: { kind: "favorites", title: "Favorites", w: 4, h: 3 } },
			{ id: "recent", icon: "history", gated: false, build: { kind: "recent", title: "Recent", count: 8, w: 4, h: 3 } },
			{ id: "links", icon: "layout-grid", gated: false, build: { kind: "links", title: "Links", links: [], w: 6, h: 2 } },
			{ id: "commands", icon: "terminal-square", gated: false, build: { kind: "commands", title: "Commands", commands: [], w: 6, h: 2 } },
			{ id: "clock", icon: "clock", gated: false, build: { kind: "clock", title: "", w: 4, h: 2 } },
			{ id: "tasks", icon: "list-todo", gated: false, build: { kind: "tasks", title: "Tasks", tasks: {}, w: 4, h: 4 } },
			{ id: "calendar", icon: "calendar-days", gated: false, build: { kind: "calendar", title: "Calendar", w: 4, h: 4 } },
			{ id: "stats", icon: "bar-chart-3", gated: false, build: { kind: "stats", title: "Stats", w: 4, h: 2 } },
			{ id: "search", icon: "search", gated: false, build: { kind: "search", title: "Query", savedSearch: { query: "" }, w: 4, h: 4 } },
			{ id: "heatmap", icon: "activity", gated: false, build: { kind: "heatmap", title: "Activity", heatmap: {}, w: 6, h: 3 } },
			{ id: "text", icon: "pencil", gated: false, build: { kind: "text", title: "Notes", text: "", w: 4, h: 2 } },
			{ id: "calculator", icon: "calculator", gated: false, build: { kind: "calculator", title: "Calculator", calculator: {}, w: 4, h: 3 } },
			{ id: "dataview", icon: "database", gated: true, build: { kind: "dataview", title: "Dataview", dataview: {}, w: 6, h: 4 } },
			{ id: "datacore", icon: "database-zap", gated: true, build: { kind: "datacore", title: "Datacore", datacore: {}, w: 6, h: 4 } },
			{ id: "rss", icon: "rss", gated: false, build: { kind: "rss", title: "RSS", rss: { sources: [] }, w: 4, h: 5 } },
			{
				id: "jira",
				icon: "ticket",
				gated: false,
				build: {
					kind: "jira",
					title: "Jira",
					jira: {
						apiBasePath: "/rest/api/latest",
						controls: ["status", "assignee", "priority", "issueType", "sprint", "fixVersion"],
						maxResults: 50,
						refreshMin: 0,
						cacheMin: 5,
					},
					w: 6,
					h: 5,
				},
			},
			{
				id: "weather",
				icon: "cloud-sun",
				gated: false,
				build: { kind: "weather", title: "Weather", weather: {}, w: 4, h: 3 },
			},
			{
				id: "git",
				icon: "git-branch",
				gated: true,
				build: { kind: "git", title: "Git", git: {}, w: 4, h: 4 },
			},
			{ id: "leaf", icon: "layout-panel-left", gated: true, build: { kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 } },
			{ id: "pet", icon: "cat", gated: false, build: { kind: "pet", title: "Pet", pet: {}, w: 3, h: 4 } },
		]);
	});

	// TEMPLATE_MENU_ORDER is the one enumeration the registry does not
	// compile-enforce: CARD_TEMPLATES is derived from it, so a preset declared in
	// a module but missing from the order silently vanishes from the add-card
	// menu. Pin the round-trip so that omission — or a duplicate id — fails here.
	it("TEMPLATE_MENU_ORDER covers every registered template id exactly once", () => {
		const declared = Object.values(CARD_DEFINITIONS)
			.flatMap((def) => def.templates.map((tpl) => tpl.id))
			.sort();
		expect([...TEMPLATE_MENU_ORDER].sort()).toEqual(declared);
	});
});

/** A card carrying every nested config the cloner touches. */
function maximalCard(): DashboardCard {
	return {
		id: "orig",
		x: 0,
		y: 0,
		w: 4,
		h: 4,
		kind: "tasks",
		title: "Everything",
		links: [{ label: "A", href: "a" } as never],
		commands: [{ id: "c", name: "C" }],
		secondView: { target: "sv" },
		tasks: {
			folders: ["f1"],
			kanbanOrder: ["k1"],
			kanbanHidden: ["k2"],
			kanbanDoneColumns: ["Done"],
			kanbanColumnSort: { Todo: { key: "due", reverse: false } },
			sortRules: [{ field: "due", reverse: false }],
		} as never,
		calendar: {
			sources: [{ url: "u" } as never],
			eventNote: { fields: [{ name: "n" } as never] },
		},
		savedSearch: { query: "q" },
		heatmap: { field: "h" } as never,
		stats: {
			builtins: ["notes"] as never,
			attachmentTypes: ["png"],
			queries: [{ label: "Q", query: "x" } as never],
		},
		clock: { format: "24" } as never,
		calculator: { keypad: "basic" } as never,
		dataview: { columnWidths: [1, 2, 3] },
		datacore: { query: "@page and #project", language: "query", pageSize: 25 },
		rss: { sources: [{ id: "s1", name: "Feed", url: "https://example.com/feed" }] },
		jira: {
			controls: ["status"],
			selections: { status: ["Open"] },
		} as never,
		weather: { place: { name: "Prague", lat: 50.08, lon: 14.44 } },
		git: { sections: ["status", "actions"], actions: ["commit", "push"] },
		pet: { species: "fox", name: "Vulpes" },
	};
}

describe("cloneCard deep-clone independence", () => {
	it("gives the copy a fresh id and detaches every nested array/object", () => {
		const orig = maximalCard();
		const copy = cloneCard(orig);
		expect(copy.id).not.toBe(orig.id);

		// Mutate every nested structure on the copy...
		copy.links![0].label = "B";
		copy.commands![0].name = "D";
		(copy.secondView as { target: string }).target = "sv2";
		copy.tasks!.folders!.push("f2");
		copy.tasks!.kanbanOrder!.push("k9");
		copy.tasks!.kanbanHidden!.push("k9");
		copy.tasks!.kanbanDoneColumns!.push("Extra");
		copy.tasks!.kanbanColumnSort!.Todo.reverse = true;
		copy.tasks!.sortRules![0].reverse = true;
		copy.calendar!.sources!.push({ url: "u2" } as never);
		copy.calendar!.eventNote!.fields!.push({ name: "n2" } as never);
		(copy.savedSearch as { query: string }).query = "q2";
		(copy.heatmap as { field: string }).field = "h2";
		copy.stats!.builtins!.push("words" as never);
		copy.stats!.attachmentTypes!.push("jpg");
		copy.stats!.queries!.push({ label: "Q2", query: "y" } as never);
		(copy.clock as { format: string }).format = "12";
		(copy.calculator as { keypad: string }).keypad = "sci";
		copy.dataview!.columnWidths!.push(4);
		copy.datacore!.query = "@page and #other";
		copy.rss!.sources!.push({ id: "s2", name: "Feed 2", url: "https://example.com/feed2" });
		copy.jira!.controls!.push("assignee");
		copy.jira!.selections!.status!.push("Closed");
		copy.weather!.place!.name = "Brno";
		copy.git!.sections!.push("log");
		copy.git!.actions!.push("pull");
		copy.pet!.name = "Renard";

		// ...and confirm none of it reached the original.
		const pristine = maximalCard();
		expect(orig.links).toEqual(pristine.links);
		expect(orig.commands).toEqual(pristine.commands);
		expect(orig.secondView).toEqual(pristine.secondView);
		expect(orig.tasks).toEqual(pristine.tasks);
		expect(orig.calendar).toEqual(pristine.calendar);
		expect(orig.savedSearch).toEqual(pristine.savedSearch);
		expect(orig.heatmap).toEqual(pristine.heatmap);
		expect(orig.stats).toEqual(pristine.stats);
		expect(orig.clock).toEqual(pristine.clock);
		expect(orig.calculator).toEqual(pristine.calculator);
		expect(orig.dataview).toEqual(pristine.dataview);
		expect(orig.datacore).toEqual(pristine.datacore);
		expect(orig.rss).toEqual(pristine.rss);
		expect(orig.jira).toEqual(pristine.jira);
		expect(orig.weather).toEqual(pristine.weather);
		expect(orig.git).toEqual(pristine.git);
		expect(orig.pet).toEqual(pristine.pet);
	});
});

describe("liveness classification", () => {
	// The refactor migrated this by hand from the old per-kind branches
	// (card.kind === "web", embed/daily checks, LIVE_KINDS). Pin it: a kind
	// silently drifting between modes would pass every other test while its
	// card stops (or starts) refreshing in the running dashboard.
	it("keeps each kind's live-refresh mode", () => {
		const modes = Object.fromEntries(
			Object.entries(CARD_DEFINITIONS).map(([kind, def]) => [kind, def.liveness.mode]),
		);
		expect(modes).toEqual({
			embed: "watch-file",
			daily: "watch-file",
			web: "poll",
			bookmarks: "static",
			favorites: "static",
			text: "static",
			recent: "static",
			links: "static",
			commands: "static",
			clock: "static",
			tasks: "vault",
			calendar: "vault",
			stats: "vault",
			search: "vault",
			heatmap: "vault",
			calculator: "static",
			dataview: "static",
			datacore: "static",
			rss: "static",
			jira: "static",
			weather: "static",
			git: "static",
			leaf: "static",
			pet: "vault",
		});
	});
});

describe("cardDefinition", () => {
	it("serves an inert fallback for a kind this build doesn't know", () => {
		// Persisted data can outrun the code: a data.json written by a newer
		// Hearth (then downgraded), a sync conflict, a hand edit. The lookup must
		// stay total so one alien card can't take down the whole dashboard render.
		const alien = { id: "a", x: 0, y: 0, w: 1, h: 1, kind: "hologram" } as unknown as DashboardCard;
		const def = cardDefinition(alien);
		expect(def).toBeDefined();
		expect(def.liveness).toEqual({ mode: "static" });
		expect("renderEditor" in def).toBe(false);
		expect(() => def.render(null as never, alien, null as never, null as never)).not.toThrow();
	});
});
