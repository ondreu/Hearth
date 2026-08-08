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
 * Ranking bands for a name query, applied before any score. The point is that a
 * literal hit in the file's own name always beats a fuzzy one, and a fuzzy hit
 * always beats one that only landed somewhere in the folder path — the fuzzy
 * matcher happily scatters a query's letters across a long string, so without
 * bands its scores put near-random matches among the obvious ones.
 */
const TIER_PREFIX = 4;
const TIER_WORD = 3;
const TIER_SUBSTRING = 2;
const TIER_FUZZY = 1;
const TIER_PATH = 0;

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
	const ranked: { hit: QueryHit; tier: number }[] = [];

	for (const file of candidates) {
		const displayName = file instanceof TFile ? file.basename : file.name;
		const folded = foldForMatch(displayName);
		const at = folded.indexOf(q);

		if (at >= 0) {
			// The query appears in the name as typed. That's what the user meant
			// almost every time, so it outranks anything fuzzy regardless of what
			// score the fuzzy matcher would have given it.
			const tier = at === 0 ? TIER_PREFIX : isWordStart(folded, at) ? TIER_WORD : TIER_SUBSTRING;
			// Within a tier: an earlier match, then a shorter name, wins.
			ranked.push({
				tier,
				hit: { file, score: -at - displayName.length / 1000, matches: highlightRanges(displayName, [query]) },
			});
			continue;
		}

		const onName = fuzzy(displayName);
		if (onName) {
			ranked.push({ tier: TIER_FUZZY, hit: { file, score: onName.score, matches: onName.matches } });
			continue;
		}

		// Path matching is literal, never fuzzy. Fuzzy-matching a whole path lets
		// the query's letters scatter across folder names and match nearly
		// everything: searching "banán" turned up "Library/Recipes/Polévka z
		// pečených batátů s cizrnou a kukuřicí" on b-a-n-a-n, ranked alongside
		// the notes actually called "Banánové…". Inside a folder name the query
		// still has to appear as typed.
		if (foldForMatch(file.path).includes(q)) {
			ranked.push({ tier: TIER_PATH, hit: { file, score: 0 } });
		}
	}

	ranked.sort(
		(a, b) =>
			b.tier - a.tier ||
			b.hit.score - a.hit.score ||
			a.hit.file.name.localeCompare(b.hit.file.name),
	);
	return ranked.slice(0, limit).map((r) => r.hit);
}

/** Whether the match at `at` starts a word, so "nut" ranks higher in
 * "Coco nut" than in "Doughnut". */
function isWordStart(folded: string, at: number): boolean {
	return !/[a-z0-9]/.test(folded[at - 1] ?? "");
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
			score: 0,
			badge: { icon: "file-search", label, matches, excerpt: true },
		});
		if (hits.length >= opts.limit) break;
	}
	return hits;
}
