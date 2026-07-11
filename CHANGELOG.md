# Changelog

All notable changes to Hearth are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a numeric-only versioning scheme
(`MAJOR.MINOR.PATCH`) as required by Obsidian's plugin manifest. Beta builds
carry a fourth `.N-beta` segment and are omitted here; each entry aggregates its
preceding beta series.

History begins at 1.5.0. For releases before 1.5.0, see the
[GitHub Releases](https://github.com/ondreu/Hearth/releases) page.

## ["1.9.0]

### Changed

- **Mobile action buttons: the legacy `commandId` field is migrated to
  `target`.** Buttons created before the unified command/note/URL model stored
  their action in a deprecated `commandId` field that was only read as a
  fallback. On load, such buttons are now migrated in place to the current
  `target` field and the result is written back to storage, so the legacy field
  finally leaves your `settings.json`. **This migration is one-way:** if you
  upgrade and then downgrade Hearth below this version, any mobile action button
  whose action was stored *only* as `commandId` loses its action (the button
  appears blank and must be reassigned). Buttons edited or created in a recent
  version are unaffected.

### Fixed

- **Invalid due dates no longer leak the text "Invalid date" into tasks.** A
  task due date that looked like an ISO date but wasn't a real calendar day —
  e.g. `📅 2026-02-31` (there's no 31st of February) or a month like `2026-13-01`
  — was being turned into the literal string **"Invalid date"** instead of being
  left alone. The validity check meant to reject such dates never ran (it tested
  moment's `isValid` as a property rather than calling it, so it was always
  truthy), so the bogus label was written straight into the tasks card. These
  dates are now correctly ignored, and any unparseable relative-date input falls
  back to showing the raw text verbatim, as intended. A silent bug — nothing
  errored, so it was easy to miss.

## [1.8.0] - 2026-07-11

A cards-and-appearance release aggregating the whole 1.7.1 beta series.

### Added

- **Dataview card** — runs a DQL or DataviewJS query and renders the results
  through [Dataview](https://github.com/blacksmithgu/obsidian-dataview)'s own
  renderers (tables, lists and task lists look native and refresh live), with
  auto-fitting, drag-resizable table columns.
- **Plugin view card** (beta) — hosts any plugin's — or a core — side-panel view
  (calendar, outline, tag pane, kanban…) right on the dashboard via a detached
  workspace leaf that never touches your saved layout.
- **Frosted glass** — a backdrop blur behind translucent cards at global,
  per-dashboard and per-card levels, drawn on one shared layer so merged cards
  read as a single seamless sheet. Now the default look for fresh installs.
- **About** settings tab.
- Embed cards can carry a **second view** with a switcher, and can **hide a
  base's header**.
- Tasks card gains a **list filter**, a **custom multi-rule sort**, and
  multi-value **TaskNotes "complete" statuses**.

### Changed

- **Settings tab reorganized** into a category ribbon (Appearance · Search ·
  Dashboard · Behaviour · Integrations · Backup · About) with a description on
  every setting.
- Embed **zoom now reflows** to fit its card.

## [1.7.0] - 2026-07-10

A major Tasks-card release, plus search and release-notes additions
(everything from the 1.6.8 beta series).

### Added

- **Kanban plugin boards** — the Tasks card can read and edit
  [Kanban](https://github.com/obsidian-community/obsidian-kanban) boards (each
  heading a column, each checkbox a card) as a list or a drag-and-drop board
  that rewrites the note in Kanban's own format.
- **Full obsidian-tasks metadata** — start (🛫), scheduled (⏳), due (📅) and
  done (✅) dates, a 5-level priority (🔺⏫🔼🔽⏬, each a distinct colour) and
  recurrence (🔁), shown as compact indicators with a right-click editor and
  add-card pickers — from Kanban cards and plain Markdown checkboxes alike.
- **Custom task states** (`[symbol] Label`) that each become a draggable board
  column, plus **done columns** and per-column **sort** (Smart / Due / Priority
  / Created / Alphabetical).
- **Quick view** — clicking a task opens a compact editor for metadata and
  description in place.
- **Convert to note** / **create as note** — turn a card into its own linked
  note (optionally from a template, scraping metadata into frontmatter), or
  create new cards as notes outright.
- **Omnisearch** — the search bar can optionally be powered by
  [Omnisearch](https://github.com/scambier/obsidian-omnisearch) when installed.
- **"What's new" dialog** — surfaces release notes from a continuous,
  accumulating changelog after each update.

### Changed

- Double-click **column rename**, clickable links, per-card descriptions, and
  card deletion on boards.
- Recurring tasks complete **per-occurrence** like TaskNotes.
- Scroll-mode boards grow as you drag a card past the bottom.

## [1.6.7] - 2026-07-09

### Fixed

- Maintenance and bug-fix release
  ([1.6.6…1.6.7](https://github.com/ondreu/Hearth/compare/1.6.6...1.6.7)).

## [1.6.6] - 2026-07-08

### Fixed

- Maintenance and bug-fix release
  ([1.6.5…1.6.6](https://github.com/ondreu/Hearth/compare/1.6.5...1.6.6)).

## [1.6.5] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.4…1.6.5](https://github.com/ondreu/Hearth/compare/1.6.4...1.6.5)).

## [1.6.4] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.3…1.6.4](https://github.com/ondreu/Hearth/compare/1.6.3...1.6.4)).

## [1.6.3] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.2…1.6.3](https://github.com/ondreu/Hearth/compare/1.6.2...1.6.3)).

## [1.6.2] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.1…1.6.2](https://github.com/ondreu/Hearth/compare/1.6.1...1.6.2)).

## [1.6.1] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.5.2…1.6.1](https://github.com/ondreu/Hearth/compare/1.5.2...1.6.1)).

## [1.6.0] - 2026-07-06

### Added

- **Natural-language task dates** — type due/scheduled dates in plain language
  (`📅 tomorrow`, `📅 next friday`, `📅 in 3 days`…).
- **Free-form tiles** — tiles can be placed anywhere and may overlap; drag & drop
  with a dashed drop-target ghost and an overlap glow. Auto-shift is an opt-in
  beta per card.
- **Mobile search** — search optimized for mobile.
- **Edge-merging cards** — adjacent cards merge their borders and sharpen their
  touching corners so they read as one continuous tile.
- **Relative date labels for tasks** — Today / Tomorrow / Yesterday / Friday /
  Next Friday / "15 Jul".
- **Recurring-task completion checkbox** — undoable, rendered before the task
  text; Kanban recurring checkbox inline with the task text.
- **Hide titles** — hides card headers (not the dashboard header).

### Changed

- Daily/embed cards now use a single scrollbar; the embed scrolls instead of the
  card body.
- Daily note: floating open button on the card; header hidden by default in
  arrange mode.
- Manifest version is numeric-only (`1.6.0`) to satisfy Obsidian plugin review.
- Replaced direct `element.style.X = …` assignments with `setCssStyles()` / CSS
  classes; use `activeDocument` instead of `document` for popout-window
  compatibility; replaced CSS `:has(...)` selectors with explicit body modifier
  classes (`.is-embed-host`, `.is-jot-host`).

### Fixed

- Daily/embed horizontal scroll (clip x-overflow, wrap text).
- Tile drag offset (transform-based); overlap glow always on.
- Added the `u` flag to regexes containing surrogate-pair emoji (Tasks-plugin
  markers).

## [1.5.2] - 2026-07-05

### Fixed

- Maintenance and bug-fix release
  ([1.5.1…1.5.2](https://github.com/ondreu/Hearth/compare/1.5.1...1.5.2)).

## [1.5.1] - 2026-07-05

### Fixed

- Maintenance and bug-fix release
  ([1.5.0…1.5.1](https://github.com/ondreu/Hearth/compare/1.5.0...1.5.1)).

## [1.5.0] - 2026-07-05

A redesigned dashboard experience, plus recurring tasks and many polish fixes.

### Added

- **CSS-grid tiles** — Links/launchpad and Commands tiles live on a fine CSS
  grid (44 px cells, 4 px snap) with independent column and row spans. Drag a
  tile to reorder; drag the corner grip to resize. Default tile is 2×2.
- **Ambient default background** — a soft, blurred backdrop ships out of the box.
- **Recurring TaskNotes tasks** — tasks with a `recurrence` RRULE show a ↻ badge
  next to the next-occurrence date, tinted with the accent colour, with a
  plain-English schedule tooltip ("Repeats every week"). Overdue recurring tasks
  tint like one-offs.
- **Overhauled starter dashboard** — a redesigned default layout with exact
  coordinates.

### Changed

- **Smarter task sorting** — due → scheduled → priority → created.
- **Kanban drop outlines** — dragged cards preview where they'll land.
- **Calendar today outline** — today's cell stays visible under the heatmap tint.
- **Search layout polish** — autocomplete click-outside, restored field width,
  larger tile grip.
- **Fit-to-page default-on** — fresh installs lock to one screen; stuck cards
  auto-recover onto the board on render.

### Fixed

- Card drag overlay behaves correctly over tile cards.
- Tile grip visibility and contrast improved.
- Calendar arrow targets now work in dark themes.
- "Other" file-type filter hides when there are no unmatched files.
- Default background uses a CDN URL (raw.githubusercontent was blocked by
  Obsidian's CSP).

[1.8.0]: https://github.com/ondreu/Hearth/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/ondreu/Hearth/compare/1.6.7...1.7.0
[1.6.7]: https://github.com/ondreu/Hearth/compare/1.6.6...1.6.7
[1.6.6]: https://github.com/ondreu/Hearth/compare/1.6.5...1.6.6
[1.6.5]: https://github.com/ondreu/Hearth/compare/1.6.4...1.6.5
[1.6.4]: https://github.com/ondreu/Hearth/compare/1.6.3...1.6.4
[1.6.3]: https://github.com/ondreu/Hearth/compare/1.6.2...1.6.3
[1.6.2]: https://github.com/ondreu/Hearth/compare/1.6.1...1.6.2
[1.6.1]: https://github.com/ondreu/Hearth/compare/1.5.2...1.6.1
[1.6.0]: https://github.com/ondreu/Hearth/compare/1.5.2...1.6.0
[1.5.2]: https://github.com/ondreu/Hearth/compare/1.5.1...1.5.2
[1.5.1]: https://github.com/ondreu/Hearth/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/ondreu/Hearth/releases/tag/1.5.0
