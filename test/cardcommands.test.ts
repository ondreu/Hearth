import { describe, expect, it } from "vitest";
import { type DashboardCard, DEFAULT_SETTINGS, type HomeSettings } from "../src/types";
import { sanitizeCard } from "../src/layout";
import {
	cardCommandId,
	cardCommandName,
	cardsWithCommands,
	planCardCommands,
} from "../src/cardcommandstate";

/**
 * A card's own command (#491): which cards get one, and what it is called.
 *
 * The name is the whole contract — Obsidian's `/` menu and the command palette
 * filter on it and nothing else — so a rename has to move the command with the
 * card, and a card without a title has to stay findable by its kind.
 */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "d1", name: "Home", cards: [card("a", { title: "Weather", command: true }), card("b")] },
		{ id: "d2", name: "Work", cards: [card("c", { command: true })] },
	];
	s.pinnedCards = [card("p", { command: true })];
	s.activeDashboardId = "d1";
	return s;
}

function card(id: string, extra: Partial<DashboardCard> = {}): DashboardCard {
	return { id, kind: "tasks", x: 0, y: 0, w: 4, h: 3, ...extra };
}

describe("cardsWithCommands", () => {
	it("takes only the cards that asked for a command", () => {
		expect(cardsWithCommands(settings()).map((c) => c.id)).toEqual(["a", "c", "p"]);
	});

	it("is empty until something is switched on", () => {
		const s = settings();
		s.dashboards[0].cards[0].command = undefined;
		s.dashboards[1].cards[0].command = undefined;
		s.pinnedCards[0].command = undefined;
		expect(cardsWithCommands(s)).toEqual([]);
	});

	it("lists a card once even if it is somehow on two boards", () => {
		const s = settings();
		s.dashboards[1].cards.push(s.dashboards[0].cards[0]);
		expect(cardsWithCommands(s).filter((c) => c.id === "a")).toHaveLength(1);
	});
});

describe("cardCommandName", () => {
	it("leads with the card's title, because that is what gets typed", () => {
		expect(cardCommandName(card("a", { title: " Weather " }))).toContain("Weather");
		expect(cardCommandName(card("a", { title: "Weather" }))).toBe("Hearth: Open Weather");
	});

	it("falls back to the card's kind when it has no title", () => {
		const name = cardCommandName(card("b"));
		expect(name.startsWith("Hearth: Open ")).toBe(true);
		expect(name.length).toBeGreaterThan("Hearth: Open ".length);
	});

	it("moves with a rename, because it is derived and not stored", () => {
		const c = card("a", { title: "Weather" });
		const before = cardCommandName(c);
		c.title = "Forecast";
		expect(cardCommandName(c)).not.toBe(before);
		expect(cardCommandName(c)).toContain("Forecast");
	});
});

describe("cardCommandId", () => {
	it("is derived from the card, so it survives a rename", () => {
		const c = card("a", { title: "Weather" });
		const id = cardCommandId(c);
		c.title = "Forecast";
		expect(cardCommandId(c)).toBe(id);
	});

	it("differs per card", () => {
		expect(cardCommandId(card("a"))).not.toBe(cardCommandId(card("b")));
	});
});

describe("planCardCommands", () => {
	it("registers a card that was just switched on", () => {
		const plan = planCardCommands(new Map(), settings());
		expect(plan.add.map((a) => a.id)).toEqual(["open-card-a", "open-card-c", "open-card-p"]);
		expect(plan.remove).toEqual([]);
		expect(plan.next.get("open-card-a")).toContain("Weather");
	});

	it("does nothing when nothing changed — the every-save path", () => {
		const s = settings();
		const first = planCardCommands(new Map(), s);
		const again = planCardCommands(first.next, s);
		expect(again.add).toEqual([]);
		expect(again.remove).toEqual([]);
	});

	it("re-registers a renamed card, because a command cannot be renamed", () => {
		const s = settings();
		const before = planCardCommands(new Map(), s).next;
		s.dashboards[0].cards[0].title = "Forecast";
		const plan = planCardCommands(before, s);
		expect(plan.remove).toEqual(["open-card-a"]);
		expect(plan.add.map((a) => a.name)).toEqual(["Hearth: Open Forecast"]);
	});

	it("unregisters a card that was switched off or deleted", () => {
		const s = settings();
		const before = planCardCommands(new Map(), s).next;
		s.dashboards[0].cards[0].command = undefined;
		s.pinnedCards = [];
		const plan = planCardCommands(before, s);
		expect(plan.remove.sort()).toEqual(["open-card-a", "open-card-p"]);
		expect(plan.next.has("open-card-a")).toBe(false);
	});
});

describe("sanitizeCard", () => {
	it("keeps a card's command through an import/export round trip", () => {
		// The card fields are copied by hand in layout.ts, so a field missing
		// there disappears on import while the type system says nothing.
		const raw = { id: "a", kind: "tasks", x: 0, y: 0, w: 4, h: 3, command: true };
		expect(sanitizeCard(raw, 0)?.command).toBe(true);
		expect(sanitizeCard({ ...raw, command: false }, 0)?.command).toBe(false);
		expect(sanitizeCard({ ...raw, command: undefined }, 0)?.command).toBeUndefined();
	});
});
