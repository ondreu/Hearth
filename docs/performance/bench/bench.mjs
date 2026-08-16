/* Measures the cost of each Hearth board configuration in a real Chromium
 * compositor, using the plugin's own drawSky()/updateFrostLayers().
 *
 * Two independent measurements per scenario:
 *  - Performance.getMetrics deltas over a fixed wall-clock window (main-thread
 *    busy time, style recalc, layout, script).
 *  - A devtools timeline trace, counted by event name (paints, raster tasks,
 *    compositor commits, frames).
 */
import { HERE, launch, loadPlaywright, readMetrics, startTrace, stopTrace } from "./harness.mjs";

const WINDOW_MS = Number(process.env.WINDOW_MS ?? 6000);
const REPEATS = Number(process.env.REPEATS ?? 3);

/** Hearth defaults: bgBlur 2, cardBlur 7. */
const SCENARIOS = {
	"1. blank board (no wallpaper, no frost)": { bg: "none", bgBlur: 0, skyAnimate: false, skyCode: 63, cardBlur: 0 },
	"2. image wallpaper, no frost": { bg: "image", bgBlur: 2, skyAnimate: false, skyCode: 63, cardBlur: 0 },
	"3. image wallpaper + frost (SHIPPED DEFAULT)": { bg: "image", bgBlur: 2, skyAnimate: false, skyCode: 63, cardBlur: 7 },
	"4. animated rain sky, no frost": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 0 },
	"5. animated rain sky + frost": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 7 },
	"6. animated thunder sky + frost (worst case)": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 95, cardBlur: 7 },
	"7. still sky + frost (sky animation off)": { bg: "sky", bgBlur: 2, skyAnimate: false, skyCode: 95, cardBlur: 7 },
	"8. low power mode (flat colour, no frost)": { bg: "color", bgBlur: 0, skyAnimate: false, skyCode: 0, cardBlur: 0 },
};

const TRACE_CATEGORIES = [
	"disabled-by-default-devtools.timeline",
	"disabled-by-default-devtools.timeline.frame",
];

/** Trace event names worth counting, grouped into something readable. */
const BUCKETS = {
	paint: ["Paint", "PaintImage"],
	raster: ["RasterTask", "Rasterize"],
	style: ["UpdateLayoutTree", "ScheduleStyleRecalculation"],
	layout: ["Layout"],
	composite: ["Commit", "CompositeLayers"],
	frames: ["DrawFrame", "BeginFrame", "ActivateLayerTree"],
};

async function collect(page, client, scenario) {
	await page.evaluate((s) => window.hearthBench.build(s), scenario);
	// Let layout, first paint and the frost rebuild settle before the window opens.
	await page.waitForTimeout(1200);

	const animations = await page.evaluate(() => window.hearthBench.countAnimated());
	const maskBytes = await page.evaluate(() => window.hearthBench.frostMaskBytes());


	await startTrace(client, TRACE_CATEGORIES);
	const before = await readMetrics(client);
	await page.waitForTimeout(WINDOW_MS);
	const after = await readMetrics(client);

	const events = await stopTrace(client);
	const counts = {};
	const durations = {};
	for (const [bucket, names] of Object.entries(BUCKETS)) {
		const hits = events.filter((e) => names.includes(e.name));
		counts[bucket] = hits.length;
		durations[bucket] = hits.reduce((a, e) => a + (e.dur ?? 0), 0) / 1000;
	}

	const d = (k) => (after[k] ?? 0) - (before[k] ?? 0);
	return {
		animations,
		maskBytes,
		// Seconds of CPU inside the renderer's main thread over the window.
		taskMs: d("TaskDuration") * 1000,
		scriptMs: d("ScriptDuration") * 1000,
		layoutMs: d("LayoutDuration") * 1000,
		styleMs: d("RecalcStyleDuration") * 1000,
		counts,
		durations,
	};
}


const browser = await launch(loadPlaywright());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${HERE}/index.html`);
const client = await page.context().newCDPSession(page);
await client.send("Performance.enable");

const results = {};
for (const [name, scenario] of Object.entries(SCENARIOS)) {
	const runs = [];
	for (let i = 0; i < REPEATS; i++) runs.push(await collect(page, client, scenario));
	// Median run by main-thread busy time, so one noisy pass can't set the number.
	runs.sort((a, b) => a.taskMs - b.taskMs);
	results[name] = runs[Math.floor(runs.length / 2)];
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 1) => v.toFixed(n).padStart(8);

console.log(`\nWindow: ${WINDOW_MS}ms per run, median of ${REPEATS} runs, DPR 2, 1440x900\n`);
console.log(
	pad("scenario", 46) +
		["mainMs", "styleMs", "paintMs", "rasterMs"].map((s) => s.padStart(8)).join("") +
		"  anims  maskKB",
);
console.log("-".repeat(46 + 8 * 4 + 16));
for (const [name, r] of Object.entries(results)) {
	console.log(
		pad(name, 46) +
			num(r.taskMs) +
			num(r.styleMs) +
			num(r.durations.paint) +
			num(r.durations.raster) +
			String(r.animations).padStart(7) +
			(r.maskBytes / 1024).toFixed(1).padStart(8),
	);
}

console.log("\nTrace event counts over the window:");
console.log(pad("scenario", 46) + ["paint", "raster", "style", "layout", "composite", "frames"].map((s) => s.padStart(10)).join(""));
console.log("-".repeat(46 + 60));
for (const [name, r] of Object.entries(results)) {
	console.log(
		pad(name, 46) +
			["paint", "raster", "style", "layout", "composite", "frames"]
				.map((k) => String(r.counts[k]).padStart(10))
				.join(""),
	);
}
