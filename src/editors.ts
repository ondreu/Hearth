import { Notice, Setting, type App } from "obsidian";
import { CARD_KINDS, cardDefinition } from "./cards";
import { type CardEditorContext } from "./cards/definition";
import { t } from "./i18n";
import { HearthTabbedModal, type HearthModalTab } from "./tabbedmodal";
import {
	TILE_COLS_DEFAULT,
	TILE_COLS_MAX,
	TILE_COLS_MIN,
	TILE_MIN_DEFAULT,
	TILE_MIN_MAX,
	TILE_MIN_MIN,
	TILE_MIN_STEP,
	tileCols,
	tileMinSize,
	tileSizing,
} from "./tiles";
import {
	CARD_BORDER_WIDTH_MAX,
	effectiveCardBorderWidth,
	type CardKind,
	type DashboardCard,
	type HomeSettings,
} from "./types";
import { confirmAction } from "./ui";


export interface CardSettingsOptions {
	/** The plugin's global settings. Read-only as far as the editors are
	 * concerned: a couple of kind editors need the global field-name mappings
	 * (which frontmatter keys the TaskNotes source reads) to offer sensible
	 * choices, rather than guessing the defaults. */
	settings: HomeSettings;
	/** The global favorites list (shared by all favorites cards). */
	favorites: string[];
	/** Whether this card is currently pinned to all dashboards. */
	isPinned: boolean;
	/** Whether the global privacy setting blocks outbound requests. */
	externalCallsDisabled: boolean;
	/** Pin/unpin this card across all dashboards. */
	setPinned: (pinned: boolean) => void;
	/** Persist the current settings (no view rebuild). */
	save: () => void;
	/** Rebuild the dashboard view to reflect content/layout changes. */
	rerender: () => void;
	/** Remove this card from the dashboard. */
	remove: () => void;
	/** Other dashboards this card can be copied to (id + name). */
	otherDashboards: { id: string; name: string }[];
	/** Copy this card onto the end of another dashboard. */
	copyToDashboard: (targetId: string) => void;
}


/**
 * The single place to configure a card — opened from the card itself in arrange
 * mode. Covers kind, title, kind-specific content, colors and size so nothing
 * has to be hunted for in the plugin settings tab.
 *
 * Laid out as a tabbed modal (Content / Style / Layout) with a persistent
 * Remove/Done footer, so a card with a dense editor (tasks, RSS) stays as
 * navigable as a plain one.
 */
export class CardSettingsModal extends HearthTabbedModal {
	private card: DashboardCard;
	private opts: CardSettingsOptions;

	/** Per-open scratch space for kind editors (the RSS "add from GitHub" fields,
	 * the Jira load-cancellation counter). Survives the in-place rerenders that
	 * editors trigger, but is fresh for each modal open. */
	private session: Record<string, unknown> = {};

	constructor(app: App, card: DashboardCard, opts: CardSettingsOptions) {
		super(app);
		this.card = card;
		this.opts = opts;
	}

	/** Bundle the modal state a kind editor needs into a CardEditorContext. */
	private editorContext(): CardEditorContext {
		return {
			app: this.app,
			card: this.card,
			opts: this.opts,
			requestRender: () => this.render(),
			session: this.session,
		};
	}

	onOpen(): void {
		this.titleEl.setText(t().editors.title);
		this.hearthRenderShell();
	}

	/** Rebuild the modal in place, keeping the active tab. Kind-specific editors
	 * call this after a change that swaps which controls are shown. */
	private render(): void {
		this.hearthRenderShell();
	}

	protected hearthTabStorageKey(): string {
		return "hearth-card-settings-tab";
	}

	protected hearthTabs(): HearthModalTab[] {
		const tabs = t().editors.tabs;
		return [
			{ id: "content", label: tabs.content, icon: "square-pen" },
			{ id: "style", label: tabs.style, icon: "palette" },
			{ id: "layout", label: tabs.layout, icon: "layout-dashboard" },
		];
	}

	protected hearthRenderBody(body: HTMLElement, tabId: string): void {
		switch (tabId) {
			case "content":
				this.identitySection(body);
				this.contentSection(body);
				break;
			case "style":
				this.colorsSection(body);
				break;
			case "layout":
				this.sizeSection(body);
				this.buttonsSection(body);
				this.pinSection(body);
				this.copySection(body);
				break;
		}
	}

	/** Type and title — what the card is, shown at the top of the Content tab. */
	private identitySection(containerEl: HTMLElement): void {
		const card = this.card;

		new Setting(containerEl)
			.setName(t().editors.type)
			.setDesc(t().editors.typeDesc)
			.addDropdown((d) => {
				CARD_KINDS.forEach((k) => {
					d.addOption(k, t().editors.kinds[k]);
				});
				d.setValue(card.kind).onChange((v) => {
					card.kind = v as CardKind;
					this.opts.save();
					this.render();
				});
			});

		// A note under the type dropdown, when the kind wants one (e.g. the leaf
		// card's "this runs a live view, it costs more" performance hint).
		cardDefinition(card).editorTypeNote?.(containerEl, this.opts.settings);

		new Setting(containerEl)
			.setName(t().editors.cardTitle)
			.setDesc(t().editors.cardTitleDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(t().editors.cardTitlePlaceholder)
					.setValue(card.title ?? "")
					.onChange((v) => {
						card.title = v;
						this.opts.save();
					}),
			);
	}

	/** Persistent footer shared by every tab: remove the card, or close. */
	protected hearthRenderFooter(footer: HTMLElement): void {
		new Setting(footer)
			.addButton((b) => {
				b.setButtonText(t().editors.removeCard).onClick(() => {
					confirmAction(this.app, {
						title: t().editors.removeCardTitle,
						message: t().editors.removeCardMessage(
							this.card.title?.trim() || t().editors.thisCard,
						),
						confirmText: t().editors.removeCardConfirm,
						onConfirm: () => {
							this.opts.remove();
							this.close();
						},
					});
				});
				b.buttonEl.addClass("hearth-danger-btn");
			})
			.addButton((b) =>
				b
					.setButtonText(t().editors.done)
					.setCta()
					.onClick(() => this.close()),
			);
	}

	/** Kind-specific content controls — delegated to the card's own module. */
	private contentSection(containerEl: HTMLElement): void {
		cardDefinition(this.card).renderEditor?.(containerEl, this.editorContext());
	}

	private colorsSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName(t().editors.colors.heading)
			.setDesc(t().editors.colors.headingDesc);

		row.addColorPicker((c) =>
			c.setValue(card.accent ?? "#7c5cff").onChange((v) => {
				card.accent = v;
				this.opts.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.clearAccent)
				.onClick(() => {
					card.accent = undefined;
					this.opts.save();
					this.render();
				}),
		);
		row.addColorPicker((c) =>
			c.setValue(card.background ?? "#000000").onChange((v) => {
				card.background = v;
				this.opts.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.clearBackground)
				.onClick(() => {
					card.background = undefined;
					this.opts.save();
					this.render();
				}),
		);

		const opacityRow = new Setting(containerEl)
			.setName(t().editors.colors.cardOpacity)
			.setDesc(t().editors.colors.cardOpacityDesc);
		opacityRow.addSlider((sl) =>
			sl
				.setLimits(0, 1, 0.05)
				.setValue(card.cardOpacity ?? 1)
				.onChange((v) => {
					card.cardOpacity = v;
					this.opts.save();
					this.opts.rerender();
				}),
		);
		opacityRow.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.useDashboardDefault)
				.onClick(() => {
					card.cardOpacity = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);

		const blurRow = new Setting(containerEl)
			.setName(t().editors.colors.cardBlur)
			.setDesc(t().editors.colors.cardBlurDesc);
		blurRow.addSlider((sl) =>
			sl
				.setLimits(0, 24, 1)
				.setValue(card.cardBlur ?? 0)
				.onChange((v) => {
					card.cardBlur = v;
					this.opts.save();
					this.opts.rerender();
				}),
		);
		blurRow.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.useDashboardDefault)
				.onClick(() => {
					card.cardBlur = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);

		const borderRow = new Setting(containerEl)
			.setName(t().editors.colors.cardBorderWidth)
			.setDesc(t().editors.colors.cardBorderWidthDesc);
		borderRow.addSlider((sl) =>
			sl
				.setLimits(0, CARD_BORDER_WIDTH_MAX, 1)
				.setValue(card.cardBorderWidth ?? effectiveCardBorderWidth(this.opts.settings))
				.onChange((v) => {
					card.cardBorderWidth = v;
					this.opts.save();
					this.opts.rerender();
				}),
		);
		borderRow.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.useDashboardDefault)
				.onClick(() => {
					card.cardBorderWidth = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);
	}

	private sizeSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName(t().editors.size.heading)
			.setDesc(t().editors.size.headingDesc);

		row.addText((txt) => {
			txt
				.setValue(String(Math.round((card.fw ?? 0.25) * 100)))
				.onChange((v) => {
					const n = parseInt(v, 10);
					if (Number.isNaN(n)) return;
					const fw = Math.max(2, Math.min(n, 100)) / 100;
					card.fw = fw;
					// Keep the card inside the board when it grows past the right edge.
					card.fx = Math.max(0, Math.min(card.fx ?? 0, 1 - fw));
					this.opts.save();
				});
			txt.inputEl.type = "number";
			txt.inputEl.addClass("hearth-count-input");
			txt.inputEl.setAttribute("aria-label", t().editors.size.widthAria);
		});
		row.addText((txt) => {
			txt.setValue(String(Math.round(card.fh ?? 184))).onChange((v) => {
				const n = parseInt(v, 10);
				if (Number.isNaN(n)) return;
				card.fh = Math.max(56, n);
				this.opts.save();
			});
			txt.inputEl.type = "number";
			txt.inputEl.addClass("hearth-count-input");
			txt.inputEl.setAttribute("aria-label", t().editors.size.heightAria);
		});
		addResetButton(this.editorContext(), row, t().editors.resetSize, () => {
			card.fw = undefined;
			card.fh = undefined;
		});
	}

	/**
	 * How big the buttons are on a launchpad-like card (links, commands,
	 * templater): which of the two sizing styles the card is on and, when they
	 * fill the card, how many buttons wide it is — which is what decides how big
	 * a button is, since a filled button is a fraction of the card.
	 *
	 * It sits in the Layout tab, under the card's own size, because that is the
	 * question it answers: how the card's buttons are laid out, not what is on
	 * them. The three cards share it — they draw the same grid.
	 */
	private buttonsSection(containerEl: HTMLElement): void {
		if (!cardDefinition(this.card).tileButtons) return;
		const strings = t().editors.tiles;
		const card = this.card;
		new Setting(containerEl).setName(strings.heading).setHeading();
		new Setting(containerEl)
			.setName(strings.sizing)
			.setDesc(strings.sizingDesc)
			.addDropdown((d) => {
				d.addOption("scale", strings.sizingScale);
				d.addOption("fixed", strings.sizingFixed);
				d.setValue(tileSizing(card)).onChange((v) => {
					card.tileSizing = v === "scale" ? "scale" : "fixed";
					this.opts.save();
					this.opts.rerender();
					// The column count below belongs to the filled style alone, and
					// the fixed style's pixel size (in the Content tab) to the other,
					// so rebuild the modal around the choice.
					this.render();
				});
			});
		if (tileSizing(card) !== "scale") return;
		const across = new Setting(containerEl)
			.setName(strings.across)
			.setDesc(strings.acrossDesc);
		across.addSlider((s) => {
			s.setLimits(TILE_COLS_MIN, TILE_COLS_MAX, 1)
				.setValue(tileCols(card.tileCols))
				.onChange((v) => {
					card.tileCols = v === TILE_COLS_DEFAULT ? undefined : v;
					this.opts.save();
					this.opts.rerender();
				});
		});
		across.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.tileCols = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);

		// The floor: how small a button may get before the card gives up and
		// scrolls instead. Sixteen small buttons and four big ones want different
		// answers, so it is the card's to set rather than the stylesheet's.
		const minSize = new Setting(containerEl)
			.setName(strings.minSize)
			.setDesc(strings.minSizeDesc);
		minSize.addSlider((s) => {
			s.setLimits(TILE_MIN_MIN, TILE_MIN_MAX, TILE_MIN_STEP)
				.setValue(tileMinSize(card.tileMinSize))
				.onChange((v) => {
					card.tileMinSize = v === TILE_MIN_DEFAULT ? undefined : v;
					this.opts.save();
					this.opts.rerender();
				});
		});
		minSize.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.tileMinSize = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);
	}

	/** Pin/unpin this card so it appears on every dashboard. */
	private pinSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().editors.pin.heading)
			.setDesc(t().editors.pin.headingDesc)
			.addToggle((t) =>
				t.setValue(this.opts.isPinned).onChange((v) => {
					this.opts.setPinned(v);
					this.opts.isPinned = v;
					this.opts.save();
				}),
			);
	}

	/** Copy this card (with its current content and settings) onto the end of
	 * another dashboard. The original stays in place. */
	private copySection(containerEl: HTMLElement): void {
		const targets = this.opts.otherDashboards;
		if (targets.length === 0) return;
		const row = new Setting(containerEl)
			.setName(t().editors.copy.heading)
			.setDesc(t().editors.copy.headingDesc);
		let dropdown: { getValue(): string } | null = null;
		row.addDropdown((d) => {
			for (const t of targets) d.addOption(t.id, t.name);
			dropdown = d;
		});
		row.addButton((b) =>
			b
				.setButtonText(t().editors.copy.copy)
				.setTooltip(t().editors.copy.copyTooltip)
				.onClick(() => {
					const id = dropdown?.getValue();
					if (!id) return;
					this.opts.copyToDashboard(id);
					new Notice(t().notices.cardCopied);
				}),
		);
	}

	onClose(): void {
		// Invalidate any in-flight Jira filter load so its result is dropped.
		this.session.jiraLoadVersion = ((this.session.jiraLoadVersion as number) ?? 0) + 1;
		this.contentEl.empty();
		this.opts.rerender();
	}
}


/** Add a reset (rotate-ccw) extra button that clears a field back to its
 * default, then saves and redraws so the input reflects the restored value. */
export function addResetButton(ctx: CardEditorContext, 
	setting: Setting,
	tooltip: string,
	onReset: () => void,
): void {
	setting.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(tooltip)
			.onClick(() => {
				onReset();
				ctx.opts.save();
				ctx.requestRender();
			}),
	);
}


/** Move an item within a list, then persist and re-render the editor. */
export function moveItem<T>(ctx: CardEditorContext, arr: T[], from: number, to: number): void {
	if (to < 0 || to >= arr.length) return;
	const [item] = arr.splice(from, 1);
	arr.splice(to, 0, item);
	ctx.opts.save();
	ctx.requestRender();
}
