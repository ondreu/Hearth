import { setIcon, type Component, type WorkspaceLeaf } from "obsidian";
import { emptyState } from "./cardbodies";
import { t } from "./i18n";
import {
	createHostedLeaf,
	FULL_VIEW_SCOPE,
	isDocumentViewType,
	isViewTypeHostable,
	teardownHostedLeaf,
} from "./leafview";
import {
	activeDashboard,
	type Dashboard,
	effectiveArrangeButtonVisibility,
	effectiveCardBlur,
	effectiveCardBorderWidth,
	effectiveCardOpacity,
	effectiveCardRadius,
	isPluginBoard,
	pluginBoardKeepsMounted,
	pluginBoardViewType,
} from "./types";
import { openDashboardSettings } from "./dashboards";
import type { HomeView } from "./view";

/**
 * How many hosted views may stay alive at once across every plugin board in one
 * Hearth view.
 *
 * Keeping a view mounted is what makes switching back to a board instant, and
 * is the whole reason a plugin board beats a tab of its own. But a mounted view
 * is a plugin still running — timers, observers, a React tree — so the number
 * kept is capped rather than unbounded: the boards you actually move between
 * stay warm, and a vault with a dozen plugin boards can't quietly accumulate a
 * dozen live plugins. Least-recently-shown boards are unmounted first.
 */
export const PLUGIN_BOARD_KEEP_ALIVE_MAX = 3;

/** One hosted view, alive across renders and (when the board asks for it)
 * across dashboard switches. */
interface HostedBoard {
	/** Identity of what is hosted — see {@link boardKey}. A change to any part
	 * of it means a different view, so the old one is torn down. */
	key: string;
	/** The dashboard this belongs to, so pruning can re-read its current
	 * settings (`keepMounted` can be toggled while it is mounted). */
	dashId: string;
	/** The element the leaf lives in. Re-parented into each render's stage; it
	 * is deliberately *not* rebuilt, because rebuilding it is what would reload
	 * the plugin. */
	host: HTMLElement;
	leaf: WorkspaceLeaf;
	/** Bumped every time the board is shown, for least-recently-shown eviction. */
	used: number;
	/** Whether Obsidian is currently pointing at this hosted leaf as the active
	 * one — only ever true for a board with `focusable` on. Kept in step by the
	 * workspace subscription below rather than read back off the workspace, so
	 * the hand-back never fires over a pane the user has since moved to. */
	holdsActiveLeaf: boolean;
	/** Drops that subscription. */
	unwatch: () => void;
}

/**
 * The live hosted views, per Hearth view.
 *
 * Deliberately *not* tied to the per-render `Component` every other part of the
 * board hangs off: that component is destroyed on every re-render, and a live
 * refresh or a settings save would then reload the hosted plugin — the exact
 * churn this module exists to avoid. Lifetime is managed by
 * {@link prunePluginBoards} (called on every render) and
 * {@link releasePluginBoards} (called when the view closes), and the WeakMap
 * key means a view that is dropped without either takes its entry with it.
 */
const hosted = new WeakMap<HomeView, Map<string, HostedBoard>>();

/** Monotonic clock for least-recently-shown ordering. */
let useCounter = 0;

function cacheFor(view: HomeView): Map<string, HostedBoard> {
	let map = hosted.get(view);
	if (!map) {
		map = new Map();
		hosted.set(view, map);
	}
	return map;
}

/**
 * What identifies a hosted view: the board, the view type and the file. Two
 * boards on the same view type are still two hosted views (they can be pointed
 * at different files, and each keeps its own scroll position and state), and
 * re-pointing a board at another view or file has to build a new one.
 *
 * `hideHeader` is *not* part of it: that is a class on the host, applied on
 * every mount, so toggling it must not throw the view away.
 */
function boardKey(dash: Dashboard, type: string, file: string): string {
	return JSON.stringify([dash.id, type, file]);
}

/** The key `dash` would mount under right now, from its current settings. */
function currentKey(dash: Dashboard): string {
	return boardKey(dash, pluginBoardViewType(dash), dash.pluginView?.file?.trim() ?? "");
}

/**
 * Give the active leaf back to Hearth if the hosted view still holds it, so a
 * board's `focusable` opt-in can never outlive the board. Without this, closing
 * or switching away from a focused plugin board would leave Obsidian pointing
 * at a leaf that no longer exists — and the next file opened would go nowhere.
 */
function releaseActiveLeaf(view: HomeView, entry: HostedBoard): void {
	if (!entry.holdsActiveLeaf) return;
	entry.holdsActiveLeaf = false;
	try {
		view.app.workspace.setActiveLeaf(view.leaf, { focus: false });
	} catch {
		/* the workspace moved on; nothing to hand back */
	}
}

/** Unmount one hosted view and forget it. */
function drop(view: HomeView, map: Map<string, HostedBoard>, entry: HostedBoard): void {
	map.delete(entry.key);
	releaseActiveLeaf(view, entry);
	entry.unwatch();
	teardownHostedLeaf(entry.leaf);
	entry.host.remove();
	entry.host.empty();
}

/**
 * Unmount every hosted view this Hearth view is keeping alive. Called when the
 * view closes (and so when the plugin unloads, which closes its views), which
 * is the only point at which a kept-alive board is guaranteed to have no reason
 * left to exist.
 */
export function releasePluginBoards(view: HomeView): void {
	const map = hosted.get(view);
	if (!map) return;
	for (const entry of [...map.values()]) drop(view, map, entry);
	hosted.delete(view);
}

/**
 * Bring the set of live hosted views back in line with what the settings now
 * say, keeping the board named by `activeKey` (when there is one).
 *
 * Called from *every* render, including renders of a cards board — that is what
 * unmounts a plugin board switched away from with `keepMounted` off, and what
 * collects a board that has since been turned back into a cards board or
 * re-pointed at another view.
 *
 * Dropped, in order: the active board never; then anything whose board no
 * longer wants to be kept alive (its `keepMounted` is off, it is no longer a
 * plugin board, or it has been deleted); then, while more than
 * {@link PLUGIN_BOARD_KEEP_ALIVE_MAX} remain, the least recently shown.
 */
export function prunePluginBoards(view: HomeView, activeKey: string | null): void {
	const map = hosted.get(view);
	if (!map || map.size === 0) return;
	const boards = view.plugin.settings.dashboards;

	for (const entry of [...map.values()]) {
		if (entry.key === activeKey) continue;
		const dash = boards.find((d) => d.id === entry.dashId);
		if (!dash || !isPluginBoard(dash) || !pluginBoardKeepsMounted(dash)) {
			drop(view, map, entry);
			continue;
		}
		// The board still wants to stay warm, but not *this* view: it has been
		// re-pointed at another type or file since. Nothing can ever reach this
		// entry again, so keeping it alive would leave a plugin running for a
		// board that no longer shows it.
		if (entry.key !== currentKey(dash)) drop(view, map, entry);
	}

	// Least recently shown first, and never the board on screen.
	const spare = [...map.values()]
		.filter((e) => e.key !== activeKey)
		.sort((a, b) => a.used - b.used);
	while (map.size > PLUGIN_BOARD_KEEP_ALIVE_MAX) {
		const victim = spare.shift();
		if (!victim) break;
		drop(view, map, victim);
	}
}

/**
 * The hosted view for this board — reused when one is already alive, built when
 * it isn't. Returns null when the leaf could not be constructed at all, which
 * `createHostedLeaf` reports rather than throwing.
 */
function acquire(
	view: HomeView,
	dash: Dashboard,
	type: string,
	file: string,
): HostedBoard | null {
	const map = cacheFor(view);
	const key = boardKey(dash, type, file);
	const existing = map.get(key);
	if (existing) {
		existing.used = ++useCounter;
		return existing;
	}

	const host = createDiv("hearth-leaf-host hearth-plugin-board-host");
	const leaf = createHostedLeaf(view.app, type, host, file || undefined);
	if (!leaf) {
		host.empty();
		return null;
	}
	const entry: HostedBoard = {
		key,
		dashId: dash.id,
		host,
		leaf,
		used: ++useCounter,
		holdsActiveLeaf: false,
		unwatch: () => {},
	};
	// Follow the active leaf for as long as this one exists, so the hand-back in
	// releaseActiveLeaf knows whether there is anything to hand back. Tied to the
	// entry rather than to a render component: a component dies on every
	// re-render, and a gap in this subscription is exactly when the flag would go
	// stale and the board would later steal focus from an unrelated pane.
	const ref = view.app.workspace.on("active-leaf-change", (active) => {
		entry.holdsActiveLeaf = active === leaf;
	});
	entry.unwatch = () => view.app.workspace.offref(ref);
	map.set(key, entry);
	return entry;
}

/**
 * Let the hosted view become the active leaf while the pointer or keyboard is
 * inside it, so the plugin's own commands and hotkeys find it (see
 * {@link PluginBoardConfig.focusable}). Registered on the render component, so
 * turning the option off drops the listeners on the next render even though the
 * host itself is reused.
 */
function trackFocus(view: HomeView, entry: HostedBoard, component: Component): void {
	const leaf = entry.leaf;
	const claim = () => {
		try {
			view.app.workspace.setActiveLeaf(leaf, { focus: false });
			entry.holdsActiveLeaf = true;
		} catch {
			/* the workspace refused the detached leaf; the board still works */
		}
	};
	entry.host.addEventListener("focusin", claim);
	entry.host.addEventListener("pointerdown", claim);
	// Only the listeners come off here. The active leaf is *not* handed back:
	// this runs on every re-render — a settings save, a live vault refresh — and
	// taking focus off the view mid-edit each time is precisely the churn a kept-
	// alive board exists to avoid. The hand-back belongs to `drop`, which runs
	// when the hosted view actually goes away.
	component.register(() => {
		entry.host.removeEventListener("focusin", claim);
		entry.host.removeEventListener("pointerdown", claim);
	});
}

/**
 * The plugin board's one action: a quiet gear onto the dashboard settings,
 * placed at the right-hand end of the *switcher* row.
 *
 * A plugin board has nothing to arrange, so the cards toolbar (add card, phone
 * preview, hide titles, done arranging) has no meaning here — but the settings
 * modal it also carries is the only in-board way to re-point the board at
 * another view, so that one button stays. It goes on the row that is already
 * there rather than in a toolbar row of its own: the whole point of the board is
 * that the hosted view gets the space, and a second row of chrome to hold one
 * icon is exactly the space it should not be spending.
 *
 * It keeps the arrange button's zone, classes and auto-hide setting, so it fades
 * on hover in the same way as the control it stands in for.
 */
export function renderPluginBoardActions(view: HomeView, switcherZone: HTMLElement): void {
	const zone = switcherZone.createDiv("hearth-arrange-zone hearth-plugin-actions");
	zone.toggleClass(
		"is-auto-hide",
		effectiveArrangeButtonVisibility(view.plugin.settings) === "hover",
	);
	const btn = zone.createEl("button", { cls: "hearth-tool-btn is-icon" });
	setIcon(btn.createSpan("hearth-tool-icon"), "settings-2");
	btn.setAttribute("aria-label", t().dashboard.dashboardSettingsAria);
	btn.addEventListener("click", () =>
		openDashboardSettings(view, activeDashboard(view.plugin.settings)),
	);
}

/**
 * Render the active dashboard as a single hosted plugin view filling the board.
 *
 * The switcher, header, banner and background above are rendered by the view as
 * they are for any other board — that is the point of the mode: the hosted view
 * is *a dashboard*, one click from every other one, rather than a tab you have
 * to find your way back from.
 *
 * Every failure has a spoken empty state rather than a blank board: no view
 * chosen yet, a view whose plugin is currently disabled or uninstalled, a
 * document surface with no file to open, and a leaf that could not be built.
 */
export function renderPluginBoard(
	view: HomeView,
	container: HTMLElement,
	component: Component,
): void {
	const s = view.plugin.settings;
	const dash = activeDashboard(s);
	const stage = container.createDiv("hearth-plugin-board");
	// The hosted view sits on one big card surface rather than a grid of small
	// ones, so it reads as part of the board and the wallpaper still shows
	// around and (at less than full opacity) through it. Same four values the
	// Style tab drives for cards, off the same resolvers, so a board styled once
	// looks the same whichever type it is.
	//
	// The blur is a plain backdrop-filter here rather than the grid's shared
	// frost layer: that layer exists to stop seams where merged cards touch, and
	// a single surface has none. `effectiveCardBlur` still reports 0 below the
	// `reduced` performance tier, so the tier switches it off exactly as it does
	// for cards.
	stage.style.setProperty("--card-opacity", String(effectiveCardOpacity(s)));
	stage.style.setProperty("--hearth-card-radius", `${effectiveCardRadius(s)}px`);
	stage.style.setProperty("--card-border-width", `${effectiveCardBorderWidth(s)}px`);
	const blur = effectiveCardBlur(s);
	stage.toggleClass("has-blur", blur > 0);
	if (blur > 0) stage.style.setProperty("--hearth-plugin-blur", `${blur}px`);
	const fail = (text: string) => {
		emptyState(stage, "layout-panel-left", text);
		prunePluginBoards(view, null);
	};

	const type = pluginBoardViewType(dash);
	if (!type) return fail(t().cards.empty.boardPickView);
	if (!isViewTypeHostable(view.app, type, FULL_VIEW_SCOPE)) {
		return fail(t().cards.empty.leafViewMissing);
	}
	const file = dash.pluginView?.file?.trim() ?? "";
	// Obsidian's own document surfaces render nothing without a document; the
	// board offers them precisely so a note or a PDF can *be* the board, so say
	// what is missing rather than mounting an empty editor.
	if (isDocumentViewType(type) && !file) return fail(t().cards.empty.boardNeedsFile);

	const entry = acquire(view, dash, type, file);
	if (!entry) return fail(t().cards.empty.leafViewMissing);

	entry.host.toggleClass("hearth-leaf-hide-header", !!dash.pluginView?.hideHeader);
	stage.appendChild(entry.host);
	if (dash.pluginView?.focusable) trackFocus(view, entry, component);
	// A view re-parented from the previous render (or from nowhere, while it was
	// kept alive off screen) has been measuring a detached element. Nudge it once
	// the browser has laid the board out so views that size themselves off their
	// container — canvases, virtualised lists — pick up the real size.
	const frame = window.requestAnimationFrame(() => {
		try {
			entry.leaf.view.onResize();
		} catch {
			/* the view doesn't care about resizes, or is already gone */
		}
	});
	component.register(() => window.cancelAnimationFrame(frame));

	prunePluginBoards(view, entry.key);
}
