import { HomeView } from "./view";
import { PANE_VIEW_TYPE } from "./cardpanesidebar";

/**
 * A sidebar pane showing one card (#492).
 *
 * The pane is a Hearth view in every way that matters — it draws through the
 * same renderer, opens the same card settings and follows the same refresh
 * paths — but it is registered under its own view type so that "open Hearth"
 * can tell a 300px card in the sidebar apart from a board in a tab, and so the
 * two can be found separately in the workspace.
 *
 * The whole difference from a board is `getViewType`; the pane's rendering and
 * its leaf state are the parent's, keyed off `HomeView.cardPaneId`.
 */
export class CardPaneView extends HomeView {
	override getViewType(): string {
		return PANE_VIEW_TYPE;
	}
}
