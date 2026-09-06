import { de } from "./de";
import { en } from "./en";
import { zh } from "./zh";

/**
 * The shape every locale must implement. English is the source of truth: a new
 * locale is an object typed as `Translations`, so TypeScript flags any missing
 * or misspelled key at build time.
 */
export type Translations = typeof en;

/**
 * Registry of available locales, keyed by lowercase language code (matching
 * Obsidian's own codes, e.g. `"en"`, `"de"`, `"zh"`, `"pt-br"`).
 *
 * To add a language: create `./xx.ts` exporting a `const` typed as
 * `Translations`, import it here, and add it to this map. See
 * `src/locales/README.md` for the full walkthrough.
 */
export const LOCALES: Record<string, Translations> = {
	en,
	de,
	zh,
};
