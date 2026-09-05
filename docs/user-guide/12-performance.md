# 12. Performance tiers and battery life

A Hearth dashboard can be an expensive thing to draw. A painted animated sky, a
frosted-glass blur behind every card, a handful of cards refreshing on timers,
and a hosted plugin view all cost CPU, GPU and battery. Hearth therefore has an
explicit performance control rather than leaving you to guess which setting is
the expensive one.

It lives at **Settings → Hearth → Appearance → Performance**.

## The performance tier

*Performance tier* is a single dropdown with four steps. Each step down drops
the next most expensive thing the board does.

**Nothing you have configured is overwritten.** Your settings are kept exactly as
they are and come back when you move the tier back up. The sections whose
settings a tier currently overrides say so in place, so you are never left
wondering why a switch appears to do nothing.

### The four tiers

| Tier | What it means |
| --- | --- |
| **Full — everything on** | Every effect at full strength |
| **Balanced — a lighter sky** | The painted sky is drawn at half density |
| **Reduced — nothing moves** | No motion, no frosted glass |
| **Minimal — plain and still** | A flat colour, opaque cards, nothing moving, nothing refreshing |

**Full.** Every effect at full strength. The painted weather sky is the most
expensive thing here: if the board is warming up your machine, this is the
setting to step down.

**Balanced.** The painted sky is drawn at half density — fewer raindrops, stars,
clouds and wisps of fog. Nothing is switched off and nothing stops moving; there
is simply less of it, for about a third less work. This is the default on
mobile.

**Reduced.** Nothing on the board moves, and the frosted glass behind cards is
off. Your wallpaper stays, cards stay translucent, and every card still
refreshes on its timer — the board just holds still.

**Minimal.** The frugal end: a flat colour instead of the wallpaper, opaque
cards, no motion, and no card refreshing itself on a timer.

### Exactly what each tier changes

Hearth lists the effects of the selected tier under the dropdown. The full set of
possible effects, in the order the tiers apply them, is:

| Effect | Applies at |
| --- | --- |
| The painted weather sky is drawn at half density | Balanced |
| Transitions, hover lifts, shadows and animations are off | Reduced |
| No frosted-glass blur behind cards | Reduced |
| Clock cards drop seconds and the sweeping second hand | Reduced |
| Slideshow cards hold one picture instead of rotating | Reduced |
| The background is a flat colour — no image, GIF, opacity layer or blur | Minimal |
| Cards are opaque rather than translucent | Minimal |
| Web, RSS, calendar-subscription and Jira cards stop refreshing on a timer (manual refresh still works) | Minimal |
| The dashboard stops rebuilding itself on vault changes | Minimal |

### The minimal background colour

*Minimal background* sets the flat colour shown behind the home view on the
minimal tier. It accepts any CSS colour, for example `#4a4459`.

## Pausing animation when you are not looking

*Pause animation when Obsidian isn't in front* holds every animation while you
are working in another application or another window. It is on by default.

The reasoning is worth knowing: a Hearth tab hidden behind another Obsidian tab
already costs nothing, because it is not being drawn. This setting covers the
case a hidden tab does not — a **visible** board in a window you are not using,
sitting beside a browser or on a second screen.

Turn it off if you deliberately keep the dashboard running on a second display
and want the sky to keep moving.

## A separate tier for mobile

Phones and tablets draw the animated sky and the frosted glass on the smallest
screen and pay for it out of a battery, so Hearth keeps a **separate tier for
mobile**: *Performance tier on mobile*, under **Settings → Hearth → Mobile →
Layout**.

It defaults to **Balanced**. It can also be set to *Match desktop*. Your desktop
tier is stored separately and is never changed by the mobile one.

## What the tier cannot help with

Three costs sit outside the tier system, and it is worth knowing which:

**Hosted plugin views.** The **Plugin view** card and a **plugin view
dashboard** both run another plugin's full view live. That plugin manages its own
timers, listeners and rendering, so Hearth's tier cannot slow it down. The card's
own settings say as much, and add that if you have already stepped the tier down
and the dashboard still feels heavy, this is the one card worth removing.

**The number of cards.** Thirty cards cost more than ten, at any tier.

**Other plugins.** A Dataview query over a large vault costs what Dataview costs.

## A practical tuning order

If a Hearth board is making your machine work harder than you want, change
things in roughly this order — each step is cheaper to give up than the one
before it:

1. **Turn off the animated sky**, or step the tier to *Balanced*. This is the
   single largest cost on most boards.
2. **Turn card blur down or off.** Every blurred card is a compositor layer
   re-evaluated whenever anything behind it changes.
3. **Remove any Plugin view cards**, or turn off *Keep running in the
   background* on plugin view dashboards you rarely visit.
4. **Raise the refresh intervals** on web, RSS, calendar-subscription and Jira
   cards, or set them to 0 so they only fetch when opened.
5. **Step the tier to *Reduced***, which stops all motion.
6. **Step the tier to *Minimal***, which drops the wallpaper and stops timers.

## Reduced-motion preferences

If your operating system asks for reduced motion, Hearth honours it: the painted
sky holds still regardless of the tier and regardless of the per-board *Animate
the sky* setting. This is accessibility behaviour and is not something you have
to configure in Hearth.

## Further reading

The repository contains a detailed engineering investigation into Hearth's power
use on macOS, at
[`docs/performance/macos-power-investigation.md`](../performance/macos-power-investigation.md),
along with the benchmarks it was based on. That document is written for
developers, but it explains in depth *why* the sky and the blur are the two
expensive things.
