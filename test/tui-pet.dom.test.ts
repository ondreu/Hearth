/**
 * @vitest-environment jsdom
 *
 * The pet card as text, at the level #479 was reported on: the sprite is drawn
 * as colour runs with no listener per cell (the body is one click target), its
 * frames advance on a timer that asks for a redraw instead of rebuilding the
 * DOM, and patting it still works.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import { PET_TICK_MS } from "../src/cards/pet";
import { DEFAULT_SETTINGS, type DashboardCard, type HomeSettings } from "../src/types";
import type { TuiContext, TuiRenderer } from "../src/tui/card";

let petTui: TuiRenderer;

beforeAll(async () => {
	installObsidianDom();
	({ petTui } = await import("../src/tui/cards/pet"));
});

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

interface Harness {
	ctx: TuiContext;
	card: DashboardCard;
	redraws: () => number;
	intervals: () => number[];
}

function harness(species = "bird"): Harness {
	const settings: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	const card = { id: "pet", kind: "pet", pet: { species } } as unknown as DashboardCard;
	let redraws = 0;
	const intervals: number[] = [];
	const state: Record<string, unknown> = {};
	const ctx = {
		view: {
			app: { vault: { getMarkdownFiles: () => [] } },
			plugin: { settings, saveData: () => Promise.resolve() },
			tui: { selection: () => 0, setSelection: () => undefined, state: () => state },
		},
		card,
		component: { registerInterval: (id: number) => intervals.push(id) },
		persistent: { registerInterval: () => undefined },
		cols: 30,
		rows: 12,
		focused: false,
		zoomed: false,
		selected: 0,
		state,
		redraw: () => {
			redraws++;
		},
		select: () => undefined,
	} as unknown as TuiContext;
	return { ctx, card, redraws: () => redraws, intervals: () => intervals };
}

/** The eight rows of the pet's picture, after the line above it. */
function spriteRowIndexes(): number[] {
	return Array.from({ length: 8 }, (_, i) => i + 1);
}

describe("the pet as text", () => {
	it("draws the sprite without a control on every cell", () => {
		const h = harness();
		const out = petTui.render(h.ctx);
		const all = out.lines.flat();
		expect(out.lines.length).toBeGreaterThan(9);
		for (const i of spriteRowIndexes()) {
			for (const seg of out.lines[i]) {
				expect(seg.onClick, `row ${i}`).toBeUndefined();
				expect(seg.onMenu, `row ${i}`).toBeUndefined();
				expect(seg.label, `row ${i}`).toBeUndefined();
			}
		}
		// Colours survive — the picture is still the picture.
		expect(all.some((seg) => seg.color !== undefined || seg.bg !== undefined)).toBe(true);
		// One click target for the whole body, not one per sprite cell: before
		// the fix this was 129 (every cell of eight rows, plus the name).
		expect(all.filter((seg) => seg.onClick).length).toBeLessThanOrEqual(1);
	});

	it("keeps the name row selectable for the keyboard", () => {
		const h = harness();
		const out = petTui.render(h.ctx);
		expect(out.items).toHaveLength(1);
		expect(out.items?.[0].activate).toBeTypeOf("function");
	});

	it("pets when the body itself is clicked", () => {
		const h = harness();
		const out = petTui.render(h.ctx);
		expect(out.onBodyClick).toBeTypeOf("function");
		out.onBodyClick?.(new MouseEvent("click"));
		expect(h.card.pet?.lastPlayedAt).toBeTypeOf("number");
		expect(h.redraws()).toBe(1);
	});

	it("advances a frame on the clock rather than rebuilding on its own", () => {
		const h = harness();
		petTui.render(h.ctx);
		expect(h.intervals()).toHaveLength(2);
		vi.advanceTimersByTime(1500);
		expect(h.redraws()).toBe(1);
		vi.advanceTimersByTime(PET_TICK_MS);
		expect(h.redraws()).toBeGreaterThanOrEqual(2);
	});
});

describe("what a frame costs the DOM", () => {
	/** Render the pet into a real body, wired the way the board wires it. */
	async function mounted() {
		const { Component } = await import("obsidian");
		const { TuiCardHost } = await import("../src/tui/host");
		const h = harness();
		const el = document.body.createDiv();
		// What a draw's own component does that the pet uses; the real one
		// unloads the previous draw's timers, which the fake timers here make
		// unnecessary.
		const component = () => ({ registerInterval: () => 0 }) as unknown as InstanceType<typeof Component>;
		const host = new TuiCardHost(h.ctx.view, h.card, petTui, el, {
			zoomed: false,
			persistent: new Component(),
			size: () => ({ cols: h.ctx.cols, rows: h.ctx.rows }),
			focused: () => false,
		});
		host.redraw = () => host.draw(component());
		host.draw(component());
		/** Count the nodes a redraw actually creates inside the body. */
		const watch = () => {
			const created: Node[] = [];
			const observer = new MutationObserver((records) => {
				for (const record of records) created.push(...Array.from(record.addedNodes));
			});
			observer.observe(el, { childList: true, subtree: true });
			return () => {
				for (const record of observer.takeRecords()) created.push(...Array.from(record.addedNodes));
				observer.disconnect();
				return created.length;
			};
		};
		return { Component, host, el, watch };
	}

	it("creates a handful of nodes per frame, not the whole body", async () => {
		const m = await mounted();
		m.host.isOnScreen = () => true;
		const count = m.watch();
		vi.advanceTimersByTime(1500);
		const created = count();
		expect(created).toBeGreaterThan(0);
		// Measured at 94 for a frame that shares most of its rows with the last
		// one. Before the fix every cell was its own listener-carrying span, so
		// one frame rebuild the whole body — roughly 290 nodes — and the board's
		// whole frame layer on top of it.
		expect(created).toBeLessThan(140);
	});

	it("creates nothing at all while the leaf is hidden", async () => {
		const m = await mounted();
		m.host.isOnScreen = () => false;
		const count = m.watch();
		vi.advanceTimersByTime(1500);
		expect(count()).toBe(0);
	});
});
