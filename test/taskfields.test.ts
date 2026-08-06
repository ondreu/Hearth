import { describe, expect, it } from "vitest";
import {
	BUILTIN_TASK_FIELDS,
	activeTaskFields,
	autoFieldColor,
	customFieldId,
	customFieldProperty,
	fieldAppliesTo,
	fieldAutoColor,
	fieldColor,
	fieldColorable,
	fieldStyle,
	fieldStyleOptions,
	isCustomField,
	resolveTaskFields,
	taskFieldValues,
} from "../src/taskfields";
import type { TaskFieldConfig } from "../src/types";

/**
 * Field customization for the tasks card (#157): which metadata a task shows,
 * in what order, and how each piece is drawn. The resolution rules matter more
 * than they look — a stored list comes off disk from a real user's vault and
 * may predate fields that exist now, so it must never render a task blank.
 */
describe("resolveTaskFields", () => {
	it("falls back to every built-in, in order, when nothing is stored", () => {
		expect(resolveTaskFields(undefined).map((f) => f.id)).toEqual([...BUILTIN_TASK_FIELDS]);
		expect(resolveTaskFields([]).map((f) => f.id)).toEqual([...BUILTIN_TASK_FIELDS]);
	});

	// The default order is the one the card rendered before fields were
	// configurable — dates chronologically (🛫 start, ⏳ scheduled, due, ✅ done),
	// not in whatever order the ids happen to be declared.
	it("defaults to the order tasks were rendered in before this existed", () => {
		expect(resolveTaskFields(undefined).map((f) => f.id)).toEqual([
			"status",
			"column",
			"priority",
			"start",
			"scheduled",
			"due",
			"doneDate",
			"description",
		]);
	});

	it("keeps the stored order, including custom fields between built-ins", () => {
		const stored: TaskFieldConfig[] = [
			{ id: "priority" },
			{ id: "fm:project" },
			{ id: "due" },
		];
		expect(resolveTaskFields(stored).slice(0, 3).map((f) => f.id)).toEqual([
			"priority",
			"fm:project",
			"due",
		]);
	});

	it("preserves each field's own settings", () => {
		const stored: TaskFieldConfig[] = [
			{ id: "status", style: "dot", colors: { done: "#0f0" }, hidden: true },
		];
		expect(resolveTaskFields(stored)[0]).toMatchObject({
			id: "status",
			style: "dot",
			hidden: true,
			colors: { done: "#0f0" },
		});
	});

	it("appends built-ins the stored list never mentions, visible", () => {
		const resolved = resolveTaskFields([{ id: "due" }]);
		expect(resolved.map((f) => f.id).sort()).toEqual([...BUILTIN_TASK_FIELDS].sort());
		expect(resolved.find((f) => f.id === "priority")?.hidden).toBeUndefined();
	});

	it("keeps a hidden field hidden rather than re-adding it", () => {
		const stored: TaskFieldConfig[] = BUILTIN_TASK_FIELDS.map((id) => ({
			id,
			hidden: id === "status" ? true : undefined,
		}));
		const status = resolveTaskFields(stored).filter((f) => f.id === "status");
		expect(status).toHaveLength(1);
		expect(status[0].hidden).toBe(true);
	});

	it("drops unknown ids, blank ids and empty custom properties", () => {
		const stored = [
			{ id: "nonsense" },
			{ id: "" },
			{ id: "fm:" },
			{ id: "fm:  " },
		] as TaskFieldConfig[];
		expect(resolveTaskFields(stored).map((f) => f.id)).toEqual([...BUILTIN_TASK_FIELDS]);
	});

	it("collapses duplicates, keeping the first entry", () => {
		const stored: TaskFieldConfig[] = [
			{ id: "due", style: "pill" },
			{ id: "due", style: "dot" },
		];
		const due = resolveTaskFields(stored).filter((f) => f.id === "due");
		expect(due).toHaveLength(1);
		expect(due[0].style).toBe("pill");
	});
});

describe("custom fields", () => {
	it("round-trips a property name through the id", () => {
		expect(customFieldId("project")).toBe("fm:project");
		expect(customFieldProperty(customFieldId("project"))).toBe("project");
		expect(isCustomField("fm:project")).toBe(true);
		expect(isCustomField("priority")).toBe(false);
	});

	it("reports no property for a built-in", () => {
		expect(customFieldProperty("priority")).toBe("");
	});
});

describe("fieldAppliesTo", () => {
	it("offers status only for TaskNotes and column only for Kanban", () => {
		expect(fieldAppliesTo("status", "tasknotes", true)).toBe(true);
		expect(fieldAppliesTo("status", "checkbox", true)).toBe(false);
		expect(fieldAppliesTo("column", "kanban", true)).toBe(true);
		expect(fieldAppliesTo("column", "tasknotes", true)).toBe(false);
	});

	it("needs extended parsing for the emoji-marker dates", () => {
		expect(fieldAppliesTo("start", "checkbox", true)).toBe(true);
		expect(fieldAppliesTo("start", "checkbox", false)).toBe(false);
		expect(fieldAppliesTo("doneDate", "kanban", false)).toBe(false);
	});

	it("always offers due, priority and custom fields", () => {
		for (const source of ["checkbox", "tasknotes", "kanban"] as const) {
			expect(fieldAppliesTo("due", source, false)).toBe(true);
			expect(fieldAppliesTo("priority", source, false)).toBe(true);
			expect(fieldAppliesTo("fm:project", source, false)).toBe(true);
		}
	});
});

describe("fieldStyle", () => {
	it("uses chips for values and text for dates", () => {
		expect(fieldStyle({ id: "status" }, "list", "tasknotes")).toBe("pill");
		expect(fieldStyle({ id: "fm:project" }, "list", "tasknotes")).toBe("pill");
		expect(fieldStyle({ id: "due" }, "list", "checkbox")).toBe("text");
	});

	it("keeps the Kanban board's bare priority dot as the default", () => {
		expect(fieldStyle({ id: "priority" }, "kanban", "kanban")).toBe("dot");
		expect(fieldStyle({ id: "priority" }, "list", "kanban")).toBe("pill");
		expect(fieldStyle({ id: "priority" }, "kanban", "tasknotes")).toBe("pill");
	});

	it("lets an explicit style win everywhere", () => {
		expect(fieldStyle({ id: "priority", style: "text" }, "kanban", "kanban")).toBe("text");
		expect(fieldStyle({ id: "due", style: "pill" }, "list", "checkbox")).toBe("pill");
	});

	it("ignores a style the field cannot render", () => {
		// A relative date label ("Tomorrow") cannot survive being reduced to a dot.
		expect(fieldStyleOptions("due")).toEqual(["text", "pill"]);
		expect(fieldStyle({ id: "due", style: "dot" }, "list", "checkbox")).toBe("text");
		expect(fieldStyleOptions("description")).toEqual([]);
		expect(fieldStyleOptions("fm:project")).toEqual(["pill", "dot", "text"]);
	});
});

describe("taskFieldValues", () => {
	it("renders a list property as one value per entry", () => {
		expect(taskFieldValues(["home", "errands"])).toEqual(["home", "errands"]);
	});

	it("coerces scalars and trims blanks", () => {
		expect(taskFieldValues("  Inbox  ")).toEqual(["Inbox"]);
		expect(taskFieldValues(3)).toEqual(["3"]);
		expect(taskFieldValues(false)).toEqual(["false"]);
	});

	it("renders nothing for empty, missing or non-scalar values", () => {
		expect(taskFieldValues(undefined)).toEqual([]);
		expect(taskFieldValues(null)).toEqual([]);
		expect(taskFieldValues("   ")).toEqual([]);
		expect(taskFieldValues({ nested: true })).toEqual([]);
		expect(taskFieldValues([null, { a: 1 }])).toEqual([]);
	});

	it("de-duplicates repeated entries in a list", () => {
		expect(taskFieldValues(["home", "home"])).toEqual(["home"]);
	});
});

describe("colours", () => {
	it("gives a value the same auto colour every time, ignoring case", () => {
		expect(autoFieldColor("in-progress")).toBe(autoFieldColor("In-Progress"));
		expect(autoFieldColor("open")).toMatch(/^var\(--color-[a-z]+\)$/);
	});

	// Turning the feature on must not repaint anything, so only chips that did
	// not exist before — frontmatter properties — colour themselves by default.
	it("auto-colours new custom chips, never the built-ins, until asked", () => {
		expect(fieldAutoColor({ id: "fm:project" })).toBe(true);
		expect(fieldAutoColor({ id: "status" })).toBe(false);
		expect(fieldAutoColor({ id: "column" })).toBe(false);
		expect(fieldAutoColor({ id: "priority" })).toBe(false);
		expect(fieldAutoColor({ id: "status", autoColor: true })).toBe(true);
		expect(fieldAutoColor({ id: "fm:project", autoColor: false })).toBe(false);
	});

	it("never colours a field whose colour already means something", () => {
		expect(fieldColorable("due")).toBe(false);
		expect(fieldColor({ id: "due", colors: { "*": "#f00" } }, "today")).toBeNull();
	});

	it("prefers an explicit colour, then a wildcard, then the auto palette", () => {
		const field: TaskFieldConfig = { id: "status", colors: { done: "#0f0", "*": "#00f" } };
		expect(fieldColor(field, "Done")).toBe("#0f0");
		expect(fieldColor(field, "waiting")).toBe("#00f");
		expect(fieldColor({ id: "fm:project" }, "hearth")).toBe(autoFieldColor("hearth"));
	});

	it("leaves the stylesheet in charge when auto colour is off", () => {
		expect(fieldColor({ id: "status" }, "open")).toBeNull();
		expect(fieldColor({ id: "fm:project", autoColor: false }, "hearth")).toBeNull();
		expect(fieldColor({ id: "priority" }, "high")).toBeNull();
	});
});

/**
 * The three layers (#157 follow-up): off globally means nothing changes for
 * anyone, on globally means cards follow one list, and a card may take over its
 * own. Each layer has to be a no-op until something is actually configured.
 */
describe("activeTaskFields", () => {
	const off = { taskFieldsEnabled: false, taskFields: [] };
	const on = { taskFieldsEnabled: true, taskFields: [] };
	const globalList = {
		taskFieldsEnabled: true,
		taskFields: [{ id: "due" }, { id: "priority", style: "dot" as const }],
	};

	it("ignores every stored list while the master switch is off", () => {
		const card = { taskFieldsEnabled: true, taskFields: [{ id: "due" }] };
		expect(activeTaskFields(card, off).map((f) => f.id)).toEqual([...BUILTIN_TASK_FIELDS]);
		expect(activeTaskFields(card, off).every((f) => !f.hidden && !f.style)).toBe(true);
	});

	it("keeps a card's own settings intact for when the switch comes back on", () => {
		const card = { taskFieldsEnabled: true, taskFields: [{ id: "due" }] };
		activeTaskFields(card, off);
		expect(card.taskFields).toEqual([{ id: "due" }]);
	});

	it("changes nothing when the switch is on but nothing is configured", () => {
		expect(activeTaskFields({}, on).map((f) => f.id)).toEqual([...BUILTIN_TASK_FIELDS]);
	});

	it("follows the global list once one is set", () => {
		expect(activeTaskFields({}, globalList).slice(0, 2).map((f) => f.id)).toEqual([
			"due",
			"priority",
		]);
	});

	it("lets a card that opted in override the global list", () => {
		const card = { taskFieldsEnabled: true, taskFields: [{ id: "status" }] };
		expect(activeTaskFields(card, globalList)[0].id).toBe("status");
	});

	it("keeps a card that stored a list but never opted in on the global one", () => {
		const card = { taskFields: [{ id: "status" }] };
		expect(activeTaskFields(card, globalList)[0].id).toBe("due");
	});
});
