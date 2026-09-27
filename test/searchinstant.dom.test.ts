/**
 * @vitest-environment jsdom
 *
 * The search bar with instant answers switched in: an empty bar offers the
 * tips once, a lone "?" always does, a sum answers above the (empty) note
 * results, and an answer switched off on the card or vault-wide stays silent.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import { DEFAULT_SETTINGS, type HomeSettings } from "../src/types";

const opened: string[] = [];

vi.mock("obsidian", async (importOriginal) => {
	const real = await importOriginal<Record<string, unknown>>();
	class Modal {
		app: unknown;
		modalEl = document.body.createDiv("modal");
		titleEl = this.modalEl.createDiv("modal-title");
		contentEl = this.modalEl.createDiv("modal-content");
		constructor(app: unknown) {
			this.app = app;
		}
		open(): void {
			opened.push(this.constructor.name);
			(this as unknown as { onOpen(): void }).onOpen();
		}
		close(): void {
			this.modalEl.remove();
		}
	}
	class Component {
		registerDomEvent(): void {}
		register(): void {}
	}
	// An empty vault never calls the matcher it prepares.
	return { ...real, Modal, Component, prepareFuzzySearch: () => () => null };
});

let SearchSection: typeof import("../src/search").SearchSection;
let Component: typeof import("obsidian").Component;

beforeAll(async () => {
	installObsidianDom();
	// Obsidian's show/hide helpers, which the dropdown uses; not part of the
	// shared DOM support, so stood in for here as display toggles.
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

beforeEach(() => {
	opened.length = 0;
	document.body.empty();
});

function mount(tweak: (s: HomeSettings) => void = () => {}, hiddenInstantAnswers?: string[]) {
	const settings: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	settings.dashboards = [{ id: "d1", name: "D", cards: [] }];
	settings.activeDashboardId = "d1";
	settings.searchContents = false;
	tweak(settings);
	const store = new Map<string, unknown>();
	const root = document.body.createDiv();
	const view = {
		plugin: { settings },
		app: {
			vault: { getAllLoadedFiles: () => [], getAbstractFileByPath: () => null },
			loadLocalStorage: (k: string) => store.get(k) ?? null,
			saveLocalStorage: (k: string, v: unknown) => store.set(k, v),
		},
		contentEl: root,
		containerEl: root,
	};
	const search = new SearchSection(view as never);
	const wrap = root.createDiv();
	search.renderBar(wrap);
	search.renderResultsAndFilters(wrap, wrap, new Component(), { filters: false, hiddenInstantAnswers });
	const input = wrap.querySelector<HTMLInputElement>(".hearth-search-input")!;
	const results = wrap.querySelector<HTMLElement>(".hearth-search-results")!;
	const type = (text: string) => {
		input.value = text;
		input.dispatchEvent(new Event("input"));
	};
	const enter = () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
	return { input, results, type, enter, store };
}

describe("search bar instant answers", () => {
	it("offers the tips once on an empty bar, until they're seen", () => {
		const { input, results, enter } = mount();
		input.dispatchEvent(new Event("focus"));
		expect(results.querySelector(".hearth-tips-hint .hearth-result-name")?.textContent).toMatch(/^New:/);
		enter();
		expect(opened).toEqual(["SearchTipsModal"]);
		input.dispatchEvent(new Event("focus"));
		// Nothing left to offer an empty bar in an empty vault: no dropdown.
		expect(results.style.display).toBe("none");
	});

	it("the hint can be dismissed without opening the tips", () => {
		const { input, results } = mount();
		input.dispatchEvent(new Event("focus"));
		results.querySelector<HTMLElement>(".hearth-tips-dismiss")!.click();
		expect(opened).toEqual([]);
		input.dispatchEvent(new Event("focus"));
		// Nothing left to offer an empty bar in an empty vault: no dropdown.
		expect(results.style.display).toBe("none");
	});

	it("a lone ? always offers the tips", () => {
		const { results, type, enter } = mount();
		type("?");
		expect(results.querySelector(".hearth-tips-hint .hearth-result-name")?.textContent).toBe("Search tips");
		enter();
		expect(opened).toEqual(["SearchTipsModal"]);
	});

	it("answers a sum above the notes, without a 'No matches'", () => {
		const { results, type } = mount();
		type("1+1");
		expect(results.querySelector(".hearth-instant-value")?.textContent).toBe("2");
		expect(results.querySelector(".hearth-search-empty")).toBeNull();
	});

	it("stays silent for an answer off on the card or vault-wide", () => {
		const card = mount(() => {}, ["calc"]);
		card.type("1+1");
		expect(card.results.querySelector(".hearth-instant")).toBeNull();

		const vault = mount((s) => (s.hiddenInstantAnswers = ["calc"]));
		vault.type("1+1");
		expect(vault.results.querySelector(".hearth-instant")).toBeNull();

		const off = mount((s) => (s.searchInstantAnswers = false));
		off.type("1+1");
		expect(off.results.querySelector(".hearth-instant")).toBeNull();
	});
});
