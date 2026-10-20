import { TASK_MATRIX_QUADRANTS } from "./taskmatrix";
import type { TaskMatrixQuadrant } from "./types";

/**
 * The Eisenhower matrix's frame: the cross of four quadrants under their axis
 * labels, the unsorted strip below it, and dragging tasks between them. What a
 * task looks like inside a quadrant, and what a drop writes, are the tasks
 * card's (src/cards/tasks.ts), handed in as callbacks — so this file has no
 * dependency on the card module and its import cycle, and is tested under
 * jsdom on its own.
 */

/** The drag payload type, private to the matrix so a drag from elsewhere on
 * the dashboard (a card being arranged, a Kanban card) is never a drop here. */
const DRAG_TYPE = "application/hearth-matrix-task";

export interface TaskMatrixFrame<T> {
	quadrants: Record<TaskMatrixQuadrant, { label: string; items: T[]; droppable: boolean }>;
	/** Tasks no quadrant claims; null hides the strip. */
	unsorted: T[] | null;
	labels: {
		urgent: string;
		notUrgent: string;
		important: string;
		notImportant: string;
		unsorted: string;
		unsortedHint: string;
		empty: string;
	};
	/** Draw one task into `host`; returns its element, which is made draggable. */
	renderItem: (item: T, host: HTMLElement) => HTMLElement;
	/** A task was dropped on a quadrant, or on the strip (null). */
	onDrop: (item: T, target: TaskMatrixQuadrant | null) => void;
}

/** Make `zone` accept matrix drags, resolving the payload against `items`. */
function dropZone<T>(zone: HTMLElement, items: T[], drop: (item: T) => void): void {
	const accepts = (e: DragEvent) => e.dataTransfer?.types.includes(DRAG_TYPE) ?? false;
	zone.addEventListener("dragover", (e) => {
		if (!accepts(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		zone.addClass("is-drop-target");
	});
	zone.addEventListener("dragleave", (e) => {
		// Leaving for a child of the zone is still being over it.
		if (e.relatedTarget instanceof Node && zone.contains(e.relatedTarget)) return;
		zone.removeClass("is-drop-target");
	});
	zone.addEventListener("drop", (e) => {
		zone.removeClass("is-drop-target");
		if (!accepts(e)) return;
		e.preventDefault();
		e.stopPropagation();
		const idx = parseInt(e.dataTransfer?.getData(DRAG_TYPE) ?? "", 10);
		const item = Number.isNaN(idx) ? undefined : items[idx];
		if (item !== undefined) drop(item);
	});
}

/** Draw the matrix into `container`. */
export function renderTaskMatrixFrame<T>(container: HTMLElement, frame: TaskMatrixFrame<T>): HTMLElement {
	const all: T[] = [];
	// The host is the size container the narrow-card rules query.
	const root = container.createDiv("hearth-matrix-host").createDiv("hearth-matrix");
	root.toggleClass("has-unsorted", frame.unsorted !== null);

	const drawItems = (host: HTMLElement, items: T[]) => {
		for (const item of items) {
			const idx = all.push(item) - 1;
			const el = frame.renderItem(item, host);
			el.addClass("hearth-matrix-item");
			el.setAttribute("draggable", "true");
			el.addEventListener("dragstart", (e) => {
				e.dataTransfer?.setData(DRAG_TYPE, String(idx));
				if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				el.addClass("is-dragging");
				root.addClass("is-dragging");
			});
			el.addEventListener("dragend", () => {
				el.removeClass("is-dragging");
				root.removeClass("is-dragging");
			});
		}
	};

	// The axis across the top, aligned with the two quadrant columns below.
	root.createDiv("hearth-matrix-corner");
	const top = root.createDiv("hearth-matrix-axis is-top");
	top.createDiv({ cls: "hearth-matrix-axis-label is-urgent", text: frame.labels.urgent });
	top.createDiv({ cls: "hearth-matrix-axis-label is-not-urgent", text: frame.labels.notUrgent });

	const side = root.createDiv("hearth-matrix-axis is-side");
	side.createDiv({ cls: "hearth-matrix-axis-label is-important", text: frame.labels.important });
	side.createDiv({ cls: "hearth-matrix-axis-label is-not-important", text: frame.labels.notImportant });

	// The cross itself: four quadrants with the two axes drawn through them.
	const grid = root.createDiv("hearth-matrix-grid");
	for (const id of TASK_MATRIX_QUADRANTS) {
		const q = frame.quadrants[id];
		const cell = grid.createDiv(`hearth-matrix-q is-${id}`);
		cell.toggleClass("is-locked", !q.droppable);
		cell.dataset.quadrant = id;
		const head = cell.createDiv("hearth-matrix-q-head");
		head.createSpan("hearth-matrix-q-dot");
		head.createSpan({ cls: "hearth-matrix-q-title", text: q.label });
		head.createSpan({ cls: "hearth-matrix-q-count", text: String(q.items.length) });
		const body = cell.createDiv("hearth-matrix-q-body");
		if (q.items.length) drawItems(body, q.items);
		else body.createDiv({ cls: "hearth-matrix-q-empty", text: frame.labels.empty });
		if (q.droppable) dropZone(cell, all, (item) => frame.onDrop(item, id));
	}

	if (frame.unsorted !== null) {
		const strip = root.createDiv("hearth-matrix-unsorted");
		const head = strip.createDiv("hearth-matrix-unsorted-head");
		head.createSpan({ cls: "hearth-matrix-unsorted-title", text: frame.labels.unsorted });
		head.createSpan({ cls: "hearth-matrix-q-count", text: String(frame.unsorted.length) });
		head.createSpan({ cls: "hearth-matrix-unsorted-hint", text: frame.labels.unsortedHint });
		const body = strip.createDiv("hearth-matrix-unsorted-body");
		drawItems(body, frame.unsorted);
		dropZone(strip, all, (item) => frame.onDrop(item, null));
	}
	return root;
}
