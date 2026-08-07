/**
 * Toggling Markdown task checkboxes from rendered output (issue #143).
 *
 * `MarkdownRenderer.render` emits reading-view markup, checkbox `<input>`s
 * included, but it isn't backed by a preview view — so nothing writes a click
 * back to the note and the tick vanishes on the next render. The DOM half of
 * the fix lives in `cardbodies.ts`; this module is the pure half: find the
 * checkbox lines in a Markdown source and rewrite one of them.
 *
 * The rendered `<input>`s carry no line information (there's no
 * `MarkdownPostProcessorContext` for a standalone render, so `getSectionInfo`
 * isn't available), so the mapping is by ordinal: the Nth checkbox in the
 * output is the Nth checkbox line in the source. The caller compares
 * `countCheckboxes` against the number of inputs it found and does nothing when
 * they disagree, which keeps a desync from writing to the wrong line.
 */

/** A list item that is a task: `- [ ] text`, `1. [x] text`, `> - [ ] text`.
 * The status character is captured; a space means open, anything else done-ish.
 * `]` must be followed by whitespace or end of line, matching Obsidian. */
const CHECKBOX_RE = /^([\s>]*(?:[-*+]|\d+[.)])\s+\[)(.)(\](?=\s|$))/;

/** Opening/closing fence of a code block, with the indent and fence captured. */
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

/** A leading YAML frontmatter block. */
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;


export interface CheckboxScanOptions {
	/** Skip a leading YAML frontmatter block, matching what the card renders.
	 * Defaults to true; the text card (whose content is a jotted snippet, not a
	 * note) passes false. */
	skipFrontmatter?: boolean;
}


/** How many lines a leading frontmatter block occupies (0 when there is none). */
function frontmatterLines(text: string): number {
	const match = FRONTMATTER_RE.exec(text);
	if (!match) return 0;
	// The block's own trailing newline ends its last line; count the breaks.
	return match[0].split("\n").length - 1;
}


/**
 * The line indices of every task checkbox in `text`, in document order — the
 * same order the renderer emits the inputs in. Lines inside fenced code blocks
 * are skipped: they render as text, not as checkboxes, so counting them would
 * shift every ordinal after them.
 */
export function checkboxLines(text: string, opts: CheckboxScanOptions = {}): number[] {
	const lines = text.split("\n");
	const start = opts.skipFrontmatter === false ? 0 : frontmatterLines(text);
	const found: number[] = [];
	let fence: string | null = null;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		const fenceMatch = FENCE_RE.exec(line);
		if (fenceMatch) {
			// A fence closes only on the same character, and only when at least
			// as long as the one that opened the block.
			if (fence === null) fence = fenceMatch[1];
			else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length)
				fence = null;
			continue;
		}
		if (fence !== null) continue;
		if (CHECKBOX_RE.test(line)) found.push(i);
	}
	return found;
}


/** How many task checkboxes `text` renders. */
export function countCheckboxes(text: string, opts: CheckboxScanOptions = {}): number {
	return checkboxLines(text, opts).length;
}


/** Rewrite one checkbox line's status character. Returns the line unchanged
 * when it is already in the wanted state, or null when it isn't a checkbox. */
export function toggleCheckboxLine(line: string, checked: boolean): string | null {
	const match = CHECKBOX_RE.exec(line);
	if (!match) return null;
	const status = checked ? "x" : " ";
	// A custom status (`[/]`, `[-]`, …) renders as a ticked box, so "check it"
	// is already true of it — leave the symbol alone rather than flattening it
	// to `x`. Unchecking one resets it to open, the only other state the
	// rendered input can express.
	if (match[2] === status || (checked && match[2] !== " ")) return line;
	return line.replace(CHECKBOX_RE, `$1${status}$3`);
}


/**
 * Set the `ordinal`-th checkbox (0-based, document order) in `text` to
 * `checked`. Returns the new text, or null when the ordinal is out of range or
 * the line turns out not to be a checkbox — the caller treats null as "don't
 * write", leaving the note untouched.
 */
export function toggleCheckboxAt(
	text: string,
	ordinal: number,
	checked: boolean,
	opts: CheckboxScanOptions = {},
): string | null {
	const indices = checkboxLines(text, opts);
	const lineIndex = indices[ordinal];
	if (lineIndex === undefined) return null;
	const lines = text.split("\n");
	const next = toggleCheckboxLine(lines[lineIndex], checked);
	if (next === null) return null;
	lines[lineIndex] = next;
	return lines.join("\n");
}
