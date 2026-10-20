import { describe, expect, it } from "vitest";
import { descriptionIssues, descriptionLineIssue, descriptionLines, parseDescriptionLine } from "../src/taskdescription";

/**
 * A task description is stored one sub-bullet per line. Inline Markdown
 * survives that and is drawn; block Markdown does not, and is flagged.
 */
describe("parseDescriptionLine", () => {
	it("keeps plain text whole", () => {
		expect(parseDescriptionLine("call the plumber")).toEqual([{ kind: "text", text: "call the plumber" }]);
	});

	it("reads the inline forms", () => {
		expect(parseDescriptionLine("**a** *b* _c_ ~~d~~ ==e== `f`").filter((s) => s.kind !== "text")).toEqual([
			{ kind: "bold", text: "a" },
			{ kind: "italic", text: "b" },
			{ kind: "italic", text: "c" },
			{ kind: "strike", text: "d" },
			{ kind: "highlight", text: "e" },
			{ kind: "code", text: "f" },
		]);
	});

	it("reads links and tags", () => {
		expect(parseDescriptionLine("see [[Plan|the plan]] or [docs](https://x.io) #work/home")).toEqual([
			{ kind: "text", text: "see " },
			{ kind: "wikilink", text: "the plan", target: "Plan" },
			{ kind: "text", text: " or " },
			{ kind: "link", text: "docs", target: "https://x.io" },
			{ kind: "text", text: " " },
			{ kind: "tag", text: "#work/home" },
		]);
	});

	it("leaves code, snake_case, numbers and unclosed markers alone", () => {
		expect(parseDescriptionLine("`**not bold**`")).toEqual([{ kind: "code", text: "**not bold**" }]);
		expect(parseDescriptionLine("snake_case_name")).toEqual([{ kind: "text", text: "snake_case_name" }]);
		expect(parseDescriptionLine("issue #123 and a#b")).toEqual([{ kind: "text", text: "issue #123 and a#b" }]);
		expect(parseDescriptionLine("**open")).toEqual([{ kind: "text", text: "**open" }]);
	});
});

describe("descriptionLineIssue", () => {
	it("passes inline formatting and a leading bullet", () => {
		expect(descriptionLineIssue("**bold** and [[link]]")).toBeNull();
		expect(descriptionLineIssue("- a bullet")).toBeNull();
		expect(descriptionLineIssue("1. numbered")).toBeNull();
	});

	it("flags block Markdown", () => {
		expect(descriptionLineIssue("## Heading")).toBe("heading");
		expect(descriptionLineIssue("- [ ] sub-task")).toBe("checkbox");
		expect(descriptionLineIssue("[x] done")).toBe("checkbox");
		expect(descriptionLineIssue("> quote")).toBe("quote");
		expect(descriptionLineIssue("```js")).toBe("codeblock");
		expect(descriptionLineIssue("| a | b |")).toBe("table");
		expect(descriptionLineIssue("---")).toBe("rule");
		expect(descriptionLineIssue("![[photo.png]]")).toBe("embed");
		expect(descriptionLineIssue("  indented")).toBe("indent");
		expect(descriptionLineIssue("#tag is fine")).toBeNull();
	});

	it("numbers lines as the textarea shows them", () => {
		expect(descriptionIssues("ok\n\n# h\n  x")).toEqual([
			{ line: 3, text: "# h", issue: "heading" },
			{ line: 4, text: "x", issue: "indent" },
		]);
	});

	it("stores trimmed, non-blank lines", () => {
		expect(descriptionLines(" a \n\n b")).toEqual(["a", "b"]);
	});
});
