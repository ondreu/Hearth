import { cleanExcerptText } from "./excerpt";

/**
 * The few lines of a note a folder browser's tile shows under its name (#375).
 *
 * Plain text, not rendered Markdown: a tile is there to recognise a note by,
 * and a page of tiles each running `MarkdownRenderer` — with its embeds,
 * images and plugin code blocks — would cost far more than the glance it buys.
 * So the note is read as text and its markup taken out, the way a search
 * result's excerpt is (`excerpt.ts`), keeping the line breaks a tile has room
 * to show.
 *
 * What is dropped outright, because it is not prose: the frontmatter (the
 * properties are not the note), fenced code blocks (a Dataview query is not
 * what the note says), comments, embeds and images, table divider rows,
 * horizontal rules and block ids. What is kept as its text: headings, list
 * items, quotes and callouts, link labels.
 */

/** The preview text's size, in pixels. The default is small on purpose; the
 * card's settings make it larger for anyone who wants to read it. */
export const PREVIEW_SIZE = { min: 6, max: 14, default: 8 } as const;

/** The preview text size a card config asks for, inside the allowed range. */
export function previewSize(raw: unknown): number {
	if (typeof raw !== "number" || !Number.isFinite(raw)) return PREVIEW_SIZE.default;
	return Math.min(PREVIEW_SIZE.max, Math.max(PREVIEW_SIZE.min, Math.round(raw)));
}

/** How much of the note is looked at. A tile shows a few hundred characters;
 * there is no reason to clean a whole book to find them. */
const RAW_LIMIT = 6000;

/** How long the finished preview may be. More than a tile can show at the
 * smallest size, so the tile's own clipping decides where it ends. */
const PREVIEW_LIMIT = 700;

const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/**
 * The preview of a note, from its raw text: markup out, frontmatter out, one
 * line per line of prose, at most {@link PREVIEW_LIMIT} characters. Empty when
 * the note has nothing but properties, code or embeds.
 */
export function notePreviewText(raw: string): string {
	let s = raw.replace(FRONTMATTER, "");
	s = s.length > RAW_LIMIT ? s.slice(0, RAW_LIMIT) : s;
	s = s
		.replace(/\r\n?/g, "\n")
		// Fenced code, closed or running to the end of what was read.
		.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm, "")
		// Obsidian and HTML comments.
		.replace(/%%[\s\S]*?(?:%%|(?![\s\S]))/g, "")
		.replace(/<!--[\s\S]*?(?:-->|(?![\s\S]))/g, "")
		// Embeds and images: a picture's file name is not the note's text.
		.replace(/!\[\[[^\]]*\]\]/g, "")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		// Wiki links as the text they show, before a table's pipes are read:
		// the pipe in `[[target|label]]` is not a cell border.
		.replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) =>
			label || target,
		);

	const lines: string[] = [];
	let length = 0;
	for (const line of s.split("\n")) {
		const text = previewLine(line);
		if (!text) continue;
		lines.push(text);
		length += text.length + 1;
		if (length >= PREVIEW_LIMIT) break;
	}
	const out = lines.join("\n");
	return out.length > PREVIEW_LIMIT ? `${out.slice(0, PREVIEW_LIMIT).trimEnd()}…` : out;
}

/** One line of a note as preview text, or "" when it carries no prose. */
function previewLine(line: string): string {
	// Horizontal rules and a table's divider row.
	if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) return "";
	if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)) return "";
	// A table row, read as a run of values. Only a line that starts with a
	// pipe is taken for one; a pipe in a sentence stays.
	const row = /^\s*\|/.test(line)
		? line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").replace(/\s*\|\s*/g, " · ")
		: line;
	const s = row
		// A callout's type marker; its title, if it has one, stays.
		.replace(/^(\s*>+\s*)\[![^\]]*\][+-]?\s*/, "$1")
		// Task checkboxes, after the list marker `cleanExcerptText` drops.
		.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[.\]\s+/, "$1")
		// Ordered list numbers, which `cleanExcerptText` leaves.
		.replace(/^\s*\d+[.)]\s+/, "")
		// Block ids and footnote references.
		.replace(/\s\^[\w-]+\s*$/, "")
		.replace(/\[\^[^\]]+\]/g, "")
		// Highlights.
		.replace(/==/g, "");
	return cleanExcerptText(s);
}
