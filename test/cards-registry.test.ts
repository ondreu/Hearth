import { describe, expect, it } from "vitest";
// The assertions below are the frozen "before" behavior and must not change
// across the refactor; only these import paths moved to the registry barrel.
import { CARD_TEMPLATES, cloneCard } from "../src/cards";
import type { DashboardCard } from "../src/types";

/**
 * Characterization tests for the card registry refactor (issue #103).
 *
 * They pin two behaviors that the refactor dismantles and must reproduce byte
 * for byte:
 *   1. the "Add card" menu — every template's id, icon and build() output, in
 *      the exact order they are offered today;
 *   2. cloneCard() deep-clones every nested config array/object, so mutating a
 *      copy never reaches the original.
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
			{ id: "leaf", icon: "layout-panel-left", gated: true, build: { kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 } },
		]);
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
		jira: {
			controls: ["status"],
			selections: { status: ["Open"] },
		} as never,
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
		copy.jira!.controls!.push("assignee");
		copy.jira!.selections!.status!.push("Closed");

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
		expect(orig.jira).toEqual(pristine.jira);
	});
});
