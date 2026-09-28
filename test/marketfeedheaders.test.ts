/**
 * What the market feed sends with a request. On a phone a request goes out
 * through the app's native HTTP, whose own User-Agent Yahoo turns away, so it
 * introduces itself as the WebKit client it is; the desktop sends the
 * browser's own and is left alone.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Platform } from "obsidian";

const sent: { url: string; headers?: Record<string, string> }[] = [];

vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	requestUrl: (req: { url: string; headers?: Record<string, string> }) => {
		sent.push(req);
		return Promise.resolve({ status: 404, text: "", json: null, arrayBuffer: new ArrayBuffer(0) });
	},
}));

const { loadQuotes } = await import("../src/marketfeed");

afterEach(() => {
	sent.length = 0;
	Platform.isMobile = false;
});

describe("market feed request headers", () => {
	it("sends a browser User-Agent on a phone", async () => {
		Platform.isMobile = true;
		await loadQuotes([[{ provider: "yahoo", symbol: "SAP.DE" }]], { ttlMs: 60_000, force: true });
		expect(sent.length).toBeGreaterThan(0);
		for (const req of sent) expect(req.headers?.["User-Agent"]).toMatch(/^Mozilla\/5\.0 .*AppleWebKit/);
	});

	it("leaves the desktop's request as it was", async () => {
		await loadQuotes([[{ provider: "yahoo", symbol: "SAP.DE" }]], { ttlMs: 60_000, force: true });
		expect(sent.length).toBeGreaterThan(0);
		for (const req of sent) expect(req.headers).toBeUndefined();
	});
});
