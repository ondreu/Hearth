import { describe, expect, it } from "vitest";
import { isNewer, parseChangelog, parseSections, reflowMarkdown, splitItem } from "../src/changelog";

describe("reflowMarkdown", () => {
	it("joins a hard-wrapped paragraph into one line", () => {
		const md = ["The weather sky, as your background. Settings →", "Appearance → Background."].join(
			"\n",
		);
		expect(reflowMarkdown(md)).toBe(
			"The weather sky, as your background. Settings → Appearance → Background.",
		);
	});

	it("keeps separate paragraphs separate", () => {
		expect(reflowMarkdown("one\nline\n\nsecond\npara")).toBe("one line\n\nsecond para");
	});

	it("joins each list item without merging items", () => {
		const md = ["- first item that", "  wraps here", "- second item", "  wrapping too"].join("\n");
		expect(reflowMarkdown(md)).toBe("- first item that wraps here\n- second item wrapping too");
	});

	it("keeps a nested list item on its own line, indentation intact", () => {
		const md = ["- parent item", "  - child item that", "    wraps"].join("\n");
		expect(reflowMarkdown(md)).toBe("- parent item\n  - child item that wraps");
	});

	it("keeps an indented follow-on paragraph inside its list item", () => {
		const md = ["- first item", "", "  A second paragraph that", "  wraps in the source."].join(
			"\n",
		);
		expect(reflowMarkdown(md)).toBe("- first item\n\n  A second paragraph that wraps in the source.");
	});

	it("starts a new line at headings, quotes and tables", () => {
		expect(reflowMarkdown("text\n### Added\nmore\n> quoted\n| a | b |")).toBe(
			"text\n### Added\nmore\n> quoted\n| a | b |",
		);
	});

	it("leaves fenced code blocks untouched", () => {
		const md = ["```js", "const a = 1;", "const b = 2;", "```", "after the", "fence"].join("\n");
		expect(reflowMarkdown(md)).toBe(
			["```js", "const a = 1;", "const b = 2;", "```", "after the fence"].join("\n"),
		);
	});

	it("honours an explicit hard break", () => {
		expect(reflowMarkdown("first line  \nsecond line")).toBe("first line\nsecond line");
	});
});

describe("parseChangelog", () => {
	const md = [
		"# Changelog",
		"",
		"Preamble that is not part of any release.",
		"",
		"## [2.0.0] - 2026-07-11",
		"",
		"### Added",
		"",
		"- A thing that wraps",
		"  across two lines.",
		"",
		"## [1.9.0]",
		"",
		"### Fixed",
		"",
		"- Another thing.",
		"",
		"[1.9.0]: https://example.com/compare/1.8.0...1.9.0",
	].join("\n");

	it("splits releases newest first and drops the preamble", () => {
		const entries = parseChangelog(md);
		expect(entries.map((e) => e.version)).toEqual(["2.0.0", "1.9.0"]);
		expect(entries[0].markdown).not.toContain("Preamble");
	});

	it("lifts the heading out of the body and reflows what's left", () => {
		const [latest] = parseChangelog(md);
		expect(latest.markdown).toBe("### Added\n\n- A thing that wraps across two lines.");
	});

	it("captures the release date when the heading carries one", () => {
		const entries = parseChangelog(md);
		expect(entries[0].date).toBe("2026-07-11");
		expect(entries[1].date).toBe("");
	});

	it("resolves link-reference definitions into entry URLs", () => {
		const entries = parseChangelog(md);
		expect(entries[1].url).toBe("https://example.com/compare/1.8.0...1.9.0");
		// An unreleased version has no link definition yet — no URL, and no
		// stray brackets left in the version itself.
		expect(entries[0].url).toBe("");
		expect(entries[0].version).toBe("2.0.0");
	});

	it("tolerates a bare heading and a stray quote in the brackets", () => {
		const entries = parseChangelog('## ["1.9.0]\n\nbody\n\n## 1.8.0 - 2026-01-02\n\nbody');
		expect(entries.map((e) => e.version)).toEqual(["1.9.0", "1.8.0"]);
		expect(entries[1].date).toBe("2026-01-02");
	});
});

describe("isNewer", () => {
	it("compares by numeric release components", () => {
		expect(isNewer("2.0.0", "1.11.0")).toBe(true);
		expect(isNewer("1.9.0", "1.10.0")).toBe(false);
		expect(isNewer("1.9.0", "1.9.0")).toBe(false);
	});

	it("ignores pre-release suffixes", () => {
		expect(isNewer("2.0.0-beta.1", "2.0.0")).toBe(false);
		expect(isNewer("2.0.0-beta.1", "1.11.0")).toBe(true);
	});

	it("treats an unknown or empty seen version as older than everything", () => {
		expect(isNewer("1.5.0", "")).toBe(true);
	});
});

describe("splitItem", () => {
	it("takes the bullet's bold lead sentence as the headline", () => {
		const item = splitItem("**A slideshow card.** It cycles through pictures.");
		expect(item.headline).toBe("A slideshow card.");
		expect(item.details).toBe("It cycles through pictures.");
	});

	it("lifts the trailing issue reference out, keeping the full stop", () => {
		const item = splitItem("**Snapping works.** It rounded the wrong way (#228).");
		expect(item.issues).toEqual(["228"]);
		expect(item.details).toBe("It rounded the wrong way.");
	});

	it("reads a multi-issue reference, and one on a headline-only bullet", () => {
		expect(splitItem("**Fixed.** Two at once (#12, #34)").issues).toEqual(["12", "34"]);
		const bare = splitItem("**Icons show up now (#132).**");
		expect(bare.issues).toEqual(["132"]);
		expect(bare.headline).toBe("Icons show up now.");
		expect(bare.details).toBe("");
	});

	it("falls back to the first sentence when there is no bold lead", () => {
		const item = splitItem("A plain bullet. With more after it.");
		expect(item.headline).toBe("A plain bullet.");
		expect(item.details).toBe("With more after it.");
	});

	it("keeps a short unpunctuated bullet whole", () => {
		const item = splitItem("Just a short note");
		expect(item.headline).toBe("Just a short note");
		expect(item.details).toBe("");
	});
});

describe("parseSections", () => {
	const body = [
		"### Added",
		"",
		"- **A new card.** It does things.",
		"- **Another card.** It does other things (#7).",
		"",
		"### Fixed",
		"",
		"- **A bug.** It is gone now.",
	].join("\n");

	it("groups the bullets under their normalised section", () => {
		const sections = parseSections(body);
		expect(sections.map((s) => [s.kind, s.label, s.items.length])).toEqual([
			["added", "Added", 2],
			["fixed", "Fixed", 1],
		]);
		expect(sections[0].items[1].issues).toEqual(["7"]);
	});

	it("keeps a section's non-bullet prose separate from its items", () => {
		const [section] = parseSections("### Changed\n\nSome preamble.\n\n- **An item.** Detail.");
		expect(section.prose).toBe("Some preamble.");
		expect(section.items).toHaveLength(1);
	});

	it("handles a release with no section headings at all", () => {
		const [section] = parseSections("- **Just this.** And its detail.");
		expect(section.kind).toBe("other");
		expect(section.items[0].headline).toBe("Just this.");
	});

	it("leaves an unknown heading's own wording in place", () => {
		expect(parseSections("### Notes\n\n- **A note.** Body.")[0]).toMatchObject({
			kind: "other",
			label: "Notes",
		});
	});

	it("keeps an item's own paragraphs and nested lists, dedented to render", () => {
		const [section] = parseSections(
			["- **Headline.** First para.", "", "  Second para.", "", "  - a nested point"].join("\n"),
		);
		expect(section.items[0].details).toBe("First para.\n\nSecond para.\n\n- a nested point");
	});

	it("keeps a fenced code block inside the item it belongs to", () => {
		const [section] = parseSections(
			["### Added", "", "- **Code.** Like so:", "", "  ```js", "  - not a bullet", "  ```"].join(
				"\n",
			),
		);
		expect(section.items).toHaveLength(1);
		expect(section.items[0].details).toContain("- not a bullet");
	});

	it("is reachable from a parsed entry", () => {
		const [entry] = parseChangelog("## [2.0.0]\n\n### Fixed\n\n- **A bug.** Gone (#3).");
		expect(entry.sections[0].items[0]).toMatchObject({ headline: "A bug.", issues: ["3"] });
	});
});
