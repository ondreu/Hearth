import { describe, expect, it } from "vitest";
import { TFile, type App } from "obsidian";
import {
	buildTasksPluginQuery,
	createTasksPluginTask,
	ensureTasksPluginTarget,
	tasksCreateInDailyNote,
	TASKS_PLUGIN_ID,
	tasksPluginApi,
	tasksPluginEnabled,
	tasksPluginQueryFence,
} from "../src/tasksplugin";
import type { HomeView } from "../src/view";
import type { TasksConfig } from "../src/types";

/**
 * The obsidian-tasks source. Hearth never parses Tasks itself: the card shows
 * the plugin's own `tasks` query block, and creation goes through the
 * plugin's own modal. What's covered here is Hearth's side of that deal —
 * the query lines it generates, the duck-typed API probe, and where a new
 * task lands.
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

describe("buildTasksPluginQuery", () => {
	it("hides completed tasks and caps the list by default", () => {
		expect(buildTasksPluginQuery({})).toBe("not done\nlimit 10");
	});

	it("shows completed tasks and honours the card's cap", () => {
		expect(buildTasksPluginQuery({ showCompleted: true, count: 25 })).toBe("limit 25");
	});

	it("scopes a single folder with the plugin's own path filter", () => {
		expect(buildTasksPluginQuery({ folders: ["Projects"], folderScope: "whitelist" })).toBe(
			"path includes Projects\nnot done\nlimit 10",
		);
	});

	it("excludes blacklisted folders", () => {
		expect(
			buildTasksPluginQuery({ folders: ["Archive", "Templates"], folderScope: "blacklist" }),
		).toBe("path does not include Archive\npath does not include Templates\nnot done\nlimit 10");
	});

	it("ORs several whitelisted folders instead of ANDing them", () => {
		const query = buildTasksPluginQuery({ folders: ["A", "B"], folderScope: "whitelist" });
		expect(query).toContain("filter by function");
		expect(query).toContain('"A"');
		expect(query).toContain('"B"');
	});

	it("matches nothing for an empty whitelist, like Hearth does", () => {
		const query = buildTasksPluginQuery({ folders: [], folderScope: "whitelist" });
		expect(query).toContain("path regex matches /^$/");
	});

	it("trims folders and drops trailing slashes", () => {
		expect(buildTasksPluginQuery({ folders: ["  Projects/ "], folderScope: "whitelist" })).toBe(
			"path includes Projects\nnot done\nlimit 10",
		);
	});

	it("quotes folder names safely in the function filter", () => {
		const query = buildTasksPluginQuery({
			folders: [`We"ird`, `back\\slash`],
			folderScope: "whitelist",
		});
		expect(query).toContain('\\"');
		expect(query).toContain("\\\\");
	});

	it("appends the user's own instructions verbatim, after Hearth's lines", () => {
		const query = buildTasksPluginQuery({ tasksQuery: "sort by due\nhide backlinks" });
		expect(query).toBe("not done\nlimit 10\nsort by due\nhide backlinks");
	});

	it("ignores blank extra lines", () => {
		expect(buildTasksPluginQuery({ tasksQuery: "\n  \n" })).toBe("not done\nlimit 10");
	});
});

describe("tasksPluginQueryFence", () => {
	it("wraps the query in a tasks block", () => {
		expect(tasksPluginQueryFence({})).toBe("```tasks\nnot done\nlimit 10\n```");
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
}) {
	const { store, vault } = stubVault(opts.files);
	const plugins: Record<string, unknown> = {};
	if (opts.enabled !== false) plugins[TASKS_PLUGIN_ID] = { apiV1: opts.api };
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
