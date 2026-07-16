import {
	Component,
	debounce,
	Menu,
	setIcon,
	type TAbstractFile,
} from "obsidian";
import { confirmAction } from "./ui";
import { t } from "./i18n";
import type { HomeView } from "./view";
import {
	activeEmbedViewEditable,
	mountEmbedViewSwitcher,
	renderCardBody,
	watchedCardPath,
} from "./cards";
import {
	createVaultEventHub,
	liveCardShouldRedraw,
	type VaultEventHub,
	watchedCardReactsToKind,
} from "./cardevents";
import { CARD_TEMPLATES, cardFromTemplate, templateName } from "./templates";
import { CardSettingsModal } from "./editors";
import {
	activeCards,
	cloneCard,
	type DashboardCard,
	effectiveCardBorderWidth,
	effectiveCardOpacity,
	effectiveCardRadius,
	effectiveColumns,
	effectiveFitToPage,
	effectiveMaxWidth,
	effectiveRowHeight,
	removeCard,
	renderCards,
	resolveCardBlur,
	setCardPinned,
} from "./types";
import {
	applyCardPosition,
	applyCardPositionFitted,
	applyEdgeMerging,
	enableDragResize,
	ensureFreeform,
	ensureLayout,
	fitVerticalScale,
	type GridLayout,
	GRID_GAP,
	layoutHeight,
	placeFreeform,
	ROW_HEIGHT,
} from "./grid";

/** Renders the dashboard toolbar and the positioned grid of cards. In arrange
 * mode cards can be moved, resized, added, removed and re-targeted on the
 * snap-to-grid layout. */
export function renderDashboard(
	view: HomeView,
	container: HTMLElement,
	component: Component,
): void {
	const s = view.plugin.settings;
	const cards = renderCards(s);
	const columns = effectiveColumns(s);
	const rowHeight = effectiveRowHeight(s);

	// Seed placement for new/older cards on the reference grid, then convert to
	// the continuous free-form coordinates the board actually renders with.
	const seeded = ensureLayout(cards, columns);
	const freed = ensureFreeform(
		cards,
		columns,
		rowHeight || ROW_HEIGHT,
		GRID_GAP,
		effectiveMaxWidth(s),
	);
	if (seeded || freed) void view.plugin.saveData(s);

	renderToolbar(view, container);

	const grid = container.createDiv("hearth-grid");
	grid.toggleClass("is-arranging", view.arrangeMode);
	// Board-level defaults; per-card overrides are set in the render loop below.
	grid.style.setProperty("--card-opacity", String(effectiveCardOpacity(s)));
	// Board-wide corner radius (px). Every card reads this via CSS; the frost
	// mask in grid.ts reads the resolved value back off the grid so its rounding
	// matches. Merged-edge corners still flatten to 0 regardless (see styles.css).
	grid.style.setProperty("--hearth-card-radius", `${effectiveCardRadius(s)}px`);
	grid.style.setProperty("--card-border-width", `${effectiveCardBorderWidth(s)}px`);
	const fit = effectiveFitToPage(s);
	// In fit-to-page mode the board is locked to one screen, so leave the
	// min-height to CSS (which clips the overflow). Otherwise grow the board
	// to fit its cards.
	if (!fit) grid.style.minHeight = `${layoutHeight(cards) + GRID_GAP}px`;

	// An empty board is left blank — no placeholder text or icon. The Arrange
	// toolbar (with "Add card") is still available above.
	if (cards.length === 0) return;

	const commit = () => void view.plugin.saveData(s);

	// Shared vault-event fan-out for every card on this board (see
	// createVaultEventHub). Lives on the render component, torn down with it.
	const events = createVaultEventHub(view.app, (ref) => component.registerEvent(ref));

	// Shared layout state for the drag engine (magnetic alignment to siblings).
	const gridLayout: GridLayout = {
		cards,
		elements: new Map(),
	};

	for (const card of cards) {
		const el = grid.createDiv("hearth-card");
		gridLayout.elements.set(card, el);
		applyCardPosition(el, card);

		if (card.pinned) el.addClass("is-pinned");
		if (card.kind === "links" || card.kind === "commands") {
			el.addClass("is-tile-card");
		}
		if (card.accent) {
			el.style.setProperty("--card-accent", card.accent);
			el.addClass("has-accent");
		}
		if (card.background) el.style.setProperty("--card-bg", card.background);
		if (card.cardOpacity != null) {
			el.style.setProperty("--card-opacity", String(card.cardOpacity));
		}
		// Cards whose resolved blur is > 0 feed the shared frost layer (see
		// updateFrostLayers / the .hearth-frost note in styles.css). The value is
		// stashed on the element so the frost rebuild can group cards by blur
		// without re-reading settings, and blur-off cards never enter a layer.
		const cardBlur = resolveCardBlur(s, card);
		if (cardBlur > 0) {
			el.addClass("has-blur");
			el.dataset.blur = String(cardBlur);
		}

		const head = el.createDiv("hearth-card-head");
		if (view.arrangeMode) {
			renderCardControls(view, card, head, commit);
		} else {
			head.toggleClass("is-untitled", !(card.title ?? "").trim());
			head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });
		}

		const body = el.createDiv("hearth-card-body");
		if (card.background) body.addClass("has-bg");
		const redraw = mountCardBody(view, card, body, component, events);

		// A second-view switcher (embed cards only) sits in the header when the
		// card is titled, or floats over the card (hover-reveal) when it isn't.
		// Not shown while arranging, where the header holds the title editor.
		if (!view.arrangeMode) {
			mountEmbedViewSwitcher(view, card, el, head, redraw);
		}

		if (view.arrangeMode) {
			enableDragResize(view, el, grid, card, gridLayout, component, commit);
		}
	}

	// Sharpen touching corners between neighbouring cards so adjacent cards
	// read as one merged tile. Recomputed after every drag/resize commit and
	// on viewport resize (handled below) since card positions reflow.
	applyEdgeMerging(grid);

	// Recompute edge merging whenever the board reflows (pane resize, zoom,
	// dashboard switch) — fractional widths shift which edges touch.
	const remerge = () => applyEdgeMerging(grid);
	component.registerDomEvent(window, "resize", debounce(remerge, 120, true));

	// In fit-to-page mode the board is locked to one screen, so cards taller than
	// the board would spill below the fold. Proportionally squeeze the vertical
	// layout so everything fits, matching how the horizontal axis already scales
	// with the pane width (fx/fw are board-width fractions).
	//
	// This is purely visual — it never writes back to the stored geometry. An
	// earlier version clamped and persisted against the measured board height,
	// but on a PC start, plugin update or full sync the workspace restores panes
	// before they reach their final size. The board was briefly short, cards got
	// clamped to that too-small height, and the upward-shifted positions were
	// saved — permanently pushing the whole board up (and compounding, since the
	// true positions were overwritten). Re-fitting on layout changes without
	// persisting means a transient/too-small measurement can't corrupt anything:
	// once the pane reaches its real height the next call repositions every card
	// from its untouched stored geometry, so the board self-heals.
	if (fit) {
		const refit = () => {
			if (!grid.isConnected) return;
			// One shared scale keeps relative spacing intact, so cards never
			// overlap when the window is made short (clamping each card on its own
			// piled them at the top).
			const vScale = fitVerticalScale(cards, grid.clientHeight);
			const boardWidth = grid.clientWidth;
			for (const card of cards) {
				const el = gridLayout.elements.get(card);
				if (el) applyCardPositionFitted(el, card, vScale, boardWidth);
			}
			applyEdgeMerging(grid);
		};
		// Apply the fit synchronously on the next frame, before the browser
		// paints, so cards never flash at their unscaled (taller) positions first.
		// That unscaled first frame is what made every existing card visibly jump
		// when a new card was added: the board briefly rendered at full height and
		// then snapped back once the debounced observer squeezed it. Fitting up
		// front means the very first painted frame is already the final layout.
		window.requestAnimationFrame(refit);
		const observer = new ResizeObserver(debounce(refit, 60, true));
		observer.observe(grid);
		component.register(() => observer.disconnect());
	}
}

/** Render a card's body. Each (re)draw renders under a fresh child component so
 * markdown/iframe embeds are torn down and rebuilt cleanly without leaking the
 * previous render.
 *
 * Liveness is per kind:
 * - web cards keep the optional polling refresh (refreshSec);
 * - embed/daily cards redraw from vault events. A create/delete/rename of the
 *   tracked file always redraws (it flips between the content and the
 *   "missing file" state); for content edits (modify) read-only cards redraw
 *   while editable cards sync their textarea in place so the cursor is kept. */
function mountCardBody(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	parent: Component,
	events: VaultEventHub,
): () => void {
	let child: Component | null = null;
	const draw = () => {
		if (child) parent.removeChild(child);
		child = new Component();
		parent.addChild(child);
		body.empty();
		renderCardBody(view, card, body, child);
	};
	draw();

	if (card.kind === "web") {
		const every = card.refreshSec && card.refreshSec > 0 ? card.refreshSec : 0;
		// registerInterval ties the timer to the view's render lifecycle, so it
		// is cleared on the next full rebuild (and on view close).
		if (every) parent.registerInterval(window.setInterval(draw, every * 1000));
		return draw;
	}

	if (card.kind === "embed" || card.kind === "daily") {
		// Editable cards sync content edits in their textarea, so don't redraw on
		// modify (it would drop the cursor) — but still redraw on existence changes.
		// An embed can switch between a read-only and an editable view, so this is
		// evaluated per event against whichever view is currently shown.
		watchCardFile(view, card, events, draw, () => !watchedCardEditable(card));
		return draw;
	}

	// Data-driven cards derive their content from the vault as a whole (tasks,
	// counts, daily-note existence, query matches, edit timestamps), so redraw
	// them — debounced — whenever the vault or its metadata changes.
	if (LIVE_KINDS.has(card.kind)) {
		const redraw = debounce(draw, 400, true);
		events.subscribe((ev) => {
			// A folder-scoped tasks card reads nothing outside its folders, so
			// events that provably can't change its content are skipped instead
			// of redrawing (and instead of resetting the debounce timer).
			if (liveCardShouldRedraw(card, ev)) redraw();
		});
	}
	return draw;
}

/** Whether the card's currently-shown content is edited in place (so a modify
 * event should sync the textarea rather than redraw). For embeds this follows
 * the active view (primary or second); daily cards use their own flag. */
function watchedCardEditable(card: DashboardCard): boolean {
	if (card.kind === "embed") return activeEmbedViewEditable(card);
	return !!card.editable;
}

/** Card kinds whose content is derived from the whole vault and should refresh
 * live on vault/metadata changes. */
const LIVE_KINDS = new Set<DashboardCard["kind"]>([
	"tasks",
	"stats",
	"calendar",
	"search",
	"heatmap",
]);

/** Redraw an embed/daily card's body when the file it tracks changes on disk.
 * create/delete/rename always redraw; modify only when `redrawOnModify` (a
 * predicate, re-evaluated per event so an embed that switches between a
 * read-only and an editable view is handled correctly). */
function watchCardFile(
	view: HomeView,
	card: DashboardCard,
	events: VaultEventHub,
	draw: () => void,
	redrawOnModify: () => boolean,
): void {
	// Coalesce bursts of writes (e.g. an editor autosaving) into one redraw.
	const redraw = debounce(draw, 150, true);
	const affects = (file: TAbstractFile, oldPath?: string): boolean => {
		const path = watchedCardPath(view, card);
		return path != null && (file.path === path || oldPath === path);
	};
	events.subscribe((ev) => {
		// Tracked-file cards key off disk events only (see watchedCardReactsToKind:
		// a metadata reparse is ignored, a content edit is ignored while the card
		// is edited in place); then only the tracked file's own path redraws.
		if (!watchedCardReactsToKind(ev.kind, redrawOnModify())) return;
		if (affects(ev.file, ev.oldPath)) redraw();
	});
}

/** Save the current settings and rebuild the view (used after structural
 * changes like adding, removing or re-targeting a card). */
function persistAndRender(view: HomeView): void {
	void view.plugin.saveData(view.plugin.settings);
	view.render();
}

/** The editable card header shown in arrange mode: an inline title field plus
 * actions to open the card's settings and to remove the card. */
function renderCardControls(
	view: HomeView,
	card: DashboardCard,
	head: HTMLElement,
	commit: () => void,
): void {
	head.addClass("is-editing");

	const title = head.createEl("input", {
		cls: "hearth-card-title-input",
		attr: { type: "text", placeholder: "Title", spellcheck: "false" },
	});
	title.value = card.title ?? "";
	// Don't let typing/clicking in the field start a card drag.
	title.addEventListener("pointerdown", (e) => e.stopPropagation());
	title.addEventListener("input", () => {
		card.title = title.value;
	});
	title.addEventListener("change", commit);
	title.addEventListener("blur", commit);

	const actions = head.createDiv("hearth-card-actions");

	const settingsBtn = actions.createEl("button", {
		cls: "hearth-card-action",
		attr: { "aria-label": t().dashboard.cardSettings },
	});
	setIcon(settingsBtn, "settings-2");
	settingsBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
	settingsBtn.addEventListener("click", () => openCardSettings(view, card));

	const remove = actions.createEl("button", {
		cls: "hearth-card-action is-danger",
		attr: { "aria-label": t().dashboard.removeCard },
	});
	setIcon(remove, "trash-2");
	remove.addEventListener("pointerdown", (e) => e.stopPropagation());
	remove.addEventListener("click", () => {
		confirmAction(view.app, {
			title: t().dashboard.removeCardTitle,
			message: t().dashboard.removeCardMessage(
				card.title?.trim() || t().dashboard.thisCard,
			),
			confirmText: t().dashboard.removeCardConfirm,
			onConfirm: () => {
				removeCard(view.plugin.settings, card);
				persistAndRender(view);
			},
		});
	});
}

/** Open the full settings editor for a single card, driven entirely from the
 * board so nothing has to be configured in the plugin settings tab. */
function openCardSettings(view: HomeView, card: DashboardCard): void {
	const s = view.plugin.settings;
	new CardSettingsModal(view.app, card, {
		favorites: s.favorites,
		isPinned: s.pinnedCards.includes(card),
		setPinned: (pinned) => setCardPinned(s, card, pinned),
		save: () => void view.plugin.saveData(s),
		rerender: () => view.render(),
		remove: () => {
			removeCard(s, card);
			persistAndRender(view);
		},
		otherDashboards: s.dashboards
			.filter((d) => d.id !== s.activeDashboardId)
			.map((d) => ({ id: d.id, name: d.name })),
		copyToDashboard: (targetId) => {
			const target = s.dashboards.find((d) => d.id === targetId);
			if (!target) return;
			target.cards.push(cloneCard(card));
			void view.plugin.saveData(s);
		},
	}).open();
}

function renderToolbar(view: HomeView, container: HTMLElement): void {
	const bar = container.createDiv("hearth-toolbar");
	// Track arrange mode so the toolbar can switch between its compact and full controls.
	bar.toggleClass("is-arranging", view.arrangeMode);

	if (view.arrangeMode) {
		const add = bar.createEl("button", { cls: "hearth-tool-btn" });
		setIcon(add.createSpan("hearth-tool-icon"), "plus");
		add.createSpan({ cls: "hearth-tool-label", text: t().dashboard.addCard });
		add.setAttribute("aria-label", t().dashboard.addCardAria);
		add.addEventListener("click", (evt) => {
			const menu = new Menu();
			for (const template of CARD_TEMPLATES) {
				// Skip plugin-gated templates (e.g. Dataview) unless available.
				if (template.available && !template.available(view.app)) continue;
				menu.addItem((item) =>
					item
						.setTitle(templateName(template))
						.setIcon(template.icon)
						.onClick(() => {
							const s = view.plugin.settings;
							const card = cardFromTemplate(template);
							// Place the new card into a free slot in the current layout so
							// it never shifts the cards already on the board (placeFreeform).
							placeFreeform(
								card,
								renderCards(s),
								effectiveMaxWidth(s),
								effectiveColumns(s),
								GRID_GAP,
								effectiveRowHeight(s) || ROW_HEIGHT,
							);
							activeCards(s).push(card);
							persistAndRender(view);
						}),
				);
			}
			menu.showAtMouseEvent(evt);
		});

		// Toggle the per-card headers (title input + actions) off so each
		// card's full body is visible while arranging. Only available while
		// arranging; the headers come back automatically when arranging ends.
		const hideHdr = bar.createEl("button", { cls: "hearth-tool-btn" });
		hideHdr.toggleClass("is-active", view.hideHeaderInArrange);
		setIcon(
			hideHdr.createSpan("hearth-tool-icon"),
			view.hideHeaderInArrange ? "eye-off" : "eye",
		);
		hideHdr.createSpan({
			cls: "hearth-tool-label",
			text: view.hideHeaderInArrange
				? t().dashboard.showTitles
				: t().dashboard.hideTitles,
		});
		hideHdr.setAttribute(
			"aria-label",
			view.hideHeaderInArrange
				? t().dashboard.showCardHeaders
				: t().dashboard.hideCardHeaders,
		);
		hideHdr.addEventListener("click", () => {
			view.hideHeaderInArrange = !view.hideHeaderInArrange;
			view.render();
		});
	}

	const arrangeZone = bar.createDiv("hearth-arrange-zone");
	arrangeZone.toggleClass(
		"is-auto-hide",
		!view.arrangeMode &&
			view.plugin.settings.arrangeButtonVisibility === "hover",
	);
	const arrange = arrangeZone.createEl("button", { cls: "hearth-tool-btn" });
	arrange.toggleClass("is-active", view.arrangeMode);
	// Outside arrange mode keep it as a small, unobtrusive icon button; while
	// arranging, show the labelled "Done arranging" action.
	arrange.toggleClass("is-icon", !view.arrangeMode);
	setIcon(
		arrange.createSpan("hearth-tool-icon"),
		view.arrangeMode ? "check" : "move",
	);
	if (view.arrangeMode) {
		arrange.createSpan({
			cls: "hearth-tool-label",
			text: t().dashboard.doneArranging,
		});
	}
	arrange.setAttribute(
		"aria-label",
		view.arrangeMode ? t().dashboard.finishArranging : t().dashboard.moveResize,
	);
	arrange.addEventListener("click", () => {
		view.arrangeMode = !view.arrangeMode;
		view.render();
	});
}
