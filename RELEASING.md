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

## Release cadence: a train, not a freeze

Hearth releases run as a **train**. `main` never freezes:

1. Work lands on `main` and is tested there commit by commit.
2. When a version's worth of work is ready, **cut a beta snapshot** of `main`
   (`x.y.z-beta.N`) and let it soak with BRAT testers for a few days.
3. **Promote** that snapshot to stable `x.y.z` — a version-only bump of the
   **beta-tested commit** (see below), not a fresh build of `main`.
4. While the beta soaks, the *next* version's features keep merging into `main`;
   they become the next beta line. Go to 2.

Two consequences fall out of this and drive the rules below:

- **At promotion time `main` is always ahead of the beta you're promoting.**
  That drift is the next cycle's work — it is expected and does **not** block
  promotion. What you ship as `x.y.z` is the soaked snapshot, and the
  beta-parity guard makes sure of it.
- **`manifest-beta.json` tracks the open line.** Promoting `x.y.z` is also when
  you *open the next line* by bumping `manifest-beta.json` to `x.(y+1).0-beta.1`.
  Opening a line (a manifest bump) is separate from cutting a soak build (the
  tag you actually test): a `beta.1` tagged at open-time with no soak is just a
  placeholder — the meaningful build is whatever `beta.N` you cut when ready.

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

**First, check what has drifted onto `main` since the beta.** Because the train
never freezes (see "Release cadence"), `main` is normally ahead of the beta
you're promoting — and that's fine when the drift is **next-version** work: it
stays on `main` and becomes the next beta line, while you promote the soaked
snapshot as-is.

The drift only blocks promotion when it's **this-version** work: a fix or change
you intend to ship *in the stable you're about to cut* that landed after the
`x.y.z-beta.N` you soaked. Those changes were **never beta-tested**, so do
**not** fold them into the promotion. Cut a fresh beta from current `main`
(bump `manifest-beta.json` to the next `-beta.N`, tag it), let it soak, and
promote _that_. The beta-parity guard enforces this either way — it will reject
a stable tag whose build inputs differ from the beta, so this-version work
cannot ride a promotion without its own beta.

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
5. **Land the store manifest on `main`, and open the next line.** The community
   store reads `manifest.json` at `main`'s HEAD, so the promotion isn't
   user-visible until `main` carries it. When `main` has already moved past the
   beta (the usual train case), the tagged promotion commit from step 1 lives on
   the beta line, **not** on `main` — so make a separate commit on `main` that
   both bumps the store-facing files to the new stable **and** opens the next
   beta line, e.g. `chore: release 1.9.0, open 1.10.0-beta.1`:
   - `manifest.json` → `"1.9.0"`, `versions.json` += `"1.9.0"`, `package.json` → `"1.9.0"`
   - `manifest-beta.json` → `"1.10.0-beta.1"`
   - `CHANGELOG.md` → open a `## [1.10.0]` section for the next-version work
     already on `main`, and make sure `[1.9.0]` lists only what the stable
     actually ships (move any next-version entries up).
   `main` is branch-protected, so land this through a PR (the `Typecheck &
   build` check must pass), not a direct push.

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
