import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS, classicCardsInUse, resolveCardDesign } from "../src/cards";
import { resolveMarket } from "../src/cards/market";
import { resolveConfig } from "../src/cards/weather";
import { applySettings, exportSettingsPayload, sanitizeCard, sanitizeDashboard } from "../src/layout";
import { flattenBoardLook } from "../src/portable/capture";
import { type CardKind, type DashboardCard, DEFAULT_SETTINGS, effectiveCardDesign, type HomeSettings } from "../src/types";

/**
 * The card *Design* beyond the weather and market cards: a per-card choice
 * (`card.design`) over a vault default (`cardDesign`). Both are written to a
 * real vault, so what they resolve to and what survives a saved layout and a
 * backup is pinned here.
 */

const vault = (): HomeSettings => structuredClone(DEFAULT_SETTINGS);

describe("which kinds draw an Expressive design", () => {
	it("is every kind whose content Hearth draws itself, and none that shows the user's own", () => {
		const expressive = (Object.keys(CARD_DEFINITIONS) as CardKind[]).filter(
			(kind) => CARD_DEFINITIONS[kind].expressive,
		);
		expect(expressive.sort()).toEqual(
			[
				"bookmarks",
				"calculator",
				"calendar",
				"clock",
				"commands",
				"favorites",
				"folder",
				"git",
				"heatmap",
				"jira",
				"links",
				"operon",
				"recent",
				"rss",
				"schedule",
				"search",
				"searchbar",
				"stats",
				"tasks",
				"templater",
				"tension",
			].sort(),
		);
		// Weather and market keep the design in their own config and editor.
		expect(CARD_DEFINITIONS.weather.expressive).toBeFalsy();
		expect(CARD_DEFINITIONS.market.expressive).toBeFalsy();
	});
});

describe("effectiveCardDesign", () => {
	const boards = (): HomeSettings => {
		const s = vault();
		s.dashboards = [
			{ id: "home", name: "Home", cards: [] },
			{ id: "work", name: "Work", cards: [] },
		];
		s.activeDashboardId = "home";
		return s;
	};

	it("prefers the card, then the board, then the vault, then Classic", () => {
		const s = boards();
		expect(effectiveCardDesign(s, undefined)).toBe("classic");
		s.cardDesign = "expressive";
		expect(effectiveCardDesign(s, undefined)).toBe("expressive");
		s.dashboards[0].cardDesign = "classic";
		expect(effectiveCardDesign(s, undefined)).toBe("classic");
		expect(effectiveCardDesign(s, "expressive")).toBe("expressive");
		s.cardDesign = undefined;
		s.dashboards[0].cardDesign = "expressive";
		expect(effectiveCardDesign(s, undefined)).toBe("expressive");
		expect(effectiveCardDesign(s, "classic")).toBe("classic");
	});

	it("follows the board that is showing", () => {
		const s = boards();
		s.dashboards[1].cardDesign = "expressive";
		expect(effectiveCardDesign(s, undefined)).toBe("classic");
		s.activeDashboardId = "work";
		expect(effectiveCardDesign(s, undefined)).toBe("expressive");
	});
});

describe("the design a card's frame follows", () => {
	const card = (kind: CardKind, extra: Partial<DashboardCard> = {}): DashboardCard => ({ id: kind, kind, x: 0, y: 0, w: 1, h: 1, ...extra });
	const board = (cards: DashboardCard[], cardDesign?: "classic" | "expressive"): HomeSettings => {
		const s = vault();
		s.dashboards = [{ id: "home", name: "Home", cards, cardDesign }];
		s.activeDashboardId = "home";
		return s;
	};

	it("takes the board's design for a kind with no Expressive body of its own", () => {
		const embed = card("embed");
		expect(resolveCardDesign(board([embed], "expressive"), embed)).toBe("expressive");
		expect(resolveCardDesign(board([embed]), embed)).toBe("classic");
		embed.design = "expressive";
		expect(resolveCardDesign(board([embed]), embed)).toBe("expressive");
	});

	it("takes the weather and market cards' own design over the card's", () => {
		const weather = card("weather", { design: "classic", weather: { design: "expressive" } });
		expect(resolveCardDesign(board([weather]), weather)).toBe("expressive");
		const moon = card("weather", { weather: { style: "moon" } });
		expect(resolveCardDesign(board([moon]), moon)).toBe("expressive");
		const market = card("market", { market: { design: "classic" } });
		expect(resolveCardDesign(board([market], "expressive"), market)).toBe("classic");
	});

	it("asks whether any card is Classic before offering the surface settings", () => {
		const text = card("text");
		const s = board([text], "expressive");
		expect(classicCardsInUse(s)).toBe(false);
		text.design = "classic";
		expect(classicCardsInUse(s)).toBe(true);
		expect(classicCardsInUse(s, s.dashboards[0])).toBe(true);
	});

	it("counts an empty board by the design its first card would take", () => {
		const s = board([], "expressive");
		expect(classicCardsInUse(s)).toBe(false);
		s.dashboards[0].cardDesign = undefined;
		expect(classicCardsInUse(s)).toBe(true);
	});
});

describe("a board's own card design", () => {
	it("survives a saved layout, and drops a value it doesn't know", () => {
		const s = vault();
		const kept = sanitizeDashboard({ id: "b", name: "B", cards: [], cardDesign: "expressive" }, s, 0);
		expect(kept?.cardDesign).toBe("expressive");
		const dropped = sanitizeDashboard({ id: "b", name: "B", cards: [], cardDesign: "neon" }, s, 0);
		expect(dropped?.cardDesign).toBeUndefined();
	});

	it("is written into a shared board, so it arrives looking the same", () => {
		const s = vault();
		s.cardDesign = "expressive";
		const board = { id: "b", name: "B", cards: [] };
		s.dashboards = [board];
		s.activeDashboardId = "b";
		expect(flattenBoardLook(s, board).cardDesign).toBe("expressive");
	});
});

describe("the vault default reaches the weather and market cards", () => {
	it("draws an unset weather card in the vault's design, bar moon and daylight", () => {
		expect(resolveConfig({}, false, 1, "expressive").expressive).toBe(true);
		expect(resolveConfig({ design: "classic" }, false, 1, "expressive").expressive).toBe(false);
		// Moon and daylight stay expressive whatever the vault says, unless told.
		expect(resolveConfig({ style: "moon" }, false, 1, "classic").expressive).toBe(true);
		expect(resolveConfig({ style: "moon", design: "classic" }, false, 1, "expressive").expressive).toBe(false);
	});

	it("draws an unset market card in the vault's design", () => {
		expect(resolveMarket({}, false, "en", "expressive").expressive).toBe(true);
		expect(resolveMarket({ design: "classic" }, false, "en", "expressive").expressive).toBe(false);
		expect(resolveMarket({}, false, "en").expressive).toBe(false);
	});
});

describe("a card's design in a saved layout", () => {
	const card = (design: unknown) => sanitizeCard({ id: "c1", kind: "clock", x: 0, y: 0, w: 4, h: 2, design }, 0);

	it("keeps the values it knows", () => {
		expect(card("expressive")?.design).toBe("expressive");
		expect(card("classic")?.design).toBe("classic");
	});

	it("drops the ones it doesn't", () => {
		expect(card("material")?.design).toBeUndefined();
		expect(card(undefined)?.design).toBeUndefined();
	});
});

describe("a clock's face in a saved layout", () => {
	const face = (mode: unknown) =>
		sanitizeCard({ id: "c1", kind: "clock", x: 0, y: 0, w: 4, h: 2, clock: { mode } }, 0)?.clock?.mode;

	it("keeps every face, the Expressive-only ones included", () => {
		for (const mode of ["digital", "analog", "stacked", "flip", "ring", "shapes", "orbit"]) {
			expect(face(mode)).toBe(mode);
		}
	});

	it("drops one it doesn't know", () => {
		expect(face("sundial")).toBeUndefined();
	});
});

describe("the vault's card design in a backup", () => {
	it("is exported", () => {
		const s = vault();
		s.cardDesign = "expressive";
		expect(exportSettingsPayload(s).cardDesign).toBe("expressive");
	});

	it("takes Expressive from a backup and stores Classic as absence", () => {
		const s = vault();
		applySettings(s, { cardDesign: "expressive" });
		expect(s.cardDesign).toBe("expressive");
		applySettings(s, { cardDesign: "classic" });
		expect(s.cardDesign).toBeUndefined();
	});

	it("leaves the vault's choice alone when a backup doesn't say", () => {
		const s = vault();
		s.cardDesign = "expressive";
		applySettings(s, { cardDesign: "neon" });
		applySettings(s, {});
		expect(s.cardDesign).toBe("expressive");
	});
});
