# 18. Troubleshooting and frequently asked questions

This chapter collects the questions people actually ask about Hearth, the
messages Hearth shows when something is not working, and what to do about each.

---

## Getting Hearth open

### Hearth does not open when Obsidian starts

Check *Open on startup* under **Settings → Hearth → Behaviour → Startup &
tabs**. It is on by default, so if it is off, something turned it off.

### A new tab is empty instead of showing Hearth

Check *Replace new tabs* under the same section. It is on by default.

### I cannot find the ribbon icon

The ribbon button is labelled *Open Hearth home*. If you have changed the *Tab
icon* setting under **Settings → Hearth → Appearance → Home**, it will be
wearing your Lucide icon rather than the Hearth crystal. You can also open
Hearth with the command *Open home dashboard*, which you can bind to a hotkey.

### Opening a note from the file explorer replaces my Hearth tab

This is Obsidian's behaviour: it hands a file to whichever tab is focused, and a
focused Hearth tab gets taken over.

Set *Notes opened from outside Hearth* to **A new tab (keep Hearth open)** under
**Settings → Hearth → Behaviour → Opening notes**. The trade-off, which Hearth
states: the file explorer then stops following what you open.

### Clicking things inside Hearth opens them in the wrong place

**Settings → Hearth → Behaviour → Opening notes** has a general *Open notes in*
setting and four per-source overrides — Links, Search results, Notes in cards,
and Notes Hearth creates. Each override can also follow the general setting.

`Ctrl`-click, or `Cmd`-click on macOS, always opens a new tab regardless.

---

## Finding settings

### Where do I change what a card shows?

Not in the settings window. Open the Home view, press **Arrange**, then press
that card's gear button. The settings page says so in a row of its own under
*Settings → Hearth → Dashboard → Cards*.

### Where do I change one dashboard rather than all of them?

Right-click that dashboard's button in the top-left switcher and choose
*Dashboard settings…*, or press *Dashboard settings* in the Arrange toolbar.

### A setting appears to do nothing

Three likely causes, in order of frequency:

1. **The performance tier is overriding it.** Steps below *Full* switch off
   animation, blur, translucency, timed refresh, and the wallpaper. The affected
   sections say so in place: "The performance tier overrides these right now.
   They are kept as they are and take effect again when you move back up."
2. **A more specific level is overriding it.** Opacity, blur, border and corner
   radius exist vault-wide, per dashboard and per card. The most specific level
   with an opinion wins.
3. **Card blur needs translucency.** Frosted-glass blur only shows when card
   opacity is below 100%. The setting says so.

### Card blur is set but I see no frosted glass

Card opacity must be below 100% for a blur to have anything to blur. Also check
the performance tier: *Reduced* and *Minimal* switch the blur off.

---

## Cards that are empty or complaining

Hearth's cards say why they are empty rather than showing nothing. The complete
set of these messages, and what each means:

### Cards waiting for a core plugin

| Message | Fix |
| --- | --- |
| *Enable the core Daily notes plugin* | Settings → Core plugins → Daily notes |
| *Enable the core Bases plugin to embed .base files* | Settings → Core plugins → Bases |
| *Enable the core Canvas plugin to embed canvases* | Settings → Core plugins → Canvas |
| *Enable the core Bookmarks plugin* | Settings → Core plugins → Bookmarks |

### Cards waiting for a community plugin

| Message | Fix |
| --- | --- |
| *Install the Excalidraw plugin to embed drawings* | Install and enable Excalidraw |
| *Install the Periodic Notes plugin* | Install and enable Periodic Notes |
| *Enable the Templater plugin to create notes from templates* | Install and enable Templater. The card keeps its configuration meanwhile |
| *Enable the Dataview plugin to run queries* | Install and enable Dataview |
| *Enable the Datacore plugin to run queries* | Install and enable Datacore |
| *Enable the Git plugin to manage your vault's repository* | Install and enable Git |
| *Enable the TaskNotes plugin, or switch source to checkboxes* | Either install TaskNotes, or change the Tasks card's *Source* to Markdown checkboxes |
| *This view isn't available — enable the plugin that provides it* | A Plugin view card is pointing at a view whose plugin is gone |

### Cards waiting for configuration

| Message | Fix |
| --- | --- |
| *Pick a file to embed in settings* | Open the card's settings and choose a file |
| *Set a query in card settings* | The Query card has no query |
| *Set a Dataview query in card settings* / *Set a Datacore query in card settings* | Same, for those cards |
| *Set a web URL in settings* | The Web page card has no URL |
| *Add pictures in card settings* | The Slideshow card has an empty list |
| *No images in this folder* | The Slideshow card's folder holds no images right now |
| *Add favorites in settings* | The Favorites card's list is empty |
| *Add links in settings* / *Add commands in card settings* / *Add a template in card settings* | Those tile cards are empty |
| *Add a feed in card settings* | The RSS card has no feeds |
| *Pick a location in card settings* | The Weather card has no place |
| *Pick a plugin view in card settings* | The Plugin view card has no view |
| *Pick a view for this board in dashboard settings* | A plugin view dashboard has no view chosen |
| *Pick a file for this board in dashboard settings* | That hosted view needs a file |
| *Enable the core Daily notes plugin, or subscribe to a calendar in this card's settings* | The Calendar card has no sources at all |
| *No Kanban board found — pick a board note in card settings, or create one with the Kanban plugin* | Auto-detection found no note with a `kanban-plugin` frontmatter key |
| *No repository open yet — set one up in the Git plugin* | The Git plugin is enabled but has no repository |

### Cards that found nothing

*No matches*, *No open tasks*, *No tasks match the filter*, *No recent files*,
*No bookmarks yet*, *No items in this feed*, *No Operon tasks match*, *Nothing
scheduled in this window*. These are not errors: the card is working and there
is nothing to show.

### Network-blocked cards

*Feeds are off (external calls disabled)* and similar messages mean *Disable
external calls* is on under **Settings → Hearth → Behaviour → Privacy &
network**.

### A card that failed to draw

*This card couldn't be drawn — see the console for details.* Open the developer
console (`Cmd`/`Ctrl` + `Option` + `I`) to see the error, and please report it on
GitHub. Only that card is affected.

Similarly, if a whole settings section fails, Hearth shows *The "<name>" section
couldn't be shown* in its place, with the same advice. The other settings are
unaffected.

---

## Tasks

### My TaskNotes tasks do not appear

TaskNotes has no stable API, so Hearth reads its frontmatter directly and has to
be told the field names. Open **Settings → Hearth → Integrations → Tasks /
TaskNotes** and match *Status field*, *Due date field*, *Priority field* and
*"Done" status value* to whatever TaskNotes is configured with. The defaults are
TaskNotes' own defaults.

### Some completed TaskNotes tasks still show as open

Hearth treats one status value as "done" by default. If your vault also uses,
say, `canceled`, add it to *Statuses counted as complete* on the Tasks card, one
value per line.

### Dragging a Kanban card in Hearth broke my board note

It should not: Hearth writes drops in Kanban's own format precisely so the note
stays editable in the Kanban plugin. If a board note comes out malformed, that is
a bug worth reporting with the note's contents.

### My custom task fields disappeared after importing a board

Turn on *Customize task fields* under **Settings → Hearth → Integrations**.
Hearth warns about this at import time: "Its task cards use custom fields — turn
on task field customization in Settings → Integrations to see them."

### Only one of my fields tints the task

Correct, and deliberate. A task has one background and one ring, so only one
field can use *Tint the whole task* and one *Glow around the task*. Hearth names
the field that already holds it.

---

## Operon

Operon is the integration most likely to need an action from you. Its messages
are specific:

| Message | What to do |
| --- | --- |
| *Operon's developer API is desktop-only and needs Obsidian 1.12.2 or newer* | Nothing — the cards cannot work on this platform or version |
| *The Operon integration is off — turn it on in Settings → Hearth → Integrations* | The kill switch is on |
| *Approve Hearth in Settings → Operon → Core → General → Developer API Integrations* | Go there and approve it |
| *Operon suspended Hearth's access* | Review Hearth's pending scope in Operon's Developer API Integrations |
| *Operon access was revoked* | Grant it again in the same place |
| *Operon is still starting up* | Wait, then press *Recheck now* |
| *Operon refused the connection* | Operon's own error text is shown underneath |
| *Reading works, but the change permissions haven't been granted yet* | You turned on *Allow changes*, which widens the request. Approve Hearth again in Operon |

### Operon could not confirm whether my change was applied

Hearth reports "unknown" rather than "failed", re-reads the card, and does not
offer a retry — a retry could apply the change twice. Check the task before
trying again.

### A drag onto an Operon board was refused

A move carries the status the board was drawn from. If the board is stale — the
task moved elsewhere since it was drawn — the move is refused rather than quietly
undoing someone else's change. Refresh and try again.

---

## Performance

### The board is warming up my machine

Work through the tuning order in [chapter 12](12-performance.md). In short: the
animated painted sky is the single largest cost, card blur is second, and hosted
plugin views are a cost the performance tier cannot touch.

### I stepped the tier down and the board is still heavy

Look for **Plugin view** cards. A hosted view runs another plugin's full view
live, keeping its timers, listeners and rendering going for as long as the board
is open, and Hearth's tier cannot slow it down. The card says as much in its own
settings.

### My animations stop when I switch to another app

That is *Pause animation when Obsidian isn't in front*, on by default. Turn it
off if you deliberately keep the dashboard on a second display.

### My laptop is on battery and the phone board is fine but the desktop one is not

The two have separate tiers. *Performance tier on mobile* defaults to *Balanced*
while the desktop tier defaults to *Full*.

---

## Layout and mobile

### My board looks completely different on my phone

At or below 600 pixels of measured board width, Hearth reflows the board into one
full-width column. Your stored layout is untouched and returns at full width.

If you would rather it did not, turn off *Stack cards on narrow screens* under
**Settings → Hearth → Mobile → Layout**, or set *Stack when narrow* to *Keep the
scaled layout* on that one board.

### A narrow split pane on my desktop is stacking too

That is the same feature: the threshold is the measured width of the board, not
the platform. It is also how you preview your phone layout — drag a pane narrow.

### One card ruins the phone layout

Open that card's settings, go to **Layout → On a narrow board**, and either
*Hide* it, give it a *Position* in the column, set a *Height*, or *Start
collapsed* so it builds only when tapped.

### How do I check the phone layout without a phone?

**Arrange → Preview at phone width**. It draws the stacked board inside a phone
so the proportions read properly. While in it you can drag card heights and
reorder with the move up and move down buttons.

### Two cards merged into one and I did not ask them to

That is edge-merging: cards snapped edge to edge lose their shared border so the
pair reads as one tile. Drag one of them a few pixels apart to separate them.

---

## Sharing and the gallery

### The shared dashboard looks wrong in my friend's vault

Half a board's appearance normally lives in the vault's global settings. Turn on
*Copy this vault's appearance settings onto the dashboard* — the flattening
switch in the export dialog's details section — so the board carries its resolved
values instead of picking up theirs.

### Cards in an imported board point at nothing

Expected, if the board was published rather than exported as a personal backup:
publishing always removes vault paths. Point the cards at your own notes.

Hearth also tells you at import time how many paths are missing, with examples.

### The gallery says my board is held for review

The gallery's own check saw something that still looks like a path from your
vault. It will not be listed until somebody there has looked at it.

### The gallery will not let me publish from my phone

Publishing needs a picture of the board, and screenshots need the desktop
application. Save the dashboard as a file on mobile and publish it later from a
desktop vault.

### I lost my publishing recovery key

There is no reset and nobody to ask: the key is held nowhere but the vault it was
made in. The handle and everything published under it are gone. Make a new handle
and copy its key somewhere safe this time.

### An imported file says its author cannot be established

Either it carries no signature, or its signature does not check out — it was
edited after signing, or somebody put another maker's handle on it. Hearth
imports it without an author. Everything else about the import is unaffected.

---

## Search

### Search does not find text inside my notes

Check *Search note contents* under **Settings → Hearth → Search → Search bar**.
It is on by default.

### I chose Omnisearch and now search is Hearth's again

The Omnisearch choice only sticks while the Omnisearch plugin is enabled. Disable
it and Hearth falls back to its own engine rather than showing an empty search.
Re-enable Omnisearch and select it again.

### A filter chip I want is missing

Chips are auto-detected: one appears only if your vault actually contains that
kind of file. Also check that it is not hidden under **Settings → Hearth →
Search → Search filters**, or on that board's *Filter chips* override.

### My file icons from Iconic or Iconize do not show

Check *Use icons from Iconic / Iconize* under **Settings → Hearth → Integrations
→ File icons**. Note that a file using an icon from a downloaded icon pack keeps
Hearth's own file-type icon; only Lucide icons and emoji are shown. If you set
icons through Iconize's frontmatter property and renamed that property, tell
Hearth the new name.

---

## General questions

### Does Hearth send any of my data anywhere?

No. There is no telemetry, no account and no phone-home. The only outbound
requests are the ones a card you added needs, and *Disable external calls*
silences all of them at once. See [chapter 17](17-privacy-and-network.md).

### Is Hearth free?

Yes, and MIT-licensed. There is an optional Ko-fi tip link in *Settings → Hearth
→ About*; no features are locked behind it.

### Was Hearth written by AI?

Yes, and the README says so plainly. Every pull request is tested in a testing
vault by a human before merging, and every release is beta tested in a testing
vault by a human before being promoted to stable.

### Can I use Hearth in more than one vault?

Yes. Its configuration lives in each vault's plugin data, so each vault has its
own dashboards. You can move a board between vaults with *Export dashboard* and
*Import*, and you can carry your publishing handle across with its recovery key.

### Can I translate Hearth?

Yes, and translations are explicitly one of the most valuable contributions
right now. User-facing strings live in `src/locales/`; English (`en.ts`) is the
source of truth. Copy it, translate the values and register the file — see
`src/locales/README.md` and [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

### The card I want does not exist

Press **Arrange → Add card**, and use **Request a card** at the bottom of the
left rail. It opens either a pre-filled GitHub issue or a pre-filled email,
carrying a few prompts and your Hearth and Obsidian versions. You can edit
anything before sending.

### How do I report a bug?

**Settings → Hearth → About → Report an issue** opens the GitHub issue tracker.
Bug reports and feature ideas are the most valuable contributions to Hearth right
now. For anything larger than a small, obvious fix, open an issue before writing
code — Hearth moves fast and big pull requests against a fast-moving codebase
tend to go stale.

### Where are the release notes?

**Settings → Hearth → About → What's new** inside Obsidian, or
[`CHANGELOG.md`](../../CHANGELOG.md) in the repository.
