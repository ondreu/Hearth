import { describe, expect, it } from "vitest";
import moment from "moment";
import {
	DEFAULT_PERIODIC_FORMATS,
	GRANULARITIES,
	type Granularity,
	isGranularity,
	PERIODICITY_KEYS,
	periodicConfigFrom,
	periodicNotePath,
	periodicOpenCommandId,
} from "../src/periodic";

/**
 * The Periodic Notes integration (issue #116).
 *
 * Everything that touches the running plugin is Obsidian API and stays
 * untested (per the no-mocks rule). What's covered here is the part that
 * decides *what Hearth believes about another plugin's data*: reading a
 * granularity out of its 0.x settings object, turning that into a vault path,
 * and picking its "open this period's note" command out of the command
 * registry. Those three are where a version difference or a hand-edited
 * setting turns into a card that silently shows nothing.
 */

const at = (iso: string) => moment(iso);

describe("periodicConfigFrom", () => {
	const settings = {
		daily: { enabled: true, format: "YYYY-MM-DD", folder: "Journal", template: "T/Daily.md" },
		weekly: { enabled: true, format: "gggg-[W]ww", folder: "Journal/Weeks" },
		monthly: { enabled: false, format: "YYYY-MM", folder: "Journal/Months" },
	};

	it("reads a granularity from its periodicity key", () => {
		expect(periodicConfigFrom(settings, "week")).toEqual({
			format: "gggg-[W]ww",
			folder: "Journal/Weeks",
		});
	});

	it("keeps the template when one is configured, and omits it when not", () => {
		expect(periodicConfigFrom(settings, "day")?.template).toBe("T/Daily.md");
		expect(periodicConfigFrom(settings, "week")).not.toHaveProperty("template");
	});

	it("treats a disabled note type as unconfigured", () => {
		expect(periodicConfigFrom(settings, "month")).toBeNull();
	});

	it("reports nothing for a granularity the settings don't mention", () => {
		expect(periodicConfigFrom(settings, "quarter")).toBeNull();
		expect(periodicConfigFrom(settings, "year")).toBeNull();
	});

	it("falls back to Periodic Notes' own default format when the format is blank", () => {
		for (const granularity of GRANULARITIES) {
			const settings = { [PERIODICITY_KEYS[granularity]]: { enabled: true, format: "   " } };
			expect(periodicConfigFrom(settings, granularity)?.format).toBe(
				DEFAULT_PERIODIC_FORMATS[granularity],
			);
		}
	});

	it("normalizes the folder, and defaults it to the vault root", () => {
		expect(periodicConfigFrom({ weekly: { folder: "/Journal/Weeks/" } }, "week")?.folder).toBe(
			"Journal/Weeks",
		);
		expect(periodicConfigFrom({ weekly: {} }, "week")?.folder).toBe("");
	});

	it("resolves an entry that never wrote an enabled flag", () => {
		// Only an explicit `false` means off — an older or hand-edited shape that
		// simply omits the flag must not make the card look unconfigured.
		expect(periodicConfigFrom({ weekly: { format: "YYYY-[W]WW" } }, "week")).toEqual({
			format: "YYYY-[W]WW",
			folder: "",
		});
	});

	it("survives every shape another plugin's settings can arrive in", () => {
		// Periodic Notes 1.0 keeps its configuration in a Svelte store, so none of
		// these keys are there at all; the rest is ordinary defensiveness.
		const stubStore = { subscribe: () => () => undefined };
		for (const settings of [undefined, null, "weekly", 42, [], {}, stubStore]) {
			expect(periodicConfigFrom(settings, "week")).toBeNull();
		}
		expect(periodicConfigFrom({ weekly: null }, "week")).toBeNull();
		expect(periodicConfigFrom({ weekly: "Journal" }, "week")).toBeNull();
		// A non-string format/folder is ignored rather than interpolated.
		expect(periodicConfigFrom({ weekly: { format: 7, folder: 9 } }, "week")).toEqual({
			format: DEFAULT_PERIODIC_FORMATS.week,
			folder: "",
		});
	});
});

describe("periodicNotePath", () => {
	it("joins the folder and the formatted name", () => {
		expect(
			periodicNotePath({ format: "gggg-[W]ww", folder: "Journal/Weeks" }, at("2026-08-28")),
		).toBe("Journal/Weeks/2026-W35.md");
	});

	it("writes into the vault root when no folder is set", () => {
		expect(periodicNotePath({ format: "YYYY-MM", folder: "" }, at("2026-08-28"))).toBe(
			"2026-08.md",
		);
	});

	it("keeps a format that nests folders of its own", () => {
		// Periodic Notes allows date-formatted folders inside the format itself.
		expect(
			periodicNotePath({ format: "gggg/[W]ww", folder: "/Journal/" }, at("2026-08-28")),
		).toBe("Journal/2026/W35.md");
	});

	it("names the same note for every day of the period", () => {
		const config = { format: DEFAULT_PERIODIC_FORMATS.month, folder: "" };
		expect(periodicNotePath(config, at("2026-08-01"))).toBe(
			periodicNotePath(config, at("2026-08-31")),
		);
	});
});

describe("periodicOpenCommandId", () => {
	/** The commands Periodic Notes 0.x registers with every note type on. */
	const ids = [
		"periodic-notes:show-date-switcher",
		"periodic-notes:open-daily-note",
		"periodic-notes:next-daily-note",
		"periodic-notes:prev-daily-note",
		"periodic-notes:open-weekly-note",
		"periodic-notes:next-weekly-note",
		"periodic-notes:prev-weekly-note",
		"periodic-notes:open-monthly-note",
		"periodic-notes:open-quarterly-note",
		"periodic-notes:open-yearly-note",
		"daily-notes",
		"calendar:open-weekly-note",
	];

	it("finds the open command for each granularity", () => {
		const found: Record<string, string | null> = {};
		for (const granularity of GRANULARITIES) {
			found[granularity] = periodicOpenCommandId(ids, granularity);
		}
		expect(found).toEqual({
			day: "periodic-notes:open-daily-note",
			week: "periodic-notes:open-weekly-note",
			month: "periodic-notes:open-monthly-note",
			quarter: "periodic-notes:open-quarterly-note",
			year: "periodic-notes:open-yearly-note",
		});
	});

	it("never picks a navigation command, or another plugin's", () => {
		expect(periodicOpenCommandId(["periodic-notes:next-weekly-note"], "week")).toBeNull();
		expect(periodicOpenCommandId(["periodic-notes:prev-weekly-note"], "week")).toBeNull();
		expect(periodicOpenCommandId(["calendar:open-weekly-note"], "week")).toBeNull();
	});

	it("matches a build that names its commands by granularity", () => {
		// Periodic Notes 1.0 derives its commands from the granularity words.
		expect(periodicOpenCommandId(["periodic-notes:open-week"], "week")).toBe(
			"periodic-notes:open-week",
		);
	});

	it("reports nothing for a note type the user hasn't turned on", () => {
		// Both generations register a command only for enabled note types, which
		// is how the card tells "off" from "on but empty".
		expect(periodicOpenCommandId(["periodic-notes:open-daily-note"], "quarter")).toBeNull();
	});

	it("ignores 1.0's fiscal year, which isn't a granularity Hearth offers", () => {
		expect(periodicOpenCommandId(["periodic-notes:open-fiscal-year"], "year")).toBeNull();
	});

	it("prefers the open command over another that names the same period", () => {
		const ids = ["periodic-notes:weekly-switcher", "periodic-notes:open-weekly-note"];
		expect(periodicOpenCommandId(ids, "week")).toBe("periodic-notes:open-weekly-note");
	});
});

describe("isGranularity", () => {
	it("accepts every granularity the card offers", () => {
		for (const granularity of GRANULARITIES) expect(isGranularity(granularity)).toBe(true);
	});

	it("rejects anything else a persisted card could carry", () => {
		for (const value of ["weekly", "", "fiscalYear", 1, null, undefined, {}]) {
			expect(isGranularity(value)).toBe(false);
		}
	});
});

describe("the granularity tables", () => {
	it("covers every granularity, once", () => {
		const keys = GRANULARITIES.map((g: Granularity) => PERIODICITY_KEYS[g]);
		expect(keys).toEqual(["daily", "weekly", "monthly", "quarterly", "yearly"]);
		expect(new Set(GRANULARITIES).size).toBe(GRANULARITIES.length);
		for (const granularity of GRANULARITIES) {
			expect(DEFAULT_PERIODIC_FORMATS[granularity], granularity).toBeTruthy();
		}
	});
});
