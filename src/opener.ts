import { Keymap, MarkdownView, TFile, type App, type OpenViewState, type PaneType, type UserEvent, type WorkspaceLeaf } from "obsidian";
import type { GlobalSearchInstance } from "./obsidian-ext";
import type { QueryHit } from "./query";
import {
	OPEN_IN_MODES,
	type HomeSettings,
	type OpenIn,
	type OpenSource,
} from "./types";

/**
 * One place that decides *where* a note Hearth opens ends up (#106).
 *
 * Every "open this note" path in the plugin used to hard-code
 * `workspace.getLeaf(true)` — always a new tab. They all route through here
 * instead, so a single Behaviour setting (plus optional per-source exceptions)
 * governs the lot, and a Mod-click still wins over any of it exactly like it
 * does everywhere else in Obsidian.
 */

/** What Hearth needs to know to open something: the app, the settings, and the
 * leaf the click came from (so "same tab" replaces *that* view rather than
 * whichever tab happens to be focused). */
export interface OpenHost {
	app: App;
	settings: HomeSettings;
	/** The leaf hosting the view that was clicked, when the caller knows it. */
	leaf?: WorkspaceLeaf | null;
}

/** Structural shape of a Hearth view — matched by `HomeView` without importing
 * it, which would make this module part of the view's import cycle. */
interface HearthViewLike {
	app: App;
	leaf: WorkspaceLeaf;
	plugin: { settings: HomeSettings };
}

/** Anything the open helpers accept: a Hearth view, or a hand-built host for
 * the few callers (modals, the plugin itself) that have no view. */
export type OpenFrom = OpenHost | HearthViewLike;

function host(from: OpenFrom): OpenHost {
	return "plugin" in from
		? { app: from.app, settings: from.plugin.settings, leaf: from.leaf }
		: from;
}

/**
 * The destination for one open: either reuse the leaf Hearth is in, or hand a
 * pane type to `getLeaf`/`openLinkText`. Kept separate from the workspace calls
 * so the decision itself is pure and testable.
 */
export type OpenTarget = { kind: "reuse" } | { kind: "pane"; pane: PaneType };

/**
 * Which destination a mode implies, given the modifier keys held at the time.
 *
 * `mod` is whatever {@link Keymap.isModEvent} reported: `false` for a plain
 * click, a {@link PaneType} when the modifier combination names one, or `true`
 * for a bare Mod-click. A modifier always overrides the setting — Mod-click
 * means "new tab" throughout Obsidian, and Hearth must not be the exception.
 */
export function openTarget(mode: OpenIn, mod: PaneType | boolean = false): OpenTarget {
	if (mod) return { kind: "pane", pane: mod === true ? "tab" : mod };
	if (mode === "same") return { kind: "reuse" };
	if (mode === "split" || mode === "window") return { kind: "pane", pane: mode };
	return { kind: "pane", pane: "tab" };
}

/**
 * The mode that applies to one kind of click: the source's own rule when it has
 * one, otherwise the global choice. Falls back to `"tab"` — Hearth's historical
 * behaviour — for any value a hand-edited or future settings file might hold.
 */
export function resolveOpenIn(settings: HomeSettings, source: OpenSource): OpenIn {
	const rule = settings.openInOverrides?.[source];
	const mode = rule && rule !== "default" ? rule : settings.openIn;
	return OPEN_IN_MODES.includes(mode) ? mode : "tab";
}

/**
 * Whether the Hearth view should report itself as navigable.
 *
 * Obsidian reuses the focused leaf for a file opened from the file explorer,
 * the quick switcher or the graph — but only when the view in it says it is
 * navigable. That is the only lever Hearth has over those opens, since the
 * click never reaches Hearth's own code (the same goes for a view embedded in a
 * card that resolves links itself, such as an embedded Bases table).
 *
 * Defaults to navigable, which is the behaviour since #84: the dashboard acts
 * like an ordinary tab, so the explorer's selection follows what you open
 * instead of getting stuck on a note in a tab you can't see.
 */
export function hearthLeafIsNavigable(settings: HomeSettings): boolean {
	const rule = settings.openFromOutside;
	if (rule === "same") return true;
	if (rule === "tab") return false;
	// "default" (and any unknown value) follows the global choice — not a
	// per-source rule, since Hearth never sees which kind of click this was.
	// Only "the current tab" means Hearth is there to be taken over.
	return settings.openIn === "same";
}

/**
 * The vault link an anchor points at, or null when it isn't one.
 *
 * `data-href` is what Obsidian's Markdown renderer emits, but content rendered
 * by other things inside a card — an embedded Bases view, a plugin's own
 * output — doesn't always carry it, or the `internal-link` class, so a plain
 * relative `href` counts too. Anything with a URL scheme (`https:`, `mailto:`,
 * `obsidian:`) belongs to the external-link path, and a fragment-only href is a
 * footnote or heading jump within the rendered content rather than a link to a
 * note.
 */
export function internalLinkText(dataHref: string | null, href: string | null): string | null {
	if (dataHref) return dataHref;
	if (!href || href.startsWith("#")) return null;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
	return href;
}

/** Resolve the modifier state for an open: the triggering event when the caller
 * has one, otherwise the last user interaction Obsidian recorded — which is how
 * commands see modifier keys they were never handed. */
function modifiers(h: OpenHost, evt?: UserEvent | null): PaneType | boolean {
	return Keymap.isModEvent(evt ?? h.app.lastEvent);
}

/** The leaf a note should open in. Exported for callers that need the leaf
 * itself (to scroll it, or to read its view back). */
export function targetLeaf(from: OpenFrom, source: OpenSource, evt?: UserEvent | null): WorkspaceLeaf {
	const h = host(from);
	const target = openTarget(resolveOpenIn(h.settings, source), modifiers(h, evt));
	if (target.kind === "pane") return h.app.workspace.getLeaf(target.pane);
	// "Same tab": replace the Hearth view in its own leaf. Without a known leaf
	// (a modal, a command) fall back to the active one, which is what Obsidian
	// itself does for `getLeaf(false)`.
	return h.leaf ?? h.app.workspace.getLeaf(false);
}

/** Open a file the way the user asked Hearth to open notes. */
export async function openFile(
	from: OpenFrom,
	file: TFile,
	source: OpenSource,
	evt?: UserEvent | null,
	state?: OpenViewState,
): Promise<void> {
	await targetLeaf(from, source, evt).openFile(file, state);
}

/** Zero-based line number of `offset` (a UTF-16 index) in `text`. Offsets past
 * the end clamp to the last line. Pure, exported for tests. */
export function offsetToLine(text: string, offset: number): number {
	const at = Math.max(0, Math.min(offset, text.length));
	let line = 0;
	for (let i = 0; i < at; i++) {
		if (text.charCodeAt(i) === 10) line++;
	}
	return line;
}

/**
 * Open a search hit, scrolling to the body match when there is one (#397).
 *
 * Only excerpt (note-body) hits of markdown notes jump: title, tag, property
 * and folder hits open at the top like before. The jump needs two parts —
 * `eState.line` so a freshly mounted MarkdownView lands on the line even
 * before its editor is laid out (the same reason tasks pass it, see
 * `openTaskFile`), then a cursor + selection once the editor exists, which is
 * what visibly highlights the term like a find hit. Gated by the
 * `searchScrollToMatch` setting (on by default); anything unexpected (binary
 * file, stale offset, Reading view without an editor) silently falls back to a
 * plain open.
 */
export async function openSearchHit(
	from: OpenFrom,
	hit: QueryHit,
	source: OpenSource,
	evt?: UserEvent | null,
): Promise<void> {
	const h = host(from);
	const file = hit.file;
	if (!(file instanceof TFile)) return;
	const bodyMatch = h.settings.searchScrollToMatch
		&& file.extension === "md"
		&& hit.badge?.excerpt
		? hit.bodyMatch
		: undefined;
	if (!bodyMatch) {
		await targetLeaf(from, source, evt).openFile(file);
		return;
	}
	const { offset, length } = bodyMatch;
	const leaf = targetLeaf(from, source, evt);
	let openState: OpenViewState | undefined;
	try {
		const text = await h.app.vault.cachedRead(file);
		openState = { eState: { line: offsetToLine(text, offset) } };
	} catch {
		openState = undefined;
	}
	await leaf.openFile(file, openState);
	try {
		if (!(leaf.view instanceof MarkdownView)) return;
		const editor = leaf.view.editor;
		if (!editor) return;
		const docLength = editor.getValue().length;
		// The indexed text can be stale (edited since the search ran); clamp
		// rather than throwing the cursor at the end of the note.
		const at = Math.max(0, Math.min(offset, docLength));
		const len = Math.max(1, Math.min(length, docLength - at));
		const pos = editor.offsetToPos(at);
		const endPos = editor.offsetToPos(at + len);
		editor.setCursor(pos);
		editor.scrollIntoView(
			{ from: { line: Math.max(0, pos.line - 10), ch: 0 }, to: { line: pos.line + 10, ch: 0 } },
		);
		// Backwards (end first) so the caret stays at the match start, like a
		// find hit in Obsidian/Omnisearch.
		editor.setSelection(endPos, pos);
	} catch {
		// A plain open already happened; highlighting is best-effort.
	}
}

/**
 * Open a link the way the user asked Hearth to open notes.
 *
 * Link text is left to `openLinkText`, which resolves aliases, headings, block
 * references and missing notes — none of which a raw path lookup here would get
 * right. For "same tab" that means focusing the Hearth leaf first, since
 * `openLinkText` can only be told *which kind* of pane to use, not which leaf.
 */
export async function openLink(
	from: OpenFrom,
	linktext: string,
	sourcePath: string,
	source: OpenSource,
	evt?: UserEvent | null,
): Promise<void> {
	const h = host(from);
	const target = openTarget(resolveOpenIn(h.settings, source), modifiers(h, evt));
	if (target.kind === "pane") {
		await h.app.workspace.openLinkText(linktext, sourcePath, target.pane);
		return;
	}
	if (h.leaf) h.app.workspace.setActiveLeaf(h.leaf, { focus: true });
	await h.app.workspace.openLinkText(linktext, sourcePath, false);
}


/**
 * Hand a query to Obsidian's own search pane, the way a tag click does.
 *
 * `openGlobalSearch` is the core Search plugin's own entry point — it reveals
 * the pane, fills the box and runs the query — and there is no public API that
 * does any of it. Returns whether the search actually ran, so a caller can say
 * something when the core plugin is switched off rather than looking broken.
 */
export function openSearch(app: App, query: string): boolean {
	const search = app.internalPlugins.getPluginById("global-search");
	if (!search?.enabled) return false;
	const instance = search.instance as GlobalSearchInstance | undefined;
	if (!instance?.openGlobalSearch) return false;
	instance.openGlobalSearch(query);
	return true;
}
