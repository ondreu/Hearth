/**
 * Pure text handling for `CHANGELOG.md`: splitting it into per-release entries
 * and preparing each body for Markdown rendering. No Obsidian API, no DOM —
 * see `whatsnew.ts` for the dialog that displays the result.
 */

/** One release section parsed out of `CHANGELOG.md`. */
export interface ChangelogEntry {
	/** The release number, e.g. `2.0.0`. */
	version: string;
	/** The release date as written in the heading, if it carries one. */
	date: string;
	/** The compare/release URL from the file's link-reference block, if any. */
	url: string;
	/** The section body — everything under the heading, reflowed for display. */
	markdown: string;
}

/**
 * A release heading: `## [1.8.0] - 2026-07-11`, `## [1.8.0]` or a bare
 * `## 1.8.0`. The brackets are optional and a stray quote inside them (e.g. a
 * malformed `## ["1.9.0]`) is tolerated; the trailing date may be separated by
 * a hyphen, en dash or em dash.
 */
const HEADING_RE = /^##\s+(?:\[["']?([^\]"']+?)["']?\]|([^\s[\]]+))\s*(?:[-–—]\s*(.+))?$/;
/** A Markdown link-reference definition, e.g. `[1.8.0]: https://…`. These sit
 * in a block at the foot of the file and turn the version headings into links. */
const LINK_DEF_RE = /^\[([^\]]+)\]:\s+(\S+)/;

/** Lines that open a block of their own and so must never be joined onto the
 * line above: headings, list items, quotes, tables, rules and fences. */
const BLOCK_START_RE = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||={3,}\s*$|(?:[-*_]\s*){3,}$)/;
/** Blocks that are exactly one line long, so the line after them starts afresh
 * rather than being absorbed: headings, table rows and horizontal rules. (A
 * list item or quote, by contrast, does absorb the lines that follow it.) */
const SINGLE_LINE_BLOCK_RE = /^\s*(?:#{1,6}\s|\||={3,}\s*$|(?:[-*_]\s*){3,}$)/;
/** An opening or closing code fence. */
const FENCE_RE = /^\s*(?:```|~~~)/;

/**
 * Undo the changelog's hard line wrapping.
 *
 * `CHANGELOG.md` is wrapped at ~80 columns for readability in the repo, but
 * Obsidian renders a single newline as a line break unless the reader has
 * "Strict line breaks" on. Left alone, the dialog therefore breaks sentences
 * mid-clause at whatever column the source happened to wrap at. Joining each
 * paragraph (and each list item) back into one logical line lets the text wrap
 * to the dialog's width instead.
 *
 * Block structure is preserved: blank lines, headings, list markers, quotes,
 * tables and fenced code all start a new line, as do explicit Markdown hard
 * breaks (a line ending in two spaces or a backslash). Indented continuation
 * lines are joined onto their parent with a single space, so a list item's
 * second paragraph stays inside the item.
 */
export function reflowMarkdown(md: string): string {
	const out: string[] = [];
	let buffer: string | null = null;
	let inFence = false;

	const flush = () => {
		if (buffer !== null) out.push(buffer);
		buffer = null;
	};

	for (const raw of md.split("\n")) {
		if (FENCE_RE.test(raw)) {
			flush();
			out.push(raw);
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			out.push(raw);
			continue;
		}

		const line = raw.replace(/\s+$/, "");
		if (line === "") {
			flush();
			out.push("");
			continue;
		}
		// The first line of a block keeps its own indentation — that is what
		// holds a list item's second paragraph inside the item.
		if (BLOCK_START_RE.test(line) || buffer === null) {
			flush();
			buffer = line;
		} else {
			buffer = `${buffer} ${line.trimStart()}`;
		}
		// A one-line block ends here, and an explicit hard break (trailing double
		// space or backslash) is the author asking for a line break — either way,
		// start afresh.
		if (SINGLE_LINE_BLOCK_RE.test(line) || /(?: {2}|\\)$/.test(raw)) flush();
	}
	flush();

	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Split the changelog Markdown into per-release entries, newest first (the
 * file's own order). The preamble above the first `##` heading is dropped, the
 * heading itself is lifted out of the body — the dialog draws it as its own
 * header — and the trailing link-reference definitions are resolved into each
 * entry's {@link ChangelogEntry.url} so nothing has to be re-appended to the
 * rendered Markdown.
 */
export function parseChangelog(md: string): ChangelogEntry[] {
	const entries: { version: string; date: string; body: string[] }[] = [];
	const urls = new Map<string, string>();
	let current: { version: string; date: string; body: string[] } | null = null;

	for (const line of md.split("\n")) {
		const linkDef = LINK_DEF_RE.exec(line);
		if (linkDef) {
			urls.set(linkDef[1], linkDef[2]);
			continue;
		}
		const heading = HEADING_RE.exec(line);
		if (heading) {
			current = {
				version: (heading[1] ?? heading[2]).trim(),
				date: (heading[3] ?? "").trim(),
				body: [],
			};
			entries.push(current);
		} else if (current) {
			current.body.push(line);
		}
		// Lines before the first heading are the file preamble — ignored.
	}

	return entries.map((e) => ({
		version: e.version,
		date: e.date,
		url: urls.get(e.version) ?? "",
		markdown: reflowMarkdown(e.body.join("\n")),
	}));
}

/** The numeric release components of a version, ignoring any pre-release suffix
 * (`1.9.0-beta.1` → `[1, 9, 0]`), so beta and stable builds compare by release. */
function versionParts(v: string): number[] {
	return v
		.split("-")[0]
		.split(".")
		.map((n) => parseInt(n, 10) || 0);
}

/** Whether release `a` is strictly newer than release `b` (semver-style, by
 * numeric components; pre-release suffixes are ignored). */
export function isNewer(a: string, b: string): boolean {
	const pa = versionParts(a);
	const pb = versionParts(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = pa[i] ?? 0;
		const y = pb[i] ?? 0;
		if (x !== y) return x > y;
	}
	return false;
}
