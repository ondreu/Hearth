import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS } from "../src/cards";
import { resolveMarket } from "../src/cards/market";
import { resolveConfig } from "../src/cards/weather";
import { applySettings, exportSettingsPayload, sanitizeCard } from "../src/layout";
import { type CardKind, DEFAULT_SETTINGS, effectiveCardDesign, type HomeSettings } from "../src/types";

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
			].sort(),
		);
		// Weather and market keep the design in their own config and editor.
		expect(CARD_DEFINITIONS.weather.expressive).toBeFalsy();
		expect(CARD_DEFINITIONS.market.expressive).toBeFalsy();
	});
});

describe("effectiveCardDesign", () => {
	it("prefers the card, then the vault, then Classic", () => {
		const s = vault();
		expect(effectiveCardDesign(s, undefined)).toBe("classic");
		s.cardDesign = "expressive";
		expect(effectiveCardDesign(s, undefined)).toBe("expressive");
		expect(effectiveCardDesign(s, "classic")).toBe("classic");
		s.cardDesign = undefined;
		expect(effectiveCardDesign(s, "expressive")).toBe("expressive");
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
