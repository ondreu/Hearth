import { Component } from "obsidian";
import { emptyState, wireMarkdownLinks } from "../cardbodies";
import { getDataviewApi, isDataviewAvailable } from "../dataview";
import { dataviewEditor } from "../editors";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Dataview query -----------------------------------------------------

/** A card that renders a Dataview query (DQL or DataviewJS) through Dataview's
 * own renderers, so tables, lists and task lists look exactly as they do in a
 * note. Depends on the Dataview community plugin — the "Add card" picker only
 * offers this card when Dataview is installed, and the card shows a friendly
 * prompt if Dataview is later disabled. Dataview attaches its own refreshable
 * renderer to `component`, so results update live as the vault (and Dataview's
 * index) change, without Hearth having to re-run the query. */
export function renderDataview(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const api = getDataviewApi(view.app);
	if (!api) {
		emptyState(body, "database", t().cards.empty.dataviewEnable);
		return;
	}
	// Mutate the card's own config (not a throwaway copy) so a column resize can
	// be persisted straight onto the card.
	const cfg = (card.dataview ??= {});
	const query = (cfg.query ?? "").trim();
	if (!query) {
		emptyState(body, "code", t().cards.empty.dataviewNoQuery);
		return;
	}

	const host = body.createDiv("hearth-dataview");
	// The dashboard has no "current note", so queries run with an empty origin
	// path: global queries (FROM #tag, folder scopes…) work fully, but a query
	// that relies on `this.file` has no meaningful current file to resolve to.
	const origin = "";
	const run =
		cfg.language === "js"
			? api.executeJs(query, host, component, origin)
			: api.execute(query, host, component, origin);
	// execute/executeJs render their own errors inline, but guard the promise so
	// an unexpected rejection surfaces as a readable message instead of an
	// unhandled rejection in the console.
	void Promise.resolve(run).catch((err: unknown) => {
		host.empty();
		const message = err instanceof Error ? err.message : String(err);
		emptyState(host, "alert-triangle", message);
	});
	// Dataview renders internal links as anchors; wire them up so they open like
	// links elsewhere on the dashboard (Obsidian only resolves link clicks inside
	// a real Markdown view).
	wireMarkdownLinks(view, host, origin);
	// Let a TABLE result's columns be resized by dragging their right edge.
	setupDataviewColumnResize(view, card, cfg, host, component);
}


/**
 * Make the columns of a Dataview TABLE result resizable by dragging a header's
 * right edge. Columns auto-fit their content by default; the first drag
 * "freezes" the current widths into a fixed layout, and further drags adjust a
 * single column. Widths persist per card (see {@link DataviewConfig.columnWidths}).
 *
 * Dataview re-renders its table on every index change, replacing the element and
 * wiping our handles, so a MutationObserver re-decorates (and re-applies the
 * stored widths) after each redraw. Our own DOM edits are ignored via a marker
 * dataset flag so the observer never loops.
 */
function setupDataviewColumnResize(
	view: HomeView,
	card: DashboardCard,
	cfg: NonNullable<DashboardCard["dataview"]>,
	host: HTMLElement,
	component: Component,
): void {
	const persist = () => void view.plugin.saveData(view.plugin.settings);
	const decorate = () => {
		const table = host.querySelector<HTMLTableElement>("table");
		if (!table || table.dataset.hearthDvResize === "1") return;
		decorateDataviewTable(card, cfg, table, persist);
	};
	const observer = new MutationObserver(() => decorate());
	observer.observe(host, { childList: true, subtree: true });
	component.register(() => observer.disconnect());
	decorate();
}


/** Read a Dataview table's header cells (thead, falling back to the first row). */
function dataviewHeaderCells(table: HTMLTableElement): HTMLTableCellElement[] {
	const thead = Array.from(
		table.querySelectorAll<HTMLTableCellElement>(":scope > thead > tr > th"),
	);
	if (thead.length) return thead;
	const firstRow = table.querySelector<HTMLTableRowElement>(
		":scope > thead > tr, :scope > tbody > tr, :scope > tr",
	);
	return firstRow ? Array.from(firstRow.cells) : [];
}


/** Ensure a `<colgroup>` at the front of `table` with `count` sized `<col>`s. */
function dataviewColgroup(table: HTMLTableElement, count: number, widths: number[]): HTMLElement {
	let colgroup = table.querySelector<HTMLElement>(":scope > colgroup.hearth-dv-cols");
	if (!colgroup) {
		colgroup = table.createEl("colgroup", { cls: "hearth-dv-cols" });
		table.insertBefore(colgroup, table.firstChild);
	}
	colgroup.empty();
	for (let i = 0; i < count; i++) {
		const col = colgroup.createEl("col");
		if (widths[i]) col.style.width = `${widths[i]}px`;
	}
	return colgroup;
}


/** Attach resize handles and (re-)apply stored widths to one Dataview table. */
function decorateDataviewTable(
	card: DashboardCard,
	cfg: NonNullable<DashboardCard["dataview"]>,
	table: HTMLTableElement,
	persist: () => void,
): void {
	const headers = dataviewHeaderCells(table);
	if (headers.length === 0) return;
	// Mark before mutating so the observer skips our own edits (no render loop).
	table.dataset.hearthDvResize = "1";
	const colCount = headers.length;

	// Stored widths only apply when they still match the table's shape; a query
	// that changed its column count drops the stale layout back to auto-fit.
	let widths: number[] | null =
		cfg.columnWidths && cfg.columnWidths.length === colCount ? [...cfg.columnWidths] : null;
	if (cfg.columnWidths && cfg.columnWidths.length !== colCount) {
		cfg.columnWidths = undefined;
		persist();
	}

	const applyManualLayout = () => {
		// The .hearth-dv-manual class carries `table-layout: fixed; width: auto`
		// so the per-column <col> widths below are honoured exactly.
		table.classList.add("hearth-dv-manual");
		dataviewColgroup(table, colCount, widths ?? []);
	};
	if (widths) applyManualLayout();

	headers.forEach((th, index) => {
		th.classList.add("hearth-dv-th");
		const handle = th.createDiv("hearth-dv-col-resizer");
		// Swallow the click so grabbing the handle never toggles Dataview's
		// column sort (which lives on the header cell's click).
		handle.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		handle.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			// First drag: freeze the columns' current auto widths, then switch to a
			// fixed layout so the drag adjusts one column predictably.
			if (!widths) {
				widths = headers.map((cell) => Math.round(cell.getBoundingClientRect().width));
				applyManualLayout();
			}
			const cols = Array.from(
				table.querySelectorAll<HTMLElement>(":scope > colgroup.hearth-dv-cols > col"),
			);
			const startX = e.clientX;
			const startW = widths[index];
			// Suppress text selection for the duration of the drag via a body
			// class (no inline styles). Captured once so a popout window's body
			// is toggled, not the main document's.
			const dragDoc = activeDocument;
			handle.addClass("is-dragging");
			dragDoc.body.addClass("hearth-dv-resizing");
			const onMove = (ev: PointerEvent) => {
				const w = Math.max(40, startW + (ev.clientX - startX));
				widths![index] = w;
				if (cols[index]) cols[index].style.width = `${w}px`;
			};
			const onUp = () => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				handle.removeClass("is-dragging");
				dragDoc.body.removeClass("hearth-dv-resizing");
				cfg.columnWidths = widths ? [...widths] : undefined;
				persist();
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		});
	});
}

/** A Dataview query, rendered through the Dataview plugin. Gated on that plugin. */
export const dataviewCard: CardDefinition<"dataview"> = {
	kind: "dataview",
	templates: [
		{
			id: "dataview",
			name: "Dataview query",
			icon: "database",
			build: () => ({ kind: "dataview", title: "Dataview", dataview: {}, w: 6, h: 4 }),
			available: (app) => isDataviewAvailable(app),
		},
	],
	render: (view, card, body, component) => renderDataview(view, card, body, component),
	renderEditor: (container, ctx) => dataviewEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.dataview)
			copy.dataview = {
				...source.dataview,
				columnWidths: source.dataview.columnWidths ? [...source.dataview.columnWidths] : undefined,
			};
	},
	liveness: { mode: "static" },
};
