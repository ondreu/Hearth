import { type Component, Platform, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";
import { HEARTH_ICON_ID } from "./icon";
import {
	effectiveHeaderAlign,
	effectiveHeaderLogoScale,
	effectiveHeaderMarginTop,
	effectiveHeaderSpacingBelow,
	effectiveHeaderTitleScale,
	effectiveLogo,
	effectiveShowSearch,
	effectiveShowTitle,
	effectiveTitle,
} from "./types";
import { t } from "./i18n";

/** The search engine used by the “Search online” button action.
 * DuckDuckGo's GET endpoint works without an API key and is privacy-friendly. */
const WEB_SEARCH_URL = "https://duckduckgo.com/?q=";

/** Renders the title/logo, the search bar with the New-note button, and the
 * auto-detected filter row. In Mobile mode, the New-note button is left out
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
		titleRow.style.setProperty("--hearth-title-scale", String(effectiveHeaderTitleScale(s)));
		titleRow.style.setProperty("--hearth-logo-scale", String(effectiveHeaderLogoScale(s)));
		const marginTop = effectiveHeaderMarginTop(s);
		if (marginTop !== undefined) {
			titleRow.style.setProperty("--hearth-title-margin-top", `${marginTop}px`);
		}

		const logo = effectiveLogo(s).trim();
		// A custom emoji/text logo is shown verbatim; otherwise fall back to the
		// Hearth crystal icon as the brand mark.
		if (logo === "") {
			const logoEl = titleRow.createSpan({ cls: "hearth-logo hearth-logo-icon" });
			setIcon(logoEl, HEARTH_ICON_ID);
		} else {
			titleRow.createSpan({ cls: "hearth-logo", text: logo });
		}
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
	const searchWrap = container.createDiv("hearth-search-wrap");
	const searchCol = searchWrap.createDiv("hearth-search-col");
	const searchRow = searchCol.createDiv("hearth-search");
	const bar = search.renderBar(searchRow);

	if (s.showNewNoteButton && !mobileOnly) {
		const btn =
			s.newNoteButtonMode === "searchOnline"
				? createSearchOnlineButton(bar)
				: createNewNoteButton(view);
		searchWrap.append(btn);
	}

	search.renderResultsAndFilters(searchCol, searchCol, component);
}

/** Read the current query out of the search bar's input element. */
function getSearchQuery(bar: HTMLElement): string {
	return bar.querySelector<HTMLInputElement>(".hearth-search-input")?.value.trim() ?? "";
}

/** Open a web search for the current query (or the engine's home page when
 * empty) in the user's default browser. */
function searchOnline(bar: HTMLElement): void {
	const q = getSearchQuery(bar);
	const url = q ? WEB_SEARCH_URL + encodeURIComponent(q) : WEB_SEARCH_URL.replace("?q=", "");
	try {
		window.open(url, "_blank");
	} catch {
		// Pop-up blocked or unavailable — fall back to Obsidian's window opener.
		window.open(url, "_blank", "noopener");
	}
}

/** The original New-note button: creates a new note on click. */
function createNewNoteButton(view: HomeView): HTMLElement {
	const btn = activeDocument.createElement("button");
	btn.className = "hearth-newnote";
	btn.setAttribute("aria-label", t().header.newNoteAria);
	setIcon(btn.createSpan("hearth-newnote-icon"), "plus");
	btn.createSpan({ cls: "hearth-newnote-label", text: t().header.newNote });
	btn.addEventListener("click", () => {
		void view.plugin.createNewNote();
	});
	return btn;
}

/** The Search-online button: runs a web search for the current query. */
function createSearchOnlineButton(bar: HTMLElement): HTMLElement {
	const btn = activeDocument.createElement("button");
	btn.className = "hearth-newnote hearth-newnote-search";
	btn.setAttribute("aria-label", t().header.searchOnlineAria);
	setIcon(btn.createSpan("hearth-newnote-icon"), "globe");
	btn.createSpan({ cls: "hearth-newnote-label", text: t().header.searchOnline });
	btn.addEventListener("click", () => searchOnline(bar));
	return btn;
}
