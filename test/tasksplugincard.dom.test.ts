/**
 * @vitest-environment jsdom
 *
 * The Tasks card reading from the obsidian-tasks plugin. Hearth draws the
 * plugin's tasks itself — normal rows with Hearth chips, filter/sort/cap over
 * what the plugin says exists — while ticking/editing/creating go through the
 * plugin. When the plugin is missing the card says so and offers the way back
 * to checkboxes.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";

installObsidianDom();

let tasks: typeof import("../src/cards/tasks");
let locales: typeof import("../src/locales/en");
let types: typeof import("../src/types");

beforeAll(async () => {
	// Seed the module graph through the registry: cards/tasks.ts reaches it
	// through editors.ts, so importing tasks first would evaluate the
	// registry against a half-initialised cycle.
	await import("../src/cards/index");
	tasks = await import("../src/cards/tasks");
	locales = await import("../src/locales/en");
	types = await import("../src/types");
});

beforeEach(() => {
	document.body.empty();
});

const fileAt = (path: string): TFile => {
	const file = new TFile();
	(file as { path: string }).path = path;
	(file as { basename: string }).basename = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
	(file as { stat: unknown }).stat = { ctime: 0 };
	return file;
};

/** A stand-in view exposing what this card path reads. */
function viewWith(opts: {
	plugins?: Record<string, unknown>;
	enabled?: string[];
	files?: Record<string, string>;
}) {
	const files = Object.entries(opts.files ?? {}).map(([path]) => fileAt(path));
	const contents = new Map(Object.entries(opts.files ?? {}));
	return {
		app: {
			plugins: { enabledPlugins: new Set(opts.enabled ?? []), plugins: opts.plugins ?? {} },
			vault: {
				getMarkdownFiles: () => files,
				cachedRead: async (file: TFile) =>
					contents.get((file as unknown as { path: string }).path) ?? "",
				read: async (file: TFile) => contents.get((file as unknown as { path: string }).path) ?? "",
				modify: async (file: TFile, content: string) => {
					contents.set((file as unknown as { path: string }).path, content);
				},
				getAbstractFileByPath: (path: string) => files.find((f) => (f as unknown as { path: string }).path === path) ?? null,
			},
			metadataCache: {
				getFileCache: () => ({ listItems: [{ task: " " }] }),
				getFirstLinkpathDest: () => null,
			},
			commands: { listCommands: () => [] },
			fileManager: { processFrontMatter: async () => {} },
		},
		plugin: { settings: structuredClone(types.DEFAULT_SETTINGS), saveData: vi.fn(async () => {}) },
		arrangeMode: false,
	} as never;
}

const cardWith = (source: string, over: Record<string, unknown> = {}) =>
	({ kind: "tasks", title: "Tasks", tasks: { source, ...over } }) as never;

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
	await new Promise((r) => window.setTimeout(r, 0));
};

const PLUGIN = { "obsidian-tasks-plugin": { apiV1: {} } };

describe("tasks-plugin source", () => {
	it("says the plugin is missing and offers the way back to checkboxes", async () => {
		const view = viewWith({ plugins: {}, enabled: [], files: {} });
		const card = cardWith("obsidian-tasks");
		const body = document.body.createDiv();
		tasks.renderTasks(view, card, body);
		await flush();

		expect(body.textContent).toContain(locales.en.cards.empty.tasksPluginEnable);
		expect(body.querySelector(".hearth-task-add")).toBeNull();
		expect(body.querySelector(".hearth-tasks-plugin")).toBeNull();

		// The switch writes the checkbox source back and draws the list.
		(body.querySelector(".hearth-tasks-plugin-missing-switch") as HTMLButtonElement).click();
		await flush();
		expect((card as { tasks: { source: string } }).tasks.source).toBe("checkbox");
		expect(body.querySelector(".hearth-tasks-filter")).not.toBeNull();
		expect(body.textContent).toContain(locales.en.cards.empty.tasksEmpty);
	});

	it("draws the plugin's tasks as Hearth rows, not a foreign widget", async () => {
		const view = viewWith({
			plugins: PLUGIN,
			enabled: ["obsidian-tasks-plugin"],
			files: { "Notes/Tasks.md": "- [ ] buy milk 📅 2026-11-20 #home\n- [x] done thing\n" },
		});
		const body = document.body.createDiv();
		tasks.renderTasks(view, cardWith("obsidian-tasks"), body);
		await flush();

		// Hearth rows with Hearth controls — filter, sort and the plugin's own
		// create button — and no embedded foreign widget.
		expect(body.querySelector(".hearth-tasks-plugin")).toBeNull();
		expect(body.querySelectorAll(".hearth-task").length).toBeGreaterThan(0);
		expect(body.textContent).toContain("buy milk");
		expect(body.querySelector(".hearth-tasks-filter")).not.toBeNull();
		expect(body.querySelector(".hearth-tasks-sort")).not.toBeNull();
		expect(body.querySelectorAll(".hearth-task-add")).toHaveLength(1);
	});

	it("does not draw a priority chip on an unmarked task", async () => {
		const view = viewWith({
			plugins: PLUGIN,
			enabled: ["obsidian-tasks-plugin"],
			files: { "Notes/Tasks.md": "- [ ] no signifier\n- [ ] medium one 🔼\n" },
		});
		const body = document.body.createDiv();
		tasks.renderTasks(view, cardWith("obsidian-tasks"), body);
		await flush();

		// Only the task that carries a signifier gets a chip: "no priority" is
		// an absence, not a level the line declared. It still sorts as Normal
		// (see taskssort.test.ts), it just doesn't wear a badge for it.
		const chips = body.querySelectorAll(".hearth-task-priority");
		expect(chips).toHaveLength(1);
		expect(chips[0].textContent?.toLowerCase()).toContain("medium");
		expect(body.querySelectorAll(".hearth-task-priority.is-unmarked")).toHaveLength(0);
	});

	it("filters, sorts and caps over what the plugin says exists", async () => {
		const view = viewWith({
			plugins: PLUGIN,
			enabled: ["obsidian-tasks-plugin"],
			files: {
				"Notes/Tasks.md":
					"- [ ] buy milk 📅 2026-11-20 #home\n- [ ] write report #work\n- [x] done thing #home\n",
			},
		});
		// Text filter narrows to the matching task.
		const body = document.body.createDiv();
		tasks.renderTasks(view, cardWith("obsidian-tasks", { taskFilter: { text: "milk" } }), body);
		await flush();
		expect(body.textContent).toContain("buy milk");
		expect(body.textContent).not.toContain("write report");

		// The cap applies after filtering.
		const capped = document.body.createDiv();
		tasks.renderTasks(view, cardWith("obsidian-tasks", { count: 1 }), capped);
		await flush();
		expect(capped.querySelectorAll(".hearth-task")).toHaveLength(1);
	});

	it("loads tasks for text views instead of a draw-here message", async () => {
		const off = viewWith({ plugins: {}, enabled: [], files: {} });
		const offLoad = await tasks.loadTasks(off, { source: "obsidian-tasks" });
		expect(offLoad.kind).toBe("message");
		if (offLoad.kind === "message") expect(offLoad.text).toBe(locales.en.cards.empty.tasksPluginEnable);

		const on = viewWith({
			plugins: PLUGIN,
			enabled: ["obsidian-tasks-plugin"],
			files: { "Notes/Tasks.md": "- [ ] buy milk\n" },
		});
		const onLoad = await tasks.loadTasks(on, { source: "obsidian-tasks" });
		expect(onLoad.kind).toBe("ok");
	});
});
