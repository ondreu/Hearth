import { describe, expect, it } from "vitest";
import {
	completionEdit,
	DEFAULT_TASKNOTES_LAYERS,
	dailyNoteDayKey,
	isCompletedStatus,
	normalizeRecurrence,
	parseTaskDate,
	parseSubscriptions,
	parseTaskNotesSettings,
	readTaskNotesTask,
	readTimeblocks,
	taskNotesEvents,
	taskNotesMeta,
	timeblockOccurrences,
	type TaskNotesLayerOptions,
	type TaskNotesSetup,
	type TaskNotesTask,
} from "../src/tasknotes";
import { moment } from "obsidian";

/**
 * The TaskNotes reader is tested against the shapes TaskNotes actually writes:
 * its settings object (field mapping, custom statuses/priorities, calendar
 * subscriptions), task frontmatter, and daily-note timeblocks. vitest forces
 * TZ=UTC (see vitest.config.ts), so every epoch assertion is deterministic.
 */

const day = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Settings as a default TaskNotes install writes them. */
function settings(overrides: Record<string, unknown> = {}): unknown {
	return {
		taskTag: "task",
		taskIdentificationMethod: "tag",
		fieldMapping: { due: "due", scheduled: "scheduled", status: "status", priority: "priority" },
		customStatuses: [
			{ value: "none", label: "None", color: "#cccccc", isCompleted: false, order: 0 },
			{ value: "open", label: "Open", color: "#888888", isCompleted: false, order: 1 },
			{ value: "in-progress", label: "In progress", color: "#3b82f6", isCompleted: false, order: 2 },
			{ value: "done", label: "Done", color: "#22c55e", isCompleted: true, order: 3 },
		],
		customPriorities: [
			{ value: "high", label: "High", color: "#ef4444", weight: 3 },
			{ value: "normal", label: "Normal", color: "#eab308", weight: 2 },
		],
		...overrides,
	};
}

function setupFrom(overrides: Record<string, unknown> = {}): TaskNotesSetup {
	return parseTaskNotesSettings(settings(overrides));
}

function layers(overrides: Partial<TaskNotesLayerOptions> = {}): TaskNotesLayerOptions {
	return { ...DEFAULT_TASKNOTES_LAYERS, ...overrides };
}

function task(overrides: Partial<TaskNotesTask> = {}): TaskNotesTask {
	return {
		path: "Tasks/Write docs.md",
		title: "Write docs",
		status: "open",
		priority: "normal",
		due: null,
		scheduled: null,
		recurrence: null,
		completeInstances: [],
		contexts: [],
		projects: [],
		timeEstimate: null,
		archived: false,
		done: false,
		...overrides,
	};
}

describe("parseTaskNotesSettings", () => {
	it("falls back to TaskNotes' defaults for an empty/absent settings object", () => {
		const setup = parseTaskNotesSettings(undefined);
		expect(setup.fields.due).toBe("due");
		expect(setup.fields.completeInstances).toBe("complete_instances");
		expect(setup.identify).toEqual({ method: "tag", tag: "task", property: "", value: "" });
		expect(setup.defaultTimeEstimate).toBe(60);
		expect(setup.calendar).toEqual({
			scheduled: true,
			due: true,
			recurring: true,
			timeblocks: false,
		});
	});

	it("reads a remapped field name and leaves the rest defaulted", () => {
		const setup = setupFrom({ fieldMapping: { due: "deadline" } });
		expect(setup.fields.due).toBe("deadline");
		expect(setup.fields.scheduled).toBe("scheduled");
	});

	it("reads custom statuses and priorities with their colours", () => {
		const setup = setupFrom();
		expect(setup.statuses.map((s) => s.value)).toEqual([
			"none",
			"open",
			"in-progress",
			"done",
		]);
		expect(setup.statuses[3].isCompleted).toBe(true);
		expect(setup.priorities[0]).toEqual({
			value: "high",
			label: "High",
			color: "#ef4444",
			weight: 3,
		});
	});

	it("reads calendar subscriptions from settings when a version keeps them there", () => {
		const setup = setupFrom({
			icsIntegration: {
				subscriptions: [
					{ id: "a", name: "Work", type: "remote", url: "https://example.com/w.ics", color: "#f00" },
					{ id: "b", name: "Local", filePath: "Calendars/home.ics", enabled: false },
					{ id: "c", name: "Nothing" },
				],
			},
		});
		expect(setup.subscriptions).toEqual([
			{
				id: "a",
				name: "Work",
				type: "remote",
				url: "https://example.com/w.ics",
				filePath: "",
				color: "#f00",
				enabled: true,
			},
			{
				id: "b",
				name: "Local",
				type: "local",
				url: "",
				filePath: "Calendars/home.ics",
				color: "",
				enabled: false,
			},
		]);
	});

	it("finds no subscriptions in the settings of a current TaskNotes (they live in its plugin data)", () => {
		expect(setupFrom().subscriptions).toEqual([]);
	});

	it("mirrors TaskNotes' calendar layer toggles", () => {
		const setup = setupFrom({
			calendarViewSettings: { defaultShowDue: false, enableTimeblocking: true },
		});
		expect(setup.calendar.due).toBe(false);
		expect(setup.calendar.timeblocks).toBe(true);
		expect(setup.calendar.scheduled).toBe(true);
	});

	it("keeps statuses in TaskNotes' configured order, not file order", () => {
		const setup = setupFrom({
			customStatuses: [
				{ value: "done", label: "Done", isCompleted: true, order: 2 },
				{ value: "open", label: "Open", isCompleted: false, order: 1 },
			],
		});
		expect(setup.statuses.map((s) => s.value)).toEqual(["open", "done"]);
	});

	it("gives a timed task an hour when TaskNotes' default estimate is 0", () => {
		// TaskNotes ships defaultTimeEstimate: 0, which is not a drawable length.
		expect(setupFrom({ defaultTimeEstimate: 0 }).defaultTimeEstimate).toBe(60);
		expect(setupFrom({ defaultTimeEstimate: 25 }).defaultTimeEstimate).toBe(25);
	});
});

describe("parseSubscriptions", () => {
	it("reads the list TaskNotes persists in its plugin data", () => {
		// Exactly the shape TaskNotes' subscription service writes under
		// `icsSubscriptions` in .obsidian/plugins/tasknotes/data.json.
		const list = parseSubscriptions([
			{
				id: "ics_1",
				name: "Family",
				type: "remote",
				url: "https://calendar.google.com/basic.ics",
				enabled: true,
				refreshInterval: 60,
				color: "#3b82f6",
			},
			{ id: "ics_2", name: "Holidays", type: "local", filePath: "Calendars/holidays.ics", enabled: true },
		]);
		expect(list.map((s) => [s.id, s.type, s.enabled])).toEqual([
			["ics_1", "remote", true],
			["ics_2", "local", true],
		]);
	});

	it("infers a missing type from which location is set", () => {
		expect(parseSubscriptions([{ id: "x", url: "https://a/b.ics" }])[0].type).toBe("remote");
		expect(parseSubscriptions([{ id: "y", filePath: "a.ics" }])[0].type).toBe("local");
	});

	it("ignores anything that isn't a list of fetchable subscriptions", () => {
		expect(parseSubscriptions(undefined)).toEqual([]);
		expect(parseSubscriptions([{ id: "z", name: "No location" }, "nonsense"])).toEqual([]);
	});
});

describe("isCompletedStatus", () => {
	it("uses the status' own isCompleted flag", () => {
		const setup = setupFrom();
		expect(isCompletedStatus(setup, "done")).toBe(true);
		expect(isCompletedStatus(setup, "in-progress")).toBe(false);
	});

	it("falls back to conventional wording when the status isn't defined", () => {
		const setup = parseTaskNotesSettings({});
		expect(isCompletedStatus(setup, "completed")).toBe(true);
		expect(isCompletedStatus(setup, "waiting")).toBe(false);
	});
});

describe("readTaskNotesTask", () => {
	const setup = setupFrom();

	it("reads a tagged task note", () => {
		const read = readTaskNotesTask(
			setup,
			"Tasks/Ship it.md",
			{
				title: "Ship it",
				status: "in-progress",
				priority: "high",
				due: "2026-08-10",
				scheduled: "2026-08-07T09:00",
				timeEstimate: 45,
				contexts: ["work"],
				complete_instances: ["2026-08-01"],
			},
			["task"],
		);
		expect(read).toMatchObject({
			title: "Ship it",
			status: "in-progress",
			priority: "high",
			due: "2026-08-10",
			scheduled: "2026-08-07T09:00",
			timeEstimate: 45,
			contexts: ["work"],
			completeInstances: ["2026-08-01"],
			done: false,
		});
	});

	it("ignores a note that isn't a task", () => {
		expect(readTaskNotesTask(setup, "Notes/Idea.md", { summary: "nope" }, [])).toBeNull();
	});

	it("honours the property identification method", () => {
		const byProperty = setupFrom({
			taskIdentificationMethod: "property",
			taskPropertyName: "type",
			taskPropertyValue: "task",
		});
		expect(readTaskNotesTask(byProperty, "a.md", { type: "task" }, [])).not.toBeNull();
		expect(readTaskNotesTask(byProperty, "b.md", { type: "note" }, [])).toBeNull();
	});

	it("marks a task carrying the archive tag", () => {
		const read = readTaskNotesTask(setup, "a.md", { status: "open" }, ["task", "archived"]);
		expect(read?.archived).toBe(true);
	});

	it("falls back to the filename when no title property is set", () => {
		const read = readTaskNotesTask(setup, "Tasks/Buy milk.md", { status: "open" }, ["task"]);
		expect(read?.title).toBe("Buy milk");
	});
});

describe("parseTaskDate", () => {
	it("reads a date-only value as all-day", () => {
		expect(parseTaskDate("2026-08-07")).toEqual({ ms: day("2026-08-07"), allDay: true });
	});

	it("reads a timed value as local wall-clock", () => {
		expect(parseTaskDate("2026-08-07T09:30")).toEqual({
			ms: new Date("2026-08-07T09:30:00Z").getTime(),
			allDay: false,
		});
	});

	it("rejects nonsense", () => {
		expect(parseTaskDate("tomorrow")).toBeNull();
	});
});

describe("normalizeRecurrence", () => {
	it("strips the RRULE prefix", () => {
		expect(normalizeRecurrence("RRULE:FREQ=WEEKLY;BYDAY=MO")).toBe("FREQ=WEEKLY;BYDAY=MO");
	});

	it("maps legacy words onto a FREQ", () => {
		expect(normalizeRecurrence("weekly")).toBe("FREQ=WEEKLY");
		expect(normalizeRecurrence("biweekly")).toBe("FREQ=WEEKLY;INTERVAL=2");
	});

	it("returns null for something it can't read", () => {
		expect(normalizeRecurrence("every other Tuesday-ish")).toBeNull();
		expect(normalizeRecurrence("")).toBeNull();
	});
});

describe("taskNotesEvents", () => {
	const setup = setupFrom();
	const window = { start: day("2026-08-01"), end: day("2026-09-01") };

	it("draws a scheduled task, sized by its time estimate", () => {
		const [occ] = taskNotesEvents(
			[task({ scheduled: "2026-08-07T09:00", timeEstimate: 30 })],
			setup,
			layers(),
			window.start,
			window.end,
		);
		expect(occ.allDay).toBe(false);
		expect(occ.end! - occ.start).toBe(30 * 60_000);
		expect(taskNotesMeta(occ)).toMatchObject({ kind: "scheduled", dayKey: "2026-08-07" });
	});

	it("uses TaskNotes' default estimate when the task has none", () => {
		const [occ] = taskNotesEvents(
			[task({ scheduled: "2026-08-07T09:00" })],
			setup,
			layers(),
			window.start,
			window.end,
		);
		expect(occ.end! - occ.start).toBe(60 * 60_000);
	});

	it("draws scheduled and due as separate entries", () => {
		const occ = taskNotesEvents(
			[task({ scheduled: "2026-08-07", due: "2026-08-10" })],
			setup,
			layers(),
			window.start,
			window.end,
		);
		expect(occ.map((o) => taskNotesMeta(o)!.kind)).toEqual(["scheduled", "due"]);
	});

	it("draws one entry when scheduled and due fall on the same day", () => {
		const occ = taskNotesEvents(
			[task({ scheduled: "2026-08-07", due: "2026-08-07" })],
			setup,
			layers(),
			window.start,
			window.end,
		);
		expect(occ).toHaveLength(1);
	});

	it("unrolls a recurring task into one entry per occurrence", () => {
		const occ = taskNotesEvents(
			[task({ scheduled: "2026-08-03", recurrence: "FREQ=WEEKLY" })],
			setup,
			layers(),
			window.start,
			window.end,
		);
		expect(occ.map((o) => taskNotesMeta(o)!.dayKey)).toEqual([
			"2026-08-03",
			"2026-08-10",
			"2026-08-17",
			"2026-08-24",
			"2026-08-31",
		]);
	});

	it("marks only the occurrences listed in complete_instances", () => {
		const occ = taskNotesEvents(
			[
				task({
					scheduled: "2026-08-03",
					recurrence: "FREQ=WEEKLY",
					completeInstances: ["2026-08-10"],
				}),
			],
			setup,
			layers(),
			window.start,
			window.end,
		);
		const done = occ.filter((o) => taskNotesMeta(o)!.done).map((o) => taskNotesMeta(o)!.dayKey);
		expect(done).toEqual(["2026-08-10"]);
	});

	it("draws only the anchor date when the recurring layer is off", () => {
		const occ = taskNotesEvents(
			[task({ scheduled: "2026-08-03", recurrence: "FREQ=WEEKLY" })],
			setup,
			layers({ recurring: false }),
			window.start,
			window.end,
		);
		expect(occ).toHaveLength(1);
	});

	it("hides completed and archived tasks when their layers are off", () => {
		const tasks = [
			task({ path: "a.md", scheduled: "2026-08-07", status: "done", done: true }),
			task({ path: "b.md", scheduled: "2026-08-07", archived: true }),
			task({ path: "c.md", scheduled: "2026-08-07" }),
		];
		const occ = taskNotesEvents(
			tasks,
			setup,
			layers({ completed: false }),
			window.start,
			window.end,
		);
		expect(occ.map((o) => taskNotesMeta(o)!.path)).toEqual(["c.md"]);
	});

	it("colours by status, priority or a fixed colour", () => {
		const one = task({ scheduled: "2026-08-07", status: "in-progress", priority: "high" });
		const color = (opts: Partial<TaskNotesLayerOptions>) =>
			taskNotesMeta(
				taskNotesEvents([one], setup, layers(opts), window.start, window.end)[0],
			)!.color;
		expect(color({ colorBy: "status" })).toBe("#3b82f6");
		expect(color({ colorBy: "priority" })).toBe("#ef4444");
		expect(color({ colorBy: "fixed", fallbackColor: "#123456" })).toBe("#123456");
	});

	it("gives due entries their own colour when one is set", () => {
		const occ = taskNotesEvents(
			[task({ due: "2026-08-07" })],
			setup,
			layers({ dueColor: "#ff0000" }),
			window.start,
			window.end,
		);
		expect(taskNotesMeta(occ[0])!.color).toBe("#ff0000");
	});

	it("skips a layer that is switched off", () => {
		const occ = taskNotesEvents(
			[task({ scheduled: "2026-08-07", due: "2026-08-10" })],
			setup,
			layers({ due: false }),
			window.start,
			window.end,
		);
		expect(occ.map((o) => taskNotesMeta(o)!.kind)).toEqual(["scheduled"]);
	});
});

describe("timeblocks", () => {
	it("reads the blocks a daily note carries, skipping unusable entries", () => {
		const blocks = readTimeblocks([
			{ id: "1", title: "Deep work", startTime: "9:00", endTime: "10:30", color: "#abc" },
			{ title: "No start" },
			"nonsense",
		]);
		expect(blocks).toEqual([
			{
				id: "1",
				title: "Deep work",
				startTime: "09:00",
				endTime: "10:30",
				color: "#abc",
				attachments: [],
				description: "",
			},
		]);
	});

	it("places a block on its daily note's day", () => {
		const [occ] = timeblockOccurrences(
			"2026-08-07",
			readTimeblocks([{ title: "Deep work", startTime: "09:00", endTime: "10:30" }]),
			"Daily/2026-08-07.md",
			"#7c6cff",
		);
		expect(occ.start).toBe(new Date("2026-08-07T09:00:00Z").getTime());
		expect(occ.end).toBe(new Date("2026-08-07T10:30:00Z").getTime());
		expect(taskNotesMeta(occ)).toMatchObject({ kind: "timeblock", path: "Daily/2026-08-07.md" });
	});

	it("drops an end that isn't after the start", () => {
		const [occ] = timeblockOccurrences(
			"2026-08-07",
			readTimeblocks([{ title: "Odd", startTime: "23:00", endTime: "01:00" }]),
			"Daily/2026-08-07.md",
			"",
		);
		expect(occ.end).toBeNull();
	});
});

describe("dailyNoteDayKey", () => {
	const parse = (input: string, format: string) => moment(input, format, true);

	it("reads the date out of a daily note's own format", () => {
		expect(dailyNoteDayKey("Journal/2026-08-07.md", "YYYY-MM-DD", parse)).toBe("2026-08-07");
		expect(dailyNoteDayKey("Journal/07-08-2026.md", "DD-MM-YYYY", parse)).toBe("2026-08-07");
	});

	it("falls back to an embedded ISO date when the format doesn't match", () => {
		expect(dailyNoteDayKey("Journal/Week 2026-08-07 notes.md", "YYYY-MM-DD", parse)).toBe(
			"2026-08-07",
		);
	});

	it("returns null for a note that carries no date", () => {
		expect(dailyNoteDayKey("Journal/Random.md", "YYYY-MM-DD", parse)).toBeNull();
	});
});

describe("completionEdit", () => {
	const setup = setupFrom();

	it("records a recurring task's day in complete_instances, sorted", () => {
		const edit = completionEdit(
			setup,
			task({ recurrence: "FREQ=WEEKLY", completeInstances: ["2026-08-17"] }),
			"2026-08-10",
			true,
		);
		expect(edit).toEqual({ complete_instances: ["2026-08-10", "2026-08-17"] });
	});

	it("removes the day again when the occurrence is reopened", () => {
		const edit = completionEdit(
			setup,
			task({ recurrence: "FREQ=WEEKLY", completeInstances: ["2026-08-10", "2026-08-17"] }),
			"2026-08-10",
			false,
		);
		expect(edit).toEqual({ complete_instances: ["2026-08-17"] });
	});

	it("skips TaskNotes' placeholder \"none\" status when reopening a task", () => {
		// "none" means "no status set" — reopening into it would hide the task
		// from TaskNotes' own status-filtered views.
		expect(completionEdit(setup, task({ status: "done", done: true }), "2026-08-10", false)).toMatchObject(
			{ status: "open" },
		);
	});

	it("never writes a status TaskNotes doesn't define", () => {
		const custom = setupFrom({
			customStatuses: [
				{ value: "todo", label: "To do", isCompleted: false, order: 0 },
				{ value: "shipped", label: "Shipped", isCompleted: true, order: 1 },
			],
		});
		expect(completionEdit(custom, task(), "2026-08-10", true)).toMatchObject({ status: "shipped" });
		expect(
			completionEdit(custom, task({ status: "shipped", done: true }), "2026-08-10", false),
		).toMatchObject({ status: "todo" });
	});

	it("moves a one-off task's status to TaskNotes' own completed status", () => {
		expect(completionEdit(setup, task(), "2026-08-10", true)).toEqual({
			status: "done",
			completedDate: "2026-08-10",
		});
	});

	it("reopens a one-off task to the first open status and clears the date", () => {
		expect(completionEdit(setup, task({ status: "done", done: true }), "2026-08-10", false)).toEqual({
			status: "open",
			completedDate: "",
		});
	});
});
