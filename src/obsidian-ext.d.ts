import "obsidian";
import { Command, TFile, TFolder } from "obsidian";

// Minimal typings for Obsidian internals that aren't part of the public API
// but are stable and widely used by community plugins.
declare module "obsidian" {
	interface App {
		internalPlugins: {
			getPluginById(id: string): {
				instance: unknown;
				enabled: boolean;
			} | null;
		};
		commands: {
			executeCommandById(id: string): boolean;
			listCommands(): Command[];
		};
		plugins: {
			/** Ids of every enabled community plugin. */
			enabledPlugins: Set<string>;
			/** The loaded community plugin instances, keyed by id. */
			plugins: Record<string, unknown>;
		};
		/** Registry of every view type registered via `registerView` (core and
		 * community). `viewByType` is keyed by the view-type id. Used by the
		 * "leaf" card to discover hostable side-panel views. */
		viewRegistry?: {
			viewByType?: Record<string, unknown>;
		};
	}

	/** WorkspaceLeaf's constructor isn't part of the public typings, but a
	 * detached leaf (`new WorkspaceLeaf(app)`) is the documented-by-practice way
	 * community plugins host a view outside the workspace layout. */
	interface WorkspaceLeaf {
		containerEl: HTMLElement;
	}

	interface FileManager {
		createNewMarkdownFile(folder: TFolder, baseName?: string): Promise<TFile>;
		processFrontMatter(file: TFile, fn: (frontmatter: Record<string, unknown>) => void): Promise<void>;
		/** The folder a new note should be created in for a note made from
		 * `sourcePath`, respecting the user's "Default location for new notes". */
		getNewFileParent(sourcePath: string, newFilePath?: string): TFolder;
		/** Build a wiki/Markdown link to `file` (honoring the user's link
		 * settings) as it should appear in the note at `sourcePath`. */
		generateMarkdownLink(file: TFile, sourcePath: string, subpath?: string, alias?: string): string;
	}
}

/** Shape of the core "Workspaces" plugin instance we care about: the saved
 * workspaces keyed by name, and the name of the last-loaded one. */
export interface WorkspacesInstance {
	workspaces?: Record<string, unknown>;
	activeWorkspace?: string;
}

// Shape of an Obsidian core "Bookmarks" item we care about. `type` is one of
// "file" | "folder" | "search" | "group" | "url" (and possibly others), kept as
// a plain string since the literals collapse into it anyway.
export interface BookmarkItem {
	type: string;
	title?: string;
	path?: string;
	url?: string;
	query?: string;
	items?: BookmarkItem[];
}
