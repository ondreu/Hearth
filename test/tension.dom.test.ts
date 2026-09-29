/**
 * @vitest-environment jsdom
 *
 * The World Tension card, actually drawn: both styles in both designs for
 * every band, under jsdom with Obsidian's DOM helpers (test/support). The
 * diorama is built with createSvg, which rejects two classes in one string the
 * way Obsidian does, so a scene node that slipped one through fails here.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { TensionSnapshot } from "../src/tension";

let paintTensionStyle: typeof import("../src/cards/tension").paintTensionStyle;
let resolveTension: typeof import("../src/cards/tension").resolveTension;

beforeAll(async () => {
	installObsidianDom();
	({ paintTensionStyle, resolveTension } = await import("../src/cards/tension"));
});

const SCORES = { cool: 12, mild: 35, warm: 55, hot: 72, burning: 91 } as const;

function snapshot(score: number): TensionSnapshot {
	const day = 86_400_000;
	const now = Date.parse("2026-09-29T10:00:00Z");
	return {
		now: { score, summary: "Tension is up. Talks stalled again.", updated: now },
		history: Array.from({ length: 10 }, (_, i) => ({
			date: new Date(now - (9 - i) * day).toISOString(),
			time: now - (9 - i) * day,
			score: Math.max(0, score - 9 + i),
			summary: "",
		})),
		fetched: now,
	};
}

describe("the World Tension card", () => {
	it("draws every band in both styles and both designs", () => {
		for (const [band, score] of Object.entries(SCORES)) {
			for (const style of ["minimal", "artistic"] as const) {
				for (const expressive of [false, true]) {
					const wrap = document.body.createDiv();
					const r = resolveTension(
						{ style, showSummary: true, showHistory: true, showChange: true, showUpdated: true },
						false,
						1,
						expressive,
					);
					paintTensionStyle(wrap, snapshot(score), r);
					if (style === "artistic") {
						const scene = wrap.querySelector(".hearth-tension-scene");
						expect(scene?.classList.contains(`is-${band}`), band).toBe(true);
						expect(scene?.classList.contains("is-expressive")).toBe(expressive);
						expect(wrap.querySelector("svg.hearth-tension-art .ts-sky")).not.toBeNull();
						expect(wrap.querySelector(".hearth-tension-art-score")?.textContent).toContain(String(score));
					} else {
						expect(wrap.querySelector(".hearth-tension-score")?.textContent).toContain(String(score));
						expect(wrap.querySelector(".hearth-tension-scale-marker")).not.toBeNull();
						expect(!!wrap.querySelector(".hearth-tension-cookie")).toBe(expressive);
					}
					expect(wrap.querySelector(".hearth-tension-summary-text")?.textContent).toBe("Tension is up.");
					expect(wrap.querySelector(".hearth-tension-change")?.textContent).toBe("▲ 1");
					expect(wrap.querySelector(".hearth-tension-history path")).not.toBeNull();
					wrap.remove();
				}
			}
		}
	});

	it("leaves out what the card doesn't show", () => {
		const wrap = document.body.createDiv();
		paintTensionStyle(wrap, snapshot(40), resolveTension({ showBand: false, showScale: false }));
		expect(wrap.querySelector(".hearth-tension-band")).toBeNull();
		expect(wrap.querySelector(".hearth-tension-scale")).toBeNull();
		expect(wrap.querySelector(".hearth-tension-summary")).toBeNull();
		expect(wrap.querySelector(".hearth-tension-history")).toBeNull();
		wrap.remove();
	});
});
