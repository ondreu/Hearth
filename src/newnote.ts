/**
 * The "+ New note" button's action, in one place.
 *
 * By default it does what it always did: `fileManager.createNewMarkdownFile` in
 * Obsidian's "Default location for new notes", called "Untitled", opened the
 * way Hearth opens notes. #227 asks for the three things a user who has already
 * built a capture workflow needs from it — a **Templater template**, a
 * **destination folder** and a **filename pattern** — plus the ability to
 * **rename the button**. All four are plain settings, so the header button, the
 * search-bar card's button and the "Create new note" command share one
 * behaviour rather than drifting apart.
 *
 * The Templater path is the Templater card's, reused wholesale (see
 * `src/templater.ts`): Hearth never expands `<% tp.* %>` itself, it asks the
 * running plugin to make the note and then opens the result through its own
 * opener so a dashboard doesn't replace itself. Everything the card supports —
 * `{{date}}`/`{{time}}`/`{{prompt}}` filename tokens, `tp.system.prompt()`
 * dialogs, the cursor jump — therefore works here too.
 *
 * The folder and filename apply to a blank note as well, so the button is
 * configurable for the (larger) group of users who never installed Templater.
 */
import { Notice, TFolder, type App, type TFile } from "obsidian";
import { t } from "./i18n";
import { openFile, type OpenFrom } from "./opener";
import {
	createNoteFromTemplate,
	expandTemplaterFilename,
	filenameNeedsPrompt,
	isTemplaterAvailable,
	jumpToTemplaterCursor,
	normalizeFolderPath,
	resolveTemplateFile,
} from "./templater";
import { effectiveNewNoteButtonLabel, type HomeSettings } from "./types";
import { promptForText } from "./ui";

/** Obsidian's own name for a note created with no name of its own. Used when no
 * filename pattern is set, and when a pattern expands to nothing legal. */
export const UNTITLED_NOTE = "Untitled";

/** The text on the New-note button: the user's own, or the built-in label. */
export function newNoteButtonLabel(s: HomeSettings): string {
	return effectiveNewNoteButtonLabel(s).trim() || t().header.newNote;
}

/** Whether the button has been pointed at a Templater template. Says nothing
 * about whether Templater is *installed* — that is checked at click time, so a
 * temporarily disabled plugin degrades to a blank note instead of a dead
 * button. */
export function newNoteUsesTemplate(s: Pick<HomeSettings, "newNoteTemplate">): boolean {
	return s.newNoteTemplate.trim() !== "";
}

/**
 * The name a blank note gets from a (possibly empty) filename pattern.
 *
 * Pure, and separate from the Templater path because the two differ in what an
 * empty pattern means: Templater is happy to be handed no filename and name the
 * note itself, whereas `createNewMarkdownFile` needs one — so "" becomes
 * "Untitled", exactly what the button produced before this setting existed.
 */
export function blankNoteName(pattern: string, now: Date, promptValue = ""): string {
	return expandTemplaterFilename(pattern, now, promptValue) || UNTITLED_NOTE;
}

/** Resolve (creating it if need be) the folder a new note should land in. A
 * path that can't be made — a name the filesystem refuses, a file sitting where
 * the folder should be — falls back to the vault's default location rather than
 * failing the click. */
async function destinationFolder(app: App, folder: string): Promise<TFolder> {
	const path = normalizeFolderPath(folder);
	if (path) {
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return existing;
		try {
			const created = await app.vault.createFolder(path);
			if (created instanceof TFolder) return created;
			// Older API shapes resolve to void; look the folder up again.
			const after = app.vault.getAbstractFileByPath(path);
			if (after instanceof TFolder) return after;
		} catch {
			// Fall through to the default location below.
		}
	}
	const parent = app.fileManager.getNewFileParent("");
	return parent instanceof TFolder ? parent : app.vault.getRoot();
}

/** Ask for the `{{prompt}}` value when the pattern wants one. Returns `null`
 * when the user cancelled (which is not an error, and stops the whole click),
 * and "" when nothing was asked. */
async function promptValueFor(app: App, pattern: string, label: string): Promise<string | null> {
	if (!filenameNeedsPrompt(pattern)) return "";
	const answer = await promptForText(app, {
		title: t().cards.templater.promptTitle,
		label,
		placeholder: t().cards.templater.promptPlaceholder,
	});
	return answer === null ? null : answer.trim();
}

/**
 * Create the note the New-note button is configured to create, and open it.
 *
 * `from` is the view the button was pressed in, so the note can replace that
 * Hearth tab when the user asked for "same tab" (#106); the command palette has
 * no view and passes a bare host instead.
 */
export async function createConfiguredNote(
	app: App,
	settings: HomeSettings,
	from: OpenFrom,
): Promise<void> {
	const pattern = settings.newNoteFilename;
	const label = newNoteButtonLabel(settings);

	if (newNoteUsesTemplate(settings)) {
		if (isTemplaterAvailable(app)) {
			await createFromTemplate(app, settings, from, pattern, label);
			return;
		}
		// Configured for a template but Templater isn't there right now. Say so
		// once, then make the plain note anyway — a button that does nothing is
		// the worse of the two failures.
		new Notice(t().notices.newNoteTemplaterMissing);
	}

	await createBlankNote(app, settings, from, pattern, label);
}

/** The Templater path: hand the job to the plugin, then open what it made. */
async function createFromTemplate(
	app: App,
	settings: HomeSettings,
	from: OpenFrom,
	pattern: string,
	label: string,
): Promise<void> {
	const template = resolveTemplateFile(app, settings.newNoteTemplate);
	if (!template) {
		new Notice(t().notices.templaterNoTemplate(settings.newNoteTemplate));
		return;
	}

	const promptValue = await promptValueFor(app, pattern, label);
	if (promptValue === null) return;

	const file = await createNoteFromTemplate(app, {
		template,
		folder: normalizeFolderPath(settings.newNoteFolder),
		// Empty stays empty here: Templater names the note itself.
		filename: expandTemplaterFilename(pattern, new Date(), promptValue),
	});
	if (!file) {
		// Templater shows its own notice for a parse failure or a dismissed
		// prompt of its own; this is the catch-all for everything else.
		new Notice(t().notices.templaterFailed(label));
		return;
	}
	await openNewNote(app, from, file, true);
}

/** The original path, plus the folder and filename settings. */
async function createBlankNote(
	app: App,
	settings: HomeSettings,
	from: OpenFrom,
	pattern: string,
	label: string,
): Promise<void> {
	try {
		const promptValue = await promptValueFor(app, pattern, label);
		if (promptValue === null) return;
		const folder = await destinationFolder(app, settings.newNoteFolder);
		const file = await app.fileManager.createNewMarkdownFile(
			folder,
			blankNoteName(pattern, new Date(), promptValue),
		);
		await openNewNote(app, from, file, false);
	} catch (err) {
		// Fall back to the core command if the internal API shape changes.
		if (!app.commands.executeCommandById("file-explorer:new-file")) {
			new Notice(t().notices.couldNotCreateNote);
			console.error("Hearth new note error", err);
		}
	}
}

/** Open a freshly made note, and place the cursor for a templated one.
 * Templater does the jump itself when it opens the note; Hearth opened it
 * instead (see `src/templater.ts`), so it has to be asked for. */
async function openNewNote(
	app: App,
	from: OpenFrom,
	file: TFile,
	templated: boolean,
): Promise<void> {
	await openFile(from, file, "newNote");
	if (templated) await jumpToTemplaterCursor(app, file);
}
