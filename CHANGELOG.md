# Changelog

All notable changes to Hearth are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a numeric-only versioning scheme
(`MAJOR.MINOR.PATCH`) as required by Obsidian's plugin manifest. Beta builds
carry a fourth `.N-beta` segment and are omitted here; each entry aggregates its
preceding beta series.

History begins at 1.5.0. For releases before 1.5.0, see the
[GitHub Releases](https://github.com/ondreu/Hearth/releases) page.

## [2.1.0]

### Added

- **Move an Operon task by dragging it, and add one from the card.** The Operon
  board card now supports **drag and drop between status columns** — with the
  same move on each row's **right-click menu**, so it is reachable without a
  pointer — and the
  board and list cards offer a **+** that creates a task. Both are off until you
  switch on **Allow changes** under Settings → Hearth → Integrations → Operon:
  Operon's developer grant is all-or-nothing, so asking for write access by
  default would make every read-only vault approve it, and turning it on widens
  the request and needs a fresh approval in Operon's own Developer API
  Integrations.

  Operon stays in charge of both. Hearth previews a change, Operon rates it and
  applies it, and any plan it marks as needing consent — or as more than routine
  — is confirmed with you before it runs. A move carries the status the board
  was drawn from, so a drag on a board that has gone stale is refused instead of
  silently reverting a change made elsewhere. Where a new task lives, and
  whether it is an inline checkbox or its own note, is read from Operon's own
  settings rather than decided by the card. And if Operon can't confirm whether
  a change landed, Hearth resolves that one plan with Operon and then says the
  outcome is uncertain — it never re-applies, which is how a task ends up moved
  twice.

- **Operon tasks, boards, agendas and the running timer on the dashboard.** Four
  new cards read from the [Operon](https://github.com/hasanyilmaz/operon) task
  plugin: a task **list**, a **board** whose columns are Operon's own pipeline
  statuses in its order and colours, an **agenda** grouping the next few days of
  due work, and a **timer** showing the active tracker, ticking live. Filter by
  pipeline, status, priority, completion state, note or text — the pickers offer
  what Operon actually has, so there are no ids to type — or delegate the
  question entirely by picking one of Operon's own scopes (*Happening today*,
  *Overdue*, *Recently touched*). Clicking a task opens its note, landing on the
  exact line for an inline task. The **Mini calendar** card can mark days with an
  Operon task due and list them in the agenda alongside external-calendar events.

  Unlike the TaskNotes integration, this reads nothing off disk: Operon ships an
  in-process developer API, and Hearth uses it, so recurrence, statuses,
  priorities and what counts as done all stay Operon's to define and keep working
  as Operon changes. The integration is **read-only** — no card here modifies a
  task.

  Operon's developer API is **desktop-only, needs Obsidian 1.12.2 or newer**, and
  requires **your approval**: Hearth's first request appears under Settings →
  Operon → Core → General → Developer API Integrations, and the cards say exactly
  what they're waiting for until you approve it. Settings → Hearth →
  Integrations shows the connection status, the read access Hearth asks for, and
  a switch to turn the whole thing off.

- **A launchpad that makes notes: the Templater card.** Hearth's third tile card
  sits beside Links and Commands, but each of its buttons creates a note. A tile
  carries three things — one of your
  [Templater](https://github.com/SilentVoid13/Templater) templates, the folder
  the note goes in, and what it is called — and one click makes it.

  **The destination is the point.** Templater's own per-template commands drop
  the note wherever Obsidian's "Default location for new notes" says, so the
  same template can only ever land in one place. A tile carries its own folder,
  so *Meeting* → `Work/Meetings`, *Book note* → `Library`, and *Idea* → `Inbox`
  are three buttons over one or three templates, whichever you have.

  **Filenames are patterns.** `{{date}}`, `{{date:YYYY-MM}}`, `{{time}}` and
  `{{time:HH-mm}}` are substituted when the tile is clicked, and `{{prompt}}`
  asks you for the rest of the name first — so `Meeting {{date}} — {{prompt}}`
  is one click and one line typed. Leave the field empty and Templater names the
  note, as it does from its own command.

  **Templater does the templating.** Hearth calls
  `create_new_note_from_template` on the running plugin and nothing else: your
  user scripts, `tp.system.prompt()` dialogs, folder templates and
  `tp.file.cursor()` placement all behave exactly as they do everywhere else.
  What Hearth adds is where the note *opens* — through its own "Open notes in"
  setting, so a click from the dashboard no longer replaces the dashboard.

  Tiles drag, resize and overlap like every other launchpad tile, take a Lucide
  icon or a vault image, and can be told to file the note away silently instead
  of opening it. The template picker lists Templater's own template folder. And
  the setup wizard offers the card on a fresh install, seeded with a button per
  template you already have.

- **A setup wizard that builds your first dashboard.** A new install no longer
  lands on a generic starter grid and a wallpaper nobody chose. Hearth asks
  instead — a title and logo, a card style and a background, what you actually
  use the vault for, how it should behave on startup — and lays out a board from
  the answers.

  **It looks before it asks.** Every supported plugin that is installed and
  enabled in *your* vault is offered on its own step, each with the single
  concrete thing accepting it will do: TaskNotes and Kanban configure a Tasks
  card, Dataview and Datacore add a card seeded with an editable query, Git adds
  a Git card, Omnisearch becomes the search bar's engine, Iconic/Iconize turn on
  your own file icons, a `.base` in the vault gets embedded, and Daily notes and
  Bookmarks add the matching cards. Nothing is installed and nothing is changed
  inside the other plugin.

  **TaskNotes is read properly, not merely noticed.** Its field names are
  remappable and its statuses are user-defined, so Hearth reads the running
  plugin's own configuration — the status, due and priority properties, and
  every status it counts as complete — and copies them across. The step shows
  you exactly what it found. A vault that renamed `due` to `deadline`, or that
  treats "cancelled" as finished, gets a Tasks card that is right on its first
  render instead of one that silently shows nothing.

  **Nothing is written until you say so.** The last step draws the board to
  scale and lists every card with the answer that put it there. A board too tall
  to squeeze onto one screen is set to scroll rather than being scaled down to
  nothing — as an override on that board alone.

  **And it says so up front.** The final step *opens* by saying that the board
  it is about to build is a starting point rather than a preset: enough to show
  what Hearth can do for you, but only a fraction of what there is. Every card
  can be moved, resized, retitled, recoloured, reconfigured or thrown out, and
  there is a great deal more in the settings than the wizard asks about — so go
  and edit all of it to your liking.

  Run it again any time from **Settings → Hearth → About → Build a dashboard**
  or the **Set up Hearth** command. Run that way it **always adds a new
  dashboard** and never touches an existing one, so it is safe to press just to
  see what it would make. Only the first-run prompt offers to replace the
  untouched starter board.

  Existing vaults are never interrupted: the wizard is offered only to an
  install with no saved Hearth settings at all, and dismissing it counts as an
  answer, so it can't nag.

- **A board that wears its background as a banner.** **Appearance → Background →
  Background layout** offers a second way to show the backdrop you already have:
  instead of filling the view, it is cropped into a strip across the top of the
  board — a cover image, the way one sits above a note — and the cards sit below
  it on your theme's own surface.

  It is the same background either way. The kind, the value, the opacity and the
  blur all mean exactly what they meant before, a live weather sky included, so
  switching between the two is one dropdown and loses nothing. What the banner
  adds is its own shape: **how tall** the strip is, whether its lower edge
  **fades** into the page or ends on a line, and whether it **lines up with the
  content** or runs edge to edge.

  **Every board chooses for itself**, in its own settings under **Background**.
  The layout and each part of the banner's shape are separate overrides, and
  each one either follows the vault or doesn't — so a board can wear the
  wallpaper you already have as a banner without restating the picture, keep a
  full background while the rest of the vault has moved to banners, or set its
  own height and let the fade and width follow along. Every control says which
  it is doing, and resets to following the vault.

  On a fit-to-page board the grid simply takes the height the banner leaves it.
  Low power mode still replaces the picture with its flat colour, but it now
  leaves the *layout* alone: a bannered board keeps its banner, so toggling the
  mode no longer moves every card on it.

- **Lucide icons for the tab and the title.** Hearth's crystal is no longer the
  only mark it can wear. **Appearance → Home → Tab icon** picks any Lucide icon
  for Hearth's tab header and ribbon button, and **Title icon** does the same for
  the icon beside the big title on the board. Leave either empty and nothing
  changes: the crystal, and the emoji/text logo, stay exactly as they were.

  **Each dashboard can set its own title icon**, under **Header → Title icon** in
  that board's settings — one board a flame, the next a rocket, or one board back
  to the plain logo text while the vault-wide setting shows an icon.

  **Every icon field is now a picker.** Type an id if you know it, or press the
  magnifier and search the whole Lucide set with each icon drawn beside its name;
  a preview beside the field shows what you'll get. That applies to the dashboard
  switcher's icon too, which until now was an id typed from memory. An id that
  names no icon falls back — to the crystal, the logo text, or the switcher's
  number — rather than leaving a blank where the icon should be.

- **The calculator converts number bases.** Binary, octal, decimal and hex now
  read and write in the same grammar as every other conversion:
  `FF hex to decimal` → `255`, `1010 binary to hex` → `0xA`, `377 octal in
  decimal` → `255`. A bare number is decimal, as it is everywhere else in the
  card, so plain arithmetic converts too — `20 + 35 to hex` → `0x37`.

  Results carry the notation you'd paste back into code (`0xFF`, `0b1010`,
  `0o377`), and the card reads that notation back: `0xFF to decimal` works
  without naming the source base. Negative values keep a sign in front of the
  digits (`-0xA`) rather than wrapping into two's complement at a bit width the
  card never asked you for.

- **An embedded picture can be framed, not just embedded.** An image embed used
  to render at whatever size the picture happened to be, in a box that scrolled
  — a wide photo in a short card showed a sliver of itself. The embed card's
  Content tab now offers the usual choices for any picture target, on the
  primary view and the second view alike:

  - **Fit the whole picture** — scaled down whole, letterboxed if it has to be.
  - **Fill the card (crop)** — the whole card, edge to edge, cropping the
    overflow.
  - **Stretch to the card** — both edges pinned, aspect ratio be damned.
  - **Fit the width (scroll)** — full width, its own height, scroll for the rest.
  - **Original size** — what image embeds have always done, and still the
    default, so no existing card changes.

  **Picture position** anchors the picture to any of nine points, which is what
  decides *which part* a crop keeps — a portrait cropped to a wide card can hold
  onto the face instead of the middle. **Zoom** now works inside the frame too:
  zooming a cropped picture crops in further rather than scrolling the box.

- **A slideshow card.** **Notes & files → Slideshow** is the image embed with
  more than one picture: it shows them in turn, on a timer you set. Choose the
  pictures one by one — each can carry its own caption, and the list can be
  reordered by hand — or point the card at a folder and let every image in it
  (optionally including subfolders) play, so a card fills itself as you drop
  photos in.

  **The order is yours**: your own list order, by name, by date created or
  modified (either direction), or shuffled — a shuffled card reshuffles between
  passes, so it shows everything once per round without settling into the same
  running order forever.

  **And so is the way pictures change**: a plain cut, a crossfade, a slide or a
  zoom, over as long as you like, with an optional slow zoom into each picture
  while it is held. Pictures either fill the card or fit whole inside it, the
  caption can be shown over them, and hovering brings up previous / pause / next
  with the position. It rotates two `<img>` layers no matter how many pictures
  there are, so a folder of hundreds costs the same as a pair — and it respects
  low power mode and a reduced-motion preference, holding still rather than
  animating.

### Fixed

- **Arranging a fit-to-page board keeps the arrangement.** On a board whose
  cards are taller than the pane — which is what happens as soon as you zoom
  Obsidian in, so it depended on your screen and zoom level rather than on
  anything you did — cards no longer jump when you finish arranging. The board
  squeezes the layout vertically to fit one screen, but a drag or resize was
  stored as the *squeezed* pixels, so the squeeze was applied a second time on
  the next draw: the card landed above where you dropped it, shorter than you
  made it, gaps between neighbours narrowed, and every further arrange session
  walked the whole board a little further up. The stored geometry is now
  converted back out of the fit, so a card stays exactly where you put it.
- **Snapping works at every zoom level.** On the same fitted boards, the
  magnetic alignment guides were computed from the cards' unsqueezed positions
  while you were dragging against their visible edges, so edges tens of pixels
  away never came close enough to snap — matching a neighbour's height or edge
  was simply impossible until you zoomed back out. Guides now come from where
  the cards actually are on screen. A dragged card also no longer jolts to a
  different position the instant it starts moving.
- **Cards wait for you to finish typing before they refresh.** A card that
  tracks a file redraws when that file changes on disk — but if the thing
  changing it was you, typing into a field the card itself is showing, the
  redraw took the field (and your cursor) with it. Plugin-rendered inputs inside
  an embedded note are the clearest case: every write went back into the note,
  and a moment later the card reloaded under your hands, so finishing a sentence
  meant clicking back in over and over. A card now holds a refresh while a field
  inside it has focus and catches up once you click away — exactly when you want
  it to. The same wait applies to **Live refresh on vault changes**, which
  rebuilt the whole board out from under the same field.

## [2.0.0]

### Added

- **A real calendar card.** **Planning → Calendar** is the calendar you look at
  to plan a day, next to the mini calendar's month-at-a-glance. It draws four
  views and the toolbar switches between them without leaving the board:
  **Month**, where every day cell lists its events by name (with “+N more” when
  a day is busy); **Week** and **Day**, a scrolling time grid where each event
  sits at its own hour, overlapping ones split into side-by-side columns, all-day
  items ride in a band across the top, and a red line marks the current time;
  and **List**, the days ahead with their events under them.

  **It reads your calendars, not a second copy of them.** Sources are exactly
  the mini calendar's: ICS/iCal subscriptions, TaskNotes (scheduled tasks, due
  dates, recurring occurrences, timeblocks and the calendars subscribed inside
  it), and your daily notes — days that already have one are marked, and a day's
  number opens or creates it. Clicking an event opens the same details popup,
  with the same **Create note** action behind it.

  **The defaults are the point.** Out of the box it opens on the month, follows
  Obsidian's language for the week start and the clock, draws the *whole* day in
  the time grid — nothing can hide outside the visible hours — and scrolls
  itself to the first event of the day rather than to midnight. When you do want
  to change something, it is all there: which views the switcher offers (down to
  one, which hides the switcher), the week start, hidden weekends, week numbers,
  a 12- or 24-hour clock, named chips or bare dots in the month and how many
  before the rest collapse, the hours the time grid draws and how tall an hour
  is, the current-time line, and how far the list reaches. Anything you push
  outside the drawn hours moves into the all-day band instead of disappearing.

  Where you have navigated to is remembered while Obsidian is open, so saving a
  note no longer snaps the calendar back to this month.

- **The weather sky, as your background.** **Settings → Appearance →
  Background** has a new type: **Live weather sky**. The board's backdrop
  becomes the painted sky the weather card's artistic style draws — sun,
  crescent moon and a full field of stars, clouds drifting in three lanes,
  rain, drizzle, snow, layered fog and lightning — spread across the whole
  window and following the real conditions and the real time of day over a
  place you pick. The storm and the fog were rebuilt for the size: lightning
  is now several generated discharges, each a crooked forked stroke on its own
  timer over a sheet flash, rather than one drawn bolt blinking in one spot;
  fog is a bank of overlapping wisps drifting past each other at different
  speeds and densities, rather than three flat bands. It is the same painting, redrawn for the space: a window is
  several times a card, so it gets a wider box, more stars, more clouds and
  more rain rather than three enormous clouds. Pick the place by searching for
  it or by typing coordinates, or reuse one already set on a weather card in
  one click; the forecast is shared with any card on the same place instead of
  fetched twice, and refreshes itself every half hour.

  **Or pin a sky and keep it.** Set the sky to *fixed* instead of live and
  choose the condition yourself — always clear, always snow, always
  thunderstorm — and whether it follows your clock or stays permanently day or
  night. A fixed sky needs no location and never goes online at all.

  Backgrounds can be set globally or per dashboard, so one board can sit under
  a live sky and another under a permanent clear night. Opacity and blur work
  as they do for a wallpaper (switching to a sky lifts the photo-oriented
  default opacity once, since a gradient dimmed to 0.35 is just a grey slab).
  Low power mode still replaces the whole background with its flat colour, and
  a reader whose system asks for reduced motion gets the sky without the
  motion.
- **Weather card.** Current conditions and a forecast on the dashboard, from
  [Open-Meteo](https://open-meteo.com) — free, key-less, and with no account to
  create, so it works the moment you add the card. Point it at a place by
  searching for it (the name lookup happens once, in the card's settings; only
  the resolved coordinates are ever sent afterwards) or by typing coordinates
  yourself. **Five styles** take it from plain to painted: *Minimal* is one
  glyph and one temperature; *Compact* is a single row with the condition and
  the place; *Detailed* adds a grid of metrics; *Forecast* draws the hourly
  temperature as a curve with a daily strip beneath it; and *Artistic* fills the
  card edge to edge with a sky that follows the real weather and the real time
  of day — sun, crescent moon and stars, clouds drifting in three lanes, falling
  rain, drizzle and snow, fog banks and a lightning flash. **What it shows is
  yours to choose**: place name, condition, feels-like, today's high and low,
  humidity, wind (with a compass point), precipitation, UV, pressure, sunrise
  and sunset, the last-updated time, and how many hours and days the strips
  cover. Units are separate — Celsius or Fahrenheit, four wind units,
  millimetres or inches, and a 12- or 24-hour clock. Forecasts are cached and
  shared between cards, a stale reading is kept when the network is gone rather
  than blanking the card, the sky stops animating in low power mode, and the
  whole thing goes quiet under **Settings → Behaviour → Disable external
  calls**. Open-Meteo joins the Integrations catalogue.
- **Pet card.** A pixel-art companion that follows how much you write. Pick an
  animal — cat, dog, bird, fox, frog or blob — name it, and set its two colors;
  the outline, shading and belly are derived from the body color, and the whole
  sprite is drawn from a 16×16 character grid, so the card ships no images at
  all. Its mood comes from the vault, not from a timer: notes edited (or
  created) today against thresholds you set make it content, happy or bouncing
  with joy, and a quiet day leaves it slouched and bored, then curled up
  asleep once the vault has been still for a while, draining of color, with
  drifting z's. That is the entire ladder —
  there is no hunger, no age, no illness and no way to lose it, so a fortnight
  away from the vault costs nothing but a nap. Click the pet to pet it: hearts,
  and a stretch of guaranteed happiness.

  **Every rung is yours to set.** Where excited, happy and content begin, how
  long the vault must stay quiet before the pet sleeps, and how long a petting
  lasts. Set them however you like — they are always read back in climbing
  order, so no combination leaves a mood the pet can't reach.

  **It looks at you, and it knows what time it is.** The pet's eyes follow
  your pointer — over its own card, or anywhere on the dashboard, or not at
  all, as you like — by shifting under a pixel, snapped to the grid, with the
  face drawn whole underneath so nothing tears. A sleeping pet keeps its eyes
  shut. And a quiet small hour now reads as the hour rather than as neglect:
  in the night window you set, a bored or merely content pet goes to sleep
  under a moon instead of its z's, or the pet sleeps through the window
  whatever the day held, or the clock is ignored entirely. A good day still
  shows as a good day at midnight, and petting always wakes the pet.

  **And it sleeps when the vault does.** After a stretch with nothing touched
  anywhere in the vault — yours to set — the pet falls asleep whatever its
  mood and however good the day was, and any activity at all wakes it back to
  the rung the day earned.

  Each mood is drawn animation, not one picture being wobbled: the pet blinks,
  glances aside, wags its head, squashes as it lands from a hop and breathes in
  its sleep, from frames generated out of that single drawing. Everything is
  recomputed from file timestamps on each draw, so a synced `data.json`, a
  closed laptop or a device you have not opened in a month can never leave the
  pet out of step. Low power mode and a reduced-motion preference keep the pet
  perfectly still — the mood is in its posture and its face.
- **Git card.** If your vault is a repository kept by the
  [Git](https://github.com/Vinzent03/obsidian-git) plugin, the dashboard can now
  show and drive it. The card puts the branch, the staged and changed files, the
  unpushed commit count, the time of the last commit and the recent log on the
  board, and gives you buttons for **commit-and-sync, commit, push, pull, fetch,
  stage all, unstage all, discard all** and **switch branch**, plus one-click
  ways into the Git plugin's own source-control and history panels.
  Right-clicking a changed file offers its diff, staging, unstaging and discard;
  clicking one opens the note.

  **None of it is a second git client.** Every action is the Git plugin doing
  the work, queued on that plugin's own task queue — so your remote,
  credentials, commit-message template, submodule and backup settings all apply
  exactly as they do from the command palette, a card button can't interleave
  with an automatic backup, and errors surface where you already expect them.
  The card follows the Git plugin's own events instead of polling, so it moves
  in step with its source-control view, including after an automatic backup.

  **Built to be arranged.** Choose which of the four sections the card stacks
  (status, buttons, changed files, recent commits) and which buttons it offers,
  in which order, as icons or icons with labels. Decide what a commit from the
  card covers — staged-if-anything-is-staged (what the Git plugin itself does),
  everything, or only staged — give it a fixed commit message or let the plugin
  prompt for one each time, cap the file and commit lists, and turn on folder
  paths or an extra timed re-read for a repo that also changes outside Obsidian.
  Discarding asks first unless you say otherwise. The card is offered whether or
  not the Git plugin is installed — without it, the card says so and points at
  it — and Git joins the Integrations catalogue.
- **Datacore card.** Dataview is winding down in favour of
  [Datacore](https://github.com/blacksmithgu/datacore), so Hearth now has a card
  for it, in the same shape as the Dataview card: pick a query type, write a
  query, get a live result. **Query** is the no-code mode — type a Datacore
  query like `@page and #project` and the card renders the matches as a list of
  links that re-runs itself whenever the index changes, with optional paging.
  The other four modes run the text as a Datacore script (JSX, JS, TSX or TS),
  exactly as inside a `datacorejsx` block, so anything you can draw in a note —
  tables, cards, interactive views — you can put on the dashboard. A query with
  a syntax error says so on the card instead of failing silently, and the card
  is offered whether or not Datacore is installed — without it, the card says so
  and points at it. Datacore also joins the Integrations catalogue.
- **Every integration in one place.** **Settings → Integrations** now opens with
  a complete catalogue of everything Hearth works with — community plugins
  (Omnisearch, TaskNotes, Dataview, Git, Iconic, Iconize, Excalidraw), Obsidian's own
  core plugins (Bases, Canvas, Daily notes, Bookmarks, Search, File explorer,
  Workspaces, Audio recorder, plus any plugin whose side panel a Plugin view
  card can host) and the external services some cards fetch from (Jira, RSS and Atom
  feeds, iCalendar subscriptions, exchange rates, web search). Every one is
  listed whether or not it's installed, so the tab answers "what does Hearth
  work with?" and not just "what did I already set up". Each row says what the
  integration does, carries a live status (enabled, disabled, not installed),
  and points at where its settings actually live — the section below on that
  tab, another tab (Omnisearch is a choice in the search-engine dropdown), the
  card itself, the other plugin's own settings, or nowhere at all. Rows link
  straight there, and anything not installed gets a one-click Install button.
- **Low power mode.** One switch at the top of **Settings → Appearance** trades
  Hearth's visual effects for battery life and smoothness on slower hardware.
  While it is on the background becomes a flat colour (a muted grey-purple by
  default, and you can change it) instead of an image, GIF, opacity layer and
  blur; cards go opaque with no frosted glass behind them; transitions, hover
  lifts, shadows and animations stop; clock cards drop seconds and the sweeping
  second hand; and every timed background refresh pauses — web, RSS, calendar
  subscriptions, Jira and the live dashboard refresh all still load on open and
  on a manual refresh, they just stop waking the app up on a clock. Nothing is
  overwritten: the mode is an override, so your background, opacity and blur
  settings sit exactly where you left them (dimmed, with a note) and come back
  unchanged the moment you switch it off — per-dashboard and per-card overrides
  included.
- **Choose what a calendar entry shows.** A new **Entry details** section in the
  calendar card's settings (agenda layout) switches each chip on an entry on or
  off: the time, the calendar name, and — with TaskNotes as a source — the
  task's status, its priority, and the due / recurring / timeblock markers. On a
  narrow card the markers competed with the title itself; now every card shows
  only what earns its space. Existing cards are unchanged: everything the agenda
  already showed stays on, and the status chip (new, and only available here) is
  off until asked for.
- **TaskNotes as a calendar source.** A calendar card can now pick up your
  TaskNotes calendar and show it as a calendar card: scheduled tasks (sized by
  their time estimate), due dates, recurring tasks unrolled into one entry per
  occurrence, timeblocks from daily notes, and the ICS calendars subscribed
  inside TaskNotes itself. Everything is read the way TaskNotes reads it — its
  field mapping, its tag-or-property rule for what counts as a task, its custom
  statuses and priorities with their colours — and each layer defaults to
  whatever TaskNotes' own calendar is showing, so switching the source on
  mirrors your existing setup. Per card you can override any layer, hide
  completed or archived tasks, colour entries by status, priority or one fixed
  colour, and give due dates and timeblocks their own colours. Completed tasks
  show struck through with a faded day dot; a checkbox on each agenda entry
  completes it in place (per-occurrence for recurring tasks, exactly as
  TaskNotes records it), and the event popup shows the task's status, priority,
  contexts, projects and estimate with an **Open task** button that hands off to
  TaskNotes' own editor.
- **Choose where Hearth opens notes.** Settings → Hearth → Behaviour → **Opening
  notes** has a single **Open notes in** choice that governs every note Hearth
  opens: **a new tab** (what it has always done), **the current tab**, which
  replaces the home view so Hearth behaves like any other tab and the back
  arrow brings it straight back, **a split pane**, or **a new window**. Four
  optional rows under it take exceptions, each starting on *Same as above*, so
  links, search results, notes listed in cards and notes Hearth creates can each
  land somewhere different — a search hit taking over the Hearth tab while a
  link from a card opens beside it. Ctrl/Cmd-click still opens a new tab
  whatever the setting says, and the modifier combinations Obsidian understands
  for a split or a window work here too.

  A last row covers what Hearth doesn't control: **Notes opened from outside
  Hearth** — the file explorer, the quick switcher, the graph — which Obsidian
  hands to whichever tab is focused, taking a Hearth tab over. It still does by
  default (the dashboard acts like an ordinary tab, and the explorer's selection
  follows what you open), but set it to **A new tab** and the Hearth tab is left
  alone. Links inside an embedded Bases table now follow the **Links** rule too,
  instead of always replacing the dashboard (#106).
- **An embedded note can be opened in its own tab.** Note embed cards have a new
  **Open button** toggle in their card settings; turned on, a button on the card
  opens the embedded file properly — following the open-behaviour setting above.
  Off by default, so no existing board changes (#144).
- **Build your own task fields.** Turn on **Customize task fields** under
  Settings → Hearth → Integrations and the fixed metadata Tasks cards show is
  replaced by fields you define yourself. You start from a blank slate — a task
  shows its text and nothing else — and add fields one at a time:

  - **Name** the field, and choose how it's drawn: a **chip**, a bare
    **colored dot**, or **plain text**.
  - Give it a **key**: any frontmatter property, or one of the values Hearth
    reads itself (a checkbox line's ⏫ priority, a Kanban board column, a due
    date, the TaskNotes status). A field can have several keys, and each one
    that has a value shows one — so related metadata can live under one name.
  - **Map values** to nicer labels and colors: `high` → *Urgent* in red, `p2` →
    *Normal* in blue. A value you haven't mapped still shows, as itself, so
    nothing goes missing while you're still building the mapping up. Priority is
    matched in every spelling it comes in, so mapping `high` also catches a ⏫
    line — and mapping the exact word your notes use (`urgent`, `p1`) keeps its
    own label and color.

  - Or have the value **color the whole task** instead of adding anything to
    it: **tint** its background or **glow** around it, at a strength you set.
    An overdue task can turn the row red without a chip anywhere on it, which
    is legible across a whole board at a glance.

  **Dates know they're dates.** A date key has no values to map — instead you
  color and label it by where it falls: **before today**, **today**, **after
  today**. Leave the label empty to keep the date's own wording and just tint
  it. A frontmatter property holding a date can be marked as one, and gets the
  same treatment.

  **Click a value to change it**, in the list and on a board alike: the chip
  opens a menu of your mapped values (under their own labels), then the other
  values that key takes elsewhere in your vault, then a free entry for anything
  new and a clear. A date opens a **calendar** instead, with today / tomorrow /
  next week shortcuts. Frontmatter is written to the task's own note, so this is
  offered on TaskNotes tasks and notes made from a Kanban card; a plain checkbox
  gets it for its priority and dates, which live on the line.

  The switch is **off by default**, and while it's off every Tasks card renders
  exactly as it always has. The fields you define in Settings apply to every
  Tasks card; an individual card can define its own instead, from that card's
  settings (#157).
- **Editable notes can use Obsidian's Live Preview editor.** An editable Note
  embed or Daily note card has a new **Live preview** toggle beside
  **Editable**. Turned on, the card hosts Obsidian's own editor instead of
  Hearth's plain raw-Markdown box: formatting renders as you type, there's no
  double-click to get into edit mode, and links, embeds, undo and your editor
  plugins all behave exactly as they do in a normal tab. The card's own settings
  make the choice per card and per embed view, so a scratchpad can stay in raw
  source while a journal card reads like a page. Like the plugin-view card, the
  hosted editor is only alive while the card is on screen, and pending
  keystrokes are flushed to the vault before it's torn down. Left off, the card
  keeps the double-click raw editor it has always had (#160).
- **A real picker for adding cards.** **Arrange → Add card** no longer drops a
  single column of thirty bare names down the side of the screen. It opens a
  browser instead: a **search field** that matches names *and* descriptions (so
  "todo" finds Tasks and "iframe" finds the web card), a rail of **categories** —
  Notes & files, Planning, Vault insight, Tools, Integrations, Fun — and a grid
  of tiles where every card says in one line what it actually shows. The
  category you were last in is where it reopens, arrow keys walk the grid, and
  on a phone the rail folds into a row of chips above the tiles.
- **Request a card, from inside the picker.** The last entry in the rail is
  **Request a card**, for the moment you have looked through the whole catalogue
  and the card you wanted isn't in it. It offers two routes — a **GitHub issue**,
  opened on Hearth's feature-request form, or an **email** to the maintainer —
  and both open pre-filled: a few prompts about what the card should show and
  where its data would come from, plus your Hearth and Obsidian versions. Edit
  anything before you send it.
- **A search bar you can put anywhere on the board.** **Vault insight → Search
  bar** is the header's search field as a card — the same field, not a lesser
  copy of it, so `#tag`, `key:value` and `>` for commands all work, Omnisearch
  is used when you have routed search to it, body matches and recent files
  appear as they do above, and the arrow keys walk the results. When the field
  sits low on the board the results open upwards instead of running off the
  bottom.

  **The card is the size control.** The field fills whatever height the card
  has, so you make the bar chunkier or slimmer by dragging the card's edge in
  Arrange — no slider, and it starts thicker than the header's. Four things are
  yours to set: its own **placeholder** (blank keeps the global one), the
  **filter row** of file-type chips underneath — and, chip by chip, *which* of
  them this card offers, so a narrow bar can carry the two or three that earn
  their place rather than every type the vault happens to hold — an optional
  **button** beside the field (**New note** or **Search online**, the same two
  the header offers), and **Seamless**.

  **Seamless** is the one to try: the card stops looking like one. No border, no
  background, no title row — just the search bar, standing on the board on its
  own. It still drags, resizes and configures like any other card, and while you
  are arranging, the dashed outline every card gets marks where it is.

- **Turn the header search bar off — everywhere, or on one board.**
  **Settings → Appearance → Home** has a new **Show search section** toggle,
  right below **Show title**, that hides the search and command bar, its
  results and its filter buttons across the whole vault. Each dashboard still
  gets the last word: the board's search setting has moved to its **Header**
  tab, beside **Title visibility**, and grown from an on/off switch into the
  same three-way choice the title block already offers — **Use global
  default**, **Show search** or **Hide search** — so a board can keep the bar
  while the rest of the vault does without it, or drop it while everywhere else
  keeps it. Boards that never set the option follow the global toggle, and the
  search-bar card is unaffected: it is a card, and it stays wherever you put it.
- **Card border width, per card.** The border width already settable globally
  and per dashboard is now also on a single card: the **Style** tab of a card's
  settings has a **Card border** slider beside **Card opacity** and **Card
  blur**, with the same reset button to hand the card back to the dashboard
  default. Set it to 0 to drop one card's frame — border and the line under its
  title — while the rest of the board keeps its own.
- **Dashboard settings, straight from the Arrange toolbar.** A **Dashboard
  settings** button now sits next to **Add card** while you are arranging, and
  opens the very same editor as right-clicking the board's switcher button and
  choosing **Dashboard settings…** — name, header, layout, style and
  background for the board you are on. The right-click route still works; it is
  no longer the only one.

### Fixed

- **A task field set to "Colored dot" now draws one on dates too.** A date key
  quietly fell back to plain text whichever of the two you picked, so the dot
  and the text styles rendered identically. A date now honours the dot like
  every other value: the colour its relation to today gives it — or the overdue
  red, or the recurring accent — with the date itself and its label moved into
  the tooltip.

- **A priority now takes the chip and the plain-text styles like any other
  field.** Whichever of them you picked, a priority was drawn in its own
  dot-and-label form: "Chip" produced a dot and a word rather than the filled
  chip every other field gets. Both forms are now shaped like the rest, tinted
  by the priority's level instead of needing a color set per value. The
  dot-and-label form is still there as **Colored dot with label**, offered to
  fields that read a priority — and it is still exactly what a task shows when
  field customization is off, on a board card, and in a task's quick view.

- **Only one field can tint or ring a task, and the editor now says so.** A
  task has one background and one ring, so the second field asking for "Tint
  the whole task" or "Glow around the task" silently painted nothing. Both
  options are now unavailable on every other field once one has them, naming
  the field that does; a list saved before this gets a warning on the field
  that never showed.

- **The weather card's clouds sat in the wrong place.** Every cloud carried its
  position and size in an SVG `transform` attribute and its drift in a CSS
  animation — and a CSS animation replaces the transform attribute outright.
  So the moment a sky started moving, the whole bank lost its placement and
  slid across the top edge in a row. Clouds now drift in an outer group and
  carry their position in an inner one, so a cloudy sky is a sky with clouds in
  it rather than a strip of them along the top.

- **One card can no longer take the board down with it.** A card kind is drawn
  synchronously while the dashboard builds, and in Arrange mode the drag overlay
  and resize grips are attached *after* that draw. So an exception inside one
  card's render didn't just leave that card half-drawn — it left the card
  unmovable and unresizable, and abandoned every card after it in the loop. A
  failing render is now contained: that card shows a "couldn't be drawn" state
  with the real error on the console, and the rest of the board (and its drag
  handles) come up normally.

- **Embedded bases follow the card opacity in table view.** A `.base` card in
  list or cards view faded with the board like any other card, but the table
  view stayed a solid slab: it fills its container and rows with Obsidian's base
  surface colour (it needs opaque paint so its sticky header and first column
  cover what scrolls beneath). Base embeds now clear those surfaces so the
  card's own translucent background shows through, and the sticky header is
  painted with the card's surface colour, so it fades with the card instead of
  staying opaque. Row hover and selection highlights are untouched.
- **The task filter's Status row is readable again.** With more than a handful
  of statuses — TaskNotes states, Kanban columns, your own checkbox statuses —
  the chips took the whole row and squeezed the label down to *Sta…*, then
  wrapped into a staggered, right-aligned block. Status and Priority now stack
  their chips under the label and lay them out left to right, so the label stays
  whole and the chips read as one strip however many there are. Two things that
  went with it: a preset chip (**Overdue**, **High priority**, …) now shows when
  it's on and a second click takes it back off, instead of only ever applying;
  and a status your filter still selects but that no tasks use any more keeps
  its chip, so you can switch it off rather than having to clear the whole
  filter. Chips also report their on/off state to screen readers (#164).
- **A task list keeps one task per line.** A task whose title didn't fit
  alongside its chips broke across two or three lines — the checkbox alone on
  one, the title on the next, its status, priority and dates on a third — so a
  list of tasks with mixed title lengths read as a ragged block rather than a
  list. A row now holds the checkbox and title (with the status chip beside it)
  on the left and gathers every other chip at the right edge, and the title is
  the only part that gives way: it ellipsizes instead of wrapping the row. This
  is how the list already behaved with **Customize task fields** on; both modes
  now match (#156).
- **Task checkboxes are no longer clipped in embed, daily and jot cards.** A
  task list embedded in a card could have the left edge of its checkboxes cut
  off. Obsidian hangs a checkbox outside its list item by one and a half checkbox
  widths, and sizes checkboxes from the global font-size setting — which card
  text doesn't follow — so on a larger setting the checkbox outgrew the indent
  it hangs out of and spilled past the card's edge. The card's side gutter now
  sits on the embed itself, where it can actually shield content from being
  clipped, and widens to match the checkbox instead of being a fixed number, so
  it holds at any font size. Checkboxes still scale with your font setting;
  ordinary cards look exactly as before (#137).
- **No grey box under an editable note.** Double-clicking an editable Note
  embed, Daily note or jot card to edit it dropped a grey form-field panel
  behind the text — permanently so on mobile, where Obsidian's own textarea
  rule outranked the transparent background Hearth asks for. The raw editor
  now keeps the card's surface in every state, so switching between the
  rendered note and its source no longer changes the card's background (#160).
- **Note-content search results are readable.** A hit inside a note's body
  showed the raw slice of file it was cut from, so results imported from HTML
  or carrying frontmatter came out as a wall of `&quot;`, `&#039;` and `<br>`
  with `["Novák Jan", "Šikl Tomáš"]` quoting in the middle of it — and the whole
  line was accent-coloured, so it shouted as loudly as the file name above it.
  Excerpts are now cleaned before they're shown (HTML and entities decoded,
  frontmatter fences, heading, quote and bullet markers dropped, links reduced
  to their text, inline YAML lists unquoted), narrowed to the text around the
  match, and rendered as muted context with only the matched words highlighted.
  Omnisearch results go through the same treatment and highlight the words it
  reports matching, so both engines read the same way.
- **Search results are ranked by how well they actually match.** Obsidian's
  fuzzy matcher will scatter a query's letters across a long string and score
  the result respectably, so searching `banán` returned
  *Pohan**á**kový chlé**b** s **a**vokádovo-vaječ**n**ou pom**a**zá**n**kou* and
  *Library/Recipes/Polévka z pečených **b**atátů s cizr**n**ou **a** kukuřicí* —
  ranked above notes that plainly contain the word *banánu*. Results are now
  banded, and **every literal match outranks every fuzzy one**: a name starting
  with what you typed, then the query at a word start in the name, then anywhere
  in the name, then in the folder path, then in the note's body, and only then a
  fuzzy name match. Paths are matched literally and never fuzzily, so a folder
  search still works but can no longer conjure hits out of scattered letters.
- **Note-content matches take their place in the list.** They were appended
  after every name match, so a note whose body plainly contained the word ranked
  below every note whose title merely fuzzy-matched it — and when scattered
  titles filled the page, content search was given no room to run at all and the
  real matches never appeared. Body hits are now merged into the ranking, and
  only results that genuinely outrank them reserve a slot.
- **Accents no longer have to be typed exactly.** `banan` now finds *Banánové
  Snickersky* and highlights `Banán` in it, in file names, note bodies and
  Omnisearch results alike — matching ignores case and diacritics throughout.
- **Omnisearch results highlight the matched words again.** Omnisearch reports
  the words it matched stemmed and stripped of their accents (`banan` for a note
  that says *Banánové*), so looking for them literally found nothing and both
  the title and the excerpt came back unhighlighted. Hearth now also reads the
  spans Omnisearch itself marked in the excerpt — which carry the words exactly
  as the note spells them — and matches without accents on top of that.
- **Searching with the folders filter no longer comes up empty on Omnisearch.**
  Omnisearch indexes notes only, so with it selected as the search engine the
  folders chip could never match anything and every query answered "no matches".
  Folder searches now go to the built-in engine whichever engine is selected.
- **A saved-search card no longer lists folders you can't open.** The Query
  card's rows open a note when clicked, but folder hits were listed too and did
  nothing. It now searches files only.
- **Omnisearch failing is no longer shown as "no matches".** If Omnisearch was
  disabled mid-query or its API threw, the dropdown emptied as though the note
  didn't exist. Hearth now quietly answers with its own engine instead.

### Changed

- **Every card is in the picker, always.** Cards backed by a community plugin —
  Dataview, Datacore, Git — used to be *hidden* from the "Add card" menu until
  their plugin happened to be installed, so a third of the catalogue was
  invisible to the people most likely to want to know it existed: you could not
  find out Hearth had a Git card without already having the Git plugin. They are
  all listed now, marked **Needs Dataview** (or Datacore, or Git) while the
  plugin is missing, with a one-click jump to it in Obsidian's plugin browser
  when you add one. Nothing about the cards themselves changed — each one has
  always explained what it needs, in place on the board.
- **Searching note contents costs a lot less on a large vault.** A body search
  walked every note and built a lower-cased copy of it to match against, and the
  walk kept going after you'd typed the next character — so a few keystrokes
  left several full-vault reads racing each other, each allocating a second copy
  of the vault. A stale scan is now abandoned as soon as the query moves on, and
  folded bodies are cached (bounded, and re-read when a note changes), so
  refining a query re-uses the work the last one did.
- **The Plugin view card now says plainly how expensive it is.** Its performance
  hint was a line of muted grey text under the type dropdown, easy to skim past
  when it is the one card that can genuinely slow a dashboard down. It is now a
  warning callout that spells out why: the card runs another plugin's full view
  live, keeping that plugin's timers, listeners and rendering going for as long
  as the board is open, and every extra card costs again. With low power mode on
  it adds that this is the card that mode can't help with.
- **Links inside tasks now open where every other link does.** A `[[wikilink]]`
  in a task's text took over the current tab, which in a Hearth tab meant
  replacing the home view — while the same link on a card opened a new tab. Both
  now follow **Open notes in** (a new tab by default). To keep tasks behaving as
  they did, set **Links** under Settings → Hearth → Behaviour → Opening notes to
  *The current tab* (#106).
- **Today is marked more quietly in the calendar's agenda.** The current day's
  row no longer takes a heavy accent fill that made its text hard to read.
  Today is now carried by an accent ring around the date badge plus a faint tint
  on the row, with the stronger accent wash kept for hover — so pointing at the
  row is what lights it up. The row sets both states itself, so a theme's own
  saturated hover colour can't turn today into an unreadable slab, and hover no
  longer sticks after a tap on touch devices.

## [1.18.0]

### Added

- **Your Iconic and Iconize icons now show up in Hearth.** A file that has a
  custom icon set with either plugin keeps that icon everywhere Hearth draws
  one — Recent files, Favorites, Bookmarks, saved-search cards and the search
  bar — instead of the generic file-type icon. Bookmarks pointing at a note or
  folder now also follow the file's *type* icon rather than always showing the
  same page glyph, so a bookmarked PDF or canvas looks like one. Lucide icons and emoji are both shown; a file
  using an icon from one of Iconize's downloaded icon packs keeps Hearth's own
  icon, since those are SVG files rather than named icons. Neither plugin offers
  an API, so Hearth reads their settings directly and quietly falls back to the
  file-type icon if it can't. Turn it off, or point it at a renamed Iconize
  frontmatter property, under Settings → Hearth → Integrations (#132).

### Fixed

- **Sorting tasks by priority puts Highest at the top.** The priority sort
  ranked tasks by the coarse colour bucket the priority dot uses, which lumps
  Highest in with High (and Lowest in with Low). Tasks one level apart therefore
  tied, and the order fell through to the next rule — so a High task could sit
  above a Highest one. Priority now ranks on the exact level, so all five
  Tasks-plugin levels order Highest → High → Medium → Low → Lowest, with
  unprioritised tasks last. This applies to the priority sort, the priority step
  of a custom sort, and the priority tiebreak in the default smart sort (#145).
- **Checkboxes now stay checked.** Ticking a task in an embedded note, a daily
  note or a jot card looked like it worked and was lost on the next render:
  Obsidian only writes a checkbox click back to the file inside a real preview
  view, and the boxes Hearth renders into a card were live but inert. They now
  edit their source — the note for embed and daily cards, the card's own text
  for jots — so the state sticks, whether or not the card is set to editable.
  A tick is reverted if the write can't land, and a click on a checkbox no
  longer opens the raw editor when it lands as part of a double-click (#143).
- **Theme focus rings no longer break the search bar.** Under Catppuccin (and
  any theme that styles input focus with a body-class-prefixed selector), the
  home-screen search input picked up the theme's own focus ring, so a blue
  outline hugged the text field instead of the search bar lighting up as a
  whole. Those themes' selectors outrank the plain class selectors Hearth used
  to suppress the ring. The controls that draw their own focus affordance — the
  search input, the jot/embed editors, the calculator, the card-title field and
  the task-detail title editor — now hold that suppression against any theme.
  Inputs with an ordinary border, such as the Kanban editors and the task-detail
  description field, keep the theme's ring, since for them it is the focus
  affordance (#138).

## [1.17.0]

### Added

- **Keep an open dashboard current.** A home view now re-renders when you switch
  back to its tab, so Recent, Bookmarks and query-driven cards no longer show
  stale content until the tab is closed and reopened. The first render of a leaf
  is left alone, and refreshes are skipped mid-drag/resize so arranging a board
  is never interrupted. A new opt-in **Live refresh on vault changes** Behaviour
  toggle (default off) additionally re-renders on vault create/modify/delete/
  rename — debounced to coalesce bursts — so a permanently-visible board stays
  current without switching tabs (#110).
- **Completion checkboxes for every TaskNotes task.** Task cards showed a
  checkbox on recurring TaskNotes tasks but a plain status badge on the rest, so
  a mixed card looked inconsistent. Non-recurring TaskNotes tasks now get a
  checkbox too, in both the list and Kanban layouts. In the list, ticking writes
  the card's done status and unticking restores its first open status; on a
  Kanban board, ticking advances the task to the next swimlane (and eventually
  the done column), untick returns it to the first — mirroring how completing a
  task progresses its status. The checkbox swallows pointer events so ticking it
  on a draggable card doesn't start a drag. Recurring tasks keep their
  per-occurrence checkbox; checkbox- and Kanban-source tasks are unchanged (#111).
- **Status chip on TaskNotes tasks in the list layout.** With the checkbox
  replacing the old status badge, a task's actual status — open, in-progress,
  waiting, whatever your setup uses — was no longer visible in the list; the
  checkbox only says done or not. Each TaskNotes task now carries a small status
  pill directly after its title, left-aligned against it so it reads as part of
  the task while the priority and date chips stay on the right edge. It shows
  the raw frontmatter value (capitalized for reading) with the full value in the
  tooltip, and fades along with a completed row. Checkbox- and Kanban-source
  tasks keep their existing badges.
- **Vault images as tile icons.** Launchpad and command tiles accepted only a
  Lucide icon id; they now also take a path to an image in your vault (png, jpg,
  svg, webp, …), which fills the whole tile with the label overlaid on a
  legibility scrim. A bare Lucide id never resolves to a file, so existing icons
  are untouched. The icon field in both editors gains a "?" help badge
  explaining the two accepted forms (#119).
- **Per-dashboard "Default on mobile" flag.** A dashboard can be marked as the
  mobile default from its settings (General tab), so a board tuned for a small
  screen opens on phones and tablets without becoming the desktop default. Only
  one board can hold the flag. The switch is applied in memory only, because the
  active-dashboard id is a single synced field — persisting it would drag the
  desktop's active board along on the next sync (#120).
- **"Focus search on open" option.** An opt-in Behaviour setting that puts
  keyboard focus in the search field whenever a home view opens, so a fresh
  Hearth tab can be typed into straight away. Focus is applied on open only, so
  a background refresh never steals it mid-interaction. Desktop only — the
  setting is hidden on mobile, where auto-focus would pop the on-screen keyboard
  on every open (#115).

### Fixed

- **Opening a task's note jumps to the task's line.** "Jump to Note" (and a
  click when quick view is off) landed at the top of the note, so a task buried
  in a long note meant scrolling to find it. The target line is now passed as
  ephemeral state, which Obsidian applies once the view has mounted, instead of
  a cursor move that a not-yet-laid-out editor discarded (#118).
- **Calendar events no longer shift by a day.** Weekly recurring events expanded
  their by-day rule against a locale-aware week start combined with a
  Sunday-based day offset, so in any locale whose week starts on Monday (Czech,
  most of Europe) occurrences landed on the wrong date — off by up to several
  days. The expansion is now locale-independent. The agenda view's
  today-highlight is also toned down to a thin outline and a lightly tinted day
  number; the month grid keeps its existing highlight.
- **Search filter chips no longer strand across the search bar.** With only a
  few filters, the chips were distributed edge-to-edge — one at the start, one
  in the middle, one at the end. They now sit in a left-aligned row whose gap
  shares out the leftover space, growing from 8px to 48px with the chip count
  and wrapping only once the minimum no longer fits.

### Changed

- **Kanban boards are as translucent as task lists.** The list layout draws no
  surface of its own, so a translucent or frosted card shows straight through
  it — but a Kanban board covered the same card with an opaque column plate and
  opaque cards, reading as a solid slab on an otherwise see-through board.
  Columns are now a light tint rather than a plate, and cards a translucent fill
  with their hairline border defining the edge; both scale with the board's card
  opacity, so they fade in step with the surface they sit on.
- **Default background** swapped from an animated GIF to a static wallpaper;
  the GIF was needlessly power-hungry.
- **Card architecture modularised into a registry** (internal, behaviour
  preserving). Adding a card type used to mean editing a dozen scattered
  enumerations — render and editor switches, the add-card menu, layout-import
  validation, the live-redraw set, the card cloner, locale records — most of
  which failed silently when missed. Each of the 20 card kinds is now a
  self-contained module under `src/cards/` declaring its render, editor,
  templates, liveness and clone behaviour, collected by a registry whose mapped
  type turns a missing registration into a compile error. An unknown persisted
  card kind (from a newer version, a sync conflict or a hand-edited
  `data.json`) now falls back to an inert definition rather than crashing the
  whole dashboard render, and a cloned RSS card no longer shares its sources
  array with the original (#103).

## [1.16.0]

### Added

- **Jira saved-filter card.** Connect a dashboard card to a favorite Jira saved
  filter using a bearer personal access token, then refine its issues with
  multi-select status, assignee, priority, issue type, sprint, and fix-version
  controls. The card derives options from the unrefined filter, preserves
  selected values, supports manual and automatic refresh, caches successful
  responses, and keeps REST requests constrained to the configured HTTPS Jira
  host. Portable exports omit the Jira personal access token.

## [1.15.0]

### Added

- **Calendar card — agenda layout and external ICS calendars.** The calendar
  card gains a **Layout** setting: the existing month grid, or a new **agenda**
  view that lists upcoming days (3–60 ahead) as a scrollable timeline. It can
  also **subscribe to external calendars** by ICS/iCal URL (Google, iCloud,
  Fastmail, Nextcloud, …) — add multiple sources, each with its own name and
  colour and an individual show/hide toggle. Events render as coloured dots on
  the month grid and are listed under each day in the agenda, expanded from the
  common recurrence rules (daily/weekly/monthly/yearly with interval, count,
  until, weekly by-day, and exclusions). Feeds are cached and auto-refreshed on
  a configurable interval, share the RSS card's fetch path (so they work despite
  browser CORS), and honour the global **disable external calls** privacy
  setting. `webcal://` links are accepted. Clicking a day that has events opens
  a picker so you can choose the daily note (open or create) or any event; in
  the agenda, each listed event is clickable. Either way an event opens a
  details modal showing its name, date, time, location, notes/description,
  source calendar and any link. From that modal you can **create a note from
  the event**, configured to be as flexible as you like: pick a template,
  choose the target folder and a filename pattern (`{{summary}}`, `{{date}}`,
  …), and route every event value independently — send the date/time to custom
  frontmatter properties, append the description to the body under a heading,
  or ignore a value entirely and just keep the name. Sensible defaults apply
  out of the box. The note is linked back to the event by its ID (stored in
  frontmatter), so opening the same event later reopens its note instead of
  making a duplicate. Timezone note: UTC and all-day times are exact; `TZID`
  wall-clock times are read in the viewer's local zone.
- **Vault statistics card — advanced mode.** The stats card gains an **Advanced**
  toggle in its editor. Off keeps the familiar fixed set of tiles. On unlocks
  three controls: choose which built-in stats appear (notes, attachments,
  folders, tags, day streak, and a new **Days using Obsidian** counter measured
  from the vault's oldest file); break attachments out into a separate count
  tile per file type (images, PDFs, videos, …); and add custom count tiles that
  show how many files match a query, using the search bar's syntax (`#tag`,
  `key:value` for a frontmatter property, or plain text). Each custom tile takes
  an optional label and icon.

### Fixed

- **Clock card — force a 12- or 24-hour clock regardless of locale.** The clock's
  "24-hour time" toggle only chose between 24-hour and the OS locale default, so
  on locales that already default to a 24-hour clock there was no way to get a
  12-hour clock. It is replaced by a three-way **Time format** selector
  (Automatic / 12-hour / 24-hour) mapping directly to `Intl`'s `hour12` option.
  Existing settings are migrated, preserving prior behaviour (#98).

## [1.14.0]

### Added

- **Link a dashboard to a core Workspace (auto-switch).** Each dashboard gets an
  optional linked workspace, chosen from the core Workspaces plugin's saved
  workspaces in the dashboard settings (General tab). When that workspace loads,
  Hearth switches to the linked dashboard automatically. Sync is one-way
  (workspace → dashboard) and fires once per workspace change; the link survives
  layout export/import, and duplicating a dashboard deliberately does not copy it
  (#91).
- **Theme-following crystal icon.** The ribbon, tab and header crystal is now a
  vector drawn with `currentColor`, so an optional **Follow theme icon color**
  Appearance setting (Off / Icon / Title / Icon and title) lets it track the
  theme's icon color in light and dark. The default keeps the familiar purple
  crystal (#90).
- **Plugin view card — show a specific file.** The Plugin view card can now open
  a chosen vault file in the hosted view, so file-backed views (Excalidraw,
  canvas, …) render the document instead of an empty "new file" screen. The card
  editor gains a file field with a fuzzy picker and a clear button; a blank path
  hosts the bare view as before (#89).
- **Bookmark groups (folders).** The Bookmarks card now mirrors Obsidian's own
  bookmarks pane: groups render as collapsible folders (click the header to
  expand or collapse) and sub-groups nest to any depth, instead of every
  bookmark being flattened into one list. This also fixes bookmarks inside a
  group appearing twice — the card previously re-flattened Obsidian's already
  flat `getBookmarks()` list — and drops groups left empty after orphaned
  file/folder bookmarks are hidden (#82).

### Fixed

- **Open files in place from the dashboard.** The dashboard view now marks itself
  navigable, so opening a file (from the file explorer or elsewhere) while the
  dashboard is focused reuses the tab instead of spawning a new one and leaving
  the file explorer's selection stuck (#84).
- **Unnamed bookmarks show the file name, not the full path.** A file or folder
  bookmark without its own name previously rendered as its whole vault path,
  which overflowed the card when the path was long. It now shows just the
  target's basename — matching Obsidian's own bookmarks pane — and still falls
  back to the last path segment if the target can't be resolved (#92).

## [1.13.0]

### Added

- **Per-dashboard header customization.** Each dashboard can now override the
  global header defaults — title visibility and text, logo text/icon,
  alignment, title and logo size, the title's top margin, and the spacing below
  the header block — while search visibility stays independent. Import/export
  sanitises the new fields and duplicating a dashboard preserves its explicit
  overrides (#75).
- **Editable Kanban card titles.** A Kanban card's title can now be edited in
  place: **double-click** a card to swap its text for an inline input (Enter
  saves, Escape cancels), the same gesture that renames a column. The card's
  quick-view popover (single click) also shows the title as an editable field,
  so it's reachable by keyboard too. Either way the card's dates, priority and
  repeat markers are preserved; note-linked cards keep their note's name as the
  title (#71).
- **Editable Kanban card descriptions.** A card's quick-view popover now has a
  **Description** field for every Kanban card — not just when the "Dates &
  priorities" toggle is on. The text is saved as indented sub-bullets under the
  card in the board note, or, for a card that's been converted to a note, into
  that note's body. The card's title and metadata line is left untouched (#71).
- **Card border width setting.** A new global setting controls the width of
  card borders (#78).

### Fixed

- **TaskNotes tasks open in a working editor again.** Opening an existing
  TaskNotes task from a Tasks card handed TaskNotes' edit modal the note's
  `TFile` instead of its own task object, leaving the modal with a broken
  change-detection baseline: every button but Delete was trapped and the window
  couldn't be closed (#72). Hearth now resolves TaskNotes' task info for the
  note first (via its cache manager or public API) and only opens the modal when
  it can, falling back to opening the note otherwise.

## [1.12.0]

### Changed

- **Card & dashboard settings, reorganised into tabs.** The card-settings and
  per-dashboard-settings dialogs — previously one long, flat scroll of every
  control — are now split across tabs, mirroring the plugin settings pane so the
  whole plugin configures the same way. Card settings groups into **Content**
  (type, title and the card's own options), **Style** (colours, opacity, blur)
  and **Layout** (size, pin to all dashboards, copy to another), with Remove and
  Done always in reach at the bottom. Dashboard settings groups into **General**,
  **Layout**, **Style** and **Background**. The last-used tab is remembered, and
  a single failing group can no longer blank the whole dialog.

### Added

- **Recent files card — file-type filter.** The **Recent files** card can now be
  limited to specific file types. Its editor offers the same type chips as the
  search filter (Notes, Images, PDFs, Canvas, …); pick any combination to list
  only those, or leave them all off to keep showing every recently-opened file.
- **Card corner radius setting.** A **Card corner radius** slider controls how
  rounded card corners are, from the default 14 px down to sharp 0 px corners,
  at both global (Settings → Dashboard) and per-dashboard (dashboard settings)
  levels. Merged-together cards still flatten their touching corners, and the
  shared frosted-glass layer follows the same radius so nothing seams.
- **RSS feed card — add feeds from a GitHub repo.** The RSS card's editor now
  has an **Add from GitHub** shortcut: type a repository as `owner/repo` (or
  paste its URL), pick **Releases**, **Commits**, or both, and Hearth adds the
  matching `releases.atom` / `commits.atom` feeds for you — no need to
  hand-write the feed URLs.

## [1.11.0]

### Added

- **RSS feed card.** A lightweight, self-contained feed reader you can drop on
  any dashboard. Add one or more RSS/Atom feeds — each becomes a tab in the card
  header — with an optional combined **"All"** tab that merges every source
  newest-first. Choose between three layouts (**List** title + date, **Cards**
  with excerpt and thumbnail, or a **Compact** headlines view), cap how many
  items each feed shows, and set an auto-refresh interval (or 0 to refresh only
  when opened, plus a manual refresh button). Feeds are fetched through
  Obsidian's own request bridge (so cross-origin feeds work) and cached in
  memory, degrade gracefully offline (the last good items stay), and honour the
  **"disable external calls"** setting — with it on, no feed request is made.

### Fixed

- **Task date parsing no longer spams the console — and understands wikilink
  dates.** When a task's date field held something moment.js couldn't parse
  natively (e.g. `📅 [[260801]] #sd`, a due date written as a daily-note link),
  the parser fell back to moment's deprecated `new Date()` path, printing a
  loud RFC2822/ISO deprecation warning for every such field on every vault scan
  (#52). Dates are now parsed strictly (ISO first, then an explicit list of
  human formats), which can never trigger the warning. As part of the same
  change, date expressions may now be wrapped in a wikilink (`📅
  [[2026-08-01]]` or `[[Daily/2026-08-01|due]]` resolve to the linked day) and
  trailing `#tags` after a date are ignored (`📅 2026-08-01 #home`).

- **Settings pane no longer opens blank on Obsidian 1.13.** Root cause found
  (with an enormous assist from the affected users' console digging in #52):
  since the category-ribbon redesign, the settings tab had a private helper
  named `renderTab(body, tab)` — and Obsidian 1.13's reworked settings window
  calls an *internal, undocumented* `SettingTab.renderTab()` method (no
  arguments) as the entry point for opening a tab. Hearth's same-named helper
  silently shadowed it: Obsidian invoked it with no arguments, the
  `switch (undefined)` inside matched no category, and the pane rendered
  nothing — no error, on every reopen, on macOS and iPad alike (#52). And
  because Obsidian never got past that entry point, none of the earlier
  guards or the declarative registration could ever run. The helper is renamed
  so Obsidian's own machinery runs again, the tab additionally registers its
  pane through the 1.13 declarative settings API (older Obsidian versions keep
  using `display()` — same UI either way), and a constructor tripwire now
  reports any future member-name collision with Obsidian's `SettingTab`
  internals as a loud console error instead of a silent blank pane.
- **A failing settings section no longer blanks the whole settings pane.**
  Previously, if any part of the settings tab threw while rendering, the entire
  pane was left empty with nothing to explain why — and, because the tab
  remembers the last category you opened, it could stay blank on every reopen.
  The **entire** settings render is now guarded — each section, each tab, and
  the surrounding ribbon/datalist build — so a failure anywhere shows an inline
  error in its place and logs the underlying error to the developer console
  (including when Obsidian 1.13 renders settings in a separate window, whose
  console is easy to miss), instead of a silent blank pane. Whatever still
  works — sibling sections and the category ribbon — keeps working so you can
  navigate.
- **Orphaned file/folder bookmarks no longer linger in the Bookmarks card.**
  Obsidian keeps a file/folder bookmark in its store after the target note is
  deleted, and its native bookmarks pane hides those orphans; the Bookmarks card
  rendered the raw store, so a deleted note left a dead, unclickable row behind.
  File/folder bookmarks whose path no longer resolves are now filtered out,
  matching Obsidian's native behaviour. URL, search, and group items are
  unaffected.

## [1.10.0] - 2026-07-13

### Added

- **Hover-visibility options for dashboard controls.** The dashboard's
  arrange-mode zone and switcher can be set to reveal on hover instead of
  staying always visible, keeping the board clean until you reach for them; the
  hover hit-area is enlarged so they're easy to summon.
- **Per-dashboard search-bar visibility toggle.** Show or hide the search bar
  independently on each dashboard.
- **Base view selector for Embed cards.** An Embed card pointing at a `.base`
  file can choose which of the base's views it displays.

### Fixed

- **Invalid due dates no longer leak the text "Invalid date" into tasks.** A
  task due date that looked like an ISO date but wasn't a real calendar day —
  e.g. `📅 2026-02-31` (there's no 31st of February) or a month like `2026-13-01`
  — was being turned into the literal string **"Invalid date"** instead of being
  left alone. The validity check meant to reject such dates never ran (it tested
  moment's `isValid` as a property rather than calling it, so it was always
  truthy), so the bogus label was written straight into the tasks card. These
  dates are now correctly ignored, and any unparseable relative-date input falls
  back to showing the raw text verbatim, as intended. A silent bug — nothing
  errored, so it was easy to miss.
- **Hover-reveal controls no longer shift the board.** Switching a dashboard
  control to "Show on hover" added in-flow padding that only existed in hover
  mode, growing the control's zone by ~32px so it pushed the header and grid
  down — and in fit-to-page mode the extra height clipped the board. Hover mode
  now has the same footprint as always-visible mode, so revealing a control no
  longer moves anything.

## [1.9.0] - 2026-07-12

### Changed

- **Mobile action buttons: the legacy `commandId` field is migrated to
  `target`.** Buttons created before the unified command/note/URL model stored
  their action in a deprecated `commandId` field that was only read as a
  fallback. On load, such buttons are now migrated in place to the current
  `target` field and the result is written back to storage, so the legacy field
  finally leaves your `settings.json`. **This migration is one-way:** if you
  upgrade and then downgrade Hearth below this version, any mobile action button
  whose action was stored *only* as `commandId` loses its action (the button
  appears blank and must be reassigned). Buttons edited or created in a recent
  version are unaffected.

## [1.8.0] - 2026-07-11

A cards-and-appearance release aggregating the whole 1.7.1 beta series.

### Added

- **Dataview card** — runs a DQL or DataviewJS query and renders the results
  through [Dataview](https://github.com/blacksmithgu/obsidian-dataview)'s own
  renderers (tables, lists and task lists look native and refresh live), with
  auto-fitting, drag-resizable table columns.
- **Plugin view card** (beta) — hosts any plugin's — or a core — side-panel view
  (calendar, outline, tag pane, kanban…) right on the dashboard via a detached
  workspace leaf that never touches your saved layout.
- **Frosted glass** — a backdrop blur behind translucent cards at global,
  per-dashboard and per-card levels, drawn on one shared layer so merged cards
  read as a single seamless sheet. Now the default look for fresh installs.
- **About** settings tab.
- Embed cards can carry a **second view** with a switcher, and can **hide a
  base's header**.
- Tasks card gains a **list filter**, a **custom multi-rule sort**, and
  multi-value **TaskNotes "complete" statuses**.

### Changed

- **Settings tab reorganized** into a category ribbon (Appearance · Search ·
  Dashboard · Behaviour · Integrations · Backup · About) with a description on
  every setting.
- Embed **zoom now reflows** to fit its card.

## [1.7.0] - 2026-07-10

A major Tasks-card release, plus search and release-notes additions
(everything from the 1.6.8 beta series).

### Added

- **Kanban plugin boards** — the Tasks card can read and edit
  [Kanban](https://github.com/obsidian-community/obsidian-kanban) boards (each
  heading a column, each checkbox a card) as a list or a drag-and-drop board
  that rewrites the note in Kanban's own format.
- **Full obsidian-tasks metadata** — start (🛫), scheduled (⏳), due (📅) and
  done (✅) dates, a 5-level priority (🔺⏫🔼🔽⏬, each a distinct colour) and
  recurrence (🔁), shown as compact indicators with a right-click editor and
  add-card pickers — from Kanban cards and plain Markdown checkboxes alike.
- **Custom task states** (`[symbol] Label`) that each become a draggable board
  column, plus **done columns** and per-column **sort** (Smart / Due / Priority
  / Created / Alphabetical).
- **Quick view** — clicking a task opens a compact editor for metadata and
  description in place.
- **Convert to note** / **create as note** — turn a card into its own linked
  note (optionally from a template, scraping metadata into frontmatter), or
  create new cards as notes outright.
- **Omnisearch** — the search bar can optionally be powered by
  [Omnisearch](https://github.com/scambier/obsidian-omnisearch) when installed.
- **"What's new" dialog** — surfaces release notes from a continuous,
  accumulating changelog after each update.

### Changed

- Double-click **column rename**, clickable links, per-card descriptions, and
  card deletion on boards.
- Recurring tasks complete **per-occurrence** like TaskNotes.
- Scroll-mode boards grow as you drag a card past the bottom.

## [1.6.7] - 2026-07-09

### Fixed

- Maintenance and bug-fix release
  ([1.6.6…1.6.7](https://github.com/ondreu/Hearth/compare/1.6.6...1.6.7)).

## [1.6.6] - 2026-07-08

### Fixed

- Maintenance and bug-fix release
  ([1.6.5…1.6.6](https://github.com/ondreu/Hearth/compare/1.6.5...1.6.6)).

## [1.6.5] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.4…1.6.5](https://github.com/ondreu/Hearth/compare/1.6.4...1.6.5)).

## [1.6.4] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.3…1.6.4](https://github.com/ondreu/Hearth/compare/1.6.3...1.6.4)).

## [1.6.3] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.2…1.6.3](https://github.com/ondreu/Hearth/compare/1.6.2...1.6.3)).

## [1.6.2] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.6.1…1.6.2](https://github.com/ondreu/Hearth/compare/1.6.1...1.6.2)).

## [1.6.1] - 2026-07-07

### Fixed

- Maintenance and bug-fix release
  ([1.5.2…1.6.1](https://github.com/ondreu/Hearth/compare/1.5.2...1.6.1)).

## [1.6.0] - 2026-07-06

### Added

- **Natural-language task dates** — type due/scheduled dates in plain language
  (`📅 tomorrow`, `📅 next friday`, `📅 in 3 days`…).
- **Free-form tiles** — tiles can be placed anywhere and may overlap; drag & drop
  with a dashed drop-target ghost and an overlap glow. Auto-shift is an opt-in
  beta per card.
- **Mobile search** — search optimized for mobile.
- **Edge-merging cards** — adjacent cards merge their borders and sharpen their
  touching corners so they read as one continuous tile.
- **Relative date labels for tasks** — Today / Tomorrow / Yesterday / Friday /
  Next Friday / "15 Jul".
- **Recurring-task completion checkbox** — undoable, rendered before the task
  text; Kanban recurring checkbox inline with the task text.
- **Hide titles** — hides card headers (not the dashboard header).

### Changed

- Daily/embed cards now use a single scrollbar; the embed scrolls instead of the
  card body.
- Daily note: floating open button on the card; header hidden by default in
  arrange mode.
- Manifest version is numeric-only (`1.6.0`) to satisfy Obsidian plugin review.
- Replaced direct `element.style.X = …` assignments with `setCssStyles()` / CSS
  classes; use `activeDocument` instead of `document` for popout-window
  compatibility; replaced CSS `:has(...)` selectors with explicit body modifier
  classes (`.is-embed-host`, `.is-jot-host`).

### Fixed

- Daily/embed horizontal scroll (clip x-overflow, wrap text).
- Tile drag offset (transform-based); overlap glow always on.
- Added the `u` flag to regexes containing surrogate-pair emoji (Tasks-plugin
  markers).

## [1.5.2] - 2026-07-05

### Fixed

- Maintenance and bug-fix release
  ([1.5.1…1.5.2](https://github.com/ondreu/Hearth/compare/1.5.1...1.5.2)).

## [1.5.1] - 2026-07-05

### Fixed

- Maintenance and bug-fix release
  ([1.5.0…1.5.1](https://github.com/ondreu/Hearth/compare/1.5.0...1.5.1)).

## [1.5.0] - 2026-07-05

A redesigned dashboard experience, plus recurring tasks and many polish fixes.

### Added

- **CSS-grid tiles** — Links/launchpad and Commands tiles live on a fine CSS
  grid (44 px cells, 4 px snap) with independent column and row spans. Drag a
  tile to reorder; drag the corner grip to resize. Default tile is 2×2.
- **Ambient default background** — a soft, blurred backdrop ships out of the box.
- **Recurring TaskNotes tasks** — tasks with a `recurrence` RRULE show a ↻ badge
  next to the next-occurrence date, tinted with the accent colour, with a
  plain-English schedule tooltip ("Repeats every week"). Overdue recurring tasks
  tint like one-offs.
- **Overhauled starter dashboard** — a redesigned default layout with exact
  coordinates.

### Changed

- **Smarter task sorting** — due → scheduled → priority → created.
- **Kanban drop outlines** — dragged cards preview where they'll land.
- **Calendar today outline** — today's cell stays visible under the heatmap tint.
- **Search layout polish** — autocomplete click-outside, restored field width,
  larger tile grip.
- **Fit-to-page default-on** — fresh installs lock to one screen; stuck cards
  auto-recover onto the board on render.

### Fixed

- Card drag overlay behaves correctly over tile cards.
- Tile grip visibility and contrast improved.
- Calendar arrow targets now work in dark themes.
- "Other" file-type filter hides when there are no unmatched files.
- Default background uses a CDN URL (raw.githubusercontent was blocked by
  Obsidian's CSP).

[1.11.0]: https://github.com/ondreu/Hearth/compare/1.10.0...1.11.0
[1.10.0]: https://github.com/ondreu/Hearth/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/ondreu/Hearth/compare/1.8.1...1.9.0
[1.8.0]: https://github.com/ondreu/Hearth/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/ondreu/Hearth/compare/1.6.7...1.7.0
[1.6.7]: https://github.com/ondreu/Hearth/compare/1.6.6...1.6.7
[1.6.6]: https://github.com/ondreu/Hearth/compare/1.6.5...1.6.6
[1.6.5]: https://github.com/ondreu/Hearth/compare/1.6.4...1.6.5
[1.6.4]: https://github.com/ondreu/Hearth/compare/1.6.3...1.6.4
[1.6.3]: https://github.com/ondreu/Hearth/compare/1.6.2...1.6.3
[1.6.2]: https://github.com/ondreu/Hearth/compare/1.6.1...1.6.2
[1.6.1]: https://github.com/ondreu/Hearth/compare/1.5.2...1.6.1
[1.6.0]: https://github.com/ondreu/Hearth/compare/1.5.2...1.6.0
[1.5.2]: https://github.com/ondreu/Hearth/compare/1.5.1...1.5.2
[1.5.1]: https://github.com/ondreu/Hearth/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/ondreu/Hearth/releases/tag/1.5.0
