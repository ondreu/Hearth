import { beforeAll, describe, expect, it } from "vitest";
import { TFile, type Component } from "obsidian";
import { t } from "../src/i18n";
import { lineWidth, type Line } from "../src/tui/text";
import type { TuiContext } from "../src/tui/card";
import type { TaskHit, TaskLoad } from "../src/cards/tasks";
import type { DashboardCard, TaskTabRow, TasksConfig } from "../src/types";
import type { HomeView } from "../src/view";

let tasksTui: typeof import("../src/tui/cards/tasks").tasksTui;

beforeAll(async () => {
	// Seed the module graph through the registry: cards/tasks.ts reaches it
	// through editors.ts, so importing the TUI card first would evaluate the
	// registry against a half-initialised cycle.
	await import("../src/cards/index");
	({ tasksTui } = await import("../src/tui/cards/tasks"));
});

/**
 * The Tasks card's tab rows in terminal mode (#481): two cascading rows draw
 * as text lines above the list, the active tab shows in reverse, and picking
 * a tab narrows the tasks the body lists — without touching the loaded hits.
 *
 * A fake `TuiContext` with a preset load is enough: the rows resolve against
 * `state.load` and never load anything of their own.
 */

const view = {
	plugin: { settings: { taskNotesDoneValue: "" } },
	app: {},
} as unknown as HomeView;

function hit(text: string, tags: string[] = [], priority?: string): TaskHit {
	const file = new TFile();
	const named = file as unknown as { basename: string; path: string };
	named.basename = "Notes";
	named.path = "Notes.md";
	return {
		file,
		line: 0,
		text,
		done: false,
		due: null,
		dueRaw: null,
		scheduled: null,
		created: 0,
		priority,
		tags,
	};
}

type OkLoad = Extract<TaskLoad, { kind: "ok" }>;

function loadFor(hits: TaskHit[]): OkLoad {
	return {
		kind: "ok",
		source: "checkbox",
		hits,
		filterChoices: { source: "checkbox", statuses: [], priorities: [], contexts: [], projects: [], tags: [] },
		today: "2026-11-18",
		openStatus: "",
	};
}

function ctxFor(cfg: TasksConfig, load: TaskLoad, cols = 64): { ctx: TuiContext; redraws: () => number } {
	let redraws = 0;
	const ctx: TuiContext = {
		view,
		card: { tasks: cfg } as DashboardCard,
		component: {} as Component,
		persistent: {} as Component,
		cols,
		rows: 24,
		focused: false,
		zoomed: false,
		selected: 0,
		state: { fresh: true, load },
		redraw: () => {
			redraws++;
		},
		select: () => undefined,
	};
	return { ctx, redraws: () => redraws };
}

const textOf = (line: Line): string => line.map((s) => s.text).join("");

const hasStyle = (line: Line, style: string): boolean =>
	line.some((s) => (Array.isArray(s.style) ? s.style.includes(style as never) : s.style === style));

/** The item on `line` whose range covers the text `label`. */
function tabItem(ctx: TuiContext, line: number, label: string) {
	const out = tasksTui.render(ctx);
	const at = textOf(out.lines[line]).indexOf(label);
	expect(at).toBeGreaterThanOrEqual(0);
	const item = out.items?.find((i) => i.line === line && i.range && at >= i.range[0] && at < i.range[1]);
	expect(item?.activate).toBeDefined();
	return { out, item: item! };
}

describe("tasks card tab rows in terminal mode", () => {
	const tagRow = (): TaskTabRow => ({ id: "tags", facet: "tag", mode: "auto" });
	const priRow = (): TaskTabRow => ({ id: "pri", facet: "priority", mode: "auto" });
	const hits = [hit("Fix leak", ["work"], "high"), hit("Paint fence", ["work"], "low"), hit("Buy milk", ["home"])];

	it("draws one line per row above the list, the active tab in reverse", () => {
		const { ctx } = ctxFor({ tabRows: [tagRow(), priRow()] }, loadFor(hits));
		const out = tasksTui.render(ctx);
		expect(textOf(out.lines[0]).startsWith(t().cards.tasks.tabs.facets.tag)).toBe(true);
		expect(textOf(out.lines[1]).startsWith(t().cards.tasks.tabs.facets.priority)).toBe(true);
		// The header follows the rows, so the sticky block covers all three.
		expect(out.sticky).toBe(3);
		expect(textOf(out.lines[0])).toContain("#work 2");
		expect(textOf(out.lines[0])).toContain("#home 1");
		for (const line of out.lines) expect(lineWidth(line)).toBeLessThanOrEqual(64);
		// "All" shows first and in reverse; every visible tab is an item.
		const active = out.lines[0].find((s) => s.text === t().cards.tasks.tabs.all);
		expect(active && hasStyle([active], "reverse")).toBe(true);
		expect(out.items?.filter((i) => i.line === 0).length).toBeGreaterThan(1);
		expect(out.items?.filter((i) => i.line === 1).length).toBeGreaterThan(1);
		expect(out.foot).toContain(t().cards.tasks.tabs.tuiHelp);
	});

	it("a chosen tab narrows the tasks the body lists, cascading down the rows", () => {
		const tag = tagRow();
		const cfg: TasksConfig = { tabRows: [tag, priRow()] };
		const { ctx, redraws } = ctxFor(cfg, loadFor(hits));
		const { item } = tabItem(ctx, 0, "#work");
		const loadedBefore = ctx.state.load;
		item.activate?.();
		expect(redraws()).toBe(1);
		// The next draw uses the cached load: a tab is view state, so no vault
		// read may be triggered by picking one.
		expect(ctx.state.fresh).toBe(true);
		const out = tasksTui.render(ctx);
		expect(ctx.state.load).toBe(loadedBefore);
		expect(ctx.state.fresh).toBe(false);
		const body = out.lines.slice(3).map(textOf).join("\n");
		expect(body).toContain("Fix leak");
		expect(body).toContain("Paint fence");
		expect(body).not.toContain("Buy milk");
		expect(out.hint).toBe(t().tui.cards.tasksOpen(2));
		// The second row only sees what the first row left: no home task, so
		// its counts narrowed with it.
		expect(textOf(out.lines[1])).toContain("high 1");
		expect(textOf(out.lines[1])).toContain("low 1");
		expect(textOf(out.lines[1])).not.toContain("— 1");
	});

	it("collapses tabs past the body's width into a trailing +N", () => {
		const { ctx } = ctxFor({ tabRows: [tagRow()] }, loadFor(hits), 24);
		const out = tasksTui.render(ctx);
		expect(lineWidth(out.lines[0])).toBeLessThanOrEqual(24);
		expect(textOf(out.lines[0]).trimEnd()).toMatch(/\+\d+$/);
	});

	it("draws the rows above the board too, and ignores them in the matrix", () => {
		const board = ctxFor({ layout: "kanban", tabRows: [tagRow(), priRow()] }, loadFor(hits));
		const boardOut = tasksTui.render(board.ctx);
		expect(textOf(boardOut.lines[0]).startsWith(t().cards.tasks.tabs.facets.tag)).toBe(true);
		expect(boardOut.sticky).toBe(3);
		expect(boardOut.foot).toContain(t().cards.tasks.tabs.tuiHelp);
		expect(boardOut.items?.some((i) => i.line === 0)).toBe(true);

		const matrix = ctxFor({ layout: "matrix", tabRows: [tagRow()] }, loadFor(hits));
		const matrixOut = tasksTui.render(matrix.ctx);
		expect(textOf(matrixOut.lines[0]).startsWith(t().cards.tasks.tabs.facets.tag)).toBe(false);
		expect(matrixOut.foot).not.toContain(t().cards.tasks.tabs.tuiHelp);
	});

	it("leaves a card without rows exactly as it was", () => {
		const { ctx } = ctxFor({}, loadFor(hits));
		const out = tasksTui.render(ctx);
		expect(out.sticky).toBe(1);
		expect(out.foot).toBe(t().tui.cards.tasksFoot);
		expect(out.items?.some((i) => i.line === 0 && i.range)).toBe(false);
	});
});
