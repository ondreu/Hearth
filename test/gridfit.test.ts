import { describe, expect, it } from "vitest";
import {
	applyCardPositionFitted,
	boardFitScale,
	cardGeometryFromScreen,
	fitVerticalScale,
	layoutHeight,
	MIN_H_PX,
	MIN_W_PX,
} from "../src/grid";
import type { DashboardCard } from "../src/types";

/**
 * A fit-to-page board paints its cards through a shared vertical scale, so the
 * pixels a drag or resize ends on are not the pixels to store. These tests pin
 * the conversion back out of that scaled space, and the property that actually
 * broke: committing an arrangement must leave the layout where the user put it,
 * however many times they arrange it.
 *
 * The geometry helpers only touch `el.style`, so a bare stub stands in for the
 * card element — no DOM needed.
 */

interface StubEl {
	style: Record<string, string>;
}

function stub(): StubEl {
	return { style: {} };
}

function asEl(el: StubEl): HTMLElement {
	return el as unknown as HTMLElement;
}

/** The footprint a stub was positioned at, as the drag engine would measure it
 * off the live element (offset* is integral, so round like the browser does). */
function rectOf(el: StubEl) {
	const px = (v: string) => Math.round(parseFloat(v));
	return {
		left: px(el.style.left),
		top: px(el.style.top),
		width: px(el.style.width),
		height: px(el.style.height),
	};
}

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
	return {
		id: "c1",
		kind: "text",
		title: "",
		x: 0,
		y: 0,
		w: 2,
		h: 2,
		fx: 0,
		fy: 0,
		fw: 0.5,
		fh: 200,
		...overrides,
	};
}

const BOARD_W = 1000;

describe("cardGeometryFromScreen", () => {
	it("stores the screen geometry as-is on an unscaled board", () => {
		const geo = cardGeometryFromScreen(
			{ left: 250, top: 120, width: 500, height: 300 },
			BOARD_W,
			1,
		);
		expect(geo).toEqual({ fx: 0.25, fw: 0.5, fy: 120, fh: 300 });
	});

	it("divides the vertical axis back out of the fit scale", () => {
		// A card dropped at screen y=150 on a board squeezed to 75% really lives at
		// y=200 in stored space; storing 150 is what walked the board upward.
		const geo = cardGeometryFromScreen(
			{ left: 0, top: 150, width: 500, height: 300 },
			BOARD_W,
			0.75,
		);
		expect(geo.fy).toBeCloseTo(200, 6);
		expect(geo.fh).toBeCloseTo(400, 6);
		// The horizontal axis is a plain board fraction — the scale is vertical only.
		expect(geo.fx).toBe(0);
		expect(geo.fw).toBe(0.5);
	});

	it("keeps the stored geometry inside the model's bounds", () => {
		const geo = cardGeometryFromScreen(
			{ left: -40, top: -40, width: 4, height: 4 },
			BOARD_W,
			1,
		);
		expect(geo.fx).toBe(0);
		expect(geo.fy).toBe(0);
		expect(geo.fh).toBe(MIN_H_PX);
		expect(geo.fw).toBeCloseTo(MIN_W_PX / BOARD_W, 6);
	});

	it("treats a non-positive scale as unscaled rather than exploding", () => {
		for (const bad of [0, -0.5]) {
			const geo = cardGeometryFromScreen({ left: 0, top: 100, width: 500, height: 200 }, BOARD_W, bad);
			expect(geo.fy).toBe(100);
			expect(geo.fh).toBe(200);
		}
	});

	it("never asks for a width fraction above 1 on a board narrower than the minimum", () => {
		const geo = cardGeometryFromScreen({ left: 0, top: 0, width: 60, height: 100 }, 60, 1);
		expect(geo.fw).toBeLessThanOrEqual(1);
		expect(geo.fw).toBeGreaterThan(0);
	});
});

describe("fitted board round trip", () => {
	it("recovers the stored geometry from where the card was painted", () => {
		const cards = [card({ fy: 0, fh: 300 }), card({ id: "c2", fy: 316, fh: 300 })];
		const boardHeight = 460;
		const vScale = fitVerticalScale(cards, boardHeight);
		expect(vScale).toBeLessThan(1);

		for (const c of cards) {
			const el = stub();
			applyCardPositionFitted(asEl(el), c, vScale, BOARD_W);
			const geo = cardGeometryFromScreen(rectOf(el), BOARD_W, vScale);
			// Painting rounds to whole pixels, so allow the scale's worth of that.
			const tol = 1 / vScale + 0.001;
			expect(geo.fy).toBeCloseTo(c.fy as number, 0);
			expect(Math.abs(geo.fy - (c.fy as number))).toBeLessThanOrEqual(tol);
			expect(Math.abs(geo.fh - (c.fh as number))).toBeLessThanOrEqual(2 * tol);
			expect(geo.fx).toBeCloseTo(c.fx as number, 2);
			expect(geo.fw).toBeCloseTo(c.fw as number, 2);
		}
	});

	it("does not walk the layout upward over repeated arrange-and-commit cycles", () => {
		// Each cycle: paint the fitted board, then commit every card back from the
		// pixels it was painted at (as ending a drag does). The stored layout has to
		// hold still — committing the *scaled* pixels shrank it by the fit factor
		// every single time, so the cards crept up the board and off their
		// neighbours' edges.
		const cards = [
			card({ id: "a", fx: 0, fw: 0.5, fy: 0, fh: 400 }),
			card({ id: "b", fx: 0.5, fw: 0.5, fy: 0, fh: 200 }),
			card({ id: "c", fx: 0.5, fw: 0.5, fy: 216, fh: 184 }),
		];
		const boardHeight = 300;
		const before = layoutHeight(cards);
		expect(fitVerticalScale(cards, boardHeight)).toBeLessThan(1);

		for (let i = 0; i < 10; i++) {
			const vScale = fitVerticalScale(cards, boardHeight);
			for (const c of cards) {
				const el = stub();
				applyCardPositionFitted(asEl(el), c, vScale, BOARD_W);
				const geo = cardGeometryFromScreen(rectOf(el), BOARD_W, vScale);
				c.fx = geo.fx;
				c.fw = geo.fw;
				c.fy = geo.fy;
				c.fh = geo.fh;
			}
		}

		// Whole-pixel painting means a little jitter, but no systematic drift.
		expect(layoutHeight(cards)).toBeCloseTo(before, 0);
		// The stacked pair on the right still meets card `b`'s bottom edge.
		expect(cards[2].fy as number).toBeCloseTo(
			(cards[1].fy as number) + (cards[1].fh as number) + 16,
			0,
		);
	});
});

describe("applyCardPositionFitted", () => {
	/** Cards stacked flush against each other, which is what a squeeze has to
	 * keep apart: any gap of its own would hide a small overlap. */
	function column(count: number, height = 200): DashboardCard[] {
		return Array.from({ length: count }, (_, i) =>
			card({ id: `c${i}`, fy: i * height, fh: height }),
		);
	}

	it("keeps stacked cards apart however hard the board is squeezed", () => {
		// A tall board squeezed into a phone-shaped viewport. Every card's scaled
		// height lands under MIN_H_PX, which is exactly where an unscaled floor
		// used to take over: Math.max can only make a card taller than the linear
		// map placed it, so each one grew past its neighbour's top edge and the
		// whole board piled up.
		const cards = column(6);
		const scale = fitVerticalScale(cards, 240);
		expect(scale).toBeLessThan(MIN_H_PX / 200);

		const rects = cards.map((c) => {
			const el = stub();
			applyCardPositionFitted(asEl(el), c, scale, BOARD_W);
			return rectOf(el);
		});

		for (let i = 1; i < rects.length; i++) {
			const above = rects[i - 1];
			const below = rects[i];
			expect(above.top + above.height).toBeLessThanOrEqual(below.top);
		}
	});

	it("still floors a degenerate stored height on an unscaled board", () => {
		// The floor's actual job — a card whose stored height is nonsense should
		// not be painted as an invisible sliver — is untouched by the fix.
		const el = stub();
		applyCardPositionFitted(asEl(el), card({ fh: 0 }), 1, BOARD_W);
		expect(rectOf(el).height).toBe(MIN_H_PX);
	});

	it("leaves an unsqueezed board on its stored geometry", () => {
		const el = stub();
		applyCardPositionFitted(asEl(el), card({ fy: 120, fh: 300 }), 1, BOARD_W);
		expect(rectOf(el)).toMatchObject({ top: 120, height: 300 });
	});
});

describe("boardFitScale", () => {
	const cards = [card({ fy: 0, fh: 600 })];

	function grid(fitted: boolean, clientHeight: number): HTMLElement {
		return {
			clientHeight,
			closest: (sel: string) => (fitted && sel === ".hearth-fit" ? ({} as HTMLElement) : null),
		} as unknown as HTMLElement;
	}

	it("is 1 on a scrolling board, however tall the cards are", () => {
		expect(boardFitScale(grid(false, 100), cards)).toBe(1);
	});

	it("matches the fit squeeze on a fitted board", () => {
		expect(boardFitScale(grid(true, 300), cards)).toBeCloseTo(0.5, 6);
		// Cards that already fit are never enlarged.
		expect(boardFitScale(grid(true, 900), cards)).toBe(1);
	});
});
