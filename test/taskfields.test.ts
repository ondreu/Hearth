import { describe, expect, it } from "vitest";
import {
	activeTaskFields,
	ambientOwner,
	builtinSource,
	displayValue,
	fieldOpacity,
	fieldStyle,
	isAmbientStyle,
	DATE_RELATIONS,
	dateDisplay,
	dateRelation,
	frontmatterSource,
	isDateSource,
	keyIsDate,
	isDescriptionSource,
	isKnownSource,
	newTaskField,
	resolveTaskFields,
	sourceBuiltin,
	sourceProperty,
	sourceValueAliases,
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

/**
 * The ambient styles colour the task itself instead of adding a chip to it, so
 * they are the two that carry a strength.
 */
describe("ambient styles", () => {
	it("knows which styles paint the whole task", () => {
		expect(isAmbientStyle("hue")).toBe(true);
		expect(isAmbientStyle("glow")).toBe(true);
		expect(isAmbientStyle("pill")).toBe(false);
		expect(isAmbientStyle("dot")).toBe(false);
		expect(isAmbientStyle("text")).toBe(false);
	});

	it("gives a tint and a ring different default strengths", () => {
		// A tint sits behind the text and has to stay out of its way; a ring sits
		// outside it and can afford to be bolder.
		const hue = fieldOpacity(field({ display: "hue" }));
		const glow = fieldOpacity(field({ display: "glow" }));
		expect(hue).toBeGreaterThan(0);
		expect(glow).toBeGreaterThan(hue);
	});

	// A task has one background and one ring, so the first field asking for
	// either takes them and a second would paint nothing — which is why the
	// editor stops one from being configured at all.
	it("names the field that owns the task's colouring", () => {
		expect(ambientOwner([])).toBeNull();
		expect(ambientOwner([field({ id: "a" }), field({ id: "b", display: "dot" })])).toBeNull();
		expect(ambientOwner([field({ id: "a" }), field({ id: "b", display: "glow" })])?.id).toBe("b");
	});

	it("gives it to the first ambient field, whichever style it asks for", () => {
		const fields = [
			field({ id: "a" }),
			field({ id: "b", display: "hue" }),
			field({ id: "c", display: "glow" }),
		];
		expect(ambientOwner(fields)?.id).toBe("b");
	});

	it("uses the configured strength when there is one", () => {
		expect(fieldOpacity(field({ display: "hue", opacity: 60 }))).toBe(60);
	});

	// The value is persisted, so a hand-edited file can hold anything.
	it("clamps a stored strength into something renderable", () => {
		expect(fieldOpacity(field({ display: "hue", opacity: 0 }))).toBe(1);
		expect(fieldOpacity(field({ display: "hue", opacity: -20 }))).toBe(1);
		expect(fieldOpacity(field({ display: "hue", opacity: 5000 }))).toBe(100);
		expect(fieldOpacity(field({ display: "hue", opacity: 42.6 }))).toBe(43);
		expect(fieldOpacity(field({ display: "hue", opacity: Number.NaN }))).toBeGreaterThan(0);
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

describe("sourceValueAliases", () => {
	// The same priority arrives as "⏫" off a checkbox line and as "high" from
	// TaskNotes frontmatter. A user who maps either means both.
	it("offers a priority under its word and its emoji", () => {
		expect(sourceValueAliases("builtin:priority", "⏫")).toEqual(["⏫", "high"]);
		expect(sourceValueAliases("builtin:priority", "high")).toEqual(["high", "⏫"]);
		expect(sourceValueAliases("builtin:priority", "🔺")).toEqual(["🔺", "highest"]);
	});

	// The raw value first, always: it is what the user saw when they wrote the
	// mapping, and the level is only a fallback for the other spellings.
	it("keeps the raw value ahead of the level it folds onto", () => {
		expect(sourceValueAliases("builtin:priority", "urgent")).toEqual(["urgent", "high", "⏫"]);
		expect(sourceValueAliases("builtin:priority", "p3")).toEqual(["p3", "low", "🔽"]);
	});

	it("offers an unrecognised priority as itself alone", () => {
		expect(sourceValueAliases("builtin:priority", "spicy")).toEqual(["spicy"]);
	});

	it("leaves every other source alone", () => {
		expect(sourceValueAliases("fm:project", "Hearth")).toEqual(["Hearth"]);
		expect(sourceValueAliases("builtin:status", "In-Progress")).toEqual(["In-Progress"]);
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

	// The bug this replaced: the value was folded onto its coarse priority level
	// before the lookup, so every mapping written against what the vault actually
	// holds missed, and only the two spellings that survive folding ("high",
	// "low") ever found their label and colour.
	describe("priority, in every spelling", () => {
		const priority = {
			source: "builtin:priority",
			values: [
				{ match: "highest", label: "Now", color: "#f00" },
				{ match: "urgent", label: "Urgent", color: "#f80" },
				{ match: "medium", label: "Soon", color: "#ff0" },
				{ match: "🔽", label: "Whenever", color: "#0f0" },
			],
		};

		it("finds a mapping written against the exact value", () => {
			expect(displayValue(priority, "urgent")).toEqual({ label: "Urgent", color: "#f80" });
			expect(displayValue(priority, "highest")).toEqual({ label: "Now", color: "#f00" });
			expect(displayValue(priority, "medium")).toEqual({ label: "Soon", color: "#ff0" });
		});

		it("catches an emoji with a mapping written against the word", () => {
			expect(displayValue(priority, "🔺")).toEqual({ label: "Now", color: "#f00" });
			expect(displayValue(priority, "🔼")).toEqual({ label: "Soon", color: "#ff0" });
		});

		it("catches a word with a mapping written against the emoji", () => {
			expect(displayValue(priority, "low")).toEqual({ label: "Whenever", color: "#0f0" });
			expect(displayValue(priority, "minor")).toEqual({ label: "Whenever", color: "#0f0" });
		});

		// "urgent" folds onto "high", but it was mapped in its own right, so that
		// mapping wins rather than the level's.
		it("prefers the exact value over the level it folds onto", () => {
			const both = {
				source: "builtin:priority",
				values: [
					{ match: "high", label: "High" },
					{ match: "urgent", label: "Urgent" },
				],
			};
			expect(displayValue(both, "urgent").label).toBe("Urgent");
			expect(displayValue(both, "⏫").label).toBe("High");
		});

		it("shows an unmapped emoji as its word rather than as a bare emoji", () => {
			const none = { source: "builtin:priority" };
			expect(displayValue(none, "⏬")).toEqual({ label: "lowest", color: null });
			expect(displayValue(none, "urgent")).toEqual({ label: "urgent", color: null });
		});
	});
});

/**
 * Dates are a scale, not a set of values: there is no list of them to map, only
 * where one falls relative to today. That is what a date key configures.
 */
describe("date keys", () => {
	const today = "2026-08-06";

	it("places a date before, on, or after today", () => {
		expect(dateRelation("2026-08-05", today)).toBe("<today");
		expect(dateRelation("2026-08-06", today)).toBe("today");
		expect(dateRelation("2026-08-07", today)).toBe(">today");
	});

	it("compares only the date part, so a timestamp still lands on today", () => {
		expect(dateRelation("2026-08-06T23:30:00", today)).toBe("today");
	});

	it("offers exactly the three relations", () => {
		expect([...DATE_RELATIONS]).toEqual(["<today", "today", ">today"]);
	});

	it("treats the built-in date sources as dates without being told", () => {
		expect(keyIsDate({ source: "builtin:due" })).toBe(true);
		expect(keyIsDate({ source: "builtin:doneDate" })).toBe(true);
		expect(keyIsDate({ source: "builtin:status" })).toBe(false);
	});

	// Hearth can't know a frontmatter property holds a date rather than text
	// that happens to look like one, so the user says.
	it("takes a frontmatter property as a date only when marked", () => {
		expect(keyIsDate({ source: "fm:deadline" })).toBe(false);
		expect(keyIsDate({ source: "fm:deadline", isDate: true })).toBe(true);
	});

	it("resolves the colour and label of a relation", () => {
		const key = {
			source: "builtin:due",
			values: [
				{ match: "<today", label: "Overdue", color: "#f00" },
				{ match: ">today", color: "#00f" },
			],
		};
		expect(dateDisplay(key, "<today")).toEqual({ label: "Overdue", color: "#f00" });
		// Colour without a label: the date keeps its own wording.
		expect(dateDisplay(key, ">today")).toEqual({ label: "", color: "#00f" });
		expect(dateDisplay(key, "today")).toEqual({ label: "", color: null });
	});

	it("leaves an unconfigured date entirely alone", () => {
		expect(dateDisplay({ source: "builtin:due" }, "<today")).toEqual({
			label: "",
			color: null,
		});
	});
});
