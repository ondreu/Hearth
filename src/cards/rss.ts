import { Component, moment as createMoment, Notice, setIcon, Setting } from "obsidian";
import { emptyState, feedHost } from "../cardbodies";
import { moveItem } from "../editors";
import { t } from "../i18n";
import { cachedFeed, loadFeed, type RssItem } from "../rss";
import { type DashboardCard, type RssLayout, type RssSource } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


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


/** A GitHub repo split into its owner and repo halves, as pulled from user
 * input by {@link parseGithubRepo}. */
interface GithubRepo {
	owner: string;
	repo: string;
}


/** Parse an `owner/repo` string — or a full GitHub URL, or an `git@…` SSH
 * remote — into its two halves. Returns null when either half is missing so
 * callers can warn the user. */
function parseGithubRepo(input: string): GithubRepo | null {
	let s = input.trim();
	if (!s) return null;
	// Strip a leading scheme + host, an SSH `git@github.com:` remote, or a bare
	// `github.com/` prefix, so a pasted URL collapses to `owner/repo/…`.
	s = s
		.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i, "")
		.replace(/^git@[^:]+:/i, "")
		.replace(/^github\.com\//i, "");
	// Drop any query/hash and a trailing `.git`, then keep the first two path
	// segments — the rest (tree/blob/…) is irrelevant to the feed.
	s = s.split(/[?#]/)[0].replace(/\.git$/i, "");
	const parts = s.split("/").filter(Boolean);
	if (parts.length < 2) return null;
	return { owner: parts[0], repo: parts[1] };
}


/** Build the RSS sources for a repo's GitHub Atom feeds. `type` selects the
 * releases feed, the commits feed, or both. */
function githubFeedSources(
	repo: GithubRepo,
	type: "releases" | "commits" | "both",
): RssSource[] {
	const base = `https://github.com/${repo.owner}/${repo.repo}`;
	const slug = `${repo.owner}/${repo.repo}`;
	const mk = (kind: "releases" | "commits", name: string): RssSource => ({
		id: `rss-gh-${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
		name,
		url: `${base}/${kind}.atom`,
	});
	const out: RssSource[] = [];
	if (type === "releases" || type === "both") {
		out.push(
			mk("releases", t().editors.rss.githubReleasesName.replace("{repo}", slug)),
		);
	}
	if (type === "commits" || type === "both") {
		out.push(
			mk("commits", t().editors.rss.githubCommitsName.replace("{repo}", slug)),
		);
	}
	return out;
}


export function rssEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.rss ??= {});
	const sources = (cfg.sources ??= []);

	new Setting(containerEl).setName(t().editors.rss.feeds).setHeading();

	sources.forEach((source, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.rss.namePlaceholder)
				.setValue(source.name)
				.onChange((v) => {
					source.name = v;
					ctx.opts.save();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.rss.urlPlaceholder)
				.setValue(source.url)
				.onChange((v) => {
					source.url = v.trim();
					ctx.opts.save();
					ctx.opts.rerender();
				});
			txt.inputEl.addClass("hearth-rss-url");
		});
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, sources, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === sources.length - 1)
				.onClick(() => moveItem(ctx, sources, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.rss.removeFeed)
				.onClick(() => {
					sources.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.rss.addFeed).onClick(() => {
			sources.push({
				id: `rss-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
				name: "",
				url: "",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);

	githubFeedAdder(ctx, containerEl, sources);

	if (sources.length > 1) {
		new Setting(containerEl)
			.setName(t().editors.rss.mergeAll)
			.setDesc(t().editors.rss.mergeAllDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.mergeAll ?? false).onChange((v) => {
					cfg.mergeAll = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	new Setting(containerEl).setName(t().editors.rss.display).setHeading();

	new Setting(containerEl)
		.setName(t().editors.rss.layout)
		.setDesc(t().editors.rss.layoutDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.rss.layoutList);
			d.addOption("cards", t().editors.rss.layoutCards);
			d.addOption("compact", t().editors.rss.layoutCompact);
			d.setValue(cfg.layout ?? "list").onChange((v) => {
				cfg.layout = v === "list" ? undefined : (v as RssLayout);
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});

	const items = new Setting(containerEl)
		.setName(t().editors.rss.itemLimit)
		.setDesc(t().editors.rss.itemLimitDesc);
	items.addSlider((s) => {
		s.setLimits(3, 50, 1)
			.setValue(cfg.itemLimit ?? 15)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.itemLimit = v === 15 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	items.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.itemLimit = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	const refresh = new Setting(containerEl)
		.setName(t().editors.rss.refresh)
		.setDesc(t().editors.rss.refreshDesc);
	refresh.addSlider((s) => {
		s.setLimits(0, 180, 5)
			.setValue(cfg.refreshMin ?? 30)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.refreshMin = v === 30 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	const isCards = (cfg.layout ?? "list") === "cards";
	if (isCards) {
		new Setting(containerEl)
			.setName(t().editors.rss.showImages)
			.setDesc(t().editors.rss.showImagesDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.showImages !== false).onChange((v) => {
					cfg.showImages = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
		new Setting(containerEl)
			.setName(t().editors.rss.showExcerpt)
			.setDesc(t().editors.rss.showExcerptDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.showExcerpt !== false).onChange((v) => {
					cfg.showExcerpt = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	new Setting(containerEl)
		.setName(t().editors.rss.showDate)
		.setDesc(t().editors.rss.showDateDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.showDate !== false).onChange((v) => {
				cfg.showDate = v ? undefined : false;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}


/** Quick-add helper: turn an `owner/repo` (or a GitHub URL) into RSS sources
 * pointing at GitHub's built-in `releases.atom` / `commits.atom` feeds, so
 * the user never has to hand-write those URLs. */
export function githubFeedAdder(ctx: CardEditorContext, containerEl: HTMLElement, sources: RssSource[]): void {
	const setting = new Setting(containerEl)
		.setName(t().editors.rss.github)
		.setDesc(t().editors.rss.githubDesc)
		.setClass("hearth-rss-github");

	setting.addText((txt) => {
		txt
			.setPlaceholder(t().editors.rss.githubPlaceholder)
			.setValue((ctx.session.ghRepo as string) ?? "")
			.onChange((v) => {
				ctx.session.ghRepo = v;
			});
		txt.inputEl.addClass("hearth-rss-github-repo");
	});

	setting.addDropdown((d) => {
		d.addOption("releases", t().editors.rss.githubReleases);
		d.addOption("commits", t().editors.rss.githubCommits);
		d.addOption("both", t().editors.rss.githubBoth);
		d.setValue((ctx.session.ghFeedType as string) ?? "releases").onChange((v) => {
			ctx.session.ghFeedType = v;
		});
	});

	setting.addButton((b) =>
		b
			.setButtonText(t().editors.rss.githubAdd)
			.setCta()
			.onClick(() => {
				const repo = parseGithubRepo((ctx.session.ghRepo as string) ?? "");
				if (!repo) {
					new Notice(t().editors.rss.githubInvalid);
					return;
				}
				sources.push(
					...githubFeedSources(
						repo,
						(ctx.session.ghFeedType as "releases" | "commits" | "both") ?? "releases",
					),
				);
				ctx.session.ghRepo = "";
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
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
