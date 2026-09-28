/**
 * The RSS card as text: a feed reader's list, the way a terminal one reads.
 *
 * A tab per source (and "All", when the card merges them) along the top, then
 * one row per item — its title, and under it the source and how long ago — in
 * the card's list layout, or with the excerpt under the title in the cards
 * layout. Pictures are left out. Enter opens the article in the browser.
 */
import { moment as createMoment } from "obsidian";
import { feedHost } from "../../cardbodies";
import { rssActiveTab } from "../../cards/rss";
import { t } from "../../i18n";
import { cachedFeed, loadFeed, type RssItem } from "../../rss";
import { effectiveAutoRefreshMinutes, type RssSource } from "../../types";
import { hearthMenu } from "../../uidesign";
import type { TuiContext, TuiItem, TuiRenderer } from "../card";
import { asciify, spread, truncate, wrap, type Line } from "../text";
import { message, showMenuFor } from "./common";

interface Tab {
	id: string;
	urls: string[];
}

function sourcesOf(ctx: TuiContext): RssSource[] {
	return (ctx.card.rss?.sources ?? []).filter((s) => s.url.trim());
}

function tabsOf(ctx: TuiContext, sources: readonly RssSource[]): Tab[] {
	const tabs: Tab[] = [];
	if (ctx.card.rss?.mergeAll && sources.length > 1) tabs.push({ id: "all", urls: sources.map((s) => s.url) });
	for (const s of sources) tabs.push({ id: s.id, urls: [s.url] });
	return tabs;
}

function activeTab(ctx: TuiContext, tabs: readonly Tab[]): Tab {
	const id = rssActiveTab.get(ctx.card);
	return tabs.find((tab) => tab.id === id) ?? tabs[0];
}

function sourceLabel(source: RssSource): string {
	return source.name.trim() || cachedFeed(source.url)?.title || feedHost(source.url);
}

function openItem(item: RssItem): void {
	if (item.link && /^https?:\/\//i.test(item.link)) window.open(item.link, "_blank");
}

function ago(ms: number): string {
	return (createMoment(new Date(ms)) as unknown as { fromNow(): string }).fromNow();
}

function itemMenu(item: RssItem, evt: MouseEvent | KeyboardEvent): void {
	if (!item.link) return;
	const menu = hearthMenu();
	menu.addItem((i) => i.setTitle(t().tui.cards.rssOpen).setIcon("globe").onClick(() => openItem(item)));
	menu.addItem((i) => i.setTitle(t().tui.cards.copyLink).setIcon("link").onClick(() => void navigator.clipboard.writeText(item.link)));
	showMenuFor(menu, evt);
}

/** When the feeds were fetched, so a load can tell whether it brought
 * anything new — a redraw that loaded again and got the same answer would
 * otherwise never stop. */
function stamp(urls: readonly string[]): string {
	return urls.map((u) => cachedFeed(u)?.fetched ?? 0).join(",");
}

function load(ctx: TuiContext, urls: readonly string[], force: boolean): void {
	const cfg = ctx.card.rss ?? {};
	const disabled = ctx.view.plugin.settings.disableExternalCalls;
	const ttlMs = Math.max(cfg.refreshMin ?? 30, 1) * 60_000;
	const before = stamp(urls);
	if (force) ctx.state.rssBusy = true;
	void Promise.all(urls.map((url) => loadFeed(url, { ttlMs, disabled, force }))).then(() => {
		const wasBusy = ctx.state.rssBusy === true;
		ctx.state.rssBusy = false;
		if (stamp(urls) !== before || wasBusy) ctx.redraw();
		else if (ctx.state.rssTried !== true) {
			ctx.state.rssTried = true;
			ctx.redraw();
		}
	});
}

function switchTab(ctx: TuiContext, dir: 1 | -1): boolean {
	const tabs = tabsOf(ctx, sourcesOf(ctx));
	if (tabs.length < 2) return false;
	const i = tabs.indexOf(activeTab(ctx, tabs));
	rssActiveTab.set(ctx.card, tabs[(i + dir + tabs.length) % tabs.length].id);
	ctx.state.rssTried = false;
	ctx.select(0);
	ctx.redraw();
	return true;
}

export const rssTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.rss ?? {};
		const sources = sourcesOf(ctx);
		if (!sources.length) return { lines: message(t().cards.empty.rssNoSources, ctx.cols) };
		const strings = t().cards.rss;
		const tabs = tabsOf(ctx, sources);
		const tab = activeTab(ctx, tabs);
		load(ctx, tab.urls, false);
		const autoMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, cfg.refreshMin ?? 30);
		if (autoMin > 0) ctx.component.registerInterval(window.setInterval(() => load(ctx, tab.urls, true), autoMin * 60_000));

		const w = ctx.cols;
		const lines: Line[] = [];
		const items: TuiItem[] = [];
		let sticky = 0;
		if (tabs.length > 1) {
			const bar: Line = [];
			for (const tb of tabs) {
				if (bar.length) bar.push({ text: " " });
				const label = tb.id === "all" ? strings.allTab : sourceLabel(sources.find((s) => s.id === tb.id) ?? { id: tb.id, name: "", url: tb.urls[0] });
				bar.push({
					text: ` ${asciify(truncate(label, 18))} `,
					style: tb.id === tab.id ? ["reverse", "bold"] : "dim",
					onClick: () => {
						rssActiveTab.set(ctx.card, tb.id);
						ctx.state.rssTried = false;
						ctx.redraw();
					},
				});
			}
			lines.push(bar, []);
			sticky = 2;
		}

		const merged = tab.urls.length > 1;
		const rows: { item: RssItem; badge: string }[] = [];
		let anyCached = false;
		for (const url of tab.urls) {
			const feed = cachedFeed(url);
			if (!feed) continue;
			anyCached = true;
			const src = sources.find((s) => s.url === url);
			for (const item of feed.items) rows.push({ item, badge: merged && src ? sourceLabel(src) : "" });
		}
		if (merged) rows.sort((a, b) => (b.item.published ?? 0) - (a.item.published ?? 0));
		const limit = ctx.zoomed ? 100 : cfg.itemLimit && cfg.itemLimit > 0 ? cfg.itemLimit : 15;
		const shown = rows.slice(0, limit);

		if (!shown.length) {
			const disabled = ctx.view.plugin.settings.disableExternalCalls;
			const text = ctx.state.rssTried !== true && !anyCached ? strings.loading : disabled && !anyCached ? strings.disabled : anyCached ? strings.empty : strings.error;
			return { lines: [...lines, ...message(text, w)], sticky };
		}

		const cards = cfg.layout === "cards";
		for (const { item, badge } of shown) {
			const own: Line[] = [];
			const title = asciify(item.title || strings.untitled);
			const meta = [badge, cfg.showDate !== false && item.published ? ago(item.published) : ""].filter(Boolean).join(" · ");
			if (cards || w < 48) {
				for (const l of wrap(title, w).slice(0, cards ? 2 : 1)) own.push([{ text: l, style: "bold" }]);
				if (cards && cfg.showExcerpt !== false && item.excerpt) {
					for (const l of wrap(asciify(item.excerpt), w).slice(0, ctx.zoomed ? 6 : 2)) own.push([{ text: l }]);
				}
				if (meta) own.push([{ text: meta, style: "faint" }]);
			} else {
				own.push(spread([{ text: title, style: "bold" }], meta ? [{ text: `  ${meta}`, style: "faint" }] : [], w));
			}
			items.push({ line: lines.length, span: own.length, activate: () => openItem(item), menu: (evt) => itemMenu(item, evt) });
			lines.push(...own);
			if (cards) lines.push([]);
		}
		return {
			lines,
			items,
			sticky,
			hint: ctx.state.rssBusy === true ? t().tui.cards.loading : undefined,
			foot: tabs.length > 1 ? t().tui.cards.rssFootTabs : t().tui.cards.rssFoot,
		};
	},
	key(ctx, evt) {
		if (evt.key === "ArrowLeft" || evt.key === "ArrowRight") return switchTab(ctx, evt.key === "ArrowRight" ? 1 : -1);
		if (evt.key === "r" && !evt.ctrlKey && !evt.metaKey) {
			const tabs = tabsOf(ctx, sourcesOf(ctx));
			if (!tabs.length) return false;
			load(ctx, activeTab(ctx, tabs).urls, true);
			ctx.redraw();
			return true;
		}
		return false;
	},
	menu(ctx, menu) {
		const tabs = tabsOf(ctx, sourcesOf(ctx));
		if (!tabs.length) return;
		menu.addItem((i) =>
			i
				.setTitle(t().cards.rss.refresh)
				.setIcon("refresh-cw")
				.onClick(() => {
					load(ctx, activeTab(ctx, tabs).urls, true);
					ctx.redraw();
				}),
		);
	},
};
