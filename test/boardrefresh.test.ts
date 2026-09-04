import { describe, expect, it } from "vitest";
import { BoardRefreshTracker } from "../src/boardrefresh";

/** Stand-in for a WorkspaceLeaf: the tracker only ever uses it as an identity. */
const leaf = () => ({});

describe("BoardRefreshTracker", () => {
	describe("refresh", () => {
		it("renders a board that is on screen", () => {
			const t = new BoardRefreshTracker();
			expect(t.refresh(leaf(), true)).toBe(true);
		});

		it("skips a board that is off screen", () => {
			const t = new BoardRefreshTracker();
			expect(t.refresh(leaf(), false)).toBe(false);
		});
	});

	describe("reveal", () => {
		it("renders a board that missed a refresh while off screen", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.refresh(l, false);
			expect(t.reveal(l)).toBe(true);
		});

		it("renders nothing when the board is already current", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.refresh(l, true);
			expect(t.reveal(l)).toBe(false);
		});

		it("pays the debt once", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.refresh(l, false);
			expect(t.reveal(l)).toBe(true);
			expect(t.reveal(l)).toBe(false);
		});

		it("renders nothing for a board no refresh ever reached", () => {
			const t = new BoardRefreshTracker();
			expect(t.reveal(leaf())).toBe(false);
		});
	});

	describe("focus", () => {
		it("skips a leaf's first activation — that was its onOpen render", () => {
			const t = new BoardRefreshTracker();
			expect(t.focus(leaf(), false)).toBe(false);
		});

		it("re-renders on genuine re-focus (#110)", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.focus(l, false);
			expect(t.focus(l, false)).toBe(true);
		});

		it("renders on a first activation that missed a refresh", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.refresh(l, false);
			expect(t.focus(l, false)).toBe(true);
		});

		it("never rebuilds a board under a drag, and stays owed the render", () => {
			const t = new BoardRefreshTracker();
			const l = leaf();
			t.refresh(l, false);
			expect(t.focus(l, true)).toBe(false);
			expect(t.reveal(l)).toBe(true);
		});
	});

	it("tracks boards independently", () => {
		const t = new BoardRefreshTracker();
		const hidden = leaf();
		const shown = leaf();
		t.refresh(hidden, false);
		t.refresh(shown, true);
		expect(t.reveal(shown)).toBe(false);
		expect(t.reveal(hidden)).toBe(true);
	});

	// The bug itself (#286). "Switch to dashboard 2" then "Open home dashboard",
	// chained by a Commander macro from a note, with Hearth open behind the note
	// and already the active leaf in its group — so nothing fires the focus
	// refresh and the reveal is the only chance to render the new board.
	it("renders the newly switched board when a chained open reveals it", () => {
		const t = new BoardRefreshTracker();
		const hearth = leaf();
		t.focus(hearth, false); // opened and looked at earlier in the session

		t.refresh(hearth, false); // switch-dashboard-2, board off screen
		expect(t.reveal(hearth)).toBe(true); // open-home reveals it: render
	});
});
