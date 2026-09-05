# 7. Cards for notes and files

This chapter documents the Hearth cards in the **Notes & files** category of the
Add card picker. Every card is added the same way — press **Arrange** in the
Home view, press **Add card**, and pick it — and every card is configured from
its own gear button while arranging. See [chapter 6](06-arranging-cards.md) for
the mechanics.

The eleven cards in this category are: Embedded note, Daily note, Periodic note,
Embedded image, Slideshow, Embedded canvas, Excalidraw drawing, Embedded base,
Recent files, Favorites and Bookmarks.

---

## Embedded note

**What it shows:** any note in your vault, rendered live by Obsidian on the
dashboard.

**Requires:** nothing.

This is the workhorse card. The note is rendered by Obsidian itself, so
everything in it behaves as it does in a normal pane, and the card follows vault
events without losing your cursor.

### Options

| Setting | Meaning |
| --- | --- |
| *File to embed* | A note, image, canvas or `.base` file in your vault. There is a file picker |
| *Zoom* | Scales the embedded content. Applies when you close the dialog |
| *Editable* | Edit the embedded note's text in place, saving to the vault. Markdown notes only |
| *Live preview* | Edit in Obsidian's own Live Preview editor instead of the plain raw-Markdown box, so formatting renders as you type. Off shows the raw Markdown source, edited on double-click |
| *Second file to embed* | Optional. When set, the card shows a switcher between the two views — in the header when the card has a title, or floating on hover when it does not |
| *Open button* | Show a button that opens the embedded file in its own tab. Off by default |

### Embedding a `.base` file

If the embedded file is a `.base`, two extra options appear:

- *Base view* — choose a named view from that `.base` file, or use its default
  view. Views whose names contain characters that cannot survive a wikilink are
  hidden, and the card tells you how many were hidden.
- *Hide base header* — hide the Bases view's own toolbar (its view switcher and
  filter/property controls) so that only the results show.

This requires Obsidian's core **Bases** plugin.

### Empty states

- *Pick a file to embed in settings* — no file chosen yet.
- *Enable the core Bases plugin to embed .base files*.
- *Enable the core Canvas plugin to embed canvases*.
- *Install the Excalidraw plugin to embed drawings*.

---

## Daily note

**What it shows:** always today's daily note. The note is created on first
click if it does not exist.

**Requires:** Obsidian's core **Daily notes** plugin.

Today's note is resolved from the Daily notes plugin's own date format and
folder, so it matches what the rest of your vault does. The card updates live as
you edit.

### Options

| Setting | Meaning |
| --- | --- |
| *Editable* | Edit today's note in place instead of read-only. Saves to the vault |
| *Open button* | Show a button to open today's note in the editor |

---

## Periodic note

**What it shows:** always the current week's, month's, quarter's or year's note.
Because it is always the *current* one, the card moves on by itself when the
period ends.

**Requires:** the [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes)
community plugin.

The note is resolved — and, if missing, created from your own template — by
Periodic Notes itself, so its folder, date format and template all apply. The
card updates live as you edit.

### Options

| Setting | Meaning |
| --- | --- |
| *Period* | Daily, Weekly, Monthly, Quarterly or Yearly |
| *Editable* | Edit the note in place instead of read-only |
| *Open button* | Show a button to open the note in the editor |

---

## Embedded image

**What it shows:** a picture from your vault, filling the card.

**Requires:** nothing.

This is the Embedded note card pointed at an image, with picture-specific
framing options.

### Options

| Setting | Meaning |
| --- | --- |
| *Picture fit* | *Original size*, *Fit the whole picture*, *Fill the card (crop)*, *Stretch to the card*, or *Fit the width (scroll)*. Every mode except *Original size* hands the picture the whole card, edge to edge |
| *Picture position* | Which of nine anchor points the picture sits at — top left, top, top right, left, center, right, bottom left, bottom, bottom right. When the fit is a crop, this decides which part of the picture the crop keeps |
| *Zoom* | Scales the picture inside the frame it was fitted to. Zooming a cropped picture crops in further |
| *Open button* | Show a button that opens the picture in its own tab |

---

## Slideshow

**What it shows:** pictures from a list you curate or from a folder, rotated on
a timer, once a day, or only by hand.

**Requires:** nothing.

### Choosing the pictures

*Pictures from* is either **A list of pictures** or **A folder**.

With a list, you add pictures one at a time, each with an optional caption, and
you can reorder and remove them. There is also an *Add a folder's pictures*
action that bulk-adds a folder's contents into the list.

With a folder, every image in that folder is shown, optionally including
subfolders. Leaving the folder empty means the vault root. The dialog tells you
how many images it finds there right now.

### Playback

| Setting | Meaning |
| --- | --- |
| *Order* | List order, Name A→Z, Name Z→A, Date created oldest or newest first, Date modified oldest or newest first, or Random |
| *Change picture* | **On a timer**, **Once a day**, or **Only by hand** |
| *Seconds per picture* | Timer mode only. 0 holds the first picture and turns rotation off |
| *Days per picture* | Daily mode only. 1 changes at midnight; 7 gives you a picture of the week |
| *Transition* | Cut (no animation), Crossfade, Slide or Zoom |
| *Transition length* | How long the transition takes, in milliseconds |
| *Slow zoom* | Drift slowly into each picture while it is shown — the "Ken Burns" effect |

The **Once a day** mode works its picture out from today's date rather than from
a running timer, so the picture stays put all day however often the board is
redrawn. Both daily and manual modes remember where they were left.

### Display

| Setting | Meaning |
| --- | --- |
| *Fit* | Fill the card (crop) or Fit the whole picture |
| *Controls* | Show previous / pause / next buttons and the position indicator, on hover. On by default |
| *Caption* | Show each picture's caption over it, falling back to its file name |
| *Pause on hover* | Hold the current picture while the pointer is over the card |
| *Open button* | Show a button that opens the picture on screen in its own tab |

Note that on the **Minimal** performance tier a slideshow holds one picture
instead of rotating; see [chapter 12](12-performance.md).

---

## Embedded canvas

**What it shows:** a canvas from your vault, interactive and edge to edge. You
can pan around it in place.

**Requires:** Obsidian's core **Canvas** plugin.

This is the Embedded note card pointed at a `.canvas` file.

---

## Excalidraw drawing

**What it shows:** an Excalidraw drawing, with native pan and zoom.

**Requires:** the [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin)
community plugin.

Drawings render live. Hearth also exposes a *Create new Excalidraw drawing*
command and a mobile action button for it; both run Excalidraw's own "new
drawing" command rather than reimplementing it.

---

## Embedded base

**What it shows:** a `.base` file, rendered by Obsidian's own Bases.

**Requires:** Obsidian's core **Bases** plugin.

See *Embedding a `.base` file* under [Embedded note](#embedded-note) above for
the *Base view* and *Hide base header* options.

---

## Recent files

**What it shows:** the files you opened most recently.

**Requires:** nothing.

### Options

| Setting | Meaning |
| --- | --- |
| *Fit to card height* | List as many files as the card is tall enough to show, instead of a fixed number. Resizing the card then changes how many appear |
| *Number of files* | How many recently-opened files to list, when not fitting to height. There is a ceiling, which is as far back as Hearth's recent-file history goes |
| *File types* | Only list files of the selected types. Pick any combination; selecting none shows every type |

If you use Iconic or Iconize, each file shows its own icon here. See
[chapter 14](14-integrations.md).

---

## Favorites

**What it shows:** the notes you have starred in Hearth.

**Requires:** nothing.

Favorites are Hearth's own list, separate from Obsidian's Bookmarks.

By default every Favorites card shows one vault-wide list, which is edited from
the card's settings (*Add favorite*, plus move up, move down and remove).

A single card can be given a list of its own with *Give this card its own list*.
Turning it on starts from the list the card is showing now; turning it back off
drops the card's own list and returns it to following the vault-wide favourites.

---

## Bookmarks

**What it shows:** your Obsidian bookmarks, groups and all, with site favicons
for bookmarked URLs.

**Requires:** Obsidian's core **Bookmarks** plugin.

The card reads Obsidian's bookmarks directly, so anything you bookmark anywhere
in the app appears here.

---

## Common behaviour across these cards

**Where a clicked note opens** is governed by **Settings → Hearth → Behaviour →
Opening notes**. There is a general *Open notes in* choice and a per-source
override for *Notes in cards*, which covers the Recent, Bookmarks, Favorites,
Calendar, Heatmap and Tasks cards.

**Liveness.** Embedded and editable notes follow vault events without losing
your cursor. The Recent, Bookmarks and saved-query cards update as the vault
changes if *Live refresh on vault changes* is on under **Settings → Hearth →
Behaviour**. Switching back to the Hearth tab always refreshes it regardless of
that setting.

**Headerless cards.** Leaving a card's *Title* empty draws it without a header
row. For image, slideshow, canvas and drawing cards this is usually what you
want: the picture then fills the card completely.
