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
3. **Register it.** Add the kind to `CARD_DEFINITIONS` in `index.ts` and append
   its template id(s) to `TEMPLATE_MENU_ORDER`. (A unit test asserts the menu
   order covers every template exactly once.)
4. **Add locale strings.** In `../locales/en.ts`: `editors.kinds.<kind>` (type
   dropdown label), `templates.<templateId>` (add-menu label), and any
   `cards.<kind>` render-time strings. Every other locale is compile-checked
   against `en`, so tsc lists what each is missing.

Steps 1, 3 (the record), and 4 are compiler-enforced.

## Where the code lives

The `CardDefinition` for each kind is here, but during the initial refactor
(issue #103) the render and editor **implementations** still live in
`../cardbodies.ts` and `../editors.ts`; each module imports and adapts them.
Phase B relocates those implementations into their kind's module so each card is
physically self-contained.
