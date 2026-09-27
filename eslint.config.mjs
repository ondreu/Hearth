import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
	{ ignores: ["main.js", "node_modules/**"] },
	...tseslint.configs.recommended,
	...obsidianmd.configs.recommended,
	// The obsidianmd recommended preset enables type-aware rules (e.g.
	// @typescript-eslint/await-thenable), which need the TypeScript program.
	// Wire up the project service so those rules can resolve type information.
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Vyžaduje Obsidian API 1.13.0+; minAppVersion je 1.8.7.
			// Zapnout zpět, až se minAppVersion zvedne.
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
		},
	},
	// The file that *implements* Obsidian's `createEl` for jsdom has to reach
	// for `document.createElement` — following the rule here would define the
	// helper in terms of itself.
	{
		files: ["test/support/obsidian-dom.ts"],
		rules: {
			"obsidianmd/prefer-create-el": "off",
		},
	},
	// test/support/obsidian-shim.ts is what *provides* the `moment` export that
	// the "import moment from 'obsidian' instead" rule points at — following
	// that advice here would be circular, and the shim documents the choice.
	// Everything else in test/ is held to the same rules as the plugin, because
	// the community directory's scorecard lints the whole repository and does
	// not read these overrides.
	{
		files: ["test/support/obsidian-shim.ts"],
		rules: {
			"@typescript-eslint/no-restricted-imports": "off",
		},
	},
);
