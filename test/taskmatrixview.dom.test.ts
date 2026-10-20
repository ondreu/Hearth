/**
 * @vitest-environment jsdom
 *
 * The Eisenhower matrix's frame: the cross of quadrants under its axes, the
 * unsorted strip, and that a drag between them reports where the task went.
 * What a task looks like and what the drop writes are the tasks card's.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { TaskMatrixFrame } from "../src/taskmatrixview";
import type { TaskMatrixQuadrant } from "../src/types";

let renderTaskMatrixFrame: typeof import("../src/taskmatrixview").renderTaskMatrixFrame;

beforeAll(async () => {
	installObsidianDom();
	({ renderTaskMatrixFrame } = await import("../src/taskmatrixview"));
});

const LABELS = {
	unsorted: "Unsorted",
	unsortedHint: "hint",
	empty: "Drop tasks here",
	rename: "Double-click to rename",
};

function frame(drops: [string, TaskMatrixQuadrant | null][], unsorted: string[] | null = ["loose"]): TaskMatrixFrame<string> {
	return {
		quadrants: {
			do: { label: "Do", items: ["a", "b"], droppable: true },
			schedule: { label: "Schedule", items: [], droppable: true },
			delegate: { label: "Delegate", items: ["c"], droppable: true },
			eliminate: { label: "Eliminate", items: [], droppable: false },
		},
		cells: ["do", "schedule", "delegate", "eliminate"],
		across: [
			{ id: "urgent", label: "Urgent" },
			{ id: "notUrgent", label: "Not urgent" },
		],
		down: [
			{ id: "important", label: "Important" },
			{ id: "notImportant", label: "Not important" },
		],
		unsorted,
		labels: LABELS,
		renderItem: (item, host) => host.createDiv({ cls: "item", text: item }),
		onDrop: (item, target) => drops.push([item, target]),
	};
}

/** A drag event carrying a DataTransfer-like store (jsdom has none). */
function dragEvent(type: string, store: Map<string, string>): Event {
	const e = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(e, "dataTransfer", {
		value: {
			get types() {
				return [...store.keys()];
			},
			setData: (k: string, v: string) => store.set(k, v),
			getData: (k: string) => store.get(k) ?? "",
			dropEffect: "none",
			effectAllowed: "all",
		},
	});
	return e;
}

describe("renderTaskMatrixFrame", () => {
	it("draws the axes, the four quadrants in reading order and the strip", () => {
		const host = document.body.createDiv();
		renderTaskMatrixFrame(host, frame([]));
		const labels = Array.from(host.querySelectorAll(".hearth-matrix-axis-label")).map((e) => e.textContent);
		expect(labels).toEqual(["Urgent", "Not urgent", "Important", "Not important"]);
		const quads = Array.from(host.querySelectorAll<HTMLElement>(".hearth-matrix-q"));
		expect(quads.map((q) => q.dataset.quadrant)).toEqual(["do", "schedule", "delegate", "eliminate"]);
		expect(quads.map((q) => q.querySelector(".hearth-matrix-q-count")?.textContent)).toEqual(["2", "0", "1", "0"]);
		expect(quads[1].querySelector(".hearth-matrix-q-empty")?.textContent).toBe("Drop tasks here");
		expect(quads[3].classList.contains("is-locked")).toBe(true);
		expect(host.querySelector(".hearth-matrix-unsorted .item")?.textContent).toBe("loose");
		expect(Array.from(host.querySelectorAll(".hearth-matrix-item")).every((e) => e.getAttribute("draggable") === "true")).toBe(true);
	});

	it("lays the quadrants out in the order it is given", () => {
		const host = document.body.createDiv();
		renderTaskMatrixFrame(host, { ...frame([]), cells: ["eliminate", "delegate", "schedule", "do"] });
		const quads = Array.from(host.querySelectorAll<HTMLElement>(".hearth-matrix-q"));
		expect(quads.map((q) => q.dataset.quadrant)).toEqual(["eliminate", "delegate", "schedule", "do"]);
	});

	it("renames a quadrant in place on double-click", () => {
		const host = document.body.createDiv();
		const renamed: [TaskMatrixQuadrant, string][] = [];
		renderTaskMatrixFrame(host, { ...frame([]), onRename: (id, label) => renamed.push([id, label]) });
		const title = host.querySelector(".hearth-matrix-q.is-delegate .hearth-matrix-q-title") as HTMLElement;
		expect(title.getAttribute("title")).toBe("Double-click to rename");
		title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
		const input = host.querySelector(".hearth-matrix-q-rename") as HTMLInputElement;
		expect(input.value).toBe("Delegate");
		input.value = "Hand off";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(renamed).toEqual([["delegate", "Hand off"]]);
		expect(host.querySelector(".hearth-matrix-q-rename")).toBeNull();
		// Escape keeps the old name.
		title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
		const again = host.querySelector(".hearth-matrix-q-rename") as HTMLInputElement;
		again.value = "Nope";
		again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(renamed).toHaveLength(1);
	});

	it("can't be renamed without a handler", () => {
		const host = document.body.createDiv();
		renderTaskMatrixFrame(host, frame([]));
		const title = host.querySelector(".hearth-matrix-q-title") as HTMLElement;
		title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
		expect(host.querySelector(".hearth-matrix-q-rename")).toBeNull();
	});

	it("leaves the strip out when asked", () => {
		const host = document.body.createDiv();
		renderTaskMatrixFrame(host, frame([], null));
		expect(host.querySelector(".hearth-matrix-unsorted")).toBeNull();
	});

	it("reports a drop on a quadrant and on the strip", () => {
		const host = document.body.createDiv();
		const drops: [string, TaskMatrixQuadrant | null][] = [];
		renderTaskMatrixFrame(host, frame(drops));
		const items = Array.from(host.querySelectorAll<HTMLElement>(".hearth-matrix-item"));
		const store = new Map<string, string>();
		items[2].dispatchEvent(dragEvent("dragstart", store)); // "c"
		const schedule = host.querySelector<HTMLElement>(".hearth-matrix-q.is-schedule") as HTMLElement;
		schedule.dispatchEvent(dragEvent("dragover", store));
		expect(schedule.classList.contains("is-drop-target")).toBe(true);
		schedule.dispatchEvent(dragEvent("drop", store));
		expect(schedule.classList.contains("is-drop-target")).toBe(false);
		(host.querySelector(".hearth-matrix-unsorted") as HTMLElement).dispatchEvent(dragEvent("drop", store));
		expect(drops).toEqual([
			["c", "schedule"],
			["c", null],
		]);
	});

	it("ignores drags from elsewhere and drops on a locked quadrant", () => {
		const host = document.body.createDiv();
		const drops: [string, TaskMatrixQuadrant | null][] = [];
		renderTaskMatrixFrame(host, frame(drops));
		const foreign = new Map([["text/plain", "0"]]);
		const doQ = host.querySelector(".hearth-matrix-q.is-do") as HTMLElement;
		const over = dragEvent("dragover", foreign);
		doQ.dispatchEvent(over);
		expect(over.defaultPrevented).toBe(false);
		doQ.dispatchEvent(dragEvent("drop", foreign));
		const store = new Map<string, string>();
		host.querySelector<HTMLElement>(".hearth-matrix-item")?.dispatchEvent(dragEvent("dragstart", store));
		(host.querySelector(".hearth-matrix-q.is-eliminate") as HTMLElement).dispatchEvent(dragEvent("drop", store));
		expect(drops).toEqual([]);
	});
});
