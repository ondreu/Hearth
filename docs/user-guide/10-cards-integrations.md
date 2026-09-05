# 10. Integration cards

This chapter documents the cards in the **Integrations** category of Hearth's
Add card picker. Each one is a window onto another plugin or another service:
Templater, Dataview, Datacore, Git, Jira, RSS, Weather, Operon (four cards) and
the Plugin view card.

A card whose plugin is not installed is still listed in the picker, marked
*Needs Dataview* (or Git, Operon, and so on) with a one-click link to install
it. You can add the card anyway; it shows a prompt until the dependency arrives.

For the full catalogue of what Hearth integrates with, including things that are
not cards, see [chapter 14](14-integrations.md).

---

## New note from template

**What it shows:** a grid of buttons, each of which creates a note from one of
your Templater templates.

**Requires:** the [Templater](https://github.com/SilentVoid13/Templater)
community plugin.

This card does something Templater's own per-template commands cannot: **the
same template can feed three different folders from three different buttons**.
Each tile carries its own template, its own destination folder and its own
filename pattern.

Templater still does the templating. Your user scripts, `tp.system.prompt()`
dialogs and `tp.file.cursor()` placement all behave exactly as they do when the
template is run from Templater's own command.

### Per-tile settings

| Setting | Meaning |
| --- | --- |
| *Label* | The text on the tile |
| Template | The Templater template this tile runs, chosen from a picker. The picker lists the templates in Templater's own template folder |
| Folder | The folder the new note goes in. The vault root means "wherever Obsidian puts new notes" |
| *Filename* | The name, without the extension. Leave empty to let Templater name it |
| Open toggle | Whether the new note opens, or is filed away silently |

### Filename tokens

Filenames may use:

| Token | Substituted with |
| --- | --- |
| `{{date}}` | Today's date |
| `{{date:FMT}}` | Today's date in a moment.js format, for example `{{date:YYYY-MM}}` |
| `{{time}}` | The current time |
| `{{time:FMT}}` | The current time in a format, for example `{{time:HH-mm}}` |
| `{{prompt}}` | Asks you for the rest of the name before the note is made |

Everything inside the template itself — `<% tp.* %>`, your user scripts,
`tp.system.prompt()` — is Templater's own.

### Card-level settings

*Button sizing*, *Buttons across*, *Minimum button size* and *Auto-shift tiles
(beta)* behave as they do on the Links card; see
[chapter 6](06-arranging-cards.md).

If Templater is not enabled, the card says so and keeps its configuration, so
installing Templater later makes the tiles start working with nothing else to
change.

---

## Dataview query

**What it shows:** a Dataview query, rendered by Dataview's own live renderers.

**Requires:** the [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
community plugin.

| Setting | Meaning |
| --- | --- |
| *Query type* | **Dataview query (DQL)** — TABLE, LIST or TASK — or **DataviewJS** |
| *Query* | The query itself, written exactly as it would be inside a fenced code block, without the fences |

Table columns rendered by this card are resizable.

An important limitation: the card runs with **no "current note"**. Global
queries work fully; queries written relative to `this.file` have no file to
resolve against.

DataviewJS runs arbitrary JavaScript with the `dv` API in scope. Only use code
you trust.

Example DQL: `TABLE file.mtime AS "Modified" FROM #project SORT file.mtime DESC`
Example DataviewJS: `dv.list(dv.pages('#project').file.link)`

The card refreshes as Dataview's index changes.

---

## Datacore query

**What it shows:** a Datacore query rendered as a live list, or a full Datacore
script rendering its own view.

**Requires:** the [Datacore](https://github.com/blacksmithgu/datacore)
community plugin. Datacore is Dataview's successor.

| Setting | Meaning |
| --- | --- |
| *Query type* | **Datacore query**, or a script in **JSX**, **JS**, **TSX** or **TS** |
| *Query* | A Datacore query such as `@page and #project`. Hearth renders the matches as a live list of links |
| *Script* | A Datacore script, as inside a `datacorejsx` block without the fences. The `dc` API is in scope and the script returns the view to render |
| *Rows per page* | Page the generated list at this many rows. 0 shows every match at once |

As with Dataview, the card runs with no "current note", so global queries work
fully and file-relative ones have nothing to resolve against. Scripts run
arbitrary code; only use code you trust.

One card runs **one** query. If you paste several, the card says so rather than
guessing which you meant.

---

## Git

**What it shows:** your repository's branch, staged and changed files, unpushed
commits and recent log, with working buttons.

**Requires:** the [Git](https://github.com/Vinzent03/obsidian-git) community
plugin, with a repository set up.

The Git card is a window onto the Git plugin rather than a second Git client.
Commits go through the Git plugin's own task queue, so your remote, your
credentials and your commit-message template all apply unchanged.

### Sections and buttons

*Sections* chooses which parts of the card are drawn. *Buttons* is a list you
build: commit, sync, push, pull, stage, discard and so on. Each button can be
removed and new ones added. *Button style* is **Icon only** (compact) or **Icon
and label** (readable on a wide card).

Buttons that discard work are marked as such: "Cannot be undone."

### Committing

| Setting | Meaning |
| --- | --- |
| *What to commit* | **Staged if anything is staged, otherwise everything**, **Everything**, or **Only staged files** |
| *Ask for a message* | Have the Git plugin prompt for a commit message each time, exactly as its "…with specific message" commands do |
| *Commit message* | Used by this card's commit buttons. Leave empty to use the Git plugin's own commit-message template. Supports `{{date}}` |
| *Skip confirmations* | Run discarding actions immediately instead of asking first. Discarded changes cannot be recovered |

### Display

| Setting | Meaning |
| --- | --- |
| *Changed files shown* | 0 lists every changed file |
| *Show folders* | Print each changed file's folder under its name |
| *Commits shown* | How many recent commits the log section lists |
| *Re-read every* | Minutes between extra reads of the repository, on top of following the Git plugin's own updates. 0 — the default — follows those updates only, which already covers everything done inside Obsidian |

Per-file diffs are available from the card.

---

## Jira filter

**What it shows:** issues from a saved Jira filter or a JQL search.

**Requires:** a Jira Cloud or Jira Server instance reachable over HTTPS, and a
personal access token.

| Setting | Meaning |
| --- | --- |
| *Jira host* | The Jira site origin, for example `https://jira.example.com`. HTTPS is required when sending a personal access token |
| *Personal access token* | A bearer PAT used for this card. Stored in Hearth's plugin data |
| *API base path* | A relative Jira REST path such as `/rest/api/latest`. Full URLs are rejected |
| *Saved filter* | Load your favourite Jira filters, then choose one |
| *Filter controls* | Which controls the card offers for narrowing the list |
| *Max results* | The most issues to show, up to 200 |
| *Auto-refresh (minutes)* | How often to refresh. 0 refreshes only when the card is opened or refreshed by hand |
| *Cache interval (minutes)* | How long successful Jira responses stay in memory. 0 disables caching |

Issues can be filtered by status, assignee, priority, type, sprint and version.

Favourite filters cannot be loaded while *Disable external calls* is on, and the
card says so. If loading fails, check the host, the API path and the token.

**The personal access token is never included in an export.** See
[chapter 16](16-sharing-and-gallery.md).

---

## RSS feed

**What it shows:** headlines from any RSS 2.0 or Atom feed.

**Requires:** network access.

### Feeds

Each feed has an optional name and a URL. There is also an **Add from GitHub**
helper: enter a repository as `owner/repo`, or paste its URL, choose
**Releases**, **Commits** or both, and Hearth builds the Atom feed URLs for you.

*Combined "All" tab* adds a leading tab that merges every feed into one stream,
newest first.

### Display

| Setting | Meaning |
| --- | --- |
| *Layout* | **List** (title and date), **Cards** (excerpt and image), or **Compact** (headlines) |
| *Items per feed* | How many recent items to show |
| *Auto-refresh (minutes)* | How often to refetch. 0 fetches only when opened |
| *Show images* | Show item thumbnails when the feed provides them |
| *Show excerpt* | Show a short text snippet under each item |
| *Show date* | Show each item's publish time |

With external calls disabled, the card says *Feeds are off (external calls
disabled)* rather than failing silently.

---

## Weather

**What it shows:** current conditions and a forecast, in five styles up to a
full painted sky.

**Requires:** network access. Forecasts come from
[Open-Meteo](https://open-meteo.com) — free, key-less, no account. Only the
coordinates you pick are ever sent.

### Location

You can find a place by name — Hearth stores the coordinates on the card, so the
lookup happens once — or type latitude and longitude in decimal degrees
yourself. There is also a *Reuse a location* picker offering places already set
on your other weather cards, and a *Label* for what the card calls the place.

Place search is unavailable while external calls are disabled; entering
coordinates by hand still works.

### Style

| Style | What it draws |
| --- | --- |
| *Minimal* | A glyph and a temperature |
| *Compact* | One row |
| *Detailed* | A grid of metrics |
| *Forecast* | An hourly curve |
| *Artistic* | An edge-to-edge painted sky that follows the real conditions and time of day |

*Animate the sky* adds drifting clouds, falling rain and twinkling stars. It is
always off in low power mode.

Clicking a card opens the full forecast, hour by hour.

### Units

Temperature in Celsius or Fahrenheit; wind speed in km/h, m/s, mph or knots;
precipitation in millimetres or inches; time in 12-hour, 24-hour or automatic
(locale) format.

### What to display

Individually switchable: place name, condition, feels-like, today's high and
low, humidity, wind, precipitation (chance of rain, how much has fallen, and
per-hour chances), UV index, pressure, sunrise and sunset, and last updated.

*Hours ahead* sets how many hours the hourly strip covers (0 hides it) and *Days
ahead* how many days the daily forecast covers (0 hides it). *Auto-refresh
(minutes)* sets how often the forecast is refetched; 0 fetches only when opened.

### The weather sky as a background

The same painted sky can be used as the whole board's background, which is a
separate feature described in [chapter 11](11-appearance.md). A sky pinned to
one fixed condition needs no location at all and never goes online.

---

## The four Operon cards

**What they show:** four different views onto [Operon](https://github.com/hasanyilmaz/operon):
a **task list**, a **status board** (Operon's pipeline statuses as columns), an
**agenda** covering the next few days, and the running **timer**.

**Requires:** the Operon plugin, desktop only, Obsidian 1.12.2 or newer, and an
approval step inside Operon. See [chapter 14](14-integrations.md) for the
connection setup, which is the one integration that needs an action from you.

All four read through Operon's own in-process Developer API, so recurrence,
statuses, priorities and completion stay Operon's to define. Hearth never parses
Operon's notes.

### Common settings

| Setting | Meaning |
| --- | --- |
| *View* | Task list, Status board, Agenda or Timer |
| *Scope* | Use one of Operon's own scoped views — *All tasks*, *Happening today*, *Overdue*, *Recently touched* — or **Custom filters** |
| *Tasks shown* | Maximum tasks in the list, or per board column |
| *Days ahead* | Agenda only: how many days it covers, including today |
| *Sort* | **Smart (date, priority, age)**, **Date**, **Priority**, **Created** or **Alphabetical**, with a direction toggle. Open tasks always come before completed ones |

Handing the question to one of Operon's own scopes means Operon decides what
counts as overdue or happening today, so the card stays correct as Operon's own
rules evolve.

### Custom filters

With *Scope* set to **Custom filters**, the card filters by *Pipelines*,
*Statuses*, *Priorities*, *Completion* (Open, Done, Cancelled — open only by
default) and a free-text *Text match* against the task description. Selecting
nothing in a picker means "all".

The pickers are populated from what Operon actually has, so a card added before
the connection is live shows *Add an Operon card to the board first to load
these options*.

### What each task row shows

Individually switchable: dates, priority, status, a recurring marker, a running
timer marker, a pinned marker, and the note name.

Clicking a task opens its note at the exact line.

### Making changes

Reading is the default. Writing is a choice, switched on at **Settings → Hearth
→ Integrations → Operon → Allow changes**.

With changes allowed:

- the board card lets you drag a task into another status column, or pick one
  from the row's right-click menu so it works without a mouse,
- every card grows a **+** that creates a task where Operon's own settings say
  new tasks go.

Hearth previews the change, Operon rates it and applies it, and anything more
than routine is confirmed with you first, in Operon's own words. A move carries
the status the board was drawn from, so a drag onto a stale board is refused
rather than quietly undoing someone else's change.

*New tasks* on the card chooses what the **+** asks Operon to make: **Operon's
default** (following Operon's own settings), **Inline, in a note**, or **Its own
note**. Where the task actually goes is Operon's decision either way. If Operon
is set to ask where each new inline task goes — which a dashboard card cannot
answer — the card tells you to choose *Its own note* instead.

### Empty and error states

The Operon cards are unusually explicit about why they are not showing anything:
*Enable the Operon plugin*, *The Operon integration is off*, *Operon's developer
API is desktop-only and needs Obsidian 1.12.2 or newer*, *Approve Hearth in
Settings → Operon → Core → General → Developer API Integrations*, *Operon
suspended Hearth's access*, *Operon access was revoked*, *Operon is still
starting up*, and *Operon refused the connection*, with Operon's own error text
shown underneath.

---

## Plugin view (beta)

**What it shows:** another plugin's registered side-panel view, hosted inside a
card — a calendar, an outline, a tag pane, a Kanban board.

**Requires:** any plugin that registers a view.

| Setting | Meaning |
| --- | --- |
| *View to host* | A registered view from a core or community plugin. The list depends on which plugins are enabled |
| *File to show* | Optional. Open a specific vault file in the hosted view — an Excalidraw drawing, a canvas, a note. Leave empty to host the view without a file; some views then show a blank or "new file" screen |
| *Hide view header* | Hide the hosted view's own breadcrumbs, back/forward arrows and menu. Handy when the card shows a single file |

The card can also be pinned to one file, which is what makes it useful for a
specific drawing or PDF.

### The performance warning, in full

This is by far the heaviest card Hearth has. It runs another plugin's full view
live inside the dashboard, so it keeps that plugin's own timers, listeners and
rendering going for as long as the board is open, and **every one of these cards
costs again**. Use one or two at most, and expect a slower dashboard on modest
hardware.

Hearth's performance tier cannot slow this card down, because a hosted view
manages itself. If you have stepped the tier down and the dashboard still feels
heavy, this is the one card worth removing.

### Beta status

Some views expect to live in a sidebar and may render or size oddly inside a
card. If you want a hosted view at full size, consider a **plugin view
dashboard** instead, which gives the view the whole board; see
[chapter 5](05-dashboards.md).
