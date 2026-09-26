import { describe, expect, it } from "vitest";
import {
	alternates,
	cnExchange,
	convert,
	direction,
	displaySymbol,
	dominantCurrency,
	formatMove,
	formatPct,
	formatPrice,
	formatSigned,
	frankfurterQuote,
	holdingValue,
	mergeSearchResults,
	normalizeCurrency,
	parseChinaTime,
	parseCoinGeckoChart,
	parseCoinGeckoMarkets,
	parseCoinGeckoSearch,
	parseEastmoneyEstimate,
	parseEastmoneyHistory,
	parseFrankfurterSeries,
	parseTencentKline,
	parseTencentMinutes,
	parseTencentQuotes,
	parseTencentSearch,
	parseYahooChart,
	parseYahooSearch,
	portfolioTotals,
	quotePageUrl,
	rangePosition,
	redUpForLanguage,
	resolveSymbol,
	wantsChineseSearch,
	yahooState,
} from "../src/market";
import { resolveMarket, rowsFor } from "../src/cards/market";
import { sanitizeCard } from "../src/layout";
import { captureDashboard, stripReferences } from "../src/portable";
import { type Dashboard, type DashboardCard, DEFAULT_SETTINGS, type HomeSettings } from "../src/types";

/**
 * The market card's data layer. None of its sources is an official API, so
 * what each response *means* is pinned here against a fixture in the shape the
 * source sends — the parsers are where a changed response would break the card,
 * and a failing case here names which source moved. The resolution table is
 * the other half: it decides which source a typed symbol reaches, and the
 * fallback order a reader in mainland China depends on.
 */

describe("resolveSymbol", () => {
	const first = (raw: string) => resolveSymbol(raw)[0];

	it("sends a bare mainland code to Tencent first, Yahoo second", () => {
		expect(resolveSymbol("510300")).toEqual([
			{ provider: "tencent", symbol: "sh510300" },
			{ provider: "yahoo", symbol: "510300.SS" },
		]);
		expect(resolveSymbol("159915")).toEqual([
			{ provider: "tencent", symbol: "sz159915" },
			{ provider: "yahoo", symbol: "159915.SZ" },
		]);
		expect(first("830799")).toEqual({ provider: "tencent", symbol: "bj830799" });
	});

	it("keeps an exchange-prefixed code on its exchange", () => {
		expect(resolveSymbol("SZ000001")).toEqual([
			{ provider: "tencent", symbol: "sz000001" },
			{ provider: "yahoo", symbol: "000001.SZ" },
		]);
	});

	it("reads Yahoo's own suffixes and falls back to Tencent", () => {
		expect(resolveSymbol("600519.ss")).toEqual([
			{ provider: "yahoo", symbol: "600519.SS" },
			{ provider: "tencent", symbol: "sh600519" },
		]);
		expect(resolveSymbol("600519.SH")[0]).toEqual({ provider: "yahoo", symbol: "600519.SS" });
		expect(resolveSymbol("700.HK")).toEqual([
			{ provider: "yahoo", symbol: "0700.HK" },
			{ provider: "tencent", symbol: "hk00700" },
		]);
		expect(resolveSymbol("hk9988")).toEqual([
			{ provider: "tencent", symbol: "hk09988" },
			{ provider: "yahoo", symbol: "9988.HK" },
		]);
	});

	it("turns a currency pair into Yahoo forex with the ECB behind it", () => {
		const pair = [
			{ provider: "yahoo", symbol: "EURUSD=X" },
			{ provider: "frankfurter", symbol: "EUR/USD" },
		];
		expect(resolveSymbol("EUR/USD")).toEqual(pair);
		expect(resolveSymbol("eur-usd")).toEqual(pair);
		expect(resolveSymbol("EURUSD=X")).toEqual(pair);
	});

	it("reads a pair against a non-currency as crypto", () => {
		expect(resolveSymbol("BTC/USD")).toEqual([{ provider: "yahoo", symbol: "BTC-USD" }]);
	});

	it("honours a source prefix, and only that source", () => {
		expect(resolveSymbol("fund:161725")).toEqual([{ provider: "eastmoney", symbol: "161725" }]);
		expect(resolveSymbol("cg:Bitcoin")).toEqual([{ provider: "coingecko", symbol: "bitcoin" }]);
		expect(resolveSymbol("fx:usdczk")).toEqual([{ provider: "frankfurter", symbol: "USD/CZK" }]);
		expect(resolveSymbol("cn:510300")).toEqual([{ provider: "tencent", symbol: "sh510300" }]);
		expect(resolveSymbol("yahoo:^GSPC")).toEqual([{ provider: "yahoo", symbol: "^GSPC" }]);
		expect(resolveSymbol("fx:nope")).toEqual([]);
	});

	it("passes anything else to Yahoo as typed, a plain US ticker with Tencent behind it", () => {
		expect(resolveSymbol("aapl")).toEqual([
			{ provider: "yahoo", symbol: "AAPL" },
			{ provider: "tencent", symbol: "usAAPL" },
		]);
		expect(resolveSymbol("^GSPC")).toEqual([{ provider: "yahoo", symbol: "^GSPC" }]);
		expect(resolveSymbol("SAP.DE")).toEqual([{ provider: "yahoo", symbol: "SAP.DE" }]);
		expect(resolveSymbol("   ")).toEqual([]);
	});

	it("tries a searched item at its own source first", () => {
		expect(resolveSymbol("sh510300", "tencent")).toEqual([
			{ provider: "tencent", symbol: "sh510300" },
			{ provider: "yahoo", symbol: "510300.SS" },
		]);
		expect(resolveSymbol("bitcoin", "coingecko")).toEqual([{ provider: "coingecko", symbol: "bitcoin" }]);
	});

	it("guesses the mainland exchange from the code's first digit", () => {
		expect(cnExchange("600000")).toBe("sh");
		expect(cnExchange("512880")).toBe("sh");
		expect(cnExchange("000001")).toBe("sz");
		expect(cnExchange("300750")).toBe("sz");
		expect(cnExchange("161725")).toBe("sz");
		expect(cnExchange("430047")).toBe("bj");
	});

	it("maps alternates both ways", () => {
		expect(alternates({ provider: "tencent", symbol: "usBRK.B" })).toEqual([{ provider: "yahoo", symbol: "BRK-B" }]);
		expect(alternates({ provider: "frankfurter", symbol: "GBP/JPY" })).toEqual([
			{ provider: "yahoo", symbol: "GBPJPY=X" },
		]);
		expect(alternates({ provider: "eastmoney", symbol: "161725" })).toEqual([]);
	});
});

describe("display and links", () => {
	it("shows a symbol without its source's decoration", () => {
		expect(displaySymbol({ provider: "tencent", symbol: "sh510300" })).toBe("510300");
		expect(displaySymbol({ provider: "tencent", symbol: "usAAPL" })).toBe("AAPL");
		expect(displaySymbol({ provider: "yahoo", symbol: "EURUSD=X" })).toBe("EUR/USD");
		expect(displaySymbol({ provider: "coingecko", symbol: "bitcoin/eur" })).toBe("bitcoin");
	});

	it("links each source to a page about the instrument", () => {
		expect(quotePageUrl({ provider: "yahoo", symbol: "^GSPC" })).toBe("https://finance.yahoo.com/quote/%5EGSPC");
		expect(quotePageUrl({ provider: "tencent", symbol: "sh510300" })).toBe("https://gu.qq.com/sh510300");
		expect(quotePageUrl({ provider: "eastmoney", symbol: "161725" })).toBe("https://fund.eastmoney.com/161725.html");
		expect(quotePageUrl({ provider: "frankfurter", symbol: "EUR/USD" })).toBe(
			"https://finance.yahoo.com/quote/EURUSD%3DX",
		);
	});
});

// ---- Yahoo ----------------------------------------------------------------

const APPLE = { provider: "yahoo" as const, symbol: "AAPL" };

function yahooChart(meta: Record<string, unknown>, closes: (number | null)[] = [227, 227.3, null]): unknown {
	return {
		chart: {
			result: [
				{
					meta: {
						currency: "USD",
						symbol: "AAPL",
						exchangeName: "NMS",
						fullExchangeName: "NasdaqGS",
						instrumentType: "EQUITY",
						regularMarketTime: 1727380800,
						regularMarketPrice: 227.52,
						fiftyTwoWeekHigh: 237.23,
						fiftyTwoWeekLow: 164.08,
						regularMarketDayHigh: 228.5,
						regularMarketDayLow: 225.41,
						regularMarketVolume: 36636700,
						longName: "Apple Inc.",
						shortName: "Apple Inc.",
						chartPreviousClose: 226.37,
						previousClose: 226.37,
						currentTradingPeriod: {
							pre: { start: 1727337600, end: 1727357400 },
							regular: { start: 1727357400, end: 1727380800 },
							post: { start: 1727380800, end: 1727395200 },
						},
						...meta,
					},
					timestamp: [1727357400, 1727357700, 1727358000],
					indicators: { quote: [{ open: [226.5, 227, null], close: closes }] },
				},
			],
			error: null,
		},
	};
}

describe("parseYahooChart", () => {
	const during = 1727360000 * 1000;

	it("reads the quote from the meta and the day's move from the previous close", () => {
		const { quote, series } = parseYahooChart(yahooChart({}), APPLE, "1d", during);
		expect(quote).toMatchObject({
			name: "Apple Inc.",
			currency: "USD",
			price: 227.52,
			prevClose: 226.37,
			open: 226.5,
			dayHigh: 228.5,
			dayLow: 225.41,
			yearHigh: 237.23,
			yearLow: 164.08,
			volume: 36636700,
			exchange: "NasdaqGS",
			type: "equity",
			state: "open",
			time: 1727380800 * 1000,
		});
		expect(quote!.change).toBeCloseTo(1.15, 6);
		expect(quote!.changePct).toBeCloseTo((1.15 / 226.37) * 100, 6);
		// The null bar is a gap, not a zero.
		expect(series!.points).toEqual([
			{ t: 1727357400000, v: 227 },
			{ t: 1727357700000, v: 227.3 },
		]);
		expect(series!.baseline).toBe(226.37);
	});

	it("doesn't take a longer range's starting price for the day's previous close", () => {
		const { quote, series } = parseYahooChart(
			yahooChart({ previousClose: undefined, chartPreviousClose: 180 }),
			APPLE,
			"1y",
			during,
		);
		expect(quote!.prevClose).toBeNull();
		expect(quote!.change).toBeNull();
		expect(series!.baseline).toBe(180);
	});

	it("folds London's pence into pounds", () => {
		const { quote, series } = parseYahooChart(
			yahooChart({ currency: "GBp", regularMarketPrice: 1234, previousClose: 1200, chartPreviousClose: 1200 }, [1230]),
			{ provider: "yahoo", symbol: "SHEL.L" },
			"1d",
			during,
		);
		expect(quote!.currency).toBe("GBP");
		expect(quote!.price).toBeCloseTo(12.34, 6);
		expect(quote!.change).toBeCloseTo(0.34, 6);
		expect(series!.points[0].v).toBeCloseTo(12.3, 6);
	});

	it("says nothing for a symbol Yahoo doesn't know", () => {
		const miss = { chart: { result: null, error: { code: "Not Found", description: "No data found" } } };
		expect(parseYahooChart(miss, APPLE, "1d", during)).toEqual({ quote: null, series: null });
		expect(parseYahooChart(null, APPLE, "1d", during)).toEqual({ quote: null, series: null });
		expect(parseYahooChart("<html>", APPLE, "1d", during)).toEqual({ quote: null, series: null });
	});

	it("tells the session from the trading periods", () => {
		const periods = yahooChart({}) as { chart: { result: { meta: { currentTradingPeriod: unknown } }[] } };
		const p = periods.chart.result[0].meta.currentTradingPeriod;
		expect(yahooState(p, 1727340000 * 1000, "equity")).toBe("pre");
		expect(yahooState(p, 1727390000 * 1000, "equity")).toBe("post");
		expect(yahooState(p, 1727400000 * 1000, "equity")).toBe("closed");
		expect(yahooState(null, 0, "crypto")).toBe("open");
		expect(yahooState(null, 0, "equity")).toBeNull();
	});
});

describe("parseYahooSearch", () => {
	it("maps each match to a Yahoo target with its type", () => {
		const results = parseYahooSearch({
			quotes: [
				{ symbol: "AAPL", shortname: "Apple Inc.", longname: "Apple Inc.", exchDisp: "NASDAQ", quoteType: "EQUITY" },
				{ symbol: "510300.SS", shortname: "HS300 ETF", exchange: "SHH", quoteType: "ETF" },
				{ symbol: "EURUSD=X", shortname: "EUR/USD", exchDisp: "CCY", quoteType: "CURRENCY" },
				{ index: "news" },
			],
		});
		expect(results).toEqual([
			{ target: APPLE, display: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "equity" },
			{
				target: { provider: "yahoo", symbol: "510300.SS" },
				display: "510300.SS",
				name: "HS300 ETF",
				exchange: "SHH",
				type: "etf",
			},
			{
				target: { provider: "yahoo", symbol: "EURUSD=X" },
				display: "EUR/USD",
				name: "EUR/USD",
				exchange: "CCY",
				type: "currency",
			},
		]);
		expect(parseYahooSearch({})).toEqual([]);
	});
});

// ---- Tencent --------------------------------------------------------------

/** A Tencent quote line, fields placed where Tencent puts them. */
function tencentLine(symbol: string, fields: Record<number, string>): string {
	const f = Array.from({ length: 50 }, () => "");
	for (const [i, v] of Object.entries(fields)) f[Number(i)] = v;
	return `v_${symbol}="${f.join("~")}";`;
}

describe("parseTencentQuotes", () => {
	const text = [
		tencentLine("sh510300", {
			0: "1",
			1: "HS300ETF",
			2: "510300",
			3: "3.935",
			4: "3.921",
			5: "3.925",
			6: "12345",
			30: "20240926150003",
			31: "0.014",
			32: "0.36",
			33: "3.950",
			34: "3.910",
		}),
		tencentLine("hk00700", {
			0: "100",
			1: "TENCENT",
			2: "00700",
			3: "412.4",
			4: "400.0",
			5: "401.0",
			6: "1000",
			30: "2024/09/26 16:08:10",
			31: "12.4",
			32: "3.10",
			33: "415.0",
			34: "399.8",
		}),
		`v_pv_none_match="1";`,
	].join("\n");
	const parsed = parseTencentQuotes(text, 1);

	it("reads a mainland fund in yuan, volume in shares", () => {
		expect(parsed.get("sh510300")).toMatchObject({
			target: { provider: "tencent", symbol: "sh510300" },
			name: "HS300ETF",
			currency: "CNY",
			price: 3.935,
			prevClose: 3.921,
			change: 0.014,
			changePct: 0.36,
			open: 3.925,
			dayHigh: 3.95,
			dayLow: 3.91,
			volume: 1234500,
			exchange: "SSE",
			type: "etf",
			time: Date.parse("2024-09-26T15:00:03+08:00"),
		});
	});

	it("reads Hong Kong in dollars with its own time format", () => {
		expect(parsed.get("hk00700")).toMatchObject({
			currency: "HKD",
			price: 412.4,
			volume: 1000,
			exchange: "HKEX",
			time: Date.parse("2024-09-26T16:08:10+08:00"),
		});
	});

	it("leaves out what Tencent didn't match", () => {
		expect([...parsed.keys()]).toEqual(["sh510300", "hk00700"]);
		expect(parseTencentQuotes("", 1).size).toBe(0);
	});

	it("skips a suspended listing's zero price", () => {
		const zero = tencentLine("sz000001", { 1: "X", 3: "0.00", 4: "10.00" });
		expect(parseTencentQuotes(zero, 1).size).toBe(0);
	});

	it("parses the time formats in Beijing time", () => {
		expect(parseChinaTime("20240926093000")).toBe(Date.parse("2024-09-26T01:30:00Z"));
		expect(parseChinaTime("2024-09-26 15:00")).toBe(Date.parse("2024-09-26T07:00:00Z"));
		expect(parseChinaTime("nope")).toBeNull();
	});
});

describe("Tencent charts and search", () => {
	it("reads the day's minutes against the previous close", () => {
		const json = {
			code: 0,
			data: { sh510300: { data: { date: "20240926", data: ["0930 3.925 100 1", "0931 3.930 50 1", "junk"] } } },
		};
		expect(parseTencentMinutes(json, "sh510300", 3.921)).toEqual({
			points: [
				{ t: Date.parse("2024-09-26T09:30:00+08:00"), v: 3.925 },
				{ t: Date.parse("2024-09-26T09:31:00+08:00"), v: 3.93 },
			],
			baseline: 3.921,
		});
		expect(parseTencentMinutes({}, "sh510300", null)).toBeNull();
	});

	it("reads daily bars, the first as the baseline", () => {
		const json = {
			data: {
				sz159915: {
					day: [
						["2024-09-24", "1.9", "1.95", "1.96", "1.88", "1"],
						["2024-09-25", "1.95", "2.01", "2.02", "1.94", "1"],
						["2024-09-26", "2.01", "2.10", "2.12", "2.00", "1"],
					],
				},
			},
		};
		const s = parseTencentKline(json, "sz159915")!;
		expect(s.baseline).toBe(1.95);
		expect(s.points.map((p) => p.v)).toEqual([2.01, 2.1]);
		// Adjusted bars win where both are given.
		expect(parseTencentKline({ data: { x: { qfqday: [["2024-01-01", "1", "5"], ["2024-01-02", "1", "6"]], day: [] } } }, "x")!.points[0].v).toBe(6);
	});

	it("reads the smartbox, unescaping names and routing OTC funds to Eastmoney", () => {
		const text =
			'v_hint="sh~510300~\\u6caa\\u6df1300ETF~hs300etf~ETF^hk~00700~\\u817e\\u8baf~tx~GP^' +
			'us~aapl.oq~\\u82f9\\u679c~pg~GP^jj~161725~\\u62db\\u5546\\u767d\\u9152~zsbj~LOF^sz~399300~X~x~ZS";';
		expect(parseTencentSearch(text)).toEqual([
			{ target: { provider: "tencent", symbol: "sh510300" }, display: "510300", name: "沪深300ETF", exchange: "SSE", type: "etf" },
			{ target: { provider: "tencent", symbol: "hk00700" }, display: "00700", name: "腾讯", exchange: "HKEX", type: "equity" },
			{ target: { provider: "tencent", symbol: "usAAPL" }, display: "AAPL", name: "苹果", exchange: "US", type: "equity" },
			{ target: { provider: "eastmoney", symbol: "161725" }, display: "161725", name: "招商白酒", exchange: "OTC", type: "fund" },
			{ target: { provider: "tencent", symbol: "sz399300" }, display: "399300", name: "X", exchange: "SZSE", type: "index" },
		]);
		expect(parseTencentSearch('v_hint="N";')).toEqual([]);
	});
});

// ---- Eastmoney ------------------------------------------------------------

describe("Eastmoney funds", () => {
	it("reads the running estimate against the last NAV", () => {
		const text =
			'jsonpgz({"fundcode":"161725","name":"招商中证白酒指数(LOF)A","jzrq":"2024-09-25","dwjz":"0.7932",' +
			'"gsz":"0.8012","gszzl":"1.01","gztime":"2024-09-26 15:00"});';
		const q = parseEastmoneyEstimate(text, "161725", 1)!;
		expect(q).toMatchObject({
			name: "招商中证白酒指数(LOF)A",
			currency: "CNY",
			price: 0.8012,
			prevClose: 0.7932,
			changePct: 1.01,
			type: "fund",
			time: Date.parse("2024-09-26T15:00:00+08:00"),
		});
		expect(q.change).toBeCloseTo(0.008, 6);
	});

	it("has nothing for a fund without an estimate", () => {
		expect(parseEastmoneyEstimate("jsonpgz();", "000000", 1)).toBeNull();
		expect(parseEastmoneyEstimate("<html>", "000000", 1)).toBeNull();
	});

	it("keeps the last days of the NAV history", () => {
		const day = 86_400_000;
		const now = 10 * day;
		const text =
			'var fS_name = "x";var Data_netWorthTrend = [' +
			`{"x":${6 * day},"y":1.0},{"x":${8 * day},"y":1.1},{"x":${9 * day},"y":1.2}` +
			'];var Data_ACWorthTrend = [[1,2]];';
		expect(parseEastmoneyHistory(text, 3, now)).toEqual({
			points: [
				{ t: 8 * day, v: 1.1 },
				{ t: 9 * day, v: 1.2 },
			],
			baseline: 1.0,
		});
		expect(parseEastmoneyHistory("var x = 1;", 3, now)).toBeNull();
	});
});

// ---- CoinGecko and the ECB ------------------------------------------------

describe("CoinGecko", () => {
	it("reads markets keyed by coin, priced in the asked currency", () => {
		const quotes = parseCoinGeckoMarkets(
			[
				{
					id: "bitcoin",
					symbol: "btc",
					name: "Bitcoin",
					current_price: 60000,
					high_24h: 61000,
					low_24h: 59000,
					price_change_24h: 1200,
					price_change_percentage_24h: 2.04,
					total_volume: 3e10,
					last_updated: "2024-09-26T12:00:00.000Z",
				},
			],
			"eur",
			1,
		);
		expect(quotes.get("bitcoin")).toMatchObject({
			target: { provider: "coingecko", symbol: "bitcoin/eur" },
			currency: "EUR",
			price: 60000,
			prevClose: 58800,
			change: 1200,
			changePct: 2.04,
			type: "crypto",
			state: "open",
			time: Date.parse("2024-09-26T12:00:00Z"),
		});
	});

	it("reads a chart and a search", () => {
		expect(parseCoinGeckoChart({ prices: [[1, 10], [2, 12]] })).toEqual({
			points: [
				{ t: 1, v: 10 },
				{ t: 2, v: 12 },
			],
			baseline: 10,
		});
		expect(
			parseCoinGeckoSearch({ coins: [{ id: "pepe", name: "Pepe", symbol: "pepe" }, { id: "a" }, { id: "b" }] }, 2),
		).toEqual([
			{ target: { provider: "coingecko", symbol: "pepe" }, display: "PEPE", name: "Pepe", exchange: "CoinGecko", type: "crypto" },
			{ target: { provider: "coingecko", symbol: "a" }, display: "A", name: "a", exchange: "CoinGecko", type: "crypto" },
		]);
	});
});

describe("Frankfurter", () => {
	it("turns the daily fixes into a series and the last two into a quote", () => {
		const series = parseFrankfurterSeries(
			{
				base: "EUR",
				rates: {
					"2024-09-25": { USD: 1.1133 },
					"2024-09-23": { USD: 1.11 },
					"2024-09-24": { USD: 1.1125 },
				},
			},
			"usd",
		)!;
		expect(series.baseline).toBe(1.11);
		expect(series.points.map((p) => p.v)).toEqual([1.1125, 1.1133]);
		const q = frankfurterQuote(series, "EUR/USD", 1)!;
		expect(q).toMatchObject({ price: 1.1133, prevClose: 1.1125, currency: "USD", type: "currency" });
		expect(q.change).toBeCloseTo(0.0008, 8);
	});
});

// ---- Formatting -----------------------------------------------------------

describe("formatting", () => {
	it("gives each kind of price the decimals it trades in", () => {
		expect(formatPrice(3.935, "etf", "CNY")).toBe("3.935");
		expect(formatPrice(1.08123, "currency", "USD")).toBe("1.0812");
		expect(formatPrice(149.234, "currency", "JPY")).toBe("149.234");
		expect(formatPrice(227.5, "equity", "USD")).toBe("227.50");
		expect(formatPrice(0.000012345, "crypto", "USD")).toBe("0.000012");
		expect(formatPrice(null)).toBe("—");
	});

	it("signs a move with a real minus", () => {
		expect(formatSigned(1.234)).toBe("+1.23");
		expect(formatSigned(-0.456)).toBe("−0.46");
		expect(formatSigned(-0.001)).toBe("0.00");
		expect(formatPct(2.5)).toBe("+2.50%");
		expect(formatPct(null)).toBe("—");
	});

	it("writes the move the way the card is set to", () => {
		const q = { price: 227.52, change: 1.15, changePct: 0.508, type: "equity" as const, currency: "USD" };
		expect(formatMove(q, "percent")).toBe("+0.51%");
		expect(formatMove(q, "absolute")).toBe("+1.15");
		expect(formatMove(q, "both")).toBe("+1.15 (+0.51%)");
		expect(formatMove({ ...q, change: null }, "both")).toBe("+0.51%");
	});

	it("knows which way a number went", () => {
		expect(direction(0.1)).toBe("up");
		expect(direction(-0.1)).toBe("down");
		expect(direction(0)).toBe("flat");
		expect(direction(null)).toBe("flat");
	});

	it("draws rises red where that is the convention", () => {
		expect(redUpForLanguage("zh")).toBe(true);
		expect(redUpForLanguage("zh-TW")).toBe(true);
		expect(redUpForLanguage("ja")).toBe(true);
		expect(redUpForLanguage("ko")).toBe(true);
		expect(redUpForLanguage("en")).toBe(false);
		expect(redUpForLanguage("de")).toBe(false);
	});

	it("places a price in its range", () => {
		expect(rangePosition(5, 0, 10)).toBe(0.5);
		expect(rangePosition(12, 0, 10)).toBe(1);
		expect(rangePosition(5, 10, 10)).toBeNull();
		expect(rangePosition(5, null, 10)).toBeNull();
	});

	it("folds the minor-unit currencies", () => {
		expect(normalizeCurrency("GBp")).toEqual({ code: "GBP", factor: 0.01 });
		expect(normalizeCurrency("GBP")).toEqual({ code: "GBP", factor: 1 });
		expect(normalizeCurrency("ZAc")).toEqual({ code: "ZAR", factor: 0.01 });
		expect(normalizeCurrency("ILA")).toEqual({ code: "ILS", factor: 0.01 });
		expect(normalizeCurrency("usd")).toEqual({ code: "USD", factor: 1 });
	});
});

// ---- Portfolio -------------------------------------------------------------

describe("portfolio", () => {
	const rates = { rates: { eur: 1, usd: 1.1, cny: 7.8 } };

	it("values a position, its day and its gain", () => {
		expect(holdingValue({ price: 110, change: 2 }, 10, 100)).toEqual({
			value: 1100,
			day: 20,
			gain: 100,
			gainPct: 10,
			costBasis: 1000,
		});
		expect(holdingValue({ price: 110, change: null }, 10)).toMatchObject({ day: null, gain: null, gainPct: null });
	});

	it("converts through the ECB table, and not at all within one currency", () => {
		expect(convert(110, "USD", "EUR", rates)).toBeCloseTo(100, 6);
		expect(convert(5, "XYZ", "XYZ", null)).toBe(5);
		expect(convert(5, "XYZ", "EUR", rates)).toBeNull();
	});

	it("totals holdings in one currency and counts what it couldn't convert", () => {
		const totals = portfolioTotals(
			[
				{ quote: { price: 110, change: 1.1, currency: "USD" }, quantity: 10, cost: 100 },
				{ quote: { price: 50, change: -1, currency: "EUR" }, quantity: 2 },
				{ quote: { price: 1, change: 0, currency: "XYZ" }, quantity: 5 },
			],
			"EUR",
			rates,
		);
		expect(totals.value).toBeCloseTo(1000 + 100, 6);
		expect(totals.day).toBeCloseTo(10 - 2, 6);
		expect(totals.dayPct).toBeCloseTo((8 / (1100 - 8)) * 100, 6);
		// Only the holding with a cost has a gain: 100 USD = 90.91 EUR on 909.09.
		expect(totals.gain).toBeCloseTo(100 / 1.1, 6);
		expect(totals.gainPct).toBeCloseTo(10, 6);
		expect(totals.missing).toBe(1);
		expect(totals.values[2]).toBeNull();
	});

	it("picks the currency most holdings are in", () => {
		expect(dominantCurrency(["CNY", "USD", "CNY"])).toBe("CNY");
		expect(dominantCurrency([], "EUR")).toBe("EUR");
	});
});

describe("search", () => {
	it("merges sources, dropping the same instrument under another source's name", () => {
		const tencent = { target: { provider: "tencent" as const, symbol: "sh510300" }, display: "510300", name: "A", exchange: "SSE", type: "etf" as const };
		const yahoo = { target: { provider: "yahoo" as const, symbol: "510300.SS" }, display: "510300.SS", name: "B", exchange: "SHH", type: "etf" as const };
		const other = { target: { provider: "yahoo" as const, symbol: "AAPL" }, display: "AAPL", name: "C", exchange: "", type: "equity" as const };
		expect(mergeSearchResults([[tencent], [yahoo, other]])).toEqual([tencent, other]);
		expect(mergeSearchResults([[tencent, other]], 1)).toEqual([tencent]);
	});

	it("asks the Chinese sources for Chinese names and codes", () => {
		expect(wantsChineseSearch("沪深300")).toBe(true);
		expect(wantsChineseSearch("5103")).toBe(true);
		expect(wantsChineseSearch("apple")).toBe(false);
	});
});

// ---- The card's config ------------------------------------------------------

describe("the market card's config", () => {
	it("defaults to a watchlist, and a move in both forms for one instrument", () => {
		expect(resolveMarket({}, false, "en")).toMatchObject({
			style: "list",
			expressive: false,
			redUp: false,
			range: "1d",
			change: "percent",
			showName: true,
			refreshMin: 5,
		});
		expect(resolveMarket({ style: "spotlight" }, false, "en").change).toBe("both");
	});

	it("follows the language for the rising colour unless told", () => {
		expect(resolveMarket({}, false, "zh").redUp).toBe(true);
		expect(resolveMarket({ upColor: "green" }, false, "zh").redUp).toBe(false);
		expect(resolveMarket({ upColor: "red" }, false, "en").redUp).toBe(true);
	});

	it("holds the tape still on a low-power tier", () => {
		expect(resolveMarket({ style: "ticker" }, true, "en").animate).toBe(false);
	});

	it("drops items with nothing to fetch", () => {
		expect(rowsFor({ items: [{ symbol: "AAPL" }, { symbol: "  " }, { symbol: "fx:no" }] })).toHaveLength(1);
	});

	it("survives a saved layout, and an import can't slip anything else in", () => {
		const card = sanitizeCard(
			{
				id: "m",
				kind: "market",
				x: 0,
				y: 0,
				w: 4,
				h: 3,
				market: {
					items: [
						{ symbol: "510300", quantity: 1000, cost: 3.5, name: "HS300" },
						{ symbol: "bitcoin", provider: "coingecko" },
						{ symbol: "X", provider: "evil" },
						{ symbol: "", quantity: 1 },
						{ symbol: "Y", quantity: "lots", cost: Number.NaN },
						"nope",
					],
					style: "portfolio",
					design: "expressive",
					upColor: "red",
					range: "6mo",
					change: "both",
					showSparkline: false,
					baseCurrency: "CNY",
					refreshMin: 99999,
					script: "alert(1)",
				},
			},
			0,
		);
		expect(card?.market).toEqual({
			items: [
				{ symbol: "510300", quantity: 1000, cost: 3.5, name: "HS300" },
				{ symbol: "bitcoin", provider: "coingecko" },
				{ symbol: "X" },
				{ symbol: "Y" },
			],
			style: "portfolio",
			design: "expressive",
			upColor: "red",
			range: "6mo",
			change: "both",
			showSparkline: false,
			baseCurrency: "cny",
			refreshMin: 24 * 60,
		});
	});

	it("leaves the holdings behind when a board is published, and keeps the symbols", () => {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		const market: DashboardCard = {
			id: "m",
			kind: "market",
			x: 0,
			y: 0,
			w: 4,
			h: 3,
			market: { style: "portfolio", items: [{ symbol: "AAPL", quantity: 12, cost: 150 }] },
		};
		s.dashboards = [{ id: "b", name: "Home", cards: [market] }];
		s.activeDashboardId = "b";
		const pkg = captureDashboard(s, s.dashboards[0]);
		const report = stripReferences(pkg);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;
		expect(report.removed.holding).toBe(2);
		expect(board.cards[0].market?.items).toEqual([{ symbol: "AAPL" }]);
		expect(board.cards[0].market?.style).toBe("portfolio");
	});
});
