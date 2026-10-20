import { describe, expect, it } from "vitest";
import {
	defaultMatrixPriorities,
	groupByQuadrant,
	linePriorityValues,
	MATRIX_NO_PRIORITY,
	matrixMoveNeeded,
	matrixPriorityKey,
	matrixQuadrantFor,
	matrixWriteValue,
	resolveTaskMatrix,
	sanitizeTaskMatrix,
	toggleMatrixPriority,
} from "../src/taskmatrix";

const LABELS = { do: "Do", schedule: "Schedule", delegate: "Delegate", eliminate: "Eliminate" };

/**
 * The Eisenhower matrix layout reuses the task's own priority: a quadrant is a
 * set of priorities, a drop writes the quadrant's first one. These pin the
 * mapping both ways, per source.
 */
describe("matrixPriorityKey", () => {
	it("compares line priorities by Tasks-plugin level, however written", () => {
		expect(matrixPriorityKey("⏫", "checkbox")).toBe("high");
		expect(matrixPriorityKey("High", "kanban")).toBe("high");
		expect(matrixPriorityKey("urgent", "checkbox")).toBe("high");
		expect(matrixPriorityKey("🔺", "checkbox")).toBe("highest");
	});

	it("compares TaskNotes priorities as written, ignoring case", () => {
		expect(matrixPriorityKey("Normal", "tasknotes")).toBe("normal");
		expect(matrixPriorityKey("normal", "tasknotes")).not.toBe(matrixPriorityKey("medium", "tasknotes"));
	});

	it("treats a missing priority as none", () => {
		expect(matrixPriorityKey(undefined, "checkbox")).toBe(MATRIX_NO_PRIORITY);
		expect(matrixPriorityKey("  ", "tasknotes")).toBe(MATRIX_NO_PRIORITY);
	});
});

describe("defaultMatrixPriorities", () => {
	it("gives the five Tasks levels one each, low and lowest to Eliminate", () => {
		expect(defaultMatrixPriorities(linePriorityValues())).toEqual({
			do: ["highest"],
			schedule: ["high"],
			delegate: ["medium"],
			eliminate: ["low", "lowest"],
		});
	});

	it("lets Eliminate take unprioritized tasks when there are too few levels", () => {
		expect(defaultMatrixPriorities(["high", "normal", "low"])).toEqual({
			do: ["high"],
			schedule: ["normal"],
			delegate: ["low"],
			eliminate: [MATRIX_NO_PRIORITY],
		});
	});
});

describe("resolveTaskMatrix", () => {
	it("fills defaults and keeps a deliberately empty quadrant empty", () => {
		const m = resolveTaskMatrix(
			{ quadrants: { delegate: { priorities: [] }, do: { label: "  Now  " } } },
			linePriorityValues(),
			LABELS,
			"checkbox",
		);
		expect(m.do).toEqual({ label: "Now", priorities: ["highest"] });
		expect(m.delegate.priorities).toEqual([]);
		expect(m.eliminate.label).toBe("Eliminate");
		expect(m.showUnsorted).toBe(true);
	});

	it("gives a value claimed twice to the first quadrant only", () => {
		const m = resolveTaskMatrix(
			{ quadrants: { do: { priorities: ["high"] }, schedule: { priorities: ["⏫", "medium"] } } },
			linePriorityValues(),
			LABELS,
			"checkbox",
		);
		expect(m.do.priorities).toEqual(["high"]);
		expect(m.schedule.priorities).toEqual(["medium"]);
		// The default for Delegate (medium) is already taken.
		expect(m.delegate.priorities).toEqual([]);
	});
});

describe("quadrant placement and writes", () => {
	const m = resolveTaskMatrix(undefined, linePriorityValues(), LABELS, "checkbox");

	it("places tasks by priority, unclaimed ones nowhere", () => {
		expect(matrixQuadrantFor("🔺", m, "checkbox")).toBe("do");
		expect(matrixQuadrantFor("lowest", m, "checkbox")).toBe("eliminate");
		expect(matrixQuadrantFor(undefined, m, "checkbox")).toBeNull();
		expect(matrixQuadrantFor("banana", m, "checkbox")).toBeNull();
	});

	it("writes the quadrant's first value, clears for none, skips an empty one", () => {
		expect(matrixWriteValue(m, "eliminate")).toBe("low");
		const custom = resolveTaskMatrix(
			{ quadrants: { eliminate: { priorities: [MATRIX_NO_PRIORITY, "lowest"] }, delegate: { priorities: [] } } },
			linePriorityValues(),
			LABELS,
			"checkbox",
		);
		expect(matrixWriteValue(custom, "eliminate")).toBeNull();
		expect(matrixWriteValue(custom, "delegate")).toBeUndefined();
	});

	it("leaves a task alone when it is dropped where it already is", () => {
		expect(matrixMoveNeeded("lowest", m, "eliminate", "checkbox")).toBe(false);
		expect(matrixMoveNeeded("lowest", m, "do", "checkbox")).toBe(true);
		expect(matrixMoveNeeded(undefined, m, null, "checkbox")).toBe(false);
	});

	it("groups in order", () => {
		const items = [{ p: "high" }, { p: "" }, { p: "highest" }, { p: "⏫" }];
		const { quadrants, unsorted } = groupByQuadrant(items, (i) => i.p, m, "checkbox");
		expect(quadrants.schedule).toEqual([items[0], items[3]]);
		expect(quadrants.do).toEqual([items[2]]);
		expect(unsorted).toEqual([items[1]]);
	});
});

describe("toggleMatrixPriority", () => {
	const options = [...linePriorityValues(), MATRIX_NO_PRIORITY];
	const start = defaultMatrixPriorities(linePriorityValues());

	it("moves a value from its quadrant to the one it is turned on in", () => {
		const next = toggleMatrixPriority(start, "do", "high", options, "checkbox");
		expect(next.do).toEqual(["highest", "high"]);
		expect(next.schedule).toEqual([]);
	});

	it("keeps lists in option order, so the first is the highest", () => {
		const next = toggleMatrixPriority(start, "eliminate", "medium", options, "checkbox");
		expect(next.eliminate).toEqual(["medium", "low", "lowest"]);
	});

	it("turns a value off", () => {
		expect(toggleMatrixPriority(start, "eliminate", "low", options, "checkbox").eliminate).toEqual(["lowest"]);
	});
});

describe("sanitizeTaskMatrix", () => {
	it("keeps known shapes and drops the rest", () => {
		expect(
			sanitizeTaskMatrix({
				showUnsorted: false,
				quadrants: { do: { label: " Now ", priorities: ["high", 3, ""] }, bogus: { label: "x" }, schedule: "no" },
			}),
		).toEqual({ showUnsorted: false, quadrants: { do: { label: "Now", priorities: ["high"] } } });
		expect(sanitizeTaskMatrix({})).toBeUndefined();
		expect(sanitizeTaskMatrix("x")).toBeUndefined();
	});
});
