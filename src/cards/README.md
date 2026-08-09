# Card modules

Every dashboard card kind is a self-contained module in this directory that
exports a [`CardDefinition`](./definition.ts). The registry barrel
([`index.ts`](./index.ts)) collects them into one `CARD_DEFINITIONS` record, and
everything that used to enumerate kinds by hand — the render dispatch, the editor
dispatch, the "Add card" menu, layout-import validation, the live-redraw set,
`cloneCard` — now derives from that record.

## Adding a new card kind

1. **Declare the kind.** Add it to the `CardKind` union in `../types.ts`, plus
   any config field on `DashboardCard` (e.g. `myCard?: MyCardConfig`). The
   compiler now walks you through the rest — the `CARD_DEFINITIONS` record is a
   `{ [K in CardKind]: … }` mapped type, so a missing registration fails to
   typecheck.
2. **Write the module.** Create `./<kind>.ts` exporting a
   `CardDefinition<"<kind>">`: its `render`, optional `renderEditor`, one or more
   `templates`, `liveness`, and `cloneConfig` if it has nested config.
3. **Register it.** Add the kind to `CARD_DEFINITIONS` in `index.ts` and put its
   template id(s) into a category in `TEMPLATE_MENU_GROUPS`. (A unit test
   asserts the groups cover every template exactly once.)
4. **Add locale strings.** In `../locales/en.ts`: `editors.kinds.<kind>` (type
   dropdown label), `templates.<templateId>` (picker name),
   `templateDescriptions.<templateId>` (the one-liner under it, also searched),
   and any `cards.<kind>` render-time strings. Every other locale is
   compile-checked against `en`, so tsc lists what each is missing. (A unit test
   asserts every template has both a name and a description.)

## Cards that depend on another plugin

Declare a `requires` on the template — a display name, the community plugin id
when there is one, and a `satisfied(app)` probe. The card is offered in the
picker **either way**; `requires` only decides whether it is badged *Needs X*
and whether adding it shows the "install X" notice. This replaced an
`available()` predicate that hid the template entirely, which meant a card
nobody could discover until they already had its dependency.

The corollary is that a card with a `requires` must render something useful
without it — every one of them shows an `emptyState` naming the plugin — and its
editor should say the same, as `gitEditor` does.

Steps 1, 3 (the record), and 4 are compiler-enforced.

## Where the code lives

Each kind's **render** and **editor** implementations now live in its own module
(Phase B): `renderBookmarks` and the bookmarks card sit in `bookmarks.ts`,
`renderCalendar`/`calendarEditor` in `calendar.ts`, and so on. Two shared files
keep only the helpers used by more than one kind:

- `../cardbodies.ts` — the render helpers shared across kinds: the `emptyState`
  placeholder, the Markdown-embed core, the daily-note path resolvers, the
  vault-activity helpers, the free-form tile grid, the embed view-state cluster
  and `feedHost`.
- `../editors.ts` — the settings-modal framework (`CardSettingsModal`,
  `CardSettingsOptions`) and the generic editor helpers `addResetButton` and
  `moveItem`.
- `../calendarsource.ts` — everything the two calendar-style kinds share: the
  per-render `IcsContext` (ICS feeds + the TaskNotes source), the event-details
  modal and event-note creation, the day picker, the agenda event row, and the
  editor sections for sources, TaskNotes, chips and event notes. `calendar.ts`
  (mini) and `schedule.ts` (full Calendar) keep only their own drawing, so the
  two can't drift on where events come from or what clicking one does.

The rule of thumb: logic used by a single kind belongs in that kind's module;
logic shared across kinds stays in the relevant shared file, and the module
imports it.
