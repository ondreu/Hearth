import { Command, Component, debounce, Platform, setIcon, TAbstractFile, TFile, TFolder } from "obsidian";
import type { HomeView } from "./view";
import { FILE_TYPE_GROUPS, FileTypeGroup, fileTypeLabel, groupForFile, iconForFile, OTHER_GROUP_ID } from "./filetypes";
import { QueryFilter, QueryHit, runQuery, searchFileContents } from "./query";
import { isOmnisearchAvailable, searchWithOmnisearch } from "./omnisearch";
import { t } from "./i18n";

/** Recently opened-via-search files, kept in the vault's local storage (never
 * in settings/data.json) so it stays out of the settings UI and layout
 * export entirely — a quiet convenience, not a feature to configure. */
const HISTORY_KEY = "hearth-search-history";
const HISTORY_MAX = 6;

const MAX_RESULTS = 40;
/** A leading ">" switches the bar to command mode (run any command). */
const COMMAND_PREFIX = ">";

let resultsIdSeq = 0;

/**
 * The search field + auto-detected file-type filter chips + results dropdown.
 * Searches the whole vault (Obsidian's vault index already excludes the
 * .obsidian config folder). A leading "#" searches tags, "key:value" searches
 * frontmatter, ">" runs commands; otherwise names/paths (and, optionally, note
 * bodies) are matched.
 */
export class SearchSection {
	private view: HomeView;
	private activeFilter: string | null = null;

	private inputEl!: HTMLInputElement;
	private resultsEl!: HTMLElement;
	private resultsId = `hearth-results-${resultsIdSeq++}`;
	/** The whole search section (bar + results + filters) — used to decide when
	 * a click counts as "outside" and should close the dropdown. */
	private rootEl: HTMLElement | null = null;
	private rows: { el: HTMLElement; open: () => void }[] = [];
	private selected = -1;
	/** Bumped on every query so a slow async content search can't render results
	 * for a query the user has already moved on from. */
	private generation = 0;

	constructor(view: HomeView) {
		this.view = view;
	}

	// resetTimer=true so it fires once typing pauses, not 140ms after the first key.
	private updateDebounced = debounce(() => this.update(), 140, true);

	/** Renders the search bar (icon + input). The caller places the New-note
	 * button beside the returned bar element. */
	renderBar(parent: HTMLElement): HTMLElement {
		const bar = parent.createDiv("hearth-search-bar");
		const icon = bar.createDiv("hearth-search-icon");
		setIcon(icon, "search");

		this.inputEl = bar.createEl("input", {
			cls: "hearth-search-input",
			attr: {
				type: "text",
				placeholder: this.view.plugin.settings.searchPlaceholder || t().search.placeholder,
				spellcheck: "false",
				role: "combobox",
				"aria-expanded": "false",
				"aria-autocomplete": "list",
				"aria-controls": this.resultsId,
			},
		});

		// Typing is debounced so large vaults aren't re-scanned on every keystroke;
		// focus (which just offers recent files) stays instant.
		this.inputEl.addEventListener("input", () => this.updateDebounced());
		this.inputEl.addEventListener("focus", () => this.update());
		this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));

		// On mobile, focusing the field pops the on-screen keyboard. Flag it
		// directly (don't rely only on the visualViewport size heuristic, which
		// misfires on some devices) so CSS can hide the action bar and anchor the
		// search to the top — otherwise the buttons slide over the field and the
		// results list ends up behind the keyboard.
		if (Platform.isMobile) {
			const root = this.view.contentEl;
			this.inputEl.addEventListener("focus", () => {
				root.addClass("hearth-search-active");
				// Pull the field to the top of the scroll area once the keyboard has
				// animated up, so the results dropdown below it lands in the visible
				// area above the keyboard instead of behind it. The delay lets the
				// viewport settle first; the CSS anchor handles the rest immediately.
				window.setTimeout(() => {
					if (root.ownerDocument.activeElement === this.inputEl) {
						this.inputEl.scrollIntoView({ block: "start" });
						// The field just moved to the top of the visible area; re-cap
						// the dropdown to the freed space so its rows aren't left
						// tucked behind the keyboard.
						this.capResultsToViewport();
					}
				}, 300);
			});
			this.inputEl.addEventListener("blur", () => {
				// Delay so a tap that lands on a result fires before the layout
				// shifts back (blur precedes the result's click on the same tap).
				window.setTimeout(() => {
					if (root.ownerDocument.activeElement !== this.inputEl) {
						root.removeClass("hearth-search-active");
					}
				}, 200);
			});
		}

		return bar;
	}

	/** Renders the results dropdown (as an overlay inside `overlayParent`, which
	 * must be positioned) and the filter chip row (under `boundary`). `boundary`
	 * wraps the whole search section and is the click-outside dismissal area. */
	renderResultsAndFilters(
		overlayParent: HTMLElement,
		boundary: HTMLElement,
		component: Component,
	): void {
		this.rootEl = boundary;
		this.resultsEl = overlayParent.createDiv("hearth-search-results");
		this.resultsEl.id = this.resultsId;
		this.resultsEl.setAttribute("role", "listbox");
		this.resultsEl.hide();
		this.renderFilters(boundary);

		// Close the dropdown when clicking outside the whole search section.
		// Registered on the per-render component (not the long-lived view) so it's
		// torn down on every re-render instead of accumulating a stale listener
		// each time the view is rebuilt.
		component.registerDomEvent(this.view.containerEl.ownerDocument, "click", (e) => {
			if (!boundary.contains(e.target as Node)) this.hide();
		});

		// On mobile the on-screen keyboard resizes the visual viewport as it
		// animates in/out; keep the open dropdown re-capped to whatever space is
		// left above it so its rows never disappear behind the keyboard.
		const vv = window.visualViewport;
		if (Platform.isMobile && vv) {
			const reposition = () => this.capResultsToViewport();
			vv.addEventListener("resize", reposition);
			vv.addEventListener("scroll", reposition);
			component.register(() => {
				vv.removeEventListener("resize", reposition);
				vv.removeEventListener("scroll", reposition);
			});
		}
	}

	// ---- Filters --------------------------------------------------------

	private detectGroups(): FileTypeGroup[] {
		const present = new Set<string>();
		let hasFolders = false;
		let hasOther = false;
		// Every discoverable file-type group except "folders" (tracked separately);
		// once all of these plus a folder have been seen, nothing further can turn
		// a chip on, so the whole-vault scan can stop early.
		const allNonFolderGroups = FILE_TYPE_GROUPS.length - 1;
		for (const f of this.view.app.vault.getAllLoadedFiles()) {
			if (f instanceof TFolder) {
				if (f.path !== "/") hasFolders = true;
				continue;
			}
			const g = groupForFile(f);
			if (g) present.add(g.id);
			// "Other" is the catch-all: only show it when there's at least one
			// file that didn't match a more specific group.
			if (!g || g.id === OTHER_GROUP_ID) hasOther = true;
			if (hasFolders && present.size >= allNonFolderGroups) break;
		}
		const hidden = new Set(this.view.plugin.settings.hiddenFilters);
		return FILE_TYPE_GROUPS.filter((g) => {
			if (hidden.has(g.id)) return false;
			if (g.id === "folders") return hasFolders;
			if (g.id === OTHER_GROUP_ID) return hasOther;
			return present.has(g.id);
		});
	}

	private renderFilters(parent: HTMLElement): void {
		const groups = this.detectGroups();
		if (groups.length === 0) return;

		const row = parent.createDiv("hearth-filters");
		for (const group of groups) {
			const chip = row.createDiv("hearth-filter");
			chip.toggleClass("is-active", this.activeFilter === group.id);
			setIcon(chip.createDiv("hearth-filter-icon"), group.icon);
			chip.setAttribute("aria-label", fileTypeLabel(group));
			chip.setAttribute("role", "button");
			chip.setAttribute("tabindex", "0");
			chip.setAttribute("aria-pressed", String(this.activeFilter === group.id));
			const toggle = () => {
				this.activeFilter = this.activeFilter === group.id ? null : group.id;
				parent.querySelectorAll(".hearth-filter").forEach((c) => {
					c.removeClass("is-active");
					c.setAttribute("aria-pressed", "false");
				});
				const on = this.activeFilter === group.id;
				chip.toggleClass("is-active", on);
				chip.setAttribute("aria-pressed", String(on));
				this.update();
				// On desktop, refocus the field for quick typing; on mobile this
				// would pop the on-screen keyboard and cover the results, so skip.
				if (!Platform.isMobile) this.inputEl.focus();
			};
			chip.addEventListener("click", toggle);
			chip.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggle();
				}
			});
		}
	}

	// ---- Searching ------------------------------------------------------

	private update(): void {
		const raw = this.inputEl.value;
		const query = raw.trim();
		this.generation++;

		// Command mode: a leading ">" runs any command-palette command.
		if (query.startsWith(COMMAND_PREFIX)) {
			this.renderCommandRows(this.searchCommands(query.slice(1).trim()));
			return;
		}

		if (!query && !this.activeFilter) {
			this.renderHistory();
			return;
		}

		const filter: QueryFilter = {
			includeFolders: !this.activeFilter || this.activeFilter === "folders",
			includeFiles: this.activeFilter !== "folders",
			groupId: this.activeFilter && this.activeFilter !== "folders" ? this.activeFilter : null,
		};

		// Omnisearch mode: hand plain queries to the Omnisearch plugin instead of
		// the built-in engine. It only runs when the plugin is actually available;
		// otherwise (and for tag/property syntax, which Omnisearch doesn't use) we
		// fall through to the built-in search below.
		if (
			this.view.plugin.settings.searchEngine === "omnisearch" &&
			query &&
			isOmnisearchAvailable(this.view.app)
		) {
			this.runOmnisearch(query, filter);
			return;
		}

		const hits = runQuery(this.view.app, query, { filter, limit: MAX_RESULTS });
		this.renderFileRows(hits);

		// Full-text body search runs after the instant name results and appends
		// any note whose body matched but whose name didn't. Guarded by generation
		// so a stale async result never overwrites a newer query's results.
		if (this.view.plugin.settings.searchContents && query && !this.activeFilter) {
			const gen = this.generation;
			const exclude = new Set(hits.map((h) => h.file.path));
			void searchFileContents(this.view.app, query, {
				exclude,
				limit: Math.max(0, MAX_RESULTS - hits.length),
			}).then((extra) => {
				if (gen !== this.generation || extra.length === 0) return;
				this.renderFileRows([...hits, ...extra]);
			});
		}
	}

	/** Query Omnisearch and render its results. Guarded by generation so a slow
	 * response can't overwrite a newer query the user has already moved on to. */
	private runOmnisearch(query: string, filter: QueryFilter): void {
		const gen = this.generation;
		void searchWithOmnisearch(this.view.app, query, { filter, limit: MAX_RESULTS }).then(
			(hits) => {
				if (gen !== this.generation) return;
				this.renderFileRows(hits);
			},
		);
	}

	/** With nothing typed, quietly offer recently opened files instead of an
	 * empty dropdown — reuses the exact same result row so it looks like an
	 * ordinary result, not a distinct "history" feature. */
	private renderHistory(): void {
		const files = this.getHistory()
			.map((p) => this.view.app.vault.getAbstractFileByPath(p))
			.filter((f): f is TFile => f instanceof TFile);
		if (files.length === 0) {
			this.hide();
			return;
		}
		this.renderFileRows(files.map((file) => ({ file, score: 0 })));
	}

	private getHistory(): string[] {
		const raw: unknown = this.view.app.loadLocalStorage(HISTORY_KEY);
		return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
	}

	private pushHistory(path: string): void {
		const next = [path, ...this.getHistory().filter((p) => p !== path)].slice(0, HISTORY_MAX);
		this.view.app.saveLocalStorage(HISTORY_KEY, next);
	}

	private searchCommands(query: string): Command[] {
		const commands = this.view.app.commands.listCommands();
		if (!query) return commands.slice(0, MAX_RESULTS);
		const q = query.toLowerCase();
		return commands
			.filter((c) => c.name.toLowerCase().includes(q))
			.slice(0, MAX_RESULTS);
	}

	// ---- Results rendering ---------------------------------------------

	private beginResults(): void {
		this.resultsEl.empty();
		this.rows = [];
		this.selected = -1;
		this.inputEl.removeAttribute("aria-activedescendant");
	}

	private renderFileRows(hits: QueryHit[]): void {
		this.beginResults();
		if (hits.length === 0) {
			this.showEmpty();
			return;
		}
		hits.forEach((hit, i) => {
			const row = this.newRow(i, hit.badge?.icon ?? iconForFile(hit.file));
			const text = row.createDiv("hearth-result-text");
			const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
			this.renderName(text.createDiv("hearth-result-name"), name || "/", hit.matches);
			// Tag/property/body hits show what actually matched instead of the
			// folder path — the badge makes the match reason visible.
			if (hit.badge) {
				text.createDiv({ cls: "hearth-result-badge", text: hit.badge.label });
			} else {
				const parentPath = hit.file.parent?.path;
				if (parentPath && parentPath !== "/") {
					text.createDiv("hearth-result-path").setText(parentPath);
				}
			}
			this.commitRow(row, () => this.openFile(hit.file));
		});
		this.finishResults();
	}

	private renderCommandRows(commands: Command[]): void {
		this.beginResults();
		if (commands.length === 0) {
			this.showEmpty(t().search.noMatchingCommands);
			return;
		}
		commands.forEach((command, i) => {
			const row = this.newRow(i, "terminal-square");
			row.createDiv("hearth-result-text").createDiv("hearth-result-name").setText(command.name);
			this.commitRow(row, () => {
				this.hide();
				this.view.app.commands.executeCommandById(command.id);
			});
		});
		this.finishResults();
	}

	private newRow(index: number, icon: string): HTMLElement {
		const row = this.resultsEl.createDiv("hearth-result");
		row.id = `${this.resultsId}-opt-${index}`;
		row.setAttribute("role", "option");
		row.setAttribute("aria-selected", "false");
		setIcon(row.createDiv("hearth-result-icon"), icon);
		return row;
	}

	private commitRow(row: HTMLElement, open: () => void): void {
		row.addEventListener("click", open);
		this.rows.push({ el: row, open });
	}

	/** Render `name` with matched character ranges wrapped in <mark>. */
	private renderName(el: HTMLElement, name: string, matches?: [number, number][]): void {
		if (!matches || matches.length === 0) {
			el.setText(name);
			return;
		}
		let cursor = 0;
		for (const [start, end] of matches) {
			if (start > cursor) el.appendText(name.slice(cursor, start));
			el.createEl("mark", { cls: "hearth-result-mark", text: name.slice(start, end) });
			cursor = end;
		}
		if (cursor < name.length) el.appendText(name.slice(cursor));
	}

	private showEmpty(text: string = t().search.noMatches): void {
		this.resultsEl.createDiv("hearth-search-empty").setText(text);
		this.resultsEl.show();
		this.capResultsToViewport();
		this.inputEl.setAttribute("aria-expanded", "true");
	}

	private finishResults(): void {
		this.resultsEl.show();
		this.capResultsToViewport();
		this.inputEl.setAttribute("aria-expanded", "true");
	}

	/**
	 * On mobile the on-screen keyboard overlays the window rather than resizing
	 * the leaf, so a results dropdown sized against the full page can spill down
	 * behind it — hiding the very rows the user is scanning. Cap the visible
	 * dropdown's height to the space that's actually above the keyboard, measured
	 * from the visualViewport. No-op on desktop or when the list is hidden.
	 */
	private capResultsToViewport(): void {
		const vv = window.visualViewport;
		if (!Platform.isMobile || !vv || !this.resultsEl) return;
		// hide() sets display:none; only cap a list that's actually showing.
		if (this.resultsEl.style.display === "none") return;
		const top = this.resultsEl.getBoundingClientRect().top;
		const visibleBottom = vv.offsetTop + vv.height;
		// Leave a small gap so the last row isn't flush against the keyboard.
		const avail = visibleBottom - top - 12;
		// Never collapse below a couple of rows even if the measurement is momentarily
		// off (e.g. mid keyboard animation); the internal scroll handles overflow.
		this.resultsEl.style.maxHeight = `${Math.max(140, Math.round(avail))}px`;
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			this.hide();
			this.inputEl.blur();
			return;
		}
		if (this.rows.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.move(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.move(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const target = this.selected >= 0 ? this.selected : 0;
			this.rows[target]?.open();
		}
	}

	private move(delta: number): void {
		const prev = this.rows[this.selected]?.el;
		if (prev) {
			prev.removeClass("is-selected");
			prev.setAttribute("aria-selected", "false");
		}
		this.selected = (this.selected + delta + this.rows.length) % this.rows.length;
		const row = this.rows[this.selected]?.el;
		if (row) {
			row.addClass("is-selected");
			row.setAttribute("aria-selected", "true");
			row.scrollIntoView({ block: "nearest" });
			this.inputEl.setAttribute("aria-activedescendant", row.id);
		}
	}

	private openFile(file: TAbstractFile): void {
		if (file instanceof TFile) {
			this.pushHistory(file.path);
			void this.view.app.workspace.getLeaf(true).openFile(file);
			this.hide();
		} else if (file instanceof TFolder) {
			// Reveal the folder in the file explorer.
			const explorer = this.view.app.internalPlugins.getPluginById("file-explorer");
			const instance = explorer?.instance as
				| { revealInFolder?: (f: TAbstractFile) => void }
				| undefined;
			instance?.revealInFolder?.(file);
			this.hide();
		}
	}

	private hide(): void {
		// Invalidate any in-flight async content search so it can't re-open the
		// dropdown after the user opened a result or dismissed it.
		this.generation++;
		if (this.resultsEl) this.resultsEl.hide();
		this.inputEl?.setAttribute("aria-expanded", "false");
		this.inputEl?.removeAttribute("aria-activedescendant");
	}
}
