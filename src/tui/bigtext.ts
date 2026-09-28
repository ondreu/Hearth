/**
 * Large characters for terminal mode: a clock's digits, a stat's number.
 *
 * Three cells wide and five tall, the way a terminal clock draws them. The
 * solid cells are drawn as the "block" style — background on spaces rather
 * than a block glyph, so the rows touch with no gap between them (a block
 * glyph stops short of the line height). Pure (test/tui-text.test.ts).
 */
import type { Line } from "./text";

/** Every glyph's five rows; `#` is a solid cell. */
const FONT: Record<string, string[]> = {
	"0": ["###", "# #", "# #", "# #", "###"],
	"1": [" # ", "## ", " # ", " # ", "###"],
	"2": ["###", "  #", "###", "#  ", "###"],
	"3": ["###", "  #", "###", "  #", "###"],
	"4": ["# #", "# #", "###", "  #", "  #"],
	"5": ["###", "#  ", "###", "  #", "###"],
	"6": ["###", "#  ", "###", "# #", "###"],
	"7": ["###", "  #", "  #", "  #", "  #"],
	"8": ["###", "# #", "###", "# #", "###"],
	"9": ["###", "# #", "###", "  #", "###"],
	":": [" ", "#", " ", "#", " "],
	".": [" ", " ", " ", " ", "#"],
	",": [" ", " ", " ", "#", "#"],
	"-": ["   ", "   ", "###", "   ", "   "],
	" ": [" ", " ", " ", " ", " "],
	"%": ["# #", "  #", " # ", "#  ", "# #"],
	"°": ["##", "##", "  ", "  ", "  "],
	C: ["###", "#  ", "#  ", "#  ", "###"],
	F: ["###", "#  ", "###", "#  ", "#  "],
};

/** The height of a big line, in rows. */
export const BIG_ROWS = 5;

/** Whether every character of `text` has a big glyph. */
export function hasBigGlyphs(text: string): boolean {
	return Array.from(text).every((ch) => ch in FONT);
}

/** How many cells wide `text` is drawn big, with one cell between glyphs. */
export function bigWidth(text: string): number {
	const chars = Array.from(text);
	return chars.reduce((n, ch) => n + (FONT[ch]?.[0].length ?? 1), 0) + Math.max(0, chars.length - 1);
}

/** `text` as five lines of big glyphs. Unknown characters are left blank. */
export function bigLines(text: string): Line[] {
	const chars = Array.from(text);
	const rows: Line[] = [];
	for (let r = 0; r < BIG_ROWS; r++) {
		const line: Line = [];
		chars.forEach((ch, i) => {
			const glyph = FONT[ch]?.[r] ?? " ";
			let run = "";
			let solid: boolean | null = null;
			const flush = () => {
				if (!run) return;
				line.push(solid ? { text: " ".repeat(run.length), style: "block" } : { text: run });
				run = "";
			};
			for (const cell of glyph) {
				const on = cell === "#";
				if (solid !== null && on !== solid) flush();
				solid = on;
				run += on ? "#" : " ";
			}
			flush();
			if (i < chars.length - 1) line.push({ text: " " });
		});
		rows.push(line);
	}
	return rows;
}
