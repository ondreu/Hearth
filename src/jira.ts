import {
	type Component,
	requestUrl,
	type RequestUrlParam,
	setIcon,
} from "obsidian";
import type { HomeView } from "./view";
import {
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	type JiraConfig,
	type JiraControl,
	type JiraSelections,
} from "./types";
import { t } from "./i18n";

export const JIRA_CONTROLS: JiraControl[] = [
	"status",
	"assignee",
	"priority",
	"issueType",
	"sprint",
	"fixVersion",
];

const JIRA_BASE_FIELDS = [
	"summary",
	"status",
	"priority",
	"issuetype",
	"assignee",
	"fixVersions",
];

export interface JiraFilter {
	id: string;
	name: string;
}

interface JiraNamedValue {
	name: string;
}

export interface JiraIssue {
	key: string;
	fields: {
		summary: string;
		status: {
			name: string;
			statusCategory?: { key?: string };
		};
		priority?: JiraNamedValue | null;
		issuetype: JiraNamedValue;
		assignee?: { displayName?: string; name?: string } | null;
		sprint?: JiraNamedValue | JiraNamedValue[] | null;
		fixVersions?: JiraNamedValue[];
		[field: string]: unknown;
	};
}

export type JiraOptions = Record<JiraControl, string[]>;

export interface JiraField {
	id?: string;
	name?: string;
	schema?: { custom?: string };
}

const SPRINT_SCHEMA = "com.pyxis.greenhopper.jira:gh-sprint";

interface JiraSearchResponse {
	issues?: JiraIssue[];
}

interface JiraFilterResponse {
	id?: string | number;
	name?: string;
	jql?: string;
}

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const jiraCache = new WeakMap<JiraConfig, Map<string, CacheEntry<unknown>>>();

export interface JiraLoadCoordinator<T> {
	request(value: T): void;
	destroy(): void;
	idle(): Promise<void>;
}

/** Serialize loads while retaining the latest request that arrives in flight. */
export function createJiraLoadCoordinator<T>(
	execute: (value: T) => Promise<void>,
): JiraLoadCoordinator<T> {
	let active = false;
	let destroyed = false;
	let pending: T | undefined;
	let idlePromise = Promise.resolve();

	const drain = async (initial: T): Promise<void> => {
		try {
			let next: T | undefined = initial;
			while (next !== undefined && !destroyed) {
				await execute(next);
				if (destroyed) break;
				next = pending;
				pending = undefined;
			}
		} finally {
			active = false;
		}
	};

	return {
		request(value: T): void {
			if (destroyed) return;
			if (active) {
				pending = value;
				return;
			}
			pending = undefined;
			active = true;
			idlePromise = drain(value);
		},
		destroy(): void {
			destroyed = true;
			pending = undefined;
		},
		idle(): Promise<void> {
			return idlePromise;
		},
	};
}

/** Escape a string for use inside a quoted JQL string literal. */
export function escapeJqlString(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\r/g, "\\r")
		.replace(/\n/g, "\\n");
}

function splitOrderBy(jql: string): { query: string; order: string } {
	const trimmed = jql.trim();
	if (/^ORDER\s+BY\s+/i.test(trimmed)) return { query: "", order: trimmed };
	let quoted = false;
	let escaped = false;
	for (let index = 0; index < jql.length; index++) {
		const char = jql[index];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === "\\" && quoted) {
			escaped = true;
			continue;
		}
		if (char === '"') {
			quoted = !quoted;
			continue;
		}
		if (quoted || !/\s/.test(char)) continue;
		const tail = jql.slice(index);
		const match = /^\s+ORDER\s+BY\s+/i.exec(tail);
		if (!match) continue;
		return {
			query: jql.slice(0, index).trim(),
			order: jql.slice(index).trim(),
		};
	}
	return { query: trimmed, order: "" };
}

/** Compose persisted multi-select refinements without allowing JQL injection. */
export function composeJiraJql(
	baseJql: string,
	selections: JiraSelections,
): string {
	const { query, order } = splitOrderBy(baseJql);
	const fieldByControl: Record<JiraControl, string> = {
		status: "status",
		assignee: "assignee",
		priority: "priority",
		issueType: "issuetype",
		sprint: "sprint",
		fixVersion: "fixVersion",
	};
	const clauses: string[] = query ? [`(${query})`] : [];
	for (const control of JIRA_CONTROLS) {
		const values = selections[control]?.filter(
			(value): value is string => typeof value === "string" && value.length > 0,
		);
		if (!values?.length) continue;
		const quoted = values.map((value) => `"${escapeJqlString(value)}"`).join(", ");
		clauses.push(`${fieldByControl[control]} IN (${quoted})`);
	}
	return [clauses.join(" AND "), order].filter(Boolean).join(" ");
}

function addNames(target: Set<string>, raw: unknown): void {
	const values = Array.isArray(raw) ? raw : [raw];
	for (const value of values) {
		if (!value || typeof value !== "object") continue;
		const name = (value as Record<string, unknown>).name;
		if (typeof name === "string" && name.trim()) target.add(name.trim());
	}
}

/** Find Jira Software's Sprint custom field, preferring its schema identity. */
export function discoverSprintFieldId(fields: JiraField[]): string | null {
	const schemaMatch = fields.find(
		(field) => field.schema?.custom === SPRINT_SCHEMA && field.id,
	);
	if (schemaMatch?.id) return schemaMatch.id;
	const nameMatch = fields.find(
		(field) => field.name?.trim().toLowerCase() === "sprint" && field.id,
	);
	return nameMatch?.id ?? null;
}

/** Parse sprint names returned as modern objects or legacy Greenhopper text. */
export function parseSprintNames(raw: unknown): string[] {
	const names = new Set<string>();
	const values = Array.isArray(raw) ? raw : [raw];
	for (const value of values) {
		if (value && typeof value === "object") {
			const name = (value as Record<string, unknown>).name;
			if (typeof name === "string" && name.trim()) names.add(name.trim());
			continue;
		}
		if (typeof value !== "string") continue;
		const match = /(?:^|,)name=([^,\]]+)/.exec(value);
		if (match?.[1]?.trim()) names.add(match[1].trim());
	}
	return Array.from(names);
}

/** Search fields, adding Sprint only after Jira identifies its custom field id. */
export function jiraSearchFields(sprintFieldId: string | null): string {
	return [...JIRA_BASE_FIELDS, ...(sprintFieldId ? [sprintFieldId] : [])].join(",");
}

/** Derive control options from unrefined issues, retaining persisted selections. */
export function deriveJiraOptions(
	issues: JiraIssue[],
	selections: JiraSelections,
	sprintFieldId: string | null = null,
): JiraOptions {
	const sets: Record<JiraControl, Set<string>> = {
		status: new Set(selections.status ?? []),
		assignee: new Set(selections.assignee ?? []),
		priority: new Set(selections.priority ?? []),
		issueType: new Set(selections.issueType ?? []),
		sprint: new Set(selections.sprint ?? []),
		fixVersion: new Set(selections.fixVersion ?? []),
	};
	for (const issue of issues) {
		const fields = issue.fields;
		addNames(sets.status, fields.status);
		addNames(sets.priority, fields.priority);
		addNames(sets.issueType, fields.issuetype);
		if (sprintFieldId) {
			for (const name of parseSprintNames(fields[sprintFieldId])) {
				sets.sprint.add(name);
			}
		}
		addNames(sets.fixVersion, fields.fixVersions);
		const assignee = fields.assignee;
		const assigneeName = assignee?.name ?? assignee?.displayName;
		if (assigneeName?.trim()) sets.assignee.add(assigneeName.trim());
	}
	return Object.fromEntries(
		JIRA_CONTROLS.map((control) => [
			control,
			Array.from(sets[control]).sort((a, b) => a.localeCompare(b)),
		]),
	) as JiraOptions;
}

/** Narrow Jira control options with a case-insensitive substring query. */
export function filterJiraOptions(values: string[], query: string): string[] {
	const needle = query.trim().toLocaleLowerCase();
	if (!needle) return [...values];
	return values.filter((value) => value.toLocaleLowerCase().includes(needle));
}

function validatedHost(host: string): URL {
	const parsed = new URL(host);
	if (
		parsed.protocol !== "https:" ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	) {
		throw new Error("invalid-host");
	}
	return parsed;
}

function relativePath(path: string, fallback: string): string {
	const value = path.trim() || fallback;
	if (
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\") ||
		value.includes("?") ||
		value.includes("#") ||
		/^[a-z][a-z0-9+.-]*:/i.test(value)
	) {
		throw new Error("invalid-api-path");
	}
	return value.replace(/\/+$/, "");
}

/** Build a Jira REST URL that cannot escape the explicitly configured host. */
export function buildJiraUrl(
	host: string,
	apiBasePath: string,
	endpoint: string,
	query?: Record<string, string>,
): URL {
	const parsedHost = validatedHost(host);
	const basePath = relativePath(apiBasePath, "/rest/api/latest");
	const endpointPath = relativePath(endpoint, "/");
	const hostPath = parsedHost.pathname.replace(/\/+$/, "");
	const url = new URL(parsedHost.origin);
	url.pathname = `${hostPath}${basePath}${endpointPath}`;
	for (const [key, value] of Object.entries(query ?? {})) {
		url.searchParams.set(key, value);
	}
	if (url.origin !== parsedHost.origin) throw new Error("cross-origin-request");
	return url;
}

function ttlMs(config: JiraConfig): number {
	return Math.max(0, config.cacheMin ?? 5) * 60_000;
}

function cacheGet<T>(config: JiraConfig, key: string): T | null {
	const cache = jiraCache.get(config);
	const entry = cache?.get(key) as CacheEntry<T> | undefined;
	if (!entry || entry.expiresAt <= Date.now()) {
		if (entry) cache?.delete(key);
		return null;
	}
	return entry.value;
}

function cacheSet<T>(key: string, value: T, config: JiraConfig): void {
	const ttl = ttlMs(config);
	if (ttl <= 0) return;
	let cache = jiraCache.get(config);
	if (!cache) {
		cache = new Map<string, CacheEntry<unknown>>();
		jiraCache.set(config, cache);
	}
	cache.set(key, { value, expiresAt: Date.now() + ttl });
}

/** Drop every cached response associated with this card's connection object. */
export function clearJiraCache(config: JiraConfig): void {
	jiraCache.delete(config);
}

function authHeader(config: JiraConfig): string {
	// SECURITY-REVIEW: The bearer PAT is read from per-card plugin data and sent
	// only to the validated Jira origin. It is never logged or included in errors.
	return `Bearer ${config.pat ?? ""}`;
}

async function requestJira<T>(
	config: JiraConfig,
	endpoint: string,
	query?: Record<string, string>,
	force = false,
): Promise<T> {
	const url = buildJiraUrl(
		config.host ?? "",
		config.apiBasePath ?? "/rest/api/latest",
		endpoint,
		query,
	);
	const key = url.toString();
	if (!force) {
		const cached = cacheGet<T>(config, key);
		if (cached !== null) return cached;
	}
	const params: RequestUrlParam = {
		url: key,
		method: "GET",
		throw: false,
		headers: {
			Authorization: authHeader(config),
			Accept: "application/json",
		},
	};
	// SECURITY-REVIEW: External request target is constructed by buildJiraUrl,
	// restricted to the configured HTTPS origin and relative REST paths.
	const response = await requestUrl(params);
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`jira-http-${response.status}`);
	}
	if (!response.json || typeof response.json !== "object") {
		throw new Error("jira-invalid-response");
	}
	const value = response.json as T;
	cacheSet(key, value, config);
	return value;
}

/** Load favorite saved filters for the card editor. */
export async function listJiraFilters(config: JiraConfig): Promise<JiraFilter[]> {
	const response = await requestJira<unknown>(config, "/filter/favourite", undefined, true);
	if (!Array.isArray(response)) return [];
	return response
		.map((raw): JiraFilter | null => {
			if (!raw || typeof raw !== "object") return null;
			const item = raw as JiraFilterResponse;
			if ((typeof item.id !== "string" && typeof item.id !== "number") || !item.name)
				return null;
			return { id: String(item.id), name: item.name };
		})
		.filter((filter): filter is JiraFilter => filter !== null);
}

async function loadFilterJql(config: JiraConfig, force: boolean): Promise<string> {
	const id = config.filterId?.trim();
	if (!id) throw new Error("missing-filter");
	const filter = await requestJira<JiraFilterResponse>(
		config,
		`/filter/${encodeURIComponent(id)}`,
		undefined,
		force,
	);
	if (typeof filter.jql !== "string" || !filter.jql.trim())
		throw new Error("missing-jql");
	return filter.jql.trim();
}

async function loadSprintFieldId(config: JiraConfig): Promise<string | null> {
	const fields = await requestJira<unknown>(config, "/field");
	return Array.isArray(fields)
		? discoverSprintFieldId(fields as JiraField[])
		: null;
}

async function searchJira(
	config: JiraConfig,
	jql: string,
	maxResults: number,
	sprintFieldId: string | null,
	force: boolean,
): Promise<JiraIssue[]> {
	const response = await requestJira<JiraSearchResponse>(
		config,
		"/search",
		{ jql, fields: jiraSearchFields(sprintFieldId), maxResults: String(maxResults) },
		force,
	);
	return Array.isArray(response.issues)
		? response.issues.filter(
				(issue) =>
					typeof issue?.key === "string" &&
					typeof issue.fields?.summary === "string" &&
					typeof issue.fields?.status?.name === "string" &&
					typeof issue.fields?.issuetype?.name === "string",
			)
		: [];
}

function statusClass(key: string | undefined): string {
	switch (key) {
		case "done":
			return "is-done";
		case "new":
			return "is-new";
		case "indeterminate":
		case undefined:
			return "is-progress";
		default:
			return "is-progress";
	}
}

function controlLabel(control: JiraControl): string {
	return t().cards.jira.controls[control];
}

/** Render a Jira saved-filter card, with unrefined option discovery. */
export function renderJiraCard(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const config = card.jira ?? {};
	const strings = t().cards.jira;
	const wrap = body.createDiv("hearth-jira");
	if (view.plugin.settings.disableExternalCalls) {
		wrap.createDiv({ cls: "hearth-jira-state", text: strings.disabled });
		return;
	}
	if (!config.host?.trim() || !config.pat?.trim() || !config.filterId?.trim()) {
		wrap.createDiv({ cls: "hearth-jira-state", text: strings.notConfigured });
		return;
	}

	let destroyed = false;
	let loading = false;
	let issues: JiraIssue[] = [];
	let sprintFieldId: string | null = null;
	let options: JiraOptions = {
		status: [],
		assignee: [],
		priority: [],
		issueType: [],
		sprint: [],
		fixVersion: [],
	};
	let error = false;
	let saveTimer = 0;

	const selections = (config.selections ??= {});
	const persistSelections = (): void => {
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => {
			if (!destroyed) void view.plugin.saveData(view.plugin.settings);
		}, 300);
	};

	const openIssue = (key: string): void => {
		const host = validatedHost(config.host ?? "");
		const hostPath = host.pathname.replace(/\/+$/, "");
		const url = new URL(`${hostPath}/browse/${encodeURIComponent(key)}`, host.origin);
		window.open(url.toString(), "_blank", "noopener");
	};

	const toolbar = wrap.createDiv("hearth-jira-toolbar");
	const content = wrap.createDiv("hearth-jira-issues");
	let refreshButton: HTMLButtonElement | null = null;
	let coordinator: JiraLoadCoordinator<{ force: boolean; refinedOnly: boolean }>;

	const paintLoading = (): void => {
		refreshButton?.toggleClass("is-loading", loading);
	};

	const paintToolbar = (): void => {
		if (destroyed) return;
		toolbar.empty();
		const enabled = config.controls ?? JIRA_CONTROLS;
		for (const control of enabled) {
			const details = toolbar.createEl("details", { cls: "hearth-jira-filter" });
			const selected = selections[control] ?? [];
			const summary = details.createEl("summary");
			summary.setText(
				selected.length
					? strings.controlCount(controlLabel(control), selected.length)
					: controlLabel(control),
			);
			const menu = details.createDiv("hearth-jira-filter-menu");
			const values = options[control];
			const searchWrap = menu.createDiv("hearth-jira-filter-search");
			const search = searchWrap.createEl("input", {
				attr: {
					"aria-label": strings.searchAria(controlLabel(control)),
					autocomplete: "off",
					spellcheck: "false",
				},
			});
			search.type = "search";
			search.placeholder = strings.searchPlaceholder;
			const optionList = menu.createDiv("hearth-jira-filter-options");
			const paintOptions = (): void => {
				optionList.empty();
				const filtered = filterJiraOptions(values, search.value);
				if (!filtered.length) {
					optionList.createDiv({
						cls: "hearth-jira-filter-empty",
						text: values.length ? strings.noMatchingOptions : strings.noOptions,
						attr: { role: "status" },
					});
					return;
				}
				for (const value of filtered) {
					const label = optionList.createEl("label", {
						cls: "hearth-jira-filter-option",
					});
					const input = label.createEl("input");
					input.type = "checkbox";
					input.checked = (selections[control] ?? []).includes(value);
					label.createSpan({ text: value });
					input.addEventListener("change", () => {
						const next = new Set(selections[control] ?? []);
						if (input.checked) next.add(value);
						else next.delete(value);
						selections[control] = Array.from(next);
						summary.setText(
							next.size
								? strings.controlCount(controlLabel(control), next.size)
								: controlLabel(control),
						);
						persistSelections();
						coordinator.request({ force: false, refinedOnly: true });
					});
				}
			};
			search.addEventListener("input", paintOptions);
			details.addEventListener("toggle", () => {
				if (details.open) {
					window.requestAnimationFrame(() => {
						if (!destroyed && search.isConnected) search.focus();
					});
					return;
				}
				search.value = "";
				paintOptions();
			});
			paintOptions();
		}
		refreshButton = toolbar.createEl("button", {
			cls: "hearth-jira-refresh",
			attr: { "aria-label": strings.refresh },
		});
		setIcon(refreshButton, "refresh-cw");
		paintLoading();
		refreshButton.addEventListener("click", () =>
			coordinator.request({ force: true, refinedOnly: false }),
		);
	};

	const paintIssues = (): void => {
		if (destroyed) return;
		content.empty();
		if (loading && !issues.length) {
			content.createDiv({ cls: "hearth-jira-state", text: strings.loading });
			return;
		}
		if (error && !issues.length) {
			content.createDiv({ cls: "hearth-jira-state", text: strings.error });
			return;
		}
		if (!issues.length) {
			content.createDiv({ cls: "hearth-jira-state", text: strings.empty });
			return;
		}
		for (const issue of issues) {
			const row = content.createEl("button", { cls: "hearth-jira-issue" });
			row.addEventListener("click", () => openIssue(issue.key));
			const type = row.createDiv("hearth-jira-type");
			setIcon(type, "square-dashed");
			type.setAttribute("aria-label", issue.fields.issuetype.name);
			const main = row.createDiv("hearth-jira-main");
			const meta = main.createDiv("hearth-jira-meta");
			meta.createSpan({ cls: "hearth-jira-key", text: issue.key });
			if (issue.fields.priority?.name) {
				meta.createSpan({
					cls: "hearth-jira-priority",
					text: issue.fields.priority.name,
				});
			}
			main.createDiv({ cls: "hearth-jira-summary", text: issue.fields.summary });
			row.createSpan({
				cls: `hearth-jira-status ${statusClass(
					issue.fields.status.statusCategory?.key,
				)}`,
				text: issue.fields.status.name,
			});
		}
	};

	coordinator = createJiraLoadCoordinator(
		async ({ force, refinedOnly }): Promise<void> => {
			if (destroyed) return;
			loading = true;
			error = false;
			paintLoading();
			paintIssues();
			try {
				const [baseJql, discoveredSprintFieldId] = await Promise.all([
					loadFilterJql(config, force),
					loadSprintFieldId(config),
				]);
				if (destroyed) return;
				sprintFieldId = discoveredSprintFieldId;
				if (!refinedOnly) {
					const sample = await searchJira(
						config,
						baseJql,
						200,
						sprintFieldId,
						force,
					);
					if (destroyed) return;
					options = deriveJiraOptions(sample, selections, sprintFieldId);
					paintToolbar();
				}
				const loadedIssues = await searchJira(
					config,
					composeJiraJql(baseJql, selections),
					Math.max(1, Math.min(200, config.maxResults ?? 50)),
					sprintFieldId,
					force,
				);
				if (destroyed) return;
				issues = loadedIssues;
			} catch {
				if (destroyed) return;
				error = true;
			} finally {
				if (!destroyed) {
					loading = false;
					paintLoading();
					paintIssues();
				}
			}
		},
	);

	component.register(() => {
		destroyed = true;
		coordinator.destroy();
		window.clearTimeout(saveTimer);
	});

	paintToolbar();
	paintIssues();
	coordinator.request({ force: false, refinedOnly: false });
	// Low power mode reports 0 here, so Jira is fetched on render and on the
	// manual refresh only — never on a timer.
	const refreshMin = effectiveAutoRefreshMinutes(
		view.plugin.settings,
		Math.max(0, config.refreshMin ?? 0),
	);
	if (refreshMin > 0) {
		component.registerInterval(
			window.setInterval(
				() => coordinator.request({ force: true, refinedOnly: false }),
				refreshMin * 60_000,
			),
		);
	}
}
