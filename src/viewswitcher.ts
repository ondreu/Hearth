import type { Component } from "obsidian";
import { setIcon } from "./glyphs";
import { cardDefinition } from "./cards";
import { activeViewIndex, cardViews, resolveViewSwitcher, type ResolvedViewSwitcher } from "./cardviews";
import { t } from "./i18n";
import { hearthMenu } from "./uidesign";
import { showMenuFor } from "./filemenu";
import type { DashboardCard } from "./types";
import type { HomeView } from "./view";

/**
 * The control that switches a card between its views (#385), and the two other
 * ways to switch: a swipe on a touch screen, and rotation on a timer.
 *
 * Which views there are and which one is on show is src/cardviews.ts's
 * business; this file only draws the choice and reports it through `select`.
 */

/** How a view reads in the switcher: its label and icon. */
export interface ViewIdentity {
	label: string;
	icon: string;
}

/**
 * The label and icon of `card` (a card or one of its views). A view's own
 * `viewLabel`/`viewIcon` wins; then what the kind can tell from the content (an
 * embed card's file); then the card's title; then the kind's name and icon.
 */
export function viewIdentity(view: HomeView, card: DashboardCard): ViewIdentity {
	const def = cardDefinition(card);
	const own = def.viewIdentity?.(view, card) ?? {};
	return {
		label:
			card.viewLabel?.trim() ||
			own.label?.trim() ||
			card.title?.trim() ||
			t().editors.kinds[card.kind],
		icon: card.viewIcon?.trim() || own.icon || def.templates[0]?.icon || "square",
	};
}

/** What the switcher needs to know about a box on screen: where its left and
 * right edges are, in viewport pixels. Kept structural so the arithmetic below
 * can be tested without a layout engine. */
export interface Span {
	left: number;
	right: number;
}

/**
 * The scroll offset `row` needs so `tab` is inside it, or `scrollLeft`
 * unchanged when the tab already is. Horizontal only, by construction: a tab
 * that sits above or below the row is not this function's business, and that is
 * the point — the board is never asked to move for a switcher (#440).
 */
export function revealScrollLeft(scrollLeft: number, row: Span, tab: Span): number {
	if (tab.left < row.left) return Math.max(0, scrollLeft - (row.left - tab.left));
	if (tab.right > row.right) return scrollLeft + (tab.right - row.right);
	return scrollLeft;
}

/** What the card hands the switcher. */
export interface ViewSwitcherHost {
	view: HomeView;
	/** The card on the board. */
	card: DashboardCard;
	cardEl: HTMLElement;
	head: HTMLElement;
	/** Whether the card shows a header for a header switcher to sit in. */
	titled: boolean;
	/** Show view `index`. */
	select: (index: number) => void;
}

/** A mounted switcher. `update` redraws it for the view now on show. */
export interface ViewSwitcherHandle {
	settings: ResolvedViewSwitcher;
	update(): void;
}

/**
 * Draw the switcher for a card with views. Returns null for a card without
 * views. A "hidden" switcher draws nothing but still returns a handle, since
 * swiping and rotation still need the resolved settings.
 */
export function mountViewSwitcher(host: ViewSwitcherHost): ViewSwitcherHandle | null {
	const { view, card, cardEl, head } = host;
	const views = cardViews(card);
	if (views.length < 2) return null;
	const settings = resolveViewSwitcher(card, host.titled);
	if (settings.placement === "hidden") return { settings, update: () => {} };

	const el =
		settings.placement === "header"
			? head.createDiv("hearth-view-switch is-header")
			: cardEl.createDiv(`hearth-view-switch is-floating is-${settings.placement}`);
	el.addClass(`is-style-${settings.style}`);
	el.toggleClass("is-reveal-hover", settings.reveal === "hover");
	// Nothing on the switcher may start a card drag, or reach the card's own
	// click handling underneath it.
	el.addEventListener("pointerdown", (e) => e.stopPropagation());
	el.addEventListener("click", (e) => e.stopPropagation());

	const draw = (): void => {
		el.empty();
		const active = activeViewIndex(card);
		if (settings.style === "dropdown") {
			drawDropdown(el, host, active);
			return;
		}
		el.setAttribute("role", "tablist");
		el.setAttribute("aria-label", t().views.switcherAria);
		views.forEach((v, index) => {
			const id = viewIdentity(view, v);
			const btn = el.createEl("button", {
				cls: "hearth-view-switch-btn",
				attr: {
					type: "button",
					role: "tab",
					"aria-selected": String(index === active),
					"aria-label": t().views.switchTo(id.label),
					tabindex: index === active ? "0" : "-1",
				},
			});
			btn.toggleClass("is-active", index === active);
			btn.setAttribute("title", id.label);
			const label = settings.style === "icons" ? "icon" : settings.label;
			if (settings.style === "dots") {
				btn.addClass("is-dot");
			} else {
				if (label !== "label") setIcon(btn.createSpan("hearth-view-switch-icon"), id.icon);
				if (label !== "icon") btn.createSpan({ cls: "hearth-view-switch-label", text: id.label });
			}
			btn.addEventListener("click", () => {
				if (index !== activeViewIndex(card)) host.select(index);
			});
		});
		// Keep the tab on show in sight when the row is wider than the card.
		// The row scrolls sideways and only sideways (`overflow-x: auto` on
		// `.hearth-view-switch`), so the row itself is moved. Asking the
		// browser instead (`scrollIntoView`) scrolls every scrollable parent
		// in both axes, so a card below the fold pulled the board down to
		// itself — and a board at the top has no restore running to undo that,
		// so the jump was saved as the user's own position (#440).
		const shown = el.querySelector<HTMLElement>(".hearth-view-switch-btn.is-active");
		if (shown) {
			const left = revealScrollLeft(
				el.scrollLeft,
				el.getBoundingClientRect(),
				shown.getBoundingClientRect(),
			);
			if (left !== el.scrollLeft) el.scrollLeft = left;
		}
	};

	// Left/right move between tabs, the way a tab list is used from a keyboard.
	el.addEventListener("keydown", (e) => {
		if (settings.style === "dropdown") return;
		if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
		e.preventDefault();
		e.stopPropagation();
		const count = views.length;
		const next = (activeViewIndex(card) + (e.key === "ArrowRight" ? 1 : -1) + count) % count;
		host.select(next);
		el.querySelector<HTMLElement>(".hearth-view-switch-btn.is-active")?.focus();
	});

	draw();
	return { settings, update: draw };
}

/** The drop-down style: one button naming the view on show, opening a menu of
 * every view. The most compact choice, and the one that copes with any number
 * of views on any width. */
function drawDropdown(el: HTMLElement, host: ViewSwitcherHost, active: number): void {
	const views = cardViews(host.card);
	const current = viewIdentity(host.view, views[active]);
	const btn = el.createEl("button", {
		cls: "hearth-view-switch-btn is-active is-dropdown",
		attr: { type: "button", "aria-haspopup": "menu", "aria-label": t().views.chooseView },
	});
	btn.setAttribute("title", current.label);
	setIcon(btn.createSpan("hearth-view-switch-icon"), current.icon);
	btn.createSpan({ cls: "hearth-view-switch-label", text: current.label });
	setIcon(btn.createSpan("hearth-view-switch-chevron"), "chevron-down");
	btn.addEventListener("click", (evt) => {
		const menu = hearthMenu();
		views.forEach((v, index) => {
			const id = viewIdentity(host.view, v);
			menu.addItem((item) =>
				item
					.setTitle(id.label)
					.setIcon(id.icon)
					.setChecked(index === activeViewIndex(host.card))
					.onClick(() => {
						if (index !== activeViewIndex(host.card)) host.select(index);
					}),
			);
		});
		showMenuFor(menu, evt);
	});
}

/** The smallest horizontal travel, in pixels, that counts as a swipe. */
const SWIPE_MIN = 56;

/** Whether `target`, or something between it and `stop`, scrolls sideways on
 * its own — a wide table, a kanban board. A swipe there belongs to it. */
function scrollsSideways(target: EventTarget | null, stop: HTMLElement): boolean {
	let el = target instanceof HTMLElement ? target : null;
	while (el && el !== stop) {
		if (el.scrollWidth > el.clientWidth + 1) {
			const overflow = el.win.getComputedStyle(el).overflowX;
			if (overflow === "auto" || overflow === "scroll") return true;
		}
		el = el.parentElement;
	}
	return false;
}

/**
 * Switch views with a horizontal swipe across the card's body. Touch only — a
 * mouse drag across a card is a text selection — and only when the swipe is
 * clearly sideways and didn't start in something that scrolls sideways itself.
 */
export function enableViewSwipe(
	body: HTMLElement,
	component: Component,
	step: (delta: 1 | -1) => void,
): void {
	let start: { id: number; x: number; y: number } | null = null;
	component.registerDomEvent(body, "pointerdown", (e) => {
		if (e.pointerType !== "touch" || scrollsSideways(e.target, body)) {
			start = null;
			return;
		}
		start = { id: e.pointerId, x: e.clientX, y: e.clientY };
	});
	component.registerDomEvent(body, "pointerup", (e) => {
		if (!start || e.pointerId !== start.id) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 2) return;
		step(dx < 0 ? 1 : -1);
	});
	component.registerDomEvent(body, "pointercancel", () => {
		start = null;
	});
}

/**
 * Move to the next view every `seconds`, holding while the card is pointed at
 * or has focus — nobody wants the note they are reading or typing into swapped
 * out from under them.
 */
export function enableViewRotation(
	cardEl: HTMLElement,
	component: Component,
	seconds: number,
	step: () => void,
): void {
	if (seconds <= 0) return;
	component.registerInterval(
		cardEl.win.setInterval(() => {
			if (!cardEl.isConnected) return;
			if (cardEl.matches(":hover") || cardEl.contains(cardEl.doc.activeElement)) return;
			step();
		}, seconds * 1000),
	);
}
