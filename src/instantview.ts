/**
 * The instant-answer panel at the top of the search results: a sum, a
 * currency conversion with its chart, a market quote, a date or a clock,
 * depending on what the query is (see instant.ts, which decides that).
 *
 * The network is only ever reached for a currency conversion (exchange rates
 * and the pair's chart) or a `$` market lookup, through the same cached feeds
 * the calculator and market cards use — so the search bar never makes a
 * request the cards wouldn't, and **Disable external calls** stops it too.
 */
import { Notice, setIcon } from "obsidian";
import { evaluate } from "./calculator";
import { cachedRates, loadRates } from "./currency";
import { drawChart, rangeChips } from "./cards/market";
import { localDayKey } from "./dates";
import { detectLanguage, t } from "./i18n";
import {
	daysBetween,
	detectInstant,
	formatOffset,
	type InstantIntent,
	instantTakesEnter,
	isoWeek,
	zoneOffsetMinutes,
} from "./instant";
import {
	direction,
	displaySymbol,
	formatMove,
	formatPrice,
	type MarketQuote,
	type MarketSearchResult,
	type MarketSeries,
	type MarketTarget,
	quotePageUrl,
	redUpForLanguage,
	resolveSymbol,
} from "./market";
import { cachedQuote, cachedSeries, loadQuotes, loadSeries, searchMarkets } from "./marketfeed";
import type { MarketRange } from "./types";

/** One keyboard-reachable row the panel adds to the results. */
export interface InstantRow {
	el: HTMLElement;
	open: () => void;
}

/** A quote or a chart stays fresh this long; the market card's default. */
const TTL_MS = 5 * 60_000;
/** Alternative matches listed under a market answer. */
const MAX_ALTERNATIVES = 4;
/** Market searches already answered this session, so retyping a query (or
 * backspacing through it) doesn't ask again. */
const searchCache = new Map<string, MarketSearchResult[]>();
const SEARCH_CACHE_MAX = 50;

let zoneList: readonly string[] | null = null;
/** The runtime's IANA zones, or none where it can't list them (the aliases in
 * instant.ts still work there). */
function zones(): readonly string[] {
	if (zoneList) return zoneList;
	try {
		const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
		zoneList = intl.supportedValuesOf?.("timeZone") ?? [];
	} catch {
		zoneList = [];
	}
	return zoneList;
}

function copy(text: string): void {
	void navigator.clipboard
		.writeText(text)
		.then(() => new Notice(t().search.instant.copied(text)))
		.catch(() => new Notice(t().search.instant.copyFailed));
}

/** What the panel needs from the search bar. */
export interface InstantHost {
	/** The privacy switch: nothing is fetched while it is on. */
	externalCallsDisabled(): boolean;
	/** Something the panel shows has arrived (a rate, a quote, a chart). */
	changed(): void;
}

interface MarketState {
	status: "loading" | "ready" | "none" | "off";
	results: MarketSearchResult[];
	/** Index into `results` of the one shown; -1 for a symbol read as typed. */
	pick: number;
	targets: MarketTarget[];
}

export class InstantAnswers {
	private host: InstantHost;
	private intent: InstantIntent | null = null;
	private key = "";
	/** Bumped whenever the query changes, so a late answer for an older one is
	 * dropped instead of drawn. */
	private generation = 0;
	private range: MarketRange = "1mo";
	private market: MarketState | null = null;

	constructor(host: InstantHost) {
		this.host = host;
	}

	/** Read a query; returns what it asks for (and starts fetching whatever
	 * the answer needs), or null when it's only a search. */
	setQuery(query: string): InstantIntent | null {
		const intent = detectInstant(query, zones());
		const key = intent ? JSON.stringify(intent) : "";
		if (key === this.key) return this.intent;
		this.key = key;
		this.intent = intent;
		this.generation++;
		this.market = null;
		this.range = "1mo";
		if (intent?.kind === "currency") this.loadCurrency(intent);
		if (intent?.kind === "market") this.loadMarket(intent.query);
		return intent;
	}

	clear(): void {
		this.setQuery("");
	}

	get current(): InstantIntent | null {
		return this.intent;
	}

	/** Whether Enter should land on the answer rather than the first note. */
	takesEnter(): boolean {
		return this.intent !== null && instantTakesEnter(this.intent);
	}

	// ---- Loading ------------------------------------------------------------

	private opts(): { ttlMs: number; disabled: boolean } {
		return { ttlMs: TTL_MS, disabled: this.host.externalCallsDisabled() };
	}

	/** Run an async step for the current query; its result is dropped if the
	 * query has moved on by the time it lands. */
	private after<T>(work: Promise<T>, then: (value: T) => void): void {
		const gen = this.generation;
		void work
			.then((value) => {
				if (gen !== this.generation) return;
				then(value);
				this.host.changed();
			})
			.catch(() => {
				/* A failed fetch leaves the answer as it was. */
			});
	}

	private pairTargets(intent: { from: string; to: string }): MarketTarget[] {
		return resolveSymbol(`${intent.from.toUpperCase()}/${intent.to.toUpperCase()}`);
	}

	private loadCurrency(intent: { from: string; to: string }): void {
		const disabled = this.host.externalCallsDisabled();
		if (!cachedRates()) this.after(loadRates(disabled), () => {});
		this.after(loadSeries(this.pairTargets(intent), this.range, this.opts()), () => {});
	}

	private loadMarket(query: string): void {
		if (this.host.externalCallsDisabled()) {
			this.market = { status: "off", results: [], pick: -1, targets: [] };
			return;
		}
		this.market = { status: "loading", results: [], pick: -1, targets: [] };
		const key = query.toLowerCase();
		const cached = searchCache.get(key);
		const search = cached ? Promise.resolve(cached) : searchMarkets(query, { disabled: false });
		this.after(search, (results) => {
			if (!cached) {
				if (searchCache.size >= SEARCH_CACHE_MAX) {
					const [oldest] = searchCache.keys();
					if (oldest !== undefined) searchCache.delete(oldest);
				}
				searchCache.set(key, results);
			}
			if (!this.market) return;
			this.market.results = results;
			// Nothing found by name: read the query as a symbol ("VWCE.DE").
			if (results.length) this.pickMarket(0);
			else this.showTargets(resolveSymbol(query), -1);
		});
	}

	private pickMarket(index: number): void {
		const result = this.market?.results[index];
		if (!result) return;
		this.showTargets(resolveSymbol(result.target.symbol, result.target.provider), index);
	}

	private showTargets(targets: MarketTarget[], pick: number): void {
		const market = this.market;
		if (!market) return;
		market.pick = pick;
		market.targets = targets;
		if (!targets.length) {
			market.status = "none";
			return;
		}
		market.status = cachedQuote(targets) ? "ready" : "loading";
		const opts = this.opts();
		this.after(loadQuotes([targets], opts), () => {
			if (this.market?.targets !== targets) return;
			this.market.status = cachedQuote(targets) ? "ready" : "none";
		});
		this.after(loadSeries(targets, this.range, opts), () => {});
	}

	private setRange(range: MarketRange): void {
		this.range = range;
		const targets =
			this.intent?.kind === "currency" ? this.pairTargets(this.intent) : this.market?.targets ?? [];
		this.host.changed();
		if (targets.length) this.after(loadSeries(targets, range, this.opts()), () => {});
	}

	// ---- Rendering ------------------------------------------------------------

	/** Draw the answer into the results list; returns its keyboard rows. */
	render(parent: HTMLElement, idBase: string): InstantRow[] {
		const intent = this.intent;
		if (!intent) return [];
		const wrap = parent.createDiv("hearth-instant");
		wrap.toggleClass("is-red-up", redUpForLanguage(detectLanguage()));
		const rows: InstantRow[] = [];
		const row = (icon: string, open: () => void): HTMLElement => {
			const el = wrap.createDiv("hearth-result hearth-instant-row");
			el.id = `${idBase}-instant-${rows.length}`;
			el.setAttribute("role", "option");
			el.setAttribute("aria-selected", "false");
			setIcon(el.createDiv("hearth-result-icon"), icon);
			el.addEventListener("click", open);
			rows.push({ el, open });
			return el;
		};
		switch (intent.kind) {
			case "calc":
				this.renderCalc(intent, row);
				break;
			case "currency":
				this.renderCurrency(intent, row, wrap);
				break;
			case "market":
				this.renderMarket(intent.query, row, wrap);
				break;
			case "date":
				this.renderDate(intent, row);
				break;
			case "time":
				this.renderTime(intent, row);
				break;
		}
		if (!rows.length) wrap.remove();
		return rows;
	}

	/** The answer's text: a big value, a quiet line under it, and a hint of
	 * what Enter does. */
	private body(el: HTMLElement, value: string, note: string, hint?: string): HTMLElement {
		const text = el.createDiv("hearth-result-text hearth-instant-text");
		text.createDiv({ cls: "hearth-instant-value", text: value });
		if (note) text.createDiv({ cls: "hearth-instant-note", text: note });
		if (hint) el.createDiv({ cls: "hearth-instant-hint", text: hint });
		return text;
	}

	private renderCalc(
		intent: Extract<InstantIntent, { kind: "calc" }>,
		row: (icon: string, open: () => void) => HTMLElement,
	): void {
		const res = evaluate(intent.input);
		if (!res.ok) {
			// Only a forced (`=`) query is worth an error; otherwise stay quiet.
			if (intent.forced) {
				const el = row("calculator", () => {});
				this.body(el, "…", res.error || t().search.instant.invalid);
			}
			return;
		}
		const el = row("calculator", () => copy(res.formatted));
		this.body(el, res.formatted, res.note ?? intent.input, t().search.instant.copyHint);
	}

	private renderCurrency(
		intent: Extract<InstantIntent, { kind: "currency" }>,
		row: (icon: string, open: () => void) => HTMLElement,
		wrap: HTMLElement,
	): void {
		const strings = t().search.instant;
		const rates = cachedRates()?.rates;
		const res = evaluate(intent.input, { rates });
		const from = intent.from.toUpperCase();
		const to = intent.to.toUpperCase();
		let el: HTMLElement;
		if (res.ok) {
			el = row("banknote", () => copy(res.formatted));
			const unit = rates && rates[intent.from] ? rates[intent.to] / rates[intent.from] : null;
			const note = [
				res.note ?? "",
				unit !== null ? strings.rate(from, formatPrice(unit, "currency"), to) : "",
			]
				.filter(Boolean)
				.join(" · ");
			this.body(el, res.formatted, note, strings.copyHint);
		} else {
			el = row("banknote", () => {});
			const off = this.host.externalCallsDisabled();
			this.body(el, "…", off ? strings.externalOff : rates ? res.error : strings.loading);
		}
		this.chart(wrap, this.pairTargets(intent));
	}

	private renderMarket(
		query: string,
		row: (icon: string, open: () => void) => HTMLElement,
		wrap: HTMLElement,
	): void {
		const strings = t().search.instant;
		const market = this.market;
		if (!market || market.status === "off") {
			this.body(row("candlestick-chart", () => {}), `$${query}`, strings.externalOff);
			return;
		}
		const quote = market.targets.length ? cachedQuote(market.targets) : null;
		if (!quote) {
			const text = market.status === "none" ? strings.noQuote(query) : strings.loading;
			this.body(row("candlestick-chart", () => {}), `$${query}`, text);
		} else {
			const picked = market.results[market.pick];
			const symbol = picked?.display ?? displaySymbol(quote.target);
			const el = row("candlestick-chart", () => window.open(quotePageUrl(quote.target), "_blank"));
			const text = el.createDiv("hearth-result-text hearth-instant-text");
			const title = text.createDiv("hearth-instant-note");
			title.setText([quote.name || symbol, quote.name && quote.name !== symbol ? symbol : "", quote.exchange]
				.filter(Boolean)
				.join(" · "));
			const line = text.createDiv("hearth-instant-quote");
			line.createSpan({
				cls: "hearth-instant-value",
				text: formatPrice(quote.price, quote.type, quote.currency),
			});
			if (quote.currency && quote.type !== "index") {
				line.createSpan({ cls: "hearth-instant-ccy", text: quote.currency });
			}
			line.createSpan({
				cls: `hearth-instant-move is-${direction(quote.change ?? quote.changePct)}`,
				text: formatMove(quote, "both"),
			});
			el.createDiv({ cls: "hearth-instant-hint", text: strings.openHint });
			this.chart(wrap, market.targets, quote.type === "currency" ? null : quote);
		}

		// The other matches, one click from taking the answer's place.
		market.results.forEach((result, i) => {
			if (i === market.pick || i > MAX_ALTERNATIVES) return;
			const alt = row("trending-up", () => {
				this.generation++;
				this.pickMarket(i);
				this.host.changed();
			});
			alt.addClass("hearth-instant-alt");
			const text = alt.createDiv("hearth-result-text");
			text.createDiv({ cls: "hearth-result-name", text: result.name || result.display });
			text.createDiv({
				cls: "hearth-result-path",
				text: [result.display, result.exchange].filter(Boolean).join(" · "),
			});
		});
	}

	/** The chart of a pair or an instrument, with its range chips. */
	private chart(
		wrap: HTMLElement,
		targets: MarketTarget[],
		quote: MarketQuote | null = null,
	): void {
		if (!targets.length) return;
		const box = wrap.createDiv("hearth-instant-chart-wrap");
		const series: MarketSeries | null = cachedSeries(targets, this.range);
		if (series && series.points.length > 1) {
			drawChart(box, series, {
				cls: "hearth-instant-chart",
				baseline: this.range === "1d",
				interactive: { range: this.range, quote },
			});
		} else {
			box.createDiv({
				cls: "hearth-instant-chart hearth-instant-chart-empty",
				text: this.host.externalCallsDisabled() ? "" : t().search.instant.loading,
			});
		}
		rangeChips(box, this.range, (range) => this.setRange(range));
	}

	private renderDate(
		intent: Extract<InstantIntent, { kind: "date" }>,
		row: (icon: string, open: () => void) => HTMLElement,
	): void {
		const strings = t().search.instant;
		const when = new Date(`${intent.date}T12:00:00`);
		const long = when.toLocaleDateString(undefined, {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
		const days = daysBetween(localDayKey(Date.now()), intent.date);
		if (intent.count) {
			const n = intent.count === "until" ? days : -days;
			const el = row("calendar-clock", () => copy(String(n)));
			this.body(el, strings.days(n), long, strings.copyHint);
			return;
		}
		const el = row("calendar", () => copy(intent.date));
		const relative = days === 0 ? strings.today : days > 0 ? strings.inDays(days) : strings.daysAgo(-days);
		this.body(el, long, `${relative} · ${strings.week(isoWeek(intent.date))}`, strings.copyHint);
	}

	private renderTime(
		intent: Extract<InstantIntent, { kind: "time" }>,
		row: (icon: string, open: () => void) => HTMLElement,
	): void {
		const strings = t().search.instant;
		const now = new Date();
		let clock: string;
		let day: string;
		try {
			clock = now.toLocaleTimeString(undefined, { timeZone: intent.zone, hour: "2-digit", minute: "2-digit" });
			day = now.toLocaleDateString(undefined, {
				timeZone: intent.zone,
				weekday: "short",
				day: "numeric",
				month: "short",
			});
		} catch {
			return;
		}
		const there = zoneOffsetMinutes(intent.zone, now);
		const here = -now.getTimezoneOffset();
		const parts = [day, intent.zone.replace(/_/g, " ")];
		if (there !== null) {
			parts.push(`UTC${formatOffset(there)}`);
			parts.push(there === here ? strings.sameTime : strings.offset(formatOffset(there - here)));
		}
		const el = row("clock", () => copy(clock));
		this.body(el, clock, parts.join(" · "), strings.copyHint);
	}
}
