/**
 * Building a package: what travels, and how a board is made self-describing.
 *
 * The interesting work here is one idea. A dashboard's look is only half stored
 * on the dashboard — the other half is the vault's global settings, which the
 * board falls back to for anything it doesn't override. Carry the board alone
 * and it arrives wearing the *importer's* half: their grid, their card opacity,
 * their wallpaper, their search placeholder. So before a board is written into a
 * `dashboard` package, every look-affecting setting is resolved and written onto
 * the board itself. The board stops inheriting and starts stating.
 *
 * That resolution goes through Hearth's own `effective*()` readers rather than a
 * copy of their rules, by handing them a snapshot of the settings whose active
 * board is the one being exported. Two things fall out of it for free: the
 * plugin-board special cases (a hosted view hides the title and fills the pane
 * unless told otherwise) come across correctly, and there is no second copy of
 * the fallback logic to drift out of step with the first.
 *
 * The snapshot is also **tier-neutralised**, and that is not a detail. The
 * performance tier overrides the frosted glass and the wallpaper *at read time*
 * without touching what is stored, so exporting what the resolvers say on a
 * phone at `balanced` would bake "no blur, flat grey backdrop" into the file
 * permanently — the author's real board, lost to a device setting. The snapshot
 * therefore pins the tier to `full` before asking, so what is captured is what
 * the author configured. The tier they were actually on is recorded in
 * `capture.performanceTier` as information, never applied on import.
 */

import { Platform } from "obsidian";
import {
	type Dashboard,
	type DashboardCard,
	effectiveArrangeButtonVisibility,
	effectiveBackground,
	effectiveCardBlur,
	effectiveCardBorderWidth,
	effectiveCardOpacity,
	effectiveCardRadius,
	effectiveColumns,
	effectiveCompact,
	effectiveFitToPage,
	effectiveFullWidth,
	effectiveHeaderAlign,
	effectiveHeaderLogoScale,
	effectiveHeaderMarginTop,
	effectiveHeaderSpacingBelow,
	effectiveHeaderTitleScale,
	effectiveHiddenFilters,
	effectiveMaxWidth,
	effectiveNewNoteButtonLabel,
	effectiveNewNoteButtonMode,
	effectiveRowHeight,
	effectiveSearchPlaceholder,
	effectiveShowNewNoteButton,
	effectiveShowSearch,
	effectiveShowTitle,
	effectiveSkyAnimate,
	effectiveStackOnNarrow,
	effectiveSwitcherVisibility,
	effectiveThemeColorTarget,
	effectiveTitle,
	effectiveTitleIcon,
	type HomeSettings,
	performanceTier,
} from "../types";
import { exportSettingsPayload, layoutPayload, scrubCard } from "../layout";
import { resolveTaskFields } from "../taskfields";
import {
	CARD_PLUGIN_REQUIREMENTS,
	type DashboardPayload,
	type HearthPackage,
	PACKAGE_FORMAT,
	type PackageCapture,
	type PackageMeta,
	type PackageRequirements,
} from "./schema";

/** A deep copy through JSON — exact for settings, which are JSON by definition,
 * and it drops `undefined`-valued keys rather than persisting them. */
function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A settings object the `effective*()` readers can be asked about one specific
 * board, with the performance tier taken out of the answer.
 *
 * Shallow: the readers only ever read. `dashboards` is replaced with just the
 * board in question so `activeDashboard()` returns it whatever the vault's real
 * selection is.
 */
function lookSnapshot(s: HomeSettings, dash: Dashboard): HomeSettings {
	return {
		...s,
		dashboards: [dash],
		activeDashboardId: dash.id,
		// The two fields that make the readers report a degraded look. See the
		// module comment: without this, a capture taken on a frugal device would
		// freeze that device's compromises into the package.
		performanceTier: "full",
		mobilePerformanceTier: "match",
	};
}

/**
 * A board that states its whole look instead of inheriting half of it.
 *
 * Every field written here is one the board would otherwise have fallen back to
 * the vault for. Fields a board already owns outright — its cards, name, icons,
 * mode, hosted view — are carried by the clone and not touched.
 */
export function flattenBoardLook(s: HomeSettings, dash: Dashboard): Dashboard {
	const snap = lookSnapshot(s, dash);
	const out = clone(dash);

	// Grid and content box
	out.gridColumns = effectiveColumns(snap);
	out.rowHeight = effectiveRowHeight(snap);
	out.fitToPage = effectiveFitToPage(snap);
	out.maxWidth = effectiveMaxWidth(snap);
	out.fullWidth = effectiveFullWidth(snap);
	out.compact = effectiveCompact(snap);

	// Card surfaces
	out.cardOpacity = effectiveCardOpacity(snap);
	out.cardBlur = effectiveCardBlur(snap);
	out.cardRadius = effectiveCardRadius(snap);
	out.cardBorderWidth = effectiveCardBorderWidth(snap);

	// The search row and the chrome around the board
	out.showSearch = effectiveShowSearch(snap);
	out.searchPlaceholder = effectiveSearchPlaceholder(snap);
	out.showNewNoteButton = effectiveShowNewNoteButton(snap);
	out.newNoteButtonMode = effectiveNewNoteButtonMode(snap);
	out.newNoteButtonLabel = effectiveNewNoteButtonLabel(snap);
	out.hiddenFilters = [...effectiveHiddenFilters(snap)];
	out.stackOnNarrow = effectiveStackOnNarrow(snap);
	out.arrangeButtonVisibility = effectiveArrangeButtonVisibility(snap);
	out.dashboardSwitcherVisibility = effectiveSwitcherVisibility(snap);

	// The backdrop, and how the board wears it
	const bg = effectiveBackground(snap);
	out.background = {
		kind: bg.kind,
		value: bg.value,
		opacity: bg.opacity,
		blur: bg.blur,
	};
	out.backgroundLayout = bg.layout;
	out.bannerHeight = bg.bannerHeight;
	out.bannerFade = bg.bannerFade;
	out.bannerFullWidth = bg.bannerFullWidth;
	out.backgroundSkyAnimate = effectiveSkyAnimate(snap);

	// The title block
	const header = { ...out.header };
	header.showTitle = effectiveShowTitle(snap);
	header.title = effectiveTitle(snap);
	header.titleIcon = effectiveTitleIcon(snap);
	header.themeColorTarget = effectiveThemeColorTarget(snap);
	header.align = effectiveHeaderAlign(snap);
	header.titleScale = effectiveHeaderTitleScale(snap);
	header.logoScale = effectiveHeaderLogoScale(snap);
	// These two mean "whatever the stylesheet says" when unset, which is not a
	// number that can be written down — so they are carried only when the board
	// or the vault actually set one.
	const marginTop = effectiveHeaderMarginTop(snap);
	if (marginTop !== undefined) header.marginTop = marginTop;
	const spacingBelow = effectiveHeaderSpacingBelow(snap);
	if (spacingBelow !== undefined) header.spacingBelow = spacingBelow;
	out.header = header;

	// Two claims about the *vault* rather than about the board, which a copy of
	// the board in someone else's vault has no business making: which board a
	// phone opens, and which workspace switches to it.
	delete out.mobileDefault;
	delete out.linkedWorkspace;

	return out;
}

/**
 * Fold the vault's pinned cards into the board's own card list.
 *
 * A pinned card is a Hearth bookkeeping distinction, not a visible one: it is
 * rendered in the same grid, at its own coordinates, alongside the board's
 * cards (see `allCards`), and nothing on screen says which list a card came
 * from. So a package that carried the board's half and left the other half
 * behind — or worse, offered it as a checkbox — would describe a board nobody
 * has ever seen. They travel, always, as ordinary cards.
 *
 * They arrive as ordinary cards too, which is the other half of the point: the
 * board looks the way its author's did without an import pinning anything to
 * every board in the importer's vault. `pinned` is therefore cleared — the copy
 * is this board's card now, and it is free to be pinned or not on its own.
 *
 * A plugin board is the exception, and only because it renders no cards at all.
 */
function withPinnedCards(board: Dashboard, s: HomeSettings): void {
	if (board.pluginView?.viewType) return;
	if (!s.pinnedCards.length) return;
	board.cards = [
		...board.cards,
		...clone(s.pinnedCards).map((card) => {
			const copy = scrubCard(card);
			delete copy.pinned;
			// A suffix rather than a fresh random id: the copy must not collide
			// with the pinned card it came from (importing your own board back
			// into your own vault would otherwise put two cards with one id in
			// it, and a card id keys the slideshow's remembered position), and a
			// *stable* id means re-exporting the same board keeps that memory
			// across an update-in-place.
			copy.id = `${copy.id}-pinned`;
			return copy;
		}),
	];
}

/**
 * Give every favourites card its own copy of the list it was showing.
 *
 * The favourites list is Hearth's own — the note paths a "favourites" card
 * renders — and it lives vault-wide, so a favourites card exported on its own
 * arrives empty or, worse, showing the importer's notes. Neither is the board
 * its author had.
 *
 * The fix is the one `foldTaskFields` uses and the one the whole module is
 * built on: the card stops inheriting and starts stating. Nothing global is
 * touched on the way in, no other board in the importing vault changes, and
 * the card can be pointed back at the vault's list whenever its new owner
 * wants (see `DashboardCard.favorites`).
 *
 * An author with no favourites at all folds nothing: an empty list would pin
 * the card permanently empty, where leaving it inheriting shows the importer
 * their own notes — the same empty-looking card for the author, a useful one
 * for everybody else.
 */
function foldFavorites(cards: DashboardCard[], s: HomeSettings): void {
	if (!s.favorites.length) return;
	for (const card of cards) {
		if (card.kind !== "favorites") continue;
		if (card.favorites !== undefined) continue;
		card.favorites = [...s.favorites];
	}
}

/**
 * Give every tasks card its own copy of the field list it was showing.
 *
 * A tasks card can define the metadata it renders, but by default it follows a
 * vault-wide list — so the same board in another vault shows different task
 * metadata, or none. Folding the resolved list onto each card closes that,
 * using the per-card override the card already has rather than a new one.
 *
 * The one thing it cannot close is the master switch: `taskFieldsEnabled` in
 * the vault's settings gates every card's list, and flipping a global on
 * someone's behalf during an import is exactly what this whole engine exists to
 * avoid. So the fold is recorded as a requirement instead, and the import
 * dialog says the switch is needed. See `PackageRequirements.settings`.
 */
function foldTaskFields(cards: DashboardCard[], s: HomeSettings): boolean {
	let needsMasterSwitch = false;
	for (const card of cards) {
		const cfg = card.tasks;
		if (!cfg) continue;
		if (cfg.taskFieldsEnabled) {
			// The card already states its own list; it only needs the switch.
			needsMasterSwitch = true;
			continue;
		}
		if (!s.taskFieldsEnabled) continue;
		cfg.taskFieldsEnabled = true;
		cfg.taskFields = clone(resolveTaskFields(s.taskFields));
		needsMasterSwitch = true;
	}
	return needsMasterSwitch;
}

/** What the importing vault will need. Built from what the cards actually are,
 * so it can't claim a requirement the board doesn't have. */
function requirementsFor(
	cards: DashboardCard[],
	boards: Dashboard[],
	needsTaskFields: boolean,
): PackageRequirements {
	const plugins = new Set<string>();
	const cardKinds = new Set<string>();
	const viewTypes = new Set<string>();

	for (const card of cards) {
		if (!card?.kind) continue;
		cardKinds.add(card.kind);
		for (const id of CARD_PLUGIN_REQUIREMENTS[card.kind] ?? []) plugins.add(id);
		// A tasks card only needs TaskNotes when that is where it reads from.
		if (card.kind === "tasks" && card.tasks?.source === "tasknotes") {
			plugins.add("tasknotes");
		}
		if (card.kind === "tasks" && card.tasks?.source === "kanban") {
			plugins.add("obsidian-kanban");
		}
		const viewType = card.leafView?.viewType?.trim();
		if (viewType) viewTypes.add(viewType);
	}
	for (const board of boards) {
		const viewType = board.pluginView?.viewType?.trim();
		if (viewType) viewTypes.add(viewType);
	}

	const requires: PackageRequirements = {};
	if (plugins.size) requires.plugins = Array.from(plugins).sort();
	if (cardKinds.size) requires.cardKinds = Array.from(cardKinds).sort();
	if (viewTypes.size) requires.viewTypes = Array.from(viewTypes).sort();
	if (needsTaskFields) requires.settings = ["taskFieldsEnabled"];
	return requires;
}

/** The conditions this capture was taken under. Informational — see
 * {@link PackageCapture}. */
function captureInfo(s: HomeSettings, locale: string): PackageCapture {
	return {
		platform: Platform.isMobile ? "mobile" : "desktop",
		performanceTier: performanceTier(s),
		locale,
	};
}

export interface CaptureOptions {
	/** Plugin version string, written into the header. */
	pluginVersion?: string;
	/** UI language, for `capture.locale`. */
	locale?: string;
	meta?: PackageMeta;
}

export interface CaptureDashboardOptions extends CaptureOptions {
	/**
	 * Resolve the vault's look-affecting settings onto the board, so it draws
	 * the same elsewhere. On by default, and the whole point of a `dashboard`
	 * package.
	 *
	 * Turn it off for a board that should *adapt* to wherever it lands — one
	 * board of your own moved between two vaults you keep configured alike, say.
	 * The board then arrives carrying only the overrides it really had.
	 */
	flatten?: boolean;
}

/**
 * Package one board.
 *
 * Assets are *not* embedded here: this module has no vault access on purpose.
 * Pass the result through `embedAssets()` from `assets.ts` to fold the wallpaper
 * and any icon images in — which is what makes wallpaper embedding an explicit
 * step the caller opts into, rather than something that quietly happens to
 * every export.
 */
export function captureDashboard(
	s: HomeSettings,
	dash: Dashboard,
	opts: CaptureDashboardOptions = {},
): HearthPackage {
	const board = opts.flatten === false ? clone(dash) : flattenBoardLook(s, dash);
	// The same scrub the layout and settings payloads run. A board can be
	// exported on its own, so it needs it on its own — this is the one path a
	// credential could otherwise leave the vault by.
	board.cards = board.cards.map(scrubCard);
	// Everything the author saw on this board, as cards: the pinned ones are
	// part of the picture and the two vault-wide lists a card can read are
	// folded onto the cards that read them.
	withPinnedCards(board, s);
	foldFavorites(board.cards, s);
	const needsTaskFields = foldTaskFields(board.cards, s);

	const payload: DashboardPayload = { dashboard: board };

	return {
		hearth: {
			format: PACKAGE_FORMAT,
			kind: "dashboard",
			plugin: opts.pluginVersion,
			createdAt: new Date().toISOString(),
		},
		// `id` before the caller's meta, so a gallery publishing this can name the
		// work itself; `name` after nothing, so the board's own name is only a
		// default. See PackageMeta.id.
		meta: { id: dash.sourceId, name: dash.name, ...opts.meta },
		capture: captureInfo(s, opts.locale ?? "en"),
		requires: requirementsFor(board.cards, [board], needsTaskFields),
		payload,
	};
}

/** Package every board plus the layout globals: the backup that restores a
 * dashboard setup without touching header, background or behaviour. */
export function captureLayout(s: HomeSettings, opts: CaptureOptions = {}): HearthPackage {
	const payload = layoutPayload(s);
	const cards = [...payload.dashboards.flatMap((d) => d.cards), ...payload.pinnedCards];
	return {
		hearth: {
			format: PACKAGE_FORMAT,
			kind: "layout",
			plugin: opts.pluginVersion,
			createdAt: new Date().toISOString(),
		},
		meta: opts.meta,
		capture: captureInfo(s, opts.locale ?? "en"),
		requires: requirementsFor(cards, payload.dashboards, s.taskFieldsEnabled),
		payload,
	};
}

/**
 * Package every configurable setting: the full backup.
 *
 * Nothing is flattened. A settings package carries the globals themselves, so
 * the boards inside it are stored exactly as they are and go on inheriting from
 * the settings that travel alongside them — which is what makes a restore
 * restore rather than approximate.
 */
export function captureSettings(s: HomeSettings, opts: CaptureOptions = {}): HearthPackage {
	const payload = exportSettingsPayload(s);
	const dashboards = (payload.dashboards ?? []) as Dashboard[];
	const cards = [
		...dashboards.flatMap((d) => d.cards),
		...((payload.pinnedCards ?? []) as DashboardCard[]),
	];
	return {
		hearth: {
			format: PACKAGE_FORMAT,
			kind: "settings",
			plugin: opts.pluginVersion,
			createdAt: new Date().toISOString(),
		},
		meta: opts.meta,
		capture: captureInfo(s, opts.locale ?? "en"),
		requires: requirementsFor(cards, dashboards, s.taskFieldsEnabled),
		payload,
	};
}

/**
 * A fresh shared-work identity.
 *
 * Random rather than derived: it identifies a *dashboard someone published*,
 * which has nothing to do with when or where the board was made, and two
 * authors exporting at the same moment must not collide. Kept to the character
 * set the importer validates.
 */
export function newSourceId(): string {
	const random = (): string => Math.random().toString(36).slice(2, 10);
	return `hd-${random()}${random()}`;
}

/** Serialize a package the way every Hearth export is written: pretty JSON, so
 * a shared board can be read and diffed by hand. */
export function serializePackage(pkg: HearthPackage): string {
	return JSON.stringify(pkg, null, 2);
}
