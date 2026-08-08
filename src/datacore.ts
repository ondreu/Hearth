import type { App, Component, MarkdownRenderChild } from "obsidian";

/** The community-plugin id Datacore registers itself under. */
export const DATACORE_PLUGIN_ID = "datacore";

/** The script dialects Datacore can execute, matching its four codeblock
 * languages (`datacorejs`, `datacorejsx`, `datacorets`, `datacoretsx`). */
export type DatacoreScriptLanguage = "js" | "jsx" | "ts" | "tsx";

/** How a Datacore card's `query` text is interpreted.
 *
 * - `"query"` — a Datacore query (`@page and #project`), rendered by Hearth as
 *   a link list. This is the no-code option, the closest thing Datacore has to
 *   Dataview's DQL: Datacore itself ships no query-only codeblock, so Hearth
 *   wraps the query in a small JSX view (see {@link datacoreQueryScript}).
 * - the four script dialects — the text is a Datacore script, exactly as inside
 *   the matching codeblock. */
export type DatacoreLanguage = "query" | DatacoreScriptLanguage;

/** Every accepted `language` value, in the order the card's editor offers them.
 * Doubles as the allow-list an imported layout is validated against. */
export const DATACORE_LANGUAGES: readonly DatacoreLanguage[] = [
	"query",
	"jsx",
	"js",
	"tsx",
	"ts",
];

/** Datacore's monadic result: `{ successful: true, value }` on success,
 * `{ successful: false, error }` on failure. */
type DatacoreResult<T> =
	| { successful: true; value: T }
	| { successful: false; error: string };

/**
 * The slice of Datacore's public API Hearth calls. Exposed by the plugin at
 * `app.plugins.plugins.datacore.api` once Datacore is enabled.
 *
 * Each `execute*` transpiles and runs the script, rendering it into `container`
 * with Preact and attaching a `MarkdownRenderChild` to `component` — so the
 * result re-renders itself as Datacore's index changes (Datacore's hooks, e.g.
 * `dc.useQuery`, subscribe to the index) for as long as the component lives.
 * Hearth passes the per-card component, which lives until the card is next
 * redrawn, so live updates come for free. Script errors are caught by
 * Datacore's own error boundary and rendered inline rather than thrown.
 */
interface DatacoreApi {
	/** Run a plain JavaScript script (no JSX). */
	executeJs(
		source: string,
		container: HTMLElement,
		component: Component,
		sourcePath: string,
	): MarkdownRenderChild;
	/** Run a JSX script (also accepts plain JavaScript). */
	executeJsx(
		source: string,
		container: HTMLElement,
		component: Component,
		sourcePath: string,
	): MarkdownRenderChild;
	/** Run a TypeScript script (no TSX). */
	executeTs(
		source: string,
		container: HTMLElement,
		component: Component,
		sourcePath: string,
	): MarkdownRenderChild;
	/** Run a TSX script (also accepts TS and JS). */
	executeTsx(
		source: string,
		container: HTMLElement,
		component: Component,
		sourcePath: string,
	): MarkdownRenderChild;
	/** Parse a query without running it. Optional: treated as absent on a
	 * Datacore old enough not to expose it, in which case an invalid query
	 * simply surfaces through Datacore's own inline error instead. */
	tryParseQuery?(query: string): DatacoreResult<unknown>;
}

/** Reach Datacore's public API, or null when the plugin isn't installed, isn't
 * enabled, or is too old to expose the script methods Hearth uses. */
export function getDatacoreApi(app: App): DatacoreApi | null {
	const plugin = app.plugins.plugins[DATACORE_PLUGIN_ID] as
		| { api?: unknown }
		| undefined;
	const api = plugin?.api;
	if (
		api &&
		typeof (api as DatacoreApi).executeJs === "function" &&
		typeof (api as DatacoreApi).executeJsx === "function" &&
		typeof (api as DatacoreApi).executeTs === "function" &&
		typeof (api as DatacoreApi).executeTsx === "function"
	) {
		return api as DatacoreApi;
	}
	return null;
}

/** Whether Datacore is enabled and its script API is reachable right now. */
export function isDatacoreAvailable(app: App): boolean {
	return getDatacoreApi(app) !== null;
}

/** Run `source` in the dialect `language` names, rendering into `container`. */
export function runDatacoreScript(
	api: DatacoreApi,
	language: DatacoreScriptLanguage,
	source: string,
	container: HTMLElement,
	component: Component,
	sourcePath: string,
): MarkdownRenderChild {
	switch (language) {
		case "js":
			return api.executeJs(source, container, component, sourcePath);
		case "ts":
			return api.executeTs(source, container, component, sourcePath);
		case "tsx":
			return api.executeTsx(source, container, component, sourcePath);
		case "jsx":
		default:
			return api.executeJsx(source, container, component, sourcePath);
	}
}

/**
 * Check a query for syntax errors before it is run, so a typo shows as a
 * readable card message instead of a Preact error boundary. Returns the parse
 * error, or null when the query parses (or when this Datacore build can't
 * parse-without-running, in which case the error surfaces at render time).
 */
export function datacoreQueryError(api: DatacoreApi, query: string): string | null {
	if (typeof api.tryParseQuery !== "function") return null;
	try {
		const parsed = api.tryParseQuery(query);
		return parsed.successful ? null : String(parsed.error);
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

/**
 * Wrap a Datacore query in the smallest JSX view that renders it: a live list
 * of links to whatever the query matched.
 *
 * This is what makes the card's no-code "Query" mode possible. Datacore's own
 * codeblocks are all script-based — unlike Dataview, there is no query-only
 * block to hand a bare query to — so Hearth generates the view around it. The
 * query is embedded as a JSON string literal, which quotes and escapes it
 * safely no matter what the user typed.
 *
 * `dc.useQuery` re-runs on every index change, so the list stays live. What a
 * row renders as depends on what Datacore returns, because its object types are
 * not uniform: pages and sections carry a `$link` (as do blocks with a block
 * id) and render as real Obsidian links; tasks and list items carry no link at
 * all, so their Markdown text is rendered instead — which is what makes
 * `@task and !$completed` useful here rather than a column of ids. Anything
 * else falls back to its path or id, so a row is never blank.
 *
 * @param query    the Datacore query, e.g. `@page and #project`
 * @param pageSize rows per page; 0 or omitted renders every result unpaged
 */
export function datacoreQueryScript(query: string, pageSize?: number): string {
	const paging =
		typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0
			? String(Math.round(pageSize))
			: "false";
	return [
		"return function HearthDatacoreQuery() {",
		`\tconst rows = dc.useQuery(${JSON.stringify(query)});`,
		`\treturn <dc.List rows={rows} paging={${paging}} renderer={(row) =>`,
		"\t\trow && row.$link ? <dc.Link link={row.$link} /> :",
		"\t\trow && row.$text ? <dc.Markdown content={row.$text} /> :",
		"\t\tString((row && (row.$path || row.$id)) ?? row)",
		"\t} />;",
		"}",
	].join("\n");
}
