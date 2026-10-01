import { describe, expect, it } from "vitest";
import { notePreviewText, PREVIEW_SIZE, previewSize } from "../src/notepreview";

/** The text a folder browser's tile shows for a note (#375). */

const note = (...lines: string[]) => lines.join("\n");

describe("notePreviewText", () => {
	it("leaves the properties out", () => {
		expect(notePreviewText(note("---", "title: Hidden", "tags: [a]", "---", "Body text."))).toBe(
			"Body text.",
		);
	});

	it("keeps the lines, without their markup", () => {
		const text = note(
			"# Heading",
			"",
			"Some **bold** and *italic* with a [[Target|label]] and a [link](https://x.y).",
			"- item one",
			"- [x] done task",
			"1. first",
			"> quoted",
		);
		expect(notePreviewText(text)).toBe(
			note(
				"Heading",
				"Some bold and italic with a label and a link.",
				"item one",
				"done task",
				"first",
				"quoted",
			),
		);
	});

	it("drops what isn't prose: code, comments, embeds, rules, block ids", () => {
		const text = note(
			"Before",
			"```dataview",
			"LIST FROM #x",
			"```",
			"%% a private comment %%",
			"<!-- html comment -->",
			"![[picture.png]]",
			"![alt](img.png)",
			"***",
			"After ^block-1",
		);
		expect(notePreviewText(text)).toBe(note("Before", "After"));
	});

	it("keeps a callout's title but not its type", () => {
		expect(notePreviewText(note("> [!note] Remember", "> the milk"))).toBe(
			note("Remember", "the milk"),
		);
	});

	it("reads a table as rows of values", () => {
		expect(notePreviewText(note("| a | b |", "| --- | --- |", "| 1 | 2 |"))).toBe(
			note("a · b", "1 · 2"),
		);
	});

	it("survives an unclosed code block", () => {
		expect(notePreviewText(note("Intro", "```", "code forever"))).toBe("Intro");
	});

	it("is empty for a note with nothing but properties", () => {
		expect(notePreviewText(note("---", "a: 1", "---", ""))).toBe("");
	});

	it("caps a long note", () => {
		const out = notePreviewText("word ".repeat(1000));
		expect(out.length).toBeLessThanOrEqual(701);
		expect(out.endsWith("…")).toBe(true);
	});
});

describe("previewSize", () => {
	it("defaults, rounds and clamps", () => {
		expect(previewSize(undefined)).toBe(PREVIEW_SIZE.default);
		expect(previewSize("9")).toBe(PREVIEW_SIZE.default);
		expect(previewSize(9.4)).toBe(9);
		expect(previewSize(1)).toBe(PREVIEW_SIZE.min);
		expect(previewSize(99)).toBe(PREVIEW_SIZE.max);
		expect(previewSize(Number.NaN)).toBe(PREVIEW_SIZE.default);
	});
});
