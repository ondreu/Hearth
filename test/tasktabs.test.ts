import { describe, expect, it } from "vitest";
import {
	TASK_TAB_ALL,
	TASK_TAB_MAX_ROWS,
	TASK_TAB_OTHER,
	clearTaskTabChoice,
	resolveTaskTabRows,
	taskTabRevealsDone,
	sanitizeTaskTabRows,
	setTaskTabChoice,
	taskFacetValues,
	taskTabChoice,
	taskTabMask,
	type TaskTabFacts,
} from "../src/tasktabs";
import type { TaskTabRow } from "../src/types";

/** A row with the defaults the editor starts from. */
function row(overrides: Partial<TaskTabRow> = {}): TaskTabRow {
	return { id: Math.random().toString(36).slice(2), facet: "tag", mode: "auto", ...overrides };
}

function task(overrides: Partial<TaskTabFacts> = {}): TaskTabFacts {
	return { ...overrides };
}

describe("taskFacetValues", () => {
	it("folds a tag's case and keeps a nested tag whole", () => {
		expect(taskFacetValues(task({ tags: ["Work/Urgent"] }), "tag")).toEqual([
			{ key: "work/urgent", label: "#work/urgent" },
		]);
	});

	it("reads a project wikilink as its note name", () => {
		expect(taskFacetValues(task({ projects: ["[[Noting/Projects/Dropzone]]"] }), "project")).toEqual([
			{
				key: "noting/projects/dropzone",
				label: "Dropzone",
				raw: "[[Noting/Projects/Dropzone]]",
			},
		]);
	});

	it("gives a task without a priority the 'none' value", () => {
		expect(taskFacetValues(task({}), "priority")).toEqual([{ key: "none", label: "" }]);
	});

	it("maps an emoji priority to its key word", () => {
		expect(taskFacetValues(task({ priority: "⏫" }), "priority")).toEqual([
			{ key: "high", label: "high" },
		]);
	});

	it("reads a status from whichever source provides it", () => {
		expect(taskFacetValues(task({ status: "In Progress" }), "status")).toEqual([
			{ key: "in progress", label: "In Progress" },
		]);
	});
});

describe("resolveTaskTabRows", () => {
	const tasks = [
		task({ tags: ["work"], priority: "high" }),
		task({ tags: ["work", "urgent"], priority: "low" }),
		task({ tags: ["home"] }),
	];

	it("builds a tab per value, alphabetical, after an All tab", () => {
		const [resolved] = resolveTaskTabRows(tasks, [row({ facet: "tag" })]);
		expect(resolved.values.map((v) => [v.id, v.kind, v.count])).toEqual([
			[TASK_TAB_ALL, "all", 3],
			["home", "value", 1],
			["urgent", "value", 1],
			["work", "value", 2],
		]);
		expect(resolved.active).toBe(TASK_TAB_ALL);
	});

	it("orders a priority row highest first, with 'none' last", () => {
		const [resolved] = resolveTaskTabRows(tasks, [row({ facet: "priority" })]);
		expect(resolved.values.map((v) => v.id)).toEqual([TASK_TAB_ALL, "high", "low", "none"]);
	});

	it("uses the card's status order when it has one", () => {
		const hits = [task({ status: "done" }), task({ status: "open" }), task({ status: "hold" })];
		const [resolved] = resolveTaskTabRows(
			hits,
			[row({ facet: "status" })],
			undefined,
			["open", "hold", "done"],
		);
		expect(resolved.values.map((v) => v.id)).toEqual([TASK_TAB_ALL, "open", "hold", "done"]);
	});

	it("cascades: the second row only offers what the first one left", () => {
		const rows = [row({ facet: "tag" }), row({ facet: "priority" })];
		setTaskTabChoice(rows[0], "work");
		const [, second] = resolveTaskTabRows(tasks, rows);
		expect(second.values.map((v) => v.id)).toEqual([TASK_TAB_ALL, "high", "low"]);
	});

	it("counts a tab against the other rows' choices", () => {
		const rows = [row({ facet: "tag" }), row({ facet: "priority" })];
		setTaskTabChoice(rows[0], "work");
		const [first, second] = resolveTaskTabRows(tasks, rows);
		// All of the tag row keeps both work tasks; each priority tab then one.
		expect(first.values.find((v) => v.id === TASK_TAB_ALL)?.count).toBe(3);
		expect(second.values.find((v) => v.id === "high")?.count).toBe(1);
		expect(second.values.find((v) => v.id === "low")?.count).toBe(1);
		expect(second.values.find((v) => v.id === TASK_TAB_ALL)?.count).toBe(2);
	});

	it("honours the base narrowing (the card's own filter)", () => {
		// The card's filter keeps the first and the last task; #work is then
		// carried by one of them, so it still narrows.
		const [resolved] = resolveTaskTabRows(tasks, [row({ facet: "tag" })], [true, false, true]);
		expect(resolved.values.map((v) => [v.id, v.count])).toEqual([
			[TASK_TAB_ALL, 2],
			["home", 1],
			["work", 1],
		]);
	});

	it("appends an Other tab holding only what the row's tabs miss", () => {
		const [resolved] = resolveTaskTabRows(tasks, [
			row({ facet: "tag", mode: "fixed", values: ["work"], other: true }),
		]);
		expect(resolved.values.map((v) => [v.id, v.kind, v.count])).toEqual([
			[TASK_TAB_ALL, "all", 3],
			["work", "value", 2],
			[TASK_TAB_OTHER, "other", 1],
		]);
	});

	it("keeps a fixed row's order and gives a tag its # back", () => {
		const [resolved] = resolveTaskTabRows(tasks, [
			row({ facet: "tag", mode: "fixed", values: ["home", "work"], all: false }),
		]);
		expect(resolved.values.map((v) => [v.label, v.kind])).toEqual([
			["#home", "value"],
			["#work", "value"],
		]);
	});

	it("falls back to the first tab when the remembered value is gone", () => {
		const rows = [row({ facet: "tag" })];
		setTaskTabChoice(rows[0], "deleted-tag");
		const [resolved] = resolveTaskTabRows(tasks, rows);
		expect(resolved.active).toBe(TASK_TAB_ALL);
		expect(taskTabChoice(rows[0])).toBe(TASK_TAB_ALL);
	});
});

describe("taskTabMask", () => {
	const tasks = [
		task({ tags: ["work"], priority: "high" }),
		task({ tags: ["work"], priority: "low" }),
		task({ tags: ["home"] }),
	];

	it("lets through only what every row shows", () => {
		const rows = [row({ facet: "tag" }), row({ facet: "priority" })];
		setTaskTabChoice(rows[0], "work");
		setTaskTabChoice(rows[1], "high");
		const resolved = resolveTaskTabRows(tasks, rows);
		expect(taskTabMask(tasks, resolved)).toEqual([true, false, false]);
	});

	it("shows everything when each row is on All", () => {
		const rows = [row({ facet: "tag" }), row({ facet: "priority" })];
		const resolved = resolveTaskTabRows(tasks, rows);
		expect(taskTabMask(tasks, resolved)).toEqual([true, true, true]);
	});

	it("shows only the tasks no tab matches when Other is picked", () => {
		const rows = [row({ facet: "tag", mode: "fixed", values: ["work"], other: true })];
		setTaskTabChoice(rows[0], TASK_TAB_OTHER);
		const resolved = resolveTaskTabRows(tasks, rows);
		expect(taskTabMask(tasks, resolved)).toEqual([false, false, true]);
	});
});

describe("edge cases the strip must survive", () => {
	const hits = [
		task({ tags: ["work"], priority: "high" }),
		task({ tags: ["home"] }),
	];

	it("does not draw a row that cannot narrow anything", () => {
		// Auto tag row on a card whose tasks carry no tags: the row would be a
		// caption with no choice, so it is left out entirely.
		expect(
			resolveTaskTabRows([task({})], [row({ facet: "tag", mode: "auto", all: false })]),
		).toEqual([]);
	});

	it("treats a fixed row with no values as an auto one", () => {
		const [resolved] = resolveTaskTabRows(hits, [
			row({ facet: "tag", mode: "fixed", values: [] }),
		]);
		expect(resolved.values.map((v) => v.id)).toEqual([TASK_TAB_ALL, "home", "work"]);
	});

	it("matches a fixed project written as the note name", () => {
		const projects = [task({ projects: ["[[Noting/Projects/Dropzone]]"] })];
		const [resolved] = resolveTaskTabRows(projects, [
			row({ facet: "project", mode: "fixed", values: ["Dropzone"] }),
		]);
		expect(resolved.values.find((v) => v.kind === "value")?.count).toBe(1);
	});

	it("tells two same-named projects apart", () => {
		const projects = [
			task({ projects: ["[[A/Website]]"] }),
			task({ projects: ["[[B/Website]]"] }),
		];
		const [resolved] = resolveTaskTabRows(projects, [row({ facet: "project" })]);
		expect(resolved.values.filter((v) => v.kind === "value").map((v) => v.label)).toEqual([
			"Website · A",
			"Website · B",
		]);
	});

	it("does not draw the same fixed value twice", () => {
		const [resolved] = resolveTaskTabRows(hits, [
			row({ facet: "tag", mode: "fixed", values: ["work", "Work", "#work"] }),
		]);
		expect(resolved.values.filter((v) => v.kind === "value").map((v) => v.label)).toEqual([
			"#work",
		]);
	});

	it("drops the value a row above already fixed, and hides a row left with nothing", () => {
		// "rondo" picked in a tag row: every task that survived carries it, so
		// a second tag row has no business offering it again.
		const tagged = [task({ tags: ["rondo", "kontrola"] }), task({ tags: ["rondo"] })];
		const rows = [row({ facet: "tag", mode: "fixed", values: ["rondo"] }), row({ facet: "tag" })];
		setTaskTabChoice(rows[0], "rondo");
		const [, second] = resolveTaskTabRows(tagged, rows);
		expect(second.values.map((v) => v.id)).toEqual([TASK_TAB_ALL, "kontrola"]);

		// With nothing but the picked tag left, the second row is not drawn.
		const onlyRondo = [task({ tags: ["rondo"] }), task({ tags: ["rondo"] })];
		const rows2 = [
			row({ facet: "tag", mode: "fixed", values: ["rondo"] }),
			row({ facet: "tag" }),
		];
		setTaskTabChoice(rows2[0], "rondo");
		expect(resolveTaskTabRows(onlyRondo, rows2)).toHaveLength(1);
	});

	it("counts a done status tab and reveals its completed tasks", () => {
		const hits = [
			task({ status: "Todo" }),
			task({ status: "Done", done: true }),
		];
		const rows = [row({ facet: "status" })];
		const resolvedRows = resolveTaskTabRows(hits, rows);
		const [resolved] = resolvedRows;
		// The done tab counts the completed task even though the list hides
		// completed tasks by default; the open tabs do not count it.
		expect(resolved.values.map((v) => [v.id, v.count])).toEqual([
			[TASK_TAB_ALL, 1],
			["todo", 1],
			["done", 1],
		]);
		expect(taskTabRevealsDone(hits, resolvedRows)).toBe(false);

		// Picking it is an explicit request for those tasks.
		setTaskTabChoice(rows[0], "done");
		const [done] = resolveTaskTabRows(hits, rows);
		expect(done.active).toBe("done");
		expect(done.values.find((v) => v.id === TASK_TAB_ALL)?.count).toBe(2);
		expect(taskTabRevealsDone(hits, [done])).toBe(true);
	});

	it("drops the remembered choice when the facet changes", () => {
		const rows = [row({ facet: "tag" })];
		setTaskTabChoice(rows[0], "work");
		clearTaskTabChoice(rows[0]);
		expect(taskTabChoice(rows[0])).toBeUndefined();
	});
});

describe("sanitizeTaskTabRows", () => {
	it("falls back to tag on an unknown facet, and to auto on an empty fixed row", () => {
		expect(
			sanitizeTaskTabRows([
				{ id: "a", facet: "nope", mode: "fixed", values: [] },
				{ id: "b", facet: "project", mode: "auto" },
			]),
		).toEqual([
			{ id: "a", facet: "tag", mode: "auto" },
			{ id: "b", facet: "project", mode: "auto" },
		]);
	});

	it("caps the number of rows and keeps flags only when set", () => {
		const raw = Array.from({ length: TASK_TAB_MAX_ROWS + 3 }, (_, i) => ({
			id: `r${i}`,
			facet: "tag",
			mode: "auto",
			other: true,
			all: false,
		}));
		const rows = sanitizeTaskTabRows(raw) ?? [];
		expect(rows).toHaveLength(TASK_TAB_MAX_ROWS);
		expect(rows[0]).toMatchObject({ other: true, all: false });
	});

	it("returns undefined when nothing survives", () => {
		expect(sanitizeTaskTabRows("nope")).toBeUndefined();
		expect(sanitizeTaskTabRows([])).toBeUndefined();
		// A cleared fixed row survives as an auto one instead of vanishing.
		expect(sanitizeTaskTabRows([{ id: "x", facet: "tag", mode: "fixed" }])).toEqual([
			{ id: "x", facet: "tag", mode: "auto" },
		]);
	});
});
