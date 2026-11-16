import { Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { addResetButton } from "../editors";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { t } from "../i18n";
import { openSearchHit } from "../opener";
import {
	expandQuery,
	mergeRanked,
	QUERY_VARIABLES,
	runQuery,
	searchFileContents,
	slotsAboveBody,
	type QueryHit,
	type QueryVariable,
} from "../query";
import { type DashboardCard } from "../types";
import { makeClickable, renderHighlighted } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Query (saved search) ----------------------------------------------

/** A card that runs a saved query (same syntax as the top search bar) and lists
 * the matching files, refreshed on every render. `{{variables}}` in the stored
 * query are filled first, so it can ask for today's notes and stay correct. */
export function renderSavedSearch(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.savedSearch ?? {};
	const query = expandQuery((cfg.query ?? "").trim());
	if (!query) {
		emptyState(body, "search", t().cards.empty.searchNoQuery);
		return;
	}
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 12;
	const useTiles = (cfg.view ?? "list") === "tiles";

	// Files only: the card's rows open a note on click, so a folder hit would
	// render as a row that looks clickable and then does nothing.
	const hits = runQuery(view.app, query, {
		limit,
		filter: { includeFolders: false, includeFiles: true, groupId: null },
	});

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
		// Budget against the hits that outrank a body match, so fuzzy name hits
		// (which sort below body ones) don't reserve slots they won't keep.
		void searchFileContents(view.app, query, {
			exclude,
			limit: Math.max(0, limit - slotsAboveBody(hits)),
		}).then((extra) => {
			if (extra.length) render(mergeRanked(hits, extra, limit));
		});
	}
}


function renderQueryList(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const el = body.createDiv("hearth-list");
	const icons = fileIconOptions(view.plugin.settings);
	for (const hit of list) {
		const row = el.createDiv("hearth-list-item");
		// A badge icon describes *why* the file matched (tag, property, body), so
		// it outranks the file's own icon.
		applyFileIcon(
			row.createDiv("hearth-list-icon"),
			hit.badge?.icon ?? resolveFileIcon(view.app, hit.file, icons),
		);
		const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
		if (hit.badge?.excerpt) {
			// A body excerpt is a sentence, not a chip: it goes on its own line
			// under the file name, muted, with the matched words picked out.
			row.addClass("has-excerpt");
			const text = row.createDiv("hearth-list-text");
			text.createDiv({ cls: "hearth-list-label", text: name });
			renderHighlighted(
				text.createDiv("hearth-list-excerpt"),
				hit.badge.label,
				hit.badge.matches,
			);
		} else {
			row.createDiv({ cls: "hearth-list-label", text: name });
			if (hit.badge) row.createDiv({ cls: "hearth-task-status", text: hit.badge.label });
		}
		const open = () => {
			if (hit.file instanceof TFile) void openSearchHit(view, hit, "search");
		};
		row.addEventListener("click", open);
		makeClickable(row, open, name);
	}
}


function renderQueryTiles(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	const icons = fileIconOptions(view.plugin.settings);
	for (const hit of list) {
		const tile = grid.createDiv("hearth-link-tile");
		applyFileIcon(
			tile.createDiv("hearth-link-icon"),
			hit.badge?.icon ?? resolveFileIcon(view.app, hit.file, icons),
		);
		const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
		tile.createDiv({ cls: "hearth-link-label", text: name });
		const open = () => {
			if (hit.file instanceof TFile) void openSearchHit(view, hit, "search");
		};
		tile.addEventListener("click", open);
		makeClickable(tile, open, name);
	}
}


/** The stored query's variables, under its field: click one and it goes in
 * where the cursor was. Same reference block the note templates show (and the
 * same CSS), because without it `{{today}}` would exist but nobody would guess
 * it. */
function renderQueryVariables(
	containerEl: HTMLElement,
	strings: { variables: string; variablesHint: string; vars: Record<QueryVariable, string> },
	field: () => HTMLInputElement | null,
): void {
	const ref = containerEl.createDiv("hearth-clip-ref");
	ref.createDiv({ cls: "hearth-clip-ref-head", text: strings.variables });
	ref.createDiv({ cls: "hearth-clip-ref-hint", text: strings.variablesHint });
	const row = ref.createDiv("hearth-clip-vars");
	for (const name of QUERY_VARIABLES) {
		const chip = row.createEl("button", { cls: "hearth-clip-chip", attr: { type: "button" } });
		chip.createSpan({ cls: "hearth-clip-chip-code", text: `{{${name}}}` });
		chip.createSpan({ cls: "hearth-clip-chip-desc", text: strings.vars[name] });
		// Keep the field's focus and selection: insert where the cursor is.
		chip.addEventListener("mousedown", (e) => e.preventDefault());
		chip.addEventListener("click", () => {
			const el = field();
			if (!el || !el.isConnected) return;
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? start;
			el.setRangeText(`{{${name}}}`, start, end, "end");
			// The field's own change handler saves it; "input" is how a
			// programmatic edit reaches Obsidian's TextComponent.
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.focus();
		});
	}
}

export function savedSearchEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.savedSearch ??= {});
	const strings = t().editors.savedSearch;
	let field: HTMLInputElement | null = null;
	new Setting(containerEl)
		.setName(strings.query)
		.setDesc(strings.queryDesc)
		.addText((txt) => {
			field = txt.inputEl;
			txt
				.setPlaceholder(strings.queryPlaceholder)
				.setValue(cfg.query ?? "")
				.onChange((v) => {
					cfg.query = v;
					ctx.opts.save();
				});
		});
	renderQueryVariables(containerEl, strings, () => field);
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
	expressive: true,
	liveness: { mode: "vault" },
};
