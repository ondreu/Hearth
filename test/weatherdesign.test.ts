import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/cards/weather";
import { applySettings, sanitizeCard, sanitizeDashboard } from "../src/layout";
import { DEFAULT_SETTINGS, effectiveSkyDesign, type HomeSettings } from "../src/types";

/**
 * The weather card's *Design* (Classic or Expressive), the moon style's
 * *Layout*, and the weather background's *Design*: each is a choice written
 * to a real vault, so what survives a saved layout and a backup import is
 * pinned here.
 */

function weatherCard(weather: Record<string, unknown>): Record<string, unknown> {
	return { id: "w1", kind: "weather", x: 0, y: 0, w: 4, h: 3, weather };
}

describe("a weather card's design and moon layout", () => {
	it("keep the values they know", () => {
		const card = sanitizeCard(weatherCard({ style: "moon", design: "expressive", moonLayout: "clean" }), 0);
		expect(card?.weather).toMatchObject({ style: "moon", design: "expressive", moonLayout: "clean" });
	});

	it("drop the ones they don't", () => {
		const card = sanitizeCard(weatherCard({ design: "material", moonLayout: "tiny" }), 0);
		expect(card?.weather?.design).toBeUndefined();
		expect(card?.weather?.moonLayout).toBeUndefined();
	});

	it("resolve to Classic and the full moon when unset", () => {
		const r = resolveConfig({});
		expect(r.expressive).toBe(false);
		expect(r.moonLayout).toBe("full");
		expect(resolveConfig({ design: "expressive" }).expressive).toBe(true);
	});
});

describe("the weather background's design", () => {
	const vault = (): HomeSettings => structuredClone(DEFAULT_SETTINGS);

	it("takes Expressive from a backup and stores Classic as absence", () => {
		const s = vault();
		applySettings(s, { backgroundSkyDesign: "expressive" });
		expect(s.backgroundSkyDesign).toBe("expressive");
		applySettings(s, { backgroundSkyDesign: "classic" });
		expect(s.backgroundSkyDesign).toBeUndefined();
	});

	it("leaves the vault's choice alone when a backup doesn't say", () => {
		const s = vault();
		s.backgroundSkyDesign = "expressive";
		applySettings(s, { backgroundSkyDesign: "neon" });
		applySettings(s, {});
		expect(s.backgroundSkyDesign).toBe("expressive");
	});
});

describe("a board's own sky design", () => {
	const vault = (): HomeSettings => {
		const s = structuredClone(DEFAULT_SETTINGS);
		s.dashboards = [{ id: "home", name: "Home", cards: [] }];
		s.activeDashboardId = "home";
		return s;
	};

	it("follows the vault until the board says otherwise", () => {
		const s = vault();
		expect(effectiveSkyDesign(s)).toBe("classic");
		s.backgroundSkyDesign = "expressive";
		expect(effectiveSkyDesign(s)).toBe("expressive");
		s.dashboards[0].backgroundSkyDesign = "classic";
		expect(effectiveSkyDesign(s)).toBe("classic");
	});

	it("survives a saved layout, and drops a value it doesn't know", () => {
		const s = vault();
		const kept = sanitizeDashboard({ id: "b", name: "B", cards: [], backgroundSkyDesign: "expressive" }, s, 0);
		expect(kept?.backgroundSkyDesign).toBe("expressive");
		const dropped = sanitizeDashboard({ id: "c", name: "C", cards: [], backgroundSkyDesign: "neon" }, s, 1);
		expect(dropped?.backgroundSkyDesign).toBeUndefined();
	});
});
