/**
 * @vitest-environment jsdom
 *
 * Linkless RSS entries (#377): the parser keeps an entry's full body and its
 * permalink guid, the card decides between the page and Hearth's reader, and
 * the reader's tidy pass strips what a feed's HTML shouldn't bring into a
 * dialog. DOMPurify itself (Obsidian's sanitizeHTMLToDom) is not under test.
 */
import { describe, expect, it } from "vitest";
import { parseFeed, type RssItem } from "../src/rss";
import { isPlainText, rssOpenAction, tidyReaderBody } from "../src/rssreader";

const rss = (items: string): string =>
	`<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Letters</title>${items}</channel></rss>`;

const atom = (entries: string): string =>
	`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><title>Atom</title>${entries}</feed>`;

function item(over: Partial<RssItem>): RssItem {
	return { title: "T", link: "", excerpt: "", published: null, image: "", content: "", ...over };
}

describe("parseFeed: entry bodies and links", () => {
	it("keeps content:encoded as the body, over the description", () => {
		const feed = parseFeed(
			rss(`<item><title>Issue 12</title><link></link><description>Short</description><content:encoded><![CDATA[<p>Full <b>text</b></p>]]></content:encoded></item>`),
		)!;
		expect(feed.items[0].link).toBe("");
		expect(feed.items[0].content).toBe("<p>Full <b>text</b></p>");
		expect(feed.items[0].excerpt).toBe("Short");
	});

	it("falls back to the description when there is no content:encoded", () => {
		const feed = parseFeed(rss(`<item><title>A</title><description>&lt;p&gt;Hi&lt;/p&gt;</description></item>`))!;
		expect(feed.items[0].content).toBe("<p>Hi</p>");
	});

	it("takes a permalink guid as the link when <link> is missing", () => {
		const feed = parseFeed(
			rss(
				`<item><title>A</title><guid>https://example.com/a</guid></item>` +
					`<item><title>B</title><guid isPermaLink="false">https://example.com/b</guid></item>` +
					`<item><title>C</title><guid>urn:uuid:1234</guid></item>`,
			),
		)!;
		const byTitle = Object.fromEntries(feed.items.map((i) => [i.title, i.link]));
		expect(byTitle).toEqual({ A: "https://example.com/a", B: "", C: "" });
	});

	it("keeps the markup of Atom xhtml content, unwrapping its div", () => {
		const feed = parseFeed(
			atom(`<entry><title>X</title><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Hello <em>there</em></p></div></content></entry>`),
		)!;
		expect(feed.items[0].content).toMatch(/^<p[^>]*>Hello <em>there<\/em><\/p>$/);
	});

	it("reads Atom html content and ignores a media:content thumbnail", () => {
		const feed = parseFeed(
			atom(`<entry><title>Y</title><media:content url="https://example.com/i.jpg" medium="image"/><summary type="html">&lt;p&gt;Body&lt;/p&gt;</summary></entry>`),
		)!;
		expect(feed.items[0].content).toBe("<p>Body</p>");
	});
});

describe("rssOpenAction", () => {
	it("opens a web link in the browser", () => {
		expect(rssOpenAction(item({ link: "https://example.com", content: "<p>x</p>" }))).toBe("link");
	});

	it("reads a linkless entry with a body in Hearth", () => {
		expect(rssOpenAction(item({ content: "<p>x</p>" }))).toBe("reader");
		expect(rssOpenAction(item({ link: "javascript:alert(1)", excerpt: "x" }))).toBe("reader");
	});

	it("prefers the reader when asked, but only when there is a body", () => {
		expect(rssOpenAction(item({ link: "https://example.com", content: "<p>x</p>" }), true)).toBe("reader");
		expect(rssOpenAction(item({ link: "https://example.com" }), true)).toBe("link");
	});

	it("has nothing to do for an entry with neither", () => {
		expect(rssOpenAction(item({ content: "  " }))).toBeNull();
	});
});

describe("tidyReaderBody", () => {
	const tidy = (html: string, images = true): HTMLElement => {
		const root = new DOMParser().parseFromString(html, "text/html").body;
		tidyReaderBody(root, { images });
		return root;
	};

	it("drops frames and forms", () => {
		const root = tidy(`<p>a</p><iframe src="https://x"></iframe><form><input></form>`);
		expect(root.innerHTML).toBe("<p>a</p>");
	});

	it("sends web and mail links outside, and defuses the rest", () => {
		const root = tidy(`<a href="https://e.com">w</a><a href="mailto:a@b.c">m</a><a href="/rel">r</a><a href="javascript:x()">j</a>`);
		const [web, mail, rel, js] = Array.from(root.querySelectorAll("a"));
		expect(web.getAttribute("target")).toBe("_blank");
		expect(web.getAttribute("rel")).toBe("noopener noreferrer");
		expect(mail.getAttribute("target")).toBe("_blank");
		expect(rel.hasAttribute("href")).toBe(false);
		expect(js.hasAttribute("href")).toBe(false);
	});

	it("loads pictures privately, drops tracking pixels and non-web sources", () => {
		const root = tidy(
			`<img src="https://e.com/a.png" srcset="x 2x"><img src="https://t.com/p.gif" width="1" height="1"><img src="cid:abc">`,
		);
		const imgs = root.querySelectorAll("img");
		expect(imgs).toHaveLength(1);
		expect(imgs[0].getAttribute("referrerpolicy")).toBe("no-referrer");
		expect(imgs[0].getAttribute("loading")).toBe("lazy");
		expect(imgs[0].hasAttribute("srcset")).toBe(false);
	});

	it("drops every picture when external calls are off", () => {
		expect(tidy(`<p>a</p><img src="https://e.com/a.png">`, false).innerHTML).toBe("<p>a</p>");
	});

	it("leaves colours, typefaces and fixed widths to the dialog", () => {
		const root = tidy(
			`<table width="600" bgcolor="#fff"><tr><td style="color: #000; background-color: #fff; padding: 4px; font-family: Arial">x</td></tr></table><font color="red">y</font>`,
		);
		const table = root.querySelector("table")!;
		expect(table.hasAttribute("width")).toBe(false);
		expect(table.hasAttribute("bgcolor")).toBe(false);
		expect(root.querySelector("td")!.getAttribute("style")).toBe("padding: 4px;");
		expect(root.querySelector<HTMLElement>("font")!.hasAttribute("color")).toBe(false);
	});
});

describe("isPlainText", () => {
	it("tells a tag-free body from markup", () => {
		expect(isPlainText("Line one\nLine two, a < b")).toBe(true);
		expect(isPlainText("<p>Hi</p>")).toBe(false);
		expect(isPlainText("Hi<br/>there")).toBe(false);
	});
});
