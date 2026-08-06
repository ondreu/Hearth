import { describe, expect, it } from "vitest";
import {
	activeTaskFields,
	builtinSource,
	displayValue,
	fieldStyle,
	frontmatterSource,
	isDateSource,
	isDescriptionSource,
	isKnownSource,
	newTaskField,
	normalizeSourceValue,
	resolveTaskFields,
	sourceBuiltin,
	sourceProperty,
	taskFieldValues,
} from "../src/taskfields";
import type { TaskFieldDef } from "../src/types";

/**
 * User-defined task fields (#157). A field is built by the user rather than
 * picked from a list, so the rules that matter are: what a stored definition
 * resolves to, when the fixed legacy rendering applies instead, and how a raw
 * value becomes something on screen.
 */

const field = (over: Partial<TaskFieldDef> = {}): TaskFieldDef => ({
	id: "f1",
	name: "Priority",
	keys: [{ source: frontmatterSource("priority") }],
	...over,
});

describe("sources", () => {
	it("round-trips a frontmatter property", () => {
		expect(frontmatterSource("project")).toBe("fm:project");
		expect(sourceProperty("fm:project")).toBe("project");
		expect(sourceBuiltin("fm:project")).toBeNull();
	});

	it("round-trips a built-in", () => {
		expect(builtinSource("due")).toBe("builtin:due");
		expect(sourceBuiltin("builtin:due")).toBe("due");
		expect(sourceProperty("builtin:due")).toBe("");
	});

	it("rejects sources it cannot read", () => {
		expect(isKnownSource("fm:project")).toBe(true);
		expect(isKnownSource("builtin:due")).toBe(true);
		expect(isKnownSource("fm:")).toBe(false);
		expect(isKnownSource("builtin:nonsense")).toBe(false);
		expect(isKnownSource("priority")).toBe(false);
	});

	it("knows which sources render as dates or as a description block", () => {
		expect(isDateSource("builtin:due")).toBe(true);
		expect(isDateSource("builtin:doneDate")).toBe(true);
		expect(isDateSource("builtin:status")).toBe(false);
		expect(isDateSource("fm:due")).toBe(false);
		expect(isDescriptionSource("builtin:description")).toBe(true);
		expect(isDescriptionSource("fm:description")).toBe(false);
	});
});

describe("resolveTaskFields", () => {
	// The empty list is the feature's starting point and a legitimate end state:
	// "show no metadata". It must never be quietly replaced with defaults.
	it("treats an empty list as an empty list, not as unconfigured", () => {
		expect(resolveTaskFields([])).toEqual([]);
		expect(resolveTaskFields(undefined)).toEqual([]);
	});

	it("keeps fields and their keys in order", () => {
		const stored = [
			field({ id: "a", keys: [{ source: "fm:project" }, { source: "builtin:due" }] }),
			field({ id: "b" }),
		];
		const resolved = resolveTaskFields(stored);
		expect(resolved.map((f) => f.id)).toEqual(["a", "b"]);
		expect(resolved[0].keys.map((k) => k.source)).toEqual(["fm:project", "builtin:due"]);
	});

	it("drops keys naming a source it cannot read", () => {
		const stored = [
			field({ keys: [{ source: "fm:project" }, { source: "builtin:nope" }, { source: "" }] }),
		];
		expect(resolveTaskFields(stored)[0].keys.map((k) => k.source)).toEqual(["fm:project"]);
	});

	it("drops a field left with no keys at all", () => {
		const stored = [field({ id: "a", keys: [{ source: "bogus" }] }), field({ id: "b" })];
		expect(resolveTaskFields(stored).map((f) => f.id)).toEqual(["b"]);
	});

	it("does not mutate what it was given", () => {
		const stored = [field({ keys: [{ source: "fm:project" }, { source: "bogus" }] })];
		resolveTaskFields(stored);
		expect(stored[0].keys).toHaveLength(2);
	});

	it("gives a new field a unique id and no keys", () => {
		const a = newTaskField("Priority");
		const b = newTaskField("Status");
		expect(a.id).not.toBe(b.id);
		expect(a.keys).toEqual([]);
		expect(a.name).toBe("Priority");
	});
});

/**
 * The three layers. Off globally means the card renders the fixed metadata it
 * always has — signalled by null, so the caller runs the legacy renderer rather
 * than an equivalent field list.
 */
describe("activeTaskFields", () => {
	const off = { taskFieldsEnabled: false, taskFields: [] };
	const on = { taskFieldsEnabled: true, taskFields: [] };
	const globalList = { taskFieldsEnabled: true, taskFields: [field({ id: "global" })] };

	it("returns null while the master switch is off, whatever is stored", () => {
		const card = { taskFieldsEnabled: true, taskFields: [field({ id: "card" })] };
		expect(activeTaskFields(card, off)).toBeNull();
		expect(activeTaskFields({}, off)).toBeNull();
	});

	it("keeps a card's own fields intact for when the switch comes back on", () => {
		const card = { taskFieldsEnabled: true, taskFields: [field({ id: "card" })] };
		activeTaskFields(card, off);
		expect(card.taskFields).toHaveLength(1);
	});

	it("shows nothing — not the old defaults — when on but unconfigured", () => {
		expect(activeTaskFields({}, on)).toEqual([]);
	});

	it("follows the global list", () => {
		expect(activeTaskFields({}, globalList)?.map((f) => f.id)).toEqual(["global"]);
	});

	it("lets a card that opted in override the global list", () => {
		const card = { taskFieldsEnabled: true, taskFields: [field({ id: "card" })] };
		expect(activeTaskFields(card, globalList)?.map((f) => f.id)).toEqual(["card"]);
	});

	it("lets a card that opted in show nothing at all", () => {
		expect(activeTaskFields({ taskFieldsEnabled: true, taskFields: [] }, globalList)).toEqual([]);
	});

	it("keeps a card that stored fields but never opted in on the global list", () => {
		const card = { taskFields: [field({ id: "card" })] };
		expect(activeTaskFields(card, globalList)?.map((f) => f.id)).toEqual(["global"]);
	});
});

describe("fieldStyle", () => {
	it("defaults to a chip", () => {
		expect(fieldStyle(field())).toBe("pill");
		expect(fieldStyle(field({ display: "dot" }))).toBe("dot");
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

describe("normalizeSourceValue", () => {
	// The same priority arrives as "⏫" off a checkbox line and as "high" from
	// TaskNotes frontmatter. A user who maps "high" means both.
	it("folds the priority emoji onto its level so one mapping covers both", () => {
		expect(normalizeSourceValue("builtin:priority", "⏫")).toBe("high");
		expect(normalizeSourceValue("builtin:priority", "🔺")).toBe("highest");
		expect(normalizeSourceValue("builtin:priority", "High")).toBe("high");
	});

	it("passes an unrecognised priority through untouched", () => {
		expect(normalizeSourceValue("builtin:priority", "spicy")).toBe("spicy");
	});

	it("leaves every other source alone", () => {
		expect(normalizeSourceValue("fm:project", "Hearth")).toBe("Hearth");
		expect(normalizeSourceValue("builtin:status", "In-Progress")).toBe("In-Progress");
	});
});

describe("displayValue", () => {
	const key = {
		source: "builtin:status",
		values: [
			{ match: "done", label: "Complete", color: "#0f0" },
			{ match: "in-progress", label: "Working" },
		],
	};

	it("uses the mapped label and colour", () => {
		expect(displayValue(key, "done")).toEqual({ label: "Complete", color: "#0f0" });
	});

	it("matches case- and whitespace-insensitively", () => {
		expect(displayValue(key, "  DONE ").label).toBe("Complete");
	});

	it("keeps a mapping that only sets a label", () => {
		expect(displayValue(key, "in-progress")).toEqual({ label: "Working", color: null });
	});

	// Nothing may vanish for want of having been mapped — a status added to the
	// vault after the mapping was written still has to be visible.
	it("shows an unmapped value as itself, uncoloured", () => {
		expect(displayValue(key, "blocked")).toEqual({ label: "blocked", color: null });
		expect(displayValue({ source: "fm:project" }, "Hearth")).toEqual({
			label: "Hearth",
			color: null,
		});
	});

	it("lets an earlier entry shadow a later duplicate", () => {
		const dupes = {
			source: "fm:x",
			values: [{ match: "a", label: "First" }, { match: "a", label: "Second" }],
		};
		expect(displayValue(dupes, "a").label).toBe("First");
	});

	it("ignores a blank label or colour rather than rendering an empty chip", () => {
		const blank = { source: "fm:x", values: [{ match: "a", label: "  ", color: " " }] };
		expect(displayValue(blank, "a")).toEqual({ label: "a", color: null });
	});
});
