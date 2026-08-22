import { Component, ItemView, Platform, type WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { renderHeader } from "./header";
import { renderDashboard } from "./dashboard";
import { renderDashboardSwitcher } from "./dashboards";
import { renderMobileActionBar } from "./mobileactions";
import { applyBackground, renderBanner } from "./background";
import { deferRedrawWhileTyping } from "./cardfocus";
import { gateMotionOnWindow } from "./motion";
import {
	bannerActive,
	effectiveFitToPage,
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
		this.maybeFocusSearch();
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

		this.cleanupChild();
		const child = new Component();
		this.addChild(child);
		this.renderChild = child;

		const root = this.contentEl;
		root.empty();
		root.addClass("hearth-view");
		root.toggleClass("hearth-compact", this.plugin.settings.compact);
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

		// With no cards to show (and not arranging), centre the search field
		// vertically so the page reads as a clean launcher.
		const emptyBoard =
			!mobileOnly &&
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
		scroll.toggleClass("hearth-fit", effectiveFitToPage(this.plugin.settings));

		if (banner) renderBanner(this, scroll, child);

		const inner = scroll.createDiv("hearth-inner");
		inner.style.maxWidth = `${effectiveMaxWidth(this.plugin.settings)}px`;

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
			renderDashboard(this, dashboard, child);
		} else if (this.plugin.settings.showMobileActionBar) {
			// Pinned to the scroll area (not the flex flow shared with `inner`) so
			// it sits in the bottom quarter of the screen regardless of how the
			// centred header above it is sized.
			renderMobileActionBar(this, scroll);
		}
	}
}
