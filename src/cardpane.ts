import { type App, type Component, FuzzySuggestModal } from "obsidian";
import { setIcon } from "./glyphs";
import { emptyState } from "./cardbodies";
import { t } from "./i18n";
import { openCardSettings, renderDashboard } from "./dashboard";
import { type DashboardCard, type HomeSettings } from "./types";
import { paneBoard } from "./cardpanestate";
import type { HomeView } from "./view";

/**
 * A card shown on its own in Obsidian's right sidebar (#492).
 *
 * The pane is not a second renderer: it draws a *single-card board* — the mode
 * a dashboard already has for exactly this (`Dashboard.mode === "single"`) —
 * through the ordinary board renderer, into this view instead of into a tab's
 * board. What lives here is that drawing, and the two controls the card has
 * nowhere to put when it fills the whole pane.
 *
 * The card is referenced, never copied: the pane and the board it came from
 * draw the same object, so a settings change is visible in both without
 * reopening either.
 */

/**
 * Draw the pane's card into `root`.
 *
 * Same wrapper chain the view builds for a board (`hearth-scroll` →
 * `hearth-inner` → `hearth-dashboard`), because the card's sizing and the
 * single-card fill in styles.css are written against it — the only difference
 * is that the board handed to the renderer is the pane's own.
 */
export function renderCardPane(
	view: HomeView,
	card: DashboardCard,
	root: HTMLElement,
	child: Component,
): void {
	root.addClass("hearth-card-pane");
	const scroll = root.createDiv("hearth-scroll hearth-fit");
	const inner = scroll.createDiv("hearth-inner");
	const dashboard = inner.createDiv("hearth-dashboard");
	renderDashboard(view, dashboard, child, paneBoard(card));

	// The card fills the pane, so its own gear (which lives in the arrange
	// header) has nowhere to be. These two ride over its top-right corner and
	// appear on hover, the way the card's own overlay buttons do.
	const actions = root.createDiv("hearth-pane-actions");
	const gear = actions.createEl("button", {
		cls: "hearth-pane-action",
		attr: { "aria-label": t().cardPane.settings, type: "button" },
	});
	setIcon(gear, "settings-2");
	gear.addEventListener("click", () => openCardSettings(view, card));
	const close = actions.createEl("button", {
		cls: "hearth-pane-action",
		attr: { "aria-label": t().cardPane.close, type: "button" },
	});
	setIcon(close, "x");
	close.addEventListener("click", () => view.leaf.detach());
}

/**
 * The pane's card is gone — deleted from its board, or the whole board was.
 * Say so, and offer the one way out that isn't "reload and hope": point this
 * pane at another card.
 */
export function renderCardPaneMissing(view: HomeView, root: HTMLElement): void {
	root.addClass("hearth-card-pane");
	const wrap = root.createDiv("hearth-card-pane-empty");
	emptyState(wrap, "layout-panel-left", t().cardPane.missing);
	const pick = wrap.createEl("button", { cls: "mod-cta", text: t().cardPane.choose });
	pick.addEventListener("click", () => {
		new CardPanePickerModal(view.app, view.plugin.settings, (card) => {
			void view.setPaneCard(card.id);
		}).open();
	});
}

/** Pick any existing card — what an empty pane does when its card has gone. */
class CardPanePickerModal extends FuzzySuggestModal<DashboardCard> {
	constructor(
		app: App,
		private readonly settings: HomeSettings,
		private readonly choose: (card: DashboardCard) => void,
	) {
		super(app);
		this.setPlaceholder(t().cardPane.choosePlaceholder);
	}

	getItems(): DashboardCard[] {
		const cards: DashboardCard[] = [];
		for (const d of this.settings.dashboards) cards.push(...d.cards);
		cards.push(...this.settings.pinnedCards);
		return cards;
	}

	getItemText(card: DashboardCard): string {
		return card.title?.trim() || t().editors.kinds[card.kind];
	}

	onChooseItem(card: DashboardCard): void {
		this.choose(card);
	}
}
