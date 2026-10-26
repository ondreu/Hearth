import { describe, expect, it } from "vitest";
import {
	iconicIconForFile,
	iconicIconForPath,
	iconicIconForPlugin,
	iconizeIconForPath,
	iconizeNameToLucide,
	isEmojiIcon,
	normalizeStoredIcon,
} from "../src/fileicons";

/**
 * Per-file icons from Iconic and Iconize (#132). Neither plugin has an API, so
 * Hearth reads their stored state — these cover the parsing of that state and
 * the name translation between their formats and Obsidian's icon ids. The
 * reads themselves (plugin instances, metadata cache) are Obsidian API and stay
 * untested, per the no-mocks rule.
 */

/** Stand-in for Obsidian's icon registry. Real ids carry the `lucide-` prefix,
 * which is what `getIconIds()` returns. */
const REGISTERED = new Set([
	"lucide-file-text",
	"lucide-square-1",
	"lucide-book-open-check",
	"lucide-globe-2",
]);
const isKnown = (id: string) => REGISTERED.has(id);

describe("isEmojiIcon", () => {
	it("accepts the literal emoji both plugins store", () => {
		expect(isEmojiIcon("📕")).toBe(true);
		expect(isEmojiIcon("🌵")).toBe(true);
	});

	it("accepts multi-codepoint sequences", () => {
		// Skin-tone modifier and a ZWJ family sequence.
		expect(isEmojiIcon("👍🏽")).toBe(true);
		expect(isEmojiIcon("👩‍👩‍👧‍👦")).toBe(true);
	});

	it("rejects icon names, which are always ASCII", () => {
		expect(isEmojiIcon("lucide-file-text")).toBe(false);
		expect(isEmojiIcon("LiFileText")).toBe(false);
		expect(isEmojiIcon("")).toBe(false);
		expect(isEmojiIcon("   ")).toBe(false);
	});

	it("rejects prose that landed in an icon field", () => {
		expect(isEmojiIcon("— a stray sentence that is not an icon at all")).toBe(false);
	});
});

describe("iconizeNameToLucide", () => {
	it("undoes Iconize's PascalCase normalization", () => {
		expect(iconizeNameToLucide("LiFileText")).toBe("file-text");
		expect(iconizeNameToLucide("LiBookOpenCheck")).toBe("book-open-check");
	});

	it("splits trailing digits back out", () => {
		expect(iconizeNameToLucide("LiSquare1")).toBe("square-1");
		expect(iconizeNameToLucide("LiGlobe2")).toBe("globe-2");
	});

	it("ignores icons from other packs, which are SVG blobs Hearth can't draw", () => {
		expect(iconizeNameToLucide("FaBook")).toBeNull();
		expect(iconizeNameToLucide("RiHome")).toBeNull();
	});

	it("ignores a bare prefix and a coincidental lowercase match", () => {
		expect(iconizeNameToLucide("Li")).toBeNull();
		expect(iconizeNameToLucide("Library")).toBeNull();
	});
});

describe("normalizeStoredIcon", () => {
	it("passes through Iconic's prefixed lucide ids", () => {
		expect(normalizeStoredIcon("lucide-file-text", isKnown)).toEqual({
			kind: "lucide",
			id: "lucide-file-text",
		});
	});

	it("resolves an unprefixed lucide id", () => {
		expect(normalizeStoredIcon("file-text", isKnown)).toEqual({
			kind: "lucide",
			id: "lucide-file-text",
		});
	});

	it("resolves Iconize's pack name", () => {
		expect(normalizeStoredIcon("LiBookOpenCheck", isKnown)).toEqual({
			kind: "lucide",
			id: "lucide-book-open-check",
		});
	});

	it("returns emoji as emoji", () => {
		expect(normalizeStoredIcon("📕", isKnown)).toEqual({ kind: "emoji", char: "📕" });
	});

	it("rejects an icon Obsidian doesn't have, so the caller can fall back", () => {
		// setIcon draws nothing for an unknown id, which would leave a blank slot
		// where the file-type icon should be.
		expect(normalizeStoredIcon("FaBook", isKnown)).toBeNull();
		expect(normalizeStoredIcon("lucide-not-a-real-icon", isKnown)).toBeNull();
		expect(normalizeStoredIcon("   ", isKnown)).toBeNull();
	});
});

describe("iconizeIconForPath", () => {
	const data = {
		"Notes/Recipe.md": "LiChefHat",
		"Notes/Empty.md": "",
		Projects: { iconName: "LiFolderGit", iconColor: "#ff0000" },
		"Notes/Nulled.md": { iconName: null },
		settings: { iconInFrontmatterEnabled: true },
		migrated: 3,
	};

	it("reads a plain icon-name entry", () => {
		expect(iconizeIconForPath(data, "Notes/Recipe.md")).toBe("LiChefHat");
	});

	it("reads the object form used for folders", () => {
		expect(iconizeIconForPath(data, "Projects")).toBe("LiFolderGit");
	});

	it("ignores the reserved keys that share the data file with paths", () => {
		expect(iconizeIconForPath(data, "settings")).toBeNull();
		expect(iconizeIconForPath(data, "migrated")).toBeNull();
	});

	it("treats empty and nulled entries as no icon", () => {
		expect(iconizeIconForPath(data, "Notes/Empty.md")).toBeNull();
		expect(iconizeIconForPath(data, "Notes/Nulled.md")).toBeNull();
	});

	it("survives a missing path or a data blob that isn't one", () => {
		expect(iconizeIconForPath(data, "Notes/Absent.md")).toBeNull();
		expect(iconizeIconForPath(undefined, "Notes/Recipe.md")).toBeNull();
		expect(iconizeIconForPath("not an object", "Notes/Recipe.md")).toBeNull();
	});
});

describe("iconicIconForPath", () => {
	const fileIcons = {
		"Notes/Recipe.md": { icon: "lucide-chef-hat", color: "red" },
		"Notes/ColorOnly.md": { color: "blue" },
		"Notes/Emoji.md": { icon: "📕" },
	};

	it("reads the icon out of an entry", () => {
		expect(iconicIconForPath(fileIcons, "Notes/Recipe.md")).toBe("lucide-chef-hat");
		expect(iconicIconForPath(fileIcons, "Notes/Emoji.md")).toBe("📕");
	});

	it("returns null for an entry that only sets a colour", () => {
		expect(iconicIconForPath(fileIcons, "Notes/ColorOnly.md")).toBeNull();
	});

	it("survives a missing path or a map that isn't one", () => {
		expect(iconicIconForPath(fileIcons, "Notes/Absent.md")).toBeNull();
		expect(iconicIconForPath(undefined, "Notes/Recipe.md")).toBeNull();
		expect(iconicIconForPath(42, "Notes/Recipe.md")).toBeNull();
	});
});

describe("iconicIconForFile", () => {
	const fileIcons = { "Notes/Recipe.md": { icon: "lucide-chef-hat" } };
	const rule = { icon: "lucide-flame" };

	it("lets a rule icon win over a manual icon, as Iconic itself does", () => {
		expect(iconicIconForFile(rule, fileIcons, "Notes/Recipe.md")).toBe("lucide-flame");
	});

	it("reads a rule icon for a file with no manual icon (#421)", () => {
		expect(iconicIconForFile(rule, fileIcons, "Notes/Plain.md")).toBe("lucide-flame");
	});

	it("falls back to the manual icon when the rule only sets a colour", () => {
		expect(iconicIconForFile({ icon: null }, fileIcons, "Notes/Recipe.md")).toBe(
			"lucide-chef-hat",
		);
		expect(iconicIconForFile({}, fileIcons, "Notes/Recipe.md")).toBe("lucide-chef-hat");
	});

	it("falls back to the manual icon when nothing rules", () => {
		expect(iconicIconForFile(null, fileIcons, "Notes/Recipe.md")).toBe("lucide-chef-hat");
	});

	it("survives a missing ruling and a missing map", () => {
		expect(iconicIconForFile(undefined, undefined, "Notes/Recipe.md")).toBeNull();
	});
});

describe("iconicIconForPlugin", () => {
	/** A plugin instance shaped like Iconic's — settings plus the rule engine it
	 * exposes — with no Obsidian API involved. `calls` records which rulebook was
	 * asked, so the page routing is observable. */
	function iconicPlugin(rulings: Record<"file" | "folder", Record<string, string>>, fileIcons = {}) {
		const calls: string[] = [];
		return {
			calls,
			plugin: {
				settings: { fileIcons },
				ruleManager: {
					checkRuling: (page: "file" | "folder", path: string) => {
						calls.push(`${page}:${path}`);
						const icon = rulings[page][path];
						return icon ? { icon } : null;
					},
				},
			},
		};
	}

	it("draws the icon a rule sets, with no manual icon stored", () => {
		const { plugin } = iconicPlugin({ file: { "Notes/Plain.md": "lucide-flame" }, folder: {} });
		expect(iconicIconForPlugin(plugin, "file", "Notes/Plain.md")).toBe("lucide-flame");
	});

	it("asks the rulebook that matches the item, files and folders apart", () => {
		const { plugin, calls } = iconicPlugin({
			file: { "Notes/Plain.md": "lucide-file" },
			folder: { Notes: "lucide-folder-open" },
		});
		expect(iconicIconForPlugin(plugin, "folder", "Notes")).toBe("lucide-folder-open");
		expect(calls).toEqual(["folder:Notes"]);
	});

	it("keeps the manual icon when the rule engine throws", () => {
		// A broken engine must cost the rule icon, not the icon underneath it.
		const plugin = {
			settings: { fileIcons: { "Notes/Recipe.md": { icon: "lucide-chef-hat" } } },
			ruleManager: {
				checkRuling: () => {
					throw new Error("internals changed");
				},
			},
		};
		expect(iconicIconForPlugin(plugin, "file", "Notes/Recipe.md")).toBe("lucide-chef-hat");
	});

	it("reads the manual icon when Iconic has no rule engine at all", () => {
		// Iconic before the rulebook existed exposes no checkRuling.
		const plugin = { settings: { fileIcons: { "Notes/Recipe.md": { icon: "lucide-chef-hat" } } } };
		expect(iconicIconForPlugin(plugin, "file", "Notes/Recipe.md")).toBe("lucide-chef-hat");
	});

	it("returns null when Iconic is not installed", () => {
		expect(iconicIconForPlugin(undefined, "file", "Notes/Recipe.md")).toBeNull();
	});
});
