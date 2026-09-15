import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, type App } from "obsidian";
import {
	cacheKey,
	cachedPath,
	createJournalNote,
	errorCode,
	forget,
	forgetAll,
	getJournalsApi,
	isJournalsEnabled,
	JOURNAL_CACHE_TTL_MS,
	listJournals,
	peekNote,
	today,
} from "../src/journals";

/**
 * The Journals integration (issue #318).
 *
 * No Obsidian API is mocked here, per the project's rule: the stand-in `app`
 * is the plugin *registry* — a plain object Hearth reads a foreign plugin off,
 * exactly as `integrations.test.ts` does — and the stand-in `api` is that
 * foreign plugin's own object, which Hearth treats as untrusted data whatever
 * it turns out to be. Nothing here touches the vault, the workspace or a
 * render.
 *
 * What's covered is the part that decides *what Hearth believes about another
 * plugin's data*, and it is the part with teeth, because the card renders
 * synchronously against an API that is entirely asynchronous: when a cached
 * answer is served, when it is refreshed, when the card is told to redraw, and
 * what happens when Journals answers oddly, slowly, or not at all.
 */

/** One call's worth of stand-in Journals API, plus a count of what was asked. */
function fakeJournals(opts: {
	notes?: Record<string, { path: string | null } | undefined>;
	journals?: readonly { name: string }[];
	notesForThrows?: Error;
	created?: TFile | null;
} = {}) {
	const calls = { notesFor: 0, journalInfo: 0, listJournals: 0, ensureNote: 0 };
	const api = {
		apiVersion: 1,
		notesFor: (selector: unknown) => {
			calls.notesFor += 1;
			if (opts.notesForThrows) return Promise.reject(opts.notesForThrows);
			const note = opts.notes?.[String(selector)];
			return Promise.resolve(note ? [note] : []);
		},
		journalInfo: (name: string) => {
			calls.journalInfo += 1;
			return Promise.resolve(opts.journals?.find((j) => j.name === name) ?? null);
		},
		listJournals: () => {
			calls.listJournals += 1;
			return Promise.resolve(opts.journals ?? []);
		},
		ensureNote: () => {
			calls.ensureNote += 1;
			return Promise.resolve({ note: { path: "J/now.md", file: opts.created ?? null }, created: true });
		},
	};
	const app = { plugins: { plugins: { journals: { api } } } } as unknown as App;
	return { app, api, calls };
}

/**
 * Let the in-flight lookup settle. The cache is promise-driven and nothing here
 * waits on a timer, so draining the microtask queue is both enough and exact —
 * a real `setTimeout` would only make these tests slower and less certain.
 */
async function settle(): Promise<void> {
	for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

beforeEach(() => {
	forgetAll();
});

afterEach(() => {
	vi.useRealTimers();
});


describe("getJournalsApi", () => {
	it("finds the API on the running plugin", () => {
		const { app, api } = fakeJournals();
		expect(getJournalsApi(app)).toBe(api);
		expect(isJournalsEnabled(app)).toBe(true);
	});

	it("reads as missing when the plugin, or its API, isn't there", () => {
		expect(getJournalsApi({ plugins: { plugins: {} } } as unknown as App)).toBeNull();
		// Installed but too old to expose an API — the same answer as absent.
		const old = { plugins: { plugins: { journals: {} } } } as unknown as App;
		expect(getJournalsApi(old)).toBeNull();
		// `plugins.plugins` is an Obsidian internal: a build without it must not
		// throw inside a card render.
		expect(getJournalsApi({} as unknown as App)).toBeNull();
	});
});


describe("peekNote", () => {
	it("answers null first, then serves the resolved path without asking again", async () => {
		const { app, calls } = fakeJournals({ notes: { Work: { path: "J/2026-09-15.md" } } });
		const onResolved = vi.fn();

		expect(peekNote(app, "Work", onResolved)).toBeNull();
		await settle();

		expect(onResolved).toHaveBeenCalledTimes(1);
		expect(peekNote(app, "Work", onResolved)).toEqual({
			path: "J/2026-09-15.md",
			unknownJournal: false,
		});
		expect(calls.notesFor).toBe(1);
	});

	it("collapses a board's worth of simultaneous asks into one lookup", async () => {
		const { app, calls } = fakeJournals({ notes: { Work: { path: "J/now.md" } } });
		for (let i = 0; i < 5; i += 1) peekNote(app, "Work", vi.fn());
		await settle();
		expect(calls.notesFor).toBe(1);
	});

	it("redraws the card only when the answer actually changed", async () => {
		const notes: Record<string, { path: string | null }> = { Work: { path: "J/now.md" } };
		const { app } = fakeJournals({ notes });
		const onResolved = vi.fn();

		peekNote(app, "Work", onResolved);
		await settle();
		expect(onResolved).toHaveBeenCalledTimes(1);

		// A refresh that resolves to the same path must not redraw: the redraw
		// re-renders the card, which peeks again, which would loop forever.
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + JOURNAL_CACHE_TTL_MS + 1);
		peekNote(app, "Work", onResolved);
		vi.useRealTimers();
		await settle();
		expect(onResolved).toHaveBeenCalledTimes(1);
	});

	it("refreshes once the answer is past its TTL, and redraws on a new path", async () => {
		const notes: Record<string, { path: string | null }> = { Work: { path: "J/old.md" } };
		const { app, calls } = fakeJournals({ notes });
		const onResolved = vi.fn();

		peekNote(app, "Work", onResolved);
		await settle();

		// Within the TTL nothing is asked again.
		peekNote(app, "Work", onResolved);
		expect(calls.notesFor).toBe(1);

		// The journal's folder was renamed — a change no vault event reports.
		notes.Work = { path: "J/new.md" };
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + JOURNAL_CACHE_TTL_MS + 1);
		expect(peekNote(app, "Work", onResolved)?.path).toBe("J/old.md"); // stale, but instant
		vi.useRealTimers();
		await settle();

		expect(calls.notesFor).toBe(2);
		expect(onResolved).toHaveBeenCalledTimes(2);
		expect(peekNote(app, "Work", onResolved)?.path).toBe("J/new.md");
	});

	it("tells a journal that is gone from one whose note isn't written yet", async () => {
		const { app } = fakeJournals({ journals: [{ name: "Work" }] });

		peekNote(app, "Work", vi.fn());
		peekNote(app, "Ghost", vi.fn());
		await settle();

		// Journals answers an empty list for both, so the difference is asked
		// for separately — and only then.
		expect(peekNote(app, "Work", vi.fn())).toEqual({ path: null, unknownJournal: false });
		expect(peekNote(app, "Ghost", vi.fn())).toEqual({ path: null, unknownJournal: true });
	});

	it("reads a journal-not-found error as an answer, not a failure", async () => {
		const { app } = fakeJournals({ notesForThrows: Object.assign(new Error("gone"), { code: "journal-not-found" }) });
		peekNote(app, "Work", vi.fn());
		await settle();
		expect(peekNote(app, "Work", vi.fn())).toEqual({ path: null, unknownJournal: true });
	});

	it("keeps the last good answer when a lookup fails outright", async () => {
		const notes: Record<string, { path: string | null }> = { Work: { path: "J/now.md" } };
		const api = fakeJournals({ notes });
		const onResolved = vi.fn();

		peekNote(api.app, "Work", onResolved);
		await settle();
		expect(peekNote(api.app, "Work", onResolved)?.path).toBe("J/now.md");

		// Journals is mid-reload: its answer is worse than the one we hold.
		const broken = { plugins: { plugins: { journals: { api: {} } } } } as unknown as App;
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + JOURNAL_CACHE_TTL_MS + 1);
		expect(peekNote(broken, "Work", onResolved)?.path).toBe("J/now.md");
		vi.useRealTimers();
		await settle();
		expect(peekNote(api.app, "Work", onResolved)?.path).toBe("J/now.md");
	});

	it("does not answer from an entry resolved on another day", async () => {
		const { app } = fakeJournals({ notes: { Work: { path: "J/2026-09-15.md" } } });
		peekNote(app, "Work", vi.fn());
		await settle();

		// The period rolled over: yesterday's answer can't stand in for today's,
		// so the key it was cached under is no longer the one being asked for.
		expect(cachedPath("Work")).toBe("J/2026-09-15.md");
		expect(cacheKey("Work", "2026-09-14")).not.toBe(cacheKey("Work", today()));
	});
});


describe("cachedPath", () => {
	it("reads what is known without asking Journals anything", async () => {
		const { app, calls } = fakeJournals({ notes: { Work: { path: "J/now.md" } } });
		// The card's liveness calls this on every vault event, so a lookup here
		// would be one question to Journals per keystroke in an open note.
		expect(cachedPath("Work")).toBeNull();
		expect(calls.notesFor).toBe(0);

		peekNote(app, "Work", vi.fn());
		await settle();

		expect(cachedPath("Work")).toBe("J/now.md");
		expect(calls.notesFor).toBe(1);
	});
});


describe("forget", () => {
	it("drops one journal's answer, leaving the others alone", async () => {
		const { app } = fakeJournals({ notes: { Work: { path: "W.md" }, Home: { path: "H.md" } } });
		peekNote(app, "Work", vi.fn());
		peekNote(app, "Home", vi.fn());
		await settle();

		forget("Work");
		expect(cachedPath("Work")).toBeNull();
		expect(cachedPath("Home")).toBe("H.md");
	});
});


describe("listJournals", () => {
	it("returns what Journals lists", async () => {
		const { app } = fakeJournals({ journals: [{ name: "Work" }, { name: "Home" }] });
		expect((await listJournals(app)).map((j) => j.name)).toEqual(["Work", "Home"]);
	});

	it("is empty when Journals isn't installed, and drops entries with no name", async () => {
		expect(await listJournals({ plugins: { plugins: {} } } as unknown as App)).toEqual([]);

		const junk = {
			plugins: { plugins: { journals: { api: { listJournals: () => Promise.resolve([{}, { name: 7 }, { name: "Work" }]) } } } },
		} as unknown as App;
		expect((await listJournals(junk)).map((j) => j.name)).toEqual(["Work"]);
	});

	it("is empty rather than throwing when the API rejects", async () => {
		const angry = {
			plugins: { plugins: { journals: { api: { listJournals: () => Promise.reject(new Error("nope")) } } } },
		} as unknown as App;
		expect(await listJournals(angry)).toEqual([]);
	});
});


describe("createJournalNote", () => {
	it("returns the file Journals made, and records where it put it", async () => {
		const file = new TFile();
		const { app, calls } = fakeJournals({ notes: {}, created: file });

		peekNote(app, "Work", vi.fn());
		await settle();
		expect(cachedPath("Work")).toBeNull();

		expect(await createJournalNote(app, "Work")).toBe(file);
		// The card redraws straight after this, and must show the new note
		// rather than the "no note yet" answer it is still holding — without
		// asking Journals a question it has just been given the answer to.
		expect(cachedPath("Work")).toBe("J/now.md");
		expect(peekNote(app, "Work", vi.fn())).toEqual({ path: "J/now.md", unknownJournal: false });
		expect(calls.notesFor).toBe(1);
	});

	it("returns null when Journals can't make one", async () => {
		const noApi = { plugins: { plugins: {} } } as unknown as App;
		expect(await createJournalNote(noApi, "Work")).toBeNull();

		// An `ensureNote` that resolves without a file (a prompt the user
		// cancelled) is not a file, and must not be treated as one.
		const { app } = fakeJournals({ created: null });
		expect(await createJournalNote(app, "Work")).toBeNull();
	});
});


describe("errorCode", () => {
	it("reads the code off a Journals API error", () => {
		expect(errorCode(Object.assign(new Error("x"), { code: "invalid-date" }))).toBe("invalid-date");
	});

	it("is null for anything else a rejection can carry", () => {
		for (const value of [new Error("x"), null, undefined, "journal-not-found", 7, {}]) {
			expect(errorCode(value)).toBeNull();
		}
	});
});


describe("today", () => {
	it("is the local date, as Journals spells dates and the cache keys them", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-07T12:00:00Z"));
		expect(today()).toBe("2026-03-07");
		vi.useRealTimers();
	});
});
