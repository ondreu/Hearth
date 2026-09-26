/**
 * @vitest-environment jsdom
 *
 * The market card, drawn end to end: every style in both designs, fed by the
 * real feed (src/marketfeed.ts) over a stand-in for Obsidian's `requestUrl`
 * that answers the way each source does. Under jsdom with Obsidian's DOM
 * helpers as their type definitions describe them (test/support), so a
 * `createSvg` given two classes fails here exactly as it does in Obsidian.
 *
 * It also pins the fallback: a symbol Yahoo can't answer is fetched from
 * Tencent, and the source that failed isn't asked again on every redraw.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { Component } from "obsidian";
import type { HomeView } from "../src/view";
import { DEFAULT_SETTINGS, type DashboardCard, type MarketConfig, type MarketStyle } from "../src/types";

const calls: string[] = [];
/** Hosts that answer 503, to exercise the fallback. */
const down = new Set<string>();

function response(body: string | object, status = 200) {
	const text = typeof body === "string" ? body : JSON.stringify(body);
	return {
		status,
		headers: {},
		text,
		arrayBuffer: new TextEncoder().encode(text).buffer,
		get json() {
			return JSON.parse(text) as unknown;
		},
	};
}

function yahooChart(symbol: string, price: number, prev: number, type = "EQUITY", currency = "USD") {
	const start = Math.floor(Date.now() / 1000) - 3600;
	return {
		chart: {
			result: [
				{
					meta: {
						symbol,
						currency,
						instrumentType: type,
						longName: `${symbol} Inc.`,
						fullExchangeName: "NasdaqGS",
						regularMarketPrice: price,
						previousClose: prev,
						chartPreviousClose: prev,
						regularMarketDayHigh: price * 1.01,
						regularMarketDayLow: prev * 0.99,
						fiftyTwoWeekHigh: price * 1.3,
						fiftyTwoWeekLow: price * 0.7,
						regularMarketVolume: 1234567,
						regularMarketTime: start + 3500,
						currentTradingPeriod: {
							regular: { start, end: start + 7200 },
							pre: { start: start - 3600, end: start },
							post: { start: start + 7200, end: start + 10800 },
						},
					},
					timestamp: [start, start + 300, start + 600, start + 900],
					indicators: { quote: [{ open: [prev, prev, prev, prev], close: [prev, (prev + price) / 2, price * 0.999, price] }] },
				},
			],
			error: null,
		},
	};
}

function tencentLine(symbol: string, price: string, prev: string): string {
	const f = Array.from({ length: 50 }, () => "");
	f[1] = symbol.toUpperCase();
	f[3] = price;
	f[4] = prev;
	f[5] = prev;
	f[6] = "1000";
	f[30] = "20240926150003";
	f[31] = (Number(price) - Number(prev)).toFixed(3);
	f[32] = (((Number(price) - Number(prev)) / Number(prev)) * 100).toFixed(2);
	f[33] = price;
	f[34] = prev;
	return `v_${symbol}="${f.join("~")}";`;
}

const fakeRequestUrl = vi.fn(async ({ url }: { url: string }) => {
	calls.push(url);
	const u = new URL(url);
	if (down.has(u.host)) return response("down", 503);
	if (u.host.endsWith("finance.yahoo.com") && u.pathname.startsWith("/v8/finance/chart/")) {
		const symbol = decodeURIComponent(u.pathname.split("/").pop() ?? "");
		if (symbol === "NOPE") return response({ chart: { result: null, error: { code: "Not Found" } } }, 404);
		if (symbol === "EURUSD=X") return response(yahooChart(symbol, 1.1133, 1.1125, "CURRENCY"));
		return response(yahooChart(symbol, 227.52, 226.37));
	}
	if (u.host.endsWith("finance.yahoo.com") && u.pathname === "/v1/finance/search") {
		return response({
			quotes: [{ symbol: "AAPL", shortname: "Apple Inc.", exchDisp: "NASDAQ", quoteType: "EQUITY" }],
		});
	}
	if (u.host === "qt.gtimg.cn") {
		const list = decodeURIComponent(u.pathname.slice(3)).split(",");
		return response(
			list
				.map((s) => (s === "sh510300" ? tencentLine(s, "3.935", "3.921") : s === "usNOPE" ? tencentLine(s, "10", "9") : ""))
				.join("\n"),
		);
	}
	if (u.host === "web.ifzq.gtimg.cn") {
		return response({
			data: { sh510300: { data: { date: "20240926", data: ["0930 3.925 1 1", "1000 3.930 1 1", "1500 3.935 1 1"] } } },
		});
	}
	if (u.host === "api.frankfurter.app" || u.host === "api.coingecko.com" || u.host.includes("eastmoney") || u.host.includes("1234567")) {
		return response({}, 404);
	}
	return response("", 404);
});

vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	// Looked up per call: vi.mock is hoisted above the fake's definition.
	requestUrl: (req: { url: string }) => fakeRequestUrl(req),
}));

let renderMarket: typeof import("../src/cards/market").renderMarket;

beforeAll(async () => {
	installObsidianDom();
	({ renderMarket } = await import("../src/cards/market"));
});

beforeEach(() => {
	calls.length = 0;
	down.clear();
});

function view() {
	const settings = structuredClone(DEFAULT_SETTINGS);
	const saveData = vi.fn(async () => undefined);
	return { view: { plugin: { settings, saveData }, app: {} } as unknown as HomeView, saveData };
}

const component = { register: () => undefined, registerInterval: () => 0 } as unknown as Component;

function draw(market: MarketConfig, v = view().view): HTMLElement {
	const body = document.body.createDiv("hearth-card-body");
	const card: DashboardCard = { id: "m", kind: "market", x: 0, y: 0, w: 4, h: 3, market };
	renderMarket(v, card, body, component);
	return body;
}

const ITEMS = [
	{ symbol: "AAPL" },
	{ symbol: "510300", quantity: 1000, cost: 3.5 },
	{ symbol: "EUR/USD" },
];

const STYLES: MarketStyle[] = ["minimal", "spotlight", "chart", "list", "tiles", "ticker", "portfolio"];

describe("every style, in both designs", () => {
	for (const style of STYLES) {
		for (const design of ["classic", "expressive"] as const) {
			it(`draws ${style} (${design}) once the quotes land`, async () => {
				const body = draw({ style, design, items: ITEMS.map((i) => ({ ...i })), upColor: "green" });
				const wrap = body.querySelector(".hearth-market")!;
				expect(wrap.classList.contains(`is-${style}`)).toBe(true);
				expect(wrap.classList.contains("is-expressive")).toBe(design === "expressive");
				await vi.waitFor(() => {
					expect(body.querySelector(".hearth-market-price")).not.toBeNull();
					expect(body.querySelector(".hearth-market-missing")).toBeNull();
				});
				if (style === "spotlight" || style === "chart") {
					await vi.waitFor(() => expect(body.querySelector(".hearth-market-chart polyline")).not.toBeNull());
					expect(body.querySelectorAll(".hearth-market-range")).toHaveLength(6);
				}
				if (style === "list" || style === "tiles") {
					await vi.waitFor(() => expect(body.querySelectorAll(".hearth-market-spark")).toHaveLength(3));
				}
				if (style === "ticker") {
					// Twice over, for a seamless loop.
					expect(body.querySelectorAll(".hearth-market-tape-item")).toHaveLength(6);
				}
				if (style === "portfolio") {
					const total = body.querySelector(".hearth-market-summary-value")!.textContent ?? "";
					// 1000 × 3.935 CNY, the only holding, in its own currency.
					expect(total).toContain("3,935.00");
				}
				if (design === "expressive" && (style === "minimal" || style === "spotlight")) {
					expect(body.querySelector(".hearth-market-badge path")).not.toBeNull();
				}
			});
		}
	}
});

describe("the move's colour", () => {
	it("marks a rise, and swaps the colours for red-up readers", async () => {
		const body = draw({ style: "list", items: [{ symbol: "AAPL" }], upColor: "red" });
		await vi.waitFor(() => expect(body.querySelector(".hearth-market-row.is-up")).not.toBeNull());
		expect(body.querySelector(".hearth-market")!.classList.contains("is-red-up")).toBe(true);
	});
});

describe("the feed's fallback", () => {
	it("fetches a symbol Yahoo can't answer from Tencent, and stops asking Yahoo", async () => {
		const body = draw({ style: "list", items: [{ symbol: "NOPE" }] });
		await vi.waitFor(() => expect(body.querySelector(".hearth-market-price")).not.toBeNull());
		expect(calls.some((c) => c.includes("/v8/finance/chart/NOPE"))).toBe(true);
		expect(calls.some((c) => c.includes("qt.gtimg.cn/q=usNOPE"))).toBe(true);

		// A redraw inside the refresh window: the cached Tencent quote, no requests.
		calls.length = 0;
		const again = draw({ style: "list", items: [{ symbol: "NOPE" }] });
		expect(again.querySelector(".hearth-market-price")).not.toBeNull();
		await new Promise((r) => window.setTimeout(r, 20));
		expect(calls.filter((c) => c.includes("NOPE"))).toEqual([]);
	});

	it("serves a mainland fund from Yahoo when Tencent is down", async () => {
		down.add("qt.gtimg.cn");
		const body = draw({ style: "list", items: [{ symbol: "512880" }] });
		await vi.waitFor(() => expect(body.querySelector(".hearth-market-price")).not.toBeNull());
		expect(calls.some((c) => c.includes("/v8/finance/chart/512880.SS"))).toBe(true);
	});
});

describe("with external calls off", () => {
	it("fetches nothing and says why", async () => {
		const { view: v } = view();
		v.plugin.settings.disableExternalCalls = true;
		const body = draw({ style: "list", items: [{ symbol: "MSFT" }] }, v);
		await new Promise((r) => window.setTimeout(r, 20));
		expect(calls).toEqual([]);
		expect(body.querySelector(".hearth-card-empty")).not.toBeNull();
	});
});

describe("an empty card", () => {
	it("asks for a symbol", () => {
		const body = draw({ style: "list" });
		expect(body.querySelector(".hearth-card-empty")).not.toBeNull();
	});
});

describe("the lookup", () => {
	it("searches from the card and adds a result to it", async () => {
		const { view: v, saveData } = view();
		const market: MarketConfig = { style: "lookup", items: [] };
		const body = document.body.createDiv("hearth-card-body");
		const card: DashboardCard = { id: "m", kind: "market", x: 0, y: 0, w: 4, h: 3, market };
		renderMarket(v, card, body, component);
		expect(body.querySelector(".hearth-market-hint")).not.toBeNull();

		const input = body.querySelector<HTMLInputElement>(".hearth-market-search-input")!;
		input.value = "apple";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		await vi.waitFor(() => expect(body.querySelector(".hearth-market-result")).not.toBeNull());
		expect(body.querySelector(".hearth-market-result .hearth-market-title")!.textContent).toBe("Apple Inc.");

		body.querySelector<HTMLButtonElement>(".hearth-market-result .hearth-market-icon-button")!.click();
		expect(card.market?.items).toEqual([{ symbol: "AAPL", provider: "yahoo", name: "Apple Inc." }]);
		expect(saveData).toHaveBeenCalled();
		await vi.waitFor(() => expect(body.querySelector(".hearth-market-row .hearth-market-price")).not.toBeNull());
		// The field survived every repaint.
		expect(body.querySelector(".hearth-market-search-input")).toBe(input);
	});
});
