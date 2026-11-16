import { t } from "./i18n";
import { findCardById, type Dashboard, type DashboardCard, type HomeSettings } from "./types";

/**
 * The state a sidebar card pane (#492) keeps — separated from the pane's
 * rendering so it can be tested without a DOM, an Obsidian view or the card
 * registry behind it.
 *
 * A pane is a leaf that shows one card; what it needs to remember is which
 * card, and what the board it draws looks like.
 */

/** Leaf state key holding the card this pane shows. */
export const PANE_STATE_KEY = "card";

/** The card id a leaf state names, or null when the state isn't a pane's. */
export function paneCardIdFromState(state: unknown): string | null {
	if (!state || typeof state !== "object") return null;
	const raw = (state as Record<string, unknown>)[PANE_STATE_KEY];
	return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** The card a pane draws right now, or null when it has gone. */
export function paneCard(settings: HomeSettings, cardId: string): DashboardCard | null {
	return findCardById(settings, cardId);
}

/**
 * The board a pane draws: the card, and nothing else.
 *
 * It is a board in the model — so the ordinary renderer, the card's own views
 * and its settings dialog keep working — but never one the user can switch to:
 * it is not in `settings.dashboards`, so it cannot appear in the switcher, be
 * edited as a board, or be exported as one. The id follows the card, so a pane
 * is a board of its own wherever a board id is used for identity.
 */
export function paneBoard(card: DashboardCard): Dashboard {
	return {
		id: `pane-${card.id}`,
		name: card.title?.trim() || t().editors.kinds[card.kind],
		mode: "single",
		cards: [card],
		singleCardId: card.id,
	};
}
