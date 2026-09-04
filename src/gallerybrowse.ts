/**
 * The gallery, as a room you walk into: categories down the left, a search
 * field across the top, an order to read them in, and the boards themselves.
 *
 * Deliberately the same shape as the add-card picker (`src/cardpicker.ts`), and
 * for the same reason — a rail of categories beside a grid of tiles is how
 * Hearth already asks "which of these do you want", and a second layout for the
 * same question would be a second thing to learn.
 *
 * Three things about how it fetches, all of them consequences of the server
 * being somebody's small box rather than a CDN:
 *
 * - **One request per view, not one per keystroke.** Typing waits for a pause
 *   before it asks.
 * - **A page at a time**, appended rather than replaced, so "show more" doesn't
 *   throw away what has already been drawn and scrolled through.
 * - **A request that has been superseded is dropped on arrival.** Each fetch
 *   carries a sequence number, and a slow answer to a query nobody is looking
 *   at any more is discarded instead of overwriting the one they are.
 */

import { Modal, Notice, Platform, setIcon } from "obsidian";
import type HearthPlugin from "./main";
import { t } from "./i18n";
import { activeDashboard } from "./types";
import { openPublishDashboard, vaultIdentity } from "./exportimport";
import { galleryErrorText, renderEmpty, renderEntryCard } from "./galleryui";
import { openGalleryEntry, openGalleryProfile } from "./gallerydetail";
import {
	GALLERY_CATEGORIES,
	GALLERY_CATEGORY_ICONS,
	GALLERY_SORTS,
	type GalleryCategory,
	type GalleryClient,
	type GalleryEntrySummary,
	type GallerySort,
	galleryClient,
	type ListQuery,
} from "./gallery";

/** What the rail can be showing. `mine` is not a category — it is the reader's
 * own shelf, and it is the only scope that needs an identity. */
type BrowseScope = "all" | "mine" | GalleryCategory;

/** localStorage keys, so the gallery reopens where it was left. */
const SCOPE_KEY = "hearth-gallery-scope";
const SORT_KEY = "hearth-gallery-sort";

/** Entries per request. Enough to fill the grid twice over on a desktop pane. */
const PAGE_SIZE = 24;

/** How long typing has to stop before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Open the gallery.
 *
 * Says why it can't rather than failing quietly when no host is configured:
 * Hearth ships pointing at nothing on purpose, so "there is no gallery" is a
 * normal state with an answer, not an error.
 */
export function openGallery(plugin: HearthPlugin): void {
	const client = galleryClient(plugin);
	if (!client) {
		new Notice(t().gallery.errors.noHost);
		return;
	}
	new GalleryBrowseModal(plugin, client).open();
}

class GalleryBrowseModal extends Modal {
	private plugin: HearthPlugin;
	private client: GalleryClient;

	/** Named `browseScope`, not `scope`: `Modal` already has a `scope` (its
	 * keymap), and shadowing it breaks the modal's key handling — the same
	 * naming hazard `CardPickerModal` documents. */
	private browseScope: BrowseScope = "all";
	private sort: GallerySort = "trending";
	private query = "";

	private entries: GalleryEntrySummary[] = [];
	private page = 1;
	private total = 0;
	private loading = false;
	private error: string | null = null;
	/** Bumped on every fetch; an answer whose number is stale is dropped. */
	private generation = 0;
	private debounce: number | null = null;

	private railEl: HTMLElement | null = null;
	private resultsEl: HTMLElement | null = null;
	private searchEl: HTMLInputElement | null = null;

	constructor(plugin: HearthPlugin, client: GalleryClient) {
		super(plugin.app);
		this.plugin = plugin;
		this.client = client;
	}

	onOpen(): void {
		const saved = this.app.loadLocalStorage(SCOPE_KEY) as string | null;
		if (typeof saved === "string" && this.isScope(saved)) this.browseScope = saved;
		// "Published by me" is remembered across sessions, but the identity it
		// was about may not have survived them — a replaced key, or a vault
		// restored without one. Without this the scope stays selected, its
		// author filter comes out undefined, and the rail shows "mine" active
		// over a listing of the whole gallery.
		if (this.browseScope === "mine" && !vaultIdentity(this.plugin)) this.browseScope = "all";
		const savedSort = this.app.loadLocalStorage(SORT_KEY) as string | null;
		if (typeof savedSort === "string" && (GALLERY_SORTS as string[]).includes(savedSort)) {
			this.sort = savedSort as GallerySort;
		}

		this.titleEl.setText(t().gallery.browse.title);
		const { contentEl, modalEl } = this;
		modalEl.addClass("hearth-gallery-modal");
		contentEl.empty();
		contentEl.addClass("hearth-gallery");

		this.renderTopBar(contentEl);
		const body = contentEl.createDiv("hearth-gallery-body");
		this.railEl = body.createDiv("hearth-gallery-rail");
		this.resultsEl = body.createDiv("hearth-gallery-results");
		this.renderRail();
		void this.load({ reset: true });

		// Same reason the card picker doesn't autofocus on a phone: the keyboard
		// covers the grid the modal exists to show.
		if (!Platform.isMobile) this.searchEl?.focus();
	}

	onClose(): void {
		if (this.debounce !== null) window.clearTimeout(this.debounce);
		this.contentEl.empty();
	}

	private isScope(value: string): value is BrowseScope {
		return (
			value === "all" ||
			value === "mine" ||
			(GALLERY_CATEGORIES as readonly string[]).includes(value)
		);
	}

	// ---- Chrome ---------------------------------------------------------

	private renderTopBar(parent: HTMLElement): void {
		const strings = t().gallery.browse;
		const bar = parent.createDiv("hearth-gallery-topbar");

		const search = bar.createDiv("hearth-gallery-search");
		setIcon(search.createSpan("hearth-gallery-search-icon"), "search");
		const input = search.createEl("input", {
			cls: "hearth-gallery-search-input",
			attr: {
				type: "text",
				placeholder: strings.searchPlaceholder,
				"aria-label": strings.searchPlaceholder,
			},
		});
		this.searchEl = input;
		input.addEventListener("input", () => {
			this.query = input.value.trim();
			if (this.debounce !== null) window.clearTimeout(this.debounce);
			this.debounce = window.setTimeout(() => {
				this.debounce = null;
				void this.load({ reset: true });
			}, SEARCH_DEBOUNCE_MS);
		});
		input.addEventListener("keydown", (evt: KeyboardEvent) => {
			// Enter asks now rather than waiting out the pause.
			if (evt.key !== "Enter") return;
			evt.preventDefault();
			if (this.debounce !== null) window.clearTimeout(this.debounce);
			this.debounce = null;
			void this.load({ reset: true });
		});

		const sort = bar.createEl("select", {
			cls: "dropdown hearth-gallery-sort",
			attr: { "aria-label": strings.sortLabel },
		});
		for (const key of GALLERY_SORTS) {
			sort.createEl("option", { value: key, text: t().gallery.sorts[key] });
		}
		sort.value = this.sort;
		sort.addEventListener("change", () => {
			this.sort = sort.value as GallerySort;
			this.app.saveLocalStorage(SORT_KEY, this.sort);
			void this.load({ reset: true });
		});

		const refresh = bar.createEl("button", {
			cls: "hearth-gallery-icon-btn",
			attr: { "aria-label": strings.refresh },
		});
		setIcon(refresh, "refresh-cw");
		refresh.addEventListener("click", () => void this.load({ reset: true }));
	}

	private renderRail(): void {
		const rail = this.railEl;
		if (!rail) return;
		rail.empty();
		const strings = t().gallery;

		this.railButton(rail, "all", strings.browse.all, "layout-grid");
		for (const category of GALLERY_CATEGORIES) {
			this.railButton(
				rail,
				category,
				strings.categories[category],
				GALLERY_CATEGORY_ICONS[category],
			);
		}
		rail.createDiv("hearth-gallery-rail-sep");
		// Only offered to a vault that has an identity: "published by me" with no
		// key behind it is a question with no possible answer, and merely opening
		// the gallery is not a reason to mint one.
		if (vaultIdentity(this.plugin)) {
			this.railButton(rail, "mine", strings.browse.mine, "user-round");
		}

		const publish = rail.createEl("button", { cls: "hearth-gallery-rail-publish" });
		setIcon(publish.createSpan("hearth-gallery-rail-icon"), "upload");
		publish.createSpan({
			cls: "hearth-gallery-rail-label",
			text: strings.browse.publish,
		});
		publish.addEventListener("click", () => {
			this.close();
			openPublishDashboard(this.plugin, activeDashboard(this.plugin.settings));
		});
	}

	private railButton(
		rail: HTMLElement,
		scope: BrowseScope,
		label: string,
		icon: string,
	): void {
		const btn = rail.createEl("button", { cls: "hearth-gallery-rail-btn" });
		btn.toggleClass("is-active", this.browseScope === scope);
		btn.setAttribute("aria-pressed", String(this.browseScope === scope));
		setIcon(btn.createSpan("hearth-gallery-rail-icon"), icon);
		btn.createSpan({ cls: "hearth-gallery-rail-label", text: label });
		btn.addEventListener("click", () => {
			if (scope === this.browseScope) return;
			this.browseScope = scope;
			this.app.saveLocalStorage(SCOPE_KEY, scope);
			this.renderRail();
			void this.load({ reset: true });
		});
	}

	// ---- Fetching -------------------------------------------------------

	private queryFor(page: number): ListQuery {
		const query: ListQuery = { sort: this.sort, page, perPage: PAGE_SIZE };
		if (this.query) query.q = this.query;
		if (this.browseScope === "mine") {
			query.author = vaultIdentity(this.plugin)?.publicKey;
		} else if (this.browseScope !== "all") {
			query.category = this.browseScope;
		}
		return query;
	}

	private async load(opts: { reset?: boolean } = {}): Promise<void> {
		const generation = ++this.generation;
		const page = opts.reset ? 1 : this.page + 1;
		if (opts.reset) {
			this.entries = [];
			this.total = 0;
		}
		this.loading = true;
		this.error = null;
		this.renderResults();
		try {
			// Cached after the first call, so this costs one request per gallery
			// per session. It is what turns "somebody typed the wrong address"
			// into a sentence saying so, instead of an empty listing that reads
			// as "this gallery has nothing in it".
			await this.client.describe();
			const listing = await this.client.list(this.queryFor(page));
			// Somebody typed again, or changed category, while this was in the
			// air. Their view is the current one; this answer is about a question
			// that is no longer on screen.
			if (generation !== this.generation) return;
			this.entries = opts.reset ? listing.entries : [...this.entries, ...listing.entries];
			this.total = listing.total;
			this.page = listing.page;
		} catch (err) {
			if (generation !== this.generation) return;
			// A failed *first* page has nothing to show but the error. A failed
			// "show more" has a grid somebody has already scrolled through, and
			// replacing it with an error message throws that away to report that
			// nothing new arrived — so the page keeps what it has and says so in
			// a notice.
			if (this.entries.length === 0) this.error = galleryErrorText(err);
			else new Notice(galleryErrorText(err));
		} finally {
			if (generation === this.generation) {
				this.loading = false;
				this.renderResults();
			}
		}
	}

	// ---- Results --------------------------------------------------------

	private renderResults(): void {
		const results = this.resultsEl;
		if (!results) return;
		results.empty();
		const strings = t().gallery.browse;

		if (this.error) {
			renderEmpty(results, "cloud-off", this.error);
			const retry = results.createEl("button", {
				cls: "hearth-gallery-retry",
				text: strings.refresh,
			});
			retry.addEventListener("click", () => void this.load({ reset: true }));
			return;
		}

		if (this.entries.length === 0) {
			if (this.loading) {
				renderEmpty(results, "loader", strings.loading);
				return;
			}
			renderEmpty(
				results,
				"inbox",
				this.query
					? strings.emptySearch(this.query)
					: this.browseScope === "mine"
						? strings.emptyMine
						: strings.empty,
			);
			return;
		}

		results.createDiv({
			cls: "hearth-gallery-count",
			text: strings.results(this.entries.length, this.total),
		});

		const grid = results.createDiv("hearth-gallery-grid");
		for (const entry of this.entries) {
			renderEntryCard(grid, entry, {
				wallpaperUrl: entry.hasWallpaper ? this.client.wallpaperUrl(entry.id) : undefined,
				onOpen: (chosen) => this.openEntry(chosen),
				onOpenProfile: (publicKey) => this.openProfile(publicKey),
			});
		}

		if (this.entries.length < this.total) {
			const more = results.createEl("button", {
				cls: "hearth-gallery-more",
				text: this.loading ? strings.loading : strings.more,
			});
			more.disabled = this.loading;
			more.addEventListener("click", () => void this.load());
		}
	}

	/** Replace one row in place after a vote, rather than refetching the page —
	 * a re-sort under the reader's cursor because they upvoted something is a
	 * list that moves when it is touched. */
	private applyEntryUpdate(updated: GalleryEntrySummary): void {
		const index = this.entries.findIndex((e) => e.id === updated.id);
		if (index < 0) return;
		this.entries[index] = { ...this.entries[index], ...updated };
		this.renderResults();
	}

	private openEntry(entry: GalleryEntrySummary): void {
		openGalleryEntry(this.plugin, this.client, entry.id, {
			onChanged: (updated) => this.applyEntryUpdate(updated),
			onInstalled: () => this.close(),
			onOpenProfile: (publicKey) => this.openProfile(publicKey),
		});
	}

	private openProfile(publicKey: string): void {
		openGalleryProfile(this.plugin, this.client, publicKey, {
			onOpenEntry: (id) =>
				openGalleryEntry(this.plugin, this.client, id, {
					onChanged: (updated) => this.applyEntryUpdate(updated),
					onInstalled: () => this.close(),
					onOpenProfile: (key) => this.openProfile(key),
				}),
		});
	}
}
