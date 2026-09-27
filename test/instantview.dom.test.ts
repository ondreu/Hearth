/**
 * @vitest-environment jsdom
 *
 * The search bar's instant-answer panel, drawn under jsdom with Obsidian's DOM
 * helpers (test/support) and a stand-in for `requestUrl`: a sum renders with
 * no request at all, a `$` lookup searches, quotes and charts through the
 * market feed, and with external calls disabled nothing is fetched.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

const calls: string[] = [];

function response(body: object, status = 200) {
	const text = JSON.stringify(body);
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
						longName: "Apple Inc.",
						fullExchangeName: "NasdaqGS",
						regularMarketPrice: price,
						previousClose: prev,
						chartPreviousClose: prev,
						regularMarketTime: start + 3500,
					},
					timestamp: [start, start + 300, start + 600, start + 900],
					indicators: { quote: [{ close: [prev, (prev + price) / 2, price * 0.999, price] }] },
				},
			],
			error: null,
		},
	};
}

const fakeRequestUrl = vi.fn(async ({ url }: { url: string }) => {
	calls.push(url);
	const u = new URL(url);
	if (u.host.endsWith("finance.yahoo.com") && u.pathname === "/v1/finance/search") {
		return response({
			quotes: [
				{ symbol: "AAPL", shortname: "Apple Inc.", exchDisp: "NASDAQ", quoteType: "EQUITY" },
				{ symbol: "APC.DE", shortname: "Apple Inc.", exchDisp: "XETRA", quoteType: "EQUITY" },
			],
		});
	}
	if (u.host.endsWith("finance.yahoo.com") && u.pathname.startsWith("/v8/finance/chart/")) {
		const symbol = decodeURIComponent(u.pathname.split("/").pop() ?? "");
		if (symbol === "CZKEUR=X") return response(yahooChart(symbol, 0.0405, 0.0404, "CURRENCY", "EUR"));
		return response(yahooChart(symbol, 227.52, 226.37));
	}
	if (u.host === "geocoding-api.open-meteo.com") {
		return response({
			results: [{ name: "Prague", admin1: "Prague", country: "Czechia", latitude: 50.08, longitude: 14.42 }],
		});
	}
	if (u.host === "api.open-meteo.com") {
		const today = new Date().toISOString().slice(0, 10);
		const days = [0, 1, 2, 3, 4].map((i) => new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10));
		return response({
			timezone: "Europe/Prague",
			current: { time: `${today}T12:00`, temperature_2m: 18.4, apparent_temperature: 16.2, weather_code: 2, is_day: 1 },
			daily: {
				time: days,
				weather_code: [2, 3, 61, 0, 1],
				temperature_2m_max: [20, 17, 14, 22, 21],
				temperature_2m_min: [11, 9, 8, 10, 12],
			},
		});
	}
	if (u.host === "en.wikipedia.org" && u.pathname === "/w/rest.php/v1/search/title") {
		return response({ pages: [{ key: "Prague", title: "Prague" }] });
	}
	if (u.host === "en.wikipedia.org" && u.pathname === "/api/rest_v1/page/summary/Prague") {
		return response({
			title: "Prague",
			description: "Capital of the Czech Republic",
			extract: "Prague is the capital and largest city of the Czech Republic.",
			content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Prague" } },
		});
	}
	if (u.host === "api.frankfurter.app" && u.pathname === "/latest") {
		return response({ base: "EUR", rates: { CZK: 25, USD: 1.1 } });
	}
	return response({}, 404);
});

vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	requestUrl: (req: { url: string }) => fakeRequestUrl(req),
}));

let InstantAnswers: typeof import("../src/instantview").InstantAnswers;

beforeAll(async () => {
	installObsidianDom();
	({ InstantAnswers } = await import("../src/instantview"));
});

beforeEach(() => {
	calls.length = 0;
});

/** A panel whose "changed" resolves a promise, so a test can await arrivals. */
function panel(disabled = false) {
	let changes = 0;
	const answers = new InstantAnswers({
		externalCallsDisabled: () => disabled,
		changed: () => {
			changes++;
		},
	});
	const draw = (): HTMLElement => {
		const host = createDiv();
		answers.render(host, "t");
		return host;
	};
	return { answers, draw, changes: () => changes };
}

/** Let every pending fetch and its follow-ups settle. */
async function settle(): Promise<void> {
	for (let i = 0; i < 10; i++) await new Promise((r) => window.setTimeout(r, 0));
}

describe("instant answers panel", () => {
	it("answers a sum without a request", () => {
		const { answers, draw } = panel();
		expect(answers.setQuery("1+1")?.kind).toBe("calc");
		const el = draw();
		expect(el.querySelector(".hearth-instant-value")?.textContent).toBe("2");
		expect(answers.takesEnter()).toBe(true);
		expect(calls).toEqual([]);
	});

	it("draws nothing for a plain search", () => {
		const { answers, draw } = panel();
		expect(answers.setQuery("meeting notes")).toBeNull();
		expect(draw().childElementCount).toBe(0);
	});

	it("converts a currency and draws the pair's chart", async () => {
		const { answers, draw } = panel();
		answers.setQuery("20CZK to EUR");
		await settle();
		const el = draw();
		expect(el.querySelector(".hearth-instant-value")?.textContent).toBe("0.8 EUR");
		expect(el.querySelector(".hearth-instant-note")?.textContent).toContain("1 CZK = ");
		expect(el.querySelector(".hearth-instant-chart svg")).not.toBeNull();
		expect(el.querySelectorAll(".hearth-market-range").length).toBeGreaterThan(0);
	});

	it("looks a $ query up: quote, chart and the other matches", async () => {
		const { answers, draw, changes } = panel();
		answers.setQuery("$apple");
		expect(draw().querySelector(".hearth-instant-note")?.textContent).toBe("Loading…");
		await settle();
		expect(changes()).toBeGreaterThan(0);
		const el = draw();
		expect(el.querySelector(".hearth-instant-value")?.textContent).toBe("227.52");
		expect(el.querySelector(".hearth-instant-move")?.classList.contains("is-up")).toBe(true);
		expect(el.querySelector(".hearth-instant-chart svg")).not.toBeNull();
		expect(el.querySelectorAll(".hearth-instant-alt").length).toBe(1);
		expect(calls.some((c) => c.includes("/v1/finance/search"))).toBe(true);
	});

	it("fetches nothing with external calls disabled", async () => {
		const { answers, draw } = panel(true);
		answers.setQuery("$AAPL");
		await settle();
		expect(draw().querySelector(".hearth-instant-note")?.textContent).toMatch(/disabled/);
		expect(calls).toEqual([]);
	});

	it("a date leaves Enter to the notes", () => {
		const { answers, draw } = panel();
		answers.setQuery("days until 2099-01-01");
		expect(answers.takesEnter()).toBe(false);
		expect(draw().querySelector(".hearth-instant-value")?.textContent).toMatch(/^\d+ days$/);
		answers.setQuery("tomorrow");
		expect(draw().querySelector(".hearth-instant-note")?.textContent).toMatch(/^Tomorrow · Week \d+$/);
	});

	it("answers a stock asked for by name", async () => {
		const { answers, draw } = panel();
		answers.setQuery("apple stock");
		expect(answers.takesEnter()).toBe(true);
		await settle();
		expect(draw().querySelector(".hearth-instant-value")?.textContent).toBe("227.52");
	});

	it("shows the weather and the next days", async () => {
		const { answers, draw } = panel();
		answers.setQuery("weather Prague");
		await settle();
		const el = draw();
		expect(el.querySelector(".hearth-instant-value")?.textContent).toMatch(/^18°[CF] · /);
		expect(el.querySelector(".hearth-instant-note")?.textContent).toContain("Prague, Prague, Czechia");
		expect(el.querySelectorAll(".hearth-instant-day").length).toBeGreaterThan(0);
	});

	it("summarises a Wikipedia article", async () => {
		const { answers, draw } = panel();
		answers.setQuery("wiki prague");
		await settle();
		const el = draw();
		expect(el.querySelector(".hearth-instant-value")?.textContent).toBe("Prague");
		expect(el.querySelector(".hearth-instant-extract")?.textContent).toContain("capital");
	});

	it("flips a coin and rolls dice without a request", () => {
		const { answers, draw } = panel();
		answers.setQuery("coin flip");
		expect(["Heads", "Tails"]).toContain(draw().querySelector(".hearth-instant-value")?.textContent);
		answers.setQuery("roll 3d6");
		const sum = Number(draw().querySelector(".hearth-instant-value")?.textContent);
		expect(sum).toBeGreaterThanOrEqual(3);
		expect(sum).toBeLessThanOrEqual(18);
		expect(calls).toEqual([]);
	});
});
