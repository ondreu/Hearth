import { describe, expect, it } from "vitest";
import {
	asNumber,
	dayKeyOf,
	formatHeatValue,
	frontmatterValue,
	heatmapByDay,
	heatmapSource,
	matchesRule,
	matchesRules,
	needsMetadata,
	noteDayKeys,
	noteWeight,
	type HeatmapNote,
} from "../src/heatmapmetric";
import type { HeatmapConfig, HeatmapRule } from "../src/types";

/**
 * The heatmap card's advanced (custom-metric) mode: which day a note lands on,
 * what it adds there, and the rules deciding whether it counts at all. All pure
 * — no vault, no Obsidian app (see src/heatmapmetric.ts). The test timezone is
 * pinned to UTC by vitest.config.ts, so day keys are deterministic.
 */

const DAY = 86_400_000;

function note(over: Partial<HeatmapNote> = {}): HeatmapNote {
	return {
		path: "Notes/Example.md",
		ctime: Date.UTC(2026, 0, 2, 10, 0),
		mtime: Date.UTC(2026, 0, 3, 10, 0),
		...over,
	};
}

function rule(over: Partial<HeatmapRule> = {}): HeatmapRule {
	return { id: "r1", ...over };
}

describe("dayKeyOf", () => {
	it("reads an ISO date", () => {
		expect(dayKeyOf("2026-08-30")).toBe("2026-08-30");
	});

	it("reads an ISO date with a time, as a local wall-clock day", () => {
		expect(dayKeyOf("2026-08-30T23:30:00")).toBe("2026-08-30");
		expect(dayKeyOf("2026-08-30 07:15")).toBe("2026-08-30");
	});

	it("reads a Date the YAML parser already built", () => {
		expect(dayKeyOf(new Date(Date.UTC(2026, 7, 30, 12)))).toBe("2026-08-30");
	});

	it("reads an epoch timestamp", () => {
		expect(dayKeyOf(Date.UTC(2026, 7, 30, 12))).toBe("2026-08-30");
	});

	it("does not mistake a bare year for a timestamp", () => {
		expect(dayKeyOf(2026)).toBeNull();
	});

	it("reads a daily-note link", () => {
		expect(dayKeyOf("[[2026-08-30]]")).toBe("2026-08-30");
		expect(dayKeyOf("[[journal/2026-08-30|Sunday]]")).toBe("2026-08-30");
	});

	it("rejects an impossible date", () => {
		expect(dayKeyOf("2026-13-01")).toBeNull();
		expect(dayKeyOf("2026-02-31")).toBeNull();
	});

	it("rejects what isn't a date at all", () => {
		expect(dayKeyOf("")).toBeNull();
		expect(dayKeyOf(null)).toBeNull();
		expect(dayKeyOf(undefined)).toBeNull();
		expect(dayKeyOf("in progress")).toBeNull();
		expect(dayKeyOf({ nested: true })).toBeNull();
	});
});

describe("frontmatterValue", () => {
	it("reads a key case-insensitively, preferring the exact spelling", () => {
		const n = note({ frontmatter: { Date: "2026-01-01", date: "2026-02-02" } });
		expect(frontmatterValue(n, "date")).toBe("2026-02-02");
		expect(frontmatterValue(n, "Date")).toBe("2026-01-01");
		expect(frontmatterValue(n, "DATE")).toBe("2026-01-01");
	});

	it("is undefined without frontmatter or without a key", () => {
		expect(frontmatterValue(note(), "date")).toBeUndefined();
		expect(frontmatterValue(note({ frontmatter: { date: "x" } }), "")).toBeUndefined();
	});
});

describe("asNumber", () => {
	it("takes numbers, numeric strings and booleans", () => {
		expect(asNumber(3)).toBe(3);
		expect(asNumber("2.5")).toBe(2.5);
		expect(asNumber(" 7 ")).toBe(7);
		expect(asNumber(true)).toBe(1);
		expect(asNumber(false)).toBe(0);
	});

	it("blank is not zero, and prose is not a number", () => {
		expect(asNumber("")).toBeNull();
		expect(asNumber("   ")).toBeNull();
		expect(asNumber("many")).toBeNull();
		expect(asNumber(null)).toBeNull();
		expect(asNumber(Infinity)).toBeNull();
	});
});

describe("matchesRule", () => {
	const tagged = note({
		path: "Fitness/Runs/Tuesday.md",
		frontmatter: { status: "done", minutes: 30, people: ["Ada", "Grace"] },
		tags: ["#health/run", "#log"],
	});

	it("compares a property case-insensitively", () => {
		expect(matchesRule(tagged, rule({ key: "status", op: "is", value: "DONE" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "status", op: "is", value: "open" }))).toBe(false);
		expect(matchesRule(tagged, rule({ key: "status", op: "isNot", value: "open" }))).toBe(true);
	});

	it("tests list properties item by item", () => {
		expect(matchesRule(tagged, rule({ key: "people", op: "is", value: "grace" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "people", op: "contains", value: "ad" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "people", op: "notContains", value: "bob" }))).toBe(true);
	});

	it("compares numbers numerically, not as text", () => {
		expect(matchesRule(tagged, rule({ key: "minutes", op: "gt", value: "5" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "minutes", op: "lt", value: "5" }))).toBe(false);
		expect(matchesRule(tagged, rule({ key: "minutes", op: "lt", value: "100" }))).toBe(true);
	});

	it("compares dates by date", () => {
		const n = note({ frontmatter: { due: "2026-08-30" } });
		expect(matchesRule(n, rule({ key: "due", op: "gt", value: "2026-01-01" }))).toBe(true);
		expect(matchesRule(n, rule({ key: "due", op: "lt", value: "2026-01-01" }))).toBe(false);
	});

	it("knows a set property from a missing one", () => {
		expect(matchesRule(tagged, rule({ key: "status", op: "exists" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "status", op: "missing" }))).toBe(false);
		expect(matchesRule(tagged, rule({ key: "project", op: "exists" }))).toBe(false);
		expect(matchesRule(tagged, rule({ key: "project", op: "missing" }))).toBe(true);
	});

	it("matches a tag with or without its #, including nested tags", () => {
		expect(matchesRule(tagged, rule({ field: "tag", op: "is", value: "log" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "tag", op: "is", value: "#log" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "tag", op: "is", value: "health" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "tag", op: "is", value: "health/run" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "tag", op: "is", value: "work" }))).toBe(false);
		expect(matchesRule(tagged, rule({ field: "tag", op: "isNot", value: "work" }))).toBe(true);
	});

	it("matches on the folder and the full path", () => {
		expect(matchesRule(tagged, rule({ field: "folder", op: "is", value: "Fitness/Runs" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "folder", op: "contains", value: "fitness" }))).toBe(true);
		expect(matchesRule(tagged, rule({ field: "path", op: "contains", value: "tuesday" }))).toBe(true);
		const root = note({ path: "Inbox.md" });
		expect(matchesRule(root, rule({ field: "folder", op: "is", value: "" }))).toBe(true);
	});

	it("passes an unfinished rule rather than blanking the card", () => {
		// A row the user is still typing: no key yet, or no value yet.
		expect(matchesRule(tagged, rule({ op: "is", value: "done" }))).toBe(true);
		expect(matchesRule(tagged, rule({ key: "status", op: "is" }))).toBe(true);
	});
});

describe("matchesRules", () => {
	const n = note({ frontmatter: { status: "done", minutes: 30 }, tags: ["#log"] });

	it("counts every note when there are no rules", () => {
		expect(matchesRules(n, {})).toBe(true);
		expect(matchesRules(n, { rules: [] })).toBe(true);
	});

	it('"all" needs every rule to pass', () => {
		const cfg: HeatmapConfig = {
			rules: [
				rule({ id: "a", key: "status", op: "is", value: "done" }),
				rule({ id: "b", key: "minutes", op: "gt", value: "10" }),
			],
		};
		expect(matchesRules(n, cfg)).toBe(true);
		cfg.rules![1].value = "60";
		expect(matchesRules(n, cfg)).toBe(false);
	});

	it('"any" needs only one', () => {
		const cfg: HeatmapConfig = {
			match: "any",
			rules: [
				rule({ id: "a", key: "status", op: "is", value: "open" }),
				rule({ id: "b", field: "tag", op: "is", value: "log" }),
			],
		};
		expect(matchesRules(n, cfg)).toBe(true);
		cfg.rules![1].value = "work";
		expect(matchesRules(n, cfg)).toBe(false);
	});
});

describe("noteDayKeys", () => {
	const n = note({ frontmatter: { date: "2026-08-30", dates: ["2026-08-30", "2026-09-01", "not a date", "2026-08-30"] } });

	it("defaults to the modified date", () => {
		expect(noteDayKeys(n, {})).toEqual(["2026-01-03"]);
		expect(noteDayKeys(n, { source: "created" })).toEqual(["2026-01-02"]);
	});

	it("falls back to the basic card's metric, so turning Advanced on keeps counting the same thing", () => {
		expect(noteDayKeys(n, { advanced: true, metric: "created" })).toEqual(["2026-01-02"]);
		expect(heatmapSource({ advanced: true, metric: "created" })).toBe("created");
		// An explicit source wins over the basic metric it was carried from.
		expect(noteDayKeys(n, { advanced: true, metric: "created", source: "modified" })).toEqual([
			"2026-01-03",
		]);
	});

	it("reads a frontmatter date", () => {
		expect(noteDayKeys(n, { source: "property", dateProperty: "date" })).toEqual(["2026-08-30"]);
	});

	it("counts a list once per parseable, distinct entry", () => {
		expect(noteDayKeys(n, { source: "property", dateProperty: "dates" })).toEqual([
			"2026-08-30",
			"2026-09-01",
		]);
	});

	it("lands nowhere when the property is absent or unparseable", () => {
		expect(noteDayKeys(n, { source: "property", dateProperty: "missing" })).toEqual([]);
		expect(noteDayKeys(n, { source: "property" })).toEqual([]);
	});
});

describe("noteWeight", () => {
	it("counts one per note by default", () => {
		expect(noteWeight(note({ frontmatter: { minutes: 30 } }), {})).toBe(1);
	});

	it("sums the configured property, including list values", () => {
		const cfg: HeatmapConfig = { value: "sum", valueProperty: "minutes" };
		expect(noteWeight(note({ frontmatter: { minutes: 30 } }), cfg)).toBe(30);
		expect(noteWeight(note({ frontmatter: { minutes: ["10", 5.5] } }), cfg)).toBe(15.5);
	});

	it("adds nothing when the value isn't a number — it is not a note count", () => {
		const cfg: HeatmapConfig = { value: "sum", valueProperty: "minutes" };
		expect(noteWeight(note({ frontmatter: { minutes: "a while" } }), cfg)).toBe(0);
		expect(noteWeight(note(), cfg)).toBe(0);
	});
});

describe("heatmapByDay", () => {
	const notes: HeatmapNote[] = [
		note({
			path: "Fitness/Run 1.md",
			mtime: Date.UTC(2026, 7, 30, 8),
			frontmatter: { date: "2026-08-30", minutes: 30, type: "run" },
			tags: ["#health"],
		}),
		note({
			path: "Fitness/Run 2.md",
			mtime: Date.UTC(2026, 7, 30, 9),
			frontmatter: { date: "2026-08-30", minutes: 20, type: "run" },
			tags: ["#health"],
		}),
		note({
			path: "Work/Standup.md",
			mtime: Date.UTC(2026, 7, 31, 9),
			frontmatter: { date: "2026-08-31", minutes: 15, type: "meeting" },
			tags: ["#work"],
		}),
	];

	it("buckets by the file date with no config, like the basic card", () => {
		expect(Object.fromEntries(heatmapByDay(notes, {}))).toEqual({
			"2026-08-30": 2,
			"2026-08-31": 1,
		});
	});

	it("buckets by a frontmatter date", () => {
		const counts = heatmapByDay(notes, { source: "property", dateProperty: "date" });
		expect(counts.get("2026-08-30")).toBe(2);
		expect(counts.get("2026-08-31")).toBe(1);
	});

	it("sums a property instead of counting notes", () => {
		const counts = heatmapByDay(notes, {
			source: "property",
			dateProperty: "date",
			value: "sum",
			valueProperty: "minutes",
		});
		expect(counts.get("2026-08-30")).toBe(50);
		expect(counts.get("2026-08-31")).toBe(15);
	});

	it("applies the rules before counting", () => {
		const counts = heatmapByDay(notes, {
			source: "property",
			dateProperty: "date",
			rules: [rule({ key: "type", op: "is", value: "run" })],
		});
		expect(counts.get("2026-08-30")).toBe(2);
		expect(counts.has("2026-08-31")).toBe(false);
	});

	it('"any" widens the same rules to a union', () => {
		const counts = heatmapByDay(notes, {
			source: "property",
			dateProperty: "date",
			match: "any",
			rules: [
				rule({ id: "a", key: "type", op: "is", value: "meeting" }),
				rule({ id: "b", field: "folder", op: "is", value: "Fitness" }),
			],
		});
		expect(counts.get("2026-08-30")).toBe(2);
		expect(counts.get("2026-08-31")).toBe(1);
	});

	it("skips notes with no day at all", () => {
		const undated = [...notes, note({ path: "Ideas/Someday.md", frontmatter: {} })];
		const counts = heatmapByDay(undated, { source: "property", dateProperty: "date" });
		expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(3);
	});

	it("spreads a list-valued date across its days", () => {
		const streak = [
			note({
				path: "Habits/Water.md",
				frontmatter: { done: ["2026-08-30", "2026-08-31"] },
			}),
		];
		const counts = heatmapByDay(streak, { source: "property", dateProperty: "done" });
		expect(counts.get("2026-08-30")).toBe(1);
		expect(counts.get("2026-08-31")).toBe(1);
	});

	it("keeps a local-midnight boundary on the local day", () => {
		const late = [note({ path: "Late.md", mtime: Date.UTC(2026, 7, 30, 23, 59) })];
		const early = [note({ path: "Early.md", mtime: Date.UTC(2026, 7, 30, 23, 59) + DAY })];
		expect([...heatmapByDay(late, {}).keys()]).toEqual(["2026-08-30"]);
		expect([...heatmapByDay(early, {}).keys()]).toEqual(["2026-08-31"]);
	});
});

describe("formatHeatValue", () => {
	it("shows whole numbers plainly and fractions to one decimal", () => {
		expect(formatHeatValue(0)).toBe("0");
		expect(formatHeatValue(12)).toBe("12");
		expect(formatHeatValue(2.5)).toBe("2.5");
		expect(formatHeatValue(2.04)).toBe("2");
		expect(formatHeatValue(1.25)).toBe("1.3");
	});
});

describe("needsMetadata", () => {
	it("is false for a basic card, whatever else is configured", () => {
		expect(needsMetadata({})).toBe(false);
		expect(needsMetadata({ source: "property", dateProperty: "date" })).toBe(false);
	});

	it("is true only when the config actually reads frontmatter or tags", () => {
		expect(needsMetadata({ advanced: true })).toBe(false);
		expect(needsMetadata({ advanced: true, unit: "workouts" })).toBe(false);
		expect(needsMetadata({ advanced: true, metric: "created" })).toBe(false);
		expect(needsMetadata({ advanced: true, source: "property", dateProperty: "date" })).toBe(true);
		expect(needsMetadata({ advanced: true, value: "sum", valueProperty: "minutes" })).toBe(true);
		expect(needsMetadata({ advanced: true, rules: [rule({ key: "status", value: "done" })] })).toBe(true);
	});
});
