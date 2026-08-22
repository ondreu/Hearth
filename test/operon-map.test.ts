import { describe, expect, it } from "vitest";
import {
	addDays,
	boardColumns,
	dayKey,
	dueRange,
	dueState,
	findPriority,
	findStatus,
	formatElapsed,
	groupByDay,
	isClosed,
	sortTasks,
	taskDay,
} from "../src/operon/map";
import type { OperonTask, OperonTaxonomy } from "../src/operon/types";

/**
 * The pure half of the Operon integration: how Operon's task DTOs get bucketed,
 * ordered and turned into board columns. Everything Operon itself decides —
 * what a task is, when it recurs, which status means done — is out of scope by
 * design; these tests only pin Hearth's own shaping of what it was handed.
 */

/** A minimal task DTO. Only the fields the mappers read are filled; the rest
 * are the empty shapes the contract guarantees. */
function task(overrides: {
	id?: string;
	description?: string;
	due?: string;
	scheduled?: string;
	created?: string;
	checkbox?: OperonTask["checkbox"];
	priorityId?: string;
	statusId?: string;
}): OperonTask {
	const {
		id = "t1",
		description = "Task",
		due,
		scheduled,
		created,
		checkbox = "open",
		priorityId,
		statusId,
	} = overrides;
	return {
		identity: { operonId: id, validity: "canonical", mutationAllowed: true },
		description,
		representation: "inline",
		locator: { representation: "inline", filePath: "Notes/Inbox.md", lineNumber: 3 },
		checkbox,
		workflow: statusId
			? { pipeline: { id: "work", label: "Work" }, status: { id: statusId, label: statusId } }
			: undefined,
		priority: priorityId ? { id: priorityId, label: priorityId } : undefined,
		dates: { due, scheduled },
		datetimes: { created },
		relationships: {
			childOperonIds: [],
			blockingOperonIds: [],
			blockedByOperonIds: [],
			relatedOperonIds: [],
		},
		recurrence: { repeating: false },
		tracker: { active: false, sessionCount: 0 },
		pinned: false,
		// Revisions are opaque to Hearth — it never compares or forwards them —
		// so the fixture carries the shape without inventing plausible values.
		sourceRevision: { algorithm: "sha256", contentDigest: "" },
		contextRevision: {
			index: { sessionId: "", ramGeneration: 0 },
			settingsFingerprint: "",
			pinnedGeneration: 0,
			activeTrackerGeneration: 0,
			repeatSeriesRevision: 0,
			projectSerialGeneration: 0,
			projectSerialSignature: "",
		},
	} as unknown as OperonTask;
}

const taxonomy = {
	defaultPipeline: { configuredValue: "work", id: "work", status: "resolved" },
	defaultPriority: { configuredValue: "normal", id: "normal", status: "resolved" },
	pipelines: [
		{
			id: "work",
			name: "Work",
			description: "",
			order: 1,
			identityStatus: "resolved",
			statuses: [
				{ id: "todo", label: "To do", order: 1, color: "#888", isFinished: false, isCancelled: false, isScheduledTarget: false, isTrackingTarget: false, identityStatus: "resolved" },
				{ id: "doing", label: "Doing", order: 2, color: "#0a0", isFinished: false, isCancelled: false, isScheduledTarget: false, isTrackingTarget: true, identityStatus: "resolved" },
				{ id: "done", label: "Done", order: 3, color: "#00a", isFinished: true, isCancelled: false, isScheduledTarget: false, isTrackingTarget: false, identityStatus: "resolved" },
			],
		},
		{
			id: "home",
			name: "Home",
			description: "",
			order: 2,
			identityStatus: "resolved",
			statuses: [
				{ id: "someday", label: "Someday", order: 1, color: "#555", isFinished: false, isCancelled: false, isScheduledTarget: false, isTrackingTarget: false, identityStatus: "resolved" },
			],
		},
	],
	priorities: [
		{ id: "high", label: "High", description: "", order: 1, color: "#f00", isDefault: false, identityStatus: "resolved" },
		{ id: "normal", label: "Normal", description: "", order: 2, color: "#888", isDefault: true, identityStatus: "resolved" },
		{ id: "low", label: "Low", description: "", order: 3, color: "#08f", isDefault: false, identityStatus: "resolved" },
	],
} as unknown as OperonTaxonomy;

describe("dayKey / taskDay", () => {
	it("takes the day part of both a date and a datetime", () => {
		expect(dayKey("2026-03-04")).toBe("2026-03-04");
		expect(dayKey("2026-03-04T17:30:00Z")).toBe("2026-03-04");
	});

	it("rejects anything that isn't a calendar day", () => {
		expect(dayKey(undefined)).toBeNull();
		expect(dayKey("")).toBeNull();
		expect(dayKey("tomorrow")).toBeNull();
		expect(dayKey("2026-3-4")).toBeNull();
	});

	it("falls back to the scheduled date when a task has no due date", () => {
		expect(taskDay(task({ due: "2026-03-04", scheduled: "2026-03-01" }))).toBe("2026-03-04");
		expect(taskDay(task({ scheduled: "2026-03-01" }))).toBe("2026-03-01");
		expect(taskDay(task({}))).toBeNull();
	});
});

describe("addDays", () => {
	it("moves forward and back across month and year ends", () => {
		expect(addDays("2026-03-04", 3)).toBe("2026-03-07");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});

	it("crosses a DST boundary without drifting a day", () => {
		// Northern-hemisphere spring forward; UTC arithmetic on a date-only key
		// must not land on the 28th or the 30th.
		expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
		expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
	});

	it("passes a non-date through unchanged rather than producing garbage", () => {
		expect(addDays("later", 1)).toBe("later");
	});
});

describe("isClosed", () => {
	it("treats both done and cancelled as closed", () => {
		expect(isClosed(task({ checkbox: "open" }))).toBe(false);
		expect(isClosed(task({ checkbox: "done" }))).toBe(true);
		expect(isClosed(task({ checkbox: "cancelled" }))).toBe(true);
	});
});

describe("dueState", () => {
	const today = "2026-03-04";

	it("buckets a task by how far off its date is", () => {
		expect(dueState(task({ due: "2026-03-01" }), today)).toBe("overdue");
		expect(dueState(task({ due: today }), today)).toBe("today");
		expect(dueState(task({ due: "2026-03-06" }), today)).toBe("soon");
		expect(dueState(task({ due: "2026-04-01" }), today)).toBe("later");
		expect(dueState(task({}), today)).toBe("none");
	});

	it("never calls a completed task overdue", () => {
		expect(dueState(task({ due: "2026-03-01", checkbox: "done" }), today)).toBe("later");
	});

	it("honours the soon window", () => {
		expect(dueState(task({ due: "2026-03-10" }), today, 7)).toBe("soon");
		expect(dueState(task({ due: "2026-03-10" }), today, 2)).toBe("later");
	});
});

describe("groupByDay", () => {
	const today = "2026-03-04";

	it("buckets tasks by day and drops empty days", () => {
		const groups = groupByDay(
			[
				task({ id: "a", due: "2026-03-04" }),
				task({ id: "b", due: "2026-03-06" }),
				task({ id: "c", due: "2026-03-06" }),
			],
			today,
			7,
		);
		expect(groups.map((g) => [g.day, g.tasks.length])).toEqual([
			["2026-03-04", 1],
			["2026-03-06", 2],
		]);
	});

	it("pulls overdue work onto the first day instead of a date already gone", () => {
		const groups = groupByDay([task({ id: "old", due: "2026-02-01" })], today, 7);
		expect(groups).toHaveLength(1);
		expect(groups[0].day).toBe(today);
	});

	it("leaves out tasks past the end of the window, and undated ones", () => {
		const groups = groupByDay(
			[task({ id: "far", due: "2026-05-01" }), task({ id: "none" })],
			today,
			7,
		);
		expect(groups).toEqual([]);
	});

	it("keeps days in chronological order regardless of input order", () => {
		const groups = groupByDay(
			[task({ id: "b", due: "2026-03-08" }), task({ id: "a", due: "2026-03-05" })],
			today,
			7,
		);
		expect(groups.map((g) => g.day)).toEqual(["2026-03-05", "2026-03-08"]);
	});
});

describe("findStatus / findPriority", () => {
	it("resolves a status from any pipeline", () => {
		expect(findStatus(taxonomy, "doing")?.label).toBe("Doing");
		expect(findStatus(taxonomy, "someday")?.label).toBe("Someday");
	});

	it("returns null for an id the taxonomy no longer has, or no taxonomy", () => {
		expect(findStatus(taxonomy, "deleted")).toBeNull();
		expect(findStatus(null, "doing")).toBeNull();
		expect(findPriority(taxonomy, undefined)).toBeNull();
	});
});

describe("boardColumns", () => {
	it("offers a status shared by two pipelines exactly once", () => {
		// Two pipelines naming the same status id must not produce two columns
		// competing for the same tasks.
		const shared = {
			...(taxonomy as unknown as { pipelines: unknown[] }),
			pipelines: [
				{
					id: "a",
					name: "A",
					order: 1,
					statuses: [{ id: "todo", label: "To do", order: 1, color: "#888" }],
				},
				{
					id: "b",
					name: "B",
					order: 2,
					statuses: [{ id: "todo", label: "To do", order: 1, color: "#888" }],
				},
			],
		} as unknown as OperonTaxonomy;
		expect(boardColumns(shared).map((s) => s.id)).toEqual(["todo"]);
	});

	it("lists every pipeline's statuses in Operon's own order", () => {
		expect(boardColumns(taxonomy).map((s) => s.id)).toEqual([
			"todo",
			"doing",
			"done",
			"someday",
		]);
	});

	it("narrows to the selected pipelines", () => {
		expect(boardColumns(taxonomy, { pipelineIds: ["home"] }).map((s) => s.id)).toEqual(["someday"]);
	});

	it("removes hidden columns and applies the card's ordering", () => {
		const columns = boardColumns(taxonomy, {
			order: ["done", "todo"],
			hidden: ["someday"],
		});
		// Explicitly ordered ids first; anything the card has never seen keeps
		// its Operon position after them, so a new upstream status still shows.
		expect(columns.map((s) => s.id)).toEqual(["done", "todo", "doing"]);
	});

	it("has nothing to show without a taxonomy", () => {
		expect(boardColumns(null)).toEqual([]);
	});
});

describe("sortTasks", () => {
	it("puts open tasks before closed ones whatever the key or direction", () => {
		const tasks = [task({ id: "done", checkbox: "done", due: "2026-01-01" }), task({ id: "open", due: "2026-09-01" })];
		expect(sortTasks(tasks, "due", false, taxonomy).map((t) => t.identity.operonId)).toEqual(["open", "done"]);
		expect(sortTasks(tasks, "due", true, taxonomy).map((t) => t.identity.operonId)).toEqual(["open", "done"]);
	});

	it("sorts by date, with undated tasks last in both directions", () => {
		const tasks = [task({ id: "none" }), task({ id: "late", due: "2026-09-01" }), task({ id: "soon", due: "2026-03-01" })];
		expect(sortTasks(tasks, "due", false, taxonomy).map((t) => t.identity.operonId)).toEqual([
			"soon",
			"late",
			"none",
		]);
	});

	it("uses Operon's priority order rather than the label", () => {
		const tasks = [task({ id: "low", priorityId: "low" }), task({ id: "high", priorityId: "high" })];
		expect(sortTasks(tasks, "priority", false, taxonomy).map((t) => t.identity.operonId)).toEqual([
			"high",
			"low",
		]);
	});

	it("puts unprioritised tasks after prioritised ones", () => {
		const tasks = [task({ id: "none" }), task({ id: "low", priorityId: "low" })];
		expect(sortTasks(tasks, "priority", false, taxonomy).map((t) => t.identity.operonId)).toEqual([
			"low",
			"none",
		]);
	});

	it("breaks a date tie on priority, then on age (smart)", () => {
		const tasks = [
			task({ id: "c", due: "2026-03-04", priorityId: "normal", created: "2026-01-02T00:00:00Z" }),
			task({ id: "b", due: "2026-03-04", priorityId: "normal", created: "2026-01-01T00:00:00Z" }),
			task({ id: "a", due: "2026-03-04", priorityId: "high", created: "2026-02-01T00:00:00Z" }),
		];
		expect(sortTasks(tasks, "smart", false, taxonomy).map((t) => t.identity.operonId)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("does not mutate the list it was given", () => {
		const tasks = [task({ id: "b", due: "2026-09-01" }), task({ id: "a", due: "2026-03-01" })];
		sortTasks(tasks, "due", false, taxonomy);
		expect(tasks.map((t) => t.identity.operonId)).toEqual(["b", "a"]);
	});
});

describe("formatElapsed", () => {
	it("drops the hour segment under an hour and pads seconds", () => {
		expect(formatElapsed(0)).toBe("0:00");
		expect(formatElapsed(9)).toBe("0:09");
		expect(formatElapsed(65)).toBe("1:05");
	});

	it("pads the minutes once an hour is showing", () => {
		expect(formatElapsed(3600)).toBe("1:00:00");
		expect(formatElapsed(3725)).toBe("1:02:05");
	});

	it("floors fractions and clamps a negative reading to zero", () => {
		expect(formatElapsed(59.9)).toBe("0:59");
		expect(formatElapsed(-5)).toBe("0:00");
	});

	it("shows zero rather than NaN for an unusable reading", () => {
		// An off-contract payload must not put "NaN:NaN" on the dashboard.
		expect(formatElapsed(Number.NaN)).toBe("0:00");
		expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe("0:00");
	});
});

describe("dueRange", () => {
	it("covers history plus the requested window, inclusive of today", () => {
		expect(dueRange("2026-03-04", 7, 30)).toEqual({ from: "2026-02-02", to: "2026-03-10" });
	});

	it("treats a one-day window as today only", () => {
		expect(dueRange("2026-03-04", 1, 0)).toEqual({ from: "2026-03-04", to: "2026-03-04" });
	});
});
