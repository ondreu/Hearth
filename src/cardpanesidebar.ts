import { type App, type WorkspaceLeaf } from "obsidian";
import type { DashboardCard } from "./types";
import { PANE_STATE_KEY, paneCardIdFromState } from "./cardpanestate";

/**
 * The workspace side of a sidebar card pane (#492): where its leaves live,
 * how to open one without duplicating another, and how to close it.
 *
 * Kept apart from the rendering (`src/cardpane.ts`) so the card settings dialog
 * can offer the switch without pulling the board renderer — and the card
 * registry behind it — into its own import graph.
 */

/** The view type the pane registers under in a tab (`main.ts`). */
export const PANE_VIEW_TYPE = "hearth-card-pane";

/** Every open pane leaf, in workspace order. */
export function cardPaneLeaves(app: App): WorkspaceLeaf[] {
	return app.workspace.getLeavesOfType(PANE_VIEW_TYPE);
}

/** Which card a pane leaf shows.
 *
 * The live view is asked first: it is the authority on what it is drawing, and
 * a view can be pointed at another card without the leaf's saved state having
 * been rewritten yet (`setPaneCard` asks Obsidian to save, it does not do it
 * synchronously). A leaf whose view Obsidian has not built — a collapsed
 * sidebar keeps a deferred one — only has the state it was saved with. */
function paneCardIdOf(leaf: WorkspaceLeaf): string | null {
	const view = leaf.view;
	if ("cardPaneId" in view && typeof view.cardPaneId === "string") return view.cardPaneId;
	return paneCardIdFromState(leaf.getViewState().state);
}

/** The open pane showing `cardId`, if there is one. */
export function cardPaneLeaf(app: App, cardId: string): WorkspaceLeaf | null {
	for (const leaf of cardPaneLeaves(app)) {
		if (paneCardIdOf(leaf) === cardId) return leaf;
	}
	return null;
}

/** Whether `cardId` is open in a sidebar pane. */
export function cardInSidebar(app: App, cardId: string): boolean {
	return cardPaneLeaf(app, cardId) !== null;
}

/**
 * Put a card in the right sidebar, or bring the pane that already shows it to
 * the front — opening the same card twice must not stack two panes on one
 * card. A phone has no right sidebar to put it in (`getRightLeaf` returns
 * null there), so the pane goes in a tab rather than nowhere.
 */
export async function openCardInSidebar(app: App, card: DashboardCard): Promise<void> {
	const existing = cardPaneLeaf(app, card.id);
	if (existing) {
		await app.workspace.revealLeaf(existing);
		return;
	}
	const leaf = app.workspace.getRightLeaf(false) ?? app.workspace.getLeaf("tab");
	await leaf.setViewState({
		type: PANE_VIEW_TYPE,
		state: { [PANE_STATE_KEY]: card.id },
		active: true,
	});
	await app.workspace.revealLeaf(leaf);
}

/** Close the pane showing `cardId`, if one is open. */
export function closeCardSidebar(app: App, cardId: string): void {
	cardPaneLeaf(app, cardId)?.detach();
}

/** Toggle the pane for `card` — what the card's own settings switch does. */
export async function setCardInSidebar(
	app: App,
	card: DashboardCard,
	open: boolean,
): Promise<void> {
	if (open) await openCardInSidebar(app, card);
	else closeCardSidebar(app, card.id);
}
