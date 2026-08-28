import { describe, expect, it } from "vitest";
import { classifyTitleIcon } from "../src/titleicon";
import {
	DEFAULT_SETTINGS,
	effectiveTitleIcon,
	type HomeSettings,
	legacyTitleIcon,
	migrateSettings,
} from "../src/types";

/**
 * The title icon is one field holding five different things (#252), so two
 * things have to be pinned down and never drift: which of the five a given
 * string is, and what the pre-2.2 `logo`/`logoIcon` pair folds into.
 *
 * The migration is the sharper of the two — it runs once, on data a user
 * cannot get back — so it is tested through `migrateSettings` itself rather
 * than through the fold in isolation.
 */

/** The registered ids Obsidian would report: the Lucide set is prefixed. */
const REGISTERED = new Set(["lucide-flame", "lucide-home", "hearth-crystal"]);
const isKnown = (id: string) => REGISTERED.has(id);
const classify = (raw: string | undefined) => classifyTitleIcon(raw, isKnown);

describe("classifyTitleIcon", () => {
	it("reads an empty value as the fallback mark", () => {
		expect(classify("")).toEqual({ kind: "empty", value: "" });
		expect(classify("   ")).toEqual({ kind: "empty", value: "" });
		expect(classify(undefined)).toEqual({ kind: "empty", value: "" });
	});

	it("reads an http(s) address as a picture from the web", () => {
		expect(classify("https://example.com/logo.png")).toEqual({
			kind: "url",
			value: "https://example.com/logo.png",
		});
		// No extension needed — plenty of image URLs don't carry one.
		expect(classify("HTTPS://cdn.example.com/i/abc123").kind).toBe("url");
		expect(classify("http://example.com/logo.svg").kind).toBe("url");
	});

	it("does not fetch any other scheme", () => {
		// A title icon is not a place to let arbitrary schemes in; the vault path
		// covers the local case.
		expect(classify("file:///etc/passwd").kind).toBe("text");
		expect(classify("data:image/png;base64,AAAA").kind).toBe("text");
		expect(classify("javascript:alert(1)").kind).toBe("text");
	});

	it("reads a path ending in a picture extension as a vault image", () => {
		expect(classify("Assets/logo.png")).toEqual({
			kind: "image",
			value: "Assets/logo.png",
		});
		expect(classify("logo.WEBP").kind).toBe("image");
		expect(classify("brand.svg").kind).toBe("image");
	});

	it("reads a known icon id as a Lucide icon, prefixed as setIcon wants it", () => {
		expect(classify("flame")).toEqual({ kind: "lucide", value: "lucide-flame" });
		expect(classify("  lucide-home  ")).toEqual({ kind: "lucide", value: "lucide-home" });
	});

	it("reads everything else as the text itself", () => {
		expect(classify("🔥")).toEqual({ kind: "text", value: "🔥" });
		expect(classify("OU")).toEqual({ kind: "text", value: "OU" });
		// A word that isn't an icon stays a word rather than vanishing, which is
		// what an unknown id handed to setIcon would do.
		expect(classify("flames")).toEqual({ kind: "text", value: "flames" });
		// Not an image: ".0" is not a picture extension.
		expect(classify("v1.0")).toEqual({ kind: "text", value: "v1.0" });
	});

	it("falls back to the shape of the value when the icon registry is unreadable", () => {
		// Trusting everything through as an icon (what a Lucide-only field does)
		// would hand setIcon an emoji and draw nothing at all.
		expect(classifyTitleIcon("flame", () => false, false).kind).toBe("lucide");
		expect(classifyTitleIcon("🔥", () => false, false).kind).toBe("text");
		expect(classifyTitleIcon("OU", () => false, false).kind).toBe("text");
		expect(classifyTitleIcon("H", () => false, false).kind).toBe("text");
	});
});

describe("legacyTitleIcon", () => {
	it("keeps the Lucide icon, which is what the old pair drew when both were set", () => {
		expect(legacyTitleIcon({ logo: "🔥", logoIcon: "flame" })).toBe("flame");
	});

	it("keeps the logo text when no icon was set", () => {
		expect(legacyTitleIcon({ logo: "🔥", logoIcon: "" })).toBe("🔥");
		expect(legacyTitleIcon({ logo: "🔥" })).toBe("🔥");
	});

	it("falls back field by field to the pair a board inherited", () => {
		// A board that overrode only the text still drew the vault-wide icon.
		expect(legacyTitleIcon({ logo: "🌟" }, { logoIcon: "flame" })).toBe("flame");
		// …and one that only opted out of the icon drew the vault-wide text.
		expect(legacyTitleIcon({ logoIcon: "" }, { logo: "🔥", logoIcon: "flame" })).toBe("🔥");
	});

	it("is empty when neither side named anything", () => {
		expect(legacyTitleIcon({})).toBe("");
		expect(legacyTitleIcon({ logo: "  ", logoIcon: "  " })).toBe("");
	});
});

/** A settings object as `loadSettings` builds it: the defaults with the
 * persisted keys merged over them, legacy fields and all. */
function loaded(raw: Record<string, unknown>): {
	s: HomeSettings;
	raw: Record<string, unknown>;
} {
	const s = Object.assign(structuredClone(DEFAULT_SETTINGS), structuredClone(raw));
	return { s, raw };
}

describe("migrateSettings: the logo/logoIcon fold", () => {
	it("folds the vault-wide pair into titleIcon and retires both fields", () => {
		const { s, raw } = loaded({
			logo: "🔥",
			logoIcon: "flame",
			dashboards: [{ id: "d1", name: "Dashboard 1", cards: [] }],
			activeDashboardId: "d1",
		});
		expect(migrateSettings(s, raw)).toBe(true);
		expect(s.titleIcon).toBe("flame");
		expect("logo" in s).toBe(false);
		expect("logoIcon" in s).toBe(false);
	});

	it("keeps the logo text when there was no icon to hide it", () => {
		const { s, raw } = loaded({
			logo: "🔥",
			logoIcon: "",
			dashboards: [{ id: "d1", name: "Dashboard 1", cards: [] }],
			activeDashboardId: "d1",
		});
		migrateSettings(s, raw);
		expect(s.titleIcon).toBe("🔥");
	});

	it("leaves a vault that never set either on the crystal", () => {
		const { s, raw } = loaded({
			dashboards: [{ id: "d1", name: "Dashboard 1", cards: [] }],
			activeDashboardId: "d1",
		});
		// Nothing to retire, so nothing needs flushing back to storage either.
		expect(migrateSettings(s, raw)).toBe(false);
		expect(s.titleIcon).toBe("");
	});

	it("gives a board the mark it was drawing, not the field it had set", () => {
		// The board's own logo text was never visible: the vault-wide Lucide icon
		// won. Migrating to the text would change what the board looks like.
		const { s, raw } = loaded({
			logo: "",
			logoIcon: "flame",
			dashboards: [
				{ id: "d1", name: "One", cards: [], header: { logo: "🌟" } },
				{ id: "d2", name: "Two", cards: [], header: { logoIcon: "rocket" } },
			],
			activeDashboardId: "d1",
		});
		migrateSettings(s, raw);
		expect(s.titleIcon).toBe("flame");
		// d1 drew the global icon, so it has no override left to carry.
		expect(s.dashboards[0].header).toBeUndefined();
		expect(effectiveTitleIcon(s)).toBe("flame");
		expect(s.dashboards[1].header).toEqual({ titleIcon: "rocket" });
	});

	it("keeps a board that opted out of the global icon on the text it showed", () => {
		const { s, raw } = loaded({
			logo: "🔥",
			logoIcon: "flame",
			dashboards: [
				{ id: "d1", name: "One", cards: [], header: { logoIcon: "", showTitle: true } },
			],
			activeDashboardId: "d1",
		});
		migrateSettings(s, raw);
		expect(s.titleIcon).toBe("flame");
		expect(s.dashboards[0].header).toEqual({ titleIcon: "🔥", showTitle: true });
		expect(effectiveTitleIcon(s)).toBe("🔥");
	});

	it("converges: a second run changes nothing and asks for no second save", () => {
		const { s, raw } = loaded({
			logo: "🔥",
			logoIcon: "flame",
			dashboards: [{ id: "d1", name: "One", cards: [], header: { logo: "🌟" } }],
			activeDashboardId: "d1",
		});
		migrateSettings(s, raw);
		const after = structuredClone(s);
		expect(migrateSettings(s, s as unknown as Record<string, unknown>)).toBe(false);
		expect(s).toEqual(after);
	});

	it("treats an already-merged titleIcon as authoritative", () => {
		// A downgrade and re-upgrade can leave both generations of the field
		// behind; the newer one wins and the old pair is dropped without loss.
		const { s, raw } = loaded({
			titleIcon: "Assets/logo.png",
			logo: "🔥",
			logoIcon: "flame",
			dashboards: [
				{ id: "d1", name: "One", cards: [], header: { titleIcon: "rocket", logo: "🌟" } },
			],
			activeDashboardId: "d1",
		});
		expect(migrateSettings(s, raw)).toBe(true);
		expect(s.titleIcon).toBe("Assets/logo.png");
		expect(s.dashboards[0].header).toEqual({ titleIcon: "rocket" });
	});
});

describe("effectiveTitleIcon", () => {
	function settings(): HomeSettings {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		s.dashboards = [
			{ id: "d1", name: "Dashboard 1", cards: [] },
			{ id: "d2", name: "Dashboard 2", cards: [] },
		];
		s.activeDashboardId = "d1";
		return s;
	}

	it("is empty by default, so the Hearth crystal is drawn", () => {
		expect(effectiveTitleIcon(settings())).toBe("");
	});

	it("follows the vault-wide mark on a board with no override", () => {
		const s = settings();
		s.titleIcon = "flame";
		expect(effectiveTitleIcon(s)).toBe("flame");
	});

	it("lets a board pick its own mark without touching the others", () => {
		const s = settings();
		s.titleIcon = "flame";
		s.dashboards[0].header = { titleIcon: "Assets/logo.png" };
		expect(effectiveTitleIcon(s)).toBe("Assets/logo.png");
		s.activeDashboardId = "d2";
		expect(effectiveTitleIcon(s)).toBe("flame");
	});

	it("treats an empty override as 'the crystal on this board'", () => {
		// Distinct from having no override at all: the board opts out of the
		// vault-wide mark rather than inheriting it.
		const s = settings();
		s.titleIcon = "flame";
		s.dashboards[0].header = { titleIcon: "" };
		expect(effectiveTitleIcon(s)).toBe("");
		s.activeDashboardId = "d2";
		expect(effectiveTitleIcon(s)).toBe("flame");
	});
});
