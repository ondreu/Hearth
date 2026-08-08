/**
 * Turning raw note text into the one readable line a search result shows under
 * its title.
 *
 * Body hits are cut straight out of the file, so the raw slice is whatever
 * happened to surround the match: YAML frontmatter, HTML entities from an
 * imported note (`&quot;`, `&#039;`), `<br>` tags, markdown emphasis markers.
 * Dropped into a result row verbatim that reads as noise. Everything here
 * exists to make that slice legible: decode it, strip the markup, keep a window
 * of context around the match, and report where the match landed so the row can
 * highlight it.
 */

/** Context kept on each side of the match in the finished line. */
const CONTEXT_BEFORE = 36;
const CONTEXT_AFTER = 110;
/** How much raw text to pull in before cleaning. Generous, because stripping
 * markup shrinks the slice and we'd rather trim than come up short. */
const RAW_BEFORE = 220;
const RAW_AFTER = 460;
/** Don't hunt further than this for a word boundary to cut on. */
const SNAP_WINDOW = 14;

/** The handful of named HTML entities that actually show up in notes imported
 * from HTML or exported by other tools. Anything else is left alone. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	lsquo: "‘",
	rsquo: "’",
	ldquo: "“",
	rdquo: "”",
};

function decodeEntities(s: string): string {
	return s.replace(/&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g, (whole, body: string) => {
		if (body.startsWith("#")) {
			const code = body[1] === "x" || body[1] === "X"
				? parseInt(body.slice(2), 16)
				: parseInt(body.slice(1), 10);
			// Skip anything that isn't a plain printable character — a lone
			// surrogate or a control code would be worse than the entity text.
			if (!Number.isFinite(code) || code < 32 || code > 0x10ffff) return whole;
			try {
				return String.fromCodePoint(code);
			} catch {
				return whole;
			}
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
	});
}

/**
 * Flatten a chunk of note text to plain readable prose on one line: HTML out,
 * entities decoded, markdown markers dropped, whitespace collapsed.
 *
 * Tags are stripped *before* entities are decoded, so an escaped `&lt;div&gt;`
 * in the note survives as visible text instead of being decoded into a tag and
 * then eaten.
 */
export function cleanExcerptText(raw: string): string {
	let s = raw
		// A newline, not a space: notes exported from HTML put `<br>` where the
		// line break was, so the heading and bullet rules below (which anchor to
		// a line start) need to see one. The final collapse flattens it again.
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/?[a-zA-Z][^>]{0,300}>/g, " ");
	s = decodeEntities(s);
	return (
		s
			// Inline YAML/JSON string lists (`participants: ["A", "B"]`) are a very
			// common frontmatter hit. Drop the quoting so they read as a plain list.
			.replace(/\[\s*"/g, "")
			.replace(/"\s*\]/g, "")
			.replace(/"\s*,\s*"/g, ", ")
			// Frontmatter fences and heading/quote/bullet markers carry no meaning
			// once the text is a single line.
			.replace(/^\s*-{3,}\s*$/gm, " ")
			.replace(/^\s{0,3}#{1,6}\s+/gm, "")
			.replace(/^\s{0,3}>+\s?/gm, "")
			.replace(/^\s{0,8}[-*+]\s+/gm, "")
			// Links: keep the text a human would read, drop the target.
			.replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, target: string, alias: string) =>
				alias || target,
			)
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
			// Emphasis and code markers. `_` is deliberately left alone: it shows up
			// far more often inside identifiers and filenames than as italics.
			.replace(/[*`~]/g, "")
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Fold one character for matching: lower-cased and stripped of its accent, so
 * "Á" and "á" both compare equal to "a".
 *
 * Every step is reverted unless it leaves the character the same length in
 * UTF-16 units. That's the whole trick: the folded string stays index-aligned
 * with the original, so a range found in the folded text can be applied to the
 * original text unchanged. The handful of characters that don't fold cleanly
 * (ß → ss, a combining mark on its own) are simply left as they are.
 */
function foldChar(ch: string): string {
	const lower = ch.toLowerCase();
	const base = lower.length === ch.length ? lower : ch;
	const stripped = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	return stripped.length === base.length ? stripped : base;
}

// Everything above ASCII, written as a positive range so the linter does not
// see control characters in a character class.
const HAS_NON_ASCII = /[\u0080-\uffff]/;
const NON_ASCII_G = /[\u0080-\uffff]/g;
const HAS_UPPER = /[A-Z]/;

/** Fold every character. Only used when the bulk path can't preserve length. */
function perCharFold(s: string): string {
	let out = "";
	for (const ch of s) out += foldChar(ch);
	return out;
}

/**
 * A lower-cased, accent-stripped copy of `s` that is index-aligned with it, for
 * matching a query against text that may not carry the same diacritics — "banan"
 * has to find "Banánové", and Omnisearch reports its matched words folded even
 * when the note spells them with accents.
 *
 * This runs over whole note bodies, so it leans on the native bulk operations
 * and only touches individual characters where it has to: an already-folded
 * string is returned as-is, and accents are fixed with one regex pass that skips
 * every ASCII character.
 */
export function foldForMatch(s: string): string {
	const nonAscii = HAS_NON_ASCII.test(s);
	if (!nonAscii && !HAS_UPPER.test(s)) return s;
	const lower = s.toLowerCase();
	// Lower-casing can change a string's length (ß, İ), which would break the
	// index alignment the ranges depend on. Fall back to the per-character fold,
	// which reverts any step that doesn't preserve it.
	const base = lower.length === s.length ? lower : perCharFold(s);
	return nonAscii ? base.replace(NON_ASCII_G, foldChar) : base;
}

/** Char ranges in `haystack` covering any of `needles`, ignoring case and
 * accents, sorted and with overlaps merged so highlight spans never cross.
 * Returns undefined when nothing matched. */
export function highlightRanges(
	haystack: string,
	needles: readonly string[],
): [number, number][] | undefined {
	const lower = foldForMatch(haystack);
	const ranges: [number, number][] = [];
	for (const needle of needles) {
		const n = foldForMatch(needle);
		if (!n) continue;
		let from = 0;
		for (;;) {
			const idx = lower.indexOf(n, from);
			if (idx < 0) break;
			ranges.push([idx, idx + n.length]);
			from = idx + n.length;
		}
	}
	if (ranges.length === 0) return undefined;
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [[ranges[0][0], ranges[0][1]]];
	for (const [start, end] of ranges) {
		const last = merged[merged.length - 1];
		if (start <= last[1]) last[1] = Math.max(last[1], end);
		else merged.push([start, end]);
	}
	return merged;
}

/** Move `i` forward to just past the next space, so a cut lands between words
 * rather than mid-word. Never moves past `limit`, and gives up if the nearest
 * boundary is too far to be worth the characters. */
function snapForward(s: string, i: number, limit: number): number {
	if (i <= 0) return 0;
	const space = s.indexOf(" ", i);
	if (space < 0 || space - i > SNAP_WINDOW) return i;
	return Math.min(space + 1, limit);
}

/** Move `i` back to the preceding space, on the same terms as snapForward. */
function snapBack(s: string, i: number, limit: number): number {
	if (i >= s.length) return s.length;
	const space = s.lastIndexOf(" ", i);
	if (space < 0 || i - space > SNAP_WINDOW) return i;
	return Math.max(space, limit);
}

/** A cleaned excerpt: the line to display, plus where in it the query matched. */
export interface Excerpt {
	label: string;
	matches?: [number, number][];
}

/**
 * Trim an already-cleaned line down to a window around the first occurrence of
 * `needle`, adding an ellipsis on whichever side was cut. `cutBefore`/`cutAfter`
 * say whether the caller had already sliced text off that end.
 *
 * The match is located in the *cleaned* text rather than mapped over from the
 * raw offsets — cleaning shifts every position, and re-finding the needle is
 * both simpler and exactly what the highlight needs anyway.
 */
export function windowExcerpt(
	cleaned: string,
	needle: string,
	cutBefore = false,
	cutAfter = false,
): Excerpt {
	const at = needle ? foldForMatch(cleaned).indexOf(foldForMatch(needle)) : -1;
	// Markup stripping can swallow the match (it straddled a tag, say). Fall
	// back to the head of the line: still readable, just not centred.
	const anchor = at < 0 ? 0 : at;
	const anchorEnd = at < 0 ? 0 : at + needle.length;

	let start = snapForward(cleaned, Math.max(0, anchor - CONTEXT_BEFORE), anchor);
	let end = snapBack(cleaned, Math.min(cleaned.length, anchorEnd + CONTEXT_AFTER), anchorEnd);
	if (end < start) end = start;

	let label = cleaned.slice(start, end).trim();
	if (start > 0 || cutBefore) label = `…${label}`;
	if (end < cleaned.length || cutAfter) label = `${label}…`;
	return { label, matches: needle ? highlightRanges(label, [needle]) : undefined };
}

/**
 * Build the display line for a body-content hit at [idx, idx+len) in `text`.
 * Pulls a generous raw window, cleans it, then narrows to the match.
 */
export function buildExcerpt(text: string, idx: number, len: number): Excerpt {
	const needle = text.slice(idx, idx + len);
	const rawStart = Math.max(0, idx - RAW_BEFORE);
	const rawEnd = Math.min(text.length, idx + len + RAW_AFTER);
	const cleaned = cleanExcerptText(text.slice(rawStart, rawEnd));
	return windowExcerpt(cleaned, needle, rawStart > 0, rawEnd < text.length);
}
