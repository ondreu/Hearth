# The Hearth dashboard package format

A **package** is a JSON file describing one dashboard, one whole layout, or one
vault's settings. It is what Hearth's Import / export produces, and it is the
unit a dashboard gallery would store, list and serve.

This document is the contract. The implementation is `src/portable/`, and
`test/portable.test.ts` is the executable version of everything below.

For the gallery this format was shaped for: [`gallery-api.md`](gallery-api.md)
is the wire contract, [`gallery-hosting.md`](gallery-hosting.md) is how to run
one, and [ondreu/hearth-gallery](https://github.com/ondreu/hearth-gallery) is a working implementation.

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
    "id": "hd-8f2k1x9qa03b",  // this dashboard as a published work — see Identity
    "name": "Reading room",
    "description": "…",
    "tags": ["reading", "minimal"],
    "category": "writing",    // one of src/gallery/categories.ts — see below
    "version": "2",

    // Authorship — see Who made it. The handle is derived from the key and the
    // signature proves the key's holder made this file; neither the name nor
    // the key is taken on trust.
    "authorPublicKey": "ae4429fc…3ae7",   // ed25519 public key, hex
    "author": "quiet-lantern-4kj2m8",     // derived; recompute, don't read
    "signature": "9f31…c0a2"              // ed25519 over the canonical package
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

  // Pre-3.1 only. Still read (folded onto the board on import), never written.
  "pinnedCards": [ /* … */ ],
  "favorites":   [ /* … */ ]
}
```

The board is the whole payload. Two things that used to sit beside it are now
folded onto it at capture, because neither is a thing a dashboard shows
separately:

- **Pinned cards** are rendered in the same grid as the board's own, at their
  own coordinates, and nothing on screen says which list a card came from. They
  travel as ordinary cards on the board, with `pinned` cleared — so the board
  looks like its author's without an import pinning a stranger's cards onto
  every board in the importing vault.
- **The favourites list** (the note paths a `favorites` card shows) is
  vault-wide, so a favourites card exported alone arrives empty or showing the
  importer's notes. Capture writes the resolved list onto each favourites card
  as `DashboardCard.favorites`, the same move `taskFields` makes. An author with
  no favourites folds nothing, leaving the card inheriting.

A pre-3.1 package carrying either beside the board gets the same fold applied on
the way in (`adoptLegacyExtras`).

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
| `add` (default) | A new board: a fresh board id, a name that doesn't collide, **no global setting touched**. |
| `replaceBoard` | Overwrites one board **in place, keeping its id**, so its workspace link, hosted-view cache and scroll memory survive an update. |
| `replaceAll` | The restore path. `layout` and `settings` packages only. |

Three things a board is never allowed to claim in someone else's vault: the
mobile-default flag, a linked workspace, and its own board id — `add` always
mints a fresh one, so a package cannot pick which of the importer's boards it
lands on. Nothing vault-wide is written either: what the author had pinned and
what their favourites card was showing arrive **on the board**, so no other
board in the importing vault changes.

## Identity

Two different questions, and conflating them was the first version's mistake:

| Field | Answers | Scope |
| --- | --- | --- |
| `Dashboard.id` | which board is this **in this vault**? | one vault; minted fresh on every import |
| `meta.id` ⇄ `Dashboard.sourceId` | which **published dashboard** is this a copy of? | stable across vaults and across versions |

`existingBoardFor()` matches on the second, which is what makes "here's the
updated version of that board" update the board it created instead of landing
beside it. Matching on the *board* id gets the interesting case wrong: in a
gallery, someone downloading a board, changing it and republishing it is normal,
and their board still carries the original's id — so their variant would have
been offered as an update to the original.

Where the value comes from:

- **Hearth mints one when a board is first exported**, and records it on the
  board, so the author's next export of that board carries the same value.
- **On import** it is recorded on the board that is created, as `sourceId`.
- **A duplicated board does not inherit it** — a copy is a new board, not
  another instance of the same published work.
- **A package with no `meta.id` always reads as new.** That is the safe way
  round, and it is what a hand-written package gets.

**A gallery must keep `meta.id` unique across itself**, refusing an id already
held by a different author key. It cannot overwrite the id with one of its own —
that would invalidate the signature it had just checked (see **The upload
pipeline**) — and it cannot tell a new *version* of a dashboard from somebody's
*fork* of it by looking at the file, because an import carries whatever identity
it is given, faithfully and without judgement. Uniqueness turns the ambiguous
case into a refusal the author can act on: duplicate the board, which mints a
fresh `sourceId`, and publish that.

### What it is for

`meta.category` is the one thing about a published dashboard that cannot be
derived from it. Its card kinds are already in `requires`, its tags are free
text, and neither says whether this is a study board or a work one — only its
author knows. So it is asked once, at publish, from the closed list in
`src/gallery/categories.ts`.

**That list is append-only.** An id is stored in a gallery's database and inside
every published copy of the package, so renaming one orphans every entry filed
under it. Add to the end; never reorder, never remove. A package with no
category, or one this build has never heard of, reads as `other` rather than
being guessed at.

An import returns an `ImportResult`, not a pass/fail. Warning codes:
`missingPath`, `missingPlugin`, `unknownCardKind`, `unknownViewType`,
`assetSkipped`, `assetMissing`, `settingRequired`, `formatNewer`.
None of them stops an import: a downloaded board routinely mentions notes the
importer hasn't got, and that is worth *saying* rather than showing as a card
that renders nothing.

The one thing a board cannot carry is Hearth's `taskFieldsEnabled` master
switch, which gates every tasks card's custom field list. Capture folds the
resolved field list onto each card and records the requirement in
`requires.settings`; the importer is told to turn the switch on, and no global is
flipped on their behalf.

## Who made it

`meta.author` is **not** a name somebody typed, and a reader must not treat it
as one. Hearth mints one secret per vault — a **recovery key**, which never
leaves it — and everything else follows from it (`src/identity.ts`):

```
  recovery key   HEARTH-4KJ2M-8XQP7-R3TWD-N6VBZ   private, never exported
         │  sha-256 → a 32-byte seed
         ▼
  signing key    (ed25519 private)                private, never exported
         │
         ▼
  meta.authorPublicKey                            travels, as machinery
         │  sha-256 → two words and a suffix
         ▼
  meta.author    quiet-lantern-4kj2m8             the one public identity
```

Three properties, and they are worth keeping apart because they are easy to
conflate — deriving a handle from a key gives you only the first of them:

| Property | Means | Comes from |
| --- | --- | --- |
| **Stable** | the same key always gives the same handle, in any vault | the derivation |
| **Unique** | two people do not end up sharing a handle | the handle's width |
| **Unforgeable** | nobody can publish under a handle they don't hold | the signature |

**Stable.** Everything public is derived, so the key is the only thing worth
keeping. Pasted into a fresh vault, the same handle comes back — no account, and
nothing held anywhere else. `authorKey` is excluded from every export, backups
included: a settings backup is a thing people hand each other, and a key in one
is an identity given away.

**Unique.** Determinism does *not* give this. A handle smaller than the key it
comes from must collide eventually, and two words drawn from lists of 64 would
have meant a better-than-even chance of some pair of users colliding at about
7,500 of them. So the handle carries its own entropy: 256 adjectives, 256 nouns
and a six-symbol Crockford-base32 suffix — 46 bits, which puts a collision past
nine million users. It is the whole public identity; there is no separate id
beside it. **Never reorder or remove a word from either list** — a word's index
is part of somebody's handle.

**Unforgeable.** This is what the keypair is for, and hashing cannot substitute.
A package is a static file, so any proof it carries its reader now has: "prove
you know the secret" has no answer that consists of writing the secret down. A
signature does have one. `verifyPackageSignature(pkg)` returns `valid`,
`unsigned` or `invalid`, and `packageAuthor(pkg)` returns a handle **only** for
`valid` — an unsigned package and one whose signature fails are equally not
evidence of who made it.

### What the signature covers

Everything except two fields: `meta.signature`, which cannot sign itself, and
`meta.author`, which a reader derives rather than reads. The subject is built
field by field in `signedBytes()` rather than by copying the package, so it
matches exactly what `readPackage()` reconstructs — otherwise a package from a
newer Hearth carrying an envelope field this build discards would fail
verification and be reported as a forgery. **Add a field to the format, add it
there too, or it travels unsigned.**

Bytes are canonicalised (keys in code-unit order, no whitespace, arrays left
alone, `undefined` dropped) so a package that has been parsed and rebuilt hashes
the same as the one that was signed.

`signPackage()` must therefore be the **last** step of an export — after
embedding pictures and after any strip.

### Using the same key for a gallery account

The recovery key signs packages, but nothing about it is package-specific: it is
an ed25519 private key, so the same key answers "is this request from the holder
of that handle?" through an ordinary challenge-response.

```ts
// Gallery → client: a random nonce, once per sign-in.
// Client (inside Hearth):
import { signMessage } from "src/identity";
const proof = signMessage(settings.authorKey, nonce);
// Gallery: verifyMessage(storedPublicKey, nonce, proof)
```

That gives accounts, comments and per-author pages with no passwords stored
anywhere: a breach of the gallery leaks public keys, which are public. And a
profile exists before anyone signs up — a public key appears the moment somebody
uploads a board signed with it, and its owner claims the page later by answering
a challenge. There is no registration step to build.

Three constraints that come with it, all of them cheaper to honour now than to
retrofit:

- **Never ask for the key.** Signing happens inside Hearth and only the
  signature crosses the wire. A gallery that accepts a pasted key in a web form
  teaches users to hand their signing key to whatever page asks — and one
  phishing page then publishes as anyone, permanently. The key has no reason to
  leave the vault and no interface should offer it a way out.
- **Reputation is not Sybil-resistant.** Keys are free to mint, so handles are
  free to mint, so votes are free to mint. Nothing in this format can fix that;
  it has to be priced elsewhere (an account that has published something, age,
  rate limits) or designed around.
- **Show the whole handle.** `polished-yarrow-n5tjd6` and
  `polished-yarrow-n5tjd5` read identically to anyone skimming, and the suffix
  is the part nobody reads. Truncating to the words makes impersonation a matter
  of minting keys until two words match.

### What it does not give you

- **Not an introduction.** A verifier learns "the same hand made this and that",
  not "this is Ondřej". That is trust on first use, like an SSH key. Binding a
  handle to a person needs someone to vouch, which is a gallery's job.
- **Not permanence through any gallery that edits the file.** A strip is an
  edit, and so is rewriting `meta.id`; either invalidates the signature it just
  checked. That is why the pipeline above does neither — a gallery that stores
  and serves the uploaded bytes unchanged keeps end-to-end verification, which
  is what lets the vault installing a board name its author rather than being
  told the file is forged.
- **Not a bar on redistribution.** Copying a signed file unchanged verifies, and
  must — the file really was made by the author it names. What is prevented is
  putting an author's name on a board they did not make.

## The gallery hand-off

**A local export deliberately contains the author's vault paths.** That is not
an oversight — the author's own copy has to keep working. The paths come off
when the package is *published*:

```ts
import { previewStrip, stripReferences, residualPaths } from "src/portable";

const report = stripReferences(pkg);   // paths + private + content
// report.removed  → counts per scope
// report.residual → anything still path-shaped. Non-empty = hold for review.

previewStrip(pkg, { paths: true });    // the same walk, listing the values and
                                       // changing nothing
```

The export dialog runs the same strip: **Leave out my private information** is
`{ paths, private, content }`, and its details section lists what each group
will remove — through `previewStrip()`, so what it shows is what the strip does
rather than a second description of it.

`src/portable/refs.ts` holds the one table of every field that points outside
the package, classified by scope:

| Scope | What it is | Stripped by |
| --- | --- | --- |
| `vaultPath` | a note, folder or attachment in the author's vault; also the workspace link | `paths` |
| `asset` | a vault path to an image (an embedded one is already an id) | `paths` |
| `privateUrl` | a URL that is effectively a credential — a private ICS feed | `private` |
| `privateHost` | a host only reachable inside the author's network | `private` |
| `place` | the author's location, from a weather card or sky background | `private` |
| `publicUrl` | a public page or feed the board **fetches** — an embedded page, an RSS source, a wallpaper by URL | *kept* |
| `linkUrl` | a URL the board **links to** — a launchpad tile, a mobile action button | *kept* |
| `commandId`, `viewType` | names a plugin, not the author | `plugins` (off) |
| `userQuery` | a search/Dataview/Datacore query, or a frontmatter property a card reads | `queries` (off) |
| `userContent` | the author's own prose or working state | `content` |

`vaultPath` includes a favourites card's own list, which is a list of the
author's notes.

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

`publicUrl` and `linkUrl` are kept apart because "how much of this board is
loaded from the internet" is a fair question to ask of a stranger's dashboard,
and a button that opens a page when pressed is not an answer to it. Only
`publicUrl` is counted when a gallery or the import dialog reports that.

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
what stops that is the reader's own **Disable external calls** setting: since
#281 it covers a background image and a title icon given by URL as well as the
live-content cards and the currency fetch, so a beacon wallpaper on an imported
board is not fetched by a vault that has the switch on. With the switch off — the
default — every `publicUrl` on the board is still fetched the moment it opens.
Hearth's import dialog says how many remote things a package loads; a gallery
should surface the same, and may want to strip or proxy `publicUrl` itself.

### The upload pipeline

There is a working gallery in [ondreu/hearth-gallery](https://github.com/ondreu/hearth-gallery), and its pipeline is
the reference
version of this — `docs/gallery-api.md` is the contract, its `src/upload.ts`
is the implementation:

1. `readPackage(json)` — reject anything that isn't a package.
2. `verifyPackageSignature(pkg)` — **before anything else touches it.** `valid`
   means the uploader holds the key behind `meta.authorPublicKey`; `unsigned`
   and `invalid` are equally not evidence of who made it, and both should be
   refused.
3. Reject `hearth.kind !== "dashboard"`: a gallery entry is one board.
4. **Check the strip; do not perform one.** `describeReferences(pkg)` must find
   nothing under `vaultPath`, `asset`, `privateUrl`, `privateHost` or `place`.
   Hearth's publish path strips before it signs, so a well-behaved client never
   trips this.
5. Hold for review if `residualPaths(pkg)` is non-empty — store the entry, keep
   it out of the listing. It is a heuristic backstop, and a false positive costs
   a look while a false negative publishes somebody's folder tree.
6. Re-check `assets`: type against the allowlist, the *encoded* length before
   decoding anything, and the total against your own budget.
7. Derive the listing — `meta`, `requires`, `describeReferences(pkg)`,
   `cardCountsFromPackage(pkg)` — **from the package**, never from fields
   supplied beside it. `capture.performanceTier` is worth showing as "captured on a
   low-power device".
8. Store the file **unchanged**, and serve it back unchanged.

### Why steps 4 and 8 differ from the obvious version

The obvious pipeline has the gallery strip the package itself and overwrite
`meta.id` with its own entry id. Both are edits, and the signature covers the
whole document — so a gallery that does either serves a file whose signature no
longer verifies. The importing vault then reads every downloaded board as
`invalid`, which is not "unattributed": it is the state a forged file produces,
reported to the reader as an alarm, on every legitimate board in the gallery.
Verification would become an upload-time proof that nobody downstream can ever
repeat, which is most of the reason the keypair exists.

Leaving `meta.id` alone leaves one hazard: somebody installs a board, changes
it, republishes, and their fork still carries the original's id — so an importer
holding the original would be offered the fork as an update to it. Close it by
making **`meta.id` unique across the gallery** rather than per author: refuse an
id already held by a different key, and say what to do about it. A duplicated
board does not inherit `sourceId`, so duplicating is how a fork gets an identity
of its own.

## Credentials

Every export path runs `scrubCard()` from `src/layout.ts`, which removes a Jira
card's personal access token. It is one exported function precisely so a new
export path cannot forget it — if you add a field that holds a credential, add
it there.

`lastSeenVersion`, `setupStatus` and `authorKey` are deliberately never exported, so a shared
file cannot rewind another vault's "What's new" state or re-offer its setup
wizard. Every other setting travels in a `settings` package, and a test checks
the export against the settings list so the next one added cannot slip through.
