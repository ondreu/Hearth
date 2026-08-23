# Translations (i18n)

Hearth's user-facing strings live in this folder so the plugin can be
translated without touching feature code. English (`en.ts`) is the source of
truth; every other locale is type-checked against it.

## Available languages

| Code | Language | File |
| --- | --- | --- |
| `en` | English (source of truth) | [`en.ts`](en.ts) |
| `zh` | Simplified Chinese — 简体中文 | [`zh.ts`](zh.ts) |

## How it works

- `src/i18n.ts` exposes `t()`, which returns the active locale object, and
  `setLanguage()`, which picks the locale from Obsidian's UI language
  (`localStorage["language"]`) at plugin load.
- `en.ts` exports the `en` object. Its type, `Translations` (see `index.ts`),
  is `typeof en`, so a new locale that misses a key or misspells one fails the
  build (`npm run typecheck`).
- Plain strings are literals. Strings that interpolate a value are **functions**
  so each language controls word order and pluralization itself, e.g.

  ```ts
  commandNotFound: (id: string) => `Hearth: command not found: ${id}`,
  ```

- Call sites read strings as `t().section.key` (or `t().section.key(arg)` for
  the function entries). `t()` is called at render time, so switching the
  active locale updates the whole UI.

## Adding a language

1. Copy `en.ts` to a new file named after the
   [Obsidian language code](https://docs.obsidian.md/) in lowercase — e.g.
   `de.ts` (German), `zh.ts` (Simplified Chinese), `pt-br.ts` (Brazilian
   Portuguese).
2. Type the export against `Translations` and translate the values (keep the
   keys and the function signatures unchanged):

   ```ts
   import type { Translations } from "./index";

   export const de: Translations = {
       // …translated values…
   };
   ```

3. Register it in `index.ts`:

   ```ts
   import { de } from "./de";

   export const LOCALES: Record<string, Translations> = {
       en,
       de,
   };
   ```

4. Run `npm run typecheck`. TypeScript will list any key you missed or
   mistyped. Fix them until it's clean, then `npm run build`.

Regional codes fall back to the base language and finally to English, so a
partial `pt-br.ts` still renders (untranslated keys aside) and an unknown
language shows English.

## Scope

Only live UI "chrome" is translated here. User-editable **seed data** — the
default dashboard title, starter card titles, and the default mobile-action
button labels — stays in English in `types.ts` / `templates.ts`, because it is
written into the vault's `data.json` the moment a dashboard is created and is
then owned by the user.
