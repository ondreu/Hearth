/** Bundle the end-to-end test the same way the server itself is bundled — it
 * imports the plugin's signing code, so it needs the same `obsidian` alias. */
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

for (const name of ["fixtures", "smoke"]) {
	await esbuild.build({
		entryPoints: [here(`test/${name}.ts`)],
		outfile: here(`dist/test/${name}.js`),
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node22",
		external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
		alias: { obsidian: here("src/obsidian-stub.ts") },
		logLevel: "warning",
	});
}
