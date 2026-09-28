/**
 * The size of one character cell of the terminal font, measured where it is
 * drawn. Everything on terminal mode's grid is positioned in these units.
 */

/** The size of one character cell, in pixels. */
export interface CellMetrics {
	ch: number;
	lh: number;
}

/**
 * Measure the terminal font's cell inside `root`: the advance of one
 * character and the height of one line. `root` must be inside an element that
 * sets the terminal font (any `.hearth-tui` scope).
 */
export function measureCell(root: HTMLElement): CellMetrics {
	const probe = root.createDiv({ cls: "hearth-tui-probe", text: "M".repeat(64) });
	const box = probe.getBoundingClientRect();
	probe.remove();
	return { ch: box.width / 64 || 8, lh: box.height || 17 };
}
