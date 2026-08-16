/**
 * The Templater integration: everything Hearth knows about the
 * [Templater](https://github.com/SilentVoid13/Templater) community plugin.
 *
 * Same rule as Dataview, Datacore and obsidian-git: **Hearth never does the
 * work itself.** It does not parse `<% tp.* %>` syntax, it does not run user
 * scripts, and it does not write the note. A tile calls
 * `create_new_note_from_template` on the running Templater instance, so the
 * user's own templates folder, user-script functions, cursor placement,
 * `tp.system.prompt()` dialogs and startup hooks all behave exactly as they do
 * when the same template is invoked from Templater's own command. The card is a
 * launchpad onto Templater, not a second templating engine.
 *
 * Two consequences shape this file:
 *
 * 1. **Everything is optional.** Templater exposes no versioned `api` object;
 *    what Hearth calls are the plugin instance's own public members
 *    (`templater`, `editor_handler`, `settings`). They are stable in practice —
 *    its own commands call the same ones — but they are not a contract, so
 *    every member is declared optional and every call site checks for the
 *    function before using it. A build of Templater that renamed something
 *    disables the card; it never throws inside a dashboard render.
 * 2. **Hearth decides where the note opens, Templater decides what's in it.**
 *    `create_new_note_from_template(…, open_new_note = true)` opens the note in
 *    `getLeaf(false)` — the *active* leaf, which on a dashboard click is the
 *    Hearth tab itself, so the board would replace itself with the new note
 *    regardless of the user's "Open notes in" setting. Hearth therefore always
 *    passes `false` and opens the result through its own opener (#106), then
 *    asks Templater to run its cursor jump so `<% tp.file.cursor() %>` still
 *    works.
 *
 * The pure helpers at the bottom (filename patterns, folder normalization)
 * carry no Obsidian dependency beyond moment and are unit-tested in
 * `test/templater.test.ts`.
 */
import { moment as createMoment, TFile, type App, type TFolder } from "obsidian";
import { sanitizeFilename } from "./eventnote";

/** The community-plugin id Templater registers itself under. */
export const TEMPLATER_PLUGIN_ID = "templater-obsidian";

/** The slice of `Templater` (the plugin's core object) Hearth calls. */
interface TemplaterCore {
	/**
	 * Create a note from `template` and run it through Templater's parser.
	 *
	 * `folder` may be a `TFolder` or a plain vault-relative path string;
	 * omitting it falls back to Obsidian's "Default location for new notes".
	 * `filename` is used verbatim (no extension) and de-duplicated by
	 * `vault.getAvailablePath`, so two clicks give "Note" and "Note 1" rather
	 * than one overwritten note. Resolves to `undefined` when Templater
	 * cancelled — a parse error, or a `tp.system.prompt()` the user dismissed.
	 */
	create_new_note_from_template?(
		template: TFile | string,
		folder?: TFolder | string,
		filename?: string,
		open_new_note?: boolean,
	): Promise<TFile | undefined>;
}

/** The slice of Templater's editor handler Hearth calls. */
interface TemplaterEditorHandler {
	/** Move the cursor to the next `<% tp.file.cursor() %>` marker in `file`.
	 * With `auto_jump` set, Templater skips it unless the user has its
	 * "Automatic jump to cursor" setting on — which is the behaviour its own
	 * create-from-template command has, so Hearth passes the same. */
	jump_to_next_cursor_location?(file?: TFile | null, auto_jump?: boolean): Promise<void>;
}

/** The Templater plugin instance, as far as Hearth is concerned. */
export interface TemplaterPlugin {
	templater?: TemplaterCore;
	editor_handler?: TemplaterEditorHandler;
	settings?: {
		/** Templater's own "Template folder location". Empty when unset, which
		 * for Templater means "every file is a template". */
		templates_folder?: string;
	};
}

/** Reach the running Templater plugin, or null when it isn't installed or
 * enabled. Never throws: `plugins.plugins` is an Obsidian internal and this
 * runs inside card renders and the settings pane. */
export function getTemplaterPlugin(app: App): TemplaterPlugin | null {
	try {
		return (app.plugins?.plugins?.[TEMPLATER_PLUGIN_ID] as TemplaterPlugin | undefined) ?? null;
	} catch {
		return null;
	}
}

/** Whether Templater is enabled and the one method Hearth needs is reachable
 * right now. */
export function isTemplaterAvailable(app: App): boolean {
	return typeof getTemplaterPlugin(app)?.templater?.create_new_note_from_template === "function";
}

/** Templater's configured template folder, normalized (no leading/trailing
 * slash). Empty when Templater is missing or the setting is unset. */
export function templaterTemplatesFolder(app: App): string {
	return normalizeFolderPath(getTemplaterPlugin(app)?.settings?.templates_folder ?? "");
}

/** Whether `file` sits in (or under) Templater's template folder. Always true
 * when no folder is configured — that is what Templater itself does, since an
 * unset folder means any file may be used as a template. */
export function isTemplaterTemplate(app: App, file: TFile): boolean {
	if (file.extension !== "md") return false;
	const folder = templaterTemplatesFolder(app);
	return !folder || file.path.startsWith(`${folder}/`);
}

/** Every file Templater would offer as a template, in vault order. */
export function templaterTemplateFiles(app: App): TFile[] {
	try {
		return app.vault.getMarkdownFiles().filter((file) => isTemplaterTemplate(app, file));
	} catch {
		return [];
	}
}

/** Resolve a stored template path to a file, tolerating a missing `.md` — the
 * same courtesy the daily-note and event-note template settings extend. */
export function resolveTemplateFile(app: App, path: string): TFile | null {
	const trimmed = (path || "").trim();
	if (!trimmed) return null;
	const direct = app.vault.getAbstractFileByPath(trimmed);
	if (direct instanceof TFile) return direct;
	const withExt = app.vault.getAbstractFileByPath(`${trimmed}.md`);
	return withExt instanceof TFile ? withExt : null;
}

/** What one tile asks Templater for. */
export interface TemplaterRunRequest {
	template: TFile;
	/** Vault-relative destination folder; "" hands the choice to Templater (and
	 * so to Obsidian's "Default location for new notes"). */
	folder: string;
	/** Filename without extension; "" lets Templater name it "Untitled". */
	filename: string;
}

/**
 * Run one template through Templater and return the note it made, or null when
 * Templater is unavailable, refused, or threw.
 *
 * A `null` return is not necessarily an error the user needs shouting about:
 * Templater cancels (and reports, through its own error notice) on a parse
 * failure or a dismissed `tp.system.prompt()`. The caller decides what to say.
 */
export async function createNoteFromTemplate(
	app: App,
	request: TemplaterRunRequest,
): Promise<TFile | null> {
	const core = getTemplaterPlugin(app)?.templater;
	// Invoked as a member rather than through a saved reference: the method reads
	// `this.plugin` internally, so it has to keep its receiver.
	if (typeof core?.create_new_note_from_template !== "function") return null;
	try {
		const file = await core.create_new_note_from_template(
			request.template,
			request.folder || undefined,
			request.filename || undefined,
			// Never let Templater open it — see the module comment.
			false,
		);
		return file ?? null;
	} catch {
		return null;
	}
}

/** Ask Templater to place the cursor at the template's `tp.file.cursor()`
 * marker, once the note is open. A no-op when Templater doesn't expose the
 * handler, or when the user has its automatic jump switched off. */
export async function jumpToTemplaterCursor(app: App, file: TFile): Promise<void> {
	const handler = getTemplaterPlugin(app)?.editor_handler;
	if (typeof handler?.jump_to_next_cursor_location !== "function") return;
	try {
		await handler.jump_to_next_cursor_location(file, true);
	} catch {
		// Cursor placement is a nicety; a Templater that changed this signature
		// must not turn a created note into a failed click.
	}
}


// ---- Pure helpers -------------------------------------------------------

const moment = createMoment as unknown as (input?: number | Date) => { format(fmt?: string): string };

/** Default formats for the bare tokens. `time` avoids `:`, which is illegal in
 * a filename on Windows and stripped by {@link sanitizeFilename} anyway. */
const TOKEN_FORMATS = { date: "YYYY-MM-DD", time: "HH-mm" } as const;

/** Matches `{{date}}`, `{{date:FMT}}`, `{{time}}`, `{{time:FMT}}` and
 * `{{prompt}}`. Deliberately the same `{{token}}` shape the event-note filename
 * pattern and the core daily-note template use, so one convention covers all
 * three. Anything else is left untouched, so a typo shows up in the filename
 * instead of silently vanishing. */
const TOKEN_RE = /\{\{\s*(date|time|prompt)\s*(?::\s*([^}]+?)\s*)?\}\}/gi;

/** Whether a filename pattern asks Hearth for a value before the note is made.
 * Drives the one-line prompt the tile shows on click. */
export function filenameNeedsPrompt(pattern: string): boolean {
	return /\{\{\s*prompt\s*\}\}/i.test(pattern || "");
}

/**
 * Expand a filename pattern into a usable, vault-legal file name.
 *
 * `now` is passed in rather than read, so the substitution is deterministic
 * under test. `promptValue` fills `{{prompt}}`; it is sanitized along with
 * everything else, which is also what stops a typed `../` from escaping the
 * destination folder.
 */
export function expandTemplaterFilename(
	pattern: string,
	now: Date,
	promptValue = "",
): string {
	const expanded = (pattern || "").replace(
		TOKEN_RE,
		(_whole, name: string, format?: string) => {
			const token = name.toLowerCase();
			if (token === "prompt") return promptValue;
			const fmt = format || TOKEN_FORMATS[token as "date" | "time"];
			return moment(now).format(fmt);
		},
	);
	return sanitizeFilename(expanded);
}

/** Trim a folder path to the form the vault uses: no leading or trailing
 * slashes, no surrounding whitespace. "/" and "" both mean the vault root. */
export function normalizeFolderPath(raw: string): string {
	return (raw || "").trim().replace(/^\/+|\/+$/g, "");
}

/** A template path reduced to its display name — the tile label a freshly
 * picked template gets, and the label shown on the editor's template button. */
export function templateDisplayName(path: string): string {
	const base = (path || "").split("/").pop() ?? "";
	return base.replace(/\.md$/i, "");
}

/**
 * Where a tile's note will land, as one line for the editor to show under the
 * tile's name. Pure and format-only: `folder` empty reads as the caller's
 * "default location" wording, and an empty filename as Templater's "Untitled".
 */
export function destinationSummary(
	folder: string,
	filename: string,
	rootLabel: string,
	untitledLabel: string,
): string {
	const where = normalizeFolderPath(folder) || rootLabel;
	const what = (filename || "").trim() || untitledLabel;
	return `${where}/${what}.md`;
}
