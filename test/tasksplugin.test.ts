import { describe, expect, it } from "vitest";
import { TFile, type App } from "obsidian";
import {
	createTasksPluginTask,
	deleteTasksPluginTask,
	editTasksPluginTask,
	ensureTasksPluginTarget,
	parseTasksPluginLine,
	tasksCreateInDailyNote,
	TASKS_PLUGIN_ID,
	tasksPluginApi,
	tasksPluginEnabled,
	tasksPluginStatuses,
	tasksPluginTaskIndex,
	toggleTasksPluginTask,
} from "../src/tasksplugin";
import type { HomeView } from "../src/view";
import type { TasksConfig } from "../src/types";

/**
 * The obsidian-tasks source. Hearth draws the plugin's tasks itself — its
 * statuses (built-ins plus custom ones) and the vault's task format — while
 * ticking, editing and creating go through the plugin so the note is never
 * converted. What's covered here is Hearth's side of that deal: parsing both
 * task formats, the status registry probe, the duck-typed API probe, the
 * toggle/edit/delete writes, and where a new task lands.
 */

const appWith = (plugins: Record<string, unknown>, enabled: string[]): App =>
	({
		plugins: {
			enabledPlugins: new Set(enabled),
			plugins,
		},
	}) as unknown as App;

describe("tasksPluginEnabled", () => {
	it("is true only while the plugin is on", () => {
		const on = appWith({ [TASKS_PLUGIN_ID]: {} }, [TASKS_PLUGIN_ID]);
		expect(tasksPluginEnabled(on)).toBe(true);
		expect(tasksPluginEnabled(appWith({ [TASKS_PLUGIN_ID]: {} }, []))).toBe(false);
		expect(tasksPluginEnabled(appWith({}, []))).toBe(false);
	});

	it("survives an app object without a plugin registry", () => {
		expect(tasksPluginEnabled({} as App)).toBe(false);
	});
});

describe("tasksPluginApi", () => {
	const fullApi = {
		createTaskLineModal: async () => "- [ ] new",
		editTaskLineModal: async (line: string) => line,
		executeToggleTaskDoneCommand: (line: string) => line,
	};

	it("hands out the documented surface", () => {
		const api = tasksPluginApi(appWith({ [TASKS_PLUGIN_ID]: { apiV1: fullApi } }, [TASKS_PLUGIN_ID]));
		expect(api).toBe(fullApi);
	});

	it("says no when the plugin is off, missing, or reshaped", () => {
		expect(tasksPluginApi(appWith({ [TASKS_PLUGIN_ID]: { apiV1: fullApi } }, []))).toBeNull();
		expect(tasksPluginApi(appWith({}, []))).toBeNull();
		expect(
			tasksPluginApi(appWith({ [TASKS_PLUGIN_ID]: {} }, [TASKS_PLUGIN_ID])),
		).toBeNull();
		expect(
			tasksPluginApi(
				appWith({ [TASKS_PLUGIN_ID]: { apiV1: { createTaskLineModal: async () => "" } } }, [
					TASKS_PLUGIN_ID,
				]),
			),
		).toBeNull();
	});
});

describe("tasksPluginStatuses", () => {
	it("falls back to the plugin's defaults without a registry", () => {
		const statuses = tasksPluginStatuses(appWith({ [TASKS_PLUGIN_ID]: {} }, [TASKS_PLUGIN_ID]));
		expect(statuses.map((s) => s.symbol)).toContain(" ");
		expect(statuses.map((s) => s.symbol)).toContain("x");
		expect(statuses.find((s) => s.symbol === "x")?.done).toBe(true);
		expect(statuses.find((s) => s.symbol === " ")?.done).toBe(false);
	});

	it("reads custom statuses from the registry", () => {
		const app = appWith(
			{
				[TASKS_PLUGIN_ID]: {
					statusRegistry: {
						registeredStatuses: [
							{ symbol: " ", name: "Todo", type: "TODO" },
							{ symbol: "?", name: "Needs review", type: "IN_PROGRESS" },
							{ symbol: "x", name: "Done", type: "DONE" },
							{ symbol: "D", name: "Deferred", type: "CANCELLED" },
						],
					},
				},
			},
			[TASKS_PLUGIN_ID],
		);
		const statuses = tasksPluginStatuses(app);
		expect(statuses).toHaveLength(4);
		expect(statuses.find((s) => s.symbol === "?")).toMatchObject({ label: "Needs review", done: false });
		expect(statuses.find((s) => s.symbol === "D")?.done).toBe(true);
	});

	it("is non-empty even with no plugin at all", () => {
		expect(tasksPluginStatuses(appWith({}, []))).not.toHaveLength(0);
	});
});

describe("parseTasksPluginLine", () => {
	it("parses the emoji format", () => {
		const parsed = parseTasksPluginLine("buy milk ⏫ 📅 2026-11-20 🔁 every week #home");
		expect(parsed.text).toBe("buy milk");
		expect(parsed.priority).toBe("⏫");
		expect(parsed.due).toBe("2026-11-20");
		expect(parsed.recurrence).toBe("every week");
		expect(parsed.tags).toEqual(["home"]);
	});

	it("parses the dataview format", () => {
		const parsed = parseTasksPluginLine("buy milk [priority:: high] [due:: 2026-11-20] #home");
		expect(parsed.text).toBe("buy milk");
		expect(parsed.priority).toBe("high");
		expect(parsed.due).toBe("2026-11-20");
		expect(parsed.tags).toEqual(["home"]);
	});

	it("prefers emoji markers when both formats are present", () => {
		const parsed = parseTasksPluginLine("task 📅 2026-11-20 [due:: 2026-12-01]");
		expect(parsed.due).toBe("2026-11-20");
	});

	it("resolves natural-language dates", () => {
		const parsed = parseTasksPluginLine("task 📅 today");
		expect(parsed.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("tasksCreateInDailyNote", () => {
	const cfg = (over: Partial<TasksConfig> = {}): TasksConfig => ({ ...over });

	it("defaults to the daily note", () => {
		expect(tasksCreateInDailyNote(cfg())).toBe(true);
	});

	it("stays on the daily note when the toggle says so", () => {
		expect(tasksCreateInDailyNote(cfg({ tasksPluginNote: "Notes/Tasks.md", tasksPluginDailyNote: true }))).toBe(
			true,
		);
	});

	it("uses the named note otherwise", () => {
		expect(tasksCreateInDailyNote(cfg({ tasksPluginNote: "Notes/Tasks.md" }))).toBe(false);
	});
});

/** A vault holding `files` by path, with spies for writes. */
function stubVault(files: Record<string, string> = {}) {
	const store = new Map(Object.entries(files));
	const made = (path: string) => {
		const file = new TFile();
		(file as { path: string }).path = path;
		(file as { stat: unknown }).stat = { ctime: 0 };
		return file;
	};
	const existing = new Map<string, TFile>();
	for (const path of store.keys()) existing.set(path, made(path));
	return {
		store,
		created: [] as string[],
		modified: [] as { path: string; content: string }[],
		vault: {
			getAbstractFileByPath: (path: string) => existing.get(path) ?? null,
			create: async (path: string, content: string) => {
				const file = made(path);
				existing.set(path, file);
				store.set(path, content);
				return file;
			},
			createFolder: async () => {},
			read: async (file: TFile) => store.get((file as { path: string }).path) ?? "",
			modify: async (file: TFile, content: string) => {
				store.set((file as { path: string }).path, content);
			},
		},
	};
}

function stubView(opts: {
	enabled?: boolean;
	api?: unknown;
	dailyNotes?: { format?: string; folder?: string; template?: string } | null;
	files?: Record<string, string>;
	statusRegistry?: unknown;
}) {
	const { store, vault } = stubVault(opts.files);
	const plugins: Record<string, unknown> = {};
	if (opts.enabled !== false) {
		plugins[TASKS_PLUGIN_ID] = { apiV1: opts.api, statusRegistry: opts.statusRegistry };
	}
	return {
		store,
		vault,
		view: {
			app: {
				plugins: {
					enabledPlugins: new Set(opts.enabled === false ? [] : [TASKS_PLUGIN_ID]),
					plugins,
				},
				internalPlugins: {
					getPluginById: (id: string) =>
						id === "daily-notes" && opts.dailyNotes !== null
							? { enabled: true, instance: { options: opts.dailyNotes ?? {} } }
							: null,
				},
				vault,
			},
			plugin: { settings: {} },
		} as unknown as HomeView,
	};
}

describe("ensureTasksPluginTarget", () => {
	it("uses today's daily note when it already exists", async () => {
		const today = new Date().toISOString().slice(0, 10);
		const { view } = stubView({ files: { [`${today}.md`]: "# day\n" } });
		const target = await ensureTasksPluginTarget(view, {});
		expect((target as unknown as { path: string }).path).toBe(`${today}.md`);
	});

	it("creates today's daily note when it doesn't exist yet", async () => {
		const { view, store, vault } = stubView({ files: {} });
		const created: string[] = [];
		const origCreate = vault.create;
		vault.create = async (path: string, content: string) => {
			created.push(path);
			return origCreate(path, content);
		};
		const today = new Date().toISOString().slice(0, 10);
		const target = await ensureTasksPluginTarget(view, {});
		expect((target as unknown as { path: string }).path).toBe(`${today}.md`);
		expect(created).toEqual([`${today}.md`]);
		expect(store.get(`${today}.md`)).toBe("");
	});

	it("reports nowhere to put the task when Daily notes is off and no note is picked", async () => {
		const { view } = stubView({ dailyNotes: null, files: {} });
		expect(await ensureTasksPluginTarget(view, {})).toBeNull();
	});

	it("resolves the named note, with or without its extension", async () => {
		const { view } = stubView({ files: { "Notes/Tasks.md": "# tasks\n" } });
		const direct = await ensureTasksPluginTarget(view, { tasksPluginNote: "Notes/Tasks.md" });
		expect((direct as unknown as { path: string }).path).toBe("Notes/Tasks.md");
		const bare = await ensureTasksPluginTarget(view, { tasksPluginNote: "Notes/Tasks" });
		expect((bare as unknown as { path: string }).path).toBe("Notes/Tasks.md");
	});

	it("reports a named note that isn't there", async () => {
		const { view } = stubView({ files: {} });
		expect(await ensureTasksPluginTarget(view, { tasksPluginNote: "Notes/Missing.md" })).toBeNull();
	});
});

describe("createTasksPluginTask", () => {
	const api = (line: string) => ({
		createTaskLineModal: async () => line,
		editTaskLineModal: async (l: string) => l,
		executeToggleTaskDoneCommand: (l: string) => l,
	});

	it("appends the plugin's own line verbatim and never converts it", async () => {
		const { view, store } = stubView({
			api: api("- [ ] bought milk 📅 2026-11-20"),
			files: { "Notes/Tasks.md": "# tasks\n" },
		});
		expect(await createTasksPluginTask(view, { tasksPluginNote: "Notes/Tasks.md" })).toBe(true);
		expect(store.get("Notes/Tasks.md")).toBe("# tasks\n- [ ] bought milk 📅 2026-11-20\n");
	});

	it("adds the missing trailing newline before the new line", async () => {
		const { view, store } = stubView({
			api: api("- [ ] no trailing newline"),
			files: { "Notes/Tasks.md": "# tasks" },
		});
		expect(await createTasksPluginTask(view, { tasksPluginNote: "Notes/Tasks.md" })).toBe(true);
		expect(store.get("Notes/Tasks.md")).toBe("# tasks\n- [ ] no trailing newline\n");
	});

	it("does nothing when the modal is cancelled", async () => {
		const { view, store } = stubView({ api: api(""), files: { "Notes/Tasks.md": "# tasks\n" } });
		expect(await createTasksPluginTask(view, { tasksPluginNote: "Notes/Tasks.md" })).toBe(false);
		expect(store.get("Notes/Tasks.md")).toBe("# tasks\n");
	});

	it("fails honestly without the plugin's API", async () => {
		const { view } = stubView({ enabled: false, files: { "Notes/Tasks.md": "# tasks\n" } });
		expect(await createTasksPluginTask(view, { tasksPluginNote: "Notes/Tasks.md" })).toBe(false);
	});
});

describe("toggleTasksPluginTask", () => {
	const fileFor = (store: Map<string, string>, path: string): TFile => {
		const file = new TFile();
		(file as { path: string }).path = path;
		(file as { stat: unknown }).stat = { ctime: 0 };
		void store;
		return file;
	};

	it("toggles through the plugin's own command", async () => {
		const { view, store } = stubView({
			api: {
				createTaskLineModal: async () => "",
				editTaskLineModal: async (l: string) => l,
				executeToggleTaskDoneCommand: (line: string) => line.replace("[ ]", "[x]"),
			},
			files: { "Notes/Tasks.md": "- [ ] buy milk\n" },
		});
		const file = fileFor(store, "Notes/Tasks.md");
		expect(await toggleTasksPluginTask(view, file, 0, "buy milk")).toBe(true);
		expect(store.get("Notes/Tasks.md")).toBe("- [x] buy milk\n");
	});

	it("bails when the line changed underneath", async () => {
		const { view, store } = stubView({
			api: {
				createTaskLineModal: async () => "",
				editTaskLineModal: async (l: string) => l,
				executeToggleTaskDoneCommand: (l: string) => l,
			},
			files: { "Notes/Tasks.md": "- [ ] something else\n" },
		});
		const file = fileFor(store, "Notes/Tasks.md");
		expect(await toggleTasksPluginTask(view, file, 0, "buy milk")).toBe(false);
	});
});

describe("editTasksPluginTask", () => {
	const fileFor = (store: Map<string, string>, path: string): TFile => {
		const file = new TFile();
		(file as { path: string }).path = path;
		(file as { stat: unknown }).stat = { ctime: 0 };
		void store;
		return file;
	};

	it("writes the plugin's edited line back verbatim", async () => {
		const { view, store } = stubView({
			api: {
				createTaskLineModal: async () => "",
				editTaskLineModal: async () => "- [ ] edited 📅 2026-11-20",
				executeToggleTaskDoneCommand: (l: string) => l,
			},
			files: { "Notes/Tasks.md": "- [ ] original\n" },
		});
		const file = fileFor(store, "Notes/Tasks.md");
		expect(await editTasksPluginTask(view, file, 0, "original")).toBe(true);
		expect(store.get("Notes/Tasks.md")).toBe("- [ ] edited 📅 2026-11-20\n");
	});

	it("does nothing when the modal is cancelled", async () => {
		const { view, store } = stubView({
			api: {
				createTaskLineModal: async () => "",
				editTaskLineModal: async () => "",
				executeToggleTaskDoneCommand: (l: string) => l,
			},
			files: { "Notes/Tasks.md": "- [ ] original\n" },
		});
		const file = fileFor(store, "Notes/Tasks.md");
		expect(await editTasksPluginTask(view, file, 0, "original")).toBe(false);
		expect(store.get("Notes/Tasks.md")).toBe("- [ ] original\n");
	});
});

describe("deleteTasksPluginTask", () => {
	const fileFor = (store: Map<string, string>, path: string): TFile => {
		const file = new TFile();
		(file as { path: string }).path = path;
		(file as { stat: unknown }).stat = { ctime: 0 };
		void store;
		return file;
	};

	it("removes the line", async () => {
		const { view, store } = stubView({
			api: {},
			files: { "Notes/Tasks.md": "- [ ] gone\n- [ ] stays\n" },
		});
		const file = fileFor(store, "Notes/Tasks.md");
		expect(await deleteTasksPluginTask(view, file, 0, "gone")).toBe(true);
		expect(store.get("Notes/Tasks.md")).toBe("- [ ] stays\n");
	});
});


/** The slice of App the cache probe touches. */
function cacheApp(plugin?: unknown, enabled = true) {
	return {
		plugins: {
			enabledPlugins: new Set(enabled ? ["obsidian-tasks-plugin"] : []),
			plugins: { "obsidian-tasks-plugin": plugin },
		},
	} as unknown as Parameters<typeof tasksPluginTaskIndex>[0];
}


describe("tasksplugin/taskIndex", () => {
	it("keys the plugin's tasks by path and line", () => {
		const index = tasksPluginTaskIndex(
			cacheApp({
				getTasks: () => [
					{ path: "Inbox.md", lineNumber: 4 },
					{ path: "a.md", lineNumber: 0 },
				],
			}),
		);
		expect(index && [...index].sort()).toEqual(["Inbox.md:4", "a.md:0"]);
	});

	it("is null while the plugin's cache is still loading", () => {
		// getTasks() is empty until the state is Warm. An empty Set would mean
		// "no line is a task" and hide the whole list, so a loading cache is
		// answered as unknown (#510).
		expect(tasksPluginTaskIndex(cacheApp({ getState: () => "Cold", getTasks: () => [] }))).toBeNull();
		expect(tasksPluginTaskIndex(cacheApp({ getState: () => "Initializing", getTasks: () => [] }))).toBeNull();
	});

	it("reads the cache once it is Warm", () => {
		const index = tasksPluginTaskIndex(
			cacheApp({ getState: () => "Warm", getTasks: () => [{ path: "a.md", lineNumber: 1 }] }),
		);
		expect(index && [...index]).toEqual(["a.md:1"]);
	});

	it("still reads a build that exposes no state or a broken one", () => {
		const tasks = () => [{ path: "a.md", lineNumber: 1 }];
		const noState = tasksPluginTaskIndex(cacheApp({ getTasks: tasks }));
		expect(noState && [...noState]).toEqual(["a.md:1"]);
		const brokenState = tasksPluginTaskIndex(
			cacheApp({
				getState: () => {
					throw new Error("no state");
				},
				getTasks: tasks,
			}),
		);
		expect(brokenState && [...brokenState]).toEqual(["a.md:1"]);
	});

	it("is null when the plugin exposes no cache", () => {
		expect(tasksPluginTaskIndex(cacheApp({}))).toBeNull();
		expect(tasksPluginTaskIndex(cacheApp({ getTasks: () => [] }, false))).toBeNull();
	});

	it("is null when the cache throws or is not a list", () => {
		expect(
			tasksPluginTaskIndex(
				cacheApp({
					getTasks: () => {
						throw new Error("not ready");
					},
				}),
			),
		).toBeNull();
		expect(tasksPluginTaskIndex(cacheApp({ getTasks: () => "nope" }))).toBeNull();
	});

	it("skips entries without a usable location", () => {
		const index = tasksPluginTaskIndex(
			cacheApp({ getTasks: () => [null, "x", { path: "a.md" }, { lineNumber: 2 }, { path: "b.md", lineNumber: 7 }] }),
		);
		expect(index && [...index]).toEqual(["b.md:7"]);
	});
});
