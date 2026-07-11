import { App, getAllTags, prepareFuzzySearch, TAbstractFile, TFile, TFolder } from "obsidian";
import { groupForFile } from "./filetypes";

/** A single query result. `matches` holds char ranges into the display name for
 * highlighting (name/path matches only). `badge` is shown instead of the folder
 * path when a hit matched via a tag, property or note body. */
export interface QueryHit {
	file: TAbstractFile;
	score: number;
	badge?: { icon: string; label: string };
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

/** Stringify a frontmatter value for display/matching. */
function formatPropertyValue(v: unknown): string {
	if (v == null) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	return JSON.stringify(v);
}

const NO_FILTER: QueryFilter = { includeFolders: true, includeFiles: true, groupId: null };

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
	const hits: QueryHit[] = [];
	for (const file of candidates) {
		const displayName = file instanceof TFile ? file.basename : file.name;
		const onName = fuzzy(displayName);
		const match = onName ?? fuzzy(file.path);
		if (match) {
			hits.push({
				file,
				score: match.score,
				// Highlight ranges only apply when the name itself matched.
				matches: onName ? match.matches : undefined,
			});
		}
	}
	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, limit);
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
 * Full-text search over note bodies. Only runs for plain (name) queries, reads
 * lazily via cachedRead, skips files already matched by name (`exclude`), and
 * stops once `limit` hits are found so a big vault isn't fully read. Each hit's
 * badge is a short snippet around the first match.
 */
export async function searchFileContents(
	app: App,
	query: string,
	opts: { exclude: Set<string>; limit: number },
): Promise<QueryHit[]> {
	const needle = query.trim().toLowerCase();
	if (!needle || queryMode(query) !== "name") return [];

	const hits: QueryHit[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (opts.exclude.has(file.path)) continue;
		let text: string;
		try {
			text = await app.vault.cachedRead(file);
		} catch {
			continue;
		}
		const idx = text.toLowerCase().indexOf(needle);
		if (idx < 0) continue;
		hits.push({ file, score: 0, badge: { icon: "file-search", label: snippet(text, idx, needle.length) } });
		if (hits.length >= opts.limit) break;
	}
	return hits;
}

/** A one-line snippet of `text` around [idx, idx+len], collapsed to single spaces. */
function snippet(text: string, idx: number, len: number): string {
	const start = Math.max(0, idx - 30);
	const end = Math.min(text.length, idx + len + 40);
	let s = text.slice(start, end).replace(/\s+/g, " ").trim();
	if (start > 0) s = `…${s}`;
	if (end < text.length) s = `${s}…`;
	return s;
}
