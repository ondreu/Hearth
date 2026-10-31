import { describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { applySettings } from "../src/layout";
import {
	DEFAULT_SETTINGS,
	effectiveBackground,
	type HomeSettings,
	retuneBackground,
	videoBackgroundPlays,
} from "../src/types";

/**
 * A video backdrop is the one background kind whose cost depends on the
 * performance tier, so the tier — not the motion ladder — decides whether it
 * plays. These tests pin the three things the rest of the code leans on:
 *
 *  - only `full` plays it, and every tier below freezes it;
 *  - the mobile tier answers on a phone, so a board that plays on the desktop
 *    can still hold still on the phone it is also open on;
 *  - the kind survives a settings import, and is tuned like the other photos.
 *
 * What no test here covers: the `<video>` element itself — autoplay, pausing and
 * the teardown — which needs a real document and lives on the vault checklist.
 */

function settings(patch: Partial<HomeSettings> = {}): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.backgroundKind = "video";
	s.backgroundValue = "Attachments/loop.mp4";
	s.dashboards = [{ id: "d1", name: "Dashboard 1", cards: [] }];
	s.activeDashboardId = "d1";
	return { ...s, ...patch };
}

describe("videoBackgroundPlays", () => {
	it("plays on the top tier only", () => {
		expect(videoBackgroundPlays(settings({ performanceTier: "full" }))).toBe(true);
		expect(videoBackgroundPlays(settings({ performanceTier: "balanced" }))).toBe(false);
		expect(videoBackgroundPlays(settings({ performanceTier: "reduced" }))).toBe(false);
		expect(videoBackgroundPlays(settings({ performanceTier: "minimal" }))).toBe(false);
	});

	it("reads the mobile tier on a phone instead of the desktop one", () => {
		const s = settings({ performanceTier: "full", mobilePerformanceTier: "balanced" });
		expect(videoBackgroundPlays(s)).toBe(true);
		Platform.isMobile = true;
		try {
			// The desktop choice is not overwritten; the device decides which is read.
			expect(videoBackgroundPlays(s)).toBe(false);
		} finally {
			Platform.isMobile = false;
		}
	});

	it("treats an unreadable tier as full, the way every other tier resolver does", () => {
		const s = settings();
		// A data.json from a future build can carry a tier this one doesn't know.
		(s as unknown as { performanceTier: string }).performanceTier = "turbo";
		expect(videoBackgroundPlays(s)).toBe(true);
	});
});

describe("the video kind survives a settings import", () => {
	it("keeps the kind and its path from a backup or an imported board", () => {
		const s = structuredClone(DEFAULT_SETTINGS);
		s.backgroundKind = "image";
		s.backgroundValue = "";
		applySettings(s, { backgroundKind: "video", backgroundValue: "Attachments/loop.mp4" });
		expect(s.backgroundKind).toBe("video");
		expect(s.backgroundValue).toBe("Attachments/loop.mp4");
	});

	it("still drops a kind it does not know", () => {
		const s = structuredClone(DEFAULT_SETTINGS);
		s.backgroundKind = "image";
		applySettings(s, { backgroundKind: "hologram", backgroundValue: "x" });
		expect(s.backgroundKind).toBe("image");
	});

	it("reaches the renderer as a painted background", () => {
		expect(effectiveBackground(settings()).kind).toBe("video");
	});
});

describe("retuneBackground with a video", () => {
	it("dims and softens a video the way it tunes a photo", () => {
		expect(retuneBackground("default", "video", { opacity: 0.8, blur: 0 })).toEqual({
			opacity: 0.35,
			blur: 2,
		});
	});

	it("leaves numbers already chosen within the photo family alone", () => {
		expect(retuneBackground("image", "video", { opacity: 0.5, blur: 4 })).toEqual({
			opacity: 0.5,
			blur: 4,
		});
	});

	it("lifts a video's dimming when switching to the drawn wallpaper", () => {
		expect(retuneBackground("video", "default", { opacity: 0.35, blur: 2 })).toEqual({
			opacity: 0.8,
			blur: 0,
		});
	});
});
