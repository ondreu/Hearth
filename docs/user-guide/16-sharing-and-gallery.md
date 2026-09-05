# 16. Sharing dashboards: export, import and the gallery

Hearth can save a dashboard as a file that looks the same in someone else's
vault, back up your whole setup as JSON, and — if a gallery server is configured
— publish a board where other people can browse, rate, comment on and install it
in one click.

This chapter covers all three. The underlying file format is documented for
developers in [`docs/dashboard-package.md`](../dashboard-package.md).

## Why a dashboard needs a special file format

A Hearth dashboard never described itself completely. Half its appearance lives
on the board and half in the vault's global settings, which the board falls back
to for anything it has not overridden. A board handed to another vault would
therefore arrive wearing *that* vault's grid, card opacity, wallpaper and search
placeholder.

The export format solves this by optionally **flattening**: writing the resolved
appearance values onto the dashboard itself so it looks the same wherever it
lands. This is a switch you control.

---

## Exporting one dashboard

**Where:** *Settings → Hearth → Backup → Export this dashboard*, or right-click
a dashboard's switcher button → *Export dashboard…*.

The dialog is titled **Share dashboard** and has two destinations: **Save a
file**, and **Publish** to a gallery if one is configured.

### The basics

| Field | Meaning |
| --- | --- |
| *Name* | What this dashboard is called in the file. Defaults to the board's own name |
| *Description* | Optional. A line or two about what this dashboard is for |
| *Tags* | Optional, comma separated. Useful if the dashboard is going somewhere it can be browsed |
| *Recommended with my theme* | Note that the board is meant to be seen under the community theme you are currently using. It is a note for whoever installs it — nothing is installed or changed on their side |

### What travels

| Setting | Default | Meaning |
| --- | --- | --- |
| *Include the wallpaper and images* | On | Carries the board's background picture, any image icons and any explicit slideshow pictures **inside** the file, so it looks right in a vault that has never seen them. Makes the file bigger. Turn it off for a backup of your own vault, where the pictures are already in place |
| *Leave out my private information* | Off for a file, forced on for a publish | Removes the parts of the board that are about you rather than about the design |

Hearth tells you exactly what the current settings mean in numbers — for
example, "As it stands, this file will mention 4 paths from this vault and 1
calendar feed URL."

### What "leave out my private information" removes

Four groups, each of which you can also toggle individually in the details
section:

| Group | What comes out |
| --- | --- |
| *Remove note and folder paths* | Everything the board points at in your vault, and the folder each embedded picture came from. The pictures themselves still travel if the wallpaper switch is on; it is the folder they lived in that goes |
| *Remove calendar feeds, private hosts and your location* | ICS calendar links (anyone holding one can read that calendar), an internal Jira host, and the place a weather card is set to |
| *Remove text you typed on the board* | A text card's body and a calculator's last input |
| *Remove searches and Dataview queries* | Off by default: a board without its queries stops doing anything. Worth turning on if a query names a private folder |
| *Remove command ids and view types* | Off by default: these name plugins, not you. Removing them leaves the buttons that ran them doing nothing |

The board still looks exactly the same afterwards. The cards simply arrive
pointing at nothing, which whoever downloads it has to fill in anyway.

Leave the switch **off** for a copy of your own board, which needs its paths to
keep working.

### The details disclosure

*See and tune exactly what travels* opens a section that lists each group with
**the actual values read from this board underneath it**, so it is a list you can
check rather than a promise you have to trust. It also carries:

*Copy this vault's appearance settings onto the dashboard* — the flattening
switch described above. Turn it off and the board carries only its own overrides
and adapts to wherever it lands.

Hearth tells you how many values will be removed, and warns you if any exported
value **still looks like a vault path** after the strip: "Exported, but N values
still look like vault paths. Worth opening the file before you share it."

### Credentials are never exported

A Jira personal access token, and anything else a card can hold as a credential,
is always removed. This is not a switch.

### Where the file goes

On desktop, the file downloads. On mobile, it is saved to your vault's root
folder and Hearth tells you the filename.

---

## Backing up everything

Two further exports live at **Settings → Hearth → Backup**:

- *Export layout* — every dashboard plus the grid and layout settings, as JSON.
- *Export settings* — every Hearth setting: the full layout plus header,
  background, behaviour, appearance and TaskNotes options.

These are backups of your vault's Hearth configuration, not things to share.

---

## Importing

**Where:** *Settings → Hearth → Backup → Import*, or right-click a dashboard's
switcher button → *Import dashboard…*.

Hearth reads the file and **tells you what is in it before anything changes**:

- which of the three kinds it is — *One dashboard*, *A dashboard layout*, or *A
  full settings backup*,
- who made it, if it carries a checkable signature,
- which Hearth version it was made with,
- how many kinds of card it holds,
- how many pictures it brings with it,
- how many vault paths it points at,
- which plugins it wants.

### How to import it

| Mode | Meaning |
| --- | --- |
| *Add as a new dashboard* | Adds it alongside your own. Leaves every one of your settings alone |
| *Add its dashboards to mine* | For a multi-board file |
| *Update "<name>" in place* | Replaces one existing board |
| *Replace all my settings* | Replaces your dashboards and every Hearth setting with the ones in the file. **This cannot be undone**, and Hearth says so |

### Worth knowing

Before importing, Hearth lists anything that will not work perfectly:

- plugins the file wants that are not installed or not enabled here — those cards
  will be empty until they are,
- notes or folders the board points at that are not in your vault, with examples,
- how many things the board loads from the internet when you open it.

None of this stops the import. The cards come through and you can point them at
your own notes.

After importing, Hearth may add further warnings: that its task cards use custom
fields and you will need to turn on task field customisation to see them, that
some cards need a newer Hearth and were left out, or that some of its pictures
were missing from the file.

### Signatures

A file that claims an author but whose signature does not check out — because it
was edited after signing, or somebody put another maker's handle on it — is
imported **without** an author, and Hearth says so plainly. Everything else about
the import is unaffected.

---

## Your publishing identity

To publish to a gallery, or to vote on someone else's dashboard, you need a
**handle**.

A Hearth handle is an anonymous name derived from a signing key that is
generated in your vault and never leaves it. There is no account, no email, and
nothing about who you are. Because each file you publish is signed with that
key, **nobody else can publish under your handle**.

- *Create my handle* mints one. It is minted on first use and never before: a
  vault that has not shared anything has no identity to have.
- *Copy my recovery key* copies the key. **This is the only way to get the handle
  back.** It is held nowhere but this vault: if you lose it there is no reset and
  nobody to ask, and the handle — along with everything published under it —
  would be gone.
- *Use a key from another install* pastes a key in, so you can carry your handle
  to another vault. If you have not copied your current key first, Hearth warns
  you: replacing it cannot be undone, anything already published under the old
  handle stays published, but you could never post as it again.

Browsing and installing from a gallery need no handle at all.

---

## The dashboard gallery

The gallery is a server that stores published dashboards. Hearth ships pointed
at one, and the address is a setting.

**Nothing is fetched until you open the gallery, and nothing is sent until you
publish.** Clearing the *Gallery address* field under *Settings → Hearth →
Backup → Dashboard gallery* turns the gallery off for good.

Anyone can run their own: the server is a separate open-source project and starts
with one Docker command. See [`docs/gallery-hosting.md`](../gallery-hosting.md).

### Browsing

The gallery browser offers a search field, an *All dashboards* / *Published by
me* switch, and four sort orders: **Trending**, **Top rated**, **Newest** and
**Most installed**.

Dashboards are filed under nine categories: Getting things done; Planning &
calendar; Study & research; Writing & journaling; Work & projects; Personal &
home; Minimal; Information-dense; Everything else.

Each card in the list shows a picture of the board, its author's handle, its
install count, its score and its card count, and marks whether it hosts a plugin
view.

### A dashboard's detail page

Opening one shows the full picture, the description and tags, when it was
published and last updated, the author's version, the Hearth version it was made
with, and the theme it is recommended with if any.

It also shows two lists that matter before you install:

- **What's on this board** — the cards it contains.
- **What it needs** — the plugins, hosted views and settings it depends on, or
  *Nothing beyond Hearth itself*.

And an explicit network statement: either *Nothing on this board is loaded from
the internet*, or *N things on this board are loaded from the internet*.

A board that arrived without a checkable signature is marked as such: who made it
cannot be established.

**Install** downloads it and adds it as a new dashboard.

### Voting, comments and profiles

You can upvote or downvote a dashboard, and leave a comment. Both need a handle;
Hearth offers to make you one at that moment.

An author's profile page shows their **karma** (every upvote across everything
they have published, minus every downvote), their total installs, how many
dashboards they have published, and when they first published.

### Publishing

Publishing happens from the same dialog you export from, with a **Category**
picker added.

Before it uploads, Hearth says plainly: *This board becomes public: anyone using
this gallery can find and install it. You can withdraw it at any time, though
people who already installed it keep their copy.*

Two things are enforced for a publish that are optional for a file:

1. **Private information is always removed.** The paths, private-host, location
   and typed-text groups are pinned on and cannot be switched off.
2. **A picture of the board is required**, and you have to confirm you have
   looked at it.

### The screenshot, and why you have to look at it

Publishing needs a picture of the board. Hearth takes it by scrolling through the
board, so a long board is captured whole.

**Every word inside your cards is blanked out before the shot is taken.** The
header, the toolbar and each card's own title stay, and so does a card with
nothing of yours in it, such as a clock.

Then Hearth asks you to look. Click the picture to see it full size and read it.
Card titles, the header and anything a card shows that is not yours are meant to
be there; a note's text, a task, a file name, an event, a number from your life
is not. Publishing waits until you switch on *I've looked — nothing private is
readable in it*.

If something of yours **is** readable, do not publish the board: the picture
cannot be taken back once people have installed it. Report it instead — that is a
bug in the blanking, and it is worth fixing before it happens to somebody else.
There is a *Report it on GitHub* link right there.

Screenshots need the desktop application; on mobile, Hearth says so and suggests
saving the dashboard as a file and publishing it later from a desktop vault.
Hearth can also only photograph the board that is currently open, so you have to
switch to a board before publishing it.

### After publishing

Your own entries carry an **Update** button, which publishes the board again over
the existing listing rather than beside it, and a **Remove from the gallery**
button. Removing it means nobody new can find it; people who already installed it
keep their copy.

If the gallery accepts a board but its own check sees something that still looks
like a path from your vault, the board is **held for review** rather than listed,
and Hearth tells you.

### Gallery errors, and what they mean

| Message | Meaning |
| --- | --- |
| *No gallery is set up* | Put a gallery address in Hearth's settings |
| *The gallery is a server on the internet, and this vault has "Disable external calls" turned on* | Turn that setting off to browse or publish |
| *Couldn't reach the gallery* | It may be down, or this device may be offline |
| *That address answered, but not like a Hearth gallery* | Wrong address |
| *The gallery didn't accept this vault's identity* | An authentication problem |
| *The gallery is asking you to slow down* | Rate limited; try again in a few minutes |
| *That dashboard is too large for this gallery* | Turn off the wallpaper, or shrink it |
| *Hearth couldn't sign the file, so it wasn't published* | An unsigned board has no provable author. Your recovery key may be damaged; try pasting it in again |

---

## A summary of what is safe to share

| Kind of data | In a file export | In a gallery publish |
| --- | --- | --- |
| Layout, styling, colours, card settings | Always included | Always included |
| Searches and Dataview queries | Included by default | Included by default; removable |
| Public pages and feeds the board shows | Included | Included |
| Vault note and folder paths | Included unless you strip them | Always removed |
| Calendar feed URLs, private hosts, your location | Included unless you strip them | Always removed |
| Text you typed on a text card, a calculator's last sum | Included unless you strip them | Always removed |
| Jira personal access tokens and other credentials | Never included | Never included |
| A picture of the board | Optional | Required, with every word inside cards blanked, and you must confirm you looked |
