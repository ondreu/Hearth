import { Component, ItemView, Platform, type WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { renderHeader } from "./header";
import { renderDashboard } from "./dashboard";
import { prunePluginBoards, releasePluginBoards, renderPluginBoard } from "./pluginboard";
import { renderDashboardSwitcher } from "./dashboards";
import { renderMobileActionBar } from "./mobileactions";
import { isNarrowWidth, observeNarrowWidth, PHONE_PREVIEW_WIDTH } from "./narrow";
import { applyBackground, renderBanner } from "./background";
import { deferRedrawWhileTyping } from "./cardfocus";
import { gateMotionOnWindow } from "./motion";
import {
	activeIsPluginBoard,
	bannerActive,
	effectiveCompact,
	effectiveFitToPage,
	effectiveFullWidth,
	effectiveMaxWidth,
	effectiveShowSearch,
	effectiveShowTitle,
	frostAllowed,
	motionAllowed,
	renderCards,
} from "./types";
import { tabIconIdFor } from "./icon";
import { hearthLeafIsNavigable } from "./opener";
import { t } from "./i18n";

export const VIEW_TYPE_HOME = "hearth-home-view";

export class HomeView extends ItemView {
	plugin: HearthPlugin;
	/**
	 * Whether the dashboard is a navigable pane (the base `View` default is
	 * `false`). A non-navigable leaf is treated like the file explorer or
	 * calendar: Obsidian won't reuse it to open a file, so clicking a note in
	 * the file explorer while the dashboard is focused spawns a *new* tab and
	 * leaves the file explorer's selection stuck on that note (#84). With
	 * navigation enabled, opening a file replaces the dashboard in place — the
	 * dashboard behaves like any editor tab and the selection tracks correctly.
	 *
	 * That is still the default, but it is now the user's call: it is also the
	 * only lever over opens Hearth never sees (#106), so `render()` keeps it in
	 * step with the "Notes opened from outside Hearth" setting.
	 */
	navigation = true;
	/** Whether the dashboard is in layout/arrange mode (drag & resize). */
	arrangeMode = false;
	/** In arrange mode, optionally hide the per-card headers (title input +
	 * actions) so each card's full body is visible. Toggled from the Arrange
	 * toolbar; resets when the view reopens. */
	hideHeaderInArrange = false;
	/**
	 * In arrange mode, constrain the board to phone width so the narrow layout
	 * can be built and checked without a phone in hand. Forces the narrow
	 * layout on regardless of the real pane width — the point is to see what a
	 * phone sees. Toggled from the Arrange toolbar; resets when the view
	 * reopens, since it is a way of looking at a board, not a property of one.
	 */
	phonePreview = false;
	/** The narrow state the current render was built for, so the width observer
	 * can tell a real crossing from a resize that changes nothing. */
	private narrowAtRender = false;
	/** Per-render child component so embeds/markdown get cleaned up on re-render. */
	private renderChild: Component | null = null;
	/** {@link liveRender}'s focus-held re-render, built on first use (the
	 * listener it registers lives on `contentEl`, which outlives every render). */
	private heldLiveRender: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: HearthPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_HOME;
	}

	getDisplayText(): string {
		return t().view.displayName;
	}

	getIcon(): string {
		const s = this.plugin.settings;
		return tabIconIdFor(s.themeColorTarget, s.tabIcon);
	}

	async onOpen(): Promise<void> {
		this.render();
		this.trackViewport();
		this.trackWidth();
		this.maybeFocusSearch();
	}

	/**
	 * Rebuild the view when the board crosses the narrow threshold, in either
	 * direction — the stacked and free-form layouts are different renders, not
	 * a stylesheet apart. Only a crossing rebuilds: this observes an element
	 * inside the view it rebuilds, so reacting to every resize would be a loop.
	 */
	private trackWidth(): void {
		this.register(observeNarrowWidth(this.contentEl, (narrow) => {
			// The phone preview pins the layout narrow, so a pane resize behind
			// it changes nothing until it is switched off.
			if (this.phonePreview || narrow === this.narrowAtRender) return;
			this.render();
		}));
	}

	/** Whether this render uses the narrow layout: the measured board width, or
	 * the Arrange phone preview forcing it on. */
	isNarrow(): boolean {
		return this.phonePreview || isNarrowWidth(this.contentEl.clientWidth);
	}

	/** Whether the board reflows into a single stacked column — narrow, and the
	 * setting left on. Narrow without stacking keeps the free-form layout,
	 * scaled down as it always was. */
	isStacked(): boolean {
		return this.isNarrow() && this.plugin.settings.stackOnNarrow;
	}

	/**
	 * When enabled, move keyboard focus into the search field as the view opens
	 * so a freshly-opened Hearth tab is ready to type into (#115). Only runs from
	 * onOpen — not on every re-render — so a background refresh never steals focus
	 * while the user is working. Desktop only: focusing an input on mobile pops
	 * the on-screen keyboard, which would be jarring on every open.
	 */
	private maybeFocusSearch(): void {
		if (!this.plugin.settings.focusSearchOnOpen || Platform.isMobile) return;
		const input = this.contentEl.querySelector<HTMLInputElement>(".hearth-search-input");
		if (input) input.focus();
	}

	/**
	 * On mobile the on-screen keyboard overlays the window without resizing the
	 * leaf, so the lower UI ends up hidden behind it. Track the real visible area
	 * (visualViewport) and, while the keyboard is up, cap the scroll area to it
	 * and allow scrolling so everything stays reachable. Cleaned up on close.
	 */
	private trackViewport(): void {
		const vv = window.visualViewport;
		if (!vv || !Platform.isMobile) return;

		const update = () => {
			const top = this.contentEl.getBoundingClientRect().top;
			const visibleBottom = vv.offsetTop + vv.height;
			this.contentEl.style.setProperty(
				"--hearth-vh",
				`${Math.max(0, Math.round(visibleBottom - top))}px`,
			);
			// Keyboard up when the visual viewport is meaningfully shorter than
			// the layout viewport.
			this.contentEl.toggleClass(
				"hearth-kbd-open",
				vv.height < window.innerHeight - 120,
			);
		};

		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		this.register(() => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
		});
		update();
	}

	async onClose(): Promise<void> {
		// Hosted plugin-board views deliberately outlive the render component, so
		// they are released here rather than with it — this is the point at which
		// a board kept alive for a fast switch back has nothing left to switch
		// back to. See src/pluginboard.ts.
		releasePluginBoards(this);
		this.cleanupChild();
	}

	private cleanupChild() {
		if (this.renderChild) {
			this.removeChild(this.renderChild);
			this.renderChild = null;
		}
	}

	/**
	 * The vault-driven re-render behind the "Live refresh on vault changes"
	 * setting. Identical to {@link render}, except that it is held while the user
	 * is typing into a field on the board and runs once after focus leaves
	 * (#212) — otherwise the board rebuild takes the focused input with it, one
	 * level above the same guard on each card's own redraw. Every other caller
	 * re-renders on something the user just did, so they keep calling `render`.
	 */
	liveRender(): void {
		this.heldLiveRender ??= deferRedrawWhileTyping(this.contentEl, () => this.render(), this);
		this.heldLiveRender();
	}

	/** Full rebuild of the view. Cheap enough to call on any settings change. */
	render(): void {
		// Re-read on every render (which includes every settings save) so the
		// choice takes effect without reopening the tab. Obsidian reads this at
		// the moment it looks for a leaf to open a file in, so the current value
		// is the one that counts.
		this.navigation = hearthLeafIsNavigable(this.plugin.settings);

		// A plugin board has no cards to arrange and no reflow to preview, so both
		// of those modes are dropped on the way in rather than hidden: switching to
		// one while arranging must not leave the view in a mode with no controls.
		const pluginBoard = activeIsPluginBoard(this.plugin.settings);
		if (pluginBoard) {
			this.arrangeMode = false;
			this.phonePreview = false;
		}

		this.cleanupChild();
		const child = new Component();
		this.addChild(child);
		this.renderChild = child;

		const root = this.contentEl;
		root.empty();
		root.addClass("hearth-view");
		root.toggleClass("hearth-compact", effectiveCompact(this.plugin.settings));
		// The two performance-tier flags CSS keys off. They are separate because
		// the tiers drop motion and frost at the same rung but for different
		// reasons, and because `hearth-no-motion` is also what the focus/visibility
		// gate toggles at runtime (see motion.ts) without touching the tier.
		// Everything with a setting behind it — the background, card opacity, the
		// blur radius, the refresh timers — is handled by the effective* resolvers
		// instead, so these classes only cover what has no setting to override.
		root.toggleClass("hearth-no-motion", !motionAllowed(this.plugin.settings));
		root.toggleClass("hearth-no-frost", !frostAllowed(this.plugin.settings));
		// In arrange mode the user can hide the per-card headers to see each
		// card's full body. The class is only applied while arranging so the
		// headers come back automatically when arranging ends.
		root.toggleClass(
			"hearth-hide-header",
			this.arrangeMode && this.hideHeaderInArrange,
		);

		// Mobile-only mode: on a phone/tablet, collapse to just the search field.
		const mobileOnly = Platform.isMobile && this.plugin.settings.mobileSearchOnly;
		root.toggleClass("hearth-mobile-only", mobileOnly);

		// The narrow layout, from the measured board width rather than the
		// platform — see src/narrow.ts for why. Recorded on the view so the width
		// observer can tell a threshold crossing (which needs a rebuild) from an
		// ordinary resize (which the fractional layout already handles).
		const narrow = this.isNarrow();
		this.narrowAtRender = narrow;
		root.toggleClass("hearth-narrow", narrow);
		root.toggleClass("hearth-phone-preview", this.phonePreview);
		// The whole board is one hosted view: it fills the pane and scrolls itself,
		// on a single card surface instead of a grid of them.
		root.toggleClass("hearth-plugin-view", pluginBoard);

		// With no cards to show (and not arranging), centre the search field
		// vertically so the page reads as a clean launcher.
		// `renderCards` is empty on a plugin board by definition, which is not the
		// "clean launcher" this centres the search for — that board is full.
		const emptyBoard =
			!mobileOnly &&
			!pluginBoard &&
			!this.arrangeMode &&
			renderCards(this.plugin.settings).length === 0;
		root.toggleClass("hearth-empty-board", emptyBoard);

		// The backdrop is painted one of two ways. As a wallpaper it goes behind
		// everything, so it is laid down before the scroll area; as a banner it is
		// a strip at the top of the content, so it is the scroll area's first
		// child and the board flows below it.
		//
		// Mobile-only mode is the one board with nothing for a banner to head: it
		// is a centred search field and nothing else, so the same background is
		// painted as a wallpaper there rather than as a strip floating above a
		// launcher.
		const banner = !mobileOnly && bannerActive(this.plugin.settings);
		root.toggleClass("hearth-has-banner", banner);
		if (!banner) applyBackground(this, root, child);

		const scroll = root.createDiv("hearth-scroll");
		// A stacked board is a list that runs off the bottom of the screen by
		// design, so fit-to-page — which locks the board to exactly one screen and
		// clips the rest — is not applied to it. The setting is untouched and
		// comes back with the free-form layout.
		const stacked = narrow && this.plugin.settings.stackOnNarrow;
		// A plugin board is always fitted, whatever the setting says and however
		// narrow the pane is: the hosted view has to be given a definite height to
		// fill and does its own scrolling inside it. Letting the page scroll
		// instead would give the board no height at all to hand over.
		scroll.toggleClass(
			"hearth-fit",
			pluginBoard || (effectiveFitToPage(this.plugin.settings) && !stacked),
		);

		if (banner) renderBanner(this, scroll, child);

		// The phone preview draws a device shell around the board. It is a wrapper
		// rather than styling on `.hearth-inner` itself, because the bezel has to
		// paint a surface and the screen has to keep showing the board's own
		// background through it — one element cannot do both. The screen width is
		// published as a variable so the shell can size itself around it and the
		// preview's width stays the one number that decides the layout.
		const frame = this.phonePreview ? scroll.createDiv("hearth-phone-frame") : null;
		frame?.style.setProperty("--hearth-phone-screen", `${PHONE_PREVIEW_WIDTH}px`);

		const inner = (frame ?? scroll).createDiv("hearth-inner");
		// The column is fluid either way — it is `width: 100%` centred in the
		// scroll area, so it already follows a narrow pane down. The setting only
		// decides how far it may grow: to a pixel ceiling, or to the pane itself.
		//
		// A narrow board skips the ceiling entirely: it is already narrower than
		// the smallest value the setting can hold (CONTENT_WIDTH_MIN is 700px),
		// so the only thing a max-width could do there is nothing.
		// The phone preview needs no clause of its own: it forces `narrow`, and its
		// ceiling is the device shell's width, not the board's.
		if (!narrow && !effectiveFullWidth(this.plugin.settings)) {
			inner.style.maxWidth = `${effectiveMaxWidth(this.plugin.settings)}px`;
		}

		if (!mobileOnly) renderDashboardSwitcher(this, inner);

		if (effectiveShowTitle(this.plugin.settings) || effectiveShowSearch(this.plugin.settings)) {
			const header = inner.createDiv("hearth-header");
			renderHeader(this, header, child);
		}

		// Hold every animation on this board while its window isn't the one being
		// used. Registered on the render component, so it re-reads the setting on
		// the next render and tears its listeners down with this one.
		gateMotionOnWindow(this, child);

		if (!mobileOnly) {
			const dashboard = inner.createDiv("hearth-dashboard");
			if (pluginBoard) renderPluginBoard(this, dashboard, child);
			else renderDashboard(this, dashboard, child);
		}

		// Nothing on this render claimed a hosted view — a cards board, or
		// mobile-only mode, which draws no board at all — so everything still
		// alive is off screen, and only what a board asked to keep survives.
		// (A plugin board prunes with its own view held; see pluginboard.ts.)
		if (!pluginBoard || mobileOnly) prunePluginBoards(this, null);

		if (mobileOnly && this.plugin.settings.showMobileActionBar) {
			// Pinned to the scroll area (not the flex flow shared with `inner`) so
			// it sits in the bottom quarter of the screen regardless of how the
			// centred header above it is sized.
			renderMobileActionBar(this, scroll);
		}
	}
}
