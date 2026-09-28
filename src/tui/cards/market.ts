/**
 * The Market card as text.
 *
 * A watchlist is an htop table — name, price, the move in green or red (red
 * for a rise where that is the convention), a sparkline — and every other
 * style has a text form of its own: a ticker tape that wraps instead of
 * scrolling, tiles, a portfolio with its allocation as a coloured bar, a
 * single instrument with its price big, a price chart drawn in block
 * characters, and the lookup with its search field.
 *
 * An instrument opens large (Enter on its row, or zoom): the whole of it, the
 * way the graphical card's dialog shows it — a chart over any range, the day's
 * and the year's range, the stats, the position.
 */
import { debounce, type Menu } from "obsidian";
import { cachedRates, loadRates } from "../../currency";
import { t } from "../../i18n";
import {
	direction,
	dominantCurrency,
	formatMoney,
	formatMove,
	formatPct,
	formatPrice,
	formatSigned,
	holdingValue,
	MARKET_RANGES,
	portfolioTotals,
	quotePageUrl,
	rangePosition,
	resolveSymbol,
	targetKey,
	type MarketQuote,
	type MarketSearchResult,
	type MarketSeries,
} from "../../market";
import {
	formatStamp,
	identity,
	inBatches,
	isSingleStyle,
	quoteFacts,
	rangeLabel,
	resolveMarket,
	rowName,
	rowsFor,
	rowSymbol,
	seriesMove,
	stateLabel,
	typeLabel,
	updatedText,
	type Resolved,
	type Row,
} from "../../cards/market";
import { cachedQuote, cachedSeries, loadQuotes, loadSeries, searchMarkets } from "../../marketfeed";
import { effectiveAutoRefreshMinutes, type MarketConfig, type MarketRange } from "../../types";
import { bigLines, bigWidth, BIG_ROWS, hasBigGlyphs } from "../bigtext";
import type { TuiContext, TuiItem, TuiMount, TuiOutput, TuiRenderer } from "../card";
import { areaChart, asciify, blockRow, chartRow, fit, padEnd, padStart, sparkline, spread, strWidth, truncate, type Line, type Seg, type TuiStyle } from "../text";
import { hearthMenu } from "../../uidesign";
import { button, heading, message, rule, showMenuFor, tableHeader, tag } from "./common";

// ---- Colour and small pieces ---------------------------------------------------

/** The style of a move: green up and red down, or the other way round where
 * rises are red. */
function moveStyle(value: number | null, r: Resolved): TuiStyle {
	const d = direction(value);
	if (d === "flat") return "dim";
	return (d === "up") !== r.redUp ? "green" : "red";
}

function arrow(value: number | null): string {
	const d = direction(value);
	return d === "up" ? "▲" : d === "down" ? "▼" : "·";
}

/** The move as the card writes it, with its arrow, coloured. */
function moveSeg(quote: MarketQuote, r: Resolved, mode = r.change): Seg {
	const v = quote.change ?? quote.changePct;
	return { text: `${arrow(v)} ${formatMove(quote, mode)}`, style: moveStyle(v, r) };
}

function priceText(quote: MarketQuote): string {
	return formatPrice(quote.price, quote.type, quote.currency);
}

/** The price and its currency: `189.25 USD`. */
function priceSegs(quote: MarketQuote, style: TuiStyle | TuiStyle[] = "bold"): Line {
	const line: Line = [{ text: priceText(quote), style }];
	if (quote.currency && quote.type !== "index") line.push({ text: ` ${quote.currency}`, style: "dim" });
	return line;
}

function stateSeg(quote: MarketQuote, r: Resolved, force = false): Seg | null {
	if ((!r.showState && !force) || !quote.state) return null;
	return { text: `● ${stateLabel(quote.state)}`, style: quote.state === "open" ? "green" : quote.state === "closed" ? "dim" : "yellow" };
}

function missing(loading: boolean): Seg {
	return { text: loading ? t().cards.market.loadingShort : t().cards.market.unavailable, style: "faint" };
}

/** A row's sparkline over the card's range, in the colour of its move. */
function sparkSeg(row: Row, r: Resolved, w: number): Seg | null {
	if (!r.showSparkline || w < 3) return null;
	const series = cachedSeries(row.targets, r.range);
	if (!series || series.points.length < 2) return null;
	return { text: padEnd(sparkline(resample(series, w), w), w), style: moveStyle(seriesMove(series), r) };
}

/** A series' prices, thinned to about `w` of them. */
function resample(series: MarketSeries, w: number): number[] {
	const pts = series.points;
	if (pts.length <= w) return pts.map((p) => p.v);
	const out: number[] = [];
	for (let i = 0; i < w; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (w - 1))].v);
	return out;
}

/** A low–high track with a marker where the price sits: `12.3 ━━━━●──── 45.6`. */
function rangeTrack(label: string, low: number | null, high: number | null, quote: MarketQuote, w: number): Line | null {
	const pos = rangePosition(quote.price, low, high);
	if (pos === null) return null;
	const lo = formatPrice(low, quote.type, quote.currency);
	const hi = formatPrice(high, quote.type, quote.currency);
	const labelW = Math.min(16, strWidth(label) + 2);
	const trackW = Math.max(4, w - labelW - strWidth(lo) - strWidth(hi) - 2);
	const at = Math.round(pos * (trackW - 1));
	return [
		{ text: padEnd(label, labelW), style: "dim" },
		{ text: `${lo} ` },
		{ text: "━".repeat(at), style: "accent" },
		{ text: "●", style: ["bold", "accent"] },
		{ text: "─".repeat(Math.max(0, trackW - at - 1)), style: "faint" },
		{ text: ` ${hi}` },
	];
}

/** Label/value facts, as many to a line as fit. */
function factLines(facts: readonly { label: string; value: string }[], w: number): Line[] {
	const shown = facts.filter((f) => f.value && f.value !== "—");
	if (!shown.length) return [];
	const labelW = Math.min(16, Math.max(...shown.map((f) => strWidth(f.label))) + 1);
	const valueW = Math.min(24, Math.max(...shown.map((f) => strWidth(f.value))));
	const cellW = labelW + valueW + 3;
	const across = Math.max(1, Math.floor((w + 3) / cellW));
	const lines: Line[] = [];
	for (let i = 0; i < shown.length; i += across) {
		const line: Line = [];
		shown.slice(i, i + across).forEach((f, j) => {
			if (j > 0) line.push({ text: "   " });
			line.push({ text: padEnd(truncate(f.label, labelW - 1), labelW), style: "dim" }, { text: padEnd(truncate(f.value, valueW), valueW), style: "bold" });
		});
		lines.push(line);
	}
	return lines;
}

/** The range switcher: `1D 5D 1M 6M 1Y 5Y`, the current one lit. */
function rangeTabs(current: MarketRange, pick: (range: MarketRange) => void): Line {
	const line: Line = [];
	MARKET_RANGES.forEach((range, i) => {
		if (i > 0) line.push({ text: " " });
		line.push({
			text: ` ${rangeLabel(range)} `,
			style: range === current ? ["reverse", "bold"] : "dim",
			onClick: () => pick(range),
			label: t().cards.market.rangeNames[range],
		});
	});
	return line;
}

/**
 * A price chart in block characters, with the high and low beside it and the
 * range's first and last moments under it. A day's chart draws the previous
 * close as a dotted rule, the way brokers do.
 */
function priceChart(series: MarketSeries | null, quote: MarketQuote | null, range: MarketRange, r: Resolved, w: number, h: number, loading: boolean): Line[] {
	if (!series || series.points.length < 2) {
		const text = loading ? t().cards.market.loadingShort : t().cards.market.noChart;
		const lines: Line[] = Array.from({ length: Math.max(1, h) }, () => []);
		lines[Math.floor((lines.length - 1) / 2)] = [{ text: padStart(text, Math.floor((w + strWidth(text)) / 2)), style: "faint" }];
		return lines;
	}
	const values = series.points.map((p) => p.v);
	const base = range === "1d" ? series.baseline : null;
	const lo = Math.min(...values, ...(base !== null ? [base] : []));
	const hi = Math.max(...values, ...(base !== null ? [base] : []));
	const fmt = (v: number) => formatPrice(v, quote?.type, quote?.currency);
	const axisW = Math.max(strWidth(fmt(lo)), strWidth(fmt(hi))) + 1;
	const chartW = Math.max(8, w - axisW);
	const rows = areaChart(values, chartW, h, lo, hi);
	const style = moveStyle(seriesMove(series), r);
	const baseRow = base !== null ? chartRow(base, lo, hi, h) : -1;
	const lines: Line[] = rows.map((row, i) => {
		const line: Line = [];
		if (i === baseRow) {
			// The baseline shows through wherever the area doesn't cover it.
			let run = "";
			let filled: boolean | null = null;
			const flush = () => {
				if (run) line.push(...(filled ? blockRow(run, style) : [{ text: run, style: "faint" as TuiStyle }]));
				run = "";
			};
			for (const ch of row) {
				const f = ch !== " ";
				if (filled !== null && f !== filled) flush();
				filled = f;
				run += f ? ch : "┄";
			}
			flush();
		} else line.push(...blockRow(row, style));
		const label = i === 0 ? fmt(hi) : i === h - 1 ? fmt(lo) : "";
		line.push({ text: ` ${label}`, style: "dim" });
		return line;
	});
	const first = formatStamp(series.points[0].t, range);
	const last = formatStamp(series.points[series.points.length - 1].t, range);
	lines.push([{ text: padEnd(first, Math.max(0, chartW - strWidth(last))), style: "faint" }, { text: last, style: "faint" }]);
	return lines;
}

// ---- Loading ----------------------------------------------------------------------

interface Feed {
	disabled: boolean;
	ttlMs: number;
	/** Whether a first load is still on its way. */
	loading: boolean;
	/** Whether a load was already running when this draw began. */
	busy: boolean;
}

/** What the card has on screen, so a load can tell whether it brought
 * anything new. */
function signature(rows: readonly Row[], charts: { rows: readonly Row[]; range: MarketRange }): string {
	const quotes = rows.map((row) => cachedQuote(row.targets)?.fetched ?? 0).join(",");
	const series = charts.rows
		.map((row) => {
			const s = cachedSeries(row.targets, charts.range);
			return s ? `${s.points.length}:${s.points[s.points.length - 1]?.t ?? 0}` : "-";
		})
		.join(",");
	return `${quotes}|${series}|${cachedRates() ? 1 : 0}`;
}

/**
 * Load the card's quotes and the charts it draws, redrawing only when they
 * brought something new — a redraw that asked again and got the same answer
 * would otherwise never stop. One load at a time per card.
 */
function feedFor(ctx: TuiContext, rows: readonly Row[], r: Resolved, charts: { rows: readonly Row[]; range: MarketRange }): Feed {
	const disabled = ctx.view.plugin.settings.disableExternalCalls;
	const ttlMs = Math.max(r.refreshMin, 1) * 60_000;
	const busy = ctx.state.mkBusy === true;
	const run = (force: boolean) => {
		if (ctx.state.mkBusy === true) return;
		ctx.state.mkBusy = true;
		const before = signature(rows, charts);
		void (async () => {
			await loadQuotes(rows.map((row) => row.targets), { ttlMs, disabled, force });
			if (r.style === "portfolio") await loadRates(disabled);
			await inBatches([...charts.rows], 4, (row) => loadSeries(row.targets, charts.range, { ttlMs, disabled, force }));
		})().finally(() => {
			ctx.state.mkBusy = false;
			if (signature(rows, charts) !== before || force) ctx.redraw();
			else if (ctx.state.mkTried !== true) {
				ctx.state.mkTried = true;
				ctx.redraw();
			}
		});
	};
	run(false);
	ctx.state.mkRefresh = () => run(true);
	const autoMin = effectiveAutoRefreshMinutes(ctx.view.plugin.settings, r.refreshMin);
	if (autoMin > 0) ctx.component.registerInterval(window.setInterval(() => run(true), autoMin * 60_000));
	return { disabled, ttlMs, busy, loading: ctx.state.mkTried !== true && rows.some((row) => !cachedQuote(row.targets)) };
}

function refreshNow(ctx: TuiContext): void {
	const again = ctx.state.mkRefresh as (() => void) | undefined;
	again?.();
}

// ---- Which instrument, which range ----------------------------------------------------

function selectedIndex(ctx: TuiContext, rows: readonly Row[]): number {
	const i = typeof ctx.state.mkSel === "number" ? ctx.state.mkSel : 0;
	return Math.max(0, Math.min(rows.length - 1, i));
}

function rangeOf(ctx: TuiContext, r: Resolved, key = "mkRange"): MarketRange {
	const v = ctx.state[key];
	return typeof v === "string" && (MARKET_RANGES as readonly string[]).includes(v) ? (v as MarketRange) : r.range;
}

function setRange(ctx: TuiContext, range: MarketRange, key = "mkRange"): void {
	ctx.state[key] = range;
	ctx.redraw();
}

function stepRange(ctx: TuiContext, r: Resolved, dir: 1 | -1, key = "mkRange"): void {
	const i = MARKET_RANGES.indexOf(rangeOf(ctx, r, key));
	setRange(ctx, MARKET_RANGES[(i + dir + MARKET_RANGES.length) % MARKET_RANGES.length], key);
}

/** Open an instrument large. */
function openRow(ctx: TuiContext, row: Row): void {
	ctx.state.mkDetail = row.index;
	if (ctx.zoomed) ctx.redraw();
	else ctx.view.tuiBoard?.zoom(ctx.card);
}

// ---- The styles ---------------------------------------------------------------------

interface Paint {
	ctx: TuiContext;
	rows: Row[];
	r: Resolved;
	feed: Feed;
	cfg: MarketConfig;
}

/** The watchlist table. */
function listStyle(p: Paint, startLine = 0): { lines: Line[]; items: TuiItem[] } {
	const { ctx, rows, r, feed } = p;
	const w = ctx.cols;
	const s = t().cards.market;
	const sparkW = r.showSparkline && w >= 44 ? Math.min(16, Math.floor(w / 5)) : 0;
	const moveW = r.change === "both" ? 20 : r.change === "absolute" ? 11 : 10;
	const priceW = 14;
	const nameW = Math.max(6, w - priceW - moveW - (sparkW ? sparkW + 1 : 0));
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	lines.push(
		tableHeader(
			[
				[r.showName ? t().tui.cards.mkName : t().tui.cards.mkSymbol, nameW],
				[padStart(t().tui.cards.mkPrice, priceW - 1) + " ", priceW],
				[padStart(t().tui.cards.mkChange, moveW - 1) + " ", moveW],
				...(sparkW ? ([[` ${rangeLabel(r.range)}`, sparkW + 1]] as [string, number][]) : []),
			],
			w,
		),
	);
	for (const row of rows) {
		const quote = cachedQuote(row.targets);
		const { title, sub } = identity(row, quote, r);
		const name: Line = [{ text: asciify(title), style: "bold" }];
		if (sub && r.showName && nameW > strWidth(title) + 4) name.push({ text: `  ${asciify(sub)}`, style: "dim" });
		const line: Line = [...fit(name, nameW - 1), { text: " " }];
		if (!quote) line.push({ text: padStart(missing(feed.loading).text, priceW + moveW - 1), style: "faint" });
		else {
			const move = moveSeg(quote, r);
			line.push({ text: padStart(priceText(quote), priceW - 1), style: "bold" }, { text: " " });
			line.push({ ...move, text: padStart(truncate(move.text, moveW - 1), moveW - 1) }, { text: " " });
		}
		if (sparkW) {
			const spark = sparkSeg(row, r, sparkW);
			line.push({ text: " " }, spark ?? { text: " ".repeat(sparkW) });
		}
		items.push({ line: startLine + lines.length, activate: () => openRow(ctx, row), menu: (evt) => rowMenu(ctx, row, evt) });
		lines.push(line);
	}
	if (!rows.length) lines.push([{ text: s.lookupHint, style: "dim" }]);
	return { lines, items };
}

/** Tiles: a block of four lines per instrument, as many across as fit. */
function tilesStyle(p: Paint): { lines: Line[]; items: TuiItem[] } {
	const { ctx, rows, r, feed } = p;
	const w = ctx.cols;
	const across = Math.max(1, Math.floor((w + 1) / 19));
	const tileW = Math.floor((w + 1) / across) - 1;
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	for (let i = 0; i < rows.length; i += across) {
		const block: Line[] = [[], [], [], []];
		rows.slice(i, i + across).forEach((row, j) => {
			const quote = cachedQuote(row.targets);
			const { title } = identity(row, quote, r);
			const col = j * (tileW + 1);
			const cells: Line[] = [
				[{ text: asciify(title), style: "bold" }],
				quote ? priceSegs(quote) : [missing(feed.loading)],
				quote ? [moveSeg(quote, r)] : [],
				[sparkSeg(row, r, tileW) ?? { text: r.showName && title !== rowSymbol(row) ? rowSymbol(row) : "", style: "dim" }],
			];
			cells.forEach((c, k) => {
				if (j > 0) block[k].push({ text: " " });
				block[k].push(...fit(c, tileW));
			});
			items.push({ line: lines.length, span: 4, range: [col, col + tileW], activate: () => openRow(ctx, row), menu: (evt) => rowMenu(ctx, row, evt) });
		});
		lines.push(...block, []);
	}
	return { lines, items };
}

/** The ticker: the tape, wrapped rather than scrolled. */
function tickerStyle(p: Paint): { lines: Line[]; items: TuiItem[] } {
	const { ctx, rows, r } = p;
	const w = ctx.cols;
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	let line: Line = [];
	let col = 0;
	for (const row of rows) {
		const quote = cachedQuote(row.targets);
		const entry: Line = [{ text: identity(row, quote, r).title, style: "bold" }, { text: " " }];
		if (quote) entry.push({ text: priceText(quote) }, { text: " " }, moveSeg(quote, r));
		else entry.push({ text: "—", style: "faint" });
		const entryW = entry.reduce((n, s) => n + strWidth(s.text), 0);
		if (col > 0 && col + 3 + entryW > w) {
			lines.push(line);
			line = [];
			col = 0;
		}
		if (col > 0) {
			line.push({ text: " │ ", style: "faint" });
			col += 3;
		}
		const open = () => openRow(ctx, row);
		line.push(...entry.map((s) => ({ ...s, onClick: open })));
		items.push({ line: lines.length, range: [col, col + entryW], activate: open, menu: (evt) => rowMenu(ctx, row, evt) });
		col += entryW;
	}
	if (line.length) lines.push(line);
	return { lines, items };
}

/** The categorical colours the allocation bar cycles through. */
const ALLOC_STYLES: TuiStyle[] = ["blue", "magenta", "cyan", "yellow", "green", "red", "accent"];

/** The portfolio: the total, the day's and the whole gain, the allocation as
 * one coloured bar, and a row per holding. */
function portfolioStyle(p: Paint): { lines: Line[]; items: TuiItem[] } {
	const { ctx, rows, r, feed, cfg } = p;
	const s = t().cards.market;
	const w = ctx.cols;
	const held = rows.map((row) => ({ row, quote: cachedQuote(row.targets), quantity: row.item.quantity ?? 0 })).filter((h) => h.quantity > 0);
	const priced = held.filter((h): h is typeof h & { quote: MarketQuote } => h.quote !== null);
	const base = (cfg.baseCurrency ?? dominantCurrency(priced.map((h) => h.quote.currency), "USD")).toUpperCase();
	const totals = portfolioTotals(
		priced.map((h) => ({ quote: h.quote, quantity: h.quantity, cost: h.row.item.cost })),
		base,
		cachedRates(),
	);
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	if (!priced.length) {
		lines.push([{ text: `${s.totalValue}  `, style: "dim" }, { text: held.length && feed.loading ? s.loadingShort : "—", style: "bold" }]);
		if (!held.length) lines.push([{ text: s.noHoldings, style: "dim" }]);
	} else {
		lines.push([{ text: `${s.totalValue}  `, style: "dim" }, { text: formatMoney(totals.value, base), style: ["bold", "accent"] }]);
		const chips: Line = [];
		const chip = (label: string, value: number | null, pct: number | null) => {
			if (value === null) return;
			if (chips.length) chips.push({ text: "   " });
			chips.push({ text: `${label} `, style: "dim" }, { text: `${arrow(value)} ${formatSigned(value)} (${formatPct(pct)})`, style: moveStyle(value, r) });
		};
		chip(s.today, totals.day, totals.dayPct);
		chip(s.totalGain, totals.gain, totals.gainPct);
		if (chips.length) lines.push(chips);
		if (totals.missing) lines.push([{ text: s.notConverted(totals.missing), style: "faint" }]);
		// The allocation: each holding's share of the total, in its colour.
		if (totals.value > 0) {
			const bar: Line = [];
			let used = 0;
			priced.forEach((h, i) => {
				const v = totals.values[i];
				if (v === null || v <= 0) return;
				const n = i === priced.length - 1 ? w - used : Math.round((v / totals.value) * w);
				if (n <= 0) return;
				bar.push({ text: "█".repeat(Math.min(n, w - used)), style: ALLOC_STYLES[i % ALLOC_STYLES.length], label: `${rowName(h.row, h.quote)} ${((v / totals.value) * 100).toFixed(1)}%` });
				used += Math.min(n, w - used);
			});
			if (bar.length) lines.push([], bar);
		}
	}
	lines.push([]);
	const heldIndex = new Map(priced.map((h, i) => [h.row.index, i]));
	const valueW = 14;
	const gainW = 22;
	const nameW = Math.max(8, w - valueW - gainW - 2);
	for (const row of rows) {
		const quote = cachedQuote(row.targets);
		const quantity = row.item.quantity ?? 0;
		const i = heldIndex.get(row.index);
		const swatch: Seg = i !== undefined ? { text: "█ ", style: ALLOC_STYLES[i % ALLOC_STYLES.length] } : { text: "  " };
		const title = asciify(identity(row, quote, r).title);
		const line: Line = [swatch];
		if (!quantity || !quote) {
			line.push(...fit([{ text: title, style: "bold" }, { text: quantity ? `  ${s.units(quantity)}` : "", style: "dim" }], nameW));
			line.push(quote ? { text: padStart(priceText(quote), valueW) } : { ...missing(feed.loading), text: padStart(missing(feed.loading).text, valueW) });
			if (quote) line.push({ text: " " }, { ...moveSeg(quote, r, "percent"), text: padStart(moveSeg(quote, r, "percent").text, gainW - 1) });
		} else {
			const v = holdingValue(quote, quantity, row.item.cost);
			line.push(...fit([{ text: title, style: "bold" }, { text: `  ${quantity.toLocaleString()} × ${priceText(quote)}`, style: "dim" }], nameW));
			line.push({ text: padStart(formatMoney(v.value, quote.currency), valueW), style: "bold" }, { text: " " });
			const gain = v.gain !== null ? `${arrow(v.gain)} ${formatSigned(v.gain)} (${formatPct(v.gainPct)})` : formatPct(quote.changePct);
			line.push({ text: padStart(gain, gainW - 1), style: moveStyle(v.gain ?? v.day, r) });
		}
		items.push({ line: lines.length, activate: () => openRow(ctx, row), menu: (evt) => rowMenu(ctx, row, evt) });
		lines.push(line);
	}
	return { lines, items };
}

/** The switcher over a single-instrument card that has more than one. */
function switcher(ctx: TuiContext, rows: readonly Row[], selected: number): Line | null {
	if (rows.length < 2) return null;
	const line: Line = [];
	rows.forEach((row, i) => {
		const quote = cachedQuote(row.targets);
		if (i > 0) line.push({ text: " " });
		line.push({
			text: ` ${rowSymbol(row)} `,
			style: i === selected ? ["reverse", "bold"] : moveStyle(quote?.changePct ?? null, resolveMarket(ctx.card.market ?? {})),
			onClick: () => {
				ctx.state.mkSel = i;
				ctx.redraw();
			},
		});
	});
	return line;
}

/** Minimal: the name, the price big, the move. */
function minimalStyle(p: Paint): Line[] {
	const { ctx, rows, r, feed } = p;
	const row = rows[selectedIndex(ctx, rows)];
	const quote = cachedQuote(row.targets);
	const lines: Line[] = [[{ text: asciify(identity(row, quote, r).title), style: "bold" }]];
	if (!quote) return [...lines, [missing(feed.loading)]];
	const price = priceText(quote);
	if (hasBigGlyphs(price) && bigWidth(price) <= ctx.cols && ctx.rows >= BIG_ROWS + 3) lines.push(...bigLines(price));
	else lines.push(priceSegs(quote, ["bold", "accent"]));
	const move: Line = [moveSeg(quote, r)];
	const state = stateSeg(quote, r);
	if (state) move.push({ text: "  " }, state);
	lines.push(move);
	if (r.showUpdated) lines.push([{ text: updatedText(quote.fetched), style: "faint" }]);
	return lines;
}

/** The single-instrument body: name, price and move, a chart, the ranges,
 * the stats. Shared by the spotlight, the lookup's picked result and the
 * instrument's large view. */
function instrumentBody(
	ctx: TuiContext,
	row: Row,
	r: Resolved,
	loading: boolean,
	opts: { range: MarketRange; pickRange: (range: MarketRange) => void; chartRows: number; stats: boolean; full: boolean },
	items: TuiItem[],
	startLine: number,
): Line[] {
	const s = t().cards.market;
	const w = ctx.cols;
	const quote = cachedQuote(row.targets);
	const lines: Line[] = [];
	const { title, sub } = identity(row, quote, r);
	const subLine = opts.full
		? [rowSymbol(row), quote?.exchange, quote ? typeLabel(quote.type) : ""].filter(Boolean).join(" · ")
		: [sub, quote ? typeLabel(quote.type) : ""].filter(Boolean).join(" · ");
	const state = quote ? stateSeg(quote, r, opts.full) : null;
	lines.push(spread([{ text: asciify(opts.full ? rowName(row, quote) : title), style: "bold" }, { text: subLine ? `  ${asciify(subLine)}` : "", style: "dim" }], state ? [state] : [], w));
	if (!quote) return [...lines, [missing(loading)]];
	lines.push([...priceSegs(quote, ["bold", "accent"]), { text: "   " }, moveSeg(quote, r, opts.full ? "both" : r.change)]);
	lines.push([]);
	lines.push(...priceChart(cachedSeries(row.targets, opts.range), quote, opts.range, r, w, opts.chartRows, loading));
	items.push({ line: startLine + lines.length, activate: () => stepRange(ctx, r, 1, ctx.zoomed ? "mkZoomRange" : "mkRange") });
	lines.push(rangeTabs(opts.range, opts.pickRange));
	if (opts.stats) {
		lines.push([]);
		const day = rangeTrack(s.dayRange, quote.dayLow, quote.dayHigh, quote, w);
		const year = rangeTrack(s.yearRange, quote.yearLow, quote.yearHigh, quote, w);
		if (day) lines.push(day);
		if (year) lines.push(year);
		const facts = opts.full
			? [
				...quoteFacts(quote),
				{ label: s.currency, value: quote.currency },
				{ label: s.source, value: s.sources[quote.target.provider] },
				{ label: s.asOf, value: new Date(quote.time).toLocaleString() },
			]
			: quoteFacts(quote);
		lines.push(...factLines(facts, w));
	}
	return lines;
}

// ---- The large view --------------------------------------------------------------------

function detailOutput(p: Paint, row: Row, withBack: boolean): TuiOutput {
	const { ctx, r, feed } = p;
	const s = t().cards.market;
	const w = ctx.cols;
	const items: TuiItem[] = [];
	const range = rangeOf(ctx, r, "mkZoomRange");
	const lines: Line[] = [];
	if (withBack) {
		const back = () => {
			ctx.state.mkDetail = undefined;
			ctx.redraw();
		};
		items.push({ line: 0, activate: back });
		lines.push([tag(`◂ ${s.back}`, back)], []);
	}
	lines.push(
		...instrumentBody(
			ctx,
			row,
			r,
			feed.loading,
			{ range, pickRange: (next) => setRange(ctx, next, "mkZoomRange"), chartRows: Math.max(6, Math.min(14, ctx.rows - 22)), stats: true, full: true },
			items,
			lines.length,
		),
	);
	const quote = cachedQuote(row.targets);
	const quantity = row.item.quantity ?? 0;
	if (quote && quantity > 0) {
		const v = holdingValue(quote, quantity, row.item.cost);
		lines.push([], heading(s.position), rule(w));
		lines.push(
			...factLines(
				[
					{ label: s.unitsLabel, value: quantity.toLocaleString() },
					{ label: s.value, value: formatMoney(v.value, quote.currency) },
					{ label: s.avgCost, value: row.item.cost === undefined ? "—" : formatPrice(row.item.cost, quote.type, quote.currency) },
					{ label: s.costBasis, value: v.costBasis === null ? "—" : formatMoney(v.costBasis, quote.currency) },
					{ label: s.today, value: v.day === null ? "—" : formatSigned(v.day) },
					{ label: s.totalGain, value: v.gain === null ? "—" : `${formatSigned(v.gain)} (${formatPct(v.gainPct)})` },
				],
				w,
			),
		);
	}
	lines.push([], rule(w));
	const actions: Line = [];
	if (quote) {
		const web = () => window.open(quotePageUrl(quote.target), "_blank");
		items.push({ line: lines.length, range: [0, strWidth(s.openInBrowser) + 4], activate: web });
		actions.push(button(s.openInBrowser, web, "accent"));
	}
	if (!feed.disabled) {
		const again = () => refreshNow(ctx);
		const from = actions.reduce((n, a) => n + strWidth(a.text), 0) + (actions.length ? 2 : 0);
		if (actions.length) actions.push({ text: "  " });
		const label = feed.busy ? t().tui.cards.loading : s.refresh;
		items.push({ line: lines.length, range: [from, from + strWidth(label) + 4], activate: again });
		actions.push(button(label, again));
	}
	if (quote) actions.push({ text: "   " }, { text: updatedText(quote.fetched), style: "faint" });
	lines.push(actions);
	return { lines, items, foot: t().tui.cards.mkDetailFoot };
}

// ---- The lookup --------------------------------------------------------------------------

interface LookupState {
	query: string;
	results: MarketSearchResult[];
	searched: boolean;
	searching: boolean;
	picked: Row | null;
	version: number;
}

function lookupState(ctx: TuiContext): LookupState {
	const cur = ctx.state.mkLookup as LookupState | undefined;
	if (cur) return cur;
	const fresh: LookupState = { query: "", results: [], searched: false, searching: false, picked: null, version: 0 };
	ctx.state.mkLookup = fresh;
	return fresh;
}

function isOnCard(rows: readonly Row[], symbol: string, provider: Row["item"]["provider"]): boolean {
	const key = resolveSymbol(symbol, provider)[0];
	return !!key && rows.some((row) => row.targets.some((tg) => targetKey(tg) === targetKey(key)));
}

function addToCard(ctx: TuiContext, symbol: string, provider: Row["item"]["provider"], name: string | undefined): void {
	const cfg = (ctx.card.market ??= {});
	(cfg.items ??= []).push({ symbol, provider, name: name || undefined });
	void ctx.view.plugin.saveData(ctx.view.plugin.settings);
	const st = lookupState(ctx);
	st.picked = null;
	st.results = [];
	st.searched = false;
	st.query = "";
	ctx.view.tuiSay?.(t().cards.market.added(name || symbol));
	ctx.redraw();
}

function lookupOutput(p: Paint): TuiOutput {
	const { ctx, rows, r, feed } = p;
	const s = t().cards.market;
	const st = lookupState(ctx);
	const lines: Line[] = [[]];
	const items: TuiItem[] = [];
	const search = async () => {
		const mine = ++st.version;
		const query = st.query.trim();
		if (!query) {
			st.searched = false;
			st.searching = false;
			st.results = [];
			ctx.redraw();
			return;
		}
		st.searching = true;
		st.picked = null;
		ctx.redraw();
		const found = await searchMarkets(query, { disabled: feed.disabled });
		if (mine !== st.version) return;
		st.results = found;
		st.searching = false;
		st.searched = true;
		ctx.redraw();
	};
	const later = debounce(() => void search(), 400, true);
	const mounts: TuiMount[] = [
		{
			line: 0,
			rows: 1,
			mount: (host) => {
				const prompt = host.createDiv("hearth-tui-line hearth-tui-calc-prompt");
				prompt.createSpan({ cls: "hearth-tui-accent hearth-tui-bold", text: "/ " });
				const input = prompt.createEl("input", {
					cls: "hearth-tui-calc-input",
					attr: {
						type: "text",
						spellcheck: "false",
						autocomplete: "off",
						placeholder: feed.disabled ? s.searchDisabled : s.searchPlaceholder,
						"aria-label": s.searchPlaceholder,
					},
				});
				input.disabled = feed.disabled;
				input.value = st.query;
				// A search's redraw rebuilds the field; it keeps the caret.
				if (ctx.state.mkTyping === true) {
					window.requestAnimationFrame(() => {
						input.focus();
						input.setSelectionRange(input.value.length, input.value.length);
					});
				}
				input.addEventListener("focus", () => (ctx.state.mkTyping = true));
				input.addEventListener("blur", () => (ctx.state.mkTyping = false));
				input.addEventListener("input", () => {
					st.query = input.value;
					later();
				});
				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						e.stopPropagation();
						if (st.searched && st.results.length && !st.searching) pick(st.results[0]);
						else void search();
					} else if (e.key === "ArrowDown") {
						e.preventDefault();
						input.blur();
						ctx.view.tuiBoard?.focus();
					}
				});
			},
		},
	];
	const pick = (result: MarketSearchResult) => {
		st.picked = {
			item: { symbol: result.target.symbol, provider: result.target.provider, name: result.name },
			targets: resolveSymbol(result.target.symbol, result.target.provider),
			index: -1,
		};
		ctx.state.mkTyping = false;
		const row = st.picked;
		void (async () => {
			await loadQuotes([row.targets], { ttlMs: feed.ttlMs, disabled: feed.disabled });
			ctx.redraw();
			await loadSeries(row.targets, rangeOf(ctx, r, "mkLookRange"), { ttlMs: feed.ttlMs, disabled: feed.disabled });
			ctx.redraw();
		})();
		ctx.redraw();
	};
	lines.push([]);

	if (st.picked) {
		const row = st.picked;
		const back = () => {
			st.picked = null;
			ctx.redraw();
		};
		const onCard = isOnCard(rows, row.item.symbol, row.item.provider);
		const add = () => addToCard(ctx, row.item.symbol, row.item.provider, row.item.name);
		const backLabel = `◂ ${s.back}`;
		items.push({ line: lines.length, range: [0, strWidth(backLabel) + 2], activate: back });
		const top: Line = [tag(backLabel, back)];
		if (onCard) top.push({ text: "  " }, { text: `[${s.onCard}]`, style: "faint" });
		else {
			const from = strWidth(backLabel) + 4;
			items.push({ line: lines.length, range: [from, from + strWidth(s.addToCard) + 4], activate: add });
			top.push({ text: "  " }, button(s.addToCard, add));
		}
		lines.push(top, []);
		const range = rangeOf(ctx, r, "mkLookRange");
		lines.push(
			...instrumentBody(
				ctx,
				row,
				r,
				true,
				{
					range,
					pickRange: (next) => {
						setRange(ctx, next, "mkLookRange");
						void loadSeries(row.targets, next, { ttlMs: feed.ttlMs, disabled: feed.disabled }).then(() => ctx.redraw());
					},
					chartRows: Math.max(3, Math.min(8, ctx.rows - 14)),
					stats: r.showStats,
					full: false,
				},
				items,
				lines.length,
			),
		);
		return { lines, items, mounts, foot: t().tui.cards.mkLookupFoot };
	}
	if (st.searching) return { lines: [...lines, [{ text: s.searching, style: "dim" }]], mounts };
	if (st.searched) {
		if (!st.results.length) return { lines: [...lines, [{ text: s.noResults, style: "dim" }]], mounts };
		for (const result of st.results) {
			const onCard = isOnCard(rows, result.target.symbol, result.target.provider);
			const right: Line = [{ text: typeLabel(result.type), style: "dim" }, { text: "  " }];
			right.push(onCard ? { text: "[✓]", style: "faint" } : tag("+", () => addToCard(ctx, result.target.symbol, result.target.provider, result.name)));
			const left: Line = [{ text: asciify(result.name), style: "bold" }, { text: `  ${[result.display, result.exchange].filter(Boolean).join(" · ")}`, style: "dim" }];
			items.push({ line: lines.length, activate: () => pick(result), toggle: onCard ? undefined : () => addToCard(ctx, result.target.symbol, result.target.provider, result.name) });
			lines.push(spread(left, right, ctx.cols));
		}
		return { lines, items, mounts, foot: t().tui.cards.mkResultsFoot };
	}
	if (!rows.length) return { lines: [...lines, ...message(s.lookupHint, ctx.cols)], mounts };
	const list = listStyle(p, lines.length);
	return { lines: [...lines, ...list.lines], items: [...items, ...list.items], mounts, foot: t().tui.cards.mkListFoot };
}

// ---- Menus -------------------------------------------------------------------------------

/** An instrument's menu: open it large, or on its source's page. */
function rowMenu(ctx: TuiContext, row: Row, evt: MouseEvent | KeyboardEvent): void {
	const quote = cachedQuote(row.targets);
	const menu = hearthMenu();
	menu.addItem((i) => i.setTitle(t().tui.cards.mkOpen).setIcon("maximize-2").onClick(() => openRow(ctx, row)));
	if (quote) {
		menu.addItem((i) =>
			i
				.setTitle(t().cards.market.openInBrowser)
				.setIcon("globe")
				.onClick(() => window.open(quotePageUrl(quote.target), "_blank")),
		);
	}
	showMenuFor(menu, evt);
}

// ---- The renderer --------------------------------------------------------------------------

export const marketTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.market ?? {};
		const r = resolveMarket(cfg);
		const rows = rowsFor(cfg);
		const s = t().cards.market;
		if (!rows.length && r.style !== "lookup") return { lines: message(t().cards.empty.marketNoSymbols, ctx.cols) };

		const detailIndex = typeof ctx.state.mkDetail === "number" ? ctx.state.mkDetail : null;
		const detailRow = ctx.zoomed && detailIndex !== null ? rows.find((row) => row.index === detailIndex) ?? null : null;
		const single = isSingleStyle(r.style);
		const selected = selectedIndex(ctx, rows);
		const range = rangeOf(ctx, r);

		// The charts this draw needs.
		let charts: { rows: Row[]; range: MarketRange } = { rows: [], range: r.range };
		if (ctx.zoomed && (detailRow || (single && rows[selected]))) charts = { rows: [detailRow ?? rows[selected]], range: rangeOf(ctx, r, "mkZoomRange") };
		else if (single && r.style !== "minimal" && rows[selected]) charts = { rows: [rows[selected]], range };
		else if ((r.style === "list" || r.style === "tiles" || r.style === "lookup") && r.showSparkline) charts = { rows, range: r.range };

		const feed = feedFor(ctx, rows, r, charts);
		if (feed.disabled && rows.length && rows.every((row) => !cachedQuote(row.targets))) return { lines: message(s.disabled, ctx.cols) };
		const p: Paint = { ctx, rows, r, feed, cfg };

		if (detailRow) return detailOutput(p, detailRow, !single);
		if (ctx.zoomed && single && rows[selected]) return detailOutput(p, rows[selected], false);
		if (r.style === "lookup") return lookupOutput(p);

		const hint = feed.busy ? s.loadingShort : undefined;
		switch (r.style) {
			case "minimal":
				return { lines: minimalStyle(p), hint, foot: t().tui.cards.mkSingleFoot };
			case "spotlight":
			case "chart": {
				const items: TuiItem[] = [];
				const head: Line[] = [];
				const sw = switcher(ctx, rows, selected);
				if (sw) head.push(sw, []);
				const row = rows[selected];
				const chartRows = r.style === "chart" ? Math.max(3, ctx.rows - head.length - 6) : Math.max(3, Math.min(8, ctx.rows - head.length - (r.showStats ? 11 : 6)));
				const body = instrumentBody(
					ctx,
					row,
					r,
					feed.loading,
					{ range, pickRange: (next) => setRange(ctx, next), chartRows, stats: r.style === "spotlight" && r.showStats, full: false },
					items,
					head.length,
				);
				if (r.showUpdated && r.style === "spotlight") {
					const quote = cachedQuote(row.targets);
					if (quote) body.push([{ text: updatedText(quote.fetched), style: "faint" }]);
				}
				return { lines: [...head, ...body], items, hint, foot: t().tui.cards.mkSingleFoot };
			}
			case "tiles":
				return { ...tilesStyle(p), hint, foot: t().tui.cards.mkListFoot };
			case "ticker":
				return { ...tickerStyle(p), hint, foot: t().tui.cards.mkListFoot };
			case "portfolio":
				return { ...portfolioStyle(p), hint, foot: t().tui.cards.mkListFoot };
			default: {
				const list = listStyle(p);
				return { ...list, hint, foot: t().tui.cards.mkListFoot, sticky: 1 };
			}
		}
	},
	key(ctx, evt) {
		const cfg = ctx.card.market ?? {};
		const r = resolveMarket(cfg);
		const rows = rowsFor(cfg);
		const zoomRange = ctx.zoomed ? "mkZoomRange" : r.style === "lookup" ? "mkLookRange" : "mkRange";
		if (evt.key === "[" || evt.key === "]") {
			stepRange(ctx, r, evt.key === "]" ? 1 : -1, zoomRange);
			return true;
		}
		if (evt.key === "r" && !evt.ctrlKey && !evt.metaKey) {
			refreshNow(ctx);
			return true;
		}
		if (evt.key === "Backspace" && ctx.zoomed && typeof ctx.state.mkDetail === "number" && !isSingleStyle(r.style)) {
			ctx.state.mkDetail = undefined;
			ctx.redraw();
			return true;
		}
		if (evt.key === "/" && r.style === "lookup") {
			const input = ctx.view.contentEl.querySelector<HTMLInputElement>(`.hearth-tui-body[data-card="${ctx.card.id}"] .hearth-tui-calc-input`);
			input?.focus();
			return !!input;
		}
		// A single-instrument card with several switches between them.
		if (isSingleStyle(r.style) && rows.length > 1 && (evt.key === "ArrowLeft" || evt.key === "ArrowRight")) {
			const i = selectedIndex(ctx, rows);
			ctx.state.mkSel = (i + (evt.key === "ArrowRight" ? 1 : -1) + rows.length) % rows.length;
			ctx.redraw();
			return true;
		}
		return false;
	},
	menu(ctx, menu: Menu) {
		if (ctx.view.plugin.settings.disableExternalCalls) return;
		menu.addItem((i) => i.setTitle(t().cards.market.refresh).setIcon("refresh-cw").onClick(() => refreshNow(ctx)));
	},
};
