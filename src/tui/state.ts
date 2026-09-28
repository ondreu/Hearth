/**
 * What terminal mode remembers about one Hearth tab between renders.
 *
 * A board is rebuilt from scratch on every settings save, and a card body on
 * every vault change, so anything the user did to a card that isn't a setting
 * — which card has the keyboard, which row is selected, which month a calendar
 * is on — would be lost many times a minute if it lived in the render. It
 * lives here instead, on the view (src/view.ts), for as long as the tab is
 * open. None of it is written to settings: it describes how someone is looking
 * at a board, not the board.
 */
export class TuiViewState {
	/** The card with the keyboard, by id. */
	focus: string | null = null;
	/** Each card's selected item. */
	private selected = new Map<string, number>();
	/** Each card's own renderer state. */
	private cardState = new Map<string, Record<string, unknown>>();
	/** Stacked cards the user has opened this session. */
	readonly expanded = new Set<string>();
	/** The status line's message, and when it was set. */
	message = "";
	messageAt = 0;

	selection(cardId: string): number {
		return this.selected.get(cardId) ?? 0;
	}

	setSelection(cardId: string, index: number): void {
		this.selected.set(cardId, Math.max(0, index));
	}

	state(cardId: string): Record<string, unknown> {
		let s = this.cardState.get(cardId);
		if (!s) {
			s = {};
			this.cardState.set(cardId, s);
		}
		return s;
	}

	say(message: string): void {
		this.message = message;
		this.messageAt = Date.now();
	}
}
