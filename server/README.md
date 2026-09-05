# The Hearth gallery server

A self-hosted catalogue of Hearth dashboard packages: browse, install, publish,
vote.

- **[How to run one](../docs/gallery-hosting.md)** — start here.
- **[The wire contract](../docs/gallery-api.md)** — what the routes are, and
  what a different implementation would have to honour.
- **[The package format](../docs/dashboard-package.md)** — what it is a
  catalogue of.

```sh
docker compose -f server/docker-compose.yml up -d --build   # from the repo root
curl http://localhost:8787/v1/info
```

## What is here

| | |
| --- | --- |
| `src/index.ts` | the routes. Start reading here. |
| `src/upload.ts` | what a gallery will accept, and why it never edits a package. |
| `src/entries.ts` | listing, detail, publish, withdraw, download. |
| `src/votes.ts` | voting, and an honest note about what it isn't. |
| `src/comments.ts` | remarks on an entry, and who may remove one. |
| `src/auth.ts` | challenge-response against an ed25519 key. No accounts. |
| `src/db.ts` | the schema, as numbered migrations. |
| `src/http.ts` | a router, and the body cap that is enforced while reading. |
| `src/obsidian-stub.ts` | how the plugin's own code runs here. |
| `test/smoke.ts` | seventy checks against a running gallery. |

## Three things worth knowing before changing it

**It reuses the plugin's package engine rather than reimplementing it.**
`readPackage`, `verifyPackageSignature`, `describeReferences` and
`previewFromPackage` are imported from `../src/`. A gallery that decides for
itself what a package is will disagree with the plugin exactly where it matters.
`esbuild.config.mjs` explains the one trick that makes those imports work.

**It never edits an uploaded package.** The bytes are stored and served
unchanged, because the author's signature covers them and a gallery that rewrote
`meta.id` would turn every installed board into "author cannot be established".
The long note at the top of `src/upload.ts` is the argument.

**It has no runtime dependencies.** `node:sqlite` for storage, `node:http` for
serving, and the plugin's crypto bundled in. The build output is one file; the
Docker runtime stage copies that file and nothing else.
