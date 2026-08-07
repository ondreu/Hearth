# Releasing Hearth

Releases are cut **exclusively by the
[`Release Obsidian plugin`](.github/workflows/release.yml) workflow**, which
builds the plugin, attaches `main.js`, `manifest.json` and `styles.css` to a
GitHub Release, and marks pre-releases correctly so the Obsidian community store
keeps serving the right build to the right people. The workflow has two entry
points — a pushed tag or a manual dispatch — and both run every guard; see
[How a release is cut](#how-a-release-is-cut).

> **Never create a release by hand through the GitHub UI.** A manual release
> skips the tag→manifest check, is created as "latest" by default, and — as has
> happened — can push a beta to every stable user. The workflow only.

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

Two rules define the train. Everything else in this document follows from them:

> 1. **A beta is cut from current `main`.** Always — that is the only thing a
>    beta ever is.
> 2. **A stable is promoted from a beta that soaked**, unchanged. Always.
>
> Together they mean: **a beta cut today can never be promoted today.** Cutting
> and promoting are two operations separated by the soak, never two halves of
> one job. If the beta you would promote does not already exist and has not
> already soaked, you are not doing a promotion — see
> ["No soaked beta to promote?"](#no-soaked-beta-to-promote).

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

## How a release is cut

The workflow has two entry points. Both run the identical guard chain
(tag↔manifest, beta parity, plain-`x.y.z` store manifest), so neither is a way
to "get around" a failing check — only the trigger differs.

**1. Push the tag** (the default). The tag name **is** the version, no `v`
prefix:

```sh
git tag 1.9.0-beta.1
git push origin 1.9.0-beta.1
```

**2. Dispatch the workflow** — for when a tag push isn't available. Sandboxed
environments (Claude Code on the web, and CI runners without tag-push rights)
have their egress proxy reject `refs/tags/*` pushes with **HTTP 403**; that is
policy, not a transient failure, so don't retry it. Run the workflow instead:

- From the **Actions tab**: _Release Obsidian plugin_ → _Run workflow_, pick the
  branch holding the release commit, and set **Version**.
- Or via the API/MCP equivalent, `workflow_id=release.yml`, `ref=<that branch>`,
  `inputs={"version": "<exact tag>"}`.

`gh release create` inside the workflow mints the tag on GitHub's side, so the
tag still ends up pointing at the release commit.

> ⚠️ **Always set the `version` input.** It is optional in the form but defaults
> to `manifest.json`'s version — i.e. the *stable* line. Dispatching a beta
> without it silently tries to cut the stable version instead of your beta.

Because the dispatch needs a `ref`, the commit must be on a **pushed branch**
first (branch pushes are unaffected by the tag-push block). For a promotion that
means a short-lived branch off the beta-tested commit — `promote-X.Y.Z` by
convention — which can be deleted once the tag exists.

## Cutting a beta

1. **Bump `manifest-beta.json` only** — do **not** touch `manifest.json`:
   - `manifest-beta.json` → `"version": "1.9.0-beta.1"`
2. Commit (e.g. `chore: beta 1.9.0-beta.1`).
3. **Cut the release** — push the tag, or dispatch the workflow with the beta
   version; see [How a release is cut](#how-a-release-is-cut).
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

**`main` being ahead of the beta is not a problem to solve.** Because the train
never freezes (see "Release cadence"), `main` is *always* ahead of the beta you
promote. Everything that landed after the snapshot belongs to the **next**
carriage — it ships in the beta you cut from `main` in this same pass, and
reaches stable one cycle later. Nothing is stranded and nothing needs folding
in. Promote the soaked snapshot as-is.

> **Don't let the changelog talk you out of this.** If `CHANGELOG.md` files work
> under `[x.y.z]` that is not in the `x.y.z-beta.N` you soaked, the *changelog*
> is wrong, not the beta. Move those entries to the next version's section
> (step 5 below) and promote as planned. A mismatch between prose and the
> snapshot is never a reason to build a new stable out of `main`.

<a id="no-soaked-beta-to-promote"></a>

### No soaked beta to promote?

Then this is not a promotion, and no amount of preparation makes it one. Cutting
a beta and promoting it in the same pass ships un-soaked code to every user
while looking like a correct release — the beta-parity guard **passes**, because
it resolves the newest `x.y.z-beta.*` tag and a beta you just cut is always
newest.

There are two ways to arrive here, and both end the same way:

- **The line was opened but never soaked** — `manifest-beta.json` holds
  `x.y.z-beta.1` and no meaningful build was ever cut from it.
- **Soak found a bug** — the beta you meant to promote is no good.

In both cases: **cut `x.y.z-beta.N` from current `main`, and stop there.** Let
it soak. Promoting it is a separate, later job — a different day and a different
run of this document, once someone has decided the build is good. A stable
release is never the second half of the job that created its beta.

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

   > **Expect `verify:manifests` to fail on this commit — that is correct.**
   > The promotion bumps `manifest.json` to `1.9.0` while `manifest-beta.json`
   > still holds `1.9.0-beta.1`, so the "beta must be strictly ahead of stable"
   > invariant is violated by construction. It is resolved a step later, when
   > the `main`-facing commit opens the next line (`1.10.0-beta.1`). Nothing is
   > wrong: the promotion branch is never merged to `main`, and neither CI (which
   > runs only on `main` pushes and PRs) nor the release workflow runs this
   > script. Run `verify:manifests` on the **`main`-facing** commit of step 5,
   > which is the one that has to satisfy it.

3. **Cut the release** — the tag must point at that promotion commit. Push the
   tag, or dispatch the workflow against the branch carrying it; see
   [How a release is cut](#how-a-release-is-cut).
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
