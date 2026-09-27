/**
 * @vitest-environment jsdom
 *
 * A dialog opened from an Expressive card wears the design too: dressModal
 * puts the one class styles.css keys the dialog's look on, and inExpressiveCard
 * answers "was this drawn in an Expressive card?" from the element clicked.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Modal } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";

let dressModal: typeof import("../src/ui").dressModal;
let inExpressiveCard: typeof import("../src/ui").inExpressiveCard;

beforeAll(async () => {
	installObsidianDom();
	({ dressModal, inExpressiveCard } = await import("../src/ui"));
});

/** The part of a Modal dressModal touches: Obsidian builds `modalEl` in the
 * constructor, before `open()`. */
function modal(): Modal {
	return { modalEl: document.body.createDiv("modal") } as unknown as Modal;
}

describe("dressModal", () => {
	it("marks a dialog from an Expressive card, and leaves a Classic one alone", () => {
		const x = dressModal(modal(), true);
		expect(x.modalEl.classList.contains("hearth-x-modal")).toBe(true);
		expect(dressModal(modal(), false).modalEl.classList.contains("hearth-x-modal")).toBe(false);
	});

	it("states the design, so a dialog opened from this one inherits it", () => {
		expect(dressModal(modal(), true).modalEl.getAttribute("data-hearth-design")).toBe("expressive");
		expect(dressModal(modal(), false).modalEl.getAttribute("data-hearth-design")).toBe("classic");
	});

	it("returns the modal, so open() chains", () => {
		const m = modal();
		expect(dressModal(m, true)).toBe(m);
	});
});

describe("inExpressiveCard", () => {
	it("is true inside an Expressive card, however deep", () => {
		const card = document.body.createDiv("hearth-card");
		card.addClass("is-expressive");
		const row = card.createDiv("hearth-card-body").createDiv().createDiv("hearth-list-item");
		expect(inExpressiveCard(row)).toBe(true);
	});

	it("is false inside a Classic card, outside any card, or with nothing", () => {
		const row = document.body.createDiv("hearth-card").createDiv("hearth-list-item");
		expect(inExpressiveCard(row)).toBe(false);
		expect(inExpressiveCard(document.body.createDiv())).toBe(false);
		expect(inExpressiveCard(null)).toBe(false);
	});
});
