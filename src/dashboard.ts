import {
	Component,
	debounce,
	setIcon,
	type TAbstractFile,
} from "obsidian";
import { emptyState, resetCardBody } from "./cardbodies";
import { deferRedrawWhileTyping } from "./cardfocus";
import { gateCardMotionOnVisibility } from "./motion";
import { confirmAction } from "./ui";
import { t } from "./i18n";
import type { HomeView } from "./view";
import {
	createVaultEventHub,
	type VaultEvent,
	type VaultEventHub,
	watchedCardReactsToKind,
} from "./cardevents";
import { cardClasses, cardDefinition, cardFromTemplate, cloneCard } from "./cards";
import { openCardPicker } from "./cardpicker";
import { openGallery } from "./gallerybrowse";
import { galleryConfigured } from "./gallery";
import { openDashboardSettings } from "./dashboards";
import { moveStacked, stackedCards, stackedHeight } from "./narrow";
import { CardSettingsModal } from "./editors";
import {
	activeCards,
	activeDashboard,
	type DashboardCard,
	effectiveArrangeButtonVisibility,
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
	resolveCardBorderWidth,
	setCardPinned,
	timersAllowed,
} from "./types";
import {
	applyCardPosition,
	applyEdgeMerging,
	applyFitLayout,
	enableDragResize,
	enableStackedResize,
	ensureFreeform,
	ensureLayout,
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
	// A narrow board reflows into one full-width column (see src/narrow.ts).
	// Everything the stacked layout does is render-only: `stackedCards` reads
	// the free-form geometry to derive an order and never writes to it, so a
	// board opened on a phone comes back to the desktop exactly as it was left.
	const stacked = view.isStacked();
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
	grid.toggleClass("is-stacked", stacked);
	// Board-level defaults; per-card overrides are set in the render loop below.
	grid.style.setProperty("--card-opacity", String(effectiveCardOpacity(s)));
	// Board-wide corner radius (px). Every card reads this via CSS; the frost
	// mask in grid.ts reads the resolved value back off the grid so its rounding
	// matches. Merged-edge corners still flatten to 0 regardless (see styles.css).
	grid.style.setProperty("--hearth-card-radius", `${effectiveCardRadius(s)}px`);
	grid.style.setProperty("--card-border-width", `${effectiveCardBorderWidth(s)}px`);
	// Fit-to-page locks the board to one screen, which a stacked board — a list
	// that is meant to run past the bottom — cannot be; the view drops the class
	// for the same reason, so read it as off here too.
	const fit = effectiveFitToPage(s) && !stacked;
	// In fit-to-page mode the board is locked to one screen, so leave the
	// min-height to CSS (which clips the overflow). Otherwise grow the board
	// to fit its cards — except when stacked, where the cards are in normal flow
	// and the column is already exactly as tall as they make it.
	if (!fit && !stacked) grid.style.minHeight = `${layoutHeight(cards) + GRID_GAP}px`;

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

	for (const card of stacked ? stackedCards(cards) : cards) {
		// A card asked to collapse gets a title row and nothing else until someone
		// taps it — which is the whole point of the option: an expensive card
		// costs one row on a phone instead of a screenful, and its body is never
		// built at all unless it is opened. Only in the stacked layout, where
		// vertical space is the scarce thing.
		const collapsed = stacked && card.mobile?.collapsed === true;

		const el = grid.createDiv("hearth-card");
		gridLayout.elements.set(card, el);
		// Stacked cards are in normal flow: full width from CSS, and only as tall
		// as the stacked layout says — bar a collapsed one, which is as tall as
		// its own header until it is opened. Everywhere else they are placed
		// absolutely from their stored geometry.
		if (!stacked) applyCardPosition(el, card);
		else if (!collapsed) el.style.height = `${stackedHeight(card)}px`;

		if (card.pinned) el.addClass("is-pinned");
		const kindClasses = cardClasses(card);
		if (kindClasses.length) el.addClass(...kindClasses);
		if (card.accent) {
			el.style.setProperty("--card-accent", card.accent);
			el.addClass("has-accent");
		}
		if (card.background) el.style.setProperty("--card-bg", card.background);
		if (card.cardOpacity != null) {
			el.style.setProperty("--card-opacity", String(card.cardOpacity));
		}
		// Per-card border width overrides the board-level variable set on the grid.
		if (card.cardBorderWidth != null) {
			el.style.setProperty(
				"--card-border-width",
				`${resolveCardBorderWidth(s, card)}px`,
			);
		}
		// Cards whose resolved blur is > 0 feed the shared frost layer (see
		// updateFrostLayers / the .hearth-frost note in styles.css). The value is
		// stashed on the element so the frost rebuild can group cards by blur
		// without re-reading settings, and blur-off cards never enter a layer.
		// A seamless card paints no surface of its own, so frosting the wallpaper
		// behind it would leave a blurred rectangle floating on the board with no
		// card on it. Such a card never joins a frost layer.
		const cardBlur = kindClasses.includes("is-seamless") ? 0 : resolveCardBlur(s, card);
		if (cardBlur > 0) {
			el.addClass("has-blur");
			el.dataset.blur = String(cardBlur);
		}

		const head = el.createDiv("hearth-card-head");
		if (view.arrangeMode) {
			renderCardControls(view, card, head, commit, stacked ? cards : null);
		} else {
			const named = (card.title ?? "").trim();
			head.toggleClass("is-untitled", !named);
			const titleEl = head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });
			// An untitled card is headerless on a normal board, so collapsing one
			// would leave a blank bar with nothing to tap and nothing to read.
			// Fall back to the card kind's own name — "Tasks", "Calendar".
			if (collapsed && !named) {
				head.removeClass("is-untitled");
				titleEl.setText(t().editors.kinds[card.kind]);
			}
		}

		const body = el.createDiv("hearth-card-body");
		if (card.background) body.addClass("has-bg");

		// One mount for both paths, so a card expanded on a phone is built exactly
		// as it would have been had it never been collapsed — its header extras
		// included.
		const mount = () => {
			const redraw = mountCardBody(view, card, body, component, events);
			// Post-render header/floating extras (the embed card's second-view
			// switcher). Not shown while arranging, where the header holds the title
			// editor.
			if (!view.arrangeMode) {
				cardDefinition(card).mountExtras?.(view, card, el, head, redraw);
			}
		};

		if (collapsed) {
			el.addClass("is-collapsed");
			enableCollapseToggle(view, card, el, head, mount);
		} else {
			mount();
		}

		// Dragging and resizing are how the free-form layout is edited. A stacked
		// card owns only its height — width is the column's and position is the
		// order — so it gets a bottom-edge grip for that one dimension, and the
		// order is moved from the card header. A collapsed card is as tall as its
		// own title row and has no height to set.
		if (view.arrangeMode && !stacked) {
			enableDragResize(view, el, grid, card, gridLayout, component, commit);
		} else if (view.arrangeMode) {
			// A shield over the card body, so arranging a stacked board can't tick a
			// task or follow a link by accident — the same protection the free-form
			// board gets from its drag overlay. Deliberately NOT that overlay: it
			// carries `touch-action: none` to claim the drag gesture, which on a
			// column that has to be scrolled with a finger would make the board
			// unscrollable. This one lets a vertical scroll through and swallows
			// everything else.
			el.createDiv("hearth-card-shield");
			if (!collapsed) enableStackedResize(el, card, component, () => persistAndRender(view));
		}
	}

	// Hold each card's animation while that card is off screen — below the fold
	// on a scrolling board, or clipped away by a fit-to-page board. One observer
	// for the whole grid; see src/motion.ts.
	gateCardMotionOnVisibility(view, grid, component);

	// Sharpen touching corners between neighbouring cards so adjacent cards
	// read as one merged tile. Recomputed after every drag/resize commit and
	// on viewport resize (handled below) since card positions reflow.
	//
	// Skipped when stacked: edge merging is about cards that share an edge, and
	// a single spaced column has no two cards touching.
	if (!stacked) {
		applyEdgeMerging(grid);

		// Recompute edge merging whenever the board reflows (pane resize, zoom,
		// dashboard switch) — fractional widths shift which edges touch.
		const remerge = () => applyEdgeMerging(grid);
		component.registerDomEvent(window, "resize", debounce(remerge, 120, true));
	}

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
			// piled them at the top). Ending a drag re-runs the very same helper, so
			// an arranged card is never left in a different space from its neighbours.
			applyFitLayout(grid, gridLayout);
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
	const def = cardDefinition(card);
	let child: Component | null = null;
	// The classes the body carries before any card has drawn into it — its own,
	// plus `has-bg`. A render adds its own marks on top and `empty()` leaves
	// them there, so each draw restores this snapshot (see `resetCardBody`).
	const baseClasses = body.className;
	const draw = () => {
		if (child) parent.removeChild(child);
		child = new Component();
		parent.addChild(child);
		resetCardBody(body, baseClasses);
		try {
			def.render(view, card, body, child);
		} catch (err) {
			// A card kind must not be able to take the board down with it. This
			// call is *synchronous* inside renderDashboard's per-card loop, and
			// the arrange-mode drag overlay and resize grips are attached after
			// it — so an exception here doesn't merely leave one card half-drawn,
			// it leaves that card unmovable and unresizable and abandons every
			// card after it in the loop. Same intent as cardDefinition()'s inert
			// fallback for an unknown kind, one level down: contain the failure
			// to the one card and say so on its face, with the real error on the
			// console for a bug report.
			console.error(`Hearth: the ${card.kind} card failed to render`, err);
			// Clear whatever the half-finished render left behind — its marks on
			// the body included — so the failure notice draws in a plain card.
			resetCardBody(body, baseClasses);
			emptyState(body, "alert-triangle", t().cards.empty.renderFailed);
		}
	};
	draw();

	const live = def.liveness;
	if (live.mode === "poll") {
		// The minimal tier suppresses the timer (not the first draw): a web card
		// keeps showing what it loaded, it just stops reloading on a clock.
		const configured = card.refreshSec && card.refreshSec > 0 ? card.refreshSec : 0;
		const every = timersAllowed(view.plugin.settings) ? configured : 0;
		// registerInterval ties the timer to the view's render lifecycle, so it
		// is cleared on the next full rebuild (and on view close).
		if (every) parent.registerInterval(window.setInterval(draw, every * 1000));
		return draw;
	}

	// Redraws the vault asks for are held while a field inside the card body has
	// focus, and run once after focus leaves (#212). `editableInPlace` below
	// covers only the card's *own* textarea; a card also renders focusable
	// content it doesn't own — anything a plugin puts inside an embed — and that
	// content is typically what writes the file the card watches, so typing into
	// it schedules the redraw that destroys it. The returned `draw` stays
	// un-held: a redraw the user asked for must still be immediate.
	//
	// A factory (rather than one shared value) so only the card kinds that
	// actually redraw from events register the focusout listener — static and
	// poll cards never call it.
	const createLiveDraw = () => deferRedrawWhileTyping(body, draw, parent);

	if (live.mode === "watch-file") {
		// Editable cards sync content edits in their textarea, so don't redraw on
		// modify (it would drop the cursor) — but still redraw on existence changes.
		// An embed can switch between a read-only and an editable view, so this is
		// evaluated per event against whichever view is currently shown.
		watchCardFile(view, card, events, createLiveDraw(), () => !live.editableInPlace(card), live.watchedPath);
		return draw;
	}

	// Data-driven cards derive their content from the vault as a whole (tasks,
	// counts, daily-note existence, query matches, edit timestamps), so redraw
	// them — debounced — whenever the vault or its metadata changes.
	if (live.mode === "vault") {
		const shouldRedraw = live.shouldRedraw;
		// Held the same way: a dataview/search card can host a plugin's input
		// just as an embed can. The hold is inside the debounce so it is decided
		// when the redraw fires, not when it was scheduled.
		const redraw = debounce(createLiveDraw(), 400, true);
		events.subscribe((ev) => {
			// A folder-scoped tasks card reads nothing outside its folders, so
			// events that provably can't change its content are skipped instead
			// of redrawing (and instead of resetting the debounce timer).
			if (!shouldRedraw || shouldRedraw(card, ev)) redraw();
		});
	}
	return draw;
}

/** Redraw a tracked-file (embed/daily) card's body when the file it tracks
 * changes on disk. create/delete/rename always redraw; modify only when
 * `redrawOnModify` (a predicate, re-evaluated per event so an embed that
 * switches between a read-only and an editable view is handled correctly). */
function watchCardFile(
	view: HomeView,
	card: DashboardCard,
	events: VaultEventHub,
	draw: () => void,
	redrawOnModify: () => boolean,
	watchedPath: (view: HomeView, card: DashboardCard) => string | null,
): void {
	// Coalesce bursts of writes (e.g. an editor autosaving) into one redraw.
	const redraw = debounce(draw, 150, true);
	const affects = (file: TAbstractFile, oldPath?: string): boolean => {
		const path = watchedPath(view, card);
		return path != null && (file.path === path || oldPath === path);
	};
	events.subscribe((ev: VaultEvent) => {
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

/**
 * Wire a collapsed stacked card's header as the control that opens it.
 *
 * The body is mounted on the first expand and never before, so a card someone
 * has collapsed genuinely costs nothing until they ask for it — no query runs,
 * no iframe loads, no timer starts. Expanding is per-session and is deliberately
 * not written back to the card: `mobile.collapsed` says how the card *starts*
 * on a phone, and tapping one open shouldn't quietly re-author the board.
 *
 * The chevron is always a control of its own so the header still works while
 * arranging, where the header is a text field that must keep its own clicks.
 */
function enableCollapseToggle(
	view: HomeView,
	card: DashboardCard,
	el: HTMLElement,
	head: HTMLElement,
	mount: () => void,
): void {
	const chevron = head.createEl("button", {
		cls: "hearth-card-expand",
		attr: {
			"aria-label": t().dashboard.expandCard,
			"aria-expanded": "false",
			type: "button",
		},
	});
	setIcon(chevron, "chevron-down");
	chevron.addEventListener("pointerdown", (e) => e.stopPropagation());

	let mounted = false;
	const toggle = () => {
		const opening = el.hasClass("is-collapsed");
		el.toggleClass("is-collapsed", !opening);
		chevron.setAttribute("aria-expanded", String(opening));
		chevron.setAttribute(
			"aria-label",
			opening ? t().dashboard.collapseCard : t().dashboard.expandCard,
		);
		// The stacked height is only meaningful once the card is open; a collapsed
		// card is as tall as its header, which CSS decides.
		el.style.height = opening ? `${stackedHeight(card)}px` : "";
		if (opening && !mounted) {
			mounted = true;
			mount();
		}
	};

	chevron.addEventListener("click", (e) => {
		e.stopPropagation();
		toggle();
	});
	// Outside arrange mode the whole row is the target — a chevron-sized tap
	// area is not what a thumb is aiming at.
	if (!view.arrangeMode) {
		head.addClass("is-collapsible");
		head.addEventListener("click", toggle);
	}
}

/** The editable card header shown in arrange mode: an inline title field plus
 * actions to open the card's settings and to remove the card. */
function renderCardControls(
	view: HomeView,
	card: DashboardCard,
	head: HTMLElement,
	commit: () => void,
	/** The board's cards when it is stacked, which is what the reorder buttons
	 * renumber; null on a free-form board, where a card is moved by dragging it
	 * and there is nothing to reorder. */
	stack: DashboardCard[] | null,
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

	// A stacked board has no free geometry to drag, so its one layout question
	// — what comes before what — is answered here instead. The buttons write
	// `mobile.order`, the same field the card's own Mobile settings expose.
	if (stack) {
		const move = (delta: -1 | 1) => {
			if (!moveStacked(stack, card, delta)) return;
			persistAndRender(view);
		};
		for (const [delta, icon, label] of [
			[-1, "arrow-up", t().dashboard.moveCardUp],
			[1, "arrow-down", t().dashboard.moveCardDown],
		] as const) {
			const btn = actions.createEl("button", {
				cls: "hearth-card-action",
				attr: { "aria-label": label, type: "button" },
			});
			setIcon(btn, icon);
			btn.addEventListener("pointerdown", (e) => e.stopPropagation());
			btn.addEventListener("click", () => move(delta));
		}
	}

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
		settings: s,
		favorites: s.favorites,
		isPinned: s.pinnedCards.includes(card),
		externalCallsDisabled: s.disableExternalCalls,
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
		add.addEventListener("click", () => {
			openCardPicker(view.app, {
				hearthVersion: view.plugin.manifest.version,
				onGallery: galleryConfigured(view.plugin)
					? () => openGallery(view.plugin)
					: undefined,
				onChoose: (template) => {
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
				},
			});
		});

		// Beside "Add card", because they are the same question at two scales:
		// one card you place yourself, or a whole board somebody has already
		// arranged. Only shown when a gallery is configured — Hearth ships
		// pointing at none, and a button that only ever says "no gallery is set
		// up" is a button that has never done anything.
		if (galleryConfigured(view.plugin)) {
			const gallery = bar.createEl("button", { cls: "hearth-tool-btn" });
			setIcon(gallery.createSpan("hearth-tool-icon"), "layout-template");
			gallery.createSpan({
				cls: "hearth-tool-label",
				text: t().gallery.browse.openLabel,
			});
			gallery.setAttribute("aria-label", t().gallery.browse.openAria);
			gallery.addEventListener("click", () => openGallery(view.plugin));
		}

		// Same editor the dashboard switcher's right-click menu opens, surfaced
		// here so arrange mode is a self-contained way to configure the board.
		const dashSettings = bar.createEl("button", { cls: "hearth-tool-btn" });
		setIcon(dashSettings.createSpan("hearth-tool-icon"), "settings-2");
		dashSettings.createSpan({
			cls: "hearth-tool-label",
			text: t().dashboard.dashboardSettings,
		});
		dashSettings.setAttribute("aria-label", t().dashboard.dashboardSettingsAria);
		dashSettings.addEventListener("click", () => {
			openDashboardSettings(view, activeDashboard(view.plugin.settings));
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

		// Constrain the board to phone width so the narrow layout can be built
		// and checked from the desk it is being built at. Hearth's narrow layout
		// is chosen by measured width rather than by platform precisely so this
		// is possible: the preview is not a simulation of the phone layout, it is
		// the phone layout, at the width that triggers it.
		//
		// Not offered on a board already narrow enough to be stacked, where
		// clamping the width further would preview nothing new.
		if (!view.isNarrow() || view.phonePreview) {
			const phone = bar.createEl("button", { cls: "hearth-tool-btn" });
			phone.toggleClass("is-active", view.phonePreview);
			setIcon(phone.createSpan("hearth-tool-icon"), "smartphone");
			phone.createSpan({
				cls: "hearth-tool-label",
				text: view.phonePreview
					? t().dashboard.phonePreviewOff
					: t().dashboard.phonePreview,
			});
			phone.setAttribute(
				"aria-label",
				view.phonePreview
					? t().dashboard.phonePreviewOff
					: t().dashboard.phonePreview,
			);
			phone.setAttribute("aria-pressed", String(view.phonePreview));
			phone.addEventListener("click", () => {
				view.phonePreview = !view.phonePreview;
				view.render();
			});
		}
	}

	const arrangeZone = bar.createDiv("hearth-arrange-zone");
	arrangeZone.toggleClass(
		"is-auto-hide",
		!view.arrangeMode &&
			effectiveArrangeButtonVisibility(view.plugin.settings) === "hover",
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
		// The phone preview is a way of looking at a board while building it, and
		// its only control lives in this toolbar. Leaving arrange mode with it
		// still on would strand the board at phone width with nothing on screen
		// to turn it off, so finishing puts the board back to its real width.
		if (!view.arrangeMode) view.phonePreview = false;
		view.render();
	});
}
