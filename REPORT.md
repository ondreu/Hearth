# Report: Tasks-plugin source as a native Hearth source

## What changed against the previous version

The previous version rendered the obsidian-tasks plugin's own `tasks` query
block inside the card. This version deletes that embedding entirely and makes
the Tasks-plugin source a first-class Hearth source:

- **Collection (`src/tasksplugin.ts`, `collectTasksPluginTasks` in
  `src/cards/tasks.ts`).** The card scans in-scope notes for checkbox lines,
  but what counts as a task is the plugin's own notion: the status symbol must
  be one the plugin knows (its built-ins plus custom statuses, read live from
  its status registry with a defensive probe of every known registry shape,
  falling back to Todo / In Progress / Done / Cancelled). Done-ness and the
  status label are the plugin's. The vault's task format is parsed off each
  line in both shapes — Emoji (`📅 ⏫ 🔁`) and Dataview inline fields
  (`[due:: …] [priority:: …]`) — with emoji winning when both are present.
  Folder scope, `showCompleted`, the task cap, sorting, and the Hearth filter
  (tags, priority, status, due, text) all apply over these hits, exactly as for
  the other sources.
- **Rendering.** The card draws its normal rows/board/matrix with Hearth's own
  chips, coloured dots, text styles and colours — no foreign widget. Priority,
  dates, status, repeat and tags flow through the normal task rendering,
  including the custom-field system (a field can be a chip, a dot, text, or
  colour the whole task). The Tasks-plugin status is offered as a builtin field
  source with its own default field, since the checkbox alone cannot say
  "Needs review".
- **Writes stay the plugin's.** Ticking goes through
  `executeToggleTaskDoneCommand`, editing through `editTaskLineModal`, creating
  through `createTaskLineModal` (into today's daily note, created when missing,
  or a chosen note). Hearth never rewrites a task line for this source: chip
  pickers, the metadata editor, inline title edits and convert-to-note are
  disabled, and `writeTaskFieldValue` refuses. Deleting removes the line only.
- **Read-only layouts.** The board groups by the plugin's statuses and the
  matrix by priority, but neither accepts drops (dragging between statuses or
  quadrants would rewrite the line outside the plugin). Cards are not
  draggable, quadrants render locked, and the context menus offer no moves —
  only the plugin edit / open note / delete. The layout picker stays, with a
  read-only note.
- **Missing plugin.** Same clear message and one-click switch back to
  checkboxes, now drawn by Hearth instead of around an embedded block. The
  legacy `tasksQuery` setting is kept for load/migration but no longer read or
  shown.
- **Kept fixes.** TaskNotes-only field scoping is untouched (only TaskNotes
  cards follow the vault-wide list; every other source — now including
  `obsidian-tasks` — configures its own fields from its own default), and the
  fields editor hardening is untouched.
- **Locales/docs/tests.** New strings (`editInTasksPlugin`,
  `layoutDescReadonly`, updated source/integration descriptions) in all six
  locales; user-guide chapter 8 and the changelog rewritten for the new
  behaviour; `tasksplugin.test.ts` now covers parsing, the registry probe and
  the toggle/edit/delete writes; `tasksplugincard.dom.test.ts` asserts Hearth
  rows, filter/cap and the missing-plugin switch; `taskfields.test.ts`
  covers the plugin status source and default.

## What I could not verify without a running Obsidian

- Against a real obsidian-tasks install: the exact runtime shape of its status
  registry across plugin versions (the probe covers `registeredStatuses`,
  `bySymbol` and settings arrays, but only a live vault proves which shape a
  given version exposes), custom-status labels/order on a real board, and the
  toggle/edit/create modals end to end (recurrence rollover, done-date stamps,
  Dataview-format vaults).
- Visual check: that rows/board/matrix with Hearth chips read as one card
  (colours, dots, dark/light themes), and that the read-only board/matrix
  affordances (locked quadrants, non-draggable cards) are obvious rather than
  merely inert.
- The daily-note creation path with Daily notes / Periodic Notes actually
  installed, and file-explorer-order interactions.

## Verification output

- `npm run typecheck` — pass.
- `npm run lint` — pass (no errors, no warnings).
- `npx vitest run test/tasksplugin.test.ts` — 28 passed.
- `npx vitest run test/tasksplugincard.dom.test.ts test/taskfields.test.ts` —
  69 passed.
- `npx vitest run test/tasksplugin.test.ts test/tasksplugincard.dom.test.ts
  test/taskfields.test.ts test/taskfilter.test.ts test/taskmatrix.test.ts
  test/portable.test.ts test/taskscope.test.ts` — 236 passed.
- `npx vitest run` (full) — 2493 passed, 14 failed, 5 files failed; all
  failures are in `weather.test.ts`, `weatherdetail.test.ts`, `market.test.ts`,
  `market.dom.test.ts` and `instantview.dom.test.ts` (locale-dependent
  weather/market/instantview baselines). No new failures in any tasks,
  fields, filter, matrix, scope or portable tests.
- `npm run build` — pass.
