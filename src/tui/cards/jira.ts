/**
 * The Jira card as text: a saved filter's issues as a table, the way a
 * terminal issue tracker lists them.
 *
 * The refinement controls sit along the top as `[Status (2)]` tags; each opens
 * a menu of the values the filter's issues carry, ticked for the ones chosen.
 * Under them, one row per issue: its key, its type, its priority, its summary
 * and its status in its category's colour. Enter opens the issue in the
 * browser.
 */
import { t } from "../../i18n";
import {
	composeJiraJql,
	controlLabel,
	deriveJiraOptions,
	JIRA_CONTROLS,
	loadFilterJql,
	loadSprintFieldId,
	searchJira,
	validatedHost,
	type JiraIssue,
	type JiraOptions,
} from "../../jira";
import { effectiveAutoRefreshMinutes, type JiraConfig, type JiraControl } from "../../types";
import { hearthMenu } from "../../uidesign";
import type { TuiContext, TuiItem, TuiRenderer } from "../card";
import { asciify, fit, padEnd, truncate, type Line, type TuiStyle } from "../text";
import { message, showMenuFor, tableHeader, tag } from "./common";

interface JiraState {
	issues: JiraIssue[];
	options: JiraOptions;
	loading: boolean;
	error: boolean;
	started: boolean;
	token: number;
}

function jiraState(ctx: TuiContext): JiraState {
	const cur = ctx.state.jira as JiraState | undefined;
	if (cur) return cur;
	const fresh: JiraState = {
		issues: [],
		options: { status: [], assignee: [], priority: [], issueType: [], sprint: [], fixVersion: [] },
		loading: false,
		error: false,
		started: false,
		token: 0,
	};
	ctx.state.jira = fresh;
	return fresh;
}

/** Load the filter's issues. `refinedOnly` skips re-reading the options,
 * which only a full refresh changes. */
function load(ctx: TuiContext, config: JiraConfig, force: boolean, refinedOnly: boolean): void {
	const st = jiraState(ctx);
	const token = ++st.token;
	st.started = true;
	st.loading = true;
	st.error = false;
	const selections = (config.selections ??= {});
	void (async () => {
		try {
			const [baseJql, sprintFieldId] = await Promise.all([loadFilterJql(config, force), loadSprintFieldId(config)]);
			if (!refinedOnly) {
				const sample = await searchJira(config, baseJql, 200, sprintFieldId, force);
				if (token !== st.token) return;
				st.options = deriveJiraOptions(sample, selections, sprintFieldId);
			}
			const issues = await searchJira(config, composeJiraJql(baseJql, selections), Math.max(1, Math.min(200, config.maxResults ?? 50)), sprintFieldId, force);
			if (token !== st.token) return;
			st.issues = issues;
		} catch {
			if (token === st.token) st.error = true;
		} finally {
			if (token === st.token) {
				st.loading = false;
				ctx.redraw();
			}
		}
	})();
}

function openIssue(config: JiraConfig, key: string): void {
	const host = validatedHost(config.host ?? "");
	const hostPath = host.pathname.replace(/\/+$/, "");
	window.open(new URL(`${hostPath}/browse/${encodeURIComponent(key)}`, host.origin).toString(), "_blank", "noopener");
}

function statusStyle(key: string | undefined): TuiStyle {
	return key === "done" ? "green" : key === "new" ? "blue" : "yellow";
}

/** A control's menu: every value the filter's issues carry, ticked when
 * chosen. Picking one refines the list at once. */
function controlMenu(ctx: TuiContext, config: JiraConfig, control: JiraControl, evt: MouseEvent | KeyboardEvent): void {
	const st = jiraState(ctx);
	const selections = (config.selections ??= {});
	const values = st.options[control];
	const menu = hearthMenu();
	if (!values.length) menu.addItem((i) => i.setTitle(t().cards.jira.noOptions).setDisabled(true));
	for (const value of values) {
		const on = (selections[control] ?? []).includes(value);
		menu.addItem((i) =>
			i
				.setTitle(value)
				.setChecked(on)
				.onClick(() => {
					const next = new Set(selections[control] ?? []);
					if (on) next.delete(value);
					else next.add(value);
					selections[control] = Array.from(next);
					void ctx.view.plugin.saveData(ctx.view.plugin.settings);
					load(ctx, config, false, true);
					ctx.redraw();
				}),
		);
	}
	if ((selections[control] ?? []).length) {
		menu.addSeparator();
		menu.addItem((i) =>
			i
				.setTitle(t().tui.cards.jiraClear)
				.setIcon("x")
				.onClick(() => {
					selections[control] = [];
					void ctx.view.plugin.saveData(ctx.view.plugin.settings);
					load(ctx, config, false, true);
					ctx.redraw();
				}),
		);
	}
	showMenuFor(menu, evt);
}

export const jiraTui: TuiRenderer = {
	render(ctx) {
		const config = ctx.card.jira ?? {};
		const strings = t().cards.jira;
		if (ctx.view.plugin.settings.disableExternalCalls) return { lines: message(strings.disabled, ctx.cols) };
		if (!config.host?.trim() || !config.pat?.trim() || !config.filterId?.trim()) return { lines: message(strings.notConfigured, ctx.cols) };
		const st = jiraState(ctx);
		if (!st.started) load(ctx, config, false, false);
		const refreshMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, Math.max(0, config.refreshMin ?? 0));
		if (refreshMin > 0) ctx.component.registerInterval(window.setInterval(() => load(ctx, config, true, false), refreshMin * 60_000));

		const w = ctx.cols;
		const lines: Line[] = [];
		const items: TuiItem[] = [];
		// The controls, as tags that wrap.
		const selections = config.selections ?? {};
		let bar: Line = [];
		let col = 0;
		const barLine = () => lines.length;
		for (const control of config.controls ?? JIRA_CONTROLS) {
			const n = (selections[control] ?? []).length;
			const label = n ? strings.controlCount(controlLabel(control), n) : controlLabel(control);
			const width = label.length + 2;
			if (col > 0 && col + 1 + width > w) {
				lines.push(bar);
				bar = [];
				col = 0;
			}
			if (col > 0) {
				bar.push({ text: " " });
				col += 1;
			}
			const open = (evt?: MouseEvent | KeyboardEvent) => controlMenu(ctx, config, control, evt ?? new KeyboardEvent("keydown"));
			bar.push(tag(label, open, n ? ["accent", "bold"] : "dim"));
			items.push({ line: barLine(), range: [col, col + width], activate: open, menu: open });
			col += width;
		}
		if (bar.length) lines.push(bar);
		const sticky = lines.length + 1;

		// The issues.
		const keyW = Math.min(14, Math.max(6, ...st.issues.map((i) => i.key.length)) + 1);
		const statusW = Math.min(16, Math.max(7, ...st.issues.map((i) => i.fields.status.name.length)) + 1);
		const typeW = w >= 60 ? 9 : 0;
		const priW = w >= 50 ? 9 : 0;
		const summaryW = Math.max(8, w - keyW - statusW - typeW - priW);
		lines.push(
			tableHeader(
				[
					[t().tui.cards.jiraKey, keyW],
					...(typeW ? ([[t().tui.cards.jiraType, typeW]] as [string, number][]) : []),
					...(priW ? ([[t().tui.cards.jiraPriority, priW]] as [string, number][]) : []),
					[t().tui.cards.jiraSummary, summaryW],
					[t().tui.cards.jiraStatus, statusW],
				],
				w,
			),
		);
		if (!st.issues.length) {
			const text = st.loading ? strings.loading : st.error ? strings.error : strings.empty;
			lines.push([{ text, style: "dim" }]);
			return { lines, items, sticky };
		}
		for (const issue of st.issues) {
			const f = issue.fields;
			const row: Line = [{ text: padEnd(issue.key, keyW), style: ["bold", "accent"] }];
			if (typeW) row.push({ text: padEnd(truncate(asciify(f.issuetype.name), typeW - 1), typeW), style: "dim" });
			if (priW) row.push({ text: padEnd(truncate(asciify(f.priority?.name ?? ""), priW - 1), priW), style: "dim" });
			row.push(...fit([{ text: asciify(f.summary) }], summaryW - 1), { text: " " });
			row.push({ text: truncate(asciify(f.status.name), statusW), style: statusStyle(f.status.statusCategory?.key) });
			items.push({ line: lines.length, activate: () => openIssue(config, issue.key) });
			lines.push(row);
		}
		return {
			lines,
			items,
			sticky,
			hint: st.loading ? t().tui.cards.loading : String(st.issues.length),
			foot: t().tui.cards.jiraFoot,
		};
	},
	key(ctx, evt) {
		if (evt.key !== "r" || evt.ctrlKey || evt.metaKey) return false;
		const config = ctx.card.jira;
		if (!config) return false;
		load(ctx, config, true, false);
		ctx.redraw();
		return true;
	},
	menu(ctx, menu) {
		const config = ctx.card.jira;
		if (!config) return;
		menu.addItem((i) =>
			i
				.setTitle(t().cards.jira.refresh)
				.setIcon("refresh-cw")
				.onClick(() => {
					load(ctx, config, true, false);
					ctx.redraw();
				}),
		);
	},
};
