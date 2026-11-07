import { describe, expect, it } from "vitest";
import {
	type TaskChuteInstance,
	type TaskChuteLogSnapshot,
	formatTaskChuteDay,
	formatTaskChuteDuration,
	formatTaskChuteMinutes,
	taskChuteDayCounts,
	taskChuteDayMinutes,
	taskChuteElapsed,
	taskChuteProgress,
	taskChuteReorder,
	taskChuteRows,
	taskChuteSectionLabel,
	taskChuteSections,
	taskChuteTime,
	taskChuteTitle,
} from "../src/taskchute";

/** A day's model row. Only the fields the card reads; the plugin's real
 * instance carries plenty more. */
function inst(over: Partial<TaskChuteInstance> = {}): TaskChuteInstance {
	return {
		instanceId: over.instanceId ?? "i1",
		state: over.state ?? "idle",
		task: { name: "Task", ...over.task },
		...over,
	};
}

describe("taskChuteTitle", () => {
	it("prefers the title the plugin executed over the note name", () => {
		expect(
			taskChuteTitle(inst({ executedTitle: "Renamed while running", task: { name: "note-name" } })),
		).toBe("Renamed while running");
	});

	it("falls back through display title and note name, ignoring blanks", () => {
		expect(taskChuteTitle(inst({ executedTitle: "  ", task: { displayTitle: "Shown", name: "note" } }))).toBe("Shown");
		expect(taskChuteTitle(inst({ task: { name: "note" } }))).toBe("note");
		expect(taskChuteTitle(inst({ task: {} }))).toBe("");
	});
});

describe("taskChuteTime", () => {
	it("shows the scheduled slot when there is one", () => {
		expect(taskChuteTime(inst({ task: { scheduledTime: "09:30" } }))).toBe("09:30");
	});

	it("shows when it was started when the task has no schedule", () => {
		const start = new Date(2026, 10, 7, 8, 5, 0);
		expect(taskChuteTime(inst({ startTime: start }))).toBe("08:05");
	});

	it("is empty for an idle, unscheduled task", () => {
		expect(taskChuteTime(inst())).toBe("");
	});
});

describe("taskChuteRows", () => {
	it("drops rows the plugin has no title for", () => {
		const rows = taskChuteRows([
			inst({ instanceId: "a", task: { name: "One" } }),
			inst({ instanceId: "b", task: {} }),
		]);
		expect(rows.map((r) => r.instanceId)).toEqual(["a"]);
	});

	it("pulls the running task to the top and keeps the rest in plugin order", () => {
		const rows = taskChuteRows([
			inst({ instanceId: "a", task: { name: "A" } }),
			inst({ instanceId: "b", task: { name: "B" } }),
			inst({ instanceId: "c", task: { name: "C" }, state: "running" }),
		]);
		expect(rows.map((r) => r.instanceId)).toEqual(["c", "a", "b"]);
	});

	it("does not mutate the array it was given", () => {
		const input = [
			inst({ instanceId: "a", task: { name: "A" } }),
			inst({ instanceId: "b", task: { name: "B" }, state: "running" }),
		];
		taskChuteRows(input);
		expect(input.map((r) => r.instanceId)).toEqual(["a", "b"]);
	});
});

describe("taskChuteProgress", () => {
	it("counts finished over all, ignoring untitled rows", () => {
		expect(
			taskChuteProgress([
				inst({ state: "done", task: { name: "A" } }),
				inst({ state: "idle", task: { name: "B" } }),
				inst({ state: "running", task: { name: "C" } }),
				inst({ state: "done", task: {} }),
			]),
		).toEqual({ done: 1, total: 3 });
	});

	it("is 0/0 for an empty day", () => {
		expect(taskChuteProgress([])).toEqual({ done: 0, total: 0 });
	});
});

describe("taskChuteElapsed", () => {
	it("counts whole seconds since the start", () => {
		const start = new Date(2026, 10, 7, 9, 0, 0);
		expect(taskChuteElapsed(inst({ startTime: start }), start.getTime() + 754_000)).toBe(754);
	});

	it("is zero for a task that isn't running", () => {
		expect(taskChuteElapsed(inst())).toBe(0);
	});
});

describe("formatTaskChuteDuration", () => {
	it("shows mm:ss under an hour and h:mm:ss above it", () => {
		expect(formatTaskChuteDuration(7)).toBe("00:07");
		expect(formatTaskChuteDuration(754)).toBe("12:34");
		expect(formatTaskChuteDuration(3725)).toBe("1:02:05");
	});

	it("never shows a negative clock", () => {
		expect(formatTaskChuteDuration(-10)).toBe("00:00");
	});
});

describe("formatTaskChuteMinutes", () => {
	it("reads like a person would say it", () => {
		expect(formatTaskChuteMinutes(45)).toBe("45 min");
		expect(formatTaskChuteMinutes(60)).toBe("1 h");
		expect(formatTaskChuteMinutes(80)).toBe("1 h 20 min");
		expect(formatTaskChuteMinutes(0)).toBe("0 min");
	});
});

describe("reading the plugin's snapshot", () => {
	const snapshot: TaskChuteLogSnapshot = {
		taskExecutions: {
			"2026-11-07": [
				{ taskTitle: "Write", durationSec: 1_500 },
				{ taskTitle: "Review", durationSec: 300 },
			],
			"2026-11-06": [{ taskTitle: "Plan", durationSec: 600 }],
		},
		dailySummary: {
			"2026-11-07": { totalMinutes: 32, totalTasks: 4, completedTasks: 3 },
		},
	};

	it("prefers the day's own total over summing executions", () => {
		expect(taskChuteDayMinutes(snapshot, "2026-11-07")).toBe(32);
	});

	it("falls back to the executions when a day has no summary", () => {
		// 600 s = 10 min
		expect(taskChuteDayMinutes(snapshot, "2026-11-06")).toBe(10);
	});

	it("is zero for a day with no record at all", () => {
		expect(taskChuteDayMinutes(snapshot, "2026-11-01")).toBe(0);
	});

	it("reads finished over planned, and tolerates a missing summary", () => {
		expect(taskChuteDayCounts(snapshot, "2026-11-07")).toEqual({ done: 3, total: 4 });
		expect(taskChuteDayCounts(snapshot, "2026-11-06")).toEqual({ done: 1, total: 1 });
	});
});

describe("taskChuteReorder", () => {
	it("swaps the order of two neighbours in the same state", () => {
		const a = inst({ instanceId: "a", task: { name: "A" } });
		const b = inst({ instanceId: "b", task: { name: "B" } });
		const c = inst({ instanceId: "c", task: { name: "C" } });
		expect(taskChuteReorder([a, b, c], "b", -1)).toBe(true);
		expect([a.order, b.order, c.order]).toEqual([1, 0, 2]);
		expect(taskChuteRows([a, b, c]).map((row) => row.instanceId)).toEqual(["b", "a", "c"]);
	});

	it("refuses at the edge of the list", () => {
		const rows = [inst({ instanceId: "a", task: { name: "A" } }), inst({ instanceId: "b", task: { name: "B" } })];
		expect(taskChuteReorder(rows, "a", -1)).toBe(false);
		expect(taskChuteReorder(rows, "b", 1)).toBe(false);
	});

	it("refuses to cross a state boundary", () => {
		const done = inst({ instanceId: "done", state: "done", task: { name: "Done" } });
		const idle = inst({ instanceId: "idle", state: "idle", task: { name: "Idle" } });
		expect(taskChuteReorder([done, idle], "idle", -1)).toBe(false);
	});
});

describe("rows follow the plugin's order", () => {
	it("sorts by order inside a state and keeps the running task first", () => {
		const rows = taskChuteRows([
			inst({ instanceId: "a", task: { name: "A" }, order: 2 }),
			inst({ instanceId: "b", task: { name: "B" }, order: 1 }),
			inst({ instanceId: "c", task: { name: "C" }, state: "running", order: 9 }),
		]);
		expect(rows.map((row) => row.instanceId)).toEqual(["c", "b", "a"]);
	});
});

describe("taskChuteSections", () => {
	it("groups by the plugin's slot, keeps section order and puts 'none' last", () => {
		const sections = taskChuteSections([
			inst({ instanceId: "none", task: { name: "Unscheduled" } }),
			inst({ instanceId: "late", slotKey: "16:00-24:00", task: { name: "Late" } }),
			inst({ instanceId: "early", slotKey: "8:00-12:00", task: { name: "Early" } }),
		]);
		expect(sections.map((s) => s.key)).toEqual(["16:00-24:00", "8:00-12:00", "none"]);
		const ordered = taskChuteSections(
			[
				inst({ instanceId: "late", slotKey: "16:00-24:00", task: { name: "Late" } }),
				inst({ instanceId: "early", slotKey: "8:00-12:00", task: { name: "Early" } }),
			],
			["8:00-12:00", "12:00-16:00", "16:00-24:00"],
		);
		expect(ordered.map((s) => s.key)).toEqual(["8:00-12:00", "12:00-16:00", "16:00-24:00"]);
		expect(sections[2].rows.map((r) => r.instanceId)).toEqual(["none"]);
	});

	it("labels a slot as a range and 'none' with the caller's word", () => {
		expect(taskChuteSectionLabel("8:00-12:00", "No time")).toBe("8:00 – 12:00");
		expect(taskChuteSectionLabel("none", "No time")).toBe("No time");
	});
});

describe("formatTaskChuteDay", () => {
	it("says Today for the current day and a short date otherwise", () => {
		const today = new Date(2026, 10, 7, 15, 0, 0);
		expect(formatTaskChuteDay(new Date(2026, 10, 7), "Today", today)).toBe("Today");
		expect(formatTaskChuteDay(new Date(2026, 10, 8), "Today", today)).not.toBe("Today");
	});
});

describe("empty time windows", () => {
	it("draws every configured window, even the ones with nothing in them", () => {
		const sections = taskChuteSections(
			[inst({ instanceId: "a", slotKey: "8:00-12:00", task: { name: "A" } })],
			["0:00-8:00", "8:00-12:00", "12:00-16:00", "16:00-0:00"],
		);
		expect(sections.map((s) => s.key)).toEqual(["0:00-8:00", "8:00-12:00", "12:00-16:00", "16:00-0:00"]);
		expect(sections[0].rows).toEqual([]);
	});
});
