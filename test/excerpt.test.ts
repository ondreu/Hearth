import { describe, expect, it } from "vitest";
import {
	buildExcerpt,
	cleanExcerptText,
	foldForMatch,
	highlightRanges,
	windowExcerpt,
} from "../src/excerpt";

/**
 * The excerpt pipeline is entirely pure — text in, display line + highlight
 * ranges out — so it's all covered here. These are the cases that made body
 * search unreadable in practice: HTML-imported notes full of entities, YAML
 * frontmatter lists, and long matches with no visible reason for the hit.
 */

/** Apply ranges to a string the way the DOM renderer does, so assertions can
 * talk about what the user sees rather than about index pairs. */
function marked(text: string, ranges?: readonly [number, number][]): string {
	if (!ranges) return text;
	let out = "";
	let cursor = 0;
	for (const [start, end] of ranges) {
		out += text.slice(cursor, start) + "[" + text.slice(start, end) + "]";
		cursor = end;
	}
	return out + text.slice(cursor);
}

describe("cleanExcerptText", () => {
	it("collapses all whitespace onto one line", () => {
		expect(cleanExcerptText("a\n\n  b\tc  ")).toBe("a b c");
	});

	it("treats <br> as the line break it stands for", () => {
		// Not just a space: the heading and bullet markers after it have to be
		// recognised as line-leading, or they survive into the excerpt.
		expect(cleanExcerptText("E-mail: x@y.cz<br>## Notes<br>- item")).toBe(
			"E-mail: x@y.cz Notes item",
		);
	});

	it("strips other inline HTML", () => {
		expect(cleanExcerptText("a <span class='x'>b</span> c")).toBe("a b c");
	});

	it("decodes the named entities that show up in imported notes", () => {
		expect(cleanExcerptText("say &quot;hi&quot; &amp; bye")).toBe('say "hi" & bye');
		expect(cleanExcerptText("it&#039;s fine")).toBe("it's fine");
		expect(cleanExcerptText("&#x2014; dash")).toBe("— dash");
	});

	it("leaves an unknown or malformed entity alone rather than mangling it", () => {
		expect(cleanExcerptText("100 &widget; &notreal;")).toBe("100 &widget; &notreal;");
	});

	it("does not decode an escaped tag into a real one", () => {
		// &lt;div&gt; must survive as visible text: entities are decoded after
		// tags are stripped precisely so this can't be eaten.
		expect(cleanExcerptText("use &lt;div&gt; here")).toBe("use <div> here");
	});

	it("unquotes inline YAML/JSON string lists", () => {
		expect(cleanExcerptText('participants: ["Novák Jan", "Šikl Tomáš"]')).toBe(
			"participants: Novák Jan, Šikl Tomáš",
		);
	});

	it("unquotes a list even when the window cut it in half", () => {
		expect(cleanExcerptText('s: ["kooperace", "Šikl Tomáš", "Zatlouk')).toBe(
			"s: kooperace, Šikl Tomáš, Zatlouk",
		);
	});

	it("drops frontmatter fences, headings, quotes and bullets", () => {
		expect(cleanExcerptText("---\n# Title\n> quoted\n- bullet")).toBe("Title quoted bullet");
	});

	it("keeps the readable half of links", () => {
		expect(cleanExcerptText("see [[notes/2026|last week]] and [docs](https://x.dev)")).toBe(
			"see last week and docs",
		);
		expect(cleanExcerptText("see [[Plain Note]]")).toBe("see Plain Note");
	});

	it("strips emphasis markers but keeps underscores in identifiers", () => {
		expect(cleanExcerptText("**bold** and `code` and ~~gone~~")).toBe("bold and code and gone");
		expect(cleanExcerptText("2026-08-05__external-poptavka")).toBe(
			"2026-08-05__external-poptavka",
		);
	});
});

describe("foldForMatch", () => {
	it("lower-cases and strips accents", () => {
		expect(foldForMatch("Banánové")).toBe("bananove");
		expect(foldForMatch("Příliš Žluťoučký KŮŇ")).toBe("prilis zlutoucky kun");
		expect(foldForMatch("Crème Brûlée")).toBe("creme brulee");
	});

	it("leaves already-folded ASCII untouched", () => {
		expect(foldForMatch("plain lower ascii 123")).toBe("plain lower ascii 123");
	});

	/**
	 * The invariant the whole highlight path rests on: a range found in the
	 * folded string is applied to the *original* string, so the two must line up
	 * character for character. Any fold that would change the length is reverted.
	 */
	it("always returns a string the same length as its input", () => {
		for (const s of [
			"Banánové Snickersky",
			"Straße", // ß upper-cases to SS
			"İstanbul", // dotted capital I lower-cases to two code points
			"Ω Ϋ ǅ",
			"emoji 🍌 and a pair",
			"é already decomposed",
			"",
		]) {
			expect(foldForMatch(s)).toHaveLength(s.length);
		}
	});

	it("keeps a character it cannot fold without changing length", () => {
		// "ß" has no single-character lower/upper fold, so it survives as-is
		// rather than becoming "ss" and shifting every index after it.
		expect(foldForMatch("Straße")).toBe("straße");
	});
});

describe("highlightRanges", () => {
	it("finds every occurrence, case-insensitively", () => {
		expect(marked("Jan and jan", highlightRanges("Jan and jan", ["jan"]))).toBe(
			"[Jan] and [jan]",
		);
	});

	it("returns undefined when nothing matched", () => {
		expect(highlightRanges("nothing here", ["zzz"])).toBeUndefined();
		expect(highlightRanges("nothing here", [])).toBeUndefined();
	});

	it("ignores empty needles", () => {
		expect(highlightRanges("abc", ["", "b"])).toEqual([[1, 2]]);
	});

	it("merges overlapping ranges so highlight spans never cross", () => {
		// "ana" at 1..4 and "nan" at 2..5 overlap inside "banana" and fuse into
		// one span; the trailing "a" is not part of either match.
		expect(marked("banana", highlightRanges("banana", ["ana", "nan"]))).toBe("b[anan]a");
	});

	it("keeps separate matches separate", () => {
		expect(marked("a b a", highlightRanges("a b a", ["a"]))).toBe("[a] b [a]");
	});

	it("ignores accents in both directions", () => {
		// Omnisearch reports its matched words stemmed and unaccented, so an
		// unaccented needle has to light up the accented spelling in the note...
		expect(marked("Banánové Snickersky", highlightRanges("Banánové Snickersky", ["banan"]))).toBe(
			"[Banán]ové Snickersky",
		);
		// ...and a needle typed *with* accents has to find text without them.
		expect(marked("bananove", highlightRanges("bananove", ["Banán"]))).toBe("[banan]ove");
	});

	it("highlights the accented spelling at the right offset", () => {
		// The range must land on the original characters, not on folded ones:
		// "banánů" is 6 characters either way, so the slice stays aligned.
		const text = "400 g banánů 40 g arašídového másla";
		expect(marked(text, highlightRanges(text, ["bananu"]))).toBe(
			"400 g [banánů] 40 g arašídového másla",
		);
	});
});

describe("windowExcerpt", () => {
	const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");

	it("keeps a short line whole and unmarked at both ends", () => {
		const { label } = windowExcerpt("a short line about cats", "cats");
		expect(label).toBe("a short line about cats");
	});

	it("centres a long line on the match and highlights it", () => {
		const { label, matches } = windowExcerpt(long, "word40");
		expect(label).toContain("word40");
		expect(label.startsWith("…")).toBe(true);
		expect(label.endsWith("…")).toBe(true);
		expect(marked(label, matches)).toContain("[word40]");
		// The far end of the text is well outside the kept window.
		expect(label).not.toContain("word0 ");
	});

	it("honours the caller's note that text was already cut off", () => {
		expect(windowExcerpt("middle bit", "middle", true, true).label).toBe("…middle bit…");
	});

	it("falls back to the head of the line when the needle isn't there", () => {
		// Markup stripping can swallow a match that straddled a tag; the excerpt
		// should still be readable, just not centred or highlighted.
		const { label, matches } = windowExcerpt(long, "not-present");
		expect(label.startsWith("word0")).toBe(true);
		expect(matches).toBeUndefined();
	});

	it("does not highlight anything for an empty needle", () => {
		expect(windowExcerpt("some text", "").matches).toBeUndefined();
	});
});

describe("buildExcerpt", () => {
	it("cleans, centres and highlights a real frontmatter hit", () => {
		const note =
			"---\nparticipants: [&quot;Moravec Stanislav&quot;, &quot;Hanik Jan&quot;]\n---\n\n# Zápis\n";
		const idx = note.toLowerCase().indexOf("hanik jan");
		const { label, matches } = buildExcerpt(note, idx, "hanik jan".length);
		expect(label).toContain("participants: Moravec Stanislav, Hanik Jan");
		expect(label).not.toContain("&quot;");
		expect(marked(label, matches)).toContain("[Hanik Jan]");
	});

	it("cleans a body hit full of <br> markup", () => {
		const note = "- E-mail: jan.hanik@x.cz<br>## Dohody a poznámky<br>- 2026-08-01 call";
		const idx = note.indexOf("Dohody");
		const { label } = buildExcerpt(note, idx, "Dohody".length);
		expect(label).not.toContain("<br>");
		expect(label).toContain("Dohody a poznámky");
	});

	it("marks an ellipsis on the side it actually trimmed", () => {
		const long = `${"filler ".repeat(200)}needle${" filler".repeat(200)}`;
		const idx = long.indexOf("needle");
		const { label } = buildExcerpt(long, idx, "needle".length);
		expect(label.startsWith("…")).toBe(true);
		expect(label.endsWith("…")).toBe(true);
	});

	it("adds no ellipsis when the whole note fits", () => {
		const { label } = buildExcerpt("just this line", 5, 4);
		expect(label).toBe("just this line");
	});
});
