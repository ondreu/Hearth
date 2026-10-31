/**
 * @vitest-environment jsdom
 *
 * The view switcher of a card with views (#385): where it is drawn, what each
 * style draws, and that a choice reaches the card. Obsidian's own pieces (the
 * menu a drop-down opens, the icons) are not under test.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { DashboardCard, ViewSwitcherConfig } from "../src/types";
import type { HomeView } from "../src/view";

let mountViewSwitcher: typeof import("../src/viewswitcher").mountViewSwitcher;
let viewIdentity: typeof import("../src/viewswitcher").viewIdentity;
let revealScrollLeft: typeof import("../src/viewswitcher").revealScrollLeft;
let setActiveViewIndex: typeof import("../src/cardviews").setActiveViewIndex;

beforeAll(async () => {
	installObsidianDom();
	({ mountViewSwitcher, viewIdentity, revealScrollLeft } = await import("../src/viewswitcher"));
	({ setActiveViewIndex } = await import("../src/cardviews"));
});

const view = {} as HomeView;

function card(viewSwitcher?: ViewSwitcherConfig): DashboardCard {
	return {
		id: "a",
		kind: "text",
		title: "Workspace",
		x: 0,
		y: 0,
		w: 4,
		h: 3,
		viewLabel: "Notes",
		views: [
			{ id: "b", kind: "clock", x: 0, y: 0, w: 1, h: 1 },
			{ id: "c", kind: "tasks", x: 0, y: 0, w: 1, h: 1, viewLabel: "Inbox", viewIcon: "inbox" },
		],
		viewSwitcher,
	};
}

function mount(c: DashboardCard, titled = true) {
	const cardEl = document.body.createDiv("hearth-card");
	const head = cardEl.createDiv("hearth-card-head");
	const picked: number[] = [];
	const handle = mountViewSwitcher({
		view,
		card: c,
		cardEl,
		head,
		titled,
		select: (i) => {
			picked.push(i);
			setActiveViewIndex(c, i);
			handle?.update();
		},
	});
	return { cardEl, head, picked, handle };
}

describe("viewIdentity", () => {
	it("prefers the view's own label and icon, then its kind", () => {
		const c = card();
		expect(viewIdentity(view, c).label).toBe("Notes");
		expect(viewIdentity(view, c.views![0]).label).toBe("Clock & greeting");
		expect(viewIdentity(view, c.views![1])).toEqual({ label: "Inbox", icon: "inbox" });
	});
});

describe("revealScrollLeft", () => {
	const row = { left: 0, right: 100 };

	it("leaves a tab that is already inside the row alone", () => {
		expect(revealScrollLeft(30, row, { left: 10, right: 60 })).toBe(30);
	});

	it("moves the row on for a tab past its right edge", () => {
		expect(revealScrollLeft(0, row, { left: 140, right: 200 })).toBe(100);
	});

	it("moves the row back for a tab before its left edge, and stops at the start", () => {
		expect(revealScrollLeft(100, row, { left: -30, right: 30 })).toBe(70);
		expect(revealScrollLeft(20, row, { left: -30, right: 30 })).toBe(0);
	});
});

describe("keeping the tab on show in sight", () => {
	/** Run `fn` with a spy in place of `scrollIntoView`, which jsdom does not
	 * implement at all — the spy is what makes "the board is never asked to
	 * move" a claim the old code fails. */
	function withoutScrollIntoView(fn: () => void): void {
		const intoView = vi.fn();
		const proto = HTMLElement.prototype as unknown as { scrollIntoView?: unknown };
		const had = "scrollIntoView" in proto;
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			value: intoView,
			configurable: true,
			writable: true,
		});
		try {
			fn();
			expect(intoView).not.toHaveBeenCalled();
		} finally {
			if (!had) delete proto.scrollIntoView;
		}
	}

	it("never scrolls the board, not on mount and not on a switch (#440)", () => {
		withoutScrollIntoView(() => {
			const c = card();
			const { head } = mount(c);
			head.querySelectorAll<HTMLElement>(".hearth-view-switch-btn")[2].click();
		});
	});

	it("scrolls the row itself when the tabs are wider than it", () => {
		const boxes = HTMLElement.prototype as unknown as { getBoundingClientRect?: unknown };
		const real = boxes.getBoundingClientRect;
		// The row is 0..100 on screen, the tab on show 140..200: the row has to
		// move by 100 to show it, and nothing else may move at all.
		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			value(this: HTMLElement) {
				if (this.classList.contains("hearth-view-switch")) return new DOMRect(0, 0, 100, 20);
				if (this.classList.contains("hearth-view-switch-btn") && this.classList.contains("is-active")) {
					return new DOMRect(140, 0, 60, 20);
				}
				return new DOMRect(0, 0, 0, 0);
			},
			configurable: true,
			writable: true,
		});
		try {
			const { head } = mount(card());
			const el = head.querySelector<HTMLElement>(".hearth-view-switch")!;
			expect(el.scrollLeft).toBe(100);
		} finally {
			Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
				value: real,
				configurable: true,
				writable: true,
			});
		}
	});
});

describe("mountViewSwitcher", () => {
	it("draws nothing for a card without views", () => {
		const c: DashboardCard = { id: "x", kind: "text", x: 0, y: 0, w: 1, h: 1 };
		expect(mount(c).handle).toBeNull();
	});

	it("puts tabs in the header of a titled card, one per view, the first on show", () => {
		const { head, cardEl } = mount(card());
		const el = head.querySelector(".hearth-view-switch.is-header");
		expect(el).not.toBeNull();
		expect(cardEl.querySelector(".is-floating")).toBeNull();
		const tabs = Array.from(el!.querySelectorAll<HTMLElement>(".hearth-view-switch-btn"));
		expect(tabs.map((b) => b.textContent)).toEqual(["Notes", "Clock & greeting", "Inbox"]);
		expect(tabs.map((b) => b.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
	});

	it("floats in a corner, hidden until hover, on an untitled card", () => {
		const { cardEl } = mount(card(), false);
		const el = cardEl.querySelector(".hearth-view-switch")!;
		expect(el.classList.contains("is-floating")).toBe(true);
		expect(el.classList.contains("is-top-right")).toBe(true);
		expect(el.classList.contains("is-reveal-hover")).toBe(true);
	});

	it("goes where it is told, and stays shown when asked", () => {
		const { cardEl } = mount(card({ placement: "bottom-left", reveal: "always" }));
		const el = cardEl.querySelector(".hearth-view-switch")!;
		expect(el.classList.contains("is-bottom-left")).toBe(true);
		expect(el.classList.contains("is-reveal-hover")).toBe(false);
	});

	it("reports a click and redraws for the view now on show", () => {
		const c = card();
		const { head, picked } = mount(c);
		head.querySelectorAll<HTMLElement>(".hearth-view-switch-btn")[2].click();
		expect(picked).toEqual([2]);
		const active = head.querySelector(".hearth-view-switch-btn.is-active");
		expect(active?.textContent).toBe("Inbox");
		// Clicking the view already on show is not a choice.
		head.querySelector<HTMLElement>(".hearth-view-switch-btn.is-active")!.click();
		expect(picked).toEqual([2]);
	});

	it("moves between tabs with the arrow keys, wrapping round", () => {
		const c = card();
		const { head, picked } = mount(c);
		const el = head.querySelector(".hearth-view-switch")!;
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(picked).toEqual([2, 0]);
	});

	it("draws dots without text, and icons without labels", () => {
		const dots = mount(card({ style: "dots" })).head;
		expect(dots.querySelectorAll(".hearth-view-switch-btn.is-dot")).toHaveLength(3);
		expect(dots.querySelector(".hearth-view-switch-label")).toBeNull();
		const icons = mount(card({ style: "icons" })).head;
		expect(icons.querySelectorAll(".hearth-view-switch-icon")).toHaveLength(3);
		expect(icons.querySelector(".hearth-view-switch-label")).toBeNull();
	});

	it("draws a drop-down as one button naming the view on show", () => {
		const c = card({ style: "dropdown" });
		setActiveViewIndex(c, 1);
		const { head } = mount(c);
		const buttons = head.querySelectorAll(".hearth-view-switch-btn");
		expect(buttons).toHaveLength(1);
		expect(buttons[0].textContent).toBe("Clock & greeting");
	});

	it("draws nothing when hidden, but still hands back its settings", () => {
		const { cardEl, handle } = mount(card({ placement: "hidden", rotateSec: 20 }));
		expect(cardEl.querySelector(".hearth-view-switch")).toBeNull();
		expect(handle?.settings.rotateSec).toBe(20);
	});
});
