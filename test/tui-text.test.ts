import { describe, expect, it } from "vitest";
import {
	areaChart,
	asciify,
	blockRow,
	cellWidth,
	chartRow,
	fit,
	hbar,
	lineWidth,
	meter,
	padEnd,
	padStart,
	sparkline,
	spread,
	strWidth,
	styleRange,
	styles,
	truncate,
	wrap,
	wrapLine,
	type Line,
} from "../src/tui/text";

/** The plain text of a line. */
const text = (line: Line) => line.map((s) => s.text).join("");

describe("cell widths", () => {
	it("counts ASCII, box drawing and blocks as one cell", () => {
		expect(strWidth("abc")).toBe(3);
		expect(strWidth("┌─┐")).toBe(3);
		expect(strWidth("▁▄█")).toBe(3);
	});

	it("counts CJK and fullwidth forms as two cells", () => {
		expect(cellWidth("日")).toBe(2);
		expect(strWidth("日本語")).toBe(6);
		expect(strWidth("ａ")).toBe(2);
	});

	it("counts combining marks as nothing", () => {
		expect(strWidth("é")).toBe(1);
	});
});

describe("asciify", () => {
	it("leaves text without emoji alone", () => {
		expect(asciify("Plain text — with a dash")).toBe("Plain text — with a dash");
	});

	it("replaces the emoji it knows with their ASCII", () => {
		expect(asciify("done ✅")).toBe("done [x]");
		expect(asciify("🙂")).toBe(":)");
	});

	it("does not turn a cross into an open checkbox", () => {
		expect(asciify("❌")).not.toBe("[ ]");
	});

	it("turns a flag into its region code", () => {
		expect(asciify("🇨🇿")).toBe("CZ");
	});

	it("drops an emoji it has no ASCII for, with its modifiers", () => {
		const out = asciify("a🦩b");
		expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
		expect(out.replace(/\s/g, "")).toBe("ab");
	});

	it("never leaves a wide pictograph behind", () => {
		for (const s of ["👍🏽 ok", "👨‍👩‍👧 family", "☀️ sun", "🏠 home"]) {
			expect(asciify(s)).not.toMatch(/\p{Extended_Pictographic}/u);
		}
	});
});

describe("truncate and pad", () => {
	it("cuts to the width with an ellipsis", () => {
		expect(truncate("abcdef", 4)).toBe("abc…");
		expect(strWidth(truncate("abcdef", 4))).toBe(4);
		expect(truncate("abc", 4)).toBe("abc");
	});

	it("never splits a wide character across the edge", () => {
		const cut = truncate("日本語", 4);
		expect(strWidth(cut)).toBeLessThanOrEqual(4);
	});

	it("pads to exactly the width", () => {
		expect(padEnd("ab", 4)).toBe("ab  ");
		expect(padStart("ab", 4)).toBe("  ab");
		expect(strWidth(padEnd("abcdef", 4))).toBe(4);
	});
});

describe("fit and spread", () => {
	it("fits a line to exactly the width", () => {
		expect(lineWidth(fit([{ text: "abc" }], 6))).toBe(6);
		expect(lineWidth(fit([{ text: "abcdef" }, { text: "ghi" }], 5))).toBe(5);
		expect(text(fit([{ text: "abcdef" }], 4))).toBe("abc…");
	});

	it("keeps a cut segment's handler", () => {
		const onClick = () => undefined;
		const out = fit([{ text: "abcdef", onClick }], 3);
		expect(out[0].onClick).toBe(onClick);
	});

	it("puts the right part flush right", () => {
		const out = spread([{ text: "left" }], [{ text: "right" }], 12);
		expect(text(out)).toBe("left   right");
		expect(lineWidth(out)).toBe(12);
	});

	it("lets the left part give way", () => {
		expect(lineWidth(spread([{ text: "a long left part" }], [{ text: "right" }], 10))).toBe(10);
	});
});

describe("styleRange", () => {
	it("styles only the cells asked for, splitting segments", () => {
		const out = styleRange([{ text: "abcdef" }], 2, 4, "reverse");
		expect(text(out)).toBe("abcdef");
		const styled = out.filter((s) => styles(s).includes("reverse"));
		expect(styled.map((s) => s.text).join("")).toBe("cd");
	});
});

describe("wrap", () => {
	it("wraps at spaces and keeps newlines", () => {
		expect(wrap("one two three", 7)).toEqual(["one two", "three"]);
		expect(wrap("a\nb", 10)).toEqual(["a", "b"]);
	});

	it("breaks a word longer than the line", () => {
		for (const l of wrap("abcdefghij", 4)) expect(strWidth(l)).toBeLessThanOrEqual(4);
	});

	it("indents continuation lines of a styled line", () => {
		const lines = wrapLine([{ text: "- " }, { text: "one two three four", style: "bold" }], 10, 2);
		expect(lines.length).toBeGreaterThan(1);
		for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(10);
		expect(text(lines[1]).startsWith("  ")).toBe(true);
	});
});

describe("charts", () => {
	it("draws a sparkline one block per value", () => {
		expect(sparkline([0, 1, 2, 3], 4)).toBe("▁▃▆█");
		expect(sparkline([], 4)).toBe("");
	});

	it("fills a bar in eighths", () => {
		expect(hbar(0.5, 4)).toBe("██  ");
		expect(hbar(1, 3)).toBe("███");
		expect(hbar(0, 3)).toBe("   ");
	});

	it("draws a meter exactly as wide as asked", () => {
		expect(lineWidth(meter([{ fraction: 0.5, style: "green" }], "3/6", 16))).toBe(16);
	});

	it("draws an area chart w by h, lowest value still visible", () => {
		const rows = areaChart([1, 2, 3, 4], 8, 3);
		expect(rows).toHaveLength(3);
		for (const r of rows) expect(strWidth(r)).toBe(8);
		// The bottom row has something in every column.
		expect(rows[2]).not.toContain(" ");
		// The top row is only reached by the highest values.
		expect(rows[0][0]).toBe(" ");
		expect(rows[0][7]).toBe("█");
	});

	it("puts a value on the row of the chart it belongs to", () => {
		expect(chartRow(10, 0, 10, 4)).toBe(0);
		expect(chartRow(0, 0, 10, 4)).toBe(3);
		expect(chartRow(5, 0, 10, 4)).toBeGreaterThan(0);
	});

	it("turns full blocks into solid cells and keeps the rest", () => {
		const line = blockRow("▄██▂", "green");
		expect(text(line)).toBe("▄  ▂");
		const solid = line.find((s) => styles(s).includes("solid"));
		expect(solid?.text).toBe("  ");
		expect(styles(solid ?? { text: "" })).toContain("green");
	});
});
