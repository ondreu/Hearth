import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "obsidian";
import { FILE_TYPE_GROUPS, excludedGroupIds } from "../src/filetypes";
import { excludedByFilter, filePassesFilter, type QueryFilter } from "../src/query";
import { DEFAULT_SETTINGS, effectiveStrictFilters, type HomeSettings } from "../src/types";

/**
 * The strict search filter (#434): a query that only returns the file types
 * whose chip is on.
 *
 * Covers the two pure halves — turning the chip row into an exclusion list, and
 * deciding whether one file passes — plus the per-board resolver. The chip row
 * itself is DOM and stays on the vault checklist.
 */

function file(name: string): TFile {
	const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
	return Object.assign(new TFile(), { name, path: `inbox/${name}`, extension: ext });
}

const ANY_TYPE: QueryFilter = { includeFolders: true, includeFiles: true, groupId: null };

describe("excludedGroupIds", () => {
	it("names every group the row does not show", () => {
		const excluded = excludedGroupIds(["markdown", "images"]);

		expect(excluded).not.toContain("markdown");
		expect(excluded).not.toContain("images");
		// Everything else is left out, including groups this vault may not hold
		// yet — the list comes from the type table, not from what is on disk.
		expect(excluded).toContain("pdf");
		expect(excluded).toContain("videos");
		expect(excluded).toContain("folders");
		expect(excluded).toHaveLength(FILE_TYPE_GROUPS.length - 2);
	});

	it("excludes everything when no chip is on", () => {
		expect(excludedGroupIds([])).toHaveLength(FILE_TYPE_GROUPS.length);
	});

	it("excludes nothing when every chip is on", () => {
		expect(excludedGroupIds(FILE_TYPE_GROUPS.map((g) => g.id))).toEqual([]);
	});
});

describe("filePassesFilter", () => {
	it("passes everything when the filter excludes nothing", () => {
		// The default, and what every existing vault does until the switch is on.
		expect(filePassesFilter(file("note.md"), ANY_TYPE)).toBe(true);
		expect(filePassesFilter(file("photo.png"), ANY_TYPE)).toBe(true);
		expect(filePassesFilter(file("scan.pdf"), ANY_TYPE)).toBe(true);
	});

	it("drops the types on the strict list", () => {
		const filter: QueryFilter = {
			...ANY_TYPE,
			excludeGroupIds: excludedGroupIds(["markdown", "pdf"]),
		};

		expect(filePassesFilter(file("note.md"), filter)).toBe(true);
		expect(filePassesFilter(file("scan.pdf"), filter)).toBe(true);
		expect(filePassesFilter(file("photo.png"), filter)).toBe(false);
	});

	it("treats an unknown extension as Other, so hiding Other hides it too", () => {
		const filter: QueryFilter = { ...ANY_TYPE, excludeGroupIds: ["other"] };

		expect(filePassesFilter(file("model.zzz"), filter)).toBe(false);
		expect(filePassesFilter(file("note.md"), filter)).toBe(true);
	});

	it("keeps requiring the picked group, and the strict list still wins", () => {
		const pickImages: QueryFilter = { ...ANY_TYPE, groupId: "images" };

		expect(filePassesFilter(file("photo.png"), pickImages)).toBe(true);
		expect(filePassesFilter(file("note.md"), pickImages)).toBe(false);
		expect(
			filePassesFilter(file("photo.png"), { ...pickImages, excludeGroupIds: ["images"] }),
		).toBe(false);
	});

	it("rules out folders by the folders id", () => {
		const folder = Object.assign(new TFolder(), { name: "Library", path: "Library" });
		const filter: QueryFilter = { ...ANY_TYPE, excludeGroupIds: ["folders"] };

		expect(excludedByFilter(folder, filter)).toBe(true);
		expect(excludedByFilter(folder, ANY_TYPE)).toBe(false);
	});
});

describe("effectiveStrictFilters", () => {
	function settings(): HomeSettings {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		s.dashboards = [
			{ id: "d1", name: "Dashboard 1", cards: [] },
			{ id: "d2", name: "Dashboard 2", cards: [] },
		];
		s.activeDashboardId = "d1";
		return s;
	}

	it("is off by default, so an untouched vault searches every type", () => {
		const s = settings();
		expect(DEFAULT_SETTINGS.strictFilters).toBe(false);
		expect(effectiveStrictFilters(s)).toBe(false);
	});

	it("follows the vault when the board sets no override", () => {
		const s = settings();
		s.strictFilters = true;
		expect(effectiveStrictFilters(s)).toBe(true);
	});

	it("lets one board answer for itself in either direction", () => {
		const s = settings();
		s.strictFilters = true;
		s.dashboards[0].strictFilters = false; // board 1: every type
		s.dashboards[1].strictFilters = true;

		expect(effectiveStrictFilters(s)).toBe(false);

		s.activeDashboardId = "d2";
		expect(effectiveStrictFilters(s)).toBe(true);

		s.strictFilters = false;
		expect(effectiveStrictFilters(s)).toBe(true);
	});
});
