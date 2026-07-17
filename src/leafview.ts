import { App, Component, TFile, WorkspaceLeaf } from "obsidian";

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
 * View types the "leaf" card never offers. These are Obsidian's own document
 * surfaces — they need a concrete file and render blank (or misbehave) when
 * hosted detached from the workspace — plus Hearth's own view, which must not
 * host itself. Everything else a plugin registers (calendar, outline, kanban,
 * tag pane, …) is a fair game side-panel view.
 */
const EXCLUDED_VIEW_TYPES = new Set<string>([
	"empty",
	"markdown",
	"image",
	"audio",
	"video",
	"pdf",
	VIEW_TYPE_HOME,
]);

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
 * read. Excludes core document surfaces and Hearth's own view. */
export function listLeafViewTypes(app: App): LeafViewType[] {
	const byType = viewByType(app);
	if (!byType) return [];
	return Object.keys(byType)
		.filter((type) => !EXCLUDED_VIEW_TYPES.has(type))
		.map((type) => ({ type, name: labelForType(type) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a specific view type is currently registered and hostable. */
export function isViewTypeHostable(app: App, type: string): boolean {
	const byType = viewByType(app);
	return !!byType && type in byType && !EXCLUDED_VIEW_TYPES.has(type);
}

/** Resolve a vault path to a file, or null when it's blank or not a file. Used
 * to point a hosted view at a specific document (an Excalidraw drawing, a
 * canvas…) rather than its empty "new file" screen. */
function fileForPath(app: App, path: string | undefined): TFile | null {
	const trimmed = path?.trim();
	if (!trimmed) return null;
	return app.vault.getFileByPath(trimmed);
}

/**
 * Host a registered view inside `container` by creating a detached workspace
 * leaf, driving it to `viewType`, and moving its element into the card. The
 * leaf lives outside the workspace layout, so it never appears in Obsidian's
 * saved layout or affects other panes.
 *
 * Cleanup is tied to `component`: the leaf is detached when the card is
 * redrawn or the dashboard closes, so no leaf or detached DOM is leaked. The
 * teardown is registered before the (async) view load so a mid-load failure
 * is still cleaned up.
 *
 * When `file` names a vault file that exists, the view is opened on that file
 * (an Excalidraw drawing, a canvas, a note…) instead of its detached "new file"
 * screen. A blank or missing path hosts the bare view as before.
 *
 * Best-effort and defensive: any failure to construct or mount returns false
 * rather than throwing, so a problematic view can never break the dashboard.
 */
export function mountLeafView(
	app: App,
	viewType: string,
	container: HTMLElement,
	component: Component,
	file?: string,
): boolean {
	try {
		// WorkspaceLeaf's constructor is internal; a detached leaf is the standard
		// way to host a view outside the layout.
		const LeafCtor = WorkspaceLeaf as unknown as { new (app: App): WorkspaceLeaf };
		const leaf = new LeafCtor(app);

		component.register(() => {
			try {
				leaf.detach();
			} catch {
				/* the leaf may already be gone; nothing to clean up */
			}
		});

		container.appendChild(leaf.containerEl);
		// active:false keeps focus and the active-leaf pointer where they are, so
		// hosting a view never steals focus from the dashboard or editor.
		const target = fileForPath(app, file);
		if (target) {
			// Drive the leaf to the requested view type on the chosen file. Passing
			// the path through the view state is how Obsidian opens a file into a
			// specific view; file-backed views (Excalidraw, canvas…) then render that
			// document rather than their empty screen.
			void leaf
				.setViewState({
					type: viewType,
					active: false,
					state: { file: target.path },
				})
				.catch(() => {
					/* the view failed to load; the empty leaf is harmless and cleaned up */
				});
		} else {
			void leaf
				.setViewState({ type: viewType, active: false })
				.catch(() => {
					/* the view failed to load; the empty leaf is harmless and cleaned up */
				});
		}
		return true;
	} catch {
		return false;
	}
}
