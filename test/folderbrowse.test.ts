import { describe, expect, it } from "vitest";
import { browseStateFor, defaultBrowseState, picturesAllowed, readBrowseState } from "../src/folderbrowse";
import { PREVIEW_SIZE } from "../src/notepreview";

/** The folder browser's state: from a card, and back out of a tab's saved
 * state (#375). */

describe("browseStateFor", () => {
	it("takes the browser's own layout, not the card's", () => {
		const state = browseStateFor({ view: "tiles", sort: "name", counts: true }, "A");
		expect(state).toEqual({
			path: "A",
			sort: "name",
			show: "all",
			counts: true,
			layout: "list",
			preview: true,
			previewSize: PREVIEW_SIZE.default,
			images: true,
		});
		expect(browseStateFor({ browserView: "tiles", preview: false, previewSize: 11 }, "A")).toMatchObject({
			layout: "tiles",
			preview: false,
			previewSize: 11,
		});
	});
});

describe("readBrowseState", () => {
	it("round-trips a state", () => {
		const state = browseStateFor({ browserView: "tiles", show: "files", sort: "modified" }, "A/B");
		expect(readBrowseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
	});

	it("falls back field by field on damaged state", () => {
		expect(
			readBrowseState({ path: "/A/", sort: "sideways", show: 3, layout: "grid", previewSize: 500 }),
		).toEqual({ ...defaultBrowseState("A"), previewSize: PREVIEW_SIZE.max });
		expect(readBrowseState(null)).toEqual(defaultBrowseState(""));
	});
});

describe("picturesAllowed", () => {
	const tiles = browseStateFor({ browserView: "tiles" }, "A");

	it("draws pictures on tiles, on the Full tier only", () => {
		expect(picturesAllowed(tiles, "full")).toBe(true);
		expect(picturesAllowed(tiles, "balanced")).toBe(false);
		expect(picturesAllowed(tiles, "reduced")).toBe(false);
		expect(picturesAllowed(tiles, "minimal")).toBe(false);
	});

	it("draws none in a list, or with pictures turned off", () => {
		expect(picturesAllowed({ ...tiles, layout: "list" }, "full")).toBe(false);
		expect(picturesAllowed({ ...tiles, images: false }, "full")).toBe(false);
	});
});

describe("the page's design", () => {
	it("is kept by a tab, and only when it names one", () => {
		expect(readBrowseState({ design: "expressive" }).design).toBe("expressive");
		expect(readBrowseState({ design: "neon" }).design).toBeUndefined();
	});
});
