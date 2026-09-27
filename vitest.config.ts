import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Pure logic only — no DOM, no jsdom.
		environment: "node",
		include: ["test/**/*.test.ts"],
		// Freeze the timezone so date logic is deterministic on any machine/CI.
		env: { TZ: "UTC" },
	},
	resolve: {
		alias: {
			// The `obsidian` package is types-only; point it at a tiny shim that
			// re-exports the real moment.js and inert placeholders (see the file).
			// A leading "/" is the project root to Vite, so this needs no Node path API.
			obsidian: "/test/support/obsidian-shim.ts",
		},
	},
});
