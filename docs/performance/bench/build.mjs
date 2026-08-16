import { createRequire } from "module";
const esbuild = createRequire(import.meta.url)("esbuild");
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

/** Redirect bare `obsidian` imports to the local stub. */
const obsidianStub = {
	name: "obsidian-stub",
	setup(build) {
		build.onResolve({ filter: /^obsidian$/ }, () => ({
			path: resolve(here, "obsidian-stub.ts"),
		}));
	},
};

await esbuild.build({
	entryPoints: [resolve(here, "entry.ts")],
	bundle: true,
	format: "iife",
	target: "es2020",
	outfile: resolve(here, "bundle.js"),
	plugins: [obsidianStub],
	logLevel: "info",
});

// styles.css is linked directly by the harness pages, so there is nothing to
// copy — and nothing that can go stale between an edit and a run.
console.log("bundled");
