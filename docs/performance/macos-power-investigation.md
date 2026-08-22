# macOS power draw and overheating — investigation

**Status:** reproduced, root-caused, mostly fixed.
**Against:** Hearth 2.0.0 (`main`), beta 2.1.0-beta.1.
**Harness:** [`bench/`](bench/) — re-runnable, uses the plugin's own drawing code.

## What has been fixed

| Finding | State |
|---|---|
| Pet sprite animating an `<svg>` | **Fixed** — 123.6 ms / 239 recalcs → 4.2 ms / 0 |
| Off-screen and unfocused boards animating | **Fixed** — 191 ms / 240 recalcs → 0.2 ms / 0 |
| Frost blurring the whole board | **Fixed** — layer sized to its cards, clamped to the grid |
| Rebuilding boards nobody is looking at | **Fixed** |
| A disk write + full rebuild per settings keystroke | **Fixed** — debounced |
| `prefers-reduced-motion` only partly honoured | **Fixed** — board-wide |
| Low power mode all-or-nothing | **Replaced** by a four-step performance tier |
| `cardBlur` on by default | **Now 0** for fresh installs |
| **The painted sky relayouts every frame** | **Not fixed** — only thinned |

The sky is the one that matters most and the one still outstanding. The
`balanced` tier draws half the field, which buys about a third of its cost, and
`reduced` stops it moving entirely — but a full-density animated sky still forces
a style recalc and a layout on every frame, because its raindrops and clouds are
still animated SVG children. Removing that means moving them off SVG entirely
(HTML elements over the gradient, or one canvas), which is a re-implementation of
the drawing rather than a tweak to it, and wants its own change and its own
review. Everything else above is done.

Hearth's painted weather sky and its pet sprite animate CSS `transform` on SVG
elements. Chromium cannot composite that. Every frame it runs a full style
recalculation on the main thread — and for the sky's raindrops and clouds, a full
layout as well. At 60 Hz that is 60 layouts per second for as long as the board is
on screen; on a ProMotion MacBook, 120.

The same animation applied to plain HTML elements costs nothing measurable. That
comparison is the whole finding:

| 52 raindrops, 5s window | Style recalcs | Layouts | Main thread |
|---|---:|---:|---:|
| SVG `<line>` — **as shipped** | **300** | **300** | **188.1 ms** |
| HTML `<div>` — control | 0 | 0 | 5.4 ms |

A browser-level trace supplies the other half. With the sky still, Chromium
produces **no compositor frames at all** over a six-second window — zero
`Display::DrawAndSwap` events. With the sky animating it draws and swaps
continuously for the entire window. That is the difference between costing some
CPU and overheating a laptop: the GPU and display pipeline never reach an idle
state while Hearth is visible. macOS amplifies it twice — a 2× Retina backing
store doubles raster area, and ProMotion doubles the frame rate.

---

## P0 — The painted sky relayouts on every frame

`src/sky.ts` — `drawPrecipitation()`, `drawCloud()`, `drawFog()`

At board spread the sky emits 52 raindrops, 9 cloud groups and 38 stars, each an
SVG child carrying its own CSS `transform` animation. Blink will not promote SVG
children to compositor layers, so each frame re-runs style and layout across the
whole SVG.

Clouds are drawn for *every* condition except clear sky (`cloudCount()`), so
almost any live forecast triggers it. Two entry points reach this code:

- a board background set to `weather` (`src/background.ts` → `applyWeatherSky`),
  which is full-window;
- the weather card's `artistic` style (`src/cards/weather.ts:553`), card-sized,
  same per-frame cost.

Measured, 5s window at DPR 2:

| Case | Main thread | Recalcs | Layouts | Paints |
|---|---:|---:|---:|---:|
| 52 raindrops — SVG `<line>` | 188.1 ms | 300 | 300 | 0 |
| 52 raindrops — HTML `<div>` control | 5.4 ms | 0 | 0 | 0 |
| 9 clouds — SVG `<g>` | 136.6 ms | 300 | 300 | 600 |
| 38 stars — SVG `<circle>`, opacity only | 47.9 ms | 83 | 0 | 0 |
| nothing animating — control | 0.4 ms | 0 | 0 | 0 |

Stars animate `opacity` only and cost the same as the HTML control (84 recalcs),
so opacity is not the problem — `transform` on SVG is. The lightning bolts'
`drop-shadow` filter is also **not** a problem: measured at 0 recalcs, because
`steps(1, end)` means the value changes a handful of times per cycle rather than
per frame.

## P0 — The pet sprite is not the cheap animation it looks like

`styles.css` — `hearth-pet-hop` / `-bob` / `-breathe` / `-slouch` on
`.hearth-pet-sprite`, which is the `<svg>` root created in
`src/cards/pet.ts:666`.

The frame cycling is genuinely free — discrete `steps()` on `opacity`. The bob is
not: `transform` on the `<svg>` *root* is refused the compositor as well.
Isolated three ways:

| Case | Animations | Main thread | Recalcs |
|---|---:|---:|---:|
| Pet, as shipped (4 pets) | 16 | 156.9 ms | 301 |
| — sprite transform only | 4 | 116.2 ms | 299 |
| — frame cycling only | 12 | **0.8 ms** | **0** |
| — transform in px, not % | 4 | 114.5 ms | 300 |

Pixels instead of percentages changed nothing, so it is the SVG element itself,
not the unit.

## P1 — Off-screen is not free; a hidden tab is

No visibility gating exists outside `src/leafview.ts`. There is no
`visibilitychange` or `document.hidden` handling anywhere in the codebase.

Good news first: when Obsidian hides an inactive leaf it takes it out of layout,
and Chromium stops everything. A backgrounded Hearth tab costs nothing, which
bounds the damage. Everything else keeps paying full price — an animated card
scrolled below the fold, or clipped away by a fit-to-page board's
`overflow: hidden`.

Animated rain sky + frost, 4s window:

| How it is hidden | Animations | Main thread | Recalcs | Layouts |
|---|---:|---:|---:|---:|
| `display: none` — a hidden Obsidian tab | 0 | **0.3 ms** | **0** | **0** |
| Scrolled out of view | 61 | 192.6 ms | 240 | 240 |
| `visibility: hidden` | 61 | 194.5 ms | 239 | 239 |
| `opacity: 0` | 61 | 204.4 ms | 241 | 241 |
| `content-visibility: hidden` | 61 | 90.0 ms | 0 | 0 |

`src/leafview.ts:287` already has the right pattern — an IntersectionObserver
that mounts and unmounts hosted leaves. Nothing else uses it.

## P1 — Frost blurs the whole board, not the cards *(reasoned, not measured)*

`src/grid.ts:837` — `updateFrostLayers()`

Each frost layer is `position: absolute; inset: 0` — the full grid — carrying
`backdrop-filter: blur()`. The SVG mask limits what is *shown* to the card
silhouettes; it does not limit what is *computed*. Chromium blurs the whole
board's backdrop and then masks the result.

This ships on by default (`cardBlur: 7` in `DEFAULT_SETTINGS`). On its own, over
a static wallpaper, it is a one-off cost — the measurements show it idle at zero.
It compounds badly with the findings above: when the wallpaper behind it
animates, the blur is recomputed every frame over the whole board at 2× DPR.

> Flagged as reasoned rather than measured. The benchmark container has no GPU, so
> Chromium fell back to software rasterization and the blur could not be priced the
> way it would run on a Mac. The layer geometry and the default are read from
> source; the per-frame recomputation is established Chromium behaviour, not
> something observed here.

## P2 — Smaller things

- **Every settings keystroke rebuilds every board.** `HomeSettingTab.save()`
  (`src/settings.ts:149`) → `saveSettings()` writes the whole settings JSON to
  disk *and* calls `refreshViews()`, which tears down and rebuilds the DOM of
  every open Hearth view. Text fields call it from `onChange`, so a 20-character
  placeholder is 20 disk writes and 20 full rebuilds.
- **Live refresh rebuilds invisible views.** `src/main.ts:425` iterates every
  home leaf regardless of visibility. Off by default (`liveRefresh: false`).
- **A diagnostic `console.warn` fires on every load** — `src/main.ts:56`, the
  issue #52 environment probe. Worth retiring.
- **The default wallpaper is fetched from GitHub** on first paint —
  `DEFAULT_BG_URL` points at `raw.githubusercontent.com`. Separately,
  `assets/default-bg.gif` is not a GIF: it is a 1920×1080 PNG with the wrong
  extension.
- **`transition: all 120ms`** in four places (`styles.css:552, 696, 5177, 5287`),
  inviting invalidation on properties nobody meant to animate.
- **`hearth-tile-obscured-pulse` animates `box-shadow`** — a paint property,
  never compositable — `infinite`, while arranging.
- **A stuck loading spinner animates forever**, and low power mode explicitly
  keeps it spinning with `!important` (`styles.css:114`).

---

## What is already right

Timer hygiene is good and is not part of this problem. Every `setInterval` goes
through Obsidian's `registerInterval`, so each is tied to a component lifecycle;
every one is minute-scale except the clock's necessary one-second tick, which
writes to the DOM only when the rendered text changes; and low power mode
suppresses all of them. Network polling is off by default for the git and web
cards. The drag reflow path (`src/grid.ts:467`) already coalesces into a single
animation frame and cancels on teardown. The vault-event fan-out is shared across
cards rather than registered per card.

Low power mode works — it kills every animation with `animation: none !important`,
which is why it resolves the symptom, and is corroborating evidence for this
diagnosis. But it is an all-or-nothing downgrade that also removes the frost, the
wallpaper and every refresh timer. The defect is that the sky and the pet cost 60
layouts a second when the same motion could cost nothing.

## The remaining fix: move the sky off SVG

The drops, clouds and fog wisps need to stop being animated SVG children. Two
routes, both a re-implementation of the drawing rather than a tweak:

- **HTML elements over the gradient.** Keeps the shapes as elements, so the
  existing keyframes and per-shape delays carry over almost unchanged. The catch
  is geometry: the field is authored in SVG user units under
  `preserveAspectRatio="xMidYMid slice"`, and an HTML layer has to reproduce that
  cover mapping exactly or the sun's glow drifts off its disc. The mapping is
  `scale = max(boxW/W, boxH/H)` with the remainder split evenly, applied as a
  static transform on a field sized W×H — which keeps child coordinates *and*
  keyframe distances in user units, and costs nothing per frame since the
  transform never animates. It needs a ResizeObserver, so `drawSky` needs a
  Component threaded in from the weather card.
- **One canvas**, drawn once and animated as a single composited layer. Fewer
  moving parts, but it gives up the CSS keyframes and the reduced-motion rules
  that come with them.

Either way the gradients, palettes, the still-sky fallback and the shapes that
already measure free — stars (opacity only), bolts and the sheet flash (both
`steps()`) — stay exactly as they are. Only the three moving families move.

The sun and moon *glows* should move too: on a clear sky the glow's
`transform: scale()` breathe is the only per-frame animation left, so a clear
board still pays 60 recalcs a second for one element. The discs and the moon's
crescent don't animate and can stay in SVG.

## How this was measured

The plugin's own `drawSky()` and `updateFrostLayers()` were bundled unmodified
from `src/`, behind a shim for Obsidian's DOM helpers, and rendered into headless
Chromium at DPR 2 via Playwright over CDP. Two independent instruments per run:
`Performance.getMetrics` deltas across a fixed wall-clock window, and a devtools
timeline trace counted by event name. A browser-level trace covering the GPU
process supplied the frame-production numbers. The harness held a steady 60 fps,
so none of this is an artifact of a throttled clock.

The controls are the load-bearing part: a compositor-driven animation produces
exactly zero style recalcs, zero layouts and zero paints, so any figure above zero
is main-thread work a correctly-composited animation would not have done. Absolute
milliseconds vary by host; the ratios and the zeros are the finding.

See [`bench/README.md`](bench/README.md) to re-run.
