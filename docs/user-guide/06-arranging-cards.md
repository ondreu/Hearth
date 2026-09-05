# 6. Arrange mode: adding, moving, resizing and styling cards

Everything about the cards on a Hearth dashboard is edited from the board
itself, in **arrange mode**. The plugin settings page holds vault-wide defaults;
it deliberately does not hold a card editor. *Settings → Hearth → Dashboard*
says as much in a row of its own: open the Home view, hit Arrange, then use
*Add card*, *Dashboard settings* and each card's settings button.

## Entering and leaving arrange mode

Press **Arrange** in the top-right corner of the Home view. The button becomes
**Done arranging**; press it again (or press it in the toolbar) to leave.

The Arrange button can be set to stay always visible, or to fade in only when
the pointer comes near it. That is *Arrange button visibility* under **Settings
→ Hearth → Dashboard → Dashboard controls** vault-wide, and *Dashboard settings
→ Layout → Arrange button* per board.

## The arrange toolbar

While arranging, a toolbar offers:

| Control | What it does |
| --- | --- |
| **Add card** | Opens the card picker (below) |
| **Gallery** | Opens the dashboard gallery, to install a board somebody else has arranged. Only shown when a gallery address is configured — see [chapter 16](16-sharing-and-gallery.md) |
| **Dashboard settings** | Opens this board's own settings — see [chapter 5](05-dashboards.md) |
| **Show titles / Hide titles** | Toggles the display of card titles across the board |
| **Show card headers / Hide card headers** | Toggles the header rows |
| **Preview at phone width** | Builds and shows the phone layout inside a drawn phone, so you can check the stacked column without a phone — see [chapter 13](13-mobile.md) |
| **Done arranging** | Leaves arrange mode |

## Adding a card

**Add card** opens a searchable picker. Type to match a card's name or its
description, or browse the six categories down the left rail:

- **Notes & files** — embedded notes, images, slideshows, canvases, bases,
  drawings, daily and periodic notes, recent files, favourites, bookmarks.
- **Planning** — tasks, calendars, mini calendar, clock and greeting.
- **Vault insight** — saved queries, a search bar, vault statistics, an activity
  heatmap.
- **Tools** — launchpads, command buttons, a text scratchpad, a calculator, a
  web page.
- **Integrations** — Templater, Dataview, Datacore, Git, Jira, RSS, Weather,
  Operon, Plugin view.
- **Fun** — the Pet.

Cards backed by a community plugin are **always listed**, whether or not the
plugin is installed. A card whose dependency is missing is marked *Needs
Dataview* (or *Needs Git*, *Needs Operon*, and so on) and carries a one-click
link that opens that plugin in Obsidian's community plugin browser. You can add
the card anyway: it shows a prompt until the dependency arrives.

At the bottom of the rail is **Request a card**. It opens a pre-filled GitHub
issue, or a pre-filled email to the maintainer if you would rather not use
GitHub. Both are pre-filled with a few prompts and with your Hearth and Obsidian
version numbers, and you can edit anything before sending.

A newly added card is placed automatically, packed left to right into the first
free slot.

## Moving and resizing

The board is **free-form**. A card is stored as a position, a width expressed as
a percentage of the board's width, and a height in pixels. Cards can sit
anywhere; they are not snapped to a rigid row-and-column grid.

- **Move** — drag the card.
- **Resize** — drag any edge or any corner.
- **Snap** — as you drag, the card snaps magnetically to the edges and centres
  of its neighbours and of the board itself. The snap threshold is 8 pixels, so
  a deliberate small nudge still overrides it.
- **Minimum size** — a card cannot be made smaller than 120 pixels wide or 56
  pixels tall.

If you would rather type the numbers than drag them, every card's settings has a
**Size** section on its Layout tab: *Width* as a percentage of the board, and
*Height* in pixels. There is also a *Reset to default size* action.

### Edge-merging

Snap two cards together and their shared border drops out, so the pair reads as
one continuous tile. Merged cards also blur as one seamless sheet rather than as
two overlapping panes of glass. This happens automatically when the edges meet;
there is nothing to switch on.

## Card controls in arrange mode

Each card grows a small set of controls while the board is being arranged:

| Control | What it does |
| --- | --- |
| Gear / settings | Opens that card's settings dialog |
| Remove | Deletes the card from the dashboard, after a confirmation naming it |
| Expand / collapse | Folds the card down to its title row |
| Move card up / Move card down | Reorders the card in the stacked column (used in phone preview) |
| Hide on a narrow board | Leaves this card out when the board stacks into one column |

## The card settings dialog

Every card's settings dialog has the same three tabs.

### Content tab

What this card shows. The contents differ completely from one card kind to the
next; chapters [7](07-cards-notes-and-files.md) through
[10](10-cards-integrations.md) document every card's Content tab in detail.

Two controls are common to all cards:

- *Type* — what this card shows. Changing it converts the card in place.
- *Title* — shown in the card's header. **Leave it empty for a headerless
  card**, which is how you get a clean, chrome-free panel.

### Style tab

Per-card visual overrides. Each defers to the dashboard's value, and the
dashboard's value defers to the vault-wide value.

| Setting | Meaning |
| --- | --- |
| *Accent* | An accent colour for this card. Clearable |
| *Background* | A background tint for this card. Clearable |
| *Card opacity* | Transparency of this card's surface |
| *Card blur* | Frosted-glass blur behind this card. Requires opacity below 100% to be visible |
| *Card border* | Border thickness in pixels. 0 removes the border and the line under the title |

### Layout tab

| Section | Meaning |
| --- | --- |
| *Size* | Width as a percentage of the board, height in pixels |
| *On a narrow board* | The four mobile options below |
| *Pin to all dashboards* | Show this card on every dashboard, sharing one definition and position |
| *Copy to dashboard* | Add an independent duplicate of this card to the end of another dashboard |

The four *On a narrow board* options control what happens when the board reflows
into one full-width column:

| Option | Meaning |
| --- | --- |
| *Hide* | Leave this card out of the stacked column. For a card that needs width to make sense — a wide table, a board view — hiding beats squeezing |
| *Start collapsed* | Show only the card's title row, and build the card when it is tapped open. A card nobody opens costs one row and runs nothing |
| *Height* | Height in pixels when stacked. Left empty, the card keeps its own height, capped so that one tall card cannot fill the screen |
| *Position* | Where this card comes in the stack, counting from 0. Left empty, it follows the order the board reads in: top to bottom, left to right |

## Pinning versus copying

These two are easy to confuse.

**Pin to all dashboards** creates *one* card that appears on every board, at the
same position, sharing one definition. Editing it anywhere edits it everywhere.
Use this for a clock, a search bar, or a launchpad you always want present.

**Copy to dashboard** creates a *separate, independent* duplicate at the end of
another board. The two diverge freely from that point on. Use this when you want
a similar card on two boards but expect to tune each.

## Cards, dashboards and the settings cascade

Three visual properties — opacity, blur, border width — plus corner radius exist
at three levels:

1. **Vault-wide**, at *Settings → Hearth → Dashboard → Card surface*.
2. **Per dashboard**, at *Dashboard settings → Style*.
3. **Per card**, at that card's *Style* tab.

The most specific level that has an opinion wins. Every control at levels 2 and
3 offers an explicit *Use dashboard default* or *Use global default* choice and
shows you what that default currently is, so you can always tell whether you are
overriding something.

## Card sizing on tile cards

Three cards — **Links / launchpad**, **Commands** and **New note from
template** — are grids of buttons rather than single panels, and they have their
own sizing model on top of the card's.

*Button sizing* offers two styles:

- **Fill the card** — every button is visible however big the card is, growing
  and shrinking with it. Buttons stop shrinking once they would be too small to
  use, and a card too small for them at that point scrolls.
- **Fixed size (legacy)** — buttons keep a fixed pixel size, and a card too
  small for them all scrolls. Cards created before the *Fill the card* style
  existed stay on this until you switch them.

Each style keeps its own sizes, so switching back restores what you had.

With *Fill the card*:

- *Buttons across* sets how many buttons wide the card is, and so how wide one
  button is. The rows share the card's height between them, so a shorter card
  means shorter buttons rather than hidden ones.
- *Minimum button size* sets how small a whole button may get, in pixels, before
  the card scrolls instead of shrinking them further. It is low by default so
  that buttons fit rather than a scrollbar appearing; raise it to keep buttons
  comfortable on a card you often make small.
- An individual button can be made two or three cells wide or tall by dragging
  its bottom-right corner in arrange mode. The tile grid takes half steps in
  both directions, so a button can also be half a cell.

All three tile cards also offer *Auto-shift tiles (beta)*: when it is on, tiles
shove each other aside as one is dragged, the way phone widgets do. It is off by
default, which means tiles are pure free-form and may overlap.

## Things that live on the board rather than in settings

To summarise, because it is the single most common source of "where is that
setting?":

| You are looking for | It is here |
| --- | --- |
| What a card shows | Arrange → the card's gear |
| A card's colour, opacity, blur, border | Arrange → the card's gear → Style |
| A card's size, mobile behaviour, pinning | Arrange → the card's gear → Layout |
| This board's name, icon, type, background | Arrange → Dashboard settings, or right-click its switcher button |
| Vault-wide defaults for all of the above | Settings → Hearth |
