/**
 * The Periodic Notes integration: everything Hearth knows about the
 * [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes)
 * community plugin (issue #116).
 *
 * Same rule as Dataview, Templater and obsidian-git: **Hearth never does the
 * work itself.** It does not invent a weekly-note convention, and it never
 * writes a periodic note — creation goes through Periodic Notes, so the user's
 * own folder, filename format, template and its `{{monday:…}}`/`{{sunday:…}}`
 * tokens apply exactly as they do from the plugin's own command. The card is a
 * window onto Periodic Notes, not a second implementation of it.
 *
 * The awkward part is that Periodic Notes exists in **two generations**, and a
 * vault may be running either:
 *
 * 1. **0.x** (the version in the community store). Configuration is a plain
 *    object — `settings.weekly = { enabled, format, folder, template }`,
 *    keyed by *periodicity* (`daily`, `weekly`, `monthly`, `quarterly`,
 *    `yearly`). There is no API: you read the settings and resolve the path
 *    yourself, which is what `obsidian-daily-notes-interface` (and so the
 *    Calendar plugin) has always done.
 * 2. **1.0 beta** (BRAT only). Configuration moved into *calendar sets* and
 *    `settings` became a Svelte store, so `settings.weekly` reads `undefined`
 *    there — but the plugin gained real methods keyed by *granularity*
 *    (`day`, `week`, `month`, `quarter`, `year`): `getPeriodicNote`,
 *    `createPeriodicNote`, `openPeriodicNote`.
 *
 * So every lookup here tries the method first and falls back to resolving a
 * path from the 0.x settings, and every member is declared optional and
 * checked before use: a build of Periodic Notes that renamed something leaves
 * the card showing its empty state, and never throws inside a render.
 *
 * Whether a granularity is *configured at all* is answered the same
 * version-agnostic way — by asking whether the plugin registered a command for
 * it, which both generations do only for the note types the user turned on.
 *
 * The pure helpers at the bottom (settings parsing, path building, command
 * matching) carry no Obsidian dependency and are unit-tested in
 * `test/periodic.test.ts`.
 */
import { moment as createMoment, TFile, type App } from "obsidian";

/** The community-plugin id Periodic Notes registers itself under. */
export const PERIODIC_NOTES_PLUGIN_ID = "periodic-notes";

/**
 * A period a note can cover. These are Periodic Notes 1.0's own granularity
 * strings, which is also what its methods take; the 0.x settings keys
 * (`daily`, `weekly`, …) are mapped from them in {@link PERIODICITY_KEYS}.
 */
export type Granularity = "day" | "week" | "month" | "quarter" | "year";

/** Every granularity, in period order — drives the card's Period dropdown. */
export const GRANULARITIES: readonly Granularity[] = ["day", "week", "month", "quarter", "year"];

/** True for a string that names a granularity (validates persisted card data). */
export function isGranularity(value: unknown): value is Granularity {
	return typeof value === "string" && (GRANULARITIES as readonly string[]).includes(value);
}

/** The 0.x settings key each granularity is stored under. */
export const PERIODICITY_KEYS: Record<Granularity, string> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

/** Periodic Notes' own default filename formats, used when a granularity is
 * enabled but its format was left empty. */
export const DEFAULT_PERIODIC_FORMATS: Record<Granularity, string> = {
	day: "YYYY-MM-DD",
	week: "gggg-[W]ww",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

/** What Hearth needs to resolve one granularity's note, as read from the 0.x
 * settings. Both strings are normalized: the format is never empty, and the
 * folder carries no leading or trailing slash. */
export interface PeriodicConfig {
	/** moment.js filename format, e.g. `gggg-[W]ww`. May contain `/`. */
	format: string;
	/** Folder the notes live in; "" for the vault root. */
	folder: string;
	/** Vault path of the template applied to new notes, when one is set. */
	template?: string;
}

/**
 * The only thing this module needs from a date: the ability to format itself.
 * Declared structurally so a moment from anywhere (Obsidian's bundled copy, a
 * card's own shim) satisfies it without an `any` in sight.
 */
export interface PeriodicDate {
	format(fmt?: string): string;
}

const moment = createMoment as unknown as (input?: Date | number) => PeriodicDate;

/** The current moment, as a date this module can format. */
export function now(): PeriodicDate {
	return moment();
}

/** The slice of the Periodic Notes plugin instance Hearth touches. Every
 * member is optional — see the module comment. */
export interface PeriodicNotesPlugin {
	/** 0.x: a plain object keyed by periodicity. 1.0: a Svelte store, which
	 * carries no periodicity keys, so the parser simply finds nothing. */
	settings?: unknown;
	/** 1.0 only: the note for a date, or null when it hasn't been made yet. */
	getPeriodicNote?(granularity: Granularity, date: PeriodicDate): TFile | null;
	/** 1.0 only: create the note from the configured template and return it. */
	createPeriodicNote?(granularity: Granularity, date: PeriodicDate): Promise<TFile>;
}

/** Reach the running Periodic Notes plugin, or null when it isn't installed or
 * enabled. Never throws: `plugins.plugins` is an Obsidian internal and this
 * runs inside card renders. */
export function getPeriodicNotesPlugin(app: App): PeriodicNotesPlugin | null {
	try {
		return (
			(app.plugins?.plugins?.[PERIODIC_NOTES_PLUGIN_ID] as PeriodicNotesPlugin | undefined) ??
			null
		);
	} catch {
		return null;
	}
}

/** Whether Periodic Notes is enabled right now. */
export function isPeriodicNotesEnabled(app: App): boolean {
	return getPeriodicNotesPlugin(app) !== null;
}

/** Every command id the app has registered. Isolated (and defensive) because
 * `listCommands` is the one thing here that reads the whole command registry. */
function commandIds(app: App): string[] {
	try {
		return app.commands?.listCommands?.().map((cmd) => cmd.id) ?? [];
	} catch {
		return [];
	}
}

/** The 0.x configuration for one granularity, or null when Periodic Notes is
 * missing, running 1.0 (where the settings live elsewhere), or has that note
 * type switched off. */
export function periodicConfig(app: App, granularity: Granularity): PeriodicConfig | null {
	const plugin = getPeriodicNotesPlugin(app);
	return plugin ? periodicConfigFrom(plugin.settings, granularity) : null;
}

/**
 * Whether the user has this note type turned on in Periodic Notes.
 *
 * Read from the 0.x settings where they are there, and otherwise from the
 * plugin's own commands — the one signal both generations share, since each
 * registers an "open this week's note"-style command only for the
 * granularities that are enabled. Between them, a note type the user has
 * switched off is told apart from one that is on but has no note yet.
 */
export function isGranularityEnabled(app: App, granularity: Granularity): boolean {
	if (!isPeriodicNotesEnabled(app)) return false;
	// The 0.x settings answer this with one object read, so they go first; the
	// command scan is what covers 1.0, where the configuration is out of reach.
	if (periodicConfig(app, granularity)) return true;
	return periodicOpenCommandId(commandIds(app), granularity) !== null;
}

/**
 * The existing note covering `date`, or null when there isn't one.
 *
 * 1.0's own lookup is preferred — it reads the plugin's cache, so it finds a
 * note whose name was written under a different locale than the one moment is
 * running in now (the hazard behind issue #229, which bites weekly notes
 * hardest: `ww` is a locale-relative week number). On 0.x there is no cache to
 * ask, so the path is formatted and looked up directly.
 */
export function findPeriodicNote(
	app: App,
	granularity: Granularity,
	date: PeriodicDate,
): TFile | null {
	const plugin = getPeriodicNotesPlugin(app);
	if (!plugin) return null;
	if (typeof plugin.getPeriodicNote === "function") {
		try {
			const found = plugin.getPeriodicNote(granularity, date);
			if (found instanceof TFile) return found;
		} catch {
			// A 1.0 build that changed this signature falls through to the path.
		}
	}
	const path = periodicNotePathFor(app, granularity, date);
	if (!path) return null;
	const file = app.vault.getAbstractFileByPath(path);
	return file instanceof TFile ? file : null;
}

/** Where the note for `date` would live, or null when the configuration can't
 * be read (Periodic Notes 1.0 keeps it out of reach). Used to watch a note that
 * doesn't exist yet, so the card redraws the moment it is created. */
export function periodicNotePathFor(
	app: App,
	granularity: Granularity,
	date: PeriodicDate,
): string | null {
	const config = periodicConfig(app, granularity);
	return config ? periodicNotePath(config, date) : null;
}

/**
 * Have Periodic Notes make the note for `date`, applying its own template.
 *
 * Returns the new file on 1.0, where the plugin exposes a method for it. On
 * 0.x there is no such method, so the plugin's own command is run instead —
 * which creates *and* opens the note — and this returns null with `ran` true.
 * Returns `{ ran: false }` when Periodic Notes offered no way to do either.
 */
export async function createPeriodicNote(
	app: App,
	granularity: Granularity,
	date: PeriodicDate,
): Promise<{ ran: boolean; file: TFile | null }> {
	const plugin = getPeriodicNotesPlugin(app);
	if (!plugin) return { ran: false, file: null };

	// Invoked as a member rather than through a saved reference: the method
	// reads the plugin's own state internally, so it keeps its receiver.
	if (typeof plugin.createPeriodicNote === "function") {
		try {
			const file = await plugin.createPeriodicNote(granularity, date);
			if (file instanceof TFile) return { ran: true, file };
		} catch {
			// Fall through to the command: a 1.0 build whose method threw (or
			// changed shape) can still have a working command.
		}
	}

	const command = periodicOpenCommandId(commandIds(app), granularity);
	if (!command) return { ran: false, file: null };
	try {
		return { ran: app.commands.executeCommandById(command) === true, file: null };
	} catch {
		return { ran: false, file: null };
	}
}


// ---- Pure helpers -------------------------------------------------------

/** Strip a folder setting down to a plain vault-relative path. */
function normalizeFolder(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, "");
}

/**
 * Read one granularity's configuration out of a Periodic Notes 0.x settings
 * object, or null when it isn't there or is switched off.
 *
 * Everything is treated as untrusted: `settings` is another plugin's data (and
 * on 1.0 it is a Svelte store, which carries none of these keys), so a missing,
 * mistyped or renamed field means "not configured" rather than a broken card.
 * An `enabled` flag is honoured only when it is explicitly `false`, so a shape
 * that never wrote the flag still resolves.
 */
export function periodicConfigFrom(
	settings: unknown,
	granularity: Granularity,
): PeriodicConfig | null {
	if (!settings || typeof settings !== "object") return null;
	const entry = (settings as Record<string, unknown>)[PERIODICITY_KEYS[granularity]];
	if (!entry || typeof entry !== "object") return null;
	const config = entry as { enabled?: unknown; format?: unknown; folder?: unknown; template?: unknown };
	if (config.enabled === false) return null;
	const format =
		(typeof config.format === "string" ? config.format.trim() : "") ||
		DEFAULT_PERIODIC_FORMATS[granularity];
	const folder = typeof config.folder === "string" ? normalizeFolder(config.folder) : "";
	const template = typeof config.template === "string" ? config.template.trim() : "";
	return { format, folder, ...(template ? { template } : {}) };
}

/** The vault path of the note covering `date` under `config`. The format may
 * itself contain folders (Periodic Notes allows `[journal]/gggg/[W]ww`), which
 * is why it is joined rather than sanitized. */
export function periodicNotePath(config: PeriodicConfig, date: PeriodicDate): string {
	const folder = normalizeFolder(config.folder);
	return `${folder ? `${folder}/` : ""}${date.format(config.format)}.md`;
}

/** The words a command id uses for each granularity, across both generations. */
const GRANULARITY_WORDS: Record<Granularity, string[]> = {
	day: ["daily", "day"],
	week: ["weekly", "week"],
	month: ["monthly", "month"],
	quarter: ["quarterly", "quarter"],
	year: ["yearly", "year"],
};

/**
 * Periodic Notes' own "open this period's note" command, picked out of the
 * app's command ids — the version-agnostic way to both detect that a note type
 * is enabled and act on it.
 *
 * Matched rather than hardcoded because the two generations name these
 * differently (`periodic-notes:open-weekly-note` against a granularity-derived
 * id), and because the navigation commands sit right beside them: anything
 * that steps to another period, or that names the fiscal year (1.0 only, and
 * not a granularity Hearth offers), is excluded.
 */
export function periodicOpenCommandId(
	ids: readonly string[],
	granularity: Granularity,
): string | null {
	const words = GRANULARITY_WORDS[granularity];
	const candidates = ids.filter((id) => {
		if (!id.startsWith(`${PERIODIC_NOTES_PLUGIN_ID}:`)) return false;
		const rest = id.slice(PERIODIC_NOTES_PLUGIN_ID.length + 1);
		if (/\b(next|prev|previous)\b|next-|prev-|fiscal/.test(rest)) return false;
		return words.some((word) => rest.includes(word));
	});
	// "open" first when the build spells it out, so an id that merely mentions
	// the period (a date switcher, say) never wins over the real command.
	return candidates.find((id) => id.includes("open")) ?? candidates[0] ?? null;
}
