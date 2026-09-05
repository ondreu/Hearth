# 8. Cards for planning: tasks, calendars and clocks

This chapter documents the Hearth cards in the **Planning** category of the Add
card picker: **Tasks**, **Calendar**, **Mini calendar**, and **Clock &
greeting**. These are the largest and most configurable cards Hearth has, and
the Tasks card in particular repays reading in full.

Cards are added with **Arrange → Add card** in Hearth's Home view and configured
from each card's own gear button while arranging; see
[chapter 6](06-arranging-cards.md).

---

## The Tasks card

**What it shows:** your tasks, as a list or as a drag-and-drop Kanban board.

**Requires:** nothing for Markdown checkboxes. The TaskNotes or Kanban community
plugins for those sources.

### Choosing a source

*Source* is the first decision, and it changes what the rest of the card offers.

| Source | What it reads |
| --- | --- |
| **Markdown checkboxes** | Ordinary `- [ ]` checkboxes anywhere in your vault. Works with no plugin at all |
| **TaskNotes plugin** | One-note-per-task vaults managed by the TaskNotes community plugin, read from frontmatter |
| **Kanban plugin** | A single board note from the Kanban community plugin, one column per heading |

#### The Markdown checkboxes source

Reads checkboxes from your notes. Two options shape how they are read:

- *Dates & priorities* — read the dates, priority and repeat marks written
  inline on each checkbox, in the format the
  [obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)
  plugin uses, so they show as indicators, sort the list, and can be edited from
  the item's right-click menu. Off reads checkboxes as plain text.
- *Task states (board columns)* — the checkbox states shown as columns on a
  Kanban board, one per line as `[symbol] Label`, where the symbol is the
  character inside `- [ ]`. Add `(done)` to mark a state complete. Dragging a
  card to a column writes that column's symbol. Leave it empty for the default
  set of To do, In progress and Done.

#### The TaskNotes source

TaskNotes stores each task as its own note, with the task's metadata in
frontmatter. TaskNotes has no stable API for other plugins to query, so Hearth
reads that frontmatter directly — which means it has to be told the field names.

The field names live at **Settings → Hearth → Integrations → Tasks /
TaskNotes**: *Status field*, *Due date field*, *Priority field* and the
*"Done" status value*. The defaults are TaskNotes' own defaults (`status`,
`due`, `priority`, `done`). If you renamed a field inside TaskNotes, match it
here.

The setup wizard reads these from TaskNotes for you when it builds a Tasks card;
see [chapter 2](02-getting-started.md).

On the card itself, *Statuses counted as complete* lets one card treat extra
status values as complete — one per line. Leave it empty to use just the done
value from the vault-wide settings; add, for example, `canceled` to count
cancelled tasks as complete too. Complete tasks are hidden unless *Show
completed* is on, and struck through when shown.

#### The Kanban source

Reads a single Kanban-plugin board note, one column per heading.

- *Board note* — which board to read. Leave it empty to auto-detect the first
  note in scope carrying a `kanban-plugin` frontmatter key.
- *Dates & priorities* — as above, reading the obsidian-tasks-compatible marks
  written on each card.

**Kanban write-back:** when you drag a card between columns, Hearth writes the
change in Kanban's own format, so the note stays fully editable in the Kanban
plugin. Hearth is not a second, disagreeing owner of the board.

### Layout: list or board

*Layout* is either **List** or **Kanban board**.

On a board:

- Drag cards between columns.
- Drag column headers to reorder columns.
- Use a column's eye icon to hide it.
- Use a column's check icon to make it auto-complete cards dropped into it.
- Right-click a card to convert it into its own note.

The card's settings summarise the current column state — which are hidden, which
auto-complete, whether a custom order is set — and offer *Show all* and *Reset
column order, visibility & done columns*.

Completed tasks always appear in the Done column on a board, regardless of the
*Show completed* setting.

### Dates, priorities and recurrence

With *Dates & priorities* on, Hearth understands the full obsidian-tasks mark
set: the priority marks 🔺 ⏫ 🔼 🔽 ⏬, the recurrence mark 🔁, and the date
marks 🛫 (start), ⏳ (scheduled), 📅 (due) and ✅ (done).

It renders relative labels ("Today", "Next Friday") rather than raw dates,
accepts natural-language input when you edit a date (`📅 in 3 days`), and
handles per-occurrence completion for recurring tasks — completing one
occurrence of a repeating task leaves the series intact.

### Sorting and filtering

Sorting is either a **smart chain** — due date, then scheduled date, then
priority, then created date — or a custom multi-rule sort you define. Sorting is
set per list and per Kanban column.

Other filters on the card:

| Setting | Meaning |
| --- | --- |
| *Show completed* | Include finished tasks |
| *Max tasks shown* | A ceiling. Tasks are sorted by due date (overdue and soonest first), then by file |
| *Scope* | *Whole vault*, *Only these folders*, or *Everywhere except these folders* |
| *Folders* | One folder path per line, used by the two scoped modes |

### Custom task fields

This is opt-in and off by default. Until you turn it on, tasks keep their usual
fixed look.

*Customize task fields* replaces the fixed metadata a task shows with fields you
define yourself. Turning it on starts from a blank slate: tasks then show only
the fields you add. The fields are defined vault-wide at **Settings → Hearth →
Integrations → Tasks / TaskNotes → Fields shown on a task**, and a single card
can define its own instead from that card's settings.

A field has:

- a **name** — what it is called; optionally shown on the task as a prefix
  ("Priority: Urgent"),
- a **display style** — how its values are drawn,
- one or more **keys** — where it reads from,
- optional **value mappings** — a nicer label and a colour per value.

The six display styles are:

| Style | Effect |
| --- | --- |
| *Chip* | A small pill on the task |
| *Colored dot* | A coloured dot |
| *Colored dot with label* | The form the built-in priority uses; offered to fields that read a priority |
| *Plain text* | The value, as text |
| *Tint the whole task* | Shows nothing on the task; colours the task's background |
| *Glow around the task* | Shows nothing on the task; puts a coloured ring around it |

The last two are **ambient**: a task has one background and one ring, so only
one field can use each. If a second field asks for one, Hearth says which field
already holds it and that this one will colour nothing. Both ambient styles have
a *Strength* control for how strongly the colour is laid on; only a value that
has a colour mapped affects the task at all.

**Keys.** A field can read several keys at once, so one field can gather several
pieces of metadata under one name. The pickers offer two groups: *Values Hearth
parses itself* — status (TaskNotes), board column (Kanban), priority, start
date, scheduled date, due date, done date and description — and *Properties
found in your notes*, which is anything in your frontmatter.

**Value mappings.** For a key with discrete values you can map each value to a
nicer label and a colour, chosen from the theme's eight named colours (red,
orange, yellow, green, cyan, blue, purple, pink) or a custom colour. Hearth
offers the values that key actually takes elsewhere in your vault, so you are
picking from real data. Values you do not map still show, as themselves.

**Dates.** A property can be marked *Treat as a date*, which shows it as a
relative date ("Tomorrow"), colours it by whether it falls before today, today,
or after today, and edits it with a calendar. A date has no fixed values to map,
so it is coloured by where it falls rather than by a value table.

A description key is always drawn as its own block of sub-bullets.

### Quick view

*Quick view on click* (on by default) makes clicking a task open a compact
popover — its metadata and description, editable in place, with buttons to open
the full note or delete the task — instead of jumping into the note. Turning it
off opens the note on click.

### Converting a card into a note

Right-clicking a task and choosing **Convert to note** turns an inline checkbox
into its own note, leaving a link on the board. Two settings shape this:

- *Convert-to-note template* — seed the new note from a template. Supports
  `{{title}}`, `{{date}}` and `{{time}}`. Leave empty for a blank note.
- *Scrape metadata to frontmatter* — move the card's dates, priority and repeat
  marks into the new note's YAML frontmatter instead of leaving the emoji
  markers on the board link.

*New tasks as notes* applies the same treatment up front: each new card is
created as its own note straight away rather than as an inline checkbox.

### Empty states

- *Enable the TaskNotes plugin, or switch source to checkboxes*
- *No open tasks*
- *No tasks match the filter*
- *No Kanban board found — pick a board note in card settings, or create one
  with the Kanban plugin*

---

## The Calendar card

**What it shows:** month, week, day and list views over the same set of event
sources, with a scrolling time grid, overlapping-event columns and an all-day
band.

**Requires:** nothing, but it is only useful with at least one source — the core
Daily notes plugin, or a subscribed calendar feed, or TaskNotes.

### Views and toolbar

| Setting | Meaning |
| --- | --- |
| *Opens in* | The view the card shows when the board is opened. You can switch views on the card itself at any time |
| *Views offered* | Which of the four views the card's switcher lists. Leaving all four on keeps every one a click away; offering a single view hides the switcher entirely |
| *Toolbar* | Show the navigation row — back, today, forward, the period being shown, and the view switcher. Turning it off pins the card to the current period |

### Daily notes

*Daily notes* marks days that already have a daily note, and opens (or offers to
create) that note when a day is clicked. Turning it off makes the card purely an
event calendar.

### The week

| Setting | Meaning |
| --- | --- |
| *Week starts on* | Which day the month and week grids start from. Defaults to following Obsidian's language, and tells you which day that currently is |
| *Hide weekends* | Leave Saturday and Sunday out of the month and week grids |
| *Week numbers* | Show a week-number column down the left edge |
| *Clock* | How event times are written: follow Obsidian's language, 12-hour (9:00 AM), or 24-hour (09:00) |

### Month view

- *Events shown as* — **Named chips**, which read at a glance on a card with
  room, or **Dots**, which suit a small card the way the Mini calendar draws
  them.
- *Events per day* — how many events a day cell lists before the rest collapse
  into a "+N more" link. 0 lists every one and lets the cell scroll.

### Week and day views

The time grid draws the whole day by default and opens scrolled to the first
event, so nothing can sit outside the visible hours.

| Setting | Meaning |
| --- | --- |
| *Hours drawn* | The first and last hour of the grid. Anything outside them moves to the all-day band above rather than disappearing |
| *Hour height* | How tall one hour is, in pixels. Taller shows more detail; shorter fits more of the day |
| *Current time line* | Draw a line across today's column at the current time |

### List view

*Days listed* sets how far ahead the list reaches, starting from the day it is
showing.

---

## The Mini calendar card

**What it shows:** a compact month grid or an agenda, with dots for days that
have notes, ISO week numbers, and an optional edit heatmap.

**Requires:** Obsidian's core **Daily notes** plugin for the daily-note
features. Calendar subscriptions and TaskNotes are optional extras.

Mini calendar and Calendar overlap, but they are different cards with different
option sets. Mini calendar is the one that carries external calendar
subscriptions and the event-note builder.

### Layout

| Setting | Meaning |
| --- | --- |
| *Layout* | **Month grid** or **Agenda** |
| *Days ahead* | Agenda only: how many days the agenda lists, starting from today |
| *Week numbers* | Show an ISO week-number column down the left edge |
| *Heatmap* | Tint each day by note activity that day |

### External calendar subscriptions

*External calendars* subscribes the card to ICS/iCal feeds — Google, iCloud,
Fastmail, Nextcloud and anything else that publishes one. Events appear as
coloured dots on the grid and are listed in the agenda view.

Each subscription has a name, a URL (`https://` or `webcal://`), and a
show/hide toggle. *Refresh every* sets how often feeds are re-fetched, in
minutes; 0 fetches only when the card opens.

Feeds are network requests, so they are silenced by *Disable external calls*;
see [chapter 17](17-privacy-and-network.md).

### TaskNotes as a source

If the TaskNotes community plugin is enabled, the Mini calendar can draw
TaskNotes items. The card mirrors what TaskNotes' own calendar shows, using
TaskNotes' own field names, statuses and colours.

| Setting | Meaning |
| --- | --- |
| *Use TaskNotes* | Draw TaskNotes items on this calendar |
| *Scheduled tasks* | Tasks on their scheduled date, sized by their time estimate |
| *Due dates* | Tasks on their due date |
| *Recurring tasks* | Unroll a recurring task into one entry per occurrence. Off shows only its next date |
| *Timeblocks* | Timeblocks written into your daily notes |
| *Show completed* | Keep finished tasks on the calendar, struck through |
| *Show archived* | Include tasks carrying TaskNotes' archive tag |
| *Complete from the calendar* | Offer a completion box on each task, writing back exactly what TaskNotes writes, per-occurrence for recurring tasks |
| *TaskNotes calendars* | Also show the calendars subscribed inside TaskNotes itself |

Each of these toggles reports what TaskNotes currently has set, and offers a
*Follow TaskNotes* reset.

Task colours come from *Colour by*: **TaskNotes status**, **TaskNotes
priority**, or **One fixed colour**. There are separate optional colours for
due-date entries and for timeblocks that carry no colour of their own.

### Operon tasks

If the Operon integration is connected, *Show Operon tasks* marks days that have
an Operon task due and lists those tasks in the agenda, in a colour you choose.
It reads through Operon's developer API, so Operon must have approved Hearth;
see [chapter 14](14-integrations.md). Tasks that are only scheduled, with no due
date, are not included.

### Entry details

*Entry details* chooses what each agenda entry shows beside its title. On a
narrow card the markers compete with the title itself, so these are worth
pruning.

| Chip | Shows |
| --- | --- |
| *Time* | The start time, or "All day" |
| *Calendar name* | Which calendar an entry came from. Only ever shown when there is more than one source |
| *Status* | A task's TaskNotes status, for example "In progress". Off by default |
| *Priority* | A task's TaskNotes priority, for example "High" |
| *Due marker* | The "Due" badge on a due-date entry |
| *Recurring marker* | The "Recurring" badge on a repeating task |
| *Timeblock marker* | The "Timeblock" badge on a timeblock |

### Creating a note from an event

The event popup can offer a **Create note** button, which turns a calendar event
into a note in your vault. This is configured under *Event notes*:

| Setting | Meaning |
| --- | --- |
| *Show "Create note"* | Offer the button in the event details popup |
| *Folder* | Where new event notes are created. Empty means the vault root |
| *Filename* | The note name. Placeholders include `{{summary}}`, `{{date}}`, `{{start}}`, `{{location}}` |
| *Template* | An optional note whose contents seed the body. The same `{{…}}` placeholders are substituted |
| *Link property* | A frontmatter property that stores the event's ID, so an event always maps to one note. Empty disables linking |
| *Customise field routing* | Off uses sensible defaults — date and time as properties, description in the body. On lets you route each value yourself |

With field routing on, each event value — Name, Date, Start time, End time,
Location, Description, URL, Calendar — can be **ignored**, written as a
**property** (with a property name and an optional format such as `HH:mm`), or
**appended to the body** under an optional heading.

---

## The Clock & greeting card

**What it shows:** the time, the date, and an optional greeting.

**Requires:** nothing.

### Options

| Setting | Meaning |
| --- | --- |
| *Style* | **Digital** or **Analog** |
| *Time format* | Automatic (from your locale), 12-hour, or 24-hour |
| *Show seconds* | Include seconds, and on the analogue face a sweeping second hand |
| *Show greeting* | Show a greeting line |
| *Playful greetings* | Cheeky, randomised greetings instead of the plain ones |
| *Greeting override* | Fixed text of your own. Leave empty for the automatic greeting |
| *Date* | Weekday-day-month; Weekday-day-month-year; Short (locale); ISO (2026-06-29); Weekday only; a custom format; or Hidden |
| *Custom date format* | A moment.js format string, for example `ddd D MMM` or `YYYY/MM/DD` |

On the **Reduced** and **Minimal** performance tiers, clock cards drop seconds
and the sweeping second hand; see [chapter 12](12-performance.md).
