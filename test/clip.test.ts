import { describe, expect, it } from "vitest";
import {
	buildClipNote,
	clipDate,
	clipPropertyValue,
	previewClipNote,
	renderClip,
	renderClipValue,
	type ClipDefaults,
	type ClipVars,
} from "../src/clip";
import { RSS_NOTE_DEFAULTS, rssClipVars } from "../src/rssnote";
import type { RssItem } from "../src/rss";

/**
 * Note templates (src/clip.ts): the Web-Clipper-style `{{variable|filter}}`
 * language, typed properties, and the assembled note. vitest runs in UTC, so
 * every date below formats deterministically.
 */

const NOW = Date.UTC(2026, 9, 2, 18, 30);
const vars: ClipVars = {
	title: "Hello, World: a story",
	empty: "",
	tags: ["one", "two", "three"],
	published: clipDate(Date.UTC(2026, 8, 29, 7, 5), "YYYY-MM-DD"),
	raw: "2026-09-29T07:05:00Z",
	multi: "line one\nline two",
	today: clipDate(NOW, "YYYY-MM-DD"),
};

describe("renderClip", () => {
	it("fills variables and leaves unknown ones as written", () => {
		expect(renderClip("{{title}} / {{nope}} / {{ title }}", vars)).toBe(
			"Hello, World: a story / {{nope}} / Hello, World: a story",
		);
	});

	it("formats dates with their own format, or a date filter's", () => {
		expect(renderClip("{{published}}", vars)).toBe("2026-09-29");
		expect(renderClip('{{published|date:"D MMM YYYY, HH:mm"}}', vars)).toBe("29 Sep 2026, 07:05");
		expect(renderClip('{{raw|date:"DD.MM."}}', vars)).toBe("29.09.");
	});

	it("reads the legacy {{name:FORMAT}} form as a date filter", () => {
		expect(renderClip("{{published:YYYY/MM}}", vars)).toBe("2026/09");
	});

	it("chains text filters", () => {
		expect(renderClip("{{title|lower|truncate:5}}", vars)).toBe("hello…");
		expect(renderClip("{{title|upper}}", vars)).toBe("HELLO, WORLD: A STORY");
		expect(renderClip("{{title|replace:\",\",\"\"|title}}", vars)).toBe("Hello World: A Story");
		expect(renderClip("{{empty|default:\"n/a\"}}", vars)).toBe("n/a");
		expect(renderClip("{{title|safe_name}}", vars)).toBe("Hello, World a story");
	});

	it("handles lists", () => {
		expect(renderClip("{{tags}}", vars)).toBe("one, two, three");
		expect(renderClip("{{tags|join:\" + \"}}", vars)).toBe("one + two + three");
		expect(renderClip("{{tags|wikilink|join}}", vars)).toBe("[[one]], [[two]], [[three]]");
		expect(renderClip("{{tags|first}}–{{tags|last}}", vars)).toBe("one–three");
		expect(renderClip("{{tags|list}}", vars)).toBe("- one\n- two\n- three");
		expect(renderClip("{{title|split:\":\"|last}}", vars)).toBe("a story");
	});

	it("quotes and links", () => {
		expect(renderClip("{{multi|blockquote}}", vars)).toBe("> line one\n> line two");
		expect(renderClip('{{title|link:"src"}}', { title: "https://e.com" })).toBe("[src](https://e.com)");
	});

	it("ignores an unknown filter rather than failing", () => {
		expect(renderClip("{{title|frobnicate}}", vars)).toBe("Hello, World: a story");
	});
});

describe("renderClipValue and properties", () => {
	it("keeps a lone placeholder's shape", () => {
		expect(renderClipValue("{{tags}}", vars)).toEqual(["one", "two", "three"]);
		expect(renderClipValue(" {{published}} ", vars)).toEqual(vars.published);
		expect(renderClipValue("#{{tags|first}}", vars)).toBe("#one");
	});

	it("types property values", () => {
		expect(clipPropertyValue({ name: "t", value: "{{tags}}", type: "list" }, vars)).toEqual(["one", "two", "three"]);
		expect(clipPropertyValue({ name: "t", value: "a, b,, c", type: "list" }, vars)).toEqual(["a", "b", "c"]);
		expect(clipPropertyValue({ name: "n", value: "4,5", type: "number" }, vars)).toBe(4.5);
		expect(clipPropertyValue({ name: "n", value: "four", type: "number" }, vars)).toBeUndefined();
		expect(clipPropertyValue({ name: "c", value: "yes", type: "checkbox" }, vars)).toBe(true);
		expect(clipPropertyValue({ name: "c", value: "no", type: "checkbox" }, vars)).toBe(false);
		expect(clipPropertyValue({ name: "d", value: "{{published}}", type: "datetime" }, vars)).toBe("2026-09-29T07:05");
		expect(clipPropertyValue({ name: "e", value: "{{empty}}" }, vars)).toBeUndefined();
	});
});

describe("buildClipNote", () => {
	const defaults: ClipDefaults = {
		name: "{{title}}",
		folder: "",
		properties: [{ name: "created", value: "{{today}}", type: "date" }],
		body: "{{multi}}",
		linkKey: "src_id",
	};

	it("fills a template, falling back to the defaults field by field", () => {
		const note = buildClipNote({ folder: "Inbox/{{tags|first}}/" }, defaults, vars, {
			templateText: "# {{title}}\n",
			linkValue: "abc",
		});
		expect(note).toEqual({
			folder: "Inbox/one",
			filename: "Hello, World a story",
			frontmatter: { created: "2026-10-02", src_id: "abc" },
			body: "# Hello, World: a story\n\nline one\nline two",
		});
	});

	it("drops nameless properties and an empty link value, and names an untitled note", () => {
		const note = buildClipNote(
			{ name: "{{empty}}", properties: [{ name: " ", value: "x" }], body: "" },
			defaults,
			vars,
			{ fallbackName: "Feed" },
		);
		expect(note.filename).toBe("Feed");
		expect(note.frontmatter).toEqual({});
		expect(note.body).toBe("");
	});

	it("previews as the note will read", () => {
		const note = buildClipNote({ properties: [{ name: "tags", value: "{{tags}}", type: "list" }] }, defaults, vars);
		expect(previewClipNote(note)).toBe("---\ntags:\n  - one\n  - two\n  - three\n---\nline one\nline two");
	});
});

describe("RSS note defaults", () => {
	const item: RssItem = {
		id: "guid-1",
		title: "Issue 12",
		link: "",
		excerpt: "Short",
		published: Date.UTC(2026, 8, 30, 12),
		image: "",
		content: "<p>Body</p>",
		author: "Ann",
		categories: ["Weekly"],
	};

	it("clip an entry the way the Web Clipper would", () => {
		const note = buildClipNote({}, RSS_NOTE_DEFAULTS, rssClipVars(item, { feed: "Letters", feedUrl: "https://e.com/f", markdown: "Body" }, NOW), {
			linkValue: item.id,
		});
		expect(note.filename).toBe("Issue 12");
		// No link: the source property is left out rather than written empty.
		expect(note.frontmatter).toEqual({
			author: "Ann",
			feed: "Letters",
			published: "2026-09-30",
			created: "2026-10-02",
			tags: ["rss"],
			rss_id: "guid-1",
		});
		expect(note.body).toBe("Body");
	});
});
