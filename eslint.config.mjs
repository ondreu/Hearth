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
);
