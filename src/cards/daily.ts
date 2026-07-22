import { Component, Notice, setIcon, TFile } from "obsidian";
import {
	dailyNotesOptions,
	emptyState,
	renderEditableEmbed,
	renderMarkdownFile,
	todaysDailyNotePath,
	watchedCardPath,
} from "../cardbodies";
import { dailyEditor } from "../editors";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


/**
 * Embed today's daily note, resolved fresh on every render so the card always
 * tracks the current day. Falls back to a "create today's note" prompt when the
 * note doesn't exist yet, and respects the per-card editable toggle.
 */
export function renderDaily(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar", t().cards.empty.dailyEnable);
		return;
	}

	const path = todaysDailyNotePath(options);
	const file = view.app.vault.getAbstractFileByPath(path);

	if (!(file instanceof TFile)) {
		const empty = body.createDiv("hearth-card-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "calendar-plus");
		empty.createDiv({ cls: "hearth-card-empty-text", text: t().cards.daily.noNoteYet });
		const create = empty.createEl("button", {
			cls: "hearth-daily-create",
			text: t().cards.daily.createToday,
		});
		create.addEventListener("click", () => {
			// The core "Open today's daily note" command creates it from the
			// configured template and opens it.
			if (!view.app.commands.executeCommandById("daily-notes")) {
				new Notice(t().notices.couldNotOpenDaily);
			}
		});
		return;
	}

	// Optional button to open today's note in the editor (hideable). Rendered
	// as a floating overlay on the card element (not the body) so it doesn't
	// affect the body's scroll/flow.
	if (card.showOpenButton !== false) {
		const cardEl = body.closest(".hearth-card");
		const overlay = (cardEl ?? body).createDiv("hearth-card-actions-overlay");
		const open = overlay.createEl("button", {
			cls: "hearth-open-btn",
			attr: { "aria-label": t().cards.daily.openToday },
		});
		setIcon(open, "square-pen");
		open.addEventListener("click", () => {
			void view.app.workspace.getLeaf(true).openFile(file);
		});
	}

	if (card.editable) {
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	void renderMarkdownFile(view, file, host, component);
}

/** Today's daily note, embedded live. */
export const dailyCard: CardDefinition<"daily"> = {
	kind: "daily",
	templates: [
		{ id: "daily", name: "Daily note (today)", icon: "calendar", build: () => ({ kind: "daily", w: 6, h: 4 }) },
	],
	render: (view, card, body, component) => renderDaily(view, card, body, component),
	renderEditor: (container, ctx) => dailyEditor(ctx, container),
	liveness: {
		mode: "watch-file",
		watchedPath: (view, card) => watchedCardPath(view, card),
		editableInPlace: (card) => !!card.editable,
	},
};
