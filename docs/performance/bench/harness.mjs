/* Shared plumbing for the benchmark scripts: locating Playwright, locating this
 * directory, and the two CDP instruments every script uses. */
import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";

export const HERE = dirname(fileURLToPath(import.meta.url));

/** Playwright is normally a global install in CI images rather than a devDep of
 * this repo, so try the usual places before giving up with a useful message. */
export function loadPlaywright() {
	const candidates = [
		"playwright",
		"/opt/node22/lib/node_modules/playwright",
		"/usr/lib/node_modules/playwright",
		"/usr/local/lib/node_modules/playwright",
	];
	for (const id of candidates) {
		try {
			return createRequire(import.meta.url)(id);
		} catch {
			/* try the next one */
		}
	}
	throw new Error(
		"Playwright not found. Install it (npm i -g playwright) or add it as a devDependency.",
	);
}

/** Chromium's own timeline events, by the buckets these benchmarks report. */
export const TIMELINE_CATEGORY = "disabled-by-default-devtools.timeline";

/** Start a trace on `client` (a page- or browser-level CDP session). */
export async function startTrace(client, categories = [TIMELINE_CATEGORY]) {
	await client.send("Tracing.start", {
		traceConfig: { includedCategories: categories, recordMode: "recordAsMuchAsPossible" },
		transferMode: "ReturnAsStream",
	});
}

/** Stop the trace and return its events. */
export async function stopTrace(client) {
	const done = new Promise((res) => client.once("Tracing.tracingComplete", res));
	await client.send("Tracing.end");
	const { stream } = await done;
	let raw = "";
	for (;;) {
		const chunk = await client.send("IO.read", { handle: stream, size: 10 * 1024 * 1024 });
		raw += chunk.data;
		if (chunk.eof) break;
	}
	await client.send("IO.close", { handle: stream });
	const parsed = JSON.parse(raw);
	return Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
}

/** Performance.getMetrics as a plain name → value object. */
export async function readMetrics(client) {
	const { metrics } = await client.send("Performance.getMetrics");
	return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

/** Count trace events by name. */
export function countByName(events, name) {
	return events.filter((e) => e.name === name).length;
}

/** Launch Chromium the way every script here wants it: a Retina-like backing
 * store, so raster area matches what a Mac actually pushes.
 *
 * `CHROMIUM_PATH` names a browser binary to use instead of the one Playwright
 * would resolve from its `chromium` channel. Needed wherever the Playwright
 * install and the browser install are versioned apart — a container with a
 * pre-baked browser under PLAYWRIGHT_BROWSERS_PATH and a globally installed
 * Playwright that pins a different build, which is what CI images and coding
 * sandboxes tend to look like. Such a container usually has no user namespaces
 * either, hence --no-sandbox on that path only: unset, the launch is exactly
 * what it always was. */
export async function launch(playwright) {
	const explicit = process.env.CHROMIUM_PATH;
	return playwright.chromium.launch({
		...(explicit ? { executablePath: explicit } : { channel: "chromium" }),
		args: [
			"--force-device-scale-factor=2",
			"--hide-scrollbars",
			...(explicit ? ["--no-sandbox"] : []),
		],
	});
}
