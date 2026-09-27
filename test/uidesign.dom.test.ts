/**
 * @vitest-environment jsdom
 *
 * Where Hearth's own interface takes its design from (src/uidesign.ts): the
 * nearest thing around the element a dialog or menu was opened from that
 * states one — a card, else its board, else a dialog it sits in — and the
 * vault's design when nothing does.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Modal } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";

let ui: typeof import("../src/uidesign");

beforeAll(async () => {
	installObsidianDom();
	ui = await import("../src/uidesign");
});

/** A board in `board`'s design holding one card in `card`'s, and a button
 * inside the card and one on the board's toolbar. */
function board(boardDesign: "classic" | "expressive", cardDesign: "classic" | "expressive") {
	const view = document.body.createDiv("hearth-view");
	ui.stateDesign(view, boardDesign);
	const card = view.createDiv("hearth-card");
	ui.stateDesign(card, cardDesign);
	return {
		inCard: card.createDiv("hearth-card-body").createEl("button"),
		onBoard: view.createDiv("hearth-toolbar").createEl("button"),
	};
}

describe("designFromOrigin", () => {
	it("takes a card's design over its board's", () => {
		const { inCard } = board("expressive", "classic");
		expect(ui.designFromOrigin(inCard, "expressive")).toBe("classic");
		const other = board("classic", "expressive");
		expect(ui.designFromOrigin(other.inCard, "classic")).toBe("expressive");
	});

	it("takes the board's design outside any card, over the vault's", () => {
		const { onBoard } = board("classic", "expressive");
		expect(ui.designFromOrigin(onBoard, "expressive")).toBe("classic");
	});

	it("falls back to the vault's design where nothing states one", () => {
		const loose = document.body.createDiv().createEl("button");
		expect(ui.designFromOrigin(loose, "expressive")).toBe("expressive");
		expect(ui.designFromOrigin(null, "classic")).toBe("classic");
		expect(ui.designFromOrigin(undefined, "expressive")).toBe("expressive");
	});

	it("ignores a stated value that is not a design", () => {
		const el = document.body.createDiv();
		el.setAttribute(ui.DESIGN_ATTR, "neon");
		expect(ui.designFromOrigin(el, "classic")).toBe("classic");
	});
});

describe("applyModalDesign", () => {
	/** The part of a Modal it touches, as Obsidian builds it before `open()`. */
	const modal = (): Modal => ({ modalEl: document.body.createDiv("modal") }) as unknown as Modal;

	it("dresses the dialog and states its design for what opens from it", () => {
		const m = modal();
		ui.applyModalDesign(m, "expressive");
		expect(m.modalEl.classList.contains(ui.X_MODAL_CLASS)).toBe(true);
		const confirm = m.modalEl.createDiv().createEl("button");
		expect(ui.designFromOrigin(confirm, "classic")).toBe("expressive");
	});

	it("undresses it again for Classic", () => {
		const m = modal();
		ui.applyModalDesign(m, "expressive");
		ui.applyModalDesign(m, "classic");
		expect(m.modalEl.classList.contains(ui.X_MODAL_CLASS)).toBe(false);
		expect(ui.designFromOrigin(m.modalEl, "expressive")).toBe("classic");
	});
});

describe("currentUiDesign", () => {
	it("is the vault's until a press is remembered", () => {
		expect(ui.currentUiDesign()).toBe("classic");
	});
});
