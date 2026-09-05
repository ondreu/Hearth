# 15. Complete settings reference

This chapter lists every setting on Hearth's own settings page, in the order the
page presents them, with what each one does and its default value where the
default is meaningful.

To reach it: **Obsidian Settings → Hearth**. The page opens on an index of eight
categories, grouped into four headings. Choosing one opens that category; a back
link returns to the index.

| Index group | Categories |
| --- | --- |
| **Look & feel** | Appearance, Dashboard |
| **How it works** | Search, Behaviour, Mobile |
| **Data & plugins** | Integrations, Backup |
| **Etc** | About |

Each category also carries a one-line description on its index row and again at
the top of its page:

| Category | Description |
| --- | --- |
| Appearance | Title, title icon, background, and low power mode |
| Search | The search bar and which results it offers |
| Dashboard | Grid, card surface, and the controls around the board |
| Behaviour | Startup, how notes open, and privacy |
| Mobile | The stacked layout on a phone, and the action bar |
| Integrations | TaskNotes, file icons, and every plugin Hearth reads |
| Backup | Export and import your layout and settings |
| About | Version, what's new, and where to report things |

Sliders and text fields whose factory default is meaningful carry a **Reset to
default** button.

If a single section fails to render, Hearth shows a message in its place —
*The "<name>" section couldn't be shown* — with a hint to open the developer
console and report it. The other settings are unaffected.

---

## Appearance

Three sections: Performance, Home, Background.

### Performance

*How much of the decoration to pay for. Trade visual effects for battery life
and smoothness on slower hardware.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Performance tier* | Full | **Full — everything on**, **Balanced — a lighter sky**, **Reduced — nothing moves**, **Minimal — plain and still**. Nothing you configured is overwritten; your settings come back when you move back up |
| *Pause animation when Obsidian isn't in front* | On | Hold every animation while you are working in another app or window. Covers a visible board in a window you are not using — beside a browser, or on a second screen |
| *Minimal background* | `#4a4459` | The flat colour shown behind the home view on the minimal tier. Any CSS colour |

The full effects of each tier are in [chapter 12](12-performance.md).

### Home

*Title, title and tab icons, search visibility and overall content width.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Show title* | On | Display the big title and its icon at the top |
| *Show search section* | On | Display the search and command bar with its results and filter buttons. Individual dashboards can override this |
| *Title* | `Obsidian` | The heading text at the top of the home view |
| *Title icon* | empty (the Hearth crystal) | Takes a Lucide icon id, an emoji or a couple of characters, a vault image path, or an image URL. Each dashboard can override it |
| *Tab icon* | empty (the Hearth crystal) | A Lucide icon for Hearth's tab header and ribbon button |
| *Follow theme icon color* | Off | Draw the crystal icon and/or the title text in your theme's icon colour. **Off**, **Icon**, **Title**, **Icon and title** |
| *Full width* | Off | Let the content fill the pane instead of stopping at the width below |
| *Content width* | 1600 px | The widest the home content may grow. A ceiling, not a width — content still shrinks to fit a narrower pane |

### Background

*The backdrop behind the home view, and how much it shows through.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Background type* | Hearth default | **Hearth default**, **None**, **Solid color**, **Vault image**, **Image URL**, **Live weather sky** |
| *Background value* | — | A CSS colour, a vault image path, or a direct image URL, depending on the type |
| *Opacity* | 0.35 | How much the background shows through |
| *Blur* | 2 px | Background blur |
| *Background layout* | Full background | **Full background** or **Banner** |
| *Banner height* | 220 px | How tall the banner strip is, in pixels |
| *Fade the lower edge* | On | Let the banner dissolve into the page |
| *Full width* (banner) | Off | Run the banner edge to edge instead of lining it up with the content |

Weather sky settings, shown when the type is *Live weather sky*:

| Setting | Meaning |
| --- | --- |
| *Sky* | **Live weather** (follow a real place) or **A fixed sky** |
| *Condition* | Fixed sky only: the weather this sky always shows |
| *Time of day* | **Follow the clock**, **Always day**, **Always night** |
| *Animate the sky* | Drifting clouds, falling rain and twinkling stars |

A URL background is not shown while *Disable external calls* is on, and the
settings page says so.

---

## Search

Two sections: Search bar, Search filters.

### Search bar

| Setting | Default | Meaning |
| --- | --- | --- |
| *Search placeholder* | `Search or command` | The greyed-out text in the empty field |
| *Search note contents* | On | Also match text inside note bodies, not just names, tags and properties. Body matches appear after name matches with a snippet |
| *Search engine* | Hearth (built-in) | **Hearth (built-in)** or **Omnisearch**. Omnisearch requires that community plugin to be installed and enabled |
| *Show "New note" button* | On | Show the action button beside the search field |
| *Search-bar button* | New note | What the button does: **New note** or **Search online** |
| *Online search engine* | DuckDuckGo | Which engine the *Search online* button opens. Also available: DuckDuckGo without AI, Brave, Kagi, Google, Mojeek, Ecosia, Qwant. The arrow beside the button searches with any of the others for one query without changing this |

Then a sub-heading, **The "New note" button** — what the button makes, and where.
The same settings drive the button beside the search bar, the one on a Search bar
card, and Hearth's *Create new note* command.

| Setting | Default | Meaning |
| --- | --- | --- |
| *Button text* | empty ("New note") | Text on the button |
| *Template* | Blank note | Make the note from a Templater template instead of a blank one. Requires Templater |
| *Location* | Default location | Folder the new note goes in, created if it does not exist. "Default location" means wherever Obsidian puts new notes |
| *Filename* | empty ("Untitled") | Name without the extension. Supports `{{date}}`, `{{date:FMT}}`, `{{time}}`, `{{time:FMT}}` and `{{prompt}}` |

### Search filters

*Filters are auto-detected from the file types in your vault. Hide any you don't
want.*

The possible groups are Folders, Notes, Excalidraw, Canvas, Bases, Images,
Videos, Audio, PDF, Documents, Sheets, Slides, 3D and Other. A chip only appears
if your vault holds that kind of file. Hiding a chip here hides it for every
search bar, including Search bar cards.

---

## Dashboard

Three sections plus an informational row.

### Grid & spacing

| Setting | Default | Meaning |
| --- | --- | --- |
| *Fit to page* | On | Keep the dashboard to one screen instead of allowing it to scroll |
| *Compact spacing* | Off | Tighten card padding and top margin to enlarge the usable area |

The board itself is free-form, so there is no column count to set here. Hearth
keeps an internal column count (12) and seed row height (92 px) that it uses only
when it has to place a new card for you; neither is exposed as a control.

### Dashboard controls

| Setting | Default | Meaning |
| --- | --- | --- |
| *Arrange button visibility* | Always visible | **Always visible** or **Show on hover** |
| *Dashboard switcher visibility* | Always visible | **Always visible** or **Show on hover** |

### Card surface

*Transparency and frosted-glass blur applied to every card.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Card opacity* | 0.5 | Transparent card backgrounds so the dashboard background shows through |
| *Card blur* | 0 (off) | Frosted-glass blur behind translucent cards. Needs opacity below 100% to show |
| *Card corner radius* | 14 px | 14 is both the default and the maximum; lower is sharper, down to 0 |
| *Card border* | 1 px | Thickness of the card border and header divider. 0 hides the border |

### Cards

An informational row, not a control: *Add and configure cards on the dashboard
itself: open the home view, hit Arrange, then use Add card, Dashboard settings
and each card's settings button.*

---

## Behaviour

Three sections: Startup & tabs, Opening notes, Privacy & network.

### Startup & tabs

| Setting | Default | Meaning |
| --- | --- | --- |
| *Open on startup* | On | Open the home view when the vault loads |
| *Replace new tabs* | On | Show the home view instead of an empty new tab |
| *Focus search on open* | Off | Place the cursor in the search field whenever a home view opens. Desktop only |
| *Live refresh on vault changes* | Off | Keep an open home view current as the vault changes — Recent, Bookmarks and saved-query cards update without reopening the tab. Switching back to the Hearth tab always refreshes it regardless |
| *Pick up synced changes* | On | Apply dashboard changes made on another device as soon as sync brings them in, instead of at the next Obsidian restart |

### Opening notes

*Where a note opens when you click it in Hearth.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Open notes in* | A new tab | **A new tab**, **The current tab (replace Hearth)**, **A split pane**, **A new window**. Ctrl/Cmd-click always opens a new tab regardless |

Four per-source overrides, each of which may also be set to *Same as above*:

| Source | Covers |
| --- | --- |
| *Links* | Links inside notes, tasks and the Links card |
| *Search results* | Hits from the search bar and the Search card |
| *Notes in cards* | Notes listed by Recent, Bookmarks, Favourites, Calendar, Heatmap and Tasks cards, and by mobile action buttons |
| *Notes Hearth creates* | New notes, daily notes and event notes, opened as they are made |

One further setting:

| Setting | Default | Meaning |
| --- | --- | --- |
| *Notes opened from outside Hearth* | The current tab (replace Hearth) | Covers the file explorer, the quick switcher, the graph, and anything a card embeds that opens links itself. Obsidian hands those to whichever tab is focused, so a Hearth tab gets taken over. Choose **A new tab (keep Hearth open)** to keep the Hearth tab — the file explorer then stops following what you open |

### Privacy & network

| Setting | Default | Meaning |
| --- | --- | --- |
| *Disable external calls* | Off | Block all outbound network requests Hearth makes, including Jira, external calendars, RSS feeds, the calculator's currency-rate lookup, and background images and title icons given as a web address — those fall back to no picture and the Hearth crystal |

---

## Mobile

Two sections: Layout, Mobile action bar.

### Layout

*How the board is laid out when the screen is too narrow for its own layout.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Mobile mode (search only)* | Off | On phones and tablets, hide the dashboard and show only the search field. No effect on desktop |
| *Stack cards on narrow screens* | On | When the board is too narrow for its layout, show the cards as one full-width column instead. Your layout is untouched and comes back at full width |
| *Performance tier on mobile* | Balanced | The tier to use on phones and tablets. Can also be **Match desktop**. Your desktop tier is kept separately and is not changed |

### Mobile action bar

*In Mobile mode (search only), this row of buttons replaces the "New note"
button beside the search bar, appearing under the search field and filters
instead. Each button can run a command, open a note or file, or open a URL —
just like a launchpad tile.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Show action bar* | On | Show the row of action buttons beneath the search field in Mobile mode |
| The button list | New note, New drawing, Record voice, Open daily note | Each has a label, an icon and a target. Buttons can be moved up and down, removed, added, and reset to the defaults |

---

## Integrations

Four sections: All integrations, Tasks / TaskNotes, Operon, File icons.

### All integrations

The catalogue: everything Hearth can work with, listed whether or not it is
installed, in three groups — **Community plugins**, **Obsidian core plugins**
and **External services**. Each row shows a status pill, a description, where its
settings live, and either an **Install** button (for a missing plugin), a
**Show** button (jumping to its section below) or an **Open** button (jumping to
another Hearth settings tab).

The full catalogue is documented in [chapter 14](14-integrations.md).

### Tasks / TaskNotes

*Field names read by Tasks cards in TaskNotes mode. TaskNotes has no stable API
for other plugins, so this reads its frontmatter directly — match these to
whatever TaskNotes' own settings have them mapped to.*

| Setting | Default | Meaning |
| --- | --- | --- |
| *Status field* | `status` | Frontmatter field read for a task's status |
| *Due date field* | `due` | Frontmatter field read for a task's due date |
| *Priority field* | `priority` | Frontmatter field read for a task's priority indicator |
| *"Done" status value* | `done` | The status value that marks a TaskNotes task complete |
| *Customize task fields* | Off | Replace the fixed metadata Tasks cards show with fields you define yourself. Turning it on starts from a blank slate: tasks then show only the fields you add |
| *Fields shown on a task* | empty | The fields every Tasks card shows. A single card can define its own instead |

Custom task fields are documented in [chapter 8](08-cards-planning.md).

### Operon

| Setting | Default | Meaning |
| --- | --- | --- |
| *Connect to Operon* | On (but inert until an Operon card exists) | Off is a kill switch: Operon cards stop reading and Hearth never asks Operon for access |
| *Connection* | — | Reports the current state, with Operon's own error text where relevant |
| *Allow changes* | Off | Lets the board card move a task by dragging, and adds a **+** for creating one. Widens what Hearth requests, so it needs a fresh approval in Operon |
| *Requested access* | — | What Hearth asks for, and anything not yet granted |
| *Recheck* | — | Reopen the connection after approving, revoking or reloading Operon |

Operon is documented in full in [chapter 14](14-integrations.md).

### File icons / Iconic / Iconize

| Setting | Default | Meaning |
| --- | --- | --- |
| *Use icons from Iconic / Iconize* | On | Off shows Hearth's file-type icon for every file, ignoring both plugins |
| *Iconize frontmatter property* | `icon` | The property Iconize stores a note's icon in, for icons set through frontmatter rather than its menu |

---

## Backup

One section, plus the gallery settings.

### Import / export

*Share one dashboard, or back up your whole setup, as a JSON file.*

| Setting | Meaning |
| --- | --- |
| *Export this dashboard* | Save the dashboard you are on as a file others can import. Everything about how it looks travels with it, and you choose whether to include its wallpaper |
| *Import* | Open a Hearth file — one dashboard, a layout, or a full backup. It tells you what is in it before anything changes, and a single dashboard is added alongside your own rather than replacing anything |
| *Export layout* | Download every dashboard plus the grid and layout settings as a JSON file |
| *Export settings* | Download every Hearth setting — the full layout plus header, background, behaviour, appearance and TaskNotes options — as a JSON backup file |

On mobile, an export file is saved to your vault's root folder rather than
downloaded.

### Dashboard gallery

| Setting | Meaning |
| --- | --- |
| *Gallery address* | The gallery Hearth browses and publishes to. Nothing is fetched until you open it and nothing is sent until you publish. **Clearing this field turns the gallery off entirely, and it stays off.** HTTPS only, or HTTP on localhost for a gallery you run yourself |
| *Browse the gallery* | Opens the gallery browser |

Export, import and the gallery are documented in
[chapter 16](16-sharing-and-gallery.md).

---

## About

| Row | What it does |
| --- | --- |
| *Set up Hearth* / *Build a dashboard* | Runs the setup wizard. It is always added as a new board, so your existing dashboards are never touched |
| *What's new* | Read the release notes for this and every past version |
| *GitHub repository* | Browse the source, star the project, or read the changelog |
| *Report an issue* | Open an issue on GitHub |
| *Support Hearth* | A Ko-fi tip link. Completely optional; no features are locked |
| *Version* | The Hearth build you are running |

---

## Commands

Hearth registers these commands. They appear in Obsidian's command palette and
can be bound to hotkeys under **Settings → Hotkeys**.

| Command | What it does |
| --- | --- |
| *Open home dashboard* | Opens the Home view |
| *Create new note (default location)* | Makes a note using the *The "New note" button* settings |
| *Create new Excalidraw drawing* | Runs Excalidraw's own new-drawing command |
| *Start/stop voice recording* | Uses Obsidian's core Audio recorder |
| *Open today's daily note* | Uses Obsidian's core Daily notes plugin |
| *Set up Hearth (first-run wizard)* | Runs the setup wizard, always adding a new board |
| *Switch to dashboard 1 … 9* | Changes the active board |
| *Open dashboard 1 … 9* | Changes the active board **and** brings Hearth up |
| *Next dashboard* | Moves to the next board |
| *Previous dashboard* | Moves to the previous board |

The ribbon button is labelled *Open Hearth home*.

## Keyboard shortcuts inside the view

| Key | In the search field |
| --- | --- |
| `↑` / `↓` | Move through the results |
| `Enter` | Open the selected result, or run the selected command |
| `Esc` | Dismiss the results |
| `Ctrl`/`Cmd` + click | Always open a result in a new tab, whatever *Open notes in* says |

## Per-dashboard settings

Every dashboard also has its own settings dialog, reached by right-clicking its
switcher button or from *Arrange → Dashboard settings*. Those are documented in
[chapter 5](05-dashboards.md), and per-card settings in
[chapter 6](06-arranging-cards.md).
