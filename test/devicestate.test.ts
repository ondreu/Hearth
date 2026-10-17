import { describe, expect, it } from "vitest";
import { settingsForDisk, validLocalDashboardId } from "../src/devicestate";
import { DEFAULT_SETTINGS, HomeSettings } from "../src/types";

/**
 * Device-local view state (#392): which board is remembered from localStorage,
 * and what goes to `data.json` while the active board lives on the device. The
 * localStorage and save wiring is Obsidian API and stays untested, per the
 * no-mocks rule.
 */

/** Settings with two boards, "a" active. */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [
		{ id: "a", name: "A", cards: [] },
		{ id: "b", name: "B", cards: [] },
	];
	s.activeDashboardId = "a";
	return s;
}

describe("validLocalDashboardId", () => {
	it("returns a stored id that names a board", () => {
		expect(validLocalDashboardId(settings(), "b")).toBe("b");
	});

	it("rejects a board that no longer exists", () => {
		expect(validLocalDashboardId(settings(), "gone")).toBeNull();
	});

	it("rejects an absent or malformed value", () => {
		expect(validLocalDashboardId(settings(), null)).toBeNull();
		expect(validLocalDashboardId(settings(), "")).toBeNull();
		expect(validLocalDashboardId(settings(), 42)).toBeNull();
	});
});

describe("settingsForDisk", () => {
	it("writes the board already on disk, not the one switched to", () => {
		const s = settings();
		s.activeDashboardId = "b";
		const disk = settingsForDisk(s, "a");
		expect(disk.activeDashboardId).toBe("a");
		// Everything else is the live settings, and they are left untouched.
		expect(disk.dashboards).toBe(s.dashboards);
		expect(s.activeDashboardId).toBe("b");
	});

	it("hands back the settings themselves when nothing differs", () => {
		const s = settings();
		expect(settingsForDisk(s, "a")).toBe(s);
	});

	it("never writes a board that was deleted", () => {
		const s = settings();
		s.activeDashboardId = "b";
		expect(settingsForDisk(s, "gone").activeDashboardId).toBe("b");
	});
});
