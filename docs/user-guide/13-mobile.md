# 13. Hearth on a phone or a narrow pane

Hearth runs on Obsidian for iOS and Android as a first-class board, not as a
reduced version of the desktop one. It also applies the same treatment to a
narrow pane on the desktop, because the problem is the same: a free-form layout
stops meaning anything below a certain width.

Everything in this chapter except the per-card options lives under **Settings →
Hearth → Mobile**.

## The threshold is width, not platform

A Hearth board is laid out freely: cards sit where you drop them, at a fraction
of the board's width. At or below **600 pixels** of measured board width that
stops working, so the board **reflows into a single full-width column**, top to
bottom, in the order the desktop board reads in.

The threshold is the **measured width of the board**, not the platform. So:

- a phone gets the stacked column,
- a narrow split pane on the desktop gets the same stacked column,
- and you can see your phone layout on your desktop simply by dragging a pane
  narrow.

**Your layout is never rewritten.** The stored board is untouched and comes back
at full width. The same board is a launcher on your phone and a wall of cards on
your monitor.

## The stacked column

*Stack cards on narrow screens* under **Settings → Hearth → Mobile → Layout** is
on by default. Turning it off keeps the free-form layout at any width, scaled
down.

Each dashboard can override this from *Dashboard settings → Layout → Stack when
narrow*: **Stack into one column** or **Keep the scaled layout**.

While stacked, cards are full width, one per row.

## Per-card behaviour in the column

Every card's settings has an *On a narrow board* section on its **Layout** tab
with four options. These are the tools for turning a desktop board into a
readable phone board without maintaining two boards.

| Option | Meaning |
| --- | --- |
| *Hide* | Leave this card out of the stacked column entirely. For a card that needs width to make sense — a wide table, a Kanban board — hiding beats squeezing |
| *Start collapsed* | Show only the card's title row, and build the card when it is tapped open. A card nobody opens costs one row and runs nothing |
| *Height* | Height in pixels when stacked. Left empty, the card keeps its own height (falling back to 184 pixels if it has none), clamped to at least 56 pixels and at most 420, so a tall card cannot fill the screen on its own |
| *Position* | Where this card comes in the stack, counting from 0. Left empty, it follows the order the board reads in: top to bottom, left to right |

*Start collapsed* is the important one for performance. An expensive card — a
Dataview query, an embedded note, a hosted view — costs one row and runs nothing
until it is tapped.

In arrange mode, a card's header also carries a **Hide on a narrow board** /
**Show on a narrow board** toggle, which is the same setting reached faster.

## Previewing the phone layout without a phone

Press **Arrange → Preview at phone width**. Hearth builds and shows the stacked
board inside a drawn phone, so the proportions read properly rather than being a
narrow strip in a wide window.

While in the preview you can:

- drag a card's bottom edge to set its stacked height,
- use the **move up** and **move down** buttons in a card's header to reorder the
  column.

Leave the preview with **Leave phone preview**.

## What else changes on a narrow board

- **Edge to edge.** The side gutters go; the device's safe-area insets stay.
- **Tap targets.** Filter chips and search results grow to 44-pixel tap targets.
- **Full-width search.** The chips and results span the screen instead of the
  search bar's share of it, and the button beside the field drops to an icon.
- **Keyboard-aware.** The visible area tracks the on-screen keyboard, so the
  field you are typing in is not hidden behind it.

## A separate performance tier

Phones draw the animated sky and the frosted glass on the smallest screen and
pay for it out of a battery, so Hearth keeps a separate tier for them.

*Performance tier on mobile* defaults to **Balanced** and can also be set to
*Match desktop*. Your desktop tier is stored separately and is never changed by
this one. See [chapter 12](12-performance.md).

## Choosing which board opens on a phone

A dashboard's *Default on mobile* setting (on its **General** tab) makes Hearth
open that board when it loads on a phone or tablet. Only one board can hold this;
turning it on clears it on the others.

This is how you keep a dense desktop board and a spare phone board in the same
vault without switching by hand each time.

## Mobile mode: search only

*Mobile mode (search only)* under **Settings → Hearth → Mobile → Layout** is a
different proposition from the stacked column. It hides the dashboard entirely
on phones and tablets and shows **only the search field**, turning Hearth into a
pure launcher on a phone. It has no effect on desktop.

It is off by default. Use it if the dashboard is a desktop thing for you and the
phone is for finding notes.

## The mobile action bar

In Mobile mode (search only), a row of buttons replaces the *New note* button
beside the search bar, appearing under the search field and filters instead.

*Show action bar* switches the row on; it is on by default.

The default buttons are **New note**, **New drawing**, **Record voice** and
**Open daily note**. Each button can be changed to run any command, open a note
or file, or open a URL — exactly like a launchpad tile. Each has a label and an
icon, and buttons can be reordered, removed, added, and reset to the defaults.

Three of the defaults depend on other plugins:

- *New drawing* runs the Excalidraw plugin's own "new drawing" command.
- *Record voice* starts and stops Obsidian's core Audio recorder.
- *Open daily note* uses Obsidian's core Daily notes plugin.

If one of those is not enabled, Hearth says which plugin to enable rather than
failing silently.

## Its own settings category

All of the above lives under **Settings → Hearth → Mobile**, which is a category
of its own rather than two sections buried in Behaviour. Hearth runs on a phone
as a first-class board, and the settings pane says so.

## Exporting on mobile

One mobile-specific detail worth knowing: on mobile, an export file is saved to
your vault's root folder rather than downloaded, because mobile Obsidian has no
download folder. Hearth tells you the filename it saved. See
[chapter 16](16-sharing-and-gallery.md).

Publishing to the dashboard gallery needs a screenshot of the board, and
screenshots need the desktop application. You can still save a dashboard as a
file on mobile and publish it later from a desktop vault.
