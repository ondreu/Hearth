/**
 * Terminal mode's dashboard: the board drawn on a character grid.
 *
 * The same cards, from the same stored geometry, as the graphical board
 * (src/dashboard.ts) — only drawn the way a terminal would draw them:
 *
 *  - every card is a box-drawn frame, and all the frames are composited onto
 *    one grid (src/tui/frames.ts), so cards that share an edge share a line and
 *    meet in proper junctions;
 *  - each frame's body is a text renderer's output (src/tui/host.ts), or — for
 *    a kind with no text renderer — its graphical body, inside the frame;
 *  - the card with the keyboard has a heavy frame; Tab moves it, the arrows
 *    move inside it, and the frame's `≡` (or right-click, or `m`) opens its menu;
 *  - arranging drags frames by whole cells, and the arrow keys do the same.
 *
 * Card bodies keep the graphical board's liveness exactly (`mountCardBody`):
 * the same vault-event redraws, the same polling, the same "don't redraw while
 * typing" hold.
 */
import { Component, debounce, type Menu } from "obsidian";
import type { HomeView } from "../view";
import { createVaultEventHub, type VaultEventHub } from "../cardevents";
import { cloneCard } from "../cards";
import { confirmRemoveCard, mountCardBody, openCardSettings, persistAndRender } from "../dashboard";
import { ensureFreeform, ensureLayout, GRID_GAP, ROW_HEIGHT } from "../grid";
import { moveStacked, stackedCards, stackedHeight } from "../narrow";
import { t } from "../i18n";
import { hearthMenu } from "../uidesign";
import {
	activeCards,
	type DashboardCard,
	effectiveColumns,
	effectiveFitToPage,
	effectiveMaxWidth,
	effectiveRowHeight,
	renderCards,
	setCardPinned,
} from "../types";
import type { TuiOutput } from "./card";
import { drawLine } from "./draw";
import { composeFrames, mergeAdjacentEdges, type BoxStyle, type FrameRect, type FrameSpec } from "./frames";
import { TuiCardHost } from "./host";
import {
	bodyRect,
	boardRows,
	cardRect,
	fitRows,
	moveRect,
	rectGeometry,
	resizeRect,
	ROW_PX,
	stackRects,
} from "./layout";
import { tuiRenderer } from "./registry";
import { asciify, strWidth, truncate, type Line, type Seg, type TuiStyle } from "./text";
import { measureCell, type CellMetrics } from "./metrics";
import { openTuiZoom } from "./zoom";

/** The fewest columns the board is laid out at. Below this a pane is scrolled
 * sideways rather than cards being squeezed past legibility. */
const MIN_BOARD_COLS = 30;

/** One cell of the frame layer while it is being assembled. */
interface Cell {
	ch: string;
	style?: TuiStyle | TuiStyle[];
	act?: Seg;
}

/** A card's display title: its own, emoji made ASCII; empty when untitled. */
export function cardTitle(card: DashboardCard): string {
	return asciify(card.title?.trim() ?? "");
}

/** A card's title, or the name of its kind when it has none — for menus and
 * messages, where a blank would read as a bug. */
export function cardName(card: DashboardCard): string {
	return cardTitle(card) || t().editors.kinds[card.kind];
}

export class TuiBoard {
	private cards: DashboardCard[] = [];
	private rects = new Map<string, FrameRect>();
	private hosts = new Map<string, TuiCardHost>();
	private bodies = new Map<string, HTMLElement>();
	private outputs = new Map<string, TuiOutput>();
	private order: string[] = [];
	private cols = 0;
	private cell: CellMetrics = { ch: 8, lh: 17 };
	private stacked = false;
	private boardEl: HTMLElement;
	private framesEl: HTMLElement;
	private bodyComponent: Component | null = null;
	private events: VaultEventHub | null = null;
	private drag: {
		id: string;
		mode: "move" | "resize";
		col: number;
		row: number;
		orig: FrameRect;
		moved: boolean;
		pointerId: number;
	} | null = null;
	/** A card nudged with the keyboard while arranging, saved once the keys
	 * stop — so holding an arrow doesn't write settings on every repeat. */
	private commitNudge = debounce(() => persistAndRender(this.view), 450, true);
	private framesQueued = false;

	constructor(
		private view: HomeView,
		private container: HTMLElement,
		private component: Component,
	) {
		this.boardEl = container.createDiv({ cls: "hearth-tui-board", attr: { tabindex: "0", role: "application" } });
		this.boardEl.setAttribute("aria-label", t().tui.boardLabel);
		this.framesEl = this.boardEl.createDiv("hearth-tui-frames");
		this.boardEl.addEventListener("pointerdown", (e) => this.onPointerDown(e));
		this.boardEl.addEventListener("pointermove", (e) => this.onPointerMove(e));
		this.boardEl.addEventListener("pointerup", (e) => this.onPointerUp(e));
		this.boardEl.addEventListener("pointercancel", (e) => this.onPointerUp(e));
		this.boardEl.addEventListener("contextmenu", (e) => this.onContextMenu(e));
		component.register(() => this.commitNudge.cancel());
	}

	private get s() {
		return this.view.plugin.settings;
	}

	private get tui() {
		return this.view.tui;
	}

	/** Build the board. Called once per view render. */
	render(): void {
		const s = this.s;
		this.cards = renderCards(s);
		// Seed placement exactly as the graphical board does, so a card added in
		// either mode has the same free-form geometry.
		const columns = effectiveColumns(s);
		const rowHeight = effectiveRowHeight(s) || ROW_HEIGHT;
		const seeded = ensureLayout(this.cards, columns);
		const freed = ensureFreeform(this.cards, columns, rowHeight, GRID_GAP, effectiveMaxWidth(s));
		if (seeded || freed) void this.view.plugin.saveData(s);

		this.events = createVaultEventHub(this.view.app, (ref) => this.component.registerEvent(ref));
		this.layout();

		// Relay out when the pane changes width enough to change the column count.
		const observer = new ResizeObserver(
			debounce(() => {
				if (!this.container.isConnected) return;
				const cols = this.measureCols();
				if (cols !== this.cols) this.layout();
			}, 80, true),
		);
		observer.observe(this.container);
		this.component.register(() => observer.disconnect());

		// The bundled font may still be loading on the very first render, in
		// which case every cell was measured in the fallback font.
		void document.fonts?.ready.then(() => {
			if (!this.container.isConnected) return;
			const cell = measureCell(this.boardEl);
			if (Math.abs(cell.ch - this.cell.ch) > 0.05 || Math.abs(cell.lh - this.cell.lh) > 0.05) this.layout();
		});
	}

	private measureCols(): number {
		return Math.max(MIN_BOARD_COLS, Math.floor((this.container.clientWidth - 1) / this.cell.ch));
	}

	/** Place every card, draw the frames and (re)mount every body. */
	private layout(): void {
		this.cell = measureCell(this.boardEl);
		this.boardEl.setCssProps({ "--tui-ch": `${this.cell.ch}px`, "--tui-lh": `${this.cell.lh}px` });
		this.cols = this.measureCols();
		this.stacked = this.view.isStacked();
		this.computeRects();

		if (this.bodyComponent) this.component.removeChild(this.bodyComponent);
		this.bodyComponent = new Component();
		this.component.addChild(this.bodyComponent);
		for (const el of this.bodies.values()) el.remove();
		this.bodies.clear();
		this.hosts.clear();
		this.outputs.clear();

		if (!this.tui.focus || !this.order.includes(this.tui.focus)) this.tui.focus = this.order[0] ?? null;

		for (const card of this.visibleCards()) this.mountBody(card);
		this.drawFrames();
	}

	/** The cards on the grid right now, in keyboard order. */
	private visibleCards(): DashboardCard[] {
		return this.order
			.map((id) => this.cards.find((c) => c.id === id))
			.filter((c): c is DashboardCard => !!c);
	}

	private computeRects(): void {
		this.rects.clear();
		const arranging = this.view.arrangeMode;
		if (this.stacked) {
			const list = stackedCards(this.cards, { includeHidden: arranging });
			const heights = list.map((c) => {
				if (this.isCollapsed(c) || c.mobile?.hidden) return 2;
				return Math.max(4, Math.round(stackedHeight(c) / ROW_PX));
			});
			const rects = stackRects(heights, this.cols);
			list.forEach((c, i) => this.rects.set(c.id, rects[i]));
			this.order = list.map((c) => c.id);
			return;
		}
		const raw = this.cards.map((c) => cardRect(c, this.cols));
		let rects = mergeAdjacentEdges(raw);
		if (effectiveFitToPage(this.s) && !arranging) {
			const avail = Math.floor(this.container.clientHeight / this.cell.lh) - 1;
			if (avail > 4) rects = fitRows(rects, avail);
		}
		this.cards.forEach((c, i) => this.rects.set(c.id, rects[i]));
		// Keyboard order is reading order: top to bottom, then left to right.
		this.order = this.cards
			.map((c) => c.id)
			.sort((a, b) => {
				const ra = this.rects.get(a)!;
				const rb = this.rects.get(b)!;
				return ra.row - rb.row || ra.col - rb.col;
			});
	}

	private isCollapsed(card: DashboardCard): boolean {
		return this.stacked && card.mobile?.collapsed === true && !this.tui.expanded.has(card.id);
	}

	private isFocused(card: DashboardCard): boolean {
		return this.tui.focus === card.id;
	}

	/** Size and place a card's body element over its frame. */
	private placeBody(el: HTMLElement, rect: FrameRect): void {
		const b = bodyRect(rect);
		el.setCssProps({
			"--tui-x": String(b.col),
			"--tui-y": String(b.row),
			"--tui-w": String(b.cols),
			"--tui-h": String(b.rows),
		});
	}

	private mountBody(card: DashboardCard): void {
		const rect = this.rects.get(card.id);
		if (!rect || this.isCollapsed(card) || card.mobile?.hidden || !this.bodyComponent || !this.events) return;
		const el = this.boardEl.createDiv({ cls: "hearth-tui-body", attr: { "data-card": card.id } });
		el.dataset.kind = card.kind;
		this.placeBody(el, rect);
		this.bodies.set(card.id, el);
		el.addEventListener("pointerdown", () => this.focusCard(card.id), { capture: true });
		// Arranging must not tick a task or follow a link by accident.
		if (this.view.arrangeMode) el.addClass("is-shielded");

		const renderer = tuiRenderer(card, this.view);
		if (!renderer) {
			// No text renderer: the kind's graphical body, inside the frame. It
			// gets the element structure its own CSS and helpers expect.
			el.addClass("is-graphical");
			const shell = el.createDiv("hearth-card hearth-tui-guicard");
			shell.dataset.kind = card.kind;
			const body = shell.createDiv("hearth-card-body");
			mountCardBody(this.view, card, body, this.bodyComponent, this.events);
			return;
		}

		const host = new TuiCardHost(this.view, card, renderer, el, {
			zoomed: false,
			persistent: this.bodyComponent,
			size: () => {
				const b = bodyRect(this.rects.get(card.id) ?? rect);
				return { cols: b.cols, rows: b.rows };
			},
			focused: () => this.isFocused(card),
			onOutput: (out) => {
				this.outputs.set(card.id, out);
				this.queueFrames();
			},
			onScroll: () => this.queueFrames(),
		});
		this.hosts.set(card.id, host);
		el.addEventListener("click", (e) => host.click(e));
		host.redraw = mountCardBody(this.view, card, el, this.bodyComponent, this.events, (child) =>
			host.draw(child),
		);
	}

	// ---- Frames ---------------------------------------------------------------

	/** Redraw the frame layer on the next frame, once, however many bodies
	 * asked. */
	private queueFrames(): void {
		if (this.framesQueued) return;
		this.framesQueued = true;
		window.requestAnimationFrame(() => {
			this.framesQueued = false;
			if (this.boardEl.isConnected) this.drawFrames();
		});
	}

	private frameStyle(card: DashboardCard): BoxStyle {
		if (this.isFocused(card)) return "heavy";
		return this.view.arrangeMode ? "dashed" : "light";
	}

	/** Composite every frame, write the titles, hints and controls onto the
	 * borders, and draw the result. */
	private drawFrames(): void {
		const specs: FrameSpec[] = [];
		for (const card of this.visibleCards()) {
			const r = this.rects.get(card.id);
			if (r) specs.push({ ...r, id: card.id, style: this.frameStyle(card) });
		}
		const rows = Math.max(boardRows([...this.rects.values()]), 1);
		const empty = specs.length === 0;
		const height = empty ? 4 : rows;
		const grid = composeFrames(specs, this.cols, height);
		const cells: Cell[] = grid.glyphs.map((ch, i) => {
			const owner = grid.owners[i];
			if (!owner) return { ch };
			return { ch, style: owner === this.tui.focus ? "accent" : "rule" };
		});
		const put = (col: number, row: number, text: string, style: Cell["style"], act?: Seg, limit?: number) => {
			let c = col;
			const end = limit ?? this.cols;
			for (const ch of text) {
				const w = strWidth(ch) || 1;
				if (c + w > end || c + w > this.cols) break;
				if (row >= 0 && row < height && c >= 0) {
					cells[row * this.cols + c] = { ch, style, act };
					// A wide character covers the next cell too.
					if (w === 2) cells[row * this.cols + c + 1] = { ch: "", style, act };
				}
				c += w;
			}
		};

		for (const card of this.visibleCards()) {
			const r = this.rects.get(card.id);
			if (r) this.decorate(card, r, put);
		}
		if (empty) {
			put(0, 1, t().tui.emptyBoard, "bold");
			put(0, 2, t().tui.emptyBoardHint, "dim");
		}

		this.boardEl.setCssProps({ "--tui-cols": String(this.cols), "--tui-rows": String(height) });
		this.framesEl.empty();
		for (let row = 0; row < height; row++) {
			const line: Line = [];
			for (let col = 0; col < this.cols; col++) {
				const cell = cells[row * this.cols + col];
				const prev = line[line.length - 1];
				if (prev && !cell.act && !prev.onClick && sameStyle(prev.style, cell.style)) prev.text += cell.ch;
				else if (prev && cell.act && prev.onClick === cell.act.onClick && sameStyle(prev.style, cell.style)) prev.text += cell.ch;
				else line.push({ ...(cell.act ?? {}), text: cell.ch, style: cell.style });
			}
			drawLine(this.framesEl, line);
		}
	}

	/** Write one card's title, hint, menu and controls onto its frame. */
	private decorate(
		card: DashboardCard,
		r: FrameRect,
		put: (col: number, row: number, text: string, style: Cell["style"], act?: Seg, limit?: number) => void,
	): void {
		const focused = this.isFocused(card);
		const arranging = this.view.arrangeMode;
		const out = this.outputs.get(card.id);
		const right = r.col + r.cols - 1;
		const top = r.row;
		const bottom = r.row + r.rows - 1;

		// Right end of the top border: the menu, and the arrange controls.
		let end = right - 1;
		const menuAct: Seg = { text: "", onClick: (e) => this.openCardMenu(card, e), label: t().tui.cardMenu };
		if (arranging) {
			const removeAct: Seg = { text: "", onClick: () => confirmRemoveCard(this.view, card), label: t().tui.removeCard };
			put(end - 2, top, "[x]", "red", removeAct, end + 1);
			end -= 3;
			if (this.stacked) {
				const down: Seg = { text: "", onClick: () => this.moveInStack(card, 1), label: t().tui.moveDown };
				const up: Seg = { text: "", onClick: () => this.moveInStack(card, -1), label: t().tui.moveUp };
				put(end - 2, top, "[▾]", "accent", down, end + 1);
				end -= 3;
				put(end - 2, top, "[▴]", "accent", up, end + 1);
				end -= 3;
				const hidden = card.mobile?.hidden === true;
				const vis: Seg = {
					text: "",
					onClick: () => {
						card.mobile = { ...card.mobile, hidden: !hidden };
						persistAndRender(this.view);
					},
					label: hidden ? t().dashboard.showOnNarrow : t().dashboard.hideOnNarrow,
				};
				put(end - 2, top, hidden ? "[○]" : "[◉]", "accent", vis, end + 1);
				end -= 3;
			}
		}
		put(end - 2, top, "[≡]", focused ? "accent" : "dim", menuAct, end + 1);
		end -= 3;

		// Left of the top border: the title.
		const collapsed = this.isCollapsed(card);
		let title = cardTitle(card);
		if (!title && (arranging || collapsed || card.mobile?.hidden)) title = cardName(card);
		if (collapsed) title = `▸ ${title}`;
		else if (this.stacked && card.mobile?.collapsed) title = `▾ ${title}`;
		let x = r.col + 2;
		if (title) {
			const room = Math.max(0, end - x - 1);
			const text = ` ${truncate(title, Math.max(0, room - 2))} `;
			const titleAct: Seg = {
				text: "",
				onClick: () => {
					if (this.stacked && card.mobile?.collapsed) this.toggleExpanded(card);
					else this.focusCard(card.id);
				},
				label: title,
			};
			put(x, top, text, focused ? ["reverse", "bold"] : "bold", titleAct, end);
			x += strWidth(text);
		}

		// The hint sits just left of the menu, when there's room between it and
		// the title.
		const hint = out?.hint ? asciify(out.hint) : "";
		if (hint) {
			const text = ` ${hint} `;
			const w = strWidth(text);
			if (end - w - 1 > x) put(end - w, top, text, "dim", undefined, end);
		}

		if (bottom <= top) return;
		// Bottom border: the resize grip while arranging, the key help while
		// focused, the scroll position whenever the body overflows.
		if (arranging && !this.stacked) {
			put(right, bottom, "◆", "accent", { text: "", label: t().tui.resize });
		}
		let bEnd = right - 1;
		const pos = this.hosts.get(card.id)?.scrollPosition();
		if (pos) {
			const text = ` ${t().tui.scroll(pos.first, pos.total)} `;
			put(bEnd - strWidth(text), bottom, text, "dim", undefined, bEnd);
			bEnd -= strWidth(text) + 1;
		}
		const foot = focused && !arranging ? out?.foot : arranging && focused ? t().tui.arrangeFoot : undefined;
		if (foot) {
			const room = bEnd - (r.col + 2);
			if (room > 6) put(r.col + 2, bottom, ` ${truncate(foot, room - 2)} `, "dim", undefined, bEnd);
		}
	}

	// ---- Focus and keys -------------------------------------------------------

	/** Give `id` the keyboard, repainting only what changes. */
	focusCard(id: string | null): void {
		const prev = this.tui.focus;
		if (prev === id) return;
		this.tui.focus = id;
		if (prev) this.hosts.get(prev)?.paint();
		if (id) this.hosts.get(id)?.paint();
		this.drawFrames();
		if (id) {
			this.keepKeyboard();
			this.revealCard(id);
		}
	}

	/**
	 * Give the board the keyboard unless something inside it already has it.
	 * A click that focuses a card repaints the row it landed on before the
	 * browser moves the focus, and a press on a removed element leaves the
	 * focus on the page — so the check runs once more after the press is done.
	 */
	private keepKeyboard(): void {
		const claim = () => {
			if (!this.boardEl.isConnected || this.boardEl.contains(document.activeElement)) return;
			this.boardEl.focus({ preventScroll: true });
		};
		claim();
		window.setTimeout(claim, 0);
	}

	/** Keep the focused card on screen as Tab moves through a long board. */
	private revealCard(id: string): void {
		const r = this.rects.get(id);
		if (!r) return;
		const scroller = this.boardEl.closest(".hearth-scroll");
		if (!(scroller instanceof HTMLElement)) return;
		const boardTop = this.boardEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
		const top = boardTop + r.row * this.cell.lh;
		const bottom = boardTop + (r.row + r.rows) * this.cell.lh;
		if (top < scroller.scrollTop) scroller.scrollTop = top - this.cell.lh;
		else if (bottom > scroller.scrollTop + scroller.clientHeight) {
			scroller.scrollTop = Math.min(top - this.cell.lh, bottom - scroller.clientHeight + this.cell.lh);
		}
	}

	/** The card with the keyboard, when it is on this board. */
	focusedCard(): DashboardCard | null {
		const id = this.tui.focus;
		return this.visibleCards().find((c) => c.id === id) ?? null;
	}

	/** Focus the board itself, so keys reach it. */
	focus(): void {
		this.boardEl.focus({ preventScroll: true });
		if (!this.tui.focus && this.order[0]) this.focusCard(this.order[0]);
	}

	/**
	 * A key pressed while the board (or something inside a card body that
	 * doesn't want it) has focus. Returns true when the board used it.
	 */
	handleKey(evt: KeyboardEvent): boolean {
		const card = this.focusedCard();
		const key = evt.key;

		if (key === "Tab") {
			this.cycleFocus(evt.shiftKey ? -1 : 1);
			return true;
		}
		if (!card) {
			if (key.startsWith("Arrow") || key === "Enter") {
				this.cycleFocus(1);
				return true;
			}
			return false;
		}

		if (this.view.arrangeMode) {
			if (this.arrangeKey(card, evt)) return true;
		}

		const host = this.hosts.get(card.id);
		if (host?.key(evt)) return true;

		const renderer = tuiRenderer(card, this.view);
		switch (key) {
			case "Enter":
				if (this.stacked && card.mobile?.collapsed && this.isCollapsed(card)) this.toggleExpanded(card);
				else if (renderer?.detail && host) renderer.detail(host.context(new Component()));
				else this.zoom(card);
				return true;
			case "Escape":
				this.focusCard(null);
				return true;
			case "ContextMenu":
				this.openCardMenu(card);
				return true;
		}
		if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;
		switch (key) {
			case "m":
				this.openCardMenu(card);
				return true;
			case "z":
				this.zoom(card);
				return true;
			case "o":
				if (renderer?.detail && host) renderer.detail(host.context(new Component()));
				else this.zoom(card);
				return true;
			case "e":
				openCardSettings(this.view, card);
				return true;
		}
		if (key.startsWith("Arrow")) return this.moveFocusSpatially(card, key);
		return false;
	}

	private cycleFocus(dir: 1 | -1): void {
		if (this.order.length === 0) return;
		const i = this.tui.focus ? this.order.indexOf(this.tui.focus) : -1;
		const next = i < 0 ? (dir > 0 ? 0 : this.order.length - 1) : (i + dir + this.order.length) % this.order.length;
		this.focusCard(this.order[next]);
	}

	/** Move focus to the nearest card in the arrow's direction. */
	private moveFocusSpatially(card: DashboardCard, key: string): boolean {
		const from = this.rects.get(card.id);
		if (!from) return false;
		const cx = from.col + from.cols / 2;
		const cy = from.row + from.rows / 2;
		let best: { id: string; d: number } | null = null;
		for (const [id, r] of this.rects) {
			if (id === card.id) continue;
			const x = r.col + r.cols / 2;
			const y = r.row + r.rows / 2;
			const dx = x - cx;
			const dy = y - cy;
			const ok =
				(key === "ArrowRight" && r.col >= from.col + from.cols - 1) ||
				(key === "ArrowLeft" && r.col + r.cols - 1 <= from.col) ||
				(key === "ArrowDown" && r.row >= from.row + from.rows - 1) ||
				(key === "ArrowUp" && r.row + r.rows - 1 <= from.row);
			if (!ok) continue;
			// Distance along the arrow counts once, across it twice: the card
			// straight ahead wins over a nearer one off to the side.
			const along = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
			const across = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
			const d = along + across * 2;
			if (!best || d < best.d) best = { id, d };
		}
		if (!best) return false;
		this.focusCard(best.id);
		return true;
	}

	// ---- Arranging --------------------------------------------------------------

	private arrangeKey(card: DashboardCard, evt: KeyboardEvent): boolean {
		const key = evt.key;
		if (key === "x" || key === "Delete" || key === "Backspace") {
			confirmRemoveCard(this.view, card);
			return true;
		}
		if (!key.startsWith("Arrow")) return false;
		if (this.stacked) {
			if (key === "ArrowUp") this.moveInStack(card, -1);
			else if (key === "ArrowDown") this.moveInStack(card, 1);
			return true;
		}
		const r = this.rects.get(card.id);
		if (!r) return false;
		const dx = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
		const dy = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
		const next = evt.shiftKey ? resizeRect(r, dx, dy, this.cols) : moveRect(r, dx, dy, this.cols);
		this.applyRect(card, next);
		this.commitNudge();
		return true;
	}

	/** Put `card` at `rect` on screen and in its stored geometry. */
	private applyRect(card: DashboardCard, rect: FrameRect): void {
		this.rects.set(card.id, rect);
		const g = rectGeometry(rect, this.cols);
		card.fx = g.fx;
		card.fy = g.fy;
		card.fw = g.fw;
		card.fh = g.fh;
		// Keep the legacy grid units in step, as the graphical drag does.
		const columns = effectiveColumns(this.s);
		const rowHeight = effectiveRowHeight(this.s) || ROW_HEIGHT;
		card.w = Math.max(1, Math.min(columns, Math.round(g.fw * columns)));
		card.x = Math.max(0, Math.min(columns - card.w, Math.round(g.fx * columns)));
		card.h = Math.max(1, Math.round(g.fh / (rowHeight + GRID_GAP)));
		card.y = Math.max(0, Math.round(g.fy / (rowHeight + GRID_GAP)));
		const el = this.bodies.get(card.id);
		if (el) this.placeBody(el, rect);
		this.drawFrames();
	}

	private moveInStack(card: DashboardCard, delta: -1 | 1): void {
		if (moveStacked(this.cards, card, delta, { includeHidden: true })) persistAndRender(this.view);
	}

	private toggleExpanded(card: DashboardCard): void {
		if (this.tui.expanded.has(card.id)) this.tui.expanded.delete(card.id);
		else this.tui.expanded.add(card.id);
		this.tui.focus = card.id;
		this.layout();
	}

	private cellAt(evt: PointerEvent | MouseEvent): { col: number; row: number } {
		const box = this.boardEl.getBoundingClientRect();
		return {
			col: Math.floor((evt.clientX - box.left) / this.cell.ch),
			row: Math.floor((evt.clientY - box.top) / this.cell.lh),
		};
	}

	/** The card whose frame border passes through a cell — or, with
	 * `anywhere`, whose frame contains it (arranging drags a card by its body
	 * too, which is shielded from clicks while arranging). */
	private frameAt(col: number, row: number, anywhere = false): { card: DashboardCard; corner: boolean } | null {
		const hits = this.visibleCards().filter((c) => {
			const r = this.rects.get(c.id);
			if (!r) return false;
			const inside = col >= r.col && col < r.col + r.cols && row >= r.row && row < r.row + r.rows;
			const border = col === r.col || col === r.col + r.cols - 1 || row === r.row || row === r.row + r.rows - 1;
			return inside && (border || anywhere);
		});
		const card = hits.find((c) => c.id === this.tui.focus) ?? hits[hits.length - 1];
		if (!card) return null;
		const r = this.rects.get(card.id)!;
		return { card, corner: col === r.col + r.cols - 1 && row === r.row + r.rows - 1 };
	}

	private onPointerDown(evt: PointerEvent): void {
		if (evt.button !== 0) return;
		if (!(evt.target instanceof HTMLElement) || !this.framesEl.contains(evt.target)) return;
		const { col, row } = this.cellAt(evt);
		const hit = this.frameAt(col, row, this.view.arrangeMode);
		if (!hit) return;
		this.focusCard(hit.card.id);
		if (!this.view.arrangeMode || this.stacked) return;
		const r = this.rects.get(hit.card.id);
		if (!r) return;
		this.drag = { id: hit.card.id, mode: hit.corner ? "resize" : "move", col, row, orig: { ...r }, moved: false, pointerId: evt.pointerId };
	}

	private onPointerMove(evt: PointerEvent): void {
		const d = this.drag;
		if (!d || evt.pointerId !== d.pointerId) return;
		const { col, row } = this.cellAt(evt);
		const dc = col - d.col;
		const dr = row - d.row;
		if (!d.moved && dc === 0 && dr === 0) return;
		if (!d.moved) {
			d.moved = true;
			this.boardEl.setPointerCapture(evt.pointerId);
			this.boardEl.addClass("is-dragging");
		}
		const card = this.cards.find((c) => c.id === d.id);
		if (!card) return;
		const next = d.mode === "move" ? moveRect(d.orig, dc, dr, this.cols) : resizeRect(d.orig, dc, dr, this.cols);
		const cur = this.rects.get(d.id);
		if (cur && cur.col === next.col && cur.row === next.row && cur.cols === next.cols && cur.rows === next.rows) return;
		this.applyRect(card, next);
	}

	private onPointerUp(evt: PointerEvent): void {
		const d = this.drag;
		if (!d || evt.pointerId !== d.pointerId) return;
		this.drag = null;
		this.boardEl.removeClass("is-dragging");
		if (this.boardEl.hasPointerCapture(evt.pointerId)) this.boardEl.releasePointerCapture(evt.pointerId);
		if (!d.moved) return;
		const card = this.cards.find((c) => c.id === d.id);
		this.tui.say(t().tui.moved(card ? cardName(card) : ""));
		persistAndRender(this.view);
	}

	private onContextMenu(evt: MouseEvent): void {
		if (!(evt.target instanceof HTMLElement)) return;
		const bodyEl = evt.target.closest<HTMLElement>(".hearth-tui-body");
		const id = bodyEl?.dataset.card ?? null;
		if (id) {
			const card = this.cards.find((c) => c.id === id);
			if (!card) return;
			// A graphical body keeps its own right-click (a task's menu, git's).
			if (bodyEl?.hasClass("is-graphical")) return;
			evt.preventDefault();
			this.focusCard(id);
			if (!this.hosts.get(id)?.contextMenu(evt)) this.openCardMenu(card, evt);
			return;
		}
		if (!this.framesEl.contains(evt.target)) return;
		const { col, row } = this.cellAt(evt);
		const hit = this.frameAt(col, row);
		if (!hit) return;
		evt.preventDefault();
		this.focusCard(hit.card.id);
		this.openCardMenu(hit.card, evt);
	}

	// ---- Card menu and zoom ---------------------------------------------------

	/** The card's menu: its own entries, then the ones every card has. */
	openCardMenu(card: DashboardCard, evt?: MouseEvent | KeyboardEvent): void {
		const renderer = tuiRenderer(card, this.view);
		const host = this.hosts.get(card.id);
		const menu = hearthMenu();
		if (renderer?.menu && host) {
			renderer.menu(host.context(new Component()), menu);
			menu.addSeparator();
		}
		if (renderer?.detail && host) {
			menu.addItem((i) =>
				i.setTitle(t().tui.menuDetail).setIcon("maximize-2").onClick(() => renderer.detail?.(host.context(new Component()))),
			);
		}
		menu.addItem((i) => i.setTitle(t().tui.menuZoom).setIcon("zoom-in").onClick(() => this.zoom(card)));
		menu.addItem((i) =>
			i.setTitle(t().tui.menuRefresh).setIcon("refresh-cw").onClick(() => {
				if (host) host.redraw();
				else this.layout();
			}),
		);
		menu.addSeparator();
		menu.addItem((i) => i.setTitle(t().tui.menuSettings).setIcon("settings-2").onClick(() => openCardSettings(this.view, card)));
		const pinned = this.s.pinnedCards.includes(card);
		menu.addItem((i) =>
			i.setTitle(pinned ? t().tui.menuUnpin : t().tui.menuPin).setIcon("pin").onClick(() => {
				setCardPinned(this.s, card, !pinned);
				persistAndRender(this.view);
			}),
		);
		menu.addItem((i) =>
			i.setTitle(t().tui.menuDuplicate).setIcon("copy").onClick(() => {
				const copy = cloneCard(card);
				const r = this.rects.get(card.id);
				if (r) Object.assign(copy, rectGeometry({ ...r, row: r.row + r.rows }, this.cols));
				activeCards(this.s).push(copy);
				this.tui.focus = copy.id;
				persistAndRender(this.view);
			}),
		);
		menu.addSeparator();
		menu.addItem((i) =>
			i.setTitle(t().tui.menuRemove).setIcon("trash-2").setWarning(true).onClick(() => confirmRemoveCard(this.view, card)),
		);
		showMenu(menu, evt, this.boardEl, this.rects.get(card.id), this.cell);
	}

	/** Open `card` large, in a dialog. */
	zoom(card: DashboardCard): void {
		if (!this.events) return;
		openTuiZoom(this.view, card);
	}

	/** Redraw every card by hand (F5). Returns how many were redrawn. */
	refreshAll(): number {
		let n = 0;
		for (const host of this.hosts.values()) {
			host.redraw();
			n++;
		}
		return n;
	}

	/** Whether any card can take the keyboard. */
	hasCards(): boolean {
		return this.order.length > 0;
	}

	/** Kind-specific filter/sort for the focused card (F4/F6), when it has
	 * one. Returns whether anything happened. */
	cardKey(key: string): boolean {
		const card = this.focusedCard();
		const host = card ? this.hosts.get(card.id) : undefined;
		if (!host) return false;
		return host.key(new KeyboardEvent("keydown", { key }));
	}
}

function sameStyle(a: Seg["style"], b: Seg["style"]): boolean {
	const ka = Array.isArray(a) ? a.join(" ") : (a ?? "");
	const kb = Array.isArray(b) ? b.join(" ") : (b ?? "");
	return ka === kb;
}

/** Show a menu at the pointer, or — opened from the keyboard — at the card's
 * top-right corner. */
function showMenu(
	menu: Menu,
	evt: MouseEvent | KeyboardEvent | undefined,
	boardEl: HTMLElement,
	rect: FrameRect | undefined,
	cell: CellMetrics,
): void {
	if (evt instanceof MouseEvent && evt.clientX + evt.clientY > 0) {
		menu.showAtMouseEvent(evt);
		return;
	}
	const box = boardEl.getBoundingClientRect();
	const x = box.left + ((rect ? rect.col + rect.cols - 4 : 0) * cell.ch);
	const y = box.top + ((rect ? rect.row + 1 : 0) * cell.lh);
	menu.showAtPosition({ x, y });
}
