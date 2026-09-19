import { describe, expect, it } from "vitest";
import { applySettings, sanitizeCard } from "../src/layout";
import { DEFAULT_SETTINGS, HomeSettings, migrateSettings } from "../src/types";

/**
 * The two fields Hearth used to persist and no longer declares:
 * `MobileActionButton.commandId` (pre-1.9.0) and `ClockConfig.use24Hour`
 * (pre-`hourFormat`).
 *
 * Both were kept alive on the public types with a `@deprecated` tag and read at
 * render time as a safety net, on top of the migrations that were already
 * folding them away. The types now stop at the current shape, so the folds are
 * the *only* thing standing between an old `data.json` and a button with no
 * action or a clock on the wrong face — which is what these cover. There are
 * three doors into settings and each one is tested: load (`migrateSettings`),
 * card layout (`sanitizeCard`) and backup import (`applySettings`).
 */

/** A saved button as a pre-1.9.0 install wrote it: the action in `commandId`,
 * with no `type`/`target` in sight. */
function legacyButton(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return { id: "b1", label: "Reload", icon: "refresh-cw", commandId: "app:reload", ...extra };
}

function settingsWith(buttons: unknown[]): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	(s as unknown as Record<string, unknown>).mobileActionButtons = buttons;
	return s;
}

describe("commandId → target, on load", () => {
	it("lifts the legacy id into target and stops persisting commandId", () => {
		const s = settingsWith([legacyButton()]);
		const flush = migrateSettings(s, { mobileActionButtons: [legacyButton()] });

		expect(s.mobileActionButtons[0].target).toBe("app:reload");
		expect("commandId" in s.mobileActionButtons[0]).toBe(false);
		// One-way: the caller has to write the result back.
		expect(flush).toBe(true);
	});

	it("keeps an existing target and drops the stale commandId beside it", () => {
		const raw = legacyButton({ type: "note", target: "Daily/Today.md" });
		const s = settingsWith([{ ...raw }]);
		migrateSettings(s, { mobileActionButtons: [{ ...raw }] });

		expect(s.mobileActionButtons[0].target).toBe("Daily/Today.md");
		expect("commandId" in s.mobileActionButtons[0]).toBe(false);
	});

	it("converges: a second load has nothing left to fold and no flush to ask for", () => {
		const s = settingsWith([legacyButton()]);
		migrateSettings(s, { mobileActionButtons: [legacyButton()] });
		const again = migrateSettings(s, { mobileActionButtons: [...s.mobileActionButtons] });

		expect(again).toBe(false);
		expect(s.mobileActionButtons[0].target).toBe("app:reload");
	});

	it("never drops a value it could not move: an empty target leaves nothing behind", () => {
		const s = settingsWith([legacyButton({ target: "" })]);
		migrateSettings(s, { mobileActionButtons: [legacyButton({ target: "" })] });

		expect(s.mobileActionButtons[0].target).toBe("app:reload");
	});
});

describe("commandId → target, on backup import", () => {
	it("folds a pre-1.9.0 backup's commandId rather than re-persisting it", () => {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		applySettings(s, { mobileActionButtons: [legacyButton()] });

		expect(s.mobileActionButtons[0].target).toBe("app:reload");
		expect("commandId" in s.mobileActionButtons[0]).toBe(false);
	});

	it("lets the backup's own target win over its stale commandId", () => {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		applySettings(s, {
			mobileActionButtons: [legacyButton({ type: "url", target: "https://example.com" })],
		});

		expect(s.mobileActionButtons[0].target).toBe("https://example.com");
		expect("commandId" in s.mobileActionButtons[0]).toBe(false);
	});
});

describe("use24Hour → hourFormat", () => {
	function clockOf(clock: Record<string, unknown>) {
		return sanitizeCard({ id: "c1", kind: "clock", clock }, 0)?.clock;
	}

	it("reads the old boolean as a forced 24-hour face", () => {
		expect(clockOf({ use24Hour: true })?.hourFormat).toBe("24");
	});

	it("reads a false boolean as 'follow the locale', which is what it meant", () => {
		expect(clockOf({ use24Hour: false })?.hourFormat).toBe("auto");
	});

	it("lets an explicit hourFormat win over a leftover boolean", () => {
		expect(clockOf({ hourFormat: "12", use24Hour: true })?.hourFormat).toBe("12");
	});

	it("does not carry the retired field onto the sanitized config", () => {
		const clock = clockOf({ use24Hour: true });
		expect(clock && "use24Hour" in clock).toBe(false);
	});
});
