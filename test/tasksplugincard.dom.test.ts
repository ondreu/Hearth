/**
 * @vitest-environment jsdom
 *
 * The Tasks card reading from the obsidian-tasks plugin. Hearth parses
 * nothing on this source: the card renders the plugin's own `tasks` query
 * block, and when the plugin is missing it says so and offers the way back
 * to checkboxes — rather than showing nothing or breaking.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

installObsidianDom();

const renderMock = vi.fn(async (..._args: unknown[]) => {});

vi.mock("obsidian", async (importOriginal) => {
	const orig = await importOriginal<typeof import("obsidian")>();
	return { ...orig, MarkdownRenderer: { render: renderMock } };
});

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
	renderMock.mockClear();
	document.body.empty();
});

/** A stand-in view exposing only what this card path reads. */
function viewWith(plugins: Record<string, unknown>, enabled: string[]) {
	return {
		app: {
			plugins: { enabledPlugins: new Set(enabled), plugins },
			vault: { getMarkdownFiles: () => [] },
			metadataCache: { getFileCache: () => null },
			commands: { listCommands: () => [] },
		},
		plugin: { settings: structuredClone(types.DEFAULT_SETTINGS), saveData: vi.fn(async () => {}) },
		arrangeMode: false,
	} as never;
}

const cardWith = (source: string) =>
	({ kind: "tasks", title: "Tasks", tasks: { source } }) as never;

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
	await new Promise((r) => window.setTimeout(r, 0));
};

describe("tasks-plugin source", () => {
	it("says the plugin is missing and offers the way back to checkboxes", async () => {
		const view = viewWith({}, []);
		const card = cardWith("obsidian-tasks");
		const body = document.body.createDiv();
		tasks.renderTasks(view, card, body);
		await flush();

		expect(body.textContent).toContain(locales.en.cards.empty.tasksPluginEnable);
		expect(body.querySelector(".hearth-task-add")).toBeNull();
		expect(renderMock).not.toHaveBeenCalled();

		// The switch writes the checkbox source back and draws the list.
		(body.querySelector(".hearth-tasks-plugin-missing-switch") as HTMLButtonElement).click();
		await flush();
		expect((card as { tasks: { source: string } }).tasks.source).toBe("checkbox");
		expect(body.querySelector(".hearth-tasks-filter")).not.toBeNull();
		expect(body.textContent).toContain(locales.en.cards.empty.tasksEmpty);
	});

	it("renders the plugin's own query block when the plugin is on", async () => {
		const view = viewWith({ "obsidian-tasks-plugin": {} }, ["obsidian-tasks-plugin"]);
		const body = document.body.createDiv();
		tasks.renderTasks(view, cardWith("obsidian-tasks"), body);
		await flush();

		expect(renderMock).toHaveBeenCalledTimes(1);
		const fence = renderMock.mock.calls[0][1] as string;
		expect(fence).toBe("```tasks\nnot done\nlimit 10\n```");
		expect(body.querySelector(".hearth-tasks-plugin")).not.toBeNull();
		// The only control is the plugin's own create dialog.
		expect(body.querySelectorAll(".hearth-task-add")).toHaveLength(1);
		expect(body.querySelector(".hearth-tasks-filter")).toBeNull();
		expect(body.querySelector(".hearth-tasks-sort")).toBeNull();
	});

	it("loads as an honest message for text views", async () => {
		const off = viewWith({}, []);
		const offLoad = await tasks.loadTasks(off, { source: "obsidian-tasks" });
		expect(offLoad.kind).toBe("message");
		if (offLoad.kind === "message") expect(offLoad.text).toBe(locales.en.cards.empty.tasksPluginEnable);

		const on = viewWith({ "obsidian-tasks-plugin": {} }, ["obsidian-tasks-plugin"]);
		const onLoad = await tasks.loadTasks(on, { source: "obsidian-tasks" });
		expect(onLoad.kind).toBe("message");
		if (onLoad.kind === "message") expect(onLoad.text).toBe(locales.en.cards.empty.tasksPluginTextOnly);
	});
});
