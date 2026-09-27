/**
 * Hearth's own wallpaper: the "default" background, drawn rather than fetched.
 *
 * It used to be a picture served from GitHub, which meant a request on every
 * first paint and nothing at all once "Disable external calls" was on. Drawn
 * here as inline SVG it costs no request, works offline, and can take its
 * colours from the theme — which a picture never could.
 *
 * Two designs, the same pair the weather sky offers (see sky.ts):
 *
 *  - **classic** — a landscape of layered hills with a cabin and a few pines.
 *    One drawing, two palettes: a soft morning under a low sun in a light
 *    theme, a moonlit night with stars in a dark one. Which is which is left
 *    to styles.css (`.theme-dark`), so switching themes needs no redraw.
 *  - **expressive** — Material 3 Expressive shapes (cookie, clover, sunny, a
 *    pill, a ring, sparkles, wavy lines) gathered in the four corners, every
 *    colour a tonal step of the reader's accent. The centre stays calm because
 *    that is where the cards sit.
 *
 * Colours live entirely in CSS; this file only draws geometry and names parts.
 */
import { shapePath, sparklePath, wavePath } from "./shapes";

export type WallpaperDesign = "classic" | "expressive";

/** The classic landscape's drawing space. Painted with `slice`, so it fills
 * the box at any aspect ratio and crops the edges rather than letterboxing. */
const W = 1600;
const H = 1000;

/** Where the sun (or, at night, the moon) sits. Near the middle on purpose: a
 * phone in portrait sees only the central third of the drawing, and a banner
 * only its middle band, and both should still get the sun. */
const SUN = { x: 960, y: 500, r: 74 };

/**
 * Paint the wallpaper into `parent` and return the element it created.
 */
export function drawWallpaper(parent: HTMLElement, design: WallpaperDesign): HTMLElement {
	const host = parent.createDiv({ cls: ["hearth-wallpaper", `is-${design}`] });
	if (design === "expressive") drawExpressive(host);
	else drawClassic(host);
	return host;
}

// ---- Classic ----------------------------------------------------------

/** A small deterministic generator, so the stars and hills come out the same
 * on every paint — a wallpaper that rearranges itself on each rebuild would
 * look like a glitch. */
function seeded(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/** A smooth curve through `points` (Catmull-Rom, written out as cubics). */
function smoothPath(points: [number, number][]): string {
	const f = (n: number): string => n.toFixed(1);
	let d = `M ${f(points[0][0])} ${f(points[0][1])}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
	}
	return d;
}

interface Ridge {
	/** The filled hill, closed along the bottom of the drawing. */
	d: string;
	/** The ridge line's height at `x`, for standing things on it. */
	y: (x: number) => number;
}

/** One hill line: three sine waves of falling size over a base height. */
function ridge(base: number, amp: number, seed: number): Ridge {
	const rand = seeded(seed);
	const waves = [0, 1, 2].map((i) => ({
		f: (0.6 + rand() * 1.6) * (i + 1),
		p: rand() * Math.PI * 2,
		a: amp / (i + 1.3),
	}));
	const y = (x: number): number =>
		waves.reduce((acc, w) => acc - w.a * Math.sin((x / W) * Math.PI * w.f + w.p), base);
	const steps = 28;
	const points: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const x = -40 + ((W + 80) * i) / steps;
		points.push([x, y(x)]);
	}
	return { d: `${smoothPath(points)} L ${W + 40} ${H + 10} L -40 ${H + 10} Z`, y };
}

/** A pine: two tiers and a trunkless base, standing on (x, y), `h` tall. */
function pinePath(x: number, y: number, h: number): string {
	const w = h * 0.42;
	const f = (n: number): string => n.toFixed(1);
	return (
		`M ${f(x)} ${f(y - h)} L ${f(x + w / 2)} ${f(y - h * 0.35)} L ${f(x + w * 0.3)} ${f(y - h * 0.35)} ` +
		`L ${f(x + w * 0.55)} ${f(y + 2)} L ${f(x - w * 0.55)} ${f(y + 2)} L ${f(x - w * 0.3)} ${f(y - h * 0.35)} ` +
		`L ${f(x - w / 2)} ${f(y - h * 0.35)} Z`
	);
}

/** The five hills, back to front: base height, how much they roll, and a seed. */
const RIDGES: [number, number, number][] = [
	[600, 70, 11],
	[675, 80, 23],
	[745, 70, 5],
	[815, 60, 41],
	[900, 45, 17],
];

/** Every glow needs its own gradient id: the document may hold several Hearth
 * views at once, and an id that two of them share resolves to whichever came
 * first — including one that has since been emptied. */
let glowSeq = 0;

function drawClassic(host: HTMLElement): void {
	const svg = host.createSvg("svg", {
		cls: "hearth-wallpaper-art",
		attr: {
			viewBox: `0 0 ${W} ${H}`,
			preserveAspectRatio: "xMidYMid slice",
			"aria-hidden": "true",
		},
	});

	// The halo round the sun. A gradient rather than rings of low-opacity
	// circles: rings band visibly across the whole sky.
	const glowId = `hearth-wallpaper-glow-${++glowSeq}`;
	const gradient = svg.createSvg("defs").createSvg("radialGradient", { attr: { id: glowId } });
	gradient.createSvg("stop", { cls: "hearth-wallpaper-glow-stop", attr: { offset: "0" } });
	gradient.createSvg("stop", { cls: ["hearth-wallpaper-glow-stop", "is-mid"], attr: { offset: "0.35" } });
	gradient.createSvg("stop", { cls: ["hearth-wallpaper-glow-stop", "is-end"], attr: { offset: "1" } });

	// Stars are drawn in both themes and shown only in the dark one, so the
	// theme switch stays a pure CSS change.
	const stars = svg.createSvg("g", { cls: "hearth-wallpaper-stars" });
	const rand = seeded(7);
	for (let i = 0; i < 90; i++) {
		stars.createSvg("circle", {
			attr: {
				cx: (rand() * W).toFixed(0),
				cy: (rand() * 560).toFixed(0),
				r: (0.7 + rand() * 1.5).toFixed(1),
				opacity: (0.3 + rand() * 0.7).toFixed(2),
			},
		});
	}

	svg.createSvg("circle", {
		attr: { cx: String(SUN.x), cy: String(SUN.y), r: "460", fill: `url(#${glowId})` },
	});
	svg.createSvg("circle", {
		cls: "hearth-wallpaper-sun",
		attr: { cx: String(SUN.x), cy: String(SUN.y), r: String(SUN.r) },
	});

	// Long thin streaks of cloud, the way they lie near the horizon.
	const clouds = svg.createSvg("g", { cls: "hearth-wallpaper-clouds" });
	const streaks: [number, number, number, number][] = [
		[360, 260, 340, 18],
		[560, 300, 200, 12],
		[1300, 230, 300, 16],
		[1180, 275, 170, 10],
		[760, 160, 160, 9],
	];
	for (const [x, y, w, h] of streaks) {
		clouds.createSvg("rect", {
			attr: { x: String(x - w / 2), y: String(y - h / 2), width: String(w), height: String(h), rx: String(h / 2) },
		});
	}

	RIDGES.forEach(([base, amp, seed], i) => {
		const hill = ridge(base, amp, seed);
		svg.createSvg("path", {
			cls: ["hearth-wallpaper-ridge", `is-${i + 1}`],
			attr: { d: hill.d },
		});
		// The cabin stands on the third hill, so the two in front of it tuck
		// its foot away and it sits *in* the landscape rather than on top.
		if (i === 2) {
			drawCabin(svg, 640, hill.y(640) + 4);
			const pines = svg.createSvg("g", { cls: "hearth-wallpaper-pines" });
			for (const [x, h] of [[585, 40], [603, 30], [700, 34], [716, 46], [736, 28]]) {
				pines.createSvg("path", { attr: { d: pinePath(x, hill.y(x) + 6, h) } });
			}
		}
		if (i === 3) {
			const pines = svg.createSvg("g", { cls: ["hearth-wallpaper-pines", "is-near"] });
			for (const [x, h] of [[1060, 56], [1082, 40], [1100, 64], [1230, 44], [1250, 58], [260, 50], [282, 66]]) {
				pines.createSvg("path", { attr: { d: pinePath(x, hill.y(x) + 8, h) } });
			}
		}
	});
}

/** The hearth in Hearth: a small house with lit windows and a curl of smoke. */
function drawCabin(svg: SVGElement, x: number, y: number): void {
	const cabin = svg.createSvg("g", {
		cls: "hearth-wallpaper-cabin",
		attr: { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` },
	});
	cabin.createSvg("path", {
		cls: "hearth-wallpaper-smoke",
		attr: { d: "M 21 -40 c -8 -12 8 -20 0 -34 c -7 -12 9 -20 2 -34" },
	});
	cabin.createSvg("rect", { cls: "hearth-wallpaper-house", attr: { x: "16", y: "-38", width: "9", height: "18" } });
	cabin.createSvg("path", { cls: "hearth-wallpaper-house", attr: { d: "M -16 6 L -16 -20 L 0 -34 L 16 -20 L 16 6 Z" } });
	cabin.createSvg("path", { cls: "hearth-wallpaper-house", attr: { d: "M 0 6 L 0 -22 L 26 -22 L 34 -12 L 34 6 Z" } });
	cabin.createSvg("rect", { cls: "hearth-wallpaper-window", attr: { x: "-5", y: "-14", width: "9", height: "9", rx: "1.5" } });
	cabin.createSvg("rect", { cls: "hearth-wallpaper-window", attr: { x: "14", y: "-12", width: "8", height: "8", rx: "1.5" } });
}

// ---- Expressive -------------------------------------------------------

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * One corner's box. Each corner is its own square pinned to that corner of the
 * view, sized in CSS against the view's shorter side — so the four clusters
 * keep their places on a wide monitor, a phone in portrait and a banner strip
 * alike, where one sliced drawing would crop most of them away.
 */
function corner(host: HTMLElement, at: Corner): SVGSVGElement {
	return host.createSvg("svg", {
		cls: ["hearth-wallpaper-corner", `is-${at}`],
		attr: { viewBox: "0 0 600 600", "aria-hidden": "true" },
	});
}

/** A horizontal wavy line from (x, y), `length` long. */
function wavyLine(x: number, y: number, length: number): string {
	const points: { x: number; y: number }[] = [];
	for (let dx = 0; dx <= length; dx += 4) points.push({ x: x + dx, y });
	return wavePath(points, 12, 52);
}

function drawExpressive(host: HTMLElement): void {
	const tl = corner(host, "tl");
	tl.createSvg("path", { cls: "hearth-wallpaper-primary", attr: { d: shapePath(90, 80, 300, 12, 0.06, 24) } });
	tl.createSvg("circle", { cls: "hearth-wallpaper-strong", attr: { cx: "450", cy: "90", r: "34" } });
	tl.createSvg("path", { cls: "hearth-wallpaper-strong", attr: { d: sparklePath(380, 300, 26) } });
	tl.createSvg("circle", { cls: "hearth-wallpaper-strong-alt", attr: { cx: "150", cy: "470", r: "18" } });

	const tr = corner(host, "tr");
	tr.createSvg("path", { cls: "hearth-wallpaper-secondary", attr: { d: shapePath(420, 170, 130, 4, 0.2, 48) } });
	tr.createSvg("path", { cls: ["hearth-wallpaper-wave", "is-alt"], attr: { d: wavyLine(60, 70, 260) } });
	tr.createSvg("path", { cls: "hearth-wallpaper-strong", attr: { d: sparklePath(230, 250, 18) } });

	const bl = corner(host, "bl");
	bl.createSvg("rect", {
		cls: "hearth-wallpaper-secondary",
		attr: { x: "-160", y: "330", width: "560", height: "220", rx: "110", transform: "rotate(-28 120 440)" },
	});
	bl.createSvg("path", { cls: "hearth-wallpaper-strong", attr: { d: sparklePath(380, 210, 22) } });
	bl.createSvg("circle", { cls: "hearth-wallpaper-strong", attr: { cx: "470", cy: "520", r: "14" } });

	const br = corner(host, "br");
	br.createSvg("path", { cls: "hearth-wallpaper-tertiary", attr: { d: shapePath(520, 520, 270, 8, 0.14, 32) } });
	br.createSvg("circle", { cls: "hearth-wallpaper-ring", attr: { cx: "220", cy: "470", r: "100" } });
	br.createSvg("path", { cls: "hearth-wallpaper-wave", attr: { d: wavyLine(10, 250, 230) } });
	br.createSvg("path", { cls: "hearth-wallpaper-strong", attr: { d: sparklePath(430, 120, 28) } });
}
