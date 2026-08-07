import { describe, expect, it } from "vitest";
import {
	checkboxLines,
	countCheckboxes,
	toggleCheckboxAt,
	toggleCheckboxLine,
} from "../src/checkboxes";

describe("checkboxLines", () => {
	it("finds bullet, ordered and quoted task lines", () => {
		const md = ["- [ ] one", "* [x] two", "+ [ ] three", "1. [ ] four", "2) [x] five", "> - [ ] six"].join("\n");
		expect(checkboxLines(md)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it("keeps indented (nested) tasks", () => {
		const md = ["- [ ] parent", "\t- [ ] child", "    - [x] grandchild"].join("\n");
		expect(checkboxLines(md)).toEqual([0, 1, 2]);
	});

	it("ignores plain list items and prose brackets", () => {
		const md = ["- plain", "- [ ]no space after", "text [ ] mid-line", "- [ ] real"].join("\n");
		expect(checkboxLines(md)).toEqual([3]);
	});

	it("accepts a task whose text is empty", () => {
		expect(checkboxLines("- [ ]")).toEqual([0]);
	});

	it("skips fenced code blocks, which render as text", () => {
		const md = ["- [ ] before", "```md", "- [ ] not a checkbox", "```", "- [x] after"].join("\n");
		expect(checkboxLines(md)).toEqual([0, 4]);
	});

	it("handles tilde fences and longer closing fences", () => {
		const md = ["~~~", "- [ ] hidden", "~~~", "````", "- [ ] also hidden", "````", "- [ ] shown"].join("\n");
		expect(checkboxLines(md)).toEqual([6]);
	});

	it("does not close a backtick fence with a tilde one", () => {
		const md = ["```", "- [ ] hidden", "~~~", "- [ ] still hidden"].join("\n");
		expect(checkboxLines(md)).toEqual([]);
	});

	it("skips frontmatter by default and counts it when asked not to", () => {
		const md = ["---", "tags:", "  - [ ] odd", "---", "- [ ] body"].join("\n");
		expect(checkboxLines(md)).toEqual([4]);
		expect(checkboxLines(md, { skipFrontmatter: false })).toEqual([2, 4]);
	});

	it("only treats a leading block as frontmatter", () => {
		const md = ["- [ ] first", "---", "a: 1", "---", "- [ ] second"].join("\n");
		expect(checkboxLines(md)).toEqual([0, 4]);
	});

	it("tolerates CRLF line endings", () => {
		expect(checkboxLines("- [ ] one\r\n- [x] two\r\n")).toEqual([0, 1]);
	});
});


describe("countCheckboxes", () => {
	it("counts what the renderer would emit", () => {
		expect(countCheckboxes("- [ ] a\n- [x] b\n- plain")).toBe(2);
		expect(countCheckboxes("no tasks here")).toBe(0);
	});
});


describe("toggleCheckboxLine", () => {
	it("checks and unchecks", () => {
		expect(toggleCheckboxLine("- [ ] milk", true)).toBe("- [x] milk");
		expect(toggleCheckboxLine("- [x] milk", false)).toBe("- [ ] milk");
	});

	it("resets a custom status when unchecked", () => {
		expect(toggleCheckboxLine("- [/] in progress", false)).toBe("- [ ] in progress");
	});

	it("treats a custom status as already checked", () => {
		expect(toggleCheckboxLine("- [/] in progress", true)).toBe("- [/] in progress");
	});

	it("leaves an already-correct line untouched", () => {
		expect(toggleCheckboxLine("- [x] done", true)).toBe("- [x] done");
	});

	it("preserves indentation, markers and trailing text", () => {
		expect(toggleCheckboxLine("  \t2) [ ] buy #tag [link]", true)).toBe("  \t2) [x] buy #tag [link]");
		expect(toggleCheckboxLine("> - [ ] quoted", true)).toBe("> - [x] quoted");
	});

	it("only rewrites the first bracket pair", () => {
		expect(toggleCheckboxLine("- [ ] see [ ] example", true)).toBe("- [x] see [ ] example");
	});

	it("returns null for a non-task line", () => {
		expect(toggleCheckboxLine("- plain", true)).toBeNull();
		expect(toggleCheckboxLine("", true)).toBeNull();
	});
});


describe("toggleCheckboxAt", () => {
	const md = ["# List", "- [ ] one", "- [x] two", "- [ ] three"].join("\n");

	it("toggles by ordinal, not by line", () => {
		expect(toggleCheckboxAt(md, 0, true)).toBe("# List\n- [x] one\n- [x] two\n- [ ] three");
		expect(toggleCheckboxAt(md, 1, false)).toBe("# List\n- [ ] one\n- [ ] two\n- [ ] three");
		expect(toggleCheckboxAt(md, 2, true)).toBe("# List\n- [ ] one\n- [x] two\n- [x] three");
	});

	it("counts past frontmatter so ordinals match the rendered output", () => {
		const withFm = ["---", "title: Shopping", "---", "- [ ] one", "- [ ] two"].join("\n");
		expect(toggleCheckboxAt(withFm, 1, true)).toBe(
			"---\ntitle: Shopping\n---\n- [ ] one\n- [x] two",
		);
	});

	it("skips code fences when resolving the ordinal", () => {
		const withCode = ["- [ ] one", "```", "- [ ] fake", "```", "- [ ] two"].join("\n");
		expect(toggleCheckboxAt(withCode, 1, true)).toBe(
			"- [ ] one\n```\n- [ ] fake\n```\n- [x] two",
		);
	});

	it("returns null when the ordinal is out of range", () => {
		expect(toggleCheckboxAt(md, 3, true)).toBeNull();
		expect(toggleCheckboxAt(md, -1, true)).toBeNull();
		expect(toggleCheckboxAt("no tasks", 0, true)).toBeNull();
	});

	it("leaves the rest of the note byte-identical", () => {
		const note = "---\na: 1\n---\n\ntext\n\n- [ ] task\n\n> quote\n";
		expect(toggleCheckboxAt(note, 0, true)).toBe("---\na: 1\n---\n\ntext\n\n- [x] task\n\n> quote\n");
	});
});
