/**
 * Keeping an open board current without rendering the ones nobody is looking at.
 *
 * Hearth re-renders a board whenever the thing it displays changes — the active
 * dashboard, a synced settings file, a vault write. A full board rebuild is the
 * most expensive thing the plugin does off its own render path, so a board that
 * is open but off screen (a backgrounded tab, a collapsed sidebar) is skipped:
 * nobody can see it, and it will be rendered before anybody can.
 *
 * That last half is the part that has to be true. It was not: `refreshViews`
 * skipped a hidden board and left the render to `active-leaf-change`, which does
 * not fire when the revealed leaf was already the active one in its group. So
 * "switch dashboard, then open Hearth" — a Commander macro, a note-toolbar
 * button, anything chaining the two commands — revealed the *previous*
 * dashboard, while each command on its own looked fine (#286).
 *
 * The fix is to remember the skip rather than assume it away. A board a refresh
 * passed over owes a render to whatever next puts it on screen, and every route
 * onto the screen — a reveal, a focus — asks here whether it is owed one.
 *
 * Deliberately DOM-free: callers decide what "visible" means (`leafIsVisible` in
 * `main.ts`) and do the rendering. This is the bookkeeping alone, which is the
 * part with the bug in it.
 */
export class BoardRefreshTracker<L extends object> {
	/** Boards that have been the active leaf at least once. Their first
	 * activation was the fresh onOpen render, so the focus refresh (#110) skips
	 * it — that also avoids clobbering any search focus set on open. */
	private seen = new WeakSet<L>();

	/** Boards a refresh passed over because they were off screen, and which are
	 * therefore showing something other than what settings now say. */
	private stale = new WeakSet<L>();

	/**
	 * A refresh reached this board. Returns whether to render it now; a `false`
	 * records that the board owes a render to whatever next shows it.
	 */
	refresh(leaf: L, visible: boolean): boolean {
		if (!visible) {
			this.stale.add(leaf);
			return false;
		}
		this.stale.delete(leaf);
		return true;
	}

	/**
	 * This board was revealed — brought on screen deliberately, by the ribbon,
	 * the "Open home dashboard" command or a chain ending in one. Returns whether
	 * it is owed a render. Revealing an already-current board renders nothing.
	 */
	reveal(leaf: L): boolean {
		if (!this.stale.has(leaf)) return false;
		this.stale.delete(leaf);
		return true;
	}

	/**
	 * This board became the active leaf. Returns whether to re-render it: on a
	 * genuine re-focus, yes (#110); on its very first activation, only if a
	 * refresh was skipped for it in the meantime, because then its onOpen render
	 * predates the change. A board mid-arrange is never rebuilt under the user's
	 * hands, and stays owed its render until the drag is done.
	 */
	focus(leaf: L, arranging: boolean): boolean {
		const owed = this.stale.has(leaf);
		const first = !this.seen.has(leaf);
		this.seen.add(leaf);
		if (first && !owed) return false;
		if (arranging) return false;
		this.stale.delete(leaf);
		return true;
	}
}
