/**
 * A feed entry as a note: the variables an entry fills a note template with
 * and the template an RSS card starts from (see `src/clip.ts`). The defaults
 * follow the Obsidian Web Clipper's, which is what a clipped article looks
 * like to most people already: where it came from, who wrote it, when it was
 * published and clipped, tagged, then the article itself.
 *
 * Pure; the reader turns the entry's HTML into Markdown and writes the note.
 */
import { clipDate, commonClipVars, type ClipDefaults, type ClipVars } from "./clip";
import type { RssItem } from "./rss";

/** The property an entry's note remembers the entry by. */
export const DEFAULT_RSS_LINK_KEY = "rss_id";

export const RSS_NOTE_DEFAULTS: ClipDefaults = {
	name: "{{title}}",
	folder: "",
	properties: [
		{ name: "source", value: "{{link}}", type: "text" },
		{ name: "author", value: "{{author}}", type: "text" },
		{ name: "feed", value: "{{feed}}", type: "text" },
		{ name: "published", value: "{{published}}", type: "date" },
		{ name: "created", value: "{{today}}", type: "date" },
		{ name: "tags", value: "rss", type: "list" },
	],
	body: "{{content}}",
	linkKey: DEFAULT_RSS_LINK_KEY,
};

/** The variables an entry offers, in the order the editor lists them. */
export const RSS_CLIP_VARIABLES = [
	"title",
	"link",
	"content",
	"excerpt",
	"published",
	"author",
	"feed",
	"feedUrl",
	"categories",
	"image",
	"id",
	"html",
	"today",
	"now",
] as const;

/** An entry's template variables. `markdown` is the entry's body already
 * converted (the reader does that, with Obsidian's converter); a published
 * date reads as a day unless a `date` filter says otherwise. */
export function rssClipVars(
	item: RssItem,
	ctx: { feed: string; feedUrl: string; markdown: string },
	now = Date.now(),
): ClipVars {
	return {
		...commonClipVars(now),
		title: item.title,
		link: item.link,
		content: ctx.markdown,
		html: item.content,
		excerpt: item.excerpt,
		published: item.published === null ? "" : clipDate(item.published, "YYYY-MM-DD"),
		author: item.author,
		feed: ctx.feed,
		feedUrl: ctx.feedUrl,
		categories: item.categories,
		image: item.image,
		id: item.id,
	};
}
