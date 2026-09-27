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

// ---- The harbour town -------------------------------------------------

/**
 * A harbour town in the Expressive manner: a real place — houses stepping down
 * a hill to the quay, a lighthouse at the end of the pier, sailing boats on the
 * water — built only from Material's soft shapes. Roofs are rounded triangles
 * and arches, the sun is the eight-lobed "sunny", clouds are stacked pills,
 * the sea is wavy tracks, and every colour is a tonal step of the accent.
 *
 * One sliced drawing like the classic landscape, and for the same reason: a
 * scene only reads whole. The lighthouse, the nearest boat and the sun sit in
 * the central third, which is all a phone in portrait sees; the town runs off
 * to the left and the far hills to the right. Day in a light theme, a lit town
 * under the moon in a dark one — decided in styles.css, so a theme switch is
 * no redraw.
 */
export function drawHarbour(parent: HTMLElement): HTMLElement {
	const host = parent.createDiv({ cls: ["hearth-wallpaper", "is-harbour"] });
	const svg = host.createSvg("svg", {
		cls: "hearth-wallpaper-art",
		attr: {
			viewBox: `0 0 ${W} ${H}`,
			preserveAspectRatio: "xMidYMid slice",
			"aria-hidden": "true",
		},
	});

	drawHarbourSky(svg);

	// The far shore, behind the town and across the bay.
	svg.createSvg("path", { cls: ["hearth-harbour-hill", "is-far"], attr: { d: ridge(540, 34, 29).d } });

	// The hill the town is built on, falling to the quay.
	svg.createSvg("path", {
		cls: "hearth-harbour-hill",
		attr: { d: `${smoothPath(TOWN_HILL)} L ${TOWN_HILL[TOWN_HILL.length - 1][0]} ${SHORE + 30} L -40 ${SHORE + 30} Z` },
	});

	const town = svg.createSvg("g", { cls: "hearth-harbour-town" });
	for (const house of HOUSES) drawHouse(town, house);

	svg.createSvg("rect", {
		cls: "hearth-harbour-water",
		attr: { x: "-40", y: String(SHORE), width: String(W + 80), height: String(H - SHORE + 40) },
	});

	// The quay along the town's foot, and the pier running out to the light.
	svg.createSvg("rect", {
		cls: "hearth-harbour-quay",
		attr: { x: "-60", y: String(SHORE - 12), width: "1020", height: "34", rx: "17" },
	});
	svg.createSvg("rect", {
		cls: "hearth-harbour-quay",
		attr: { x: "850", y: String(SHORE + 4), width: "170", height: "26", rx: "13" },
	});

	drawLighthouse(svg, 935, SHORE + 8);

	const sea = svg.createSvg("g", { cls: "hearth-harbour-sea" });
	for (const [x, y, length, alt] of WAVES) {
		const points: { x: number; y: number }[] = [];
		for (let dx = 0; dx <= length; dx += 4) points.push({ x: x + dx, y });
		sea.createSvg("path", {
			cls: alt ? ["hearth-harbour-wave", "is-alt"] : "hearth-harbour-wave",
			attr: { d: wavePath(points, 7, 46) },
		});
	}

	drawSailboat(svg, 760, 770, 1, false);
	drawSailboat(svg, 1360, 720, 0.7, true);
	drawSailboat(svg, 470, 880, 1.25, true);
	drawTug(svg, 1190, 870, 1);

	return host;
}

/** Where the water starts: the quay's line. */
const SHORE = 650;

/** The town hill's crest, left to right, down to the pier's root. */
const TOWN_HILL: [number, number][] = [
	[-40, 430],
	[160, 420],
	[360, 450],
	[560, 500],
	[740, 560],
	[880, 622],
	[960, SHORE],
];

/** The town hill's height at `x`, straight between its crest points — close
 * enough to stand a house on, since every house is sunk a little into it. */
function townHillY(x: number): number {
	for (let i = 1; i < TOWN_HILL.length; i++) {
		const [x0, y0] = TOWN_HILL[i - 1];
		const [x1, y1] = TOWN_HILL[i];
		if (x <= x1) return y0 + ((y1 - y0) * (Math.max(x, x0) - x0)) / (x1 - x0);
	}
	return SHORE;
}

type Roof = "gable" | "arch" | "flat" | "tower";
type Tone = "a" | "b" | "c";

/** One house: left edge, width, wall height, roof, tone, and how far below
 * the crest it stands — a back row high on the hill, a front row lower down. */
type House = [x: number, w: number, h: number, roof: Roof, tone: Tone, drop: number];

const HOUSES: House[] = [
	// The upper row, along the crest.
	[20, 70, 70, "gable", "a", 6],
	[100, 56, 90, "arch", "b", 6],
	[170, 74, 64, "gable", "c", 6],
	[262, 60, 84, "flat", "a", 6],
	[336, 42, 150, "tower", "b", 6],
	[392, 78, 70, "gable", "c", 6],
	[484, 62, 80, "arch", "a", 6],
	[560, 70, 60, "gable", "b", 6],
	[646, 58, 70, "flat", "c", 6],
	[716, 64, 58, "gable", "a", 6],
	[796, 56, 50, "arch", "b", 6],
	// The lower row, nearer the quay and drawn over the first.
	[-10, 80, 74, "flat", "b", 92],
	[64, 76, 70, "gable", "c", 88],
	[152, 64, 86, "arch", "a", 84],
	[228, 80, 64, "gable", "b", 80],
	[322, 70, 76, "gable", "a", 72],
	[404, 70, 72, "flat", "c", 66],
	[486, 80, 64, "gable", "b", 58],
	[578, 66, 70, "arch", "c", 48],
	[656, 72, 56, "gable", "a", 36],
];

function drawHouse(parent: SVGElement, [x, w, h, roof, tone, drop]: House): void {
	const f = (n: number): string => n.toFixed(1);
	const base = Math.min(townHillY(x + w / 2) + drop, SHORE - 8);
	const top = base - h;
	// Walls run on below the ground line; the quay and the row in front hide
	// the rest, so no house ever floats on a slope.
	const bottom = SHORE + 10;
	const house = parent.createSvg("g", { cls: ["hearth-harbour-house", `is-${tone}`] });

	if (roof === "arch" || roof === "tower") {
		house.createSvg("path", {
			cls: "hearth-harbour-wall",
			attr: { d: `M ${f(x)} ${bottom} L ${f(x)} ${f(top)} A ${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(top)} L ${f(x + w)} ${bottom} Z` },
		});
	} else {
		house.createSvg("rect", {
			cls: "hearth-harbour-wall",
			attr: { x: f(x), y: f(top), width: f(w), height: f(bottom - top), rx: roof === "flat" ? "10" : "4" },
		});
	}
	if (roof === "gable") {
		const peak = top - w * 0.42;
		house.createSvg("path", {
			cls: "hearth-harbour-roof",
			attr: { d: `M ${f(x - 6)} ${f(top + 4)} L ${f(x + w / 2)} ${f(peak)} L ${f(x + w + 6)} ${f(top + 4)} Z` },
		});
	}
	if (roof === "tower") {
		// The church: a round window high up and a sparkle for a weathervane.
		house.createSvg("circle", {
			cls: "hearth-harbour-window",
			attr: { cx: f(x + w / 2), cy: f(top + 8), r: "9" },
		});
		house.createSvg("path", { cls: "hearth-harbour-roof", attr: { d: sparklePath(x + w / 2, top - w / 2 - 22, 12) } });
		return;
	}

	// One window on a narrow house, two on a wide one, a third of the way down.
	const count = w >= 62 ? 2 : 1;
	const winW = 12;
	const winH = 16;
	for (let i = 0; i < count; i++) {
		const cx = x + (w * (i + 1)) / (count + 1);
		house.createSvg("rect", {
			cls: "hearth-harbour-window",
			attr: { x: f(cx - winW / 2), y: f(top + h * 0.3), width: String(winW), height: String(winH), rx: "6" },
		});
	}
}

/** The lighthouse, its foot at (x, y): a tapering tower in two bands, a
 * gallery, and a lamp with its halo. */
function drawLighthouse(parent: SVGElement, x: number, y: number): void {
	const f = (n: number): string => n.toFixed(1);
	const height = 230;
	const half = (at: number): number => 32 - ((y - at) / height) * 12;
	const top = y - height;
	const light = parent.createSvg("g", { cls: "hearth-harbour-lighthouse" });
	// The halo first, so the lantern and its cap sit on it rather than under.
	light.createSvg("circle", { cls: "hearth-harbour-halo", attr: { cx: f(x), cy: f(top - 34), r: "50" } });

	light.createSvg("path", {
		cls: "hearth-harbour-tower",
		attr: { d: `M ${f(x - half(y))} ${f(y)} L ${f(x - half(top))} ${f(top)} L ${f(x + half(top))} ${f(top)} L ${f(x + half(y))} ${f(y)} Z` },
	});
	for (const [from, to] of [
		[y - 60, y - 100],
		[y - 150, y - 190],
	]) {
		light.createSvg("path", {
			cls: "hearth-harbour-band",
			attr: { d: `M ${f(x - half(from))} ${f(from)} L ${f(x - half(to))} ${f(to)} L ${f(x + half(to))} ${f(to)} L ${f(x + half(from))} ${f(from)} Z` },
		});
	}
	light.createSvg("circle", { cls: "hearth-harbour-lamp", attr: { cx: f(x), cy: f(top - 30), r: "17" } });
	light.createSvg("rect", {
		cls: "hearth-harbour-band",
		attr: { x: f(x - 30), y: f(top - 12), width: "60", height: "14", rx: "7" },
	});
	light.createSvg("path", {
		cls: "hearth-harbour-band",
		attr: { d: `M ${f(x - 22)} ${f(top - 44)} A 22 22 0 0 1 ${f(x + 22)} ${f(top - 44)} Z` },
	});
	light.createSvg("path", { cls: "hearth-harbour-band", attr: { d: sparklePath(x, top - 78, 9) } });
}

/** A sailing boat on the waterline at (x, y), `s` times its natural size: a
 * rounded hull, a mast, a mainsail and a jib, and its shine on the water. */
function drawSailboat(parent: SVGElement, x: number, y: number, s: number, alt: boolean): void {
	const f = (n: number): string => n.toFixed(1);
	const p = (dx: number, dy: number): string => `${f(x + dx * s)} ${f(y + dy * s)}`;
	const boat = parent.createSvg("g", { cls: "hearth-harbour-boat" });
	boat.createSvg("rect", {
		cls: "hearth-harbour-shine",
		attr: { x: f(x - 44 * s), y: f(y + 18 * s), width: f(88 * s), height: f(7 * s), rx: f(3.5 * s) },
	});
	boat.createSvg("path", {
		cls: "hearth-harbour-mast",
		attr: { d: `M ${p(0, -14)} L ${p(0, -124)}` },
	});
	boat.createSvg("path", {
		cls: alt ? ["hearth-harbour-sail", "is-alt"] : "hearth-harbour-sail",
		attr: { d: `M ${p(6, -120)} L ${p(6, -24)} L ${p(54, -24)} Z` },
	});
	boat.createSvg("path", {
		cls: alt ? "hearth-harbour-sail" : ["hearth-harbour-sail", "is-alt"],
		attr: { d: `M ${p(-6, -104)} L ${p(-6, -24)} L ${p(-42, -24)} Z` },
	});
	boat.createSvg("path", {
		cls: "hearth-harbour-hull",
		attr: { d: `M ${p(-60, -14)} L ${p(60, -14)} Q ${p(50, 12)} ${p(26, 12)} L ${p(-26, 12)} Q ${p(-50, 12)} ${p(-60, -14)} Z` },
	});
}

/** A small harbour tug: a hull, a pill of a cabin and a funnel. */
function drawTug(parent: SVGElement, x: number, y: number, s: number): void {
	const f = (n: number): string => n.toFixed(1);
	const p = (dx: number, dy: number): string => `${f(x + dx * s)} ${f(y + dy * s)}`;
	const tug = parent.createSvg("g", { cls: "hearth-harbour-boat" });
	tug.createSvg("rect", {
		cls: "hearth-harbour-shine",
		attr: { x: f(x - 40 * s), y: f(y + 16 * s), width: f(80 * s), height: f(7 * s), rx: f(3.5 * s) },
	});
	tug.createSvg("rect", {
		cls: ["hearth-harbour-sail", "is-alt"],
		attr: { x: f(x + 2 * s), y: f(y - 62 * s), width: f(14 * s), height: f(34 * s), rx: f(7 * s) },
	});
	tug.createSvg("rect", {
		cls: "hearth-harbour-sail",
		attr: { x: f(x - 30 * s), y: f(y - 42 * s), width: f(52 * s), height: f(32 * s), rx: f(12 * s) },
	});
	tug.createSvg("circle", { cls: "hearth-harbour-window", attr: { cx: f(x - 14 * s), cy: f(y - 26 * s), r: f(5 * s) } });
	tug.createSvg("circle", { cls: "hearth-harbour-window", attr: { cx: f(x + 4 * s), cy: f(y - 26 * s), r: f(5 * s) } });
	tug.createSvg("path", {
		cls: "hearth-harbour-hull",
		attr: { d: `M ${p(-54, -12)} L ${p(54, -12)} Q ${p(46, 12)} ${p(24, 12)} L ${p(-24, 12)} Q ${p(-46, 12)} ${p(-54, -12)} Z` },
	});
}

/** The swells on the bay: start x, y, length, and whether in the second tone. */
const WAVES: [number, number, number, boolean][] = [
	[40, 700, 240, false],
	[1090, 700, 180, true],
	[1230, 780, 300, false],
	[560, 830, 220, true],
	[120, 800, 200, true],
	[860, 930, 340, false],
	[1300, 900, 240, true],
	[180, 960, 260, false],
];

/** Sky: the sun (a moon, in a dark theme), clouds, gulls, and stars that only
 * the dark theme shows. */
function drawHarbourSky(svg: SVGElement): void {
	const stars = svg.createSvg("g", { cls: "hearth-harbour-stars" });
	const rand = seeded(19);
	for (let i = 0; i < 40; i++) {
		const x = rand() * W;
		const y = rand() * 420;
		if (i % 5 === 0) stars.createSvg("path", { attr: { d: sparklePath(x, y, 6 + rand() * 6) } });
		else stars.createSvg("circle", { attr: { cx: x.toFixed(0), cy: y.toFixed(0), r: (1.4 + rand() * 1.8).toFixed(1) } });
	}

	svg.createSvg("path", { cls: "hearth-harbour-sun", attr: { d: shapePath(700, 240, 74, 8, 0.07, 24) } });

	const clouds = svg.createSvg("g", { cls: "hearth-harbour-clouds" });
	for (const [x, y, s] of [
		[330, 210, 1.1],
		[1290, 170, 1],
		[640, 120, 0.6],
		[1500, 330, 0.7],
	]) {
		const pill = (dx: number, dy: number, w: number): void => {
			clouds.createSvg("rect", {
				attr: {
					x: (x + dx * s).toFixed(1),
					y: (y + dy * s).toFixed(1),
					width: (w * s).toFixed(1),
					height: (34 * s).toFixed(1),
					rx: (17 * s).toFixed(1),
				},
			});
		};
		pill(-90, 0, 180);
		pill(-40, -24, 110);
	}

	const gulls = svg.createSvg("g", { cls: "hearth-harbour-gulls" });
	for (const [x, y, s] of [
		[820, 300, 1],
		[870, 272, 0.8],
		[560, 360, 0.9],
	]) {
		const p = (dx: number, dy: number): string => `${(x + dx * s).toFixed(1)} ${(y + dy * s).toFixed(1)}`;
		gulls.createSvg("path", {
			attr: { d: `M ${p(-18, 0)} Q ${p(-9, -12)} ${p(0, 0)} Q ${p(9, -12)} ${p(18, 0)}` },
		});
	}
}
