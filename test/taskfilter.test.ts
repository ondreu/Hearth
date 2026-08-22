import { describe, expect, it } from "vitest";
import {
	filterTagLabel,
	isTaskFilterActive,
	normalizeFilterTag,
	taskMatchesFilter,
	type TaskFilterHit,
} from "../src/taskfilter";
import type { TaskFilterConfig } from "../src/types";

function hit(overrides: Partial<TaskFilterHit> = {}): TaskFilterHit {
	return {
		text: "Write report",
		fileBasename: "Write report",
		done: false,
		due: null,
		scheduled: null,
		...overrides,
	};
}

describe("normalizeFilterTag", () => {
	it("strips wikilink brackets and folds case", () => {
		expect(normalizeFilterTag("[[Work]]")).toBe("work");
		expect(filterTagLabel("[[Work]]")).toBe("Work");
	});

	it("shows the note basename for path wikilinks", () => {
		expect(filterTagLabel("[[Noting/TaskNotes/Projects/Dropzone]]")).toBe("Dropzone");
		expect(normalizeFilterTag("[[Noting/TaskNotes/Projects/Dropzone]]")).toBe(
			"noting/tasknotes/projects/dropzone",
		);
	});
});

describe("isTaskFilterActive", () => {
	it("treats contexts and projects as active constraints", () => {
		expect(isTaskFilterActive({ contexts: ["home"] })).toBe(true);
		expect(isTaskFilterActive({ projects: ["[[Alpha]]"] })).toBe(true);
		expect(isTaskFilterActive({})).toBe(false);
	});
});

describe("taskMatchesFilter", () => {
	const today = "2026-08-19";

	it("matches TaskNotes contexts with OR semantics inside the dimension", () => {
		const filter: TaskFilterConfig = { contexts: ["home", "work"] };
		expect(taskMatchesFilter(hit({ contexts: ["home"] }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ contexts: ["errands"] }), filter, today)).toBe(false);
	});

	it("matches TaskNotes projects with wikilink normalization", () => {
		const filter: TaskFilterConfig = { projects: ["Alpha"] };
		expect(taskMatchesFilter(hit({ projects: ["[[Alpha]]"] }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ projects: ["Beta"] }), filter, today)).toBe(false);
	});

	it("requires every set dimension to match", () => {
		const filter: TaskFilterConfig = { contexts: ["home"], projects: ["Alpha"] };
		expect(taskMatchesFilter(hit({ contexts: ["home"], projects: ["[[Alpha]]"] }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ contexts: ["home"], projects: [] }), filter, today)).toBe(false);
	});
});
