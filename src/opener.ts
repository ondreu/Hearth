import { Keymap, type App, type OpenViewState, type PaneType, type TFile, type UserEvent, type WorkspaceLeaf } from "obsidian";
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
