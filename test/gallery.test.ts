/**
 * The gallery engine, minus the network.
 *
 * Two things are worth testing here and they are both about *not trusting the
 * other side*: what a package turns into when a listing draws it, and what
 * arbitrary JSON from a host turns into when the client reads it. The client
 * itself is a thin wrapper over `requestUrl` — what it puts in a URL and what
 * it refuses to talk to at all are covered, the socket is not.
 */

import { describe, expect, it } from "vitest";
import {
	asGalleryCategory,
	cardCountsFromPackage,
	DEFAULT_GALLERY_URL,
	GALLERY_CATEGORIES,
	isGalleryCategory,
	normalizeGalleryUrl,
	PREVIEW_MAX_ROWS,
	PREVIEW_MAX_TILES,
	previewFromPackage,
	readEntryDetail,
	readEntrySummary,
	readInfo,
	readListing,
	readPreview,
	readProfile,
} from "../src/gallery";
import type { HearthPackage } from "../src/portable";
import { DEFAULT_SETTINGS, migrateSettings } from "../src/types";

/** A dashboard package with the cards given, and nothing else set. */
function pkg(cards: unknown[], dash: Record<string, unknown> = {}): HearthPackage {
	return {
		hearth: { format: 3, kind: "dashboard" },
		payload: { dashboard: { id: "d1", name: "Board", cards, ...dash } },
	} as unknown as HearthPackage;
}

const KEY = "a".repeat(64);
const HANDLE = "quiet-lantern-4kj2m8";

describe("categories", () => {
	it("has no duplicate ids", () => {
		expect(new Set(GALLERY_CATEGORIES).size).toBe(GALLERY_CATEGORIES.length);
	});

	it("files an unknown or missing category under `other` rather than guessing", () => {
		expect(asGalleryCategory("study")).toBe("study");
		expect(asGalleryCategory("gardening")).toBe("other");
		expect(asGalleryCategory(undefined)).toBe("other");
		expect(isGalleryCategory("other")).toBe(true);
		expect(isGalleryCategory("Other")).toBe(false);
	});
});

describe("previewFromPackage", () => {
	it("turns a board into positioned tiles", () => {
		const preview = previewFromPackage(
			pkg(
				[
					{ id: "a", kind: "tasks", x: 0, y: 0, w: 6, h: 4 },
					{ id: "b", kind: "clock", x: 6, y: 0, w: 6, h: 2 },
				],
				{ gridColumns: 12 },
			),
		);
		expect(preview?.columns).toBe(12);
		expect(preview?.rows).toBe(4);
		expect(preview?.tiles).toEqual([
			{ x: 0, y: 0, w: 6, h: 4, kind: "tasks" },
			{ x: 6, y: 0, w: 6, h: 2, kind: "clock" },
		]);
	});

	it("refuses anything that isn't a dashboard package", () => {
		const settings = { hearth: { format: 3, kind: "settings" }, payload: {} };
		expect(previewFromPackage(settings as unknown as HearthPackage)).toBeNull();
		expect(cardCountsFromPackage(settings as unknown as HearthPackage)).toEqual([]);
	});

	it("clamps a card that claims to be somewhere impossible", () => {
		const preview = previewFromPackage(
			pkg(
				[
					{ kind: "text", x: -50, y: -3, w: 900, h: 9999 },
					{ kind: "text", x: 1e12, y: Number.NaN, w: 0, h: -1 },
				],
				{ gridColumns: 8 },
			),
		);
		for (const tile of preview?.tiles ?? []) {
			expect(tile.x).toBeGreaterThanOrEqual(0);
			expect(tile.y).toBeGreaterThanOrEqual(0);
			expect(tile.w).toBeGreaterThanOrEqual(1);
			expect(tile.h).toBeGreaterThanOrEqual(1);
			expect(tile.x + tile.w).toBeLessThanOrEqual(8);
		}
	});

	it("drops a kind that isn't shaped like one, rather than passing it through", () => {
		const preview = previewFromPackage(
			pkg([{ kind: "<img onerror=x>", x: 0, y: 0, w: 2, h: 2 }]),
		);
		expect(preview?.tiles[0].kind).toBe("");
	});

	it("caps the tiles a listing has to draw, and says how many it left out", () => {
		const many = Array.from({ length: PREVIEW_MAX_TILES + 5 }, (_, i) => ({
			kind: "text",
			x: 0,
			y: i % PREVIEW_MAX_ROWS,
			w: 1,
			h: 1,
		}));
		const preview = previewFromPackage(pkg(many));
		expect(preview?.tiles.length).toBe(PREVIEW_MAX_TILES);
		expect(preview?.truncated).toBe(5);
	});

	it("carries a background colour but never a path, a URL or anything else", () => {
		const colour = previewFromPackage(
			pkg([], { background: { kind: "color", value: "#1a1b26" } }),
		);
		expect(colour?.background).toEqual({ kind: "color", color: "#1a1b26" });

		const path = previewFromPackage(
			pkg([], { background: { kind: "image", value: "Attachments/wall.png" } }),
		);
		expect(path?.background?.color).toBeUndefined();
		expect(path?.background?.hasImage).toBeUndefined();

		const url = previewFromPackage(
			pkg([], { background: { kind: "image", value: "url(javascript:alert(1))" } }),
		);
		expect(url?.background?.color).toBeUndefined();
	});

	it("marks an embedded wallpaper, which is the only one a listing can fetch", () => {
		const preview = previewFromPackage(
			pkg([], { background: { kind: "image", value: "hearth:asset/a1" } }),
		);
		expect(preview?.background?.hasImage).toBe(true);
	});

	it("says a plugin board is one, since it has no tiles to draw", () => {
		const preview = previewFromPackage(pkg([], { mode: "plugin" }));
		expect(preview?.pluginBoard).toBe(true);
	});

	it("counts the cards by kind, most first", () => {
		expect(
			cardCountsFromPackage(
				pkg([
					{ kind: "text", x: 0, y: 0, w: 1, h: 1 },
					{ kind: "tasks", x: 0, y: 0, w: 1, h: 1 },
					{ kind: "text", x: 0, y: 0, w: 1, h: 1 },
				]),
			),
		).toEqual([
			{ kind: "text", count: 2 },
			{ kind: "tasks", count: 1 },
		]);
	});
});

describe("readPreview re-clamps what arrives over the wire", () => {
	it("holds every number inside its range", () => {
		const preview = readPreview({
			columns: 1e9,
			rows: -4,
			tiles: [{ x: "1", y: 1e9, w: Number.POSITIVE_INFINITY, h: 1e9, kind: 42 }],
			opacity: 12,
			radius: 1e6,
			background: { kind: "color", color: "url(x)" },
		});
		expect(preview?.columns).toBeLessThanOrEqual(48);
		expect(preview?.rows).toBeGreaterThanOrEqual(1);
		expect(preview?.tiles[0].kind).toBe("");
		expect(preview?.opacity).toBe(1);
		expect(preview?.radius).toBeLessThanOrEqual(64);
		expect(preview?.background?.color).toBeUndefined();
	});

	it("never places a tile outside the grid it declares", () => {
		// A host that sends a short `rows` beside a tall tile would otherwise get
		// the tile drawn outside the frame: the browser resolves a grid row past
		// the declared count by adding an implicit one.
		const preview = readPreview({
			columns: 12,
			rows: 2,
			tiles: [
				{ x: 0, y: 9, w: 4, h: 3, kind: "text" },
				{ x: 11, y: 0, w: 8, h: 1, kind: "clock" },
			],
		});
		for (const tile of preview?.tiles ?? []) {
			expect(tile.x + tile.w).toBeLessThanOrEqual(preview!.columns);
			expect(tile.y + tile.h).toBeLessThanOrEqual(preview!.rows);
		}
	});

	it("keeps a tile's row index inside the row cap, as capture does", () => {
		const preview = readPreview({
			columns: 12,
			tiles: [{ x: 0, y: PREVIEW_MAX_ROWS + 40, w: 1, h: 1, kind: "text" }],
		});
		expect(preview?.tiles[0].y).toBeLessThan(PREVIEW_MAX_ROWS);
		expect(preview!.tiles[0].y + preview!.tiles[0].h).toBeLessThanOrEqual(preview!.rows);
	});

	it("reads nothing out of nothing", () => {
		expect(readPreview(null)).toBeNull();
		expect(readPreview("a preview")).toBeNull();
	});
});

describe("reading a listing from a host", () => {
	const entry = {
		id: "e1",
		name: "Reading room",
		description: "  A board.  ",
		category: "writing",
		tags: ["Minimal", "minimal", "dark"],
		author: { handle: HANDLE, publicKey: KEY },
		upvotes: 12,
		downvotes: 2,
		downloads: 40,
		myVote: 1,
		publishedAt: "2026-09-01T10:00:00.000Z",
		hasWallpaper: true,
	};

	it("reads a well-formed entry", () => {
		const read = readEntrySummary(entry);
		expect(read?.name).toBe("Reading room");
		expect(read?.description).toBe("A board.");
		expect(read?.category).toBe("writing");
		// De-duplicated and lower-cased, so two spellings of one tag are one tag.
		expect(read?.tags).toEqual(["minimal", "dark"]);
		expect(read?.score).toBe(10);
		expect(read?.myVote).toBe(1);
	});

	it("refuses an entry with no id or no name — a row can't be drawn from it", () => {
		expect(readEntrySummary({ ...entry, id: undefined })).toBeNull();
		expect(readEntrySummary({ ...entry, name: "   " })).toBeNull();
	});

	it("refuses an id that isn't one, so it can't reach into a URL path", () => {
		expect(readEntrySummary({ ...entry, id: "../../admin" })).toBeNull();
		expect(readEntrySummary({ ...entry, id: "a/b" })).toBeNull();
	});

	it("drops an author whose handle or key isn't the shape identity.ts derives", () => {
		expect(readEntrySummary({ ...entry, author: { handle: "Ondrej", publicKey: KEY } })?.author)
			.toBeNull();
		expect(readEntrySummary({ ...entry, author: { handle: HANDLE, publicKey: "nope" } })?.author)
			.toBeNull();
	});

	it("takes the host's own score, since a host may weight or age it", () => {
		expect(readEntrySummary({ ...entry, score: 3 })?.score).toBe(3);
		// …and falls back to the plain difference when it didn't send one.
		expect(readEntrySummary({ ...entry, score: undefined })?.score).toBe(10);
	});

	it("ignores a date that isn't one", () => {
		expect(readEntrySummary({ ...entry, publishedAt: "soon" })?.publishedAt).toBeUndefined();
	});

	it("bounds a description a host made enormous", () => {
		const read = readEntrySummary({ ...entry, description: "x".repeat(50_000) });
		expect(read?.description?.length).toBe(1000);
	});

	it("keeps the good rows out of a page that also has bad ones", () => {
		const listing = readListing({ entries: [entry, null, { id: "e2" }, 7], total: 4 });
		expect(listing.entries.map((e) => e.id)).toEqual(["e1"]);
		expect(listing.total).toBe(4);
	});

	it("reads a detail's contents and requirements", () => {
		const detail = readEntryDetail({
			...entry,
			cards: [{ kind: "tasks", count: 2 }, { kind: 3 }],
			requires: { plugins: ["dataview", "dataview"], cardKinds: [], viewTypes: ["kanban"] },
			remoteRefs: 2,
			sizeBytes: 4096,
		});
		expect(detail?.cards).toEqual([{ kind: "tasks", count: 2 }]);
		expect(detail?.requires.plugins).toEqual(["dataview"]);
		expect(detail?.requires.settings).toEqual([]);
		expect(detail?.remoteRefs).toBe(2);
	});

	it("reads a profile, and refuses one with no author", () => {
		const profile = readProfile({
			author: { handle: HANDLE, publicKey: KEY },
			entries: [entry],
			totalUpvotes: 30,
			totalDownvotes: 4,
			totalDownloads: 900,
		});
		expect(profile?.totalScore).toBe(26);
		expect(profile?.entries.length).toBe(1);
		expect(readProfile({ entries: [] })).toBeNull();
	});

	it("fills in its own limits for a host that didn't state them", () => {
		const info = readInfo({ name: "Example", api: 1 });
		expect(info.limits.maxPackageBytes).toBeGreaterThan(0);
		expect(info.termsUrl).toBeUndefined();
		// An http terms link is not one Hearth would put in front of a reader.
		expect(readInfo({ termsUrl: "http://example.com/terms" }).termsUrl).toBeUndefined();
		expect(readInfo({ termsUrl: "https://example.com/terms" }).termsUrl).toBe(
			"https://example.com/terms",
		);
	});
});

describe("the gallery host a vault ends up with", () => {
	/** A settings object as `loadData` would hand it over, before migration. */
	function migrated(raw: Record<string, unknown>): string {
		const s = structuredClone(DEFAULT_SETTINGS);
		migrateSettings(s, raw);
		return s.galleryUrl;
	}

	it("gives a vault that has never seen the setting the default", () => {
		// The upgrade path for every existing install: `data.json` has no
		// `galleryUrl` key at all.
		expect(migrated({})).toBe(DEFAULT_GALLERY_URL);
	});

	it("leaves a vault that turned the gallery off turned off", () => {
		// The one that matters. An empty string is somebody's decision, and
		// re-seeding the default over it would switch the feature back on at
		// every upgrade, silently.
		expect(migrated({ galleryUrl: "" })).toBe("");
	});

	it("keeps a host somebody chose", () => {
		expect(migrated({ galleryUrl: "https://gallery.example.com/" })).toBe(
			"https://gallery.example.com",
		);
	});

	it("clears a stored host this build would not talk to", () => {
		// A hand-edited `data.json` must not leave a vault pointed at an `http:`
		// host on the network and looking configured — and it must not silently
		// fall back to the default either, since that is a host the vault never
		// asked for.
		expect(migrated({ galleryUrl: "http://192.168.1.5:8787" })).toBe("");
		expect(migrated({ galleryUrl: "not a url" })).toBe("");
	});

	it("ships a default this build would actually talk to", () => {
		expect(normalizeGalleryUrl(DEFAULT_GALLERY_URL)).toBe(DEFAULT_GALLERY_URL);
	});
});

describe("normalizeGalleryUrl", () => {
	it("takes https anywhere", () => {
		expect(normalizeGalleryUrl("https://gallery.example.com/")).toBe(
			"https://gallery.example.com",
		);
		expect(normalizeGalleryUrl("  https://example.com/gallery/  ")).toBe(
			"https://example.com/gallery",
		);
	});

	it("takes plain http only on loopback, so `docker compose up` works", () => {
		expect(normalizeGalleryUrl("http://localhost:8787")).toBe("http://localhost:8787");
		expect(normalizeGalleryUrl("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
		expect(normalizeGalleryUrl("http://gallery.example.com")).toBeNull();
		expect(normalizeGalleryUrl("http://192.168.1.5:8787")).toBeNull();
	});

	it("refuses anything that isn't a host Hearth would talk to", () => {
		expect(normalizeGalleryUrl("")).toBeNull();
		expect(normalizeGalleryUrl("gallery.example.com")).toBeNull();
		expect(normalizeGalleryUrl("file:///etc/passwd")).toBeNull();
		expect(normalizeGalleryUrl("javascript:alert(1)")).toBeNull();
		// Credentials in a URL are a way to hand a secret to a host by pasting.
		expect(normalizeGalleryUrl("https://user:pw@example.com")).toBeNull();
	});
});
