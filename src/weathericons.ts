/**
 * The weather card's glyphs in its Expressive design: flat, two- or three-tone
 * drawings built from the same shapes as the expressive sky (src/shapes.ts) —
 * a sunny for the sun, a bubbly cloud of circles on a pill, pill raindrops,
 * flower snowflakes, a solid bolt. They stand in for the Lucide line icons the
 * Classic design uses, one per condition group and half of the day.
 *
 * Colours are classes the stylesheet fills from the weather palette (see the
 * `.hearth-wx-icon` tokens in styles.css), so the same drawing works in a light
 * and a dark theme.
 */
import { shapePath, boltShape, sparklePath } from "./shapes";
import { weatherGroup } from "./weather";

const SVG_NS = { xmlns: "http://www.w3.org/2000/svg" };

/** The crescent moon, centred on (24,24): a disc's major arc round the lit
 * side, closed by a larger shadow circle's minor arc along the terminator. */
const CRESCENT = "M31.53 11.03 A15 15 0 1 1 11.03 31.53 A17 17 0 0 0 31.53 11.03 Z";

/** A cloud: three circles on a pill, drawn in one colour so they read as one
 * body. `transform` places and sizes it in the 48-unit box. */
function cloud(svg: SVGElement, transform: string, cls = "hearth-wx-cloud"): void {
	const g = svg.createSvg("g", { cls, attr: { transform } });
	g.createSvg("rect", { attr: { x: "7", y: "25", width: "34", height: "14", rx: "7" } });
	g.createSvg("circle", { attr: { cx: "17", cy: "26", r: "9" } });
	g.createSvg("circle", { attr: { cx: "27", cy: "20", r: "11" } });
	g.createSvg("circle", { attr: { cx: "35", cy: "27", r: "7" } });
}

/** The sun, in a group of its own so it can turn about its centre. */
function sun(svg: SVGElement, cx: number, cy: number, r: number): void {
	svg.createSvg("g", { cls: "hearth-wx-spin" }).createSvg("path", {
		cls: "hearth-wx-sun",
		attr: { d: shapePath(cx, cy, r, 8, 0.12) },
	});
}

function moon(svg: SVGElement, transform = ""): void {
	const g = svg.createSvg("g", transform ? { attr: { transform } } : {});
	g.createSvg("path", { cls: "hearth-wx-moon", attr: { d: CRESCENT } });
}

/** Short pills under a cloud: rain, or the lighter drizzle. */
function drops(svg: SVGElement, long: boolean): void {
	const layer = svg.createSvg("g", { cls: "hearth-wx-drops" });
	const len = long ? 8 : 4;
	for (const [x, y] of [
		[16, 35],
		[25, 37],
		[34, 35],
	]) {
		layer.createSvg("line", {
			attr: { x1: String(x), y1: String(y), x2: String(x - len * 0.35), y2: String(y + len) },
		});
	}
}

/**
 * Draw the Expressive glyph for a WMO code into a new element of class `cls`.
 * With `backdrop`, the glyph sits on a nine-lobed cookie in the accent's
 * container tone — how Material sets a hero icon off from its surface.
 */
export function drawWeatherIcon(
	parent: HTMLElement,
	code: number,
	isDay: boolean,
	cls: string,
	backdrop = false,
): HTMLElement {
	const host = parent.createDiv(`${cls} hearth-wx-icon`);
	const svg = host.createSvg("svg", {
		attr: {
			...SVG_NS,
			viewBox: backdrop ? "-9 -9 66 66" : "0 0 48 48",
			"aria-hidden": "true",
		},
	});
	if (backdrop) {
		svg.createSvg("g", { cls: "hearth-wx-backdrop-wrap" }).createSvg("path", {
			cls: "hearth-wx-backdrop",
			attr: { d: shapePath(24, 24, 31, 9, 0.05) },
		});
	}

	const rainy = "translate(1.5 -7) scale(0.94)";
	switch (weatherGroup(code)) {
		case "clear":
			if (isDay) sun(svg, 24, 24, 15);
			else {
				moon(svg);
				svg.createSvg("path", { cls: "hearth-wx-star", attr: { d: sparklePath(37, 11, 4.5) } });
			}
			break;
		case "partly":
			if (isDay) sun(svg, 17, 16, 10.5);
			else moon(svg, "translate(1 0) scale(0.66)");
			cloud(svg, "translate(7 8) scale(0.8)");
			break;
		case "cloudy":
			cloud(svg, "translate(15 -3) scale(0.62)", "hearth-wx-cloud-back");
			cloud(svg, "translate(-1 3)");
			break;
		case "fog": {
			cloud(svg, "translate(3 -7) scale(0.88)");
			const fog = svg.createSvg("g", { cls: "hearth-wx-fog" });
			fog.createSvg("line", { attr: { x1: "9", y1: "34", x2: "39", y2: "34" } });
			fog.createSvg("line", { attr: { x1: "15", y1: "42", x2: "35", y2: "42" } });
			break;
		}
		case "drizzle":
			cloud(svg, rainy);
			drops(svg, false);
			break;
		case "rain":
			cloud(svg, rainy);
			drops(svg, true);
			break;
		case "snow": {
			cloud(svg, rainy);
			const flakes = svg.createSvg("g", { cls: "hearth-wx-flakes" });
			for (const [x, y] of [
				[15, 38],
				[24, 42],
				[33, 38],
			]) {
				flakes.createSvg("path", { attr: { d: shapePath(x, y, 3.4, 6, 0.28) } });
			}
			break;
		}
		case "thunder":
			cloud(svg, rainy);
			svg.createSvg("path", { cls: "hearth-wx-bolt", attr: { d: boltShape(24, 27, 19) } });
			break;
	}
	return host;
}
