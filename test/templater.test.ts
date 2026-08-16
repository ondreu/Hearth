import { describe, expect, it } from "vitest";
import { TFile, type App } from "obsidian";
import {
	TEMPLATER_PLUGIN_ID,
	destinationSummary,
	expandTemplaterFilename,
	filenameNeedsPrompt,
	getTemplaterPlugin,
	isTemplaterAvailable,
	isTemplaterTemplate,
	normalizeFolderPath,
	templateDisplayName,
	templaterTemplatesFolder,
} from "../src/templater";

/**
 * The Templater integration. The calls *into* Templater are Obsidian API and
 * stay untested (per the no-mocks rule); what's covered here is everything
 * Hearth decides on its own — which files count as templates, what a filename
 * pattern expands to, and where the note is going to land — plus that the
 * plugin probes survive every shape of app object Obsidian can hand them.
 */

/** A stand-in `App` exposing only what the probes read. */
function fakeApp(plugin?: unknown): App {
	return {
		plugins: { plugins: plugin === undefined ? {} : { [TEMPLATER_PLUGIN_ID]: plugin } },
	} as unknown as App;
}

/** A stand-in `TFile`: the probes only read `path` and `extension`. */
function file(path: string): TFile {
	return Object.assign(new TFile(), { path, extension: path.split(".").pop() ?? "" });
}

/** A Templater instance shaped like the real one. */
function templaterPlugin(templatesFolder = "Templates"): unknown {
	return {
		templater: { create_new_note_from_template: () => Promise.resolve(undefined) },
		editor_handler: { jump_to_next_cursor_location: () => Promise.resolve() },
		settings: { templates_folder: templatesFolder },
	};
}

describe("reaching the plugin", () => {
	it("reports unavailable when Templater isn't installed", () => {
		expect(getTemplaterPlugin(fakeApp())).toBeNull();
		expect(isTemplaterAvailable(fakeApp())).toBe(false);
	});

	it("reports unavailable when the one method Hearth needs is gone", () => {
		// A Templater that renamed create_new_note_from_template must disable the
		// card, not throw inside a dashboard render.
		expect(isTemplaterAvailable(fakeApp({ templater: {} }))).toBe(false);
		expect(isTemplaterAvailable(fakeApp({}))).toBe(false);
	});

	it("reports available for a plugin exposing it", () => {
		expect(isTemplaterAvailable(fakeApp(templaterPlugin()))).toBe(true);
	});

	it("survives an app with no plugin registry at all", () => {
		const bare = {} as App;
		expect(getTemplaterPlugin(bare)).toBeNull();
		expect(isTemplaterAvailable(bare)).toBe(false);
		expect(templaterTemplatesFolder(bare)).toBe("");
	});

	it("normalizes Templater's own template folder", () => {
		expect(templaterTemplatesFolder(fakeApp(templaterPlugin("/Meta/Templates/")))).toBe(
			"Meta/Templates",
		);
		expect(templaterTemplatesFolder(fakeApp(templaterPlugin("")))).toBe("");
	});
});

describe("which files count as templates", () => {
	it("takes only Markdown files under Templater's template folder", () => {
		const app = fakeApp(templaterPlugin("Templates"));
		expect(isTemplaterTemplate(app, file("Templates/Meeting.md"))).toBe(true);
		expect(isTemplaterTemplate(app, file("Templates/Work/Standup.md"))).toBe(true);
		expect(isTemplaterTemplate(app, file("Notes/Meeting.md"))).toBe(false);
		expect(isTemplaterTemplate(app, file("Templates/logo.png"))).toBe(false);
	});

	// A folder prefix must match on a path *segment*: "Templates archive" is a
	// different folder from "Templates" and its notes are not templates.
	it("doesn't mistake a sibling folder with a shared prefix for the folder", () => {
		const app = fakeApp(templaterPlugin("Templates"));
		expect(isTemplaterTemplate(app, file("Templates archive/Old.md"))).toBe(false);
	});

	// Templater treats an unset folder as "any file may be a template", and the
	// picker has to offer the same set or a working setup becomes unreachable.
	it("takes every Markdown file when no template folder is configured", () => {
		const app = fakeApp(templaterPlugin(""));
		expect(isTemplaterTemplate(app, file("Notes/Meeting.md"))).toBe(true);
		expect(isTemplaterTemplate(app, file("Notes/photo.jpg"))).toBe(false);
	});
});

describe("filename patterns", () => {
	// 14:05 on 2024-03-09, in the frozen UTC test timezone.
	const now = new Date(Date.UTC(2024, 2, 9, 14, 5));

	it("substitutes the bare date and time tokens", () => {
		expect(expandTemplaterFilename("Meeting {{date}}", now)).toBe("Meeting 2024-03-09");
		expect(expandTemplaterFilename("Log {{time}}", now)).toBe("Log 14-05");
	});

	it("honours an explicit moment format", () => {
		expect(expandTemplaterFilename("{{date:YYYY-MM}} review", now)).toBe("2024-03 review");
		expect(expandTemplaterFilename("{{time:HHmm}}", now)).toBe("1405");
	});

	it("leaves an unknown token alone so a typo is visible", () => {
		expect(expandTemplaterFilename("{{titel}} note", now)).toBe("{{titel}} note");
	});

	it("fills {{prompt}} with what the user typed", () => {
		expect(expandTemplaterFilename("Idea — {{prompt}}", now, "kanban ideas")).toBe(
			"Idea — kanban ideas",
		);
	});

	it("drops {{prompt}} to nothing when nothing was typed", () => {
		expect(expandTemplaterFilename("{{prompt}}", now, "")).toBe("");
	});

	// The default time format avoids ":" deliberately — it is illegal in a
	// filename on Windows, and sanitizing would swallow it either way.
	it("never emits a character illegal in a vault filename", () => {
		expect(expandTemplaterFilename("{{time}}", now)).not.toContain(":");
		expect(expandTemplaterFilename("{{date:YYYY/MM}}", now)).toBe("2024 03");
	});

	// The typed value goes straight into a path, so this is the check that stops
	// a prompt answer from writing outside the tile's folder.
	it("can't escape the destination folder through the prompt", () => {
		expect(expandTemplaterFilename("{{prompt}}", now, "../../secrets")).toBe(".. .. secrets");
	});

	it("knows which patterns need asking about", () => {
		expect(filenameNeedsPrompt("{{prompt}}")).toBe(true);
		expect(filenameNeedsPrompt("Idea — {{ PROMPT }}")).toBe(true);
		expect(filenameNeedsPrompt("Meeting {{date}}")).toBe(false);
		expect(filenameNeedsPrompt("")).toBe(false);
	});
});

describe("folder paths", () => {
	it("strips the slashes a picker or a typo leaves behind", () => {
		expect(normalizeFolderPath("/Journal/")).toBe("Journal");
		expect(normalizeFolderPath("  Journal/Daily  ")).toBe("Journal/Daily");
	});

	// The folder picker offers the vault root as "/", and "" is what the card
	// stores for "let Templater decide" — the two must collapse to one value.
	it("collapses the vault root to the empty path", () => {
		expect(normalizeFolderPath("/")).toBe("");
		expect(normalizeFolderPath("")).toBe("");
	});
});

describe("display strings", () => {
	it("names a template after its file", () => {
		expect(templateDisplayName("Templates/Meeting note.md")).toBe("Meeting note");
		expect(templateDisplayName("Meeting.MD")).toBe("Meeting");
		expect(templateDisplayName("")).toBe("");
	});

	it("spells out where a tile's note will land", () => {
		expect(destinationSummary("Journal", "{{date}}", "Default", "Untitled")).toBe(
			"Journal/{{date}}.md",
		);
	});

	it("falls back to the caller's wording for the unset halves", () => {
		expect(destinationSummary("", "", "Default location", "Untitled")).toBe(
			"Default location/Untitled.md",
		);
	});
});
