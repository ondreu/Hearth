import { Modal, setIcon } from "obsidian";
import { t } from "./i18n";

/** One tab in a {@link HearthTabbedModal}'s ribbon. */
export interface HearthModalTab {
	/** Stable id — persisted as the active tab and passed to the body renderer. */
	id: string;
	/** Ribbon label. */
	label: string;
	/** Lucide icon id shown beside the label. */
	icon: string;
}

/**
 * A modal whose content is split across a top ribbon of tabs — one group shown
 * at a time — with an optional persistent footer below. It mirrors the plugin
 * settings pane's ribbon so every configuration surface in Hearth navigates the
 * same way: click a tab, see just that group.
 *
 * ⚠️ #52 naming hazard: members here live on the same prototype chain as
 * Obsidian's `Modal` (and `Component`), whose *undocumented internals* aren't in
 * the typings — so a colliding method name compiles cleanly and silently
 * replaces engine behaviour at runtime (exactly how the blank-settings bug #52
 * happened one layer up, in `SettingTab`). Every member here is prefixed
 * `hearth*` to stay unmistakably clear of them; subclasses must do the same and
 * must never name a method `open`/`close`/`onOpen`/`onClose`/`setTitle`/
 * `load`/`unload`/`render`-that-shadows-anything without checking.
 */
export abstract class HearthTabbedModal extends Modal {
	/** The tabs to show, in ribbon order. Read once per shell render, so tabs
	 * may appear or disappear with state. */
	protected abstract hearthTabs(): HearthModalTab[];

	/** Render the body of the given tab into `body`. */
	protected abstract hearthRenderBody(body: HTMLElement, tabId: string): void;

	/** localStorage key under which the active tab persists across opens, so the
	 * modal reopens on the tab you last used. */
	protected abstract hearthTabStorageKey(): string;

	/** Optional persistent footer, rendered below the body on every tab (e.g. the
	 * Remove/Done actions). Left unset for modals that need no footer. */
	protected hearthRenderFooter?(footer: HTMLElement): void;

	/** Resolve the active tab: the persisted one if it still exists, else the
	 * first tab. */
	private hearthActiveTab(tabs: HearthModalTab[]): string {
		const saved = this.app.loadLocalStorage(this.hearthTabStorageKey()) as
			| string
			| null;
		return tabs.some((tab) => tab.id === saved) ? (saved as string) : tabs[0].id;
	}

	/**
	 * Build (or rebuild) the whole modal: ribbon, the active tab's body, and the
	 * footer. Call from `onOpen`, and again after any state change that should
	 * redraw — the active tab is preserved across rebuilds.
	 */
	protected hearthRenderShell(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("hearth-tabbed-modal");

		this.hearthSyncModalSurface();

		const tabs = this.hearthTabs();
		const active = this.hearthActiveTab(tabs);

		this.hearthRenderRibbon(contentEl, tabs, active);

		const body = contentEl.createDiv("hearth-modal-tabbody");
		// Per-tab backstop (the #52 lesson): a throw while building one tab shows
		// an inline error in the body instead of blanking the whole modal, and the
		// ribbon above still lets the user switch to a tab that works.
		try {
			this.hearthRenderBody(body, active);
		} catch (err) {
			const label = tabs.find((tab) => tab.id === active)?.label ?? active;
			body.empty();
			this.hearthRenderTabError(body, label, err);
		}

		if (this.hearthRenderFooter) {
			this.hearthRenderFooter(contentEl.createDiv("hearth-modal-footer"));
		}
	}

	/**
	 * Publish the modal's own background colour as `--hearth-modal-surface`, for
	 * the sticky ribbon to paint itself with.
	 *
	 * The ribbon has to hide the rows scrolling beneath it, and any hard-coded
	 * colour is a guess about the theme: with `--background-primary` (the note
	 * background) the strip showed up as a slab in a different shade to the
	 * modal on every theme that styles the two differently. Measuring beats
	 * guessing — a theme can dress its modals through `--modal-background`, a
	 * rule on `.modal`, or one on `.modal-content`, and all three end up in the
	 * computed colour of some element between the content and the frame.
	 *
	 * Walks content → frame and takes the first background solid enough to cover
	 * what slides under it; faint tints layered over the frame are skipped so
	 * the strip doesn't take a 3%-white wash for the whole surface. Nothing
	 * usable (a gradient, a translucent frame) leaves the property unset, and
	 * the stylesheet's fallback chain takes over.
	 */
	private hearthSyncModalSurface(): void {
		const { contentEl } = this;
		contentEl.style.removeProperty("--hearth-modal-surface");
		const frame = this.modalEl ?? contentEl;
		let el: HTMLElement | null = contentEl;
		while (el) {
			const color = window.getComputedStyle(el).backgroundColor;
			if (isOpaqueSurfaceColor(color)) {
				contentEl.style.setProperty("--hearth-modal-surface", color);
				return;
			}
			if (el === frame) return;
			el = el.parentElement;
		}
	}

	/** Draw the tab ribbon. Clicking a tab persists the choice and rebuilds. */
	private hearthRenderRibbon(
		containerEl: HTMLElement,
		tabs: HearthModalTab[],
		active: string,
	): void {
		const ribbon = containerEl.createDiv("hearth-modal-ribbon");
		ribbon.setAttribute("role", "tablist");
		for (const tab of tabs) {
			const btn = ribbon.createEl("button", { cls: "hearth-ribbon-tab" });
			btn.setAttribute("role", "tab");
			btn.toggleClass("is-active", tab.id === active);
			btn.setAttribute("aria-selected", String(tab.id === active));
			btn.setAttribute("aria-label", tab.label);
			setIcon(btn.createSpan("hearth-ribbon-tab-icon"), tab.icon);
			btn.createSpan({ cls: "hearth-ribbon-tab-label", text: tab.label });
			btn.addEventListener("click", () => {
				if (tab.id === active) return;
				this.app.saveLocalStorage(this.hearthTabStorageKey(), tab.id);
				this.hearthRenderShell();
			});
		}
	}

	/** Inline error shown in place of a tab body whose render threw, reusing the
	 * settings pane's error styling and copy. */
	private hearthRenderTabError(
		body: HTMLElement,
		label: string,
		err: unknown,
	): void {
		console.error(`Hearth: the "${label}" settings tab failed to render`, err);
		const box = body.createDiv("hearth-settings-error");
		setIcon(box.createSpan("hearth-settings-error-icon"), "alert-triangle");
		const text = box.createDiv("hearth-settings-error-text");
		text.createDiv({
			cls: "hearth-settings-error-title",
			text: t().settings.sectionError(label),
		});
		text.createDiv({
			cls: "hearth-settings-error-hint",
			text: t().settings.sectionErrorHint,
		});
	}
}

/**
 * Is this computed `background-color` solid enough to sit a sticky bar on?
 *
 * `getComputedStyle` hands back `rgb()`/`rgba()` in either the legacy comma
 * form or the modern `rgb(r g b / a)` one, so both separators are treated the
 * same and the alpha is simply the fourth component when there is one.
 * Anything else — `transparent`, a colour space this doesn't recognise, an
 * element painted by a gradient — reads as "no surface here" and the walk
 * carries on outwards.
 *
 * The 0.9 floor keeps the near-solid, so a theme that rounds its modal fill to
 * 0.98 still counts, while rejecting the decorative washes themes lay over a
 * frame: such a colour on its own says nothing about what shows through it.
 */
export function isOpaqueSurfaceColor(color: string): boolean {
	const body = /^rgba?\(([^)]*)\)$/.exec(color.trim())?.[1];
	if (body === undefined) return false;
	const args = body.split(/[\s,/]+/).filter((arg) => arg.length > 0);
	if (args.length < 3) return false;
	if (args.length < 4) return true;
	const raw = args[3];
	const alpha = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
	return Number.isFinite(alpha) && alpha >= 0.9;
}
