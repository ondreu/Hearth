# 11. Appearance: backgrounds, banners, frosted glass and icons

This chapter covers how a Hearth dashboard looks: the backdrop behind it, the
surface the cards are drawn on, and the marks and icons around them.

Nearly everything here exists at two or three levels. The vault-wide value lives
under **Settings → Hearth**; a dashboard can override it from *Dashboard
settings*; and for the card-surface properties an individual card can override it
again from its own Style tab. The most specific level with an opinion wins, and
every overriding control tells you what it is overriding.

---

## The background

Vault-wide: **Settings → Hearth → Appearance → Background**.
Per dashboard: *Dashboard settings → Background*.

### The seven background types

| Type | What it is |
| --- | --- |
| *Hearth default* | A wallpaper Hearth draws itself, so nothing is downloaded. Its *Design* is **Classic** — layered hills with a cabin, a soft morning in a light theme and a moonlit night with stars in a dark one — or **Expressive**: flat Material 3 Expressive shapes in the corners, in tones of your accent colour. It is the same *Design* setting the live sky uses, and a dashboard can override it |
| *Harbour town* | A harbour town Hearth draws itself: houses stepping down a hill to the quay, a lighthouse at the end of the pier and sailing boats on the bay, all in Material 3 Expressive's soft shapes and tones of your accent colour. By day in a light theme, at night — lit windows, the lamp burning, stars — in a dark one |
| *None* | Your theme's own background, untouched |
| *Solid color* | Any CSS colour, for example `#1e1e2e` or `rgb(30,30,46)` |
| *Vault image* | An image path in your vault, for example `Attachments/bg.png` |
| *Image URL* | A direct image URL |
| *Live weather sky* | A painted sky — see below |

### Opacity and blur

*Opacity* controls how much the background shows through; lower is more subtle.
*Blur* is the background blur in pixels.

The defaults suit Hearth's own wallpaper: opacity 0.8 and no blur. It is a flat,
already muted drawing, so it needs little dimming and has no detail to soften;
the card surfaces keep the content readable. Switching to a vault image or an
image URL dims a photo to 0.35 and blurs it by 2, so text reads over it, and
switching back lifts it again. Either way the sliders are right there to change
it.

### Full background or banner

*Background layout* wears the same backdrop two ways:

- **Full background** — it fills the whole view. This is what Hearth has always
  done, and stays the default.
- **Banner** — a strip across the top of the board, the way a cover image sits
  above a note, with the cards below it on your theme's own surface.

Banner mode has three further controls: *Banner height* in pixels, *Fade the
lower edge* (let the banner dissolve into the page instead of ending on a hard
line), and *Full width* (run the banner edge to edge instead of lining it up
with the content below).

Each of these is a per-board override, so one dashboard can show the vault's
background as a banner while the next keeps it as a wallpaper.

### The live weather sky

Instead of an image, the board's backdrop can be a **painted sky** — the same
sky the Weather card's *Artistic* style draws, spread across the whole window.

There are two ways to run it:

**Follow the real weather** over a place you pick. Conditions come from
Open-Meteo; only the coordinates are sent, and nothing is fetched while external
calls are off. The sky follows the real conditions and the real time of day.

**Pin one sky** — clear night, snow, thunder, and so on — and keep it whatever
the weather is doing. A pinned sky **needs no location at all and never goes
online**. If you like the look but do not want the network, this is the option.

| Setting | Meaning |
| --- | --- |
| *Sky* | **Live weather** or **A fixed sky** |
| *Condition* | Fixed sky only: the weather this sky always shows |
| *Time of day* | **Follow the clock**, **Always day**, or **Always night** |
| *Animate the sky* | Drifting clouds, falling rain and twinkling stars behind the board |
| *Design* | **Classic (painted)** — gradients and soft clouds — or **Expressive (flat)**, drawn in Material 3 Expressive's manner: pastel skies by day and deep ones by night, rolling hills, bubbly clouds, a turning sun, sparkling stars, pill raindrops and flower snowflakes. The vault's choice; a dashboard can't override it yet |

Animation is always off in low power mode, and for readers whose system asks for
reduced motion. Each dashboard can also override *Animate the sky* on its own.

### External calls and backgrounds

An *Image URL* background and a title icon given as a web address are both
network requests. While *Disable external calls* is on under **Settings → Hearth
→ Behaviour**, the settings page says the background will not be shown and
suggests a vault image instead; a URL background falls back to no picture, and a
URL title icon falls back to the Hearth crystal.

---

## The card surface

Vault-wide: **Settings → Hearth → Dashboard → Card surface**.
Per dashboard: *Dashboard settings → Style*.
Per card: that card's *Style* tab.

| Setting | Default | Meaning |
| --- | --- | --- |
| *Card opacity* | 0.5 | Transparent card backgrounds, so the dashboard background shows through |
| *Card blur* | 0 (off) | Frosted-glass blur behind translucent cards. Needs card opacity below 100% to show |
| *Card corner radius* | 14 px | How rounded card corners are. 14 is both the default and the maximum; lower makes corners sharper, down to 0 |
| *Card border* | 1 px | Thickness of the card border and the header divider. 0 hides the border |

### Design: Classic or Expressive

Vault-wide: at the head of **Settings → Hearth → Appearance**, where the two
choices are shown as a small card drawn each way — pick one to switch. Per
dashboard: *Dashboard settings → Style → Design*. Per card: that card's *Style*
tab. The first run of the setup wizard asks too.

*Design* sets how cards draw what's inside them: **Classic**, or
**Expressive**, in Material 3 Expressive's manner — the look the weather and
market cards introduced. In Expressive, rows and tiles sit on tonal containers
in your accent colour instead of on rules and borders, icons sit on round
badges, controls become pills, and the thing each card is about is set heavy
and tight or on a cookie shape: the time, today in the calendar, the
calculator's answer, the statistics.

It cascades like the rest of the card surface: the vault's choice, then the
board's (*Dashboard settings → Style → Design*, *Default* follows the
vault), then the card's own. Each card's *Style* tab has a *Design* — *Default*,
*Classic* or *Expressive* — where *Default* names what the card inherits right
now; the weather and market cards keep theirs in their *Content* tab, with the
same *Default*. A synced card follows the board it is showing on, and a shared
or published board carries its card design with it.

The search row at the top of the board isn't a card, but it follows the board's
*Design* too (else the vault's): in Expressive the field and the button are
tonal pills — *Search online* a connected pair — the filters round chips that
firm up when chosen, and the results a tonal sheet with each icon on a badge.

The dialogs an Expressive card opens are Expressive too: a task, the task
filter and sort, an event, the folder browser, the full forecast, an
instrument's chart and a confirmation open on a tonal surface with large
corners, pill buttons and filled fields, dressed like the card they came from. The cards that have
an Expressive design are clock, mini calendar, full calendar, tasks, statistics,
activity heatmap, links, commands, new note, favourites, bookmarks, recent
files, folder, query, search bar, calculator, Git, RSS, Jira and Operon, plus
weather and markets. Cards whose content is your own — notes, embeds, web pages,
Dataview and Datacore, hosted views, the slideshow and the pets — stay as they
are. Nothing changes the card's frame: its corners, border and surface are still
the board's.

#### All of Hearth in Expressive

The design reaches past the cards to everything else Hearth draws. In
Expressive, every Hearth dialog and picker opens on a tonal surface with large
corners, pill buttons and filled fields, Material's wide switches and
slim-handled sliders, and pill tab ribbons; Hearth's menus become rounded
tonal sheets; the board's toolbar, dashboard switcher and card buttons become
pills (the current board's button squares off as it is chosen); and Hearth's
own settings pane groups its rows in tonal containers. Menus are grouped:
entries that belong together share a rounded container, a small gap apart
from the next group, and a destructive entry (deleting a board, discarding a
change) sits in a group of its own. Obsidian's own
interface, and other plugins', are left to your theme.

It follows the same cascade as the cards. A dialog or menu takes the design of
whatever it was opened from: from a card, the card's; from the board's
furniture, the board's; from another dialog, that dialog's; from the settings
pane, the vault's. Anything opened from elsewhere — the command palette, the
ribbon — follows the vault. So a Classic board keeps its dialogs Classic in an
Expressive vault, and the other way round.

### Why frosted glass is off by default

Card blur defaults to 0, and this is the one default that was chosen for power
rather than for looks. Every blurred card is a `backdrop-filter` layer that the
compositor re-evaluates whenever anything behind it changes. On a board with a
moving wallpaper that means re-blurring every frame at the display's full pixel
density.

Translucency is kept — alpha compositing is cheap — so cards still read as glass
over the wallpaper. If you want the full frosted look and your hardware can
carry it, raise *Card blur*.

Vaults that already had a blur value set keep it; the change in default only
affects fresh installs.

### Merged cards blur as one

When two cards are snapped edge to edge their shared border drops out and they
blur as a single seamless sheet, rather than as two overlapping panes of glass.
This is automatic; see [chapter 6](06-arranging-cards.md).

### Per-card colours

Beyond opacity, blur and border, each card can take an **accent** colour and a
**background tint** of its own, both clearable back to the dashboard's default.

---

## Spacing and width

| Setting | Where | Meaning |
| --- | --- | --- |
| *Compact spacing* | Settings → Hearth → Dashboard; per board on the Layout tab | Tighten card padding and the top margin to enlarge the usable area |
| *Content width* | Settings → Hearth → Appearance → Home; per board on the Layout tab | The widest the home content may grow, in pixels. Default 1600. It is a ceiling, not a width — the content still shrinks to fit a narrower pane |
| *Full width* | Same places | Let the content fill the pane instead of stopping at the width above. Cards keep their proportions as the pane widens, but text does not grow with them, so a very wide board reads sparser |
| *Fit to page* | Settings → Hearth → Dashboard; per board on the Layout tab | Keep the dashboard to one screen instead of allowing it to scroll. On by default |

---

## The title and its icon

Vault-wide: **Settings → Hearth → Appearance → Home**.
Per dashboard: *Dashboard settings → Header*.

| Setting | Meaning |
| --- | --- |
| *Show title* | Display the big title and its icon at the top |
| *Title* | The heading text. The default is `Obsidian` |
| *Title icon* | The mark drawn next to the title |
| *Tab icon* | A Lucide icon for Hearth's tab header and ribbon button, in place of the Hearth crystal |
| *Follow theme icon color* | Draw the crystal icon and/or the title text in your theme's icon colour instead of the default purple crystal and normal text. Four choices: **Off**, **Icon**, **Title**, **Icon and title** |

### One title icon, four kinds of value

The *Title icon* field accepts any of four things, and works out which you gave
it:

1. A **Lucide icon id** such as `home` or `layout-dashboard`. A search button
   browses the whole Lucide set, so you do not have to remember ids.
2. An **emoji**, or a couple of characters.
3. The **vault path of an image**, such as `Attachments/logo.png`. There is a
   picker button for this.
4. The **URL of an image on the web**.

Leave it empty for the Hearth crystal.

Each dashboard can override the title icon, so one board can wear a logo and the
next the crystal. Hearth's tab and ribbon icons follow the vault-wide setting
even when a board overrides its own title mark.

### Title layout, per board

A dashboard's Header tab additionally offers *Title alignment* (default centre,
or left, centre, right), *Title size*, *Title icon size*, *Title top margin* and
*Spacing below title/header*. These are per-board only; there is no vault-wide
equivalent, because they are layout decisions that tend to differ from board to
board.

---

## Chrome visibility

The dashboard switcher and the Arrange button can each be set to **Always
visible** or **Show on hover**.

Vault-wide those are *Arrange button visibility* and *Dashboard switcher
visibility* under **Settings → Hearth → Dashboard → Dashboard controls**. Per
board they are *Arrange button* and *Dashboard switcher* on the Layout tab of
that dashboard's settings.

Hiding both gives a completely clean board that reveals its controls only when
you reach for them.

---

## A dashboard's own search row

Beyond the title, each dashboard can set its own search placeholder, its own
button beside the search field (or none), its own filter chips, and whether the
search section is shown at all. Each follows the vault until the board says
otherwise, and each travels with the board when you export it. See
[chapter 4](04-search.md) and [chapter 5](05-dashboards.md).

---

## Themes

Hearth draws its own surfaces but honours your Obsidian theme's colours, and the
*Follow theme icon color* setting exists specifically so the brand mark can join
in rather than sitting apart from the theme.

When you publish a dashboard to the gallery you can note which theme it was
built for. That is a note to whoever installs it — nothing is installed or
changed on their side. See [chapter 16](16-sharing-and-gallery.md).

---

## Putting a look together: three worked examples

**A calm, low-contrast board.** Background: *Hearth default* at opacity 0.25,
blur 4. Card surface: opacity 0.6, blur 12, radius 14, border 0. Compact
spacing off. Chrome on hover.

**A photograph board.** Background: *Vault image* at opacity 1.0, blur 0, layout
*Banner* with a 320 px height and *Fade the lower edge* on. Card surface: opacity
1.0 (solid), so the cards read cleanly under the photograph.

**A cheap-to-draw board for a laptop on battery.** Background: *Solid color*.
Card surface: opacity 1.0, blur 0. Performance tier: *Reduced*, so nothing moves.
See [chapter 12](12-performance.md).
