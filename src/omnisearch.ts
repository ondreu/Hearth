import { App, TFile } from "obsidian";
import { cleanExcerptText, foldForMatch, highlightRanges, windowExcerpt } from "./excerpt";
import { groupForFile } from "./filetypes";
import { QueryFilter, QueryHit } from "./query";

/** The community-plugin id Omnisearch registers itself under. */
export const OMNISEARCH_PLUGIN_ID = "omnisearch";

/** A single result from Omnisearch's public search API. Only the fields Hearth
 * uses are declared; Omnisearch returns a few more. */
interface OmnisearchResult {
	score: number;
	path: string;
	basename: string;
	/** The words that matched, lower-cased. */
	foundWords: string[];
	/** A short body snippet around the best match (may contain <mark> markup,
	 * which Hearth strips — it renders its own highlighting). */
	excerpt: string;
}

/** The slice of Omnisearch's public API Hearth calls. Exposed by the plugin at
 * `app.plugins.plugins.omnisearch.api` once Omnisearch is enabled. */
interface OmnisearchApi {
	search(query: string): Promise<OmnisearchResult[]>;
}

/** Reach Omnisearch's public API, or null when the plugin isn't installed,
 * isn't enabled, or is too old to expose one. */
export function getOmnisearchApi(app: App): OmnisearchApi | null {
	const plugin = app.plugins.plugins[OMNISEARCH_PLUGIN_ID] as
		| { api?: unknown }
		| undefined;
	const api = plugin?.api;
	if (api && typeof (api as OmnisearchApi).search === "function") {
		return api as OmnisearchApi;
	}
	return null;
}

/** Whether Omnisearch is enabled and its search API is reachable right now. */
export function isOmnisearchAvailable(app: App): boolean {
	return getOmnisearchApi(app) !== null;
}

/**
 * Turn an Omnisearch excerpt into the same readable one-liner a built-in body
 * hit produces: its own `<mark>` markup comes out (Hearth highlights the result
 * row itself), then the shared cleaner deals with everything else the raw note
 * text dragged along — HTML, entities, frontmatter, markdown markers.
 *
 * `foundWords` is what Omnisearch actually matched, so the excerpt is narrowed
 * around the first of those words and they're highlighted in place. Without
 * that the row shows a wall of context with no visible reason it matched.
 *
 * Exported for tests.
 */
export function cleanExcerpt(
	excerpt: string,
	foundWords: readonly string[] = [],
): { label: string; matches?: [number, number][] } {
	// Omnisearch already marked the hits, and those spans hold the words as the
	// note actually spells them — `foundWords` comes back stemmed and stripped of
	// diacritics ("banan" for a note that says "Banánové"), so on its own it
	// often finds nothing to highlight. Take both.
	const words = [...markedWords(excerpt), ...foundWords].filter((w) => w.length > 1);
	const cleaned = cleanExcerptText(excerpt.replace(/<\/?mark>/g, ""));
	if (!cleaned) return { label: "" };
	// Narrow around the first word that's actually present, so the visible part
	// of a long excerpt is the part that explains the hit.
	const folded = foldForMatch(cleaned);
	const anchor = words.find((w) => folded.includes(foldForMatch(w)));
	const { label } = windowExcerpt(cleaned, anchor ?? "");
	return { label, matches: highlightRanges(label, words) };
}

/** The literal text Omnisearch wrapped in `<mark>` — the matched words exactly
 * as the note spells them, accents and inflection included. */
function markedWords(excerpt: string): string[] {
	const words = new Set<string>();
	const re = /<mark>([\s\S]*?)<\/mark>/g;
	for (let m = re.exec(excerpt); m; m = re.exec(excerpt)) {
		const word = m[1].trim();
		if (word) words.add(word);
	}
	return [...words];
}

/**
 * Run a vault search through Omnisearch and adapt its results to Hearth's
 * {@link QueryHit} shape.
 *
 * Resolves to `null` — not an empty list — when Omnisearch can't answer at all
 * (plugin gone, or its API threw). The two cases need to look different to the
 * caller: "Omnisearch found nothing" is a real answer worth showing, while
 * "Omnisearch is broken" should fall back to the built-in engine instead of
 * rendering a misleading empty state.
 *
 * The active file-type filter (and folder/file toggles) is applied to the
 * returned notes so the filter chips keep working; Omnisearch only indexes
 * notes, so folder-only filters yield nothing.
 */
export async function searchWithOmnisearch(
	app: App,
	query: string,
	opts: { filter: QueryFilter; limit: number },
): Promise<QueryHit[] | null> {
	const api = getOmnisearchApi(app);
	if (!api) return null;

	let results: OmnisearchResult[];
	try {
		results = await api.search(query);
	} catch {
		return null;
	}

	const { filter } = opts;
	// Omnisearch indexes notes only, so a folders-only filter can never match.
	if (!filter.includeFiles) return [];
	const hits: QueryHit[] = [];
	for (const result of results) {
		const file = app.vault.getAbstractFileByPath(result.path);
		if (!(file instanceof TFile)) continue;
		if (filter.groupId && groupForFile(file)?.id !== filter.groupId) continue;
		// Single characters match almost everywhere; highlighting them speckles
		// the row without saying anything about why it matched.
		const words = result.foundWords.filter((w) => w.length > 1);
		const excerpt = cleanExcerpt(result.excerpt, words);
		hits.push({
			file,
			// Folded, so a stemmed "banan" still lights up "Banánové" in the title.
			matches: highlightRanges(file.basename, words),
			score: result.score,
			badge: excerpt.label
				? { icon: "file-search", label: excerpt.label, matches: excerpt.matches, excerpt: true }
				: undefined,
		});
		if (hits.length >= opts.limit) break;
	}
	return hits;
}
