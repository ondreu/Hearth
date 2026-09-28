/**
 * The contract a card kind implements to be drawn as text in terminal mode.
 *
 * Deliberately separate from `CardDefinition` (src/cards/definition.ts): a
 * kind's graphical renderer stays exactly what it was, and terminal mode looks
 * its text renderer up in its own registry (src/tui/registry.ts). A kind with
 * no text renderer is not left out — terminal mode draws its graphical body
 * inside a terminal frame — so the registry can grow one kind at a time.
 *
 * A text renderer does not touch the DOM for its text. It returns lines of
 * segments sized to the body it is given, and the board draws them, highlights
 * the selected item, scrolls it into view and routes the keyboard. What it
 * cannot express as text (a textarea, an editor) it asks for as a mount.
 */
import type { Component, Menu } from "obsidian";
import type { DashboardCard } from "../types";
import type { HomeView } from "../view";
import type { Line } from "./text";

/** One selectable thing in a card body: a task, a file, a button. The board
 * moves the selection between items with the arrow keys, draws the selected
 * one in reverse video, and calls these when it is acted on. */
export interface TuiItem {
	/** The first body line the item occupies. */
	line: number;
	/** How many lines it spans (default 1). */
	span?: number;
	/** The columns it occupies on its line, `[from, to)`, when it shares the
	 * line with other items (a row of buttons). Default: the whole line. */
	range?: [number, number];
	/** Enter, a click or a tap. */
	activate?: (evt?: MouseEvent | KeyboardEvent) => void;
	/** Space: tick a task, move a card, toggle a folder. */
	toggle?: () => void;
	/** The context menu key, or a right-click. */
	menu?: (evt: MouseEvent | KeyboardEvent) => void;
	/** Delete / Backspace. */
	remove?: () => void;
}

/** Something that isn't text, placed on the body's grid: a textarea, a
 * hosted editor, a real input. `mount` is handed an element already sized
 * and positioned to the cells asked for. */
export interface TuiMount {
	/** First body line it covers. */
	line: number;
	/** Lines it covers. */
	rows: number;
	/** First column (default 0) and width (default the whole body). */
	col?: number;
	cols?: number;
	mount: (host: HTMLElement, component: Component) => void;
}

/** What a text renderer produces for one draw. */
export interface TuiOutput {
	/** The body, one entry per row, each already at most `cols` wide (the board
	 * fits them regardless). May run past `rows`; the body then scrolls. */
	lines: Line[];
	/** The selectable items, in keyboard order. */
	items?: TuiItem[];
	/** Short text on the frame's top border, right-aligned: a count, a place,
	 * a state. */
	hint?: string;
	/** Key help on the frame's bottom border while the card is focused. */
	foot?: string;
	/** Non-text content to place on the grid. */
	mounts?: TuiMount[];
	/** A double-click anywhere on the body — a note card's way into its
	 * editor. */
	onDoubleClick?: () => void;
	/** Scroll the body so this line is at the top, the first time the card
	 * is drawn (a time grid opening on the morning rather than at midnight). */
	scrollTo?: number;
	/** How many of the first lines stay put while the rest scrolls under them
	 * — a toolbar, a table's header. */
	sticky?: number;
	/** Pin the selection to this item index for this draw (e.g. after a new
	 * item was added). */
	select?: number;
}

/** Everything a text renderer is given. */
export interface TuiContext {
	view: HomeView;
	card: DashboardCard;
	/** Owns everything this draw registers; torn down before the next draw. */
	component: Component;
	/** Lives as long as the card is on screen, across its redraws — for what a
	 * card keeps between draws (a calendar's event feeds and their refresh
	 * timer). */
	persistent: Component;
	/** The body's size in cells. */
	cols: number;
	rows: number;
	/** Whether the card has the keyboard. */
	focused: boolean;
	/** Whether this draw is the zoomed view in a dialog rather than the card. */
	zoomed: boolean;
	/** The selected item's index. */
	selected: number;
	/** Per-card state that outlives redraws and board rebuilds (a calendar's
	 * month, a folder card's open folders) for as long as the tab is open. */
	state: Record<string, unknown>;
	/** Draw the card again — after async data arrived, or after the renderer
	 * changed its own state. */
	redraw: () => void;
	/** Move the selection. */
	select: (index: number) => void;
}

/** A kind's text renderer. */
export interface TuiRenderer {
	render: (ctx: TuiContext) => TuiOutput;
	/** Whether this particular card is drawn graphically after all — an
	 * embed card showing a picture or a canvas rather than a note. */
	graphicalFor?: (view: HomeView, card: DashboardCard) => boolean;
	/** Keys the card handles itself (arrows in a calendar grid, letters for
	 * git actions). Return true to claim the key. Called before the board's
	 * own list navigation. */
	key?: (ctx: TuiContext, evt: KeyboardEvent) => boolean;
	/** Kind-specific entries for the card menu, above the common ones. */
	menu?: (ctx: TuiContext, menu: Menu) => void;
	/** The kind's own larger view — the weather forecast, a quote's chart, a
	 * task's details. Offered in the card menu and on `o`. Without it, the
	 * card's zoomed text view is the larger view. */
	detail?: (ctx: TuiContext) => void;
}
