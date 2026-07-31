import { Component, debounce, MarkdownRenderer } from "obsidian";
import { wireMarkdownCheckboxes, wireMarkdownLinks } from "../cardbodies";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Text / jot-down ----------------------------------------------------

export function renderText(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	body.addClass("is-jot-host");
	const preview = wrap.createDiv("hearth-jot-preview markdown-rendered");
	preview.setAttribute("title", t().cards.embed.editHint);
	wireMarkdownLinks(view, preview, "");
	// Ticking a checkbox edits the card's own text (issue #143). The jot isn't a
	// note, so its leading `---` is content, not frontmatter. Registered before
	// the dblclick-to-edit handler below so a quick double-tick doesn't open the
	// raw editor.
	wireMarkdownCheckboxes(
		preview,
		(fn) => {
			const next = fn(card.text ?? "");
			if (next !== (card.text ?? "")) {
				card.text = next;
				void view.plugin.saveData(view.plugin.settings);
			}
			return Promise.resolve();
		},
		{ skipFrontmatter: false },
	);
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-jot-edit",
		attr: { placeholder: t().cards.text.placeholder },
	});
	area.hide();

	const placeholder = t().cards.text.placeholder;
	const renderPreview = () => {
		preview.empty();
		const text = card.text ?? "";
		if (!text.trim()) {
			preview.addClass("is-empty");
			preview.setText(placeholder);
			return;
		}
		preview.removeClass("is-empty");
		// Render the jotted text as Markdown so headings, lists, checkboxes and
		// links all show, just like a note.
		void MarkdownRenderer.render(view.app, text, preview, "", component);
	};

	const enterEdit = () => {
		area.value = card.text ?? "";
		preview.hide();
		area.show();
		area.focus();
	};
	const leaveEdit = () => {
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);

	const save = debounce(
		() => {
			card.text = area.value;
			void view.plugin.saveData(view.plugin.settings);
		},
		500,
		true,
	);
	area.addEventListener("input", save);
	area.addEventListener("blur", () => {
		card.text = area.value;
		void view.plugin.saveData(view.plugin.settings);
		leaveEdit();
	});

	renderPreview();
}

/** A free-text jot-down note stored on the card. No settings. */
export const textCard: CardDefinition<"text"> = {
	kind: "text",
	templates: [
		{ id: "text", name: "Text / jot-down", icon: "pencil", build: () => ({ kind: "text", title: "Notes", text: "", w: 4, h: 2 }) },
	],
	render: (view, card, body, component) => renderText(view, card, body, component),
	liveness: { mode: "static" },
};
