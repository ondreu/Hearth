import { describe, expect, it } from "vitest";
import {
	filterHashtagLabel,
	filterTagLabel,
	inlineTags,
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

describe("filterHashtagLabel", () => {
	it("keeps a nested tag whole and puts the # back", () => {
		expect(filterHashtagLabel("work/urgent")).toBe("#work/urgent");
		expect(filterHashtagLabel("#Work")).toBe("#Work");
	});
});

describe("inlineTags", () => {
	it("reads hashtags written in a task line, without their #", () => {
		expect(inlineTags("Write report #work #work/urgent")).toEqual(["work", "work/urgent"]);
	});

	it("ignores a # that is not a tag", () => {
		expect(inlineTags("See https://example.com/page#top")).toEqual([]);
		expect(inlineTags("Close issue #1")).toEqual([]);
		expect(inlineTags("a#b")).toEqual([]);
	});

	it("de-duplicates case-insensitively, keeping the first spelling", () => {
		expect(inlineTags("#Work and #work")).toEqual(["Work"]);
	});
});

describe("isTaskFilterActive", () => {
	it("treats contexts, projects and tags as active constraints", () => {
		expect(isTaskFilterActive({ contexts: ["home"] })).toBe(true);
		expect(isTaskFilterActive({ projects: ["[[Alpha]]"] })).toBe(true);
		expect(isTaskFilterActive({ tags: ["work"] })).toBe(true);
		expect(isTaskFilterActive({ tags: [] })).toBe(false);
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

	it("matches tags with OR semantics, ignoring a leading # and case", () => {
		const filter: TaskFilterConfig = { tags: ["#Work", "errands"] };
		expect(taskMatchesFilter(hit({ tags: ["work"] }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ tags: ["#errands"] }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ tags: ["work/urgent"] }), filter, today)).toBe(false);
		expect(taskMatchesFilter(hit({ tags: [] }), filter, today)).toBe(false);
		expect(taskMatchesFilter(hit(), filter, today)).toBe(false);
	});

	it("ANDs tags with the other dimensions", () => {
		const filter: TaskFilterConfig = { tags: ["work"], priorities: ["high"] };
		expect(taskMatchesFilter(hit({ tags: ["work"], priority: "high" }), filter, today)).toBe(true);
		expect(taskMatchesFilter(hit({ tags: ["work"], priority: "low" }), filter, today)).toBe(false);
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

	describe("date filter", () => {
		it("matches today on the scheduled date even when due is in the future", () => {
			const filter: TaskFilterConfig = { due: "today" };
			expect(taskMatchesFilter(hit({ due: "2026-08-26", scheduled: today }), filter, today)).toBe(true);
			expect(taskMatchesFilter(hit({ due: today, scheduled: "2026-08-26" }), filter, today)).toBe(true);
			expect(taskMatchesFilter(hit({ due: "2026-08-26", scheduled: "2026-08-25" }), filter, today)).toBe(false);
		});

		it("ignores a time component on either date", () => {
			const filter: TaskFilterConfig = { due: "today" };
			expect(taskMatchesFilter(hit({ scheduled: `${today}T09:00` }), filter, today)).toBe(true);
		});

		it("matches this week on whichever date falls in the window", () => {
			const filter: TaskFilterConfig = { due: "week" };
			expect(taskMatchesFilter(hit({ due: "2026-09-30", scheduled: "2026-08-21" }), filter, today)).toBe(true);
			expect(taskMatchesFilter(hit({ due: "2026-09-30", scheduled: "2026-09-01" }), filter, today)).toBe(false);
		});

		it("treats a past scheduled date as overdue unless the task is done", () => {
			const filter: TaskFilterConfig = { due: "overdue" };
			expect(taskMatchesFilter(hit({ due: "2026-08-26", scheduled: "2026-08-18" }), filter, today)).toBe(true);
			expect(
				taskMatchesFilter(hit({ due: "2026-08-26", scheduled: "2026-08-18", done: true }), filter, today),
			).toBe(false);
			expect(taskMatchesFilter(hit({ due: "2026-08-26", scheduled: today }), filter, today)).toBe(false);
		});

		it("counts a scheduled-only task as having a date", () => {
			expect(taskMatchesFilter(hit({ scheduled: "2026-09-01" }), { due: "hasDate" }, today)).toBe(true);
			expect(taskMatchesFilter(hit({ scheduled: "2026-09-01" }), { due: "noDate" }, today)).toBe(false);
			expect(taskMatchesFilter(hit(), { due: "noDate" }, today)).toBe(true);
		});
	});
});
