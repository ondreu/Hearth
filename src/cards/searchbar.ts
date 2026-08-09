import { Component, Setting } from "obsidian";
import { createSearchBarButton } from "../header";
import { t } from "../i18n";
import { SearchSection } from "../search";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Search bar --------------------------------------------------------

/**
 * A live search field on the board — the same `SearchSection` the header
 * renders, so it carries every search feature with it (tag/property/`>` command
 * syntax, Omnisearch routing, body search, recents on focus, keyboard
 * navigation) rather than reimplementing a second, weaker one. The action
 * button beside it is the header's button too, in either of its modes.
 *
 * The field's thickness is the card's own height: the bar stretches to fill
 * whatever room the card has left after the optional chip row, so it is resized
 * by dragging the card rather than by a setting (see styles.css). `seamless`
 * drops the frame entirely (see `cardClass` below), which is how you put a bare
 * search bar anywhere on the board instead of a card that contains one.
 */
export function renderSearchBar(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.searchBar ?? {};
	const search = new SearchSection(view);
	// One positioned wrapper holds the bar, the chip row and the results
	// overlay, mirroring the header's search column — the overlay is absolutely
	// positioned against it, so the dropdown spans the card's width.
	const wrap = body.createDiv("hearth-searchbar-card");
	// The bar and its button share a row so the button sits beside the field
	// rather than above the chips, exactly as in the header.
	const row = wrap.createDiv("hearth-searchbar-row");
	const bar = search.renderBar(row, { placeholder: cfg.placeholder });
	if (cfg.button && cfg.button !== "none") {
		row.append(createSearchBarButton(view, bar, cfg.button));
	}
	search.renderResultsAndFilters(wrap, wrap, component, { filters: cfg.filters === true });
}


export function searchBarEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.searchBar ??= {});
	new Setting(containerEl)
		.setName(t().editors.searchBar.placeholder)
		.setDesc(t().editors.searchBar.placeholderDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(ctx.opts.settings.searchPlaceholder || t().search.placeholder)
				.setValue(cfg.placeholder ?? "")
				.onChange((v) => {
					cfg.placeholder = v.trim() ? v : undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
	new Setting(containerEl)
		.setName(t().editors.searchBar.filters)
		.setDesc(t().editors.searchBar.filtersDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.filters === true).onChange((v) => {
				cfg.filters = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.searchBar.button)
		.setDesc(t().editors.searchBar.buttonDesc)
		.addDropdown((d) => {
			d.addOption("none", t().editors.searchBar.buttonNone);
			d.addOption("newNote", t().editors.searchBar.buttonNewNote);
			d.addOption("searchOnline", t().editors.searchBar.buttonSearchOnline);
			d.setValue(cfg.button ?? "none").onChange((v) => {
				cfg.button = v === "none" ? undefined : (v as "newNote" | "searchOnline");
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(t().editors.searchBar.seamless)
		.setDesc(t().editors.searchBar.seamlessDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.seamless === true).onChange((v) => {
				cfg.seamless = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
	// There is no thickness control: the bar fills the card, so its height is the
	// card's. Say so here — it isn't discoverable from a settings pane that has
	// no slider for it.
	const note = new Setting(containerEl).setDesc(t().editors.searchBar.sizeNote);
	note.settingEl.addClass("hearth-setting-note");
}

/** A live search field, optionally without any card frame around it. */
export const searchbarCard: CardDefinition<"searchbar"> = {
	kind: "searchbar",
	templates: [
		{
			id: "searchbar",
			name: "Search bar",
			icon: "text-cursor-input",
			// One row tall: the bar fills the card, so this is what sets its
			// starting thickness — a little more generous than the header's fixed
			// 52px, and made thicker or slimmer by resizing the card. Untitled,
			// because the field explains itself and a title row above a bare bar is
			// exactly what the seamless option exists to avoid.
			build: () => ({ kind: "searchbar", title: "", searchBar: {}, w: 6, h: 1 }),
		},
	],
	render: (view, card, body, component) => renderSearchBar(view, card, body, component),
	renderEditor: (container, ctx) => searchBarEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.searchBar) copy.searchBar = { ...source.searchBar };
	},
	// The results overlay has to escape the card box, and a seamless card paints
	// no surface at all — both are styled off these classes (see styles.css).
	cardClass: (card) =>
		card.searchBar?.seamless ? "is-searchbar-card is-seamless" : "is-searchbar-card",
	// Deliberately not vault-live. The card holds live UI state — the typed
	// query, the active chip, the open dropdown — and a redraw would throw all
	// of it away; a background sync landing mid-search would blank the field
	// under the user's hands. Nothing here goes stale in the meantime either:
	// results are computed per keystroke, and the chip row (derived from the
	// file types present in the vault) is rebuilt on the next board render.
	liveness: { mode: "static" },
};
