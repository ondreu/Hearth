# 4. Search: modes, filters and the action button

The **search section** sits under the title in Hearth's Home view. It is
keyboard-first: focus it, type, and results appear in a dropdown as you go.
There is also a **Search bar** *card*, which puts the same field anywhere on the
board — see [chapter 9](09-cards-vault-tools-and-fun.md).

Everything in this chapter refers to Hearth's own search. It is a separate thing
from Obsidian's built-in search pane, though Hearth can hand a query over to
that pane when you want the full results.

## The four search modes

Hearth's search field has four modes. You do not switch between them with a
control: the mode is decided by what you type, which is why the guide calls them
*transparent* modes.

| What you type | Mode | What it matches |
| --- | --- | --- |
| anything else | Fuzzy plus full text | File names, file paths, tags, frontmatter properties, and — optionally — the text inside note bodies |
| `#something` | Tags | Vault tags, showing which tag matched |
| `key:value` | Frontmatter | Notes whose property `key` matches `value` |
| `>something` | Commands | Any registered Obsidian command, run by name |

### Fuzzy plus full-text mode (the default)

With no prefix, Hearth matches file names and paths first, and then — if *Search
note contents* is on, which it is by default — the text inside your notes. Name
matches always rank above body matches, so a well-scored fuzzy match on a body
can never displace a literal match on a file name. Body matches appear after
name matches, each with a short excerpt showing the matched text in context.

At most 40 results are shown.

### Tag mode

A leading `#` searches your vault's tags. Each result shows which tag matched,
so a note carrying several tags tells you why it is in the list.

### Frontmatter mode

Typing an identifier followed by a colon — `status:active`, `project:hearth`,
`type:meeting` — searches frontmatter properties. Hearth recognises this shape
because a colon is not a legal filename character, so a property query can never
be confused with a file-name search.

### Command mode

A leading `>` turns the field into a command launcher. Every command registered
in Obsidian — core, community plugin, or Hearth's own — can be found by name and
run with Enter. This is the same set of commands as Obsidian's command palette.

## Filter chips

Under the search field is a row of **filter chips** for file types. They are
**auto-detected**: a chip only appears if your vault actually contains that kind
of file. The possible groups are Folders, Notes, Excalidraw, Canvas, Bases,
Images, Videos, Audio, PDF, Documents, Sheets, Slides, 3D and Other.

Clicking a chip lists the items of that type. Clicking it again clears the
filter.

You can hide chips you never use. Vault-wide, that is **Settings → Hearth →
Search → Search filters**. Per dashboard, *Dashboard settings → Header → Filter
chips* lets one board show a different set from the vault-wide choice; a board
that has not been given its own set follows the vault, and the control tells you
how many the vault currently hides.

## Recent files

Focusing the search field while it is empty lists the files you opened most
recently through Hearth's search. This history holds the last six entries and
lives in the vault's local storage rather than in Hearth's settings, so it never
appears in the settings UI and is never included in an export.

## Keyboard control

Inside the search field:

- `↑` and `↓` move the selection through the results.
- `Enter` opens the selected result, or runs the selected command in command
  mode.
- `Esc` dismisses the results.
- `Ctrl`-click (or `Cmd`-click on macOS) on a result always opens it in a new
  tab, whatever your *Open notes in* setting says.

Optionally, Hearth can place the cursor in the search field whenever a Home view
opens, so you can start typing straight away: **Settings → Hearth → Behaviour →
Startup & tabs → Focus search on open**. This is desktop-only.

## Where a search result opens

Where a clicked result goes is governed by **Settings → Hearth → Behaviour →
Opening notes**. There is a general *Open notes in* choice (a new tab, the
current tab replacing Hearth, a split pane, or a new window) and a per-source
override for *Search results* specifically, which may also be set to follow the
general choice. See [chapter 15](15-settings-reference.md).

Right-clicking a result offers **Reveal in file explorer**, which uses
Obsidian's core File explorer plugin.

## The action button beside the field

By default a **New note** button sits beside the search field. It has two
possible jobs, chosen with *Search-bar button* under **Settings → Hearth →
Search → Search bar**:

- **New note** — creates a note.
- **Search online** — sends whatever is typed in the search field to a web
  search engine.

The button can also be hidden entirely (*Show "New note" button*), and each
dashboard can override whether the button is shown, what it does, and what its
label says.

### Configuring what "New note" makes

One set of settings drives the button beside the search bar, the button on a
Search bar card, and Hearth's *Create new note (default location)* command.
They are under **Settings → Hearth → Search → Search bar**, in a group headed
*The "New note" button*:

| Setting | Meaning |
| --- | --- |
| *Button text* | The text on the button. Empty means "New note". |
| *Template* | Make the note from a Templater template instead of a blank one. Requires the Templater community plugin. Templater does the templating, so your user scripts, `tp.system.prompt()` dialogs and cursor placement behave exactly as they do from Templater's own command. |
| *Location* | The folder the new note goes in, created if it does not exist. "Default location" means wherever Obsidian puts new notes. |
| *Filename* | The name, without the extension. Supports `{{date}}`, `{{date:FMT}}`, `{{time}}`, `{{time:FMT}}` and `{{prompt}}`. `{{prompt}}` asks you for the name on each click. Empty means "Untitled". |

If the button is set to use a Templater template but Templater is not enabled,
Hearth makes a blank note and tells you why.

### Searching the web

When the button is set to *Search online*, pressing it opens your chosen engine
with the current contents of the search field.

The engine the button itself uses is *Online search engine* under **Settings →
Hearth → Search → Search bar**. The available engines are **DuckDuckGo** (the
default), **DuckDuckGo without AI**, **Brave**, **Kagi**, **Google**,
**Mojeek**, **Ecosia** and **Qwant**.

The button also carries a small arrow. Clicking the arrow lets you search with
any of the other engines for that one query, without changing which engine the
button uses from then on.

Web search opens a browser; it does not send anything from your vault other than
the text you typed.

## Using Omnisearch as the engine

Hearth can hand the whole job over to the
[Omnisearch](https://github.com/scambier/obsidian-omnisearch) community plugin,
which maintains its own fuzzy full-text index.

Set *Search engine* to **Omnisearch** under **Settings → Hearth → Search →
Search bar**. Omnisearch must be installed and enabled; if it is not, Hearth
says so and offers a link to it in Obsidian's community plugin browser. The
choice only sticks while Omnisearch is enabled — disable the plugin and Hearth
falls back to its built-in engine rather than showing you an empty search.

Tag, frontmatter and command modes are Hearth's own and continue to work the
same way; it is the plain-text query that is handed to Omnisearch.

## File icons in results

If you use the [Iconic](https://obsidian.md/plugins?id=iconic) or
[Iconize](https://obsidian.md/plugins?id=obsidian-icon-folder) community plugins
to give individual files their own icons, Hearth shows those icons in search
results, and in the Recent, Favorites and saved-query cards.

This is on by default and lives at **Settings → Hearth → Integrations → File
icons / Iconic / Iconize**. Lucide icons and emoji are shown; a file using an
icon from a downloaded icon pack keeps Hearth's own file-type icon. If you have
renamed Iconize's frontmatter property, tell Hearth the new name there — Iconize's
own default is `icon`.

Turning the setting off makes every file show Hearth's file-type icon. Leaving it
on in a vault with neither plugin installed changes nothing, and it starts
working the moment you install one.

## Hiding the search section

The search section can be turned off entirely.

- Vault-wide: **Settings → Hearth → Appearance → Home → Show search section**.
- Per dashboard: *Dashboard settings → Header → Search visibility*, which can
  follow the vault-wide default or override it to show or hide on that board.

A board that hosts a plugin view starts with the search hidden, because the
hosted view takes the whole pane; that is a per-board default you can switch
back on.

## Per-dashboard search options

Beyond visibility, each dashboard can set:

- its own *Search placeholder* (the greyed-out text in the empty field),
- whether the button beside the field is shown, what it does, and its label,
- which filter chips it offers.

All of these are on the **Header** tab of that dashboard's settings, and each
follows the vault-wide value until the board says otherwise. They travel with
the board when you export it.
