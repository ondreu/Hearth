import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import type { App, EventRef } from "obsidian";
import {
	createVaultEventHub,
	liveCardShouldRedraw,
	type VaultEvent,
	type VaultEventKind,
	watchedCardReactsToKind,
} from "../src/cardevents";
import type { DashboardCard } from "../src/types";

/**
 * The dashboard's live-refresh wiring, tested without the Obsidian runtime.
 * These cover the regression the shared hub could introduce — a card that no
 * longer refreshes when it should — from both ends:
 *   - the hub fans every vault event out to every subscriber (lazily, and
 *     isolating one subscriber's failure from the rest);
 *   - the two pure decisions reproduce the old per-card behaviour exactly.
 */

const ALL_KINDS: VaultEventKind[] = ["create", "delete", "rename", "modify", "meta"];

/** A minimal fake of Obsidian's Vault/MetadataCache event emitters: `on`
 * records the handler under its event name and returns a sentinel EventRef so
 * the hub's `register` can be counted. `emit` invokes the recorded handler. */
function fakeApp() {
	const handlers = new Map<string, (...args: unknown[]) => void>();
	let refs = 0;
	const on = (name: string) => (event: string, cb: (...args: unknown[]) => void): EventRef => {
		handlers.set(`${name}:${event}`, cb);
		refs++;
		return {};
	};
	const app = {
		vault: { on: on("vault") },
		metadataCache: { on: on("meta") },
	} as unknown as App;
	return {
		app,
		refCount: () => refs,
		emitVault(event: string, ...args: unknown[]) {
			handlers.get(`vault:${event}`)?.(...args);
		},
		emitMeta(...args: unknown[]) {
			handlers.get(`meta:changed`)?.(...args);
		},
	};
}

function file(path: string): TFile {
	return Object.assign(new TFile(), { path });
}

describe("createVaultEventHub", () => {
	it("registers nothing until the first subscribe (lazy)", () => {
		const f = fakeApp();
		createVaultEventHub(f.app, () => {});
		expect(f.refCount()).toBe(0);
	});

	it("registers exactly five listeners, once, however many cards subscribe", () => {
		const f = fakeApp();
		let registered = 0;
		const hub = createVaultEventHub(f.app, () => registered++);
		hub.subscribe(() => {});
		hub.subscribe(() => {});
		hub.subscribe(() => {});
		expect(registered).toBe(5); // not 5 per subscriber
		expect(f.refCount()).toBe(5);
	});

	it("fans every event kind out to every subscriber with the right shape", () => {
		const f = fakeApp();
		const hub = createVaultEventHub(f.app, () => {});
		const a: VaultEvent[] = [];
		const b: VaultEvent[] = [];
		hub.subscribe((ev) => a.push(ev));
		hub.subscribe((ev) => b.push(ev));

		const created = file("New.md");
		f.emitVault("create", created);
		f.emitVault("delete", file("Gone.md"));
		f.emitVault("rename", file("After.md"), "Before.md");
		f.emitVault("modify", file("Edited.md"));
		f.emitMeta(file("Reparsed.md"));

		expect(a).toEqual(b); // both subscribers see the same stream
		expect(a.map((e) => e.kind)).toEqual(["create", "delete", "rename", "modify", "meta"]);
		expect(a[0].file).toBe(created);
		// oldPath is carried for renames only.
		expect(a[2].oldPath).toBe("Before.md");
		expect(a[3].oldPath).toBeUndefined();
	});

	it("isolates a throwing subscriber so the others still refresh", () => {
		const f = fakeApp();
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const hub = createVaultEventHub(f.app, () => {});
		const seen: string[] = [];
		hub.subscribe(() => {
			throw new Error("boom");
		});
		hub.subscribe(() => seen.push("second"));
		hub.subscribe(() => seen.push("third"));

		expect(() => f.emitVault("modify", file("X.md"))).not.toThrow();
		expect(seen).toEqual(["second", "third"]);
		expect(spy).toHaveBeenCalledOnce();
		spy.mockRestore();
	});
});

/** Build a card of the given kind carrying an optional tasks config. */
function card(kind: DashboardCard["kind"], tasks?: DashboardCard["tasks"]): DashboardCard {
	return { id: "c", kind, ...(tasks ? { tasks } : {}) } as DashboardCard;
}
function ev(kind: VaultEventKind, path = "Any.md", oldPath?: string): VaultEvent {
	return { kind, file: file(path), oldPath };
}

describe("liveCardShouldRedraw", () => {
	it("non-tasks live cards redraw on every event kind", () => {
		for (const kind of ["stats", "calendar", "search", "heatmap"] as const) {
			for (const k of ALL_KINDS) {
				expect(liveCardShouldRedraw(card(kind), ev(k))).toBe(true);
			}
		}
	});

	it("a default (all-scope) tasks card redraws on every event kind — unchanged from before", () => {
		for (const k of ALL_KINDS) {
			expect(liveCardShouldRedraw(card("tasks"), ev(k))).toBe(true);
			expect(liveCardShouldRedraw(card("tasks", { folderScope: "all" }), ev(k))).toBe(true);
		}
	});

	it("a folder-scoped tasks card redraws for in-scope events and skips out-of-scope ones", () => {
		const scoped = card("tasks", { folderScope: "whitelist", folders: ["Tasks"] });
		expect(liveCardShouldRedraw(scoped, ev("modify", "Tasks/todo.md"))).toBe(true);
		expect(liveCardShouldRedraw(scoped, ev("modify", "Journal/x.md"))).toBe(false);
		// A rename that touches the scope on either side still redraws.
		expect(liveCardShouldRedraw(scoped, ev("rename", "Archive/todo.md", "Tasks/todo.md"))).toBe(
			true,
		);
	});
});

describe("watchedCardReactsToKind", () => {
	it("ignores meta reparse events regardless of editability", () => {
		expect(watchedCardReactsToKind("meta", true)).toBe(false);
		expect(watchedCardReactsToKind("meta", false)).toBe(false);
	});

	it("reacts to modify only when the card is not being edited in place", () => {
		expect(watchedCardReactsToKind("modify", true)).toBe(true); // redrawOnModify = !editable
		expect(watchedCardReactsToKind("modify", false)).toBe(false);
	});

	it("always reacts to existence changes (create/delete/rename)", () => {
		for (const k of ["create", "delete", "rename"] as const) {
			expect(watchedCardReactsToKind(k, true)).toBe(true);
			expect(watchedCardReactsToKind(k, false)).toBe(true);
		}
	});
});
