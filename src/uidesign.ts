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
export function installUiDesign(plugin: Plugin, vault: () => CardDesign): void {
	vaultDesign = vault;
	watchDocument(plugin, document);
	plugin.registerEvent(
		plugin.app.workspace.on("window-open", (win) => watchDocument(plugin, win.doc)),
	);
	plugin.register(() => {
		lastOrigin = null;
		vaultDesign = () => "classic";
	});
}

/** The vault's own Card design, the fallback for everything else. */
export function vaultUiDesign(): CardDesign {
	return vaultDesign();
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
	modal.modalEl.toggleClass(X_MODAL_CLASS, design === "expressive");
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
		dom.toggleClass(X_MENU_CLASS, design === "expressive");
		stateDesign(dom, design);
		if (design === "expressive") markMenuGroups(menu, dom);
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
