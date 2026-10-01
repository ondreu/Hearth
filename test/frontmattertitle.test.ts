import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import {
	cleanTitle,
	explorerTitles,
	FMT_EXPLORER_FEATURE,
	FRONT_MATTER_TITLE_PLUGIN_ID,
	hasFrontMatterTitle,
	whenFrontMatterTitleReady,
} from "../src/frontmattertitle";

/**
 * The Front Matter Title integration (#375). The plugin is reached through the
 * API its `front-matter-plugin-api-provider` package declares — `getDefer()` on
 * the plugin instance — so what's covered here is that Hearth asks for the
 * explorer's titles only when the explorer would show them, and that every
 * shape of missing, unready or broken plugin comes back as "keep the file
 * name" rather than as a thrown error mid-draw.
 */

interface FakePlugin {
	features?: string[];
	titles?: Record<string, unknown>;
	ready?: boolean;
	noApi?: boolean;
	throws?: boolean;
	onAwait?: () => void;
}

function fakeApp(plugin: FakePlugin | null, enabled = plugin !== null): App {
	const api = {
		getEnabledFeatures: () => plugin?.features ?? [FMT_EXPLORER_FEATURE],
		getResolverFactory: () => ({
			createResolver: (feature: string) => ({
				resolve: (path: string) => {
					if (plugin?.throws) throw new Error("boom");
					return feature === FMT_EXPLORER_FEATURE ? (plugin?.titles?.[path] ?? null) : null;
				},
			}),
		}),
	};
	const defer = {
		getApi: () => (plugin?.noApi ? null : api),
		isFeaturesReady: () => plugin?.ready !== false,
		awaitFeatures: () => {
			plugin?.onAwait?.();
			return Promise.resolve();
		},
	};
	return {
		plugins: {
			enabledPlugins: new Set(enabled ? [FRONT_MATTER_TITLE_PLUGIN_ID] : []),
			getPlugin: (id: string) =>
				id === FRONT_MATTER_TITLE_PLUGIN_ID && plugin ? { getDefer: () => defer } : null,
		},
	} as unknown as App;
}

const on = { frontMatterTitles: true };

describe("cleanTitle", () => {
	it("keeps a trimmed, non-blank string", () => {
		expect(cleanTitle("  My note ")).toBe("My note");
	});

	it("turns anything else into no title", () => {
		expect(cleanTitle("   ")).toBeNull();
		expect(cleanTitle(null)).toBeNull();
		expect(cleanTitle(42)).toBeNull();
	});
});

describe("explorerTitles", () => {
	it("resolves the titles the explorer shows", () => {
		const titles = explorerTitles(fakeApp({ titles: { "A/_x_note.md": "Note" } }), on);
		expect(titles?.("A/_x_note.md")).toBe("Note");
		expect(titles?.("A/other.md")).toBeNull();
	});

	it("asks for nothing while the setting is off", () => {
		expect(explorerTitles(fakeApp({}), { frontMatterTitles: false })).toBeNull();
	});

	it("asks for nothing without the plugin, or with it disabled", () => {
		expect(explorerTitles(fakeApp(null), on)).toBeNull();
		expect(explorerTitles(fakeApp({}, false), on)).toBeNull();
		expect(hasFrontMatterTitle(fakeApp({}, false))).toBe(false);
	});

	it("asks for nothing while the explorer feature is off", () => {
		// The plugin's resolver answers for a disabled feature too, so the
		// feature list is what keeps the card in step with the sidebar.
		const app = fakeApp({ features: ["graph", "tab"], titles: { "a.md": "A" } });
		expect(explorerTitles(app, on)).toBeNull();
	});

	it("asks for nothing before the plugin's API is ready", () => {
		expect(explorerTitles(fakeApp({ noApi: true }), on)).toBeNull();
	});

	it("keeps the file name when the plugin throws or returns a blank", () => {
		expect(explorerTitles(fakeApp({ throws: true }), on)?.("a.md")).toBeNull();
		expect(explorerTitles(fakeApp({ titles: { "a.md": " " } }), on)?.("a.md")).toBeNull();
	});

	it("survives an app without a plugin registry", () => {
		expect(explorerTitles({} as App, on)).toBeNull();
	});
});

describe("whenFrontMatterTitleReady", () => {
	it("waits for a plugin that is still starting", async () => {
		let called = 0;
		whenFrontMatterTitleReady(fakeApp({ ready: false }), () => called++);
		await Promise.resolve();
		expect(called).toBe(1);
	});

	it("does nothing for a plugin already running, or no plugin", async () => {
		let called = 0;
		whenFrontMatterTitleReady(fakeApp({ ready: true }), () => called++);
		whenFrontMatterTitleReady(fakeApp(null), () => called++);
		await Promise.resolve();
		expect(called).toBe(0);
	});
});
