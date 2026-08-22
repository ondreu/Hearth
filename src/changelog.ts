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
	/** The same body, split into `### …` sections of headline/detail items —
	 * what the "What's new" dialog draws. See {@link parseSections}. */
	sections: ChangelogSection[];
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

	return entries.map((e) => {
		const markdown = reflowMarkdown(e.body.join("\n"));
		return {
			version: e.version,
			date: e.date,
			url: urls.get(e.version) ?? "",
			markdown,
			sections: parseSections(markdown),
		};
	});
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

/* ── Structured entries: sections and headline/detail items ───────────────
 *
 * `CHANGELOG.md` is written to a house style the dialog can lean on: each
 * release is split into `### Added` / `### Changed` / `### Fixed` sections, and
 * every bullet opens with a bold sentence saying what changed, followed by the
 * paragraphs that explain it. Rendering the section body as one block of
 * Markdown therefore produces a wall of text — several screens of it for a
 * release like 2.0.0. Splitting it back into (headline, details) pairs lets the
 * dialog show the headlines as a scannable list and keep each explanation
 * folded away until it's asked for.
 */

/** The Keep-a-Changelog section a bullet sits under, normalised. */
export type ChangeKind = "added" | "changed" | "fixed" | "removed" | "deprecated" | "security" | "other";

/** One bullet from a release section, split into what changed and why. */
export interface ChangelogItem {
	/** The bullet's opening bold sentence — the one-line summary. Markdown. */
	headline: string;
	/** Everything after the headline: the explanation, as Markdown. May be
	 * empty, in which case the item is a headline and nothing more. */
	details: string;
	/** Issue numbers from the trailing `(#123)` reference, without the `#`.
	 * Lifted out of {@link details} so the dialog can show them as links. */
	issues: string[];
}

/** One `### …` section of a release. */
export interface ChangelogSection {
	/** The normalised section kind, for the label and icon. */
	kind: ChangeKind;
	/** The heading as written, e.g. `Added`. */
	label: string;
	/** The section's bullets, in file order. */
	items: ChangelogItem[];
	/** Any prose that isn't a bullet (rare — a section intro). Markdown. */
	prose: string;
}

/** A `### Added`-style section heading. */
const SECTION_RE = /^###\s+(.+?)\s*$/;
/** A top-level list bullet (a nested one is indented, so it stays in details). */
const BULLET_RE = /^[-*+]\s+(.*)$/;
/** The bold sentence a bullet opens with. */
const HEADLINE_RE = /^\*\*(.+?)\*\*[ \t]*/;
/** The `(#123)` — or `(#123, #124)` — reference bullets close with, which the
 * house style writes inside the closing full stop: `… as any other (#229).` */
const ISSUE_REF_RE = /\s*\((#\d+(?:\s*,\s*#\d+)*)\)(\.?)\s*$/;

/** Map a section heading to a known kind, so unknown headings still render. */
function sectionKind(label: string): ChangeKind {
	const l = label.toLowerCase();
	for (const kind of ["added", "changed", "fixed", "removed", "deprecated", "security"] as const) {
		if (l.startsWith(kind)) return kind;
	}
	return "other";
}

/**
 * Split one bullet's Markdown into a headline and the details beneath it.
 *
 * The house style opens every bullet with `**A bold sentence.**`, which becomes
 * the headline verbatim. Without one, the bullet's first sentence stands in —
 * truncating nothing, since the whole first line is kept as the headline when
 * it is short and the rest becomes details.
 */
export function splitItem(md: string): ChangelogItem {
	const trimmed = md.trim();
	const bold = HEADLINE_RE.exec(trimmed);

	let headline: string;
	let rest: string;
	if (bold) {
		headline = bold[1].trim();
		rest = trimmed.slice(bold[0].length);
	} else {
		// No bold lead: break at the first sentence end on the opening line, so
		// there is still something short to scan.
		const firstLine = trimmed.split("\n")[0];
		const stop = /[.!?](\s|$)/.exec(firstLine);
		const cut = stop && stop.index < 160 ? stop.index + 1 : firstLine.length;
		headline = firstLine.slice(0, cut).trim();
		rest = trimmed.slice(cut);
	}

	// The trailing issue reference belongs to the item, not its prose — the
	// dialog draws it as a link beside the headline.
	const issues: string[] = [];
	let details = rest.replace(/^[ \t]+/, "").trimEnd();
	const refs = ISSUE_REF_RE.exec(details) ?? ISSUE_REF_RE.exec(headline);
	if (refs) {
		for (const n of refs[1].split(",")) issues.push(n.trim().replace(/^#/, ""));
		// The full stop the reference sat inside stays with the sentence.
		if (ISSUE_REF_RE.test(details)) details = details.replace(ISSUE_REF_RE, refs[2]);
		else headline = headline.replace(ISSUE_REF_RE, refs[2]);
	}

	return { headline: headline.trim(), details: details.trim(), issues };
}

/**
 * Split a release body (as produced by {@link reflowMarkdown}) into its
 * sections, each split into headline/detail items. A body with no `###`
 * headings yields a single `other` section, so a hand-written release still
 * renders; bullet-less prose is kept in {@link ChangelogSection.prose}.
 */
export function parseSections(md: string): ChangelogSection[] {
	const sections: ChangelogSection[] = [];
	let current: ChangelogSection | null = null;
	/** Raw lines of the bullet being accumulated, and the loose prose lines. */
	let bullet: string[] | null = null;
	let prose: string[] = [];
	let inFence = false;

	const openSection = (label: string) => {
		flushBullet();
		flushProse();
		current = { kind: sectionKind(label), label, items: [], prose: "" };
		sections.push(current);
	};
	const ensureSection = () => {
		if (!current) openSection("");
		return current as ChangelogSection;
	};
	const flushBullet = () => {
		if (bullet && current) {
			const item = splitItem(dedent(bullet.join("\n")));
			if (item.headline || item.details) current.items.push(item);
		}
		bullet = null;
	};
	const flushProse = () => {
		const text = prose.join("\n").trim();
		if (text && current) current.prose = `${current.prose}\n\n${text}`.trim();
		prose = [];
	};

	for (const line of md.split("\n")) {
		if (FENCE_RE.test(line)) inFence = !inFence;

		if (!inFence) {
			const heading = SECTION_RE.exec(line);
			if (heading) {
				openSection(heading[1]);
				continue;
			}
			const item = BULLET_RE.exec(line);
			if (item) {
				ensureSection();
				flushBullet();
				flushProse();
				bullet = [item[1]];
				continue;
			}
		}

		// A blank or indented line continues the bullet it follows; anything at
		// column zero (outside a bullet) is the section's own prose.
		if (bullet && (line.trim() === "" || /^\s/.test(line) || inFence)) {
			bullet.push(line);
			continue;
		}
		flushBullet();
		if (line.trim() !== "" || prose.length) {
			ensureSection();
			prose.push(line);
		}
	}
	flushBullet();
	flushProse();

	return sections.filter((s) => s.items.length > 0 || s.prose !== "");
}

/** Strip the common indentation from a bullet's continuation lines, so its
 * nested lists and follow-on paragraphs render on their own. */
function dedent(md: string): string {
	const lines = md.split("\n");
	const indents = lines
		.slice(1)
		.filter((l) => l.trim() !== "")
		.map((l) => /^\s*/.exec(l)?.[0].length ?? 0);
	const common = indents.length ? Math.min(...indents) : 0;
	return [lines[0], ...lines.slice(1).map((l) => l.slice(common))].join("\n");
}
