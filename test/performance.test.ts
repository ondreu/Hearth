import { describe, expect, it } from "vitest";
import {
	BANNER_HEIGHT_DEFAULT,
	DEFAULT_SETTINGS,
	effectiveAutoRefreshMinutes,
	effectiveBackground,
	effectiveCardBlur,
	effectiveCardOpacity,
	frostAllowed,
	LOW_POWER_BACKGROUND,
	lowPowerActive,
	migrateSettings,
	motionAllowed,
	PERFORMANCE_TIERS,
	type PerformanceTier,
	performanceTier,
	resolveCardBlur,
	resolveCardOpacity,
	skyDensity,
	timersAllowed,
	type DashboardCard,
	type HomeSettings,
} from "../src/types";

/**
 * The performance tier is an override layer, not a bulk edit of the settings it
 * covers: choosing a lower tier changes what the `effective*` resolvers
 * *report*, and moving back up must give back the previous look byte for byte —
 * including per-dashboard and per-card overrides, which no snapshot-and-restore
 * scheme would have captured.
 *
 * That round-trip is the whole promise of the feature, so it is what these
 * tests pin: every assertion below is paired, checking both the overridden
 * value at the lower tier and the *original* value once it is back to full, off
 * the same settings object.
 */

/** Settings with one dashboard carrying a distinctive, non-default look, so an
 * accidental write by a tier would be visible rather than blending into the
 * defaults. */
function settings(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.backgroundKind = "url";
	s.backgroundValue = "https://example.com/wallpaper.png";
	s.backgroundOpacity = 0.4;
	s.backgroundBlur = 6;
	s.cardOpacity = 0.5;
	s.cardBlur = 7;
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return s;
}

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
	return { id: "c1", kind: "text", title: "", x: 0, y: 0, w: 2, h: 2, ...overrides };
}

describe("performanceTier", () => {
	it("is full by default and reads the field", () => {
		const s = settings();
		expect(performanceTier(s)).toBe("full");
		s.performanceTier = "reduced";
		expect(performanceTier(s)).toBe("reduced");
	});

	// A hand-edited data.json, or a tier added by a future version and synced
	// back, must not read as something arbitrary — `full` is the only safe
	// fallback, since it changes nothing about the board.
	it("reads an unknown tier as full", () => {
		const s = settings();
		(s as unknown as Record<string, unknown>).performanceTier = "turbo";
		expect(performanceTier(s)).toBe("full");
		expect(motionAllowed(s)).toBe(true);
		expect(frostAllowed(s)).toBe(true);
		expect(timersAllowed(s)).toBe(true);
	});
});

/**
 * The ladder itself: which rung each capability switches off at. This table is
 * the specification — if a predicate moves to a different tier, this is the
 * test that has to be changed deliberately rather than a behaviour that can
 * drift unnoticed.
 */
describe("the tier ladder", () => {
	const expected: Record<
		PerformanceTier,
		{ motion: boolean; frost: boolean; timers: boolean; minimal: boolean; density: number }
	> = {
		full: { motion: true, frost: true, timers: true, minimal: false, density: 1 },
		balanced: { motion: true, frost: true, timers: true, minimal: false, density: 0.5 },
		reduced: { motion: false, frost: false, timers: true, minimal: false, density: 1 },
		minimal: { motion: false, frost: false, timers: false, minimal: true, density: 1 },
	};

	for (const tier of PERFORMANCE_TIERS) {
		it(`drops the right things at "${tier}"`, () => {
			const s = settings();
			s.performanceTier = tier;
			const want = expected[tier];
			expect(motionAllowed(s)).toBe(want.motion);
			expect(frostAllowed(s)).toBe(want.frost);
			expect(timersAllowed(s)).toBe(want.timers);
			expect(lowPowerActive(s)).toBe(want.minimal);
			expect(skyDensity(s)).toBe(want.density);
		});
	}

	// Each rung must be at least as frugal as the one above it, or the dropdown
	// would be offering a "lower" tier that costs more.
	it("never gains a capability on the way down", () => {
		let motion = true;
		let frost = true;
		let timers = true;
		for (const tier of PERFORMANCE_TIERS) {
			const s = settings();
			s.performanceTier = tier;
			expect(motionAllowed(s) && !motion).toBe(false);
			expect(frostAllowed(s) && !frost).toBe(false);
			expect(timersAllowed(s) && !timers).toBe(false);
			motion = motionAllowed(s);
			frost = frostAllowed(s);
			timers = timersAllowed(s);
		}
	});

	// Halving the field is only meaningful while the field is moving. A still
	// sky costs nothing to draw whole, and thinning it there would be a visible
	// change bought for no saving at all.
	it("only thins the sky while it is animating", () => {
		const s = settings();
		s.performanceTier = "balanced";
		expect(skyDensity(s)).toBe(0.5);
		s.performanceTier = "reduced";
		expect(skyDensity(s)).toBe(1);
	});
});

describe("effectiveBackground under the tiers", () => {
	it("substitutes a flat colour on minimal and restores the configured background", () => {
		const s = settings();
		const before = effectiveBackground(s);
		expect(before).toEqual({
			kind: "url",
			value: "https://example.com/wallpaper.png",
			opacity: 0.4,
			blur: 6,
			// Resolved rather than configured: effectiveBackground always reports
			// the banner fields so callers never repeat the fallbacks.
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});

		s.performanceTier = "minimal";
		expect(effectiveBackground(s)).toEqual({
			kind: "color",
			value: LOW_POWER_BACKGROUND,
			opacity: 1,
			blur: 0,
			// The tier replaces the picture, not the shape of the board: the
			// layout is not a paint cost, and changing it would move every card
			// on a bannered board the moment the tier changed.
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});

		s.performanceTier = "full";
		expect(effectiveBackground(s)).toEqual(before);
	});

	// The wallpaper is the reason to use `reduced` rather than `minimal`: the
	// board stops moving but still looks like itself.
	it("leaves the wallpaper alone on every tier above minimal", () => {
		const s = settings();
		for (const tier of ["full", "balanced", "reduced"] as const) {
			s.performanceTier = tier;
			expect(effectiveBackground(s).kind).toBe("url");
			expect(effectiveBackground(s).blur).toBe(6);
		}
	});

	it("uses the configured minimal colour, falling back when it is blank", () => {
		const s = settings();
		s.performanceTier = "minimal";
		s.lowPowerBackgroundColor = "#123456";
		expect(effectiveBackground(s).value).toBe("#123456");

		s.lowPowerBackgroundColor = "   ";
		expect(effectiveBackground(s).value).toBe(LOW_POWER_BACKGROUND);
	});

	it("overrides a per-dashboard background too, without erasing it", () => {
		const s = settings();
		s.dashboards[0].background = {
			kind: "image",
			value: "Attachments/board.png",
			opacity: 0.8,
			blur: 12,
		};

		s.performanceTier = "minimal";
		expect(effectiveBackground(s).kind).toBe("color");

		s.performanceTier = "full";
		expect(effectiveBackground(s)).toEqual({
			kind: "image",
			value: "Attachments/board.png",
			opacity: 0.8,
			blur: 12,
			layout: "full",
			bannerHeight: BANNER_HEIGHT_DEFAULT,
			bannerFade: true,
			bannerFullWidth: false,
		});
	});
});

describe("card surface under the tiers", () => {
	// The two halves part company at `reduced`: the frost is a backdrop-filter
	// the compositor re-evaluates whenever anything behind it moves, while plain
	// translucency is ordinary alpha compositing and costs almost nothing. So
	// `reduced` drops the blur and keeps the glass.
	it("drops the blur from reduced down, but keeps translucency until minimal", () => {
		const s = settings();

		s.performanceTier = "reduced";
		expect(effectiveCardBlur(s)).toBe(0);
		expect(effectiveCardOpacity(s)).toBe(0.5);

		s.performanceTier = "minimal";
		expect(effectiveCardBlur(s)).toBe(0);
		expect(effectiveCardOpacity(s)).toBe(1);

		s.performanceTier = "full";
		expect(effectiveCardOpacity(s)).toBe(0.5);
		expect(effectiveCardBlur(s)).toBe(7);
	});

	it("overrides per-dashboard and per-card values without losing them", () => {
		const s = settings();
		s.dashboards[0].cardOpacity = 0.2;
		s.dashboards[0].cardBlur = 20;
		const c = card({ cardOpacity: 0.15, cardBlur: 30 });

		s.performanceTier = "minimal";
		expect(effectiveCardOpacity(s)).toBe(1);
		expect(effectiveCardBlur(s)).toBe(0);
		expect(resolveCardOpacity(s, c)).toBe(1);
		expect(resolveCardBlur(s, c)).toBe(0);

		s.performanceTier = "full";
		expect(effectiveCardOpacity(s)).toBe(0.2);
		expect(effectiveCardBlur(s)).toBe(20);
		expect(resolveCardOpacity(s, c)).toBe(0.15);
		expect(resolveCardBlur(s, c)).toBe(30);
	});
});

describe("effectiveAutoRefreshMinutes", () => {
	it("passes the configured interval through until minimal", () => {
		const s = settings();
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(30);
		expect(effectiveAutoRefreshMinutes(s, 0)).toBe(0);

		// A board that has stopped moving should still stay up to date.
		s.performanceTier = "reduced";
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(30);

		s.performanceTier = "minimal";
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(0);

		s.performanceTier = "full";
		expect(effectiveAutoRefreshMinutes(s, 30)).toBe(30);
	});
});

describe("the tiers never write to the settings they override", () => {
	it("leaves every covered field untouched across a full round trip", () => {
		const s = settings();
		s.dashboards[0].background = {
			kind: "color",
			value: "#ff0000",
			opacity: 0.9,
			blur: 3,
		};
		s.dashboards[0].cardOpacity = 0.25;
		s.dashboards[0].cardBlur = 18;
		const c = card({ cardOpacity: 0.1, cardBlur: 9 });
		const before = structuredClone(s);

		// Everything a render would ask for, at every tier.
		for (const tier of PERFORMANCE_TIERS) {
			s.performanceTier = tier;
			effectiveBackground(s);
			effectiveCardOpacity(s);
			effectiveCardBlur(s);
			resolveCardOpacity(s, c);
			resolveCardBlur(s, c);
			effectiveAutoRefreshMinutes(s, 15);
			skyDensity(s);
		}
		s.performanceTier = "full";

		expect(s).toEqual(before);
	});
});

describe("migrateSettings and the performance tier", () => {
	/** A settings object as loadSettings hands it over: DEFAULT_SETTINGS merged
	 * under the persisted data, so every key is populated even when the vault's
	 * data.json predates it. */
	function loaded(raw: Record<string, unknown>): HomeSettings {
		return Object.assign(structuredClone(DEFAULT_SETTINGS), raw);
	}

	// The whole point of keying the migration off `raw`: by the time it runs,
	// `s.performanceTier` has already been filled in from the defaults, so
	// reading it would mean never seeing the legacy flag at all.
	it("folds a legacy lowPower=true into the minimal tier", () => {
		const raw = { lowPower: true };
		const s = loaded(raw);
		const migrated = migrateSettings(s, raw);

		expect(s.performanceTier).toBe("minimal");
		expect(lowPowerActive(s)).toBe(true);
		// One-way, so the caller has to persist the result.
		expect(migrated).toBe(true);
	});

	it("folds a legacy lowPower=false into the full tier", () => {
		const raw = { lowPower: false };
		const s = loaded(raw);
		migrateSettings(s, raw);
		expect(s.performanceTier).toBe("full");
	});

	// Otherwise the retired key would sit in data.json and start contradicting
	// the tier the moment someone changed it.
	it("drops the legacy key so it cannot disagree later", () => {
		const raw = { lowPower: true };
		const s = loaded(raw);
		migrateSettings(s, raw);
		expect("lowPower" in (s as object)).toBe(false);
	});

	it("keeps a persisted tier and ignores a stale legacy flag beside it", () => {
		const raw = { performanceTier: "balanced", lowPower: true };
		const s = loaded(raw);
		migrateSettings(s, raw);
		expect(s.performanceTier).toBe("balanced");
	});

	it("defaults both new fields for settings saved before they existed", () => {
		const s = settings();
		delete (s as Partial<HomeSettings>).performanceTier;
		delete (s as Partial<HomeSettings>).pauseWhenUnfocused;
		delete (s as Partial<HomeSettings>).lowPowerBackgroundColor;

		migrateSettings(s, {});

		expect(s.performanceTier).toBe("full");
		expect(s.pauseWhenUnfocused).toBe(true);
		expect(s.lowPowerBackgroundColor).toBe(LOW_POWER_BACKGROUND);
	});

	it("repairs a wrong-typed tier and keeps a good one", () => {
		const s = settings();
		(s as unknown as Record<string, unknown>).performanceTier = "turbo";
		s.lowPowerBackgroundColor = "  ";
		migrateSettings(s, {});
		expect(s.performanceTier).toBe("full");
		expect(s.lowPowerBackgroundColor).toBe(LOW_POWER_BACKGROUND);

		s.performanceTier = "reduced";
		s.lowPowerBackgroundColor = "#0a0a0a";
		migrateSettings(s, {});
		expect(s.performanceTier).toBe("reduced");
		expect(s.lowPowerBackgroundColor).toBe("#0a0a0a");
	});

	// Migration must converge: a second load off the migrated data.json has to
	// be a no-op, or every start would re-save.
	it("is idempotent once the legacy key is gone", () => {
		const raw: Record<string, unknown> = { lowPower: true };
		const first = loaded(raw);
		expect(migrateSettings(first, raw)).toBe(true);

		const persisted = { performanceTier: first.performanceTier };
		const second = loaded(persisted);
		expect(migrateSettings(second, persisted)).toBe(false);
		expect(second.performanceTier).toBe("minimal");
	});
});
