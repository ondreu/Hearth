/**
 * @vitest-environment jsdom
 *
 * A text body keeps the rows that did not change between draws, and a card's
 * own timer stops painting while the leaf is hidden — the two halves of #479,
 * where the terminal-mode pet card rebuilt its whole body and the whole frame
 * layer every 1.5 s in a background tab until Obsidian ran out of memory.
 */
import { Component } from "obsidian";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { TuiContext, TuiOutput } from "../src/tui/card";
import type { DashboardCard } from "../src/types";
import type { HomeView } from "../src/view";

let TuiCardHost: typeof import("../src/tui/host").TuiCardHost;

beforeAll(async () => {
	installObsidianDom();
	({ TuiCardHost } = await import("../src/tui/host"));
});

afterEach(() => {
	document.body.empty();
});

/** The view a host reads: only the tab's selection and per-card state. */
function fakeView(): HomeView {
	return {
		tui: {
			selection: () => 0,
			setSelection: () => undefined,
			state: () => ({}),
		},
	} as unknown as HomeView;
}

const card = { id: "c1", kind: "pet" } as unknown as DashboardCard;

function makeHost(output: () => TuiOutput, el: HTMLElement) {
	const host = new TuiCardHost(
		fakeView(),
		card,
		{ render: () => output() },
		el,
		{
			zoomed: false,
			persistent: new Component(),
			size: () => ({ cols: 12, rows: 8 }),
			focused: () => false,
		},
	);
	// The board wires the body's click to the host; do the same here.
	el.addEventListener("click", (evt) => host.click(evt));
	return host;
}

/** The drawn rows, in document order. */
function rows(el: HTMLElement): HTMLElement[] {
	return Array.from(el.querySelectorAll<HTMLElement>(".hearth-tui-line"));
}

describe("repainting a text body", () => {
	it("keeps every row when the draw says the same thing", () => {
		const el = document.body.createDiv();
		let out: TuiOutput = { lines: [[{ text: "one" }], [{ text: "two" }]] };
		const host = makeHost(() => out, el);

		host.draw(new Component());
		const first = rows(el);
		out = { lines: [[{ text: "one" }], [{ text: "two" }]] };
		host.draw(new Component());

		const second = rows(el);
		expect(second).toHaveLength(first.length);
		second.forEach((row, i) => expect(row).toBe(first[i]));
	});

	it("replaces only the rows whose content changed", () => {
		const el = document.body.createDiv();
		let out: TuiOutput = { lines: [[{ text: "one" }], [{ text: "two" }], [{ text: "three" }]] };
		const host = makeHost(() => out, el);

		host.draw(new Component());
		const first = rows(el);
		out = { lines: [[{ text: "one" }], [{ text: "TWO" }], [{ text: "three" }]] };
		host.draw(new Component());

		const second = rows(el);
		expect(second[0]).toBe(first[0]);
		expect(second[1]).not.toBe(first[1]);
		expect(second[2]).toBe(first[2]);
		expect(second[1].textContent?.trimEnd()).toBe("TWO");
	});

	it("rebuilds a row that carries a handler, even with the same text", () => {
		const el = document.body.createDiv();
		let out: TuiOutput = { lines: [[{ text: "click me", onClick: () => undefined }]] };
		const host = makeHost(() => out, el);

		host.draw(new Component());
		const first = rows(el)[0];
		out = { lines: [[{ text: "click me", onClick: () => undefined }]] };
		host.draw(new Component());

		expect(rows(el)[0]).not.toBe(first);
	});

	it("leaves the sticky block alone when the body under it changes", () => {
		const el = document.body.createDiv();
		let out: TuiOutput = { sticky: 1, lines: [[{ text: "head" }], [{ text: "a" }], [{ text: "b" }]] };
		const host = makeHost(() => out, el);

		host.draw(new Component());
		const stickyRow = el.querySelector<HTMLElement>(".hearth-tui-sticky .hearth-tui-line");
		const bodyRow = rows(el)[1];
		out = { sticky: 1, lines: [[{ text: "head" }], [{ text: "A" }], [{ text: "b" }]] };
		host.draw(new Component());

		expect(el.querySelector(".hearth-tui-sticky .hearth-tui-line")).toBe(stickyRow);
		expect(rows(el)[1]).not.toBe(bodyRow);
		expect(rows(el)).toHaveLength(3);
	});
});

describe("a card's own redraw", () => {
	function setup() {
		const el = document.body.createDiv();
		const out: TuiOutput = { lines: [[{ text: "tick" }]] };
		let draws = 0;
		const seen: { ctx: TuiContext | null } = { ctx: null };
		const host = new TuiCardHost(
			fakeView(),
			card,
			{
				render: (c) => {
					draws++;
					seen.ctx = c;
					return out;
				},
			},
			el,
			{
				zoomed: false,
				persistent: new Component(),
				size: () => ({ cols: 12, rows: 8 }),
				focused: () => false,
			},
		);
		host.redraw = () => host.draw(new Component());
		host.draw(new Component());
		return {
			host,
			draws: () => draws,
			askRedraw: () => seen.ctx?.redraw(),
		};
	}

	it("paints while the body is on screen", () => {
		const { host, draws, askRedraw } = setup();
		host.isOnScreen = () => true;
		askRedraw();
		expect(draws()).toBe(2);
	});

	it("skips the draw while the leaf is hidden, and keeps the card's state", () => {
		const { host, draws, askRedraw } = setup();
		host.isOnScreen = () => false;
		askRedraw();
		askRedraw();
		expect(draws()).toBe(1);
	});
});

describe("a click on a body that is one picture", () => {
	it("hands a click off the items to the card", () => {
		const el = document.body.createDiv();
		const petted = vi.fn();
		const out: TuiOutput = { lines: [[{ text: "sprite" }], [{ text: "name" }]], onBodyClick: petted };
		const host = makeHost(() => out, el);
		host.draw(new Component());

		rows(el)[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(petted).toHaveBeenCalledTimes(1);
	});

	it("still activates an item row instead", () => {
		const el = document.body.createDiv();
		const petted = vi.fn();
		const activated = vi.fn();
		const out: TuiOutput = {
			lines: [[{ text: "sprite" }], [{ text: "name" }]],
			items: [{ line: 1, activate: activated }],
			onBodyClick: petted,
		};
		const host = makeHost(() => out, el);
		host.draw(new Component());

		rows(el)[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(activated).toHaveBeenCalledTimes(1);
		expect(petted).not.toHaveBeenCalled();
	});
});
