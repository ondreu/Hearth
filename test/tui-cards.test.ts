import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS } from "../src/cards";
import { bigLines, bigWidth, BIG_ROWS, hasBigGlyphs } from "../src/tui/bigtext";
import { literalText } from "../src/tui/cards/dataview";
import { TUI_RENDERERS } from "../src/tui/cards";
import { halfBlocks } from "../src/tui/cards/pet";
import { ART_W, conditionArt } from "../src/tui/cards/weather";
import { GRAPHICAL_KINDS } from "../src/tui/registry";
import { lineWidth, strWidth, type Line } from "../src/tui/text";
import { spriteFrames, PET_SPECIES } from "../src/cards/pet";
import type { CardKind } from "../src/types";

describe("terminal renderers", () => {
	const kinds = Object.keys(CARD_DEFINITIONS) as CardKind[];

	it("draws every kind as text, or says it stays graphical", () => {
		for (const kind of kinds) {
			const text = kind in TUI_RENDERERS;
			const graphical = GRAPHICAL_KINDS.includes(kind);
			expect(text || graphical, kind).toBe(true);
			expect(text && graphical, kind).toBe(false);
		}
	});
});

describe("big text", () => {
	it("draws every digit five rows tall, each row as wide as the glyph", () => {
		for (const s of ["0123456789", "12:45", "-3°C", "1,234.50", "42%"]) {
			expect(hasBigGlyphs(s), s).toBe(true);
			const lines = bigLines(s);
			expect(lines).toHaveLength(BIG_ROWS);
			for (const l of lines) expect(lineWidth(l)).toBe(bigWidth(s));
		}
	});

	it("knows which characters it has no glyph for", () => {
		expect(hasBigGlyphs("12a")).toBe(false);
	});
});

describe("weather art", () => {
	it("draws every condition in five rows of the same width", () => {
		for (const code of [0, 1, 2, 3, 45, 51, 61, 71, 95]) {
			for (const isDay of [true, false]) {
				const art = conditionArt(code, isDay);
				expect(art).toHaveLength(5);
				for (const l of art) expect(lineWidth(l)).toBe(ART_W);
			}
		}
	});
});

describe("pet half blocks", () => {
	const color = (ch: string) => (ch === "." ? null : ch === "o" ? "#000" : "#fff");
	const text = (l: Line) => l.map((s) => s.text).join("");

	it("puts two pixel rows in a line of text, one cell per pixel", () => {
		for (const species of PET_SPECIES) {
			const frame = spriteFrames(species, "content")[0];
			const lines = halfBlocks(frame, color);
			expect(lines).toHaveLength(frame.length / 2);
			for (const l of lines) expect(strWidth(text(l))).toBe(frame[0].length);
		}
	});

	it("uses the character for the upper pixel and the background for the lower", () => {
		const [line] = halfBlocks(["o.o.", "..oo"], color);
		expect(line[0]).toMatchObject({ text: "▀", color: "#000" });
		expect(line[1]).toMatchObject({ text: " " });
		expect(line[2]).toMatchObject({ text: " ", bg: "#000" });
		expect(line[3]).toMatchObject({ text: "▄", color: "#000" });
	});
});

describe("dataview values as text", () => {
	it("writes the values a query returns", () => {
		expect(literalText(null)).toBe("-");
		expect(literalText("a")).toBe("a");
		expect(literalText(3)).toBe("3");
		expect(literalText([1, "b"])).toBe("1, b");
		expect(literalText({ path: "Projects/Hearth.md", type: "file", embed: false })).toBe("Hearth");
		expect(literalText({ path: "a.md", type: "file", embed: false, display: "Alias" })).toBe("Alias");
	});
});
