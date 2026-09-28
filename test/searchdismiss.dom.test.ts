/**
 * @vitest-environment jsdom
 *
 * The search dropdown closes on a press anywhere outside the search section,
 * not only on a click: a phone sends no click for a tap on the board's
 * background or for a touch that turns into a scroll, and the dropdown stayed
 * open over the board.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import { DEFAULT_SETTINGS, type HomeSettings } from "../src/types";

vi.mock("obsidian", async (importOriginal) => {
	const real = await importOriginal<Record<string, unknown>>();
	class Component {
		registerDomEvent(el: EventTarget, type: string, fn: EventListener): void {
			el.addEventListener(type, fn);
		}
		register(): void {}
	}
	return { ...real, Component, prepareFuzzySearch: () => () => null };
});

let SearchSection: typeof import("../src/search").SearchSection;
let Component: typeof import("obsidian").Component;

beforeAll(async () => {
	installObsidianDom();
	const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
	proto.show ??= function (this: HTMLElement) {
		this.setCssProps({ display: "" });
	};
	proto.hide ??= function (this: HTMLElement) {
		this.setCssProps({ display: "none" });
	};
	proto.isShown ??= function (this: HTMLElement) {
		return this.style.display !== "none";
	};
	({ SearchSection } = await import("../src/search"));
	({ Component } = await import("obsidian"));
});

function mount() {
	const settings: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	settings.dashboards = [{ id: "d1", name: "D", cards: [] }];
	settings.activeDashboardId = "d1";
	settings.searchContents = false;
	document.body.empty();
	const root = document.body.createDiv();
	const view = {
		plugin: { settings },
		app: {
			vault: { getAllLoadedFiles: () => [], getAbstractFileByPath: () => null },
			loadLocalStorage: () => null,
			saveLocalStorage: () => {},
		},
		contentEl: root,
		containerEl: root,
	};
	const search = new SearchSection(view as never);
	const wrap = root.createDiv();
	search.renderBar(wrap);
	search.renderResultsAndFilters(wrap, wrap, new Component(), { filters: false });
	const outside = root.createDiv();
	const input = wrap.querySelector<HTMLInputElement>(".hearth-search-input")!;
	const results = wrap.querySelector<HTMLElement>(".hearth-search-results")!;
	input.value = "1+1";
	input.dispatchEvent(new Event("input"));
	return { results, outside };
}

const press = (el: Element) => el.dispatchEvent(new Event("pointerdown", { bubbles: true }));

describe("search dropdown dismissal", () => {
	it("closes on a press outside the search section", () => {
		const { results, outside } = mount();
		expect(results.style.display).not.toBe("none");
		press(outside);
		expect(results.style.display).toBe("none");
	});

	it("stays open for a press inside it", () => {
		const { results } = mount();
		press(results);
		expect(results.style.display).not.toBe("none");
	});
});
