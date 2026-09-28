/**
 * Terminal mode's screen: everything around the board.
 *
 * Top to bottom, the way a text interface is laid out:
 *
 *   1 Home  2 Work  3 Vault  +                              F2 Arrange
 *   ◆ Obsidian                                        Sun 28 Sep 21:50
 *   Search: ___________________________________________  [ New note ]
 *   (the board)
 *   status line                                   dashboard · 12 cards
 *   F1Help F2Arrange F3Search F4Filter F5Refresh F6Sort F7Add …
 *
 * The tabs are the dashboard switcher (right-click one for its menu), the
 * search is Hearth's own search section in terminal dress, and the function
 * keys are both keys and buttons — on a phone they are the only way to reach
 * them. All of it is drawn as text lines (src/tui/draw.ts) except the search
 * field, which is a real input.
 */
import { type Component, type Menu, Platform } from "obsidian";
import { moment } from "../cardbodies";
import { openAddCard } from "../dashboard";
import { openDashboardSettings, showDashboardMenu } from "../dashboards";
import { createSearchBarButton } from "../header";
import { t } from "../i18n";
import { SearchSection } from "../search";
import {
	activeDashboard,
	type Dashboard,
	effectiveNewNoteButtonMode,
	effectiveShowNewNoteButton,
	effectiveShowSearch,
	effectiveShowTitle,
	effectiveTerminalFontSize,
	effectiveTerminalScheme,
	effectiveTitle,
	newDashboardId,
	renderCards,
	TERMINAL_SCHEMES,
} from "../types";
import { confirmAction } from "../ui";
import { HearthModal } from "../uidesign";
import type { HomeView } from "../view";
import { TuiBoard } from "./board";
import { drawLine, drawLines } from "./draw";
import { asciify, fit, spread, strWidth, type Line, type Seg } from "./text";

/** The root classes terminal mode puts on a view, so switching modes can take
 * every one of them off again. */
const SCHEME_CLASS_PREFIX = "hearth-tui-scheme-";

/** How long a status-line message stays before the line goes back to its
 * resting text. */
const MESSAGE_MS = 6000;

/** One function key: what it is called on the bar and what it does. */
interface FnKey {
	key: string;
	label: () => string;
	run: () => void;
}

/**
 * Draw the whole terminal-mode view into `root`. Called from
 * `HomeView.render` in place of the graphical build.
 */
export function renderTerminalView(view: HomeView, root: HTMLElement, component: Component): void {
	const s = view.plugin.settings;
	root.addClass("hearth-tui");
	for (const scheme of TERMINAL_SCHEMES) root.removeClass(`${SCHEME_CLASS_PREFIX}${scheme}`);
	root.addClass(`${SCHEME_CLASS_PREFIX}${effectiveTerminalScheme(s)}`);
	root.setCssProps({ "--tui-font-size": `${effectiveTerminalFontSize(s)}px` });

	const mobileOnly = Platform.isMobile && s.mobileSearchOnly;
	const scroll = root.createDiv("hearth-scroll hearth-tui-scroll");
	const screen = scroll.createDiv("hearth-tui-screen");

	const tabs = screen.createDiv("hearth-tui-tabs");
	const titleRow = screen.createDiv("hearth-tui-titlerow");
	let search: SearchSection | null = null;
	if (effectiveShowSearch(s)) search = renderSearch(view, screen, component);

	const toolbar = screen.createDiv("hearth-tui-toolbar");
	const dash = screen.createDiv("hearth-dashboard hearth-tui-dash");
	const bottom = scroll.createDiv("hearth-tui-bottom");
	const status = bottom.createDiv("hearth-tui-status");
	const fkeys = bottom.createDiv("hearth-tui-fkeys");

	let board: TuiBoard | null = null;
	if (!mobileOnly) {
		board = new TuiBoard(view, dash, component);
		board.render();
	}
	view.tuiBoard = board;

	const redrawChrome = () => {
		drawTabs(view, tabs);
		drawTitle(view, titleRow);
		drawToolbar(view, toolbar, board);
		drawStatus(view, status);
		drawFnKeys(fkeys, fnKeys(view, board, search));
	};
	redrawChrome();
	// The title row carries a clock and the status line a message that times
	// out; neither is worth a timer faster than a minute.
	component.registerInterval(window.setInterval(() => {
		drawTitle(view, titleRow);
		drawStatus(view, status);
	}, 30000));
	view.tuiSay = (message: string) => {
		view.tui.say(message);
		drawStatus(view, status);
	};

	const keys = fnKeys(view, board, search);
	component.registerDomEvent(root, "keydown", (evt: KeyboardEvent) => {
		if (onKey(view, evt, board, search, keys)) {
			evt.preventDefault();
			evt.stopPropagation();
			redrawChrome();
		}
	});
	// Clicking empty space on the screen gives the board the keyboard, so the
	// keys work without having to find a card first.
	component.registerDomEvent(scroll, "pointerdown", (evt: PointerEvent) => {
		if (evt.target === scroll || evt.target === screen) board?.focus();
	});
	if (board && !s.focusSearchOnOpen) window.requestAnimationFrame(() => board?.focus());
}

/** Take terminal mode's marks off a view root, for a render in the graphical
 * design. */
export function clearTerminalView(view: HomeView, root: HTMLElement): void {
	root.removeClass("hearth-tui");
	for (const scheme of TERMINAL_SCHEMES) root.removeClass(`${SCHEME_CLASS_PREFIX}${scheme}`);
	view.tuiBoard = null;
}

// ---- Tabs and title ---------------------------------------------------------

function drawTabs(view: HomeView, el: HTMLElement): void {
	const s = view.plugin.settings;
	el.empty();
	const cols = cellsAcross(el);
	const left: Line = [];
	s.dashboards.forEach((d, i) => {
		const active = d.id === s.activeDashboardId;
		const name = asciify(d.name?.trim() || String(i + 1));
		left.push({
			text: ` ${i + 1} ${name} `,
			style: active ? ["reverse", "bold"] : undefined,
			onClick: () => view.plugin.setActiveDashboard(d.id),
			onMenu: (evt) => showDashboardMenu(view, d, evt, (menu) => addMoveEntries(view, d, menu)),
			label: d.name,
		});
		left.push({ text: " " });
	});
	left.push({
		text: " + ",
		style: "dim",
		onClick: () => addDashboard(view),
		label: t().dashboards.newDashboard,
	});
	const arrange: Line = [
		{ text: "F2", style: "dim" },
		{
			text: view.arrangeMode ? ` ${t().tui.doneArranging} ` : ` ${t().tui.arrange} `,
			style: "header",
			onClick: () => toggleArrange(view),
		},
	];
	drawLine(el, spread(left, arrange, cols));
}

function addMoveEntries(view: HomeView, dash: Dashboard, menu: Menu): void {
	const s = view.plugin.settings;
	const i = s.dashboards.indexOf(dash);
	const move = (to: number) => {
		const [moved] = s.dashboards.splice(i, 1);
		s.dashboards.splice(to, 0, moved);
		void view.plugin.saveData(s);
		view.render();
	};
	menu.addItem((item) =>
		item.setTitle(t().tui.moveBoardLeft).setDisabled(i <= 0).onClick(() => move(i - 1)),
	);
	menu.addItem((item) =>
		item.setTitle(t().tui.moveBoardRight).setDisabled(i >= s.dashboards.length - 1).onClick(() => move(i + 1)),
	);
}

function addDashboard(view: HomeView): void {
	const s = view.plugin.settings;
	const dash: Dashboard = {
		id: newDashboardId(),
		name: t().dashboards.defaultName(s.dashboards.length + 1),
		cards: [],
	};
	s.dashboards.push(dash);
	s.activeDashboardId = dash.id;
	void view.plugin.saveData(s);
	view.render();
}

function drawTitle(view: HomeView, el: HTMLElement): void {
	const s = view.plugin.settings;
	el.empty();
	if (!effectiveShowTitle(s)) {
		el.hide();
		return;
	}
	el.show();
	const cols = cellsAcross(el);
	const now = moment();
	const left: Line = [
		{ text: "◆ ", style: ["accent", "bold"] },
		{ text: asciify(effectiveTitle(s)), style: "bold" },
	];
	const right: Line = [{ text: now.format("ddd D MMM  HH:mm"), style: "dim" }];
	drawLine(el, spread(left, right, cols));
}

// ---- Search -----------------------------------------------------------------

function renderSearch(view: HomeView, parent: HTMLElement, component: Component): SearchSection {
	const s = view.plugin.settings;
	const search = new SearchSection(view);
	const wrap = parent.createDiv("hearth-search-wrap hearth-tui-searchwrap");
	const col = wrap.createDiv("hearth-search-col");
	const row = col.createDiv("hearth-search hearth-tui-searchrow");
	row.createSpan({ cls: "hearth-tui-searchlabel", text: t().tui.searchLabel });
	const bar = search.renderBar(row);
	if (effectiveShowNewNoteButton(s)) {
		row.append(createSearchBarButton(view, bar, effectiveNewNoteButtonMode(s)));
	}
	search.renderResultsAndFilters(col, col, component);
	return search;
}

function focusSearch(root: HTMLElement): boolean {
	const input = root.querySelector<HTMLInputElement>(".hearth-tui-searchwrap .hearth-search-input");
	if (!input) return false;
	input.focus();
	input.select();
	return true;
}

// ---- Toolbar ------------------------------------------------------------------

function drawToolbar(view: HomeView, el: HTMLElement, board: TuiBoard | null): void {
	el.empty();
	if (!view.arrangeMode) {
		el.hide();
		return;
	}
	el.show();
	const cols = cellsAcross(el);
	const button = (text: string, run: () => void): Seg => ({ text: `[${text}]`, style: "accent", onClick: run });
	const line: Line = [
		{ text: ` ${t().tui.arranging} `, style: ["header", "bold"] },
		{ text: " " },
		button(t().dashboard.addCard, () => openAddCard(view, false, (card) => (view.tui.focus = card.id))),
		{ text: " " },
		button(t().dashboard.dashboardSettings, () => openDashboardSettings(view, activeDashboard(view.plugin.settings))),
	];
	if (!view.isNarrow() || view.phonePreview) {
		line.push({ text: " " });
		line.push(
			button(view.phonePreview ? t().dashboard.phonePreviewOff : t().dashboard.phonePreview, () => {
				view.phonePreview = !view.phonePreview;
				view.render();
			}),
		);
	}
	line.push({ text: " " }, button(t().tui.doneArranging, () => toggleArrange(view)));
	if (board?.hasCards()) line.push({ text: `  ${t().tui.arrangeHint}`, style: "dim" });
	drawLine(el, fit(line, cols));
}

function toggleArrange(view: HomeView): void {
	view.arrangeMode = !view.arrangeMode;
	if (!view.arrangeMode) view.phonePreview = false;
	view.tui.say(view.arrangeMode ? t().tui.arrangeOn : t().tui.arrangeOff);
	view.render();
}

// ---- Status line and function keys ------------------------------------------

function drawStatus(view: HomeView, el: HTMLElement): void {
	const s = view.plugin.settings;
	el.empty();
	const cols = cellsAcross(el);
	const fresh = view.tui.message && Date.now() - view.tui.messageAt < MESSAGE_MS;
	const left: Line = [{ text: fresh ? view.tui.message : t().tui.restingHint, style: fresh ? undefined : "dim" }];
	const dash = activeDashboard(s);
	const n = renderCards(s).length;
	const right: Line = [
		{ text: ` ${asciify(dash.name)} · ${t().tui.cardCount(n)}`, style: "dim" },
		...(view.arrangeMode ? [{ text: " ", style: undefined }, { text: ` ${t().tui.arranging} `, style: "header" as const }] : []),
	];
	drawLine(el, spread(left, right, cols));
}

function drawFnKeys(el: HTMLElement, keys: FnKey[]): void {
	el.empty();
	for (const k of keys) {
		const btn = el.createSpan({ cls: "hearth-tui-fkey", attr: { role: "button", tabindex: "-1" } });
		btn.createSpan({ cls: "hearth-tui-fkey-n", text: k.key });
		btn.createSpan({ cls: "hearth-tui-fkey-label", text: k.label() });
		btn.addEventListener("click", (evt) => {
			evt.preventDefault();
			k.run();
		});
	}
}

function fnKeys(view: HomeView, board: TuiBoard | null, search: SearchSection | null): FnKey[] {
	const say = (m: string) => view.tuiSay?.(m);
	const keys: FnKey[] = [
		{ key: "F1", label: () => t().tui.fn.help, run: () => openHelp(view) },
		{ key: "F2", label: () => t().tui.fn.arrange, run: () => toggleArrange(view) },
		{
			key: "F3",
			label: () => t().tui.fn.search,
			run: () => {
				if (!search || !focusSearch(view.contentEl)) say(t().tui.noSearch);
			},
		},
		{
			key: "F4",
			label: () => t().tui.fn.filter,
			run: () => {
				if (!board?.cardKey("f")) say(t().tui.noFilter);
			},
		},
		{
			key: "F5",
			label: () => t().tui.fn.refresh,
			run: () => say(t().tui.refreshed(board?.refreshAll() ?? 0)),
		},
		{
			key: "F6",
			label: () => t().tui.fn.sort,
			run: () => {
				if (!board?.cardKey("s")) say(t().tui.noSort);
			},
		},
		{ key: "F7", label: () => t().tui.fn.add, run: () => openAddCard(view, false, (card) => (view.tui.focus = card.id)) },
		{ key: "F8", label: () => t().tui.fn.board, run: () => openDashboardSettings(view, activeDashboard(view.plugin.settings)) },
		{ key: "F9", label: () => t().tui.fn.scheme, run: () => cycleScheme(view) },
		{ key: "F10", label: () => t().tui.fn.quit, run: () => leaveTerminal(view) },
	];
	return keys;
}

function cycleScheme(view: HomeView): void {
	const s = view.plugin.settings;
	const i = TERMINAL_SCHEMES.indexOf(effectiveTerminalScheme(s));
	const next = TERMINAL_SCHEMES[(i + 1) % TERMINAL_SCHEMES.length];
	s.terminalScheme = next === "theme" ? undefined : next;
	view.tui.say(t().tui.schemeSet(t().tui.schemes[next]));
	void view.plugin.saveSettings();
}

function leaveTerminal(view: HomeView): void {
	confirmAction(view.app, {
		title: t().tui.quitTitle,
		message: t().tui.quitMessage,
		confirmText: t().tui.quitConfirm,
		onConfirm: () => {
			view.plugin.settings.terminalMode = undefined;
			void view.plugin.saveSettings();
		},
	});
}

// ---- Keys ---------------------------------------------------------------------

/** Whether a key event comes from somewhere text is being typed. */
function typingIn(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function onKey(
	view: HomeView,
	evt: KeyboardEvent,
	board: TuiBoard | null,
	search: SearchSection | null,
	keys: FnKey[],
): boolean {
	const fn = /^F(\d{1,2})$/.exec(evt.key);
	if (fn && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
		const k = keys.find((x) => x.key === evt.key);
		if (k) {
			k.run();
			return true;
		}
		return false;
	}
	if (typingIn(evt.target)) {
		// Escape leaves a field for the board, the way it leaves insert mode.
		if (evt.key === "Escape" && !(evt.target instanceof HTMLElement && evt.target.closest(".modal"))) {
			(evt.target as HTMLElement).blur();
			board?.focus();
			return true;
		}
		return false;
	}
	// A graphical card body keeps its own keys.
	if (evt.target instanceof HTMLElement && evt.target.closest(".hearth-tui-body.is-graphical")) return false;

	if (board?.handleKey(evt)) return true;
	if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;

	const s = view.plugin.settings;
	switch (evt.key) {
		case "?":
		case "h":
			openHelp(view);
			return true;
		case "/":
			if (search) return focusSearch(view.contentEl);
			return false;
		case "a":
			toggleArrange(view);
			return true;
		case "n":
			openAddCard(view, false, (card) => (view.tui.focus = card.id));
			return true;
		case "r":
			view.tuiSay?.(t().tui.refreshed(board?.refreshAll() ?? 0));
			return true;
		case "t":
			cycleScheme(view);
			return true;
	}
	if (/^[1-9]$/.test(evt.key)) {
		const d = s.dashboards[Number(evt.key) - 1];
		if (d) {
			view.plugin.setActiveDashboard(d.id);
			return true;
		}
	}
	return false;
}

// ---- Help -----------------------------------------------------------------------

class TuiHelpModal extends HearthModal {
	onOpen(): void {
		this.modalEl.addClass("hearth-tui-help");
		this.titleEl.setText(t().tui.helpTitle);
		const h = t().tui.help;
		const rows: [string, string][] = [
			["Tab / Shift+Tab", h.nextCard],
			["↑ ↓", h.moveSelection],
			["← →", h.moveSideways],
			["Enter", h.open],
			["Space", h.toggle],
			["m  ≡", h.menu],
			["z", h.zoom],
			["o", h.detail],
			["e", h.settings],
			["Esc", h.escape],
			["/  F3", h.search],
			["1 – 9", h.boards],
			["a  F2", h.arrange],
			["n  F7", h.add],
			["f  F4", h.filter],
			["s  F6", h.sort],
			["r  F5", h.refresh],
			["F8", h.board],
			["t  F9", h.scheme],
			["?  F1", h.help],
			["F10", h.quit],
		];
		const keyW = Math.max(...rows.map(([k]) => strWidth(k))) + 3;
		const lines: Line[] = rows.map(([k, d]) => [
			{ text: k.padEnd(keyW, " "), style: "accent" },
			{ text: d },
		]);
		lines.push([], [{ text: h.arrangeNote, style: "dim" }]);
		const body = this.contentEl.createDiv("hearth-tui-helpbody");
		drawLines(body, lines);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function openHelp(view: HomeView): void {
	new TuiHelpModal(view.app).open();
}

// ---- Helpers ------------------------------------------------------------------

/** How many terminal cells fit across `el`. */
function cellsAcross(el: HTMLElement): number {
	const probe = el.createSpan({ cls: "hearth-tui-probe-inline", text: "M".repeat(32) });
	const w = probe.getBoundingClientRect().width / 32 || 8;
	probe.remove();
	return Math.max(20, Math.floor((el.clientWidth - 1) / w));
}
