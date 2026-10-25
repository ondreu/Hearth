import { describe, expect, it } from "vitest";
import {
	defaultMatrixPriorities,
	groupByQuadrant,
	linePriorityValues,
	matrixArrangement,
	matrixAxisLabels,
	MATRIX_NO_PRIORITY,
	matrixMoveNeeded,
	matrixPriorityKey,
	matrixQuadrantFor,
	matrixWriteValue,
	resolveTaskMatrix,
	sanitizeTaskMatrix,
	toggleMatrixPriority,
	withQuadrantLabel,
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

describe("matrixArrangement", () => {
	it("is the classic matrix by default: urgent left, important on top", () => {
		expect(matrixArrangement(undefined)).toEqual({
			across: ["urgent", "notUrgent"],
			down: ["important", "notImportant"],
			cells: ["do", "schedule", "delegate", "eliminate"],
		});
	});

	it("puts urgent on the right", () => {
		const a = matrixArrangement({ urgentFirst: false });
		expect(a.across).toEqual(["notUrgent", "urgent"]);
		expect(a.cells).toEqual(["schedule", "do", "eliminate", "delegate"]);
	});

	it("puts important at the bottom", () => {
		expect(matrixArrangement({ importantFirst: false }).cells).toEqual(["delegate", "eliminate", "do", "schedule"]);
	});

	it("runs urgency down the rows, importance across", () => {
		const a = matrixArrangement({ urgency: "rows" });
		expect(a.across).toEqual(["important", "notImportant"]);
		expect(a.down).toEqual(["urgent", "notUrgent"]);
		expect(a.cells).toEqual(["do", "delegate", "schedule", "eliminate"]);
		expect(matrixArrangement({ urgency: "rows", urgentFirst: false, importantFirst: false }).cells).toEqual([
			"eliminate",
			"schedule",
			"delegate",
			"do",
		]);
	});

	it("keeps every quadrant exactly once in every arrangement", () => {
		for (const urgency of ["columns", "rows"] as const)
			for (const urgentFirst of [true, false])
				for (const importantFirst of [true, false]) {
					const cells = matrixArrangement({ urgency, urgentFirst, importantFirst }).cells;
					expect([...cells].sort()).toEqual(["delegate", "do", "eliminate", "schedule"]);
				}
	});
});

describe("names", () => {
	const defaults = { urgent: "Urgent", notUrgent: "Not urgent", important: "Important", notImportant: "Not important", unsorted: "Unsorted" };

	it("fills the user's axis names over the built-in ones", () => {
		expect(matrixAxisLabels({ axisLabels: { urgent: " Now ", unsorted: "  " } }, defaults)).toEqual({ ...defaults, urgent: "Now" });
	});

	it("sets and clears a quadrant name, keeping its priorities", () => {
		const named = withQuadrantLabel({ quadrants: { do: { priorities: ["high"] } } }, "do", " First ");
		expect(named.quadrants?.do).toEqual({ priorities: ["high"], label: "First" });
		expect(withQuadrantLabel(named, "do", "").quadrants?.do).toEqual({ priorities: ["high"] });
		expect(withQuadrantLabel({ quadrants: { do: { label: "x" } } }, "do", "")).toEqual({});
	});

	it("keeps the layout and the names through sanitizing", () => {
		expect(
			sanitizeTaskMatrix({ urgency: "rows", urgentFirst: false, importantFirst: "no", axisLabels: { urgent: "Now", bogus: "x", important: 3 } }),
		).toEqual({ urgency: "rows", urgentFirst: false, axisLabels: { urgent: "Now" } });
	});
});
