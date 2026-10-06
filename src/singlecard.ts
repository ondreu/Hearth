import { setIcon } from "./glyphs";
import { emptyState } from "./cardbodies";
import { t } from "./i18n";
import {
	activeDashboard,
	type Dashboard,
	effectiveArrangeButtonVisibility,
	singleBoardCard,
} from "./types";
import { cardFromTemplate } from "./cards";
import { openCardPicker } from "./cardpicker";
import { GRID_GAP, placeFreeform, ROW_HEIGHT } from "./grid";
import { openCardSettings, persistAndRender } from "./dashboard";
import { openDashboardSettings } from "./dashboards";
import type { HomeView } from "./view";

/**
 * A single-card board: a dashboard whose whole board is one of its own Hearth
 * cards, drawn at full size (Dashboard.mode === "single").
 *
 * The card itself is rendered by the ordinary board renderer — the same body,
 * frame, frost and live refresh as on a grid — and only its placement differs:
 * it fills the fitted board instead of sitting at its stored geometry. What
 * lives here is the chrome that replaces the arrange toolbar, which has nothing
 * to arrange on a board of one card.
 */

/**
 * Open the card picker and make the chosen card the one `dash` shows. The card
 * is added to the board's own cards like any other — placed into a free slot of
 * that board's grid — so switching the board back to cards keeps it. `dash`
 * need not be the active board: the dashboard settings open on any board.
 */
export function addSingleBoardCard(view: HomeView, dash: Dashboard, onAdded?: () => void): void {
	openCardPicker(view.app, {
		hearthVersion: view.plugin.manifest.version,
		onChoose: (template) => {
			const s = view.plugin.settings;
			const card = cardFromTemplate(template);
			placeFreeform(
				card,
				dash.cards,
				dash.maxWidth ?? s.maxWidth,
				dash.gridColumns ?? s.gridColumns,
				GRID_GAP,
				(dash.rowHeight ?? s.rowHeight) || ROW_HEIGHT,
			);
			dash.cards.push(card);
			dash.singleCardId = card.id;
			persistAndRender(view);
			onAdded?.();
		},
	});
}

/**
 * The board's actions, at the right-hand end of the switcher row the way a
 * plugin board places its gear: the card's own settings (title, source, look),
 * and the dashboard settings, where the board can be pointed at another card.
 */
export function renderSingleCardActions(view: HomeView, switcherZone: HTMLElement): void {
	const zone = switcherZone.createDiv("hearth-arrange-zone hearth-plugin-actions");
	zone.toggleClass(
		"is-auto-hide",
		effectiveArrangeButtonVisibility(view.plugin.settings) === "hover",
	);
	const dash = activeDashboard(view.plugin.settings);
	const card = singleBoardCard(dash);
	if (card) {
		const edit = zone.createEl("button", { cls: "hearth-tool-btn is-icon" });
		setIcon(edit.createSpan("hearth-tool-icon"), "pencil");
		edit.setAttribute("aria-label", t().dashboards.modal.singleCardEdit);
		edit.addEventListener("click", () => openCardSettings(view, card));
	}
	const btn = zone.createEl("button", { cls: "hearth-tool-btn is-icon" });
	setIcon(btn.createSpan("hearth-tool-icon"), "settings-2");
	btn.setAttribute("aria-label", t().dashboard.dashboardSettingsAria);
	btn.addEventListener("click", () => openDashboardSettings(view, dash));
}

/** What a single-card board shows before it has a card: a spoken empty state
 * and the one button that fixes it. */
export function renderSingleCardEmpty(view: HomeView, container: HTMLElement): void {
	const wrap = container.createDiv("hearth-single-card-empty");
	emptyState(wrap, "square", t().cards.empty.boardPickCard);
	const add = wrap.createEl("button", { cls: "mod-cta", text: t().dashboard.addCard });
	add.addEventListener("click", () =>
		addSingleBoardCard(view, activeDashboard(view.plugin.settings)),
	);
}
