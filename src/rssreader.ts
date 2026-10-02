/**
 * Reading an RSS entry inside Hearth (#377).
 *
 * An entry with a web link opens that page, as it always has. One without —
 * typically an email newsletter turned into a feed (LetterFeed, Kill the
 * Newsletter, FreshRSS' own imports), where there is no page to go to — used
 * to do nothing at all. Those open here instead: the body the feed carried,
 * sanitised and shown in a dialog styled like the calendar's event details.
 *
 * The feed's HTML is untrusted. It goes through Obsidian's
 * `sanitizeHTMLToDom` (DOMPurify), and {@link tidyReaderBody} then takes out
 * what sanitising leaves but a reader has no use for: embedded frames and
 * forms, links that lead nowhere outside the dialog, and remote pictures when
 * external calls are off — including the 1×1 tracking pixels newsletters
 * carry, which would otherwise tell the sender the mail was opened.
 */
import { type App, moment as createMoment, Notice, sanitizeHTMLToDom } from "obsidian";
import { setIcon } from "./glyphs";
import { t } from "./i18n";
import { type RssItem } from "./rss";
import { HearthModal } from "./uidesign";

/** What activating an entry does: open its web page, read it in Hearth, or
 * nothing (no link and no body to show). */
export type RssOpenAction = "link" | "reader" | null;

const WEB_LINK = /^https?:\/\//i;

/** How an entry opens. By default a web link wins — the page is the
 * article — and the reader is the fallback for an entry that only carries its
 * body. `preferReader` (the card's "Read in Hearth") flips that for entries
 * whose feed sends a body, keeping the link one click away in the dialog. */
export function rssOpenAction(item: RssItem, preferReader = false): RssOpenAction {
	const hasLink = WEB_LINK.test(item.link);
	const hasBody = !!(item.content.trim() || item.excerpt.trim());
	if (hasLink && !(preferReader && hasBody)) return "link";
	return hasBody ? "reader" : null;
}

/** Context the reader shows around the entry. */
export interface RssReaderContext {
	/** The feed the entry came from, shown under the title. */
	source?: string;
	/** The "disable external calls" setting: remote pictures stay unloaded. */
	disableExternal: boolean;
	/** Read entries that carry a body in Hearth even when they have a link. */
	preferReader?: boolean;
}

/** Activate an entry: its page in the browser, or the reader when it has
 * none. An entry with neither says so rather than silently doing nothing. */
export function openRssItem(app: App, item: RssItem, ctx: RssReaderContext): void {
	switch (rssOpenAction(item, ctx.preferReader)) {
		case "link":
			window.open(item.link, "_blank");
			return;
		case "reader":
			new RssReaderModal(app, item, ctx).open();
			return;
		default:
			new Notice(t().cards.rss.nothingToOpen);
	}
}

/** Elements a reader never shows, even when the sanitiser lets them through. */
const DROP = "script, style, link, meta, iframe, frame, frameset, object, embed, form, input, button, select, textarea";

/** Whether a tag-free body is plain text (shown with its line breaks kept)
 * rather than markup. */
export function isPlainText(body: string): boolean {
	return !/<[a-z!/][^>]*>/i.test(body);
}

/**
 * Make sanitised feed markup fit to read in a dialog, in place:
 *
 * - drop frames, forms and anything else {@link DROP} names;
 * - web and mail links open outside Obsidian; any other link (relative,
 *   `javascript:`, an in-page anchor) loses its address and stays as text;
 * - pictures load lazily without a referrer, or not at all when `images` is
 *   false; tracking pixels (a declared size of 2 px or less) always go;
 * - layout widths newsletters hard-code (`width="600"`) are lifted so the
 *   body reflows to the dialog;
 * - colours and typefaces are left to the theme: a newsletter's white table
 *   cell would otherwise hold a dark theme's white text.
 */
export function tidyReaderBody(root: ParentNode, opts: { images: boolean }): void {
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

	for (const img of Array.from(root.querySelectorAll("img"))) {
		const src = img.getAttribute("src")?.trim() ?? "";
		const tiny = [img.getAttribute("width"), img.getAttribute("height")].some(
			(v) => v !== null && Number.parseFloat(v) <= 2,
		);
		if (!opts.images || tiny || !WEB_LINK.test(src)) {
			img.remove();
			continue;
		}
		img.removeAttribute("srcset");
		img.setAttribute("loading", "lazy");
		img.setAttribute("referrerpolicy", "no-referrer");
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
}

/** Inline style properties the theme owns in the reader. */
const THEMED = ["color", "background", "background-color", "background-image", "font-family"];

/** The entry in a dialog: title, where and when it came from, its body, and
 * the page's address when it has one. */
class RssReaderModal extends HearthModal {
	constructor(
		app: App,
		private readonly item: RssItem,
		private readonly ctx: RssReaderContext,
	) {
		super(app);
	}

	onOpen(): void {
		const { item, ctx } = this;
		const strings = t().cards.rss;
		this.modalEl.addClass("hearth-rss-reader-modal");
		this.titleEl.setText(item.title || strings.untitled);

		const meta: string[] = [];
		if (ctx.source) meta.push(ctx.source);
		if (item.published) meta.push(createMoment(new Date(item.published)).format("LLL"));
		if (meta.length) {
			this.contentEl.createDiv({ cls: "hearth-rss-reader-meta", text: meta.join(" · ") });
		}

		const body = this.contentEl.createDiv("hearth-rss-reader-body markdown-rendered");
		const raw = item.content.trim() || item.excerpt.trim();
		if (isPlainText(raw)) {
			body.addClass("is-plain");
			body.setText(raw);
		} else {
			const fragment = sanitizeHTMLToDom(raw);
			tidyReaderBody(fragment, { images: !ctx.disableExternal });
			body.appendChild(fragment);
		}

		if (WEB_LINK.test(item.link)) {
			const footer = this.contentEl.createDiv("hearth-event-footer");
			const open = footer.createEl("button", { cls: "mod-cta" });
			setIcon(open.createSpan("hearth-event-btnicon"), "globe");
			open.createSpan({ text: t().tui.cards.rssOpen });
			open.addEventListener("click", () => {
				window.open(item.link, "_blank");
				this.close();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
