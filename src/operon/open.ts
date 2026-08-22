import { MarkdownView, Notice, TFile, type App } from "obsidian";
import { t } from "../i18n";
import type { OperonTask } from "./types";

/**
 * Open the note behind an Operon task.
 *
 * Operon's locator is the whole address: a file task names its note, an inline
 * task names the note and the line. Both are ordinary vault paths, so opening
 * one needs no Operon API call and works even when the session is stale.
 */
export async function openOperonTask(app: App, task: OperonTask): Promise<void> {
	const file = app.vault.getAbstractFileByPath(task.locator.filePath);
	if (!(file instanceof TFile)) {
		new Notice(t().notices.operonTaskMissing);
		return;
	}

	const line = task.locator.representation === "inline" ? task.locator.lineNumber : -1;
	const leaf = app.workspace.getLeaf(true);
	// Scroll via ephemeral state rather than a setCursor right after openFile:
	// in a fresh leaf the editor isn't laid out yet, so an immediate scroll is
	// discarded and the note opens at the top (#118). Obsidian applies
	// `eState.line` once the view has mounted; the setCursor then places the
	// caret.
	await leaf.openFile(file, line >= 0 ? { eState: { line } } : undefined);
	if (line >= 0 && leaf.view instanceof MarkdownView) {
		leaf.view.editor.setCursor({ line, ch: 0 });
	}
}
