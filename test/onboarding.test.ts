import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { Platform } from "obsidian";
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
		templaterTemplates: [],
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
	const instances = opts.pluginSettings ?? {};
	return {
		plugins: {
			enabledPlugins: new Set(opts.enabled ?? []),
			manifests: Object.fromEntries(
				Object.entries(opts.installed ?? {}).map(([id, name]) => [id, { name }]),
			),
			plugins: instances,
			// Operon is probed through its own plugin object rather than the
			// enabled-plugins set, because what matters is whether it exposes the
			// Developer API accessor at all.
			getPlugin: (id: string) => instances[id] ?? null,
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

	// Operon is the one integration whose offer is not "is the plugin on": its
	// Developer API is desktop-only and only newer builds expose the accessor, so
	// the wizard must offer it exactly when a card added from the picker could
	// actually work — not merely when Operon is installed.
	const operonApp = (over: Record<string, unknown> = {}) =>
		fakeApp({
			enabled: ["operon"],
			installed: { operon: "Operon" },
			pluginSettings: { operon: { getDeveloperApiV1: () => null, ...over } },
		});

	it("offers Operon when its developer API accessor is there", () => {
		expect(detectSetup(operonApp()).integrations.map((i) => i.id)).toContain("operon");
	});

	it("does not offer Operon when it exposes no accessor", () => {
		const detection = detectSetup(
			fakeApp({
				enabled: ["operon"],
				installed: { operon: "Operon" },
				pluginSettings: { operon: {} },
			}),
		);

		expect(detection.integrations.map((i) => i.id)).not.toContain("operon");
	});

	it("does not offer Operon on mobile, where its API cannot run", () => {
		Platform.isDesktopApp = false;
		try {
			expect(detectSetup(operonApp()).integrations.map((i) => i.id)).not.toContain("operon");
		} finally {
			Platform.isDesktopApp = true;
		}
	});

	it("leaves Operon off by default — it adds a card and needs approval", () => {
		const detection = detectSetup(operonApp());

		expect(detection.integrations.find((i) => i.id === "operon")?.recommended).toBe(false);
		expect(defaultAnswers(freshSettings(), detection).integrations).not.toContain("operon");
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
					{ id: "dailyNotes", name: "Daily notes", recommended: true },
					{ id: "git", name: "Git", recommended: false },
				],
			}),
		);

		expect(answers.integrations).toEqual(["dailyNotes"]);
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
			// TaskNotes' own field names, on the card rather than in settings.
			taskNotesStatusField: "status",
			taskNotesDueField: "due",
			taskNotesPriorityField: "priority",
			taskNotesDoneValue: "done",
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

	it("seeds a tile per detected Templater template", () => {
		const templater = planCards(
			blankAnswers({ integrations: ["templater"] }),
			emptyDetection({
				templaterTemplates: ["Templates/Meeting.md", "Templates/Book note.md"],
			}),
			(i) => `c${i}`,
		).find((p) => p.id === "templater");

		expect(templater?.card.templater?.items).toEqual([
			{ id: "templater-0", label: "Meeting", icon: "file-plus-2", template: "Templates/Meeting.md" },
			{ id: "templater-1", label: "Book note", icon: "file-plus-2", template: "Templates/Book note.md" },
		]);
	});

	// The review step draws the plan and then the finish step builds it again, so
	// a card whose contents depended on the clock or the RNG would arrive
	// different from the one that was previewed.
	it("plans the same Templater card twice in a row", () => {
		const plan = (): unknown =>
			planCards(
				blankAnswers({ integrations: ["templater"] }),
				emptyDetection({ templaterTemplates: ["Templates/Meeting.md"] }),
				(i) => `c${i}`,
			).find((p) => p.id === "templater")?.card;

		expect(plan()).toEqual(plan());
	});

	// Accepting an integration whose evidence has gone (the templates were moved
	// between the detection pass and the finish step) must drop the card rather
	// than plant an empty launchpad.
	it("skips the Templater card when no templates were found", () => {
		const planned = planCards(
			blankAnswers({ integrations: ["templater"] }),
			emptyDetection(),
			(i) => `c${i}`,
		);

		expect(planned.some((p) => p.id === "templater")).toBe(false);
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

	it("plans an Operon list card when Operon is accepted", () => {
		const planned = planCards(blankAnswers({ integrations: ["operon"] }), emptyDetection(), (i) => `c${i}`);

		expect(planned.map((p) => p.id)).toContain("operon");
		expect(planned.find((p) => p.id === "operon")?.card).toMatchObject({
			kind: "operon",
			operon: { view: "list" },
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

describe("applySetup", () => {
	/** The board the wizard just built. */
	const built = (settings: HomeSettings, outcome: { dashboardId: string }) => {
		const dash = settings.dashboards.find((d) => d.id === outcome.dashboardId);
		if (!dash) throw new Error("the wizard reported a dashboard it did not install");
		return dash;
	};

	it("writes the chosen surface preset onto the board, not the vault", () => {
		const settings = freshSettings();
		const before = structuredClone(settings);
		const outcome = applySetup(
			settings,
			blankAnswers({ surface: "minimal" }),
			emptyDetection(),
		);

		expect(built(settings, outcome)).toMatchObject(SURFACE_PRESETS.minimal);
		expect(settings).toMatchObject({
			cardOpacity: before.cardOpacity,
			cardBlur: before.cardBlur,
			cardRadius: before.cardRadius,
			cardBorderWidth: before.cardBorderWidth,
		});
	});

	it("paints a flat colour at full strength rather than fading it", () => {
		const settings = freshSettings();
		const outcome = applySetup(
			settings,
			blankAnswers({ background: "color", backgroundColor: "#102030" }),
			emptyDetection(),
		);

		expect(built(settings, outcome).background).toEqual({
			kind: "color",
			value: "#102030",
			opacity: 1,
			blur: 0,
		});
	});

	it("falls back to the bundled wallpaper when a live sky has no place yet", () => {
		const settings = freshSettings();
		const outcome = applySetup(
			settings,
			blankAnswers({ background: "weather", skyValue: "" }),
			emptyDetection(),
		);

		expect(built(settings, outcome).background).toMatchObject({
			kind: "default",
			opacity: 0.35,
		});
	});

	it("keeps a weather background once a sky is picked", () => {
		const settings = freshSettings();
		const outcome = applySetup(
			settings,
			blankAnswers({ background: "weather", skyValue: "fixed:clear:auto" }),
			emptyDetection(),
		);

		expect(built(settings, outcome).background).toMatchObject({
			kind: "weather",
			value: "fixed:clear:auto",
		});
	});

	it("writes the header answers as this board's own overrides", () => {
		const settings = freshSettings();
		const outcome = applySetup(
			settings,
			blankAnswers({
				title: "Second Brain",
				showTitle: false,
				logo: "🔥",
				themeColorTarget: "both",
				showSearch: false,
				compact: true,
			}),
			emptyDetection(),
		);
		const dash = built(settings, outcome);

		expect(dash.header).toMatchObject({
			title: "Second Brain",
			showTitle: false,
			logo: "🔥",
			themeColorTarget: "both",
		});
		expect(dash.showSearch).toBe(false);
		expect(dash.compact).toBe(true);

		// None of it leaked into the vault-wide header.
		expect(settings.title).toBe(DEFAULT_SETTINGS.title);
		expect(settings.showTitle).toBe(true);
		expect(settings.logo).toBe(DEFAULT_SETTINGS.logo);
		expect(settings.themeColorTarget).toBe("none");
		expect(settings.showSearch).toBe(true);
		expect(settings.compact).toBe(false);
	});

	it("leaves the title alone when the field was left blank", () => {
		const settings = freshSettings();
		const outcome = applySetup(settings, blankAnswers({ title: "   " }), emptyDetection());

		expect(built(settings, outcome).header?.title).toBeUndefined();
	});

	it("puts the TaskNotes field mapping on the card, not in settings", () => {
		const settings = freshSettings();
		const detection = emptyDetection({
			taskNotes: parseTaskNotesSettings({
				fieldMapping: { status: "state", due: "deadline", priority: "urgency" },
				customStatuses: [{ value: "shipped", isCompleted: true }],
			}),
		});

		const outcome = applySetup(
			settings,
			blankAnswers({ integrations: ["tasknotes"] }),
			detection,
		);
		const tasks = built(settings, outcome).cards.find((c) => c.kind === "tasks");

		expect(tasks?.tasks).toMatchObject({
			source: "tasknotes",
			taskNotesStatusField: "state",
			taskNotesDueField: "deadline",
			taskNotesPriorityField: "urgency",
			taskNotesDoneValue: "shipped",
			taskNotesDoneStatuses: ["shipped"],
		});
		expect(settings).toMatchObject({
			taskNotesStatusField: DEFAULT_SETTINGS.taskNotesStatusField,
			taskNotesDueField: DEFAULT_SETTINGS.taskNotesDueField,
			taskNotesPriorityField: DEFAULT_SETTINGS.taskNotesPriorityField,
			taskNotesDoneValue: DEFAULT_SETTINGS.taskNotesDoneValue,
		});
	});

	/**
	 * The guarantee the whole module rests on, asserted wholesale rather than
	 * setting by setting: run the wizard with every answer turned away from its
	 * default and compare the settings object against an untouched clone,
	 * ignoring only the three structural fields installing a board *is*.
	 *
	 * A future answer that writes a global setting fails here even if nobody
	 * thought to write a test for it.
	 */
	it("changes nothing vault-wide but the board list and the setup flag", () => {
		const settings = freshSettings();
		const before = structuredClone(settings);

		applySetup(
			settings,
			blankAnswers({
				title: "Elsewhere",
				showTitle: false,
				logo: "🔥",
				themeColorTarget: "both",
				showSearch: false,
				surface: "minimal",
				compact: true,
				background: "color",
				backgroundColor: "#102030",
				backgroundLayout: "banner",
				purposes: ["daily", "tasks", "browsing", "insights"],
				integrations: ["dataview", "bookmarks"],
				target: "new",
				dashboardName: "Elsewhere",
			}),
			emptyDetection(),
		);

		const structural = new Set(["dashboards", "activeDashboardId", "setupStatus"]);
		for (const key of Object.keys(before) as (keyof HomeSettings)[]) {
			if (structural.has(key)) continue;
			expect({ [key]: settings[key] }).toEqual({ [key]: before[key] });
		}
		// And the boards that already existed are untouched too.
		expect(settings.dashboards[0]).toEqual(before.dashboards[0]);
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
