/**
 * The World Tension card's artistic style: a diorama that goes from peace to
 * war as the score climbs.
 *
 * One landscape — hills, a village with a church, a windmill — drawn five ways,
 * one per band of the score:
 *
 * - `cool`    — a spring morning: the windmill turns, sheep graze, birds fly.
 * - `mild`    — an afternoon with clouds coming in and a watchtower on the hill.
 * - `warm`    — an amber overcast: an army camp, a parked tank, barbed wire.
 * - `hot`     — a red dusk: tanks on the move, jets overhead, searchlights,
 *               smoke, the first house alight.
 * - `burning` — night: a bomber over the village, bombs falling, flak,
 *               explosions and the houses in ruins.
 *
 * The scene is built as plain data (a tree of {@link SceneNode}s) with no DOM
 * and no Obsidian import, so it can be unit-tested and rendered outside the app;
 * {@link mountScene} turns it into SVG. Colours live in styles.css
 * (`.hearth-tension-scene.is-<band>`), keyed by the `ts-*` classes here, the
 * same way the weather card's painted sky keeps its palettes in CSS.
 *
 * Two designs share the geometry: "classic" paints gradients, glows and soft
 * silhouettes; "expressive" draws Material 3 Expressive's flat tonal shapes — a
 * turning sunny for the sun, bubbly clouds, lollipop trees, cookie-shaped
 * blasts.
 *
 * Motion is CSS, and follows the rule the painted sky learned the hard way: a
 * CSS animation replaces an element's `transform` attribute, so nothing that
 * moves carries its position in one. The position sits on a parent group and
 * the motion on the child.
 */
import { shapePath, sparklePath } from "./shapes";
import type { TensionBand } from "./tension";

export type SceneDesign = "classic" | "expressive";

export interface SceneNode {
	tag: string;
	cls?: string[];
	attr?: Record<string, string>;
	/** Inline style — animation delays, mostly. */
	style?: Record<string, string>;
	children?: SceneNode[];
}

export interface SceneOptions {
	band: TensionBand;
	design: SceneDesign;
	/** Fraction of the particles (smoke, flak, birds) to draw, 0–1. The
	 * "balanced" performance tier's whole saving. Default 1. */
	density?: number;
	/** Makes gradient ids unique when several cards share a board. */
	uid?: string;
}

/** The scene's own coordinate space. */
export const SCENE_W = 360;
export const SCENE_H = 220;

// ---- Node helpers -------------------------------------------------------------

const n = (v: number): string => (Math.round(v * 100) / 100).toString();

function el(tag: string, cls: string | string[] | undefined, attr: Record<string, string | number> = {}, children?: SceneNode[]): SceneNode {
	const out: SceneNode = { tag };
	if (cls) out.cls = Array.isArray(cls) ? cls : [cls];
	const a: Record<string, string> = {};
	for (const [k, v] of Object.entries(attr)) a[k] = typeof v === "number" ? n(v) : v;
	if (Object.keys(a).length) out.attr = a;
	if (children?.length) out.children = children;
	return out;
}

const g = (cls: string | string[] | undefined, children: SceneNode[], attr: Record<string, string | number> = {}): SceneNode =>
	el("g", cls, attr, children);
const path = (cls: string | string[], d: string, attr: Record<string, string | number> = {}): SceneNode =>
	el("path", cls, { d, ...attr });
const rect = (cls: string | string[], x: number, y: number, w: number, h: number, rx = 0): SceneNode =>
	el("rect", cls, rx ? { x, y, width: w, height: h, rx } : { x, y, width: w, height: h });
const circle = (cls: string | string[], cx: number, cy: number, r: number): SceneNode => el("circle", cls, { cx, cy, r });
const ellipse = (cls: string | string[], cx: number, cy: number, rx: number, ry: number): SceneNode =>
	el("ellipse", cls, { cx, cy, rx, ry });
const at = (x: number, y: number, children: SceneNode[], cls?: string | string[], scale = 1): SceneNode =>
	g(cls, children, { transform: scale === 1 ? `translate(${n(x)} ${n(y)})` : `translate(${n(x)} ${n(y)}) scale(${n(scale)})` });

/** A node that is animated: its delay (negative, so it starts mid-cycle) and
 * optionally its duration. */
function timed(node: SceneNode, delay: number, duration?: number): SceneNode {
	node.style = { ...node.style, animationDelay: `${n(delay)}s` };
	if (duration !== undefined) node.style.animationDuration = `${n(duration)}s`;
	return node;
}

/** Where a moving node rests while motion is off — an inline transform, which
 * a running animation overrides. */
function still(node: SceneNode, transform: string): SceneNode {
	node.style = { ...node.style, transform };
	return node;
}

function thin(count: number, density: number): number {
	return density >= 1 ? count : Math.max(1, Math.round(count * density));
}

// ---- What each band shows ---------------------------------------------------------

const LEVEL: Record<TensionBand, number> = { cool: 0, mild: 1, warm: 2, hot: 3, burning: 4 };

/** Ground line of each layer, in scene units. */
const FAR_Y = 138;
const MID_Y = 160;
const NEAR_Y = 188;

// ---- Sky ------------------------------------------------------------------------

function sky(o: Required<SceneOptions>, defs: SceneNode[]): SceneNode[] {
	// Sky above the scene's own box, for a card taller than the scene: there
	// the scene sits full-width on the card's bottom edge (styles.css) and this
	// is what fills the card above it.
	const out: SceneNode[] = [rect("ts-sky-over", -SCENE_W, -SCENE_H * 3, SCENE_W * 3, SCENE_H * 3 + 1)];
	const lvl = LEVEL[o.band];
	if (o.design === "classic") {
		const id = `ts-sky-${o.uid}`;
		defs.push(
			el("linearGradient", undefined, { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
				el("stop", "ts-sky-top", { offset: "0" }),
				el("stop", "ts-sky-mid", { offset: "0.55" }),
				el("stop", "ts-sky-bottom", { offset: "1" }),
			]),
		);
		out.push(el("rect", "ts-sky", { x: 0, y: 0, width: SCENE_W, height: SCENE_H, fill: `url(#${id})` }));
		if (lvl >= 3) {
			const glow = `ts-glow-${o.uid}`;
			defs.push(
				el("radialGradient", undefined, { id: glow, cx: "0.62", cy: "1", r: "0.75" }, [
					el("stop", "ts-glow-in", { offset: "0" }),
					el("stop", "ts-glow-out", { offset: "1" }),
				]),
			);
			out.push(el("rect", "ts-horizon-glow", { x: 0, y: 40, width: SCENE_W, height: 150, fill: `url(#${glow})` }));
		}
	} else {
		out.push(rect("ts-sky", 0, 0, SCENE_W, SCENE_H));
		// A second flat band low on the sky: Expressive's tonal step instead of a
		// gradient.
		out.push(path("ts-sky-band", `M0 92 Q 180 70 360 92 L360 ${SCENE_H} L0 ${SCENE_H} Z`));
	}
	return out;
}

function sun(o: Required<SceneOptions>): SceneNode[] {
	const lvl = LEVEL[o.band];
	if (lvl === 4) {
		// Night: a pale moon behind the smoke.
		const moon = g("ts-moon-wrap", [circle("ts-moon", 300, 40, 11), circle("ts-moon-bite", 305, 37, 10)]);
		return [moon];
	}
	// The sun sinks and reddens as the score climbs.
	const pos = [
		{ x: 292, y: 42, r: 15 },
		{ x: 300, y: 50, r: 14 },
		{ x: 305, y: 70, r: 16 },
		{ x: 300, y: 112, r: 20 },
	][lvl];
	if (o.design === "expressive") {
		return [
			g("ts-sun", [
				circle("ts-sun-glow", pos.x, pos.y, pos.r * 1.9),
				at(pos.x, pos.y, [g("ts-sunny", [path("ts-sun-disc", shapePath(0, 0, pos.r, 8, 0.11))])]),
			]),
		];
	}
	return [g("ts-sun", [circle("ts-sun-glow", pos.x, pos.y, pos.r * 2.2), circle("ts-sun-disc", pos.x, pos.y, pos.r)])];
}

function stars(o: Required<SceneOptions>): SceneNode[] {
	if (o.band !== "burning") return [];
	const pts = [
		[30, 18, 0.9], [72, 34, 0.7], [118, 14, 1], [160, 30, 0.6], [206, 12, 0.8], [246, 26, 0.7], [338, 20, 0.9], [352, 58, 0.6],
	];
	return [
		g(
			"ts-stars",
			pts.map(([x, y, r], i) =>
				timed(o.design === "expressive" ? path("ts-star", sparklePath(x, y, r * 2.6)) : circle("ts-star", x, y, r), -i * 0.7),
			),
		),
	];
}

function cloud(o: Required<SceneOptions>, x: number, y: number, scale: number, cls: string, lane: number): SceneNode {
	const shape =
		o.design === "expressive"
			? [circle("", -13, 4, 11), circle("", 3, -3, 14), circle("", 18, 5, 10), rect("", -26, 3, 56, 14, 7)]
			: [ellipse("", -14, 4, 16, 10), ellipse("", 2, -2, 18, 13), ellipse("", 18, 5, 15, 9), rect("", -28, 4, 58, 11, 5.5)];
	for (const s of shape) delete s.cls;
	// Outer group drifts; inner group holds the place and size.
	return timed(g(["ts-drift", `is-lane-${lane}`], [at(x, y, [g(cls, shape)], undefined, scale)]), -(x / SCENE_W) * (50 + lane * 18));
}

function clouds(o: Required<SceneOptions>): SceneNode[] {
	const lvl = LEVEL[o.band];
	const plan: [number, number, number, string][][] = [
		[[200, 26, 0.7, "ts-cloud"], [132, 70, 0.6, "ts-cloud"]],
		[[150, 30, 0.9, "ts-cloud"], [226, 20, 0.8, "ts-cloud"], [270, 60, 0.7, "ts-cloud"], [340, 28, 0.6, "ts-cloud"]],
		[[150, 26, 1.2, "ts-cloud"], [230, 40, 1.3, "ts-cloud"], [320, 22, 1.0, "ts-cloud-dark"], [80, 72, 0.9, "ts-cloud"], [196, 14, 1.0, "ts-cloud-dark"]],
		[[170, 20, 1.1, "ts-cloud-dark"], [250, 40, 1.1, "ts-cloud"], [90, 76, 0.8, "ts-cloud-dark"]],
		[[150, 30, 1.2, "ts-cloud-dark"], [262, 18, 1.1, "ts-cloud-dark"], [60, 80, 0.9, "ts-cloud-dark"]],
	];
	return [g("ts-clouds", plan[lvl].map(([x, y, s, cls], i) => cloud(o, x, y, s, cls, i % 3)))];
}

// ---- Land -----------------------------------------------------------------------

function hills(o: Required<SceneOptions>): { far: SceneNode; mid: SceneNode; near: SceneNode } {
	const exp = o.design === "expressive";
	const far = exp
		? `M0 ${FAR_Y} Q 60 ${FAR_Y - 26} 130 ${FAR_Y - 6} Q 200 ${FAR_Y - 30} 270 ${FAR_Y - 8} Q 320 ${FAR_Y - 20} 360 ${FAR_Y - 10} L360 ${SCENE_H} L0 ${SCENE_H} Z`
		: `M0 ${FAR_Y - 4} C 40 ${FAR_Y - 22} 80 ${FAR_Y - 24} 125 ${FAR_Y - 8} C 170 ${FAR_Y - 30} 230 ${FAR_Y - 34} 280 ${FAR_Y - 12} C 310 ${FAR_Y - 20} 340 ${FAR_Y - 18} 360 ${FAR_Y - 10} L360 ${SCENE_H} L0 ${SCENE_H} Z`;
	const mid = exp
		? `M0 ${MID_Y + 4} Q 90 ${MID_Y - 18} 180 ${MID_Y - 4} Q 270 ${MID_Y - 22} 360 ${MID_Y - 2} L360 ${SCENE_H} L0 ${SCENE_H} Z`
		: `M0 ${MID_Y + 2} C 60 ${MID_Y - 10} 120 ${MID_Y - 12} 180 ${MID_Y - 4} C 240 ${MID_Y - 16} 300 ${MID_Y - 18} 360 ${MID_Y - 4} L360 ${SCENE_H} L0 ${SCENE_H} Z`;
	const near = exp
		? `M0 ${NEAR_Y} Q 180 ${NEAR_Y - 12} 360 ${NEAR_Y} L360 ${SCENE_H} L0 ${SCENE_H} Z`
		: `M0 ${NEAR_Y - 2} C 90 ${NEAR_Y - 8} 250 ${NEAR_Y - 6} 360 ${NEAR_Y - 2} L360 ${SCENE_H} L0 ${SCENE_H} Z`;
	return { far: path("ts-hill-far", far), mid: path("ts-hill-mid", mid), near: path("ts-ground", near) };
}

function tree(o: Required<SceneOptions>, x: number, y: number, s: number): SceneNode {
	const lvl = LEVEL[o.band];
	if (lvl >= 3) {
		// Charred: a bare trunk and two stubs.
		return at(x, y, [path("ts-tree-dead", "M0 0 L0 -14 M0 -8 L-4 -12 M0 -10 L4 -15")], undefined, s);
	}
	const crown =
		o.design === "expressive"
			? [circle("ts-tree", 0, -13, 6.5)]
			: [ellipse("ts-tree", 0, -13, 5.5, 7.5), ellipse("ts-tree-light", -1.5, -15, 2.6, 3.6)];
	return at(x, y, [rect("ts-trunk", -0.9, -7, 1.8, 7), ...crown], undefined, s);
}

interface HouseState {
	ruined: boolean;
	burning: boolean;
	lit: boolean;
}

function flame(o: Required<SceneOptions>, x: number, y: number, s: number, delay: number): SceneNode {
	const body =
		o.design === "expressive"
			? [path("ts-fire", "M0 0 C -6 0 -7 -6 -4 -10 C -3 -6 -1 -7 -1 -9 C -1 -13 2 -16 3 -19 C 4 -14 7 -11 7 -6 C 7 -2 4 0 0 0 Z"), path("ts-fire-core", "M0 0 C -3 0 -3.5 -3 -2 -5 C -1 -3 0 -4 0.5 -7 C 2 -5 3.5 -3.5 3.5 -2 C 3.5 -0.5 2 0 0 0 Z")]
			: [path("ts-fire", "M0 0 C -7 0 -7 -8 -3 -12 C -3 -8 0 -8 -1 -12 C 0 -16 3 -18 3 -22 C 7 -17 8 -10 6 -5 C 5 -2 3 0 0 0 Z"), path("ts-fire-core", "M0 0 C -3 0 -4 -3 -2 -6 C -1 -4 1 -5 1 -8 C 3 -6 4 -3 3 -1.5 C 2.5 -0.5 1.5 0 0 0 Z")];
	return at(x, y, [timed(g("ts-flicker", body), delay)], undefined, s);
}

function smoke(o: Required<SceneOptions>, x: number, y: number, s: number, puffs: number, seed: number): SceneNode {
	const count = thin(puffs, o.density);
	const kids: SceneNode[] = [];
	for (let i = 0; i < count; i++) {
		const f = i / count;
		const dx = Math.sin((i + seed) * 1.7) * 3 + f * 10;
		kids.push(timed(circle("ts-smoke", dx, -f * 34, 4 + f * 7), -(f * 6 + seed * 0.37), 6));
	}
	return at(x, y, [g("ts-plume", kids)], undefined, s);
}

function house(o: Required<SceneOptions>, x: number, y: number, w: number, h: number, st: HouseState, seed: number): SceneNode {
	const exp = o.design === "expressive";
	const top = y - h;
	const roofH = h * 0.75;
	const kids: SceneNode[] = [];
	if (st.ruined) {
		// Broken walls with a jagged top, no roof.
		const d = `M${x} ${y} L${x} ${top + 3} L${x + w * 0.2} ${top} L${x + w * 0.35} ${top + h * 0.35} L${x + w * 0.55} ${top + 2} L${x + w * 0.7} ${top + h * 0.45} L${x + w} ${top + h * 0.25} L${x + w} ${y} Z`;
		kids.push(path("ts-ruin", d));
		kids.push(rect("ts-window-lit", x + w * 0.2, top + h * 0.55, w * 0.18, h * 0.22));
		kids.push(rect("ts-window-lit", x + w * 0.62, top + h * 0.6, w * 0.16, h * 0.2));
	} else {
		kids.push(rect("ts-wall", x, top, w, h, exp ? 1.5 : 0));
		kids.push(rect("ts-wall-shade", x + w * 0.72, top, w * 0.28, h, exp ? 1.5 : 0));
		const roof = `M${x - 2} ${top + 0.5} L${x + w / 2} ${top - roofH} L${x + w + 2} ${top + 0.5} Z`;
		kids.push(path(exp ? ["ts-roof", "is-round"] : "ts-roof", roof));
		const win = st.lit ? "ts-window-lit" : "ts-window";
		kids.push(rect(win, x + w * 0.16, top + h * 0.28, w * 0.2, h * 0.24, exp ? 0.8 : 0));
		kids.push(rect("ts-door", x + w * 0.52, top + h * 0.45, w * 0.2, h * 0.55, exp ? 0.8 : 0));
	}
	const out: SceneNode[] = [g("ts-house", kids)];
	if (st.burning) {
		const fy = st.ruined ? top + h * 0.3 : top - roofH * 0.2;
		out.push(smoke(o, x + w * 0.5, fy - 8, 1, 7, seed));
		out.push(flame(o, x + w * 0.45, fy + 2, st.ruined ? 0.9 : 0.8, -seed * 0.3));
	}
	return g(undefined, out);
}

function church(o: Required<SceneOptions>, x: number, y: number, st: HouseState): SceneNode {
	const exp = o.design === "expressive";
	const kids: SceneNode[] = [];
	if (st.ruined) {
		kids.push(path("ts-ruin", `M${x} ${y} L${x} ${y - 16} L${x + 6} ${y - 20} L${x + 8} ${y - 34} L${x + 12} ${y - 38} L${x + 14} ${y - 26} L${x + 22} ${y - 18} L${x + 30} ${y - 12} L${x + 30} ${y} Z`));
		kids.push(rect("ts-window-lit", x + 9, y - 24, 3, 5));
		return g("ts-church", kids);
	}
	// Nave, then the tower with its spire and cross.
	kids.push(rect("ts-wall", x + 10, y - 16, 20, 16, exp ? 1.5 : 0));
	kids.push(path(exp ? ["ts-roof", "is-round"] : "ts-roof", `M${x + 9} ${y - 15.5} L${x + 20} ${y - 25} L${x + 31} ${y - 15.5} Z`));
	kids.push(rect("ts-wall", x, y - 32, 10, 32, exp ? 1.5 : 0));
	kids.push(rect("ts-wall-shade", x + 7, y - 32, 3, 32));
	kids.push(path(exp ? ["ts-roof", "is-round"] : "ts-roof", `M${x - 1} ${y - 31.5} L${x + 5} ${y - 48} L${x + 11} ${y - 31.5} Z`));
	kids.push(path("ts-cross", `M${x + 5} ${y - 48} L${x + 5} ${y - 55} M${x + 2.5} ${y - 52.5} L${x + 7.5} ${y - 52.5}`));
	kids.push(el("path", st.lit ? "ts-window-lit" : "ts-window", { d: `M${x + 3.5} ${y - 20} L${x + 3.5} ${y - 24} Q ${x + 5} ${y - 26} ${x + 6.5} ${y - 24} L${x + 6.5} ${y - 20} Z` }));
	kids.push(rect(st.lit ? "ts-window-lit" : "ts-window", x + 15, y - 11, 3, 5));
	kids.push(rect(st.lit ? "ts-window-lit" : "ts-window", x + 22, y - 11, 3, 5));
	return g("ts-church", kids);
}

function windmill(o: Required<SceneOptions>, x: number, y: number): SceneNode {
	const lvl = LEVEL[o.band];
	if (lvl === 4) {
		return path("ts-ruin", `M${x - 6} ${y} L${x - 4} ${y - 16} L${x} ${y - 20} L${x + 3} ${y - 14} L${x + 6} ${y} Z`);
	}
	const exp = o.design === "expressive";
	const blade = (a: number): SceneNode =>
		g(undefined, [rect("ts-blade", -1.6, -20, 3.2, 20, exp ? 1.6 : 0), rect("ts-blade-sail", -1.2, -19, 5, 14, exp ? 1 : 0)], { transform: `rotate(${a})` });
	const spin = g(lvl >= 3 ? "ts-mill-still" : "ts-spin", [blade(20), blade(110), blade(200), blade(290)]);
	return g("ts-windmill", [
		path("ts-mill", exp ? `M${x - 7} ${y} L${x - 4.5} ${y - 26} Q ${x} ${y - 32} ${x + 4.5} ${y - 26} L${x + 7} ${y} Z` : `M${x - 7} ${y} L${x - 4} ${y - 26} L${x} ${y - 31} L${x + 4} ${y - 26} L${x + 7} ${y} Z`),
		rect("ts-door", x - 1.8, y - 7, 3.6, 7, exp ? 1 : 0),
		at(x, y - 26, [spin, circle("ts-hub", 0, 0, 1.8)]),
	]);
}

function watchtower(o: Required<SceneOptions>, x: number, y: number): SceneNode {
	const lvl = LEVEL[o.band];
	const exp = o.design === "expressive";
	const kids: SceneNode[] = [
		path("ts-tower-legs", `M${x - 6} ${y} L${x - 3} ${y - 24} M${x + 6} ${y} L${x + 3} ${y - 24} M${x - 5} ${y - 6} L${x + 4} ${y - 16} M${x + 5} ${y - 6} L${x - 4} ${y - 16}`),
		rect("ts-tower", x - 6, y - 32, 12, 8, exp ? 1.5 : 0),
		path(exp ? ["ts-tower-roof", "is-round"] : "ts-tower-roof", `M${x - 8} ${y - 31.5} L${x} ${y - 37} L${x + 8} ${y - 31.5} Z`),
		path("ts-pole", `M${x} ${y - 37} L${x} ${y - 48}`),
		at(x, y - 48, [g("ts-wave", [path(lvl >= 2 ? "ts-flag-war" : "ts-flag", "M0 0 L10 1.5 L10 6.5 L0 5 Z")])]),
	];
	return g("ts-watchtower", kids);
}

function searchlight(x: number, y: number, delay: number): SceneNode {
	return at(x, y, [timed(g("ts-sweep", [path("ts-beam", "M-1.5 0 L-16 -120 L16 -120 L1.5 0 Z")]), delay), rect("ts-lamp", -3, -2, 6, 4, 1)]);
}

function tent(o: Required<SceneOptions>, x: number, y: number, s: number): SceneNode {
	const exp = o.design === "expressive";
	return at(x, y, [
		path(exp ? ["ts-tent", "is-round"] : "ts-tent", "M-10 0 L0 -10 L10 0 Z"),
		path("ts-tent-door", "M-2 0 L0 -6 L2 0 Z"),
	], undefined, s);
}

function tank(o: Required<SceneOptions>, x: number, y: number, s: number, facing: 1 | -1, firing: boolean, delay = 0): SceneNode {
	const exp = o.design === "expressive";
	const r = exp ? 3 : 1.5;
	const kids: SceneNode[] = [
		rect("ts-tank-track", -14, -6, 28, 6, 3),
		circle("ts-tank-wheel", -9, -3, 1.8),
		circle("ts-tank-wheel", -3, -3, 1.8),
		circle("ts-tank-wheel", 3, -3, 1.8),
		circle("ts-tank-wheel", 9, -3, 1.8),
		rect("ts-tank", -12, -11, 24, 5.5, r),
		rect("ts-tank", -6, -16, 12, 5.5, r),
		rect("ts-tank", 5, -14.6, 14, 2.2, 1),
	];
	if (firing) kids.push(at(21, -13.5, [timed(g("ts-muzzle", [path("ts-flash", sparklePath(0, 0, 5, 0.6))]), delay)]));
	return at(x, y, [g("ts-tank-body", kids, facing === -1 ? { transform: "scale(-1 1)" } : {})], undefined, s);
}

function jet(o: Required<SceneOptions>, y: number, delay: number, s: number, stillX: number): SceneNode {
	const exp = o.design === "expressive";
	const body = exp
		? [path("ts-jet", "M0 0 Q 2 -2.4 8 -2.2 L 20 -1.6 Q 23 0 20 1.6 L 8 2.2 Q 2 2.4 0 0 Z"), path("ts-jet", "M9 -1 L4 -9 L7.5 -9 L14 -1 Z"), path("ts-jet", "M2 -1 L-1 -6 L1.5 -6 L5 -1 Z")]
		: [path("ts-jet", "M0 0 L6 -2 L20 -1.2 L23 0 L20 1.2 L6 2 Z"), path("ts-jet", "M8 -1 L3 -9 L6 -9 L13 -1 Z"), path("ts-jet", "M1.5 -1 L-1.5 -6 L0.5 -6 L4.5 -1 Z")];
	// The jet flies right to left, trailing its contrail. Still, it hangs
	// where it reads best; a running animation overrides the inline transform.
	const fly = timed(g("ts-fly-jet", [at(0, y, [path("ts-contrail", "M22 0 L96 0"), ...body], undefined, s)]), delay);
	fly.style = { ...fly.style, transform: `translateX(${n(stillX)}px)` };
	return fly;
}

function bomber(o: Required<SceneOptions>, y: number): SceneNode {
	const exp = o.design === "expressive";
	const plane = exp
		? [
			path("ts-bomber", "M-38 0 Q -40 -4 -30 -5 L 30 -4.5 Q 42 -3 44 0 Q 42 3 30 4 L -30 4 Q -40 3 -38 0 Z"),
			path("ts-bomber", "M-30 -4 L-38 -17 L-31 -17 L-20 -4 Z"),
			path("ts-bomber", "M-8 -1 L-22 3 L22 3 L10 -1 Z"),
			rect("ts-bomber", -14, 3, 8, 4, 2),
			rect("ts-bomber", 6, 3, 8, 4, 2),
			circle("ts-bomber-glass", 38, -1, 2.2),
		]
		: [
			path("ts-bomber", "M-40 -1 L-30 -5 L28 -5 L40 -2 L44 0 L40 2 L28 4 L-30 3 Z"),
			path("ts-bomber", "M-30 -4 L-40 -18 L-33 -18 L-20 -4 Z"),
			path("ts-bomber", "M-10 -1 L-24 4 L24 4 L12 -1 Z"),
			rect("ts-bomber", -15, 3, 8, 3.5, 1.5),
			rect("ts-bomber", 7, 3, 8, 3.5, 1.5),
			path("ts-bomber-glass", "M36 -2 L42 -0.5 L36 1 Z"),
		];
	// Bombs ride with the plane and fall out of it, one after another.
	const bombs = [0, 1, 2].map((i) =>
		at(-2 + i * 7, 6, [still(timed(g("ts-drop", [rect("ts-bomb", -1.3, 0, 2.6, 6, 1.3), path("ts-bomb-fin", "M-2 0 L2 0 L0 2 Z")]), -i * 0.9), `translateY(${6 + i * 12}px)`)]),
	);
	const fly = timed(g("ts-fly-bomber", [at(0, y, [g(undefined, plane), ...bombs], undefined, 1.35)]), -9);
	fly.style = { ...fly.style, transform: "translateX(196px)" };
	return fly;
}

function blast(o: Required<SceneOptions>, x: number, y: number, s: number, delay: number): SceneNode {
	const inner =
		o.design === "expressive"
			? [path("ts-blast", shapePath(0, 0, 11, 10, 0.24)), path("ts-blast-core", shapePath(0, 0, 6, 7, 0.2))]
			: [circle("ts-blast-glow", 0, 0, 18), path("ts-blast", shapePath(0, 0, 9, 13, 0.3)), path("ts-blast-core", shapePath(0, 0, 4.6, 7, 0.28))];
	return at(x, y, [timed(g("ts-boom", inner), delay)], undefined, s);
}

function flak(o: Required<SceneOptions>): SceneNode[] {
	const pts: [number, number][] = [[80, 40], [130, 70], [200, 30], [250, 64], [330, 44], [40, 66], [170, 54]];
	const count = thin(pts.length, o.density);
	return [
		g(
			"ts-flak-field",
			pts.slice(0, count).map(([x, y], i) =>
				at(x, y, [
					timed(
						g("ts-flak", [
							o.design === "expressive" ? path("ts-flak-puff", shapePath(0, 0, 4, 6, 0.25)) : circle("ts-flak-puff", 0, 0, 4),
							path("ts-flak-spark", sparklePath(0, 0, 3.4, 0.7)),
						]),
						-i * 0.63,
					),
				]),
			),
		),
	];
}

function birds(o: Required<SceneOptions>): SceneNode[] {
	const lvl = LEVEL[o.band];
	if (lvl >= 2) return [];
	const flock: [number, number, number][] = lvl === 0
		? [[120, 52, 1], [134, 46, 0.8], [146, 56, 0.9], [160, 42, 0.7], [104, 60, 0.7]]
		: [[150, 60, 0.9], [164, 54, 0.8], [176, 64, 0.7]];
	const count = thin(flock.length, o.density);
	return [
		g(
			"ts-flock",
			flock.slice(0, count).map(([x, y, s], i) => at(x, y, [timed(g("ts-flap", [path("ts-bird", "M-5 0 Q -2.5 -3 0 0 Q 2.5 -3 5 0")]), -i * 0.37)], undefined, s)),
		),
	];
}

function sheep(o: Required<SceneOptions>, x: number, y: number, s: number): SceneNode {
	const exp = o.design === "expressive";
	const wool = exp
		? [circle("ts-wool", -3, -5, 3.2), circle("ts-wool", 1, -6, 3.6), circle("ts-wool", 4, -4.5, 3)]
		: [ellipse("ts-wool", 0, -5, 6, 3.8)];
	return at(x, y, [path("ts-leg", "M-3 -2 L-3 0 M3 -2 L3 0"), ...wool, ellipse("ts-sheep-head", 6.5, -6, 1.8, 1.5)], undefined, s);
}

function flowers(o: Required<SceneOptions>): SceneNode[] {
	const pts: [number, number, string][] = [
		[24, 204, "ts-flower-a"], [46, 210, "ts-flower-b"], [70, 202, "ts-flower-a"], [96, 212, "ts-flower-c"], [140, 206, "ts-flower-b"],
		[196, 211, "ts-flower-a"], [236, 204, "ts-flower-c"], [280, 210, "ts-flower-b"], [318, 203, "ts-flower-a"], [344, 211, "ts-flower-c"],
	];
	return [
		g(
			"ts-flowers",
			pts.map(([x, y, cls]) => (o.design === "expressive" ? path(cls, shapePath(x, y, 2, 5, 0.3, 6)) : circle(cls, x, y, 1.4))),
		),
	];
}

function wire(o: Required<SceneOptions>, y: number): SceneNode {
	const posts: SceneNode[] = [];
	let coil = `M0 ${y - 5}`;
	for (let x = 0; x <= SCENE_W; x += 6) coil += ` Q ${x + 3} ${y - 10} ${x + 6} ${y - 5} Q ${x + 3} ${y} ${x} ${y - 5}`;
	for (let x = 14; x < SCENE_W; x += 44) posts.push(path("ts-post", `M${x - 3} ${y + 2} L${x} ${y - 12} L${x + 3} ${y + 2}`));
	return g("ts-wire", [...posts, path("ts-coil", coil)]);
}

function sandbags(o: Required<SceneOptions>, x: number, y: number): SceneNode {
	const bags: SceneNode[] = [];
	const rows = [[0, 6], [3, 5], [6, 4]];
	rows.forEach(([dx, count], r) => {
		for (let i = 0; i < count; i++) bags.push(rect("ts-sandbag", x + dx + i * 9, y - 4.5 - r * 4.5, 9, 5, 2.5));
	});
	return g("ts-sandbags", bags);
}

function crater(x: number, y: number, s: number): SceneNode {
	return at(x, y, [ellipse("ts-crater-rim", 0, 0, 14, 3.4), ellipse("ts-crater", 0, 0.4, 10, 2.2)], undefined, s);
}

// ---- The scene ----------------------------------------------------------------------

/** Build the diorama for a band. Pure: same options, same tree. */
export function buildScene(opts: SceneOptions): SceneNode {
	const o: Required<SceneOptions> = {
		band: opts.band,
		design: opts.design,
		density: Math.max(0, Math.min(1, opts.density ?? 1)),
		uid: opts.uid ?? "0",
	};
	const lvl = LEVEL[o.band];
	const defs: SceneNode[] = [];
	const layers: SceneNode[] = [];
	const land = hills(o);

	layers.push(...sky(o, defs), ...stars(o), ...sun(o));
	if (lvl >= 3) layers.push(searchlight(44, FAR_Y - 6, -1.2), searchlight(330, FAR_Y - 4, -3.4));
	layers.push(...clouds(o));
	if (lvl === 3) layers.push(jet(o, 34, -1.5, 0.9, 214), jet(o, 52, -4.2, 0.7, 150));
	if (lvl === 4) layers.push(...flak(o), bomber(o, 46), jet(o, 80, -2.6, 0.6, 60));
	layers.push(...birds(o));

	// The far hill: the windmill and, from mild up, the watchtower.
	const far: SceneNode[] = [land.far, at(104, FAR_Y - 12, [windmill(o, 0, 0)], undefined, 1.2)];
	if (lvl >= 1) far.push(at(158, FAR_Y - 8, [watchtower(o, 0, 0)], undefined, 1.15));
	if (lvl >= 3) far.push(smoke(o, 64, FAR_Y - 14, 1.3, 9, 3), smoke(o, 230, FAR_Y - 18, 1.1, 8, 5));
	if (lvl === 4) far.push(blast(o, 120, FAR_Y - 12, 0.9, -0.4), blast(o, 262, FAR_Y - 16, 0.8, -1.9));
	layers.push(g("ts-far", far));

	// The village on the middle hill.
	const houseState = (i: number): HouseState => ({
		ruined: lvl === 4 && i !== 2,
		burning: (lvl === 3 && i === 1) || (lvl === 4 && i !== 3),
		lit: lvl >= 3,
	});
	const buildings: SceneNode[] = [
		tree(o, 180, MID_Y - 3, 1),
		tree(o, 338, MID_Y - 3, 1.1),
		house(o, 196, MID_Y - 3, 16, 12, houseState(0), 1),
		house(o, 218, MID_Y - 5, 18, 13, houseState(1), 2),
		church(o, 244, MID_Y - 6, { ...houseState(2), burning: false }),
		house(o, 282, MID_Y - 5, 16, 12, houseState(3), 4),
		house(o, 304, MID_Y - 3, 20, 13, houseState(4), 6),
		tree(o, 328, MID_Y - 1, 0.9),
	];
	if (lvl === 4) buildings.push(smoke(o, 262, MID_Y - 40, 1.3, 10, 7));
	// Drawn at a comfortable size to work with, then enlarged about the
	// church so the village reads on a small card.
	const village: SceneNode[] = [land.mid, g(undefined, buildings, { transform: "translate(250 157) scale(1.25) translate(-250 -157)" })];
	if (lvl >= 2) {
		village.push(tent(o, 38, MID_Y + 2, 1), tent(o, 62, MID_Y + 4, 0.9), tent(o, 84, MID_Y + 3, 0.8));
	}
	if (lvl === 2) village.push(tank(o, 140, MID_Y - 4, 1, 1, false));
	layers.push(g("ts-mid", village));

	// The near ground.
	const near: SceneNode[] = [land.near];
	if (lvl === 0) near.push(sheep(o, 150, NEAR_Y + 6, 1.2), sheep(o, 176, NEAR_Y + 10, 1), sheep(o, 110, NEAR_Y + 12, 1.1), ...flowers(o));
	if (lvl === 1) near.push(sheep(o, 170, NEAR_Y + 8, 1.1), ...flowers(o).map((f) => ({ ...f, children: f.children?.slice(0, 5) })));
	if (lvl >= 3) {
		near.push(tank(o, 128, NEAR_Y + 4, 1.05, 1, true, -0.6));
		near.push(tank(o, 226, NEAR_Y + 8, 0.9, -1, lvl === 4, -2.2));
	}
	if (lvl === 4) near.push(crater(70, NEAR_Y + 14, 1), crater(300, NEAR_Y + 18, 1.2), blast(o, 186, NEAR_Y - 2, 1.1, -2.8), flame(o, 300, NEAR_Y + 16, 1, -0.5));
	if (lvl >= 3) near.push(sandbags(o, 150, NEAR_Y + 24), sandbags(o, 300, NEAR_Y + 26));
	if (lvl >= 2) near.push(wire(o, SCENE_H - 4));
	layers.push(g("ts-near", near));

	// Night's red flash: the whole sky blinks when a bomb lands.
	if (lvl === 4) layers.push(timed(rect("ts-sky-flash", 0, 0, SCENE_W, SCENE_H), -1.4));

	return el(
		"svg",
		["hearth-tension-art"],
		{
			viewBox: `0 0 ${SCENE_W} ${SCENE_H}`,
			// Keep the ground on the card's bottom edge and crop the sky or the
			// sides, never letterbox.
			preserveAspectRatio: "xMidYMax slice",
			"aria-hidden": "true",
		},
		[...(defs.length ? [el("defs", undefined, {}, defs)] : []), ...layers],
	);
}

/** Every class the scene uses, for the stylesheet test. */
export function sceneClasses(node: SceneNode, into = new Set<string>()): Set<string> {
	for (const c of node.cls ?? []) if (c) into.add(c);
	for (const child of node.children ?? []) sceneClasses(child, into);
	return into;
}

/** The scene as SVG markup — for tests and mockups, never for the card (the
 * card builds DOM nodes through {@link mountScene}). */
export function sceneMarkup(node: SceneNode): string {
	const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
	const attrs: string[] = [];
	if (node.cls?.length) attrs.push(`class="${esc(node.cls.filter(Boolean).join(" "))}"`);
	for (const [k, v] of Object.entries(node.attr ?? {})) attrs.push(`${k}="${esc(v)}"`);
	if (node.style) {
		const css = Object.entries(node.style)
			.map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
			.join(";");
		attrs.push(`style="${esc(css)}"`);
	}
	const open = `<${node.tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
	if (!node.children?.length) return `${open}/>`;
	return `${open}>${node.children.map(sceneMarkup).join("")}</${node.tag}>`;
}

/** Build the scene's SVG into `parent` with Obsidian's `createSvg`. */
export function mountScene(parent: HTMLElement | SVGElement, node: SceneNode): SVGElement {
	const svgEl = parent.createSvg(node.tag as keyof SVGElementTagNameMap, {
		cls: node.cls?.filter(Boolean),
		attr: node.attr,
	});
	if (node.style) for (const [k, v] of Object.entries(node.style)) svgEl.style.setProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v);
	for (const child of node.children ?? []) mountScene(svgEl, child);
	return svgEl;
}
