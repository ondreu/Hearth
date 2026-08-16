/* Does the sky keep costing anything when the Hearth tab is not the visible
 * one? Obsidian hides an inactive leaf in a tab group by taking it out of
 * layout, so the question is what Chromium does with a running animation in
 * each of the ways an element can be "not shown". */
import { HERE, launch, loadPlaywright, readMetrics, startTrace, stopTrace } from "./harness.mjs";

const WINDOW_MS = 4000;

const MODES = {
	"visible (control)": "",
	"display: none  (what a hidden Obsidian tab does)": "display:none",
	"visibility: hidden": "visibility:hidden",
	"opacity: 0": "opacity:0",
	"scrolled out of view / offscreen": "position:absolute;left:-10000px",
	"content-visibility: hidden": "content-visibility:hidden",
};

const browser = await launch(loadPlaywright());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${HERE}/index.html`);
const client = await page.context().newCDPSession(page);
await client.send("Performance.enable");


console.log(`\nAnimated rain sky + frost, ${WINDOW_MS}ms window, DPR 2\n`);
console.log("mode".padEnd(50) + "anims".padStart(7) + "mainMs".padStart(9) + "recalcs".padStart(9) + "layouts".padStart(9));
console.log("-".repeat(84));

for (const [label, css] of Object.entries(MODES)) {
	await page.evaluate(
		(s) => window.hearthBench.build(s),
		{ bg: "sky", bgBlur: 2, skyAnimate: true, skyCode: 63, cardBlur: 7 },
	);
	await page.evaluate((c) => {
		const root = document.getElementById("root");
		root.setAttribute("style", c);
	}, css);
	await page.waitForTimeout(1000);

	const anims = await page.evaluate(() => document.getAnimations().length);
	await startTrace(client);
	const b = await readMetrics(client);
	await page.waitForTimeout(WINDOW_MS);
	const a = await readMetrics(client);
	const ev = await stopTrace(client);

	console.log(
		label.padEnd(50) +
			String(anims).padStart(7) +
			(((a.TaskDuration ?? 0) - (b.TaskDuration ?? 0)) * 1000).toFixed(1).padStart(9) +
			String(ev.filter((e) => e.name === "UpdateLayoutTree").length).padStart(9) +
			String(ev.filter((e) => e.name === "Layout").length).padStart(9),
	);
}

await browser.close();
console.log("\n(anims counts CSS animations still registered; the cost columns are what actually runs.)");
