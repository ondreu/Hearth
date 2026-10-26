/**
 * Part of a note rather than the whole of it (#396).
 *
 * An embed card can point at a note, and — since #396 — at one *section* of it:
 * a heading and everything under it (sub-headings included), or a single
 * `^block`. The ranges come from the metadata cache, which already knows where
 * every heading and block starts and ends; this module turns that into line
 * numbers and the text they span.
 *
 * It works in **line numbers** throughout, not offsets, because the one thing
 * built on top of it — checkbox ticks written back to the note — is line-based
 * (`checkboxes.ts` maps the Nth rendered input to the Nth checkbox line). A
 * card that draws a section therefore hands the slice's `from`/`to` to that
 * mapping, and a tick lands on the line the user actually clicked instead of on
 * the Nth checkbox of the whole note.
 *
 * Obsidian's own `resolveSubpath` would answer the same question, but it lives
 * behind the `obsidian` module, which the test shim only stubs out: the range
 * logic is the part worth pinning down in tests, so it is implemented here from
 * the cache's `headings` / `blocks` instead.
 */

/** The fields of a cached heading this module reads (`HeadingCache`). */
export interface SectionHeading {
	heading: string;
	level: number;
	position: { start: { line: number }; end: { line: number } };
}

/** The fields of a cached block this module reads (`BlockCache`). */
export interface SectionBlock {
	position: { start: { line: number }; end: { line: number } };
}

/** The slice of `CachedMetadata` a section lookup needs. `CachedMetadata`
 * satisfies it structurally, so callers pass the real cache. */
export interface SectionCache {
	headings?: readonly SectionHeading[];
	blocks?: Readonly<Record<string, SectionBlock>>;
}

/** A resolved section: where it is in the note, and its text. */
export interface NoteSection {
	/** The normalized subpath this came from, e.g. `#Heading` or `#^block`. */
	subpath: string;
	/** Line of the section's own heading (or block start) — where to put the
	 * cursor when the card opens the note, even when the heading is hidden. */
	anchor: number;
	/** First line of `text`, 0-based and inclusive. */
	from: number;
	/** Last line of `text`, 0-based and inclusive. `from - 1` when empty. */
	to: number;
	/** The section's Markdown, without the heading line when that was asked
	 * for, and without the blank lines the note's spacing left at either end. */
	text: string;
	/** True when this is a heading's section rather than a block. */
	heading: boolean;
}


/**
 * The `#subpath` a user typed, normalized — or null when they typed nothing
 * usable.
 *
 * People paste these in every shape Obsidian hands them out in, so accept them
 * all: `Heading`, `#Heading`, `## Heading` (the level is not part of the name —
 * the heading's own level decides where its section ends), `#^block`, and a
 * whole `![[Note#Heading|alias]]` link, whose note path and alias are dropped
 * because the card picks the note in its own field.
 */
export function sectionSubpath(raw: string | null | undefined): string | null {
	let s = (raw ?? "").trim();
	if (!s) return null;
	s = s.replace(/^!?\[\[/, "").replace(/\]\]$/, "");
	const pipe = s.indexOf("|");
	if (pipe >= 0) s = s.slice(0, pipe);
	if (!s.startsWith("#")) {
		// `Note#Heading` / `folder/Note.md#Heading`: keep the subpath, drop the path.
		const hash = s.indexOf("#");
		s = hash >= 0 ? s.slice(hash) : `#${s}`;
	}
	const body = s.replace(/^#+/, "").trim();
	return body ? `#${body}` : null;
}


/** One line index, clamped into a note of `count` lines. */
function line(line: number, count: number): number {
	if (!Number.isFinite(line) || line < 0) return 0;
	return Math.min(line, Math.max(count - 1, 0));
}


/**
 * Resolve `raw` to the part of `text` it names, or null when the note has no
 * such heading or block (a renamed heading, a deleted block, a note the cache
 * hasn't indexed yet).
 *
 * A heading's section runs from its own line to the line before the next
 * heading of the same or a higher level, so sub-headings come along — which is
 * what "everything under this heading" means to the person asking.
 */
export function noteSection(
	text: string,
	cache: SectionCache | null | undefined,
	raw: string | null | undefined,
	opts: { hideHeading?: boolean } = {},
): NoteSection | null {
	const subpath = sectionSubpath(raw);
	if (!subpath) return null;
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const body = subpath.slice(1);

	let anchor: number;
	let end: number;
	let heading = false;
	if (body.startsWith("^")) {
		const block = cache?.blocks?.[body.slice(1)];
		if (!block) return null;
		anchor = line(block.position.start.line, lines.length);
		end = line(block.position.end.line, lines.length);
	} else {
		const headings = cache?.headings ?? [];
		const wanted = body.toLowerCase();
		const index = headings.findIndex((h) => h.heading.trim().toLowerCase() === wanted);
		if (index < 0) return null;
		const target = headings[index];
		heading = true;
		anchor = line(target.position.start.line, lines.length);
		const next = headings.slice(index + 1).find((h) => h.level <= target.level);
		end = next ? line(next.position.start.line, lines.length) - 1 : lines.length - 1;
	}

	let from = heading && opts.hideHeading ? anchor + 1 : anchor;
	let to = end;
	// Blank lines at either end are the spacing the note had around the heading
	// or block; a card shows the content, not the gap above it.
	while (from <= to && !lines[from]?.trim()) from++;
	while (to >= from && !lines[to]?.trim()) to--;
	if (from > to) return { subpath, anchor, from, to: from - 1, text: "", heading };
	return { subpath, anchor, from, to, text: lines.slice(from, to + 1).join("\n"), heading };
}
