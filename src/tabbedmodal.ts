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
