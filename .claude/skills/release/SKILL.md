---
name: release
description: >-
  Cut a Hearth beta or promote a beta to stable, following the release-train
  cadence in RELEASING.md. Use whenever the request is to "cut a beta",
  "promote (the) beta to stable", "release <version>", "open the next beta",
  or "ship stable". Handles the stable/beta two-manifest split, the
  beta-parity guard, cutting the release via a pushed tag OR via
  workflow_dispatch when tag pushes are blocked, and landing the store
  manifest on a protected main through a PR.
---

# Releasing Hearth

Hearth ships on a **release train**, not a freeze-and-cut model. Internalise the
cadence before touching anything — it is the source of every subtle rule below.

## The cadence (mental model)

```
main ──●──●──●───────●──●──●───────●──●──▶   (never freezes; always moving)
        \           /   ↑ next-cycle work    \
         └ tag 1.12.0-beta.1                   └ tag 1.13.0-beta.1
           (snapshot, soaks ~days)               (next snapshot)
                       │
                       └─ promote ─▶ tag 1.12.0  (version-only bump of the SNAPSHOT,
                                                   NOT of main HEAD)
```

- A **beta tag is a snapshot** of `main` at cut time. It soaks with BRAT testers.
- **While it soaks, `main` keeps moving** — those new commits are the *next*
  version's work, not this one's.
- **Promotion ships the snapshot**, byte-for-byte. It is a version-only bump
  committed **on top of the beta-tested commit**, never a fresh build of `main`.
- So at promotion time `main` will *always* be ahead of the beta. That is
  normal and correct — it does **not** block promotion (see "drift" below).

**The two rules, and the one thing they forbid:**

1. A beta is cut from current `main`. Always.
2. A stable is promoted from a beta that soaked, unchanged. Always.

⛔ **Therefore a beta cut today can never be promoted today.** Cutting and
promoting are separated by the soak — they are never two halves of one job. If
the beta you would promote does not already exist and has not already soaked,
you are not doing a promotion: cut the beta, stop, and hand back.

Always read `RELEASING.md` first; this skill is the operational runbook for it.

## Preflight (do this every time, before deciding anything)

```sh
git fetch origin --tags
node -p "require('./manifest.json').version"        # current STABLE
node -p "require('./manifest-beta.json').version"   # current BETA line
git tag -l "*-beta.*" --sort=-v:refname | head      # existing beta snapshots
git log --oneline "$(git describe --tags --abbrev=0 --match '*-beta.*')"..origin/main -- src styles.css esbuild.config.mjs
```

Drift on `main` since the newest beta is **not** something to classify or fix.
It is next-cycle work by definition: it ships in the beta you cut from `main` in
this same pass and reaches stable one cycle later. Promote the soaked snapshot
as-is.

The one question preflight actually has to answer is:

> **Does a soaked `X.Y.Z-beta.N` already exist?**

- **Yes** → Operation B. Promote it unchanged, whatever `main` looks like now.
- **No** (the line was opened but never soaked, or soak found a bug) → this is
  **not a promotion**. Do Operation A only — cut `X.Y.Z-beta.N` from `main` —
  then **stop and hand back**. Do not continue into Operation B in the same
  pass, and do not treat silence as permission to. Promotion is a later job,
  after someone has decided the build is good.

⛔ Cutting a beta and promoting it minutes later ships un-soaked code to every
user, and **the beta-parity guard will not catch it** — that guard resolves the
newest `X.Y.Z-beta.*` tag, and a beta you just cut is always the newest. Nothing
downstream will stop you. This rule is the only thing that does.

If the changelog files work under `[X.Y.Z]` that is not in the soaked beta, the
**changelog** is wrong, not the beta: move those entries to the next version's
section in B2 and promote as planned.

## Operation A — Cut a beta from `main`

1. Bump **`manifest-beta.json` only** → `"version": "X.Y.Z-beta.N"`. Never touch
   `manifest.json` (that is the store-facing stable manifest).
2. Make sure `CHANGELOG.md`'s top `## [X.Y.Z]` section describes this beta line
   and lists only what this build actually contains.
3. Commit (`chore: cut X.Y.Z-beta.N` or `chore: beta X.Y.Z-beta.N`).
4. Cut the release (see "Cutting the actual release" — the tag name **is** the
   version, no `v` prefix). The workflow publishes it as a **pre-release**.

## Operation B — Promote a beta to stable (+ open the next beta line)

**Precondition:** the `X.Y.Z-beta.N` you are promoting already existed and had
already soaked when this job started. If you cut it yourself in this pass,
Operation B does not apply — you are done after Operation A.

This is two commits on **two different bases** — do not try to do it as one
commit on `main`, or the beta-parity guard will reject the stable tag.

### B1. The stable promotion commit (base = the beta-tested commit)

```sh
git checkout -b promote-X.Y.Z <the X.Y.Z-beta.N commit>   # e.g. the tag itself
# version-only bump, NO src/styles.css/esbuild changes:
#   manifest.json   → "X.Y.Z"
#   versions.json   → add "X.Y.Z": "<minAppVersion>"
#   package.json    → "X.Y.Z"
#   CHANGELOG.md     → finalise the [X.Y.Z] section (only what this build ships)
git commit -am "chore: release X.Y.Z"
# GUARD SELF-CHECK — must print nothing:
git diff --stat "$(git tag -l 'X.Y.Z-*' | sort -V | tail -1)" HEAD -- src styles.css esbuild.config.mjs
```

Tag this commit `X.Y.Z`. It is fine (and expected) that this commit is not on
`main` — the stable tag points at it; `main` moves on independently.

### B2. Open the next beta line + update the store manifest (base = `main`)

On a branch off current `main`, in one commit:

- `manifest.json`      → `X.Y.Z`  (store now offers the freshly promoted stable)
- `versions.json`      → add `"X.Y.Z": "<minAppVersion>"`
- `package.json`       → `X.Y.Z`
- `manifest-beta.json` → `X.(Y+1).0-beta.1`  (opens the next line)
- `CHANGELOG.md`       → new `## [X.(Y+1).0]` section on top, holding the
  next-version work already on `main`; make sure `[X.Y.Z]` lists only what the
  stable actually ships (move mis-filed next-version entries up).

Commit (`chore: release X.Y.Z, open X.(Y+1).0-beta.1`). Optionally tag the head
`X.(Y+1).0-beta.1` if you want to cut beta.1 immediately — but a beta.1 with
zero soak is only a placeholder; the meaningful soak build is whatever beta.N
you cut later once you're ready to test.

## Cutting the actual release

`RELEASING.md`'s canonical path is **push the tag** (`git tag X.Y.Z && git push
origin X.Y.Z`); the `Release Obsidian plugin` workflow does the rest.

**If tag pushes are blocked** (in Claude Code on the web the egress proxy
rejects `refs/tags/*` pushes with HTTP 403 — do not retry, it is policy), use
the workflow's `workflow_dispatch` entry point instead, which is the same path
every recent release used:

```
mcp__github__actions_run_trigger  method=run_workflow  workflow_id=release.yml
  ref=<branch that carries the release commit>
  inputs={ "version": "<exact tag>" }   # REQUIRED for betas, else it defaults to manifest.json
```

`gh release create` inside the workflow mints the tag on GitHub's side, so this
sidesteps the blocked local push while still enforcing every guard. Push the
branch that holds the commit first (branch pushes are allowed) so the dispatch
ref exists. Verify with `mcp__github__list_releases` that the stable is
`prerelease:false` (pinned latest) and the beta is `prerelease:true`.

## Landing the store manifest on `main`

The Obsidian community store reads `manifest.json` at **`main`'s HEAD**, so the
promotion is not user-visible until the B2 commit is on `main`. `main` is
branch-protected (requires the "Typecheck & build" check), so direct pushes are
rejected — land it via a PR and merge once the check is green.

## Guard self-checks (mirror what CI / the release workflow enforce)

- **Tag ↔ manifest:** stable tag `X.Y.Z` must equal `manifest.json`; pre-release
  tag must equal `manifest-beta.json`.
- **Beta parity (stable only):** `git diff --quiet <newest X.Y.Z-*.beta tag>
  HEAD -- src styles.css esbuild.config.mjs` must succeed. A version-only
  promotion passes; a diverged `main` fails.
- **versions.json** contains an entry for `manifest.json`'s version.
- **manifest-beta.json** is a pre-release strictly ahead of `manifest.json` and
  differs from it in `version` only.
- **manifest.json** is always plain `x.y.z` (a beta there ships to every stable
  user). Never four-segment (`1.8.1.4-beta` is invalid semver, is rejected, and
  silently becomes "latest").
- **CHANGELOG** top entry is the in-flight version, and each section lists only
  what that build ships.
- Run `node scripts/verify-manifests.mjs` on the `main`-facing branch to confirm
  the manifest/version/changelog invariants before opening the PR. Do **not**
  expect it to pass on the B1 promotion commit — there `manifest.json` is already
  `X.Y.Z` while `manifest-beta.json` still holds `X.Y.Z-beta.N`, so the
  "beta strictly ahead of stable" check fails by construction until B2 opens the
  next line. That branch is never merged and nothing in CI or the release
  workflow runs this script, so the failure is expected, not a problem to fix.

## Never

- **Never promote a beta you cut in this same pass.** No soak, no promotion —
  cut it, stop, hand back. The beta-parity guard does not catch this.
- **Never merge the B2 store-manifest PR yourself**, and never dispatch
  `release.yml` for a plain `x.y.z`, unless the user asked for that in this
  session. Those two steps are what reach every user. Open the PR, report the
  green check, hand over the link.
- **Never treat an unanswered question as approval.** If you asked whether to
  proceed and got no reply, the answer is no — stop with what you have.
- Never create a release by hand through the GitHub UI.
- Never put a `-beta` version in `manifest.json`.
- Never carry `src/` / `styles.css` / `esbuild.config.mjs` changes into a
  promotion commit — promotion is version/label only.
- Never delete old tags to "fix" a bad release; cut a new, correctly-versioned
  one and let the channel checks reconcile the store.
