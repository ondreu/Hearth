import { App, getAllTags, prepareFuzzySearch, TAbstractFile, TFile, TFolder } from "obsidian";
import { buildExcerpt, foldForMatch, highlightRanges } from "./excerpt";
import { groupForFile } from "./filetypes";

/** Shown instead of the folder path to say *why* a file matched. */
export interface QueryBadge {
	icon: string;
	label: string;
	/** Char ranges into `label` to highlight — the part that actually matched. */
	matches?: [number, number][];
	/** True for a note-body excerpt. Excerpts are prose, so they're rendered as
	 * muted context with the match picked out, not as a short accent-coloured
	 * chip the way a tag or property badge is — a whole sentence in accent
	 * colour competes with the file name it sits under. */
	excerpt?: boolean;
}

/** A single query result. `matches` holds char ranges into the display name for
 * highlighting (name/path matches only). `badge` is shown instead of the folder
 * path when a hit matched via a tag, property or note body. */
export interface QueryHit {
	file: TAbstractFile;
	score: number;
	/** Ranking band (see {@link RANK}). Compared before `score`, so a literal
	 * match can never be displaced by a well-scored fuzzy one. Absent on tag and
	 * property hits, which are their own mode and never mixed with these. */
	rank?: number;
	badge?: QueryBadge;
	matches?: [number, number][];
}

/** Which file-type group (and folders) a query is restricted to. */
export interface QueryFilter {
	includeFolders: boolean;
	includeFiles: boolean;
	/** File-type group id to require, or null for any. */
	groupId: string | null;
}

/** Property keys are matched as plain identifiers followed by a colon — a shape
 * real file names can't take (":" isn't a legal filename char), so it never
 * collides with a name search. */
const PROPERTY_QUERY = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/;

export type QueryMode = "tag" | "property" | "name";

export function queryMode(query: string): QueryMode {
	if (query.startsWith("#")) return "tag";
	if (PROPERTY_QUERY.test(query)) return "property";
	return "name";
}

/** Stringify a frontmatter value for display/matching. Exported for tests. */
export function formatPropertyValue(v: unknown): string {
	if (v == null) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	return JSON.stringify(v);
}

const NO_FILTER: QueryFilter = { includeFolders: true, includeFiles: true, groupId: null };

/**
 * Ranking bands for a name query, applied before any score.
 *
 * The ordering principle is that **every literal match beats every fuzzy one**.
 * Obsidian's fuzzy matcher will scatter a query's letters across a long string
 * and score the result respectably, so a query for "banán" pulls in
 * "Pohanákový chlé*b* s *a*vokádovo-vaječ*n*ou pom*a*zá*n*kou" — a hit no reader
 * would call a hit. Left to compete on score alone, those crowd out the notes
 * that plainly contain the word. Bands stop that: fuzzy is the last resort, not
 * a peer.
 *
 * Among literal matches, specificity decides: the file's own name first, then
 * its folder path, then its body. `BODY` is used by {@link searchFileContents},
 * whose hits the search bar merges into this same order rather than tacking
 * them on the end.
 */
export const RANK = {
	NAME_PREFIX: 5,
	NAME_WORD: 4,
	NAME_SUBSTRING: 3,
	PATH: 2,
	BODY: 1,
	FUZZY_NAME: 0,
} as const;

/**
 * Run a synchronous vault query (tag / property / name+path). Content search is
 * separate (see searchFileContents) because it needs async file reads.
 */
export function runQuery(
	app: App,
	query: string,
	opts: { filter?: QueryFilter; limit: number },
): QueryHit[] {
	const filter = opts.filter ?? NO_FILTER;
	const q = query.trim();
	if (q.startsWith("#")) return searchByTag(app, q.slice(1), opts.limit);
	const property = PROPERTY_QUERY.exec(q);
	if (property) return searchByProperty(app, property[1], property[2], opts.limit);
	return searchByName(app, q, filter, opts.limit);
}

/**
 * Count the files matching a vault query, using the same tag / property / name
 * dispatch as {@link runQuery} but without scoring, sorting or a result cap — so
 * it suits a stat tile that only needs the total. A blank query counts 0 (not
 * the whole vault), so an unconfigured custom stat doesn't read as "everything".
 */
export function countQuery(app: App, query: string): number {
	const q = query.trim();
	if (!q) return 0;
	if (q.startsWith("#")) return countByTag(app, q.slice(1));
	const property = PROPERTY_QUERY.exec(q);
	if (property) return countByProperty(app, property[1], property[2]);
	return countByName(app, q);
}

function countByName(app: App, query: string): number {
	const fuzzy = prepareFuzzySearch(query);
	const q = foldForMatch(query);
	let n = 0;
	for (const f of app.vault.getAllLoadedFiles()) {
		if (f instanceof TFolder && f.path === "/") continue;
		const displayName = f instanceof TFile ? f.basename : f.name;
		// Same predicate as searchByName, so a stat tile counts exactly what the
		// search bar would list: name literal or fuzzy, path literal only.
		if (
			foldForMatch(displayName).includes(q) ||
			fuzzy(displayName) ||
			foldForMatch(f.path).includes(q)
		) {
			n++;
		}
	}
	return n;
}

function countByTag(app: App, raw: string): number {
	const q = raw.trim().toLowerCase();
	let n = 0;
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) continue;
		const tags = getAllTags(cache);
		if (!tags || tags.length === 0) continue;
		if (!q || tags.some((tag) => tag.slice(1).toLowerCase().includes(q))) n++;
	}
	return n;
}

function countByProperty(app: App, key: string, rawValue: string): number {
	const value = rawValue.trim().toLowerCase();
	let n = 0;
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		const actualKey = Object.keys(fm).find((k) => k.toLowerCase() === key.toLowerCase());
		if (!actualKey || fm[actualKey] == null) continue;

		const values: unknown[] = Array.isArray(fm[actualKey]) ? fm[actualKey] : [fm[actualKey]];
		const matched = value
			? values.some((v) => formatPropertyValue(v).toLowerCase().includes(value))
			: values.length > 0;
		if (matched) n++;
	}
	return n;
}

function searchByName(app: App, query: string, filter: QueryFilter, limit: number): QueryHit[] {
	const candidates: TAbstractFile[] = [];
	for (const f of app.vault.getAllLoadedFiles()) {
		if (f instanceof TFolder) {
			if (filter.includeFolders && f.path !== "/") candidates.push(f);
			continue;
		}
		if (!filter.includeFiles) continue;
		if (filter.groupId && groupForFile(f)?.id !== filter.groupId) continue;
		candidates.push(f);
	}

	if (!query) {
		return candidates
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, limit)
			.map((file) => ({ file, score: 0 }));
	}

	const fuzzy = prepareFuzzySearch(query);
	const q = foldForMatch(query);
	const hits: QueryHit[] = [];

	for (const file of candidates) {
		const displayName = file instanceof TFile ? file.basename : file.name;
		const folded = foldForMatch(displayName);
		const at = folded.indexOf(q);

		if (at >= 0) {
			// The query appears in the name as typed — what the user meant almost
			// every time, whatever score the fuzzy matcher would have given it.
			const rank =
				at === 0
					? RANK.NAME_PREFIX
					: isWordStart(folded, at)
						? RANK.NAME_WORD
						: RANK.NAME_SUBSTRING;
			hits.push({
				file,
				rank,
				// Within a band: an earlier match, then a shorter name, wins.
				score: -at - displayName.length / 1000,
				matches: highlightRanges(displayName, [query]),
			});
			continue;
		}

		// Path matching is literal, never fuzzy. Fuzzy-matching a whole path lets
		// the query's letters scatter across folder names and match nearly
		// everything: searching "banán" turned up "Library/Recipes/Polévka z
		// pečených batátů s cizrnou a kukuřicí" on b-a-n-a-n. Inside a folder name
		// the query still has to appear as typed.
		if (foldForMatch(file.path).includes(q)) {
			hits.push({ file, rank: RANK.PATH, score: 0 });
			continue;
		}

		const onName = fuzzy(displayName);
		if (onName) {
			hits.push({ file, rank: RANK.FUZZY_NAME, score: onName.score, matches: onName.matches });
		}
	}

	return sortByRank(hits).slice(0, limit);
}

/** Whether the match at `at` starts a word, so "nut" ranks higher in
 * "Coco nut" than in "Doughnut". */
function isWordStart(folded: string, at: number): boolean {
	return !/[a-z0-9]/.test(folded[at - 1] ?? "");
}

/** Order hits by rank band, then by score within the band, then by name so the
 * list is stable between renders. Sorts in place and returns the same array. */
export function sortByRank(hits: QueryHit[]): QueryHit[] {
	return hits.sort(
		(a, b) =>
			(b.rank ?? 0) - (a.rank ?? 0) ||
			b.score - a.score ||
			a.file.name.localeCompare(b.file.name),
	);
}

/**
 * Fold body-content hits into the same order as the name/path hits they arrive
 * after, instead of appending them below everything.
 *
 * Body search is async, so its results land after the instant name results are
 * already on screen. Tacking them on the end put a note that plainly contains
 * the word you typed below every note whose title the fuzzy matcher had merely
 * scattered it across — the exact complaint that motivated the rank bands.
 */
export function mergeRanked(hits: QueryHit[], extra: QueryHit[], limit: number): QueryHit[] {
	return sortByRank([...hits, ...extra]).slice(0, limit);
}

/** How many hits outrank a body match, and so genuinely occupy a result slot
 * ahead of one. Fuzzy name hits sort *below* body hits, so they must not be
 * counted — reserving slots for them is what starved body search of its budget
 * and kept the good matches off the list entirely. */
export function slotsAboveBody(hits: readonly QueryHit[]): number {
	return hits.filter((h) => (h.rank ?? 0) > RANK.BODY).length;
}

function searchByTag(app: App, raw: string, limit: number): QueryHit[] {
	const q = raw.trim().toLowerCase();
	const hits: QueryHit[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) continue;
		const tags = getAllTags(cache);
		if (!tags || tags.length === 0) continue;
		const matched = q ? tags.find((t) => t.slice(1).toLowerCase().includes(q)) : tags[0];
		if (matched) hits.push({ file, score: 0, badge: { icon: "tag", label: matched } });
	}
	hits.sort((a, b) => a.file.name.localeCompare(b.file.name));
	return hits.slice(0, limit);
}

function searchByProperty(app: App, key: string, rawValue: string, limit: number): QueryHit[] {
	const value = rawValue.trim().toLowerCase();
	const hits: QueryHit[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		const actualKey = Object.keys(fm).find((k) => k.toLowerCase() === key.toLowerCase());
		if (!actualKey || fm[actualKey] == null) continue;

		const values: unknown[] = Array.isArray(fm[actualKey]) ? fm[actualKey] : [fm[actualKey]];
		const matched = value
			? values.find((v) => formatPropertyValue(v).toLowerCase().includes(value))
			: values[0];
		if (matched === undefined) continue;
		hits.push({
			file,
			score: 0,
			badge: { icon: "list", label: `${actualKey}: ${formatPropertyValue(matched)}` },
		});
	}
	hits.sort((a, b) => a.file.name.localeCompare(b.file.name));
	return hits.slice(0, limit);
}

/**
 * Folded note bodies (lower-cased, accents stripped, index-aligned with the
 * original), keyed by path. Folding every note on every keystroke was by far the
 * biggest cost of a content search — it allocates a second copy of the whole
 * vault per query — so the result is kept around and a refined query ("meet" →
 * "meeting") re-uses it. Bounded by total characters so a large vault can't grow
 * it without limit, and keyed by mtime so an edited note is re-folded instead of
 * matched against stale text.
 */
const BODY_CACHE_MAX_CHARS = 4_000_000;
const bodyCache = new Map<string, { mtime: number; folded: string }>();
let bodyCacheChars = 0;

/** The folded body of `path`, from the cache when it's still current for
 * `mtime`, otherwise folded now and cached (evicting the coldest entries when
 * that pushes the cache over budget). Exported for tests. */
export function foldedBody(path: string, mtime: number, text: string): string {
	const cached = bodyCache.get(path);
	if (cached && cached.mtime === mtime) {
		// Re-insert so Map's insertion order stays least-recently-used first.
		bodyCache.delete(path);
		bodyCache.set(path, cached);
		return cached.folded;
	}
	const folded = foldForMatch(text);
	if (cached) bodyCacheChars -= cached.folded.length;
	bodyCache.set(path, { mtime, folded });
	bodyCacheChars += folded.length;
	while (bodyCacheChars > BODY_CACHE_MAX_CHARS) {
		const oldest = bodyCache.keys().next();
		// Never evict the entry we're about to return, even if it alone is over
		// budget — otherwise a single huge note would loop forever.
		if (oldest.done || oldest.value === path) break;
		bodyCacheChars -= bodyCache.get(oldest.value)?.folded.length ?? 0;
		bodyCache.delete(oldest.value);
	}
	return folded;
}

/** Drop every cached body. Called on plugin unload so the plugin doesn't leave
 * a copy of the vault behind; also used to isolate tests. */
export function clearContentSearchCache(): void {
	bodyCache.clear();
	bodyCacheChars = 0;
}

/**
 * Full-text search over note bodies. Only runs for plain (name) queries, reads
 * lazily via cachedRead, skips files already matched by name (`exclude`), and
 * stops once `limit` hits are found so a big vault isn't fully read. Each hit's
 * badge is a short snippet around the first match.
 *
 * `shouldStop` is polled once per file: a scan of a large vault outlives the
 * keystroke that started it, so the caller uses this to abandon the walk as
 * soon as the query it belongs to is stale — without it, every keystroke piles
 * another full-vault read onto the ones already running.
 */
export async function searchFileContents(
	app: App,
	query: string,
	opts: { exclude: Set<string>; limit: number; shouldStop?: () => boolean },
): Promise<QueryHit[]> {
	// Folded, so a query typed without diacritics still finds the accented
	// spelling — the same way name matching and Omnisearch behave.
	const needle = foldForMatch(query.trim());
	if (!needle || opts.limit <= 0 || queryMode(query) !== "name") return [];

	const hits: QueryHit[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (opts.shouldStop?.()) break;
		if (opts.exclude.has(file.path)) continue;
		let text: string;
		try {
			text = await app.vault.cachedRead(file);
		} catch {
			continue;
		}
		const idx = foldedBody(file.path, file.stat.mtime, text).indexOf(needle);
		if (idx < 0) continue;
		const { label, matches } = buildExcerpt(text, idx, needle.length);
		hits.push({
			file,
			rank: RANK.BODY,
			score: 0,
			badge: { icon: "file-search", label, matches, excerpt: true },
		});
		if (hits.length >= opts.limit) break;
	}
	return hits;
}
