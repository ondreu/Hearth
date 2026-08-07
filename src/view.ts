import { Component, ItemView, Platform, type WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { renderHeader } from "./header";
import { renderDashboard } from "./dashboard";
import { renderDashboardSwitcher } from "./dashboards";
import { renderMobileActionBar } from "./mobileactions";
import { applyBackground } from "./background";
import {
	effectiveFitToPage,
	effectiveMaxWidth,
	effectiveShowSearch,
	effectiveShowTitle,
	renderCards,
} from "./types";
import { hearthIconIdFor } from "./icon";
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
		return hearthIconIdFor(this.plugin.settings.themeColorTarget);
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

		applyBackground(this, root);

		const scroll = root.createDiv("hearth-scroll");
		scroll.toggleClass("hearth-fit", effectiveFitToPage(this.plugin.settings));

		const inner = scroll.createDiv("hearth-inner");
		inner.style.maxWidth = `${effectiveMaxWidth(this.plugin.settings)}px`;

		if (!mobileOnly) renderDashboardSwitcher(this, inner);

		if (effectiveShowTitle(this.plugin.settings) || effectiveShowSearch(this.plugin.settings)) {
			const header = inner.createDiv("hearth-header");
			renderHeader(this, header, child);
		}

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
