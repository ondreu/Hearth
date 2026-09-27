/**
 * @vitest-environment jsdom
 *
 * An Expressive dialog's tab gathers its flat run of settings rows into tonal
 * groups after it is drawn (groupSettingRows in src/uidesign.ts): a group per
 * heading and per break marker, and whatever an editor adds later joins the
 * last one.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

let groupSettingRows: typeof import("../src/uidesign").groupSettingRows;

beforeAll(async () => {
	installObsidianDom();
	({ groupSettingRows } = await import("../src/uidesign"));
});

function row(body: HTMLElement, name: string, heading = false): HTMLElement {
	const el = body.createDiv(heading ? "setting-item setting-item-heading" : "setting-item");
	el.dataset.name = name;
	return el;
}

/** Each group as [heading or "-", ...row names]. */
function shape(body: HTMLElement): string[][] {
	return Array.from(body.children).map((group) => {
		const head = group.querySelector<HTMLElement>(":scope > .setting-item-heading");
		const rows = Array.from(group.querySelectorAll<HTMLElement>(":scope > .hearth-x-group-body > *"));
		return [head?.dataset.name ?? "-", ...rows.map((r) => r.dataset.name ?? "?")];
	});
}

describe("groupSettingRows", () => {
	it("starts a group at every heading, with the rows before the first untitled", () => {
		const body = document.body.createDiv();
		row(body, "type");
		row(body, "title");
		row(body, "Mobile", true);
		row(body, "hide");
		row(body, "height");
		row(body, "Buttons", true);
		row(body, "size");
		groupSettingRows(body);
		expect(shape(body)).toEqual([
			["-", "type", "title"],
			["Mobile", "hide", "height"],
			["Buttons", "size"],
		]);
	});

	it("splits at a break marker and drops the marker, however many are in a row", () => {
		const body = document.body.createDiv();
		row(body, "a");
		body.createDiv("hearth-x-group-break");
		body.createDiv("hearth-x-group-break");
		row(body, "b");
		groupSettingRows(body);
		expect(shape(body)).toEqual([["-", "a"], ["-", "b"]]);
		expect(body.querySelector(".hearth-x-group-break")).toBeNull();
	});

	it("puts a row added later into the last group and leaves the rest as they were", () => {
		const body = document.body.createDiv();
		row(body, "Feed", true);
		row(body, "url");
		groupSettingRows(body);
		row(body, "fetched");
		groupSettingRows(body);
		expect(shape(body)).toEqual([["Feed", "url", "fetched"]]);
	});
});
