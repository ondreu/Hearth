# 2. Installing Hearth and your first run

This chapter covers getting the Hearth plugin into an Obsidian vault, what
happens the first time it loads, and how to use the setup wizard that builds
your first dashboard.

## Installing Hearth

### From Obsidian's community plugin browser (recommended)

1. In Obsidian, open **Settings → Community plugins**.
2. If restricted mode is on, turn it off.
3. Choose **Browse**, search for **Hearth**, and install it.
4. Enable it.

Hearth requires Obsidian **1.8.7** or newer. It is not desktop-only: it runs on
Obsidian for iOS and Android as well.

### Manually

Download `main.js`, `manifest.json` and `styles.css` from a release, place all
three in the folder `<your vault>/.obsidian/plugins/hearth/`, then enable
**Hearth** under **Settings → Community plugins**. If Obsidian is already
running, use the reload-plugins button or restart the app.

### Beta releases

Hearth publishes beta builds alongside stable ones. Betas can be installed with
the BRAT community plugin, pointed at the `ondreu/Hearth` repository. Betas are
tested in a real vault by a human before release but are, by definition, ahead
of the stable line.

## What happens the first time Hearth loads

On a fresh install Hearth does three things:

1. It registers the **Home** view, a ribbon icon (the Hearth crystal by
   default), and a set of commands including *Open home dashboard*.
2. It sets itself to open on startup and to replace empty new tabs. Both are
   ordinary settings you can turn off — see [chapter 15](15-settings-reference.md).
3. It offers to run the **setup wizard**, which builds your first dashboard
   from a handful of questions.

Vaults that had Hearth installed before the wizard existed are marked as already
set up, so upgrading never offers to rebuild a dashboard you already have.

## Opening Hearth

There are four ways to open the Home view:

- Click the **Hearth crystal** icon in the left ribbon.
- Run the command **Open home dashboard** from the command palette.
- Open a new empty tab, if *Replace new tabs* is on (it is, by default).
- Start Obsidian, if *Open on startup* is on (it is, by default).

You can bind a hotkey to *Open home dashboard*, and to several other Hearth
commands, under **Settings → Hotkeys**. The full list of bindable commands is in
[chapter 15](15-settings-reference.md).

## The setup wizard

The wizard exists so that you are not dropped onto a blank grid. It asks about
you and about your vault, then lays out a board from the answers.

You can run it at any later time from **Settings → Hearth → About → Build a
dashboard**, or with the command **Set up Hearth**.

### The six steps

**Step 1 — Welcome.** Explains what the wizard will do and lists any supported
plugins it has already detected in your vault. If it finds none, that is fine:
Hearth works entirely on its own.

**Step 2 — Your vault.** Names the board. You set the *Title* shown large across
the top, whether the title is shown at all, the *Title icon* beside it (an
emoji, a couple of characters, a Lucide icon id, a vault image path, or an image
URL — leave it empty for the Hearth crystal), whether the title and/or icon
should follow your theme's accent colour, and whether the search bar is shown.

**Step 3 — Look.** Chooses a card surface and a background.

The three card surfaces are *Frosted* (translucent cards over a soft blur of the
background), *Solid* (opaque panels, easiest to read over a busy photograph) and
*Minimal* (no card surface at all, content floating on the background).

The four backgrounds are *Hearth's wallpaper* (the image that ships with the
plugin), *Live sky* (a painted sky drawn from real weather over a place you
pick, or one condition pinned and kept), *A flat colour* (the lightest option
there is), and *None* (your theme's own background, untouched).

You also choose whether the background sits behind everything or is worn as a
*banner* strip across the top of the board, and whether spacing is compact.

**Step 4 — What for.** Pick as many purposes as apply. Each one adds cards:

| Purpose | What it adds |
| --- | --- |
| Daily notes & journaling | Today's note front and centre, with a calendar to move between days |
| Tasks & to-dos | A task list, read from your checkboxes or from a task plugin |
| Planning & calendar | A full month/week/day calendar, including any subscribed feeds |
| Finding my notes | What you touched recently, plus a shelf of favourites |
| Quick capture & launching | Tiles for the notes and commands you reach for constantly |
| Vault statistics | How big the vault is and how active you have been |
| Reading & feeds | An RSS card for the sites you follow |
| A bit of life | Weather, and a small pet that lives on your board |

A running count tells you how many cards the board is up to.

**Step 5 — Integrations.** Hearth lists the supported plugins it found installed
and enabled, each with the single thing accepting it will do:

| Plugin found | What Hearth does with it |
| --- | --- |
| TaskNotes | Adds a Tasks card on the TaskNotes source, using TaskNotes' own field names and completed statuses |
| Kanban | Adds a Tasks card showing your board as draggable columns |
| Dataview | Adds a Dataview card, seeded with an editable query |
| Datacore | Adds a Datacore card ready for a query |
| Templater | Adds a launchpad with one button per template you already have |
| Git | Adds a Git card with status, commit and sync |
| Operon | Adds an Operon tasks card (desktop only; Operon still has to approve Hearth separately) |
| Bases | Embeds a `.base` file from your vault |
| Daily notes | Adds a card showing today's daily note, editable in place |
| Bookmarks | Adds a card listing your bookmarks |

The TaskNotes case is worth understanding. TaskNotes lets its users rename its
frontmatter fields and define their own statuses, so there is no fixed set of
names Hearth could assume. The wizard reads the names TaskNotes is actually
configured with — the status field, the due field, the priority field, and which
statuses count as done — and writes them onto the Tasks card it creates. A vault
that renamed `due` to `deadline` therefore gets a Tasks card that works on its
first render. The wizard shows you the values it read before it uses them.

Nothing is installed, enabled or changed in the other plugin. The wizard only
adds a card to the board it is building.

**Step 6 — Finish.** Shows a preview: a scale drawing of the board, plus a list
of every card with the reason it is there ("Daily notes is enabled", "Reading &
feeds", "Templater templates were found"). You name the dashboard, and choose
whether it replaces the board you are on or is added as a new one.

Nothing is written to your vault until you press **Build my dashboard**.

### What the wizard writes, and what it never touches

This distinction matters if you already have Hearth set up the way you like it.

Everything the wizard sets lands as a **per-board override on the one dashboard
it builds**: the title, the title icon, the accent colour target, the card
surface, the spacing, and the background. The TaskNotes field mapping lands on
the Tasks card itself. Your vault-wide settings, and every other dashboard you
have, come out of a setup run exactly as they went in.

That is also why the wizard no longer asks about things that can only be
vault-wide — whether Hearth opens on startup, where notes open, which search
engine to use, whose file icons to show. Those live in **Settings → Hearth**,
one toggle each, and apply everywhere by design.

When you run the wizard again later from *Settings → Hearth → About*, it
**always** adds a new dashboard. Every board you already have is left alone;
nothing is replaced or removed.

### If you skip the wizard

Skipping is a supported choice. You get Hearth's starter dashboard, and you add
cards yourself with **Arrange → Add card**. See
[chapter 6](06-arranging-cards.md).

## What to do immediately after setup

The wizard's own closing advice is worth repeating, because it is accurate:
the board it built is a starting point, not a preset. Hearth is built above all
to be customised, and the wizard touches only a fraction of it.

Three things to try first:

1. **Press Arrange** (top-right of the board). Drag a card. Resize it from a
   corner. Open a card's settings with its gear button. Add a card you did not
   ask the wizard for.
2. **Open the dashboard switcher** (top-left) and press **+** to make a second
   board. Give it an icon. Bind *Switch to dashboard 2* to a hotkey.
3. **Open Settings → Hearth** and read down the eight categories. There is a
   great deal in there that the wizard never asked about.
