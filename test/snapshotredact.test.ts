/**
 * @vitest-environment jsdom
 *
 * The blanking that happens before a board is photographed for the gallery.
 *
 * This is the one part of the capture that can be exercised without Electron —
 * and it is the part that, done wrong, either writes to somebody's vault or
 * publishes their notes. Both have happened: 3.1.0-beta.7 wrote block
 * characters into live notes, and 3.1.0-beta.8 could not take a picture at all
 * because a `Document` was asked to append a span to itself. Neither was caught
 * by 1470 passing tests, because nothing here had any.
 *
 * The Obsidian DOM helpers come from `test/support/obsidian-dom.ts`, which
 * implements them from the contract in `obsidian.d.ts` — "create an element and
 * append it to this node" — so a call that cannot work in Obsidian cannot pass
 * here either.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

installObsidianDom();

const { redact } = await import("../src/gallery/snapshot");

/**
 * A board: chrome outside the card bodies, the author's content inside them.
 * The caller fills the body, so every fixture's markup is a literal at the
 * place it is read.
 */
function board(): { root: HTMLElement; body: HTMLElement } {
	const root = document.body.createDiv("hearth-view");
	root.createDiv("hearth-header").createSpan({ cls: "hearth-vault", text: "My vault" });
	const card = root.createDiv("hearth-card");
	card.dataset.kind = "note";
	card.createDiv({ cls: "hearth-card-title", text: "Reading list" });
	return { root, body: card.createDiv("hearth-card-body") };
}

describe("redact", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("puts nothing into the Document, which cannot hold it", () => {
		// The beta.8 regression, stated as the DOM rule it broke: a Document
		// already has its one element child, so appending a second throws and
		// takes the capture down with it. The wrapper span belongs beside the
		// text it covers, never on the document.
		const { root, body } = board();
		body.createEl("p", { text: "The line a card is showing, " }).createEl("em", { text: "Italics and all" });
		const before = document.childNodes.length;

		expect(() => redact(root)).not.toThrow();

		expect(document.childNodes.length).toBe(before);
		expect(document.documentElement.tagName.toLowerCase()).toBe("html");
	});

	it("covers what a card holds, and leaves the board's own chrome alone", () => {
		const { root, body } = board();
		body.createEl("p", { text: "The line a card is showing" });
		const redaction = redact(root);

		expect(body.textContent).not.toContain("showing");
		expect(body.querySelector(".hearth-snapshot-bar")).not.toBeNull();

		// The thing being published has to stay recognisable as itself.
		expect(root.querySelector(".hearth-vault")!.textContent).toBe("My vault");
		expect(root.querySelector(".hearth-card-title")!.textContent).toBe("Reading list");

		redaction.restore();
	});

	it("gives back the exact text it covered", () => {
		const text = "The line a card is showing — page 41";
		const { root, body } = board();
		body.createEl("p", { text });

		const redaction = redact(root);
		expect(root.querySelector("p")!.textContent).not.toBe(text);

		redaction.restore();
		expect(root.querySelector("p")!.textContent).toBe(text);
		expect(root.querySelector(".hearth-snapshot-bar")).toBeNull();
		expect(root.classList.contains("hearth-snapshot-redacted")).toBe(false);
	});

	it("blanks an editor by style, never by writing to it", () => {
		// The beta.7 data loss: a live-preview note card hosts Obsidian's own
		// editor, which reads anything written into its contenteditable back as
		// typing and saves it. The blanking must not touch a character of it.
		const note = "The note itself, which is a file in the vault.";
		const { root, body } = board();
		const editable = body.createDiv("cm-editor").createDiv({ text: note });
		editable.setAttribute("contenteditable", "true");

		const redaction = redact(root);

		const editor = root.querySelector<HTMLElement>(".cm-editor")!;
		expect(editor.classList.contains("hearth-snapshot-blank")).toBe(true);
		expect(editor.textContent).toBe(note);

		redaction.restore();
		expect(editor.classList.contains("hearth-snapshot-blank")).toBe(false);
		expect(editor.textContent).toBe(note);
	});

	it("blanks a field's value by style, for the same reason", () => {
		// A raw-edit note card's textarea *is* the note, and its debounced save
		// writes whatever `value` holds at the moment it fires.
		//
		// Built the way the cards build it — `createEl("textarea")` and then
		// `area.value = content` (see `cardbodies.ts` and `cards/text.ts`) — not
		// as `<textarea>text</textarea>`. Assigning `value` sets the dirty value
		// flag and leaves the element without a child text node, which is why
		// the walk above genuinely never sees a field's contents. Written the
		// other way the fixture would be testing a DOM the plugin never makes.
		const { root, body } = board();
		const area = body.createEl("textarea");
		area.value = "Tomorrow: ring the dentist";

		const redaction = redact(root);

		const field = root.querySelector<HTMLTextAreaElement>("textarea")!;
		expect(field.classList.contains("hearth-snapshot-blank")).toBe(true);
		expect(field.value).toBe("Tomorrow: ring the dentist");

		redaction.restore();
		expect(field.classList.contains("hearth-snapshot-blank")).toBe(false);
	});

	it("covers rows that arrive after the first pass", () => {
		// A Bases embed renders when its query comes back, which can be after
		// the board has been blanked. `reapply` is what closes that gap.
		const { root, body } = board();
		const results = body.createDiv("results");
		const redaction = redact(root);

		results.createEl("p", { text: "A row nobody asked to publish" });
		redaction.reapply();

		expect(results.textContent).not.toContain("nobody asked");
		redaction.restore();
		expect(results.textContent).toBe("A row nobody asked to publish");
	});
});
