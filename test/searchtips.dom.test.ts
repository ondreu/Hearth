/**
 * @vitest-environment jsdom
 *
 * The search tips dialog: every syntax and every instant answer, with the
 * examples typed into the search bar it was opened from, and answers switched
 * off shown as off (their examples no longer clickable). Opening it marks the
 * tips as seen, which is what retires the one-time hint in the dropdown.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

vi.mock("obsidian", async (importOriginal) => {
	const real = await importOriginal<Record<string, unknown>>();
	/** Just enough of Obsidian's Modal: the elements it builds, open, close. */
	class Modal {
		app: unknown;
		modalEl = document.body.createDiv("modal");
		titleEl = this.modalEl.createDiv("modal-title");
		contentEl = this.modalEl.createDiv("modal-content");
		constructor(app: unknown) {
			this.app = app;
		}
		open(): void {
			(this as unknown as { onOpen(): void }).onOpen();
		}
		close(): void {
			this.modalEl.remove();
		}
	}
	return { ...real, Modal };
});

let tips: typeof import("../src/searchtips");

beforeAll(async () => {
	installObsidianDom();
	tips = await import("../src/searchtips");
});

function app() {
	const store = new Map<string, unknown>();
	return {
		loadLocalStorage: (k: string) => store.get(k) ?? null,
		saveLocalStorage: (k: string, v: unknown) => store.set(k, v),
	};
}

describe("search tips dialog", () => {
	it("lists the syntaxes and every answer, and marks itself seen", () => {
		const a = app();
		expect(tips.searchTipsSeen(a as never)).toBe(false);
		const modal = new tips.SearchTipsModal(a as never);
		modal.open();
		expect(modal.titleEl.textContent).toBe("What the search bar can do");
		expect(modal.contentEl.querySelectorAll(".hearth-tips-row").length).toBe(4 + 8);
		// Opened from a command there's no bar to type into: plain examples.
		expect(modal.contentEl.querySelector("button.hearth-tips-example")).toBeNull();
		expect(tips.searchTipsSeen(a as never)).toBe(true);
	});

	it("types a clicked example into the bar it was opened from", () => {
		const tried: string[] = [];
		const modal = new tips.SearchTipsModal(app() as never, { onTry: (e) => tried.push(e) });
		modal.open();
		const chip = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>("button.hearth-tips-example")).find(
			(b) => b.textContent === "1+1",
		);
		chip?.click();
		expect(tried).toEqual(["1+1"]);
		expect(modal.modalEl.isConnected).toBe(false);
	});

	it("shows a switched-off answer as off, without clickable examples", () => {
		const modal = new tips.SearchTipsModal(app() as never, {
			enabled: (f) => f !== "wiki",
			onTry: () => {},
		});
		modal.open();
		const off = Array.from(modal.contentEl.querySelectorAll(".hearth-tips-row.is-off"));
		expect(off.length).toBe(1);
		expect(off[0].querySelector(".hearth-tips-off")?.textContent).toBe("Off");
		expect(off[0].querySelector("button")).toBeNull();
	});
});
