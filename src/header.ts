import { type Component, Menu, Platform, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";
import { hearthIconIdFor } from "./icon";
import { renderTitleIcon } from "./titleicon";
import {
	effectiveHeaderAlign,
	effectiveHeaderLogoScale,
	effectiveHeaderMarginTop,
	effectiveHeaderSpacingBelow,
	effectiveHeaderTitleScale,
	effectiveNewNoteButtonLabel,
	effectiveNewNoteButtonMode,
	effectiveShowNewNoteButton,
	effectiveShowSearch,
	effectiveShowTitle,
	effectiveThemeColorTarget,
	effectiveTitle,
	effectiveTitleIcon,
} from "./types";
import { t } from "./i18n";
import { newNoteButtonLabel } from "./newnote";
import { openWebSearch, WEB_SEARCH_ENGINES } from "./websearch";

/** Renders the title and its icon, the search bar with the New-note button,
 * and the auto-detected filter row. In Mobile mode, the New-note button is left out
 * here — it moves into the mobile action bar rendered below (see
 * mobileactions.ts), along with the rest of that customizable button row.
 *
 * The single button beside the search bar has two modes (configurable in
 * Settings → Appearance → “Search-bar button”):
 *   - "newNote": create a new note (the original button)
 *   - "searchOnline": run a web search for the current search-field contents */
export function renderHeader(view: HomeView, container: HTMLElement, component: Component): void {
	const s = view.plugin.settings;
	const mobileOnly = Platform.isMobile && s.mobileSearchOnly;

	container.addClass(`is-title-align-${effectiveHeaderAlign(s)}`);
	const spacingBelow = effectiveHeaderSpacingBelow(s);
	if (spacingBelow !== undefined) {
		container.style.setProperty("--hearth-header-spacing-below", `${spacingBelow}px`);
	}

	if (effectiveShowTitle(s)) {
		const titleRow = container.createDiv("hearth-title");
		// Tint the crystal and/or title text with the theme's icon color per
		// the themeColorTarget setting — this board's override, or the global one
		// (see styles.css).
		const target = effectiveThemeColorTarget(s);
		if (target === "icon" || target === "both") titleRow.addClass("is-icon-themed");
		if (target === "title" || target === "both") titleRow.addClass("is-title-themed");
		titleRow.style.setProperty("--hearth-title-scale", String(effectiveHeaderTitleScale(s)));
		titleRow.style.setProperty("--hearth-logo-scale", String(effectiveHeaderLogoScale(s)));
		const marginTop = effectiveHeaderMarginTop(s);
		if (marginTop !== undefined) {
			titleRow.style.setProperty("--hearth-title-margin-top", `${marginTop}px`);
		}

		// One setting decides the mark: a Lucide icon, an emoji or short text, a
		// picture from the vault or the web, or — when it is empty, when a picture
		// it names has gone missing, and when a web picture is one "Disable
		// external calls" won't fetch — the Hearth crystal (#252, #281).
		renderTitleIcon(view.app, titleRow, effectiveTitleIcon(s), {
			fallbackIconId: hearthIconIdFor(target),
			externalCallsDisabled: s.disableExternalCalls,
		});
		titleRow.createSpan({ cls: "hearth-title-text", text: effectiveTitle(s) });
	}

	if (!effectiveShowSearch(s)) return;

	const search = new SearchSection(view);

	// Layout:
	//   searchWrap (flex row, align-items: flex-start)
	//     ├─ searchCol (flex:1) — the bar's width
	//     │     ├─ searchRow (the bar + (nothing else))
	//     │     └─ filter chips + results dropdown (matching the bar's width)
	//     └─ New-note button (beside the bar, top-aligned, flush)
	// The button is a sibling of the column (not inside the bar's row) so the
	// filters span only the bar's width; the button sits flush beside the bar,
	// not pushed down among the filter chips.
	//
	// A narrow board hangs the chips and the results off the WRAP instead, so
	// they span the whole width rather than the bar's share of it. On a phone
	// the button takes a real bite out of a ~390px row, and everything below
	// inherited that bite: a half-width chip row and a half-width results list,
	// with the other half sitting empty next to them. The wrap is `position:
	// relative` exactly as the column is, so the overlay still anchors correctly
	// — it just anchors to the full width, below the chip row rather than beside
	// it. The button loses its label to a tooltip at that width (see styles.css)
	// so the field keeps the rest of the row.
	const narrow = view.isNarrow();
	const searchWrap = container.createDiv("hearth-search-wrap");
	searchWrap.toggleClass("is-narrow", narrow);
	const searchCol = searchWrap.createDiv("hearth-search-col");
	const searchRow = searchCol.createDiv("hearth-search");
	const bar = search.renderBar(searchRow);

	if (effectiveShowNewNoteButton(s) && !mobileOnly) {
		searchWrap.append(createSearchBarButton(view, bar, effectiveNewNoteButtonMode(s)));
	}

	const below = narrow ? searchWrap : searchCol;
	search.renderResultsAndFilters(below, below, component);
}

/** The button that sits beside a search bar, in either of its two modes. Shared
 * with the search-bar card, which offers the same choice per card — so the two
 * places can't drift into two subtly different buttons. `bar` is the search bar
 * the button belongs to; "searchOnline" reads its current query. */
export function createSearchBarButton(
	view: HomeView,
	bar: HTMLElement,
	mode: "newNote" | "searchOnline",
): HTMLElement {
	return mode === "searchOnline" ? createSearchOnlineButton(view, bar) : createNewNoteButton(view);
}

/** Read the current query out of the search bar's input element. */
function getSearchQuery(bar: HTMLElement): string {
	return bar.querySelector<HTMLInputElement>(".hearth-search-input")?.value.trim() ?? "";
}

/** The New-note button: creates a note on click. What that note is — blank, or
 * made from a Templater template, and where it lands — is configured in
 * Settings → Appearance and resolved by `src/newnote.ts` (#227); the button's
 * text is configurable there too, so a board can say "Capture" or "New meeting
 * note" instead. */
function createNewNoteButton(view: HomeView): HTMLElement {
	const label = newNoteButtonLabel(view.plugin.settings);
	const btn = createEl("button", {
		cls: "hearth-newnote",
		// A renamed button describes itself; the generic aria label is only
		// right for the default one.
		attr: {
			"aria-label":
				effectiveNewNoteButtonLabel(view.plugin.settings).trim() ||
				t().header.newNoteAria,
		},
	});
	setIcon(btn.createSpan("hearth-newnote-icon"), "plus");
	btn.createSpan({ cls: "hearth-newnote-label", text: label });
	btn.addEventListener("click", () => {
		void view.plugin.createNewNote(view);
	});
	return btn;
}

/** The Search-online control: a split button. The wide half searches with the
 * configured engine (DuckDuckGo unless Settings → Appearance says otherwise);
 * the caret opens a menu of the other engines, so a one-off search elsewhere
 * costs one extra click and doesn't change the default.
 *
 * Both halves are real <button>s inside one wrapper rather than one button with
 * a clickable corner: the caret is then reachable by keyboard and announces
 * itself as a menu opener. */
function createSearchOnlineButton(view: HomeView, bar: HTMLElement): HTMLElement {
	const wrap = createDiv("hearth-searchonline");

	const btn = wrap.createEl("button", {
		cls: "hearth-newnote hearth-newnote-search",
		attr: { "aria-label": t().header.searchOnlineAria },
	});
	setIcon(btn.createSpan("hearth-newnote-icon"), "globe");
	btn.createSpan({ cls: "hearth-newnote-label", text: t().header.searchOnline });
	btn.addEventListener("click", () => {
		openWebSearch(view.plugin.settings.webSearchEngine, getSearchQuery(bar));
	});

	const caret = wrap.createEl("button", {
		cls: "hearth-newnote hearth-newnote-search-caret",
		attr: {
			"aria-label": t().header.searchOnlinePickAria,
			"aria-haspopup": "menu",
		},
	});
	setIcon(caret.createSpan("hearth-newnote-icon"), "chevron-down");
	caret.addEventListener("click", (evt) => {
		const current = view.plugin.settings.webSearchEngine;
		const menu = new Menu();
		for (const engine of WEB_SEARCH_ENGINES) {
			menu.addItem((item) =>
				item
					.setTitle(
						engine.id === current
							? t().header.searchEngineDefault(engine.name)
							: engine.name,
					)
					.setChecked(engine.id === current)
					.onClick(() => openWebSearch(engine.id, getSearchQuery(bar))),
			);
		}
		menu.showAtMouseEvent(evt);
	});

	return wrap;
}
