/**
 * @vitest-environment jsdom
 *
 * The matrix under a CJK UI language: the side-axis labels keep their upright
 * glyphs via the is-cjk-axis override (the 180° turn stays off in styles.css).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installObsidianDom } from "./support/obsidian-dom";
import type { TaskMatrixFrame } from "../src/taskmatrixview";
import type { TaskMatrixQuadrant } from "../src/types";

vi.mock("obsidian", async (importOriginal) => {
	const real = await importOriginal<Record<string, unknown>>();
	return { ...real, getLanguage: () => "zh-TW" };
});

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

describe("renderTaskMatrixFrame under a CJK language", () => {
	it("marks the matrix so the side labels stay upright", () => {
		const host = document.body.createDiv();
		renderTaskMatrixFrame(host, frame([]));
		expect(host.querySelector(".hearth-matrix.is-cjk-axis")).not.toBeNull();
		expect(host.querySelector(".hearth-matrix-axis.is-side .hearth-matrix-axis-label")).not.toBeNull();
	});
});
