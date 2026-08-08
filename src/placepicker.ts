/**
 * The location controls, shared by everything that needs to know where the
 * weather is: the weather card's editor, the global background settings, and a
 * dashboard's background override. The background adds one more choice on top
 * — live weather or a sky pinned to one condition — which is `renderSkySource`
 * at the bottom of this file.
 *
 * It is one control rather than three copies because the behaviour is fiddly
 * and worth getting right once — the search is a real network call that has to
 * be cancellable, degrade when external calls are off, and survive the
 * in-place re-renders its own buttons trigger. The caller supplies a scratch
 * object to keep the query and results in, and gets told when a place is
 * chosen; everything else is in here.
 */
import { Notice, Setting } from "obsidian";
import { t } from "./i18n";
import type { DashboardCard, HomeSettings, WeatherPlace } from "./types";
import {
	type SkyBackground,
	type SkyDaylight,
	SKY_GROUPS,
	skyGroupCode,
} from "./sky";
import { type GeoResult, searchPlaces, type WeatherGroup, weatherLabelKey } from "./weather";

/** Scratch-space keys. Namespaced because the card editor's session object is
 * shared with the other kind editors. */
const QUERY = "placeQuery";
const RESULTS = "placeResults";
const SEARCHED = "placeSearched";
const VERSION = "placeSearchVersion";

export interface PlacePickerOptions {
	/** The place currently configured, shown with a clear button. */
	current: WeatherPlace | undefined;
	/** Called with the chosen place, or undefined when it is cleared. */
	onPick: (place: WeatherPlace | undefined) => void;
	/** Rebuild the surrounding pane, so the picker can show what changed. */
	rerender: () => void;
	/** True while Hearth's privacy setting blocks outbound requests: the search
	 * is disabled and says so, but coordinates can still be typed. */
	disabled: boolean;
	/** Per-open scratch space that survives `rerender()` but not a reopen. */
	session: Record<string, unknown>;
	/** Places already configured elsewhere in the vault, offered as one-click
	 * choices so the same location isn't looked up twice. */
	suggestions?: WeatherPlace[];
}

/** Every distinct place already configured on a weather card, so a second
 * consumer (a background, another card) can borrow one instead of searching
 * again. Deduplicated on the rounded coordinates the forecast cache uses. */
export function configuredPlaces(settings: HomeSettings): WeatherPlace[] {
	const seen = new Set<string>();
	const out: WeatherPlace[] = [];
	const consider = (place: WeatherPlace | undefined): void => {
		if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
		const key = `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(place);
	};
	const fromCards = (cards: DashboardCard[] | undefined): void => {
		for (const card of cards ?? []) consider(card.weather?.place);
	};
	// Every board, plus the cards pinned across all of them.
	for (const dash of settings.dashboards ?? []) fromCards(dash.cards);
	fromCards(settings.pinnedCards);
	return out;
}

/** A short label for a place: its name, or its coordinates when it has none. */
export function placeLabel(place: WeatherPlace): string {
	const name = place.name?.trim();
	if (name) return name;
	return `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`;
}

/** The row showing what is configured now, with a button to clear it. */
function currentRow(containerEl: HTMLElement, opts: PlacePickerOptions): void {
	const place = opts.current;
	if (!place) return;
	const strings = t().editors.weather;
	new Setting(containerEl)
		.setName(placeLabel(place))
		.setDesc(
			[place.region, `${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`]
				.filter(Boolean)
				.join(" · "),
		)
		.setClass("hearth-weather-current-place")
		.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.clearPlace)
				.onClick(() => {
					opts.onPick(undefined);
					opts.rerender();
				}),
		);
}

/** One-click reuse of a place already configured on a weather card. */
function suggestionRow(containerEl: HTMLElement, opts: PlacePickerOptions): void {
	const suggestions = (opts.suggestions ?? []).filter(
		(p) =>
			!opts.current ||
			p.lat.toFixed(4) !== opts.current.lat.toFixed(4) ||
			p.lon.toFixed(4) !== opts.current.lon.toFixed(4),
	);
	if (!suggestions.length) return;
	const strings = t().editors.weather;
	const setting = new Setting(containerEl)
		.setName(strings.reuse)
		.setDesc(strings.reuseDesc);
	let chosen = "";
	setting.addDropdown((d) => {
		d.addOption("", strings.reusePick);
		suggestions.forEach((place, i) => {
			d.addOption(String(i), placeLabel(place));
		});
		d.onChange((v) => {
			chosen = v;
		});
	});
	setting.addButton((b) =>
		b.setButtonText(strings.usePlace).onClick(() => {
			const place = suggestions[Number(chosen)];
			if (!place) return;
			opts.onPick({ ...place });
			opts.rerender();
		}),
	);
}

/** The name search: type a name, hit Search, pick one of the matches. This is
 * the only lookup Hearth ever does, and only when asked. */
function searchRows(containerEl: HTMLElement, opts: PlacePickerOptions): void {
	const strings = t().editors.weather;

	const search = new Setting(containerEl)
		.setName(strings.search)
		.setDesc(opts.disabled ? strings.searchDisabled : strings.searchDesc)
		.setClass("hearth-weather-search");

	search.addText((txt) => {
		txt
			.setPlaceholder(strings.searchPlaceholder)
			.setValue((opts.session[QUERY] as string) ?? "")
			.onChange((v) => {
				opts.session[QUERY] = v;
			});
		txt.inputEl.addClass("hearth-weather-search-input");
	});

	const run = async (button: { setDisabled(v: boolean): unknown }): Promise<void> => {
		const query = ((opts.session[QUERY] as string) ?? "").trim();
		if (!query) {
			new Notice(strings.searchEmpty);
			return;
		}
		// Ignore a slow search whose results land after a newer one, or after the
		// pane has moved on.
		const version = ((opts.session[VERSION] as number) ?? 0) + 1;
		opts.session[VERSION] = version;
		button.setDisabled(true);
		const results = await searchPlaces(query, { disabled: opts.disabled });
		if (version !== opts.session[VERSION] || !search.settingEl.isConnected) {
			button.setDisabled(false);
			return;
		}
		opts.session[RESULTS] = results;
		opts.session[SEARCHED] = true;
		opts.rerender();
	};

	search.addButton((b) =>
		b
			.setButtonText(strings.searchButton)
			.setCta()
			.setDisabled(opts.disabled)
			.onClick(() => {
				void run(b);
			}),
	);

	const results = (opts.session[RESULTS] as GeoResult[] | undefined) ?? [];
	if (opts.session[SEARCHED] && !results.length) {
		containerEl.createDiv({
			cls: "hearth-weather-search-empty setting-item-description",
			text: strings.searchNoResults,
		});
	}
	for (const result of results) {
		new Setting(containerEl)
			.setName(result.name)
			.setDesc(result.region || `${result.lat.toFixed(2)}, ${result.lon.toFixed(2)}`)
			.setClass("hearth-weather-result")
			.addButton((b) =>
				b.setButtonText(strings.usePlace).onClick(() => {
					opts.onPick({
						name: result.name,
						region: result.region || undefined,
						lat: result.lat,
						lon: result.lon,
						timezone: result.timezone || undefined,
					});
					opts.session[RESULTS] = [];
					opts.session[SEARCHED] = false;
					opts.rerender();
				}),
			);
	}
}

/** Latitude/longitude entry, for a place the geocoder doesn't know — or for
 * anyone who would rather not send a place name anywhere at all. */
function coordinateRows(containerEl: HTMLElement, opts: PlacePickerOptions): void {
	const strings = t().editors.weather;

	/** Write one coordinate, creating the place if this is the first one typed. */
	const setCoord = (which: "lat" | "lon", raw: string): void => {
		const value = Number(raw.trim());
		if (raw.trim() === "" || Number.isNaN(value)) return;
		const limit = which === "lat" ? 90 : 180;
		if (Math.abs(value) > limit) return;
		const place: WeatherPlace = opts.current
			? { ...opts.current }
			: { name: "", lat: 0, lon: 0 };
		place[which] = value;
		if (!place.name.trim()) place.name = `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`;
		opts.onPick(place);
	};

	const coords = new Setting(containerEl)
		.setName(strings.coordinates)
		.setDesc(strings.coordinatesDesc);
	coords.addText((txt) =>
		txt
			.setPlaceholder(strings.latPlaceholder)
			.setValue(opts.current ? String(opts.current.lat) : "")
			.onChange((v) => setCoord("lat", v)),
	);
	coords.addText((txt) =>
		txt
			.setPlaceholder(strings.lonPlaceholder)
			.setValue(opts.current ? String(opts.current.lon) : "")
			.onChange((v) => setCoord("lon", v)),
	);

	new Setting(containerEl)
		.setName(strings.placeName)
		.setDesc(strings.placeNameDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.placeNamePlaceholder)
				.setValue(opts.current?.name ?? "")
				.setDisabled(!opts.current)
				.onChange((v) => {
					if (!opts.current) return;
					opts.onPick({ ...opts.current, name: v });
				}),
		);
}

/** Draw the whole picker: what is set now, one-click reuse, name search, and
 * manual coordinates. */
export function renderPlacePicker(containerEl: HTMLElement, opts: PlacePickerOptions): void {
	currentRow(containerEl, opts);
	suggestionRow(containerEl, opts);
	searchRows(containerEl, opts);
	coordinateRows(containerEl, opts);
}

export interface SkySourceOptions extends Omit<PlacePickerOptions, "current" | "onPick"> {
	/** What the background is set to now, or null when it is unset. */
	current: SkyBackground | null;
	/** Called with the new setting, or undefined to clear it. */
	onChange: (sky: SkyBackground | undefined) => void;
}

/**
 * Where a weather background gets its sky: the live weather over a place, or
 * one condition pinned and kept.
 *
 * The fixed branch is deliberately the same painting, not a lesser one — it is
 * for anyone who wants a clear night behind their notes whatever the sky is
 * doing outside. It also needs no location, and so makes no request at all.
 */
export function renderSkySource(containerEl: HTMLElement, opts: SkySourceOptions): void {
	const strings = t().settings.background;
	const mode = opts.current?.mode ?? "live";

	new Setting(containerEl)
		.setName(strings.skySource)
		.setDesc(strings.skySourceDesc)
		.addDropdown((d) => {
			d.addOption("live", strings.skySourceLive);
			d.addOption("fixed", strings.skySourceFixed);
			d.setValue(mode).onChange((v) => {
				if (v === "fixed") {
					// Default to the sky most people picking "fixed" are after,
					// and keep following the clock until told otherwise.
					opts.onChange({ mode: "fixed", group: "clear", daylight: "auto" });
				} else {
					// Switching back to live keeps whatever place was last set, if
					// this control still has one; otherwise the picker below asks.
					opts.onChange(undefined);
				}
				opts.rerender();
			});
		});

	if (mode === "fixed" && opts.current?.mode === "fixed") {
		const fixed = opts.current;
		const conditions = t().cards.weather.conditions;
		new Setting(containerEl)
			.setName(strings.skyCondition)
			.setDesc(strings.skyConditionDesc)
			.addDropdown((d) => {
				for (const group of SKY_GROUPS) {
					d.addOption(group, conditions[weatherLabelKey(skyGroupCode(group))]);
				}
				d.setValue(fixed.group).onChange((v) => {
					opts.onChange({ ...fixed, group: v as WeatherGroup });
					opts.rerender();
				});
			});
		new Setting(containerEl)
			.setName(strings.skyDaylight)
			.setDesc(strings.skyDaylightDesc)
			.addDropdown((d) => {
				d.addOption("auto", strings.skyDaylightAuto);
				d.addOption("day", strings.skyDaylightDay);
				d.addOption("night", strings.skyDaylightNight);
				d.setValue(fixed.daylight).onChange((v) => {
					opts.onChange({ ...fixed, daylight: v as SkyDaylight });
					opts.rerender();
				});
			});
		return;
	}

	renderPlacePicker(containerEl, {
		...opts,
		current: opts.current?.mode === "live" ? opts.current.place : undefined,
		onPick: (place) => opts.onChange(place ? { mode: "live", place } : undefined),
	});
}
