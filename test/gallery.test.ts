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
	GalleryClient,
	cardCountsFromPackage,
	DEFAULT_GALLERY_URL,
	GALLERY_CATEGORIES,
	isGalleryCategory,
	normalizeGalleryUrl,
	readEntryDetail,
	readEntrySummary,
	readInfo,
	readListing,
	readProfile,
	redactedText,
} from "../src/gallery";
import type { HearthPackage } from "../src/portable";
import { DEFAULT_SETTINGS, migrateSettings } from "../src/types";

/**
 * A card at the coordinates the board renders from: `fx`/`fw` as fractions of
 * the width, `fy`/`fh` in pixels. The grid units beside them are the legacy
 * seed the renderer ignores, and they are deliberately *wrong* here — a preview
 * that reads them instead would fail these tests, which is how the first
 * version's mistake would have been caught.
 */
function card(
	kind: string,
	geo: { fx: number; fy: number; fw: number; fh: number },
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return { id: `c-${kind}-${geo.fy}`, kind, x: 99, y: 99, w: 99, h: 99, ...geo, ...extra };
}

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

describe("cardCountsFromPackage", () => {
	it("counts the cards by kind, most first", () => {
		expect(
			cardCountsFromPackage(
				pkg([
					card("text", { fx: 0, fy: 0, fw: 0.2, fh: 100 }),
					card("tasks", { fx: 0, fy: 110, fw: 0.2, fh: 100 }),
					card("text", { fx: 0, fy: 220, fw: 0.2, fh: 100 }),
				]),
			),
		).toEqual([
			{ kind: "text", count: 2 },
			{ kind: "tasks", count: 1 },
		]);
	});

	it("refuses anything that isn't a dashboard package", () => {
		const settings = { hearth: { format: 3, kind: "settings" }, payload: {} };
		expect(cardCountsFromPackage(settings as unknown as HearthPackage)).toEqual([]);
	});

	it("drops a kind that isn't shaped like one", () => {
		// It reaches a card-registry lookup and a class name on the way to the
		// screen, so a value that isn't a plain kind id does not travel.
		expect(
			cardCountsFromPackage(pkg([card("<img onerror=x>", { fx: 0, fy: 0, fw: 0.2, fh: 100 })])),
		).toEqual([]);
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

describe("redactedText", () => {
	/**
	 * The rule the snapshot applies before a board is photographed. Whatever
	 * survives this is in the published JPEG permanently, in strangers' vaults,
	 * so the only interesting property is that nothing readable does.
	 *
	 * The DOM traversal that applies it — text nodes *and* form-field values,
	 * which is where a calculator card keeps its last sum — is not covered here:
	 * this suite is deliberately DOM-free (see `vitest.config.ts`). The dialog
	 * showing the captured picture before anything is uploaded is the check that
	 * catches what a unit test here cannot.
	 */
	it("leaves nothing readable, and keeps the shape of the line", () => {
		expect(redactedText("Therapy notes")).toBe("███████ █████");
		expect(redactedText("1200*1.21")).toBe("█████████");
	});

	it("redacts every script, not just Latin letters", () => {
		expect(redactedText("Ondřej 日本語")).toBe("██████ ███");
	});

	it("keeps whitespace, so a line still reads as a line of words", () => {
		expect(redactedText("  a  b  ")).toBe("  █  █  ");
	});

	it("caps a very long run rather than painting an essay to photograph it", () => {
		expect(redactedText("a".repeat(5000)).length).toBe(120);
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

describe("picture addresses", () => {
	const client = new GalleryClient("https://gallery.example.com");

	/**
	 * The bug this exists to stop: publish a board, publish it again with a new
	 * picture, and everyone who had already looked keeps seeing the old one —
	 * the bytes changed but the address didn't, and the host serves pictures
	 * with a long `max-age` because for one version of an entry they really are
	 * immutable.
	 */
	it("gives a republished entry a picture address of its own", () => {
		const before = client.snapshotUrl("abc", "2026-01-01T00:00:00.000Z");
		const after = client.snapshotUrl("abc", "2026-02-01T00:00:00.000Z");
		expect(before).not.toBe(after);
		expect(new URL(before).pathname).toBe(new URL(after).pathname);
		expect(new URL(after).searchParams.get("v")).toBeTruthy();
	});

	it("is stable for an entry that has not changed", () => {
		expect(client.wallpaperUrl("abc", "2026-01-01T00:00:00.000Z")).toBe(
			client.wallpaperUrl("abc", "2026-01-01T00:00:00.000Z"),
		);
	});

	it("asks for the picture plainly when the host never said when it changed", () => {
		expect(client.snapshotUrl("abc")).toBe(
			"https://gallery.example.com/v1/entries/abc/snapshot",
		);
	});
});

describe("the author's own entry", () => {
	/** A detail response as a host would send one. */
	function detail(extra: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			id: "e1",
			name: "Board",
			author: { publicKey: KEY, handle: HANDLE },
			cards: [],
			requires: {},
			...extra,
		};
	}

	/**
	 * `sourceId` is how the detail view finds the local board an entry was
	 * published from, so "update" can mean this entry rather than a second one
	 * beside it. A host sends it only to the author; everybody else gets a
	 * detail without it, and a vault that has no board with that id gets no
	 * match — both of which read as "nothing to update" rather than as an error.
	 */
	it("carries the published id back when the host sends one", () => {
		expect(readEntryDetail(detail({ sourceId: "brd-1a2b" }))?.sourceId).toBe("brd-1a2b");
	});

	it("has none when the host didn't say, or said something that isn't an id", () => {
		expect(readEntryDetail(detail())?.sourceId).toBeUndefined();
		expect(readEntryDetail(detail({ sourceId: "../../etc/passwd" }))?.sourceId).toBeUndefined();
		expect(readEntryDetail(detail({ sourceId: 7 }))?.sourceId).toBeUndefined();
	});
});
