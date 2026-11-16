import type { App } from "obsidian";
import type HearthPlugin from "./main";

/**
 * What a card is allowed to ask of the thing drawing it (#491).
 *
 * A card used to be drawn only by a board, so its `render` took the board's
 * `HomeView`. A card can now also be drawn in a floating dialog — a host that
 * is not a view at all — so the contract is narrowed to the four things every
 * card actually uses. `HomeView` satisfies it as it stands, which is why no
 * card had to change shape, only its annotation.
 */
export interface CardHost {
	readonly app: App;
	readonly plugin: HearthPlugin;
	/** The element this host draws into, and its container — what the search
	 * section inside a search-bar card positions itself against. */
	readonly contentEl: HTMLElement;
	readonly containerEl: HTMLElement;
	/** Whether the surface being drawn is being arranged (a board) — never true
	 * for a dialog. */
	arrangeMode: boolean;
	/** Redraw this host. For a board that is a full rebuild; for a dialog it is
	 * the dialog's card, which is what a card calling it after an edit means. */
	render(): void;
	/** Whether the surface is a stacked (one-column) board. A dialog never is,
	 * which is what a card laying tiles out needs to know. */
	isStacked(): boolean;
}

/**
 * What drawing a *board* additionally needs — the board renderer reads these
 * off the view it is given, and a dialog that draws one card provides the
 * neutral answers (never previewing a phone, never stacked, its own width).
 */
export interface BoardHost extends CardHost {
	/** The arrange-mode phone preview, off outside the board's toolbar. */
	phonePreview: boolean;
	/** Whether card headers are hidden while arranging. */
	hideHeaderInArrange: boolean;
	isNarrow(): boolean;
}
