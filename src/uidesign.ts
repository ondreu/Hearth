/**
 * The design Hearth's own interface is drawn in — its dialogs, menus, settings
 * pane and the board's furniture — as opposed to the cards, which already had
 * one (see effectiveCardDesign).
 *
 * The rule is the cards' rule, carried outwards: a card's design, else its
 * board's, else the vault's Card design. What makes it work for a dialog is
 * knowing where the dialog was opened *from*, and a dialog is almost always
 * opened by a click or a keystroke a moment earlier. So Hearth remembers the
 * element the last press landed on, and a dialog or menu built shortly after
 * takes the design of the nearest thing around that element that states one:
 *
 *  - a card, which carries its own effective design (`data-hearth-design`,
 *    written in dashboard.ts);
 *  - the board, which carries the board's (view.ts);
 *  - another Hearth dialog or menu, which carries whatever it was given — so a
 *    confirm opened from a dialog looks like that dialog;
 *  - the settings pane, which carries the vault's.
 *
 * Anything else — the command palette, a ribbon button, a press too long ago
 * to be the one that opened this — falls back to the vault's design.
 *
 * A caller that knows better still says so: {@link dressModal} in ui.ts
 * overrides the default, which is how a task, an event or a folder dialog has
 * always taken the design of the card it came from.
 */
import { type App, FuzzySuggestModal, Menu, Modal, type Plugin } from "obsidian";
import type { CardDesign } from "./types";

/** The attribute every design-carrying element states its design in. Read and
 * written through `dataset`, where it is `hearthDesign`. */
export const DESIGN_ATTR = "data-hearth-design";

/** The class a dialog wears in the Expressive design. styles.css keys the
 * dialog's frame, its controls and any card content inside it off this. */
export const X_MODAL_CLASS = "hearth-x-modal";
/** The class a menu wears in the Expressive design. */
export const X_MENU_CLASS = "hearth-x-menu";

/** The classes a dialog and a menu wear while terminal mode is on. Terminal
 * mode is vault-wide, so it doesn't follow the press that opened them: every
 * Hearth dialog and menu is a terminal one while it's on. */
export const T_MODAL_CLASS = "hearth-t-modal";
export const T_MENU_CLASS = "hearth-t-menu";

/** How long a press stays the likely opener of the next dialog. Long enough to
 * cover a dialog that waits on a file read or two first; short enough that a
 * press from a minute ago isn't credited with a dialog a timer opened. */
const ORIGIN_TTL_MS = 3000;

/**
 * The design stated nearest to `origin`: the closest ancestor (or `origin`
 * itself) carrying {@link DESIGN_ATTR}, else `fallback`. Pure, and the whole of
 * the precedence rule — a card sits inside its board, so the card is found
 * first; a board sits inside nothing that states one, so the vault's comes
 * last.
 */
export function designFromOrigin(origin: Element | null | undefined, fallback: CardDesign): CardDesign {
	const holder = origin?.closest(`[${DESIGN_ATTR}]`);
	const stated = holder?.getAttribute(DESIGN_ATTR);
	return stated === "expressive" || stated === "classic" ? stated : fallback;
}

/** State the design an element (and everything opened from inside it) is
 * drawn in. */
export function stateDesign(el: HTMLElement, design: CardDesign): void {
	el.setAttribute(DESIGN_ATTR, design);
}

// ---- Where the last press landed ----------------------------------------

let lastOrigin: Element | null = null;
let lastOriginAt = 0;
let vaultDesign: () => CardDesign = () => "classic";
let terminalUi: () => string | null = () => null;

function remember(evt: Event): void {
	lastOrigin = evt.target instanceof Element ? evt.target : null;
	lastOriginAt = Date.now();
}

/** Listen for presses on one document. Capture phase, so a handler that stops
 * propagation (a card's own click handling, a menu) can't hide the press. */
function watchDocument(plugin: Plugin, doc: Document): void {
	plugin.registerDomEvent(doc, "pointerdown", remember, { capture: true });
	plugin.registerDomEvent(doc, "keydown", remember, { capture: true });
}

/**
 * Start following presses, for the life of `plugin`. `vault` reads the vault's
 * Card design each time it is needed, so a change in settings needs no call
 * back here. Popout windows are followed as they open.
 */
export function installUiDesign(
	plugin: Plugin,
	vault: () => CardDesign,
	/** The terminal scheme in force, or null outside terminal mode. */
	terminal: () => string | null = () => null,
): void {
	vaultDesign = vault;
	terminalUi = terminal;
	watchDocument(plugin, document);
	plugin.registerEvent(
		plugin.app.workspace.on("window-open", (win) => watchDocument(plugin, win.doc)),
	);
	plugin.register(() => {
		lastOrigin = null;
		vaultDesign = () => "classic";
		terminalUi = () => null;
	});
}

/** The vault's own Card design, the fallback for everything else. */
export function vaultUiDesign(): CardDesign {
	return vaultDesign();
}

/** Whether Hearth's interface is in terminal mode right now. */
export function terminalUiActive(): boolean {
	return terminalUi() !== null;
}

/** The terminal scheme's class, or null outside terminal mode. Dialogs and
 * menus live outside the view, so they carry the scheme themselves. */
export function terminalSchemeClass(): string | null {
	const scheme = terminalUi();
	return scheme ? `hearth-tui-scheme-${scheme}` : null;
}

/** Put `el` in terminal mode's dress when it is on: `cls`, and the scheme. */
function dressTerminal(el: HTMLElement, cls: string): boolean {
	const scheme = terminalSchemeClass();
	el.toggleClass(cls, scheme !== null);
	if (scheme) el.addClass(scheme);
	return scheme !== null;
}

/** The design something opened right now should take: that of whatever the
 * last press landed in, when it was recent enough to be the opener. */
export function currentUiDesign(): CardDesign {
	const fresh = lastOrigin && Date.now() - lastOriginAt <= ORIGIN_TTL_MS ? lastOrigin : null;
	return designFromOrigin(fresh, vaultDesign());
}

// ---- Dialogs and menus -----------------------------------------------------

/** Put a dialog in `design`: the class its look keys off, and the stated
 * design a dialog opened from it inherits. */
export function applyModalDesign(modal: Modal, design: CardDesign): void {
	const terminal = dressTerminal(modal.modalEl, T_MODAL_CLASS);
	modal.modalEl.toggleClass(X_MODAL_CLASS, design === "expressive" && !terminal);
	stateDesign(modal.modalEl, design);
}

/** Every Hearth dialog: born in the design of wherever it was opened from. */
export class HearthModal extends Modal {
	constructor(app: App) {
		super(app);
		applyModalDesign(this, currentUiDesign());
	}
}

/** Every Hearth picker (file, folder, command, icon): as {@link HearthModal}. */
export abstract class HearthFuzzySuggestModal<T> extends FuzzySuggestModal<T> {
	constructor(app: App) {
		super(app);
		applyModalDesign(this, currentUiDesign());
	}
}

/**
 * A menu in the design of wherever it was opened from.
 *
 * Obsidian's public Menu API has no handle on the menu's element; `dom` is the
 * internal one (see obsidian-ext.d.ts) and is treated as possibly absent. A
 * native menu (the desktop "Native menus" option) is drawn by the OS, so it
 * has no element to dress and simply stays native.
 */
export function hearthMenu(): Menu {
	const menu = new Menu();
	const dom = menu.dom;
	if (dom instanceof HTMLElement) {
		const design = currentUiDesign();
		const terminal = dressTerminal(dom, T_MENU_CLASS);
		dom.toggleClass(X_MENU_CLASS, design === "expressive" && !terminal);
		stateDesign(dom, design);
		if (design === "expressive" && !terminal) markMenuGroups(menu, dom);
	}
	return menu;
}

/**
 * Mark an Expressive menu's groups for its CSS: `is-grouped` on a menu whose
 * entries are split by separators, `is-group-end` on the entry closing each
 * group. CSS could ask with `:has()`, but that selector is re-evaluated on
 * every change anywhere in the menu. The entries are added after
 * {@link hearthMenu} returns (and may be rebuilt on show), so the marks follow
 * the element's children rather than being set once.
 */
function markMenuGroups(menu: Menu, dom: HTMLElement): void {
	const mark = () => {
		dom.toggleClass("is-grouped", dom.querySelector(".menu-separator") !== null);
		for (const item of Array.from(dom.querySelectorAll(".menu-item"))) {
			const next = item.nextElementSibling;
			item.toggleClass("is-group-end", next !== null && next.hasClass("menu-separator"));
		}
	};
	const observer = new MutationObserver(mark);
	observer.observe(dom, { childList: true, subtree: true });
	menu.register(() => observer.disconnect());
}

// ---- Grouped settings rows --------------------------------------------------

/** A group of settings rows in an Expressive dialog: its heading row, if it
 * has one, above a tonal container holding the rows. */
export const X_GROUP_CLASS = "hearth-x-group";
const X_GROUP_BODY_CLASS = "hearth-x-group-body";
const X_GROUP_HEAD_CLASS = "hearth-x-group-head";
/** Left between two runs of rows that belong in separate groups but have no
 * heading between them. Consumed by {@link groupSettingRows}. */
export const X_GROUP_BREAK_CLASS = "hearth-x-group-break";

/**
 * Gather the loose children of a dialog's body into groups, the way Material
 * lays out a settings screen: each run of rows on a tonal container of its own,
 * under its heading. A group starts at every heading row (`setHeading()`, which
 * becomes the group's title) and at every break marker; anything before the
 * first of either forms an untitled group.
 *
 * Done after the fact, over whatever the tab drew, so the ~35 kinds' editors —
 * which draw flat runs of rows split by `setHeading()` — are grouped without
 * each being rewritten. Idempotent: children already in a group stay put, and
 * anything appended later (an editor that fills in after a fetch) joins the
 * last group when this runs again.
 */
export function groupSettingRows(body: HTMLElement): void {
	let groupBody: HTMLElement | null = null;
	// A new group, put where `before` stands. Made at the end of the body and
	// moved, since a loose element would belong to the main window's document
	// rather than a popout's.
	const open = (before: Element): HTMLElement => {
		const group = body.createDiv(X_GROUP_CLASS);
		body.insertBefore(group, before);
		return group;
	};
	for (const child of Array.from(body.children)) {
		const cls = child.classList;
		if (cls.contains(X_GROUP_CLASS)) {
			groupBody = child.querySelector<HTMLElement>(`:scope > .${X_GROUP_BODY_CLASS}`);
		} else if (cls.contains(X_GROUP_BREAK_CLASS)) {
			child.remove();
			groupBody = null;
		} else if (cls.contains("setting-item-heading")) {
			const group = open(child);
			group.appendChild(child);
			cls.add(X_GROUP_HEAD_CLASS);
			groupBody = group.createDiv(X_GROUP_BODY_CLASS);
		} else {
			groupBody ??= open(child).createDiv(X_GROUP_BODY_CLASS);
			groupBody.appendChild(child);
		}
	}
}
