import { describe, expect, it } from "vitest";
import { actionTarget } from "../src/mobileactions";
import { DEFAULT_SETTINGS, migrateSettings, type HomeSettings } from "../src/types";

/**
 * The legacy `commandId` → `target` fold.
 *
 * The deprecated `commandId` field was removed from `MobileActionButton` in
 * 1.18.0, together with the `?? btn.commandId` fallback that `actionTarget()`
 * used to carry. This migration is what replaced them: it is now the *only*
 * thing that keeps a vault whose settings still store `commandId` — one that
 * skipped 1.9.0–1.17.0 — from coming back with a row of dead buttons. It is
 * also the reason the fallback could be dropped safely, so the rules it
 * guarantees are worth pinning down.
 */

/** Load settings the way `main.ts` does, then migrate. Returns the migrated
 * buttons alongside the flag that tells the caller to flush to storage. */
function load(buttons: unknown[]): { buttons: Record<string, unknown>[]; flushed: boolean } {
	const raw = { mobileActionButtons: buttons } as Record<string, unknown>;
	const s = Object.assign({}, DEFAULT_SETTINGS, raw) as HomeSettings;
	const flushed = migrateSettings(s, raw);
	return { buttons: s.mobileActionButtons as unknown as Record<string, unknown>[], flushed };
}

const legacy = (extra: Record<string, unknown>) => ({
	id: "b1",
	label: "Daily",
	icon: "calendar",
	...extra,
});

describe("commandId → target migration", () => {
	it("lifts a legacy commandId into target and drops the old field", () => {
		const { buttons, flushed } = load([legacy({ commandId: "daily-notes" })]);
		expect(buttons[0].target).toBe("daily-notes");
		expect(buttons[0]).not.toHaveProperty("commandId");
		// The fold is one-way, so the caller must persist it.
		expect(flushed).toBe(true);
	});

	it("keeps an existing target authoritative and discards the stale commandId", () => {
		const { buttons } = load([legacy({ target: "new-note", commandId: "daily-notes" })]);
		expect(buttons[0].target).toBe("new-note");
		expect(buttons[0]).not.toHaveProperty("commandId");
	});

	it("preserves a command that does not resolve yet", () => {
		// At load time another plugin's commands may not be registered, so a
		// "missing" command is only not-yet-loaded — dropping it would be data loss.
		const { buttons } = load([legacy({ commandId: "some-other-plugin:thing" })]);
		expect(buttons[0].target).toBe("some-other-plugin:thing");
	});

	it("drops an empty commandId without inventing a target", () => {
		const { buttons } = load([legacy({ commandId: "" })]);
		expect(buttons[0]).not.toHaveProperty("commandId");
		expect(buttons[0].target).toBeUndefined();
	});

	it("leaves an already-migrated button completely alone", () => {
		const { buttons, flushed } = load([legacy({ type: "command", target: "new-note" })]);
		expect(buttons[0].target).toBe("new-note");
		// Nothing was folded, so there is nothing to flush.
		expect(flushed).toBe(false);
	});

	it("converges — a second load has nothing left to migrate", () => {
		const raw = { mobileActionButtons: [legacy({ commandId: "daily-notes" })] } as Record<
			string,
			unknown
		>;
		const s = Object.assign({}, DEFAULT_SETTINGS, raw) as HomeSettings;
		expect(migrateSettings(s, raw)).toBe(true);
		// Re-running over the already-folded settings must not re-fire, or the
		// plugin would save on every single start.
		expect(migrateSettings(s, s as unknown as Record<string, unknown>)).toBe(false);
	});

	it("hands actionTarget a button it can resolve without the removed fallback", () => {
		const { buttons } = load([legacy({ commandId: "daily-notes" })]);
		expect(actionTarget(buttons[0] as never)).toBe("daily-notes");
	});
});
