import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "obsidian";
import { inTaskScope, tasksEventRelevant } from "../src/taskscope";
import type { TasksConfig } from "../src/types";

/**
 * Both functions here are pure path/config logic (the obsidian import is only
 * the inert TFile/TFolder classes for `instanceof`). `tasksEventRelevant` is
 * the gate that lets a folder-scoped tasks card skip redraws, so its
 * "conservative by default" contract is pinned exhaustively: a wrong `false`
 * would silently leave a card stale — the one regression this feature must
 * never introduce.
 */

/** A shim TFile/TFolder carrying just the `path` the predicates read. */
function file(path: string): TFile {
	return Object.assign(new TFile(), { path });
}
function folder(path: string): TFolder {
	return Object.assign(new TFolder(), { path });
}

describe("inTaskScope", () => {
	it('"all" (explicit or defaulted) matches every path', () => {
		expect(inTaskScope("anything/at/all.md", {})).toBe(true);
		expect(inTaskScope("x.md", { folderScope: "all", folders: ["Tasks"] })).toBe(true);
	});

	it("whitelist matches the folder itself and its descendants only", () => {
		const cfg: TasksConfig = { folderScope: "whitelist", folders: ["Tasks"] };
		expect(inTaskScope("Tasks", cfg)).toBe(true);
		expect(inTaskScope("Tasks/todo.md", cfg)).toBe(true);
		expect(inTaskScope("Tasks/deep/nested.md", cfg)).toBe(true);
		// Sibling folder sharing the prefix must NOT match ("Tasks2" vs "Tasks/").
		expect(inTaskScope("Tasks2/todo.md", cfg)).toBe(false);
		expect(inTaskScope("Other/todo.md", cfg)).toBe(false);
	});

	it("blacklist is the whitelist match inverted", () => {
		const cfg: TasksConfig = { folderScope: "blacklist", folders: ["Archive"] };
		expect(inTaskScope("Archive/old.md", cfg)).toBe(false);
		expect(inTaskScope("Archive", cfg)).toBe(false);
		expect(inTaskScope("Notes/current.md", cfg)).toBe(true);
	});

	it("normalizes trailing slashes and whitespace in configured folders", () => {
		const cfg: TasksConfig = { folderScope: "whitelist", folders: [" Tasks/ "] };
		expect(inTaskScope("Tasks/todo.md", cfg)).toBe(true);
	});

	it("an empty whitelist matches nothing; an empty blacklist excludes nothing", () => {
		expect(inTaskScope("Tasks/todo.md", { folderScope: "whitelist", folders: [] })).toBe(false);
		expect(inTaskScope("Tasks/todo.md", { folderScope: "whitelist" })).toBe(false);
		expect(inTaskScope("Tasks/todo.md", { folderScope: "blacklist", folders: [] })).toBe(true);
	});
});

describe("tasksEventRelevant", () => {
	const whitelist: TasksConfig = { folderScope: "whitelist", folders: ["Tasks"] };

	it("missing config or 'all' scope treats every event as relevant", () => {
		expect(tasksEventRelevant(undefined, file("anywhere.md"))).toBe(true);
		expect(tasksEventRelevant({}, file("anywhere.md"))).toBe(true);
		expect(tasksEventRelevant({ folderScope: "all", folders: ["Tasks"] }, file("x.md"))).toBe(
			true,
		);
	});

	it("the kanban source is never filtered (board and linked notes may sit out of scope)", () => {
		const cfg: TasksConfig = { ...whitelist, source: "kanban" };
		expect(tasksEventRelevant(cfg, file("Elsewhere/board.md"))).toBe(true);
	});

	it("folder events always pass — an ancestor rename can move the scope's subtree", () => {
		// Renaming "Projects" (whitelist "Projects/Work") matches neither the
		// scope path nor its prefix, yet moves every scoped file; only files can
		// be proven irrelevant by path.
		const cfg: TasksConfig = { folderScope: "whitelist", folders: ["Projects/Work"] };
		expect(tasksEventRelevant(cfg, folder("Projects"), "Stuff")).toBe(true);
		expect(tasksEventRelevant(whitelist, folder("Unrelated"))).toBe(true);
	});

	it("whitelist: in-scope file events are relevant, out-of-scope are not", () => {
		expect(tasksEventRelevant(whitelist, file("Tasks/todo.md"))).toBe(true);
		expect(tasksEventRelevant(whitelist, file("Journal/2026-07-13.md"))).toBe(false);
		// tasknotes reads the same scoped file set as checkbox.
		expect(
			tasksEventRelevant({ ...whitelist, source: "tasknotes" }, file("Journal/x.md")),
		).toBe(false);
	});

	it("a rename is relevant when either side of the move touches the scope", () => {
		// Moved out: new path outside, old path inside.
		expect(tasksEventRelevant(whitelist, file("Archive/todo.md"), "Tasks/todo.md")).toBe(true);
		// Moved in: new path inside, old path outside.
		expect(tasksEventRelevant(whitelist, file("Tasks/todo.md"), "Inbox/todo.md")).toBe(true);
		// Moved entirely outside the scope.
		expect(tasksEventRelevant(whitelist, file("Archive/todo.md"), "Inbox/todo.md")).toBe(false);
	});

	it("blacklist: events inside the excluded folders are irrelevant", () => {
		const cfg: TasksConfig = { folderScope: "blacklist", folders: ["Archive"] };
		expect(tasksEventRelevant(cfg, file("Archive/old.md"))).toBe(false);
		expect(tasksEventRelevant(cfg, file("Notes/current.md"))).toBe(true);
		// A move out of the blacklist re-enters the scan; both sides checked.
		expect(tasksEventRelevant(cfg, file("Archive/x.md"), "Notes/x.md")).toBe(true);
	});
});
