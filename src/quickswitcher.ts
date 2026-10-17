import { App, parseFrontMatterAliases, prepareFuzzySearch, SearchResult, TFile } from "obsidian";
import { groupForFile } from "./filetypes";
import { QueryFilter, QueryHit } from "./query";

/**
 * The "Quick switcher" search engine: the search bar answers the way
 * Obsidian's own Quick switcher (Ctrl/Cmd+O) does, instead of with Hearth's
 * banded name/path/body ranking.
 *
 * What that means, matching the core plugin:
 * - files only — never folders;
 * - one fuzzy match against the file's path (notes without their `.md`), the
 *   same string the switcher matches;
 * - each frontmatter alias is matched too, and an alias that scores better
 *   than the path wins the row and is shown as the reason it matched;
 * - which file types are listed follows the switcher's own "Show attachments"
 *   and "Show all file types" options, read from the core plugin when it's
 *   reachable.
 *
 * The switcher's own modal isn't an API a plugin can embed, so this re-creates
 * its matching with the public `prepareFuzzySearch`, the matcher it uses.
 */

/** File types Obsidian opens natively, i.e. what the switcher calls notes. */
const NOTE_EXTENSIONS = new Set(["md", "canvas", "base"]);
/** File types Obsidian can display — the switcher's "attachments". */
const ATTACHMENT_EXTENSIONS = new Set([
	"png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif",
	"mp3", "wav", "m4a", "ogg", "3gp", "flac", "webm",
	"mp4", "ogv", "mov", "mkv",
	"pdf",
]);

/** The two Quick switcher options that decide which files it lists. */
export interface SwitcherFileOptions {
	showAttachments: boolean;
	showAllFileTypes: boolean;
}

/** The switcher's defaults, used when the core plugin's options can't be read. */
const DEFAULT_OPTIONS: SwitcherFileOptions = { showAttachments: true, showAllFileTypes: false };

/** Read the Quick switcher's file-type options from the core plugin. Private
 * API, so every step is checked and anything missing falls back to the
 * switcher's defaults. */
export function switcherFileOptions(app: App): SwitcherFileOptions {
	const instance = app.internalPlugins?.getPluginById("switcher")?.instance as
		| { options?: Partial<Record<keyof SwitcherFileOptions, unknown>> }
		| undefined;
	const options = instance?.options;
	return {
		showAttachments:
			typeof options?.showAttachments === "boolean"
				? options.showAttachments
				: DEFAULT_OPTIONS.showAttachments,
		showAllFileTypes:
			typeof options?.showAllFileTypes === "boolean"
				? options.showAllFileTypes
				: DEFAULT_OPTIONS.showAllFileTypes,
	};
}

/** Whether the switcher would list a file with this extension. Exported for tests. */
export function switcherListsExtension(extension: string, options: SwitcherFileOptions): boolean {
	const ext = extension.toLowerCase();
	if (NOTE_EXTENSIONS.has(ext)) return true;
	if (options.showAllFileTypes) return true;
	return options.showAttachments && ATTACHMENT_EXTENSIONS.has(ext);
}

/** The string the switcher matches a file against: its path, without `.md`
 * for notes. Exported for tests. */
export function switcherText(path: string, extension: string): string {
	return extension === "md" ? path.slice(0, -".md".length) : path;
}

/**
 * Re-base match ranges found in `text` onto its trailing `tail` (the file's
 * display name), dropping the parts that fell in the folder path and clipping
 * any that straddle the boundary. Exported for tests.
 */
export function tailRanges(
	ranges: readonly [number, number][],
	textLength: number,
	tailLength: number,
): [number, number][] {
	const offset = textLength - tailLength;
	const out: [number, number][] = [];
	for (const [start, end] of ranges) {
		if (end <= offset) continue;
		out.push([Math.max(start, offset) - offset, end - offset]);
	}
	return out;
}

/** One file the engine may list, reduced to what matching needs. */
export interface SwitcherCandidate {
	/** The string matched against (see {@link switcherText}). */
	text: string;
	/** What the result row shows as its title — the end of `text`. */
	displayName: string;
	aliases: readonly string[];
}

/** The best match for one candidate. */
export interface SwitcherMatch {
	score: number;
	/** Ranges into `displayName`. */
	matches: [number, number][];
	/** Set when an alias matched better than the path. */
	alias?: { text: string; matches: [number, number][] };
}

/**
 * Match one candidate the way the switcher does: the path and every alias go
 * through the same matcher and the best score wins (the path keeps a tie).
 * Null when none of them matches. Exported for tests, which pass their own
 * matcher in place of Obsidian's.
 */
export function matchCandidate(
	candidate: SwitcherCandidate,
	match: (text: string) => SearchResult | null,
): SwitcherMatch | null {
	let best: SwitcherMatch | null = null;
	const onPath = match(candidate.text);
	if (onPath) {
		best = {
			score: onPath.score,
			matches: tailRanges(onPath.matches, candidate.text.length, candidate.displayName.length),
		};
	}
	for (const alias of candidate.aliases) {
		const onAlias = match(alias);
		if (!onAlias || (best && onAlias.score <= best.score)) continue;
		best = { score: onAlias.score, matches: [], alias: { text: alias, matches: onAlias.matches } };
	}
	return best;
}

/**
 * Run a search the Quick switcher way and adapt it to Hearth's
 * {@link QueryHit} shape, best match first. The file-type chips still narrow
 * the list; the folders chip never reaches here (folders aren't the
 * switcher's to list), the search bar keeps that on the built-in engine.
 */
export function searchLikeQuickSwitcher(
	app: App,
	query: string,
	opts: { filter: QueryFilter; limit: number },
): QueryHit[] {
	const { filter } = opts;
	if (!filter.includeFiles) return [];
	const options = switcherFileOptions(app);
	const fuzzy = prepareFuzzySearch(query);
	const hits: QueryHit[] = [];
	for (const file of app.vault.getFiles()) {
		if (!switcherListsExtension(file.extension, options)) continue;
		if (filter.groupId && groupForFile(file)?.id !== filter.groupId) continue;
		const result = matchCandidate(
			{
				text: switcherText(file.path, file.extension),
				displayName: file.basename,
				aliases: aliasesOf(app, file),
			},
			fuzzy,
		);
		if (!result) continue;
		hits.push({
			file,
			score: result.score,
			matches: result.matches,
			badge: result.alias
				? { icon: "corner-down-right", label: result.alias.text, matches: result.alias.matches }
				: undefined,
		});
	}
	// Scores closer to zero are better; the name keeps the order stable.
	hits.sort((a, b) => b.score - a.score || a.file.name.localeCompare(b.file.name));
	return hits.slice(0, opts.limit);
}

function aliasesOf(app: App, file: TFile): string[] {
	if (file.extension !== "md") return [];
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatter ? (parseFrontMatterAliases(frontmatter) ?? []) : [];
}
