import { fencedLineMask } from "./checkboxtasks";

/**
 * Pure line logic for a Kanban-plugin board note: its `##` columns, which lines
 * are cards, and where a moved or new card goes. The tasks card does the vault
 * reads and writes around it; keeping this free of Obsidian lets it be tested.
 */


/** Marks the start of the Kanban plugin's trailing settings block
 * (`%% kanban:settings`). Everything from this line to end-of-file is board
 * metadata, not cards, so parsing and card insertion stop here. */
const KANBAN_SETTINGS_RE = /^\s*%%\s*kanban:settings/i;


/** A Kanban board column: its `##` heading text and the line range
 * `[headingLine, endLine)` (endLine exclusive) that holds its cards. */
export interface KanbanColumn {
	heading: string;
	headingLine: number;
	endLine: number;
}


/** The checkbox-item pattern shared by the Kanban parser (a card is a plain
 * Markdown task item, same as a checkbox task). The status char may be any
 * single character so custom statuses (`[/]`, `[-]`, …) are handled too. */
export const KANBAN_CARD_RE = /^\s*[-*+]\s\[(.)\]\s*(.*)$/;


/** Parse a Kanban board's `##` headings into ordered columns with the line
 * range that holds each column's cards. Frontmatter and the trailing
 * `%% kanban:settings` block are excluded. `footerStart` marks where the
 * settings block begins (or EOF), so callers never write past the cards.
 * `fenced` flags the lines of fenced code blocks: a heading or checkbox there
 * is text, not a column or a card (#400). */
export function parseKanbanColumns(lines: string[]): {
	columns: KanbanColumn[];
	footerStart: number;
	fenced: boolean[];
} {
	let footerStart = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (KANBAN_SETTINGS_RE.test(lines[i])) {
			footerStart = i;
			break;
		}
	}
	// Skip YAML frontmatter so a `---` fence isn't mistaken for content.
	let start = 0;
	if (lines[0]?.trim() === "---") {
		for (let i = 1; i < footerStart; i++) {
			if (lines[i].trim() === "---") {
				start = i + 1;
				break;
			}
		}
	}
	const fenced = new Array<boolean>(start).fill(false).concat(fencedLineMask(lines.slice(start)));
	const columns: KanbanColumn[] = [];
	for (let i = start; i < footerStart; i++) {
		if (fenced[i]) continue;
		const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
		if (!m) continue;
		if (columns.length) columns[columns.length - 1].endLine = i;
		columns.push({ heading: m[1].trim(), headingLine: i, endLine: footerStart });
	}
	return { columns, footerStart, fenced };
}


/** Insert a card block after the last existing card in the named column (or
 * right after the heading when the column is empty), keeping a blank line
 * before whatever follows. Mutates `lines`. Returns false if the column heading
 * isn't found. */
export function insertCardBlock(lines: string[], heading: string, block: string[]): boolean {
	const { columns, fenced } = parseKanbanColumns(lines);
	const target = columns.find((c) => c.heading === heading);
	if (!target) return false;
	let insertAt = target.headingLine + 1;
	for (let i = target.headingLine + 1; i < target.endLine; i++) {
		// A checkbox in a code block isn't a card; landing after it would drop
		// the moved card inside the block.
		if (!fenced[i] && KANBAN_CARD_RE.test(lines[i])) insertAt = i + 1;
	}
	// When the column is empty, skip a blank line right under the heading so the
	// card sits directly below it rather than after the gap.
	if (insertAt === target.headingLine + 1 && lines[insertAt]?.trim() === "") insertAt++;
	const toInsert = [...block];
	if (lines[insertAt] != null && lines[insertAt].trim() !== "") toInsert.push("");
	lines.splice(insertAt, 0, ...toInsert);
	return true;
}
