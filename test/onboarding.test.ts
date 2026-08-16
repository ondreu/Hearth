import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { detectSetup, taskNotesImport } from "../src/onboarding/detect";
import {
	applySetup,
	defaultAnswers,
	isUntouchedStarterBoard,
	planCards,
	SURFACE_PRESETS,
	type SetupAnswers,
} from "../src/onboarding/plan";
import type { SetupDetection } from "../src/onboarding/detect";
import { DEFAULT_SETTINGS, migrateSettings, type HomeSettings } from "../src/types";
import { parseTaskNotesSettings } from "../src/tasknotes";

/**
 * The first-run setup wizard.
 *
 * The modal itself is Obsidian UI and stays untested (per the no-mocks rule),
 * but everything it decides is pure: what the vault has, which cards that
 * implies, where they land, and what changes in settings. That is what's
 * covered here — including the two things a first impression actually hinges
 * on, that the planned board never overlaps itself and that a TaskNotes vault
 * gets a Tasks card configured with TaskNotes' *own* field names.
 */

// ---- Fixtures --------------------------------------------------------

/** A settings object in the state a fresh install reaches `applySetup` in:
 * defaults, plus the one starter dashboard `migrateSettings` builds. */
function freshSettings(): HomeSettings {
	const settings = structuredClone(DEFAULT_SETTINGS);
	migrateSettings(settings, {});
	return settings;
}

/** A detection snapshot with nothing found, unless overridden. */
function emptyDetection(over: Partial<SetupDetection> = {}): SetupDetection {
	return {
		vaultName: "Notes",
		integrations: [],
		taskNotes: null,
		basePath: null,
		kanbanPath: null,
		...over,
	};
}

/** Answers with nothing selected, so each test opts in to exactly what it is
 * about rather than inheriting the recommended defaults. */
function blankAnswers(over: Partial<SetupAnswers> = {}): SetupAnswers {
	return {
		...defaultAnswers(freshSettings(), emptyDetection()),
		purposes: [],
		integrations: [],
		...over,
	};
}

/**
 * A stand-in `App` exposing only what the detection pass reads. Same approach
 * as the integrations catalogue's test: no Obsidian behaviour is simulated,
 * just the shape of the registries the probes look at.
 */
function fakeApp(opts: {
	enabled?: string[];
	installed?: Record<string, string>;
	core?: Record<string, boolean>;
	files?: { path: string; extension: string; frontmatter?: Record<string, unknown> }[];
	pluginSettings?: Record<string, unknown>;
	vaultName?: string;
}): App {
	const files = opts.files ?? [];
	return {
		plugins: {
			enabledPlugins: new Set(opts.enabled ?? []),
			manifests: Object.fromEntries(
				Object.entries(opts.installed ?? {}).map(([id, name]) => [id, { name }]),
			),
			plugins: opts.pluginSettings ?? {},
		},
		internalPlugins: {
			getPluginById: (id: string) =>
				id in (opts.core ?? {}) ? { instance: {}, enabled: opts.core![id] } : null,
		},
		vault: {
			getName: () => opts.vaultName ?? "Notes",
			getFiles: () => files,
		},
		metadataCache: {
			getFileCache: (file: { path: string; frontmatter?: Record<string, unknown> }) =>
				files.find((f) => f.path === file.path)?.frontmatter
					? { frontmatter: files.find((f) => f.path === file.path)!.frontmatter }
					: null,
		},
	} as unknown as App;
}

// ---- Reading TaskNotes' configuration --------------------------------

describe("taskNotesImport", () => {
	it("mirrors TaskNotes' remapped field names", () => {
		const setup = parseTaskNotesSettings({
			fieldMapping: { status: "state", due: "deadline", priority: "urgency" },
		});

		expect(taskNotesImport(setup)).toMatchObject({
			statusField: "state",
			dueField: "deadline",
			priorityField: "urgency",
		});
	});

	it("collects every status TaskNotes counts as complete", () => {
		const setup = parseTaskNotesSettings({
			customStatuses: [
				{ value: "open", label: "Open", order: 0 },
				{ value: "done", label: "Done", isCompleted: true, order: 2 },
				{ value: "cancelled", label: "Cancelled", isCompleted: true, order: 3 },
			],
		});

		const imported = taskNotesImport(setup);
		expect(imported.doneStatuses).toEqual(["done", "cancelled"]);
		// The single global done-value takes the first, in TaskNotes' own order.
		expect(imported.doneValue).toBe("done");
	});

	it("falls back to a usable done-value when no status is marked complete", () => {
		const imported = taskNotesImport(parseTaskNotesSettings({ customStatuses: [] }));

		expect(imported.doneValue).toBe("done");
		expect(imported.doneStatuses).toEqual([]);
	});
});

// ---- Detection -------------------------------------------------------

describe("detectSetup", () => {
	it("offers only plugins that are installed and enabled", () => {
		const detection = detectSetup(
			fakeApp({
				enabled: ["dataview"],
				installed: { dataview: "Dataview", "obsidian-git": "Git" },
			}),
		);

		expect(detection.integrations.map((i) => i.id)).toEqual(["dataview"]);
	});

	it("names an integration after its own manifest", () => {
		const detection = detectSetup(
			fakeApp({ enabled: ["tasknotes"], installed: { tasknotes: "TaskNotes (fork)" } }),
		);

		expect(detection.integrations[0].name).toBe("TaskNotes (fork)");
	});

	it("reads TaskNotes' settings off the running plugin", () => {
		const detection = detectSetup(
			fakeApp({
				enabled: ["tasknotes"],
				pluginSettings: {
					tasknotes: {
						settings: {
							fieldMapping: { due: "deadline" },
							customStatuses: [{ value: "shipped", isCompleted: true }],
						},
					},
				},
			}),
		);

		expect(detection.taskNotes?.fields.due).toBe("deadline");
		expect(taskNotesImport(detection.taskNotes!).doneValue).toBe("shipped");
	});

	it("finds a Kanban board by its frontmatter, plugin or no plugin", () => {
		const detection = detectSetup(
			fakeApp({
				files: [
					{ path: "Notes/Plain.md", extension: "md" },
					{ path: "Boards/Work.md", extension: "md", frontmatter: { "kanban-plugin": "board" } },
				],
			}),
		);

		expect(detection.kanbanPath).toBe("Boards/Work.md");
		expect(detection.integrations.map((i) => i.id)).toContain("kanban");
	});

	it("does not offer Kanban alongside TaskNotes — one card has one source", () => {
		const detection = detectSetup(
			fakeApp({
				enabled: ["tasknotes"],
				files: [
					{ path: "Boards/Work.md", extension: "md", frontmatter: { "kanban-plugin": "board" } },
				],
			}),
		);

		expect(detection.integrations.map((i) => i.id)).toContain("tasknotes");
		expect(detection.integrations.map((i) => i.id)).not.toContain("kanban");
	});

	it("only offers a base when Bases is on and the vault has one", () => {
		const files = [{ path: "Tables/Books.base", extension: "base" }];

		expect(detectSetup(fakeApp({ files })).basePath).toBeNull();
		expect(detectSetup(fakeApp({ files, core: { bases: true } })).basePath).toBe(
			"Tables/Books.base",
		);
	});

	it("survives an app whose internals are missing entirely", () => {
		expect(() => detectSetup({} as App)).not.toThrow();
		expect(detectSetup({} as App).integrations).toEqual([]);
	});
});

// ---- Default answers -------------------------------------------------

describe("defaultAnswers", () => {
	it("seeds the title from the vault name", () => {
		const answers = defaultAnswers(freshSettings(), emptyDetection({ vaultName: "Second Brain" }));

		expect(answers.title).toBe("Second Brain");
	});

	it("pre-accepts only the recommended integrations", () => {
		const answers = defaultAnswers(
			freshSettings(),
			emptyDetection({
				integrations: [
					{ id: "omnisearch", name: "Omnisearch", recommended: true },
					{ id: "git", name: "Git", recommended: false },
				],
			}),
		);

		expect(answers.integrations).toEqual(["omnisearch"]);
	});

	it("assumes someone running a task plugin wants tasks on their board", () => {
		const answers = defaultAnswers(
			freshSettings(),
			emptyDetection({
				integrations: [{ id: "tasknotes", name: "TaskNotes", recommended: true }],
			}),
		);

		expect(answers.purposes).toContain("tasks");
	});
});

// ---- Planning the board ----------------------------------------------

describe("planCards", () => {
	const ids = (answers: SetupAnswers, detection = emptyDetection()): string[] =>
		planCards(answers, detection, (i) => `c${i}`).map((p) => p.id);

	it("always starts with a full-width clock", () => {
		const [first] = planCards(blankAnswers(), emptyDetection(), (i) => `c${i}`);

		expect(first.id).toBe("clock");
		expect(first.card).toMatchObject({ kind: "clock", x: 0, y: 0, w: 12 });
	});

	it("adds a card group per chosen purpose", () => {
		expect(ids(blankAnswers({ purposes: ["browsing"] }))).toEqual([
			"clock",
			"recent",
			"favorites",
		]);
		expect(ids(blankAnswers({ purposes: ["insights"] }))).toEqual(["clock", "stats", "heatmap"]);
	});

	it("gives a planning board the full calendar and a journaling board the mini one", () => {
		expect(ids(blankAnswers({ purposes: ["planning"] }))).toContain("schedule");
		expect(ids(blankAnswers({ purposes: ["daily"] }))).toContain("calendar");
		// Both chosen: the full calendar supersedes the mini one rather than
		// stacking two calendars on one board.
		const both = ids(blankAnswers({ purposes: ["daily", "planning"] }));
		expect(both).toContain("schedule");
		expect(both).not.toContain("calendar");
	});

	it("adds the Tasks card exactly once when a purpose and an integration both ask", () => {
		const planned = ids(
			blankAnswers({ purposes: ["tasks"], integrations: ["tasknotes"] }),
			emptyDetection({ taskNotes: parseTaskNotesSettings({}) }),
		);

		expect(planned.filter((id) => id === "tasks")).toHaveLength(1);
	});

	it("configures the Tasks card for TaskNotes, completed statuses included", () => {
		const detection = emptyDetection({
			taskNotes: parseTaskNotesSettings({
				customStatuses: [
					{ value: "todo", order: 0 },
					{ value: "done", isCompleted: true, order: 1 },
					{ value: "cancelled", isCompleted: true, order: 2 },
				],
			}),
		});

		const tasks = planCards(
			blankAnswers({ integrations: ["tasknotes"] }),
			detection,
			(i) => `c${i}`,
		).find((p) => p.id === "tasks");

		expect(tasks?.card.tasks).toEqual({
			source: "tasknotes",
			taskNotesDoneStatuses: ["done", "cancelled"],
		});
		expect(tasks?.reason).toBe("tasknotes");
	});

	it("points the Tasks card at the detected Kanban board", () => {
		const tasks = planCards(
			blankAnswers({ integrations: ["kanban"] }),
			emptyDetection({ kanbanPath: "Boards/Work.md" }),
			(i) => `c${i}`,
		).find((p) => p.id === "tasks");

		expect(tasks?.card.tasks).toEqual({
			source: "kanban",
			kanbanFile: "Boards/Work.md",
			layout: "kanban",
		});
	});

	it("embeds the detected base under its own name", () => {
		const base = planCards(
			blankAnswers({ integrations: ["bases"] }),
			emptyDetection({ basePath: "Tables/Reading list.base" }),
			(i) => `c${i}`,
		).find((p) => p.id === "base");

		expect(base?.card).toMatchObject({
			kind: "embed",
			target: "Tables/Reading list.base",
			title: "Reading list",
		});
	});

	it("lays every card out without overlapping, inside the grid", () => {
		const planned = planCards(
			blankAnswers({
				purposes: ["daily", "tasks", "planning", "browsing", "capture", "insights", "reading", "ambience"],
				integrations: ["dataview", "git", "bookmarks"],
			}),
			emptyDetection(),
			(i) => `c${i}`,
		);

		expect(planned.length).toBeGreaterThan(10);
		for (const { card } of planned) {
			expect(card.x).toBeGreaterThanOrEqual(0);
			expect(card.x + card.w).toBeLessThanOrEqual(12);
		}
		for (const a of planned) {
			for (const b of planned) {
				if (a === b) continue;
				const overlaps =
					a.card.x < b.card.x + b.card.w &&
					a.card.x + a.card.w > b.card.x &&
					a.card.y < b.card.y + b.card.h &&
					a.card.y + a.card.h > b.card.y;
				expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
			}
		}
	});

	it("gives every card a distinct id", () => {
		const planned = planCards(
			blankAnswers({ purposes: ["daily", "browsing", "insights"] }),
			emptyDetection(),
		);
		const seen = new Set(planned.map((p) => p.card.id));

		expect(seen.size).toBe(planned.length);
	});
});

// ---- Applying the answers --------------------------------------------

describe("applySetup — replacing a board writes the look to the vault", () => {
	it("writes the chosen surface preset", () => {
		const settings = freshSettings();
		applySetup(settings, blankAnswers({ surface: "minimal" }), emptyDetection());

		expect(settings).toMatchObject(SURFACE_PRESETS.minimal);
	});

	it("paints a flat colour at full strength rather than fading it", () => {
		const settings = freshSettings();
		applySetup(
			settings,
			blankAnswers({ background: "color", backgroundColor: "#102030" }),
			emptyDetection(),
		);

		expect(settings.backgroundKind).toBe("color");
		expect(settings.backgroundValue).toBe("#102030");
		expect(settings.backgroundOpacity).toBe(1);
		expect(settings.backgroundBlur).toBe(0);
	});

	it("falls back to the bundled wallpaper when a live sky has no place yet", () => {
		const settings = freshSettings();
		applySetup(settings, blankAnswers({ background: "weather", skyValue: "" }), emptyDetection());

		expect(settings.backgroundKind).toBe("default");
		expect(settings.backgroundOpacity).toBe(0.35);
	});

	it("keeps a weather background once a sky is picked", () => {
		const settings = freshSettings();
		applySetup(
			settings,
			blankAnswers({ background: "weather", skyValue: "fixed:clear:auto" }),
			emptyDetection(),
		);

		expect(settings.backgroundKind).toBe("weather");
		expect(settings.backgroundValue).toBe("fixed:clear:auto");
	});

	it("leaves the replaced board carrying no overrides of its own", () => {
		const settings = freshSettings();
		applySetup(
			settings,
			blankAnswers({ backgroundLayout: "banner", surface: "solid" }),
			emptyDetection(),
		);

		const board = settings.dashboards[0];
		expect(settings.backgroundLayout).toBe("banner");
		expect(board.backgroundLayout).toBeUndefined();
		expect(board.background).toBeUndefined();
		expect(board.cardOpacity).toBeUndefined();
		expect(board.header).toBeUndefined();
	});

	it("clears a stale override that would otherwise ignore the new choice", () => {
		const settings = freshSettings();
		// A board already wearing its own wallpaper: without clearing, the global
		// value the wizard just wrote would never be seen.
		settings.dashboards[0].background = {
			kind: "color",
			value: "#ff0000",
			opacity: 1,
			blur: 0,
		};
		settings.dashboards[0].cardOpacity = 0.1;
		settings.dashboards[0].header = { title: "Old", align: "left" };

		applySetup(settings, blankAnswers({ background: "none" }), emptyDetection());

		const board = settings.dashboards[0];
		expect(board.background).toBeUndefined();
		expect(board.cardOpacity).toBeUndefined();
		expect(board.header?.title).toBeUndefined();
		// Header settings the wizard never asks about survive.
		expect(board.header?.align).toBe("left");
	});
});

describe("applySetup — adding a board keeps the look on that board", () => {
	/** Apply to a vault whose existing board has a deliberate look of its own,
	 * and hand back both boards. */
	function addBoard(over: Partial<SetupAnswers> = {}) {
		const settings = freshSettings();
		const existing = settings.dashboards[0];
		const before = {
			backgroundKind: settings.backgroundKind,
			backgroundLayout: settings.backgroundLayout,
			cardOpacity: settings.cardOpacity,
			compact: settings.compact,
			title: settings.title,
			showSearch: settings.showSearch,
			themeColorTarget: settings.themeColorTarget,
		};

		applySetup(settings, blankAnswers({ target: "new", ...over }), emptyDetection());

		return { settings, existing, added: settings.dashboards[1], before };
	}

	it("puts the banner layout on the new board, not on the vault", () => {
		const { settings, added, before } = addBoard({ backgroundLayout: "banner" });

		expect(added.backgroundLayout).toBe("banner");
		expect(settings.backgroundLayout).toBe(before.backgroundLayout);
		expect(settings.backgroundLayout).toBe("full");
	});

	it("puts the background on the new board, not on the vault", () => {
		const { settings, added, before } = addBoard({
			background: "color",
			backgroundColor: "#102030",
		});

		expect(added.background).toEqual({
			kind: "color",
			value: "#102030",
			opacity: 1,
			blur: 0,
		});
		expect(settings.backgroundKind).toBe(before.backgroundKind);
		expect(settings.backgroundValue).toBe("");
	});

	it("puts the card surface on the new board, not on the vault", () => {
		const { settings, added, before } = addBoard({ surface: "minimal" });

		expect(added).toMatchObject(SURFACE_PRESETS.minimal);
		expect(settings.cardOpacity).toBe(before.cardOpacity);
		expect(settings.cardBlur).toBe(DEFAULT_SETTINGS.cardBlur);
	});

	it("puts the title, logo and search bar on the new board, not on the vault", () => {
		const { settings, added, before } = addBoard({
			title: "Planning",
			logo: "📅",
			showSearch: false,
		});

		expect(added.header).toMatchObject({ title: "Planning", logo: "📅", showTitle: true });
		expect(added.showSearch).toBe(false);
		expect(settings.title).toBe(before.title);
		expect(settings.showSearch).toBe(before.showSearch);
	});

	it("leaves an existing board completely untouched", () => {
		const { existing } = addBoard({
			backgroundLayout: "banner",
			background: "color",
			surface: "minimal",
			title: "Planning",
		});

		expect(existing.backgroundLayout).toBeUndefined();
		expect(existing.background).toBeUndefined();
		expect(existing.cardOpacity).toBeUndefined();
		expect(existing.header).toBeUndefined();
		expect(existing.showSearch).toBeUndefined();
	});

	it("never touches the two vault-wide settings that have no per-board home", () => {
		const { settings, before } = addBoard({ compact: true, themeColorTarget: "both" });

		expect(settings.compact).toBe(before.compact);
		expect(settings.themeColorTarget).toBe(before.themeColorTarget);
	});

	it("still applies vault-wide behaviour and integration answers", () => {
		const { settings } = addBoard({ openOnStartup: false, integrations: ["omnisearch"] });

		// These have no per-board equivalent *and* are what the user asked for at
		// the vault level, so an added board still sets them.
		expect(settings.openOnStartup).toBe(false);
		expect(settings.searchEngine).toBe("omnisearch");
	});

	it("declines to override the title when the field was cleared", () => {
		const { settings, added } = addBoard({ title: "  " });

		expect(added.header?.title).toBeUndefined();
		expect(settings.title).toBe(DEFAULT_SETTINGS.title);
	});
});

describe("applySetup", () => {

	it("syncs the TaskNotes field mapping into settings", () => {
		const settings = freshSettings();
		const detection = emptyDetection({
			taskNotes: parseTaskNotesSettings({
				fieldMapping: { status: "state", due: "deadline", priority: "urgency" },
				customStatuses: [{ value: "shipped", isCompleted: true }],
			}),
		});

		applySetup(settings, blankAnswers({ integrations: ["tasknotes"] }), detection);

		expect(settings).toMatchObject({
			taskNotesStatusField: "state",
			taskNotesDueField: "deadline",
			taskNotesPriorityField: "urgency",
			taskNotesDoneValue: "shipped",
		});
	});

	it("switches the search engine only when Omnisearch is accepted", () => {
		const declined = freshSettings();
		applySetup(declined, blankAnswers(), emptyDetection());
		expect(declined.searchEngine).toBe("builtin");

		const accepted = freshSettings();
		applySetup(accepted, blankAnswers({ integrations: ["omnisearch"] }), emptyDetection());
		expect(accepted.searchEngine).toBe("omnisearch");
	});

	it("never turns an integration off — declining leaves settings alone", () => {
		const settings = freshSettings();
		settings.searchEngine = "omnisearch";
		settings.customFileIcons = true;

		applySetup(settings, blankAnswers({ integrations: [] }), emptyDetection());

		expect(settings.searchEngine).toBe("omnisearch");
		expect(settings.customFileIcons).toBe(true);
	});

	it("replaces the active board's cards when asked to replace", () => {
		const settings = freshSettings();
		const before = settings.dashboards[0].id;

		const outcome = applySetup(
			settings,
			blankAnswers({ target: "replace", dashboardName: "Home", purposes: ["browsing"] }),
			emptyDetection(),
		);

		expect(settings.dashboards).toHaveLength(1);
		expect(settings.dashboards[0].id).toBe(before);
		expect(settings.dashboards[0].name).toBe("Home");
		expect(settings.dashboards[0].cards).toHaveLength(outcome.cardCount);
		expect(outcome.replaced).toBe(true);
	});

	it("adds a board beside the existing one when asked for a new dashboard", () => {
		const settings = freshSettings();
		const original = settings.dashboards[0];
		const originalCards = original.cards.length;

		const outcome = applySetup(
			settings,
			blankAnswers({ target: "new", dashboardName: "Planning" }),
			emptyDetection(),
		);

		expect(settings.dashboards).toHaveLength(2);
		expect(original.cards).toHaveLength(originalCards);
		expect(settings.activeDashboardId).toBe(outcome.dashboardId);
		expect(settings.dashboards[1].name).toBe("Planning");
	});

	it("still builds a board when settings hold no dashboards at all", () => {
		const settings = freshSettings();
		settings.dashboards = [];

		const outcome = applySetup(settings, blankAnswers({ target: "replace" }), emptyDetection());

		expect(settings.dashboards).toHaveLength(1);
		expect(outcome.replaced).toBe(false);
		expect(settings.activeDashboardId).toBe(outcome.dashboardId);
	});

	it("lets a tall board scroll instead of squeezing it onto one screen", () => {
		const settings = freshSettings();
		applySetup(
			settings,
			blankAnswers({
				target: "new",
				purposes: [
					"daily",
					"tasks",
					"planning",
					"browsing",
					"capture",
					"insights",
					"reading",
					"ambience",
				],
			}),
			emptyDetection(),
		);

		expect(settings.dashboards[1].fitToPage).toBe(false);
		// The global default is untouched — only this board opts out.
		expect(settings.fitToPage).toBe(true);
	});

	it("leaves a board that comfortably fits on fit-to-page", () => {
		const settings = freshSettings();
		applySetup(settings, blankAnswers({ target: "new", purposes: ["browsing"] }), emptyDetection());

		expect(settings.dashboards[1].fitToPage).toBeUndefined();
	});

	it("records the run as done", () => {
		const settings = freshSettings();
		applySetup(settings, blankAnswers(), emptyDetection());

		expect(settings.setupStatus).toBe("done");
	});
});

// ---- Which board the wizard offers to replace ------------------------

describe("isUntouchedStarterBoard", () => {
	it("recognises the freshly seeded starter board", () => {
		expect(isUntouchedStarterBoard(freshSettings())).toBe(true);
	});

	it("notices a card added or removed", () => {
		const added = freshSettings();
		added.dashboards[0].cards.push({ id: "card-mine", kind: "text", x: 0, y: 0, w: 2, h: 2 });
		expect(isUntouchedStarterBoard(added)).toBe(false);

		const removed = freshSettings();
		removed.dashboards[0].cards.pop();
		expect(isUntouchedStarterBoard(removed)).toBe(false);
	});

	it("does not count rearranging as making the board your own", () => {
		const moved = freshSettings();
		moved.dashboards[0].cards[0].x = 4;
		moved.dashboards[0].cards[0].y = 9;

		expect(isUntouchedStarterBoard(moved)).toBe(true);
	});
});

// ---- Who gets offered the wizard -------------------------------------

describe("setupStatus migration", () => {
	it("offers the wizard to a vault with no persisted settings", () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		migrateSettings(settings, {});

		expect(settings.setupStatus).toBe("pending");
	});

	it("never interrupts an existing vault that predates the wizard", () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		migrateSettings(settings, { title: "My vault", gridColumns: 12 });

		expect(settings.setupStatus).toBe("done");
	});

	it("keeps a recorded status", () => {
		const skipped = structuredClone(DEFAULT_SETTINGS);
		skipped.setupStatus = "skipped";
		migrateSettings(skipped, { setupStatus: "skipped" });

		expect(skipped.setupStatus).toBe("skipped");
	});

	it("treats an unrecognised status as done rather than re-prompting", () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		settings.setupStatus = "nonsense" as HomeSettings["setupStatus"];
		migrateSettings(settings, { setupStatus: "nonsense" });

		expect(settings.setupStatus).toBe("done");
	});
});
