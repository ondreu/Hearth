# 19. Glossary of Hearth terms

Terms used throughout this guide and inside the Hearth plugin, defined. Entries
are alphabetical. Where a term is Obsidian's rather than Hearth's, that is said.

---

**Action bar** — In Mobile mode (search only), a row of buttons under the search
field, replacing the button that would otherwise sit beside it. Each button can
run a command, open a note or file, or open a URL. Configured at *Settings →
Hearth → Mobile → Mobile action bar*.

**Arrange mode** — Hearth's edit mode for a dashboard, entered with the
**Arrange** button in the top-right of the Home view. Cards can be added, moved,
resized, configured and removed only while arranging.

**Auto-shift tiles** — A beta option on the Links, Commands and New note from
template cards. When on, tiles shove each other aside as one is dragged, the way
phone widgets do. Off by default, which leaves tiles free-form and able to
overlap.

**Banner** — One of the two ways a background can be worn: a strip across the top
of the board, with the cards below it on the theme's own surface, the way a cover
image sits above a note. The alternative is *Full background*.

**Board** — A synonym for dashboard, used throughout Hearth's own wording.

**Card** — One panel on a dashboard. A card has a kind, an optional title, a
position and size, optional style overrides, and optional behaviour when the
board is stacked into one column.

**Card surface** — The collective name for the four visual properties every card
shares: opacity, blur, corner radius and border width. They exist vault-wide, per
dashboard and per card.

**Cascade** — Hearth's three-level settings model: a vault-wide default, an
optional per-dashboard override, and (for card properties) an optional per-card
override. The most specific level with an opinion wins.

**Chip** — Two unrelated uses. (1) A *filter chip* is one of the auto-detected
file-type buttons under the search field. (2) A *chip* is one of the display
styles for a custom task field: a small pill on the task.

**Collapsed (on a narrow board)** — A per-card option that shows only the card's
title row in the stacked mobile column, building the card when it is tapped open.
A card nobody opens costs one row and runs nothing.

**Command mode** — What the search field becomes when the query starts with `>`:
a launcher for any command registered in Obsidian.

**Dashboard** — One arrangement of cards, with its own name, switcher icon, and
optional overrides of almost every visual setting. A vault can hold many.

**Dashboard gallery** — A server that stores published dashboards, which Hearth
can browse, install from and publish to. Off entirely if no gallery address is
set. Anyone can run their own.

**Dashboard switcher** — The strip of buttons in the top-left of the Home view,
one per dashboard, plus a `+` to create one.

**Dashboard type** — Either **Cards** (the normal board) or **Plugin view** (the
whole board given over to one other plugin's view).

**Disable external calls** — The master privacy switch at *Settings → Hearth →
Behaviour → Privacy & network*, which blocks every outbound network request
Hearth makes.

**Edge-merging** — When two cards are snapped edge to edge, their shared border
drops out so the pair reads as one continuous tile, and they blur as one seamless
sheet. Automatic; there is nothing to switch on.

**Favorites** — Hearth's own list of starred notes, separate from Obsidian's
Bookmarks. Shown by the Favorites card, which normally follows one vault-wide
list but can be given a list of its own.

**Fit to page** — A setting that keeps the dashboard to one screen instead of
allowing it to scroll. On by default. A plugin view board always fits the pane.

**Flattening** — In an export, writing the vault's resolved appearance values
onto the dashboard itself so it looks the same in another vault instead of
picking up that vault's settings. Controlled by *Copy this vault's appearance
settings onto the dashboard*.

**Free-form layout** — Hearth's board geometry: cards are stored as a position, a
width as a percentage of the board, and a height in pixels, and may sit anywhere.
Not a rigid row-and-column grid.

**Frosted glass** — Translucent cards with a backdrop blur behind them. Blur
defaults to 0 for power reasons; translucency is on by default.

**Handle** — Your anonymous publishing identity, derived from a signing key
generated in your vault that never leaves it. Needed to publish or vote in a
gallery; not needed to browse or install.

**Headerless card** — A card whose *Title* is empty, drawn without a header row.

**Home view** — The Obsidian view Hearth registers. It contains the switcher, the
Arrange button, the title block, the search section and the dashboard.

**Karma** — On a gallery profile, every upvote across everything that handle has
published, minus every downvote.

**Kill switch** — Used in Hearth's own wording for *Connect to Operon*: turning
it off stops Operon cards reading and stops Hearth ever asking Operon for
access.

**Launchpad** — The Links card: a grid of buttons opening notes, URLs or
commands.

**Live weather sky** — A painted sky used as the board's background, either
following the real conditions and time of day over a place you pick, or pinned to
one condition. A pinned sky needs no location and never goes online.

**Lucide icon** — An icon from the [Lucide](https://lucide.dev/icons) set, which
Obsidian uses. Hearth accepts Lucide ids in title icons, tab icons, switcher
icons and tile icons, and provides a searchable picker so you do not have to
remember ids.

**Minimal tier** — The lowest performance tier: a flat colour instead of the
wallpaper, opaque cards, no motion, and no card refreshing itself on a timer.

**Mobile mode (search only)** — An optional mode in which Hearth on phones and
tablets hides the dashboard entirely and shows only the search field with an
action bar. Distinct from the stacked column, which is the default behaviour on a
narrow board.

**Package** — The JSON file format Hearth's export produces and its import
consumes, describing one dashboard, one whole layout, or one vault's settings.
Documented in [`docs/dashboard-package.md`](../dashboard-package.md).

**Performance tier** — A single control with four steps — Full, Balanced,
Reduced, Minimal — where each step down drops the next most expensive thing the
board does. Nothing you configured is overwritten; your settings return when you
move back up.

**Pinned card** — A card set to appear on every dashboard, sharing one definition
and position. Distinct from *Copy to dashboard*, which makes an independent
duplicate.

**Plugin view card** — A card that hosts another plugin's registered side-panel
view. By far the heaviest card Hearth has, because it runs that plugin's full
view live.

**Plugin view dashboard** — A whole board given over to one plugin's view at full
size, with the switcher, header and background still around it. The board keeps
its cards, and switching back to *Cards* brings them back.

**Quick view** — On the Tasks card, a compact popover with a task's editable
metadata and description, opened by clicking the task instead of jumping into its
note. On by default.

**Recovery key** — The key behind your publishing handle. Held nowhere but your
vault; the only way to carry the handle to another install or get it back.

**Redaction** — The blanking of every word inside your cards before the gallery
screenshot is taken. Card titles, the header and anything a card shows that is not
yours are kept. You are asked to look at the result and confirm it before
publishing.

**Seamless** — An option on the Search bar card that drops the card frame — no
border, background or title row — so it reads as a standalone search bar on the
board.

**Setup wizard** — The six-step flow that builds your first dashboard from a
handful of questions and from what it finds installed in your vault. Rerunnable
from *Settings → Hearth → About*, where it always adds a new board.

**Snap** — The magnetic alignment of a dragged card to the edges and centres of
its neighbours and of the board. The threshold is 8 pixels.

**Stacked column** — What a board becomes when it is too narrow for its free-form
layout: one full-width column, top to bottom, in the order the desktop board
reads in. The stored layout is untouched.

**Tier** — See *Performance tier*.

**Tile** — One button on a Links, Commands or New note from template card. Tiles
can be resized by dragging their bottom-right corner, in half-cell steps.

**Title block** — The large heading at the top of the Home view and the mark
beside it.

**Title icon** — The mark beside the title. Accepts a Lucide icon id, an emoji or
a couple of characters, a vault image path, or an image URL. Empty means the
Hearth crystal.

**Transparent modes** — Hearth's description of its search modes: you do not
switch between them with a control, the mode is decided by what you type.

**Vault-wide** — A setting that applies to every dashboard unless a dashboard
overrides it. Vault-wide settings live under *Settings → Hearth*.
