/* Browser-level trace (all processes, GPU included) so the backdrop-filter and
 * raster work that never shows up in a renderer-only trace is counted. */
import { HERE, launch, loadPlaywright, startTrace, stopTrace } from "./harness.mjs";

const WINDOW_MS = Number(process.env.WINDOW_MS ?? 6000);

const SCENARIOS = {
	"still sky, no frost": { bg: "sky", bgBlur: 2, skyAnimate: false, skyCode: 63, cardBlur: 0 },
	"still sky + frost(7px)": { bg: "sky", bgBlur: 2, skyAnimate: false, skyCode: 63, cardBlur: 7 },
	"animated sky, no frost": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 0 },
	"animated sky + frost(7px)": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 7 },
	"animated sky + frost(30px)": { bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 30 },
};

const browser = await launch(loadPlaywright());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${HERE}/index.html`);
const bs = await browser.newBrowserCDPSession();

async function trace(scenario) {
	await page.evaluate((s) => window.hearthBench.build(s), scenario);
	await page.waitForTimeout(1200);

	// Browser-level session, so the GPU and viz processes are in the trace too.
	await startTrace(bs, [
		"disabled-by-default-devtools.timeline",
		"disabled-by-default-devtools.timeline.frame",
		"viz",
		"gpu",
		"cc",
		"benchmark",
	]);
	await page.waitForTimeout(WINDOW_MS);
	return stopTrace(bs);
}

/** Sum of self-time per event name, in ms, for the busiest names. */
function hot(events, n = 14) {
	const by = new Map();
	for (const e of events) {
		if (e.ph !== "X" || !e.dur) continue;
		by.set(e.name, (by.get(e.name) ?? 0) + e.dur / 1000);
	}
	return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

const INTEREST = [
	"Draw", "DrawFrame", "SkCanvas::onDrawPaint", "RasterTask",
	"Display::DrawAndSwap", "SkiaRenderer::DrawRenderPass",
	"GLRenderer::DrawRenderPass", "RenderPassDrawQuad", "BackdropFilter",
	"cc::Picture::Raster", "Paint", "Layout", "UpdateLayoutTree", "Commit",
];

for (const [name, s] of Object.entries(SCENARIOS)) {
	const events = await trace(s);
	const total = events.filter((e) => e.ph === "X" && e.dur).reduce((a, e) => a + e.dur / 1000, 0);
	console.log(`\n=== ${name} ===  total traced busy: ${total.toFixed(0)} ms over ${WINDOW_MS}ms`);
	const picked = hot(events).filter(([n]) => true);
	for (const [n, ms] of picked) console.log(`   ${String(Math.round(ms)).padStart(6)} ms  ${n}`);
	const named = INTEREST.map((n) => {
		const hits = events.filter((e) => e.name === n && e.dur);
		return [n, hits.length, hits.reduce((a, e) => a + e.dur / 1000, 0)];
	}).filter(([, c]) => c > 0);
	if (named.length) {
		console.log("   --- of interest ---");
		for (const [n, c, ms] of named) console.log(`   ${String(c).padStart(6)}x ${ms.toFixed(1).padStart(8)}ms  ${n}`);
	}
}

await browser.close();
