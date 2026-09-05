# 3. The anatomy of the Home view

This chapter names every part of the Hearth Home view, so that the rest of this
guide can refer to them without ambiguity. Read it once and the vocabulary in
the other chapters will be obvious.

The Home view is an ordinary Obsidian view. It lives in a tab, it can be split
and moved like any other tab, and Obsidian's own tab header sits above it
carrying the Hearth crystal (or a Lucide icon of your choosing) and the view
name, *Home*.

Inside the tab, from top to bottom:

## 1. The dashboard switcher (top-left)

A strip of small buttons, `[1] [2] [3] … [+]`. Each button is one dashboard.
Clicking a button switches the board. The `+` button creates a new dashboard.

Each button shows the dashboard's number by default. You can give a dashboard an
emoji or a couple of characters instead, or a Lucide icon, which takes
precedence over the emoji. You can drag the buttons to reorder your dashboards.
Right-clicking a button opens a menu with *Dashboard settings…*, *Duplicate*,
*Export dashboard…*, *Import dashboard…* and *Delete*.

The switcher can be set to stay always visible, or to fade in only when you move
the pointer near it. That is *Settings → Hearth → Dashboard → Dashboard switcher
visibility* vault-wide, and *Dashboard settings → Layout → Dashboard switcher*
per board.

Dashboards are covered in [chapter 5](05-dashboards.md).

## 2. The Arrange button (top-right)

The button that puts the board into **arrange mode** — Hearth's edit mode. In
arrange mode the button becomes *Done arranging*, and a toolbar appears carrying
*Add card*, *Dashboard settings*, a titles toggle, a card-headers toggle, and
*Preview at phone width*.

Like the switcher, the Arrange button can be always visible or revealed on
hover, vault-wide or per board.

Arrange mode is covered in [chapter 6](06-arranging-cards.md).

## 3. The Gallery button (in the arrange toolbar)

While the board is being arranged, a **Gallery** button sits beside *Add card*.
It opens the **dashboard gallery**, where dashboards other people have published
can be browsed, rated, commented on and installed in one click, and where you
can publish your own. It is placed there deliberately: adding one card you place
yourself, and installing a whole board somebody else has already arranged, are
the same question at two scales.

The button only appears when a gallery address is configured. Clearing that
address under *Settings → Hearth → Backup → Dashboard gallery* turns the gallery
off entirely, and nothing is fetched until you open it.

The gallery is covered in [chapter 16](16-sharing-and-gallery.md).

## 4. The title block

A large heading with an optional mark beside it. The default title text is
`Obsidian`; the default mark is the Hearth crystal.

The mark accepts four different kinds of value, and works out which you meant:

- a **Lucide icon id** such as `home`, `star` or `layout-dashboard` (there is a
  search button that browses the whole Lucide set, so you do not have to
  remember ids),
- an **emoji** or a couple of characters,
- the **vault path of an image**, such as `Attachments/logo.png` (there is a
  picker button for this too),
- the **URL of an image on the web**.

The title block can be hidden entirely, aligned left, centre or right, resized,
given a top margin, and set to draw the icon and/or the title text in your
theme's icon colour instead of the default purple crystal and normal text. Every
one of those is a vault-wide setting with a per-dashboard override.

## 5. The search section

The search field, the row of file-type filter chips beneath it, and the results
dropdown that appears as you type. Optionally, an action button sits beside the
field — by default *New note*, and optionally *Search online* instead.

The whole section can be hidden vault-wide (*Settings → Hearth → Appearance →
Show search section*) and each dashboard can follow that default or override it
to show or hide the section on that board alone.

Search is covered in [chapter 4](04-search.md).

## 6. The dashboard

The board of cards. This is the bulk of the view.

### Cards

A **card** is one panel on the board. Every card has:

- a **kind** (the type of thing it shows — Tasks, Clock, Weather, and so on),
- an optional **title**, shown in a header row at the top of the card; a card
  with an empty title is drawn headerless,
- a **position and size** on the board,
- optional per-card style overrides (accent colour, background tint, opacity,
  blur, border width),
- optional per-card behaviour when the board is stacked into one column on a
  narrow screen.

Cards are live. Embedded and editable notes follow vault events without losing
your cursor, data cards redraw when the vault or its metadata changes, and web,
RSS, calendar-subscription and Jira cards refresh on their own timers.

### The board's geometry

The board is **free-form**, not a strict row-and-column grid. Cards are stored
as a position and a size, where width is a fraction of the board's width and
height is in pixels, and they can sit anywhere. When you drag a card it snaps
magnetically to the edges and centres of its neighbours and of the board itself
(the snap threshold is 8 pixels). Two cards snapped together share a border,
which drops out so that the pair reads as one continuous tile — this is called
**edge-merging**, and merged cards blur as one seamless sheet.

Because the board is free-form there is no column count to configure. Hearth
keeps an internal column count of 12 and a seed row height of 92 pixels, used
only when it has to place a newly added card for you.

### Fit to page

By default the board is set to **fit to page**: it stays on one screen and does
not scroll. Turning that off lets the board scroll. This is a vault-wide setting
with a per-board override. A dashboard that hosts a plugin view always fits the
pane, because the hosted view fills it and scrolls itself.

## 7. The background

Behind everything sits the background: nothing, a solid colour, an image from
your vault, an image from a URL, Hearth's own bundled wallpaper, or a **live
weather sky** — a painted sky that follows the real conditions and time of day
over a place you pick, or one condition pinned and kept.

The background has an opacity and a blur, and can be worn two ways: filling the
whole view, or as a **banner** strip across the top of the board with the cards
below it on your theme's own surface, the way a cover image sits above a note.

Backgrounds are covered in [chapter 11](11-appearance.md).

## Two special kinds of dashboard

Almost everything above describes a **cards dashboard**, the normal kind. There
are two variations worth knowing about now.

### Plugin view dashboards

A dashboard's *Dashboard type* can be set to **Plugin view**, at which point it
stops being a grid of cards: the whole board becomes one other plugin's view —
your RSS reader, a Kanban board, a Canvas, an outline, a specific PDF — at full
size and fully working, with the dashboard switcher, header and background still
around it. The board keeps its cards while it is in this mode, and switching it
back to **Cards** brings them back untouched.

See [chapter 5](05-dashboards.md).

### Mobile mode (search only)

An optional mode, off by default, in which Hearth on phones and tablets hides the
dashboard entirely and shows only the search field with a row of action buttons
beneath it. This is for people who want a launcher on their phone and a
dashboard on their desktop. It has no effect on desktop.

See [chapter 13](13-mobile.md).

## Where each thing is configured

This table is a map of the rest of the guide.

| Part of the view | Configured from |
| --- | --- |
| Title, title icon, tab icon, content width | Settings → Hearth → Appearance, with per-board overrides in Dashboard settings → Header |
| Search field, filter chips, action button | Settings → Hearth → Search, with per-board overrides in Dashboard settings → Header |
| Background and banner | Settings → Hearth → Appearance → Background, with per-board overrides in Dashboard settings → Background |
| Grid, spacing, card surface, chrome visibility | Settings → Hearth → Dashboard, with per-board overrides in Dashboard settings → Layout and → Style |
| One dashboard's name, icon, type, workspace link | Right-click its switcher button → Dashboard settings… |
| An individual card | Arrange → that card's gear button |
| Startup, new tabs, where notes open, privacy | Settings → Hearth → Behaviour |
| The stacked phone layout and the action bar | Settings → Hearth → Mobile, and each card's Layout tab |
