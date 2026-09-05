# 14. Integrations: every plugin and service Hearth works with

Hearth integrates with twenty-five other things: community plugins, Obsidian's
own core plugins, and external services. Almost all of them are picked up
automatically — nothing to connect, no keys to paste. The exceptions are named
explicitly below.

The full live catalogue is inside the plugin at **Settings → Hearth →
Integrations**. It lists every integration whether or not it is installed,
shows its current status, and says where its settings live. Rows for
integrations that need a setting link straight down to it; rows for missing
plugins offer an **Install** button that opens that plugin in Obsidian's
community plugin browser.

## Reading the status pills

| Pill | Meaning |
| --- | --- |
| **Enabled** | Installed and enabled — Hearth is using it |
| **Disabled** | Installed but turned off, so Hearth cannot use it right now |
| **Not installed** | Not installed. Everything else in Hearth works without it |
| **Network** | An outbound request, not a plugin |
| **Always available** | Nothing to install |

## Where an integration's settings live

| Note on the row | Meaning |
| --- | --- |
| *Settings below on this tab* | It has a section further down the Integrations tab |
| *Settings under <tab>* | It is configured on another Hearth settings tab |
| *Configured on the card itself, on your dashboard* | Open the card's gear in arrange mode |
| *Uses that plugin's own settings — nothing to set in Hearth* | Hearth reads the other plugin's configuration |
| *Nothing to configure* | It just works |

---

## Community plugins

### Omnisearch

**What Hearth does with it:** swaps the search bar over to
[Omnisearch](https://github.com/scambier/obsidian-omnisearch)'s fuzzy, full-text
index instead of Hearth's built-in engine.

**Configured in:** *Settings → Hearth → Search → Search bar → Search engine*.

The choice only sticks while Omnisearch is enabled — disable the plugin and
Hearth falls back to its own engine rather than showing you an empty search.

### TaskNotes

**What Hearth does with it:** Tasks cards read one-note-per-task vaults — status,
due date and priority straight from frontmatter. Mini calendar cards can also
draw TaskNotes items: scheduled tasks, due dates, recurring occurrences,
timeblocks, and the calendars subscribed inside TaskNotes.

**Configured in:** *Settings → Hearth → Integrations → Tasks / TaskNotes*.

TaskNotes has no stable API for other plugins, so Hearth reads its frontmatter
directly, which means it has to be told the field names. Hearth's defaults are
TaskNotes' own defaults (`status`, `due`, `priority`, `done`); if you renamed a
field inside TaskNotes, match it here. The setup wizard reads these from
TaskNotes for you when it builds a Tasks card.

See [chapter 8](08-cards-planning.md).

### Dataview

**What Hearth does with it:** the Dataview card runs DQL queries and DataviewJS
blocks and renders them with
[Dataview](https://github.com/blacksmithgu/obsidian-dataview)'s own renderers,
refreshing as its index changes.

**Configured in:** the card itself.

### Datacore

**What Hearth does with it:** the Datacore card runs a
[Datacore](https://github.com/blacksmithgu/datacore) query — or a JS, JSX, TS or
TSX script — and renders it with Datacore's own live views. Datacore is
Dataview's successor.

**Configured in:** the card itself.

### Templater

**What Hearth does with it:** the *New note from template* card turns your
[Templater](https://github.com/SilentVoid13/Templater) templates into buttons,
each carrying its own template, destination folder and filename pattern.
Templater's *New note* integration is also available for the search bar's action
button.

**Configured in:** the card itself, and *Settings → Hearth → Search → Search
bar*.

Templater does the templating throughout: your user scripts,
`tp.system.prompt()` dialogs and cursor placement behave exactly as they do from
Templater's own command.

### Periodic Notes

**What Hearth does with it:** the Periodic note card shows this week's, month's,
quarter's or year's note, resolved — and created, from your own template — by
[Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) itself.

**Configured in:** the card itself.

### Git

**What Hearth does with it:** the Git card shows your repository's branch,
changes and recent commits, and commits, syncs, pushes and pulls through the
[Git](https://github.com/Vinzent03/obsidian-git) plugin itself — its remote,
credentials and commit-message template all apply unchanged.

**Configured in:** the card itself.

### Operon

**What Hearth does with it:** four cards — tasks, board, agenda and timer — read
through [Operon](https://github.com/hasanyilmaz/operon)'s own Developer API, so
its statuses, priorities and recurrence stay its to define.

**Configured in:** *Settings → Hearth → Integrations → Operon*.

This is the one integration that needs a step from you. It has its own section
below.

### Iconic and Iconize

**What Hearth does with them:** per-file icons set with
[Iconic](https://obsidian.md/plugins?id=iconic) or
[Iconize](https://obsidian.md/plugins?id=obsidian-icon-folder) (formerly
Obsidian Icon Folder) show up wherever Hearth lists a file — Recent, Favorites,
saved searches and search results. Iconize icons set through a frontmatter
property are included.

**Configured in:** *Settings → Hearth → Integrations → File icons / Iconic /
Iconize*.

Lucide icons and emoji are shown; a file using an icon from a downloaded icon
pack keeps Hearth's own file-type icon. Turning the setting off shows Hearth's
file-type icon for every file, ignoring both plugins. Leaving it on in a vault
with neither plugin installed changes nothing and starts working as soon as one
is installed.

If you renamed Iconize's frontmatter property, tell Hearth the new name;
Iconize's own default is `icon`.

### Excalidraw

**What Hearth does with it:** Embed cards render
[Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) drawings
live with native pan and zoom, and the *New drawing* action creates one through
Excalidraw's own command.

**Configured in:** the card itself.

### Kanban

**What Hearth does with it:** Tasks cards read and write
[Kanban](https://github.com/obsidian-community/obsidian-kanban) board notes in
Kanban's own format, so a board dragged around in Hearth stays fully editable in
Kanban.

**Configured in:** the card itself.

---

## Obsidian core plugins

These are built into Obsidian. Enable them in **Settings → Core plugins** if a
Hearth card says one is missing.

| Core plugin | What Hearth does with it |
| --- | --- |
| **Daily notes** | The Daily note, Mini calendar and Vault statistics cards resolve today's note from Daily notes' own folder, date format and template |
| **Bases** | Embed cards can show a `.base` view on the dashboard |
| **Canvas** | Embed cards can show a canvas, interactive and edge to edge |
| **Bookmarks** | The Bookmarks card lists your Obsidian bookmarks, groups and all |
| **Search** | Hands a query over to Obsidian's own search pane when you ask for the full results |
| **File explorer** | Powers *Reveal in file explorer* on Hearth's search results |
| **Workspaces** | A dashboard can switch to a saved workspace when you open it |
| **Audio recorder** | The *Record voice* mobile action button starts and stops Obsidian's own recorder |
| **Any plugin with a side panel** | The Plugin view card hosts another plugin's registered view inside a card; a whole dashboard can also be given over to one |

---

## External services

Every one of these is an outbound network request. **All of them are silenced at
once** by *Disable external calls* under **Settings → Hearth → Behaviour →
Privacy & network**. See [chapter 17](17-privacy-and-network.md).

| Service | Used by | Account or key needed |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com) | Weather cards and the live weather sky | None. Only the coordinates you pick are sent, and a pinned sky needs no location at all |
| [Frankfurter](https://www.frankfurter.app/) (European Central Bank rates) | Calculator currency conversion | None |
| Jira Cloud or Jira Server | Jira cards, over REST with bearer PAT authentication | Yours, entered on the card. Exports never include the token |
| RSS and Atom feeds | RSS cards | None |
| ICS and webcal feeds | Mini calendar subscriptions — Google, iCloud, Fastmail, Nextcloud and others | The feed URL |
| DuckDuckGo, Brave, Kagi, Google, Mojeek, Ecosia, Qwant | The search bar's optional web-search button | None |
| Whatever host you name | A background image or title icon given as a web address. Hearth's own bundled default wallpaper is one of these, served from `raw.githubusercontent.com` | None |
| A dashboard gallery server | The gallery browser and publisher | An anonymous handle Hearth generates locally, needed only for voting and publishing |

---

## Operon in detail

Operon is the one integration that needs an explicit action from you, because
Operon requires plugins to be approved before they may read anything.

### Before you add an Operon card

| | |
| --- | --- |
| **Platform** | Desktop only, Obsidian 1.12.2 or newer |
| **Approval** | Hearth's request appears in **Settings → Operon → Core → General → Developer API Integrations** — approve it there. Until then the cards say exactly what they are waiting for |
| **Widening it** | Operon grants all-or-nothing, so turning on *Allow changes* needs a fresh approval |
| **Status and kill switch** | **Settings → Hearth → Integrations → Operon** shows the connection, what was requested, and how to cut it |

### How the connection works

*Connect to Operon* under **Settings → Hearth → Integrations → Operon** is on by
default, but it is inert until an Operon card exists: no session is opened, and
so no grant is requested, until one renders. Switching it off is a kill switch —
Operon cards stop reading and Hearth never asks Operon for access.

The *Connection* row reports one of these states:

| State | Meaning |
| --- | --- |
| Operon isn't installed or enabled | Nothing to connect to |
| Operon's developer API is desktop-only and needs Obsidian 1.12.2 or newer | The platform does not support it |
| Operon is running but still starting up | Wait |
| Waiting for approval | Approve Hearth in Operon's Developer API Integrations |
| Access is suspended | Review Hearth's pending scope in Operon's Developer API Integrations |
| Access was revoked | Grant it again |
| Connected — Operon cards can read tasks | Working |
| Not connected yet | Add an Operon card to open a session |
| The integration is switched off | The kill switch is on |
| Operon refused the connection | Operon's own error text is shown underneath |

*Recheck now* reopens the connection after approving, revoking or reloading
Operon.

### Requested access

Hearth asks for all of its capabilities at once, because Operon does not open a
partly approved session. The request is read-only unless *Allow changes* is on,
which adds the task-transition and task-creation permissions. The settings
section lists what has been requested and names anything not yet granted.

### Allowing changes

*Allow changes* lets the board card move a task to another status by dragging
it, and adds a **+** for creating one. Operon decides where a new task goes and
whether a move is legal; Hearth only asks.

Turning this on **widens what Hearth requests**, so you will need to approve
Hearth again in Operon's Developer API Integrations. Until you do, reading keeps
working and the cards stay read-only, and Hearth says so.

Off means Hearth can only read.

### How writes are handled

Hearth previews the change, Operon rates it, and Operon applies it. Anything
more than routine is confirmed with you first, using Operon's own summary of
what would happen rather than Hearth's guess at it.

A move carries the status the board was drawn from, so a drag onto a stale board
is refused rather than quietly undoing someone else's change.

If Operon cannot confirm whether a change was applied, Hearth reports "unknown"
rather than "failed", re-reads the card, and does **not** offer a retry — a retry
could apply the change twice.

See [chapter 10](10-cards-integrations.md) for the four Operon cards themselves.

---

## Integrations that need no setup at all

For completeness, this is the set that simply works once the other plugin is
enabled, with nothing to configure in Hearth: Dataview, Datacore, Excalidraw,
Kanban, Periodic Notes, Git, Bases, Canvas, Bookmarks, Daily notes, Search, File
explorer, Workspaces, Audio recorder, and any plugin with a side panel.
