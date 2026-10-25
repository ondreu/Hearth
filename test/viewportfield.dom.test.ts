/**
 * @vitest-environment jsdom
 *
 * #417 — the on-screen keyboard overlays the window instead of resizing the
 * leaf, so the board sizes itself against the *visual* viewport. When the
 * browser pans that viewport to reveal a focused card editor deep in the
 * board, `getBoundingClientRect()` already follows the pan (it is
 * visual-viewport relative), so the space left for the view is exactly
 * `vv.height - rect.top`. The old `vv.offsetTop + vv.height` counted the pan a
 * second time and pushed the bottom of the board behind the keyboard, while
 * the header search (pinned top, offsetTop 0) never showed the bug.
 *
 * These tests drive the real `HomeView` methods against a stand-in
 * visualViewport — jsdom has none, and the arithmetic is the whole fix.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";

type HomeViewClass = typeof import("../src/view").HomeView;

/** Only the two private methods under test, reachable through the prototype. */
interface Privates {
	trackViewport(this: FakeView): void;
	trackFieldFocus(this: FakeView): void;
}

interface FakeView {
	contentEl: HTMLElement;
	register(cb: () => void): void;
}

/** A stand-in for window.visualViewport (jsdom ships none). */
class FakeVisualViewport extends EventTarget {
	height = 800;
	width = 400;
	offsetTop = 0;
	offsetLeft = 0;
}

const platform = Platform as unknown as { isMobile: boolean; isDesktop: boolean };
const originalPlatform = { isMobile: platform.isMobile, isDesktop: platform.isDesktop };

let HomeView: HomeViewClass;
let priv: Privates;
let vv: FakeVisualViewport;

beforeAll(async () => {
	installObsidianDom();
	({ HomeView } = await import("../src/view"));
	priv = HomeView.prototype as unknown as Privates;
});

beforeEach(() => {
	platform.isMobile = true;
	platform.isDesktop = false;
	document.body.empty();
	vv = new FakeVisualViewport();
	Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
	Object.defineProperty(window, "innerHeight", { value: 800, configurable: true, writable: true });
});

afterEach(() => {
	vi.useRealTimers();
	platform.isMobile = originalPlatform.isMobile;
	platform.isDesktop = originalPlatform.isDesktop;
});

/** Where the browser reports an element that starts `top` px down the visible area. */
function rectAt(top: number): DOMRect {
	return new DOMRect(0, top, 0, 0);
}

/**
 * A view whose content element reports `top` in visual-viewport coordinates,
 * which is what the browser hands back after panning for the keyboard.
 */
function fakeView(top: number): { view: FakeView; contentEl: HTMLElement; cleanups: Array<() => void> } {
	const contentEl = document.body.createDiv("hearth-view");
	contentEl.getBoundingClientRect = () => rectAt(top);
	const cleanups: Array<() => void> = [];
	return {
		contentEl,
		cleanups,
		view: {
			contentEl,
			register: (cb: () => void) => {
				cleanups.push(cb);
				return cb;
			},
		},
	};
}

function vh(contentEl: HTMLElement): string {
	return contentEl.style.getPropertyValue("--hearth-vh");
}

describe("--hearth-vh measures the visual viewport (#417)", () => {
	it("fills the visible area while the keyboard is closed and nothing is panned", () => {
		const { view, contentEl } = fakeView(0);
		vv.height = 800;
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("800px");
	});

	it("subtracts the pan once, not twice — the reported overshoot", () => {
		// Keyboard up: 400px of page visible. The browser panned 150px to reveal
		// the focused editor, so the view's top sits 150px above the visual
		// viewport origin: 150px scrolled off + 400px visible = 550px of board.
		vv.height = 400;
		vv.offsetTop = 150;
		const { view, contentEl } = fakeView(-150);
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("550px");
		// The pre-fix (offsetTop + height) formula answered 700px here: 150px of
		// board taller than the space it has, hidden behind the keyboard.
		expect(vh(contentEl)).not.toBe("700px");
	});

	it("leaves only the space below a view that starts partway down the viewport", () => {
		vv.height = 400;
		const { view, contentEl } = fakeView(100);
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("300px");
	});

	it("clamps to zero when the view has been panned entirely out of sight", () => {
		vv.height = 400;
		const { view, contentEl } = fakeView(900);
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("0px");
	});

	it("rounds to whole pixels", () => {
		vv.height = 400;
		const { view, contentEl } = fakeView(10.4);
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("390px");
	});
});

describe("keyboard flag from the visual viewport", () => {
	it("flags the keyboard while the visible area is meaningfully shorter", () => {
		const { view, contentEl } = fakeView(0);
		vv.height = 400;
		priv.trackViewport.call(view);
		expect(contentEl.hasClass("hearth-kbd-open")).toBe(true);
	});

	it("drops the flag when the keyboard is back down", () => {
		const { view, contentEl } = fakeView(0);
		vv.height = 400;
		priv.trackViewport.call(view);
		vv.height = 800;
		vv.dispatchEvent(new Event("resize"));
		expect(contentEl.hasClass("hearth-kbd-open")).toBe(false);
	});

	it("re-measures on a visual viewport scroll (the pan itself)", () => {
		const { view, contentEl } = fakeView(0);
		vv.height = 400;
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("400px");
		// The browser pans further to keep the caret visible.
		contentEl.getBoundingClientRect = () => rectAt(-80);
		vv.dispatchEvent(new Event("scroll"));
		expect(vh(contentEl)).toBe("480px");
	});

	it("detaches its listeners when the view registers a teardown", () => {
		const { view, contentEl, cleanups } = fakeView(0);
		vv.height = 400;
		priv.trackViewport.call(view);
		for (const cb of cleanups) cb();
		vv.height = 200;
		vv.dispatchEvent(new Event("resize"));
		expect(vh(contentEl)).toBe("400px");
	});

	it("does nothing on desktop, where the keyboard doesn't exist", () => {
		platform.isMobile = false;
		platform.isDesktop = true;
		const { view, contentEl } = fakeView(0);
		vv.height = 400;
		priv.trackViewport.call(view);
		expect(vh(contentEl)).toBe("");
	});
});

describe("card fields on mobile (#417)", () => {
	/** A field with jsdom's missing scrollIntoView replaced by a spy. */
	function field(contentEl: HTMLElement, tag = "textarea"): { el: HTMLElement; scrolled: ReturnType<typeof vi.fn> } {
		const el = contentEl.createEl(tag as "textarea");
		const scrolled = vi.fn();
		el.scrollIntoView = scrolled;
		return { el, scrolled };
	}

	it("flags the view while a card editor holds focus, and caps the scroll area", () => {
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const area = field(contentEl);
		area.el.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(true);
	});

	it("re-settles the field once the keyboard has finished animating", () => {
		vi.useFakeTimers();
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const area = field(contentEl);
		area.el.focus();
		vi.advanceTimersByTime(299);
		expect(area.scrolled).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(area.scrolled).toHaveBeenCalledWith({ block: "nearest" });
	});

	it("doesn't yank a field that already lost focus back into view", () => {
		vi.useFakeTimers();
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const area = field(contentEl);
		area.el.focus();
		area.el.blur();
		vi.advanceTimersByTime(400);
		expect(area.scrolled).not.toHaveBeenCalled();
	});

	it("keeps the flag while focus moves between two fields", () => {
		vi.useFakeTimers();
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const first = field(contentEl);
		const second = field(contentEl);
		first.el.focus();
		second.el.focus();
		vi.advanceTimersByTime(250);
		expect(contentEl.hasClass("hearth-field-active")).toBe(true);
	});

	it("drops the flag once nothing on the board holds focus", () => {
		vi.useFakeTimers();
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const area = field(contentEl);
		area.el.focus();
		area.el.blur();
		vi.advanceTimersByTime(199);
		expect(contentEl.hasClass("hearth-field-active")).toBe(true);
		vi.advanceTimersByTime(1);
		expect(contentEl.hasClass("hearth-field-active")).toBe(false);
	});

	it("leaves the header search to its own keyboard handling", () => {
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const search = contentEl.createDiv("hearth-search");
		const input = search.createEl("input");
		input.className = "hearth-search-input";
		input.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(false);
	});

	it("ignores plain focusable chrome that isn't a field", () => {
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		contentEl.createDiv("hearth-card");
		const button = contentEl.createEl("button");
		button.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(false);
	});

	it("covers a contenteditable editor (hosted Live Preview, Bases)", () => {
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const editor = contentEl.createDiv("cm-editor");
		editor.setAttribute("contenteditable", "true");
		editor.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(true);
	});

	it("unwires itself on teardown", () => {
		const { view, contentEl, cleanups } = fakeView(0);
		priv.trackFieldFocus.call(view);
		for (const cb of cleanups) cb();
		const area = field(contentEl);
		area.el.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(false);
	});

	it("does nothing on desktop", () => {
		platform.isMobile = false;
		platform.isDesktop = true;
		const { view, contentEl } = fakeView(0);
		priv.trackFieldFocus.call(view);
		const area = field(contentEl);
		area.el.focus();
		expect(contentEl.hasClass("hearth-field-active")).toBe(false);
	});
});

/*
 * What this cannot cover, and belongs in the PR's vault checklist instead:
 * `.hearth-view.hearth-field-active .hearth-scroll` has to set
 * `height: var(--hearth-vh)` and the floating action bar has to hide while the
 * flag is on. The repository keeps stylesheet assertions out of the test suite
 * (no test reads styles.css or imports `node:fs`), so that half of the fix is
 * checked by hand on a phone.
 */
