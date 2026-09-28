/**
 * One text-drawn card body: the bridge between a kind's text renderer and the
 * element it is drawn into.
 *
 * The board (src/tui/board.ts) places one of these inside every card frame,
 * and the zoom dialog places one inside itself, so a card behaves the same in
 * both. The host owns three things the renderer shouldn't have to:
 *
 *  - **drawing**: the renderer returns lines; the host fits them to the body's
 *    width and paints them, the selected item in reverse video;
 *  - **selection and keys**: arrows, Enter, Space, the menu key — routed to the
 *    renderer's items after the renderer has had first refusal;
 *  - **the two speeds of redraw**. A full draw asks the renderer again, which
 *    may scan the vault. Moving the selection only repaints the last output
 *    with a different row highlighted, so holding ↓ down a long task list
 *    never re-reads a file.
 */
import { Component } from "obsidian";
import type { DashboardCard } from "../types";
import type { HomeView } from "../view";
import type { TuiContext, TuiItem, TuiOutput, TuiRenderer } from "./card";
import { drawLine } from "./draw";
import { fit, styleLine, type Line } from "./text";

/** The class of the element that holds a body's rows. */
const LINES_CLASS = "hearth-tui-lines";
/** The class of a non-text mount placed on the body grid. */
const MOUNT_CLASS = "hearth-tui-mount";

export interface TuiHostOptions {
	zoomed: boolean;
	/** The body's current size in cells. */
	size: () => { cols: number; rows: number };
	/** Whether the card has the keyboard. */
	focused: () => boolean;
	/** Called after every draw, so the frame can show the new hint and foot. */
	onOutput?: (out: TuiOutput) => void;
	/** Called when the body scrolls, so the frame can show where it is. */
	onScroll?: () => void;
}

export class TuiCardHost {
	/** The last thing the renderer drew. */
	output: TuiOutput = { lines: [] };
	/** Asks for a full redraw; replaced by the liveness wiring once mounted. */
	redraw: () => void = () => {};
	private linesEl: HTMLElement;
	private mountsEl: HTMLElement;
	private lineEls: HTMLElement[] = [];

	constructor(
		private view: HomeView,
		private card: DashboardCard,
		private renderer: TuiRenderer,
		readonly el: HTMLElement,
		private opts: TuiHostOptions,
	) {
		el.addClass("hearth-tui-textbody");
		this.linesEl = el.createDiv(LINES_CLASS);
		this.mountsEl = el.createDiv("hearth-tui-mounts");
		el.addEventListener("scroll", () => this.opts.onScroll?.(), { passive: true });
	}

	private get tui() {
		return this.view.tui;
	}

	get selected(): number {
		return this.tui.selection(this.card.id);
	}

	/** The renderer's context for one draw. */
	context(component: Component): TuiContext {
		const { cols, rows } = this.opts.size();
		return {
			view: this.view,
			card: this.card,
			component,
			cols,
			rows,
			focused: this.opts.focused(),
			zoomed: this.opts.zoomed,
			selected: this.selected,
			state: this.tui.state(this.card.id),
			redraw: () => this.redraw(),
			select: (i) => this.select(i),
		};
	}

	/** Ask the renderer for a fresh output and paint it. `component` is this
	 * draw's own, torn down before the next one. */
	draw(component: Component): void {
		const ctx = this.context(component);
		const out = this.renderer.render(ctx);
		this.output = out;
		if (typeof out.select === "number") this.tui.setSelection(this.card.id, out.select);
		this.clampSelection();
		this.paint();
		this.placeMounts(out, component, ctx.cols);
		this.opts.onOutput?.(out);
	}

	/** Repaint the last output — after the selection or the focus moved. */
	paint(): void {
		const { cols } = this.opts.size();
		const out = this.output;
		const focused = this.opts.focused();
		const item = focused ? this.items()[this.selected] : undefined;
		const from = item ? item.line : -1;
		const to = item ? item.line + (item.span ?? 1) : -1;
		this.linesEl.empty();
		this.lineEls = out.lines.map((line, i) => {
			let l: Line = fit(line, cols);
			if (i >= from && i < to) l = styleLine(l, "reverse");
			return drawLine(this.linesEl, l);
		});
		if (item) this.reveal(item);
	}

	private placeMounts(out: TuiOutput, component: Component, cols: number): void {
		this.mountsEl.empty();
		for (const m of out.mounts ?? []) {
			const host = this.mountsEl.createDiv(MOUNT_CLASS);
			host.setCssProps({
				"--tui-x": String(m.col ?? 0),
				"--tui-y": String(m.line),
				"--tui-w": String(m.cols ?? cols - (m.col ?? 0)),
				"--tui-h": String(m.rows),
			});
			m.mount(host, component);
		}
	}

	items(): TuiItem[] {
		return this.output.items ?? [];
	}

	private clampSelection(): void {
		const n = this.items().length;
		if (n === 0) return;
		if (this.selected >= n) this.tui.setSelection(this.card.id, n - 1);
	}

	/** Move the selection to item `i` and repaint. */
	select(i: number): void {
		const n = this.items().length;
		if (n === 0) return;
		this.tui.setSelection(this.card.id, Math.max(0, Math.min(n - 1, i)));
		this.paint();
	}

	/** Scroll the body so `item` is on screen. */
	private reveal(item: TuiItem): void {
		const first = this.lineEls[item.line];
		const last = this.lineEls[item.line + (item.span ?? 1) - 1] ?? first;
		if (!first) return;
		const top = first.offsetTop;
		const bottom = last.offsetTop + last.offsetHeight;
		if (top < this.el.scrollTop) this.el.scrollTop = top;
		else if (bottom > this.el.scrollTop + this.el.clientHeight) this.el.scrollTop = bottom - this.el.clientHeight;
	}

	/** Where the body is scrolled to, as the first visible line and the total,
	 * or null when it all fits. */
	scrollPosition(): { first: number; total: number; visible: number } | null {
		const total = this.output.lines.length;
		const lh = this.lineEls[0]?.offsetHeight ?? 0;
		if (!lh) return null;
		const visible = Math.floor(this.el.clientHeight / lh);
		if (total <= visible) return null;
		return { first: Math.round(this.el.scrollTop / lh) + 1, total, visible };
	}

	/** Route a key to the renderer, then to the items. True when handled. */
	key(evt: KeyboardEvent): boolean {
		if (this.renderer.key?.(this.context(new Component()), evt)) return true;
		const items = this.items();
		const item = items[this.selected];
		const n = items.length;
		switch (evt.key) {
			case "ArrowDown":
				if (n === 0 || this.selected >= n - 1) return false;
				this.select(this.selected + 1);
				return true;
			case "ArrowUp":
				if (n === 0 || this.selected <= 0) return false;
				this.select(this.selected - 1);
				return true;
			case "PageDown":
				if (n === 0) return false;
				this.select(this.selected + Math.max(1, this.opts.size().rows - 1));
				return true;
			case "PageUp":
				if (n === 0) return false;
				this.select(this.selected - Math.max(1, this.opts.size().rows - 1));
				return true;
			case "Home":
				if (n === 0) return false;
				this.select(0);
				return true;
			case "End":
				if (n === 0) return false;
				this.select(n - 1);
				return true;
			case "Enter":
				if (!item?.activate) return false;
				item.activate(evt);
				return true;
			case " ":
				if (!item?.toggle) return false;
				item.toggle();
				return true;
			case "Delete":
				if (!item?.remove) return false;
				item.remove();
				return true;
			case "ContextMenu":
				if (!item?.menu) return false;
				item.menu(evt);
				return true;
		}
		return false;
	}

	/** The item on body line `line`, and its index. */
	itemAt(line: number): { item: TuiItem; index: number } | null {
		const items = this.items();
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			if (line >= it.line && line < it.line + (it.span ?? 1)) return { item: it, index: i };
		}
		return null;
	}

	/** Which body line a pointer event landed on. */
	lineAt(evt: MouseEvent): number {
		const target = evt.target instanceof HTMLElement ? evt.target.closest(`.${LINES_CLASS} > *`) : null;
		if (target) {
			const i = this.lineEls.indexOf(target as HTMLElement);
			if (i >= 0) return i;
		}
		return -1;
	}

	/** A click on the body: select the row's item and, unless the click was on
	 * a control of its own, act on it. */
	click(evt: MouseEvent): void {
		const hit = this.itemAt(this.lineAt(evt));
		if (!hit) return;
		this.tui.setSelection(this.card.id, hit.index);
		const onControl = evt.target instanceof HTMLElement && evt.target.closest(".hearth-tui-act");
		if (!onControl && hit.item.activate) hit.item.activate(evt);
		else this.paint();
	}

	/** A right-click on the body: the row's own menu, when it has one. True
	 * when one was shown. */
	contextMenu(evt: MouseEvent): boolean {
		const hit = this.itemAt(this.lineAt(evt));
		if (!hit?.item.menu) return false;
		this.tui.setSelection(this.card.id, hit.index);
		this.paint();
		hit.item.menu(evt);
		return true;
	}
}
