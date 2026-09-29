/**
 * The search cards as text: the saved query and the search bar.
 *
 * The saved query lists what it finds, one file a row with the reason it
 * matched beside it (a tag, a property) or the matched sentence under it.
 *
 * The search bar is the header's own search, as the graphical card is — the
 * same field, the same syntax, the same results — mounted on the card's grid,
 * with its results listed in the card instead of in a dropdown over the board.
 */
import { TFile } from "obsidian";
import { createSearchBarButton } from "../../header";
import { t } from "../../i18n";
import { mergeRanked, runQuery, searchFileContents, slotsAboveBody, type QueryHit } from "../../query";
import { SearchSection } from "../../search";
import type { TuiContext, TuiItem, TuiRenderer } from "../card";
import { asciify, spread, truncate, wrap, type Line } from "../text";
import { buttonGrid, fileMenu, fileTag, fileTagStyle, message, openCardFile } from "./common";

// ---- Saved query ----------------------------------------------------------------------

/** The file-name hits, and the body hits a content search added to them. A
 * content search redraws the card; that draw must not start another. */
function hitsFor(ctx: TuiContext, query: string, limit: number): QueryHit[] {
	const hits = runQuery(ctx.view.app, query, { limit, filter: { includeFolders: false, includeFiles: true, groupId: null } });
	const key = `${query}|${limit}`;
	const extra = ctx.state.searchExtraFor === key ? (ctx.state.searchExtra as QueryHit[] | undefined) : undefined;
	if (ctx.state.searchFresh === true) {
		ctx.state.searchFresh = false;
	} else if (ctx.view.plugin.settings.searchContents) {
		const exclude = new Set(hits.map((h) => h.file.path));
		void searchFileContents(ctx.view.app, query, { exclude, limit: Math.max(0, limit - slotsAboveBody(hits)) }).then((found) => {
			ctx.state.searchExtra = found;
			ctx.state.searchExtraFor = key;
			ctx.state.searchFresh = true;
			ctx.redraw();
		});
	}
	return extra?.length ? mergeRanked(hits, extra, limit) : hits.slice(0, limit);
}

export const searchTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.savedSearch ?? {};
		const query = (cfg.query ?? "").trim();
		if (!query) return { lines: message(t().cards.empty.searchNoQuery, ctx.cols) };
		const limit = ctx.zoomed ? 100 : cfg.count && cfg.count > 0 ? cfg.count : 12;
		const list = hitsFor(ctx, query, limit);
		if (!list.length) return { lines: message(t().cards.empty.searchNoMatches, ctx.cols) };
		const w = ctx.cols;
		const open = (hit: QueryHit, evt?: MouseEvent | KeyboardEvent) => {
			if (hit.file instanceof TFile) openCardFile(ctx.view, hit.file, evt);
		};
		const menu = (hit: QueryHit) => (evt: MouseEvent | KeyboardEvent) => {
			if (hit.file instanceof TFile) fileMenu(ctx.view, hit.file, evt);
		};
		const name = (hit: QueryHit) => asciify(hit.file instanceof TFile ? hit.file.basename : hit.file.name);

		// Tiles: a launchpad of the names.
		if ((cfg.view ?? "list") === "tiles") {
			const grid = buttonGrid(ctx, list.map((hit) => ({ label: name(hit), style: "accent", activate: (evt) => open(hit, evt), menu: menu(hit) })));
			return { ...grid, hint: query, foot: t().tui.cards.filesFoot };
		}

		const lines: Line[] = [];
		const items: TuiItem[] = [];
		for (const hit of list) {
			const line = lines.length;
			const tag: Line = [{ text: ` ${fileTag(hit.file)}`, style: fileTagStyle(hit.file) }];
			if (hit.badge?.excerpt) {
				lines.push(spread([{ text: name(hit), style: "bold" }], tag, w));
				for (const l of wrap(asciify(hit.badge.label), Math.max(8, w - 2)).slice(0, ctx.zoomed ? 4 : 2)) lines.push([{ text: "  " }, { text: l, style: "dim" }]);
			} else {
				const right: Line = hit.badge ? [{ text: ` ${asciify(truncate(hit.badge.label, 20))}`, style: "yellow" }, ...tag] : tag;
				lines.push(spread([{ text: name(hit) }], right, w));
			}
			items.push({ line, span: lines.length - line, activate: (evt) => open(hit, evt), menu: menu(hit) });
		}
		return { lines, items, hint: truncate(query, 24), foot: t().tui.cards.filesFoot };
	},
};

// ---- Search bar ------------------------------------------------------------------------

export const searchbarTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.searchBar ?? {};
		return {
			lines: Array.from({ length: Math.max(1, ctx.rows) }, () => []),
			mounts: [
				{
					line: 0,
					rows: Math.max(1, ctx.rows),
					mount: (host, component) => {
						const search = new SearchSection(ctx.view);
						const shell = host.createDiv("hearth-search-wrap hearth-tui-searchwrap hearth-tui-cardsearch");
						const col = shell.createDiv("hearth-search-col");
						const row = col.createDiv("hearth-search hearth-tui-searchrow");
						row.createSpan({ cls: "hearth-tui-searchlabel", text: "/" });
						const bar = search.renderBar(row, { placeholder: cfg.placeholder });
						if (cfg.button && cfg.button !== "none") row.append(createSearchBarButton(ctx.view, bar, cfg.button));
						search.renderResultsAndFilters(col, col, component, {
							filters: cfg.filters === true,
							hiddenFilters: cfg.hiddenFilters,
							hiddenInstantAnswers: cfg.hiddenInstantAnswers,
						});
					},
				},
			],
		};
	},
	key(ctx, evt) {
		if (evt.key !== "/" && evt.key !== "i") return false;
		const input = ctx.view.contentEl.querySelector<HTMLInputElement>(`.hearth-tui-body[data-card="${ctx.card.id}"] .hearth-search-input`);
		if (!input) return false;
		input.focus();
		return true;
	},
};
