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
});
