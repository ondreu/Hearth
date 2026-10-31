/**
 * @vitest-environment jsdom
 *
 * #446 — a hotkey that puts the cursor in the board's search field needs a
 * focus helper a command can call on a board that is *already* open. The
 * startup focus (#115) is gated on a setting and on desktop; the command is
 * not: a pressed hotkey is an explicit request for the field, and on a phone
 * with a hardware keyboard it is the only way in. These tests drive the real
 * `HomeView` methods, so the two paths cannot quietly collapse into one.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";
import { DEFAULT_SETTINGS, type HomeSettings } from "../src/types";

type HomeViewClass = typeof import("../src/view").HomeView;

/** The two focus paths under test, reachable through the prototype. */
interface FocusPaths {
	focusSearch: (this: FakeView) => boolean;
	maybeFocusSearch: (this: FakeView) => void;
}

interface FakeView {
	plugin: { settings: HomeSettings };
	contentEl: HTMLElement;
	/** `maybeFocusSearch` delegates to the command path, so the stand-in needs
	 * the same method a real view has. */
	focusSearch(this: FakeView): boolean;
}

const platform = Platform as unknown as { isMobile: boolean; isDesktop: boolean };
const originalPlatform = { isMobile: platform.isMobile, isDesktop: platform.isDesktop };

let HomeView: HomeViewClass;
let paths: FocusPaths;

beforeAll(async () => {
	installObsidianDom();
	({ HomeView } = await import("../src/view"));
	paths = HomeView.prototype as unknown as FocusPaths;
});

beforeEach(() => {
	platform.isMobile = false;
	platform.isDesktop = true;
	document.body.empty();
});

afterEach(() => {
	platform.isMobile = originalPlatform.isMobile;
	platform.isDesktop = originalPlatform.isDesktop;
});

/** A view carrying the markup the board really renders: the search field lives
 * in the header, and only when the board has search switched on
 * (`effectiveShowSearch`). */
function fakeView(opts: { search?: boolean; focusOnOpen?: boolean } = {}): FakeView {
	const settings = structuredClone(DEFAULT_SETTINGS);
	settings.focusSearchOnOpen = opts.focusOnOpen ?? false;
	const contentEl = document.body.createDiv("hearth-view");
	if (opts.search ?? true) contentEl.createEl("input", { cls: "hearth-search-input" });
	const view: FakeView = {
		plugin: { settings },
		contentEl,
		focusSearch(this: FakeView): boolean {
			// `=== true` because `.call` is untyped without strictBindCallApply.
			return paths.focusSearch.call(this) === true;
		},
	};
	return view;
}

function field(view: FakeView): HTMLInputElement {
	const input = view.contentEl.querySelector<HTMLInputElement>(".hearth-search-input");
	if (!input) throw new Error("the test view was built without a search field");
	return input;
}

describe("focusSearch (the command path)", () => {
	it("focuses the field even with the startup setting off and on mobile", () => {
		platform.isMobile = true;
		const view = fakeView({ focusOnOpen: false });

		expect(paths.focusSearch.call(view)).toBe(true);
		expect(document.activeElement).toBe(field(view));
	});

	it("does nothing, and reports it, on a board without a search field", () => {
		const view = fakeView({ search: false });

		expect(paths.focusSearch.call(view)).toBe(false);
		expect(document.activeElement).toBe(document.body);
	});
});

describe("maybeFocusSearch (the startup path)", () => {
	it("stays gated on the setting", () => {
		const off = fakeView({ focusOnOpen: false });
		paths.maybeFocusSearch.call(off);
		expect(document.activeElement).toBe(document.body);

		const on = fakeView({ focusOnOpen: true });
		paths.maybeFocusSearch.call(on);
		expect(document.activeElement).toBe(field(on));
	});

	it("stays desktop only", () => {
		platform.isMobile = true;
		const view = fakeView({ focusOnOpen: true });

		paths.maybeFocusSearch.call(view);
		expect(document.activeElement).toBe(document.body);
	});
});
