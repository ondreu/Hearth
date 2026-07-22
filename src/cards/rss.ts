import { Component, moment as createMoment, setIcon } from "obsidian";
import { emptyState, feedHost } from "../cardbodies";
import { rssEditor } from "../editors";
import { t } from "../i18n";
import { cachedFeed, loadFeed, type RssItem } from "../rss";
import { type DashboardCard, type RssLayout, type RssSource } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- RSS (lightweight feed reader) -------------------------------------

/** Which source tab each rss card is showing. Transient (not persisted): keyed
 * by the card object so the choice survives body redraws and full rebuilds —
 * the card objects live in settings and are reused — but resets on reload. */
const rssActiveTab = new WeakMap<DashboardCard, string>();


/** moment's `.fromNow()` isn't on the shared Moment shim; assert it locally. */
interface RelativeMoment {
	fromNow(): string;
}


export function renderRss(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.rss ?? {};
	const sources = (cfg.sources ?? []).filter((s) => s.url.trim());
	if (sources.length === 0) {
		emptyState(body, "rss", t().cards.empty.rssNoSources);
		return;
	}

	const layout: RssLayout = cfg.layout ?? "list";
	const limit = cfg.itemLimit && cfg.itemLimit > 0 ? cfg.itemLimit : 15;
	const refreshMin = cfg.refreshMin ?? 30;
	const disabled = view.plugin.settings.disableExternalCalls;
	// Freshness window for the cache: at least a minute so re-renders don't spam.
	const ttlMs = Math.max(refreshMin, 1) * 60_000;

	/** A header tab: one source, or the merged "All" view over several. */
	interface Tab {
		id: string;
		urls: string[];
	}
	const tabs: Tab[] = [];
	if (cfg.mergeAll && sources.length > 1) {
		tabs.push({ id: "all", urls: sources.map((s) => s.url) });
	}
	for (const s of sources) tabs.push({ id: s.id, urls: [s.url] });

	let activeId = rssActiveTab.get(card) ?? tabs[0].id;
	if (!tabs.some((tab) => tab.id === activeId)) activeId = tabs[0].id;

	// Async loads may resolve after the card is torn down and rebuilt; ignore them.
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});
	let loading = false;

	const wrap = body.createDiv("hearth-rss");

	const sourceById = (id: string): RssSource | undefined =>
		sources.find((s) => s.id === id);

	/** Friendly label for a source: its name, else the feed's own title, else host. */
	const sourceLabel = (source: RssSource): string =>
		source.name.trim() || cachedFeed(source.url)?.title || feedHost(source.url);

	const tabLabel = (tab: Tab): string =>
		tab.id === "all"
			? t().cards.rss.allTab
			: sourceLabel(sourceById(tab.id) ?? { id: tab.id, name: "", url: tab.urls[0] });

	const activeTab = (): Tab =>
		tabs.find((tab) => tab.id === activeId) ?? tabs[0];

	const openItem = (item: RssItem): void => {
		if (item.link && /^https?:\/\//i.test(item.link)) {
			window.open(item.link, "_blank");
		}
	};

	const renderItem = (
		container: HTMLElement,
		item: RssItem,
		badge: string,
	): void => {
		const row = container.createDiv("hearth-rss-item");
		makeClickable(row, () => openItem(item), item.title || t().cards.rss.untitled);
		row.addEventListener("click", () => openItem(item));

		if (layout === "cards" && cfg.showImages !== false && item.image) {
			const thumb = row.createDiv("hearth-rss-thumb");
			const img = thumb.createEl("img");
			img.setAttribute("src", item.image);
			img.setAttribute("loading", "lazy");
			img.setAttribute("referrerpolicy", "no-referrer");
			// Drop the thumbnail slot entirely if the image can't be fetched.
			img.addEventListener("error", () => thumb.remove());
		}

		const main = row.createDiv("hearth-rss-main");
		main.createDiv({
			cls: "hearth-rss-title",
			text: item.title || t().cards.rss.untitled,
		});
		if (layout === "cards" && cfg.showExcerpt !== false && item.excerpt) {
			main.createDiv({ cls: "hearth-rss-excerpt", text: item.excerpt });
		}

		const metaBits: string[] = [];
		if (badge) metaBits.push(badge);
		if (cfg.showDate !== false && item.published) {
			metaBits.push(
				(createMoment(new Date(item.published)) as unknown as RelativeMoment).fromNow(),
			);
		}
		if (metaBits.length) {
			main.createDiv({ cls: "hearth-rss-meta", text: metaBits.join(" · ") });
		}
	};

	/** Paint the item list (or a loading/empty/offline state) for the active tab. */
	const paint = (content: HTMLElement): void => {
		const tab = activeTab();
		const merged = tab.urls.length > 1;
		const rows: { item: RssItem; badge: string }[] = [];
		let anyCached = false;
		for (const url of tab.urls) {
			const feed = cachedFeed(url);
			if (!feed) continue;
			anyCached = true;
			const src = sources.find((s) => s.url === url);
			const badge = merged && src ? sourceLabel(src) : "";
			for (const item of feed.items) rows.push({ item, badge });
		}
		if (merged) {
			rows.sort((a, b) => (b.item.published ?? 0) - (a.item.published ?? 0));
		}
		const items = rows.slice(0, limit);

		if (items.length === 0) {
			if (loading) {
				emptyState(content, "rss", t().cards.rss.loading);
			} else if (disabled && !anyCached) {
				emptyState(content, "wifi-off", t().cards.rss.disabled);
			} else if (anyCached) {
				emptyState(content, "rss", t().cards.rss.empty);
			} else {
				emptyState(content, "rss", t().cards.rss.error);
			}
			return;
		}
		for (const row of items) renderItem(content, row.item, row.badge);
	};

	/** Rebuild tab bar + content from the current cache and loading flag. */
	const rebuild = (): void => {
		wrap.empty();

		const bar = wrap.createDiv("hearth-rss-tabs");
		const tabsEl = bar.createDiv("hearth-rss-tablist");
		if (tabs.length > 1) {
			for (const tab of tabs) {
				const btn = tabsEl.createEl("button", {
					cls: "hearth-rss-tab",
					text: tabLabel(tab),
				});
				if (tab.id === activeId) btn.addClass("is-active");
				btn.addEventListener("click", () => {
					activeId = tab.id;
					rssActiveTab.set(card, tab.id);
					load(false);
				});
			}
		}
		const refresh = bar.createEl("button", {
			cls: "hearth-rss-refresh",
			attr: { "aria-label": t().cards.rss.refresh },
		});
		setIcon(refresh, "refresh-cw");
		if (loading) refresh.addClass("is-loading");
		refresh.addEventListener("click", () => load(true));

		const content = wrap.createDiv(`hearth-rss-content hearth-rss-${layout}`);
		paint(content);
	};

	/** Show cached content immediately, then fetch and repaint. `force` bypasses
	 * the cache TTL (used by the manual refresh button and the auto-refresh timer). */
	const load = (force: boolean): void => {
		const tab = activeTab();
		// Only show the loading placeholder when there's nothing cached to show.
		loading = tab.urls.every((url) => !cachedFeed(url));
		rebuild();
		void Promise.all(
			tab.urls.map((url) => loadFeed(url, { ttlMs, disabled, force })),
		).then(() => {
			if (destroyed) return;
			loading = false;
			rebuild();
		});
	};

	load(false);
	if (refreshMin > 0) {
		component.registerInterval(
			window.setInterval(() => load(true), refreshMin * 60_000),
		);
	}
}

/** An RSS/Atom reader with its own internal refresh. */
export const rssCard: CardDefinition<"rss"> = {
	kind: "rss",
	templates: [
		{ id: "rss", name: "RSS feed", icon: "rss", build: () => ({ kind: "rss", title: "RSS", rss: { sources: [] }, w: 4, h: 5 }) },
	],
	render: (view, card, body, component) => renderRss(view, card, body, component),
	renderEditor: (container, ctx) => rssEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.rss)
			copy.rss = {
				...source.rss,
				sources: source.rss.sources ? source.rss.sources.map((s) => ({ ...s })) : undefined,
			};
	},
	liveness: { mode: "static" },
};
