import { type Component, TFile } from "obsidian";
import {
	daylightFromHour,
	drawSky,
	parseSkyValue,
	resolveDaylight,
	skyGroupCode,
} from "./sky";
import type { HomeView } from "./view";
import { type BackgroundConfig, effectiveBackground } from "./types";
import { cachedWeather, loadWeather, type WeatherRequest } from "./weather";

/**
 * URL of the bundled default background. Served straight from the main branch
 * on GitHub so it works without depending on a specific release asset being
 * attached. Update the file at assets/default-bg.gif to ship a new image.
 */
const DEFAULT_BG_URL =
	"https://raw.githubusercontent.com/ondreu/Hearth/refs/heads/main/assets/default-bg.gif";

/**
 * Apply the optional, customizable background as a separate layer behind the
 * content so opacity/blur don't affect the foreground. Uses the active
 * dashboard's override when set, otherwise the global default.
 */
export function applyBackground(
	view: HomeView,
	root: HTMLElement,
	component: Component,
): void {
	const bg = effectiveBackground(view.plugin.settings);
	if (bg.kind === "none") return;
	// "default" uses the bundled Hearth background; no value field needed.
	if (bg.kind !== "default" && !bg.value) return;

	const layer = root.createDiv("hearth-bg");
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

	let url: string | null = null;
	if (bg.kind === "default") {
		url = DEFAULT_BG_URL;
	} else if (bg.kind === "url") {
		url = bg.value;
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
	const animate = settings.backgroundSkyAnimate !== false;

	// A fixed sky is the whole feature for anyone who wants one weather and
	// wants it kept: it is drawn once, from a condition the reader chose, and
	// touches the network exactly never.
	if (sky.mode === "fixed") {
		drawSky(layer, {
			code: skyGroupCode(sky.group),
			isDay: resolveDaylight(sky.daylight, new Date().getHours()),
			animate,
			spread: "board",
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
				spread: "board",
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
			spread: "board",
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
