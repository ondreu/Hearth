import { App, Component, debounce, TextFileView, TFile, WorkspaceLeaf } from "obsidian";

/** Hearth's own view type — hosting it inside itself makes no sense, so it is
 * excluded from the leaf card's picker. Kept as a literal (rather than imported
 * from ./view) to avoid an import cycle through cards.ts. */
const VIEW_TYPE_HOME = "hearth-home-view";

/** A view type registered in the app, offered by the "leaf" card's picker. */
export interface LeafViewType {
	/** The registered view-type id (what `registerView` was called with). */
	type: string;
	/** A human-friendly label derived from the id. */
	name: string;
}

/**
 * View types nothing may ever host: the placeholder empty view, and Hearth's
 * own view, which must not host itself.
 */
const EXCLUDED_VIEW_TYPES = new Set<string>(["empty", VIEW_TYPE_HOME]);

/**
 * Obsidian's own document surfaces. They need a concrete file — hosted without
 * one they render blank or misbehave — so they are hidden by default.
 *
 * A card is too small for them to be worth the footgun, but a *plugin board*
 * gives a view the whole page, where opening a note, a PDF or a picture as the
 * board is a real thing to want. Callers that can supply a file opt in with
 * `{ documents: true }`.
 */
const DOCUMENT_VIEW_TYPES = new Set<string>(["markdown", "image", "audio", "video", "pdf"]);

/** Options shared by the view-type listing and the hostable check. */
export interface LeafViewScope {
	/** Include Obsidian's document surfaces (Markdown, PDF, image, audio,
	 * video). They only work pointed at a file — see {@link isDocumentViewType}
	 * — so only a caller that offers a file picker should ask for them. */
	documents?: boolean;
}

/**
 * The scope a *full-view* host asks for: everything, document surfaces
 * included. A plugin board has a file picker beside its type picker and gives
 * the view the whole page, so opening a note, a PDF or a picture as the board
 * is a real thing to want. (A card, with room for neither, keeps the default.)
 */
export const FULL_VIEW_SCOPE: LeafViewScope = { documents: true };

/** Whether `type` is one of Obsidian's document surfaces, which render nothing
 * useful without a file to open. */
export function isDocumentViewType(type: string): boolean {
	return DOCUMENT_VIEW_TYPES.has(type);
}

/** Whether `type` is hidden from the pickers under `scope`. */
function isHiddenType(type: string, scope: LeafViewScope | undefined): boolean {
	if (EXCLUDED_VIEW_TYPES.has(type)) return true;
	return !scope?.documents && DOCUMENT_VIEW_TYPES.has(type);
}

/** Reach the app's view registry, or null when the internal shape isn't there
 * (a future Obsidian could move it). Never throws. */
function viewByType(app: App): Record<string, unknown> | null {
	try {
		const byType = app.viewRegistry?.viewByType;
		return byType && typeof byType === "object" ? byType : null;
	} catch {
		return null;
	}
}

/** Turn a view-type id into a readable label, e.g. "tag-pane" → "Tag pane". */
function labelForType(type: string): string {
	const spaced = type.replace(/[-_]+/g, " ").trim();
	return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : type;
}

/** Whether the leaf card can work at all right now (the registry is reachable).
 * Used to gate the "Add card" template so the card is only offered when Hearth
 * can actually enumerate and host views. */
export function isLeafViewAvailable(app: App): boolean {
	return viewByType(app) !== null;
}

/** Every hostable view type, sorted by label. Empty when the registry can't be
 * read. Always excludes the empty view and Hearth's own; excludes Obsidian's
 * document surfaces too unless `scope.documents` asks for them. */
export function listLeafViewTypes(app: App, scope?: LeafViewScope): LeafViewType[] {
	const byType = viewByType(app);
	if (!byType) return [];
	return Object.keys(byType)
		.filter((type) => !isHiddenType(type, scope))
		.map((type) => ({ type, name: labelForType(type) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a specific view type is currently registered and hostable under
 * `scope` (see {@link listLeafViewTypes}). */
export function isViewTypeHostable(app: App, type: string, scope?: LeafViewScope): boolean {
	const byType = viewByType(app);
	return !!byType && type in byType && !isHiddenType(type, scope);
}

/** Resolve a vault path to a file, or null when it's blank or not a file. Used
 * to point a hosted view at a specific document (an Excalidraw drawing, a
 * canvas…) rather than its empty "new file" screen. */
function fileForPath(app: App, path: string | undefined): TFile | null {
	const trimmed = path?.trim();
	if (!trimmed) return null;
	return app.vault.getFileByPath(trimmed);
}

/** Build a detached leaf, mount it into `container`, and drive it to `viewType`
 * (opening `file` when one is given). Returns the leaf, or null if construction
 * failed. Best-effort: never throws. */
export function createHostedLeaf(
	app: App,
	viewType: string,
	container: HTMLElement,
	file: string | undefined,
): WorkspaceLeaf | null {
	try {
		// WorkspaceLeaf's constructor is internal; a detached leaf is the standard
		// way to host a view outside the layout.
		const LeafCtor = WorkspaceLeaf as unknown as { new (app: App): WorkspaceLeaf };
		const leaf = new LeafCtor(app);
		container.appendChild(leaf.containerEl);
		// active:false keeps focus and the active-leaf pointer where they are, so
		// hosting a view never steals focus from the dashboard or editor.
		const target = fileForPath(app, file);
		if (target) {
			// Open the file through the leaf's own opener rather than hand-rolling a
			// view state. openFile loads the file's data the way Obsidian does when
			// you click a note, so file-backed views (Excalidraw, canvas…) get a fully
			// initialised document instead of a half-built one — driving these views
			// via setViewState({ state: { file } }) leaves them without their data and
			// crashes some of them (Excalidraw throws in setViewData on every frame).
			// The file's registered editor is its natural view, which matches the type
			// the user picked for the card.
			void leaf.openFile(target, { active: false }).catch(() => {
				/* the file/view failed to load; the empty leaf is harmless and cleaned up */
			});
		} else {
			void leaf.setViewState({ type: viewType, active: false }).catch(() => {
				/* the view failed to load; the empty leaf is harmless and cleaned up */
			});
		}
		return leaf;
	} catch {
		return null;
	}
}

/** Build a detached leaf showing `file` in Obsidian's own Markdown editor and
 * mount it into `container`. Returns the leaf, or null if construction failed.
 * Best-effort: never throws. */
function createEditorLeaf(app: App, file: TFile, container: HTMLElement): WorkspaceLeaf | null {
	try {
		const LeafCtor = WorkspaceLeaf as unknown as { new (app: App): WorkspaceLeaf };
		const leaf = new LeafCtor(app);
		container.appendChild(leaf.containerEl);
		// `mode: "source"` selects the editing (not reading) sub-view, and the
		// `source` flag inside it picks raw Markdown (true) over Live Preview
		// (false). These are the same two keys Obsidian persists for every markdown
		// leaf in workspace.json — there is no typed API for the Live Preview flag,
		// so the state object is the only way to ask for it. active:false keeps
		// focus and the active-leaf pointer where they are.
		void leaf
			.openFile(file, { active: false, state: { mode: "source", source: false } })
			.catch(() => {
				/* the file failed to load; the empty leaf is harmless and cleaned up */
			});
		return leaf;
	} catch {
		return null;
	}
}

/** Tear a hosted leaf down, best-effort. Resetting to the empty view first runs
 * the previous view's `onunload`, so heavy views (Excalidraw's React app and its
 * autosave/animation loops, a canvas' renderer) actually release their memory
 * and timers instead of lingering — a bare `detach()` on a hand-made leaf does
 * not reliably unload them. */
export function teardownHostedLeaf(leaf: WorkspaceLeaf): void {
	const detach = () => {
		try {
			leaf.detach();
		} catch {
			/* the leaf may already be gone; nothing to clean up */
		}
	};
	const unload = () => {
		try {
			// setViewState is async; unload the view, then detach whether it resolved
			// or rejected. Promise.resolve tolerates a future API that returns void.
			void Promise.resolve(leaf.setViewState({ type: "empty" })).then(detach, detach);
		} catch {
			detach();
		}
	};
	try {
		// A hosted text editor (the live-preview note card, a canvas) can be holding
		// keystrokes that TextFileView has only scheduled to write — `requestSave` is
		// debounced two seconds out. Flush them before the view is unloaded, so
		// scrolling the card off screen or closing the dashboard can't drop an edit.
		const view = leaf.view;
		if (view instanceof TextFileView) {
			void Promise.resolve(view.save()).then(unload, unload);
			return;
		}
	} catch {
		/* couldn't reach the view; fall through to a plain unload */
	}
	unload();
}

/**
 * Host a registered view inside `container` by creating a detached workspace
 * leaf, driving it to `viewType`, and moving its element into the card. The
 * leaf lives outside the workspace layout, so it never appears in Obsidian's
 * saved layout or affects other panes.
 *
 * The hosted view is only kept alive while the card is actually on screen. An
 * IntersectionObserver mounts it when the card scrolls into view and tears it
 * down (after a short grace period, so a quick scroll-past doesn't churn it)
 * when it leaves — which also fires when the whole Hearth tab is hidden behind
 * another tab. This bounds the cost of heavy views like Excalidraw, whose
 * background React/autosave loops would otherwise pile up over a long session
 * until Obsidian runs out of memory.
 *
 * Cleanup is tied to `component`: the observer is disconnected and any live leaf
 * unloaded and detached when the card is redrawn or the dashboard closes, so no
 * leaf, view or detached DOM is leaked.
 *
 * When `file` names a vault file that exists, the view is opened on that file
 * (an Excalidraw drawing, a canvas, a note…) instead of its detached "new file"
 * screen. A blank or missing path hosts the bare view as before.
 *
 * Best-effort and defensive: any failure to set hosting up returns false rather
 * than throwing, so a problematic view can never break the dashboard.
 */
export function mountLeafView(
	app: App,
	viewType: string,
	container: HTMLElement,
	component: Component,
	file?: string,
): boolean {
	return hostLeafIn(app, container, component, () =>
		createHostedLeaf(app, viewType, container, file),
	);
}


/**
 * Host Obsidian's own Markdown editor for `file` inside `container`, opened in
 * Live Preview. Same detached-leaf hosting (and same visibility-driven
 * mount/unmount lifecycle) as `mountLeafView`, so an off-screen card costs
 * nothing and the editor is torn down — after flushing any pending save — when
 * the card is redrawn or the dashboard closes.
 *
 * This is what the editable note cards use instead of their plain textarea when
 * "Live preview" is on: it's the real editor, so wikilinks, embeds, formatting
 * and every editor plugin behave exactly as they do in a normal tab.
 *
 * Best-effort: returns false rather than throwing when hosting can't be set up,
 * so the caller can fall back to the plain editor.
 */
export function mountMarkdownEditor(
	app: App,
	file: TFile,
	container: HTMLElement,
	component: Component,
): boolean {
	return hostLeafIn(app, container, component, () => createEditorLeaf(app, file, container));
}


/** The shared hosting lifecycle behind `mountLeafView` and
 * `mountMarkdownEditor`: build the leaf lazily when the card is on screen, tear
 * it down when it leaves, and release everything with `component`. `create`
 * supplies the leaf and is only ever called once per mount. */
function hostLeafIn(
	app: App,
	container: HTMLElement,
	component: Component,
	create: () => WorkspaceLeaf | null,
): boolean {
	try {
		let leaf: WorkspaceLeaf | null = null;
		let destroyed = false;

		const mount = () => {
			if (leaf || destroyed) return;
			// Never build the view before the workspace has finished restoring and
			// all plugins are loaded. Mounting a host like Excalidraw mid-startup
			// leaves it "waiting for Obsidian to initialize all of your plugins" and
			// can hang the app. onLayoutReady runs immediately once ready, so after
			// startup this is a straight-through call.
			app.workspace.onLayoutReady(() => {
				if (leaf || destroyed) return;
				leaf = create();
			});
		};
		const unmount = () => {
			if (!leaf) return;
			teardownHostedLeaf(leaf);
			leaf = null;
			container.empty();
		};
		// Debounced so scrolling quickly past the card (or a brief tab switch)
		// doesn't tear the view down and immediately rebuild it — which is both
		// wasteful and, for editors like Excalidraw, a chance to trip their
		// "changes couldn't be saved" recovery path.
		const unmountSoon = debounce(unmount, 1500, true);

		const io = new IntersectionObserver((entries) => {
			const visible = entries.some((e) => e.isIntersecting);
			if (visible) {
				unmountSoon.cancel();
				mount();
			} else {
				unmountSoon();
			}
		});
		io.observe(container);

		component.register(() => {
			destroyed = true;
			io.disconnect();
			unmountSoon.cancel();
			unmount();
		});
		return true;
	} catch {
		return false;
	}
}
