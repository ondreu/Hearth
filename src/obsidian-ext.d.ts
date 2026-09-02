import "obsidian";
import { Command, EventRef, TFile, TFolder } from "obsidian";
import type { GitStatus } from "./git";

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
			/** Manifests of every *installed* community plugin, keyed by id —
			 * present whether or not the plugin is enabled, which is how the
			 * integrations catalogue tells "installed but off" from "not
			 * installed". Optional: it's an internal, so treat it as absent. */
			manifests?: Record<string, unknown>;
			/** The loaded instance of one community plugin, or null. Same object
			 * as `plugins[id]`; Operon's Developer API documents this accessor
			 * and verifies consumers against it, so integrations use it. */
			getPlugin(id: string): unknown;
		};
		/** Registry of every view type registered via `registerView` (core and
		 * community). `viewByType` is keyed by the view-type id. Used by the
		 * "leaf" card to discover hostable side-panel views. */
		viewRegistry?: {
			viewByType?: Record<string, unknown>;
		};
	}

	/**
	 * The events the obsidian-git community plugin fires on the workspace.
	 *
	 * `Workspace` redeclares `on` with one overload per built-in event, which
	 * hides the `on(name: string, …)` signature it inherits from `Events` — so
	 * a plugin-defined event needs its own overload to be listenable at all.
	 * (`trigger` is untyped by name and needs nothing.) Declared here rather
	 * than cast at the call site so the callback payloads stay typed.
	 *
	 * See `src/git.ts` for what each one means.
	 */
	interface Workspace {
		on(name: "obsidian-git:refreshed", callback: () => unknown, ctx?: unknown): EventRef;
		on(
			name: "obsidian-git:status-changed",
			callback: (status: GitStatus) => unknown,
			ctx?: unknown,
		): EventRef;
		on(name: "obsidian-git:head-change", callback: () => unknown, ctx?: unknown): EventRef;
		on(name: "obsidian-git:loading-status", callback: () => unknown, ctx?: unknown): EventRef;
	}

	/**
	 * The adapter-level file event. `Vault.on` declares one overload per public
	 * event (create/modify/delete/rename), which hides the inherited
	 * `on(name: string, …)` — so listening to `raw` needs its own overload.
	 *
	 * Unlike the public events, `raw` reports every path the adapter sees change,
	 * the config folder included. That makes it the only way to notice Hearth's
	 * own `data.json` being rewritten by sync (see `src/settingssync.ts`). It's
	 * an internal, but a long-standing one: it is how core Obsidian picks up an
	 * edited CSS snippet, and community plugins have listened to it for years.
	 */
	interface Vault {
		on(name: "raw", callback: (path: string) => unknown, ctx?: unknown): EventRef;
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
