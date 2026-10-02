/**
 * Writing a filled note template (`src/clip.ts`) to the vault: reading the
 * template note it may name, finding the note an item already has, and
 * creating the new one with its frontmatter. Shared by the calendars' event
 * notes and the RSS card's saved entries.
 */
import { type App, TFile, TFolder } from "obsidian";
import { type BuiltClipNote } from "./clip";

/** The text of a template note, by path (with or without `.md`), or "". */
export async function readTemplateText(app: App, path: string | undefined): Promise<string> {
	const at = (path ?? "").trim();
	if (!at) return "";
	const file = app.vault.getAbstractFileByPath(at) ?? app.vault.getAbstractFileByPath(`${at}.md`);
	if (!(file instanceof TFile)) return "";
	try {
		return await app.vault.read(file);
	} catch {
		return "";
	}
}

/** The note whose `key` property holds `value` — the note an event or an
 * entry was saved as before — or null when linking is off or none matches. */
export function findNoteByProperty(app: App, key: string, value: string): TFile | null {
	if (!key || !value) return null;
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm && String(fm[key]) === value) return file;
	}
	return null;
}

/** Create the note: its folder when missing, a free name in it, the body, then
 * the frontmatter through Obsidian (which handles the YAML). Returns the file,
 * or null when it couldn't be made. */
export async function writeClipNote(app: App, built: BuiltClipNote): Promise<TFile | null> {
	if (built.folder && !(app.vault.getAbstractFileByPath(built.folder) instanceof TFolder)) {
		try {
			await app.vault.createFolder(built.folder);
		} catch {
			// May have been created concurrently — proceed.
		}
	}
	const parent =
		(built.folder ? app.vault.getAbstractFileByPath(built.folder) : app.vault.getRoot()) ??
		app.vault.getRoot();
	if (!(parent instanceof TFolder)) return null;

	let file: TFile;
	try {
		file = await app.fileManager.createNewMarkdownFile(parent, built.filename);
	} catch {
		return null;
	}
	try {
		if (built.body) await app.vault.modify(file, `${built.body.replace(/\s+$/, "")}\n`);
		if (Object.keys(built.frontmatter).length) {
			await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				for (const [k, v] of Object.entries(built.frontmatter)) fm[k] = v;
			});
		}
	} catch {
		// The file exists even if body/frontmatter writes failed; return it.
	}
	return file;
}
