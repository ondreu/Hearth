/**
 * @vitest-environment jsdom
 *
 * A task description as the card draws it, and the editor that tells the user
 * what a description line can hold.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";

let view: typeof import("../src/taskdescriptionview");

beforeAll(async () => {
	installObsidianDom();
	view = await import("../src/taskdescriptionview");
});

describe("renderDescriptionLines", () => {
	it("draws one bullet per line with the inline formatting", () => {
		const host = document.body.createDiv();
		view.renderDescriptionLines(host, "buy **milk**\n\n  see [[Shop|the shop]] #errand");
		const lines = Array.from(host.querySelectorAll(".hearth-task-desc-text"));
		expect(lines).toHaveLength(2);
		expect(lines[0].innerHTML).toBe("buy <strong>milk</strong>");
		expect(lines[1].querySelector(".hearth-task-link")?.textContent).toBe("the shop");
		expect(lines[1].querySelector(".hearth-task-desc-tag")?.textContent).toBe("#errand");
	});

	it("opens links through the given opener, and says whether they are external", () => {
		const host = document.body.createDiv();
		const opened: [string, boolean][] = [];
		view.renderDescriptionLines(host, "[[Plan]] [web](https://x.io)", (target, external) => opened.push([target, external]));
		host.querySelectorAll<HTMLElement>(".hearth-task-link").forEach((link) => link.click());
		expect(opened).toEqual([
			["Plan", false],
			["https://x.io", true],
		]);
	});
});

describe("descriptionEditor", () => {
	it("shows the guide and warns about a line a sub-bullet can't hold", () => {
		const row = document.body.createDiv();
		const { area } = view.descriptionEditor(row, "fine");
		expect(row.querySelector("details.hearth-taskdesc-guide summary")?.textContent).toBe("What formatting works here?");
		expect(row.querySelectorAll(".hearth-taskdesc-col.is-works .hearth-taskdesc-item").length).toBeGreaterThan(5);
		expect(row.querySelector(".hearth-taskdesc-col.is-works strong")?.textContent).toBe("bold");
		const issues = row.querySelector(".hearth-taskdesc-issues") as HTMLElement;
		expect(issues.classList.contains("is-empty")).toBe(true);
		area.value = "fine\n## Heading\n- [ ] step";
		area.dispatchEvent(new Event("input"));
		expect(issues.classList.contains("is-empty")).toBe(false);
		expect(Array.from(issues.querySelectorAll(".hearth-taskdesc-issue")).map((e) => e.textContent)).toEqual([
			"Line 2: headings aren't kept — it shows as text starting with #.",
			"Line 3: a checkbox makes this line a sub-task, not part of the description.",
		]);
		expect(area.classList.contains("has-issues")).toBe(true);
	});

	it("drops the guidance for a note body, where anything goes", () => {
		const row = document.body.createDiv();
		const editor = view.descriptionEditor(row, "# Heading");
		editor.setGuided(false);
		expect((row.querySelector(".hearth-taskdesc-help") as HTMLElement).style.display).toBe("none");
		expect(row.querySelector(".hearth-taskdesc-issue")).toBeNull();
	});
});
