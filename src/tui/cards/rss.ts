/**
 * The RSS card as text: a feed reader's list, the way a terminal one reads.
 *
 * A tab per source (and "All", when the card merges them) along the top, each
 * with its unread count, then one row per item — a `●` while it is unread,
 * its title, and under it the source and how long ago — in the card's list
 * layout, or with the excerpt under the title in the cards layout. Pictures
 * are left out. Enter opens an entry the way the card says (its page, or the
 * reader); `u` marks it read or unread, `A` marks the feed read, `f` lists
 * only the unread, and `m` has every other way to open or keep it.
 */
import { moment as createMoment } from "obsidian";
import { rssActiveTab, rssEntryMenu } from "../../cards/rss";
import { t } from "../../i18n";
import { cachedFeed, loadFeed } from "../../rss";
import {
	rssEntryRead,
	rssSources,
	rssTabEntries,
	rssTabLabel,
	rssTabs,
	rssTabUnread,
	type RssEntry,
	type RssTab,
} from "../../rssfeeds";
import { openRssEntry, type RssOpenContext } from "../../rssreader";
import { setRssRead } from "../../rssstate";
import { effectiveAutoRefreshMinutes } from "../../types";
import type { TuiContext, TuiItem, TuiRenderer } from "../card";
import { asciify, spread, truncate, wrap, type Line } from "../text";
import { message, showMenuFor } from "./common";

function activeTab(ctx: TuiContext, tabs: readonly RssTab[]): RssTab {
	const id = rssActiveTab.get(ctx.card);
	return tabs.find((tab) => tab.id === id) ?? tabs[0];
}

function openCtx(ctx: TuiContext): RssOpenContext {
	return { app: ctx.view.app, settings: ctx.view.plugin.settings, opener: ctx.view };
}

function ago(ms: number): string {
	return (createMoment(new Date(ms)) as unknown as { fromNow(): string }).fromNow();
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
	const tabs = rssTabs(ctx.card);
	if (tabs.length < 2) return false;
	const i = tabs.indexOf(activeTab(ctx, tabs));
	rssActiveTab.set(ctx.card, tabs[(i + dir + tabs.length) % tabs.length].id);
	ctx.state.rssTried = false;
	ctx.select(0);
	ctx.redraw();
	return true;
}

/** The entry under the selection, as the last draw listed them. */
function selectedEntry(ctx: TuiContext): RssEntry | null {
	const shown = ctx.state.rssShown as RssEntry[] | undefined;
	return shown?.[ctx.selected] ?? null;
}

/** Flip the card's unread-only filter. Saved quietly: only this card
 * changes. */
function toggleUnreadOnly(ctx: TuiContext): void {
	const rss = (ctx.card.rss ??= {});
	rss.unreadOnly = rss.unreadOnly ? undefined : true;
	void ctx.view.plugin.saveData(ctx.view.plugin.settings);
	ctx.select(0);
	ctx.redraw();
}

export const rssTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.rss ?? {};
		const sources = rssSources(ctx.card);
		if (!sources.length) return { lines: message(t().cards.empty.rssNoSources, ctx.cols) };
		const strings = t().cards.rss;
		const tabs = rssTabs(ctx.card);
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
				const unread = rssTabUnread(tb);
				const count = unread > 0 ? ` ${unread > 99 ? "99+" : unread}` : "";
				bar.push({
					text: ` ${asciify(truncate(rssTabLabel(ctx.card, tb), 18))}${count} `,
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
		const all = rssTabEntries(ctx.card, tab);
		const anyCached = tab.urls.some((url) => cachedFeed(url) !== null);
		const limit = ctx.zoomed ? 100 : cfg.itemLimit && cfg.itemLimit > 0 ? cfg.itemLimit : 15;
		const shown = (cfg.unreadOnly ? all.filter((e) => !rssEntryRead(e)) : all).slice(0, limit);
		ctx.state.rssShown = shown;

		const foot = `${tabs.length > 1 ? t().tui.cards.rssFootTabs : t().tui.cards.rssFoot}${cfg.unreadOnly ? ` · ${strings.unreadOnly.toLowerCase()}` : ""}`;
		if (!shown.length) {
			const disabled = ctx.view.plugin.settings.disableExternalCalls;
			const text =
				ctx.state.rssTried !== true && !anyCached
					? strings.loading
					: disabled && !anyCached
						? strings.disabled
						: all.length > 0
							? strings.allRead
							: anyCached
								? strings.empty
								: strings.error;
			return { lines: [...lines, ...message(text, w)], sticky, foot };
		}

		const cards = cfg.layout === "cards";
		for (const entry of shown) {
			const { item } = entry;
			const read = rssEntryRead(entry);
			const own: Line[] = [];
			const mark = { text: read ? "  " : "● ", style: "accent" as const };
			const title = asciify(item.title || strings.untitled);
			const titleStyle = read ? ("dim" as const) : ("bold" as const);
			const meta = [merged ? entry.feed : "", cfg.showDate !== false && item.published ? ago(item.published) : ""]
				.filter(Boolean)
				.join(" · ");
			if (cards || w < 48) {
				wrap(title, w - 2)
					.slice(0, cards ? 2 : 1)
					.forEach((l, i) => own.push([i === 0 ? mark : { text: "  " }, { text: l, style: titleStyle }]));
				if (cards && cfg.showExcerpt !== false && item.excerpt) {
					for (const l of wrap(asciify(item.excerpt), w - 2).slice(0, ctx.zoomed ? 6 : 2)) own.push([{ text: "  " }, { text: l }]);
				}
				if (meta) own.push([{ text: "  " }, { text: meta, style: "faint" }]);
			} else {
				own.push(spread([mark, { text: title, style: titleStyle }], meta ? [{ text: `  ${meta}`, style: "faint" }] : [], w));
			}
			items.push({
				line: lines.length,
				span: own.length,
				activate: () => openRssEntry(openCtx(ctx), ctx.card, tab.id, entry),
				menu: (evt) => showMenuFor(rssEntryMenu(openCtx(ctx), ctx.card, tab.id, entry), evt),
			});
			lines.push(...own);
			if (cards) lines.push([]);
		}
		return {
			lines,
			items,
			sticky,
			hint: ctx.state.rssBusy === true ? t().tui.cards.loading : undefined,
			foot,
		};
	},
	key(ctx, evt) {
		if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;
		if (evt.key === "ArrowLeft" || evt.key === "ArrowRight") return switchTab(ctx, evt.key === "ArrowRight" ? 1 : -1);
		const tabs = rssTabs(ctx.card);
		if (!tabs.length) return false;
		switch (evt.key) {
			case "r":
				load(ctx, activeTab(ctx, tabs).urls, true);
				ctx.redraw();
				return true;
			case "u": {
				const entry = selectedEntry(ctx);
				if (!entry) return false;
				setRssRead([entry], !rssEntryRead(entry));
				ctx.redraw();
				return true;
			}
			case "A":
				setRssRead(rssTabEntries(ctx.card, activeTab(ctx, tabs)), true);
				ctx.redraw();
				return true;
			case "f":
				toggleUnreadOnly(ctx);
				return true;
			default:
				return false;
		}
	},
	menu(ctx, menu) {
		const tabs = rssTabs(ctx.card);
		if (!tabs.length) return;
		const strings = t().cards.rss;
		menu.addItem((i) =>
			i
				.setTitle(strings.refresh)
				.setIcon("refresh-cw")
				.onClick(() => {
					load(ctx, activeTab(ctx, tabs).urls, true);
					ctx.redraw();
				}),
		);
		menu.addItem((i) =>
			i
				.setTitle(strings.markAllRead)
				.setIcon("check-check")
				.onClick(() => {
					setRssRead(rssTabEntries(ctx.card, activeTab(ctx, tabs)), true);
					ctx.redraw();
				}),
		);
		menu.addItem((i) =>
			i
				.setTitle(ctx.card.rss?.unreadOnly ? strings.showAll : strings.unreadOnly)
				.setIcon("list-filter")
				.onClick(() => toggleUnreadOnly(ctx)),
		);
	},
};
