import { type Component, Platform, TFile } from "obsidian";
import {
	daylightFromHour,
	drawSky,
	parseSkyValue,
	resolveDaylight,
	skyGroupCode,
} from "./sky";
import type { HomeView } from "./view";
import {
	type BackgroundConfig,
	backgroundPaintable,
	effectiveBackground,
	effectiveFullWidth,
	effectiveMaxWidth,
	effectiveSkyAnimate,
	effectiveSkyDesign,
	motionAllowed,
	skyDensity,
	videoBackgroundPlays,
} from "./types";
import { drawHarbour, drawWallpaper } from "./wallpaper";
import { cachedWeather, loadWeather, type WeatherRequest } from "./weather";

/**
 * Apply the optional, customizable background as a separate layer behind the
 * content so opacity/blur don't affect the foreground. Uses the active
 * dashboard's override when set, otherwise the global default.
 *
 * This is the full-view wallpaper; {@link renderBanner} is the strip at the top
 * of the content. Which one a board gets is the view's call rather than this
 * function's, because the configured layout isn't the only input: mobile-only
 * mode has no content column to head and so asks for the wallpaper whatever the
 * layout says. `render()` therefore calls exactly one of the two, and this one
 * paints whenever it is called.
 */
export function applyBackground(
	view: HomeView,
	root: HTMLElement,
	component: Component,
): void {
	const bg = effectiveBackground(view.plugin.settings);
	// Nothing to paint: no background, a kind with no value, or a picture from
	// the web that "Disable external calls" won't let Hearth fetch (#281).
	if (!backgroundPaintable(bg, view.plugin.settings.disableExternalCalls)) return;

	paintBackground(view, root.createDiv("hearth-bg"), bg, component);
}

/**
 * Draw the board's backdrop as a banner: a strip across the top of the content,
 * the way a cover image sits above a note.
 *
 * It is the same background the wallpaper mode paints — same kinds, same
 * opacity and blur, live weather sky included — put in a box of its own instead
 * of behind everything. That box is a normal element in the scroll flow, so the
 * rest of the board sits below it on the theme's own surface, and on a
 * fit-to-page board the grid simply gets the height the banner leaves it.
 *
 * Returns the banner element, or null when there is nothing to draw (no
 * background configured, or the board isn't in banner mode).
 */
export function renderBanner(
	view: HomeView,
	parent: HTMLElement,
	component: Component,
): HTMLElement | null {
	const bg = effectiveBackground(view.plugin.settings);
	if (bg.layout !== "banner") return null;
	if (!backgroundPaintable(bg, view.plugin.settings.disableExternalCalls)) return null;

	const banner = parent.createDiv("hearth-banner");
	banner.style.height = `${bg.bannerHeight}px`;
	banner.toggleClass("is-faded", bg.bannerFade);
	// Full width means "as wide as the pane"; otherwise the banner lines up with
	// the content column, which is the same max-width `.hearth-inner` uses — and
	// so is uncapped exactly when the column is, keeping the two in line.
	banner.toggleClass("is-full-width", bg.bannerFullWidth);
	if (!bg.bannerFullWidth && !effectiveFullWidth(view.plugin.settings)) {
		banner.style.maxWidth = `${effectiveMaxWidth(view.plugin.settings)}px`;
	}

	const layer = banner.createDiv("hearth-bg");
	// A blurred layer goes soft at its own edges. Behind a whole view that is
	// barely visible; cropped into a strip it is a pale halo down all four
	// sides, so grow the layer past the crop and let the softness fall outside.
	if (bg.blur > 0) layer.style.inset = `-${Math.ceil(bg.blur * 2)}px`;

	paintBackground(view, layer, bg, component);
	return banner;
}

/**
 * Paint a resolved background into `layer`. Shared by the wallpaper and the
 * banner: the two differ only in where that layer sits and how big it is, so
 * everything about *what* is drawn — the opacity, the blur, the colour, the
 * image URL, the live sky, Hearth's own wallpaper — lives here once.
 */
function paintBackground(
	view: HomeView,
	layer: HTMLElement,
	bg: BackgroundConfig,
	component: Component,
): void {
	layer.style.opacity = String(bg.opacity);
	if (bg.blur > 0) layer.style.filter = `blur(${bg.blur}px)`;

	if (bg.kind === "color") {
		layer.style.background = bg.value;
		return;
	}

	if (bg.kind === "weather") {
		applyWeatherSky(view, layer, bg, component);
		return;
	}

	// Hearth's own wallpaper is drawn, not fetched, in the same design the
	// weather sky uses (see wallpaper.ts).
	if (bg.kind === "default") {
		drawWallpaper(layer, effectiveSkyDesign(view.plugin.settings));
		return;
	}

	// The harbour town is Expressive by nature, so it takes no design.
	if (bg.kind === "harbour") {
		drawHarbour(layer);
		return;
	}

	// A clip from the vault needs an element, not a CSS background: it has to be
	// started, paused and torn down, none of which `background-image` can do.
	if (bg.kind === "video") {
		applyVaultVideo(view, layer, bg, component);
		return;
	}

	// A picture from the web is an outbound request whoever it was configured by,
	// so "Disable external calls" blocks it. `paintable` normally means we are
	// never called for one; this is the check at the point the request would
	// actually be made.
	const blocked = view.plugin.settings.disableExternalCalls;
	let url: string | null = null;
	if (bg.kind === "url") {
		url = blocked ? null : bg.value;
	} else if (bg.kind === "image") {
		const file = view.app.vault.getAbstractFileByPath(bg.value);
		if (file instanceof TFile) url = view.app.vault.getResourcePath(file);
	}

	if (url) {
		// Escape characters that would break out of the CSS url("...") literal.
		// cover/center sizing lives in styles.css (.hearth-bg).
		const safe = url.replace(/["\\]/g, "\\$&");
		layer.style.backgroundImage = `url("${safe}")`;
	}
}

/**
 * Play a vault video as the board's backdrop.
 *
 * Video rather than an animated image because the decode moves off the main
 * thread — an animated GIF or WEBP is re-decoded there frame by frame, which is
 * what makes those backdrops stutter on a slow machine. It is still the most
 * expensive backdrop Hearth paints, so it is gated harder than any other kind:
 * only the `full` performance tier lets it play (see
 * {@link videoBackgroundPlays}), and even there it holds still while the window
 * is not the one being used. Every other case leaves it paused on its first
 * frame, which is why the element is given a real `preload` value — a paused
 * video with no data loaded paints nothing at all.
 *
 * The teardown is not optional. A `<video>` removed from the document keeps its
 * decoder alive until the element is collected, and this view is rebuilt often,
 * so without it the feature would leak one running decoder per rebuild — the
 * exact cost it exists to avoid.
 */
function applyVaultVideo(
	view: HomeView,
	layer: HTMLElement,
	bg: BackgroundConfig,
	component: Component,
): void {
	const file = view.app.vault.getAbstractFileByPath(bg.value);
	if (!(file instanceof TFile)) return;

	const settings = view.plugin.settings;
	const doc = layer.ownerDocument;
	const win = doc.defaultView;

	// Autoplay with no sound: a wallpaper that talks is a bug. `muted` plus
	// `playsinline` is also what a mobile webview requires before it will start
	// a video at all.
	const video = layer.createEl("video", { cls: "hearth-bg-video" });
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.setAttribute("muted", "");
	video.setAttribute("playsinline", "");
	video.src = view.app.vault.getResourcePath(file);

	// The system's own reduced-motion request is honoured here for the same
	// reason the painted sky's animation is: a reader who asked their machine to
	// hold still did not mean "except behind this one plugin".
	const reducedMotion = win?.matchMedia("(prefers-reduced-motion: reduce)") ?? null;
	const wanted = (): boolean =>
		videoBackgroundPlays(settings) && reducedMotion?.matches !== true;

	// The window gate of motion.ts, restated for an element a CSS class cannot
	// freeze. Mobile has no second window to lose focus to, and the on-screen
	// keyboard moves focus around while the board is plainly being looked at.
	const windowActive = (): boolean =>
		!doc.hidden && (Platform.isMobile || !settings.pauseWhenUnfocused || doc.hasFocus());

	const apply = (): void => {
		if (wanted() && windowActive()) {
			// A rejection here is not an error: iOS in low power mode, and any
			// webview that dislikes the markup, refuse autoplay outright — and a
			// frozen first frame is the right outcome then.
			void video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	};

	// Only fetch enough to paint the first frame when it is not going to play.
	video.preload = wanted() ? "auto" : "metadata";
	apply();

	// A paused video paints nothing until something has been decoded, and a file
	// that is only metadata-deep has decoded nothing — seeking a hair past zero
	// is what turns "frozen" into "a still picture" instead of a black board.
	component.registerDomEvent(video, "loadedmetadata", () => {
		if (video.paused && video.currentTime === 0) video.currentTime = 0.001;
	});
	component.registerDomEvent(doc, "visibilitychange", apply);
	if (win && !Platform.isMobile) {
		component.registerDomEvent(win, "focus", apply);
		component.registerDomEvent(win, "blur", apply);
	}
	component.register(() => {
		video.pause();
		video.removeAttribute("src");
		video.load();
	});
}

/** How often the backdrop refetches its forecast. Fixed rather than
 * configurable: a sky that changes is the whole point, an hourly-published
 * forecast is all there is to fetch, and this is a wallpaper — not a card whose
 * refresh the reader is tuning. */
const SKY_REFRESH_MIN = 30;

/**
 * A weather background needs no units — it draws a condition and a day/night
 * flag — so it asks for the defaults, which is also what an unconfigured
 * weather card asks for. The two then share one cached response instead of
 * making the same request twice.
 */
function skyRequest(lat: number, lon: number): WeatherRequest {
	return { lat, lon, tempUnit: "c", windUnit: "kmh", precipUnit: "mm" };
}

/**
 * Paint the live sky for a place across the whole board.
 *
 * The same drawing as the weather card's artistic style (see sky.ts), at board
 * spread: more stars, more clouds, more rain, because a window is several times
 * a card. It shows whatever is cached immediately — a stale sky beats a blank
 * one — then fetches and repaints, and keeps itself current on a timer. Low
 * power mode never reaches here: `effectiveBackground` has already replaced the
 * whole background with its flat colour.
 */
function applyWeatherSky(
	view: HomeView,
	layer: HTMLElement,
	bg: BackgroundConfig,
	component: Component,
): void {
	const sky = parseSkyValue(bg.value);
	if (!sky) return;
	const settings = view.plugin.settings;
	const animate = effectiveSkyAnimate(settings) && motionAllowed(settings);
	const density = skyDensity(settings);
	const design = effectiveSkyDesign(settings);

	// A fixed sky is the whole feature for anyone who wants one weather and
	// wants it kept: it is drawn once, from a condition the reader chose, and
	// touches the network exactly never.
	if (sky.mode === "fixed") {
		drawSky(layer, {
			code: skyGroupCode(sky.group),
			isDay: resolveDaylight(sky.daylight, new Date().getHours()),
			animate,
			density,
			spread: "board",
			design,
		});
		return;
	}

	const req = skyRequest(sky.place.lat, sky.place.lon);
	const disabled = settings.disableExternalCalls;

	// The view is rebuilt often; a resolved fetch must not draw into a layer
	// that has since been thrown away.
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});

	const paint = (): void => {
		layer.empty();
		const snapshot = cachedWeather(req);
		if (snapshot) {
			drawSky(layer, {
				code: snapshot.now.code,
				isDay: snapshot.now.isDay,
				animate,
				density,
				spread: "board",
			design,
			});
			return;
		}
		// Nothing cached yet (a cold start, or external calls are off). Rather
		// than flash an empty board, paint a neutral overcast sky — the one
		// condition that claims nothing — lit by the reader's own clock so it at
		// least agrees with whether it is dark outside their window.
		drawSky(layer, {
			code: 3,
			isDay: daylightFromHour(new Date().getHours()),
			animate,
			density,
			spread: "board",
			design,
		});
	};

	paint();
	void loadWeather(req, { ttlMs: SKY_REFRESH_MIN * 60_000, disabled }).then(() => {
		if (!destroyed) paint();
	});
	component.registerInterval(
		window.setInterval(() => {
			void loadWeather(req, { ttlMs: SKY_REFRESH_MIN * 60_000, disabled, force: true }).then(
				() => {
					if (!destroyed) paint();
				},
			);
		}, SKY_REFRESH_MIN * 60_000),
	);
}
