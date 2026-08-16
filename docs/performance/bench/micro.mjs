/* Prices each animation shape Hearth's sky uses, against the equivalent
 * plain-HTML animation. A compositor-driven animation costs the main thread
 * nothing: zero style recalcs, zero layouts, zero paints. Anything above zero
 * means Chromium is re-running style/paint on the main thread every frame. */
import { HERE, launch, loadPlaywright, readMetrics, startTrace, stopTrace } from "./harness.mjs";

const WINDOW_MS = Number(process.env.WINDOW_MS ?? 5000);

const CASES = [
	["none                          (control)", "none"],
	["52 rain drops — SVG <line>    (Hearth)", "svgFall"],
	["52 rain drops — HTML <div>", "htmlFall"],
	["38 stars       — SVG <circle> (Hearth)", "svgTwinkle"],
	["38 stars       — HTML <div>", "htmlTwinkle"],
	["9 clouds       — SVG <g>      (Hearth)", "svgDrift"],
	["3 bolts + drop-shadow filter  (Hearth)", "boltsFiltered"],
	["3 bolts, no filter", "boltsPlain"],
	["4 pet sprites (svg ROOT xform) (Hearth)", "pets"],
	["  pet: svg-root bob only", "petsBobOnly"],
	["  pet: frame cycling only", "petsFramesOnly"],
	["  pet: bob with px instead of %", "petsBobPx"],
	["slideshow Ken Burns            (Hearth)", "kenburns"],
];

const NAMES = {
	paint: ["Paint"],
	style: ["UpdateLayoutTree"],
	layout: ["Layout"],
};


const browser = await launch(loadPlaywright());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${HERE}/micro.html`);
const client = await page.context().newCDPSession(page);
await client.send("Performance.enable");

const fps = await page.evaluate(() => window.microBench.frameRate(2000));
console.log(`\nHarness frame rate: ${fps} fps (DPR 2, 1440x900, ${WINDOW_MS}ms windows)\n`);

const rows = [];
for (const [label, name] of CASES) {
	const anims = await page.evaluate((n) => window.microBench.build(n), name);
	await page.waitForTimeout(800);

	await startTrace(client);
	const b = await readMetrics(client);
	await page.waitForTimeout(WINDOW_MS);
	const a = await readMetrics(client);
	const events = await stopTrace(client);

	const c = {};
	for (const [k, ns] of Object.entries(NAMES)) c[k] = events.filter((e) => ns.includes(e.name)).length;
	rows.push({
		label,
		anims,
		styleMs: ((a.RecalcStyleDuration ?? 0) - (b.RecalcStyleDuration ?? 0)) * 1000,
		layoutMs: ((a.LayoutDuration ?? 0) - (b.LayoutDuration ?? 0)) * 1000,
		taskMs: ((a.TaskDuration ?? 0) - (b.TaskDuration ?? 0)) * 1000,
		...c,
	});
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const r = (v, n) => String(v).padStart(n);
console.log(
	pad("case", 42) + r("anims", 7) + r("mainMs", 9) + r("styleMs", 9) + r("recalcs", 9) + r("layouts", 9) + r("paints", 8),
);
console.log("-".repeat(93));
for (const x of rows) {
	console.log(
		pad(x.label, 42) +
			r(x.anims, 7) +
			r(x.taskMs.toFixed(1), 9) +
			r(x.styleMs.toFixed(1), 9) +
			r(x.style, 9) +
			r(x.layout, 9) +
			r(x.paint, 8),
	);
}
console.log("\nA compositor-driven animation shows 0 recalcs / 0 layouts / 0 paints.");
