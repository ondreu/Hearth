import { type App, Component } from "obsidian";
import { setIcon } from "./glyphs";
import { renderDashboard, openCardSettings } from "./dashboard";
import type { BoardHost } from "./cardhost";
import { paneBoard } from "./cardpanestate";
import { t } from "./i18n";
import { HearthModal } from "./uidesign";
import type HearthPlugin from "./main";
import { findCardById, type DashboardCard } from "./types";

/**
 * A card in a floating dialog (#491) — what a card's command opens.
 *
 * A board is the only thing that used to draw cards, so the dialog provides
 * what the board renderer reads off its view and nothing else: a fixed size,
 * no arrange mode, never stacked, and `render()` redrawing this dialog rather
 * than a tab. The card it draws is a single-card board, exactly like the
 * sidebar pane, so the frame, the body, the card's own views and its settings
 * dialog are the board's own.
 */

/** The board renderer's view, made out of a dialog. */
class CardDialogHost implements BoardHost {
	readonly contentEl: HTMLElement;
	readonly containerEl: HTMLElement;
	readonly arrangeMode = false;
	readonly phonePreview = false;
	readonly hideHeaderInArrange = false;

	constructor(
		readonly app: App,
		readonly plugin: HearthPlugin,
		private readonly el: HTMLElement,
		private readonly redraw: () => void,
	) {
		this.contentEl = el;
		this.containerEl = el;
	}

	/** A card that redraws itself after an edit redraws this dialog. */
	render(): void {
		this.redraw();
	}

	isStacked(): boolean {
		return false;
	}

	/** The dialog's width, not a tab's: the card's own container queries do the
	 * rest. */
	isNarrow(): boolean {
		return this.contentEl.clientWidth < 380;
	}
}

export class CardDialog extends HearthModal {
	private cardComponent: Component | null = null;

	/** The card is held by id, not by reference: its settings dialog can delete
	 * it, and the dialog has to notice rather than keep drawing a card that is
	 * no longer in the settings. */
	private readonly cardId: string;

	constructor(
		app: App,
		private readonly plugin: HearthPlugin,
		card: DashboardCard,
	) {
		super(app);
		this.cardId = card.id;
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-card-dialog");
		this.draw();
	}

	onClose(): void {
		this.cardComponent?.unload();
		this.cardComponent = null;
		this.contentEl.empty();
	}

	/** Draw the card into the dialog. Kept as its own method so a card asking
	 * for a redraw (after an edit) rebuilds only its own body. */
	private draw(): void {
		const card = findCardById(this.plugin.settings, this.cardId);
		// Deleted from its board — possibly from this very dialog — takes the
		// dialog with it: there is nothing left to show.
		if (!card) {
			this.close();
			return;
		}
		this.titleEl.setText(card.title?.trim() || t().editors.kinds[card.kind]);
		this.cardComponent?.unload();
		this.contentEl.empty();
		const body = this.contentEl.createDiv("hearth-card-dialog-body");
		const component = new Component();
		component.load();
		this.cardComponent = component;
		const host = new CardDialogHost(this.app, this.plugin, body, () => this.draw());
		renderDashboard(host, body, component, paneBoard(card));
		// The card that fills the dialog has no arrange header, so its settings
		// need somewhere to live: the same hover control the sidebar pane uses.
		const actions = body.createDiv("hearth-pane-actions");
		const gear = actions.createEl("button", {
			cls: "hearth-pane-action",
			attr: { "aria-label": t().cardPane.settings, type: "button" },
		});
		setIcon(gear, "settings-2");
		gear.addEventListener("click", () => openCardSettings(host, card));
	}
}

/** Open `card` in a floating dialog. */
export function openCardDialog(app: App, plugin: HearthPlugin, card: DashboardCard): void {
	new CardDialog(app, plugin, card).open();
}
