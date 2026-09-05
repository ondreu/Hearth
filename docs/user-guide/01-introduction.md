# 1. Introduction: what Hearth is

**Hearth** is a community plugin for [Obsidian](https://obsidian.md). It adds a
view called **Home** that acts as the front page of your vault. Instead of
opening Obsidian to whatever note you had open last, or to an empty pane, you
open it to a screen you designed: a search field, and a board of live panels
showing your notes, your tasks, your calendar, your repository status, the
weather, and anything else you decide belongs there.

If you have used a browser's new-tab page, a phone's home screen, or a
dashboarding tool such as Grafana or Notion's gallery view, the idea will be
familiar. Hearth is all three of those things pointed at one Obsidian vault.

Hearth works on desktop (Windows, macOS, Linux) and on mobile (iOS, Android).
A small number of features are desktop-only, and this guide says so wherever
that is the case.

## The three things Hearth does

### 1. It searches

The Home view carries a keyboard-first search field that searches file names,
file paths, tags, frontmatter properties and — optionally — the text inside your
notes. A leading `>` turns the same field into a command launcher that can run
any command in Obsidian's command palette. Below the field sit filter chips for
the kinds of file your vault actually contains, so you can narrow a search to
images, canvases, PDFs or notes with one click.

Search is covered in [chapter 4](04-search.md).

### 2. It displays

Below the search field is the **dashboard**: a free-form board of **cards**.
Hearth ships with more than thirty-five kinds of card. A card can embed a note
and let you edit it in place, list your tasks as a to-do list or a drag-and-drop
Kanban board, show a month calendar with your daily notes marked on it, draw a
year of vault activity as a heatmap, run a Dataview query, render a web page in
an iframe, show your Git repository's status with working commit and sync
buttons, paint the sky as it currently looks over a place you pick, or host
another plugin's entire side panel.

Cards are covered in chapters [7](07-cards-notes-and-files.md) through
[10](10-cards-integrations.md).

### 3. It launches

Hearth's **Links / launchpad** and **Commands** cards turn any note, folder,
URL or Obsidian command into a button on a grid. The **New note from template**
card turns each of your Templater templates into a button that creates a note
in a folder and under a filename pattern you choose. On mobile there is a
dedicated action bar of buttons under the search field. The result is a
launcher: the twenty things you do most often, one tap each.

## Design principles worth knowing before you start

Understanding these five ideas will save you a lot of hunting.

**Cards are configured on the board, not in the settings window.** The plugin
settings page holds vault-wide defaults. Everything about an individual card —
what it shows, how big it is, what colour it is — is edited by pressing
**Arrange** in the Home view and then opening that card's own settings. The
settings page says so explicitly under *Settings → Hearth → Dashboard → Cards*.

**Almost everything cascades in three levels.** A visual property such as card
opacity has a vault-wide default, an optional per-dashboard override, and an
optional per-card override. The most specific level that has an opinion wins.
Where a control can defer, it offers an explicit *Use global default* choice
rather than a blank, so you can always tell whether a board is following the
vault or overriding it.

**Nothing reaches the network unless a card asks it to.** Hearth has no
telemetry, no account and no phone-home. The only outbound requests it makes are
the ones a card you added needs — a weather forecast, an RSS feed, a calendar
subscription, a Jira query, an image whose address you typed. A single switch,
*Settings → Hearth → Behaviour → Disable external calls*, silences all of them
at once. See [chapter 17](17-privacy-and-network.md).

**Hearth works through other plugins rather than around them.** Where Hearth
integrates with another plugin, it uses that plugin's own machinery. Git commits
go through the Git plugin's task queue, so your remote, credentials and
commit-message template apply unchanged. Kanban writes are made in the Kanban
plugin's own format, so the note stays editable in Kanban. Periodic notes are
resolved and created by Periodic Notes itself. Templater does the templating.
This means Hearth does not become a second, disagreeing source of truth.

**Your layout is never rewritten behind your back.** When the board is too
narrow for its free-form layout — on a phone, or in a narrow split pane on the
desktop — Hearth reflows it into a single column for display only. The stored
layout is untouched and returns at full width.

## What Hearth is not

- It is not a note editor. It embeds Obsidian's editor where editing makes sense
  (an embedded note card can be edited in place, in raw Markdown or in Live
  Preview), but Hearth does not implement editing of its own.
- It is not a task manager. Its Tasks card reads and writes Markdown checkboxes,
  TaskNotes task notes and Kanban board notes; the rules about what a task *is*
  stay with those systems.
- It is not a sync service. Everything Hearth stores lives in your vault's
  plugin data, and travels with whatever sync you already use.
- It is not a theme. Hearth draws its own surfaces and honours your theme's
  colours; it does not restyle the rest of Obsidian.

## A note on how Hearth is built

Hearth's README states plainly that the plugin was created using AI. Every pull
request is tested in a testing vault by a human before merging, and every
release is beta tested in a testing vault by a human before being promoted to
stable. Hearth is MIT-licensed, and the full source is in the repository.

## Where to go next

If Hearth is not installed yet, or you have just installed it and the setup
wizard is offering to build you a dashboard, read
[chapter 2, Installing Hearth and your first run](02-getting-started.md).

If Hearth is already open in front of you and you want to know what you are
looking at, read [chapter 3, The anatomy of the Home view](03-the-home-view.md).
