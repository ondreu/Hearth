import { Component, type Menu, moment as createMoment, Notice, Setting } from "obsidian";
import { setIcon } from "../glyphs";
import { emptyState } from "../cardbodies";
import { clipTemplateEditor } from "../clipeditor";
import { moveItem } from "../editors";
import { t } from "../i18n";
import { openFile } from "../opener";
import { cachedFeed, loadFeed } from "../rss";
import {
	rssEntryRead,
	rssSources,
	rssTabEntries,
	rssTabLabel,
	rssTabs,
	rssTabUnread,
	type RssEntry,
	type RssTab,
} from "../rssfeeds";
import { RSS_CLIP_VARIABLES, RSS_NOTE_DEFAULTS, rssClipVars } from "../rssnote";
import { entryMarkdown, entryNote, openRssEntry, saveEntryNote, type RssOpenContext } from "../rssreader";
import { onRssReadChange, setRssRead } from "../rssstate";
import {
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	type RssConfig,
	type RssLayout,
	type RssOpenIn,
	type RssReaderImages,
	type RssSource,
} from "../types";
import { hearthMenu } from "../uidesign";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- RSS (lightweight feed reader) -------------------------------------

/** Which source tab each rss card is showing. Transient (not persisted): keyed
 * by the card object so the choice survives body redraws and full rebuilds —
 * the card objects live in settings and are reused — but resets on reload. */
export const rssActiveTab = new WeakMap<DashboardCard, string>();


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
	const sources = rssSources(card);
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

	const tabs = rssTabs(card);
	let activeId = rssActiveTab.get(card) ?? tabs[0].id;
	if (!tabs.some((tab) => tab.id === activeId)) activeId = tabs[0].id;

	// Async loads may resolve after the card is torn down and rebuilt; ignore them.
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});
	let loading = false;

	const wrap = body.createDiv("hearth-rss");
	const opener: RssOpenContext = { app: view.app, settings: view.plugin.settings, opener: view };

	const activeTab = (): RssTab =>
		tabs.find((tab) => tab.id === activeId) ?? tabs[0];

	/** The card's own toggles (unread only) are saved quietly: only this
	 * card needs redrawing. */
	const persist = (): void => {
		void view.plugin.saveData(view.plugin.settings);
	};

	const renderItem = (container: HTMLElement, entry: RssEntry, merged: boolean): void => {
		const item = entry.item;
		const open = (): void => openRssEntry(opener, card, activeId, entry);
		const row = container.createDiv("hearth-rss-item");
		row.toggleClass("is-read", rssEntryRead(entry));
		makeClickable(row, open, item.title || t().cards.rss.untitled);
		row.addEventListener("click", open);
		row.addEventListener("contextmenu", (evt) => {
			evt.preventDefault();
			rssEntryMenu(opener, card, activeId, entry).showAtMouseEvent(evt);
		});
		row.createSpan({ cls: "hearth-rss-dot", attr: { "aria-hidden": "true" } });

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
		if (merged) metaBits.push(entry.feed);
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
		const all = rssTabEntries(card, tab);
		const anyCached = tab.urls.some((url) => cachedFeed(url) !== null);
		const items = (cfg.unreadOnly ? all.filter((e) => !rssEntryRead(e)) : all).slice(0, limit);

		if (items.length === 0) {
			if (loading) {
				emptyState(content, "rss", t().cards.rss.loading);
			} else if (disabled && !anyCached) {
				emptyState(content, "wifi-off", t().cards.rss.disabled);
			} else if (all.length > 0) {
				emptyState(content, "check-check", t().cards.rss.allRead);
			} else if (anyCached) {
				emptyState(content, "rss", t().cards.rss.empty);
			} else {
				emptyState(content, "rss", t().cards.rss.error);
			}
			return;
		}
		for (const entry of items) renderItem(content, entry, merged);
	};

	const barButton = (bar: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement => {
		const btn = bar.createEl("button", { cls: "hearth-rss-refresh", attr: { "aria-label": label } });
		setIcon(btn, icon);
		btn.addEventListener("click", onClick);
		return btn;
	};

	/** Rebuild tab bar + content from the current cache and loading flag. */
	const rebuild = (): void => {
		const scroll = wrap.querySelector(".hearth-rss-content")?.scrollTop ?? 0;
		wrap.empty();

		const bar = wrap.createDiv("hearth-rss-tabs");
		const tabsEl = bar.createDiv("hearth-rss-tablist");
		if (tabs.length > 1) {
			for (const tab of tabs) {
				const btn = tabsEl.createEl("button", { cls: "hearth-rss-tab" });
				btn.createSpan({ cls: "hearth-rss-tab-label", text: rssTabLabel(card, tab) });
				const unread = rssTabUnread(tab);
				if (unread > 0) {
					btn.createSpan({ cls: "hearth-rss-tab-count", text: unread > 99 ? "99+" : String(unread) });
				}
				if (tab.id === activeId) btn.addClass("is-active");
				btn.addEventListener("click", () => {
					activeId = tab.id;
					rssActiveTab.set(card, tab.id);
					load(false);
				});
			}
		}
		const strings = t().cards.rss;
		const filter = barButton(bar, "list-filter", cfg.unreadOnly ? strings.showAll : strings.unreadOnly, () => {
			const rss = (card.rss ??= {});
			rss.unreadOnly = rss.unreadOnly ? undefined : true;
			cfg.unreadOnly = rss.unreadOnly;
			persist();
			rebuild();
		});
		filter.toggleClass("is-active", !!cfg.unreadOnly);
		barButton(bar, "check-check", strings.markAllRead, () => setRssRead(rssTabEntries(card, activeTab()), true));
		const refresh = barButton(bar, "refresh-cw", strings.refresh, () => load(true));
		if (loading) refresh.addClass("is-loading");

		const content = wrap.createDiv(`hearth-rss-content hearth-rss-${layout}`);
		paint(content);
		content.scrollTop = scroll;
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

	// Read anywhere — this card, another, the reader — shows here at once.
	component.register(onRssReadChange(() => {
		if (!destroyed) rebuild();
	}));

	load(false);
	// The cache TTL above still uses the configured interval; only the timer is
	// suppressed on the minimal tier, so the card loads on render and on the manual
	// refresh button but never on its own.
	const autoRefreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, refreshMin);
	if (autoRefreshMin > 0) {
		component.registerInterval(
			window.setInterval(() => load(true), autoRefreshMin * 60_000),
		);
	}
}


/** An entry's menu — the right-click on the card, and the terminal card's
 * `m`: every way to open it, mark it, save it or copy its link. */
export function rssEntryMenu(ctx: RssOpenContext, card: DashboardCard, tabId: string, entry: RssEntry): Menu {
	const strings = t().cards.rss;
	const menu = hearthMenu();
	const item = entry.item;
	const linked = /^https?:\/\//i.test(item.link);
	const readable = !!(item.content.trim() || item.excerpt.trim());
	if (readable) {
		menu.addItem((i) =>
			i.setTitle(strings.readHere).setIcon("book-open").onClick(() => openRssEntry(ctx, card, tabId, entry, "dialog")),
		);
		menu.addItem((i) =>
			i.setTitle(strings.openTab).setIcon("app-window").onClick(() => openRssEntry(ctx, card, tabId, entry, "tab")),
		);
	}
	if (linked) {
		menu.addItem((i) =>
			i.setTitle(strings.openBrowser).setIcon("globe").onClick(() => openRssEntry(ctx, card, tabId, entry, "browser")),
		);
	}
	menu.addSeparator();
	const read = rssEntryRead(entry);
	menu.addItem((i) =>
		i
			.setTitle(read ? strings.markUnread : strings.markRead)
			.setIcon(read ? "circle-dot" : "check")
			.onClick(() => setRssRead([entry], !read)),
	);
	if (card.rss?.note?.enabled !== false && readable) {
		const existing = entryNote(ctx.app, card, entry);
		menu.addItem((i) =>
			i
				.setTitle(existing ? strings.openNote : strings.saveNote)
				.setIcon(existing ? "file-text" : "file-plus")
				.onClick(() => {
					if (existing) {
						void openFile(ctx.opener, existing, "card");
						return;
					}
					void saveEntryNote(ctx.app, card, entry).then((file) => {
						if (file) new Notice(strings.reader.noteSaved(file.path));
						else new Notice(strings.reader.noteFailed);
					});
				}),
		);
	}
	if (linked) {
		menu.addItem((i) =>
			i
				.setTitle(strings.copyLink)
				.setIcon("link")
				.onClick(() => void navigator.clipboard.writeText(item.link).then(() => new Notice(strings.linkCopied))),
		);
	}
	return menu;
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
		// Terminal mode leaves the pictures out.
		if (!ctx.terminal) {
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
		}
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

	rssReadingEditor(ctx, containerEl, cfg);
	rssNoteEditor(ctx, containerEl, cfg);
}


/** The "Reading" section: where an entry opens, the reader's pictures, and
 * the unread filter. */
function rssReadingEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: RssConfig): void {
	const s = t().editors.rss;
	new Setting(containerEl).setName(s.reading).setHeading();

	new Setting(containerEl)
		.setName(s.openIn)
		.setDesc(s.openInDesc)
		.addDropdown((d) => {
			d.addOption("browser", s.openInBrowser);
			d.addOption("dialog", s.openInDialog);
			d.addOption("tab", s.openInTab);
			d.setValue(cfg.openIn ?? "browser").onChange((v) => {
				cfg.openIn = v === "browser" ? undefined : (v as RssOpenIn);
				ctx.opts.save();
			});
		});

	new Setting(containerEl)
		.setName(s.readerImages)
		.setDesc(s.readerImagesDesc)
		.addDropdown((d) => {
			d.addOption("ask", s.imagesAsk);
			d.addOption("always", s.imagesAlways);
			d.addOption("never", s.imagesNever);
			d.setValue(cfg.readerImages ?? "ask").onChange((v) => {
				cfg.readerImages = v === "ask" ? undefined : (v as RssReaderImages);
				ctx.opts.save();
			});
		});

	new Setting(containerEl)
		.setName(s.unreadOnly)
		.setDesc(s.unreadOnlyDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.unreadOnly ?? false).onChange((v) => {
				cfg.unreadOnly = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}


/** The "Save as note" section: the reader's note template, previewed with
 * the card's newest entry when one has been fetched. */
function rssNoteEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: RssConfig): void {
	const s = t().editors.rss;
	const note = (cfg.note ??= {});
	clipTemplateEditor(ctx, containerEl, note, {
		heading: s.noteHeading,
		desc: s.noteDesc,
		enabledName: s.noteEnabled,
		enabledDesc: s.noteEnabledDesc,
		defaults: RSS_NOTE_DEFAULTS,
		variables: RSS_CLIP_VARIABLES,
		sample: () => {
			const tab = rssTabs(ctx.card)[0];
			const entry = tab ? rssTabEntries(ctx.card, tab)[0] : undefined;
			if (entry) {
				const markdown = entryMarkdown(entry.item);
				return {
					label: entry.item.title || entry.feed,
					vars: rssClipVars(entry.item, { feed: entry.feed, feedUrl: entry.url, markdown }),
					linkValue: entry.item.id,
				};
			}
			const sample = t().editors.clip.sampleEntry;
			const item = {
				id: "https://example.com/digest-42",
				title: sample.title,
				link: "https://example.com/digest-42",
				excerpt: sample.content,
				published: Date.now() - 3_600_000,
				image: "",
				content: sample.content,
				author: sample.author,
				categories: ["newsletter"],
			};
			return {
				label: null,
				vars: rssClipVars(item, { feed: sample.feed, feedUrl: "https://example.com/feed.xml", markdown: sample.content }),
				linkValue: item.id,
			};
		},
	});
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
				note: source.rss.note
					? {
							...source.rss.note,
							properties: source.rss.note.properties?.map((p) => ({ ...p })),
						}
					: undefined,
			};
	},
	expressive: true,
	liveness: { mode: "static" },
};
