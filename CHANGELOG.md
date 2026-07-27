# Changelog

All notable changes to Hearth are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a numeric-only versioning scheme
(`MAJOR.MINOR.PATCH`) as required by Obsidian's plugin manifest. Beta builds
carry a fourth `.N-beta` segment and are omitted here; each entry aggregates its
preceding beta series.

History begins at 1.5.0. For releases before 1.5.0, see the
[GitHub Releases](https://github.com/ondreu/Hearth/releases) page.

## [1.17.0]

### Added

- **Keep an open dashboard current.** A home view now re-renders when you switch
  back to its tab, so Recent, Bookmarks and query-driven cards no longer show
  stale content until the tab is closed and reopened. The first render of a leaf
  is left alone, and refreshes are skipped mid-drag/resize so arranging a board
  is never interrupted. A new opt-in **Live refresh on vault changes** Behaviour
  toggle (default off) additionally re-renders on vault create/modify/delete/
  rename — debounced to coalesce bursts — so a permanently-visible board stays
  current without switching tabs (#110).
- **Completion checkboxes for every TaskNotes task.** Task cards showed a
  checkbox on recurring TaskNotes tasks but a plain status badge on the rest, so
  a mixed card looked inconsistent. Non-recurring TaskNotes tasks now get a
  checkbox too, in both the list and Kanban layouts. In the list, ticking writes
  the card's done status and unticking restores its first open status; on a
  Kanban board, ticking advances the task to the next swimlane (and eventually
  the done column), untick returns it to the first — mirroring how completing a
  task progresses its status. The checkbox swallows pointer events so ticking it
  on a draggable card doesn't start a drag. Recurring tasks keep their
  per-occurrence checkbox; checkbox- and Kanban-source tasks are unchanged (#111).
- **Status chip on TaskNotes tasks in the list layout.** With the checkbox
  replacing the old status badge, a task's actual status — open, in-progress,
  waiting, whatever your setup uses — was no longer visible in the list; the
  checkbox only says done or not. Each TaskNotes task now carries a small status
  pill beside its priority chip, showing the raw frontmatter value (capitalized
  for reading) with the full value in the tooltip. Checkbox- and Kanban-source
  tasks keep their existing badges.
- **Vault images as tile icons.** Launchpad and command tiles accepted only a
  Lucide icon id; they now also take a path to an image in your vault (png, jpg,
  svg, webp, …), which fills the whole tile with the label overlaid on a
  legibility scrim. A bare Lucide id never resolves to a file, so existing icons
  are untouched. The icon field in both editors gains a "?" help badge
  explaining the two accepted forms (#119).
- **Per-dashboard "Default on mobile" flag.** A dashboard can be marked as the
  mobile default from its settings (General tab), so a board tuned for a small
  screen opens on phones and tablets without becoming the desktop default. Only
  one board can hold the flag. The switch is applied in memory only, because the
  active-dashboard id is a single synced field — persisting it would drag the
  desktop's active board along on the next sync (#120).
- **"Focus search on open" option.** An opt-in Behaviour setting that puts
  keyboard focus in the search field whenever a home view opens, so a fresh
  Hearth tab can be typed into straight away. Focus is applied on open only, so
  a background refresh never steals it mid-interaction. Desktop only — the
  setting is hidden on mobile, where auto-focus would pop the on-screen keyboard
  on every open (#115).

### Fixed

- **Opening a task's note jumps to the task's line.** "Jump to Note" (and a
  click when quick view is off) landed at the top of the note, so a task buried
  in a long note meant scrolling to find it. The target line is now passed as
  ephemeral state, which Obsidian applies once the view has mounted, instead of
  a cursor move that a not-yet-laid-out editor discarded (#118).
- **Calendar events no longer shift by a day.** Weekly recurring events expanded
  their by-day rule against a locale-aware week start combined with a
  Sunday-based day offset, so in any locale whose week starts on Monday (Czech,
  most of Europe) occurrences landed on the wrong date — off by up to several
  days. The expansion is now locale-independent. The agenda view's
  today-highlight is also toned down to a thin row border and an
  accent-coloured day number, with no filled pill behind it, so today reads as
  part of the list rather than a block of colour; the month grid keeps its
  existing highlight.
- **Search filter chips no longer strand across the search bar.** With only a
  few filters, the chips were distributed edge-to-edge — one at the start, one
  in the middle, one at the end. They now sit in a left-aligned row whose gap
  shares out the leftover space, growing from 8px to 48px with the chip count
  and wrapping only once the minimum no longer fits.

### Changed

- **Default background** swapped from an animated GIF to a static wallpaper;
  the GIF was needlessly power-hungry.
- **Card architecture modularised into a registry** (internal, behaviour
  preserving). Adding a card type used to mean editing a dozen scattered
  enumerations — render and editor switches, the add-card menu, layout-import
  validation, the live-redraw set, the card cloner, locale records — most of
  which failed silently when missed. Each of the 20 card kinds is now a
  self-contained module under `src/cards/` declaring its render, editor,
  templates, liveness and clone behaviour, collected by a registry whose mapped
  type turns a missing registration into a compile error. An unknown persisted
  card kind (from a newer version, a sync conflict or a hand-edited
  `data.json`) now falls back to an inert definition rather than crashing the
  whole dashboard render, and a cloned RSS card no longer shares its sources
  array with the original (#103).

## [1.16.0]

### Added

- **Jira saved-filter card.** Connect a dashboard card to a favorite Jira saved
  filter using a bearer personal access token, then refine its issues with
  multi-select status, assignee, priority, issue type, sprint, and fix-version
  controls. The card derives options from the unrefined filter, preserves
  selected values, supports manual and automatic refresh, caches successful
  responses, and keeps REST requests constrained to the configured HTTPS Jira
  host. Portable exports omit the Jira personal access token.

## [1.15.0]

### Added

- **Calendar card — agenda layout and external ICS calendars.** The calendar
  card gains a **Layout** setting: the existing month grid, or a new **agenda**
  view that lists upcoming days (3–60 ahead) as a scrollable timeline. It can
  also **subscribe to external calendars** by ICS/iCal URL (Google, iCloud,
  Fastmail, Nextcloud, …) — add multiple sources, each with its own name and
  colour and an individual show/hide toggle. Events render as coloured dots on
  the month grid and are listed under each day in the agenda, expanded from the
  common recurrence rules (daily/weekly/monthly/yearly with interval, count,
  until, weekly by-day, and exclusions). Feeds are cached and auto-refreshed on
  a configurable interval, share the RSS card's fetch path (so they work despite
  browser CORS), and honour the global **disable external calls** privacy
  setting. `webcal://` links are accepted. Clicking a day that has events opens
  a picker so you can choose the daily note (open or create) or any event; in
  the agenda, each listed event is clickable. Either way an event opens a
  details modal showing its name, date, time, location, notes/description,
  source calendar and any link. From that modal you can **create a note from
  the event**, configured to be as flexible as you like: pick a template,
  choose the target folder and a filename pattern (`{{summary}}`, `{{date}}`,
  …), and route every event value independently — send the date/time to custom
  frontmatter properties, append the description to the body under a heading,
  or ignore a value entirely and just keep the name. Sensible defaults apply
  out of the box. The note is linked back to the event by its ID (stored in
  frontmatter), so opening the same event later reopens its note instead of
  making a duplicate. Timezone note: UTC and all-day times are exact; `TZID`
  wall-clock times are read in the viewer's local zone.
- **Vault statistics card — advanced mode.** The stats card gains an **Advanced**
  toggle in its editor. Off keeps the familiar fixed set of tiles. On unlocks
  three controls: choose which built-in stats appear (notes, attachments,
  folders, tags, day streak, and a new **Days using Obsidian** counter measured
  from the vault's oldest file); break attachments out into a separate count
  tile per file type (images, PDFs, videos, …); and add custom count tiles that
  show how many files match a query, using the search bar's syntax (`#tag`,
  `key:value` for a frontmatter property, or plain text). Each custom tile takes
  an optional label and icon.

### Fixed

- **Clock card — force a 12- or 24-hour clock regardless of locale.** The clock's
  "24-hour time" toggle only chose between 24-hour and the OS locale default, so
  on locales that already default to a 24-hour clock there was no way to get a
  12-hour clock. It is replaced by a three-way **Time format** selector
  (Automatic / 12-hour / 24-hour) mapping directly to `Intl`'s `hour12` option.
  Existing settings are migrated, preserving prior behaviour (#98).

## [1.14.0]

### Added

- **Link a dashboard to a core Workspace (auto-switch).** Each dashboard gets an
  optional linked workspace, chosen from the core Workspaces plugin's saved
  workspaces in the dashboard settings (General tab). When that workspace loads,
  Hearth switches to the linked dashboard automatically. Sync is one-way
  (workspace → dashboard) and fires once per workspace change; the link survives
  layout export/import, and duplicating a dashboard deliberately does not copy it
  (#91).
- **Theme-following crystal icon.** The ribbon, tab and header crystal is now a
  vector drawn with `currentColor`, so an optional **Follow theme icon color**
  Appearance setting (Off / Icon / Title / Icon and title) lets it track the
  theme's icon color in light and dark. The default keeps the familiar purple
  crystal (#90).
- **Plugin view card — show a specific file.** The Plugin view card can now open
  a chosen vault file in the hosted view, so file-backed views (Excalidraw,
  canvas, …) render the document instead of an empty "new file" screen. The card
  editor gains a file field with a fuzzy picker and a clear button; a blank path
  hosts the bare view as before (#89).
- **Bookmark groups (folders).** The Bookmarks card now mirrors Obsidian's own
  bookmarks pane: groups render as collapsible folders (click the header to
  expand or collapse) and sub-groups nest to any depth, instead of every
  bookmark being flattened into one list. This also fixes bookmarks inside a
  group appearing twice — the card previously re-flattened Obsidian's already
  flat `getBookmarks()` list — and drops groups left empty after orphaned
  file/folder bookmarks are hidden (#82).

### Fixed

- **Open files in place from the dashboard.** The dashboard view now marks itself
  navigable, so opening a file (from the file explorer or elsewhere) while the
  dashboard is focused reuses the tab instead of spawning a new one and leaving
  the file explorer's selection stuck (#84).
- **Unnamed bookmarks show the file name, not the full path.** A file or folder
  bookmark without its own name previously rendered as its whole vault path,
  which overflowed the card when the path was long. It now shows just the
  target's basename — matching Obsidian's own bookmarks pane — and still falls
  back to the last path segment if the target can't be resolved (#92).

## [1.13.0]

### Added

- **Per-dashboard header customization.** Each dashboard can now override the
  global header defaults — title visibility and text, logo text/icon,
  alignment, title and logo size, the title's top margin, and the spacing below
  the header block — while search visibility stays independent. Import/export
  sanitises the new fields and duplicating a dashboard preserves its explicit
  overrides (#75).
- **Editable Kanban card titles.** A Kanban card's title can now be edited in
  place: **double-click** a card to swap its text for an inline input (Enter
  saves, Escape cancels), the same gesture that renames a column. The card's
  quick-view popover (single click) also shows the title as an editable field,
  so it's reachable by keyboard too. Either way the card's dates, priority and
  repeat markers are preserved; note-linked cards keep their note's name as the
  title (#71).
- **Editable Kanban card descriptions.** A card's quick-view popover now has a
  **Description** field for every Kanban card — not just when the "Dates &
  priorities" toggle is on. The text is saved as indented sub-bullets under the
  card in the board note, or, for a card that's been converted to a note, into
  that note's body. The card's title and metadata line is left untouched (#71).
- **Card border width setting.** A new global setting controls the width of
  card borders (#78).

### Fixed

- **TaskNotes tasks open in a working editor again.** Opening an existing
  TaskNotes task from a Tasks card handed TaskNotes' edit modal the note's
  `TFile` instead of its own task object, leaving the modal with a broken
  change-detection baseline: every button but Delete was trapped and the window
  couldn't be closed (#72). Hearth now resolves TaskNotes' task info for the
  note first (via its cache manager or public API) and only opens the modal when
  it can, falling back to opening the note otherwise.

## [1.12.0]

### Changed

- **Card & dashboard settings, reorganised into tabs.** The card-settings and
  per-dashboard-settings dialogs — previously one long, flat scroll of every
  control — are now split across tabs, mirroring the plugin settings pane so the
  whole plugin configures the same way. Card settings groups into **Content**
  (type, title and the card's own options), **Style** (colours, opacity, blur)
  and **Layout** (size, pin to all dashboards, copy to another), with Remove and
  Done always in reach at the bottom. Dashboard settings groups into **General**,
  **Layout**, **Style** and **Background**. The last-used tab is remembered, and
  a single failing group can no longer blank the whole dialog.

### Added

- **Recent files card — file-type filter.** The **Recent files** card can now be
  limited to specific file types. Its editor offers the same type chips as the
  search filter (Notes, Images, PDFs, Canvas, …); pick any combination to list
  only those, or leave them all off to keep showing every recently-opened file.
- **Card corner radius setting.** A **Card corner radius** slider controls how
  rounded card corners are, from the default 14 px down to sharp 0 px corners,
  at both global (Settings → Dashboard) and per-dashboard (dashboard settings)
  levels. Merged-together cards still flatten their touching corners, and the
  shared frosted-glass layer follows the same radius so nothing seams.
- **RSS feed card — add feeds from a GitHub repo.** The RSS card's editor now
  has an **Add from GitHub** shortcut: type a repository as `owner/repo` (or
  paste its URL), pick **Releases**, **Commits**, or both, and Hearth adds the
  matching `releases.atom` / `commits.atom` feeds for you — no need to
  hand-write the feed URLs.

## [1.11.0]

### Added

- **RSS feed card.** A lightweight, self-contained feed reader you can drop on
  any dashboard. Add one or more RSS/Atom feeds — each becomes a tab in the card
  header — with an optional combined **"All"** tab that merges every source
  newest-first. Choose between three layouts (**List** title + date, **Cards**
  with excerpt and thumbnail, or a **Compact** headlines view), cap how many
  items each feed shows, and set an auto-refresh interval (or 0 to refresh only
  when opened, plus a manual refresh button). Feeds are fetched through
  Obsidian's own request bridge (so cross-origin feeds work) and cached in
  memory, degrade gracefully offline (the last good items stay), and honour the
  **"disable external calls"** setting — with it on, no feed request is made.

### Fixed

- **Task date parsing no longer spams the console — and understands wikilink
  dates.** When a task's date field held something moment.js couldn't parse
  natively (e.g. `📅 [[260801]] #sd`, a due date written as a daily-note link),
  the parser fell back to moment's deprecated `new Date()` path, printing a
  loud RFC2822/ISO deprecation warning for every such field on every vault scan
  (#52). Dates are now parsed strictly (ISO first, then an explicit list of
  human formats), which can never trigger the warning. As part of the same
  change, date expressions may now be wrapped in a wikilink (`📅
  [[2026-08-01]]` or `[[Daily/2026-08-01|due]]` resolve to the linked day) and
  trailing `#tags` after a date are ignored (`📅 2026-08-01 #home`).

- **Settings pane no longer opens blank on Obsidian 1.13.** Root cause found
  (with an enormous assist from the affected users' console digging in #52):
  since the category-ribbon redesign, the settings tab had a private helper
  named `renderTab(body, tab)` — and Obsidian 1.13's reworked settings window
  calls an *internal, undocumented* `SettingTab.renderTab()` method (no
  arguments) as the entry point for opening a tab. Hearth's same-named helper
  silently shadowed it: Obsidian invoked it with no arguments, the
  `switch (undefined)` inside matched no category, and the pane rendered
  nothing — no error, on every reopen, on macOS and iPad alike (#52). And
  because Obsidian never got past that entry point, none of the earlier
  guards or the declarative registration could ever run. The helper is renamed
  so Obsidian's own machinery runs again, the tab additionally registers its
  pane through the 1.13 declarative settings API (older Obsidian versions keep
  using `display()` — same UI either way), and a constructor tripwire now
  reports any future member-name collision with Obsidian's `SettingTab`
  internals as a loud console error instead of a silent blank pane.
- **A failing settings section no longer blanks the whole settings pane.**
  Previously, if any part of the settings tab threw while rendering, the entire
  pane was left empty with nothing to explain why — and, because the tab
  remembers the last category you opened, it could stay blank on every reopen.
  The **entire** settings render is now guarded — each section, each tab, and
  the surrounding ribbon/datalist build — so a failure anywhere shows an inline
  error in its place and logs the underlying error to the developer console
  (including when Obsidian 1.13 renders settings in a separate window, whose
  console is easy to miss), instead of a silent blank pane. Whatever still
  works — sibling sections and the category ribbon — keeps working so you can
  navigate.
- **Orphaned file/folder bookmarks no longer linger in the Bookmarks card.**
  Obsidian keeps a file/folder bookmark in its store after the target note is
  deleted, and its native bookmarks pane hides those orphans; the Bookmarks card
  rendered the raw store, so a deleted note left a dead, unclickable row behind.
  File/folder bookmarks whose path no longer resolves are now filtered out,
  matching Obsidian's native behaviour. URL, search, and group items are
  unaffected.

## [1.10.0] - 2026-07-13

### Added

- **Hover-visibility options for dashboard controls.** The dashboard's
  arrange-mode zone and switcher can be set to reveal on hover instead of
  staying always visible, keeping the board clean until you reach for them; the
  hover hit-area is enlarged so they're easy to summon.
- **Per-dashboard search-bar visibility toggle.** Show or hide the search bar
  independently on each dashboard.
- **Base view selector for Embed cards.** An Embed card pointing at a `.base`
  file can choose which of the base's views it displays.

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
- **Hover-reveal controls no longer shift the board.** Switching a dashboard
  control to "Show on hover" added in-flow padding that only existed in hover
  mode, growing the control's zone by ~32px so it pushed the header and grid
  down — and in fit-to-page mode the extra height clipped the board. Hover mode
  now has the same footprint as always-visible mode, so revealing a control no
  longer moves anything.

## [1.9.0] - 2026-07-12

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

[1.11.0]: https://github.com/ondreu/Hearth/compare/1.10.0...1.11.0
[1.10.0]: https://github.com/ondreu/Hearth/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/ondreu/Hearth/compare/1.8.1...1.9.0
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
