import {
	App,
	Component,
	debounce,
	getAllTags,
	MarkdownRenderer,
	MarkdownView,
	Menu,
	Modal,
	moment as createMoment,
	Notice,
	setIcon,
	Setting,
	TFile,
	TFolder,
} from "obsidian";
import type { HomeView } from "./view";
import type { BookmarkItem } from "./obsidian-ext";
import {
	ClockConfig,
	CommandItem,
	DashboardCard,
	EmbedView,
	LinkItem,
	TaskDueFilter,
	TaskFilterConfig,
	TaskMeta,
	TaskPriorityLevel,
	TaskSortField,
	TaskSortRule,
	TasksConfig,
} from "./types";
import { evaluate as evaluateCalc } from "./calculator";
import { cachedRates, loadRates } from "./currency";
import { getDataviewApi } from "./dataview";
import { isViewTypeHostable, mountLeafView } from "./leafview";
import { EXCALIDRAW_PLUGIN_ID, iconForFile, isExcalidraw } from "./filetypes";
import { QueryHit, runQuery, searchFileContents } from "./query";
import { confirmAction, makeClickable } from "./ui";
import { parseNaturalDate, formatRelativeDate } from "./dates";
import { t } from "./i18n";

/**
 * moment is bundled with Obsidian, not a direct dependency, so it's imported
 * from "obsidian" rather than the "moment" package. Some toolchains resolve
 * that export's type as `any` (no @types/moment in scope), which would make
 * every call/member-access on it "unsafe" — asserting it to this minimal,
 * explicitly-typed surface (the only bits of the Moment API this file uses)
 * keeps every use provably non-`any` regardless of the toolchain.
 */
interface Moment {
	format(fmt?: string): string;
	clone(): Moment;
	startOf(unit: string): Moment;
	endOf(unit: string): Moment;
	subtract(amount: number, unit: string): Moment;
	add(amount: number, unit: string): Moment;
	day(): number;
	day(value: number): Moment;
	date(): number;
	month(): number;
	year(): number;
	diff(other: Moment, unit?: string): number;
}
interface MomentFn {
	(input?: Date | string): Moment;
	localeData(): { firstDayOfWeek(): number };
}
const moment: MomentFn = createMoment as unknown as MomentFn;

/** Community plugin id for TaskNotes (used by "tasks" cards in TaskNotes mode). */
const TASKNOTES_PLUGIN_ID = "tasknotes";

/** Frontmatter key the Kanban plugin writes on every board note. Used both to
 * auto-detect a board when none is configured and to confirm a chosen file is
 * actually a Kanban board. */
const KANBAN_FRONTMATTER_KEY = "kanban-plugin";

/** Marks the start of the Kanban plugin's trailing settings block
 * (`%% kanban:settings`). Everything from this line to end-of-file is board
 * metadata, not cards, so parsing and card insertion stop here. */
const KANBAN_SETTINGS_RE = /^\s*%%\s*kanban:settings/i;

/** A Kanban board column: its `##` heading text and the line range
 * `[headingLine, endLine)` (endLine exclusive) that holds its cards. */
interface KanbanColumn {
	heading: string;
	headingLine: number;
	endLine: number;
}

/** Render a card's body based on its kind. */
export function renderCardBody(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	switch (card.kind) {
		case "embed":
			renderEmbed(view, card, body, component);
			break;
		case "daily":
			renderDaily(view, card, body, component);
			break;
		case "web":
			renderWeb(card, body, component);
			break;
		case "bookmarks":
			renderBookmarks(view, body);
			break;
		case "favorites":
			renderFavorites(view, body);
			break;
		case "text":
			renderText(view, card, body, component);
			break;
		case "recent":
			renderRecent(view, card, body);
			break;
		case "links":
			renderLinks(view, card, body);
			break;
		case "commands":
			renderCommands(view, card, body);
			break;
		case "clock":
			renderClock(view, card, body, component);
			break;
		case "tasks":
			renderTasks(view, card, body);
			break;
		case "calendar":
			renderCalendar(view, card, body);
			break;
		case "stats":
			renderStats(view, body);
			break;
		case "search":
			renderSavedSearch(view, card, body);
			break;
		case "heatmap":
			renderHeatmap(view, card, body);
			break;
		case "calculator":
			renderCalculator(view, card, body);
			break;
		case "dataview":
			renderDataview(view, card, body, component);
			break;
		case "leaf":
			renderLeaf(view, card, body, component);
			break;
	}
}

// ---- Leaf (hosted plugin side-panel view) -------------------------------

/** A card that hosts another plugin's (or a core) registered side-panel view —
 * a calendar, outline, tag pane, kanban board, and so on — by mounting a
 * detached workspace leaf inside the card body. Beta.
 *
 * The card shows a friendly prompt when it has no view chosen yet, or when the
 * chosen view type isn't registered right now (the plugin that provides it is
 * disabled or uninstalled). Mounting is best-effort: `mountLeafView` never
 * throws, and the hosted leaf's lifecycle is tied to `component`, so it is torn
 * down cleanly on the next redraw or when the dashboard closes. */
function renderLeaf(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const type = card.leafView?.viewType?.trim();
	if (!type) {
		emptyState(body, "layout-panel-left", t().cards.empty.leafPickView);
		return;
	}
	if (!isViewTypeHostable(view.app, type)) {
		emptyState(body, "layout-panel-left", t().cards.empty.leafViewMissing);
		return;
	}

	const host = body.createDiv("hearth-leaf-host");
	// Hosted views are natively interactive and manage their own scrolling, so
	// let them fill the card edge-to-edge like canvas/Excalidraw embeds do.
	body.addClass("hearth-card-body-live");
	if (!mountLeafView(view.app, type, host, component)) {
		host.remove();
		body.removeClass("hearth-card-body-live");
		emptyState(body, "layout-panel-left", t().cards.empty.leafViewMissing);
	}
}

// ---- Dataview query -----------------------------------------------------

/** A card that renders a Dataview query (DQL or DataviewJS) through Dataview's
 * own renderers, so tables, lists and task lists look exactly as they do in a
 * note. Depends on the Dataview community plugin — the "Add card" picker only
 * offers this card when Dataview is installed, and the card shows a friendly
 * prompt if Dataview is later disabled. Dataview attaches its own refreshable
 * renderer to `component`, so results update live as the vault (and Dataview's
 * index) change, without Hearth having to re-run the query. */
function renderDataview(
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

// ---- Query (saved search) ----------------------------------------------

/** A card that runs a saved query (same syntax as the top search bar) and lists
 * the matching files, refreshed on every render. */
function renderSavedSearch(view: HomeView, card: DashboardCard, body: HTMLElement): void {
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

function emptyState(body: HTMLElement, icon: string, text: string): void {
	const empty = body.createDiv("hearth-card-empty");
	setIcon(empty.createDiv("hearth-card-empty-icon"), icon);
	empty.createDiv({ cls: "hearth-card-empty-text", text });
}

// ---- Embed (note / image / base / ...) ---------------------------------

/** Which embed view (0 = primary, 1 = second) each card is currently showing.
 * Transient (not persisted): a WeakMap keyed by the card object so the choice
 * survives body redraws and full view rebuilds — the card objects live in
 * settings and are reused — but resets to the primary when Obsidian reloads. */
const activeEmbedView = new WeakMap<DashboardCard, number>();

/** The resolved views an embed card can switch between: always the primary
 * (`target`/`scale`/`editable`), plus the second view when it carries a target.
 * Cards without a valid second view return a single-element list. */
function embedViews(card: DashboardCard): EmbedView[] {
	const views: EmbedView[] = [
		{ target: card.target, scale: card.scale, editable: card.editable },
	];
	if (card.secondView?.target?.trim()) views.push(card.secondView);
	return views;
}

/** The index of the view a card is currently showing, clamped to the views that
 * still exist (so removing the second view falls back to the primary). */
function activeEmbedIndex(card: DashboardCard): number {
	const count = embedViews(card).length;
	const stored = activeEmbedView.get(card) ?? 0;
	return Math.min(Math.max(0, stored), count - 1);
}

/** The embed view a card is currently showing (the primary unless the user has
 * switched to the second view and it still exists). */
function activeEmbedViewParams(card: DashboardCard): EmbedView {
	return embedViews(card)[activeEmbedIndex(card)];
}

/** Whether the embed view a card is currently showing is edited in place. Used
 * by the body watcher to decide whether a modify event should redraw. */
export function activeEmbedViewEditable(card: DashboardCard): boolean {
	return !!activeEmbedViewParams(card).editable;
}

function renderEmbed(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const active = activeEmbedViewParams(card);
	const target = active.target?.trim();
	if (!target) {
		emptyState(body, "file-plus", t().cards.empty.embedPickFile);
		return;
	}
	const file = view.app.vault.getAbstractFileByPath(target);
	if (!(file instanceof TFile)) {
		emptyState(body, "file-x", `Not found: ${target}`);
		return;
	}

	// Bases (.base) embeds depend on the core Bases plugin being enabled.
	if (file.extension.toLowerCase() === "base") {
		const bases = view.app.internalPlugins.getPluginById("bases");
		if (!bases?.enabled) {
			emptyState(body, "database", t().cards.empty.embedEnableBases);
			return;
		}
	}

	// Canvas embeds depend on the core Canvas plugin being enabled.
	if (file.extension.toLowerCase() === "canvas") {
		const canvas = view.app.internalPlugins.getPluginById("canvas");
		if (!canvas?.enabled) {
			emptyState(body, "layout-dashboard", t().cards.empty.embedEnableCanvas);
			return;
		}
	}

	// Excalidraw drawings render through the community Excalidraw plugin.
	if (isExcalidraw(file)) {
		if (!view.app.plugins.enabledPlugins.has(EXCALIDRAW_PLUGIN_ID)) {
			emptyState(body, "pen-tool", t().cards.empty.embedInstallExcalidraw);
			return;
		}
	}

	const ext = file.extension.toLowerCase();
	const isMarkdown = ext === "md" || ext === "markdown";
	const excalidraw = isExcalidraw(file);

	// Editable Markdown notes are edited in place rather than rendered read-only.
	if (active.editable && isMarkdown && !excalidraw) {
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	// Optionally hide the embedded Bases view's own toolbar/header (view switcher
	// + filter/property controls) so only the results show. Scoped via a class on
	// the host so it only affects this card's base embed.
	if (ext === "base" && card.hideBaseHeader) host.addClass("hearth-embed-hide-base-header");
	// Optional zoom: scale the rendered content and widen it inversely so it
	// still fills the card width before scaling (the body handles overflow).
	const scale = active.scale && active.scale > 0 ? active.scale : 1;
	if (scale !== 1) {
		host.addClass("is-scaled");
		host.style.setProperty("--hearth-embed-scale", String(scale));
	}

	if (isMarkdown && !excalidraw) {
		// Render the note's actual content so all Markdown (headings, lists,
		// callouts, links…) shows. A bare ![[embed]] only renders a placeholder
		// outside a real Markdown view, which looks empty on the dashboard.
		void renderMarkdownFile(view, file, host, component);
	} else {
		// Images, canvas, .base and Excalidraw go through Obsidian's own
		// transclusion embed, which handles those file types uniformly.
		void MarkdownRenderer.render(view.app, `![[${target}]]`, host, target, component);

		// Canvas and Excalidraw embeds are natively interactive (pan/zoom, and
		// their own in-place edit toggle) — let them fill the card edge-to-edge
		// instead of sitting in a small box inside a scrolling body, so their
		// own pan gestures don't fight the card's scrollbar.
		if (ext === "canvas" || excalidraw) {
			host.addClass("hearth-embed-live");
			body.addClass("hearth-card-body-live");
		}
	}
}

/** A short label for a view's switcher button — the embedded file's basename,
 * or a placeholder when the view has no target yet. */
function embedViewLabel(view: HomeView, ev: EmbedView, index: number): string {
	const target = ev.target?.trim();
	if (!target) return t().cards.embed.viewFallback(index + 1);
	const file = view.app.vault.getAbstractFileByPath(target);
	return file instanceof TFile ? file.basename : target;
}

/**
 * Mount the second-view switcher for an embed card, when it has one. A titled
 * card gets an inline segmented control in its header; an untitled (headerless)
 * card gets a floating control that CSS reveals on hover. Selecting a view
 * records the choice (transiently) and redraws just the card body.
 *
 * `head` is the card's header element (hidden by CSS when untitled) and `redraw`
 * re-renders the body via the same closure the live-refresh watchers use.
 */
export function mountEmbedViewSwitcher(
	view: HomeView,
	card: DashboardCard,
	cardEl: HTMLElement,
	head: HTMLElement,
	redraw: () => void,
): void {
	if (card.kind !== "embed") return;
	const views = embedViews(card);
	if (views.length < 2) return;

	const titled = !!(card.title ?? "").trim();
	const host = titled
		? head.createDiv("hearth-embed-switch is-inline")
		: cardEl.createDiv("hearth-embed-switch is-floating");

	const build = () => {
		host.empty();
		const activeIdx = activeEmbedIndex(card);
		views.forEach((ev, index) => {
			const label = embedViewLabel(view, ev, index);
			const btn = host.createEl("button", { cls: "hearth-embed-switch-btn", text: label });
			btn.toggleClass("is-active", index === activeIdx);
			btn.setAttribute("title", label);
			btn.setAttribute("aria-label", t().cards.embed.switchTo(label));
			// Don't let a click on the switcher start a card drag / bubble to the card.
			btn.addEventListener("pointerdown", (e) => e.stopPropagation());
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (index === activeIdx) return;
				activeEmbedView.set(card, index);
				redraw();
				build();
			});
		});
	};
	build();
}

/** Strip a leading YAML frontmatter block so it isn't rendered as body content. */
function stripFrontmatter(text: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
	return match ? text.slice(match[0].length) : text;
}

/**
 * Make links inside rendered Markdown clickable. Obsidian only resolves link
 * clicks inside a real Markdown view; anchors rendered into a custom container
 * (like a dashboard embed) do nothing on their own. A delegated click listener
 * on the stable host handles internal (wiki) links, external URLs and tags —
 * and keeps working as the content node is re-rendered underneath it.
 */
function wireMarkdownLinks(view: HomeView, host: HTMLElement, sourcePath: string): void {
	host.addEventListener("click", (evt) => {
		const anchor = (evt.target as HTMLElement | null)?.closest("a");
		if (!(anchor instanceof HTMLAnchorElement) || !host.contains(anchor)) return;

		if (anchor.classList.contains("external-link")) {
			const href = anchor.getAttribute("href");
			if (href) {
				evt.preventDefault();
				window.open(href, "_blank");
			}
			return;
		}

		if (anchor.classList.contains("tag")) {
			const tag = anchor.getAttribute("href");
			if (tag) {
				evt.preventDefault();
				const search = view.app.internalPlugins.getPluginById("global-search");
				const instance = search?.instance as
					| { openGlobalSearch?: (query: string) => void }
					| undefined;
				instance?.openGlobalSearch?.(`tag:${tag}`);
			}
			return;
		}

		if (anchor.classList.contains("internal-link")) {
			const linktext = anchor.getAttribute("data-href") || anchor.getAttribute("href");
			if (linktext) {
				evt.preventDefault();
				void view.app.workspace.openLinkText(linktext, sourcePath, true);
			}
		}
	});
}

/** Render a Markdown file's real content (not a transclusion placeholder). */
async function renderMarkdownFile(
	view: HomeView,
	file: TFile,
	host: HTMLElement,
	component: Component,
): Promise<void> {
	const raw = await view.app.vault.cachedRead(file);
	await MarkdownRenderer.render(view.app, stripFrontmatter(raw), host, file.path, component);
	wireMarkdownLinks(view, host, file.path);
}

/**
 * "Live mode" editable embed: shows the note rendered as Markdown and swaps to a
 * raw editor on double-click (Obsidian doesn't expose a true Live Preview editor
 * for arbitrary containers). Saves back to the vault and stays in sync with
 * external edits without ever interrupting typing.
 */
function renderEditableEmbed(
	view: HomeView,
	file: TFile,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	body.addClass("is-jot-host");
	const preview = wrap.createDiv("hearth-embed markdown-rendered hearth-jot-preview");
	preview.setAttribute("title", t().cards.embed.editHint);
	wireMarkdownLinks(view, preview, file.path);
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-embed-edit hearth-jot-edit",
		attr: { placeholder: t().cards.embed.emptyNotePlaceholder },
	});
	area.hide();

	// `saving` guards against reacting to our own writes; `editing` tracks whether
	// the raw editor is open; `lastSaved` is the content we last wrote so a
	// no-op leave doesn't trigger a redundant write (and modify event).
	let saving = false;
	let editing = false;
	let lastSaved: string | null = null;
	let previewChild: Component | null = null;
	// Monotonic token so overlapping renders (e.g. leaveEdit + a modify event
	// firing together) can't clobber each other. Only the latest render creates
	// a component and touches the DOM; stale in-flight renders bail out. Without
	// this, an earlier render could finish against a component that a later
	// render already unloaded, which drops async content like fenced code blocks.
	let renderToken = 0;

	const renderPreview = () => {
		const token = ++renderToken;
		if (previewChild) {
			component.removeChild(previewChild);
			previewChild = null;
		}
		void view.app.vault.cachedRead(file).then((raw) => {
			// A newer render superseded this one — leave the DOM to the winner.
			if (token !== renderToken) return;
			// The card was torn down while we were reading — don't render into a
			// detached node.
			if (!preview.isConnected) return;
			preview.empty();
			const md = stripFrontmatter(raw);
			if (!md.trim()) {
				preview.addClass("is-empty");
				preview.setText(t().cards.embed.emptyNoteHint);
				return;
			}
			preview.removeClass("is-empty");
			// Render into a FRESH child node each time rather than into `preview`
			// itself. Some third-party code-block processors dedupe re-renders by
			// the block's parent element — e.g. Numerals keeps a
			// WeakMap<parentEl, source> and, on seeing the same source under the
			// same parent, removes the block instead of rendering it. Reusing
			// `preview` (we only empty() it) kept the parent identical across
			// renders, so leaving raw edit made the math block dedupe itself away
			// until an unrelated full re-render built a new preview node. A new
			// content node per render gives each block a fresh parent.
			const content = preview.createDiv("markdown-rendered");
			previewChild = new Component();
			component.addChild(previewChild);
			void MarkdownRenderer.render(view.app, md, content, file.path, previewChild);
		});
	};

	const flush = () => {
		// Nothing changed since our last write — skip it, so a bare
		// double-click-then-leave doesn't fire a self-modify event that races
		// the leaveEdit re-render.
		if (lastSaved !== null && area.value === lastSaved) return;
		const current = view.app.vault.getAbstractFileByPath(file.path);
		if (current instanceof TFile) {
			saving = true;
			lastSaved = area.value;
			void view.app.vault.modify(current, area.value).finally(() => {
				saving = false;
			});
		}
	};

	const enterEdit = () => {
		void view.app.vault.read(file).then((content) => {
			area.value = content;
			lastSaved = content;
			editing = true;
			preview.hide();
			area.show();
			area.focus();
		});
	};
	const leaveEdit = () => {
		flush();
		editing = false;
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);
	area.addEventListener("input", debounce(flush, 500, true));
	area.addEventListener("blur", leaveEdit);

	// Reflect external edits when we aren't the one writing: re-render the preview,
	// or (if editing but not focused) refresh the buffer without yanking the cursor.
	component.registerEvent(
		view.app.vault.on("modify", (changed) => {
			if (changed.path !== file.path || saving) return;
			if (editing) {
				if (area.ownerDocument.activeElement !== area) {
					void view.app.vault.read(file).then((content) => {
						area.value = content;
						lastSaved = content;
					});
				}
			} else {
				renderPreview();
			}
		}),
	);

	renderPreview();
}

// ---- Daily note (today) -------------------------------------------------

interface DailyNotesOptions {
	/** moment.js date format, e.g. "YYYY-MM-DD". */
	format?: string;
	/** Folder daily notes live in. */
	folder?: string;
	/** Vault path of the template applied to new daily notes. */
	template?: string;
}

/** The core Daily notes plugin's options, or null if it's disabled. Shared by
 * every card that resolves a daily-note path (daily, calendar, stats). */
function dailyNotesOptions(view: HomeView): DailyNotesOptions | null {
	const plugin = view.app.internalPlugins.getPluginById("daily-notes");
	if (!plugin?.enabled) return null;
	return (plugin.instance as { options?: DailyNotesOptions } | undefined)?.options ?? {};
}

/** Resolve the daily-note path for an arbitrary date from the core Daily
 * notes plugin settings. */
function dailyNotePath(date: Moment, options: DailyNotesOptions): string {
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	const folder = (options.folder || "").trim().replace(/^\/+|\/+$/g, "");
	return `${folder ? `${folder}/` : ""}${date.format(format)}.md`;
}

function todaysDailyNotePath(options: DailyNotesOptions): string {
	return dailyNotePath(moment(), options);
}

/**
 * Embed today's daily note, resolved fresh on every render so the card always
 * tracks the current day. Falls back to a "create today's note" prompt when the
 * note doesn't exist yet, and respects the per-card editable toggle.
 */
function renderDaily(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar", t().cards.empty.dailyEnable);
		return;
	}

	const path = todaysDailyNotePath(options);
	const file = view.app.vault.getAbstractFileByPath(path);

	if (!(file instanceof TFile)) {
		const empty = body.createDiv("hearth-card-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "calendar-plus");
		empty.createDiv({ cls: "hearth-card-empty-text", text: t().cards.daily.noNoteYet });
		const create = empty.createEl("button", {
			cls: "hearth-daily-create",
			text: t().cards.daily.createToday,
		});
		create.addEventListener("click", () => {
			// The core "Open today's daily note" command creates it from the
			// configured template and opens it.
			if (!view.app.commands.executeCommandById("daily-notes")) {
				new Notice(t().notices.couldNotOpenDaily);
			}
		});
		return;
	}

	// Optional button to open today's note in the editor (hideable). Rendered
	// as a floating overlay on the card element (not the body) so it doesn't
	// affect the body's scroll/flow.
	if (card.showOpenButton !== false) {
		const cardEl = body.closest(".hearth-card");
		const overlay = (cardEl ?? body).createDiv("hearth-card-actions-overlay");
		const open = overlay.createEl("button", {
			cls: "hearth-open-btn",
			attr: { "aria-label": t().cards.daily.openToday },
		});
		setIcon(open, "square-pen");
		open.addEventListener("click", () => {
			void view.app.workspace.getLeaf(true).openFile(file);
		});
	}

	if (card.editable) {
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	void renderMarkdownFile(view, file, host, component);
}

/** The vault path an embed/daily card currently tracks, used to refresh the card
 * live when that file changes. Returns null when there's nothing to watch. */
export function watchedCardPath(view: HomeView, card: DashboardCard): string | null {
	// Track the view the card is currently showing, so switching to the second
	// view live-refreshes on that file's changes (and back again).
	if (card.kind === "embed") return activeEmbedViewParams(card).target?.trim() || null;
	if (card.kind === "daily") {
		const options = dailyNotesOptions(view);
		if (!options) return null;
		return todaysDailyNotePath(options);
	}
	return null;
}

// ---- Mini calendar -------------------------------------------------------

/** A month grid resolved against the core Daily notes plugin's format/folder:
 * dots mark days with an existing note, clicking one opens it, clicking
 * today when it doesn't exist yet safely falls back to the core "Open
 * today's daily note" command (template-aware). Other empty days are left
 * alone rather than guessing at template handling for arbitrary dates. */
function renderCalendar(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar-days", t().cards.empty.dailyEnable);
		return;
	}

	const cfg = card.calendar ?? {};
	const wrap = body.createDiv("hearth-calendar");
	// Activity counts are only needed for the heatmap tint.
	const activity = cfg.heatmap ? activityByDay(view.app, cfg.heatmapMetric ?? "modified") : null;
	let cursor: Moment = moment().startOf("month");

	const draw = () => {
		wrap.empty();
		renderCalendarHead(wrap, cursor, {
			onPrev: () => {
				cursor = cursor.clone().subtract(1, "month");
				draw();
			},
			onNext: () => {
				cursor = cursor.clone().add(1, "month");
				draw();
			},
			onToday: () => {
				cursor = moment().startOf("month");
				draw();
			},
		});
		renderCalendarGrid(view, wrap, cursor, options, cfg, activity);
	};
	draw();
}

function renderCalendarHead(
	wrap: HTMLElement,
	cursor: Moment,
	handlers: { onPrev: () => void; onNext: () => void; onToday: () => void },
): void {
	const head = wrap.createDiv("hearth-calendar-head");
	const prev = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": t().cards.calendar.previousMonth } });
	setIcon(prev, "chevron-left");
	prev.addEventListener("click", handlers.onPrev);

	const label = head.createDiv({ cls: "hearth-calendar-label", text: cursor.format("MMMM YYYY") });
	label.setAttribute("title", t().cards.calendar.backToToday);
	label.addEventListener("click", handlers.onToday);

	const next = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": t().cards.calendar.nextMonth } });
	setIcon(next, "chevron-right");
	next.addEventListener("click", handlers.onNext);
}

function renderCalendarGrid(
	view: HomeView,
	wrap: HTMLElement,
	cursor: Moment,
	options: DailyNotesOptions,
	cfg: NonNullable<DashboardCard["calendar"]>,
	activity: Map<string, number> | null,
): void {
	const grid = wrap.createDiv("hearth-calendar-grid");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const weekNumbers = cfg.showWeekNumbers === true;
	if (weekNumbers) {
		// One extra leading column for the week number.
		grid.addClass("has-week-numbers");
		grid.createDiv({ cls: "hearth-calendar-dow hearth-calendar-wk", text: "wk" });
	}

	for (let i = 0; i < 7; i++) {
		const dow = (startOfWeek + i) % 7;
		grid.createDiv({ cls: "hearth-calendar-dow", text: moment().day(dow).format("dd") });
	}

	const monthStart = cursor.clone().startOf("month");
	const monthEnd = cursor.clone().endOf("month");
	const gridStart = monthStart.clone().subtract((monthStart.day() - startOfWeek + 7) % 7, "days");
	const totalCells = Math.ceil((monthEnd.diff(gridStart, "days") + 1) / 7) * 7;

	// Highest edit count in the visible range, so the heatmap tint is relative.
	let peak = 1;
	if (activity) {
		for (let i = 0; i < totalCells; i++) {
			const key = gridStart.clone().add(i, "days").format("YYYY-MM-DD");
			peak = Math.max(peak, activity.get(key) ?? 0);
		}
	}

	const today: string = moment().format("YYYY-MM-DD");
	for (let i = 0; i < totalCells; i++) {
		const day = gridStart.clone().add(i, "days");
		if (weekNumbers && i % 7 === 0) {
			grid.createDiv({ cls: "hearth-calendar-wk", text: day.format("W") });
		}
		const path = dailyNotePath(day, options);
		const file = view.app.vault.getAbstractFileByPath(path);
		const isToday = day.format("YYYY-MM-DD") === today;

		const cell = grid.createDiv("hearth-calendar-day");
		cell.toggleClass("is-outside", day.month() !== cursor.month());
		cell.toggleClass("is-today", isToday);
		cell.toggleClass("has-note", file instanceof TFile);
		if (activity) {
			const count = activity.get(day.format("YYYY-MM-DD")) ?? 0;
			cell.style.setProperty("--heat", count > 0 ? String(heatLevel(count, peak)) : "0");
			cell.toggleClass("has-heat", count > 0);
			cell.setAttribute("aria-label", t().cards.calendar.dayEdited(day.format("MMM D"), count));
		}
		cell.createDiv({ cls: "hearth-calendar-daynum", text: String(day.date()) });
		if (file instanceof TFile) cell.createDiv("hearth-calendar-dot");

		const activate = () => {
			if (file instanceof TFile) {
				void view.app.workspace.getLeaf(true).openFile(file);
			} else if (isToday) {
				if (!view.app.commands.executeCommandById("daily-notes")) {
					new Notice(t().notices.couldNotOpenDaily);
				}
			} else {
				// Offer to create the missing daily note for that day.
				void createDailyNoteAt(view, day, options).then((created) => {
					if (created) void view.app.workspace.getLeaf(true).openFile(created);
					else new Notice(t().notices.couldNotCreateNoteForDay(day.format("MMM D, YYYY")));
				});
			}
		};
		cell.addEventListener("click", activate);
		makeClickable(cell, activate, day.format("MMMM D, YYYY"));
	}
}

/** Bucket an edit count into a 1–4 heat level relative to the range peak. */
function heatLevel(count: number, peak: number): number {
	if (count <= 0) return 0;
	return Math.min(4, Math.ceil((count / peak) * 4));
}

/** Create a daily note for `day` at the plugin's configured path (making any
 * missing parent folders), returning the file or null on failure. Applies the
 * core Daily notes template (with the usual {{date}}/{{time}}/{{title}}
 * substitutions) so a note made here matches Obsidian's own defaults. */
async function createDailyNoteAt(
	view: HomeView,
	day: Moment,
	options: DailyNotesOptions,
): Promise<TFile | null> {
	const path = dailyNotePath(day, options);
	const existing = view.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	const folder = path.split("/").slice(0, -1).join("/");
	if (folder && !view.app.vault.getAbstractFileByPath(folder)) {
		try {
			await view.app.vault.createFolder(folder);
		} catch {
			// Folder may have been created concurrently — ignore and try the file.
		}
	}
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	let content = "";
	const templatePath = (options.template || "").trim();
	if (templatePath) {
		const tpl =
			view.app.vault.getAbstractFileByPath(templatePath) ??
			view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				content = applyDailyTemplate(await view.app.vault.read(tpl), day, format);
			} catch {
				content = "";
			}
		}
	}
	try {
		return await view.app.vault.create(path, content);
	} catch {
		return null;
	}
}

/** Substitute the daily-note template variables Obsidian's core plugin supports
 * for an arbitrary date: {{date}}, {{time}}, {{title}} and their {{date:FMT}}/
 * {{time:FMT}} formatted variants. */
function applyDailyTemplate(raw: string, day: Moment, format: string): string {
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, day.format(format))
		.replace(/\{\{\s*time\s*\}\}/gi, day.format("HH:mm"))
		.replace(/\{\{\s*title\s*\}\}/gi, day.format(format));
}

/** Count files edited (or created) per calendar day, keyed by YYYY-MM-DD. Read
 * entirely from the in-memory file stats — no file reads. Shared by the
 * calendar heatmap tint and the activity-heatmap card. */
function activityByDay(app: HomeView["app"], metric: "modified" | "created"): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const ts = metric === "created" ? file.stat.ctime : file.stat.mtime;
		const key: string = moment(new Date(ts)).format("YYYY-MM-DD");
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

// ---- Vault statistics -----------------------------------------------------

/** Cheap vault stats — everything here comes from the already-loaded vault
 * index and metadata cache, never a file read, so it's fast even on large
 * vaults. */
function renderStats(view: HomeView, body: HTMLElement): void {
	const vault = view.app.vault;
	let notes = 0;
	let attachments = 0;
	let folders = 0;
	for (const f of vault.getAllLoadedFiles()) {
		if (f instanceof TFolder) {
			if (f.path !== "/") folders++;
		} else if (f instanceof TFile) {
			if (f.extension.toLowerCase() === "md") notes++;
			else attachments++;
		}
	}

	const tags = new Set<string>();
	for (const file of vault.getMarkdownFiles()) {
		const cache = view.app.metadataCache.getFileCache(file);
		if (!cache) continue;
		for (const t of getAllTags(cache) ?? []) tags.add(t.toLowerCase());
	}

	const grid = body.createDiv("hearth-stats");
	addStat(grid, "file-text", notes, t().cards.stats.notes);
	addStat(grid, "paperclip", attachments, t().cards.stats.attachments);
	addStat(grid, "folder", folders, t().cards.stats.folders);
	addStat(grid, "tag", tags.size, t().cards.stats.tags);

	const streak = dailyNoteStreak(view);
	if (streak !== null) addStat(grid, "flame", streak, t().cards.stats.dayStreak);
}

function addStat(grid: HTMLElement, icon: string, value: number, label: string): void {
	const cell = grid.createDiv("hearth-stat");
	setIcon(cell.createDiv("hearth-stat-icon"), icon);
	cell.createDiv({ cls: "hearth-stat-value", text: String(value) });
	cell.createDiv({ cls: "hearth-stat-label", text: label });
}

/** Consecutive days with an existing daily note, counting back from today —
 * or from yesterday if today's isn't written yet, so an otherwise-unbroken
 * streak doesn't read as zero just because the day isn't over. */
function dailyNoteStreak(view: HomeView): number | null {
	const options = dailyNotesOptions(view);
	if (!options) return null;

	let day: Moment = moment();
	if (!(view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile)) {
		day = day.clone().subtract(1, "day");
	}

	let streak = 0;
	while (view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile) {
		streak++;
		day = day.clone().subtract(1, "day");
		if (streak > 3650) break;
	}
	return streak;
}

// ---- Activity heatmap (GitHub-style) ------------------------------------

/** A contribution-style grid: one square per day for the last N weeks, tinted
 * by how many notes were edited (or created) that day. */
function renderHeatmap(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.heatmap ?? {};
	const metric = cfg.metric ?? "modified";
	const weeks = cfg.weeks && cfg.weeks > 0 ? Math.min(cfg.weeks, 53) : 26;
	const activity = activityByDay(view.app, metric);
	const options = dailyNotesOptions(view);

	const wrap = body.createDiv("hearth-heatmap");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const today = moment().startOf("day");
	const todayKey: string = today.format("YYYY-MM-DD");
	// Start `weeks - 1` weeks back, aligned to the start of that week, so the
	// last column is the current (partial) week.
	let start = today.clone().subtract((weeks - 1) * 7, "days");
	start = start.clone().subtract((start.day() - startOfWeek + 7) % 7, "days");

	// Relative peak over the visible, non-future days.
	let peak = 1;
	for (let i = 0; i < weeks * 7; i++) {
		const key = start.clone().add(i, "days").format("YYYY-MM-DD");
		if (key <= todayKey) peak = Math.max(peak, activity.get(key) ?? 0);
	}

	const grid = wrap.createDiv("hearth-heatmap-grid");
	grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
	// Column-major fill (top-to-bottom, then next week): 7 rows, auto-flow column.
	for (let w = 0; w < weeks; w++) {
		for (let r = 0; r < 7; r++) {
			const day = start.clone().add(w * 7 + r, "days");
			const key: string = day.format("YYYY-MM-DD");
			const cellEl = grid.createDiv("hearth-heatmap-cell");
			if (key > todayKey) {
				cellEl.addClass("is-empty");
				continue;
			}
			const count = activity.get(key) ?? 0;
			cellEl.style.setProperty("--heat", String(heatLevel(count, peak)));
			cellEl.toggleClass("has-heat", count > 0);
			cellEl.setAttribute("aria-label", t().cards.calendar.dayMetric(day.format("MMM D, YYYY"), count, metric));
			cellEl.setAttribute("title", `${day.format("MMM D, YYYY")} · ${count} ${metric}`);
			if (options) {
				const activate = () => {
					void createDailyNoteAt(view, day, options).then((f) => {
						if (f) void view.app.workspace.getLeaf(true).openFile(f);
					});
				};
				cellEl.addEventListener("click", activate);
				makeClickable(cellEl, activate, day.format("MMMM D, YYYY"));
			}
		}
	}

	// A small Less→More legend.
	const legend = wrap.createDiv("hearth-heatmap-legend");
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: t().cards.heatmap.less });
	for (let l = 0; l <= 4; l++) {
		const sq = legend.createDiv("hearth-heatmap-cell");
		sq.style.setProperty("--heat", String(l));
		if (l > 0) sq.addClass("has-heat");
	}
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: t().cards.heatmap.more });
}

// ---- Web / iframe embed -------------------------------------------------

function renderWeb(card: DashboardCard, body: HTMLElement, component: Component): void {
	const url = card.url?.trim();
	if (!url) {
		emptyState(body, "globe", t().cards.empty.webNoUrl);
		return;
	}
	// Only allow http(s) URLs into the iframe.
	if (!/^https?:\/\//i.test(url)) {
		emptyState(body, "globe", "URL must start with http:// or https://");
		return;
	}

	body.addClass("hearth-web-body");
	const frame = body.createEl("iframe", { cls: "hearth-web" });
	frame.setAttribute("src", url);
	frame.setAttribute("loading", "lazy");
	frame.setAttribute("referrerpolicy", "no-referrer");
	// Sandbox keeps embedded pages from reaching into the app while still
	// letting normal sites run their scripts. `allow-same-origin` together with
	// `allow-scripts` is the well-known combination that can let framed content
	// escape the sandbox, so it's opt-in per card ("trusted") rather than the
	// default — most sites render fine without it.
	const tokens = ["allow-scripts", "allow-popups", "allow-forms"];
	if (card.sandboxTrusted) tokens.push("allow-same-origin");
	frame.setAttribute("sandbox", tokens.join(" "));

	// A small always-available "open in browser" button, plus a fallback shown
	// if the frame never loads (e.g. the site refuses framing via
	// X-Frame-Options / CSP, which can't be detected reliably cross-origin).
	const openExternally = () => window.open(url, "_blank");
	const ext = body.createEl("button", {
		cls: "hearth-web-external",
		attr: { "aria-label": t().cards.web.openInBrowser },
	});
	setIcon(ext, "external-link");
	ext.addEventListener("click", openExternally);

	let loaded = false;
	frame.addEventListener("load", () => {
		loaded = true;
		body.removeClass("hearth-web-blocked");
		// A slow but successful load can arrive after the fallback showed — clear it.
		body.querySelector(".hearth-web-fallback")?.remove();
	});
	const timer = window.setTimeout(() => {
		if (loaded) return;
		body.addClass("hearth-web-blocked");
		const fallback = body.createDiv("hearth-web-fallback");
		setIcon(fallback.createDiv("hearth-card-empty-icon"), "globe");
		fallback.createDiv({
			cls: "hearth-card-empty-text",
			text: t().cards.web.mayRefuse,
		});
		const open = fallback.createEl("button", { cls: "hearth-daily-create", text: t().cards.web.openInBrowser });
		open.addEventListener("click", openExternally);
	}, 4000);
	component.register(() => window.clearTimeout(timer));
}

// ---- Bookmarks (Obsidian core) -----------------------------------------

function flattenBookmarks(items: BookmarkItem[], out: BookmarkItem[]): void {
	for (const item of items) {
		if (item.type === "group" && item.items) {
			flattenBookmarks(item.items, out);
		} else {
			out.push(item);
		}
	}
}

function renderBookmarks(view: HomeView, body: HTMLElement): void {
	const plugin = view.app.internalPlugins.getPluginById("bookmarks");
	const instance = plugin?.instance as
		| { getBookmarks?: () => BookmarkItem[] }
		| undefined;

	if (!plugin?.enabled || !instance?.getBookmarks) {
		emptyState(body, "bookmark", t().cards.empty.bookmarksEnable);
		return;
	}

	const items: BookmarkItem[] = [];
	flattenBookmarks(instance.getBookmarks() ?? [], items);

	if (items.length === 0) {
		emptyState(body, "bookmark", t().cards.empty.bookmarksEmpty);
		return;
	}

	const list = body.createDiv("hearth-list");
	for (const item of items) {
		const label =
			item.title ||
			item.path ||
			item.url ||
			item.query ||
			t().cards.bookmarks.untitled;
		const row = list.createDiv("hearth-list-item");
		const iconEl = row.createDiv("hearth-list-icon");
		if (item.type === "url" && item.url) {
			renderFavicon(iconEl, item.url);
		} else {
			const icon =
				item.type === "folder" ? "folder" :
				item.type === "search" ? "search" : "file-text";
			setIcon(iconEl, icon);
		}
		row.createDiv({ cls: "hearth-list-label", text: label });
		const open = () => openBookmark(view, item);
		row.addEventListener("click", open);
		makeClickable(row, open, label);
	}
}

/** Show a site favicon for a URL bookmark, falling back to the globe icon if the
 * URL can't be parsed or the favicon fails to load (e.g. offline). */
function renderFavicon(iconEl: HTMLElement, url: string): void {
	let host: string;
	try {
		host = new URL(url).hostname;
	} catch {
		setIcon(iconEl, "globe");
		return;
	}
	const img = iconEl.createEl("img", { cls: "hearth-favicon" });
	img.setAttribute("loading", "lazy");
	img.setAttribute("referrerpolicy", "no-referrer");
	img.addEventListener("error", () => {
		img.remove();
		setIcon(iconEl, "globe");
	});
	img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function openBookmark(view: HomeView, item: BookmarkItem): void {
	if (item.type === "url" && item.url) {
		window.open(item.url, "_blank");
		return;
	}
	if (item.path) {
		const file = view.app.vault.getAbstractFileByPath(item.path);
		if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
	}
}

// ---- Favorites (curated note cards) ------------------------------------

function renderFavorites(view: HomeView, body: HTMLElement): void {
	const paths = view.plugin.settings.favorites;
	if (!paths.length) {
		emptyState(body, "star", t().cards.empty.favoritesEmpty);
		return;
	}

	const grid = body.createDiv("hearth-favorites");
	for (const path of paths) {
		const file = view.app.vault.getAbstractFileByPath(path);
		const card = grid.createDiv("hearth-fav-card");
		if (file instanceof TFile) {
			setIcon(card.createDiv("hearth-fav-icon"), iconForFile(file));
			card.createDiv({ cls: "hearth-fav-name", text: file.basename });
			const open = () => void view.app.workspace.getLeaf(true).openFile(file);
			card.addEventListener("click", open);
			makeClickable(card, open, file.basename);
		} else {
			card.addClass("is-missing");
			setIcon(card.createDiv("hearth-fav-icon"), "file-x");
			card.createDiv({ cls: "hearth-fav-name", text: path });
		}
	}
}

// ---- Text / jot-down ----------------------------------------------------

function renderText(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	body.addClass("is-jot-host");
	const preview = wrap.createDiv("hearth-jot-preview markdown-rendered");
	preview.setAttribute("title", t().cards.embed.editHint);
	wireMarkdownLinks(view, preview, "");
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-jot-edit",
		attr: { placeholder: t().cards.text.placeholder },
	});
	area.hide();

	const placeholder = t().cards.text.placeholder;
	const renderPreview = () => {
		preview.empty();
		const text = card.text ?? "";
		if (!text.trim()) {
			preview.addClass("is-empty");
			preview.setText(placeholder);
			return;
		}
		preview.removeClass("is-empty");
		// Render the jotted text as Markdown so headings, lists, checkboxes and
		// links all show, just like a note.
		void MarkdownRenderer.render(view.app, text, preview, "", component);
	};

	const enterEdit = () => {
		area.value = card.text ?? "";
		preview.hide();
		area.show();
		area.focus();
	};
	const leaveEdit = () => {
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);

	const save = debounce(
		() => {
			card.text = area.value;
			void view.plugin.saveData(view.plugin.settings);
		},
		500,
		true,
	);
	area.addEventListener("input", save);
	area.addEventListener("blur", () => {
		card.text = area.value;
		void view.plugin.saveData(view.plugin.settings);
		leaveEdit();
	});

	renderPreview();
}

// ---- Calculator ---------------------------------------------------------

/** One key on the on-screen keypad. `insert` is spliced in at the caret; keys
 * with no `insert` carry a named `action` (equals / clear / backspace). */
interface CalcKey {
	label: string;
	insert?: string;
	action?: "equals" | "clear" | "back";
	/** Extra CSS class for accent keys (operators, equals). */
	cls?: string;
}

/** The basic pad: digits and the four operations plus edit keys. */
const CALC_BASIC_KEYS: CalcKey[] = [
	{ label: "C", action: "clear", cls: "is-fn" },
	{ label: "(", insert: "(" },
	{ label: ")", insert: ")" },
	{ label: "⌫", action: "back", cls: "is-fn" },
	{ label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" },
	{ label: "÷", insert: "/", cls: "is-op" },
	{ label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" },
	{ label: "×", insert: "*", cls: "is-op" },
	{ label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" },
	{ label: "−", insert: "-", cls: "is-op" },
	{ label: "0", insert: "0" }, { label: ".", insert: "." },
	{ label: "=", action: "equals", cls: "is-eq" },
	{ label: "+", insert: "+", cls: "is-op" },
];

/** Extra keys prepended for the scientific tier: functions, powers, constants. */
const CALC_SCI_KEYS: CalcKey[] = [
	{ label: "sin", insert: "sin(", cls: "is-fn" },
	{ label: "cos", insert: "cos(", cls: "is-fn" },
	{ label: "tan", insert: "tan(", cls: "is-fn" },
	{ label: "√", insert: "sqrt(", cls: "is-fn" },
	{ label: "ln", insert: "ln(", cls: "is-fn" },
	{ label: "log", insert: "log(", cls: "is-fn" },
	{ label: "xʸ", insert: "^", cls: "is-fn" },
	{ label: "π", insert: "pi", cls: "is-fn" },
	{ label: "e", insert: "e", cls: "is-fn" },
	{ label: "!", insert: "!", cls: "is-fn" },
	{ label: "%", insert: "%", cls: "is-fn" },
	{ label: "mod", insert: " mod ", cls: "is-fn" },
];

/** A free-text calculator: arithmetic, unit/currency conversions and
 * plain-language queries (à la Wolfram Alpha's input box), evaluated live as
 * you type. The on-screen keypad tier is chosen in card settings. */
function renderCalculator(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = (card.calculator ??= {});
	const angleUnit = cfg.angleUnit ?? "deg";

	const wrap = body.createDiv("hearth-calc");

	const input = wrap.createEl("input", {
		cls: "hearth-calc-input",
		attr: {
			type: "text",
			placeholder: t().cards.calculator.placeholder,
			spellcheck: "false",
			"aria-label": t().cards.calculator.placeholder,
		},
	});
	input.value = cfg.lastInput ?? "";

	const resultEl = wrap.createDiv("hearth-calc-result");
	const noteEl = wrap.createDiv("hearth-calc-note");
	const keysEl = wrap.createDiv("hearth-calc-keys");

	// Currency conversions need exchange rates. To stay local-first, rates are
	// only fetched lazily — the first time a query actually needs them (see the
	// error branch in update) — never just because a calculator card exists.
	const currentRates = () => cachedRates()?.rates;
	let triedRates = false;

	const persist = debounce(
		() => void view.plugin.saveData(view.plugin.settings),
		600,
		true,
	);

	// Show the live result of the current input.
	const update = () => {
		const raw = input.value;
		cfg.lastInput = raw;
		if (!raw.trim()) {
			resultEl.setText("");
			resultEl.removeClass("is-error");
			noteEl.setText("");
			persist();
			return;
		}
		const res = evaluateCalc(raw, { angleUnit, rates: currentRates() });
		if (res.ok) {
			resultEl.removeClass("is-error");
			resultEl.setText(res.formatted);
			noteEl.setText(res.note ?? "");
		} else {
			resultEl.addClass("is-error");
			resultEl.setText(res.error ? "…" : "");
			// Surface a currency/rates hint (but not routine "still typing" errors).
			noteEl.setText(/rate|currency/i.test(res.error) ? res.error : "");
			// A currency query needs rates we don't have yet — fetch them once,
			// then re-evaluate so the answer fills in without a manual retry.
			// Skipped entirely when external calls are disabled.
			if (
				!triedRates &&
				!view.plugin.settings.disableExternalCalls &&
				/rate/i.test(res.error) &&
				!currentRates()
			) {
				triedRates = true;
				void loadRates().then((rates) => {
					if (rates) update();
				});
			}
		}
		persist();
	};

	// Enter / "=" just re-evaluates and selects the input so the next query
	// overwrites it (results are already shown live as you type).
	const commit = () => {
		update();
		input.select();
	};

	// The caret, treating a not-yet-focused input as "at the end" — an unfocused
	// text input reports selectionStart 0, not null, so keys would otherwise
	// insert at the start on the first tap after a render with restored text.
	const caret = (): [number, number] => {
		if (activeDocument.activeElement !== input) return [input.value.length, input.value.length];
		return [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
	};

	// Splice text in at the caret (or over the selection) and re-evaluate.
	const insertAtCaret = (text: string) => {
		const [start, end] = caret();
		input.value = input.value.slice(0, start) + text + input.value.slice(end);
		const pos = start + text.length;
		input.setSelectionRange(pos, pos);
		input.focus();
		update();
	};

	const backspace = () => {
		const [start, end] = caret();
		if (start !== end) {
			input.value = input.value.slice(0, start) + input.value.slice(end);
			input.setSelectionRange(start, start);
		} else if (start > 0) {
			input.value = input.value.slice(0, start - 1) + input.value.slice(start);
			input.setSelectionRange(start - 1, start - 1);
		}
		input.focus();
		update();
	};

	const renderKeys = () => {
		keysEl.empty();
		const tier = cfg.keypad ?? "none";
		keysEl.toggleClass("is-hidden", tier === "none");
		if (tier === "none") return;
		const keys = tier === "scientific" ? [...CALC_SCI_KEYS, ...CALC_BASIC_KEYS] : CALC_BASIC_KEYS;
		for (const key of keys) {
			const btn = keysEl.createEl("button", {
				cls: `hearth-calc-key${key.cls ? " " + key.cls : ""}`,
				text: key.label,
				attr: { type: "button" },
			});
			btn.addEventListener("click", () => {
				if (key.action === "equals") commit();
				else if (key.action === "clear") {
					input.value = "";
					input.focus();
					update();
				} else if (key.action === "back") backspace();
				else if (key.insert !== undefined) insertAtCaret(key.insert);
			});
		}
	};

	input.addEventListener("input", update);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			commit();
		}
	});
	// Keep the board's drag/keyboard handlers from stealing typing.
	input.addEventListener("keydown", (e) => e.stopPropagation());

	renderKeys();
	update();
}

// ---- Recent files -------------------------------------------------------

function renderRecent(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const count = card.count && card.count > 0 ? card.count : 8;
	const files = view.app.workspace
		.getLastOpenFiles()
		.map((p) => view.app.vault.getAbstractFileByPath(p))
		.filter((f): f is TFile => f instanceof TFile)
		.slice(0, count);

	if (files.length === 0) {
		emptyState(body, "history", t().cards.empty.recentEmpty);
		return;
	}

	const list = body.createDiv("hearth-list");
	for (const file of files) {
		const row = list.createDiv("hearth-list-item");
		setIcon(row.createDiv("hearth-list-icon"), iconForFile(file));
		row.createDiv({ cls: "hearth-list-label", text: file.basename });
		const open = () => void view.app.workspace.getLeaf(true).openFile(file);
		row.addEventListener("click", open);
		makeClickable(row, open, file.basename);
	}
}

// ---- Links / launchpad --------------------------------------------------

function renderLinks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const links = card.links ?? [];
	if (links.length === 0) {
		emptyState(body, "layout-grid", t().cards.empty.linksEmpty);
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	// Flag the card body so CSS can disable the card drag overlay over tiles in
	// arrange mode (tiles are self-contained widgets with their own resize).
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, link.sizeW, link.sizeH, link.size, baseTile, link.col, link.row);
		setIcon(tile.createDiv("hearth-link-icon"), link.icon || "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		const open = () => openLink(view, link);
		// In arrange mode, clicking a tile must NOT trigger its action — the
		// click is almost always the tail end of a resize/drag gesture.
		if (!view.arrangeMode) {
			tile.addEventListener("click", open);
			makeClickable(tile, open, link.label || link.target);
		}

		// Tiles can only be resized/repositioned while the dashboard is in
		// arrange mode.
		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => link.sizeW, (v) => {
				link.sizeW = v;
			}, () => link.sizeH, (v) => {
				link.sizeH = v;
			}, () => link.size, (v) => {
				link.size = v;
			});
			makeTileDraggable(view, grid, tile, links, link, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}

/** Apply a per-tile size: converts pixel width/height into grid column/row
 * spans (relative to the fine cell size). Each tile is placed on the grid
 * spanning N columns × M rows, so it can independently span multiple rows
 * without its row's height being governed by the tallest tile. When the tile
 * has an explicit free-form position (col/row), it's pinned to that grid line
 * instead of auto-flowing. */
function applyTileSize(
	tile: HTMLElement,
	sizeW: number | undefined,
	sizeH: number | undefined,
	legacySize: number | undefined,
	baseTile: number,
	col?: number,
	row?: number,
): void {
	// Migrate a legacy single `size` into independent width/height on read.
	const w = sizeW ?? legacySize;
	const h = sizeH ?? legacySize;
	// Use the fine cell size for span calculation so sizing is granular.
	const cell = TILE_CELL;
	const rowH = Math.round(TILE_CELL * 0.78);
	const cs = w && w > 0 ? Math.max(1, Math.round(w / cell)) : DEFAULT_TILE_CS;
	const rs = h && h > 0 ? Math.max(1, Math.round(h / rowH)) : DEFAULT_TILE_RS;
	tile.style.setProperty("--hearth-tile-cs", String(cs));
	tile.style.setProperty("--hearth-tile-rs", String(rs));
	applyTileIconOnly(tile, cs, rs);
	// Free-form position: pin to a grid line (1-based). When either is missing
	// the tile auto-flows into the next available cell.
	if (col != null && col > 0) tile.style.setProperty("--hearth-tile-col", String(col));
	else tile.style.removeProperty("--hearth-tile-col");
	if (row != null && row > 0) tile.style.setProperty("--hearth-tile-row", String(row));
	else tile.style.removeProperty("--hearth-tile-row");
}

/** Toggle icon-only mode when a tile is too small to show its label. Below two
 * fine rows there's no vertical room for text, and at a single column there's
 * no horizontal room; in both cases the label ellipsises away to nothing while
 * still reserving its line + gap, which pushes the icon off-centre. Dropping
 * the label (and its gap) then lets the icon sit dead-centre. */
function applyTileIconOnly(tile: HTMLElement, cs: number, rs: number): void {
	tile.toggleClass("is-icon-only", rs <= 1 || cs <= 1);
}

/** Default span for a tile with no explicit size: 2 columns × 2 rows on the
 * fine grid (≈88×68px), matching the visual size of the old 90px default. */
const DEFAULT_TILE_CS = 2;
const DEFAULT_TILE_RS = 2;

/** Fine grid (px) that tile sizes snap to, so tiles align like Android widgets. */
const TILE_GRID = 4;

/** Base cell size (px) for the tile grid. Smaller = finer granularity: a tile
 * can span more columns/rows in smaller steps, so sizing feels precise rather
 * than chunky. Half of the visual default so 2 cells ≈ one old tile. */
const TILE_CELL = 44;

/** Attach a widget-style resize handle to a tile. The handle is a clear,
 * grabbable corner grip (bottom-right) that resizes width and height together
 * on a fine grid. Fully self-contained: stops propagation so the card's drag
 * engine never interferes. */
function makeTileResizable(
	view: HomeView,
	tile: HTMLElement,
	baseTile: number,
	getW: () => number | undefined,
	setW: (size: number | undefined) => void,
	getH: () => number | undefined,
	setH: (size: number | undefined) => void,
	getLegacy: () => number | undefined,
	setLegacy: (size: number | undefined) => void,
): void {
	const handle = tile.createDiv("hearth-tile-resize");
	handle.setAttribute("aria-hidden", "true");

	const stop = (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	let resizing = false;
	let startW = 0;
	let startH = 0;
	let startX = 0;
	let startY = 0;

	handle.addEventListener("pointerdown", (e) => {
		stop(e);
		resizing = true;
		// Seed from legacy `size` (which used to drive both axes) so a tile
		// resized before this split still starts from its stored footprint.
		const legacy = getLegacy();
		startW = getW() ?? legacy ?? baseTile;
		if (legacy != null && getW() == null) setW(legacy);
		startH = getH() ?? legacy ?? Math.round(baseTile * 0.78);
		if (legacy != null && getH() == null) setH(legacy);
		startX = e.clientX;
		startY = e.clientY;
		handle.setPointerCapture(e.pointerId);
		tile.addClass("is-tile-resizing");
		tile.closest(".hearth-card")?.addClass("has-tile-gesture");
	});

	handle.addEventListener("pointermove", (e) => {
		if (!resizing) return;
		e.preventDefault();
		e.stopPropagation();
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		// Snap to the fine grid so tiles stay aligned like widgets.
		const w = Math.max(TILE_CELL, Math.min(480, snap(startW + dx, TILE_GRID)));
		const h = Math.max(34, Math.min(480, snap(startH + dy, TILE_GRID)));
		setW(w === baseTile ? undefined : w);
		setH(h === Math.round(baseTile * 0.78) ? undefined : h);
		setLegacy(undefined);
		// Convert live pixel size to grid spans using the fine cell size so
		// the tile grows in small, precise steps.
		const cell = TILE_CELL;
		const rowH = Math.round(TILE_CELL * 0.78);
		const cs = Math.max(1, Math.round(w / cell));
		const rs = Math.max(1, Math.round(h / rowH));
		tile.style.setProperty("--hearth-tile-cs", String(cs));
		tile.style.setProperty("--hearth-tile-rs", String(rs));
		applyTileIconOnly(tile, cs, rs);
	});

	const end = (e: PointerEvent) => {
		if (!resizing) return;
		resizing = false;
		try {
			handle.releasePointerCapture(e.pointerId);
		} catch {
			// pointer already released
		}
		tile.removeClass("is-tile-resizing");
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		void view.plugin.saveData(view.plugin.settings);
	};
	handle.addEventListener("pointerup", end);
	handle.addEventListener("pointercancel", end);
}

/** Snap a value to the nearest multiple of `grid`. */
function snap(value: number, grid: number): number {
	return Math.round(value / grid) * grid;
}

/** Make a tile draggable (to reposition it within its card) in arrange mode.
 *  Uses pointer events (not HTML5 DnD) so it coexists with the resize handle
 *  and doesn't trigger the card's drag engine.
 *
 *  Two modes:
 *  - Free-form (default, `autoFlow = false`): the tile floats under the
 *    pointer and lands on the cell under it on drop. Tiles may overlap and
 *    be placed anywhere; siblings never move. Overlapping tiles are flagged
 *    with a glow (see `markOverlappingTiles`) so a hidden tile is visible.
 *  - Auto-shift (beta, `autoFlow = true`): a dashed placeholder occupies the
 *    target slot and siblings swap aside live (phone-widget style). See
 *    `makeTileAutoFlowDrag`. */
function makeTileDraggable<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	items: T[],
	item: T,
	autoFlow: boolean,
): void {
	if (autoFlow) {
		makeTileAutoFlowDrag(view, container, tile, item);
	} else {
		makeTileFreeFormDrag(view, container, tile, item);
	}
	tile.setAttribute("data-tile-id", item.id);
	// Double-click a pinned tile to clear its position and let it auto-flow.
	if (item.col != null || item.row != null) {
		tile.addEventListener("dblclick", (e) => {
			e.stopPropagation();
			delete item.col;
			delete item.row;
			void view.plugin.saveData(view.plugin.settings);
			view.render();
		});
	}
}

/** Free-form drag: the tile floats under the pointer via a transform (delta
 *  from the grab point) and lands on whatever cell the pointer is over on
 *  drop. Siblings don't move; tiles may overlap. A dashed ghost outline
 *  follows the pointer so the drop target is visible. Overlapping tiles glow
 *  so a hidden tile stays visible (an undesirable state worth flagging).
 *  Using a transform (not absolute positioning) avoids any offset/jump —
 *  the tile simply translates by the pointer delta from its grid slot. */
function makeTileFreeFormDrag<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;
	// Dashed ghost showing the drop target cell under the pointer.
	let ghost: HTMLElement | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Insert a dashed ghost outline that will follow the pointer.
			ghost = container.createDiv("hearth-tile-ghost");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS);
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || String(DEFAULT_TILE_RS);
			ghost.style.setProperty("--hearth-tile-cs", cs);
			ghost.style.setProperty("--hearth-tile-rs", rs);
		}
		// Float the tile by the pointer delta — no position/size changes, so
		// there's no offset or jump. The grid slot stays reserved.
		tile.setCssStyles({ transform: `translate(${dx}px, ${dy}px)` });
		// Move the ghost outline to the cell under the pointer.
		if (ghost) {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile);
			if (cell) {
				ghost.style.setProperty("--hearth-tile-col", String(cell.col));
				ghost.style.setProperty("--hearth-tile-row", String(cell.row));
			}
		}
		// Live-flag tiles the dragged tile is covering so overlaps are visible
		// as it moves (the dragged tile is on top and ignored by the marker).
		markOverlappingTiles(container);
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		if (ghost) {
			ghost.remove();
			ghost = null;
		}
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		// Drop on the cell under the pointer (free-form; may overlap others).
		const cell = pickGridCell(container, e.clientX, e.clientY, tile);
		if (cell) {
			item.col = cell.col;
			item.row = cell.row;
		}
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}

/** Auto-shift drag (beta): a dashed placeholder occupies the dragged tile's
 *  target slot and siblings swap aside live, like phone widgets. On drop,
 *  only the dragged tile's `col`/`row` is persisted; siblings revert to
 *  their stored positions (a full re-render follows), so a tile that was
 *  shoved aside comes back if its slot wasn't taken. */
function makeTileAutoFlowDrag<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;

	// The tile's offset within the container at drag start, so we can position
	// it absolutely without a jump (delta-based movement).
	let baseLeft = 0;
	let baseTop = 0;
	let baseWidth = 0;
	let baseHeight = 0;

	let placeholder: HTMLElement | null = null;
	let placeholderPos: { col: number; row: number } | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Measure the tile's position relative to the container BEFORE
			// removing it from flow, so we can place it absolutely at the
			// same spot (then move by the pointer delta — no jump).
			const rect = tile.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			baseLeft = rect.left - containerRect.left;
			baseTop = rect.top - containerRect.top;
			baseWidth = rect.width;
			baseHeight = rect.height;
			placeholderPos = getTileCell(tile, container) ?? {
				col: item.col ?? 1,
				row: item.row ?? 1,
			};
			placeholder = container.createDiv("hearth-tile-placeholder");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS);
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || String(DEFAULT_TILE_RS);
			placeholder.style.setProperty("--hearth-tile-cs", cs);
			placeholder.style.setProperty("--hearth-tile-rs", rs);
			placeholder.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
			placeholder.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
			// Freeze every sibling tile to its current cell so a swap with the
			// placeholder moves exactly one tile.
			const siblings = Array.from(
				container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
			);
			for (const sib of siblings) {
				if (sib === tile) continue;
				const cell = getTileCell(sib, container);
				if (cell) {
					sib.style.setProperty("--hearth-tile-col", String(cell.col));
					sib.style.setProperty("--hearth-tile-row", String(cell.row));
				}
			}
			// Take the tile out of flow and immediately pin it to its current
			// spot so it doesn't jump before the first delta is applied.
			tile.setCssStyles({
				position: "absolute",
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				left: `${baseLeft}px`,
				top: `${baseTop}px`,
			});
		}
		// Move by the pointer delta from the grab point — no offset issues.
		tile.setCssStyles({
			position: "absolute",
			width: `${baseWidth}px`,
			height: `${baseHeight}px`,
			left: `${baseLeft + dx}px`,
			top: `${baseTop + dy}px`,
		});
		if (!placeholder || !placeholderPos) return;
		const other = findTileUnderPointer(container, e.clientX, e.clientY, tile);
		if (other) {
			const otherPos = getTileCell(other, container);
			if (otherPos) {
				other.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
				other.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
				placeholder.style.setProperty("--hearth-tile-col", String(otherPos.col));
				placeholder.style.setProperty("--hearth-tile-row", String(otherPos.row));
				placeholderPos = otherPos;
			}
		} else {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile);
			if (cell) {
				placeholder.style.setProperty("--hearth-tile-col", String(cell.col));
				placeholder.style.setProperty("--hearth-tile-row", String(cell.row));
				placeholderPos = cell;
			}
		}
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		const dropPos = placeholderPos;
		if (placeholder) {
			placeholder.remove();
			placeholder = null;
		}
		const siblings = Array.from(
			container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
		);
		for (const sib of siblings) {
			if (sib === tile) continue;
			sib.style.removeProperty("--hearth-tile-col");
			sib.style.removeProperty("--hearth-tile-row");
		}
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		if (dropPos) {
			item.col = dropPos.col;
			item.row = dropPos.row;
		}
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}

/** Mark tiles that are obscured behind another tile in the same card, so the
 *  user can see (and fix) the undesirable overlap. A tile counts as obscured
 *  when another sibling tile's rect covers a meaningful part of it. The
 *  actively-dragged tile is skipped (it's on top, so it can't be "obscured"),
 *  but a tile it covers IS flagged. Only runs in arrange mode. */
function markOverlappingTiles(container: HTMLElement): void {
	const tiles = Array.from(container.querySelectorAll<HTMLElement>(".hearth-link-tile"));
	for (const t of tiles) t.removeClass("is-obscured");
	const rects = tiles.map((t) => ({
		t,
		r: t.getBoundingClientRect(),
		dragging: t.classList.contains("is-tile-dragging"),
	}));
	for (let i = 0; i < rects.length; i++) {
		const a = rects[i];
		if (a.dragging) continue; // the dragged tile floats on top — never obscured
		// A tile is obscured if any other tile (drawn later, i.e. on top in
		// DOM order, or the floating dragged tile) overlaps more than a sliver
		// of its area.
		for (let j = i + 1; j < rects.length; j++) {
			const b = rects[j];
			const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
			const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
			const overlap = ix * iy;
			const aArea = a.r.width * a.r.height;
			// Flag `a` (the lower-DOM, i.e. underneath) tile when `b` covers
			// more than 15% of it.
			if (aArea > 0 && overlap / aArea > 0.15) {
				a.t.addClass("is-obscured");
			}
		}
	}
}

/** Read a tile's current grid cell from the DOM. Prefers the inline
 *  `--hearth-tile-col/row` (set for pinned tiles), falling back to the tile's
 *  rendered position mapped onto the grid's metrics. Returns null when the
 *  metrics can't be measured reliably. */
function getTileCell(
	tile: HTMLElement,
	container: HTMLElement,
): { col: number; row: number } | null {
	const colAttr = tile.style.getPropertyValue("--hearth-tile-col");
	const rowAttr = tile.style.getPropertyValue("--hearth-tile-row");
	if (colAttr && rowAttr) {
		const col = parseInt(colAttr, 10);
		const row = parseInt(rowAttr, 10);
		if (Number.isFinite(col) && Number.isFinite(row)) return { col, row };
	}
	const rect = tile.getBoundingClientRect();
	const cRect = container.getBoundingClientRect();
	if (cRect.width <= 0) return null;
	const gap = 6;
	const columns = Math.max(1, Math.floor((cRect.width + gap) / (TILE_CELL + gap)));
	const colW = (cRect.width - (columns - 1) * gap) / columns;
	const rowH = Math.round(TILE_CELL * 0.78);
	const relX = rect.left - cRect.left;
	const relY = rect.top - cRect.top;
	const col = Math.max(1, Math.round(relX / (colW + gap)) + 1);
	const row = Math.max(1, Math.round(relY / (rowH + gap)) + 1);
	return { col, row };
}

/** Find the `.hearth-link-tile` under a pointer, excluding the dragged tile
 *  (and anything inside it, like its resize handle). The dragged tile has
 *  pointer-events: none while dragging, so elementFromPoint already skips it,
 *  but we also guard against its descendants in case a child overrides. */
function findTileUnderPointer(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	except: HTMLElement,
): HTMLElement | null {
	const el = activeDocument.elementFromPoint(clientX, clientY) as HTMLElement | null;
	if (!el) return null;
	if (except.contains(el)) return null;
	const tile = el.closest<HTMLElement>(".hearth-link-tile");
	if (!tile || tile === except || !container.contains(tile)) return null;
	return tile;
}

/** Work out the (col, row) grid cell under a pointer, relative to the card's
 *  tile grid. `container` is the `.hearth-links` grid element. Returns null
 *  when the metrics can't be measured reliably. Clamps to the grid's bounds
 *  so a tile dropped near the edge lands on the last valid cell, not off-board.
 *  `tile` is the dragged element (its span is used so the drop keeps the tile
 *  fully inside the grid — the column count limits the start column). */
function pickGridCell(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	tile: HTMLElement,
): { col: number; row: number } | null {
	const rect = container.getBoundingClientRect();
	if (rect.width <= 0) return null;
	const gap = 6;
	// auto-fill column count at the current card width (matches the CSS
	// `repeat(auto-fill, minmax(44px, 1fr))` grid).
	const columns = Math.max(1, Math.floor((rect.width + gap) / (TILE_CELL + gap)));
	// Actual column width (the 1fr columns expand past the 44px minimum, so
	// use the real width to map the pointer to a column line).
	const colW = (rect.width - (columns - 1) * gap) / columns;
	// The dragged tile's column span, so we keep its start within bounds.
	const cs = parseInt(
		tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS),
		10,
	) || DEFAULT_TILE_CS;
	const rowH = Math.round(TILE_CELL * 0.78);
	// Pointer relative to the grid's content box, in cells (1-based lines).
	const relX = clientX - rect.left;
	const relY = clientY - rect.top;
	let col = Math.round(relX / (colW + gap)) + 1;
	let row = Math.round(relY / (rowH + gap)) + 1;
	col = Math.max(1, Math.min(col, Math.max(1, columns - cs + 1)));
	row = Math.max(1, row);
	return { col, row };
}

function openLink(view: HomeView, link: LinkItem): void {
	switch (link.type) {
		case "url":
			if (link.target) window.open(link.target, "_blank");
			break;
		case "command":
			if (link.target) view.app.commands.executeCommandById(link.target);
			break;
		case "note": {
			const file = view.app.vault.getAbstractFileByPath(link.target);
			if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
			else if (link.target) void view.app.workspace.openLinkText(link.target, "", true);
			break;
		}
	}
}

// ---- Commands / command palette tiles -----------------------------------

function renderCommands(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const commands = card.commands ?? [];
	if (commands.length === 0) {
		emptyState(body, "terminal", t().cards.empty.commandsEmpty);
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		// A per-tile size overrides the card default: it drives the tile's own
		// height/icon (via --hearth-tile) and, when larger than the base, makes
		// the tile span proportionally more grid columns so it's wider too.
		applyTileSize(tile, cmd.sizeW, cmd.sizeH, cmd.size, baseTile, cmd.col, cmd.row);
		setIcon(tile.createDiv("hearth-link-icon"), cmd.icon || "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		const run = () => runCommand(view, cmd);
		// In arrange mode, clicking a tile must NOT trigger its action.
		if (!view.arrangeMode) {
			tile.addEventListener("click", run);
			makeClickable(tile, run, cmd.name || cmd.id);
		}

		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => cmd.sizeW, (v) => {
				cmd.sizeW = v;
			}, () => cmd.sizeH, (v) => {
				cmd.sizeH = v;
			}, () => cmd.size, (v) => {
				cmd.size = v;
			});
			makeTileDraggable(view, grid, tile, commands, cmd, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}

function runCommand(view: HomeView, cmd: CommandItem): void {
	if (cmd.id) view.app.commands.executeCommandById(cmd.id);
}

// ---- Tasks ---------------------------------------------------------------

interface TaskHit {
	file: TFile;
	/** Line index for checkbox tasks; -1 for TaskNotes tasks (whole-file, no
	 * single line to jump to or toggle in place). */
	line: number;
	text: string;
	done: boolean;
	due: string | null;
	/** The original due text as written (e.g. "tomorrow"), kept so the display
	 * can show the user's natural-language wording next to the parsed date. */
	dueRaw: string | null;
	/** TaskNotes "scheduled" date (frontmatter), used as a fallback for sorting
	 * when no due date is set. */
	scheduled: string | null;
	/** File creation time (epoch ms), the final sort tiebreaker. */
	created: number;
	/** TaskNotes recurrence rule (e.g. "FREQ=WEEKLY;INTERVAL=1" or an RRULE).
	 * When present the task is recurring; shown as a ↻ badge next to the due
	 * date so the date isn't mistaken for a one-off. */
	recurrence?: string;
	/** TaskNotes complete_instances: the YYYY-MM-DD dates already completed for
	 * a recurring task. Used to mark today's instance done and to reflect an
	 * already-checked checkbox without re-completing. */
	completeInstances?: string[];
	/** Raw TaskNotes status value, shown as a badge instead of a checkbox
	 * since it may not be a simple open/done binary. */
	status?: string;
	/** Raw TaskNotes priority value (e.g. high/normal/low), shown as an
	 * indicator dot + label. */
	priority?: string;
	/** Kanban source: the board column (heading) this card currently lives
	 * under. Used to group cards in the Kanban layout and as the status badge
	 * in the list layout. */
	boardColumn?: string;
	/** Tasks-plugin "start" date (🛫), a card can't be started before it. */
	start?: string | null;
	/** Tasks-plugin "done" date (✅), set when the card was completed. */
	doneDate?: string | null;
	/** Kanban card description: the plain-text lines nested under the card,
	 * shown as sub-bullets. Joined with "\n"; empty when the card has none. */
	description?: string;
	/** Kanban card that is essentially a single link to a note (as produced by
	 * "Convert to note"): the linked note. When set, the card's metadata is read
	 * from that note's frontmatter and its description from the note body, and
	 * "open note" opens it. */
	linkedFile?: TFile | null;
	/** Checkbox source: the raw checkbox status symbol (the char inside `- [ ]`),
	 * used to group the task into its status column on the Kanban board. */
	checkboxStatus?: string;
}

/** The default checkbox task states shown as Kanban columns when the card has
 * no custom set: To do ` `, In progress `/`, Done `x` (done). */
function defaultCheckboxStatuses(): { symbol: string; label: string; done?: boolean }[] {
	return [
		{ symbol: " ", label: t().cards.tasks.toDo },
		{ symbol: "/", label: t().cards.tasks.statusInProgress },
		{ symbol: "x", label: t().cards.tasks.done, done: true },
	];
}

/** The card's configured checkbox statuses, or the default set. Blank/malformed
 * entries are dropped; a status without a label falls back to its symbol. */
function checkboxStatuses(cfg: TasksConfig): { symbol: string; label: string; done?: boolean }[] {
	const custom = (cfg.checkboxStatuses ?? [])
		.filter((s) => s && typeof s.symbol === "string" && s.symbol.length === 1)
		.map((s) => ({ symbol: s.symbol, label: (s.label || "").trim() || s.symbol, done: !!s.done }));
	return custom.length ? custom : defaultCheckboxStatuses();
}

/** Whether `path` is in scope per the card's folder whitelist/blacklist. An
 * empty whitelist matches nothing; an empty blacklist excludes nothing. */
function inTaskScope(path: string, cfg: TasksConfig): boolean {
	const mode = cfg.folderScope ?? "all";
	if (mode === "all") return true;
	const folders = (cfg.folders ?? [])
		.map((f) => f.trim().replace(/\/+$/, ""))
		.filter(Boolean);
	if (folders.length === 0) return mode === "blacklist";
	const matches = folders.some((f) => path === f || path.startsWith(`${f}/`));
	return mode === "whitelist" ? matches : !matches;
}

function renderTasks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.tasks ?? {};
	const container = body.createDiv("hearth-tasks-wrap");
	const refresh = () => void loadAndRenderTasks(view, cfg, container, refresh);
	refresh();
}

/** Resolve TaskNotes' "create new task" command id. Prefer a live lookup (the
 * plugin's command ids have shifted between versions) and fall back to the
 * conventional id. */
function taskNotesCreateCommandId(view: HomeView): string {
	const commands = view.app.commands.listCommands();
	const match =
		commands.find((c) => /^tasknotes[:.]/i.test(c.id) && /create.*task/i.test(c.name)) ??
		commands.find((c) => /tasknotes/i.test(c.id) && /create.*task/i.test(c.name));
	return match?.id ?? "tasknotes:create-new-task";
}

/** A small "+" button that triggers TaskNotes' create-task command, appended to
 * `parent`. */
function taskNotesAddButton(view: HomeView, parent: HTMLElement): void {
	const btn = parent.createEl("button", {
		cls: "hearth-task-add",
		attr: { "aria-label": t().cards.tasks.createNewTask, title: t().cards.tasks.createNewTask },
	});
	setIcon(btn, "plus");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const id = taskNotesCreateCommandId(view);
		if (!view.app.commands.executeCommandById(id)) {
			new Notice(t().notices.taskNotesCreateFailed);
		}
	});
}

/** Places the list layout's controls: the filter/sort controls and a
 * source-appropriate add control (TaskNotes' create command, or a Kanban
 * quick-add into the first column). When the card has a title the controls dock
 * into its title header; otherwise they float over the card's top-right corner. */
function renderTasksListHeader(
	view: HomeView,
	cfg: TasksConfig,
	source: string,
	availableStatuses: string[],
	boardColumns: string[] | undefined,
	container: HTMLElement,
	refresh: () => void,
): void {
	const actions = resolveTaskActionsHost(view, container);
	// Filter and sort controls for the whole list. Like the add control, they're
	// revealed on card hover (see styles.css) so the header stays uncluttered.
	renderTaskFilterControl(view, actions, cfg, availableStatuses, refresh);
	renderTaskListSortControl(view, actions, cfg, availableStatuses, refresh);
	if (source === "tasknotes") {
		// TaskNotes add is a single command button, so it sits with the controls.
		taskNotesAddButton(view, actions);
	} else if (source === "kanban" && boardColumns && boardColumns.length) {
		// Kanban add expands into a form, so give it a full-width row below the
		// header; new cards go into the board's first column.
		const target = boardColumns[0];
		const addHost = container.createDiv("hearth-tasks-listadd");
		renderKanbanAddCard(view, cfg, target, addHost, refresh, {
			extended: cfg.kanbanExtended ?? false,
			markDone: (cfg.kanbanDoneColumns ?? []).includes(target.toLowerCase()),
		});
	}
}

/** Resolve where the list-layout controls (filter/sort/add) should live and
 * return the element to render them into.
 *
 * A titled card docks the controls at the right of its title header, reusing a
 * single host so a task refresh replaces — rather than stacks — them. An
 * untitled card, or any card while arranging (where the header holds the title
 * editor), floats them over the card's top-right corner instead. */
function resolveTaskActionsHost(view: HomeView, container: HTMLElement): HTMLElement {
	const head = view.arrangeMode
		? null
		: container.closest(".hearth-card")?.querySelector<HTMLElement>(".hearth-card-head");
	if (head && !head.classList.contains("is-untitled")) {
		const existing = head.querySelector<HTMLElement>(":scope > .hearth-tasks-headactions");
		if (existing) {
			existing.empty();
			return existing;
		}
		return head.createDiv("hearth-tasks-headactions hearth-tasks-listhead-actions");
	}
	// Untitled (or arranging): float the controls over the card's top-right
	// corner, revealed on hover — matching the add button and embed switcher on
	// headerless cards, and never reserving a row of its own.
	return container.createDiv("hearth-tasks-head hearth-tasks-listhead-actions");
}

/** A short, human-readable label for a recurrence rule (e.g. "FREQ=WEEKLY;
 * INTERVAL=2" → "Repeats weekly"). Returns null if the rule is empty or
 * unparseable. */
function recurrenceLabel(rule: string | undefined): string | null {
	if (!rule) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toLowerCase();
	if (!freq) return t().recurrence.repeats;
	const interval = parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10);
	const units = t().recurrence.units;
	const unit =
		freq === "daily"
			? units.day
			: freq === "weekly"
				? units.week
				: freq === "monthly"
					? units.month
					: freq === "yearly"
						? units.year
						: freq;
	return interval > 1 ? t().recurrence.everyMany(interval, unit) : t().recurrence.everyOne(unit);
}

/** The date used for display/sorting — `due` wins, but recurring tasks use
 * `scheduled` (the next occurrence) since they have no fixed due date. */
function effectiveDate(hit: TaskHit): string | null {
	return hit.due ?? hit.scheduled ?? null;
}

/** Format a due/next-occurrence date for display as a short, human-relative
 * label ("Today", "Tomorrow", "Yesterday", "Friday", "Next Friday", "15 Jul").
 * Recurring tasks append a ↻ symbol so the date isn't mistaken for a one-off
 * and the user knows it's the next occurrence. */
function formatDueLabel(hit: TaskHit): string | null {
	const raw = hit.recurrence ? hit.due ?? hit.scheduled : hit.due;
	if (!raw) return hit.recurrence ? "↻" : null;
	const tail = hit.recurrence ? " ↻" : "";
	return `${formatRelativeDate(raw)}${tail}`;
}

/** Map a raw priority value to a coarse level for coloring the indicator. */
function priorityLevel(priority: string): "high" | "medium" | "low" | "other" {
	const v = priority.trim().toLowerCase();
	if (/^(high|urgent|critical|highest|p1|1|!!!|🔺|⏫)$/.test(v)) return "high";
	if (/^(medium|normal|med|moderate|p2|2|🔼)$/.test(v)) return "medium";
	if (/^(low|lowest|minor|p3|3|🔽|⏬)$/.test(v)) return "low";
	return "other";
}

/** A readable label for a priority value: a raw word (e.g. TaskNotes' "high")
 * is shown as-is, but an emoji priority (🔺⏫🔼🔽⏬) is mapped to its key word
 * (highest/high/medium/low/lowest) so the list doesn't show a bare emoji. */
function priorityDisplayLabel(priority: string): string {
	if (/[a-z]/i.test(priority)) return priority;
	return priorityKey(priority) || priority; // CSS capitalizes the word
}

/** The fine-grained CSS level class for a priority: distinguishes all five
 * Tasks-plugin levels (highest/high/medium/low/lowest) so, e.g., "highest" and
 * "high" get different colours. Falls back to "other". */
function priorityClass(priority: string): string {
	return priorityKey(priority) || "other";
}

/** A small colored dot showing a task's priority. With `dotOnly` (used by
 * Kanban board cards to keep them compact) it renders just the coloured dot
 * inline, with the value in the tooltip; otherwise it also shows a readable
 * label beside the dot. */
function renderPriority(parent: HTMLElement, priority: string, dotOnly = false): void {
	const chip = parent.createDiv(`hearth-task-priority is-${priorityClass(priority)}`);
	if (dotOnly) chip.addClass("is-dot-only");
	chip.createDiv("hearth-task-priority-dot");
	if (!dotOnly) chip.createSpan({ cls: "hearth-task-priority-label", text: priorityDisplayLabel(priority) });
	chip.setAttribute("title", `Priority: ${priorityDisplayLabel(priority)}`);
}

/** Render a task's date indicators into `parent`: start (🛫), scheduled (⏳),
 * the due/next-occurrence label, and the done date (✅). Start/scheduled/done
 * chips are shown only for Kanban cards (the source that parses them); the due
 * label keeps its existing recurrence/overdue treatment for every source. */
function renderTaskDateChips(parent: HTMLElement, hit: TaskHit, today: string): void {
	const overdue = (d: string | null | undefined) => !hit.done && !!d && d.slice(0, 10) < today;
	const chip = (emoji: string, date: string, kind: string, title: string, markOverdue: boolean) => {
		const el = parent.createDiv({ cls: `hearth-task-meta hearth-task-meta-${kind}` });
		el.createSpan({ cls: "hearth-task-meta-emoji", text: emoji });
		el.appendText(formatRelativeDate(date));
		el.setAttribute("title", `${title}: ${date}`);
		if (markOverdue) el.toggleClass("is-overdue", overdue(date));
	};
	// Line-based tasks (checkbox + Kanban) show start and scheduled chips; for
	// recurring cards scheduled is folded into the due label, so skip it then to
	// avoid duplication. (TaskNotes uses line -1 and keeps its own treatment.)
	if (hit.line >= 0 && hit.start) chip("🛫", hit.start, "start", t().cards.tasks.startDate, true);
	if (hit.line >= 0 && hit.scheduled && !hit.recurrence)
		chip("⏳", hit.scheduled, "scheduled", t().cards.tasks.scheduledDate, true);

	const dueLabel = formatDueLabel(hit);
	if (dueLabel) {
		const due = parent.createDiv({ cls: "hearth-task-due", text: dueLabel });
		due.toggleClass("is-overdue", overdue(effectiveDate(hit)));
		if (hit.recurrence) {
			due.addClass("is-recurring");
			due.setAttribute("title", recurrenceLabel(hit.recurrence) ?? t().cards.tasks.recurring);
		}
	}

	if (hit.line >= 0 && hit.doneDate) chip("✅", hit.doneDate, "done", t().cards.tasks.doneDate, false);
}

/** Render a card's description as muted plain-text sub-bullets (one per line),
 * with no Markdown formatting applied. */
function renderTaskDescription(parent: HTMLElement, description: string): void {
	const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
	if (!lines.length) return;
	const wrap = parent.createDiv("hearth-task-desc");
	for (const line of lines) {
		const item = wrap.createDiv("hearth-task-desc-line");
		item.createSpan({ cls: "hearth-task-desc-bullet", text: "•" });
		item.createSpan({ cls: "hearth-task-desc-text", text: line });
	}
}

/** Whether a line-based task's inline Tasks-plugin metadata (dates, priority,
 * repeat marks) is managed — parsed for display/sorting and written on edits.
 * Kanban cards (identified by `boardColumn`) follow `kanbanExtended` (off by
 * default); plain checkboxes follow `checkboxExtended` (on by default). */
function taskMetaEnabled(cfg: TasksConfig, hit: TaskHit): boolean {
	return hit.boardColumn ? (cfg.kanbanExtended ?? false) : (cfg.checkboxExtended ?? true);
}

/** Coarse rank of a priority value for ordering: high → medium → low → other. */
function priorityRank(p: string | undefined): number {
	switch (priorityLevel(p ?? "")) {
		case "high":
			return 0;
		case "medium":
			return 1;
		case "low":
			return 2;
		default:
			return 3;
	}
}

/** The default "smart" ordering: due date → scheduled date → priority → created
 * date. Dates compare as strings (YYYY-MM-DD sorts lexically); tasks missing a
 * date sort after those that have one. */
function compareSmart(a: TaskHit, b: TaskHit): number {
	if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
	if (a.due) return -1;
	if (b.due) return 1;
	if (a.scheduled && b.scheduled) return a.scheduled < b.scheduled ? -1 : a.scheduled > b.scheduled ? 1 : 0;
	if (a.scheduled) return -1;
	if (b.scheduled) return 1;
	const pa = priorityRank(a.priority);
	const pb = priorityRank(b.priority);
	if (pa !== pb) return pa - pb;
	return a.created - b.created;
}

/** A chosen sort key + direction. An absent `key` means "smart" (the default
 * chain); an absent `reverse` means ascending. */
type SortKey = NonNullable<TasksConfig["sortKey"]>;
interface SortState {
	key?: SortKey;
	reverse?: boolean;
}

/** Sort a list of tasks in place by the given key and direction. Incomplete
 * tasks always come before completed ones (so "show completed" adds them below
 * rather than crowding out open work); within each group the chosen key
 * applies, and `reverse` flips that key (not the incomplete/complete grouping). */
function sortHits(hits: TaskHit[], key: SortKey, reverse: boolean): void {
	const compare = (a: TaskHit, b: TaskHit): number => {
		switch (key) {
			case "due": {
				const ad = effectiveDate(a);
				const bd = effectiveDate(b);
				if (ad && bd) return ad < bd ? -1 : ad > bd ? 1 : 0;
				if (ad) return -1;
				if (bd) return 1;
				return a.created - b.created;
			}
			case "priority": {
				const d = priorityRank(a.priority) - priorityRank(b.priority);
				return d !== 0 ? d : compareSmart(a, b);
			}
			case "created":
				return a.created - b.created;
			case "alpha":
				return (a.text || a.file.basename).localeCompare(b.text || b.file.basename);
			default:
				return compareSmart(a, b);
		}
	};
	hits.sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		const c = compare(a, b);
		return reverse ? -c : c;
	});
}

/** Compare two tasks on a single custom-sort field, ascending. Tasks missing a
 * value for the field sort after those that have one; ties return 0 so the
 * next rule (or the created-date backstop) decides. */
function compareByField(a: TaskHit, b: TaskHit, field: TaskSortField): number {
	const cmpDate = (x: string | null, y: string | null): number => {
		if (x && y) return x < y ? -1 : x > y ? 1 : 0;
		if (x) return -1;
		if (y) return 1;
		return 0;
	};
	switch (field) {
		case "due":
			return cmpDate(effectiveDate(a), effectiveDate(b));
		case "scheduled":
			return cmpDate(a.scheduled, b.scheduled);
		case "priority":
			return priorityRank(a.priority) - priorityRank(b.priority);
		case "created":
			return a.created - b.created;
		case "alpha":
			return (a.text || a.file.basename).localeCompare(b.text || b.file.basename);
		case "status": {
			const sa = (hitStatusValue(a) ?? "").toLowerCase();
			const sb = (hitStatusValue(b) ?? "").toLowerCase();
			return sa.localeCompare(sb);
		}
	}
	return 0;
}

/** Sort tasks in place by an ordered list of custom rules: each rule is applied
 * as a tiebreaker for the previous, with the file creation time as the final
 * backstop. Like the single-key sort, incomplete tasks always come first. */
function sortHitsByRules(hits: TaskHit[], rules: TaskSortRule[]): void {
	hits.sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		for (const rule of rules) {
			const c = compareByField(a, b, rule.field);
			if (c !== 0) return rule.reverse ? -c : c;
		}
		return a.created - b.created;
	});
}

/** Whether a custom-rules sort is configured (a non-empty rule list). */
function hasCustomSort(cfg: TasksConfig): boolean {
	return !!cfg.sortRules?.length;
}

/** Sort tasks by the card's persistent (whole-list) sort setting: the custom
 * rule list when set, otherwise the single sort key + direction. */
function sortTasks(hits: TaskHit[], cfg: TasksConfig): void {
	if (hasCustomSort(cfg)) sortHitsByRules(hits, cfg.sortRules as TaskSortRule[]);
	else sortHits(hits, cfg.sortKey ?? "smart", !!cfg.sortReverse);
}

/** Available sort keys, in the order shown in the sort menu. */
const TASK_SORT_KEYS: SortKey[] = ["smart", "due", "priority", "created", "alpha"];

/** A minimalistic sort control: a small button that opens a menu to pick a sort
 * key or reverse the direction. `compact` renders it icon-only (for Kanban
 * column headers, where each column sorts independently); otherwise it shows a
 * label too (the list header). `onChange` persists and refreshes. */
function renderTaskSortControl(
	parent: HTMLElement,
	current: SortState,
	compact: boolean,
	onChange: (next: SortState) => void,
): void {
	const active = current.key ?? "smart";
	const labels = t().cards.tasks.sortLabels;
	const btn = parent.createEl("button", {
		cls: compact ? "hearth-kanban-col-sort" : "hearth-tasks-sort",
		attr: { "aria-label": t().cards.tasks.sort, title: t().cards.tasks.sort },
	});
	setIcon(btn, "arrow-up-down");
	if (!compact) btn.createSpan({ cls: "hearth-tasks-sort-label", text: labels[active] });
	if (current.reverse) btn.addClass("is-reversed");
	if (active !== "smart" || current.reverse) btn.addClass("is-active");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const menu = new Menu();
		for (const key of TASK_SORT_KEYS) {
			menu.addItem((item) =>
				item
					.setTitle(labels[key])
					.setChecked(active === key)
					.onClick(() => onChange({ key: key === "smart" ? undefined : key, reverse: current.reverse })),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(t().cards.tasks.sortReverse)
				.setChecked(!!current.reverse)
				.setIcon("arrow-down-up")
				.onClick(() => onChange({ key: current.key, reverse: current.reverse ? undefined : true })),
		);
		menu.showAtMouseEvent(e);
	});
}

/** Fields offered by the custom-sort modal, in menu order. */
const TASK_SORT_FIELDS: TaskSortField[] = ["due", "scheduled", "priority", "created", "alpha", "status"];

/**
 * The list header's sort control. Like {@link renderTaskSortControl} it offers
 * the simple one-key sorts, but it also exposes a "Custom…" option that opens a
 * modal to build an ordered multi-rule sort (mirroring how the filter control
 * opens the filter modal). A custom sort supersedes the simple key; picking a
 * simple key clears it.
 */
function renderTaskListSortControl(
	view: HomeView,
	parent: HTMLElement,
	cfg: TasksConfig,
	availableStatuses: string[],
	refresh: () => void,
): void {
	const custom = hasCustomSort(cfg);
	const active: SortKey = cfg.sortKey ?? "smart";
	const labels = t().cards.tasks.sortLabels;
	const persist = () => {
		void view.plugin.saveData(view.plugin.settings);
		refresh();
	};

	const btn = parent.createEl("button", {
		cls: "hearth-tasks-sort",
		attr: { "aria-label": t().cards.tasks.sort, title: t().cards.tasks.sort },
	});
	setIcon(btn, "arrow-up-down");
	btn.createSpan({
		cls: "hearth-tasks-sort-label",
		text: custom ? t().cards.tasks.sortCustom : labels[active],
	});
	if (!custom && cfg.sortReverse) btn.addClass("is-reversed");
	if (custom || active !== "smart" || cfg.sortReverse) btn.addClass("is-active");

	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const menu = new Menu();
		for (const key of TASK_SORT_KEYS) {
			menu.addItem((item) =>
				item
					.setTitle(labels[key])
					.setChecked(!custom && active === key)
					.onClick(() => {
						cfg.sortRules = undefined;
						cfg.sortKey = key === "smart" ? undefined : key;
						persist();
					}),
			);
		}
		// Reverse applies to the simple key sort; hidden while a custom sort (which
		// carries its own per-rule directions) is active.
		if (!custom) {
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.sortReverse)
					.setChecked(!!cfg.sortReverse)
					.setIcon("arrow-down-up")
					.onClick(() => {
						cfg.sortReverse = cfg.sortReverse ? undefined : true;
						persist();
					}),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(t().cards.tasks.sortCustomOption)
				.setChecked(custom)
				.setIcon("list-ordered")
				.onClick(() => {
					new TaskSortModal(view.app, cfg.sortRules ?? [], availableStatuses, (rules) => {
						cfg.sortRules = rules.length ? rules : undefined;
						persist();
					}).open();
				}),
		);
		menu.showAtMouseEvent(e);
	});
}

/**
 * The custom-sort modal: an ordered list of rules (field + direction) applied
 * in sequence, plus add / reorder / remove controls. Mirrors the filter modal —
 * edits apply on "Apply", "Clear" empties the list, "Cancel" discards them.
 */
class TaskSortModal extends Modal {
	private rules: TaskSortRule[];
	private body: HTMLElement | null = null;

	constructor(
		app: App,
		initial: TaskSortRule[],
		private readonly availableStatuses: string[],
		private readonly onSubmit: (rules: TaskSortRule[]) => void,
	) {
		super(app);
		// Clone so Cancel truly discards edits.
		this.rules = initial.map((r) => ({ ...r }));
	}

	/** Sort fields available in this context (status only when the source exposes
	 * status/column values, matching the filter modal). */
	private fields(): TaskSortField[] {
		return TASK_SORT_FIELDS.filter((f) => f !== "status" || this.availableStatuses.length > 0);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-tasksort-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.sortTitle });
		contentEl.createEl("p", { cls: "hearth-tasksort-hint", text: t().cards.tasks.sortHint });
		this.body = contentEl.createDiv("hearth-tasksort-body");
		this.renderBody();
		this.renderFooter(contentEl);
	}

	private renderBody(): void {
		const body = this.body;
		if (!body) return;
		body.empty();
		const labels = t().cards.tasks;
		const fieldLabels = labels.sortFields;
		const available = this.fields();

		this.rules.forEach((rule, index) => {
			const row = new Setting(body).setClass("hearth-tasksort-rule");
			row.setName(index === 0 ? labels.sortLevelFirst : labels.sortLevelNext);
			row.addDropdown((d) => {
				for (const f of available) d.addOption(f, fieldLabels[f]);
				d.setValue(rule.field).onChange((v) => {
					rule.field = v as TaskSortField;
				});
			});
			row.addDropdown((d) => {
				d.addOption("asc", labels.sortAscending);
				d.addOption("desc", labels.sortDescending);
				d.setValue(rule.reverse ? "desc" : "asc").onChange((v) => {
					rule.reverse = v === "desc" ? true : undefined;
				});
			});
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(labels.sortMoveUp)
					.setDisabled(index === 0)
					.onClick(() => {
						this.moveRule(index, index - 1);
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(labels.sortMoveDown)
					.setDisabled(index === this.rules.length - 1)
					.onClick(() => {
						this.moveRule(index, index + 1);
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(labels.sortRemoveRule)
					.onClick(() => {
						this.rules.splice(index, 1);
						this.renderBody();
					}),
			);
		});

		if (!this.rules.length) {
			body.createDiv({ cls: "hearth-tasksort-empty", text: labels.sortEmpty });
		}

		new Setting(body).addButton((b) =>
			b
				.setButtonText(labels.sortAddRule)
				.setIcon("plus")
				.setDisabled(this.rules.length >= available.length)
				.onClick(() => {
					const used = new Set(this.rules.map((r) => r.field));
					const next = available.find((f) => !used.has(f)) ?? available[0];
					this.rules.push({ field: next });
					this.renderBody();
				}),
		);
	}

	private moveRule(from: number, to: number): void {
		if (to < 0 || to >= this.rules.length) return;
		const [item] = this.rules.splice(from, 1);
		this.rules.splice(to, 0, item);
		this.renderBody();
	}

	private renderFooter(parent: HTMLElement): void {
		new Setting(parent)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.filterApply)
					.setCta()
					.onClick(() => {
						this.onSubmit(this.rules);
						this.close();
					}),
			)
			.addButton((b) =>
				b.setButtonText(t().cards.tasks.filterClear).onClick(() => {
					this.rules = [];
					this.renderBody();
				}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

// ---- List filter ---------------------------------------------------------

/** The status-like value a task exposes for filtering: the TaskNotes status or
 * the Kanban column, whichever the source provides (checkbox tasks have neither
 * and so aren't offered status chips). */
function hitStatusValue(hit: TaskHit): string | null {
	return hit.status ?? hit.boardColumn ?? null;
}

/** The coarse priority bucket of a task for filtering. No priority — or a value
 * that doesn't map to high/medium/low — counts as "none". */
function hitPriorityLevel(hit: TaskHit): TaskPriorityLevel {
	if (!hit.priority || !hit.priority.trim()) return "none";
	const lvl = priorityLevel(hit.priority);
	return lvl === "other" ? "none" : lvl;
}

/** Whether a filter constrains anything. An all-empty filter is inactive and
 * shows everything, so the control renders as "off" and nothing is filtered. */
function isTaskFilterActive(f: TaskFilterConfig | undefined): boolean {
	if (!f) return false;
	return !!(f.statuses?.length || f.priorities?.length || f.due || (f.text && f.text.trim()));
}

/** Whether a task satisfies a due-date constraint. Dates compare as YYYY-MM-DD
 * strings; "week" means due today through seven days out. */
function taskMatchesDue(hit: TaskHit, due: TaskDueFilter, today: string): boolean {
	const raw = effectiveDate(hit);
	const d = raw ? raw.slice(0, 10) : null;
	switch (due) {
		case "hasDate":
			return !!d;
		case "noDate":
			return !d;
		case "overdue":
			return !!d && d < today && !hit.done;
		case "today":
			return d === today;
		case "week": {
			if (!d) return false;
			const end = moment(today).add(7, "day").format("YYYY-MM-DD");
			return d >= today && d <= end;
		}
	}
	return true;
}

/** Whether a task passes an active filter: it must satisfy every set criterion
 * (statuses, priorities, due, text) — unset criteria impose no constraint. */
function taskMatchesFilter(hit: TaskHit, f: TaskFilterConfig, today: string): boolean {
	if (f.statuses?.length) {
		const v = (hitStatusValue(hit) ?? "").trim().toLowerCase();
		if (!f.statuses.some((s) => s.trim().toLowerCase() === v)) return false;
	}
	if (f.priorities?.length && !f.priorities.includes(hitPriorityLevel(hit))) return false;
	if (f.due && !taskMatchesDue(hit, f.due, today)) return false;
	if (f.text && f.text.trim()) {
		const needle = f.text.trim().toLowerCase();
		if (!(hit.text || hit.file.basename).toLowerCase().includes(needle)) return false;
	}
	return true;
}

/** A filter button styled like the sort control. Shows "active" when the card
 * carries a filter, and opens a modal to edit it (presets + custom criteria). */
function renderTaskFilterControl(
	view: HomeView,
	parent: HTMLElement,
	cfg: TasksConfig,
	availableStatuses: string[],
	refresh: () => void,
): void {
	const btn = parent.createEl("button", {
		cls: "hearth-tasks-filter",
		attr: { "aria-label": t().cards.tasks.filter, title: t().cards.tasks.filter },
	});
	setIcon(btn, "list-filter");
	btn.createSpan({ cls: "hearth-tasks-filter-label", text: t().cards.tasks.filter });
	if (isTaskFilterActive(cfg.taskFilter)) btn.addClass("is-active");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		new TaskFilterModal(view.app, cfg.taskFilter ?? {}, availableStatuses, (next) => {
			cfg.taskFilter = isTaskFilterActive(next) ? next : undefined;
			void view.plugin.saveData(view.plugin.settings);
			refresh();
		}).open();
	});
}

/** The order priority chips appear in the filter modal. */
const TASK_PRIORITY_LEVELS: TaskPriorityLevel[] = ["high", "medium", "low", "none"];

/** The filter modal: quick presets across the top, then editable criteria
 * (due, priority, status, text). Edits are applied on "Apply"; "Cancel"
 * discards them and "Clear" empties every field. */
class TaskFilterModal extends Modal {
	private working: TaskFilterConfig;
	private body: HTMLElement | null = null;

	constructor(
		app: App,
		initial: TaskFilterConfig,
		private readonly availableStatuses: string[],
		private readonly onSubmit: (filter: TaskFilterConfig) => void,
	) {
		super(app);
		// Clone so Cancel truly discards edits.
		this.working = {
			statuses: [...(initial.statuses ?? [])],
			priorities: [...(initial.priorities ?? [])],
			due: initial.due,
			text: initial.text,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-taskfilter-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.filterTitle });
		this.renderPresets(contentEl);
		this.body = contentEl.createDiv("hearth-taskfilter-body");
		this.renderBody();
		this.renderFooter(contentEl);
	}

	/** Preset chips that fill in the criteria below, then re-render the body. */
	private renderPresets(parent: HTMLElement): void {
		const labels = t().cards.tasks.filterPresets;
		const row = parent.createDiv("hearth-taskfilter-presets");
		const preset = (label: string, apply: () => void) => {
			const chip = row.createEl("button", { cls: "hearth-taskfilter-chip", text: label });
			chip.addEventListener("click", () => {
				apply();
				this.renderBody();
			});
		};
		preset(labels.overdue, () => (this.working.due = "overdue"));
		preset(labels.today, () => (this.working.due = "today"));
		preset(labels.week, () => (this.working.due = "week"));
		preset(labels.highPriority, () => (this.working.priorities = ["high"]));
		preset(labels.noDate, () => (this.working.due = "noDate"));
	}

	/** The editable criteria; rebuilt whenever a preset or toggle changes them. */
	private renderBody(): void {
		const body = this.body;
		if (!body) return;
		body.empty();
		const labels = t().cards.tasks;

		// Due-date constraint (a dropdown; "" = any).
		new Setting(body).setName(labels.filterDue).addDropdown((d) => {
			d.addOption("", labels.filterDueAny);
			d.addOption("overdue", labels.filterPresets.overdue);
			d.addOption("today", labels.filterPresets.today);
			d.addOption("week", labels.filterPresets.week);
			d.addOption("hasDate", labels.filterDueHasDate);
			d.addOption("noDate", labels.filterPresets.noDate);
			d.setValue(this.working.due ?? "");
			d.onChange((v) => {
				this.working.due = v ? (v as TaskDueFilter) : undefined;
			});
		});

		// Priority buckets (multi-select chips).
		const prioRow = new Setting(body).setName(labels.filterPriority);
		const prioHost = prioRow.controlEl.createDiv("hearth-taskfilter-chips");
		for (const level of TASK_PRIORITY_LEVELS) {
			this.toggleChip(prioHost, labels.filterPriorityLevels[level], () => (this.working.priorities ?? []).includes(level), () => {
				const set = new Set(this.working.priorities ?? []);
				if (set.has(level)) set.delete(level);
				else set.add(level);
				this.working.priorities = set.size ? [...set] : undefined;
			});
		}

		// Status/column chips (only when the source exposes statuses).
		if (this.availableStatuses.length) {
			const statusRow = new Setting(body).setName(labels.filterStatus);
			const statusHost = statusRow.controlEl.createDiv("hearth-taskfilter-chips");
			for (const status of this.availableStatuses) {
				this.toggleChip(statusHost, status, () => (this.working.statuses ?? []).some((s) => s.toLowerCase() === status.toLowerCase()), () => {
					const cur = this.working.statuses ?? [];
					const has = cur.some((s) => s.toLowerCase() === status.toLowerCase());
					const next = has ? cur.filter((s) => s.toLowerCase() !== status.toLowerCase()) : [...cur, status];
					this.working.statuses = next.length ? next : undefined;
				});
			}
		}

		// Free-text substring.
		new Setting(body).setName(labels.filterText).addText((txt) => {
			txt.setPlaceholder(labels.filterTextPlaceholder).setValue(this.working.text ?? "");
			txt.onChange((v) => (this.working.text = v.trim() || undefined));
		});
	}

	/** A single multi-select chip: reflects `isOn()` and flips it on click. */
	private toggleChip(host: HTMLElement, label: string, isOn: () => boolean, flip: () => void): void {
		const chip = host.createEl("button", { cls: "hearth-taskfilter-chip", text: label });
		chip.toggleClass("is-on", isOn());
		chip.addEventListener("click", () => {
			flip();
			chip.toggleClass("is-on", isOn());
		});
	}

	private renderFooter(parent: HTMLElement): void {
		new Setting(parent)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.filterApply)
					.setCta()
					.onClick(() => {
						this.onSubmit(this.working);
						this.close();
					}),
			)
			.addButton((b) =>
				b.setButtonText(t().cards.tasks.filterClear).onClick(() => {
					this.working = {};
					this.renderBody();
				}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

async function loadAndRenderTasks(
	view: HomeView,
	cfg: TasksConfig,
	container: HTMLElement,
	refresh: () => void,
): Promise<void> {
	container.empty();
	const source = cfg.source ?? "checkbox";

	let hits: TaskHit[];
	let boardColumns: string[] | undefined;
	if (source === "tasknotes") {
		if (!view.app.plugins.enabledPlugins.has(TASKNOTES_PLUGIN_ID)) {
			emptyState(container, "list-todo", t().cards.empty.tasksEnable);
			return;
		}
		hits = collectTaskNotesTasks(view, cfg);
	} else if (source === "kanban") {
		const board = await collectKanbanTasks(view, cfg);
		if (!board.file) {
			emptyState(container, "list-todo", t().cards.empty.kanbanNoBoard);
			return;
		}
		hits = board.hits;
		boardColumns = board.columns.map((c) => c.heading);
	} else {
		hits = await collectCheckboxTasks(view, cfg);
	}

	sortTasks(hits, cfg);

	if (cfg.layout === "kanban") {
		// TaskNotes' quick-add sits top-right over the board; sorting is per
		// column, handled inside renderTaskKanban.
		if (source === "tasknotes") taskNotesAddButton(view, container.createDiv("hearth-tasks-head"));
		renderTaskKanban(view, cfg, hits, container, refresh, boardColumns);
		return;
	}

	const today: string = moment().format("YYYY-MM-DD");

	// Distinct status/column values present, offered as filter chips (computed
	// from all hits so the choices don't shift as the filter narrows the list).
	const availableStatuses: string[] = [];
	const seenStatus = new Set<string>();
	for (const h of hits) {
		const v = hitStatusValue(h);
		if (v && !seenStatus.has(v.toLowerCase())) {
			seenStatus.add(v.toLowerCase());
			availableStatuses.push(v);
		}
	}

	// List layout: hide completed unless asked, apply any active filter, then cap.
	let list = cfg.showCompleted ? hits : hits.filter((h) => !h.done);
	if (isTaskFilterActive(cfg.taskFilter)) {
		const filter = cfg.taskFilter as TaskFilterConfig;
		list = list.filter((h) => taskMatchesFilter(h, filter, today));
	}
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 10;
	list = list.slice(0, limit);

	// The list's sort/filter/add controls — docked into the card's title header
	// when it has one, otherwise floating over the card's corner. Rendered even
	// when empty so the controls stay reachable.
	renderTasksListHeader(view, cfg, source, availableStatuses, boardColumns, container, refresh);

	if (list.length === 0) {
		const empty = isTaskFilterActive(cfg.taskFilter) ? t().cards.empty.tasksNoMatch : t().cards.empty.tasksEmpty;
		emptyState(container, "list-todo", empty);
		return;
	}

	const listEl = container.createDiv("hearth-list hearth-tasks");
	for (const hit of list) renderTaskRow(view, cfg, listEl, hit, today, refresh);
}

function renderTaskRow(
	view: HomeView,
	cfg: TasksConfig,
	listEl: HTMLElement,
	hit: TaskHit,
	today: string,
	refresh: () => void,
): void {
	const row = listEl.createDiv("hearth-list-item hearth-task");
	row.toggleClass("is-done", hit.done);

	if (hit.linkedFile && hit.recurrence && taskMetaEnabled(cfg, hit)) {
		// Recurring card linked to a note: complete per-occurrence in the note's
		// frontmatter (complete_instances + next scheduled), TaskNotes-style.
		renderRecurringCheckbox(view, hit, today, row, refresh, hit.linkedFile);
	} else if (hit.line >= 0 && hit.recurrence && taskMetaEnabled(cfg, hit)) {
		// Recurring checkbox / Kanban task: complete per-occurrence (stamp today's
		// ✅ and roll the date forward), resetting to open on its next date rather
		// than retiring the line.
		renderLineRecurringCheckbox(view, hit, today, row, refresh);
	} else if (hit.line >= 0) {
		const check = row.createEl("input", {
			cls: "hearth-task-check",
			attr: { type: "checkbox" },
		});
		check.checked = hit.done;
		check.addEventListener("click", (e) => e.stopPropagation());
		check.addEventListener("change", () => {
			// Keep the ✅ done date in sync only when metadata is managed for this
			// task (checkbox tasks by default, Kanban cards in extended mode); a
			// plain task stays plain.
			const done = check.checked;
			const ext = taskMetaEnabled(cfg, hit);
			void setKanbanCardDone(view, hit, done, ext).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		});
	} else if (hit.recurrence) {
		// Recurring TaskNotes tasks complete per-occurrence (complete_instances +
		// next scheduled), not by flipping status — a checkbox does that without
		// needing a status column to drag into.
		renderRecurringCheckbox(view, hit, today, row, refresh);
	} else if (hit.status) {
		row.createDiv({ cls: "hearth-task-status", text: hit.status });
	}

	const label = row.createDiv({ cls: "hearth-list-label hearth-task-text" });
	fillTaskText(view, label, hit.text || hit.file.basename, hit.file.path);
	// Kanban cards show the board column they belong to as a small badge.
	if (hit.boardColumn) row.createDiv({ cls: "hearth-task-status hearth-task-column", text: hit.boardColumn });
	// The list has room for a labelled priority chip (a bare dot is easy to
	// miss); board cards stay dot-only for compactness.
	if (hit.priority) renderPriority(row, hit.priority);
	renderTaskDateChips(row, hit, today);
	if (hit.description) renderTaskDescription(row, hit.description);

	const open = () => void openTask(view, cfg, hit, refresh);
	row.addEventListener("click", open);
	makeClickable(row, open, hit.text || hit.file.basename);
	// Line-based tasks (Kanban cards and plain checkboxes) get the right-click
	// menu; checkboxes get the edit-details item, Kanban also convert/delete.
	if (hit.line >= 0) attachKanbanCardMenu(view, cfg, hit, row, refresh);
}

/** A Kanban board: tasks grouped into status columns, draggable between them.
 * For checkbox tasks the columns are To do / Done; for TaskNotes they're the
 * distinct status values (plus the configured "done" value). Dropping a task in
 * a column writes the new state back to the file. */
function renderTaskKanban(
	view: HomeView,
	cfg: TasksConfig,
	hits: TaskHit[],
	container: HTMLElement,
	refresh: () => void,
	boardColumns?: string[],
): void {
	const source = cfg.source ?? "checkbox";
	const doneValue = (view.plugin.settings.taskNotesDoneValue.trim() || "done");

	// Build the ordered list of columns and assign each hit to one.
	interface Column { key: string; label: string; hits: TaskHit[]; statusSymbol?: string; statusDone?: boolean }
	const columns: Column[] = [];
	const columnFor = new Map<string, Column>();
	const ensure = (key: string, label: string): Column => {
		let col = columnFor.get(key);
		if (!col) {
			col = { key, label, hits: [] };
			columnFor.set(key, col);
			columns.push(col);
		}
		return col;
	};

	if (source === "kanban") {
		// Columns are the board's own headings, kept in board order — including
		// empty lanes, so a card can be dragged into a column that has no cards
		// yet. Cards whose heading somehow isn't listed fall into "No status".
		for (const heading of boardColumns ?? []) ensure(heading.toLowerCase(), heading);
		for (const hit of hits) {
			const key = (hit.boardColumn ?? "").trim().toLowerCase();
			const col = columnFor.get(key) ?? ensure(t().cards.tasks.noStatus.toLowerCase(), t().cards.tasks.noStatus);
			col.hits.push(hit);
		}
	} else if (source === "checkbox") {
		// One column per configured checkbox status (To do / In progress / Done by
		// default), keyed by the status symbol. Cards whose symbol isn't in the
		// set fall into a column of their own so nothing is hidden.
		const statuses = checkboxStatuses(cfg);
		for (const s of statuses) {
			const col = ensure(s.symbol.toLowerCase(), s.label);
			col.statusSymbol = s.symbol;
			col.statusDone = !!s.done;
		}
		for (const hit of hits) {
			const sym = hit.checkboxStatus ?? (hit.done ? "x" : " ");
			let col = columnFor.get(sym.toLowerCase());
			if (!col) {
				col = ensure(sym.toLowerCase(), sym === " " ? t().cards.tasks.toDo : sym);
				col.statusSymbol = sym;
				col.statusDone = hit.done;
			}
			col.hits.push(hit);
		}
	} else {
		// Collect the statuses actually present, then make sure a "done" column
		// exists so tasks can be completed by dragging.
		for (const hit of hits) {
			const status = (hit.status ?? "").trim() || t().cards.tasks.noStatus;
			ensure(status.toLowerCase(), status).hits.push(hit);
		}
		if (!columnFor.has(doneValue.toLowerCase())) ensure(doneValue.toLowerCase(), doneValue);
		// Keep the done column last.
		columns.sort((a, b) => {
			const ad = a.key === doneValue.toLowerCase() ? 1 : 0;
			const bd = b.key === doneValue.toLowerCase() ? 1 : 0;
			return ad - bd || a.label.localeCompare(b.label);
		});
	}

	// Apply the user's saved column order (unlisted keys keep their default
	// position after the listed ones, since sort is stable).
	const order = cfg.kanbanOrder;
	if (order && order.length) {
		const rank = (k: string) => {
			const i = order.indexOf(k);
			return i < 0 ? Number.MAX_SAFE_INTEGER : i;
		};
		columns.sort((a, b) => rank(a.key) - rank(b.key));
	}

	const persist = () => void view.plugin.saveData(view.plugin.settings);
	const hidden = new Set(cfg.kanbanHidden ?? []);
	const visible = columns.filter((c) => !hidden.has(c.key));
	// Columns that auto-complete cards landing in them (Kanban source only).
	const doneColumns = new Set(cfg.kanbanDoneColumns ?? []);
	const extended = cfg.kanbanExtended ?? false;

	// Reorder columns by dragging their headers; persists the full key order.
	const reorder = (fromKey: string, toKey: string) => {
		if (fromKey === toKey) return;
		const keys = columns.map((c) => c.key);
		const fi = keys.indexOf(fromKey);
		const ti = keys.indexOf(toKey);
		if (fi < 0 || ti < 0) return;
		keys.splice(ti, 0, keys.splice(fi, 1)[0]);
		cfg.kanbanOrder = keys;
		persist();
		refresh();
	};

	const hideColumn = (key: string) => {
		cfg.kanbanHidden = [...new Set([...(cfg.kanbanHidden ?? []), key])];
		persist();
		refresh();
	};

	// Toggle a column as a "done column". Turning it on also completes the cards
	// already sitting in it (one batched write); future drops/adds complete
	// automatically via moveTo/addKanbanCard.
	const toggleDoneColumn = (col: Column) => {
		const set = new Set(cfg.kanbanDoneColumns ?? []);
		const turningOn = !set.has(col.key);
		if (turningOn) set.add(col.key);
		else set.delete(col.key);
		cfg.kanbanDoneColumns = set.size ? [...set] : undefined;
		persist();
		const undone = col.hits.filter((h) => !h.done);
		if (turningOn && undone.length) {
			void markCardsDone(view, undone, extended ? moment().format("YYYY-MM-DD") : undefined).then(refresh);
		} else refresh();
	};

	const board = container.createDiv("hearth-kanban");
	const today: string = moment().format("YYYY-MM-DD");

	// Move a dragged task into a target column and persist the change.
	const moveTo = (hit: TaskHit, col: Column) => {
		if (source === "kanban") {
			// Relocate the card's checkbox line under the target heading in the
			// board note. A card's done state normally stays as-is (column and
			// completion are independent), but a column marked as a "done column"
			// completes the card as it lands.
			if ((hit.boardColumn ?? "") === col.label) return;
			const markDone = doneColumns.has(col.key) || undefined;
			const doneDate = markDone && extended ? today : undefined;
			void moveKanbanCard(view, hit, col.label, markDone, doneDate).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		} else if (source === "checkbox") {
			// Write the target column's status symbol onto the checkbox; stamp/clear
			// the ✅ done date to match when metadata is managed.
			const symbol = col.statusSymbol ?? (col.statusDone ? "x" : " ");
			if ((hit.checkboxStatus ?? (hit.done ? "x" : " ")) === symbol) return;
			void setCheckboxSymbol(view, hit, symbol, !!col.statusDone, cfg.checkboxExtended ?? true).then((ok) => {
				if (!ok) new Notice(t().notices.taskChangedOnDisk);
				refresh();
			});
		} else {
			// Recurring TaskNotes tasks complete per-occurrence, not by status:
			// dragging one into the "done" column marks today's instance done and
			// advances its scheduled date instead of setting status=done (which
			// would wrongly retire the whole recurring task).
			if (hit.recurrence && col.key === doneValue.toLowerCase()) {
				void completeRecurringInstance(view, hit).then(refresh);
				return;
			}
			const value = col.label === t().cards.tasks.noStatus ? "" : col.label;
			void setTaskNotesStatus(view, hit, value).then(refresh);
		}
	};

	// Each column sorts independently from its own header, falling back to the
	// card's global sort when it has no override of its own.
	const globalKey: SortKey = cfg.sortKey ?? "smart";
	const globalReverse = !!cfg.sortReverse;

	for (const col of visible) {
		const colSort = cfg.kanbanColumnSort?.[col.key] ?? {};
		// A column with its own override sorts by that; otherwise it follows the
		// card's global sort — the custom rule list when set, else the simple key.
		if (colSort.key || colSort.reverse) {
			sortHits(col.hits, colSort.key ?? globalKey, colSort.reverse ?? globalReverse);
		} else {
			sortTasks(col.hits, cfg);
		}

		const colEl = board.createDiv("hearth-kanban-col");
		colEl.toggleClass("is-done-col", doneColumns.has(col.key) || !!col.statusDone);
		const head = colEl.createDiv("hearth-kanban-col-head");
		const titleEl = head.createSpan({ cls: "hearth-kanban-col-title", text: col.label });
		// Kanban source: double-click the title to rename the board column.
		if (source === "kanban") {
			titleEl.setAttribute("title", t().cards.tasks.renameColumnHint);
			titleEl.addEventListener("dblclick", (e) => {
				e.preventDefault();
				e.stopPropagation();
				startColumnRename(view, cfg, head, titleEl, col.label, refresh);
			});
		}
		head.createSpan({ cls: "hearth-kanban-col-count", text: String(col.hits.length) });
		// Per-column sort control (icon-only). Writes into kanbanColumnSort under
		// this column's key; clearing back to Smart/forward removes the override.
		renderTaskSortControl(head, colSort, true, (next) => {
			const map = { ...(cfg.kanbanColumnSort ?? {}) };
			if (!next.key && !next.reverse) delete map[col.key];
			else map[col.key] = next;
			cfg.kanbanColumnSort = Object.keys(map).length ? map : undefined;
			persist();
			refresh();
		});
		// Kanban source: toggle whether this column auto-completes its cards.
		if (source === "kanban") {
			const isDoneCol = doneColumns.has(col.key);
			const doneBtn = head.createEl("button", {
				cls: "hearth-kanban-col-done",
				attr: {
					"aria-label": isDoneCol
						? t().cards.tasks.unsetDoneColumn(col.label)
						: t().cards.tasks.setDoneColumn(col.label),
				},
			});
			doneBtn.toggleClass("is-active", isDoneCol);
			setIcon(doneBtn, "circle-check-big");
			doneBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				toggleDoneColumn(col);
			});
		}
		const hideBtn = head.createEl("button", {
			cls: "hearth-kanban-col-hide",
			attr: { "aria-label": t().cards.tasks.hideColumn(col.label) },
		});
		setIcon(hideBtn, "eye-off");
		hideBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			hideColumn(col.key);
		});

		// Drag the header to reorder columns (distinct from dragging task cards).
		head.setAttribute("draggable", "true");
		head.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("application/hearth-col", col.key);
			colEl.addClass("is-dragging");
		});
		head.addEventListener("dragend", () => colEl.removeClass("is-dragging"));
		head.addEventListener("dragover", (e) => {
			if (e.dataTransfer?.types.includes("application/hearth-col")) {
				e.preventDefault();
				colEl.addClass("is-col-drop-target");
			}
		});
		head.addEventListener("dragleave", () => colEl.removeClass("is-col-drop-target"));
		head.addEventListener("drop", (e) => {
			const fromKey = e.dataTransfer?.getData("application/hearth-col");
			colEl.removeClass("is-col-drop-target");
			if (fromKey) {
				e.preventDefault();
				e.stopPropagation();
				reorder(fromKey, col.key);
			}
		});

		const colBody = colEl.createDiv("hearth-kanban-col-body");
		colBody.addEventListener("dragover", (e) => {
			// Only task-card drags target the column body (not header reorders).
			if (e.dataTransfer?.types.includes("application/hearth-col")) return;
			e.preventDefault();
			colBody.addClass("is-drop-target");
		});
		colBody.addEventListener("dragleave", () => colBody.removeClass("is-drop-target"));
		colBody.addEventListener("drop", (e) => {
			colBody.removeClass("is-drop-target");
			const raw = e.dataTransfer?.getData("text/plain") ?? "";
			if (!raw) return; // header reorder, handled on the header
			e.preventDefault();
			const idx = parseInt(raw, 10);
			const hit = Number.isNaN(idx) ? null : hits[idx];
			if (hit) moveTo(hit, col);
		});

		for (const hit of col.hits) {
			const idx = hits.indexOf(hit);
			const cardEl = colBody.createDiv("hearth-kanban-card");
			cardEl.toggleClass("is-done", hit.done);
			cardEl.setAttribute("draggable", "true");
			cardEl.addEventListener("dragstart", (e) => {
				e.dataTransfer?.setData("text/plain", String(idx));
				cardEl.addClass("is-dragging");
			});
			cardEl.addEventListener("dragend", () => cardEl.removeClass("is-dragging"));
			// Highlight the task card a dragged task would land on (the card
			// being hovered), with the same dashed outline as column drop.
			cardEl.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				e.preventDefault();
				e.stopPropagation();
				cardEl.addClass("is-drop-target");
			});
			cardEl.addEventListener("dragleave", () => cardEl.removeClass("is-drop-target"));
			cardEl.addEventListener("drop", (e) => {
				cardEl.removeClass("is-drop-target");
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				const raw = e.dataTransfer?.getData("text/plain") ?? "";
				if (!raw) return;
				e.preventDefault();
				e.stopPropagation();
				const fromIdx = parseInt(raw, 10);
				if (Number.isNaN(fromIdx)) return;
				const from = hits[fromIdx];
				if (!from) return;
				if (from === hit) return;
				if (from.status === hit.status) {
					// Same column: reorder within it. No fine-grained order is
					// stored (tasks sort by due), so just move to the same col.
				}
				moveTo(from, col);
			});
		// Recurring TaskNotes tasks get a per-occurrence completion checkbox
		// inline with the task text (in a row), in addition to drag: checking
		// it completes today's instance and advances scheduled without
		// retiring the task.
		const textRow = cardEl.createDiv("hearth-kanban-card-row");
		if (source === "tasknotes" && hit.recurrence) {
			renderRecurringCheckbox(view, hit, today, textRow, refresh);
		} else if (source === "kanban" && hit.linkedFile && hit.recurrence && taskMetaEnabled(cfg, hit)) {
			// Recurring card linked to a note: complete per-occurrence in the note's
			// frontmatter (complete_instances + next scheduled), TaskNotes-style.
			renderRecurringCheckbox(view, hit, today, textRow, refresh, hit.linkedFile);
		} else if (source === "kanban" && hit.line >= 0 && hit.recurrence && taskMetaEnabled(cfg, hit)) {
			// Recurring Kanban card: complete per-occurrence (stamp ✅ today, roll
			// the date forward) rather than retiring the card.
			renderLineRecurringCheckbox(view, hit, today, textRow, refresh);
		} else if (source === "kanban" && hit.line >= 0) {
			// Kanban cards are Markdown checkboxes: a checkbox toggles the card's
			// done state in place, independent of which column it's in.
			const check = textRow.createEl("input", {
				cls: "hearth-task-check",
				attr: { type: "checkbox" },
			});
			check.checked = hit.done;
			const stop = (e: Event) => e.stopPropagation();
			check.addEventListener("click", stop);
			check.addEventListener("mousedown", stop);
			check.addEventListener("pointerdown", stop);
			check.addEventListener("change", () => {
				void setKanbanCardDone(view, hit, check.checked, taskMetaEnabled(cfg, hit)).then((ok) => {
					if (!ok) new Notice(t().notices.taskChangedOnDisk);
					refresh();
				});
			});
		}
		const cardText = textRow.createDiv({ cls: "hearth-kanban-card-text" });
		fillTaskText(view, cardText, hit.text || hit.file.basename, hit.file.path);
			// Kanban priority shows as a single coloured dot inline with the title;
			// TaskNotes keeps its labelled chip in the meta row below.
			if (source === "kanban" && hit.priority) renderPriority(textRow, hit.priority, true);
			if (hit.description) renderTaskDescription(cardEl, hit.description);
			const meta = cardEl.createDiv("hearth-kanban-card-meta");
			if (source !== "kanban" && hit.priority) renderPriority(meta, hit.priority);
			renderTaskDateChips(meta, hit, today);
			const open = () => void openTask(view, cfg, hit, refresh);
			cardEl.addEventListener("click", open);
			makeClickable(cardEl, open, hit.text || hit.file.basename);
			// Line-based cards (Kanban cards and plain checkboxes) get the
			// right-click menu: edit metadata, plus convert/delete for Kanban.
			if (hit.line >= 0) attachKanbanCardMenu(view, cfg, hit, cardEl, refresh);
		}

		// Kanban source: a per-column "add card" affordance that appends a new
		// `- [ ]` item under this column's heading in the board note.
		if (source === "kanban") {
			renderKanbanAddCard(view, cfg, col.label, colBody, refresh, {
				extended: cfg.kanbanExtended ?? false,
				markDone: doneColumns.has(col.key),
			});
		}
	}
}

/** Render a compact "+ Add card" control at the bottom of a Kanban column. On
 * click it swaps to a small form: a text input plus, in extended mode, a due
 * date and priority picker whose values are written onto the card as
 * Tasks-plugin metadata (📅 / ⏫🔼🔽). Enter or clicking away commits, Escape
 * cancels. When the column is a "done column" the new card is added completed. */
function renderKanbanAddCard(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	colBody: HTMLElement,
	refresh: () => void,
	opts: { extended: boolean; markDone: boolean },
): void {
	const addBtn = colBody.createDiv({ cls: "hearth-kanban-add" });
	setIcon(addBtn.createSpan("hearth-kanban-add-icon"), "plus");
	addBtn.createSpan({ cls: "hearth-kanban-add-label", text: t().cards.tasks.addCard });
	addBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		addBtn.hide();
		const form = colBody.createDiv({ cls: "hearth-kanban-add-form" });
		const input = form.createEl("textarea", {
			cls: "hearth-kanban-add-input",
			attr: { rows: "1", placeholder: t().cards.tasks.addCardPlaceholder },
		});

		// Extended mode: dates and priority fields for the new card (the body /
		// description is handled separately below so it can preview the template).
		const readMeta = opts.extended
			? buildTaskDetailFields(form, emptyMeta(), "", false)
			: () => ({ meta: emptyMeta(), description: "" });

		// "Create as note" toggle (per-add; defaults to the card's setting).
		const noteLabel = form.createEl("label", { cls: "hearth-kanban-add-note" });
		const noteToggle = noteLabel.createEl("input", { attr: { type: "checkbox" } });
		noteToggle.checked = !!cfg.newTaskAsNote;
		noteLabel.createSpan({ text: t().cards.tasks.createAsNote });

		// Body / description field. When creating as a note it's the note body,
		// prefilled from the configured template so it's visible and editable
		// before the note is created; otherwise it's the card's inline description.
		const bodyWrap = form.createDiv({ cls: "hearth-taskdetail" });
		const bodyRow = bodyWrap.createDiv({ cls: "hearth-taskdetail-row is-description" });
		const bodyLabel = bodyRow.createSpan({ cls: "hearth-taskdetail-label" });
		const bodyArea = bodyRow.createEl("textarea", {
			cls: "hearth-taskdetail-desc",
			attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
		});

		let prefillText = "";
		const applyPrefill = () => {
			bodyLabel.setText(noteToggle.checked ? t().cards.tasks.noteBody : t().cards.tasks.description);
			// Keep the body field out of the way for a plain (non-extended) checkbox
			// add until the user opts into notes or extended metadata.
			if (opts.extended || noteToggle.checked) bodyWrap.show();
			else bodyWrap.hide();
			if (!prefillText) return;
			if (noteToggle.checked && !bodyArea.value.trim()) bodyArea.value = prefillText;
			else if (!noteToggle.checked && bodyArea.value === prefillText) bodyArea.value = "";
		};
		noteToggle.addEventListener("change", applyPrefill);
		applyPrefill();
		// Load the template body (if any) to preview it in the field.
		const templatePath = cfg.convertNoteTemplate?.trim();
		if (templatePath) {
			const tpl =
				view.app.vault.getAbstractFileByPath(templatePath) ??
				view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
			if (tpl instanceof TFile) {
				void view.app.vault.read(tpl).then((raw) => {
					prefillText = substituteConvertDateTime(raw);
					applyPrefill();
				});
			}
		}

		input.focus();
		let committed = false;
		const cancel = () => {
			if (committed) return;
			form.remove();
			addBtn.show();
		};
		const commit = () => {
			if (committed) return;
			const text = input.value.trim();
			if (!text) return cancel();
			committed = true;
			const meta = readMeta().meta;
			const body = bodyArea.value;
			const asNote = noteToggle.checked;
			const doneDate = opts.markDone && opts.extended ? moment().format("YYYY-MM-DD") : undefined;
			// "Create as note": create the card as its own note (a link) right away
			// instead of an inline checkbox.
			const add = asNote
				? addKanbanCardAsNote(view, cfg, heading, text, meta, body, opts.markDone, doneDate)
				: addKanbanCard(view, cfg, heading, text + buildMetadataSuffix(meta), opts.markDone, doneDate, body);
			void add.then((ok) => {
				if (!ok) new Notice(t().notices.couldNotAddKanbanCard);
				refresh();
			});
		};
		input.addEventListener("keydown", (ke) => {
			if (ke.key === "Enter" && !ke.shiftKey) {
				ke.preventDefault();
				commit();
			} else if (ke.key === "Escape") {
				ke.preventDefault();
				cancel();
			}
		});
		// Commit when focus truly leaves the form; cancel if nothing was typed.
		// Deferred so moving between the text/date/priority fields (and the
		// native date picker returning focus) doesn't commit early.
		form.addEventListener("focusout", () => {
			window.setTimeout(() => {
				if (committed || form.contains(form.ownerDocument.activeElement)) return;
				if (input.value.trim()) commit();
				else cancel();
			}, 0);
		});
		form.addEventListener("click", (ce) => ce.stopPropagation());
	});
}

/** An empty metadata set. */
function emptyMeta(): TaskMeta {
	return { priority: "", recurrence: "", start: "", scheduled: "", due: "" };
}

/** Build the Tasks-plugin metadata tail for a card (e.g. " ⏫ 🔁 every week 🛫
 * 2024-01-10 ⏳ 2024-01-12 📅 2024-01-15"). Emits markers in the Tasks-plugin's
 * conventional order; omits any blank field. */
function buildMetadataSuffix(meta: TaskMeta): string {
	const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
	let s = "";
	if (meta.priority && PRIORITY_EMOJI[meta.priority]) s += ` ${PRIORITY_EMOJI[meta.priority]}`;
	if (meta.recurrence.trim()) s += ` 🔁 ${meta.recurrence.trim()}`;
	if (isDate(meta.start)) s += ` 🛫 ${meta.start}`;
	if (isDate(meta.scheduled)) s += ` ⏳ ${meta.scheduled}`;
	if (isDate(meta.due)) s += ` 📅 ${meta.due}`;
	return s;
}

/** The repeat units offered by the deterministic recurrence picker, mapped to
 * the singular word the Tasks plugin expects ("every day/week/month/year"). */
const RECURRENCE_UNITS = ["day", "week", "month", "year"] as const;

/** Parse a Tasks-plugin recurrence string into the picker's {unit, interval}.
 * Handles "every day", "every week", "every 2 weeks", etc. Unknown/empty rules
 * yield unit "" (no recurrence). */
function parseRecurrence(rule: string): { unit: string; interval: number } {
	const m = /every\s+(\d+)?\s*(day|week|month|year)s?/i.exec(rule.trim());
	if (!m) return { unit: "", interval: 1 };
	return { unit: m[2].toLowerCase(), interval: Math.max(1, parseInt(m[1] ?? "1", 10) || 1) };
}

/** Build a Tasks-plugin recurrence string from the picker's {unit, interval}
 * (e.g. "every week", "every 2 weeks"). Empty unit means no recurrence. */
function buildRecurrence(unit: string, interval: number): string {
	if (!unit) return "";
	const n = Math.max(1, interval || 1);
	return n > 1 ? `every ${n} ${unit}s` : `every ${unit}`;
}

/** Build the shared task-detail fields (priority, repeat, and start/scheduled/
 * due dates) into `parent`, prefilled from `meta`, and return a getter for the
 * current values. Repeat and the dates are mutually exclusive: setting one
 * disables and clears the other. Used by both the Kanban add-card form and the
 * edit dialog. */
function buildTaskDetailFields(
	parent: HTMLElement,
	meta: TaskMeta,
	description: string,
	allowDescription = true,
): () => { meta: TaskMeta; description: string } {
	const grid = parent.createDiv({ cls: "hearth-taskdetail" });

	const row = (labelText: string) => {
		const r = grid.createDiv({ cls: "hearth-taskdetail-row" });
		r.createSpan({ cls: "hearth-taskdetail-label", text: labelText });
		return r;
	};

	const prioRow = row(t().cards.tasks.priority);
	const prio = prioRow.createEl("select", { cls: "hearth-taskdetail-input", attr: { "aria-label": t().cards.tasks.priority } });
	for (const [value, label] of [
		["", t().cards.tasks.priorityNone],
		["highest", t().cards.tasks.priorityHighest],
		["high", t().cards.tasks.priorityHigh],
		["medium", t().cards.tasks.priorityMedium],
		["low", t().cards.tasks.priorityLow],
		["lowest", t().cards.tasks.priorityLowest],
	] as const)
		prio.createEl("option", { value, text: label });
	prio.value = meta.priority;

	// Repeat: unit dropdown + interval number (deterministic, no free text).
	const parsed = parseRecurrence(meta.recurrence);
	const repeatRow = row(t().cards.tasks.recurrenceLabel);
	const repeatUnit = repeatRow.createEl("select", { cls: "hearth-taskdetail-input", attr: { "aria-label": t().cards.tasks.recurrenceLabel } });
	repeatUnit.createEl("option", { value: "", text: t().cards.tasks.recurrenceNever });
	for (const u of RECURRENCE_UNITS)
		repeatUnit.createEl("option", { value: u, text: t().cards.tasks.recurrenceUnits[u] });
	repeatUnit.value = parsed.unit;
	const repeatEvery = repeatRow.createSpan({ cls: "hearth-taskdetail-every", text: t().cards.tasks.recurrenceEvery });
	const repeatInterval = repeatRow.createEl("input", {
		cls: "hearth-taskdetail-interval",
		attr: { type: "number", min: "1", "aria-label": t().cards.tasks.recurrenceInterval },
	});
	repeatInterval.value = String(parsed.interval);

	const dateField = (emoji: string, label: string, value: string) => {
		const r = grid.createDiv({ cls: "hearth-taskdetail-row" });
		r.createSpan({ cls: "hearth-taskdetail-label", text: `${emoji} ${label}` });
		const inp = r.createEl("input", { cls: "hearth-taskdetail-input", attr: { type: "date", "aria-label": label } });
		inp.value = value;
		return inp;
	};
	const start = dateField("🛫", t().cards.tasks.startDate, meta.start);
	const scheduled = dateField("⏳", t().cards.tasks.scheduledDate, meta.scheduled);
	const due = dateField("📅", t().cards.tasks.dueDate, meta.due);
	// A repeating card is anchored by its scheduled date only; a fixed start/due
	// date is mutually exclusive with repeating. Don't show stale start/due
	// values beside an existing repeat.
	if (parsed.unit) {
		start.value = "";
		due.value = "";
	}

	const sync = () => {
		const repeating = repeatUnit.value !== "";
		const hasFixed = start.value !== "" || due.value !== "";
		start.disabled = repeating;
		due.disabled = repeating;
		repeatUnit.disabled = hasFixed;
		repeatInterval.disabled = hasFixed || !repeating;
		repeatEvery.toggleClass("is-disabled", hasFixed || !repeating);
	};
	repeatUnit.addEventListener("change", () => {
		if (repeatUnit.value !== "") {
			start.value = "";
			due.value = "";
		}
		sync();
	});
	[start, due].forEach((d) =>
		d.addEventListener("input", () => {
			if (d.value !== "") {
				repeatUnit.value = "";
				repeatInterval.value = "1";
			}
			sync();
		}),
	);
	sync();

	// Description: plain multiline text, stored as sub-bullets under the card.
	// Only offered where nested lines are a description (Kanban cards), not for
	// plain checkboxes whose nested lines may be sub-tasks.
	let descArea: HTMLTextAreaElement | null = null;
	if (allowDescription) {
		const descRow = grid.createDiv({ cls: "hearth-taskdetail-row is-description" });
		descRow.createSpan({ cls: "hearth-taskdetail-label", text: t().cards.tasks.description });
		descArea = descRow.createEl("textarea", {
			cls: "hearth-taskdetail-desc",
			attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
		});
		descArea.value = description;
	}

	return () => {
		const repeating = repeatUnit.value !== "";
		return {
			meta: {
				priority: prio.value,
				recurrence: repeating ? buildRecurrence(repeatUnit.value, parseInt(repeatInterval.value, 10)) : "",
				start: repeating ? "" : start.value,
				scheduled: scheduled.value,
				due: repeating ? "" : due.value,
			},
			description: descArea ? descArea.value : description,
		};
	};
}

/** A modal to edit a Kanban card's dates, priority and description via {@link
 * buildTaskDetailFields}, prefilled from the card; submits the new values. */
class TaskMetadataModal extends Modal {
	private read: (() => { meta: TaskMeta; description: string }) | null = null;
	constructor(
		app: App,
		private readonly initial: TaskMeta,
		private readonly initialDescription: string,
		private readonly allowDescription: boolean,
		private readonly onSubmit: (meta: TaskMeta, description: string) => void,
	) {
		super(app);
	}
	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("hearth-taskdetail-modal");
		contentEl.createEl("h3", { text: t().cards.tasks.editMetadata });
		this.read = buildTaskDetailFields(contentEl, this.initial, this.initialDescription, this.allowDescription);
		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						if (this.read) {
							const r = this.read();
							this.onSubmit(r.meta, r.description);
						}
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}
	onClose(): void {
		this.contentEl.empty();
	}
}

/** A compact quick-view for a line-based task, opened by clicking it: shows the
 * task title, its Tasks-plugin metadata and (for Kanban cards) description, and
 * offers to open the full note or delete the task. When the task's metadata is
 * managed (checkbox extended / Kanban extended) the fields are editable and a
 * Save button writes them back; otherwise the metadata is shown read-only. */
class TaskDetailModal extends Modal {
	private read: (() => { meta: TaskMeta; description: string }) | null = null;
	/** For a linked card, the editable description textarea (its content is
	 * written back to the note body on save). */
	private linkedDescArea: HTMLTextAreaElement | null = null;
	constructor(
		private readonly view: HomeView,
		private readonly cfg: TasksConfig,
		private readonly hit: TaskHit,
		private readonly refresh: () => void,
	) {
		super(view.app);
	}
	onOpen(): void {
		const { contentEl } = this;
		const { view, cfg, hit } = this;
		contentEl.addClass("hearth-taskdetail-modal");
		const isKanban = !!hit.boardColumn;
		const editable = taskMetaEnabled(cfg, hit);
		// A card linked to a note stores its metadata in that note's frontmatter
		// (edited here, written back there) and its description inside the note
		// body (edited in a textarea below the metadata, written back to the note).
		const linked = !!hit.linkedFile;

		const title = contentEl.createEl("h3", { cls: "hearth-taskdetail-title" });
		fillTaskText(view, title, hit.text || hit.file.basename, hit.file.path);

		if (editable) {
			const current: TaskMeta = {
				priority: priorityKey(hit.priority),
				recurrence: hit.recurrence ?? "",
				start: hit.start ?? "",
				scheduled: hit.scheduled ?? "",
				due: hit.due ?? "",
			};
			this.read = buildTaskDetailFields(contentEl, current, hit.description ?? "", isKanban && !linked);
			if (linked && hit.linkedFile) {
				// Description lives inside the linked note — edit it in its own
				// textarea, prefilled from the note body once it loads.
				const descWrap = contentEl.createDiv({ cls: "hearth-taskdetail" });
				const descRow = descWrap.createDiv({ cls: "hearth-taskdetail-row is-description" });
				descRow.createSpan({ cls: "hearth-taskdetail-label", text: t().cards.tasks.description });
				const area = descRow.createEl("textarea", {
					cls: "hearth-taskdetail-desc",
					attr: { rows: "3", placeholder: t().cards.tasks.descriptionPlaceholder },
				});
				this.linkedDescArea = area;
				void readNoteDescription(view, hit.linkedFile).then((desc) => {
					// Don't clobber edits the user already started typing.
					if (!area.value) area.value = desc;
				});
			}
		} else {
			// Read-only summary of whatever metadata the task carries (from the card
			// or, for a linked card, its note's frontmatter), plus its description.
			const today: string = moment().format("YYYY-MM-DD");
			const chips = contentEl.createDiv("hearth-taskdetail-readonly");
			if (hit.priority) renderPriority(chips, hit.priority);
			renderTaskDateChips(chips, hit, today);
			if (!chips.childNodes.length)
				chips.createSpan({ cls: "hearth-taskdetail-empty", text: t().cards.tasks.noMetadata });
			if (linked && hit.linkedFile) {
				const descHost = contentEl.createDiv();
				void readNoteDescription(view, hit.linkedFile).then((desc) => {
					if (desc) renderTaskDescription(descHost, desc);
				});
			} else if (hit.description) {
				renderTaskDescription(contentEl, hit.description);
			}
		}

		const actions = new Setting(contentEl);
		if (editable) {
			actions.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						if (this.read) {
							const r = this.read();
							const descArea = this.linkedDescArea;
							void (async () => {
								const ok = await setKanbanCardMetadata(view, hit, r.meta, r.description);
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
								// A linked card's description is written back to the note body.
								if (hit.linkedFile && descArea) await writeNoteDescription(view, hit.linkedFile, descArea.value);
								this.refresh();
							})();
						}
						this.close();
					}),
			);
		}
		actions.addButton((b) =>
			b
				.setButtonText(t().cards.tasks.openNote)
				.setIcon("file-symlink")
				.onClick(() => {
					this.close();
					void openTaskFile(view, hit);
				}),
		);
		actions.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().cards.tasks.deleteTask)
				.onClick(() => {
					confirmAction(view.app, {
						title: t().cards.tasks.deleteTask,
						message: t().cards.tasks.deleteTaskConfirm,
						confirmText: t().cards.tasks.deleteTask,
						onConfirm: () => {
							void deleteKanbanCard(view, hit).then((ok) => {
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
								this.refresh();
								this.close();
							});
						},
					});
				}),
		);
	}
	onClose(): void {
		this.contentEl.empty();
	}
}

/** Scan plain Markdown `- [ ]`/`- [x]` checkboxes in every in-scope note,
 * reading the full obsidian-tasks emoji metadata (priority, repeat, and the
 * start/scheduled/due/done dates) off each line — the same set the Kanban
 * source understands — so plain checkboxes get the same indicators, sorting and
 * editing. The metadata is stripped from the displayed text. When the card's
 * "Dates & priorities" toggle is off, checkboxes are read as plain text: the
 * emoji stay in the visible text and no dates/priority are parsed. */
async function collectCheckboxTasks(view: HomeView, cfg: TasksConfig): Promise<TaskHit[]> {
	const extended = cfg.checkboxExtended ?? true;
	const statuses = checkboxStatuses(cfg);
	// Symbols recognised as tasks: the configured ones, plus the always-valid
	// blank/done marks. Anything else inside `- [ ]` is left alone (so a stray
	// `- [1]` reference isn't mistaken for a task).
	const known = new Map(statuses.map((s) => [s.symbol.toLowerCase(), s]));
	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const content = await view.app.vault.cachedRead(file);
		const lines = content.split("\n");
		lines.forEach((line, i) => {
			const match = /^\s*[-*+]\s\[(.)\]\s*(.*)$/.exec(line);
			if (!match) return;
			const symbol = match[1];
			const st = known.get(symbol.toLowerCase());
			// Only known status symbols (or the built-in blank/done marks) count.
			if (!st && !/[ xX]/.test(symbol)) return;
			const raw = match[2].trim();
			if (!raw) return; // ignore empty checkboxes ("- [ ]")
			const done = st ? !!st.done : symbol.toLowerCase() === "x";
			if (!extended) {
				// Plain mode: keep the line's text verbatim, no metadata parsing.
				hits.push({
					file,
					line: i,
					text: raw,
					done,
					checkboxStatus: symbol,
					due: null,
					dueRaw: null,
					scheduled: null,
					start: null,
					doneDate: null,
					created: file.stat.ctime,
				});
				return;
			}
			// The due date accepts natural-language wording (today, next friday,
			// in 3 days, …) which we resolve to a date; the rest are ISO dates.
			const dueExpr = readEmojiField(raw, "📅");
			let due: string | null = null;
			let dueRaw: string | null = null;
			if (dueExpr) {
				dueRaw = dueExpr;
				due = /^\d{4}-\d{2}-\d{2}$/.test(dueExpr) ? dueExpr : parseNaturalDate(dueExpr);
			}
			hits.push({
				file,
				line: i,
				text: stripTaskMetadata(raw),
				done,
				checkboxStatus: symbol,
				due,
				dueRaw,
				scheduled: readEmojiDate(raw, "⏳") || null,
				start: readEmojiDate(raw, "🛫") || null,
				doneDate: readEmojiDate(raw, "✅") || null,
				created: file.stat.ctime,
				recurrence: readEmojiField(raw, "🔁") ?? undefined,
				priority: readPriorityEmoji(raw),
			});
		});
	}
	return hits;
}

/** Read TaskNotes task notes directly via frontmatter (see TasksConfig.source
 * doc for why: no stable public API, and field names are user-remappable).
 * Only files that actually have the configured status field are treated as
 * tasks, so unrelated notes with a `due` or `priority` property aren't
 * mistaken for one. */
/** Build a predicate deciding whether a TaskNotes status value counts as
 * complete. If the card lists its own complete statuses (`taskNotesDoneStatuses`,
 * e.g. "done" + "canceled") those win; otherwise the single global done value
 * (Settings → Hearth) is used. Comparison is case-insensitive. */
function doneStatusMatcher(cfg: TasksConfig, globalDoneValue: string): (status: string) => boolean {
	const custom = (cfg.taskNotesDoneStatuses ?? [])
		.map((v) => v.trim().toLowerCase())
		.filter(Boolean);
	const done = custom.length ? new Set(custom) : new Set([globalDoneValue.trim().toLowerCase() || "done"]);
	return (status: string) => done.has(status.trim().toLowerCase());
}

/** Coerce a frontmatter scalar to a string, treating missing, empty, or
 * non-scalar (object/array) values as absent. Guards against a YAML object
 * being rendered as the literal "[object Object]" in task metadata. */
function scalarField(v: unknown): string | undefined {
	if (typeof v === "string") return v || undefined;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	return undefined;
}

function collectTaskNotesTasks(view: HomeView, cfg: TasksConfig): TaskHit[] {
	const s = view.plugin.settings;
	const statusField = s.taskNotesStatusField.trim() || "status";
	const dueField = s.taskNotesDueField.trim() || "due";
	const priorityField = s.taskNotesPriorityField.trim() || "priority";
	// Which status values count as complete. A per-card list (e.g. "done" +
	// "canceled") overrides the single global done value; otherwise fall back to
	// that global value alone.
	const isDone = doneStatusMatcher(cfg, s.taskNotesDoneValue);

	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const cache = view.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || !(statusField in fm)) continue;
		const status = String(fm[statusField] ?? "");
		const dueRawVal: unknown = fm[dueField];
		// TaskNotes stores due as YYYY-MM-DD by convention, but users may have
		// written a natural-language date — resolve either to YYYY-MM-DD and
		// keep the raw wording for display.
		let due: string | null = null;
		let dueRaw: string | null = null;
		if (typeof dueRawVal === "string" && dueRawVal.trim()) {
			const expr = dueRawVal.trim();
			dueRaw = expr;
			due = /^\d{4}-\d{2}-\d{2}$/.test(expr) ? expr : parseNaturalDate(expr);
		}
		// TaskNotes' scheduled field is conventionally "scheduled"; read it as
		// a fallback sort key when no due date is set.
		const scheduledRaw: unknown = fm["scheduled"];
		const scheduled: string | null = typeof scheduledRaw === "string" ? scheduledRaw : null;
		const priority = scalarField(fm[priorityField]);
		// TaskNotes stores the recurrence rule in a "recurrence" frontmatter
		// field (an RRULE like "FREQ=WEEKLY;INTERVAL=1" or "RRULE:FREQ=DAILY").
		const recurrence = scalarField(fm["recurrence"]);
		// TaskNotes records each completed occurrence of a recurring task as a
		// YYYY-MM-DD entry in "complete_instances". Read it so the completion
		// checkbox can reflect today's state and avoid double-completing.
		const ciRaw: unknown = fm["complete_instances"];
		const completeInstances: string[] = Array.isArray(ciRaw)
			? ciRaw.map((v) => String(v)).filter(Boolean)
			: [];
		hits.push({
			file,
			line: -1,
			text: String(fm.title ?? file.basename),
			done: isDone(status),
			due,
			dueRaw,
			scheduled,
			created: file.stat.ctime,
			recurrence,
			completeInstances,
			status,
			priority,
		});
	}
	return hits;
}

// ---- Kanban plugin board -------------------------------------------------

/** Resolve the Kanban board note for a card. Prefers the explicitly configured
 * `kanbanFile` path; otherwise auto-detects the first in-scope note whose
 * frontmatter carries the `kanban-plugin` key the Kanban plugin writes. */
function resolveKanbanFile(view: HomeView, cfg: TasksConfig): TFile | null {
	const path = cfg.kanbanFile?.trim();
	if (path) {
		const f = view.app.vault.getAbstractFileByPath(path);
		return f instanceof TFile ? f : null;
	}
	for (const file of view.app.vault.getMarkdownFiles()) {
		if (!inTaskScope(file.path, cfg)) continue;
		const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm && KANBAN_FRONTMATTER_KEY in fm) return file;
	}
	return null;
}

/** Parse a Kanban board's `##` headings into ordered columns with the line
 * range that holds each column's cards. Frontmatter and the trailing
 * `%% kanban:settings` block are excluded. `footerStart` marks where the
 * settings block begins (or EOF), so callers never write past the cards. */
function parseKanbanColumns(lines: string[]): { columns: KanbanColumn[]; footerStart: number } {
	let footerStart = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (KANBAN_SETTINGS_RE.test(lines[i])) {
			footerStart = i;
			break;
		}
	}
	// Skip YAML frontmatter so a `---` fence isn't mistaken for content.
	let start = 0;
	if (lines[0]?.trim() === "---") {
		for (let i = 1; i < footerStart; i++) {
			if (lines[i].trim() === "---") {
				start = i + 1;
				break;
			}
		}
	}
	const columns: KanbanColumn[] = [];
	for (let i = start; i < footerStart; i++) {
		const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
		if (!m) continue;
		if (columns.length) columns[columns.length - 1].endLine = i;
		columns.push({ heading: m[1].trim(), headingLine: i, endLine: footerStart });
	}
	return { columns, footerStart };
}

/** The checkbox-item pattern shared by the Kanban parser (a card is a plain
 * Markdown task item, same as a checkbox task). The status char may be any
 * single character so custom statuses (`[/]`, `[-]`, …) are handled too. */
const KANBAN_CARD_RE = /^\s*[-*+]\s\[(.)\]\s*(.*)$/;

/** The extent of a Kanban card starting at `cardLine`: its item line plus any
 * deeper-indented, non-blank continuation lines (the card's description). `end`
 * is the exclusive line after the block; `descLines` is the continuation text
 * with its indentation and any list marker stripped. */
function cardBlockRange(lines: string[], cardLine: number): { end: number; descLines: string[] } {
	const indent = (/^(\s*)/.exec(lines[cardLine])?.[1] ?? "").length;
	const descLines: string[] = [];
	let end = cardLine + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		descLines.push(l.replace(/^\s*(?:[-*+]\s+)?/, ""));
		end++;
	}
	return { end, descLines };
}

/** Build the nested description bullet lines for a card whose item line has the
 * given indent (each non-empty description line becomes an indented `- ` item,
 * one level deeper). */
function descriptionBullets(description: string, itemIndent: string): string[] {
	return description
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => `${itemIndent}\t- ${l}`);
}

/** If `text` is essentially a single link to a note (`[[Note]]`, `[[Note|alias]]`
 * or `[alias](Note.md)`) — the shape "Convert to note" leaves on the board —
 * return the resolved note, else null. */
function soleLinkedNote(view: HomeView, text: string, sourcePath: string): TFile | null {
	const s = text.trim();
	let target: string | null = null;
	const wiki = /^\[\[([^\]]+?)\]\]$/.exec(s);
	if (wiki) {
		target = wiki[1].split("|")[0].trim();
	} else {
		const md = /^\[[^\]]*\]\(([^)]+?)\)$/.exec(s);
		if (md) {
			try {
				target = decodeURIComponent(md[1].trim());
			} catch {
				target = md[1].trim();
			}
		}
	}
	if (!target) return null;
	// Drop any heading/block anchor and a trailing ".md" so linkpath resolution
	// matches whether the link was written as a path or a bare basename.
	target = target.replace(/[#^].*$/, "").replace(/\.md$/i, "").trim();
	if (!target) return null;
	const f = view.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	return f instanceof TFile ? f : null;
}

/** Read a linked note's body (frontmatter stripped) as plain description lines,
 * with any leading list marker removed. Joined with "\n"; empty when the note
 * has no body. Used to show a converted card's description "inside the note". */
async function readNoteDescription(view: HomeView, file: TFile): Promise<string> {
	let content: string;
	try {
		content = await view.app.vault.cachedRead(file);
	} catch {
		return "";
	}
	const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	return body
		.split(/\r?\n/)
		.map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim())
		.filter(Boolean)
		.join("\n");
}

/** Write a linked note's description (the body below its frontmatter) from the
 * quick-view editor: keeps the frontmatter intact and replaces the body with the
 * edited lines as bullet points. */
async function writeNoteDescription(view: HomeView, file: TFile, description: string): Promise<void> {
	try {
		const content = await view.app.vault.read(file);
		const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content)?.[0] ?? "";
		const bullets = description
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => `- ${l}`)
			.join("\n");
		const next = fm ? (bullets ? `${fm.replace(/\r?\n?$/, "\n")}\n${bullets}\n` : fm) : bullets ? `${bullets}\n` : "";
		await view.app.vault.modify(file, next);
	} catch {
		new Notice(t().notices.taskChangedOnDisk);
	}
}

/** Read a Kanban board note: each `##` heading is a column and each checkbox
 * item beneath it is a card. In extended mode the Tasks-plugin emoji metadata
 * (📅 due, ⏫/🔼/🔽 priority, 🔁 recurrence) is parsed off each card so due dates
 * and priorities display and sort; otherwise cards are read as-is (plain text).
 * Returns the ordered columns too, so the Kanban layout can show empty lanes. */
async function collectKanbanTasks(
	view: HomeView,
	cfg: TasksConfig,
): Promise<{ hits: TaskHit[]; columns: KanbanColumn[]; file: TFile | null }> {
	const file = resolveKanbanFile(view, cfg);
	if (!file) return { hits: [], columns: [], file: null };
	const content = await view.app.vault.cachedRead(file);
	const lines = content.split("\n");
	const { columns } = parseKanbanColumns(lines);
	const extended = cfg.kanbanExtended ?? false;
	const hits: TaskHit[] = [];
	for (const col of columns) {
		let i = col.headingLine + 1;
		while (i < col.endLine) {
			const m = KANBAN_CARD_RE.exec(lines[i]);
			if (!m) {
				i++;
				continue;
			}
			const { end, descLines } = cardBlockRange(lines, i);
			const rawText = m[2].trim();
			if (!rawText) {
				// Ignore empty checkboxes ("- [ ]") and skip past their block.
				i = end;
				continue;
			}
			let text = rawText;
			let due: string | null = null;
			let dueRaw: string | null = null;
			let scheduled: string | null = null;
			let start: string | null = null;
			let doneDate: string | null = null;
			let priority: string | undefined;
			let recurrence: string | undefined;
			if (extended) {
				const dueExpr = readEmojiField(rawText, "📅");
				if (dueExpr) {
					dueRaw = dueExpr;
					due = /^\d{4}-\d{2}-\d{2}$/.test(dueExpr) ? dueExpr : parseNaturalDate(dueExpr);
				}
				scheduled = readEmojiDate(rawText, "⏳") || null;
				start = readEmojiDate(rawText, "🛫") || null;
				doneDate = readEmojiDate(rawText, "✅") || null;
				priority = readPriorityEmoji(rawText);
				recurrence = readEmojiField(rawText, "🔁") ?? undefined;
				text = stripTaskMetadata(rawText);
			}
			// A card that is just a link to a note (as "Convert to note" produces)
			// is treated as that note: metadata missing from the card is read from
			// the note's frontmatter so it still shows and sorts, and "open note"
			// opens the linked note.
			const linkedFile = soleLinkedNote(view, extended ? text : stripTaskMetadata(rawText), file.path);
			let completeInstances: string[] | undefined;
			if (extended && linkedFile) {
				const fm = view.app.metadataCache.getFileCache(linkedFile)?.frontmatter;
				if (fm) {
					const fmStr = (k: string): string | null => {
						const v: unknown = fm[k];
						return typeof v === "string" && v.trim() ? v.trim() : null;
					};
					if (!due) {
						const d = fmStr("due");
						if (d) {
							dueRaw = d;
							due = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : parseNaturalDate(d);
						}
					}
					scheduled = scheduled || fmStr("scheduled");
					start = start || fmStr("start");
					doneDate = doneDate || fmStr("done");
					const fmPrio = fmStr("priority");
					if (!priority && fmPrio) priority = PRIORITY_EMOJI[fmPrio] ?? fmPrio;
					recurrence = recurrence || fmStr("recurrence") || undefined;
					const ci: unknown = fm["complete_instances"];
					if (Array.isArray(ci)) completeInstances = ci.map((v) => String(v)).filter(Boolean);
				}
			}
			hits.push({
				file,
				line: i,
				text,
				done: m[1].toLowerCase() === "x",
				due,
				dueRaw,
				scheduled,
				start,
				doneDate,
				created: file.stat.ctime,
				recurrence,
				priority,
				boardColumn: col.heading,
				description: descLines.join("\n"),
				linkedFile,
				completeInstances,
			});
			i = end;
		}
	}
	return { hits, columns, file };
}

/** The Tasks-plugin priority emoji present on a card (highest→lowest), or
 * undefined. Returned raw; priorityLevel()/renderPriority() map it to a level
 * and show it as the label. */
function readPriorityEmoji(text: string): string | undefined {
	const m = /[🔺⏫🔼🔽⏬]/u.exec(text);
	return m ? m[0] : undefined;
}

/** Tasks-plugin priority keys, in descending order, mapped to their emoji. */
const PRIORITY_EMOJI: Record<string, string> = {
	highest: "🔺",
	high: "⏫",
	medium: "🔼",
	low: "🔽",
	lowest: "⏬",
};

/** The priority key ("high", "lowest", …) for a raw priority value — an emoji
 * (⏫) or a word ("high") — or "" when none/unrecognized. Used to prefill the
 * editor and to round-trip the emoji through the pickers. */
function priorityKey(priority: string | undefined): string {
	if (!priority) return "";
	for (const [key, emoji] of Object.entries(PRIORITY_EMOJI)) {
		if (priority === emoji || priority.toLowerCase() === key) return key;
	}
	// Fall back to the coarse level for words like "urgent"/"minor".
	const level = priorityLevel(priority);
	return level === "other" ? "" : level;
}

/** Every Tasks-plugin metadata emoji marker, used to strip metadata from a
 * card's display text and to compare cards ignoring their metadata. */
const TASK_EMOJI_CLASS = "📅⏳🛫🔁✅❌➕⏫🔼🔽🔺⏬";

/** The subset of metadata emoji Hearth's editor manages (due/scheduled/start/
 * recurrence/priority). Completion (✅), created (➕) and cancelled (❌) markers
 * are left untouched when rewriting a card's metadata. */
const MANAGED_EMOJI_CLASS = "📅⏳🛫🔁⏫🔼🔽🔺⏬";

/** Read a Tasks-plugin date field (e.g. 📅) and resolve it to YYYY-MM-DD, or
 * "" when absent/unparseable. Accepts natural-language wording. */
function readEmojiDate(text: string, emoji: string): string {
	const expr = readEmojiField(text, emoji);
	if (!expr) return "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(expr)) return expr;
	return parseNaturalDate(expr) ?? "";
}

/** Strip all Tasks-plugin emoji metadata (each marker and its trailing value up
 * to the next marker) from a task's text, collapsing leftover whitespace. Used
 * for clean Kanban card display and for stable text comparison on writeback
 * (idempotent, so a raw and an already-stripped text compare equal). */
function stripTaskMetadata(text: string): string {
	const re = new RegExp(`[${TASK_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	return text.replace(re, "").replace(/\s+/g, " ").trim();
}

/** Add or remove the Tasks-plugin done-date marker (✅ YYYY-MM-DD) on a card's
 * text: any existing ✅ field is dropped, then today's is appended when `done`.
 * Used to keep the completion date in sync as cards are checked/unchecked. */
function withDoneDate(text: string, done: boolean, today: string): string {
	const re = new RegExp(`✅[^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = text.replace(re, "").replace(/\s+/g, " ").trim();
	return done ? `${base} ✅ ${today}`.trim() : base;
}

/** Set (or, when null, remove) a Tasks-plugin date field (e.g. 📅/⏳/🛫) on a
 * task's text to `date`, replacing any existing value for that marker. */
function withEmojiDate(text: string, emoji: string, date: string | null): string {
	const re = new RegExp(`${emoji}[^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = text.replace(re, "").replace(/\s+/g, " ").trim();
	return date ? `${base} ${emoji} ${date}`.trim() : base;
}

/** Complete (or un-complete) the current occurrence of a recurring checkbox /
 * Kanban task in place, TaskNotes-style: the line stays unchecked (a recurring
 * task never retires) but on completion its ✅ done date is stamped to today and
 * its reference date (📅 due, else ⏳ scheduled, else 🛫 start) rolls forward to
 * the next occurrence — so it reads as done today and resets to open on its next
 * date. Un-completing removes today's ✅ and rolls the reference date back to
 * today. Bails (false) when the stored line no longer matches. */
async function setLineRecurringInstanceDone(
	view: HomeView,
	hit: TaskHit,
	done: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const today: string = moment().format("YYYY-MM-DD");
	const rule = hit.recurrence ?? readEmojiField(m[2], "🔁") ?? "";
	// The reference date the recurrence advances: due first, then scheduled, then
	// start (whichever the card carries).
	const refEmoji = readEmojiField(m[2], "📅")
		? "📅"
		: readEmojiField(m[2], "⏳")
			? "⏳"
			: readEmojiField(m[2], "🛫")
				? "🛫"
				: null;
	let body = withDoneDate(m[2], false, today); // strip any existing ✅ first
	if (done) {
		if (refEmoji) {
			const curRef = readEmojiDate(m[2], refEmoji);
			// Advance from whichever is later — the card's date or today — so a
			// same-day or overdue occurrence lands on a future date.
			const from = curRef && curRef > today ? curRef : today;
			const next = nextRecurrenceDate(rule, from);
			if (next) body = withEmojiDate(body, refEmoji, next);
		}
		body = `${body} ✅ ${today}`.trim();
	} else if (refEmoji) {
		// Restore the occurrence being un-completed to today.
		body = withEmojiDate(body, refEmoji, today);
	}
	// A recurring task never retires its line — keep the checkbox unchecked so it
	// stays open; today's completion is tracked by the ✅ date instead.
	const prefix = cur
		.slice(0, cur.length - m[2].length)
		.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre} ${post}`);
	lines[hit.line] = `${prefix}${body}`.trimEnd();
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Flip a Kanban card's checkbox to `done` in place, and — in extended mode —
 * add/remove its ✅ done date to match. Bails (false) if the stored line no
 * longer matches the card. */
async function setKanbanCardDone(
	view: HomeView,
	hit: TaskHit,
	done: boolean,
	extended: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const marker = cur
		.slice(0, cur.length - m[2].length)
		.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}${done ? "x" : " "}${post}`);
	const body = extended ? withDoneDate(m[2], done, moment().format("YYYY-MM-DD")) : m[2];
	lines[hit.line] = `${marker}${body}`;
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Move a Kanban card's checkbox line (plus any nested continuation lines) out
 * of its current column and under `targetHeading` in the board note. The card's
 * done state normally stays as-is (column and completion are independent), but
 * when `markDone` is set — the target is a "done column" — the card is checked
 * as it lands. Bails (returning false) if the stored line no longer matches. */
async function moveKanbanCard(
	view: HomeView,
	hit: TaskHit,
	targetHeading: string,
	markDone?: boolean,
	doneDate?: string,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m) return false; // line changed under us
	if (stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;

	// Capture the card block: the item line plus any deeper-indented, non-blank
	// continuation lines (nested content that belongs to the card).
	const indent = (/^(\s*)/.exec(cur)?.[1] ?? "").length;
	let end = hit.line + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		end++;
	}
	const block = lines.slice(hit.line, end);
	if (markDone) {
		const bm = KANBAN_CARD_RE.exec(block[0]);
		const bodyMarker = block[0]
			.slice(0, block[0].length - (bm?.[2].length ?? 0))
			.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}x${post}`);
		const body = doneDate && bm ? withDoneDate(bm[2], true, doneDate) : bm?.[2] ?? "";
		block[0] = `${bodyMarker}${body}`;
	}
	// Also drop one trailing blank line so blanks don't accumulate on each move.
	let removeEnd = end;
	if (lines[removeEnd]?.trim() === "") removeEnd++;
	lines.splice(hit.line, removeEnd - hit.line);

	if (!insertCardBlock(lines, targetHeading, block)) return false;
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Append a new card under `heading` in the configured board note, checked when
 * `markDone` (the target is a "done column") and unchecked otherwise. Any
 * `description` is written as plain-text sub-bullets under the card. */
async function addKanbanCard(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	text: string,
	markDone?: boolean,
	doneDate?: string,
	description?: string,
): Promise<boolean> {
	const file = resolveKanbanFile(view, cfg);
	if (!file) return false;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	let body = text.replace(/\r?\n/g, " ").trim();
	if (markDone && doneDate) body = withDoneDate(body, true, doneDate);
	const block = [`- [${markDone ? "x" : " "}] ${body}`, ...descriptionBullets(description ?? "", "")];
	if (!insertCardBlock(lines, heading, block)) return false;
	await view.app.vault.modify(file, lines.join("\n"));
	return true;
}

/** Add a new Kanban card as its own note (a link on the board) instead of an
 * inline checkbox — the same result as adding a card and immediately converting
 * it, honouring the card's convert-to-note template and metadata-to-frontmatter
 * options. Creates the note (template + description bullets, and frontmatter
 * metadata when scraping), then inserts a link card into `heading`'s column. */
async function addKanbanCardAsNote(
	view: HomeView,
	cfg: TasksConfig,
	heading: string,
	title: string,
	meta: TaskMeta,
	noteBody: string,
	markDone?: boolean,
	doneDate?: string,
): Promise<boolean> {
	const board = resolveKanbanFile(view, cfg);
	if (!board) return false;
	const safeTitle =
		(title || "Untitled").replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
	let note: TFile;
	try {
		const parent = view.app.fileManager.getNewFileParent(board.path);
		const folder = parent instanceof TFolder ? parent : view.app.vault.getRoot();
		note = await view.app.fileManager.createNewMarkdownFile(folder, safeTitle);
	} catch {
		return false;
	}
	// The note body is whatever the add form assembled (a template preview the
	// user may have edited, or plain text) with {{title}} resolved now.
	const body = applyConvertTemplate(noteBody ?? "", safeTitle).replace(/\s+$/, "");
	if (body) await view.app.vault.modify(note, `${body}\n`);

	// Metadata: to the note's frontmatter when scraping, else onto the board link
	// as emoji markers (matching convert-to-note).
	const scrape = cfg.convertMetadataToFrontmatter ?? false;
	if (scrape) {
		await writeMetadataFrontmatter(view, note, meta);
		if (markDone && doneDate) {
			try {
				await view.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
					fm["done"] = doneDate;
				});
			} catch {
				// Frontmatter write failed — the note and link are still created.
			}
		}
	}

	const content = await view.app.vault.read(board);
	const lines = content.split("\n");
	const link = view.app.fileManager.generateMarkdownLink(note, board.path);
	let cardBody = link;
	if (!scrape) {
		cardBody = `${link}${buildMetadataSuffix(meta)}`;
		if (markDone && doneDate) cardBody = withDoneDate(cardBody, true, doneDate);
	}
	const block = [`- [${markDone ? "x" : " "}] ${cardBody}`.trimEnd()];
	if (!insertCardBlock(lines, heading, block)) return false;
	await view.app.vault.modify(board, lines.join("\n"));
	return true;
}

/** Mark a batch of Kanban cards (all in the same board note) done in a single
 * write, stamping the ✅ done date when `doneDate` is given. Skips any line that
 * no longer matches its card. Used when a column is toggled into a "done
 * column" so the cards already in it complete at once. */
async function markCardsDone(view: HomeView, hits: TaskHit[], doneDate?: string): Promise<void> {
	if (!hits.length) return;
	const file = hits[0].file;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	let changed = false;
	for (const hit of hits) {
		const line = lines[hit.line];
		const m = line != null ? KANBAN_CARD_RE.exec(line) : null;
		if (!m) continue;
		if (stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) continue;
		const marker = line
			.slice(0, line.length - m[2].length)
			.replace(CHECKBOX_MARKER, (_x, pre: string, _s: string, post: string) => `${pre}x${post}`);
		const body = doneDate ? withDoneDate(m[2], true, doneDate) : m[2];
		lines[hit.line] = `${marker}${body}`;
		changed = true;
	}
	if (changed) await view.app.vault.modify(file, lines.join("\n"));
}

/** Attach a right-click menu to a task row/card. Every metadata-capable task
 * (Kanban cards, and plain checkboxes — which always read their marks) offers
 * "Edit dates & priority"; Kanban cards additionally offer convert-to-note and
 * delete. Kanban cards get a description field in the editor; checkboxes don't
 * (their nested lines may be sub-tasks, not a description). */
function attachKanbanCardMenu(
	view: HomeView,
	cfg: TasksConfig,
	hit: TaskHit,
	el: HTMLElement,
	refresh: () => void,
): void {
	const isKanban = !!hit.boardColumn;
	// Metadata editing is offered wherever the marks are managed (checkboxes by
	// default, Kanban cards in extended mode). A card linked to a note edits its
	// note's frontmatter instead of the board line (handled in setKanbanCardMetadata).
	const canEditMeta = taskMetaEnabled(cfg, hit);
	// Nothing to show for a plain checkbox with metadata off — leave the native
	// context menu alone rather than popping an empty one.
	if (!canEditMeta && !isKanban) return;
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const menu = new Menu();
		if (canEditMeta) {
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.editMetadata)
					.setIcon("calendar-clock")
					.onClick(() => {
						const current: TaskMeta = {
							priority: priorityKey(hit.priority),
							recurrence: hit.recurrence ?? "",
							start: hit.start ?? "",
							scheduled: hit.scheduled ?? "",
							due: hit.due ?? "",
						};
						// A linked card's description lives in its note, so only its
						// metadata (frontmatter) is editable here.
						new TaskMetadataModal(view.app, current, hit.description ?? "", isKanban && !hit.linkedFile, (meta, description) => {
							void setKanbanCardMetadata(view, hit, meta, description).then((ok) => {
								if (!ok) new Notice(t().notices.taskChangedOnDisk);
								refresh();
							});
						}).open();
					}),
			);
		}
		if (isKanban) {
			// A card already linked to a note has nothing to convert.
			if (!hit.linkedFile) {
				menu.addItem((item) =>
					item
						.setTitle(t().cards.tasks.convertToNote)
						.setIcon("file-output")
						.onClick(() => void convertKanbanCardToNote(view, cfg, hit).then(refresh)),
				);
			}
			menu.addItem((item) =>
				item
					.setTitle(t().cards.tasks.deleteCard)
					.setIcon("trash-2")
					.onClick(() => {
						void deleteKanbanCard(view, hit).then((ok) => {
							if (!ok) new Notice(t().notices.taskChangedOnDisk);
							refresh();
						});
					}),
			);
		}
		menu.showAtMouseEvent(e);
	});
}

/** Render task text into `el`, turning `[[wikilinks]]` and `[label](url)` into
 * clickable links (the rest stays plain text). Link clicks open the target and
 * stop propagation so they don't also trigger the card's open-on-click. */
function fillTaskText(view: HomeView, el: HTMLElement, text: string, sourcePath: string): void {
	const re = /\[\[([^\]]+?)\]\]|\[([^\]]+?)\]\(([^)]+?)\)/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) el.appendText(text.slice(last, m.index));
		if (m[1] != null) {
			const [target, alias] = m[1].split("|");
			const link = el.createSpan({ cls: "hearth-task-link", text: (alias ?? target).trim() });
			link.addEventListener("click", (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
				void view.app.workspace.openLinkText(target.trim(), sourcePath, false);
			});
		} else {
			const link = el.createSpan({ cls: "hearth-task-link", text: m[2] });
			const url = m[3];
			link.addEventListener("click", (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
				if (/^https?:\/\//i.test(url)) window.open(url, "_blank");
				else void view.app.workspace.openLinkText(url, sourcePath, false);
			});
		}
		last = re.lastIndex;
	}
	if (last < text.length) el.appendText(text.slice(last));
	if (!el.childNodes.length) el.appendText(text);
}

/** Set (or clear) a Kanban card's due date and priority, rewriting the card
 * line's Tasks-plugin metadata in place while preserving its text and any link.
 * `due` is "" to clear; `priority` is "high"/"medium"/"low" or "" to clear. */
async function setKanbanCardMetadata(
	view: HomeView,
	hit: TaskHit,
	meta: TaskMeta,
	description: string,
): Promise<boolean> {
	// A card linked to a note keeps its metadata in that note's frontmatter —
	// edits are written there, not onto the board link.
	if (hit.linkedFile) return writeMetadataFrontmatter(view, hit.linkedFile, meta);
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	// Strip the managed markers (priority/recurrence/start/scheduled/due and
	// their values) from the card text, leaving ✅/➕/❌ untouched, then re-append
	// the new markers.
	const managedRe = new RegExp(`[${MANAGED_EMOJI_CLASS}][^\\n\\r${TASK_EMOJI_CLASS}]*`, "gu");
	const base = m[2].replace(managedRe, "").replace(/\s+/g, " ").trim();
	const itemIndent = /^(\s*)/.exec(cur)?.[1] ?? "";
	const prefix = cur.slice(0, cur.length - m[2].length);
	const newItem = `${prefix}${base}${buildMetadataSuffix(meta)}`.trimEnd();
	if (hit.boardColumn) {
		// Kanban card: replace the item line and its old description sub-bullets
		// with the new item line and freshly-built description bullets.
		const { end } = cardBlockRange(lines, hit.line);
		lines.splice(hit.line, end - hit.line, newItem, ...descriptionBullets(description, itemIndent));
	} else {
		// Plain checkbox: rewrite only the item line, leaving any nested lines
		// (which may be sub-tasks, not a description) untouched.
		lines[hit.line] = newItem;
	}
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Delete a Kanban card (its checkbox line plus any nested continuation lines,
 * and one trailing blank line) from the board note. Bails if the stored line no
 * longer matches the card. */
async function deleteKanbanCard(view: HomeView, hit: TaskHit): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) return false;
	const indent = (/^(\s*)/.exec(cur)?.[1] ?? "").length;
	let end = hit.line + 1;
	while (end < lines.length) {
		const l = lines[end];
		if (l.trim() === "") break;
		if ((/^(\s*)/.exec(l)?.[1] ?? "").length <= indent) break;
		end++;
	}
	let removeEnd = end;
	if (lines[removeEnd]?.trim() === "") removeEnd++;
	lines.splice(hit.line, removeEnd - hit.line);
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Swap a Kanban column's title span for an inline text input to rename it.
 * Enter (or blur) commits, Escape cancels; the header's drag is suspended while
 * editing so text selection doesn't start a column drag. */
function startColumnRename(
	view: HomeView,
	cfg: TasksConfig,
	head: HTMLElement,
	titleEl: HTMLElement,
	oldLabel: string,
	refresh: () => void,
): void {
	const wasDraggable = head.getAttribute("draggable");
	head.setAttribute("draggable", "false");
	titleEl.hide();
	const input = head.createEl("input", {
		cls: "hearth-kanban-col-rename",
		attr: { type: "text", "aria-label": t().cards.tasks.renameColumnHint },
	});
	head.insertBefore(input, titleEl);
	input.value = oldLabel;
	input.focus();
	input.select();
	let done = false;
	const cleanup = () => {
		input.remove();
		titleEl.show();
		if (wasDraggable != null) head.setAttribute("draggable", wasDraggable);
	};
	const commit = () => {
		if (done) return;
		done = true;
		const next = input.value.trim();
		cleanup();
		if (next && next !== oldLabel) void renameKanbanColumn(view, cfg, oldLabel, next).then(refresh);
	};
	const cancel = () => {
		if (done) return;
		done = true;
		cleanup();
	};
	input.addEventListener("keydown", (ke) => {
		if (ke.key === "Enter") {
			ke.preventDefault();
			commit();
		} else if (ke.key === "Escape") {
			ke.preventDefault();
			cancel();
		}
	});
	input.addEventListener("blur", commit);
	// Keep clicks/drags on the input from bubbling to the header's handlers.
	for (const type of ["mousedown", "click", "dblclick", "pointerdown"])
		input.addEventListener(type, (e) => e.stopPropagation());
}

/** Rename a Kanban board column: rewrite its `## heading` line and remap the
 * card's stored column keys (order/hidden/done) from the old to the new key. */
async function renameKanbanColumn(
	view: HomeView,
	cfg: TasksConfig,
	oldHeading: string,
	newHeading: string,
): Promise<void> {
	const file = resolveKanbanFile(view, cfg);
	if (!file) return;
	const content = await view.app.vault.read(file);
	const lines = content.split("\n");
	const { columns } = parseKanbanColumns(lines);
	const col = columns.find((c) => c.heading === oldHeading);
	if (!col) return;
	lines[col.headingLine] = `## ${newHeading}`;
	await view.app.vault.modify(file, lines.join("\n"));
	// Remap the lowercased column keys the config stores.
	const oldKey = oldHeading.toLowerCase();
	const newKey = newHeading.toLowerCase();
	const remap = (arr: string[] | undefined) => arr?.map((k) => (k === oldKey ? newKey : k));
	cfg.kanbanOrder = remap(cfg.kanbanOrder);
	cfg.kanbanHidden = remap(cfg.kanbanHidden);
	cfg.kanbanDoneColumns = remap(cfg.kanbanDoneColumns);
	await view.plugin.saveData(view.plugin.settings);
}

/** Convert a Kanban card into its own note (like the Kanban plugin): create a
 * note in the user's default new-note location named after the card, then
 * replace the card's text with a link to it — preserving the checkbox state and
 * any Tasks-plugin metadata tail. */
async function convertKanbanCardToNote(view: HomeView, cfg: TasksConfig, hit: TaskHit): Promise<void> {
	const board = hit.file;
	const content = await view.app.vault.read(board);
	const lines = content.split("\n");
	const cur = lines[hit.line];
	const m = cur != null ? KANBAN_CARD_RE.exec(cur) : null;
	if (!m || stripTaskMetadata(m[2]) !== stripTaskMetadata(hit.text)) {
		new Notice(t().notices.taskChangedOnDisk);
		return;
	}
	// Sanitise the card title for use as a filename.
	const title = (stripTaskMetadata(m[2]) || "Untitled").replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
	// The card's nested lines are its description — they move into the note (as
	// bullet points), not left orphaned on the board.
	const { end, descLines } = cardBlockRange(lines, hit.line);
	let note: TFile;
	try {
		const parent = view.app.fileManager.getNewFileParent(board.path);
		const folder = parent instanceof TFolder ? parent : view.app.vault.getRoot();
		note = await view.app.fileManager.createNewMarkdownFile(folder, title);
	} catch {
		new Notice(t().notices.couldNotConvertCard);
		return;
	}
	// Seed the note body: an optional template (Obsidian-core-style
	// {{title}}/{{date}}/{{time}} substitution) followed by the card's
	// description as bullet points. A missing/unreadable template is skipped
	// rather than aborting the convert.
	const bodyParts: string[] = [];
	const templatePath = cfg.convertNoteTemplate?.trim();
	if (templatePath) {
		const tpl =
			view.app.vault.getAbstractFileByPath(templatePath) ??
			view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				bodyParts.push(applyConvertTemplate(await view.app.vault.read(tpl), title));
			} catch {
				// Template unreadable — carry on without it.
			}
		}
	}
	if (descLines.length) bodyParts.push(descLines.map((l) => `- ${l.trim()}`).join("\n"));
	if (bodyParts.length) await view.app.vault.modify(note, bodyParts.join("\n\n"));

	// Optionally scrape the card's Tasks-plugin metadata into the note's YAML
	// frontmatter (read straight off the card text so it works even when the
	// card wasn't parsed in extended mode). When scraping, the metadata now
	// lives in the note, so the emoji tail is dropped from the board link.
	const scrape = cfg.convertMetadataToFrontmatter ?? false;
	if (scrape) await writeTaskFrontmatter(view, note, m[2]);

	const link = view.app.fileManager.generateMarkdownLink(note, board.path);
	const meta = scrape ? "" : extractMetadataTail(m[2]);
	// Everything before the card's text (indent + `- [x] `) is preserved; the
	// card's description lines are removed from the board (they moved into the
	// note), leaving just the link line.
	const prefix = cur.slice(0, cur.length - m[2].length);
	lines.splice(hit.line, end - hit.line, `${prefix}${link}${meta ? ` ${meta}` : ""}`);
	await view.app.vault.modify(board, lines.join("\n"));
}

/** Substitute the note-template variables supported for convert-to-note:
 * {{title}}, {{date}}, {{time}} and their {{date:FMT}}/{{time:FMT}} formatted
 * variants (mirrors the daily-note template substitution). */
function applyConvertTemplate(raw: string, title: string): string {
	const now = moment();
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, now.format("YYYY-MM-DD"))
		.replace(/\{\{\s*time\s*\}\}/gi, now.format("HH:mm"))
		.replace(/\{\{\s*title\s*\}\}/gi, title);
}

/** Substitute only the date/time template variables (leaving {{title}} for when
 * the card's title is known at create time). Used to preview a template's body
 * in the add-card form. */
function substituteConvertDateTime(raw: string): string {
	const now = moment();
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => now.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, now.format("YYYY-MM-DD"))
		.replace(/\{\{\s*time\s*\}\}/gi, now.format("HH:mm"));
}

/** Write a card's Tasks-plugin metadata (read from its raw text) into a note's
 * YAML frontmatter, using conventional keys (priority, due, scheduled, start,
 * done, recurrence). Only fields the card actually carries are written; merges
 * with any frontmatter a template already added. */
async function writeTaskFrontmatter(view: HomeView, note: TFile, rawText: string): Promise<void> {
	const priority = priorityKey(readPriorityEmoji(rawText));
	const due = readEmojiDate(rawText, "📅");
	const scheduled = readEmojiDate(rawText, "⏳");
	const start = readEmojiDate(rawText, "🛫");
	const done = readEmojiDate(rawText, "✅");
	const recurrence = readEmojiField(rawText, "🔁");
	try {
		await view.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
			if (priority) fm["priority"] = priority;
			if (due) fm["due"] = due;
			if (scheduled) fm["scheduled"] = scheduled;
			if (start) fm["start"] = start;
			if (done) fm["done"] = done;
			if (recurrence) fm["recurrence"] = recurrence;
		});
	} catch {
		// Frontmatter write failed — the link and note are still created.
	}
}

/** Write edited task metadata into a note's YAML frontmatter, using the same
 * conventional keys convert-to-note scrapes to (priority/recurrence/start/
 * scheduled/due). Empty fields are removed. Used when editing a converted
 * (linked) card's metadata from the quick view or right-click editor. */
async function writeMetadataFrontmatter(view: HomeView, file: TFile, meta: TaskMeta): Promise<boolean> {
	const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
	try {
		await view.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const set = (k: string, v: string) => {
				if (v) fm[k] = v;
				else delete fm[k];
			};
			set("priority", meta.priority);
			set("recurrence", meta.recurrence.trim());
			set("start", isDate(meta.start) ? meta.start : "");
			set("scheduled", isDate(meta.scheduled) ? meta.scheduled : "");
			set("due", isDate(meta.due) ? meta.due : "");
		});
	} catch {
		return false;
	}
	return true;
}

/** The substring of a card's text from its first Tasks-plugin metadata emoji to
 * the end (trimmed), or "" when the card carries no metadata. Used to keep
 * due/priority markers on the card when its text is replaced with a link. */
function extractMetadataTail(text: string): string {
	const idx = text.search(new RegExp(`[${TASK_EMOJI_CLASS}]`, "u"));
	return idx >= 0 ? text.slice(idx).trim() : "";
}

/** Insert a card block after the last existing card in the named column (or
 * right after the heading when the column is empty), keeping a blank line
 * before whatever follows. Mutates `lines`. Returns false if the column heading
 * isn't found. */
function insertCardBlock(lines: string[], heading: string, block: string[]): boolean {
	const { columns } = parseKanbanColumns(lines);
	const target = columns.find((c) => c.heading === heading);
	if (!target) return false;
	let insertAt = target.headingLine + 1;
	for (let i = target.headingLine + 1; i < target.endLine; i++) {
		if (KANBAN_CARD_RE.test(lines[i])) insertAt = i + 1;
	}
	// When the column is empty, skip a blank line right under the heading so the
	// card sits directly below it rather than after the gap.
	if (insertAt === target.headingLine + 1 && lines[insertAt]?.trim() === "") insertAt++;
	const toInsert = [...block];
	if (lines[insertAt] != null && lines[insertAt].trim() !== "") toInsert.push("");
	lines.splice(insertAt, 0, ...toInsert);
	return true;
}

/** Read the value of a Tasks-plugin emoji field from a checkbox line, e.g.
 * `📅 tomorrow` or `📅 2024-01-15`. Returns the trimmed value up to the next
 * known emoji marker or end of line, or null when the marker isn't present. */
function readEmojiField(text: string, emoji: string): string | null {
	const idx = text.indexOf(emoji);
	if (idx < 0) return null;
	let rest = text.slice(idx + emoji.length);
	// Stop at the next emoji marker (any of the Tasks-plugin conventions).
	const next = rest.search(new RegExp(`[${TASK_EMOJI_CLASS}]`, "u"));
	if (next >= 0) rest = rest.slice(0, next);
	const value = rest.trim();
	return value || null;
}

/** The checkbox marker at the start of a list item, capturing the state char so
 * only that bracket is flipped (never a stray "[x]" elsewhere in the text). The
 * state char may be any single character to support custom statuses. */
const CHECKBOX_MARKER = /^(\s*[-*+]\s\[)(.)(\])/;


/** Set a checkbox task's status symbol in place (used when a checkbox card is
 * dragged between the board's status columns). Only the leading `[·]` marker is
 * changed; when metadata is managed the ✅ done date is stamped for a done status
 * and cleared otherwise. Returns false when the stored line no longer matches. */
async function setCheckboxSymbol(
	view: HomeView,
	hit: TaskHit,
	symbol: string,
	done: boolean,
	extended: boolean,
): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const line = lines[hit.line];
	const match = line != null ? CHECKBOX_MARKER.exec(line) : null;
	if (!match) return false;
	const rest = line.slice(match[0].length);
	if (stripTaskMetadata(rest) !== stripTaskMetadata(hit.text)) return false;
	const marker = line
		.slice(0, match[0].length)
		.replace(CHECKBOX_MARKER, (_m, pre: string, _state: string, post: string) => `${pre}${symbol}${post}`);
	const body = extended ? withDoneDate(rest, done, moment().format("YYYY-MM-DD")) : rest;
	lines[hit.line] = `${marker}${body}`.trimEnd();
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Write a TaskNotes task's status frontmatter field (used by the Kanban board
 * when a card is dragged to another status column). */
async function setTaskNotesStatus(view: HomeView, hit: TaskHit, value: string): Promise<void> {
	const field = view.plugin.settings.taskNotesStatusField.trim() || "status";
	try {
		await view.app.fileManager.processFrontMatter(hit.file, (fm) => {
			fm[field] = value;
		});
	} catch {
		new Notice(t().notices.couldNotUpdateTaskStatus);
	}
}

/** Compute the next occurrence date (YYYY-MM-DD) of a TaskNotes recurrence
 * rule strictly after `fromDate` (YYYY-MM-DD). Handles the common FREQ values
 * (DAILY/WEEKLY/MONTHLY/YEARLY) with INTERVAL and BYDAY; weeks are aligned to
 * the rule's DTSTART so a "weekly on Monday, every 1 week" anchored on a
 * Monday keeps landing on Mondays. Returns null when the rule can't be parsed
 * or no occurrence is found within a sane horizon (~2 years). */
function nextOccurrence(rule: string, fromDate: string): string | null {
	if (!rule || !fromDate) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const dtRaw = /DTSTART[:=](\d{8})/i.exec(r)?.[1];
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toUpperCase();
	if (!freq) return null;
	const interval = Math.max(1, parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10) || 1);
	const bydayRaw = /BYDAY=([A-Z,]+)/i.exec(r)?.[1];
	const dtstart = dtRaw
		? moment(`${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`)
		: null;
	const from = moment(fromDate);
	const wdMap: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
	const weekdays = bydayRaw
		? bydayRaw
				.split(",")
				.map((d) => wdMap[d.trim().toUpperCase()] ?? -1)
				.filter((w) => w >= 0)
		: dtstart
			? [dtstart.day()]
			: [];

	const cursor = from.clone().add(1, "day");
	const limit = 730;
	for (let i = 0; i < limit; i++) {
		const daysSince = dtstart ? cursor.diff(dtstart, "days") : 0;
		if (daysSince < 0) {
			cursor.add(1, "day");
			continue;
		}
		if (freq === "DAILY") {
			if (daysSince % interval === 0) return cursor.format("YYYY-MM-DD");
		} else if (freq === "WEEKLY") {
			if (weekdays.length === 0) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			} else if (weekdays.includes(cursor.day())) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "MONTHLY") {
			if (dtstart && cursor.date() === dtstart.date()) {
				const monthsSince =
					(cursor.year() - dtstart.year()) * 12 + (cursor.month() - dtstart.month());
				if (monthsSince >= 0 && monthsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "YEARLY") {
			if (
				dtstart &&
				cursor.date() === dtstart.date() &&
				cursor.month() === dtstart.month()
			) {
				const yearsSince = cursor.year() - dtstart.year();
				if (yearsSince >= 0 && yearsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		}
		cursor.add(1, "day");
	}
	return null;
}

/** Next occurrence strictly after `fromDate` for either an RRULE ("FREQ=…") or
 * a Tasks-plugin "every N unit" recurrence string (e.g. "every 2 weeks"), as
 * YYYY-MM-DD. Null when the rule is empty or unparseable. Used to roll a
 * recurring checkbox/Kanban task's date forward as each occurrence completes. */
function nextRecurrenceDate(rule: string, fromDate: string): string | null {
	if (!rule || !fromDate) return null;
	if (/FREQ=/i.test(rule)) return nextOccurrence(rule, fromDate);
	const { unit, interval } = parseRecurrence(rule);
	if (!unit) return null;
	return moment(fromDate).add(interval, unit).format("YYYY-MM-DD");
}

/** Mark today's occurrence of a recurring TaskNotes task complete the way
 * TaskNotes does: append today's YYYY-MM-DD to `complete_instances` (deduped,
 * kept sorted) and advance `scheduled` to the next occurrence derived from the
 * recurrence rule. The task's `status` is left untouched — a recurring task
 * stays open and just rolls forward to its next due date. */
async function completeRecurringInstance(view: HomeView, hit: TaskHit, targetFile?: TFile): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	const next = nextRecurrenceDate(hit.recurrence, today);
	try {
		await view.app.fileManager.processFrontMatter(targetFile ?? hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v))
				: [];
			if (!instances.includes(today)) {
				instances.push(today);
				instances.sort();
				fm["complete_instances"] = instances;
			}
			if (next) {
				fm["scheduled"] = timeMatch ? `${next}T${timeMatch[1]}` : next;
			}
		});
	} catch {
		new Notice(t().notices.couldNotCompleteRecurring);
	}
}

/** Undo today's completion of a recurring TaskNotes task: remove today from
 * `complete_instances` and roll `scheduled` back to today (the occurrence we
 * just un-completed). Used when the user unchecks the box to cancel a
 * mistaken completion. */
async function uncompleteRecurringInstance(view: HomeView, hit: TaskHit, targetFile?: TFile): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	try {
		await view.app.fileManager.processFrontMatter(targetFile ?? hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v)).filter((d) => d !== today)
				: [];
			fm["complete_instances"] = instances;
			// Restore the occurrence date the checkbox represents (today),
			// keeping any time component the task already had.
			fm["scheduled"] = timeMatch ? `${today}T${timeMatch[1]}` : today;
		});
	} catch {
		new Notice(t().notices.couldNotUndoRecurring);
	}
}

/** Render a small checkbox that completes today's occurrence of a recurring
 * TaskNotes task on check, and undoes it on uncheck (removes today from
 * complete_instances and rolls scheduled back to today). Pre-checked when
 * today is already in complete_instances. Stops propagation so it never
 * triggers the row/card click or drag. Rendered as the first child of `parent`
 * so it sits before the task text. */
function renderRecurringCheckbox(
	view: HomeView,
	hit: TaskHit,
	today: string,
	parent: HTMLElement,
	refresh: () => void,
	targetFile?: TFile,
): void {
	const check = parent.createEl("input", {
		cls: "hearth-task-check hearth-task-check-recurring",
		attr: { type: "checkbox", "aria-label": t().cards.tasks.markOccurrence },
	});
	// Move it to the very front so it leads the task text regardless of what
	// the caller appends afterwards.
	parent.insertBefore(check, parent.firstChild);
	check.checked = (hit.completeInstances ?? []).includes(today);
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		const wasChecked = (hit.completeInstances ?? []).includes(today);
		if (check.checked && !wasChecked) {
			void completeRecurringInstance(view, hit, targetFile).then(refresh);
		} else if (!check.checked && wasChecked) {
			void uncompleteRecurringInstance(view, hit, targetFile).then(refresh);
		} else {
			// State already matches the data — keep the checkbox in sync.
			check.checked = wasChecked;
		}
	});
}

/** Render the per-occurrence completion checkbox for a recurring checkbox /
 * Kanban task (one carrying a 🔁 mark). Checked when the task's ✅ done date is
 * today; checking stamps today and rolls the reference date to the next
 * occurrence, unchecking undoes it — so it resets to open on its next date.
 * Rendered as the first child of `parent`. */
function renderLineRecurringCheckbox(
	view: HomeView,
	hit: TaskHit,
	today: string,
	parent: HTMLElement,
	refresh: () => void,
): void {
	const check = parent.createEl("input", {
		cls: "hearth-task-check hearth-task-check-recurring",
		attr: { type: "checkbox", "aria-label": t().cards.tasks.markOccurrence },
	});
	parent.insertBefore(check, parent.firstChild);
	check.checked = hit.doneDate === today;
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		void setLineRecurringInstanceDone(view, hit, check.checked).then((ok) => {
			if (!ok) new Notice(t().notices.taskChangedOnDisk);
			refresh();
		});
	});
}

/** Best-effort: open a TaskNotes task in TaskNotes' own editor rather than the
 * raw Markdown note. TaskNotes exposes no stable public API, so this tries a
 * couple of plausible instance/api methods and returns whether one handled it;
 * the caller falls back to opening the file when it didn't. */
function openInTaskNotes(view: HomeView, file: TFile): boolean {
	const plugin = view.app.plugins.plugins[TASKNOTES_PLUGIN_ID] as
		| Record<string, unknown>
		| undefined;
	if (!plugin) return false;
	const targets: unknown[] = [plugin, plugin.api];
	for (const target of targets) {
		if (!target || typeof target !== "object") continue;
		const obj = target as Record<string, unknown>;
		for (const method of ["openTaskEditModal", "openTask"]) {
			const fn = obj[method];
			if (typeof fn === "function") {
				try {
					(fn as (f: TFile) => void).call(obj, file);
					return true;
				} catch {
					// Wrong signature or internal error — fall through to file open.
				}
			}
		}
	}
	return false;
}

async function openTask(view: HomeView, cfg: TasksConfig, hit: TaskHit, refresh: () => void): Promise<void> {
	// Line-based tasks (checkboxes / Kanban cards) open a compact quick-view by
	// default — metadata + description with open-note / delete actions — instead
	// of jumping straight into the file. TaskNotes tasks (whole-file, no line)
	// keep opening in their own editor. Storing `taskQuickView: false` restores
	// the old open-on-click behaviour.
	if (hit.line >= 0 && (cfg.taskQuickView ?? true)) {
		new TaskDetailModal(view, cfg, hit, refresh).open();
		return;
	}
	await openTaskFile(view, hit);
}

/** Open a task's underlying file: TaskNotes tasks in TaskNotes' own editor when
 * possible, otherwise the note, scrolled to the task's line for line-based
 * tasks. */
async function openTaskFile(view: HomeView, hit: TaskHit): Promise<void> {
	// A card that links to a note opens that note directly (not the board line).
	if (hit.linkedFile) {
		await view.app.workspace.getLeaf(true).openFile(hit.linkedFile);
		return;
	}
	// TaskNotes tasks (no line) open in TaskNotes' own editor when possible.
	if (hit.line < 0 && openInTaskNotes(view, hit.file)) return;

	const leaf = view.app.workspace.getLeaf(true);
	await leaf.openFile(hit.file);
	if (hit.line >= 0 && leaf.view instanceof MarkdownView) {
		const pos = { line: hit.line, ch: 0 };
		leaf.view.editor.setCursor(pos);
		leaf.view.editor.scrollIntoView({ from: pos, to: pos }, true);
	}
}

// ---- Clock / greeting ---------------------------------------------------

/** Time-of-day buckets used to pick a fitting greeting. */
function greetingBucket(hour: number): number {
	if (hour < 5) return 0; // late night
	if (hour < 8) return 1; // early morning
	if (hour < 12) return 2; // morning
	if (hour < 17) return 3; // afternoon
	if (hour < 22) return 4; // evening
	return 5; // night
}

function pickGreeting(hour: number, playful: boolean): string {
	if (!playful) {
		return hour < 12 ? t().clock.greetingMorning : hour < 18 ? t().clock.greetingAfternoon : t().clock.greetingEvening;
	}
	const pool = t().clock.playfulGreetings[greetingBucket(hour)];
	return pool[Math.floor(Math.random() * pool.length)];
}

function formatClockDate(now: Date, mode: NonNullable<ClockConfig["dateMode"]>, custom?: string): string {
	switch (mode) {
		case "short":
			return now.toLocaleDateString(undefined, { dateStyle: "short" });
		case "long":
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
		case "iso": {
			const iso: string = moment(now).format("YYYY-MM-DD");
			return iso;
		}
		case "weekday":
			return now.toLocaleDateString(undefined, { weekday: "long" });
		case "custom": {
			const formatted: string = custom?.trim() ? moment(now).format(custom) : "";
			return formatted;
		}
		case "full":
		default:
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
	}
}

function svgEl(parent: Element, tag: string, attrs: Record<string, string>, cls?: string): SVGElement {
	const el = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	if (cls) el.setAttribute("class", cls);
	parent.appendChild(el);
	return el;
}

/** Draw an analogue clock face and return a tick() to rotate its hands. */
function renderAnalogClock(wrap: HTMLElement, cfg: ClockConfig): (now: Date) => void {
	const svg = svgEl(wrap, "svg", { viewBox: "0 0 100 100" }, "hearth-analog");
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "48" }, "hearth-analog-face");
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		const major = i % 3 === 0;
		const r1 = major ? 38 : 42;
		svgEl(
			svg,
			"line",
			{
				x1: String(50 + Math.sin(a) * r1),
				y1: String(50 - Math.cos(a) * r1),
				x2: String(50 + Math.sin(a) * 46),
				y2: String(50 - Math.cos(a) * 46),
			},
			major ? "hearth-analog-tick-major" : "hearth-analog-tick",
		);
	}
	const hand = (cls: string, length: number) =>
		svgEl(svg, "line", { x1: "50", y1: "50", x2: "50", y2: String(50 - length) }, cls);
	const hourHand = hand("hearth-analog-hour", 26);
	const minHand = hand("hearth-analog-min", 38);
	const secHand = cfg.showSeconds ? hand("hearth-analog-sec", 42) : null;
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "2.5" }, "hearth-analog-pin");

	const rotate = (el: SVGElement, deg: number) =>
		el.setAttribute("transform", `rotate(${deg} 50 50)`);

	return (now: Date) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		const h = now.getHours() % 12;
		rotate(hourHand, (h + m / 60) * 30);
		rotate(minHand, (m + s / 60) * 6);
		if (secHand) rotate(secHand, s * 6);
	};
}

function renderClock(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.clock ?? {};
	const showGreeting = cfg.showGreeting !== false;
	const dateMode = cfg.dateMode ?? "full";
	const analog = cfg.mode === "analog";

	const wrap = body.createDiv("hearth-clock");
	const greetingEl = showGreeting ? wrap.createDiv("hearth-clock-greeting") : null;

	// Pick the greeting once per time bucket so playful ones don't flicker.
	let bucket = -1;
	const refreshGreeting = (hour: number) => {
		if (!greetingEl) return;
		const override = cfg.greetingText?.trim();
		if (override) {
			greetingEl.setText(override);
			return;
		}
		if (greetingBucket(hour) === bucket) return;
		bucket = greetingBucket(hour);
		greetingEl.setText(pickGreeting(hour, cfg.playfulGreetings ?? false));
	};

	const tickAnalog = analog ? renderAnalogClock(wrap, cfg) : null;
	const timeEl = analog ? null : wrap.createDiv("hearth-clock-time");
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");

	const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	if (cfg.use24Hour) timeOpts.hour12 = false;
	if (cfg.showSeconds) timeOpts.second = "2-digit";

	const update = () => {
		const now = new Date();
		refreshGreeting(now.getHours());
		if (tickAnalog) tickAnalog(now);
		if (timeEl) timeEl.setText(now.toLocaleTimeString(undefined, timeOpts));
		if (dateEl) dateEl.setText(formatClockDate(now, dateMode, cfg.dateFormat));
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}
