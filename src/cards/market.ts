import { type App, Component, Notice, Setting } from "obsidian";
import { setIcon } from "../glyphs";
import { HearthModal } from "../uidesign";
import { emptyState } from "../cardbodies";
import { cachedRates, CURRENCY_CODES, loadRates } from "../currency";
import { detectLanguage, t } from "../i18n";
import {
	direction,
	displaySymbol,
	dominantCurrency,
	formatCompact,
	formatMoney,
	formatMove,
	formatPct,
	formatPrice,
	formatSigned,
	holdingValue,
	MARKET_RANGES,
	type MarketAssetType,
	type MarketQuote,
	type MarketSearchResult,
	type MarketSeries,
	type MarketState,
	type MarketTarget,
	portfolioTotals,
	quotePageUrl,
	rangePosition,
	redUpForLanguage,
	resolveSymbol,
	targetKey,
} from "../market";
import { cachedQuote, cachedSeries, loadQuotes, loadSeries, searchMarkets } from "../marketfeed";
import { shapePath } from "../shapes";
import {
	type CardDesign,
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	effectiveCardDesign,
	type MarketConfig,
	type MarketItem,
	type MarketRange,
	type MarketStyle,
	motionAllowed,
} from "../types";
import { designSetting, dressModal, makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Market -------------------------------------------------------------
//
// One card, eight styles: three for a single instrument (minimal, spotlight,
// chart), four for several (list, tiles, ticker, portfolio) and one that looks
// things up on the card itself (lookup). All of them draw quotes from the one
// shared feed (src/marketfeed.ts) and honour the same display toggles, in a
// Classic or a Material 3 Expressive design — the weather card's two, and
// built the same way. Clicking an instrument opens the whole of it in a dialog.


/** Every config value a render needs, with its default applied once. */
export interface Resolved {
	style: MarketStyle;
	expressive: boolean;
	redUp: boolean;
	range: MarketRange;
	change: "percent" | "absolute" | "both";
	showName: boolean;
	showSparkline: boolean;
	showStats: boolean;
	showState: boolean;
	showUpdated: boolean;
	animate: boolean;
	refreshMin: number;
}

/** The styles that draw one instrument. */
export function isSingleStyle(style: MarketStyle): boolean {
	return style === "minimal" || style === "spotlight" || style === "chart";
}

export function resolveMarket(
	cfg: MarketConfig,
	lowPower = false,
	lang = detectLanguage(),
	vaultDesign: CardDesign = "classic",
): Resolved {
	const style = cfg.style ?? "list";
	return {
		style,
		expressive: (cfg.design ?? vaultDesign) === "expressive",
		redUp: cfg.upColor ? cfg.upColor === "red" : redUpForLanguage(lang),
		range: cfg.range ?? "1d",
		change: cfg.change ?? (isSingleStyle(style) ? "both" : "percent"),
		showName: cfg.showName !== false,
		showSparkline: cfg.showSparkline !== false,
		showStats: cfg.showStats !== false,
		showState: cfg.showMarketState !== false,
		showUpdated: cfg.showUpdated ?? false,
		animate: (cfg.animate ?? true) && !lowPower,
		refreshMin: cfg.refreshMin ?? 5,
	};
}

/** One instrument on the card with the targets it is fetched from. */
export interface Row {
	item: MarketItem;
	targets: MarketTarget[];
	index: number;
}

export function rowsFor(cfg: MarketConfig): Row[] {
	return (cfg.items ?? [])
		.map((item, index) => ({ item, targets: resolveSymbol(item.symbol, item.provider), index }))
		.filter((row) => row.targets.length > 0);
}

/** The symbol a row shows: the source's own, without its decoration. */
function rowSymbol(row: Row): string {
	return displaySymbol(row.targets[0]);
}

/** The name a row goes by: the one on the card, else the quote's. */
function rowName(row: Row, quote: MarketQuote | null): string {
	return row.item.name?.trim() || quote?.name || rowSymbol(row);
}

/** The label line and the line under it, as the display toggles ask. */
function identity(row: Row, quote: MarketQuote | null, r: Resolved): { title: string; sub: string } {
	const symbol = rowSymbol(row);
	if (!r.showName) return { title: symbol, sub: quote?.exchange ?? "" };
	const name = rowName(row, quote);
	const sub = [name === symbol ? "" : symbol, quote?.exchange ?? ""].filter(Boolean).join(" · ");
	return { title: name, sub };
}

function dirClass(value: number | null): string {
	return `is-${direction(value)}`;
}

/** The trend glyph for a move. */
function trendIcon(value: number | null): string {
	const d = direction(value);
	return d === "up" ? "trending-up" : d === "down" ? "trending-down" : "minus";
}

function typeLabel(type: MarketAssetType): string {
	return t().cards.market.types[type];
}

function stateLabel(state: MarketState): string {
	return t().cards.market.states[state];
}

function rangeLabel(range: MarketRange): string {
	return t().cards.market.ranges[range];
}

/** When a chart point was, at the grain its range is drawn in. */
function formatStamp(ms: number, range: MarketRange): string {
	const d = new Date(ms);
	if (range === "1d") return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	if (range === "5d") {
		return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
	}
	return d.toLocaleDateString(undefined, {
		year: range === "1y" || range === "5y" ? "numeric" : undefined,
		month: "short",
		day: "numeric",
	});
}

function updatedText(fetched: number): string {
	return t().cards.market.updated(
		new Date(fetched).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
	);
}

/** The move a chart shows: its last price against its baseline. */
function seriesMove(series: MarketSeries): number | null {
	const last = series.points[series.points.length - 1];
	const base = series.baseline ?? series.points[0]?.v ?? null;
	return last && base !== null ? last.v - base : null;
}


// ---- Pieces -------------------------------------------------------------

/**
 * The Expressive hero badge: the trend glyph on a nine-lobed cookie in the
 * move's container tone, the way the weather card sets its big glyph.
 */
function trendBadge(parent: HTMLElement, value: number | null, cls = "hearth-market-badge"): void {
	const badge = parent.createDiv(`${cls} ${dirClass(value)}`);
	const svg = badge.createSvg("svg", { attr: { viewBox: "0 0 48 48", "aria-hidden": "true" } });
	svg.createSvg("path", { cls: "hearth-market-badge-shape", attr: { d: shapePath(24, 24, 22, 9, 0.06) } });
	setIcon(badge.createDiv("hearth-market-badge-icon"), trendIcon(value));
}

/** The price, and its currency as a small tag beside it. */
function priceLine(parent: HTMLElement, quote: MarketQuote, cls = "hearth-market-price"): HTMLElement {
	const el = parent.createDiv(cls);
	el.createSpan({ cls: "hearth-market-price-value", text: formatPrice(quote.price, quote.type, quote.currency) });
	if (quote.currency && quote.type !== "index") {
		el.createSpan({ cls: "hearth-market-ccy", text: quote.currency });
	}
	return el;
}

/** The move: coloured text in Classic, a tonal pill in Expressive (CSS). */
function changeLine(parent: HTMLElement, quote: MarketQuote, r: Resolved, cls = "hearth-market-change"): HTMLElement {
	const el = parent.createDiv(`${cls} ${dirClass(quote.change ?? quote.changePct)}`);
	if (r.expressive) setIcon(el.createSpan("hearth-market-change-icon"), trendIcon(quote.change ?? quote.changePct));
	el.createSpan({ text: formatMove(quote, r.change) });
	return el;
}

/** "Open" / "Closed", with a dot. */
function stateChip(parent: HTMLElement, quote: MarketQuote, r: Resolved): void {
	if (!r.showState || !quote.state) return;
	const chip = parent.createDiv(`hearth-market-state is-${quote.state}`);
	chip.createSpan("hearth-market-state-dot");
	chip.createSpan({ text: stateLabel(quote.state) });
}

/** Stand-in for a row whose quote hasn't arrived (or can't). */
function missingQuote(parent: HTMLElement, loading: boolean): void {
	parent.createDiv({
		cls: "hearth-market-missing",
		text: loading ? t().cards.market.loadingShort : t().cards.market.unavailable,
	});
}

interface ChartOptions {
	cls: string;
	/** Draw the baseline (the previous close on a day's chart) as a dashed rule. */
	baseline?: boolean;
	/** A crosshair and a readout that follow the pointer. */
	interactive?: { range: MarketRange; quote: MarketQuote | null };
}

/**
 * A price chart. Like the weather card's curve, the viewBox is stretched to
 * the box (`preserveAspectRatio="none"`) and the strokes use `vector-effect`
 * so the stretch doesn't thicken them. Points are spaced evenly rather than by
 * time, so a night or a weekend with no trading doesn't draw a flat plateau —
 * the way every broker draws a multi-day chart.
 */
export function drawChart(parent: HTMLElement, series: MarketSeries, opts: ChartOptions): HTMLElement {
	const box = parent.createDiv(`hearth-market-chart ${opts.cls} ${dirClass(seriesMove(series))}`);
	const pts = series.points;
	if (pts.length < 2) return box;

	const values = pts.map((p) => p.v);
	const base = opts.baseline ? series.baseline : null;
	if (base !== null) values.push(base);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const width = 100;
	const height = 40;
	const pad = 3;
	const x = (i: number): number => (i / (pts.length - 1)) * width;
	const y = (v: number): number => (max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2));

	const svg = box.createSvg("svg", {
		cls: "hearth-market-chart-svg",
		attr: { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", "aria-hidden": "true" },
	});
	const line = pts.map((p, i) => `${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");
	svg.createSvg("polygon", {
		cls: "hearth-market-chart-fill",
		attr: { points: `0,${height} ${line} ${width},${height}` },
	});
	if (base !== null) {
		const by = y(base).toFixed(2);
		svg.createSvg("line", {
			cls: "hearth-market-chart-base",
			attr: { x1: "0", x2: String(width), y1: by, y2: by, "vector-effect": "non-scaling-stroke" },
		});
	}
	svg.createSvg("polyline", {
		cls: "hearth-market-chart-line",
		attr: { points: line, "vector-effect": "non-scaling-stroke" },
	});

	if (opts.interactive) {
		const { range, quote } = opts.interactive;
		const cursor = box.createDiv("hearth-market-chart-cursor");
		const dot = box.createDiv("hearth-market-chart-dot");
		const readout = box.createDiv("hearth-market-chart-readout");
		const hide = (): void => box.removeClass("is-tracking");
		box.addEventListener("pointermove", (e: PointerEvent) => {
			const rect = box.getBoundingClientRect();
			if (!rect.width) return;
			const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
			const i = Math.round(frac * (pts.length - 1));
			const p = pts[i];
			const left = `${(x(i) / width) * 100}%`;
			const top = `${(y(p.v) / height) * 100}%`;
			cursor.setCssStyles({ left });
			dot.setCssStyles({ left, top });
			const price = formatPrice(p.v, quote?.type, quote?.currency);
			const from = series.baseline ?? pts[0].v;
			const pct = from ? ((p.v - from) / from) * 100 : null;
			readout.setText(`${price} · ${formatPct(pct)} · ${formatStamp(p.t, range)}`);
			readout.toggleClass("is-right", frac > 0.5);
			box.addClass("is-tracking");
		});
		box.addEventListener("pointerleave", hide);
		box.addEventListener("pointercancel", hide);
	}
	return box;
}

/** A small chart in a row or a tile; nothing without a series. */
function sparkline(parent: HTMLElement, row: Row, r: Resolved): void {
	if (!r.showSparkline) return;
	const series = cachedSeries(row.targets, r.range);
	if (!series || series.points.length < 2) return;
	drawChart(parent, series, { cls: "hearth-market-spark", baseline: r.range === "1d" });
}

/** The range switcher: one chip per span, the current one filled. */
export function rangeChips(parent: HTMLElement, current: MarketRange, onPick: (range: MarketRange) => void): void {
	const row = parent.createDiv("hearth-market-ranges");
	for (const range of MARKET_RANGES) {
		const chip = row.createEl("button", {
			cls: "hearth-market-range",
			text: rangeLabel(range),
			attr: { type: "button", "aria-pressed": String(range === current) },
		});
		chip.toggleClass("is-active", range === current);
		chip.addEventListener("click", (e) => {
			// The card behind opens the detail dialog on a click; not this one.
			e.stopPropagation();
			onPick(range);
		});
	}
}

/** A low–high track with a marker where the price sits. */
function rangeBar(parent: HTMLElement, label: string, low: number | null, high: number | null, quote: MarketQuote): void {
	const pos = rangePosition(quote.price, low, high);
	if (pos === null) return;
	const el = parent.createDiv("hearth-market-rangebar");
	el.createDiv({ cls: "hearth-market-rangebar-label", text: label });
	const line = el.createDiv("hearth-market-rangebar-line");
	line.createSpan({ cls: "hearth-market-rangebar-end", text: formatPrice(low, quote.type, quote.currency) });
	const track = line.createDiv("hearth-market-rangebar-track");
	track.createDiv("hearth-market-rangebar-fill").setCssStyles({ width: `${pos * 100}%` });
	track.createDiv("hearth-market-rangebar-mark").setCssStyles({ left: `${pos * 100}%` });
	line.createSpan({ cls: "hearth-market-rangebar-end", text: formatPrice(high, quote.type, quote.currency) });
}

/** Label/value facts: the spotlight's stats and the dialog's. */
function facts(parent: HTMLElement, items: { label: string; value: string }[], cls = "hearth-market-facts"): void {
	const shown = items.filter((f) => f.value && f.value !== "—");
	if (!shown.length) return;
	const grid = parent.createDiv(cls);
	for (const f of shown) {
		const cell = grid.createDiv("hearth-market-fact");
		cell.createDiv({ cls: "hearth-market-fact-label", text: f.label });
		cell.createDiv({ cls: "hearth-market-fact-value", text: f.value });
	}
}

function quoteFacts(quote: MarketQuote): { label: string; value: string }[] {
	const s = t().cards.market;
	const p = (v: number | null): string => (v === null ? "—" : formatPrice(v, quote.type, quote.currency));
	return [
		{ label: s.open, value: p(quote.open) },
		{ label: s.prevClose, value: p(quote.prevClose) },
		{ label: s.volume, value: formatCompact(quote.volume) },
	];
}


// ---- Styles -------------------------------------------------------------

/** What every paint function is handed. */
interface PaintContext {
	rows: Row[];
	r: Resolved;
	loading: boolean;
	/** Open the dialog for a row. */
	open: (row: Row) => void;
	/** The spotlight's and chart's own range, which their chips change. */
	range: MarketRange;
	setRange: (range: MarketRange) => void;
	/** The spotlight's current instrument, which its switcher changes. */
	selected: number;
	setSelected: (index: number) => void;
	cfg: MarketConfig;
}

/** Make an element open a row's dialog. */
function opens(el: HTMLElement, row: Row, ctx: PaintContext, label: string): void {
	el.addClass("is-clickable");
	el.addEventListener("click", () => ctx.open(row));
	makeClickable(el, () => ctx.open(row), label);
}

/** Minimal: the price and its move. */
function paintMinimal(wrap: HTMLElement, ctx: PaintContext): void {
	const row = ctx.rows[Math.min(ctx.selected, ctx.rows.length - 1)];
	const quote = cachedQuote(row.targets);
	const box = wrap.createDiv("hearth-market-hero");
	opens(box, row, ctx, rowName(row, quote));
	if (ctx.r.expressive && quote) trendBadge(box, quote.change ?? quote.changePct);
	const { title } = identity(row, quote, ctx.r);
	box.createDiv({ cls: "hearth-market-title", text: title });
	if (!quote) {
		missingQuote(box, ctx.loading);
		return;
	}
	priceLine(box, quote, "hearth-market-price hearth-market-price-hero");
	changeLine(box, quote, ctx.r);
	stateChip(box, quote, ctx.r);
	if (ctx.r.showUpdated) box.createDiv({ cls: "hearth-market-updated", text: updatedText(quote.fetched) });
}

/** The switcher over a spotlight with more than one instrument. */
function switcher(wrap: HTMLElement, ctx: PaintContext): void {
	if (ctx.rows.length < 2) return;
	const bar = wrap.createDiv("hearth-market-switcher");
	ctx.rows.forEach((row, i) => {
		const quote = cachedQuote(row.targets);
		const chip = bar.createEl("button", {
			cls: `hearth-market-switch ${dirClass(quote?.changePct ?? null)}`,
			text: rowSymbol(row),
			attr: { type: "button", "aria-pressed": String(i === ctx.selected) },
		});
		chip.toggleClass("is-active", i === ctx.selected);
		chip.addEventListener("click", (e) => {
			e.stopPropagation();
			ctx.setSelected(i);
		});
	});
}

/** Spotlight: name, price, move, a chart with a range switcher, stats. */
function paintSpotlight(wrap: HTMLElement, ctx: PaintContext): void {
	switcher(wrap, ctx);
	const row = ctx.rows[Math.min(ctx.selected, ctx.rows.length - 1)];
	const quote = cachedQuote(row.targets);
	spotlightBody(wrap, row, quote, ctx);
}

/** The spotlight's body, shared with the lookup's picked result. */
function spotlightBody(wrap: HTMLElement, row: Row, quote: MarketQuote | null, ctx: PaintContext): void {
	const r = ctx.r;
	const head = wrap.createDiv("hearth-market-head");
	opens(head, row, ctx, rowName(row, quote));
	if (r.expressive && quote) trendBadge(head, quote.change ?? quote.changePct);
	const text = head.createDiv("hearth-market-headtext");
	const { title, sub } = identity(row, quote, r);
	text.createDiv({ cls: "hearth-market-title", text: title });
	const subLine = [sub, quote ? typeLabel(quote.type) : ""].filter(Boolean).join(" · ");
	if (subLine) text.createDiv({ cls: "hearth-market-sub", text: subLine });
	if (quote) stateChip(head, quote, r);

	if (!quote) {
		missingQuote(wrap, ctx.loading);
		return;
	}
	const numbers = wrap.createDiv("hearth-market-numbers");
	priceLine(numbers, quote, "hearth-market-price hearth-market-price-big");
	changeLine(numbers, quote, r);

	const series = cachedSeries(row.targets, ctx.range);
	if (series && series.points.length > 1) {
		drawChart(wrap, series, {
			cls: "hearth-market-chart-main",
			baseline: ctx.range === "1d",
			interactive: { range: ctx.range, quote },
		});
	} else {
		wrap.createDiv({
			cls: "hearth-market-chart-main hearth-market-chart-empty",
			text: ctx.loading ? t().cards.market.loadingShort : t().cards.market.noChart,
		});
	}
	rangeChips(wrap, ctx.range, ctx.setRange);

	if (r.showStats) {
		const stats = wrap.createDiv("hearth-market-stats");
		rangeBar(stats, t().cards.market.dayRange, quote.dayLow, quote.dayHigh, quote);
		rangeBar(stats, t().cards.market.yearRange, quote.yearLow, quote.yearHigh, quote);
		facts(stats, quoteFacts(quote));
	}
	if (r.showUpdated) wrap.createDiv({ cls: "hearth-market-updated", text: updatedText(quote.fetched) });
}

/** Chart: the chart edge to edge, the price over it. */
function paintChart(wrap: HTMLElement, ctx: PaintContext): void {
	const row = ctx.rows[Math.min(ctx.selected, ctx.rows.length - 1)];
	const quote = cachedQuote(row.targets);
	const series = cachedSeries(row.targets, ctx.range);
	if (series && series.points.length > 1) {
		drawChart(wrap, series, {
			cls: "hearth-market-chart-full",
			baseline: ctx.range === "1d",
			interactive: { range: ctx.range, quote },
		});
	}
	const over = wrap.createDiv("hearth-market-over");
	opens(over, row, ctx, rowName(row, quote));
	over.createDiv({ cls: "hearth-market-title", text: identity(row, quote, ctx.r).title });
	if (!quote) {
		missingQuote(over, ctx.loading);
	} else {
		priceLine(over, quote, "hearth-market-price hearth-market-price-big");
		changeLine(over, quote, ctx.r);
	}
	const foot = wrap.createDiv("hearth-market-foot");
	rangeChips(foot, ctx.range, ctx.setRange);
}

/** One watchlist row. */
function listRow(parent: HTMLElement, row: Row, ctx: PaintContext): void {
	const quote = cachedQuote(row.targets);
	const el = parent.createDiv(`hearth-market-row ${dirClass(quote?.changePct ?? null)}`);
	opens(el, row, ctx, rowName(row, quote));
	const id = el.createDiv("hearth-market-id");
	const { title, sub } = identity(row, quote, ctx.r);
	id.createDiv({ cls: "hearth-market-title", text: title });
	if (sub) id.createDiv({ cls: "hearth-market-sub", text: sub });
	sparkline(el, row, ctx.r);
	const right = el.createDiv("hearth-market-quote");
	if (!quote) {
		missingQuote(right, ctx.loading);
		return;
	}
	priceLine(right, quote);
	changeLine(right, quote, ctx.r);
}

/** List: a watchlist, one row each. */
function paintList(wrap: HTMLElement, ctx: PaintContext): void {
	const list = wrap.createDiv("hearth-market-list");
	for (const row of ctx.rows) listRow(list, row, ctx);
}

/** Tiles: a grid of them. */
function paintTiles(wrap: HTMLElement, ctx: PaintContext): void {
	const grid = wrap.createDiv("hearth-market-tiles");
	for (const row of ctx.rows) {
		const quote = cachedQuote(row.targets);
		const tile = grid.createDiv(`hearth-market-tile ${dirClass(quote?.changePct ?? null)}`);
		opens(tile, row, ctx, rowName(row, quote));
		const { title } = identity(row, quote, ctx.r);
		tile.createDiv({ cls: "hearth-market-title", text: title });
		if (ctx.r.showName && title !== rowSymbol(row)) {
			tile.createDiv({ cls: "hearth-market-sub", text: rowSymbol(row) });
		}
		if (!quote) {
			missingQuote(tile, ctx.loading);
			continue;
		}
		priceLine(tile, quote);
		changeLine(tile, quote, ctx.r);
		sparkline(tile, row, ctx.r);
	}
}

/** Ticker: a tape that scrolls, or sits still and scrolls by hand when motion
 * is off. The items are drawn twice so the loop has no seam. */
function paintTicker(wrap: HTMLElement, ctx: PaintContext): void {
	const tape = wrap.createDiv("hearth-market-tape");
	tape.toggleClass("is-moving", ctx.r.animate && ctx.rows.length > 0);
	const track = tape.createDiv("hearth-market-tape-track");
	track.setCssProps({ "--hearth-tape-duration": `${Math.max(18, ctx.rows.length * 6)}s` });
	const copies = ctx.r.animate ? 2 : 1;
	for (let copy = 0; copy < copies; copy++) {
		const run = track.createDiv("hearth-market-tape-run");
		if (copy > 0) run.setAttribute("aria-hidden", "true");
		for (const row of ctx.rows) {
			const quote = cachedQuote(row.targets);
			const item = run.createDiv(`hearth-market-tape-item ${dirClass(quote?.changePct ?? null)}`);
			if (copy === 0) opens(item, row, ctx, rowName(row, quote));
			else item.addEventListener("click", () => ctx.open(row));
			item.createSpan({ cls: "hearth-market-title", text: identity(row, quote, ctx.r).title });
			if (!quote) {
				item.createSpan({ cls: "hearth-market-missing", text: "—" });
				continue;
			}
			item.createSpan({
				cls: "hearth-market-price",
				text: formatPrice(quote.price, quote.type, quote.currency),
			});
			const change = item.createSpan(`hearth-market-change ${dirClass(quote.changePct)}`);
			setIcon(change.createSpan("hearth-market-change-icon"), trendIcon(quote.changePct));
			change.createSpan({ text: formatMove(quote, ctx.r.change) });
		}
	}
}

/** The categorical colours the allocation bar cycles through (Obsidian's own
 * palette, so it follows the theme). */
const ALLOCATION_VARS = ["blue", "purple", "cyan", "orange", "pink", "yellow", "green", "red"];

/** Portfolio: holdings valued in one currency. */
function paintPortfolio(wrap: HTMLElement, ctx: PaintContext): void {
	const s = t().cards.market;
	const held = ctx.rows
		.map((row) => ({ row, quote: cachedQuote(row.targets), quantity: row.item.quantity ?? 0 }))
		.filter((h) => h.quantity > 0);
	const priced = held.filter((h): h is typeof h & { quote: MarketQuote } => h.quote !== null);
	const base = (
		ctx.cfg.baseCurrency ?? dominantCurrency(priced.map((h) => h.quote.currency), "USD")
	).toUpperCase();
	const totals = portfolioTotals(
		priced.map((h) => ({ quote: h.quote, quantity: h.quantity, cost: h.row.item.cost })),
		base,
		cachedRates(),
	);

	const summary = wrap.createDiv("hearth-market-summary");
	summary.createDiv({ cls: "hearth-market-summary-label", text: s.totalValue });
	if (!priced.length) {
		summary.createDiv({
			cls: "hearth-market-summary-value",
			text: held.length && ctx.loading ? s.loadingShort : "—",
		});
		if (!held.length) summary.createDiv({ cls: "hearth-market-sub", text: s.noHoldings });
	} else {
		summary.createDiv({ cls: "hearth-market-summary-value", text: formatMoney(totals.value, base) });
		const chips = summary.createDiv("hearth-market-summary-chips");
		const chip = (label: string, value: number | null, pct: number | null): void => {
			if (value === null) return;
			const el = chips.createDiv(`hearth-market-summary-chip ${dirClass(value)}`);
			el.createSpan({ cls: "hearth-market-summary-chip-label", text: label });
			el.createSpan({ text: `${formatSigned(value)} (${formatPct(pct)})` });
		};
		chip(s.today, totals.day, totals.dayPct);
		chip(s.totalGain, totals.gain, totals.gainPct);
		if (totals.missing) {
			summary.createDiv({ cls: "hearth-market-note", text: s.notConverted(totals.missing) });
		}

		// Allocation: each holding's share of the converted total.
		if (totals.value > 0 && totals.values.filter((v) => v !== null && v > 0).length > 1) {
			const bar = wrap.createDiv("hearth-market-alloc");
			priced.forEach((h, i) => {
				const v = totals.values[i];
				if (v === null || v <= 0) return;
				const seg = bar.createDiv("hearth-market-alloc-seg");
				seg.setCssProps({
					"--seg-share": `${(v / totals.value) * 100}%`,
					"--seg-color": `var(--color-${ALLOCATION_VARS[i % ALLOCATION_VARS.length]})`,
				});
				seg.setAttribute("aria-label", `${rowName(h.row, h.quote)} ${((v / totals.value) * 100).toFixed(1)}%`);
			});
		}
	}

	const list = wrap.createDiv("hearth-market-list hearth-market-holdings");
	const heldIndex = new Map(priced.map((h, i) => [h.row.index, i]));
	for (const row of ctx.rows) {
		const quote = cachedQuote(row.targets);
		const quantity = row.item.quantity ?? 0;
		if (!quantity) {
			listRow(list, row, ctx);
			continue;
		}
		const el = list.createDiv(`hearth-market-row ${dirClass(quote?.changePct ?? null)}`);
		opens(el, row, ctx, rowName(row, quote));
		const i = heldIndex.get(row.index);
		if (i !== undefined) {
			el.createDiv("hearth-market-swatch").setCssProps({
				"--seg-color": `var(--color-${ALLOCATION_VARS[i % ALLOCATION_VARS.length]})`,
			});
		}
		const id = el.createDiv("hearth-market-id");
		id.createDiv({ cls: "hearth-market-title", text: identity(row, quote, ctx.r).title });
		const right = el.createDiv("hearth-market-quote");
		if (!quote) {
			id.createDiv({ cls: "hearth-market-sub", text: s.units(quantity) });
			missingQuote(right, ctx.loading);
			continue;
		}
		id.createDiv({
			cls: "hearth-market-sub",
			text: `${quantity.toLocaleString()} × ${formatPrice(quote.price, quote.type, quote.currency)}`,
		});
		const v = holdingValue(quote, quantity, row.item.cost);
		right.createDiv({ cls: "hearth-market-price", text: formatMoney(v.value, quote.currency) });
		const line = right.createDiv(`hearth-market-change ${dirClass(v.gain ?? v.day)}`);
		line.setText(
			v.gain !== null ? `${formatSigned(v.gain)} (${formatPct(v.gainPct)})` : formatPct(quote.changePct),
		);
	}
}

/** Draw a style. The lookup is drawn by its own code (see `renderLookup`). */
function paintStyle(wrap: HTMLElement, ctx: PaintContext): void {
	switch (ctx.r.style) {
		case "minimal":
			paintMinimal(wrap, ctx);
			break;
		case "spotlight":
			paintSpotlight(wrap, ctx);
			break;
		case "chart":
			paintChart(wrap, ctx);
			break;
		case "tiles":
			paintTiles(wrap, ctx);
			break;
		case "ticker":
			paintTicker(wrap, ctx);
			break;
		case "portfolio":
			paintPortfolio(wrap, ctx);
			break;
		case "list":
		default:
			paintList(wrap, ctx);
			break;
	}
}


// ---- Render -------------------------------------------------------------

/** Run loads a few at a time: a board of twenty charts shouldn't open twenty
 * connections at once. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
	for (let i = 0; i < items.length; i += size) {
		await Promise.all(items.slice(i, i + size).map(fn));
	}
}

export function renderMarket(view: HomeView, card: DashboardCard, body: HTMLElement, component: Component): void {
	const cfg = card.market ?? {};
	const r = resolveMarket(
		cfg,
		!motionAllowed(view.plugin.settings),
		detectLanguage(),
		effectiveCardDesign(view.plugin.settings, undefined),
	);
	const rows = rowsFor(cfg);
	if (!rows.length && r.style !== "lookup") {
		emptyState(body, "trending-up", t().cards.empty.marketNoSymbols);
		return;
	}

	const disabled = view.plugin.settings.disableExternalCalls;
	const ttlMs = Math.max(r.refreshMin, 1) * 60_000;
	body.addClass("hearth-market-host");
	if (r.style === "chart") body.addClass("hearth-market-flush");

	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});
	let loading = false;
	let range = r.range;
	let selected = 0;

	const wrap = body.createDiv(`hearth-market is-${r.style}`);
	wrap.toggleClass("is-expressive", r.expressive);
	wrap.toggleClass("is-red-up", r.redUp);

	const openRow = (row: Row): void => {
		const modal = new MarketDetailModal(view.app, {
			row,
			r,
			disabled,
			ttlMs,
			onRefresh: () => {
				if (!destroyed) paint();
			},
		});
		dressModal(modal, r.expressive).open();
	};

	/** The rows whose charts this style draws, and over which range. */
	const chartsWanted = (): { rows: Row[]; range: MarketRange } => {
		if (isSingleStyle(r.style)) {
			const row = rows[Math.min(selected, rows.length - 1)];
			return { rows: r.style === "minimal" || !row ? [] : [row], range };
		}
		if ((r.style === "list" || r.style === "tiles" || r.style === "lookup") && r.showSparkline) {
			return { rows, range: r.range };
		}
		return { rows: [], range: r.range };
	};

	const paint = (): void => {
		wrap.empty();
		if (disabled && rows.every((row) => !cachedQuote(row.targets))) {
			emptyState(wrap, "wifi-off", t().cards.market.disabled);
			return;
		}
		paintStyle(wrap, {
			rows,
			r,
			loading,
			open: openRow,
			range,
			setRange: (next) => {
				range = next;
				void loadCharts(false).then(() => {
					if (!destroyed) paint();
				});
				paint();
			},
			selected,
			setSelected: (next) => {
				selected = next;
				void loadCharts(false).then(() => {
					if (!destroyed) paint();
				});
				paint();
			},
			cfg,
		});
	};

	const loadCharts = async (force: boolean): Promise<void> => {
		const want = chartsWanted();
		await inBatches(want.rows, 4, (row) => loadSeries(row.targets, want.range, { ttlMs, disabled, force }));
	};

	const load = (force: boolean): void => {
		loading = rows.some((row) => !cachedQuote(row.targets));
		paint();
		void (async () => {
			await loadQuotes(rows.map((row) => row.targets), { ttlMs, disabled, force });
			if (destroyed) return;
			loading = false;
			paint();
			if (r.style === "portfolio") await loadRates(disabled);
			await loadCharts(force);
			if (!destroyed) paint();
		})();
	};

	if (r.style === "lookup") {
		renderLookup(view, card, wrap, component, { r, disabled, ttlMs, rows, open: openRow });
		return;
	}

	load(false);

	const autoRefreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, r.refreshMin);
	if (autoRefreshMin > 0) {
		component.registerInterval(window.setInterval(() => load(true), autoRefreshMin * 60_000));
	}
}


// ---- Lookup -------------------------------------------------------------
//
// A search field on the card over its watchlist. The field is built once and
// survives every repaint (only the area under it is redrawn), so typing never
// loses focus to a quote arriving.

interface LookupOptions {
	r: Resolved;
	disabled: boolean;
	ttlMs: number;
	rows: Row[];
	open: (row: Row) => void;
}

function renderLookup(
	view: HomeView,
	card: DashboardCard,
	wrap: HTMLElement,
	component: Component,
	opts: LookupOptions,
): void {
	const s = t().cards.market;
	const { r, disabled, ttlMs } = opts;
	let rows = opts.rows;
	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});

	let results: MarketSearchResult[] = [];
	let searched = false;
	let searching = false;
	let picked: Row | null = null;
	let range = r.range;
	let version = 0;
	let loading = false;

	const bar = wrap.createDiv("hearth-market-searchbar");
	setIcon(bar.createSpan("hearth-market-search-icon"), "search");
	const input = bar.createEl("input", {
		cls: "hearth-market-search-input",
		attr: {
			type: "search",
			placeholder: disabled ? s.searchDisabled : s.searchPlaceholder,
			"aria-label": s.searchPlaceholder,
			spellcheck: "false",
			autocomplete: "off",
		},
	});
	input.disabled = disabled;
	const content = wrap.createDiv("hearth-market-lookup");

	const isOnCard = (target: MarketTarget): boolean =>
		rows.some((row) => row.targets.some((t2) => targetKey(t2) === targetKey(target)));

	const addToCard = (result: MarketSearchResult | Row): void => {
		const target = "target" in result ? result.target : result.targets[0];
		const name = "target" in result ? result.name : result.item.name;
		const cfg = (card.market ??= {});
		const items = (cfg.items ??= []);
		items.push({ symbol: target.symbol, provider: target.provider, name: name || undefined });
		void view.plugin.saveData(view.plugin.settings);
		rows = rowsFor(cfg);
		new Notice(s.added(name || displaySymbol(target)));
		picked = null;
		results = [];
		searched = false;
		input.value = "";
		paint();
		void refresh(false);
	};

	const pick = (result: MarketSearchResult): void => {
		picked = {
			item: { symbol: result.target.symbol, provider: result.target.provider, name: result.name },
			targets: resolveSymbol(result.target.symbol, result.target.provider),
			index: -1,
		};
		loading = true;
		paint();
		const row = picked;
		void (async () => {
			await loadQuotes([row.targets], { ttlMs, disabled });
			loading = false;
			if (destroyed || picked !== row) return;
			paint();
			await loadSeries(row.targets, range, { ttlMs, disabled });
			if (!destroyed && picked === row) paint();
		})();
	};

	const paint = (): void => {
		content.empty();
		if (picked) {
			const row = picked;
			const top = content.createDiv("hearth-market-lookup-top");
			const back = top.createEl("button", {
				cls: "hearth-market-icon-button",
				attr: { type: "button", "aria-label": s.back },
			});
			setIcon(back, "arrow-left");
			back.addEventListener("click", () => {
				picked = null;
				paint();
			});
			const onCard = isOnCard(row.targets[0]);
			const add = top.createEl("button", {
				cls: "hearth-market-add mod-cta",
				text: onCard ? s.onCard : s.addToCard,
				attr: { type: "button" },
			});
			add.disabled = onCard;
			add.addEventListener("click", () => addToCard(row));
			const quote = cachedQuote(row.targets);
			spotlightBody(content, row, quote, {
				rows: [row],
				r,
				loading,
				open: opts.open,
				range,
				setRange: (next) => {
					range = next;
					paint();
					void loadSeries(row.targets, range, { ttlMs, disabled }).then(() => {
						if (!destroyed && picked === row) paint();
					});
				},
				selected: 0,
				setSelected: () => undefined,
				cfg: card.market ?? {},
			});
			return;
		}
		if (searching) {
			content.createDiv({ cls: "hearth-market-hint", text: s.searching });
			return;
		}
		if (searched) {
			if (!results.length) {
				content.createDiv({ cls: "hearth-market-hint", text: s.noResults });
				return;
			}
			const list = content.createDiv("hearth-market-results");
			for (const result of results) {
				const el = list.createDiv("hearth-market-result");
				makeClickable(el, () => pick(result), result.name);
				el.addEventListener("click", () => pick(result));
				const id = el.createDiv("hearth-market-id");
				id.createDiv({ cls: "hearth-market-title", text: result.name });
				id.createDiv({
					cls: "hearth-market-sub",
					text: [result.display, result.exchange].filter(Boolean).join(" · "),
				});
				const tag = typeLabel(result.type);
				if (tag) el.createDiv({ cls: "hearth-market-tag", text: tag });
				if (!isOnCard(result.target)) {
					const add = el.createEl("button", {
						cls: "hearth-market-icon-button",
						attr: { type: "button", "aria-label": s.addToCard },
					});
					setIcon(add, "plus");
					add.addEventListener("click", (e) => {
						e.stopPropagation();
						addToCard(result);
					});
				}
			}
			return;
		}
		if (!rows.length) {
			content.createDiv({ cls: "hearth-market-hint", text: s.lookupHint });
			return;
		}
		paintList(content, {
			rows,
			r,
			loading,
			open: opts.open,
			range,
			setRange: () => undefined,
			selected: 0,
			setSelected: () => undefined,
			cfg: card.market ?? {},
		});
	};

	const refresh = async (force: boolean): Promise<void> => {
		loading = rows.some((row) => !cachedQuote(row.targets));
		await loadQuotes(rows.map((row) => row.targets), { ttlMs, disabled, force });
		loading = false;
		if (destroyed) return;
		paint();
		if (r.showSparkline) {
			await inBatches(rows, 4, (row) => loadSeries(row.targets, r.range, { ttlMs, disabled, force }));
			if (!destroyed) paint();
		}
	};

	const runSearch = async (): Promise<void> => {
		const query = input.value.trim();
		const mine = ++version;
		if (!query) {
			searched = false;
			searching = false;
			results = [];
			paint();
			return;
		}
		searching = true;
		picked = null;
		paint();
		const found = await searchMarkets(query, { disabled });
		if (destroyed || mine !== version) return;
		results = found;
		searching = false;
		searched = true;
		paint();
	};

	let timer = 0;
	input.addEventListener("input", () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => void runSearch(), 400);
	});
	input.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			window.clearTimeout(timer);
			if (searched && results.length && !searching) pick(results[0]);
			else void runSearch();
		} else if (e.key === "Escape" && (input.value || picked)) {
			e.preventDefault();
			e.stopPropagation();
			input.value = "";
			void runSearch();
		}
	});
	component.register(() => window.clearTimeout(timer));

	paint();
	void refresh(false);
	const autoRefreshMin = effectiveAutoRefreshMinutes(view.plugin.settings, r.refreshMin);
	if (autoRefreshMin > 0) {
		component.registerInterval(window.setInterval(() => void refresh(true), autoRefreshMin * 60_000));
	}
}


// ---- The detail dialog --------------------------------------------------

interface DetailOptions {
	row: Row;
	r: Resolved;
	disabled: boolean;
	ttlMs: number;
	/** Tell the card a refresh inside the dialog brought new data. */
	onRefresh: () => void;
}

/**
 * Everything about one instrument: the price and its move, a chart over any
 * range with a crosshair, the day's and the year's range, the stats — and the
 * position, when the card holds some.
 */
export class MarketDetailModal extends HearthModal {
	private range: MarketRange;
	private host!: HTMLElement;
	private closed = false;

	constructor(app: App, private readonly opts: DetailOptions) {
		super(app);
		this.range = opts.r.style === "spotlight" || opts.r.style === "chart" ? opts.r.range : "1d";
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-market-modal");
		this.host = this.contentEl.createDiv("hearth-market-detail hearth-market");
		this.host.toggleClass("is-expressive", this.opts.r.expressive);
		this.host.toggleClass("is-red-up", this.opts.r.redUp);
		this.draw();
		void this.loadChart(false);
	}

	onClose(): void {
		this.closed = true;
		this.contentEl.empty();
	}

	private async loadChart(force: boolean): Promise<void> {
		const { row, ttlMs, disabled } = this.opts;
		await loadSeries(row.targets, this.range, { ttlMs, disabled, force });
		if (!this.closed) this.draw();
	}

	private draw(): void {
		const { row, r } = this.opts;
		const s = t().cards.market;
		const quote = cachedQuote(row.targets);
		this.titleEl.setText(rowName(row, quote));
		this.host.empty();

		const sub = [rowSymbol(row), quote?.exchange, quote ? typeLabel(quote.type) : ""].filter(Boolean).join(" · ");
		const head = this.host.createDiv("hearth-market-detail-head");
		head.createDiv({ cls: "hearth-market-sub", text: sub });
		if (!quote) {
			missingQuote(this.host, false);
			return;
		}
		const numbers = this.host.createDiv("hearth-market-numbers");
		priceLine(numbers, quote, "hearth-market-price hearth-market-price-big");
		changeLine(numbers, quote, { ...r, change: "both" });
		stateChip(numbers, quote, { ...r, showState: true });

		const series = cachedSeries(row.targets, this.range);
		if (series && series.points.length > 1) {
			drawChart(this.host, series, {
				cls: "hearth-market-chart-detail",
				baseline: this.range === "1d",
				interactive: { range: this.range, quote },
			});
		} else {
			this.host.createDiv({ cls: "hearth-market-chart-detail hearth-market-chart-empty", text: s.noChart });
		}
		rangeChips(this.host, this.range, (next) => {
			this.range = next;
			this.draw();
			void this.loadChart(false);
		});

		const stats = this.host.createDiv("hearth-market-stats");
		rangeBar(stats, s.dayRange, quote.dayLow, quote.dayHigh, quote);
		rangeBar(stats, s.yearRange, quote.yearLow, quote.yearHigh, quote);
		facts(stats, [
			...quoteFacts(quote),
			{ label: s.currency, value: quote.currency },
			{ label: s.source, value: s.sources[quote.target.provider] },
			{ label: s.asOf, value: new Date(quote.time).toLocaleString() },
		]);

		const quantity = row.item.quantity ?? 0;
		if (quantity > 0) {
			const v = holdingValue(quote, quantity, row.item.cost);
			this.host.createDiv({ cls: "hearth-market-detail-heading", text: s.position });
			facts(this.host, [
				{ label: s.unitsLabel, value: quantity.toLocaleString() },
				{ label: s.value, value: formatMoney(v.value, quote.currency) },
				{
					label: s.avgCost,
					value: row.item.cost === undefined ? "—" : formatPrice(row.item.cost, quote.type, quote.currency),
				},
				{ label: s.costBasis, value: v.costBasis === null ? "—" : formatMoney(v.costBasis, quote.currency) },
				{ label: s.today, value: v.day === null ? "—" : formatSigned(v.day) },
				{
					label: s.totalGain,
					value: v.gain === null ? "—" : `${formatSigned(v.gain)} (${formatPct(v.gainPct)})`,
				},
			]);
		}

		const actions = this.host.createDiv("hearth-market-detail-actions");
		const web = actions.createEl("button", { text: s.openInBrowser, attr: { type: "button" } });
		web.addEventListener("click", () => window.open(quotePageUrl(quote.target), "_blank"));
		if (!this.opts.disabled) {
			const refresh = actions.createEl("button", { cls: "mod-cta", text: s.refresh, attr: { type: "button" } });
			refresh.addEventListener("click", () => {
				refresh.disabled = true;
				void (async () => {
					await loadQuotes([row.targets], { ttlMs: this.opts.ttlMs, force: true });
					await this.loadChart(true);
					this.opts.onRefresh();
				})();
			});
		}
	}
}


// ---- Editor -------------------------------------------------------------

const QUERY = "marketQuery";
const RESULTS = "marketResults";
const SEARCHED = "marketSearched";
const VERSION = "marketSearchVersion";

/** Move an item within the list. Kept here rather than borrowed from
 * editors.ts: that module imports the card registry, and a card module that
 * imports it back can't be loaded on its own (see cards/README.md). */
function moveItem(ctx: CardEditorContext, items: MarketItem[], from: number, to: number): void {
	if (to < 0 || to >= items.length) return;
	const [item] = items.splice(from, 1);
	items.splice(to, 0, item);
	ctx.opts.save();
	ctx.requestRender();
}

/** Where an item comes from, for the editor's list. */
function sourceLabel(item: MarketItem): string {
	const targets = resolveSymbol(item.symbol, item.provider);
	const first = targets[0];
	return first ? t().cards.market.sources[first.provider] : "";
}

function parseNumber(raw: string): number | undefined {
	const n = Number(raw.trim().replace(",", "."));
	return raw.trim() === "" || !Number.isFinite(n) ? undefined : n;
}

function itemsSection(ctx: CardEditorContext, containerEl: HTMLElement, cfg: MarketConfig): void {
	const strings = t().editors.market;
	const items = (cfg.items ??= []);
	const portfolio = cfg.style === "portfolio";
	new Setting(containerEl).setName(strings.symbols).setDesc(strings.symbolsDesc).setHeading();

	if (!items.length) {
		containerEl.createDiv({ cls: "setting-item-description hearth-market-editor-empty", text: strings.noSymbols });
	}
	items.forEach((item, i) => {
		const row = new Setting(containerEl)
			.setName(item.name?.trim() || item.symbol)
			.setDesc([item.symbol, sourceLabel(item)].filter(Boolean).join(" · "))
			.setClass("hearth-market-editor-item");
		row.addExtraButton((b) =>
			b.setIcon("arrow-up").setTooltip(strings.moveUp).setDisabled(i === 0).onClick(() => {
				moveItem(ctx, items, i, i - 1);
				ctx.opts.rerender();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("arrow-down")
				.setTooltip(strings.moveDown)
				.setDisabled(i === items.length - 1)
				.onClick(() => {
					moveItem(ctx, items, i, i + 1);
					ctx.opts.rerender();
				}),
		);
		row.addExtraButton((b) =>
			b.setIcon("trash-2").setTooltip(strings.remove).onClick(() => {
				items.splice(i, 1);
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
		);
		if (portfolio) {
			const holding = new Setting(containerEl).setName(strings.holding).setClass("hearth-market-editor-holding");
			holding.addText((txt) => {
				txt
					.setPlaceholder(strings.quantity)
					.setValue(item.quantity === undefined ? "" : String(item.quantity))
					.onChange((v) => {
						item.quantity = parseNumber(v);
						ctx.opts.save();
						ctx.opts.rerender();
					});
				txt.inputEl.setAttribute("inputmode", "decimal");
				txt.inputEl.setAttribute("aria-label", strings.quantity);
			});
			holding.addText((txt) => {
				txt
					.setPlaceholder(strings.cost)
					.setValue(item.cost === undefined ? "" : String(item.cost))
					.onChange((v) => {
						item.cost = parseNumber(v);
						ctx.opts.save();
						ctx.opts.rerender();
					});
				txt.inputEl.setAttribute("inputmode", "decimal");
				txt.inputEl.setAttribute("aria-label", strings.cost);
			});
		}
	});

	// ---- Search ----
	const disabled = ctx.opts.externalCallsDisabled;
	const search = new Setting(containerEl)
		.setName(strings.search)
		.setDesc(disabled ? strings.searchDisabled : strings.searchDesc)
		.setClass("hearth-market-editor-search");
	search.addText((txt) => {
		txt
			.setPlaceholder(strings.searchPlaceholder)
			.setValue((ctx.session[QUERY] as string) ?? "")
			.onChange((v) => {
				ctx.session[QUERY] = v;
			});
		txt.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void run();
			}
		});
	});
	const run = async (): Promise<void> => {
		const query = ((ctx.session[QUERY] as string) ?? "").trim();
		if (!query) {
			new Notice(strings.searchEmpty);
			return;
		}
		const version = ((ctx.session[VERSION] as number) ?? 0) + 1;
		ctx.session[VERSION] = version;
		const results = await searchMarkets(query, { disabled });
		if (version !== ctx.session[VERSION] || !search.settingEl.isConnected) return;
		ctx.session[RESULTS] = results;
		ctx.session[SEARCHED] = true;
		ctx.requestRender();
	};
	search.addButton((b) =>
		b
			.setButtonText(strings.searchButton)
			.setCta()
			.setDisabled(disabled)
			.onClick(() => void run()),
	);
	// Typed symbols need no search: "AAPL", "510300", "EUR/USD", "fund:161725".
	search.addButton((b) =>
		b.setButtonText(strings.addTyped).onClick(() => {
			const query = ((ctx.session[QUERY] as string) ?? "").trim();
			if (!query) {
				new Notice(strings.searchEmpty);
				return;
			}
			if (!resolveSymbol(query).length) return;
			items.push({ symbol: query });
			ctx.session[QUERY] = "";
			ctx.session[RESULTS] = [];
			ctx.session[SEARCHED] = false;
			ctx.opts.save();
			ctx.opts.rerender();
			ctx.requestRender();
		}),
	);

	const results = (ctx.session[RESULTS] as MarketSearchResult[] | undefined) ?? [];
	if (ctx.session[SEARCHED] && !results.length) {
		containerEl.createDiv({ cls: "setting-item-description hearth-market-editor-empty", text: strings.noResults });
	}
	for (const result of results) {
		const already = items.some(
			(item) => resolveSymbol(item.symbol, item.provider).some((tg) => targetKey(tg) === targetKey(result.target)),
		);
		new Setting(containerEl)
			.setName(result.name)
			.setDesc(
				[result.display, result.exchange, t().cards.market.types[result.type], t().cards.market.sources[result.target.provider]]
					.filter(Boolean)
					.join(" · "),
			)
			.setClass("hearth-market-editor-result")
			.addButton((b) =>
				b
					.setButtonText(already ? strings.added : strings.add)
					.setDisabled(already)
					.onClick(() => {
						items.push({ symbol: result.target.symbol, provider: result.target.provider, name: result.name });
						ctx.opts.save();
						ctx.opts.rerender();
						ctx.requestRender();
					}),
			);
	}
}

export function marketEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.market ??= {});
	const strings = t().editors.market;
	const style = cfg.style ?? "list";
	const single = isSingleStyle(style);

	itemsSection(ctx, containerEl, cfg);

	// ---- Appearance ----
	new Setting(containerEl).setName(strings.appearance).setHeading();
	new Setting(containerEl)
		.setName(strings.style)
		.setDesc(strings.styleDesc)
		.addDropdown((d) => {
			const styles: MarketStyle[] = ["minimal", "spotlight", "chart", "list", "tiles", "ticker", "portfolio", "lookup"];
			for (const s of styles) d.addOption(s, strings.styles[s]);
			d.setValue(style).onChange((v) => {
				cfg.style = v === "list" ? undefined : (v as MarketStyle);
				ctx.opts.save();
				ctx.opts.rerender();
				// Which settings apply differs per style.
				ctx.requestRender();
			});
		});
	designSetting(containerEl, {
		name: strings.design,
		desc: strings.designDesc,
		own: cfg.design,
		fallback: effectiveCardDesign(ctx.opts.settings, undefined),
		set: (design) => {
			cfg.design = design;
			ctx.opts.save();
			ctx.opts.rerender();
		},
	});
	new Setting(containerEl)
		.setName(strings.upColor)
		.setDesc(strings.upColorDesc)
		.addDropdown((d) => {
			d.addOption("auto", strings.upColorAuto);
			d.addOption("green", strings.upColorGreen);
			d.addOption("red", strings.upColorRed);
			d.setValue(cfg.upColor ?? "auto").onChange((v) => {
				cfg.upColor = v === "green" || v === "red" ? v : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	if (style !== "ticker" && style !== "portfolio" && style !== "minimal") {
		new Setting(containerEl)
			.setName(strings.range)
			.setDesc(single ? strings.rangeDescSingle : strings.rangeDesc)
			.addDropdown((d) => {
				for (const range of MARKET_RANGES) d.addOption(range, t().cards.market.rangeNames[range]);
				d.setValue(cfg.range ?? "1d").onChange((v) => {
					cfg.range = v === "1d" ? undefined : (v as MarketRange);
					ctx.opts.save();
					ctx.opts.rerender();
				});
			});
	}
	new Setting(containerEl)
		.setName(strings.change)
		.addDropdown((d) => {
			d.addOption("percent", strings.changePercent);
			d.addOption("absolute", strings.changeAbsolute);
			d.addOption("both", strings.changeBoth);
			const fallback = single ? "both" : "percent";
			d.setValue(cfg.change ?? fallback).onChange((v) => {
				const mode = v as NonNullable<MarketConfig["change"]>;
				cfg.change = mode === fallback ? undefined : mode;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	if (style === "portfolio") {
		new Setting(containerEl)
			.setName(strings.baseCurrency)
			.setDesc(strings.baseCurrencyDesc)
			.addDropdown((d) => {
				d.addOption("", strings.baseCurrencyAuto);
				for (const code of [...CURRENCY_CODES].sort()) d.addOption(code, code.toUpperCase());
				d.setValue(cfg.baseCurrency ?? "").onChange((v) => {
					cfg.baseCurrency = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				});
			});
	}
	if (style === "ticker") {
		new Setting(containerEl)
			.setName(strings.animate)
			.setDesc(strings.animateDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.animate !== false).onChange((v) => {
					cfg.animate = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	// ---- What to display ----
	new Setting(containerEl).setName(strings.display).setHeading();
	const toggle = (name: string, get: () => boolean | undefined, set: (v: boolean | undefined) => void, defaultOn: boolean): void => {
		new Setting(containerEl).setName(name).addToggle((tg) =>
			tg.setValue(get() ?? defaultOn).onChange((v) => {
				set(v === defaultOn ? undefined : v);
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
	};
	toggle(strings.showName, () => cfg.showName, (v) => (cfg.showName = v), true);
	if (style === "list" || style === "tiles" || style === "lookup") {
		toggle(strings.showSparkline, () => cfg.showSparkline, (v) => (cfg.showSparkline = v), true);
	}
	if (style === "spotlight" || style === "lookup") {
		toggle(strings.showStats, () => cfg.showStats, (v) => (cfg.showStats = v), true);
	}
	if (style === "minimal" || style === "spotlight" || style === "lookup") {
		toggle(strings.showMarketState, () => cfg.showMarketState, (v) => (cfg.showMarketState = v), true);
		toggle(strings.showUpdated, () => cfg.showUpdated, (v) => (cfg.showUpdated = v), false);
	}

	// ---- Refresh ----
	const refresh = new Setting(containerEl).setName(strings.refresh).setDesc(strings.refreshDesc);
	refresh.addSlider((sl) =>
		sl
			.setLimits(0, 60, 1)
			.setValue(cfg.refreshMin ?? 5)
			.onChange((v) => {
				cfg.refreshMin = v === 5 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
}

/** Deep copy of a market config, so a cloned card shares no items. */
export function cloneMarket(cfg: MarketConfig): MarketConfig {
	return { ...cfg, items: cfg.items?.map((item) => ({ ...item })) };
}

/** Stocks, funds, forex and crypto from free key-less sources. */
export const marketCard: CardDefinition<"market"> = {
	kind: "market",
	ownDesign: (card, fallback) => card.market?.design ?? fallback,
	templates: [
		{
			id: "market",
			name: "Markets",
			icon: "trending-up",
			build: () => ({
				kind: "market",
				title: "Markets",
				market: {
					items: [
						{ symbol: "^GSPC", provider: "yahoo", name: "S&P 500" },
						{ symbol: "EURUSD=X", provider: "yahoo", name: "EUR/USD" },
						{ symbol: "BTC-USD", provider: "yahoo", name: "Bitcoin" },
					],
				},
				w: 4,
				h: 3,
			}),
		},
	],
	render: (view, card, body, component) => renderMarket(view, card, body, component),
	renderEditor: (container, ctx) => marketEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.market) copy.market = cloneMarket(source.market);
	},
	liveness: { mode: "static" },
};
