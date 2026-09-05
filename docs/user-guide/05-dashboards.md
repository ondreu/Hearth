# 5. Dashboards: creating, switching and configuring boards

A **dashboard** (also called a **board** in this guide) is one arrangement of
cards, with its own name, its own icon in the switcher, and its own optional
overrides for almost every visual setting Hearth has. A vault can hold as many
dashboards as you like, and switching between them is instant.

This chapter covers the dashboards themselves. Adding and arranging the cards
*on* a dashboard is [chapter 6](06-arranging-cards.md).

## The dashboard switcher

The switcher is the strip of small buttons in the top-left of the Home view:
`[1] [2] [3] … [+]`.

| Action | How |
| --- | --- |
| Switch to a board | Click its button |
| Create a board | Click `+` |
| Reorder boards | Drag a button |
| Open a board's settings | Right-click its button → *Dashboard settings…* |
| Duplicate a board | Right-click → *Duplicate* |
| Export a board to a file | Right-click → *Export dashboard…* |
| Import a board from a file | Right-click → *Import dashboard…* |
| Delete a board | Right-click → *Delete* (asks for confirmation and names how many cards go with it; this cannot be undone) |

A new dashboard is named *Dashboard N* by default. A duplicate is named
*<original> copy*.

## Switching with the keyboard

Several commands are bindable under **Settings → Hotkeys**:

- **Switch to dashboard 1 … 9** — changes the active board.
- **Open dashboard 1 … 9** — changes the active board *and* brings Hearth up.
  This is the useful one: it means jumping to a particular board from anywhere
  in the vault is a single shortcut, whether or not Hearth is currently in
  front.
- **Next dashboard** and **Previous dashboard**.
- **Open home dashboard** — opens Hearth on whichever board is active.

## Dashboard settings

Open with a right-click on the switcher button, or with *Dashboard settings* in
the Arrange toolbar. The dialog has up to six tabs.

### General tab

| Setting | Meaning |
| --- | --- |
| *Name* | What this board is called in the switcher and in exports |
| *Dashboard type* | **Cards** (the normal board) or **Plugin view** (see below) |
| *Switcher icon* | An emoji or short text on the switcher button. Empty shows the number |
| *Switcher Lucide icon* | A Lucide icon such as `home`, `star`, `layout-dashboard`. Takes precedence over the emoji |
| *Linked workspace* | Automatically switch to this dashboard when the named Obsidian workspace loads. Requires the core Workspaces plugin |
| *Default on mobile* | Open this dashboard when Hearth loads on a phone or tablet. Only one board can hold this; enabling it clears it on the others |

### Header tab

Everything about the title block and the search row on this one board. Each
control offers an explicit *Use global default* option, and tells you what the
global default currently is.

- *Title visibility*, *Title text*, *Title icon*.
- *Title alignment* (default centre, left, centre, right), *Title size*, *Title
  icon size*, *Title top margin*, *Spacing below title/header*.
- *Accent colour on the title* — which parts of this board's brand mark follow
  the theme's icon colour: neither, the icon, the title, or both. Hearth's tab
  and ribbon icons keep following the vault-wide setting.
- *Search visibility*, *Search placeholder*.
- *Button beside search* (shown or hidden), *What that button does* (new note or
  search online), *Button label*.
- *Filter chips* — which file-type chips this board offers.

### Layout tab

- *Content width* and *Full width* — override the vault-wide width ceiling.
- *Fit to page* — override whether this board scrolls.
- *Compact spacing* — override the vault-wide spacing.
- *Stack when narrow* — whether this board reflows into one full-width column
  when the pane is too narrow for the free-form layout, or keeps the scaled
  layout.
- *Arrange button* and *Dashboard switcher* — always visible, or fade in on
  hover, on this board.

### Style tab

Per-board overrides of the card surface: *Card opacity*, *Card blur*, *Card
corner radius*, *Card border*.

### Background tab

A per-board override of the whole background: type (none, Hearth default, solid
colour, vault image, image URL, live weather sky), the value, *Opacity*,
*Blur*, *Background layout* (full or banner), *Banner height*, *Fade the lower
edge*, *Full width*, and *Animate the sky*. Choosing *Follow the global setting*
drops the override.

Backgrounds in detail are [chapter 11](11-appearance.md).

### Plugin view tab

Only relevant when *Dashboard type* is **Plugin view**. See the next section.

## Plugin view dashboards

Setting a board's *Dashboard type* to **Plugin view** stops it being a grid of
cards. The whole board becomes one other plugin's view — your RSS reader, a
Kanban board, a Canvas, the outline — at full size and fully working, with the
switcher, header and background still around it.

The point is reachability. The reader you check twenty times a day becomes one
click from your task board, instead of a tab you have to find your way back to.

### Choosing the view

On the board's **Plugin view** tab, *View* lists every view the application has
registered right now, so it follows which plugins are enabled. Obsidian's own
document surfaces are in the list too — Markdown, PDF, image, audio, video —
which means a specific note, drawing or PDF can *be* a dashboard.

Beside the view picker is a *File* picker. Some views need a file (a PDF viewer
has to be told which PDF); others are happy without one and will say so. A full
board has the room for both pickers side by side.

### The other plugin-view settings

| Setting | Meaning |
| --- | --- |
| *Hide the view's own header* | Drops the hosted view's breadcrumbs, back/forward arrows and kebab menu. Its own toolbars and tabs are untouched |
| *Keep running in the background* | Stay loaded while another dashboard is showing, so coming back is instant instead of a reload. Turn it off for a heavy plugin you would rather not leave running |
| *Let the view take focus (experimental)* | Make this the active pane while you work in it, so the plugin's own commands and hotkeys find it. Obsidian also opens notes into the active pane, so a link you click may replace the view until you switch boards |

### Edge to edge

A plugin board gives the hosted view the whole pane: no page gutter, no card
frame, no toolbar row. The only chrome left is the switcher strip across the top
with the board's settings gear at the end of it. The title and search start
hidden for the same reason. All of that is an ordinary per-board override you can
switch back on.

A plugin board also always fits the pane rather than scrolling, because the
hosted view fills it and scrolls itself.

### Switching is instant

A plugin board stays loaded while another board is showing rather than reloading
from cold. Up to three boards are kept warm at a time, and a heavy plugin can opt
out per board with *Keep running in the background*.

### Cards are kept

Turning a board into a plugin view does not throw away its cards. Switch the
*Dashboard type* back to **Cards** and they come back untouched.

### The performance cost

A hosted view is the plugin doing its full job, not a preview of it. It costs
what opening that plugin costs, and it keeps that plugin's own timers, listeners
and rendering going for as long as the board is open. Views that are slow in
their own tab are slow here too. Hearth's performance tier cannot slow a hosted
view down, because the view manages itself.

The same warning applies to the **Plugin view** *card*, which hosts a view
inside a single card rather than filling a board; see
[chapter 10](10-cards-integrations.md).

## Pinned cards

A card can be **pinned to all dashboards**. A pinned card appears on every
board, sharing one definition and one position — edit it on any board and every
board sees the change. This is set on the card's own settings, under *Pin to all
dashboards*.

Pinning is the right tool for a clock, a search bar, or a launchpad you want
present everywhere. It is the wrong tool for anything you want to differ between
boards; for that, use *Copy to dashboard* on the card instead, which drops an
independent duplicate at the end of another board.

## How many dashboards should you have?

There is no limit and no cost to an unused board beyond the space it takes in
your settings file, but there are two costs worth knowing:

- A **plugin view** board with *Keep running in the background* on keeps another
  plugin loaded. Up to three boards are kept warm at once.
- Every board's cards are stored in Hearth's plugin data, which syncs with your
  vault.

A common arrangement is three or four boards: a home board with search and
launchers, a work board, a planning board with calendars and tasks, and one
plugin-view board for whatever plugin you live in.

## Picking up changes made on another device

If you sync your vault, Hearth can apply dashboard changes made on another
device as soon as sync brings them in, rather than at the next Obsidian restart.
That is *Pick up synced changes* under **Settings → Hearth → Behaviour →
Startup & tabs**, and it is on by default. Turn it off only if a board reloading
mid-session gets in your way.
