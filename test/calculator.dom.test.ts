/**
 * @vitest-environment jsdom
 *
 * The calculator card as drawn: its result line and its keypad, with the
 * number format the card's settings chose. The engine is covered in
 * calculator.test.ts; this pins that the setting actually reaches it — a
 * separator that formats results but is never passed to `evaluate` would look
 * correct here only if this test went through the card's own renderer.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { CardHost } from "../src/cardhost";
import type { CalculatorConfig, DashboardCard } from "../src/types";

let renderCalculator: typeof import("../src/cards/calculator").renderCalculator;

beforeAll(async () => {
	installObsidianDom();
	({ renderCalculator } = await import("../src/cards/calculator"));
});

/** A host that answers only what a rendered card asks of it. */
function host(): CardHost {
	const plugin = { settings: { disableExternalCalls: true }, saveData: async () => {} };
	return { plugin } as unknown as CardHost;
}

function draw(calculator: CalculatorConfig): HTMLElement {
	const body = document.body.createDiv();
	const card: DashboardCard = { id: "calc", kind: "calculator", title: "Calculator", x: 0, y: 0, w: 4, h: 3, calculator };
	renderCalculator(host(), card, body);
	return body;
}

/** Type into the card's field the way a user does, and let it redraw. */
function type(body: HTMLElement, text: string): string {
	const input = body.querySelector<HTMLInputElement>(".hearth-calc-input");
	if (!input) throw new Error("no calculator input");
	input.value = text;
	input.dispatchEvent(new Event("input"));
	return body.querySelector(".hearth-calc-result")?.textContent ?? "";
}

describe("the calculator card's number format", () => {
	it("writes results with a dot by default", () => {
		const body = draw({});
		expect(type(body, "1.5 + 3")).toBe("4.5");
	});

	it("writes results with a comma when the card asks for it", () => {
		const body = draw({ decimalSeparator: "," });
		expect(type(body, "1,5 + 3")).toBe("4,5");
		expect(type(body, "1500 * 2")).toBe("3\u00A0000");
	});

	it("puts the chosen separator on the keypad", () => {
		const labels = (calculator: CalculatorConfig) =>
			Array.from(draw(calculator).querySelectorAll(".hearth-calc-key"), (key) => key.textContent);
		expect(labels({ keypad: "basic" })).toContain(".");
		expect(labels({ keypad: "basic" })).not.toContain(",");
		expect(labels({ keypad: "basic", decimalSeparator: "," })).toContain(",");
		expect(labels({ keypad: "basic", decimalSeparator: "," })).not.toContain(".");
	});

	it("copies the result the card is showing", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		const body = draw({ decimalSeparator: "," });
		expect(type(body, "1,5 + 3")).toBe("4,5");
		body.querySelector<HTMLButtonElement>(".hearth-calc-copy")?.click();
		await Promise.resolve();
		expect(writeText).toHaveBeenCalledWith("4,5");
	});

	it("offers nothing to copy while the query is empty or invalid", () => {
		const hidden = (body: HTMLElement) =>
			body.querySelector(".hearth-calc-actions")?.classList.contains("is-hidden");
		const body = draw({});
		expect(hidden(body)).toBe(true);
		type(body, "2 + 2");
		expect(hidden(body)).toBe(false);
		type(body, "2 +");
		expect(hidden(body)).toBe(true);
		type(body, "");
		expect(hidden(body)).toBe(true);
	});
});
