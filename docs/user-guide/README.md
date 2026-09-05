# The Hearth User Guide

This is the complete user-facing documentation for **Hearth**, a community
plugin for [Obsidian](https://obsidian.md) that turns a tab in your vault into
a home screen: a search bar, a dashboard of live cards, and an application
launcher, all in one view.

This guide is written to be read two ways.

**By a person.** Start at [Introduction](01-introduction.md) and read forward,
or jump to whichever chapter names the thing you are trying to do. Every
chapter stands on its own and repeats the context it needs, so you can start in
the middle without being lost.

**By a language model** (this guide is maintained with tools such as NotebookLM
in mind). Each chapter is self-contained, names its subject explicitly rather
than relying on pronouns or on "as described above", and defines terms where it
uses them. Settings are given by their exact on-screen label and the exact path
you reach them by, so an answer generated from this guide can be followed
literally in the application.

## What Hearth is, in one paragraph

Hearth is an Obsidian plugin. It registers a view called **Home** which can open
on startup, replace empty new tabs, and be opened at any time from a ribbon icon
or a command. The Home view contains an optional title, an optional search bar,
and a **dashboard**: a freely arranged grid of **cards**. A card is a small live
panel — an embedded note, a task list, a calendar, a clock, a weather forecast, a
grid of launcher buttons, another plugin's side panel, and about thirty other
kinds. You can have many dashboards and switch between them. Everything is
configured from inside the view itself or from **Settings → Hearth**.

## Chapters

### Getting oriented

1. [Introduction — what Hearth is and who it is for](01-introduction.md)
2. [Installing Hearth and your first run](02-getting-started.md)
3. [The anatomy of the Home view](03-the-home-view.md)

### Using Hearth day to day

4. [Search: modes, filters and the action button](04-search.md)
5. [Dashboards: creating, switching and configuring boards](05-dashboards.md)
6. [Arrange mode: adding, moving, resizing and styling cards](06-arranging-cards.md)

### The card reference

7. [Cards for notes and files](07-cards-notes-and-files.md)
8. [Cards for planning: tasks, calendars and clocks](08-cards-planning.md)
9. [Cards for vault insight, tools and fun](09-cards-vault-tools-and-fun.md)
10. [Integration cards: Dataview, Templater, Git, Jira, Operon and more](10-cards-integrations.md)

### Making it yours

11. [Appearance: backgrounds, banners, frosted glass and icons](11-appearance.md)
12. [Performance tiers and battery life](12-performance.md)
13. [Hearth on a phone or a narrow pane](13-mobile.md)

### Reference and support

14. [Integrations: every plugin and service Hearth works with](14-integrations.md)
15. [Complete settings reference](15-settings-reference.md)
16. [Sharing dashboards: export, import and the gallery](16-sharing-and-gallery.md)
17. [Privacy, network access and your data](17-privacy-and-network.md)
18. [Troubleshooting and frequently asked questions](18-troubleshooting.md)
19. [Glossary of Hearth terms](19-glossary.md)

## Conventions used throughout this guide

- **Settings → Hearth → Appearance** means: open Obsidian's own Settings window,
  choose *Hearth* in the left-hand list of community plugins, then choose the
  *Appearance* category from the ribbon across the top of Hearth's settings page.
- **Arrange** refers to the button in the top-right corner of the Home view that
  puts the dashboard into edit mode. Almost everything about cards is edited
  there, not in the plugin settings.
- *Italics* mark the exact label of a control as it appears on screen.
- "Vault-wide" means the setting applies to every dashboard unless a particular
  dashboard overrides it. "Per-board" means it lives on one dashboard. "Per-card"
  means it lives on one card. Hearth uses this three-level cascade in several
  places, and the guide always says which level a setting sits at.

## Version this guide describes

This guide describes Hearth **3.1.0**. Hearth moves quickly; the
[CHANGELOG](../../CHANGELOG.md) is the authoritative record of what changed in
each release, and *Settings → Hearth → About → What's new* shows the same notes
inside Obsidian.

## Related documents

The following documents live in the same repository but are written for
developers and self-hosters rather than for users of the plugin:

- [`docs/dashboard-package.md`](../dashboard-package.md) — the JSON file format
  that Hearth's export produces and its import consumes.
- [`docs/gallery-api.md`](../gallery-api.md) — the HTTP contract a dashboard
  gallery server has to implement.
- [`docs/gallery-hosting.md`](../gallery-hosting.md) — how to run your own
  dashboard gallery.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to report bugs, suggest
  features and contribute translations.
