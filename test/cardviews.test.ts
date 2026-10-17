import { describe, expect, it } from "vitest";
import {
	activeViewCard,
	activeViewIndex,
	cardViews,
	detachView,
	foldSecondViews,
	hasViews,
	mergeCards,
	moveView,
	removeView,
	resolveViewSwitcher,
	rotateSeconds,
	sanitizeViewSwitcher,
	secondViewAsView,
	setActiveViewIndex,
	splitForNarrow,
	splitViews,
	stepViewIndex,
	stripFrame,
	withViews,
} from "../src/cardviews";
import { cloneCard } from "../src/cards";
import { sanitizeCard, scrubCard } from "../src/layout";
import { cardReferences } from "../src/portable/refs";
import { type DashboardCard, hydrateSettings } from "../src/types";

/**
 * Cards with several views (#385). The model is pure data — a card and the
 * whole cards in its `views` — so what these pin is that the shuffling keeps
 * every view's content with it, the frame with the card on the board, and the
 * view on show where the user left it; and that every way into settings (load,
 * import, export) carries views and folds the embed card's old second view.
 */

function card(id: string, extra: Partial<DashboardCard> = {}): DashboardCard {
	return { id, kind: "text", x: 1, y: 2, w: 4, h: 3, ...extra };
}

/** A card with views b and c, content told apart by `text`. */
function threeViews(): DashboardCard {
	return card("a", {
		text: "A",
		title: "Board card",
		fx: 0.1,
		fy: 20,
		fw: 0.5,
		fh: 300,
		accent: "#f00",
		views: [card("b", { text: "B" }), card("c", { kind: "clock", text: undefined })],
	});
}

function roundTrip<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

describe("the views of a card", () => {
	it("are the card itself followed by its views", () => {
		const host = threeViews();
		expect(cardViews(host).map((c) => c.id)).toEqual(["a", "b", "c"]);
		expect(hasViews(host)).toBe(true);
		expect(cardViews(card("solo"))).toHaveLength(1);
		expect(hasViews(card("solo", { views: [] }))).toBe(false);
	});

	it("flatten across a board for the walks that read content", () => {
		expect(withViews([threeViews(), card("d")]).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
	});
});

describe("the view on show", () => {
	it("starts on the card itself and is kept in memory, not on the card", () => {
		const host = threeViews();
		expect(activeViewIndex(host)).toBe(0);
		expect(setActiveViewIndex(host, 2)).toBe(false);
		expect(activeViewIndex(host)).toBe(2);
		expect(activeViewCard(host).id).toBe("c");
		expect(host.activeView).toBeUndefined();
	});

	it("is written to the card, and asks for a save, only when remembered", () => {
		const host = threeViews();
		host.viewSwitcher = { rememberView: true };
		expect(setActiveViewIndex(host, 1)).toBe(true);
		expect(host.activeView).toBe(1);
		expect(setActiveViewIndex(host, 1)).toBe(false);
		expect(setActiveViewIndex(host, 0)).toBe(true);
		expect(host.activeView).toBeUndefined();
	});

	it("falls back to the first view when the one on show is gone", () => {
		const host = threeViews();
		host.viewSwitcher = { rememberView: true };
		host.activeView = 7;
		expect(activeViewIndex(host)).toBe(0);
	});

	it("steps round in both directions", () => {
		const host = threeViews();
		expect(stepViewIndex(host, 1)).toBe(1);
		expect(stepViewIndex(host, -1)).toBe(2);
		setActiveViewIndex(host, 2);
		expect(stepViewIndex(host, 1)).toBe(0);
	});

	it("hands every view the card's design, which kinds read while drawing", () => {
		const host = threeViews();
		host.design = "expressive";
		setActiveViewIndex(host, 1);
		expect(activeViewCard(host).design).toBe("expressive");
		host.design = undefined;
		expect(activeViewCard(host).design).toBeUndefined();
	});
});

describe("merging", () => {
	it("appends the other card and its views, without their frame", () => {
		const host = card("a", { fx: 0.1 });
		const other = card("o", {
			text: "O",
			fx: 0.7,
			accent: "#0f0",
			pinned: true,
			mobile: { hidden: true },
			views: [card("o2", { text: "O2", accent: "#00f" })],
			viewSwitcher: { style: "dots" },
		});
		mergeCards(host, other);
		expect(cardViews(host).map((c) => c.id)).toEqual(["a", "o", "o2"]);
		for (const view of host.views ?? []) {
			expect(view.fx).toBeUndefined();
			expect(view.accent).toBeUndefined();
			expect(view.pinned).toBeUndefined();
			expect(view.mobile).toBeUndefined();
			expect(view.views).toBeUndefined();
			expect(view.viewSwitcher).toBeUndefined();
		}
		expect(host.views?.[0].text).toBe("O");
		expect(host.fx).toBe(0.1);
	});

	it("keeps a merged card's title as its label in the switcher", () => {
		const host = card("a");
		mergeCards(host, card("o", { title: "Tasks" }));
		expect(host.views?.[0].title).toBeUndefined();
		expect(host.views?.[0].viewLabel).toBe("Tasks");
		const labelled = card("b");
		mergeCards(labelled, card("p", { title: "Tasks", viewLabel: "Inbox" }));
		expect(labelled.views?.[0].viewLabel).toBe("Inbox");
	});

	it("renames a view whose id clashes, since ids key per-card memory", () => {
		const host = card("a", { views: [card("x")] });
		mergeCards(host, card("x"));
		const ids = cardViews(host).map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("reordering", () => {
	it("moves a view and keeps the view on show on show", () => {
		const host = threeViews();
		setActiveViewIndex(host, 2);
		expect(moveView(host, 2, 1)).toBe(true);
		expect(cardViews(host).map((c) => c.text ?? c.kind)).toEqual(["A", "clock", "B"]);
		expect(activeViewCard(host).kind).toBe("clock");
	});

	it("moves content, not the frame, when the first view changes", () => {
		const host = threeViews();
		expect(moveView(host, 0, 2)).toBe(true);
		// The object on the board is still `a`, with its frame and title-less
		// content swapped for B's.
		expect(host.id).toBe("a");
		expect(host.fx).toBe(0.1);
		expect(host.accent).toBe("#f00");
		expect(cardViews(host).map((c) => c.text ?? c.kind)).toEqual(["B", "clock", "A"]);
		// The title heads the card, so it stays with the card.
		expect(host.title).toBe("Board card");
		expect(cardViews(host)[2].title).toBeUndefined();
	});

	it("does nothing for an out-of-range or empty move", () => {
		const host = threeViews();
		expect(moveView(host, 1, 1)).toBe(false);
		expect(moveView(host, 0, 9)).toBe(false);
	});
});

describe("moving views out", () => {
	it("detaches a view as a card with the host's look and size, unplaced", () => {
		const host = threeViews();
		const out = detachView(host, 1);
		expect(out?.text).toBe("B");
		expect(out?.accent).toBe("#f00");
		expect(out?.fw).toBe(0.5);
		expect(out?.fh).toBe(300);
		expect(out?.fx).toBeUndefined();
		expect(out?.x).toBe(-1);
		expect(cardViews(host).map((c) => c.id)).toEqual(["a", "c"]);
	});

	it("titles a detached view with its label", () => {
		const host = card("a", { views: [card("b", { viewLabel: "Inbox" })] });
		const out = detachView(host, 1);
		expect(out?.title).toBe("Inbox");
		expect(out?.viewLabel).toBeUndefined();
	});

	it("detaches the card's own content and promotes the next view", () => {
		const host = threeViews();
		const out = detachView(host, 0);
		expect(out?.text).toBe("A");
		expect(host.id).toBe("a");
		expect(host.text).toBe("B");
		expect(host.fx).toBe(0.1);
	});

	it("drops the views settings with the last view", () => {
		const host = card("a", { views: [card("b")], viewSwitcher: { style: "dots" }, activeView: 1 });
		expect(removeView(host, 1)).toBe(true);
		expect(host.views).toBeUndefined();
		expect(host.viewSwitcher).toBeUndefined();
		expect(host.activeView).toBeUndefined();
		expect(removeView(host, 0)).toBe(false);
	});

	it("splits every view into a card of its own, in order", () => {
		const host = threeViews();
		const out = splitViews(host);
		expect(out.map((c) => c.id)).toEqual(["b", "c"]);
		expect(hasViews(host)).toBe(false);
	});

	it("lays views out for the narrow column without changing anything", () => {
		const host = threeViews();
		const before = roundTrip(host);
		expect(splitForNarrow(host).map((c) => c.id)).toEqual(["a", "b", "c"]);
		expect(roundTrip(host)).toEqual(before);
	});
});

describe("the switcher's settings", () => {
	it("defaults to tabs in the header of a titled card, in a corner on hover otherwise", () => {
		const host = threeViews();
		expect(resolveViewSwitcher(host, true)).toMatchObject({
			placement: "header",
			style: "tabs",
			reveal: "always",
			swipe: true,
			rememberView: false,
			rotateSec: 0,
			narrow: "switcher",
		});
		expect(resolveViewSwitcher(host, false)).toMatchObject({ placement: "top-right", reveal: "hover" });
	});

	it("moves a header switcher into a corner on a card without a header", () => {
		const host = threeViews();
		host.viewSwitcher = { placement: "header" };
		expect(resolveViewSwitcher(host, false).placement).toBe("top-right");
	});

	it("keeps rotation between 3 seconds and an hour, or off", () => {
		expect(rotateSeconds(1)).toBe(3);
		expect(rotateSeconds(10.4)).toBe(10);
		expect(rotateSeconds(99999)).toBe(3600);
		expect(rotateSeconds(0)).toBe(0);
		expect(rotateSeconds(-5)).toBe(0);
		expect(rotateSeconds("10")).toBe(0);
	});

	it("sanitizes to known values and drops an empty result", () => {
		expect(
			sanitizeViewSwitcher({ placement: "middle", style: "dots", rotateSec: 1, swipe: false, extra: 1 }),
		).toEqual({ style: "dots", rotateSec: 3, swipe: false });
		expect(sanitizeViewSwitcher({ placement: "nowhere" })).toBeUndefined();
		expect(sanitizeViewSwitcher("tabs")).toBeUndefined();
	});
});

describe("the embed card's old second view", () => {
	const legacy = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
		id: "e1",
		kind: "embed",
		title: "Notes",
		target: "A.md",
		hideBaseHeader: true,
		x: 0,
		y: 0,
		w: 6,
		h: 3,
		secondView: { target: "B.base", baseView: "Table", scale: 0.8, editable: true },
		...extra,
	});

	it("becomes the card's first view, drawing as it did", () => {
		const out = secondViewAsView(legacy());
		expect(out.secondView).toBeUndefined();
		expect(out.views).toEqual([
			{
				id: "e1-view-2",
				kind: "embed",
				x: 0,
				y: 0,
				w: 1,
				h: 1,
				target: "B.base",
				baseView: "Table",
				scale: 0.8,
				editable: true,
				hideBaseHeader: true,
			},
		]);
		expect(out.target).toBe("A.md");
	});

	it("is dropped when it never had a target", () => {
		const out = secondViewAsView(legacy({ secondView: { target: "  " } }));
		expect(out.secondView).toBeUndefined();
		expect(out.views).toBeUndefined();
	});

	it("goes ahead of views the card already has, with an id of its own", () => {
		const out = secondViewAsView(legacy({ views: [{ id: "e1-view-2", kind: "clock" }] }));
		const ids = (out.views as { id: string }[]).map((v) => v.id);
		expect(ids).toEqual(["e1-view-2-2", "e1-view-2"]);
	});

	it("leaves its input untouched and is deterministic", () => {
		const input = legacy();
		const copy = roundTrip(input);
		expect(secondViewAsView(input)).toEqual(secondViewAsView(copy));
		expect(input).toEqual(copy);
	});

	it("folds in place and says whether it did", () => {
		const cards: unknown[] = [legacy(), { id: "c", kind: "clock" }];
		expect(foldSecondViews(cards)).toBe(true);
		expect(foldSecondViews(cards)).toBe(false);
		expect(foldSecondViews(undefined)).toBe(false);
	});

	it("is folded on load, pinned cards included, once", () => {
		const raw = {
			dashboards: [{ id: "b1", name: "One", cards: [legacy()] }],
			activeDashboardId: "b1",
			pinnedCards: [legacy({ id: "p1", pinned: true })],
		};
		const first = hydrateSettings(roundTrip(raw));
		expect(first.migrated).toBe(true);
		expect(first.settings.dashboards[0].cards[0].views?.[0].target).toBe("B.base");
		expect(first.settings.pinnedCards[0].views?.[0].id).toBe("p1-view-2");
		const second = hydrateSettings(roundTrip(first.settings) as unknown as Record<string, unknown>);
		expect(second.migrated).toBe(false);
		expect(second.settings.dashboards).toEqual(first.settings.dashboards);
	});

	it("is folded on import", () => {
		const out = sanitizeCard(legacy(), 0);
		expect(out?.views?.[0]).toMatchObject({ kind: "embed", target: "B.base", baseView: "Table" });
		expect((out as unknown as Record<string, unknown>).secondView).toBeUndefined();
	});
});

describe("views through import and export", () => {
	it("sanitizes views as frameless cards, one level deep, with unique ids", () => {
		const out = sanitizeCard(
			{
				id: "a",
				kind: "text",
				x: 0,
				y: 0,
				w: 4,
				h: 2,
				views: [
					{ id: "a", kind: "clock", fx: 0.5, accent: "#f00", views: [{ id: "deep", kind: "text" }] },
					{ id: "v", kind: "nonsense" },
					"junk",
					{ id: "w", kind: "commands", commands: [{ id: "app:reload", name: "Reload" }] },
				],
				viewSwitcher: { style: "dots", placement: "bogus" },
				activeView: 5,
			},
			0,
		);
		expect(out?.views?.map((v) => v.kind)).toEqual(["clock", "links"]);
		const ids = cardViews(out as DashboardCard).map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(out?.views?.[0].fx).toBeUndefined();
		expect(out?.views?.[0].accent).toBeUndefined();
		expect(out?.views?.[0].views).toBeUndefined();
		expect(out?.viewSwitcher).toEqual({ style: "dots" });
		expect(out?.activeView).toBe(2);
	});

	it("drops switcher settings from a card without views", () => {
		const out = sanitizeCard({ id: "a", kind: "text", x: 0, y: 0, w: 1, h: 1, viewSwitcher: { style: "dots" } }, 0);
		expect(out?.viewSwitcher).toBeUndefined();
	});

	it("round-trips a card with views", () => {
		const host = threeViews();
		host.viewSwitcher = { placement: "bottom-left", style: "icons", rotateSec: 30, narrow: "split" };
		host.views![0].viewLabel = "Inbox";
		host.views![0].viewIcon = "inbox";
		expect(sanitizeCard(roundTrip(host), 0)).toEqual(sanitizeCard(roundTrip(sanitizeCard(roundTrip(host), 0)), 0));
		expect(sanitizeCard(roundTrip(host), 0)?.views?.[0]).toMatchObject({ viewLabel: "Inbox", viewIcon: "inbox" });
	});

	it("scrubs a Jira token held by a view", () => {
		const host = card("a", { views: [card("j", { kind: "jira", jira: { pat: "secret" } })] });
		const scrubbed = scrubCard(host);
		expect(scrubbed.views?.[0].jira?.pat).toBeUndefined();
		expect(host.views?.[0].jira?.pat).toBe("secret");
	});

	it("reports the references a view holds", () => {
		const host = card("a", { views: [card("e", { kind: "embed", target: "Private/Plan.md" })] });
		const refs = cardReferences(host);
		expect(refs.map((r) => [r.pointer, r.value])).toContainEqual(["views[0].target", "Private/Plan.md"]);
	});

	it("clones views deeply, with ids of their own", () => {
		const host = threeViews();
		const copy = cloneCard(host);
		copy.views![0].text = "changed";
		expect(host.views![0].text).toBe("B");
		const ids = [...cardViews(host), ...cardViews(copy)].map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("stripFrame", () => {
	it("takes the frame off and keeps the content", () => {
		const out = stripFrame(card("a", { text: "keep", title: "T", fx: 0.3, design: "expressive", activeView: 1 }));
		expect(out).toEqual({ id: "a", kind: "text", text: "keep", x: 0, y: 0, w: 1, h: 1 });
	});
});
