import type { App } from "obsidian";
import type { HomeSettings } from "./types";

/**
 * Note titles from the Front Matter Title community plugin (#375).
 *
 * Front Matter Title shows a note's title from its frontmatter in place of the
 * file name — in the file explorer, among other places — without renaming the
 * file. A folder card that lists the same folder by file name then disagrees
 * with the sidebar beside it, which is the whole complaint: the user named
 * their files with characters they want kept out of sight.
 *
 * Unlike Iconic and Iconize (`fileicons.ts`), this plugin publishes an API for
 * other plugins, so Hearth asks it rather than reading its stored state. The
 * contract is the one its `front-matter-plugin-api-provider` package declares;
 * it is mirrored here as a few structural types instead of pulled in as a
 * dependency, because all the package does is reach `getDefer()` on the plugin
 * instance — which is all this module does too.
 *
 * Hearth asks for the title the plugin's *explorer* feature would show, and
 * only while that feature is on: the point is to match the sidebar, so a vault
 * where the explorer shows file names keeps showing file names here.
 *
 * Every call is guarded: a missing plugin, one that hasn't finished loading or
 * one whose API changed shape all come back as "no title", and the caller keeps
 * the file name.
 */

/** The community-plugin id Front Matter Title registers itself under. */
export const FRONT_MATTER_TITLE_PLUGIN_ID = "obsidian-front-matter-title-plugin";

/** The plugin's id for its file-explorer feature. */
export const FMT_EXPLORER_FEATURE = "explorer";

/** What a resolver from the plugin answers. */
interface FmtResolver {
	resolve(path: string): string | null;
}

/** The plugin's public API, as far as Hearth uses it. */
interface FmtApi {
	getResolverFactory(): { createResolver(feature: string): FmtResolver } | null;
	getEnabledFeatures(): string[];
}

/** The handle the plugin gives out before (and after) its API is ready. */
interface FmtDefer {
	getApi(): FmtApi | null;
	isFeaturesReady?(): boolean;
	awaitFeatures?(): Promise<void>;
}

/** A note's display title by its vault path, or null to keep the file name. */
export type TitleOf = (path: string) => string | null;

/** Whether Front Matter Title is installed and enabled. */
export function hasFrontMatterTitle(app: App): boolean {
	try {
		return app.plugins.enabledPlugins.has(FRONT_MATTER_TITLE_PLUGIN_ID);
	} catch {
		return false;
	}
}

function fmtDefer(app: App): FmtDefer | null {
	if (!hasFrontMatterTitle(app)) return null;
	try {
		const plugin = app.plugins.getPlugin(FRONT_MATTER_TITLE_PLUGIN_ID) as
			| { getDefer?: () => FmtDefer | null }
			| null;
		return plugin?.getDefer?.() ?? null;
	} catch {
		return null;
	}
}

/**
 * A resolved title as something a row can show: a non-blank string, trimmed.
 * Anything else — null, a number from a hand-edited frontmatter, whitespace —
 * means "no title", so the row falls back to the file name rather than going
 * blank.
 */
export function cleanTitle(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const title = raw.trim();
	return title.length > 0 ? title : null;
}

/**
 * The titles the file explorer shows, or null when there is nothing to ask:
 * the setting is off, the plugin isn't enabled or ready, or its explorer
 * feature is switched off.
 *
 * Meant to be called once per draw and used for every row in it — the
 * resolver is created once, and each lookup is the plugin's own (cached) work.
 *
 * The feature check is not optional: the plugin's resolver answers for a
 * disabled feature too (from the plugin's general settings), so without it the
 * card would show titles the sidebar doesn't.
 */
export function explorerTitles(
	app: App,
	settings: Pick<HomeSettings, "frontMatterTitles">,
): TitleOf | null {
	if (!settings.frontMatterTitles) return null;
	const defer = fmtDefer(app);
	if (!defer) return null;
	try {
		const api = defer.getApi();
		if (!api) return null;
		const enabled = api.getEnabledFeatures();
		if (!Array.isArray(enabled) || !enabled.includes(FMT_EXPLORER_FEATURE)) return null;
		const resolver = api.getResolverFactory()?.createResolver(FMT_EXPLORER_FEATURE);
		if (!resolver || typeof resolver.resolve !== "function") return null;
		return (path) => {
			try {
				return cleanTitle(resolver.resolve(path));
			} catch {
				return null;
			}
		};
	} catch {
		return null;
	}
}

/**
 * Run `cb` once Front Matter Title has its features running, if it hasn't yet.
 *
 * A board drawn at startup can beat the plugin to it, and a card has no reason
 * to redraw on its own afterwards — so the plugin calls this once the layout
 * is ready and redraws the boards when the titles become available. Nothing
 * happens when the plugin is absent or already ready.
 */
export function whenFrontMatterTitleReady(app: App, cb: () => void): void {
	const defer = fmtDefer(app);
	if (!defer) return;
	try {
		if (defer.isFeaturesReady?.() !== false) return;
		void defer.awaitFeatures?.().then(cb, () => undefined);
	} catch {
		// An API that changed shape: the titles show from the next redraw.
	}
}
