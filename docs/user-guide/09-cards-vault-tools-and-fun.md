# 9. Cards for vault insight, tools and fun

This chapter documents three categories from Hearth's Add card picker: **Vault
insight** (Query, Search bar, Vault statistics, Activity heatmap), **Tools**
(Links / launchpad, Commands, Text / jot-down, Calculator, Web page) and **Fun**
(Pet).

Cards are added with **Arrange → Add card** in Hearth's Home view and configured
from each card's own gear button while arranging; see
[chapter 6](06-arranging-cards.md).

---

# Vault insight

## The Query card

**What it shows:** a saved search, kept live.

**Requires:** nothing.

The Query card runs one query and lists what matches, refreshing as the vault
changes.

| Setting | Meaning |
| --- | --- |
| *Query* | The same syntax as Hearth's search bar: plain text matches names and bodies, `#tag` matches tags, `key:value` matches a frontmatter property |
| *Display* | **List** (compact) or **Tiles** |
| *Max results* | The most matches to show at once |

Example queries: `#project`, `status:active`, `meeting notes`.

Empty states: *Set a query in card settings*, and *No matches*.

---

## The Search bar card

**What it shows:** a search field on the board — the same search Hearth's header
offers, placed wherever you want it.

**Requires:** nothing.

| Setting | Meaning |
| --- | --- |
| *Placeholder* | Text shown in the empty field. Leave blank to use the vault-wide one |
| *Filter row* | Show the file-type chips under the field. They need a taller card to sit in |
| *Filter chips* | Which chips this card offers. A chip only appears when the vault actually holds that kind of file |
| *Button* | An action button beside the field: **None**, **New note**, or **Search online** |
| *Seamless* | Drop the card frame — no border, background or title row — so this reads as a standalone search bar on the board rather than as a card |

The field is as thick as the card is tall, so you set the bar's chunkiness by
dragging the card's edge in arrange mode.

A chip hidden vault-wide under *Settings → Hearth → Search → Search filters* is
hidden for every search bar, and the card says so.

The *New note* button here obeys the same *The "New note" button* settings as
the header's; see [chapter 4](04-search.md).

---

## The Vault statistics card

**What it shows:** counts describing your vault — notes, attachments, folders,
tags, and a daily-note streak.

**Requires:** nothing. The day-streak statistic only appears when daily notes
are set up.

By default the card shows a sensible built-in set. Turning on *Advanced* opens
three further controls:

| Setting | Meaning |
| --- | --- |
| *Stats to show* | Pick which built-in statistics appear |
| *Attachment breakdown* | Add a separate count tile for each selected file type — images, PDFs, and so on |
| *Custom counts* | Each row counts the files matching a query and shows the total as a tile |

A custom count has a label, an icon, and a query. Query syntax matches the search
bar: `#tag`, `key:value` for a property, or plain text. For example, a tile
labelled "Active projects" with the query `status:active`.

---

## The Activity heatmap card

**What it shows:** a year of vault activity, day by day, as a grid of coloured
squares — or, in advanced mode, any metric you define.

**Requires:** nothing.

### Simple mode

| Setting | Meaning |
| --- | --- |
| *Metric* | **Notes edited** or **Notes created** |
| *Weeks* | How many weeks of history to show |

### Advanced mode

Turning on *Advanced* lets you build your own metric out of three parts.

**Which date a note lands on** — *Day comes from*:

- **Date modified** (the file's own modification time),
- **Date created** (the file's own creation time),
- **A frontmatter date**, where you name the property. It accepts a date, a date
  and time, or a `[[daily note]]` link; a list counts once per entry. Notes
  without the property are skipped.

**What each note contributes** — *Each note adds*:

- **1 (count the notes)**, or
- **A number from a property** — minutes read, pages written, kilometres run.
  You name the property. Notes whose value is not a number are skipped rather
  than counted as one.

*Unit* names what one unit is when a day is described — "5 workouts". Leaving it
blank follows the metric.

**Which notes count at all** — *Which notes count* is a list of rules. With no
rules, every note counts. Each rule tests a **Property**, **Tag**, **Folder** or
**Path** with one of these operators: *is*, *is not*, *contains*, *does not
contain*, *is more than*, *is less than*, *is set*, *is not set*. The rules are
combined with *Match: All rules (AND)* or *Any rule (OR)*.

Example: count only notes in `Journal/` that carry a `words` property, summing
that property, to draw a writing-volume heatmap.

---

# Tools

## The Links / launchpad card

**What it shows:** a grid of buttons, each opening a note, a URL or a command.

**Requires:** nothing.

Each link has a **label**, an **icon**, and a **target**. The target is one of:

| Type | Target |
| --- | --- |
| **Note** | A note path in your vault |
| **URL** | Any web address |
| **Command** | Any Obsidian command, chosen from a picker |

The icon field accepts a Lucide icon id (`home`, `star`, `calendar` — browse
them at lucide.dev/icons) or the vault path of an image such as
`Attachments/icon.png`, so you can use your own picture as a button icon.

Links can be reordered with move up and move down, and removed.

### Button sizing

The Links card, the Commands card and the New note from template card share a
sizing model, documented in full in [chapter 6](06-arranging-cards.md). In
summary: *Button sizing* is either **Fill the card** (buttons grow and shrink
with the card, down to a *Minimum button size*, after which the card scrolls) or
**Fixed size (legacy)**. Each button can be made two or three cells wide or tall
by dragging its bottom-right corner in arrange mode, in half-cell steps.

*Auto-shift tiles (beta)*, off by default, makes tiles shove each other aside as
one is dragged, the way phone widgets do. With it off, tiles are pure free-form
and may overlap.

---

## The Commands card

**What it shows:** buttons that run Obsidian commands.

**Requires:** nothing.

This is the Links card narrowed to one target type. Each entry is a command
chosen from a picker, with an optional label, an optional icon and an optional
per-tile size in pixels.

*Button size* sets the default tile size; individual tiles can be resized by
dragging their bottom-right corner. *Auto-shift tiles (beta)* behaves as it does
on the Links card.

---

## The Text / jot-down card

**What it shows:** a quick Markdown scratchpad.

**Requires:** nothing.

The text is stored with the card, not in a note. That makes it right for a
running list you do not want to file anywhere, and wrong for anything you need
to search or link to.

Because the text lives on the card, it is one of the things Hearth removes when
you export a board with *Leave out my private information* on, and it is always
removed when you publish to the gallery; see
[chapter 16](16-sharing-and-gallery.md).

---

## The Calculator card

**What it shows:** a free-text calculator in the spirit of a search box —
arithmetic, unit conversions, number bases, currency, and plain-language
queries.

**Requires:** network access for currency rates only. Everything else is
computed locally with no network and no dependencies.

You type one line and get an answer. It understands five kinds of question:

| Kind | Examples |
| --- | --- |
| Arithmetic | `2 + 2`, `3 * (4 + 5)`, `2^10`, `sqrt(16)`, `sin(30)` |
| Unit conversions | `10 km to miles`, `100 f in c`, `1 hour in minutes` |
| Plain language | `20% of 150`, `3 plus 4`, `10 squared`, `2 x 3` |
| Currency | `10 € to USD`, `$5 in czk` |
| Number bases | `FF hex to decimal`, `1010 binary to hex`, `255 to hex` |

Unit families it knows include length, mass, time, volume, area, speed, digital
storage (both decimal SI and binary IEC) and angle. It accepts scientific
notation (`1e5`, `2.5e-3`) and `**` as an alias for `^`. Currency symbols are
recognised before or after the number, so `$10` and `10€` both work.

| Setting | Meaning |
| --- | --- |
| *Angle unit* | The unit trigonometric functions assume: **Degrees** (the default, so `sin(30)` is 0.5) or **Radians** |
| *Keypad* | **Hidden**, **Basic** (digits and operations), or **Scientific** (adds functions, powers and constants) |

Currency conversion uses European Central Bank rates fetched from the free,
key-less [Frankfurter](https://www.frankfurter.app/) API. When rates are not
available — you are offline, or external calls are disabled — a currency query
says so rather than guessing.

---

## The Web page card

**What it shows:** any `http(s)` URL, in a sandboxed iframe.

**Requires:** network access.

| Setting | Meaning |
| --- | --- |
| *URL* | The page to show |
| *Trusted site* | Allow the page same-origin access — cookies and storage. This relaxes the iframe sandbox, so only enable it for sites you trust |
| *Auto-refresh* | Re-render the card every N seconds to pick up changes. 0 turns it off |

On the **Minimal** performance tier, web cards stop refreshing on their timer;
manual refresh still works.

---

# Fun

## The Pet card

**What it shows:** a small pixel-art companion that lives on your dashboard and
whose mood follows your vault activity.

**Requires:** nothing, and nothing reaches the network.

The pet is drawn, animated, and can watch your pointer. It is deliberately
consequence-free: nothing you do or fail to do can make it unwell or lose it. A
quiet vault only sends it to sleep, and any writing wakes it straight back up.

### Appearance

| Setting | Meaning |
| --- | --- |
| *Animal* | Cat, Dog, Bird, Fox, Frog or Blob |
| *Name* | What to call it. Leave empty to use the animal's name |
| *Colors* | A body colour and an accent. The outline, shading and belly are derived from the body colour. There is a reset to this animal's own colours |
| *Size* | Small, Medium or Large |
| *Eyes follow the pointer* | **Never**, **On its own card**, or **Anywhere on the dashboard**. A sleeping pet keeps its eyes shut whatever you set |
| *Show name*, *Show mood*, *Show today's activity* | What text appears under the pet |

### Mood

*Feed it with* chooses which vault activity the mood follows: **Notes edited**
or **Notes created**.

The mood thresholds are yours to set, counted in notes touched today:

| Setting | Meaning |
| --- | --- |
| *Bouncing with joy at* | Notes touched today, or more |
| *Happy at* | Notes touched today — your good day |
| *Content at* | Notes touched today. Below this the pet gets bored |
| *Falls asleep after* | Minutes with nothing touched anywhere in the vault. The pet sleeps whatever its mood; any activity wakes it again where the day left it |
| *A petting lasts* | Minutes of guaranteed happiness after you click the pet |

The mood labels you will see are: *Bouncing with joy*, *Happy*, *Content*, *A
little bored*, *Fast asleep* and *Asleep for the night*.

### Night

*At night* decides what the clock is allowed to do:

- **Nothing — only the vault matters**,
- **A bored or content pet sleeps instead**,
- **Always asleep at night**.

*Night runs from* sets the window in your local time, and the window may cross
midnight. A thin small hour is the hour, not neglect: a good day still shows as
a good day, and petting wakes the pet whatever you set here.

Clicking the pet pets it, and earns hearts.
