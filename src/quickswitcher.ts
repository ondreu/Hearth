import { App, parseFrontMatterAliases, prepareFuzzySearch, SearchResult, TFile } from "obsidian";
import { QueryFilter, QueryHit, filePassesFilter } from "./query";

/**
 * The "Quick switcher" search engine: the search bar answers the way
 * Obsidian's own Quick switcher (Ctrl/Cmd+O) does, instead of with Hearth's
 * banded name/path/body ranking.
 *
 * What that means, matching the core plugin's matcher:
 * - files only — never folders;
 * - the file's *name* is matched first. The folder path is matched only when
 *   the name doesn't match at all, and that match is docked by one point — the
 *   core plugin's own rule, so any name hit outranks any path hit. Without it a
 *   note called "Black Sphinx" ties with an empty note "A" sitting next to it,
 *   because the folder name scores the same as the file name (#447);
 * - each frontmatter alias is matched too, and an alias that scores better than
 *   the name wins the row and is shown as the reason it matched;
 * - files the user excluded from link suggestions are docked ten points, which
 *   is what the switcher does with the rows it down-ranks;
 * - the list is ordered by score alone. The core sorts by `match.score` and
 *   nothing else, so equal scores keep the order the vault hands out; an
 *   alphabetical tiebreak puts different files on top than the switcher does,
 *   which is the other half of #447;
 * - which file types are listed follows the switcher's own "Show attachments"
 *   and "Show all file types" options, read from the core plugin when it's
 *   reachable; a type that isn't one of the core ones is listed when Obsidian's
 *   own registry can display it, so a plugin's `.excalidraw` behaves like any
 *   other attachment.
 *
 * The switcher's own modal isn't an API a plugin can embed, so this re-creates
 * its matching with the public `prepareFuzzySearch`, the matcher it uses.
 */

/** File types Obsidian opens natively, i.e. what the switcher calls notes. */
const NOTE_EXTENSIONS = new Set(["md", "canvas", "base"]);
/** Images the switcher counts as attachments. */
const IMAGE_EXTENSIONS = new Set(["bmp", "png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "tiff"]);
/** Audio, likewise. */
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "3gp", "flac", "ogg", "oga", "opus"]);
/** Video, likewise. */
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov", "mkv"]);

/** Whether Obsidian itself can display a file with this extension. */
export type ExtensionRegistry = (extension: string) => boolean;

/** The two Quick switcher options that decide which files it lists. */
export interface SwitcherFileOptions {
	showAttachments: boolean;
	showAllFileTypes: boolean;
}

/** The switcher's defaults, used when the core plugin's options can't be read. */
const DEFAULT_OPTIONS: SwitcherFileOptions = { showAttachments: true, showAllFileTypes: false };

/** What the core matcher subtracts when the name didn't match and the whole
 * path had to. One point is enough because every score is negative, so a name
 * hit can never lose to a path hit. */
const PATH_MATCH_PENALTY = 1;

/** What the switcher subtracts from a file the user excluded from link
 * suggestions ("Excluded files" in Obsidian's settings). */
const EXCLUDED_FILE_PENALTY = 10;

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

/** Whether the switcher would list a file with this extension. The known core
 * types decide on their own; anything else is a type a plugin brought along,
 * and the switcher asks Obsidian's registry whether it can display it at all —
 * `canDisplay` is that check, and without it unknown types stay hidden.
 * Exported for tests. */
export function switcherListsExtension(
	extension: string,
	options: SwitcherFileOptions,
	canDisplay: ExtensionRegistry = () => false,
): boolean {
	const ext = extension.toLowerCase();
	if (NOTE_EXTENSIONS.has(ext)) return true;
	if (IMAGE_EXTENSIONS.has(ext)) return options.showAttachments;
	if (options.showAllFileTypes) return true;
	if (!options.showAttachments) return false;
	if (AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || ext === "pdf") return true;
	return canDisplay(ext);
}

/** The string the switcher matches a file against: its path, without `.md`
 * for notes. Exported for tests. */
export function switcherText(path: string, extension: string): string {
	return extension === "md" ? path.slice(0, -".md".length) : path;
}

/** The last segment of a match string — the file's own name, folders
 * stripped. This is the part the switcher matches first. Exported for tests. */
export function switcherName(text: string): string {
	const at = text.lastIndexOf("/");
	return at === -1 ? text : text.slice(at + 1);
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
	/** Set when an alias matched better than the name. */
	alias?: { text: string; matches: [number, number][] };
}

/**
 * Match one candidate the way the switcher does: the name first, and only when
 * that misses the whole path docked by one point; every alias goes through the
 * same matcher, the best score winning (a tie keeps the name). Null when none
 * of them matches. Exported for tests, which pass their own matcher in place of
 * Obsidian's.
 *
 * The path is matched *first* even though the name decides the score. That
 * isn't the order the core evaluates them in, but it can't change the result:
 * the name is the tail of the path, so anything the query finds in the name it
 * also finds in the path. A path miss therefore means the name misses too, and
 * one failed match answers both questions — the name is only matched for the
 * handful of files the path already accepted.
 */
export function matchCandidate(
	candidate: SwitcherCandidate,
	match: (text: string) => SearchResult | null,
): SwitcherMatch | null {
	const name = switcherName(candidate.text);
	let best: SwitcherMatch | null = null;
	const onPath = match(candidate.text);
	if (onPath) {
		const onName = match(name);
		best = onName
			? {
					score: onName.score,
					matches: tailRanges(onName.matches, name.length, candidate.displayName.length),
				}
			: {
					// The name missed, so the path is the only reason this file is
					// listed: docked, so it can never displace a name hit.
					score: onPath.score - PATH_MATCH_PENALTY,
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

/** The switcher's own order: score alone, best first. Ties keep the order the
 * vault handed them out — `Array#sort` is stable — because the core sorts by
 * `match.score` and nothing else. Exported for tests. */
export function sortSwitcherHits(hits: QueryHit[]): QueryHit[] {
	return hits.sort((a, b) => b.score - a.score);
}

/** Whether Obsidian can display a file type — the check the switcher makes for
 * anything that isn't a note, image, audio file, video or PDF, so files brought
 * by a plugin (`.excalidraw`, `.typ`, …) are listed the same way. Private API:
 * without it, unknown types stay hidden exactly as before. */
function extensionRegistry(app: App): ExtensionRegistry {
	const registry = (app as unknown as {
		viewRegistry?: { isExtensionRegistered?: (extension: string) => boolean };
	}).viewRegistry;
	const isRegistered = registry?.isExtensionRegistered;
	if (!registry || typeof isRegistered !== "function") return () => false;
	return (extension) => {
		try {
			return isRegistered.call(registry, extension) === true;
		} catch {
			return false;
		}
	};
}

/** Aliases already parsed, keyed by the frontmatter object they came from: the
 * metadata cache hands out a fresh object on every re-parse, so an entry
 * expires with the file that produced it. Matching runs per keystroke and
 * re-parsing the same frontmatter for every file was pure overhead. */
const aliasCache = new WeakMap<object, readonly string[]>();

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
	const canDisplay = extensionRegistry(app);
	const fuzzy = prepareFuzzySearch(query);
	const hits: QueryHit[] = [];
	for (const file of app.vault.getFiles()) {
		if (!switcherListsExtension(file.extension, options, canDisplay)) continue;
		if (!filePassesFilter(file, filter)) continue;
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
			score: isUserExcluded(app, file) ? result.score - EXCLUDED_FILE_PENALTY : result.score,
			matches: result.matches,
			badge: result.alias
				? { icon: "corner-down-right", label: result.alias.text, matches: result.alias.matches }
				: undefined,
		});
	}
	return sortSwitcherHits(hits).slice(0, opts.limit);
}

/** Whether the user excluded the file from link suggestions. Private API, so
 * anything missing or refusing the call means "not excluded". */
function isUserExcluded(app: App, file: TFile): boolean {
	const cache = app.metadataCache as unknown as { isUserIgnored?: (path: string) => boolean };
	if (typeof cache.isUserIgnored !== "function") return false;
	try {
		return cache.isUserIgnored.call(cache, file.path) === true;
	} catch {
		return false;
	}
}

function aliasesOf(app: App, file: TFile): readonly string[] {
	if (file.extension !== "md") return [];
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter) return [];
	const cached = aliasCache.get(frontmatter);
	if (cached) return cached;
	const aliases = parseFrontMatterAliases(frontmatter) ?? [];
	aliasCache.set(frontmatter, aliases);
	return aliases;
}
