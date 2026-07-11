# Releasing Hearth

Releases are cut **exclusively by pushing a git tag**. The
[`Release Obsidian plugin`](.github/workflows/release.yml) workflow builds the
plugin, attaches `main.js`, `manifest.json` and `styles.css` to a GitHub
Release, and marks pre-releases correctly so the Obsidian community store keeps
serving the right build to the right people.

> **Never create a release by hand through the GitHub UI.** A manual release
> skips the tag→manifest check, is created as "latest" by default, and — as has
> happened — can push a beta to every stable user. Tags only.

## Versioning

Obsidian requires plain [semver](https://semver.org/) `x.y.z` versions. The tag,
`manifest.json` `version`, and the `versions.json` key must all be identical.

- **Stable:** `1.8.1`
- **Beta / pre-release:** `1.8.1-beta.1`, then `1.8.1-beta.2`, …
  (also `-alpha.N` and `-rc.N`).

A pre-release like `1.8.1-beta.1` sorts **before** `1.8.1` under semver. That is
exactly what we want: beta testers on `1.8.1-beta.N` are automatically offered
the upgrade to `1.8.1` the moment it ships.

### ⛔ Never use four-segment versions

Tags like `1.8.1.4-beta` are **not valid semver** and Obsidian rejects them
(`x.y.z` only). They also don't match the release workflow's tag trigger, so the
workflow never runs, `--prerelease` is never applied, and the release silently
becomes "latest" for all users. Use `1.8.1-beta.4`, not `1.8.1.4-beta`.

## Release checklist

1. **Bump the version in both files** — they must match the tag exactly:
   - `manifest.json` → `"version": "1.8.1-beta.1"`
   - `versions.json` → add `"1.8.1-beta.1": "<minAppVersion>"`
2. Commit the bump (e.g. `chore: release 1.8.1-beta.1`).
3. **Tag and push** — the tag name **is** the version, with no `v` prefix:
   ```sh
   git tag 1.8.1-beta.1
   git push origin 1.8.1-beta.1
   ```
4. The workflow then:
   - verifies the tag matches `manifest.json` (**fails** on mismatch, so the
     store never sees the dreaded
     *"No release matches your manifest version"* error),
   - builds and attaches the assets,
   - marks `-beta` / `-alpha` / `-rc` tags as **pre-release** (never "latest"),
     and pins stable tags as **latest**.

## If something goes out wrong

Don't delete old tags. If a bad release landed, cut a new, correctly-versioned
tag — the workflow's pre-release/latest handling and manifest check will keep
the store consistent from there.
