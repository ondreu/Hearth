import { beforeAll, describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import type { TaskHit } from "../src/cards/tasks";
import { priorityRank } from "../src/priority";

let collectTaskFilterChoices: typeof import("../src/cards/tasks").collectTaskFilterChoices;
let sortHits: typeof import("../src/cards/tasks").sortHits;
let sortTasks: typeof import("../src/cards/tasks").sortTasks;

beforeAll(async () => {
	// Seed the module graph through the registry, the same way the TUI card test
	// does: cards/tasks.ts reaches the registry through editors.ts, and importing
	// it first evaluates the registry against a half-initialised cycle.
	await import("../src/cards/index");
	({ collectTaskFilterChoices, sortHits, sortTasks } = await import("../src/cards/tasks"));
});

/** A task with only the fields a sort reads. */
function task(overrides: Partial<TaskHit> & { name?: string } = {}): TaskHit {
	const name = overrides.name ?? "task";
	return {
		file: { path: `${name}.md`, basename: name } as unknown as TFile,
		line: 0,
		text: name,
		done: false,
		due: null,
		dueRaw: null,
		scheduled: null,
		created: 0,
		...overrides,
	};
}

const names = (hits: TaskHit[]) => hits.map((h) => h.file.basename);

describe("priorityRank with unmarkedAsNormal", () => {
	it("keeps an absent priority last by default", () => {
		expect(priorityRank(undefined)).toBe(5);
		expect(priorityRank("")).toBe(5);
	});

	it("ranks a missing priority as Normal only when asked", () => {
		// Normal sits between Medium and Low in the Tasks plugin's own order.
		expect(priorityRank(undefined, true)).toBeGreaterThan(priorityRank("medium"));
		expect(priorityRank(undefined, true)).toBeLessThan(priorityRank("low"));
		expect(priorityRank("", true)).toBe(priorityRank(undefined, true));
	});

	it("still ranks an unrecognised value last", () => {
		expect(priorityRank("banana", true)).toBe(5);
	});
});

describe("sortHits by priority", () => {
	it("puts an unmarked Obsidian Tasks task between Medium and Low", () => {
		const hits = [
			task({ name: "highest", priority: "🔺" }),
			task({ name: "lowest", priority: "⏬" }),
			task({ name: "unmarked" }),
			task({ name: "medium", priority: "🔼" }),
		];
		sortHits(hits, "priority", false, "obsidian-tasks");
		expect(names(hits)).toEqual(["highest", "medium", "unmarked", "lowest"]);
	});

	it("keeps an unmarked TaskNotes task last (#145)", () => {
		const hits = [
			task({ name: "unmarked" }),
			task({ name: "lowest", priority: "lowest" }),
			task({ name: "high", priority: "high" }),
		];
		sortHits(hits, "priority", false, "tasknotes");
		expect(names(hits)).toEqual(["high", "lowest", "unmarked"]);
	});
});

describe("sortHits by date", () => {
	const hits = () => [
		task({ name: "scheduled-only", scheduled: "2030-01-01", priority: "🔼" }),
		task({ name: "later-due", due: "2030-01-20", priority: "🔼" }),
		task({ name: "earlier-due", due: "2030-01-10", priority: "🔼" }),
	];

	it("sorts by due only, so a scheduled date does not pull a task forward (#508)", () => {
		const list = hits();
		sortHits(list, "due", false, "obsidian-tasks");
		expect(names(list)).toEqual(["earlier-due", "later-due", "scheduled-only"]);
	});

	it("sorts by scheduled on its own", () => {
		const list = hits();
		sortHits(list, "scheduled", false, "obsidian-tasks");
		expect(names(list)).toEqual(["scheduled-only", "earlier-due", "later-due"]);
	});

	it("sorts by start on its own", () => {
		const list = [
			task({ name: "later-start", start: "2030-02-01" }),
			task({ name: "no-start" }),
			task({ name: "earlier-start", start: "2030-01-15" }),
		];
		sortHits(list, "start", false, "obsidian-tasks");
		expect(names(list)).toEqual(["earlier-start", "later-start", "no-start"]);
	});

	it("sorts a custom rule list priority-then-due strictly", () => {
		const list = [
			task({ name: "medium-no-due", priority: "🔼" }),
			task({ name: "unmarked-early-due", due: "2030-01-05" }),
			task({ name: "unmarked-late-due", due: "2030-06-01" }),
		];
		sortTasks(list, {
			source: "obsidian-tasks",
			sortRules: [{ field: "priority" }, { field: "due" }],
		});
		// An explicit Medium sorts above an unmarked line (Normal sits after
		// Medium), then the due date orders the two unmarked tasks.
		expect(names(list)).toEqual(["medium-no-due", "unmarked-early-due", "unmarked-late-due"]);
	});
});

describe("collectTaskFilterChoices date fields", () => {
	it("offers only the date fields the tasks actually carry", () => {
		const choices = collectTaskFilterChoices(
			[
				task({ due: "2030-01-01" }),
				task({ scheduled: "2030-01-02" }),
				task({ start: "2030-01-03" }),
				task({ due: "2030-01-04" }),
			],
			"obsidian-tasks",
		);
		expect(choices.dateFields).toEqual(["due", "scheduled", "start"]);
		const onlyDue = collectTaskFilterChoices([task({ due: "2030-01-01" }), task()], "obsidian-tasks");
		expect(onlyDue.dateFields).toEqual(["due"]);
	});
});
