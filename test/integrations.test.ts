import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import {
	INTEGRATIONS,
	type IntegrationEntry,
	integrationsInGroup,
	integrationStatus,
} from "../src/integrations";
import { en } from "../src/locales/en";

/**
 * The integrations catalogue. The rendering is Obsidian API and stays untested
 * (per the no-mocks rule), but the catalogue itself is data — so what's covered
 * here is that it stays complete and internally consistent, and that the status
 * resolver survives every shape of app object Obsidian can hand it.
 */

/** A stand-in `App` exposing only the two registries the resolver reads. */
function fakeApp(opts: {
	enabled?: string[];
	installed?: string[];
	core?: Record<string, boolean>;
}): App {
	return {
		plugins: {
			enabledPlugins: new Set(opts.enabled ?? []),
			manifests: Object.fromEntries((opts.installed ?? []).map((id) => [id, {}])),
		},
		internalPlugins: {
			getPluginById: (id: string) =>
				id in (opts.core ?? {}) ? { instance: {}, enabled: opts.core![id] } : null,
		},
	} as unknown as App;
}

const entry = (id: string): IntegrationEntry => {
	const found = INTEGRATIONS.find((e) => e.id === id);
	if (!found) throw new Error(`no such integration: ${id}`);
	return found;
};

describe("the catalogue", () => {
	it("has a unique id per entry", () => {
		const ids = INTEGRATIONS.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("has strings for every entry", () => {
		for (const e of INTEGRATIONS) {
			const item = en.settings.integrations.items[e.id];
			expect(item?.name, e.id).toBeTruthy();
			expect(item?.desc, e.id).toBeTruthy();
		}
	});

	it("lists no entry the strings don't cover, and none the catalogue doesn't", () => {
		const listed = new Set(INTEGRATIONS.map((e) => e.id));
		for (const id of Object.keys(en.settings.integrations.items)) {
			expect(listed.has(id as (typeof INTEGRATIONS)[number]["id"]), id).toBe(true);
		}
	});

	it("binds each plugin entry to exactly one plugin id", () => {
		for (const e of INTEGRATIONS) {
			if (e.group === "service") {
				expect(e.pluginId ?? e.corePluginId, e.id).toBeUndefined();
			} else {
				// A row is either community, core, or bound to nothing at all (the
				// Leaf card, which works with whatever is installed) — never both.
				expect(!!e.pluginId && !!e.corePluginId, e.id).toBe(false);
			}
		}
	});

	it("groups every entry", () => {
		const grouped = [
			...integrationsInGroup("plugin"),
			...integrationsInGroup("core"),
			...integrationsInGroup("service"),
		];
		expect(grouped).toHaveLength(INTEGRATIONS.length);
	});
});

describe("integrationStatus", () => {
	it("reports an enabled community plugin", () => {
		const app = fakeApp({ enabled: ["omnisearch"], installed: ["omnisearch"] });
		expect(integrationStatus(app, entry("omnisearch"))).toBe("enabled");
	});

	it("tells an installed-but-off plugin from one that was never installed", () => {
		const app = fakeApp({ installed: ["omnisearch"] });
		expect(integrationStatus(app, entry("omnisearch"))).toBe("disabled");
		expect(integrationStatus(app, entry("dataview"))).toBe("missing");
	});

	it("falls back to 'missing' when the manifests internal isn't there", () => {
		const app = { plugins: { enabledPlugins: new Set<string>() } } as unknown as App;
		expect(integrationStatus(app, entry("dataview"))).toBe("missing");
	});

	it("reads core plugins from the internal registry", () => {
		const app = fakeApp({ core: { bookmarks: true, canvas: false } });
		expect(integrationStatus(app, entry("bookmarks"))).toBe("enabled");
		expect(integrationStatus(app, entry("canvas"))).toBe("disabled");
	});

	it("reports a core plugin this Obsidian version doesn't have as missing", () => {
		// Bases only exists from Obsidian 1.9 on.
		expect(integrationStatus(fakeApp({}), entry("bases"))).toBe("missing");
	});

	it("marks services external and unbound entries always-available", () => {
		const app = fakeApp({});
		expect(integrationStatus(app, entry("jira"))).toBe("external");
		expect(integrationStatus(app, entry("leafViews"))).toBe("always");
	});

	it("never throws on an app missing the registries entirely", () => {
		const bare = {} as App;
		for (const e of INTEGRATIONS) {
			expect(() => integrationStatus(bare, e), e.id).not.toThrow();
		}
	});

	it("resolves a status the strings have a label for", () => {
		const app = fakeApp({ enabled: ["dataview"], core: { canvas: true } });
		for (const e of INTEGRATIONS) {
			const status = integrationStatus(app, e);
			expect(en.settings.integrations.status[status], e.id).toBeTruthy();
			expect(en.settings.integrations.statusTooltip[status], e.id).toBeTruthy();
		}
	});
});
