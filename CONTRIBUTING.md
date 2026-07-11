# Contributing to Hearth

First off — thank you. The fact that you're reading this means you care about
Hearth, and that already makes my day.

This guide is short and honest about **where help lands best right now**. It
will change as the project matures.

## Where the project is today

Hearth is moving fast. The architecture, the card system and the settings are
all still shifting release to release, and I'm often mid-rewrite of something
you can't see yet. That has one practical consequence:

> **Right now I can't reliably take large pull requests.** A big PR against a
> fast-moving codebase tends to go stale, collide with work in flight, or aim
> at a part of the code I'm about to change anyway — which isn't fair to the
> time you'd put into it.

So for the moment, the contributions I can genuinely act on and value most are:

### 🐛 Bug reports
By far the most useful thing you can send me. If something misbehaves, tell me:
- what you did, what you expected, and what happened instead
- your Obsidian version, platform (desktop/mobile) and Hearth version
- a screenshot, screen recording or console error if you have one

Small, self-contained reproductions are gold.

### 💡 Feature requests & ideas
Hearth is opinionated but I love hearing how people actually use their vaults.
Open an issue describing the problem you're trying to solve (not just the
feature) — the *why* often points at a better solution than the *what*.

### 🌍 Translations
This is the one place where PRs are genuinely welcome and easy to merge, because
they're self-contained and don't collide with core work. User-facing strings
live in [`src/locales/`](src/locales/). English (`en.ts`) is the source of
truth and the keys are type-checked against it, so a translation is: copy
`en.ts`, translate the values, register the file. See
[`src/locales/README.md`](src/locales/README.md) for the walkthrough.

## About code pull requests

I'm not closing the door — I just want to set expectations so nobody's effort
is wasted:

- **Small, obvious fixes** (a typo, a clear one-line bug, a broken link) are
  always welcome. Send them.
- **Anything larger — new cards, refactors, new settings, behaviour changes —
  please open an issue first** so we can talk before you write code. If it
  overlaps with something I'm already changing, I'll tell you, and we'll save
  you the trouble.
- Please don't be discouraged if a bigger PR sits, gets deferred, or is
  declined for now. It's almost never about the quality of the work — it's
  about timing. **As development slows down, I'll be able to take PRs far more
  readily**, and this guide will say so when that day comes.

## Cutting a release

Releases are maintainer-only and go out **exclusively by pushing a git tag** —
never by hand through the GitHub UI. The versioning rules (plain semver `x.y.z`,
betas as `1.8.1-beta.1`, never four-segment versions) and the full checklist
live in [`RELEASING.md`](RELEASING.md).

## Filing an issue

Use [GitHub Issues](https://github.com/ondreu/Hearth/issues). A quick search
first saves duplicates. Otherwise there are no forms to fill — just be clear,
and be kind. 🔥
