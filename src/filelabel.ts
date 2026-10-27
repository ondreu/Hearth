import type { App, TFile } from "obsidian";
import { cleanTitle, type TitleOf } from "./frontmattertitle";

/**
 * What a file-listing card calls a note (#399).
 *
 * A vault that names its files with a code, a date or a number up front —
 * `2026-10-14 meeting`, `PRJ-118 spec` — is unreadable on a narrow card,
 * because the row can only show the beginning. Those vaults keep the human name
 * in frontmatter instead: `aliases` (which Bases itself uses for
 * `link(file.name, aliases[0])`), or a `title` of their own.
 *
 * So a card may name one property, and a note that has it is listed under that
 * value. Everything else falls back the way it always did: the title the file
 * explorer shows (Front Matter Title, see `frontmattertitle.ts`), then the file
 * name. The fallback is per note, not per card — a note without the property is
 * still listed, under its file name, rather than going missing.
 */

/**
 * A frontmatter value as the one line a row can show, or null when there is
 * nothing usable in it.
 *
 * A list (as `aliases` is) gives its first entry that has any text, which is
 * what Bases' `aliases[0]` idiom does. Property names are matched
 * case-insensitively, as they are for icons (#398): Obsidian keeps the casing
 * the user typed, and `Aliases` is the same property as `aliases` to a vault.
 * Numbers are shown as text; booleans, objects and nested lists are not titles
 * and come back as null, so the caller keeps the file name.
 */
export function propertyLabel(frontmatter: unknown, property: string): string | null {
	if (!frontmatter || typeof frontmatter !== "object") return null;
	const key = property.trim().toLowerCase();
	if (!key) return null;
	const entry = Object.entries(frontmatter as Record<string, unknown>).find(
		([name]) => name.toLowerCase() === key,
	);
	if (!entry) return null;
	const value = entry[1];
	if (Array.isArray(value)) {
		for (const item of value) {
			const label = scalarLabel(item);
			if (label) return label;
		}
		return null;
	}
	return scalarLabel(value);
}

function scalarLabel(value: unknown): string | null {
	if (typeof value === "string") return cleanTitle(value);
	// A year, an issue number: a hand-written property can be a number, and
	// "2026" reads fine as a title. Anything non-finite is not a label.
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

/** What the card and the vault know about one file, as far as its name goes. */
export interface RowLabelInput {
	/** The file name without its extension — the last resort, and what every
	 * file-listing card showed before #399. */
	basename: string;
	/** The property the card names, already trimmed; empty when it names none. */
	property: string;
	/** The file's frontmatter, when the file has any. */
	frontmatter: unknown;
	/** The title the file explorer shows for it, when Front Matter Title is
	 * on — the middle fallback, so a card agrees with the sidebar beside it. */
	title: string | null;
}

/**
 * One row's name: the card's property, else the explorer's title, else the file
 * name. Pure, so the three levels are tested without an Obsidian vault; the
 * lookup that feeds it is `fileLabel` below.
 */
export function noteLabel(input: RowLabelInput): string {
	const named = input.property ? propertyLabel(input.frontmatter, input.property) : null;
	return named ?? cleanTitle(input.title) ?? input.basename;
}

/**
 * The function a card uses to name each of its files.
 *
 * `titles` is the explorer's resolver (`explorerTitles`), or null when Front
 * Matter Title is absent or its explorer titles are off. Call this once per draw
 * and use the result for every row: the card's property is read once rather than
 * once per file, and the metadata cache is only consulted when the card actually
 * names a property.
 */
export function fileLabel(
	app: App,
	card: { titleProperty?: string },
	titles: TitleOf | null,
): (file: TFile) => string {
	const property = card.titleProperty?.trim() ?? "";
	return (file) =>
		noteLabel({
			basename: file.basename,
			property,
			frontmatter: property ? app.metadataCache.getFileCache(file)?.frontmatter : undefined,
			title: titles?.(file.path) ?? null,
		});
}
