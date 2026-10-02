/**
 * Reading RSS entries inside Hearth (#377).
 *
 * The reader is a page of its own, drawn by {@link RssReader} into whatever
 * hosts it — a dialog over the board ({@link RssReaderModal}) or a tab
 * (`rssreaderview.ts`), the way the folder browser is drawn into both. It
 * shows one entry at a time and steps through the card's whole list: the
 * card's feeds along the top (with how many are unread), the entries of the
 * one chosen down the side, the entry itself on the right, with buttons to
 * open its page, save it as a note, mark it unread, and load its pictures.
 * Arrow keys walk the entries and `[` `]` the feeds.
 *
 * An entry with a web link can still open that page directly — it does by
 * default; one without (an email newsletter brought into a feed, where there
 * is no page) opens here whatever the card says.
 *
 * The feed's HTML is untrusted. It goes through Obsidian's
 * `sanitizeHTMLToDom` (DOMPurify), and {@link tidyReaderBody} then takes out
 * what sanitising leaves but a reader has no use for: embedded frames and
 * forms, links that lead nowhere outside the reader, colours and typefaces
 * that would fight the theme, and pictures until they are asked for — a
 * remote picture, the 1×1 tracking pixel above all, tells its sender the mail
 * was opened.
 */
import {
	type App,
	htmlToMarkdown,
	moment as createMoment,
	Notice,
	sanitizeHTMLToDom,
	type TFile,
} from "obsidian";
import { buildClipNote, resolveClipTemplate } from "./clip";
import { findNoteByProperty, readTemplateText, writeClipNote } from "./clipnote";
import { setIcon } from "./glyphs";
import { t } from "./i18n";
import { openFile, type OpenFrom } from "./opener";
import { loadFeed, type RssItem } from "./rss";
import {
	rssEntryRead,
	rssTabEntries,
	rssTabLabel,
	rssTabLoaded,
	rssTabs,
	rssTabUnread,
	rssVisibleEntries,
	type RssEntry,
	type RssTab,
} from "./rssfeeds";
import { RSS_NOTE_DEFAULTS, rssClipVars } from "./rssnote";
import { onRssReadChange, setRssRead } from "./rssstate";
import type { CardDesign, DashboardCard, HomeSettings, RssOpenIn } from "./types";
import { currentUiDesign, DESIGN_ATTR, HearthModal } from "./uidesign";

const WEB_LINK = /^https?:\/\//i;

// ---- Deciding where an entry opens -------------------------------------------

/** What activating an entry does: open its page in the browser, read it in
 * Hearth, or nothing (no link and no text to show). */
export type RssOpenAction = "link" | "reader" | null;

/** How an entry opens under a card's "Open entries in". In the browser by
 * default — the page is the article — with the reader as the fallback for an
 * entry that only carries its text; the reader modes read every entry that
 * has text in Hearth, and fall back to the page for one that has none. */
export function rssOpenAction(item: RssItem, openIn: RssOpenIn = "browser"): RssOpenAction {
	const hasLink = WEB_LINK.test(item.link);
	const hasBody = hasText(item);
	if (hasLink && (openIn === "browser" || !hasBody)) return "link";
	return hasBody ? "reader" : null;
}

function hasText(item: RssItem): boolean {
	return !!(item.content.trim() || item.excerpt.trim());
}

/** Everything opening an entry needs from where it was opened. */
export interface RssOpenContext {
	app: App;
	settings: HomeSettings;
	opener: OpenFrom;
}

/**
 * Open an entry the way its card says: its page, or the reader as a dialog or
 * in a tab — `as` overrides the card (an item menu's "Read in Hearth"). The
 * entry counts as read either way.
 */
export function openRssEntry(
	ctx: RssOpenContext,
	card: DashboardCard,
	tabId: string,
	entry: RssEntry,
	as?: RssOpenIn,
): void {
	const openIn = as ?? card.rss?.openIn ?? "browser";
	const action = rssOpenAction(entry.item, openIn);
	if (action === null) {
		new Notice(t().cards.rss.nothingToOpen);
		return;
	}
	if (action === "link") {
		window.open(entry.item.link, "_blank");
		setRssRead([entry], true);
		return;
	}
	const state: RssReaderState = { card: card.id, feed: tabId, entry: entry.key };
	if (openIn === "tab") {
		void openRssReaderTab(ctx.app, { ...state, design: currentUiDesign() });
		return;
	}
	new RssReaderModal(ctx, card, state).open();
}

// ---- Cleaning a feed's HTML ---------------------------------------------------

/** Elements a reader never shows, even when the sanitiser lets them through:
 * active content, forms, and every element besides `<img>` that would fetch
 * something from the sender (media, `<picture>` sources, SVG images). */
const DROP =
	"script, style, link, meta, base, iframe, frame, frameset, object, embed, form, input, button, select, textarea, video, audio, source, track, image, use";

/** Inline style properties the theme owns in the reader. */
const THEMED = ["color", "background", "background-color", "background-image", "font-family"];

/** Where a picture's address waits while the markup is sanitised: an `<img>`
 * with a `src` starts downloading the moment it is created in the page, which
 * the sanitiser's copy into the page would do. */
const HELD_SRC = "data-hearth-src";

/** Whether a body is plain text (shown with its line breaks kept) rather
 * than markup. */
export function isPlainText(body: string): boolean {
	return !/<[a-z!/][^>]*>/i.test(body);
}

/**
 * Make feed markup fit to read, in place. Run on an inert document (see
 * {@link prepareEntryHtml}) — nothing in it loads — before sanitising:
 *
 * - drop frames, forms, media and anything else {@link DROP} names;
 * - web and mail links open outside Obsidian; any other link (relative,
 *   `javascript:`, an in-page anchor) loses its address and stays as text;
 * - tracking pixels (a declared size of 2 px or less) and pictures with no web
 *   address always go; the rest go too when `images` is false, and are
 *   counted; the ones kept have their address held in {@link HELD_SRC} when
 *   `hold` is set, for {@link releaseImages} to put back;
 * - layout widths newsletters hard-code (`width="600"`) are lifted so the
 *   body reflows;
 * - colours and typefaces are left to the theme: a newsletter's white table
 *   cell would otherwise hold a dark theme's white text.
 *
 * Returns how many pictures were held back (pixels not counted), for the
 * reader's "Load pictures".
 */
export function tidyReaderBody(
	root: ParentNode,
	opts: { images: boolean; hold?: boolean; held?: string[] },
): { blocked: number } {
	for (const el of Array.from(root.querySelectorAll(DROP))) el.remove();

	for (const a of Array.from(root.querySelectorAll("a"))) {
		const href = a.getAttribute("href")?.trim() ?? "";
		if (WEB_LINK.test(href) || /^mailto:/i.test(href)) {
			a.setAttribute("target", "_blank");
			a.setAttribute("rel", "noopener noreferrer");
		} else {
			a.removeAttribute("href");
		}
	}

	let blocked = 0;
	for (const img of Array.from(root.querySelectorAll("img"))) {
		const src = img.getAttribute("src")?.trim() ?? "";
		const tiny = [img.getAttribute("width"), img.getAttribute("height")].some(
			(v) => v !== null && Number.parseFloat(v) <= 2,
		);
		if (tiny || !WEB_LINK.test(src)) {
			img.remove();
			continue;
		}
		if (!opts.images) {
			blocked++;
			img.remove();
			continue;
		}
		img.removeAttribute("srcset");
		img.setAttribute("loading", "lazy");
		img.setAttribute("referrerpolicy", "no-referrer");
		if (opts.hold) {
			img.removeAttribute("src");
			img.setAttribute(HELD_SRC, src);
			opts.held?.push(src);
		}
	}

	for (const el of Array.from(root.querySelectorAll("[width]"))) {
		if (el.localName !== "img") el.removeAttribute("width");
	}
	for (const el of Array.from(root.querySelectorAll("[bgcolor], [background], font[color], font[face]"))) {
		for (const attr of ["bgcolor", "background", "color", "face"]) el.removeAttribute(attr);
	}
	for (const el of Array.from(root.querySelectorAll<HTMLElement>("[style]"))) {
		for (const prop of THEMED) el.style.removeProperty(prop);
		if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
	}
	return { blocked };
}

/** After sanitising: links open outside again (the sanitiser drops
 * `target`), and the pictures kept get their addresses back — each set up
 * to load lazily and without a referrer before it can start. `held` is the
 * addresses in document order, for a sanitiser that drops `data-` attributes:
 * the pictures were already chosen, so it has no reason to drop one, and
 * the n-th picture is the n-th address — trusted only when the counts agree. */
export function releaseImages(root: ParentNode, held: readonly string[] = []): void {
	for (const a of Array.from(root.querySelectorAll("a[href]"))) {
		a.setAttribute("target", "_blank");
		a.setAttribute("rel", "noopener noreferrer");
	}
	const imgs = Array.from(root.querySelectorAll("img"));
	const byOrder = imgs.length === held.length;
	for (const [i, img] of imgs.entries()) {
		if (img.hasAttribute("src")) continue;
		const src = img.getAttribute(HELD_SRC) ?? (byOrder ? held[i] : "");
		img.removeAttribute(HELD_SRC);
		if (!WEB_LINK.test(src)) {
			img.remove();
			continue;
		}
		img.setAttribute("loading", "lazy");
		img.setAttribute("referrerpolicy", "no-referrer");
		img.setAttribute("src", src);
	}
}

/** An entry's markup parsed into an inert document — one that loads nothing
 * and runs nothing — and tidied there. */
export function prepareEntryHtml(
	raw: string,
	opts: { images: boolean; hold?: boolean },
): { body: HTMLElement; blocked: number; held: string[] } {
	const body = new DOMParser().parseFromString(raw, "text/html").body;
	const held: string[] = [];
	const { blocked } = tidyReaderBody(body, { ...opts, held });
	return { body, blocked, held };
}

/** An entry's text, ready to show: sanitised, tidied, pictures decided on. */
function entryFragment(item: RssItem, images: boolean): { fragment: DocumentFragment | null; text: string; blocked: number } {
	const raw = item.content.trim() || item.excerpt.trim();
	if (isPlainText(raw)) return { fragment: null, text: raw, blocked: 0 };
	const { body, blocked, held } = prepareEntryHtml(raw, { images, hold: true });
	const fragment = sanitizeHTMLToDom(body.innerHTML);
	releaseImages(fragment, held);
	return { fragment, text: "", blocked };
}

/** An entry's text as Markdown, for a note. Converted from the inert
 * document, so making the note loads nothing either. */
export function entryMarkdown(item: RssItem): string {
	const raw = item.content.trim() || item.excerpt.trim();
	if (isPlainText(raw)) return raw;
	return htmlToMarkdown(prepareEntryHtml(raw, { images: true }).body).trim();
}

// ---- Saving an entry as a note -----------------------------------------------

/** The note an entry was saved as before, if the card links them. */
export function entryNote(app: App, card: DashboardCard, entry: RssEntry): TFile | null {
	const tpl = resolveClipTemplate(card.rss?.note ?? {}, RSS_NOTE_DEFAULTS);
	return findNoteByProperty(app, tpl.linkKey.trim(), entry.item.id);
}

/** Save an entry through the card's note template. Pictures go into the note
 * as links — a note is something the user chose to keep — but tracking pixels
 * don't. */
export async function saveEntryNote(app: App, card: DashboardCard, entry: RssEntry): Promise<TFile | null> {
	const cfg = card.rss?.note ?? {};
	const vars = rssClipVars(entry.item, { feed: entry.feed, feedUrl: entry.url, markdown: entryMarkdown(entry.item) });
	const built = buildClipNote(cfg, RSS_NOTE_DEFAULTS, vars, {
		templateText: await readTemplateText(app, cfg.template),
		linkValue: entry.item.id,
		fallbackName: entry.feed,
	});
	return writeClipNote(app, built);
}

// ---- The reader ---------------------------------------------------------------

/** Where a reader is: which card, which of its tabs, which entry. */
export interface RssReaderState {
	card: string;
	feed: string;
	entry: string;
	/** The design a reader tab is drawn in (the card's or dialog's that
	 * opened it). Dialogs take theirs from where they were opened. */
	design?: CardDesign;
}

/** Read a reader state out of whatever a tab was restored with. */
export function readReaderState(raw: unknown): RssReaderState {
	const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const str = (v: unknown): string => (typeof v === "string" ? v : "");
	const state: RssReaderState = { card: str(r.card), feed: str(r.feed), entry: str(r.entry) };
	if (r.design === "classic" || r.design === "expressive") state.design = r.design;
	return state;
}

/** What the reader needs from whatever holds it. */
export interface RssReaderHost extends RssOpenContext {
	/** The card being read, found afresh each draw (a tab outlives edits). */
	card(): DashboardCard | null;
	setTitle(text: string): void;
	/** Go somewhere: the dialog just redraws, a tab records it in history. */
	navigate(state: RssReaderState): void;
	/** The dialog only: move this page into a tab. */
	popOut?(state: RssReaderState): void;
	/** The dialog only: close (after opening a note). */
	close?(): void;
}

/** Whether the entry list is folded away, for the session, in every reader. */
let listHidden: boolean | null = null;

/** The reader page, drawn into a host's element. */
export class RssReader {
	private state: RssReaderState;
	/** The entries being stepped through. Taken when a feed is chosen and kept
	 * while reading it, so an entry marked read doesn't drop out of an
	 * unread-only list under the reader. */
	private entries: RssEntry[] = [];
	private snapshotOf = "";
	private imagesAllowed = false;
	private loading = false;
	/** Tabs whose feeds this reader has fetched (or tried to): one attempt
	 * each, so an offline reader doesn't ask again on every redraw. */
	private readonly fetched = new Set<string>();
	private live = true;
	private readonly unsubscribe: () => void;
	private root: HTMLElement;
	private barEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private articleEl: HTMLElement | null = null;
	/** The entry the article pane last drew. */
	private drawnEntry = "";

	constructor(
		private readonly host: RssReaderHost,
		parent: HTMLElement,
		state: RssReaderState,
	) {
		this.state = state;
		this.root = parent.createDiv({ cls: "hearth-rss-reader", attr: { tabindex: "0" } });
		this.root.addEventListener("keydown", (e) => this.key(e));
		// Read marks made anywhere — this reader included — repaint the feed
		// counts and the list's dots, never the entry being read.
		this.unsubscribe = onRssReadChange(() => {
			if (!this.live) return;
			this.drawBar();
			this.drawList();
		});
	}

	/** Take a new state: a step to another entry, another feed, or a tab
	 * restored from history. */
	setState(state: RssReaderState): void {
		if (state.entry !== this.state.entry) this.imagesAllowed = false;
		this.state = state;
		this.draw();
	}

	destroy(): void {
		this.live = false;
		this.unsubscribe();
		this.root.remove();
	}

	focus(): void {
		this.root.focus({ preventScroll: true });
	}

	// ---- Model ----

	private card(): DashboardCard | null {
		return this.host.card();
	}

	private tab(card: DashboardCard): RssTab | null {
		const tabs = rssTabs(card);
		return tabs.find((tb) => tb.id === this.state.feed) ?? tabs[0] ?? null;
	}

	/** Refresh the list being stepped through when the feed changed or its
	 * feeds have just loaded. */
	private snapshot(card: DashboardCard, tab: RssTab): void {
		const stamp = `${tab.id}|${rssTabEntries(card, tab).length}`;
		if (stamp === this.snapshotOf && this.entries.some((e) => e.key === this.state.entry)) return;
		this.snapshotOf = stamp;
		this.entries = rssVisibleEntries(card, tab, this.state.entry);
	}

	private current(): RssEntry | null {
		return this.entries.find((e) => e.key === this.state.entry) ?? null;
	}

	/** Fetch the tab's feeds when the cache has none yet, then redraw. */
	private ensureLoaded(card: DashboardCard, tab: RssTab): void {
		if (this.loading || rssTabLoaded(tab) || this.fetched.has(tab.id)) return;
		this.fetched.add(tab.id);
		this.loading = true;
		const cfg = card.rss ?? {};
		const ttlMs = Math.max(cfg.refreshMin ?? 30, 1) * 60_000;
		const disabled = this.host.settings.disableExternalCalls;
		void Promise.all(tab.urls.map((url) => loadFeed(url, { ttlMs, disabled }))).then(() => {
			this.loading = false;
			this.snapshotOf = "";
			if (this.live) this.draw();
		});
	}

	private go(patch: Partial<RssReaderState>): void {
		this.host.navigate({ ...this.state, ...patch });
	}

	private step(dir: 1 | -1): void {
		const at = this.entries.findIndex((e) => e.key === this.state.entry);
		const next = this.entries[at + dir];
		if (next) this.go({ entry: next.key });
	}

	private stepFeed(dir: 1 | -1): void {
		const card = this.card();
		if (!card) return;
		const tabs = rssTabs(card);
		if (tabs.length < 2) return;
		const at = Math.max(0, tabs.findIndex((tb) => tb.id === this.state.feed));
		this.openFeed(card, tabs[(at + dir + tabs.length) % tabs.length]);
	}

	/** Switch feeds, landing on its first unread entry (or its first). */
	private openFeed(card: DashboardCard, tab: RssTab): void {
		const entries = rssVisibleEntries(card, tab);
		const first = entries.find((e) => !rssEntryRead(e)) ?? entries[0];
		this.snapshotOf = "";
		this.go({ feed: tab.id, entry: first?.key ?? "" });
	}

	// ---- Drawing ----

	draw(): void {
		if (!this.live) return;
		const card = this.card();
		const listScroll = this.listEl?.scrollTop ?? 0;
		// A redraw of the entry being read (a settings change) keeps its place.
		const articleScroll = this.drawnEntry === this.state.entry ? (this.articleEl?.scrollTop ?? 0) : 0;
		this.root.empty();
		const strings = t().cards.rss.reader;
		// A tab not yet told which card it reads (it is opened, then given
		// its state) has nothing to say yet.
		if (!this.state.card) return;
		if (!card) {
			this.host.setTitle(strings.title);
			this.root.createDiv({ cls: "hearth-rss-reader-empty", text: strings.gone });
			return;
		}
		const tab = this.tab(card);
		this.host.setTitle(card.title?.trim() || (tab ? rssTabLabel(card, tab) : strings.title));
		if (tab) {
			this.ensureLoaded(card, tab);
			this.snapshot(card, tab);
			// A state naming no entry (a feed just loaded, a tab restored before
			// its feed was fetched) lands on the first unread.
			if (!this.current() && this.entries.length) {
				const first = this.entries.find((e) => !rssEntryRead(e)) ?? this.entries[0];
				this.state = { ...this.state, feed: tab.id, entry: first.key };
			}
		}

		this.root.toggleClass("is-list-hidden", listHidden ?? false);
		this.barEl = this.root.createDiv("hearth-rss-reader-bar");
		const main = this.root.createDiv("hearth-rss-reader-main");
		this.listEl = main.createDiv("hearth-rss-reader-list hearth-rss-content");
		this.articleEl = main.createDiv("hearth-rss-reader-article");
		this.drawBar();
		this.drawList();
		this.listEl.scrollTop = listScroll;
		this.drawArticle();
		if (articleScroll) this.articleEl.scrollTop = articleScroll;
	}

	private toggleList(): void {
		listHidden = !this.root.hasClass("is-list-hidden");
		this.root.toggleClass("is-list-hidden", listHidden);
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
		const btn = parent.createEl("button", {
			cls: "clickable-icon hearth-rss-reader-iconbtn",
			attr: { "aria-label": label, type: "button" },
		});
		setIcon(btn, icon);
		btn.addEventListener("click", onClick);
		return btn;
	}

	private drawBar(): void {
		const card = this.card();
		const bar = this.barEl;
		if (!card || !bar) return;
		bar.empty();
		const strings = t().cards.rss.reader;
		this.iconButton(bar, "panel-left", strings.toggleList, () => this.toggleList());
		const tabs = rssTabs(card);
		const active = this.tab(card)?.id ?? "";
		if (tabs.length > 1) this.iconButton(bar, "chevron-left", strings.prevFeed, () => this.stepFeed(-1));
		const list = bar.createDiv("hearth-rss-tablist");
		for (const tab of tabs) {
			const btn = list.createEl("button", { cls: "hearth-rss-tab", attr: { type: "button" } });
			btn.createSpan({ cls: "hearth-rss-tab-label", text: rssTabLabel(card, tab) });
			const unread = rssTabUnread(tab);
			if (unread > 0) btn.createSpan({ cls: "hearth-rss-tab-count", text: unread > 99 ? "99+" : String(unread) });
			if (tab.id === active) btn.addClass("is-active");
			btn.addEventListener("click", () => this.openFeed(card, tab));
		}
		if (tabs.length > 1) this.iconButton(bar, "chevron-right", strings.nextFeed, () => this.stepFeed(1));
		bar.createDiv("hearth-rss-reader-spacer");
		this.iconButton(bar, "check-check", t().cards.rss.markAllRead, () => {
			const tab = this.tab(card);
			if (tab) setRssRead(rssTabEntries(card, tab), true);
		});
		if (this.host.popOut) this.iconButton(bar, "app-window", strings.popOut, () => this.host.popOut?.(this.state));
	}

	private drawList(): void {
		const card = this.card();
		const list = this.listEl;
		if (!card || !list) return;
		const keepScroll = list.scrollTop;
		list.empty();
		for (const entry of this.entries) {
			const row = list.createDiv("hearth-rss-item");
			row.toggleClass("is-read", rssEntryRead(entry));
			row.toggleClass("is-current", entry.key === this.state.entry);
			row.createSpan({ cls: "hearth-rss-dot", attr: { "aria-hidden": "true" } });
			const main = row.createDiv("hearth-rss-main");
			main.createDiv({ cls: "hearth-rss-title", text: entry.item.title || t().cards.rss.untitled });
			const meta = [this.state.feed === "all" ? entry.feed : "", ago(entry.item.published)].filter(Boolean);
			if (meta.length) main.createDiv({ cls: "hearth-rss-meta", text: meta.join(" · ") });
			row.addEventListener("click", () => this.go({ entry: entry.key }));
		}
		list.scrollTop = keepScroll;
	}

	private drawArticle(): void {
		const card = this.card();
		const el = this.articleEl;
		if (!el) return;
		el.empty();
		el.scrollTop = 0;
		const strings = t().cards.rss;
		const entry = this.current();
		if (!card || !entry) {
			el.createDiv({
				cls: "hearth-rss-reader-empty",
				text: this.loading ? strings.loading : strings.reader.noItems,
			});
			return;
		}
		const item = entry.item;
		this.drawnEntry = entry.key;
		this.listEl?.querySelector(".is-current")?.scrollIntoView({ block: "nearest" });

		const meta = [entry.feed, item.published ? createMoment(new Date(item.published)).format("LLL") : "", item.author]
			.filter(Boolean)
			.join(" · ");
		if (meta) el.createDiv({ cls: "hearth-rss-reader-meta", text: meta });
		el.createEl("h1", { cls: "hearth-rss-reader-title", text: item.title || strings.untitled });

		// ---- Actions ----
		const actions = el.createDiv("hearth-rss-reader-actions");
		const hasLink = WEB_LINK.test(item.link);
		if (hasLink) {
			this.action(actions, "globe", strings.openBrowser, () => window.open(item.link, "_blank"), "mod-cta");
		}
		if (card.rss?.note?.enabled !== false) {
			const existing = entryNote(this.host.app, card, entry);
			if (existing) this.action(actions, "file-text", strings.openNote, () => this.openNote(existing));
			else this.action(actions, "file-plus", strings.saveNote, () => void this.save(card, entry));
		}
		this.action(actions, "circle-dot", strings.markUnread, () => setRssRead([entry], false));
		if (hasLink) {
			this.action(actions, "link", strings.copyLink, () => {
				void navigator.clipboard.writeText(item.link).then(() => new Notice(strings.linkCopied));
			});
		}

		// ---- Body ----
		const mode = this.host.settings.disableExternalCalls ? "never" : (card.rss?.readerImages ?? "ask");
		const images = mode === "always" || (mode === "ask" && this.imagesAllowed);
		const { fragment, text, blocked } = entryFragment(item, images);
		if (blocked > 0 && mode === "ask") {
			const note = el.createDiv("hearth-rss-reader-blocked");
			setIcon(note.createSpan("hearth-rss-reader-btnicon"), "image-off");
			note.createSpan({ cls: "hearth-rss-reader-blocked-text", text: strings.reader.imagesBlocked(blocked) });
			const load = note.createEl("button", { cls: "hearth-rss-reader-action", text: strings.reader.loadImages, attr: { type: "button" } });
			load.addEventListener("click", () => this.loadImages());
		}
		const body = el.createDiv("hearth-rss-reader-body markdown-rendered");
		if (fragment) body.appendChild(fragment);
		else {
			body.addClass("is-plain");
			body.setText(text);
		}

		// ---- Stepping ----
		const at = this.entries.indexOf(entry);
		const nav = el.createDiv("hearth-rss-reader-nav");
		this.navButton(nav, this.entries[at - 1], "prev");
		nav.createDiv({ cls: "hearth-rss-reader-pos", text: strings.reader.position(at + 1, this.entries.length) });
		this.navButton(nav, this.entries[at + 1], "next");
		el.createDiv({ cls: "hearth-rss-reader-keys", text: strings.reader.keys });

		// Opened is read. Marked last, so the repaint it triggers finds the
		// page already drawn.
		if (!rssEntryRead(entry)) setRssRead([entry], true);
	}

	private action(parent: HTMLElement, icon: string, label: string, onClick: () => void, cls = ""): void {
		const btn = parent.createEl("button", { cls: `hearth-rss-reader-action ${cls}`.trim(), attr: { type: "button" } });
		setIcon(btn.createSpan("hearth-rss-reader-btnicon"), icon);
		btn.createSpan({ text: label });
		btn.addEventListener("click", onClick);
	}

	private navButton(nav: HTMLElement, entry: RssEntry | undefined, dir: "prev" | "next"): void {
		const strings = t().cards.rss.reader;
		const btn = nav.createEl("button", { cls: `hearth-rss-reader-step is-${dir}`, attr: { type: "button" } });
		if (!entry) {
			btn.disabled = true;
			btn.addClass("is-empty");
		}
		const icon = createSpan("hearth-rss-reader-btnicon");
		setIcon(icon, dir === "prev" ? "arrow-left" : "arrow-right");
		const label = createDiv("hearth-rss-reader-steplabel");
		label.createDiv({ cls: "hearth-rss-reader-stepdir", text: dir === "prev" ? strings.prev : strings.next });
		if (entry) label.createDiv({ cls: "hearth-rss-reader-steptitle", text: entry.item.title || t().cards.rss.untitled });
		if (dir === "prev") btn.append(icon, label);
		else btn.append(label, icon);
		btn.addEventListener("click", () => this.step(dir === "prev" ? -1 : 1));
	}

	private loadImages(): void {
		this.imagesAllowed = true;
		this.drawArticle();
	}

	private async save(card: DashboardCard, entry: RssEntry): Promise<void> {
		const file = await saveEntryNote(this.host.app, card, entry);
		if (!file) {
			new Notice(t().cards.rss.reader.noteFailed);
			return;
		}
		new Notice(t().cards.rss.reader.noteSaved(file.path));
		// The metadata cache learns the new note's link property a moment
		// later; until then the button would still offer to save it again.
		window.setTimeout(() => {
			if (this.live && this.current()?.key === entry.key) this.drawArticle();
		}, 400);
	}

	private openNote(file: TFile): void {
		void openFile(this.host.opener, file, "card");
		this.host.close?.();
	}

	private key(e: KeyboardEvent): void {
		const target = e.target as HTMLElement | null;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
		const card = this.card();
		const entry = this.current();
		let handled = true;
		switch (e.key) {
			case "ArrowLeft":
			case "k":
				this.step(-1);
				break;
			case "ArrowRight":
			case "j":
				this.step(1);
				break;
			case "[":
				this.stepFeed(-1);
				break;
			case "]":
				this.stepFeed(1);
				break;
			case "o":
				if (entry && WEB_LINK.test(entry.item.link)) window.open(entry.item.link, "_blank");
				break;
			case "s":
				if (card && entry && card.rss?.note?.enabled !== false) {
					const existing = entryNote(this.host.app, card, entry);
					if (existing) this.openNote(existing);
					else void this.save(card, entry);
				}
				break;
			case "u":
				if (entry) setRssRead([entry], !rssEntryRead(entry));
				break;
			case "i":
				this.loadImages();
				break;
			case "l":
				this.toggleList();
				break;
			default:
				handled = false;
		}
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}
}

/** How long ago, for the list. */
function ago(ms: number | null): string {
	if (!ms) return "";
	return (createMoment(new Date(ms)) as unknown as { fromNow(): string }).fromNow();
}

// ---- The dialog -----------------------------------------------------------------

/** The reader over the board. */
export class RssReaderModal extends HearthModal {
	private reader: RssReader | null = null;

	constructor(
		private readonly ctx: RssOpenContext,
		private readonly cardRef: DashboardCard,
		private readonly initial: RssReaderState,
	) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-rss-reader-modal");
		const host: RssReaderHost = {
			...this.ctx,
			card: () => this.cardRef,
			setTitle: (text) => this.titleEl.setText(text),
			navigate: (state) => this.reader?.setState(state),
			close: () => this.close(),
			popOut: (state) => {
				// The tab keeps the dialog's design: it is the same page, moved.
				const stated = this.modalEl.getAttribute(DESIGN_ATTR);
				const design = stated === "expressive" || stated === "classic" ? stated : undefined;
				this.close();
				void openRssReaderTab(this.app, { ...state, design });
			},
		};
		this.reader = new RssReader(host, this.contentEl, this.initial);
		this.reader.draw();
		this.reader.focus();
	}

	onClose(): void {
		this.reader?.destroy();
		this.reader = null;
		this.contentEl.empty();
	}
}

// ---- The tab ---------------------------------------------------------------------

/** The view type the reader registers under in a tab (`rssreaderview.ts`).
 * Declared here so the card can open one without importing the view. */
export const VIEW_TYPE_RSS_READER = "hearth-rss-reader";

/** Open the reader in a tab — the card's own, when it already has one. */
export async function openRssReaderTab(app: App, state: RssReaderState): Promise<void> {
	const existing = app.workspace
		.getLeavesOfType(VIEW_TYPE_RSS_READER)
		.find((leaf) => readReaderState(leaf.getViewState().state).card === state.card);
	const leaf = existing ?? app.workspace.getLeaf("tab");
	await leaf.setViewState({ type: VIEW_TYPE_RSS_READER, state: { ...state }, active: true });
	if (existing) await app.workspace.revealLeaf(existing);
}
