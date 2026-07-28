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
			// Sentence case is for prose. Some UI strings are literal property
			// keys instead — e.g. the `event_uid` placeholder in the calendar
			// event-note settings, which is the actual frontmatter key written
			// by eventnote.ts. Sentence-casing those to `Event_uid` would show
			// users a key that does not match the one the plugin writes, so
			// exempt snake_case identifiers. `enforceCamelCaseLower` is
			// repeated from the preset because options replace, not merge.
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					enforceCamelCaseLower: true,
					ignoreRegex: ["^[a-z0-9]+(?:_[a-z0-9]+)+$"],
				},
			],
		},
	},
	// The test suite is not part of the shipped plugin bundle, so the rules
	// about what a plugin may import do not apply to it. In particular,
	// test/support/obsidian-shim.ts is what *provides* the `moment` export that
	// the "import moment from 'obsidian' instead" rule points at — following
	// that advice here would be circular, and the shim documents the choice.
	{
		files: ["test/**"],
		rules: {
			"@typescript-eslint/no-restricted-imports": "off",
		},
	},
);
