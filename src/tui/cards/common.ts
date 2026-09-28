/**
 * What terminal mode's text renderers share: lists of rows, rows of buttons,
 * tables, file rows and their menus, empty states.
 *
 * A renderer builds its body out of these so every card reads the same way — a
 * selected row is always reverse video, a button always `[ label ]`, a table
 * header always the htop bar — and so the card-specific modules stay about
 * their own data.
 */
import { Menu, TFile, type TAbstractFile } from "obsidian";
import { groupForFile } from "../../filetypes";
import { t } from "../../i18n";
import { openFile } from "../../opener";
import { hearthMenu } from "../../uidesign";
import type { HomeView } from "../../view";
import type { TuiContext, TuiItem, TuiOutput } from "../card";
import {
	asciify,
	padEnd,
	strWidth,
	truncate,
	wrap,
	type Line,
	type Seg,
	type TuiStyle,
} from "../text";

/** A row of a list: its text and what can be done to it. */
export interface Row extends Omit<TuiItem, "line" | "span"> {
	/** One line, or several (a row with a second line of detail). */
	lines: Line | Line[];
	/** Rows that aren't selectable: headings, separators, notes. */
	inert?: boolean;
}

function isMulti(lines: Line | Line[]): lines is Line[] {
	return lines.length > 0 && Array.isArray(lines[0]);
}

/** Lay rows out one after another, making every non-inert row an item. */
export function listOutput(rows: readonly Row[], extra: Partial<TuiOutput> = {}): TuiOutput {
	const lines: Line[] = [...(extra.lines ?? [])];
	const items: TuiItem[] = [...(extra.items ?? [])];
	for (const row of rows) {
		const own = isMulti(row.lines) ? row.lines : [row.lines];
		const line = lines.length;
		lines.push(...own);
		if (row.inert) continue;
		items.push({
			line,
			span: own.length,
			activate: row.activate,
			toggle: row.toggle,
			menu: row.menu,
			remove: row.remove,
			range: row.range,
		});
	}
	return { ...extra, lines, items };
}

/** A message in place of content — an empty list, a missing plugin — wrapped
 * to the body's width. */
export function message(text: string, cols: number, style: TuiStyle | TuiStyle[] = "dim"): Line[] {
	return wrap(asciify(text), Math.max(4, cols)).map((l) => [{ text: l, style }]);
}

/** A whole output that is only a message. */
export function messageOutput(text: string, cols: number, extra: Partial<TuiOutput> = {}): TuiOutput {
	return { ...extra, lines: [...message(text, cols), ...(extra.lines ?? [])] };
}

/** A button: `[ label ]`. */
export function button(label: string, onClick: Seg["onClick"], style: TuiStyle | TuiStyle[] = "accent"): Seg {
	return { text: `[ ${asciify(label)} ]`, style, onClick, label };
}

/** A compact button: `[label]`. */
export function tag(label: string, onClick?: Seg["onClick"], style: TuiStyle | TuiStyle[] = "accent"): Seg {
	return onClick ? { text: `[${label}]`, style, onClick, label } : { text: `[${label}]`, style };
}

/** One button in a {@link buttonGrid}. */
export interface GridButton {
	label: string;
	style?: TuiStyle | TuiStyle[];
	activate: (evt?: MouseEvent | KeyboardEvent) => void;
	menu?: (evt: MouseEvent | KeyboardEvent) => void;
}

/**
 * Buttons laid out left to right, wrapping at the body's width — a launchpad.
 * Each button is its own item, so the arrows move between them and only the
 * selected one is drawn in reverse video.
 */
export function buttonGrid(
	ctx: TuiContext,
	buttons: readonly GridButton[],
	opts: { width?: number; startLine?: number; startItem?: number } = {},
): { lines: Line[]; items: TuiItem[] } {
	const lines: Line[] = [];
	const items: TuiItem[] = [];
	let line: Line = [];
	let col = 0;
	const startLine = opts.startLine ?? 0;
	const startItem = opts.startItem ?? 0;
	const fixed = opts.width;
	buttons.forEach((b, i) => {
		const label = asciify(b.label);
		const inner = fixed ? padEnd(label, Math.max(1, fixed - 4)) : truncate(label, Math.max(1, ctx.cols - 4));
		const text = `[ ${inner} ]`;
		const w = strWidth(text);
		if (col > 0 && col + w > ctx.cols) {
			lines.push(line);
			line = [];
			col = 0;
		}
		const index = startItem + i;
		line.push({
			text,
			style: b.style ?? "accent",
			onClick: (evt) => {
				ctx.select(index);
				b.activate(evt);
			},
			label: b.label,
		});
		items.push({ line: startLine + lines.length, range: [col, col + w], activate: b.activate, menu: b.menu });
		col += w;
		if (col + 1 <= ctx.cols) {
			line.push({ text: " " });
			col += 1;
		}
	});
	if (line.length) lines.push(line);
	return { lines, items };
}

/** An htop table header: every column in the header colour, the sorted one
 * highlighted. `cols` are `[label, width]`. */
export function tableHeader(cols: readonly [string, number][], total: number, sorted = -1): Line {
	const line: Line = [];
	let n = 0;
	cols.forEach(([label, w], i) => {
		line.push({ text: padEnd(label, w), style: i === sorted ? "header-sort" : "header" });
		n += w;
	});
	if (n < total) line.push({ text: " ".repeat(total - n), style: "header" });
	return line;
}

/** A section heading inside a card body. */
export function heading(text: string, style: TuiStyle | TuiStyle[] = ["bold", "accent"]): Line {
	return [{ text: asciify(text), style }];
}

/** A horizontal rule the width of the body. */
export function rule(cols: number, ch = "─"): Line {
	return [{ text: ch.repeat(Math.max(0, cols)), style: "rule" }];
}

// ---- Files ------------------------------------------------------------------

/** Short type tags for file rows, by file-type group. */
const GROUP_TAGS: Record<string, string> = {
	markdown: "md",
	excalidraw: "draw",
	canvas: "canv",
	bases: "base",
	images: "img",
	videos: "vid",
	audio: "aud",
	pdf: "pdf",
	documents: "doc",
	spreadsheets: "xls",
	presentations: "ppt",
	"3d": "3d",
	folders: "dir",
	other: "file",
};

/** A file's type as a terminal would list it: `md`, `pdf`, `img`… */
export function fileTag(file: TAbstractFile): string {
	const group = groupForFile(file);
	return GROUP_TAGS[group?.id ?? "other"] ?? "file";
}

/** The style a file's tag is drawn in: notes quiet, everything else marked. */
export function fileTagStyle(file: TAbstractFile): TuiStyle {
	return groupForFile(file)?.id === "markdown" ? "dim" : "yellow";
}

/** The folder a file sits in, for a row's dim right-hand column. */
export function fileFolder(file: TAbstractFile): string {
	const parent = file.parent?.path ?? "";
	return parent === "/" ? "" : parent;
}

/** Open `file` the way the card opens notes. */
export function openCardFile(view: HomeView, file: TFile, evt?: MouseEvent | KeyboardEvent): void {
	void openFile(view, file, "card", evt ?? null);
}

/**
 * A file's menu: open it here, in a new tab or to the right, then whatever
 * Obsidian and other plugins add to a file's menu — so a file on a terminal
 * card offers what it offers anywhere else in the vault.
 */
export function fileMenu(view: HomeView, file: TFile, evt: MouseEvent | KeyboardEvent, extend?: (menu: Menu) => void): void {
	const menu = hearthMenu();
	menu.addItem((i) => i.setTitle(t().tui.open).setIcon("file").onClick(() => openCardFile(view, file)));
	menu.addItem((i) =>
		i.setTitle(t().tui.openNewTab).setIcon("file-plus").onClick(() => void view.app.workspace.getLeaf("tab").openFile(file)),
	);
	menu.addItem((i) =>
		i.setTitle(t().tui.openSplit).setIcon("columns-3").onClick(() => void view.app.workspace.getLeaf("split").openFile(file)),
	);
	extend?.(menu);
	menu.addSeparator();
	view.app.workspace.trigger("file-menu", menu, file, "hearth-terminal");
	showMenuFor(menu, evt);
}

/** Show a menu at the pointer, or beside the focused element when it was
 * opened from the keyboard. */
export function showMenuFor(menu: Menu, evt: MouseEvent | KeyboardEvent): void {
	if (evt instanceof MouseEvent && (evt.clientX || evt.clientY)) {
		menu.showAtMouseEvent(evt);
		return;
	}
	const el = evt.target instanceof HTMLElement ? evt.target : document.activeElement;
	const box = el instanceof HTMLElement ? el.getBoundingClientRect() : { left: 0, bottom: 0 };
	menu.showAtPosition({ x: box.left + 16, y: box.bottom });
}

/** Whether `f` is a file (not a folder). */
export function isFile(f: TAbstractFile | null | undefined): f is TFile {
	return f instanceof TFile;
}
