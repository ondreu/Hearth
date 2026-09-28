/**
 * A card, large: terminal mode's zoom (`z`, or "Zoom" in the card menu).
 *
 * The same text renderer the card uses on the board, handed the dialog's size
 * instead of the frame's, so a card that is cramped on the board — a long task
 * list, a month of events, a feed — can be read and worked in at full size
 * without rearranging anything. Keys work inside it exactly as on the board.
 * A kind with no text renderer is drawn graphically, large.
 */
import { Component } from "obsidian";
import { createVaultEventHub } from "../cardevents";
import { mountCardBody } from "../dashboard";
import { t } from "../i18n";
import type { DashboardCard } from "../types";
import { HearthModal } from "../uidesign";
import type { HomeView } from "../view";
import { TuiCardHost } from "./host";
import { measureCell } from "./metrics";
import { tuiRenderer } from "./registry";
import { asciify } from "./text";

class TuiZoomModal extends HearthModal {
	private component = new Component();

	constructor(
		private view: HomeView,
		private card: DashboardCard,
	) {
		super(view.app);
	}

	onOpen(): void {
		this.modalEl.addClass("hearth-tui-zoom");
		const title = asciify(this.card.title?.trim() ?? "") || t().editors.kinds[this.card.kind];
		this.titleEl.setText(title);
		this.component.load();
		const events = createVaultEventHub(this.view.app, (ref) => this.component.registerEvent(ref));
		const body = this.contentEl.createDiv({ cls: "hearth-tui-zoombody", attr: { tabindex: "0" } });
		const renderer = tuiRenderer(this.card, this.view);

		if (!renderer) {
			const shell = body.createDiv("hearth-card hearth-tui-guicard");
			shell.dataset.kind = this.card.kind;
			mountCardBody(this.view, this.card, shell.createDiv("hearth-card-body"), this.component, events);
			return;
		}

		// Laid out once the dialog has its size.
		window.requestAnimationFrame(() => {
			if (!body.isConnected) return;
			const cell = measureCell(body);
			const size = () => ({
				cols: Math.max(20, Math.floor((body.clientWidth - 2) / cell.ch)),
				rows: Math.max(4, Math.floor(body.clientHeight / cell.lh)),
			});
			const host = new TuiCardHost(this.view, this.card, renderer, body, {
				zoomed: true,
				persistent: this.component,
				size,
				focused: () => true,
			});
			body.addEventListener("click", (e) => host.click(e));
			body.addEventListener("contextmenu", (e) => {
				if (host.contextMenu(e)) e.preventDefault();
			});
			body.addEventListener("keydown", (e) => {
				if (host.key(e)) {
					e.preventDefault();
					e.stopPropagation();
				}
			});
			host.redraw = mountCardBody(this.view, this.card, body, this.component, events, (child) => host.draw(child));
			body.focus({ preventScroll: true });
		});
	}

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
		// What was done in here (a task ticked, a day picked) shows on the board.
		this.view.render();
	}
}

/** Open `card` zoomed. */
export function openTuiZoom(view: HomeView, card: DashboardCard): void {
	new TuiZoomModal(view, card).open();
}
