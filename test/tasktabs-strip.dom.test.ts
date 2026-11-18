/**
 * @vitest-environment jsdom
 *
 * The Tasks card's rows of tabs (#481), drawn end to end: the strip renders
 * above the list from the card's own loaded hits, picking a tab narrows the
 * list without a vault read or a saveData, keyboard moves selection inside a
 * row, and the matrix layout draws no strip at all.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { installObsidianDom } from "./support/obsidian-dom";

installObsidianDom();

let tasks: typeof import("../src/cards/tasks");
let locales: typeof import("../src/locales/en");
let types: typeof import("../src/types");
let model: typeof import("../src/tasktabs");

beforeAll(async () => {
	// Seed the module graph through the registry: cards/tasks.ts reaches it
	// through editors.ts, so importing tasks first would evaluate the
	// registry against a half-initialised cycle.
	await import("../src/cards/index");
	tasks = await import("../src/cards/tasks");
	locales = await import("../src/locales/en");
	types = await import("../src/types");
	model = await import("../src/tasktabs");
});

beforeEach(() => {
	document.body.empty();
});

const fileAt = (path: string): TFile => {
	const file = new TFile();
	(file as { path: string }).path = path;
	(file as { basename: string }).basename = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
	(file as { stat: unknown }).stat = { ctime: 0 };
	return file;
};

/** A stand-in view exposing what the checkbox source reads. */
function viewWith(files: Record<string, string>) {
	const list = Object.keys(files).map(fileAt);
	const saveData = vi.fn(async () => {});
	const view = {
		app: {
			plugins: { enabledPlugins: new Set<string>(), plugins: {} },
			vault: {
				getMarkdownFiles: () => list,
				cachedRead: async (file: TFile) => files[(file as unknown as { path: string }).path] ?? "",
				read: async (file: TFile) => files[(file as unknown as { path: string }).path] ?? "",
				getAbstractFileByPath: (path: string) => list.find((f) => (f as unknown as { path: string }).path === path) ?? null,
			},
			metadataCache: {
				getFileCache: () => ({ listItems: [{ task: " " }] }),
				getFirstLinkpathDest: () => null,
			},
			commands: { listCommands: () => [] },
			fileManager: { processFrontMatter: async () => {} },
		},
		plugin: { settings: structuredClone(types.DEFAULT_SETTINGS), saveData },
		arrangeMode: false,
	} as never;
	return { view, saveData };
}

const cardWith = (over: Record<string, unknown> = {}) =>
	({ kind: "tasks", title: "Tasks", tasks: { source: "checkbox", ...over } }) as never;

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
	await new Promise((r) => window.setTimeout(r, 0));
};

const FILES = {
	"Notes/T.md": "- [ ] alpha #work\n- [ ] beta #home\n- [x] done thing #work\n",
};

const tabLabel = (btn: Element): string => btn.querySelector(".hearth-tasktab-label")?.textContent ?? "";

function tabButtons(root: ParentNode): HTMLButtonElement[] {
	return Array.from(root.querySelectorAll(".hearth-tasktab"), (el) => el as HTMLButtonElement);
}

describe("taskTabFacts", () => {
	it("reads each facet off a hit, status from whichever source provides it", () => {
		expect(
			tasks.taskTabFacts({
				file: fileAt("Notes/T.md"),
				line: 0,
				text: "alpha",
				done: false,
				due: null,
				dueRaw: null,
				scheduled: null,
				created: 0,
				tags: ["work"],
				projects: ["[[Dropzone]]"],
				contexts: ["home"],
				priority: "high",
				checkboxLabel: "To do",
			}),
		).toEqual({
			tags: ["work"],
			projects: ["[[Dropzone]]"],
			contexts: ["home"],
			priority: "high",
			status: "To do",
		});
	});
});

describe("renderTaskTabStrip", () => {
	const facts = [{ tags: ["work"] }, { tags: ["work", "home"] }, { tags: [] }];
	const rows = [{ id: "r1", facet: "tag", mode: "auto", label: "Tags" }] as const;

	it("draws the caption, one tab per value with counts, and a dimmed zero", () => {
		const resolved = model.resolveTaskTabRows(facts, [...rows]);
		const picks: Array<[string, string]> = [];
		const host = document.body.createDiv();
		tasks.renderTaskTabStrip(host, resolved, (row, id) => picks.push([row.id, id]));

		expect(host.querySelector(".hearth-tasktabs")?.getAttribute("aria-label")).toBe(
			locales.en.cards.tasks.tabs.title,
		);
		expect(host.querySelector(".hearth-tasktab-caption-label")?.textContent).toBe("Tags");
		const buttons = tabButtons(host);
		expect(buttons.map(tabLabel)).toEqual([
			locales.en.cards.tasks.tabs.all,
			"#home",
			"#work",
		]);
		// Counts match the card's own filter math: All sees 3, #home sees 1.
		expect(buttons.map((b) => b.querySelector(".hearth-tasktab-count")?.textContent)).toEqual(["3", "1", "2"]);
		expect(buttons[0].getAttribute("aria-selected")).toBe("true");
		expect(buttons[0].getAttribute("role")).toBe("tab");
		expect(host.querySelector(".hearth-tasktab-list")?.getAttribute("role")).toBe("tablist");

		// A fixed row naming a value no task carries keeps its tab, dimmed.
		host.empty();
		const fixed = model.resolveTaskTabRows(facts, [{ id: "r2", facet: "tag", mode: "fixed", values: ["zzz"] }]);
		tasks.renderTaskTabStrip(host, fixed, () => {});
		const zero = tabButtons(host)[1];
		expect(tabLabel(zero)).toBe("#zzz");
		expect(zero.querySelector(".hearth-tasktab-count")?.textContent).toBe("0");
		expect(zero.querySelector(".hearth-tasktab-count")?.classList.contains("is-zero")).toBe(true);
	});

	it("reports picks and moves selection with the keyboard", () => {
		const resolved = model.resolveTaskTabRows(facts, [...rows]);
		const picks: Array<{ id: string; refocus: number | null }> = [];
		const host = document.body.createDiv();
		tasks.renderTaskTabStrip(host, resolved, (_row, id, refocus) => picks.push({ id, refocus }));
		const buttons = tabButtons(host);

		buttons[1].click();
		expect(picks).toEqual([{ id: "home", refocus: null }]);

		// ArrowRight on the active (first) tab picks the next one, asking for
		// focus back on this row after the redraw.
		picks.length = 0;
		buttons[0].focus();
		buttons[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(picks).toEqual([{ id: "home", refocus: 0 }]);

		// End on the first tab picks the last one.
		picks.length = 0;
		buttons[0].focus();
		buttons[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
		expect(picks).toEqual([{ id: "work", refocus: 0 }]);
	});
});

describe("the tasks card with tab rows", () => {
	it("draws the strip first, and a tab narrows the list without saving", async () => {
		const { view, saveData } = viewWith(FILES);
		const card = cardWith({ tabRows: [{ id: "r1", facet: "tag", mode: "auto", label: "Tags" }] });
		const body = document.body.createDiv();
		tasks.renderTasks(view, card, body);
		await flush();

		const wrap = body.querySelector(".hearth-tasks-wrap")!;
		expect(wrap.firstElementChild?.classList.contains("hearth-tasktabs")).toBe(true);
		expect(body.textContent).toContain("alpha");
		expect(body.textContent).toContain("beta");

		const home = tabButtons(wrap).find((b) => tabLabel(b) === "#home")!;
		home.click();
		await flush();

		expect(body.textContent).not.toContain("alpha");
		expect(body.textContent).toContain("beta");
		// View state only: no vault write, and the active tab moved.
		expect(saveData).not.toHaveBeenCalled();
		const after = tabButtons(body.querySelector(".hearth-tasks-wrap")!);
		expect(after.find((b) => b.classList.contains("is-active") && tabLabel(b) === "#home")).toBeTruthy();

		// Back to All restores the list.
		after.find((b) => tabLabel(b) === locales.en.cards.tasks.tabs.all)!.click();
		await flush();
		expect(body.textContent).toContain("alpha");
		expect(body.textContent).toContain("beta");
	});

	it("draws no strip without rows, and none on the matrix", async () => {
		const plain = document.body.createDiv();
		tasks.renderTasks(viewWith(FILES).view, cardWith({}), plain);
		await flush();
		expect(plain.querySelector(".hearth-tasktabs")).toBeNull();

		const matrix = document.body.createDiv();
		tasks.renderTasks(
			viewWith(FILES).view,
			cardWith({ layout: "matrix", tabRows: [{ id: "r1", facet: "tag", mode: "auto" }] }),
			matrix,
		);
		await flush();
		expect(matrix.querySelector(".hearth-tasktabs")).toBeNull();
		expect(matrix.querySelector(".hearth-matrix")).not.toBeNull();
	});

	it("draws the strip over the kanban board too", async () => {
		const body = document.body.createDiv();
		tasks.renderTasks(
			viewWith(FILES).view,
			cardWith({ layout: "kanban", tabRows: [{ id: "r1", facet: "tag", mode: "auto" }] }),
			body,
		);
		await flush();
		const wrap = body.querySelector(".hearth-tasks-wrap")!;
		expect(wrap.firstElementChild?.classList.contains("hearth-tasktabs")).toBe(true);
		expect(wrap.querySelector(".hearth-kanban")).not.toBeNull();
	});
});
