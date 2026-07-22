import { setIcon, Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { addResetButton } from "../editors";
import { iconForFile } from "../filetypes";
import { t } from "../i18n";
import { runQuery, searchFileContents, type QueryHit } from "../query";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Query (saved search) ----------------------------------------------

/** A card that runs a saved query (same syntax as the top search bar) and lists
 * the matching files, refreshed on every render. */
export function renderSavedSearch(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.savedSearch ?? {};
	const query = (cfg.query ?? "").trim();
	if (!query) {
		emptyState(body, "search", t().cards.empty.searchNoQuery);
		return;
	}
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 12;
	const useTiles = (cfg.view ?? "list") === "tiles";

	const hits = runQuery(view.app, query, { limit });

	const render = (all: QueryHit[]) => {
		const list = all.slice(0, limit);
		if (list.length === 0) {
			emptyState(body, "search-x", t().cards.empty.searchNoMatches);
			return;
		}
		body.empty();
		if (useTiles) {
			renderQueryTiles(view, body, list);
		} else {
			renderQueryList(view, body, list);
		}
	};

	render(hits);
	// Append full-text body matches when enabled (self-guards to name queries).
	if (view.plugin.settings.searchContents) {
		const exclude = new Set(hits.map((h) => h.file.path));
		void searchFileContents(view.app, query, { exclude, limit }).then((extra) => {
			if (extra.length) render([...hits, ...extra]);
		});
	}
}


function renderQueryList(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const el = body.createDiv("hearth-list");
	for (const hit of list) {
		const row = el.createDiv("hearth-list-item");
		setIcon(row.createDiv("hearth-list-icon"), hit.badge?.icon ?? iconForFile(hit.file));
		const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
		row.createDiv({ cls: "hearth-list-label", text: name });
		if (hit.badge) row.createDiv({ cls: "hearth-task-status", text: hit.badge.label });
		const open = () => {
			if (hit.file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(hit.file);
		};
		row.addEventListener("click", open);
		makeClickable(row, open, name);
	}
}


function renderQueryTiles(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	for (const hit of list) {
		const tile = grid.createDiv("hearth-link-tile");
		setIcon(tile.createDiv("hearth-link-icon"), hit.badge?.icon ?? iconForFile(hit.file));
		const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
		tile.createDiv({ cls: "hearth-link-label", text: name });
		const open = () => {
			if (hit.file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(hit.file);
		};
		tile.addEventListener("click", open);
		makeClickable(tile, open, name);
	}
}


export function savedSearchEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.savedSearch ??= {});
	new Setting(containerEl)
		.setName(t().editors.savedSearch.query)
		.setDesc(t().editors.savedSearch.queryDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(t().editors.savedSearch.queryPlaceholder)
				.setValue(cfg.query ?? "")
				.onChange((v) => {
					cfg.query = v;
					ctx.opts.save();
				}),
		);
	new Setting(containerEl)
		.setName(t().editors.savedSearch.display)
		.setDesc(t().editors.savedSearch.displayDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.savedSearch.displayList);
			d.addOption("tiles", t().editors.savedSearch.displayTiles);
			d.setValue(cfg.view ?? "list").onChange((v) => {
				cfg.view = v === "list" ? undefined : (v as "tiles");
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	const maxResults = new Setting(containerEl)
		.setName(t().editors.savedSearch.maxResults)
		.setDesc(t().editors.savedSearch.maxResultsDesc);
	maxResults.addText((t) => {
		t.setValue(String(cfg.count ?? 12)).onChange((v) => {
			const n = parseInt(v, 10);
			cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		t.inputEl.type = "number";
		t.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, maxResults, t().settings.resetField, () => {
		cfg.count = undefined;
	});
}

/** A saved query whose matching notes are listed live. */
export const searchCard: CardDefinition<"search"> = {
	kind: "search",
	templates: [
		{ id: "search", name: "Query", icon: "search", build: () => ({ kind: "search", title: "Query", savedSearch: { query: "" }, w: 4, h: 4 }) },
	],
	render: (view, card, body) => renderSavedSearch(view, card, body),
	renderEditor: (container, ctx) => savedSearchEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.savedSearch) copy.savedSearch = { ...source.savedSearch };
	},
	liveness: { mode: "vault" },
};
