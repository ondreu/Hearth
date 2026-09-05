# 17. Privacy, network access and your data

This chapter answers, in one place: what data Hearth holds, where it holds it,
what it sends over the network, when, and how to stop it.

The short version: Hearth has **no telemetry, no account and no phone-home**.
The only outbound requests it makes are the ones a card you added needs, and a
single switch silences all of them.

## Where Hearth stores your data

Everything Hearth knows lives in your vault, in the plugin's own data file under
`.obsidian/plugins/hearth/`. That includes your dashboards, your cards and their
configuration, your vault-wide settings, your Favorites list, and your
publishing key if you have created one.

Two things deliberately live elsewhere:

- **Search history.** The last six files you opened through Hearth's search are
  kept in the vault's local storage rather than in the settings file, so they
  never appear in the settings UI and are never included in an export.
- **Nothing at all is stored outside the vault.** There is no cloud component,
  no cache directory elsewhere on your machine, and no server that holds your
  configuration.

Because it all lives in the vault, it travels with whatever sync you already
use, and it is included in whatever backup you already take of the vault.

## The master switch

**Settings → Hearth → Behaviour → Privacy & network → Disable external calls.**

Turning this on blocks **all** outbound network requests Hearth makes. Its
description is exhaustive: Jira, external calendars, RSS feeds, the calculator's
currency-rate lookup, and background images and title icons given as a web
address — those last two fall back to no picture and to the Hearth crystal.

Cards do not fail silently under this setting. Each one says why it is empty:
*Feeds are off (external calls disabled)*, *Place search is unavailable while
external calls are disabled*, *Favorite filters can't be loaded while external
calls are disabled*, and so on. The background settings section says the URL
background will not be shown and suggests a vault image instead.

The gallery is also blocked, with a message saying exactly that.

## Everything Hearth can send, and to whom

There are eight categories of outbound request. Nothing else exists.

| Destination | Sent by | What is sent | Account or key |
| --- | --- | --- | --- |
| [Open-Meteo](https://open-meteo.com) | Weather cards, and the live weather sky background | Only the coordinates you picked | None. Free, key-less, no account |
| [Frankfurter](https://www.frankfurter.app/) | The Calculator card, for currency conversion | A rate request. Your sum is computed locally | None |
| Your Jira Cloud or Server instance | Jira cards | A REST query, authenticated with the personal access token you entered on the card | Yours |
| RSS and Atom feed hosts | RSS cards | A feed request | None |
| ICS and webcal hosts | Mini calendar subscriptions | A feed request | The feed URL you entered |
| A web search engine | The search bar's *Search online* button | Only the text you typed in the search field | None |
| Any host you name | A background image or title icon given as a web address | An image request | None |
| A dashboard gallery server | The gallery browser and publisher | Nothing until you open the gallery; nothing published until you press Publish | An anonymous handle generated locally |

Two of these deserve a note.

**Hearth's own default wallpaper is a web request.** The bundled ambient
background is served from `raw.githubusercontent.com`. If that matters to you,
choose a vault image or a solid colour instead, or turn on *Disable external
calls*, which makes it fall back to no picture.

**A pinned weather sky needs no network at all.** If you like the painted sky but
not the request, set the background's *Sky* to **A fixed sky** and choose a
condition. It needs no location and never goes online. Only *Live weather* asks
Open-Meteo anything.

**The Web page card** is a special case: it renders a page you named in a
sandboxed iframe, so whatever that page loads, it loads. The card's *Trusted
site* option relaxes the iframe sandbox to allow same-origin access — cookies
and storage — and should only be enabled for sites you trust.

## What Hearth never does

- It does not send anything about your vault, your notes, your usage or your
  machine anywhere.
- It has no analytics, crash reporting or update-check beacon of its own.
  Obsidian's own plugin updater is Obsidian's, not Hearth's.
- It does not require an account for any feature. Publishing to a gallery uses a
  key generated in your vault, not a sign-up.
- It does not read anything a card is not asked to read.

## Credentials

The only credential Hearth stores is a **Jira personal access token**, entered on
a Jira card and stored in Hearth's plugin data alongside the rest of your
configuration.

It is **never included in any export**, of any kind, with any setting. This is
not a switch you can get wrong.

## Sharing a dashboard safely

When you export a dashboard to a file, Hearth offers *Leave out my private
information*, which removes vault paths, calendar feed URLs, private hosts, your
location, and any text you typed on a text or calculator card. The details
section lists **the actual values** it will remove, read from your board, so you
can check rather than trust.

When you **publish** to a gallery, that removal is not optional — those groups are
pinned on — and a screenshot is required, taken with every word inside your cards
blanked out, which you must look at and confirm before publishing goes ahead.

Both flows are documented in full in [chapter 16](16-sharing-and-gallery.md).

## The gallery, specifically

The gallery is the only Hearth feature that is a server relationship rather than
a one-off request, so it is worth being precise:

- **Nothing is fetched until you open the gallery.** It does not poll, prefetch
  or check in.
- **Nothing is sent until you publish.** Browsing does not upload anything about
  your vault.
- **The address is a setting.** Clearing the *Gallery address* field under
  *Settings → Hearth → Backup* turns the gallery off entirely, and it stays off.
- **Your identity is a local key.** The handle you publish under is derived from
  a signing key generated in your vault that never leaves it. It says nothing
  about who you are. Voting and publishing need one; browsing and installing do
  not.
- **You can run your own.** The gallery server is open source and starts with one
  Docker command; see [`docs/gallery-hosting.md`](../gallery-hosting.md).

## Installing someone else's dashboard

A dashboard from the gallery, or a file from a friend, is data rather than code —
but it can point at things. Before you install, Hearth tells you:

- exactly which plugins and hosted views it needs,
- how many things on the board are loaded from the internet, or explicitly that
  none are,
- whether its signature checks out, and therefore whether its author can be
  established at all.

Two cards can run code you did not write if you paste it in: the **Dataview**
card (DataviewJS) and the **Datacore** card (scripts). Both say so in their own
settings: "Runs arbitrary JavaScript — only use code you trust." An imported
board's scripts are worth reading before you open the board.

## A quick audit of your own vault

If you want to know what your Hearth setup currently reaches out to:

1. Open **Settings → Hearth → Integrations**. The **External services** group
   lists every network-using integration with a live status pill.
2. Open the **Share dashboard** dialog for each board and read the details
   disclosure. It lists the actual feed URLs, hosts and locations the board
   holds.
3. Turn on *Disable external calls* for a session. Every card that wanted the
   network will say so in place, which is a fast way to find the ones you forgot
   about.

## Accessibility and reduced motion

Not privacy, but adjacent and easy to miss: if your operating system asks for
reduced motion, Hearth honours it. The painted sky holds still regardless of the
performance tier and regardless of the per-board *Animate the sky* setting.
