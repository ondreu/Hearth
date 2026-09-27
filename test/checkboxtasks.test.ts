import { describe, expect, it } from "vitest";
import {
	checkboxTaskEvents,
	checkboxTaskMeta,
	parseCheckboxTask,
	parseCheckboxTasks,
	readEmojiField,
	stripTaskMetadata,
	type CheckboxLayerOptions,
} from "../src/checkboxtasks";
import { taskNotesMeta } from "../src/tasknotes";

/** vitest forces TZ=UTC (see vitest.config.ts), so local midnight is UTC. */
const day = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

const layers = (overrides: Partial<CheckboxLayerOptions> = {}): CheckboxLayerOptions => ({
	scheduled: true,
	due: true,
	completed: true,
	color: "#111111",
	dueColor: "",
	...overrides,
});

describe("parseCheckboxTask", () => {
	it("reads the Tasks-format dates, priority and a clean title", () => {
		const task = parseCheckboxTask("a.md", 3, "- [ ] Pay [[Bills/Rent|rent]] #home ⏫ 📅 2026-10-01 ⏳ 2026-09-28");
		expect(task).toMatchObject({
			path: "a.md",
			line: 3,
			title: "Pay rent",
			status: " ",
			done: false,
			due: "2026-10-01",
			scheduled: "2026-09-28",
			priority: "⏫",
			recurrence: null,
		});
	});

	it("skips undated tasks and non-task lines", () => {
		expect(parseCheckboxTask("a.md", 0, "- [ ] No date")).toBeNull();
		expect(parseCheckboxTask("a.md", 0, "- Plain 📅 2026-10-01")).toBeNull();
		expect(parseCheckboxTask("a.md", 0, "- [ ] ")).toBeNull();
	});

	it("treats x and cancelled as done, other statuses as open", () => {
		expect(parseCheckboxTask("a.md", 0, "- [x] A 📅 2026-10-01")?.done).toBe(true);
		expect(parseCheckboxTask("a.md", 0, "- [-] A 📅 2026-10-01")?.done).toBe(true);
		expect(parseCheckboxTask("a.md", 0, "- [/] A 📅 2026-10-01")?.done).toBe(false);
	});

	it("reads recurrence and the done date", () => {
		const task = parseCheckboxTask("a.md", 0, "  * [ ] Water 🔁 every week 📅 2026-10-01 ✅ 2026-09-24");
		expect(task?.recurrence).toBe("every week");
		expect(task?.doneDate).toBe("2026-09-24");
	});
});

describe("parseCheckboxTasks", () => {
	it("keeps line numbers and skips fenced code", () => {
		const note = [
			"# Todo",
			"- [ ] One 📅 2026-10-01",
			"```",
			"- [ ] Not a task 📅 2026-10-01",
			"```",
			"- [ ] Two ⏳ 2026-10-02",
		].join("\n");
		expect(parseCheckboxTasks("a.md", note).map((t) => [t.title, t.line])).toEqual([
			["One", 1],
			["Two", 5],
		]);
	});
});

describe("checkboxTaskEvents", () => {
	const windowStart = day("2026-09-01");
	const windowEnd = day("2026-11-01");

	it("draws one all-day entry per date, once when both fall on the same day", () => {
		const tasks = parseCheckboxTasks(
			"a.md",
			["- [ ] Split ⏳ 2026-09-28 📅 2026-10-01", "- [ ] Same ⏳ 2026-10-05 📅 2026-10-05"].join("\n"),
		);
		const events = checkboxTaskEvents(tasks, layers({ dueColor: "#ff0000" }), windowStart, windowEnd);
		expect(events.map((e) => [e.summary, e.start, e.allDay])).toEqual([
			["Split", day("2026-09-28"), true],
			["Split", day("2026-10-01"), true],
			["Same", day("2026-10-05"), true],
		]);
		const due = checkboxTaskMeta(taskNotesMeta(events[1]));
		expect(due).toMatchObject({ kind: "due", line: 0, color: "#ff0000", dayKey: "2026-10-01" });
	});

	it("honours the layer toggles, the window and hidden completed tasks", () => {
		const tasks = parseCheckboxTasks(
			"a.md",
			["- [ ] A ⏳ 2026-09-28 📅 2026-10-01", "- [x] Done 📅 2026-10-02", "- [ ] Late 📅 2027-01-01"].join("\n"),
		);
		const events = checkboxTaskEvents(tasks, layers({ scheduled: false, completed: false }), windowStart, windowEnd);
		expect(events.map((e) => [e.summary, e.start])).toEqual([["A", day("2026-10-01")]]);
	});

	it("marks a recurring task done only on the day it was completed", () => {
		const tasks = parseCheckboxTasks("a.md", "- [ ] Water 🔁 every week 📅 2026-10-01 ✅ 2026-10-01");
		const [ev] = checkboxTaskEvents(tasks, layers(), windowStart, windowEnd);
		expect(taskNotesMeta(ev)).toMatchObject({ recurring: true, done: true });
	});
});

describe("shared emoji helpers", () => {
	it("read one field and strip them all", () => {
		expect(readEmojiField("Do it 📅 tomorrow ⏫", "📅")).toBe("tomorrow");
		expect(stripTaskMetadata("Do it 📅 2026-10-01 ⏫")).toBe("Do it");
	});
});
