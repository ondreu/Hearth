/**
 * What the setup wizard can find in a vault before it asks a single question.
 *
 * The wizard's promise is that it does the looking: rather than presenting a
 * list of everything Hearth *could* talk to (that is the Integrations
 * catalogue's job — see `src/integrations.ts`), it reports only what is
 * actually installed and enabled *here*, and offers to wire each one up.
 *
 * Everything in this module is either a plain probe of the running app or a
 * pure function of what a probe returned, so the interesting part — reading
 * TaskNotes' own configuration well enough that a Tasks card works on the
 * first render — is unit-testable without an Obsidian instance.
 */
import type { App, TFile } from "obsidian";
import { DATACORE_PLUGIN_ID } from "../datacore";
import { DATAVIEW_PLUGIN_ID } from "../dataview";
import { ICONIC_PLUGIN_ID, ICONIZE_PLUGIN_ID } from "../fileicons";
import { GIT_PLUGIN_ID } from "../git";
import { OMNISEARCH_PLUGIN_ID } from "../omnisearch";
import { TASKNOTES_PLUGIN_ID, readTaskNotesSetup, type TaskNotesSetup } from "../tasknotes";
import { TEMPLATER_PLUGIN_ID, templaterTemplateFiles } from "../templater";

/** Community plugin id for the Kanban plugin, whose boards the Tasks card can
 * read as a task source. Declared here rather than in `cards/tasks.ts` because
 * that module identifies a board by its frontmatter key, not by the plugin. */
export const KANBAN_PLUGIN_ID = "obsidian-kanban";

/**
 * The integrations the wizard offers to set up.
 *
 * Deliberately a *subset* of `INTEGRATIONS`: an entry earns a place here only
 * when accepting it has a concrete, automatic effect — a card added and
 * configured, or a setting flipped. Anything Hearth merely tolerates (Canvas,
 * Excalidraw, the file explorer) has nothing for the wizard to do and would
 * only be a question with no answer worth giving.
 */
export type SetupIntegrationId =
	| "tasknotes"
	| "kanban"
	| "dataview"
	| "datacore"
	| "templater"
	| "git"
	| "omnisearch"
	| "fileIcons"
	| "bases"
	| "dailyNotes"
	| "bookmarks";

/** One integration found in this vault, ready to be offered. */
export interface DetectedIntegration {
	id: SetupIntegrationId;
	/** The name to show — the installed plugin's own display name where one is
	 * available, so a renamed or forked build still reads correctly. */
	name: string;
	/** Whether accepting it is on by default. Set for the ones whose effect is
	 * unambiguous (a field mapping, a search engine); left off for the ones that
	 * add a card the user may not want. */
	recommended: boolean;
}

/** Everything the wizard learned about the vault in one pass. */
export interface SetupDetection {
	/** The vault's name, used to seed the dashboard title. */
	vaultName: string;
	/** Integrations found, in offer order. */
	integrations: DetectedIntegration[];
	/** TaskNotes' own configuration, read from the running plugin. Null when
	 * TaskNotes isn't enabled. */
	taskNotes: TaskNotesSetup | null;
	/** Path of a `.base` file to embed, when Bases is available and the vault
	 * has one. */
	basePath: string | null;
	/** Path of a Kanban board note, when one exists. */
	kanbanPath: string | null;
	/** Paths of the templates Templater would offer, capped at
	 * {@link TEMPLATER_TILE_LIMIT}. Empty when Templater isn't enabled or has no
	 * templates yet. The wizard seeds one tile per entry, so the card arrives
	 * with the user's own templates on it rather than blank. */
	templaterTemplates: string[];
}

/** How many template tiles the wizard seeds. Enough to show what the card is
 * for; a vault with forty templates does not want forty buttons chosen for it,
 * and adding more is one click in the card's settings. */
export const TEMPLATER_TILE_LIMIT = 6;

/** Whether a community plugin is installed *and* on. */
function pluginEnabled(app: App, id: string): boolean {
	try {
		return app.plugins?.enabledPlugins?.has(id) === true;
	} catch {
		return false;
	}
}

/** Whether a core (internal) plugin is on. Returns false for an id this
 * Obsidian version doesn't know — Bases only exists in 1.9+. */
function corePluginEnabled(app: App, id: string): boolean {
	try {
		return app.internalPlugins?.getPluginById(id)?.enabled === true;
	} catch {
		return false;
	}
}

/** An installed plugin's own display name, falling back to `fallback` when the
 * manifest can't be read. */
function pluginName(app: App, id: string, fallback: string): string {
	try {
		// `manifests` is an Obsidian internal typed only as far as "some object
		// per id", so the display name is read defensively rather than assumed.
		const manifest = app.plugins?.manifests?.[id] as { name?: unknown } | undefined;
		const name = manifest?.name;
		return typeof name === "string" && name.trim() ? name : fallback;
	} catch {
		return fallback;
	}
}

/** The first file in the vault matching `test`, or null. Never throws: this
 * runs while the wizard is being built. */
function findFile(app: App, test: (file: TFile) => boolean): TFile | null {
	try {
		return app.vault.getFiles().find(test) ?? null;
	} catch {
		return null;
	}
}

/** The frontmatter key the Kanban plugin writes into a board note. */
const KANBAN_FRONTMATTER_KEY = "kanban-plugin";

/** A Kanban board note in the vault, or null. Looks at frontmatter rather than
 * the plugin, because a board is readable whether or not Kanban is enabled —
 * which is exactly why Hearth can read one at all. */
function findKanbanBoard(app: App): string | null {
	const file = findFile(app, (f) => {
		if (f.extension !== "md") return false;
		const fm = app.metadataCache.getFileCache(f)?.frontmatter;
		return !!fm && KANBAN_FRONTMATTER_KEY in fm;
	});
	return file?.path ?? null;
}

/**
 * Look through the vault once and report everything the wizard can offer.
 *
 * Every probe is guarded: several read Obsidian internals (`plugins.manifests`,
 * `internalPlugins`) that a given version may not expose, and a throw here
 * would take down the wizard before it ever drew a step.
 */
export function detectSetup(app: App): SetupDetection {
	const integrations: DetectedIntegration[] = [];

	const taskNotesOn = pluginEnabled(app, TASKNOTES_PLUGIN_ID);
	if (taskNotesOn) {
		integrations.push({
			id: "tasknotes",
			name: pluginName(app, TASKNOTES_PLUGIN_ID, "TaskNotes"),
			recommended: true,
		});
	}

	const kanbanPath = findKanbanBoard(app);
	// Offered on the strength of a board existing, not of the plugin being on:
	// Hearth parses the note itself. But never alongside TaskNotes — one Tasks
	// card has one source, and TaskNotes is the richer of the two.
	if (kanbanPath && !taskNotesOn) {
		integrations.push({
			id: "kanban",
			name: pluginName(app, KANBAN_PLUGIN_ID, "Kanban"),
			recommended: false,
		});
	}

	if (pluginEnabled(app, DATAVIEW_PLUGIN_ID)) {
		integrations.push({
			id: "dataview",
			name: pluginName(app, DATAVIEW_PLUGIN_ID, "Dataview"),
			recommended: false,
		});
	}

	if (pluginEnabled(app, DATACORE_PLUGIN_ID)) {
		integrations.push({
			id: "datacore",
			name: pluginName(app, DATACORE_PLUGIN_ID, "Datacore"),
			recommended: false,
		});
	}

	// Offered on the strength of templates existing, not merely of the plugin
	// being on: a Templater install with no templates yet has nothing for the
	// card to put on a tile, and a card of zero buttons is worse than no card.
	const templaterTemplates = pluginEnabled(app, TEMPLATER_PLUGIN_ID)
		? findTemplaterTemplates(app)
		: [];
	if (templaterTemplates.length > 0) {
		integrations.push({
			id: "templater",
			name: pluginName(app, TEMPLATER_PLUGIN_ID, "Templater"),
			recommended: false,
		});
	}

	if (pluginEnabled(app, GIT_PLUGIN_ID)) {
		integrations.push({
			id: "git",
			name: pluginName(app, GIT_PLUGIN_ID, "Git"),
			recommended: false,
		});
	}

	if (pluginEnabled(app, OMNISEARCH_PLUGIN_ID)) {
		integrations.push({
			id: "omnisearch",
			name: pluginName(app, OMNISEARCH_PLUGIN_ID, "Omnisearch"),
			recommended: true,
		});
	}

	// Iconic and Iconize are interchangeable as far as Hearth is concerned —
	// both feed the one "use the icons you already set" switch — so they are
	// offered as a single row named after whichever is actually installed.
	const iconic = pluginEnabled(app, ICONIC_PLUGIN_ID);
	const iconize = pluginEnabled(app, ICONIZE_PLUGIN_ID);
	if (iconic || iconize) {
		integrations.push({
			id: "fileIcons",
			name: iconic
				? pluginName(app, ICONIC_PLUGIN_ID, "Iconic")
				: pluginName(app, ICONIZE_PLUGIN_ID, "Iconize"),
			recommended: true,
		});
	}

	const basePath = corePluginEnabled(app, "bases")
		? (findFile(app, (f) => f.extension === "base")?.path ?? null)
		: null;
	if (basePath) {
		integrations.push({ id: "bases", name: "Bases", recommended: false });
	}

	if (corePluginEnabled(app, "daily-notes")) {
		integrations.push({ id: "dailyNotes", name: "Daily notes", recommended: true });
	}

	if (corePluginEnabled(app, "bookmarks")) {
		integrations.push({ id: "bookmarks", name: "Bookmarks", recommended: false });
	}

	return {
		vaultName: safeVaultName(app),
		integrations,
		taskNotes: taskNotesOn ? readTaskNotesSetup(app) : null,
		basePath,
		kanbanPath,
		templaterTemplates,
	};
}

/** The first few templates Templater would offer, by path. Never throws: this
 * runs while the wizard is being built. */
function findTemplaterTemplates(app: App): string[] {
	try {
		return templaterTemplateFiles(app)
			.slice(0, TEMPLATER_TILE_LIMIT)
			.map((file) => file.path);
	} catch {
		return [];
	}
}

/** The vault's name, or "" when it can't be read. */
function safeVaultName(app: App): string {
	try {
		return app.vault.getName() || "";
	} catch {
		return "";
	}
}

/**
 * The slice of TaskNotes' configuration Hearth needs to mirror, reduced to the
 * four settings a Tasks card reads.
 *
 * This is the whole point of detecting TaskNotes rather than merely noticing
 * it: its field names are user-remappable and its statuses are user-defined,
 * so a Tasks card switched to the TaskNotes source without this shows nothing
 * at all in a vault that renamed `due` to `deadline`. Copying the mapping
 * across at setup time means the card works on its first render.
 */
export interface TaskNotesImport {
	statusField: string;
	dueField: string;
	priorityField: string;
	/** The single status written when a task is completed. */
	doneValue: string;
	/** Every status TaskNotes counts as complete, so a card treats "cancelled"
	 * as finished too rather than showing it as outstanding forever. */
	doneStatuses: string[];
}

/**
 * Reduce a parsed TaskNotes configuration to the mapping Hearth stores.
 *
 * Pure, and total: a vault whose TaskNotes defines no completed status at all
 * still yields a usable `doneValue` (its documented default, "done"), because
 * a Tasks card with an empty done-value can never mark anything complete.
 */
export function taskNotesImport(setup: TaskNotesSetup): TaskNotesImport {
	const doneStatuses = setup.statuses.filter((s) => s.isCompleted).map((s) => s.value);
	return {
		statusField: setup.fields.status,
		dueField: setup.fields.due,
		priorityField: setup.fields.priority,
		doneValue: doneStatuses[0] ?? "done",
		doneStatuses,
	};
}
