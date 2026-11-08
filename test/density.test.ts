import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, hydrateSettings } from "../src/types";

/**
 * The spacing setting used to be one boolean (`compact`) and is now a
 * three-step choice (`density`: roomy / compact / flush). The fold is one-way
 * and drops the old key, so the thing worth pinning is that no vault's look
 * changes underneath it:
 *
 * - `compact: true` must land on `"compact"`, not on the new default;
 * - `compact: false` must land on `"roomy"`, which is what it drew;
 * - a board that overrode it keeps its own answer instead of falling back to
 *   the global one;
 * - a value this build doesn't know (a hand-edit, a file from a newer version)
 *   is dropped rather than stored and later drawn as something arbitrary.
 */
describe("spacing migration (compact → density)", () => {
	it("folds a vault's compact spacing into the new field", () => {
		const { settings, migrated } = hydrateSettings({ compact: true });
		expect(settings.density).toBe("compact");
		expect(migrated).toBe(true);
	});

	it("reads the old false as the default, roomy", () => {
		const { settings } = hydrateSettings({ compact: false });
		expect(settings.density).toBe("roomy");
	});

	it("drops the retired key so it cannot contradict the dropdown later", () => {
		const { settings } = hydrateSettings({ compact: true });
		expect("compact" in (settings as object)).toBe(false);
	});

	it("folds a board's own override instead of resetting it to the global", () => {
		const { settings } = hydrateSettings({
			compact: true,
			dashboards: [
				{ id: "d1", name: "Board", cards: [], compact: false },
				{ id: "d2", name: "Other", cards: [] },
			],
			activeDashboardId: "d1",
		});
		expect(settings.dashboards[0].density).toBe("roomy");
		// A board that never overrode it keeps following the vault.
		expect(settings.dashboards[1].density).toBeUndefined();
		expect("compact" in (settings.dashboards[0] as object)).toBe(false);
	});

	it("keeps a stored density, including the new flush step", () => {
		const { settings, migrated } = hydrateSettings({
			density: "flush",
			dashboards: [{ id: "d1", name: "Board", cards: [], density: "compact" }],
			activeDashboardId: "d1",
		});
		expect(settings.density).toBe("flush");
		expect(settings.dashboards[0].density).toBe("compact");
		expect(migrated).toBe(false);
	});

	it("drops a density this build cannot draw, vault-wide and per board", () => {
		const { settings } = hydrateSettings({
			density: "tight",
			dashboards: [{ id: "d1", name: "Board", cards: [], density: "tight" }],
			activeDashboardId: "d1",
		});
		expect(settings.density).toBe(DEFAULT_SETTINGS.density);
		expect(settings.dashboards[0].density).toBeUndefined();
	});
});
