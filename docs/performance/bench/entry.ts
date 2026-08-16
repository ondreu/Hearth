/* Harness entry: builds the real Hearth board DOM in a plain browser using the
 * plugin's own drawSky() and updateFrostLayers(), so the measurements below are
 * of the shipped code path rather than a mock-up. */
import { installDomShim } from "./dom-shim";
import { drawSky } from "../../../src/sky";
import { applyEdgeMerging, updateFrostLayers } from "../../../src/grid";

installDomShim();

/** Hearth's shipped defaults (DEFAULT_SETTINGS in src/types.ts). */
const DEFAULTS = {
	backgroundOpacity: 0.35,
	backgroundBlur: 2,
	cardOpacity: 0.5,
	cardBlur: 7,
	cardRadius: 14,
};

/** A plausible 8-card board on a 1440x900 pane. */
const CARDS = [
	{ x: 0, y: 0, w: 460, h: 260 },
	{ x: 476, y: 0, w: 460, h: 260 },
	{ x: 952, y: 0, w: 440, h: 260 },
	{ x: 0, y: 276, w: 300, h: 300 },
	{ x: 316, y: 276, w: 300, h: 300 },
	{ x: 632, y: 276, w: 300, h: 300 },
	{ x: 948, y: 276, w: 444, h: 140 },
	{ x: 948, y: 432, w: 444, h: 144 },
];

export interface Scenario {
	/** Wallpaper: none | image | sky */
	bg: "none" | "color" | "image" | "sky";
	/** CSS filter: blur() px on the wallpaper layer. */
	bgBlur: number;
	/** Animate the sky (drift/fall/twinkle). */
	skyAnimate: boolean;
	/** WMO code for the sky. 63 = rain, 95 = thunder, 0 = clear. */
	skyCode: number;
	/** backdrop-filter blur px behind the cards; 0 disables the frost layers. */
	cardBlur: number;
	/** Fraction of the sky's field to draw — what the "balanced" tier reports. */
	density?: number;
}

function makeBoard(root: HTMLElement, s: Scenario): void {
	root.empty();
	root.setAttribute("class", "hearth-view");

	// ---- Wallpaper layer, exactly as background.ts paints it ----
	if (s.bg !== "none") {
		const layer = root.createDiv("hearth-bg");
		layer.style.opacity = String(DEFAULTS.backgroundOpacity);
		if (s.bgBlur > 0) layer.style.filter = `blur(${s.bgBlur}px)`;
		if (s.bg === "color") {
			layer.style.background = "#101014";
		} else if (s.bg === "image") {
			// A local gradient stands in for the wallpaper: same compositing shape
			// as a bitmap, with no network in the measurement.
			layer.style.background =
				"linear-gradient(135deg,#2b3a55 0%,#7b4b6e 40%,#c98a5e 70%,#22303f 100%)";
		} else {
			drawSky(layer, {
				code: s.skyCode,
				isDay: false,
				animate: s.skyAnimate,
				density: s.density ?? 1,
				spread: "board",
			});
		}
	}

	const scroll = root.createDiv("hearth-scroll");
	const inner = scroll.createDiv("hearth-inner");
	const dash = inner.createDiv("hearth-dashboard");
	const grid = dash.createDiv("hearth-grid");
	grid.style.setProperty("--card-opacity", String(DEFAULTS.cardOpacity));
	grid.style.setProperty("--hearth-card-radius", `${DEFAULTS.cardRadius}px`);
	grid.style.setProperty("--card-border-width", "1px");
	grid.style.position = "relative";
	grid.style.height = "600px";

	for (const c of CARDS) {
		const el = grid.createDiv("hearth-card");
		el.style.position = "absolute";
		el.style.left = `${c.x}px`;
		el.style.top = `${c.y}px`;
		el.style.width = `${c.w}px`;
		el.style.height = `${c.h}px`;
		if (s.cardBlur > 0) {
			el.addClass("has-blur");
			el.dataset.blur = String(s.cardBlur);
		}
		const head = el.createDiv("hearth-card-head");
		head.createDiv({ cls: "hearth-card-title", text: "Card" });
		const body = el.createDiv("hearth-card-body");
		body.createDiv({ text: "Some representative card content." });
	}

	// The shipped reflow path: merge classes then the frost rebuild.
	applyEdgeMerging(grid);
}

declare global {
	interface Window {
		hearthBench: {
			build: (s: Scenario) => void;
			countAnimated: () => number;
			frostMaskBytes: () => number;
			rebuildFrost: () => void;
		};
	}
}

const root = document.getElementById("root") as HTMLElement;

window.hearthBench = {
	build: (s: Scenario) => makeBoard(root, s),
	/** How many elements currently have a running CSS animation. */
	countAnimated: () => document.getAnimations().length,
	/** Total bytes of the inline SVG data-URI masks on the frost layers. */
	frostMaskBytes: () => {
		let n = 0;
		for (const l of Array.from(document.querySelectorAll<HTMLElement>(".hearth-frost"))) {
			n += (l.style.getPropertyValue("mask-image") || "").length;
		}
		return n;
	},
	rebuildFrost: () => {
		const grid = document.querySelector<HTMLElement>(".hearth-grid");
		if (grid) updateFrostLayers(grid);
	},
};
