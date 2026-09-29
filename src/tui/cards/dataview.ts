/**
 * The Dataview card as text.
 *
 * A DQL query is run through Dataview's own `query` API and its result drawn
 * as the terminal would: a TABLE as a table under an htop header, a LIST as a
 * list, a TASK query as tickable boxes grouped under their notes. The query
 * reruns when Dataview's index changes.
 *
 * DataviewJS draws whatever its script draws, so a card in that language is
 * shown graphically inside the frame, as is a Dataview too old to answer
 * `query`.
 */
import { TFile, type Events } from "obsidian";
import { getDataviewApi } from "../../dataview";
import { t } from "../../i18n";
import type { TuiContext, TuiItem, TuiOutput, TuiRenderer } from "../card";
import { asciify, fit, padEnd, strWidth, truncate, type Line } from "../text";
import { fileMenu, message, openCardFile, tableHeader } from "./common";

/** The slice of a Dataview query result read here. Everything under it is
 * Dataview's own values — links, dates, durations, arrays — narrowed as it is
 * drawn. */
interface QueryResult {
	type: string;
	headers?: string[];
	values: unknown[];
}

type QueryOutcome = { successful: true; value: QueryResult } | { successful: false; error: string };

interface QueryApi {
	query(source: string, originFile?: string): Promise<QueryOutcome>;
}

function queryApi(ctx: TuiContext): QueryApi | null {
	const api = getDataviewApi(ctx.view.app) as unknown as Partial<QueryApi> | null;
	return api && typeof api.query === "function" ? (api as QueryApi) : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

/** A Dataview link: an object with a path and (for a file) a display. */
function linkOf(v: unknown): { path: string; display?: string; subpath?: string } | null {
	if (!isRecord(v) || typeof v.path !== "string") return null;
	if (!("embed" in v) && !("type" in v)) return null;
	return { path: v.path, display: typeof v.display === "string" ? v.display : undefined, subpath: typeof v.subpath === "string" ? v.subpath : undefined };
}

/** Any Dataview value as a line of text. */
export function literalText(v: unknown): string {
	if (v === null || v === undefined) return "-";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	if (Array.isArray(v)) return v.map(literalText).join(", ");
	const link = linkOf(v);
	if (link) return link.display || (link.path.split("/").pop() ?? link.path).replace(/\.md$/i, "") + (link.subpath ? `#${link.subpath}` : "");
	if (isRecord(v)) {
		// Luxon's DateTime and Duration, as Dataview hands them over.
		if (typeof v.toISODate === "function" && v.isLuxonDateTime === true) {
			const dt = v as { toISODate(): string; hour: number; minute: number; toFormat(f: string): string };
			return dt.hour || dt.minute ? dt.toFormat("yyyy-MM-dd HH:mm") : dt.toISODate();
		}
		if (typeof v.toHuman === "function") return (v as { toHuman(): string }).toHuman();
		if (typeof v.toString === "function" && v.toString !== Object.prototype.toString) return (v as { toString(): string }).toString();
		return JSON.stringify(v);
	}
	return "";
}

/** The first link in a row, for opening it. */
function rowFile(ctx: TuiContext, row: readonly unknown[]): TFile | null {
	for (const cell of row) {
		const link = linkOf(Array.isArray(cell) ? cell[0] : cell);
		if (!link) continue;
		const file = ctx.view.app.metadataCache.getFirstLinkpathDest(link.path, "") ?? ctx.view.app.vault.getAbstractFileByPath(link.path);
		if (file instanceof TFile) return file;
	}
	return null;
}

function openRow(ctx: TuiContext, file: TFile | null, evt?: MouseEvent | KeyboardEvent): void {
	if (file) openCardFile(ctx.view, file, evt);
}

function tableOutput(ctx: TuiContext, result: QueryResult): TuiOutput {
	const w = ctx.cols;
	const headers = result.headers ?? [];
	const rows = result.values.filter(Array.isArray) as unknown[][];
	const texts = rows.map((row) => row.map((cell) => asciify(literalText(cell)).replace(/\s+/g, " ")));
	// Each column as wide as its widest cell, the last one taking what is left;
	// a column never shrinks below its header or six cells.
	const n = headers.length;
	const want = headers.map((h, i) => Math.max(strWidth(h), 6, ...texts.map((r) => strWidth(r[i] ?? ""))) + 1);
	const widths = [...want];
	let total = widths.reduce((a, b) => a + b, 0);
	while (total > w && widths.some((x) => x > 7)) {
		const i = widths.indexOf(Math.max(...widths));
		widths[i]--;
		total--;
	}
	if (n && total < w) widths[n - 1] += w - total;
	const lines: Line[] = [tableHeader(headers.map((h, i) => [truncate(h, widths[i] - 1), widths[i]] as [string, number]), w)];
	const items: TuiItem[] = [];
	texts.forEach((cells, r) => {
		const line: Line = [];
		cells.forEach((text, i) => {
			const isLink = !!linkOf(Array.isArray(rows[r][i]) ? (rows[r][i] as unknown[])[0] : rows[r][i]);
			line.push({ text: padEnd(truncate(text, (widths[i] ?? 8) - 1), widths[i] ?? 8), style: isLink ? "accent" : i === 0 ? "bold" : undefined });
		});
		const file = rowFile(ctx, rows[r]);
		items.push({ line: lines.length, activate: (evt) => openRow(ctx, file, evt), menu: file ? (evt) => fileMenu(ctx.view, file, evt) : undefined });
		lines.push(fit(line, w));
	});
	if (!rows.length) lines.push([{ text: t().tui.cards.dvNoResults, style: "dim" }]);
	return { lines, items, sticky: 1, hint: String(rows.length), foot: t().tui.cards.filesFoot };
}

function listOutput(ctx: TuiContext, result: QueryResult): TuiOutput {
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	for (const value of result.values) {
		const cells = Array.isArray(value) ? value : [value];
		const file = rowFile(ctx, cells);
		const line: Line = [{ text: "- ", style: "faint" }];
		cells.forEach((cell, i) => {
			if (i > 0) line.push({ text: ": ", style: "faint" });
			line.push({ text: asciify(literalText(cell)), style: linkOf(cell) ? "accent" : undefined });
		});
		items.push({ line: lines.length, activate: (evt) => openRow(ctx, file, evt), menu: file ? (evt) => fileMenu(ctx.view, file, evt) : undefined });
		lines.push(fit(line, ctx.cols));
	}
	if (!lines.length) lines.push([{ text: t().tui.cards.dvNoResults, style: "dim" }]);
	return { lines, items, hint: String(result.values.length), foot: t().tui.cards.filesFoot };
}

/** A TASK result: the tasks under the note each came from, as boxes. */
function taskOutput(ctx: TuiContext, result: QueryResult): TuiOutput {
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	const task = (item: Record<string, unknown>, depth: number) => {
		const done = item.completed === true;
		const text = typeof item.text === "string" ? item.text : literalText(item);
		const path = typeof item.path === "string" ? item.path : "";
		const file = path ? ctx.view.app.vault.getAbstractFileByPath(path) : null;
		const line: Line = [{ text: "  ".repeat(depth) }];
		if (item.task !== false) line.push({ text: done ? "[x] " : "[ ] ", style: done ? "green" : "accent" });
		else line.push({ text: "- ", style: "faint" });
		line.push({ text: asciify(text.split("\n")[0]), style: done ? ["dim", "strike"] : undefined });
		items.push({ line: lines.length, activate: (evt) => openRow(ctx, file instanceof TFile ? file : null, evt) });
		lines.push(fit(line, ctx.cols));
		const children = Array.isArray(item.children) ? item.children : [];
		for (const child of children) if (isRecord(child)) task(child, depth + 1);
	};
	for (const value of result.values) {
		if (!isRecord(value)) continue;
		// A grouping: `{ key, rows }`, the note (or whatever it was grouped by)
		// over its tasks.
		if ("rows" in value && Array.isArray(value.rows)) {
			if (lines.length) lines.push([]);
			lines.push([{ text: asciify(literalText(value.key)), style: ["bold", "accent"] }]);
			for (const row of value.rows) if (isRecord(row)) task(row, 0);
		} else task(value, 0);
	}
	if (!lines.length) lines.push([{ text: t().tui.cards.dvNoResults, style: "dim" }]);
	return { lines, items, foot: t().tui.cards.filesFoot };
}

export const dataviewTui: TuiRenderer = {
	graphicalFor: (view, card) => card.dataview?.language === "js" || !(getDataviewApi(view.app) && typeof (getDataviewApi(view.app) as unknown as Partial<QueryApi>).query === "function"),
	render(ctx) {
		const api = queryApi(ctx);
		if (!api) return { lines: message(t().cards.empty.dataviewEnable, ctx.cols) };
		const query = (ctx.card.dataview?.query ?? "").trim();
		if (!query) return { lines: message(t().cards.empty.dataviewNoQuery, ctx.cols) };

		// Rerun when Dataview's index changes. A result redraws the card, and
		// that draw must not run the query again.
		// Dataview announces its index on the metadata cache, under names of its
		// own that Obsidian's typings don't list.
		const events: Events = ctx.view.app.metadataCache;
		const again = () => ctx.redraw();
		ctx.component.registerEvent(events.on("dataview:index-ready", again));
		ctx.component.registerEvent(events.on("dataview:metadata-change", again));
		if (ctx.state.dvFresh === true) ctx.state.dvFresh = false;
		else {
			void api.query(query, "").then(
				(outcome) => {
					ctx.state.dvOutcome = outcome;
					ctx.state.dvFresh = true;
					ctx.redraw();
				},
				(err: unknown) => {
					ctx.state.dvOutcome = { successful: false, error: err instanceof Error ? err.message : String(err) };
					ctx.state.dvFresh = true;
					ctx.redraw();
				},
			);
		}
		const outcome = ctx.state.dvOutcome as QueryOutcome | undefined;
		if (!outcome) return { lines: [[{ text: t().tui.cards.loading, style: "dim" }]] };
		if (!outcome.successful) {
			// Dataview's parse errors are drawings (a caret under the column), so
			// they are kept line for line rather than rewrapped.
			return { lines: [[{ text: t().tui.cards.dvError, style: ["red", "bold"] }], [], ...outcome.error.split("\n").map((l) => [{ text: l, style: "dim" as const }])] };
		}
		const result = outcome.value;
		if (result.type === "table") return tableOutput(ctx, result);
		if (result.type === "task") return taskOutput(ctx, result);
		return listOutput(ctx, result);
	},
};
