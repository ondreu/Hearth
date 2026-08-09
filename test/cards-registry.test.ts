import { describe, expect, it } from "vitest";
// The assertions below are the frozen "before" behavior and must not change
// across the refactor; only these import paths moved to the registry barrel.
import {
	CARD_CATEGORIES,
	CARD_DEFINITIONS,
	CARD_TEMPLATES,
	TEMPLATE_MENU_ORDER,
	cardDefinition,
	cloneCard,
	templateCategory,
	templateDescription,
	templateName,
	unmetRequirement,
} from "../src/cards";
import type { App } from "obsidian";
import type { DashboardCard } from "../src/types";

/**
 * Characterization tests for the card registry refactor (issue #103).
 *
 * They pin two behaviors:
 *   1. the "Add card" picker — every template's id, icon, category, dependency
 *      and build() output, in the exact order they are offered;
 *   2. cloneCard() deep-clones every nested config array/object, so mutating a
 *      copy never reaches the original. (The RSS config is the one addition
 *      over the old cloner, which missed it — a clone shared `rss.sources`
 *      with its original.)
 */

describe("CARD_TEMPLATES (add-card menu)", () => {
	it("offers every template, grouped in picker order, with the same build output", () => {
		const snapshot = CARD_TEMPLATES.map((tpl) => ({
			id: tpl.id,
			icon: tpl.icon,
			category: templateCategory(tpl.id),
			requires: tpl.requires?.name ?? null,
			build: tpl.build(),
		}));
		expect(snapshot).toEqual([
			// ---- Notes & files ----
			{ id: "note", icon: "file-text", category: "notes", requires: null, build: { kind: "embed", title: "Note", target: "", w: 6, h: 3 } },
			{ id: "daily", icon: "calendar", category: "notes", requires: null, build: { kind: "daily", w: 6, h: 4 } },
			{ id: "image", icon: "image", category: "notes", requires: null, build: { kind: "embed", title: "Image", target: "", w: 4, h: 3 } },
			{ id: "canvas", icon: "layout-dashboard", category: "notes", requires: null, build: { kind: "embed", title: "Canvas", target: "", w: 6, h: 4 } },
			{ id: "excalidraw", icon: "pen-tool", category: "notes", requires: null, build: { kind: "embed", title: "Drawing", target: "", w: 6, h: 4 } },
			{ id: "base", icon: "database", category: "notes", requires: null, build: { kind: "embed", title: "Base", target: "", w: 6, h: 4 } },
			{ id: "recent", icon: "history", category: "notes", requires: null, build: { kind: "recent", title: "Recent", count: 8, w: 4, h: 3 } },
			{ id: "favorites", icon: "star", category: "notes", requires: null, build: { kind: "favorites", title: "Favorites", w: 4, h: 3 } },
			{ id: "bookmarks", icon: "bookmark", category: "notes", requires: null, build: { kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 } },

			// ---- Planning ----
			{ id: "tasks", icon: "list-todo", category: "planning", requires: null, build: { kind: "tasks", title: "Tasks", tasks: {}, w: 4, h: 4 } },
			{ id: "schedule", icon: "calendar-range", category: "planning", requires: null, build: { kind: "schedule", title: "Calendar", schedule: {}, w: 8, h: 6 } },
			{ id: "calendar", icon: "calendar-days", category: "planning", requires: null, build: { kind: "calendar", title: "Calendar", w: 4, h: 4 } },
			{ id: "clock", icon: "clock", category: "planning", requires: null, build: { kind: "clock", title: "", w: 4, h: 2 } },

			// ---- Vault insight ----
			{ id: "search", icon: "search", category: "vault", requires: null, build: { kind: "search", title: "Query", savedSearch: { query: "" }, w: 4, h: 4 } },
			{ id: "searchbar", icon: "text-cursor-input", category: "vault", requires: null, build: { kind: "searchbar", title: "", searchBar: {}, w: 6, h: 1 } },
			{ id: "stats", icon: "bar-chart-3", category: "vault", requires: null, build: { kind: "stats", title: "Stats", w: 4, h: 2 } },
			{ id: "heatmap", icon: "activity", category: "vault", requires: null, build: { kind: "heatmap", title: "Activity", heatmap: {}, w: 6, h: 3 } },

			// ---- Tools ----
			{ id: "links", icon: "layout-grid", category: "tools", requires: null, build: { kind: "links", title: "Links", links: [], w: 6, h: 2 } },
			{ id: "commands", icon: "terminal-square", category: "tools", requires: null, build: { kind: "commands", title: "Commands", commands: [], w: 6, h: 2 } },
			{ id: "text", icon: "pencil", category: "tools", requires: null, build: { kind: "text", title: "Notes", text: "", w: 4, h: 2 } },
			{ id: "calculator", icon: "calculator", category: "tools", requires: null, build: { kind: "calculator", title: "Calculator", calculator: {}, w: 4, h: 3 } },
			{ id: "web", icon: "globe", category: "tools", requires: null, build: { kind: "web", title: "Web", url: "", w: 6, h: 4 } },

			// ---- Integrations ----
			{ id: "dataview", icon: "database", category: "integrations", requires: "Dataview", build: { kind: "dataview", title: "Dataview", dataview: {}, w: 6, h: 4 } },
			{ id: "datacore", icon: "database-zap", category: "integrations", requires: "Datacore", build: { kind: "datacore", title: "Datacore", datacore: {}, w: 6, h: 4 } },
			{
				id: "git",
				icon: "git-branch",
				category: "integrations",
				requires: "Git",
				build: { kind: "git", title: "Git", git: {}, w: 4, h: 4 },
			},
			{
				id: "jira",
				icon: "ticket",
				category: "integrations",
				requires: null,
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
			{ id: "rss", icon: "rss", category: "integrations", requires: null, build: { kind: "rss", title: "RSS", rss: { sources: [] }, w: 4, h: 5 } },
			{
				id: "weather",
				icon: "cloud-sun",
				category: "integrations",
				requires: null,
				build: { kind: "weather", title: "Weather", weather: {}, w: 4, h: 3 },
			},
			{
				id: "leaf",
				icon: "layout-panel-left",
				category: "integrations",
				requires: "Hostable side-panel views",
				build: { kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 },
			},

			// ---- Fun ----
			{ id: "pet", icon: "cat", category: "fun", requires: null, build: { kind: "pet", title: "Pet", pet: {}, w: 3, h: 4 } },
		]);
	});

	// TEMPLATE_MENU_GROUPS is the one enumeration the registry does not
	// compile-enforce: CARD_TEMPLATES is derived from it, so a preset declared in
	// a module but missing from the groups silently vanishes from the picker.
	// Pin the round-trip so that omission — or a duplicate id — fails here.
	it("TEMPLATE_MENU_GROUPS covers every registered template id exactly once", () => {
		const declared = Object.values(CARD_DEFINITIONS)
			.flatMap((def) => def.templates.map((tpl) => tpl.id))
			.sort();
		expect([...TEMPLATE_MENU_ORDER].sort()).toEqual(declared);
		expect(new Set(TEMPLATE_MENU_ORDER).size).toBe(TEMPLATE_MENU_ORDER.length);
	});

	// Every card is offered whether or not its dependency is installed (that is
	// the point of `requires` replacing the old `available` gate), so the picker
	// must never consult a requirement to decide *whether* to list a template —
	// only how to badge it.
	it("offers plugin-backed cards even when the plugin is missing", () => {
		const app = { plugins: { enabledPlugins: new Set<string>(), plugins: {} } } as unknown as App;
		for (const id of ["dataview", "datacore", "git"]) {
			const template = CARD_TEMPLATES.find((tpl) => tpl.id === id);
			expect(template, id).toBeDefined();
			expect(unmetRequirement(app, template!)?.name, id).toBeTruthy();
		}
	});

	// The picker shows a description under every name and searches on it, so a
	// template with no matching locale key would read as a blank half-tile.
	it("has a localized name and description for every template", () => {
		for (const template of CARD_TEMPLATES) {
			expect(templateName(template), template.id).toBeTruthy();
			expect(templateDescription(template), template.id).toBeTruthy();
		}
	});

	// Not every category needs to be crowded, but an empty one is a rail entry
	// that leads to a blank page.
	it("gives every category at least one template", () => {
		for (const category of CARD_CATEGORIES) {
			expect(
				CARD_TEMPLATES.some((tpl) => templateCategory(tpl.id) === category),
				category,
			).toBe(true);
		}
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
		schedule: {
			views: ["month", "week"],
			sources: [{ url: "u" } as never],
			chips: { time: false },
			taskNotes: { enabled: true },
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
		copy.schedule!.views!.push("day");
		copy.schedule!.sources!.push({ url: "u2" } as never);
		copy.schedule!.chips!.source = false;
		copy.schedule!.taskNotes!.enabled = false;
		copy.schedule!.eventNote!.fields!.push({ name: "n2" } as never);
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
		expect(orig.schedule).toEqual(pristine.schedule);
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
			schedule: "vault",
			stats: "vault",
			search: "vault",
		searchbar: "static",
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
