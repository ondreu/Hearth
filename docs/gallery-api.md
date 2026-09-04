# The Hearth gallery API

The wire contract between Hearth and a dashboard gallery. The client half is
`src/gallery/`; a working server is in `server/`, and
[`gallery-hosting.md`](gallery-hosting.md) is how to run it.

This document is the contract, not a description of that implementation. A
different server that answers these routes the same way is a gallery Hearth can
use, and `server/test/smoke.ts` is a conformance suite you can point at one.

## The shape of it

- One version prefix: everything is under `/v1`.
- JSON in, JSON out, UTF-8, no envelope — a route's response *is* its object.
- Errors are `{ "error": "a sentence" }` with a meaningful status. The status
  decides how Hearth phrases it; the sentence is shown verbatim only for `422`.
- No CORS headers, and that is deliberate. Hearth talks to a gallery through
  Obsidian's `requestUrl`, which is not a browser fetch and is not subject to
  CORS — so a gallery has no reason to open itself to arbitrary web pages, and
  every reason not to.
- `https` only, except that Hearth accepts plain `http` on a loopback address so
  a gallery you are running locally can be tried without a certificate.

### Status codes Hearth understands

| Status | Means | What Hearth says |
| --- | --- | --- |
| `400` | malformed request | a generic problem |
| `401` / `403` | not signed in, or not yours | "didn't accept this vault's identity", and the held token is dropped |
| `404` | no such thing | "the gallery doesn't have that" |
| `413` | body too large | "too large for this gallery" |
| `422` | the *content* was refused | **the server's own sentence**, verbatim |
| `429` | rate limited | "asking you to slow down" |
| `5xx` | the server's problem | a generic problem |

`422` is the only status whose message reaches the reader unchanged, so it is
the only one worth writing carefully: it is for things the person publishing can
act on ("the package is not signed", "still names 6 things from its author's
vault"). Everything else is phrased by the client, because a 500's body is not
an error message.

## Identity

There are no accounts and no passwords. An identity is an ed25519 key pair that
lives in a vault and never leaves it (`src/identity.ts`); the public half and
the handle derived from it are the whole public identity.

**Never accept a private key, in any form, on any route.** A gallery with a
field for one teaches people to paste their signing key into whatever page asks,
and one phishing page then publishes as anyone, permanently.

**Derive the handle; never store it.** `handleFromPublicKey(key)` is a pure
function of the key, so a stored copy is a second truth that can be wrong.
Servers should return it in responses for convenience, and Hearth recomputes
nothing but does hold it to the shape the derivation produces —
`word-word-suffix` — so a gallery that returns a name somebody typed has its
authors dropped rather than displayed.

### `POST /v1/auth/challenge`

```jsonc
→ { "publicKey": "9e75…f18f" }
← { "nonce": "…64 hex…", "expiresIn": 300 }
```

Cheap and commits nothing, so rate-limit it as an ordinary write.

### `POST /v1/auth/token`

```jsonc
→ { "publicKey": "9e75…f18f", "nonce": "…", "signature": "…128 hex…" }
← { "token": "…", "expiresIn": 86400, "handle": "quiet-lantern-4kj2m8" }
```

The signature is over the nonce as UTF-8 (`signMessage(key, nonce)`). **Spend
the nonce whether or not the signature verifies** — a nonce that survives a
failed attempt is not a nonce.

The token is a bearer token: `Authorization: Bearer <token>`.

## Reading

None of these needs a token. All of them accept one, and use it only to fill in
`myVote`.

### `GET /v1/info`

```jsonc
{
  "name": "A Hearth gallery",
  "api": 1,                       // Hearth requires exactly 1
  "limits": {
    "maxPackageBytes": 16777216,
    "maxNameLength": 80,
    "maxDescriptionLength": 600,
    "maxTags": 8,
    "uploadsPerDay": 10
  },
  "termsUrl": "https://…"         // optional
}
```

### `GET /v1/categories`

`[{ "id": "writing", "count": 12 }, …]` — the taxonomy this host files boards
under, with how many are in each. The ids are the closed list in
`src/gallery/categories.ts`. **They are stored inside published packages, so the
list is append-only**: a name may be reworded, an id may never be.

### `GET /v1/entries`

| Query | |
| --- | --- |
| `q` | free text; matched against name, description and tags |
| `category` | one category id; an unknown one is ignored, not an error |
| `author` | a public key, lower-case hex |
| `sort` | `trending` (default), `top`, `new`, `downloads` |
| `page` | 1-based |
| `perPage` | 1–60, default 24 |

```jsonc
{ "entries": [ /* summaries */ ], "total": 42, "page": 1, "perPage": 24 }
```

An **entry summary**:

```jsonc
{
  "id": "FwYjb9o0NSy6",
  "name": "Reading room",
  "description": "…",
  "category": "writing",
  "tags": ["minimal", "dark"],
  "author": { "publicKey": "9e75…f18f", "handle": "quiet-lantern-4kj2m8" },
  "score": 12,                    // ups minus downs; may be negative
  "upvotes": 14,
  "downvotes": 2,
  "downloads": 310,
  "publishedAt": "2026-09-01T10:00:00.000Z",
  "updatedAt":   "2026-09-03T08:12:00.000Z",
  "myVote": 1,                    // 1 | 0 | -1, for the bearer of the token
  "preview": { /* see below */ },
  "pluginVersion": "3.1.0",
  "hasWallpaper": true
}
```

`score` is taken as sent rather than recomputed from the two tallies, so a
gallery is free to weight or age it — but a `score` that disagrees with the
order rows arrived in is a list that looks broken, so keep them consistent.

### The preview

A board reduced to something a listing can draw, and the one field with rules
about *what it may contain*:

```jsonc
{
  "columns": 12,
  "rows": 5,
  "tiles": [{ "x": 0, "y": 0, "w": 4, "h": 2, "kind": "clock" }],
  "background": { "kind": "color", "color": "#1e1e2e", "hasImage": false },
  "radius": 8,
  "opacity": 0.9,
  "pluginBoard": false,
  "truncated": 0
}
```

**Derive it from the package with `previewFromPackage()`; never accept one from
the uploader.** A preview supplied alongside a file is a listing advertising a
board it may not be.

It is data rather than a picture on purpose. A screenshot is of somebody else's
vault in somebody else's theme; a rendered thumbnail means running Hearth
headless; and SVG from a server is markup from a stranger — which the package
format already refuses to embed for exactly that reason, so injecting it into
the modal that lists packages would be odd. Hearth re-clamps every number on
arrival and drops a `kind` that isn't shaped like one, so a gallery serving
nonsense produces a small odd thumbnail rather than a broken modal.

### `GET /v1/entries/:id`

The summary, plus:

```jsonc
{
  "cards": [{ "kind": "tasks", "count": 2 }],   // derived, not supplied
  "requires": { "plugins": [], "cardKinds": [], "viewTypes": [], "settings": [] },
  "version": "2",                                // the author's own, if any
  "remoteRefs": 2,                               // things fetched from the internet
  "sizeBytes": 48213
}
```

### `GET /v1/entries/:id/package`

The package file, `application/json`. **Serve the bytes exactly as they were
uploaded** — see [Publishing](#publishing).

Count a download here, deduplicated per address per day. A counter anybody can
run up in a loop is not a number worth sorting by.

### `GET /v1/entries/:id/wallpaper`

The board's own embedded wallpaper as an image, so a listing can show the real
picture without pulling a 12 MB package per row. **Raster types only** — the
format's allowlist (PNG, JPEG, GIF, WebP, BMP, AVIF) and never SVG. `404` when
the board has none.

### `GET /v1/authors/:publicKey`

```jsonc
{
  "author": { "publicKey": "9e75…f18f", "handle": "quiet-lantern-4kj2m8" },
  "entries": [ /* summaries */ ],
  "totalScore": 96, "totalUpvotes": 104, "totalDownvotes": 8,
  "totalDownloads": 2431,
  "firstSeenAt": "2026-06-02T11:00:00.000Z"
}
```

A profile exists as soon as a key has been seen — there is no registration step,
and no way to reserve a handle you don't hold the key for.

## Publishing

### `POST /v1/entries` (token required)

```jsonc
→ { "package": "{…the file, as a string…}" }
← { "id": "FwYjb9o0NSy6", "updated": false, "held": false }
```

The pipeline, in order, and every step is a refusal rather than a repair:

1. **Read it.** `readPackage()`. Anything else is not a package.
2. **Verify the signature, before anything mutates anything.**
   `verifyPackageSignature()` must return `valid`. `unsigned` and `invalid` are
   equally not evidence of who made it.
3. **`hearth.kind` must be `dashboard`.** A gallery entry is one board.
4. **Check the strip — don't perform one.** `describeReferences()` must find
   nothing in `vaultPath`, `asset`, `privateUrl`, `privateHost` or `place`.
   Hearth's publish path always strips before signing, so a well-behaved client
   never sees this; a client that skipped it gets told, which is better than a
   gallery that silently launders bad uploads.
5. **Re-check the assets.** MIME against the allowlist, *encoded* length before
   decoding anything (`bytes` is a number the file supplies), total against your
   budget.
6. **Hold, don't refuse, on a residual.** `residualPaths()` is a heuristic
   backstop for gaps in the reference table. A non-empty result means store the
   entry, keep it out of the listing, and answer `"held": true`.
7. **Derive the listing** — preview, card counts, requirements, remote
   references — from the package.
8. **Store the file unchanged.**

### Why nothing edits the package

[`dashboard-package.md`](dashboard-package.md) sketches a pipeline in which the
gallery strips the package and overwrites `meta.id` with its own entry id. Both
are edits, and the signature covers the whole document — so a gallery that does
either serves a file whose signature no longer verifies. The importing vault
then reads every downloaded board as **invalid**, which is not "unattributed":
it is the state a forged file produces, reported as an alarm, on every
legitimate board in the gallery.

So: store and serve the bytes as uploaded, and check the strip instead of
performing one.

That leaves one hazard the sketch was trying to solve. Somebody installs a
board, changes it, republishes — and their fork still carries the original's
`meta.id`, so an importer holding the original would be offered the fork as an
update to it. Close it by making **`meta.id` unique across the gallery**, not
per author: refuse an id already held by a different key, and say what to do
about it. Duplicating a board does not inherit `sourceId`, so a duplicate is how
a fork gets an identity of its own.

Matching an upload's `meta.id` to an existing entry **by the same author** is how
"here is the new version" works: update in place, keep the entry id, answer
`"updated": true`.

### `DELETE /v1/entries/:id` (token required)

Withdraws the caller's own entry. `204`.

Mark it rather than deleting the row: an id that can be reused is an id that can
be made to point at a different board than the one somebody installed. People
who already installed it keep their copy — nothing about publishing is
retractable from other people's vaults, and Hearth says so before you publish.

## Voting

### `POST /v1/entries/:id/vote` (token required)

```jsonc
→ { "value": 1 }                  // 1 | 0 | -1; 0 clears
← { "score": 13, "upvotes": 15, "downvotes": 2, "myVote": 1 }
```

One vote per key per entry, changeable and clearable.

**This is not Sybil-resistant and cannot be made so on this side of the wire.**
Keys are free to mint, so identities are free to mint, so votes are free to
mint. What a gallery can do is make it tedious — per-key *and* per-address
limits, since only the second costs an attacker anything — and, if it comes to
it, refuse votes from keys younger than some age. Say this in your terms rather
than implying a robustness the mechanism doesn't have.

## Comments

Flat, newest first, one body of text each, no threading and no editing. A
board's comments are "does this need Dataview 0.5" and "the third card wants a
folder set" — remarks, not a discussion, and threading them means building a
forum.

A comment body is the **only free prose in this API that somebody other than the
board's own author wrote**. Store it as typed, serve it as typed, and never
interpret it: Hearth renders it into a text node. Cap it on the way in — 1000
characters, which is the figure both sides use — so a megabyte of it cannot be
stored in the first place.

### `GET /v1/entries/:id/comments`

`?page=` — 50 per page.

```jsonc
{
  "comments": [{
    "id": "kAq2…",
    "body": "Does this need Dataview 0.5?",
    "createdAt": "2026-09-04T09:00:00.000Z",
    "author": { "publicKey": "9e75…f18f", "handle": "quiet-lantern-4kj2m8" }
  }],
  "total": 12, "page": 1, "perPage": 50
}
```

### `POST /v1/entries/:id/comments` (token required)

`{ "body": "…" }` → the comment as stored. Trim it, collapse runs of three or
more newlines to two (a wall of blank lines is how one comment fills a page),
and refuse an empty one with `400`.

### `DELETE /v1/comments/:id` (token required)

Allowed for **the comment's author and for the owner of the entry it sits on**.
That second one is the whole of moderation for a gallery with no admin
interface, and it is in the right hands: somebody publishing a board can clear
something off it without waiting for whoever runs the server.

Mark it removed and clear the body rather than dropping the row, so an id is
never reused.

## Rate limiting

Applied per address and per key, and per address *first* — a limit that only
counts keys is a limit anybody gets around by minting one. Answer `429`; Hearth
tells the reader to try again in a few minutes and does not retry on its own.

Read `X-Forwarded-For` only when a proxy you control is in front of the server.
On a directly exposed one, every client sets that header itself.
