# The Hearth dashboard package format

A **package** is a JSON file describing one dashboard, one whole layout, or one
vault's settings. It is what Hearth's Import / export produces, and it is the
unit a dashboard gallery would store, list and serve.

This document is the contract. The implementation is `src/portable/`, and
`test/portable.test.ts` is the executable version of everything below.

## Why the format exists

A dashboard never described itself completely. Half its appearance lived on the
board and half in the vault's global settings, which the board fell back to for
anything it had not overridden — so a board handed to another vault arrived
wearing *that* vault's grid, card opacity, wallpaper and search placeholder. And
the two exports Hearth had before this both described a whole vault and replaced
one wholesale, which is not a thing you can safely do with a stranger's file.

A `dashboard` package fixes both: it states its own look, and importing it adds
a board without touching a single global setting.

## Shape

```jsonc
{
  "hearth": {
    "format": 3,              // PACKAGE_FORMAT
    "kind": "dashboard",      // "dashboard" | "layout" | "settings"
    "plugin": "3.1.0",        // Hearth version that wrote it (optional)
    "createdAt": "2026-09-02T18:00:00.000Z"
  },
  "meta": {                   // all optional; a gallery listing's fields
    "name": "Reading room",
    "description": "…",
    "author": "…",
    "tags": ["reading", "minimal"],
    "version": "2"
  },
  "capture": {                // recorded, never applied
    "platform": "desktop",
    "performanceTier": "full",
    "locale": "en"
  },
  "requires": {               // advisory; a gap is a warning, never a refusal
    "plugins": ["dataview"],
    "cardKinds": ["dataview", "clock"],
    "viewTypes": ["kanban"],
    "settings": ["taskFieldsEnabled"]
  },
  "assets": [                 // optional; see Pictures
    { "id": "a1", "name": "wall.png", "mime": "image/png",
      "bytes": 812345, "data": "<base64>", "from": "Attachments/wall.png" }
  ],
  "payload": { /* one of the three below */ }
}
```

### `kind: "dashboard"`

```jsonc
"payload": {
  "dashboard": { /* a Dashboard, with its look resolved onto it */ },
  "pinnedCards": [ /* optional */ ],
  "favorites":   [ /* optional */ ]
}
```

### `kind: "layout"` and `kind: "settings"`

The payload is exactly what Hearth's pre-v3 layout (`hearthLayout: 2`) and
settings (`hearthSettings: 1`) exports wrote, unchanged, so both apply through
the same sanitizers they always did.

### Reading older files

`readPackage()` also accepts the three pre-v3 shapes and wraps them in an
envelope, so a consumer only ever handles one format:

| File | Recognised by |
| --- | --- |
| v3 package | a `hearth` object |
| settings export | `hearthSettings: 1` |
| layout export | `hearthLayout: 2`, or a `dashboards` array |
| v1 layout export | a bare `cards` array (it had no marker) |

## What "the look travels" means

Building a `dashboard` package resolves every look-affecting setting onto the
board itself — grid and row height, fit-to-page, content width, compact
spacing, the four card-surface settings, the background and how the board wears
it, the whole title block, the search row, the filter chips, narrow-pane
stacking and the two chrome visibilities.

Two properties of how that is done matter to anyone building on this:

- **It goes through Hearth's own `effective*()` readers**, against a snapshot
  whose active board is the one being exported — not through a second copy of
  the fallback rules. The plugin-board special cases (a hosted view hides its
  title and fills the pane unless told otherwise) therefore come across
  correctly, and there is no parallel truth to drift.
- **The snapshot is tier-neutralised.** Hearth's performance tier overrides the
  frosted glass and the wallpaper *at read time* without changing what is
  stored, so capturing what the readers say on a phone at `balanced` would bake
  "no blur, flat grey backdrop" into the file permanently. Capture pins the tier
  to `full` before asking. The tier the author was really on is recorded in
  `capture.performanceTier` and **never applied on import** — a shared board
  must not force expensive rendering onto someone else's hardware.

`captureDashboard(s, dash, { flatten: false })` opts out, for a board that
should adapt to wherever it lands instead.

## Pictures

A wallpaper is a file in the author's vault, and a path to it means nothing in
anyone else's. Embedding is a separate, opt-in step (`embedAssets()`):

- each referenced image is stored once in `assets` as base64, and the references
  that pointed at the author's vault path become `hearth:asset/<id>`;
- **that scheme exists only inside a package.** Import writes the bytes into the
  importing vault and rewrites the references to the real paths they landed at,
  so nothing downstream ever sees it;
- allowlisted types only: PNG, JPEG, GIF, WebP, BMP, AVIF. **SVG is excluded** —
  it is a document that can carry script and reference remote resources, and
  these files are written into someone else's vault;
- caps are 4 MiB per asset and 16 MiB per package. On import the *encoded*
  length is checked before decoding, because `bytes` is a number the file
  supplies;
- anything too large, of the wrong type, or no longer in the vault is left as a
  bare path and reported rather than silently dropped.

## Importing

`applyPackage(settings, pkg, { mode })` — always through the sanitizers in
`src/layout.ts`, so a hostile file can only ever set values the settings UI
itself could produce.

| Mode | What it does |
| --- | --- |
| `add` (default) | A new board: keeps the package's board id when free, a name that doesn't collide, **no global setting touched**. |
| `replaceBoard` | Overwrites one board **in place, keeping its id**, so its workspace link, hosted-view cache and scroll memory survive an update. |
| `replaceAll` | The restore path. `layout` and `settings` packages only. |

Because `add` keeps the package's board id when the vault has nothing under it,
`existingBoardFor()` can find the board a previous import created — which is how
"there's a new version of that board" updates one board instead of leaving two.

Three things a board is never allowed to claim in someone else's vault: the
mobile-default flag, a linked workspace, and (on `add`) an id that is already
taken. Pinned cards and the favourites list are *carried* but not applied unless
the importer asks, because both are vault-wide and would change boards they
never looked at.

An import returns an `ImportResult`, not a pass/fail. Warning codes:
`missingPath`, `missingPlugin`, `unknownCardKind`, `unknownViewType`,
`assetSkipped`, `assetMissing`, `settingRequired`, `notApplied`, `formatNewer`.
None of them stops an import: a downloaded board routinely mentions notes the
importer hasn't got, and that is worth *saying* rather than showing as a card
that renders nothing.

The one thing a board cannot carry is Hearth's `taskFieldsEnabled` master
switch, which gates every tasks card's custom field list. Capture folds the
resolved field list onto each card and records the requirement in
`requires.settings`; the importer is told to turn the switch on, and no global is
flipped on their behalf.

## The gallery hand-off

**A local export deliberately contains the author's vault paths.** That is not
an oversight — the author's own copy has to keep working. The paths come off
when the package is *published*:

```ts
import { stripReferences, residualPaths } from "src/portable";

const report = stripReferences(pkg);   // paths + private + content
// report.removed  → counts per scope
// report.residual → anything still path-shaped. Non-empty = hold for review.
```

`src/portable/refs.ts` holds the one table of every field that points outside
the package, classified by scope:

| Scope | What it is | Stripped by |
| --- | --- | --- |
| `vaultPath` | a note, folder or attachment in the author's vault; also the workspace link | `paths` |
| `asset` | a vault path to an image (an embedded one is already an id) | `paths` |
| `privateUrl` | a URL that is effectively a credential — a private ICS feed | `private` |
| `privateHost` | a host only reachable inside the author's network | `private` |
| `place` | the author's location, from a weather card or sky background | `private` |
| `publicUrl` | a public page or feed the board embeds | *kept* |
| `commandId`, `viewType` | names a plugin, not the author | `plugins` (off) |
| `userQuery` | a search/Dataview/Datacore query, or a frontmatter property a card reads | `queries` (off) |
| `userContent` | the author's own prose or working state | `content` |

`paths` also drops each embedded asset's `from`: the picture stays, the folder
it lived in does not.

Everything about a board's *appearance* survives a strip, because none of it
lives in a path — the wallpaper travels as an embedded asset, not as the path it
came from. Cards that pointed at notes come through with nothing selected, which
is what the person downloading the board has to fill in anyway.

The table is a **denylist**, so a gap in it means a value travels that perhaps
shouldn't. `residualPaths()` is the backstop: after a strip it sweeps whatever
is left for strings that still look like vault paths or calendar feeds and
reports where it found them. It is a heuristic — treat a non-empty result as
"hold this for review", since a false positive costs a look and a false negative
publishes someone's folder tree.

**When you add a card kind whose config names a note, folder, attachment,
private URL, command or view type, add a rule for it to that table.** A gap
there is a value published that perhaps shouldn't be — and the backstop cannot
see every shape. A heatmap rule comparing against a bare folder name
(`Private/Therapy`, no extension) is the case that proves it: no rule matched it
and `residualPaths()` could not recognise it either.

### One thing the strip does not cover

A board can name things on the web — an embedded page, an RSS feed, a wallpaper
given as a URL. Those are `publicUrl` and travel by design, because they are
what the board *is*. But a board opened from a stranger will fetch them, and
Hearth's **Disable external calls** setting does not currently cover a
background image or a title icon given by URL (it covers live-content cards and
the currency fetch — see its own documentation). Hearth's import dialog says how
many remote things a package loads; a gallery should surface the same, and may
want to strip or proxy `publicUrl` itself.

### A suggested upload pipeline

1. `readPackage(json)` — reject anything that isn't a package.
2. Reject `hearth.kind !== "dashboard"`: a gallery entry is one board.
3. `stripReferences(pkg)` — the default takes paths, private references and
   the author's own prose. Pass `{ content: false }` only for a board whose text
   really is part of the design.
4. Hold for review if `report.residual` is non-empty.
5. Re-check `assets`: type against the allowlist, `bytes` against the decoded
   length, and the total against your own budget.
6. Index `meta`, `requires` and `describeReferences(pkg)` for the listing;
   `capture.performanceTier` is worth showing as "captured on a low-power
   device".

## Credentials

Every export path runs `scrubCard()` from `src/layout.ts`, which removes a Jira
card's personal access token. It is one exported function precisely so a new
export path cannot forget it — if you add a field that holds a credential, add
it there.

`lastSeenVersion` and `setupStatus` are deliberately never exported, so a shared
file cannot rewind another vault's "What's new" state or re-offer its setup
wizard. Every other setting travels in a `settings` package, and a test checks
the export against the settings list so the next one added cannot slip through.
