import { describe, expect, it } from "vitest";
import { insertCardBlock, KANBAN_CARD_RE, parseKanbanColumns } from "../src/kanbanboard";

/** The board from #400: a real card and an example in a code block. */
const board = (): string[] => [
	"## todo",
	"",
	"## done",
	"",
	"- [ ] Detected",
	"",
	"```",
	"- [ ] still detected",
	"## not a column",
	"```",
];

/** Card lines as the tasks card collects them: checkboxes outside code blocks. */
const cardLines = (lines: string[]): number[] => {
	const { fenced } = parseKanbanColumns(lines);
	return lines.flatMap((l, i) => (!fenced[i] && KANBAN_CARD_RE.test(l) ? [i] : []));
};

describe("parseKanbanColumns (issue #400)", () => {
	it("ignores a heading inside a code block", () => {
		expect(parseKanbanColumns(board()).columns.map((c) => c.heading)).toEqual(["todo", "done"]);
	});

	it("flags only the code block's lines as fenced", () => {
		expect(cardLines(board())).toEqual([4]);
	});

	it("skips frontmatter and code blocks alike", () => {
		const lines = ["---", "kanban-plugin: board", "---", "## a", "```", "- [ ] x", "```", "- [ ] y"];
		expect(cardLines(lines)).toEqual([7]);
	});
});

describe("insertCardBlock (issue #400)", () => {
	it("lands after the last real card, not inside the code block", () => {
		const lines = board();
		expect(insertCardBlock(lines, "done", ["- [x] Moved"])).toBe(true);
		expect(lines.slice(4, 8)).toEqual(["- [ ] Detected", "- [x] Moved", "", "```"]);
		expect(lines[8]).toBe("- [ ] still detected");
	});

	it("lands under the heading when the column holds only a code block", () => {
		const lines = ["## done", "", "```", "- [ ] example", "```"];
		insertCardBlock(lines, "done", ["- [ ] New"]);
		expect(lines).toEqual(["## done", "", "- [ ] New", "", "```", "- [ ] example", "```"]);
	});
});
