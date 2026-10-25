/**
 * A task's description: the lines nested under a checkbox or Kanban card, one
 * sub-bullet per line. This is the part of it that is pure text logic — what
 * inline formatting a line carries, and which lines hold something a
 * sub-bullet can't — kept free of Obsidian and the DOM so it can be tested.
 *
 * Why there is a line between "works" and "doesn't": every line is written
 * back as `\t- <line>` under the task. Inline Markdown survives that (Obsidian
 * renders it inside the bullet, and the card draws the same set), but anything
 * that is a *block* of its own does not: a heading or quote becomes a bullet
 * that happens to start with `#` or `>`, a `[ ]` turns the line into a
 * sub-task (which, for a checkbox task, ends the description right there), a
 * code fence or table row is split one bullet per line, and indentation is
 * flattened because each line is trimmed. The editor shows this list, and
 * flags a line that falls on the wrong side of it before it is saved.
 */

/** One run of a description line, as the card draws it. */
export type DescriptionSegment =
	| { kind: "text"; text: string }
	| { kind: "bold" | "italic" | "strike" | "highlight" | "code"; text: string }
	| { kind: "wikilink"; text: string; target: string }
	| { kind: "link"; text: string; target: string }
	| { kind: "tag"; text: string };

/** The inline forms a description line can carry, in the order they are
 * matched: code first (nothing inside backticks is formatting), then links
 * (their text is shown as-is), then the emphasis forms. `***` is matched before
 * `**` and `*` so it isn't read as an empty bold. An underscore italic and a
 * tag need what comes before them (a word character would make `snake_case` or
 * `a#b` formatting), which is captured rather than looked behind for: older iOS
 * WebViews, which Obsidian mobile runs on, reject lookbehind outright. */
const INLINE_RE =
	/`([^`\n]+)`|\[\[([^\]\n]+?)\]\]|\[([^\]\n]+?)\]\(([^)\s]+)\)|\*\*\*([^*\n]+?)\*\*\*|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|==([^=\n]+?)==|\*([^*\s][^*\n]*?)\*|(^|[^\w])_([^_\s][^_\n]*?)_(?!\w)|(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;

/** Split a description line into the runs the card draws. Unmatched markers
 * (`**open`) stay as text, so nothing typed is lost. */
export function parseDescriptionLine(line: string): DescriptionSegment[] {
	const out: DescriptionSegment[] = [];
	const push = (seg: DescriptionSegment) => {
		const prev = out[out.length - 1];
		if (seg.kind === "text" && prev?.kind === "text") prev.text += seg.text;
		else out.push(seg);
	};
	let last = 0;
	INLINE_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = INLINE_RE.exec(line)) !== null) {
		if (m.index > last) push({ kind: "text", text: line.slice(last, m.index) });
		if (m[1] !== undefined) push({ kind: "code", text: m[1] });
		else if (m[2] !== undefined) {
			const [target, alias] = m[2].split("|");
			push({ kind: "wikilink", text: (alias ?? target).trim(), target: target.trim() });
		} else if (m[3] !== undefined) push({ kind: "link", text: m[3], target: m[4] });
		else if (m[5] !== undefined) push({ kind: "bold", text: m[5] });
		else if (m[6] !== undefined || m[7] !== undefined) push({ kind: "bold", text: (m[6] ?? m[7]) });
		else if (m[8] !== undefined) push({ kind: "strike", text: m[8] });
		else if (m[9] !== undefined) push({ kind: "highlight", text: m[9] });
		else if (m[10] !== undefined) push({ kind: "italic", text: m[10] });
		else if (m[12] !== undefined) {
			if (m[11]) push({ kind: "text", text: m[11] });
			push({ kind: "italic", text: m[12] });
		} else if (m[14] !== undefined) {
			if (m[13]) push({ kind: "text", text: m[13] });
			push({ kind: "tag", text: `#${m[14]}` });
		}
		last = INLINE_RE.lastIndex;
	}
	if (last < line.length) push({ kind: "text", text: line.slice(last) });
	return out;
}

/** Something on a description line that a sub-bullet can't hold. */
export type DescriptionIssue =
	| "heading"
	| "checkbox"
	| "quote"
	| "codeblock"
	| "table"
	| "rule"
	| "embed"
	| "indent";

/** The lines of a description as they are stored: trimmed, blanks dropped. */
export function descriptionLines(description: string): string[] {
	return description
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
}

/** What, if anything, is wrong with one raw (untrimmed) description line. */
export function descriptionLineIssue(raw: string): DescriptionIssue | null {
	const line = raw.trim();
	if (!line) return null;
	// The bullet marker is added on save and stripped on read, so a line typed
	// with one is judged by what follows it.
	const body = line.replace(/^[-*+]\s+/, "");
	if (/^\[.\]\s/.test(body) || /^\[.\]$/.test(body)) return "checkbox";
	if (/^#{1,6}\s/.test(body)) return "heading";
	if (/^>/.test(body)) return "quote";
	if (/^(```|~~~)/.test(body)) return "codeblock";
	if (/^\|.*\|$/.test(body)) return "table";
	if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return "rule";
	if (/!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)/.test(body)) return "embed";
	if (/^[ \t]+\S/.test(raw)) return "indent";
	return null;
}

/** Every line of a draft that holds something a sub-bullet can't, with its
 * 1-based line number in the textarea. */
export function descriptionIssues(description: string): { line: number; text: string; issue: DescriptionIssue }[] {
	const out: { line: number; text: string; issue: DescriptionIssue }[] = [];
	description.split(/\r?\n/).forEach((raw, i) => {
		const issue = descriptionLineIssue(raw);
		if (issue) out.push({ line: i + 1, text: raw.trim(), issue });
	});
	return out;
}
