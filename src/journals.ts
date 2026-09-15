/**
 * The Journals integration: everything Hearth knows about the
 * [Journals](https://github.com/srg-kostyrko/obsidian-journal) community
 * plugin (issue #318).
 *
 * Journals covers the same ground as Periodic Notes — a note per day, week,
 * month, quarter or year, from your own folder, name template and note
 * template — so it feeds the same card rather than a second one. The
 * Periodic note card gained a **Source** dropdown; this module is what sits
 * behind the Journals half of it, exactly as `periodic.ts` sits behind the
 * Periodic Notes half.
 *
 * Same rule as every other integration: **Hearth never does the work
 * itself.** It does not resolve a path, read the plugin's settings or write a
 * note; it asks Journals for the note covering *now* and renders the answer.
 *
 * Two things about Journals shape this module.
 *
 * 1. **There is no "the" weekly note.** A vault can hold several journals of
 *    the same cadence — a personal daily and a work daily — so the card asks
 *    for a journal *by name* rather than for a period. That also means the
 *    plugin's `custom` cadence (every N days/weeks/…) needs no special case:
 *    the journal already knows what period it writes, and Hearth never has to
 *    name it.
 * 2. **The whole API is async**, and card renders are synchronous. So every
 *    lookup goes through the small stale-while-revalidate cache below:
 *    `peekNote` answers instantly from what was last resolved, and the card
 *    kicks a refresh and redraws itself when a newer answer lands. See
 *    {@link peekNote}.
 *
 * Every member of the API is declared optional and checked before use, the
 * same defensiveness `periodic.ts` applies: a Journals build that renames
 * something leaves the card in its empty state rather than throwing inside a
 * render.
 *
 * The pure helpers at the bottom (cache keying and entry staleness) carry no
 * Obsidian dependency and are unit-tested in `test/journals.test.ts`.
 */
import { TFile, type App } from "obsidian";

/** The community-plugin id Journals registers itself under. */
export const JOURNALS_PLUGIN_ID = "journals";

/**
 * How long a resolved answer is served before a background refresh is kicked
 * off behind it.
 *
 * The file a note lives at is re-checked against the vault on every render, so
 * this window only covers changes to the journal's *configuration* — a renamed
 * folder or an edited name template, neither of which raises an event Hearth
 * can hear. A minute keeps that self-healing without asking the plugin
 * anything on a board that is merely redrawing.
 */
export const JOURNAL_CACHE_TTL_MS = 60_000;

/** What Journals says a journal is. Mirrors its `JournalInfo`, minus the
 * fields Hearth has no use for. */
export interface JournalInfo {
	/** The journal's name, which is also its selector. */
	readonly name: string;
	/** The shelf it sits on, or null when it sits on none. */
	readonly shelf?: string | null;
	/** Its cadence. `custom` is "every N days/weeks/…", which Hearth shows but
	 * never has to name. */
	readonly write?: { readonly type?: string };
}

/** One journal's note for a period — on disk, or where it would go. Mirrors
 * Journals' `JournalNote`. */
export interface JournalNote {
	/** Where the note is, or would be created. null when none can be placed. */
	readonly path: string | null;
	/** null until the note is created. */
	readonly file: TFile | null;
	/** The period's first day, `YYYY-MM-DD`. */
	readonly date?: string;
	/** The day the period's name is formatted from — see the API docs; it
	 * differs from `date` only for weeks. */
	readonly displayDate?: string;
}

/** The slice of Journals' public API Hearth touches. Every member optional:
 * see the module comment. */
export interface JournalsApi {
	readonly apiVersion?: number;
	listJournals?(selector?: unknown): Promise<readonly JournalInfo[]>;
	journalInfo?(name: string): Promise<JournalInfo | null>;
	notesFor?(selector: unknown, date: unknown): Promise<readonly JournalNote[]>;
	ensureNote?(
		selector: unknown,
		date: unknown,
		options?: { readonly prompt?: boolean },
	): Promise<{ readonly note: JournalNote; readonly created: boolean }>;
}

/**
 * Reach the running Journals API, or null when the plugin isn't installed,
 * isn't enabled, or predates the release that added the API.
 *
 * Resolved at every point of use rather than cached: Journals' own docs are
 * explicit that a plugin reload replaces the object and there is no readiness
 * event, so a held reference goes stale. Never throws — `plugins.plugins` is
 * an Obsidian internal and this runs inside card renders.
 */
export function getJournalsApi(app: App): JournalsApi | null {
	try {
		const plugin = app.plugins?.plugins?.[JOURNALS_PLUGIN_ID] as
			| { api?: JournalsApi }
			| undefined;
		return plugin?.api ?? null;
	} catch {
		return null;
	}
}

/** Whether Journals is installed, enabled, and exposing its API right now. */
export function isJournalsEnabled(app: App): boolean {
	return getJournalsApi(app) !== null;
}

/**
 * What another plugin handed back, as a list Hearth can walk.
 *
 * `Array.isArray` widens a readonly array to `any[]`, which would quietly undo
 * the typing on everything downstream of a value that is untrusted precisely
 * because it crossed a plugin boundary. This keeps the element type while
 * still tolerating an answer that isn't a list at all.
 */
function asList<T>(value: readonly T[] | undefined): readonly T[] {
	return Array.isArray(value) ? (value as readonly T[]) : [];
}

/**
 * Every journal in the vault, or an empty list when Journals isn't there.
 * Feeds the card editor's journal dropdown.
 */
export async function listJournals(app: App): Promise<readonly JournalInfo[]> {
	const api = getJournalsApi(app);
	if (typeof api?.listJournals !== "function") return [];
	try {
		const journals = asList(await api.listJournals());
		return journals.filter((j) => typeof j?.name === "string");
	} catch {
		return [];
	}
}


// ---- The note for now ---------------------------------------------------

/**
 * What Hearth knows about one journal's current note. `missing` is the
 * answer's own state, not the file's: a journal that no longer exists reads
 * differently from one whose note simply hasn't been written yet.
 */
export interface JournalLookup {
	/** The note's path, or where it would be created. null when Journals
	 * couldn't place one (an out-of-timeline date, say). */
	path: string | null;
	/** True when the named journal isn't in the vault any more — renamed,
	 * deleted, or never there. The card says so rather than showing "no note
	 * yet" for a journal that can never have one. */
	unknownJournal: boolean;
}

interface CacheEntry extends JournalLookup {
	/** When this answer was resolved, for {@link isStale}. */
	at: number;
}

const cache = new Map<string, CacheEntry>();

/** Keys with a lookup in flight. A board can render the same card many times
 * in a frame — and several cards can follow one journal — so this collapses
 * them into one question to Journals rather than one per render. */
const inFlight = new Set<string>();

/** The cache key for one journal's note on one day. The day is part of it so
 * the entry expires by itself when the period rolls over — a stale answer
 * can't outlive the date it was resolved for. */
export function cacheKey(journal: string, day: string): string {
	return `${journal}\u0000${day}`;
}

/** Whether an answer resolved at `at` is past {@link JOURNAL_CACHE_TTL_MS}. */
export function isStale(at: number, now: number): boolean {
	return now - at >= JOURNAL_CACHE_TTL_MS;
}

/** Today as Journals spells dates, and as the cache keys them. */
export function today(): string {
	const now = new Date();
	const month = `${now.getMonth() + 1}`.padStart(2, "0");
	const day = `${now.getDate()}`.padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * What Hearth last learned about `journal`'s current note, without waiting.
 *
 * Returns null the first time a card asks, and the last answer after that —
 * stale-while-revalidate, because `render` is synchronous and a card that
 * blanked itself on every redraw while a promise settled would flicker on
 * every keystroke in an editable embed.
 *
 * Either way a refresh is started when what's cached is missing or past its
 * TTL, and `onResolved` is called **only when the answer actually changed**,
 * so the card redraws once on real news and never loops on its own redraw.
 */
export function peekNote(
	app: App,
	journal: string,
	onResolved: () => void,
): JournalLookup | null {
	const key = cacheKey(journal, today());
	const entry = cache.get(key);
	if (!entry || isStale(entry.at, Date.now())) void refresh(app, key, journal, entry, onResolved);
	return entry ? { path: entry.path, unknownJournal: entry.unknownJournal } : null;
}

/**
 * The path last resolved for `journal`'s current note, without asking
 * Journals anything.
 *
 * Separate from {@link peekNote} because the card's liveness re-reads the
 * watched path on every vault event: that is a question about what Hearth
 * already knows, and must not start a refresh — let alone one per event.
 */
export function cachedPath(journal: string): string | null {
	return cache.get(cacheKey(journal, today()))?.path ?? null;
}

/** Resolve one journal's current note and cache it, notifying only on news. */
async function refresh(
	app: App,
	key: string,
	journal: string,
	previous: CacheEntry | undefined,
	onResolved: () => void,
): Promise<void> {
	if (inFlight.has(key)) return;
	inFlight.add(key);
	let resolved: JournalLookup | null = null;
	try {
		resolved = await lookup(app, journal);
	} finally {
		inFlight.delete(key);
	}

	// A lookup that couldn't reach Journals at all leaves what's cached alone:
	// the plugin is mid-reload, and the previous answer is still the best one.
	if (!resolved) return;

	cache.set(key, { ...resolved, at: Date.now() });
	const changed =
		!previous ||
		previous.path !== resolved.path ||
		previous.unknownJournal !== resolved.unknownJournal;
	if (changed) onResolved();
}

/** Ask Journals for `journal`'s note covering today, or null when it can't be
 * asked (not installed, or an API that threw). */
async function lookup(app: App, journal: string): Promise<JournalLookup | null> {
	const api = getJournalsApi(app);
	if (typeof api?.notesFor !== "function") return null;
	try {
		// Reads fan out: a selector can match several journals, but this one
		// names exactly one, so there is at most a single note to take.
		const note = asList(await api.notesFor(journal, "today"))[0];
		if (!note) {
			// No note *and* no journal of that name are the same empty array, so
			// the difference is asked for separately — only when it matters.
			return { path: null, unknownJournal: await isUnknown(api, journal) };
		}
		return { path: typeof note.path === "string" ? note.path : null, unknownJournal: false };
	} catch (err) {
		// `journal-not-found` is Journals telling us the card's journal is gone,
		// which is an answer; anything else is a failure, and keeps the old one.
		return errorCode(err) === "journal-not-found"
			? { path: null, unknownJournal: true }
			: null;
	}
}

/** Whether Journals has no journal by this name. */
async function isUnknown(api: JournalsApi, journal: string): Promise<boolean> {
	if (typeof api.journalInfo !== "function") return false;
	try {
		return (await api.journalInfo(journal)) === null;
	} catch {
		return false;
	}
}

/** The `code` off a Journals API error, when it carries one. */
export function errorCode(err: unknown): string | null {
	if (!err || typeof err !== "object") return null;
	const code = (err as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

/**
 * Have Journals write `journal`'s note for today, applying its own template
 * and asking its own creation prompts, and return the file.
 *
 * `ensureNote` is idempotent and does not open what it creates, so Hearth
 * opens it the way it opens everything else and redraws the card itself.
 */
export async function createJournalNote(app: App, journal: string): Promise<TFile | null> {
	const api = getJournalsApi(app);
	if (typeof api?.ensureNote !== "function") return null;
	try {
		const note = (await api.ensureNote(journal, "today"))?.note;
		const file = note?.file;
		// Where the note landed is the answer the cache was missing, and the
		// card is about to redraw: record it rather than dropping the entry, so
		// the redraw shows the new note instead of "looking it up" first.
		if (typeof note?.path === "string") remember(journal, note.path);
		else forget(journal);
		return file instanceof TFile ? file : null;
	} catch {
		return null;
	}
}

/** Record where a journal's current note is, for a path Hearth has just been
 * told authoritatively — the note Journals reports having written. */
export function remember(journal: string, path: string): void {
	cache.set(cacheKey(journal, today()), { path, unknownJournal: false, at: Date.now() });
}

/** Drop what's cached for a journal, so the next peek resolves afresh. Called
 * after a write, and when the card's journal changes in the editor. */
export function forget(journal: string): void {
	const key = cacheKey(journal, today());
	cache.delete(key);
}

/** Drop everything. Exported for tests, which must not leak cached answers
 * between cases. */
export function forgetAll(): void {
	cache.clear();
}
