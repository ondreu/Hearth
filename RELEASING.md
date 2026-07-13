# Releasing Hearth

Releases are cut **exclusively by pushing a git tag**. The
[`Release Obsidian plugin`](.github/workflows/release.yml) workflow builds the
plugin, attaches `main.js`, `manifest.json` and `styles.css` to a GitHub
Release, and marks pre-releases correctly so the Obsidian community store keeps
serving the right build to the right people.

> **Never create a release by hand through the GitHub UI.** A manual release
> skips the tag→manifest check, is created as "latest" by default, and — as has
> happened — can push a beta to every stable user. Tags only.

## Two channels: stable vs. beta

The Obsidian community store reads the `version` from **`manifest.json` at the
HEAD of the default branch** and offers it to every user. It ignores GitHub's
"pre-release" flag entirely. So the golden rule is:

> **`manifest.json` on `main` must always be the latest _stable_ `x.y.z`.**
> A beta version in `manifest.json` is a beta shipped to every stable user.

Betas therefore go in a **separate file, `manifest-beta.json`**, which the
[BRAT](https://github.com/TfTHacker/obsidian42-brat) beta-tester plugin reads and
the community store never touches. CI enforces this: a non-`x.y.z` version in
`manifest.json` fails the build, so a beta can't be merged into the store manifest.

| File | Read by | Must contain |
| --- | --- | --- |
| `manifest.json` | Obsidian community store **and** BRAT | latest **stable** `x.y.z` |
| `manifest-beta.json` | BRAT only | latest **beta** `x.y.z-beta.N` |
| `versions.json` | store (compatibility fallback) | **stable** versions only |

## Versioning

Obsidian requires plain [semver](https://semver.org/) `x.y.z` versions. The tag
must equal the version in whichever manifest matches its channel.

- **Stable:** tag `1.8.1` → `manifest.json` `1.8.1`
- **Beta / pre-release:** tag `1.9.0-beta.1` → `manifest-beta.json` `1.9.0-beta.1`
  (also `-alpha.N` and `-rc.N`).

A pre-release like `1.9.0-beta.1` sorts **before** `1.9.0` under semver, so beta
testers on `1.9.0-beta.N` are automatically offered the upgrade to `1.9.0` the
moment it ships stable.

### ⛔ Never use four-segment versions

Tags like `1.8.1.4-beta` are **not valid semver** and Obsidian rejects them
(`x.y.z` only). They also don't match the release workflow's tag trigger, so the
workflow never runs, `--prerelease` is never applied, and the release silently
becomes "latest" for all users. Use `1.9.0-beta.4`, not `1.8.1.4-beta`.

## Cutting a beta

1. **Bump `manifest-beta.json` only** — do **not** touch `manifest.json`:
   - `manifest-beta.json` → `"version": "1.9.0-beta.1"`
2. Commit (e.g. `chore: beta 1.9.0-beta.1`).
3. **Tag and push** — the tag name **is** the version, no `v` prefix:
   ```sh
   git tag 1.9.0-beta.1
   git push origin 1.9.0-beta.1
   ```
4. The workflow verifies the tag matches `manifest-beta.json`, builds, and
   publishes a **pre-release** whose `manifest.json` asset carries the beta
   version — so BRAT testers get it and the store does not.

## Cutting a stable release

> **Golden rule: a stable `x.y.z` is a _promotion_ of the beta-tested build, not
> a fresh build of whatever is on `main` now.** The code that ships to every
> stable user must be the exact code that soaked as `x.y.z-beta.N`. The only
> things that change on promotion are the version-carrying files
> (`manifest.json`, `versions.json`, `package.json`) and `CHANGELOG.md` — never
> `src/`, `styles.css` or `esbuild.config.mjs`.
>
> The release workflow **enforces this**: step _"Verify stable is the promotion
> of its beta-tested build"_ diffs the tagged commit's build inputs against the
> newest `x.y.z-beta.*` tag and **fails the release** if they differ (or if no
> such beta exists). This is what stops a beta's un-tested code — a new feature,
> a refactor — from riding a stable tag straight into the store.

**First, make sure `main` hasn't drifted past the beta.** If commits touching
`src/` / `styles.css` have landed since the last `x.y.z-beta.N` you shipped,
those changes were **never beta-tested**. Do **not** promote — cut a fresh beta
from current `main` (bump `manifest-beta.json`, tag `x.(y+1).0-beta.1` or the
next `-beta.N`), let it soak, and promote _that_.

To promote:

1. **Check out the beta-tested commit** (the one the final `x.y.z-beta.N` was
   built from) and bump the store-facing files on top of it — they must match
   the tag exactly:
   - `manifest.json` → `"version": "1.9.0"`
   - `versions.json` → add `"1.9.0": "<minAppVersion>"`
   - (also bump `package.json` `version` to match, for tooling)
   A version-only bump like this leaves the build inputs untouched, so the guard
   passes. **Never** carry along extra `src/`/`styles.css` commits here.
2. Commit (e.g. `chore: release 1.9.0`).
3. **Tag and push** — the tag must point at that promotion commit:
   ```sh
   git tag 1.9.0
   git push origin 1.9.0
   ```
4. The workflow verifies the tag matches `manifest.json`, confirms beta parity
   (above), builds, attaches the assets, and pins the tag as **latest**.

> Genuine emergency hotfix with no beta? Run the workflow from the **Actions
> tab** (`workflow_dispatch`) with `allow_no_beta = true`. This is the only
> supported way to skip the beta-parity gate, and it's logged as a warning.

## Keep the changelog honest

`CHANGELOG.md`'s newest `## [x.y.z]` entry must describe the version that is
**actually in flight** — the current beta line (or the stable just cut), not a
version whose contents aren't locked yet. CI (`verify:manifests`) fails if the
top entry matches neither `manifest.json` nor the current beta base version.
File a change under a version only once that version's build is what carries it;
if you're unsure which release will ship it, it belongs in the current beta line.

## If something goes out wrong

Don't delete old tags. If a bad release landed, cut a new, correctly-versioned
tag — the workflow's channel checks and the CI store-manifest guard keep the
store consistent from there. If `manifest.json` on `main` ever shows a `-beta`
version, revert it to the latest stable immediately: that single file is what
the store serves.
