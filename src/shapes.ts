/**
 * Material 3 Expressive's shapes, as SVG path data.
 *
 * The expressive design (the moon and daylight weather styles, the weather card
 * and painted sky in their "Expressive" design) draws with a handful of soft
 * polygons from Material's shape library and a wavy track. They live here,
 * pure and DOM-free, so every drawing uses the same ones and test/shapes.test.ts
 * can pin them.
 */

/**
 * A soft polygon: a circle whose radius swells and dips `lobes` times round, by
 * `depth` of the radius. Nine shallow lobes is the "cookie", eight deeper ones
 * the "sunny", six the snowflake's "flower". The first lobe points straight up.
 */
export function shapePath(cx: number, cy: number, r: number, lobes: number, depth: number): string {
	const steps = Math.max(lobes, 3) * 12;
	const points: string[] = [];
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		const radius = r * (1 + depth * Math.cos(lobes * a));
		const x = cx + radius * Math.sin(a);
		const y = cy - radius * Math.cos(a);
		points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
	}
	return `M ${points.join(" L ")} Z`;
}

/**
 * The four-pointed sparkle: its points up, right, down and left, joined by
 * sides that curve in towards the centre. `pinch` (0–1) is how far in — 0 is a
 * diamond, 1 meets at the centre.
 */
export function sparklePath(cx: number, cy: number, r: number, pinch = 0.8): string {
	const k = r * (1 - pinch) * 0.5;
	const p = (x: number, y: number): string => `${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`;
	return (
		`M ${p(0, -r)} Q ${p(k, -k)} ${p(r, 0)} Q ${p(k, k)} ${p(0, r)} ` +
		`Q ${p(-k, k)} ${p(-r, 0)} Q ${p(-k, -k)} ${p(0, -r)} Z`
	);
}

/**
 * A lightning bolt as one flat shape, `h` tall with its tip at the bottom and
 * its top centred on `x`. Drawn with a round-joined stroke of its own colour,
 * which is what softens its corners.
 */
export function boltShape(x: number, y: number, h: number): string {
	const u = h / 10;
	const p = (dx: number, dy: number): string => `${(x + dx * u).toFixed(2)} ${(y + dy * u).toFixed(2)}`;
	return `M ${p(0.6, 0)} L ${p(-2.4, 5.4)} L ${p(0, 5.4)} L ${p(-1.2, 10)} L ${p(2.6, 3.8)} L ${p(0.2, 3.8)} L ${p(1.8, 0)} Z`;
}

/**
 * A polyline as a wave that runs along it: every point pushed off the line
 * along its normal by a sine of the distance travelled. Material's wavy
 * progress track, bent to follow whatever it is laid on.
 */
export function wavePath(
	points: { x: number; y: number }[],
	amplitude: number,
	wavelength: number,
): string {
	if (points.length < 2) return "";
	let travelled = 0;
	const out: string[] = [];
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (i > 0) travelled += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
		// The normal from the neighbours on either side, so a bend doesn't kink.
		const a = points[Math.max(i - 1, 0)];
		const b = points[Math.min(i + 1, points.length - 1)];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const offset = amplitude * Math.sin((travelled / wavelength) * Math.PI * 2);
		const x = p.x + (-dy / len) * offset;
		const y = p.y + (dx / len) * offset;
		out.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	return `M ${out.join(" L ")}`;
}
