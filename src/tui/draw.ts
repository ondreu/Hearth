/**
 * Terminal mode's text, put on the page.
 *
 * Every text-drawn surface — card bodies, frames, the status and function-key
 * bars — goes through {@link drawLine}: one element per grid row, one span per
 * run of text in a single look. The DOM is built with Obsidian's `createSpan`
 * helpers, never through markup strings, so nothing a note contains can ever be
 * parsed as HTML.
 *
 * Two things here exist to keep the grid honest:
 *  - wide characters (CJK and fullwidth forms) are wrapped in a span pinned to
 *    exactly two cells, because the fallback font they come from draws them at
 *    its own width, which is not two of the terminal font's;
 *  - interactive runs are real controls (`role="button"`, keyboard-activatable)
 *    rather than styled text, so the board stays usable without a mouse.
 */
import { cellWidth, styles, type Line, type Seg, type TuiStyle } from "./text";

/** The class every grid row wears. */
export const LINE_CLASS = "hearth-tui-line";

/** The class of a text run that is a control. */
export const ACTION_CLASS = "hearth-tui-act";

/** The class that makes a character exactly two cells wide. */
const WIDE_CLASS = "hearth-tui-wide";

/** The CSS class for one style. */
export function styleClass(style: TuiStyle): string {
	return `hearth-tui-${style}`;
}

/** Append `text` to `el`, wrapping each wide character in a two-cell span. */
function appendText(el: HTMLElement, text: string): void {
	let run = "";
	for (const ch of text) {
		if (cellWidth(ch) === 2) {
			if (run) {
				el.appendText(run);
				run = "";
			}
			el.createSpan({ cls: WIDE_CLASS, text: ch });
		} else run += ch;
	}
	if (run) el.appendText(run);
}

/** Draw one segment into `parent`. */
export function drawSeg(parent: HTMLElement, s: Seg): HTMLElement {
	const classes = styles(s).map(styleClass);
	if (s.onClick || s.onMenu) classes.push(ACTION_CLASS);
	if (s.color) classes.push("hearth-tui-colored");
	const span = parent.createSpan({ cls: classes });
	if (s.color) span.setCssProps({ "--tui-seg-color": s.color });
	appendText(span, s.text);
	if (s.label) {
		span.setAttribute("aria-label", s.label);
		span.setAttribute("title", s.label);
	}
	const onClick = s.onClick;
	if (onClick) {
		span.setAttribute("role", "button");
		span.setAttribute("tabindex", "-1");
		span.addEventListener("click", (evt) => {
			evt.preventDefault();
			onClick(evt);
		});
		span.addEventListener("keydown", (evt) => {
			if (evt.key !== "Enter" && evt.key !== " ") return;
			evt.preventDefault();
			evt.stopPropagation();
			onClick(evt);
		});
	}
	const onMenu = s.onMenu;
	if (onMenu) {
		span.addEventListener("contextmenu", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			onMenu(evt);
		});
	}
	return span;
}

/** Draw one grid row into `parent`. Adjacent plain runs in the same look are
 * merged first, so a row costs as few elements as its styling allows. */
export function drawLine(parent: HTMLElement, line: Line, cls?: string): HTMLElement {
	const row = parent.createDiv(cls ? `${LINE_CLASS} ${cls}` : LINE_CLASS);
	for (const s of mergeRuns(line)) {
		if (!s.style && !s.onClick && !s.onMenu && !s.label && !s.color) appendText(row, s.text);
		else drawSeg(row, s);
	}
	return row;
}

/** Draw rows into `parent`, one element each. */
export function drawLines(parent: HTMLElement, lines: readonly Line[], cls?: string): HTMLElement[] {
	return lines.map((line) => drawLine(parent, line, cls));
}

/** Join neighbouring segments that look the same and do nothing. */
export function mergeRuns(line: Line): Line {
	const out: Line = [];
	for (const s of line) {
		if (!s.text) continue;
		const prev = out[out.length - 1];
		if (
			prev &&
			!prev.onClick &&
			!prev.onMenu &&
			!prev.label &&
			!s.onClick &&
			!s.onMenu &&
			!s.label &&
			prev.color === s.color &&
			styleKey(prev) === styleKey(s)
		) {
			out[out.length - 1] = { ...prev, text: prev.text + s.text };
		} else out.push(s);
	}
	return out;
}

function styleKey(s: Seg): string {
	return styles(s).join(" ");
}
