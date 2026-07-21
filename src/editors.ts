import { type App, Notice, setIcon, Setting } from "obsidian";
import { FILE_TYPE_GROUPS, fileTypeLabel, FOLDERS_GROUP_ID } from "./filetypes";
import { listBaseViews, isBaseTarget } from "./bases";
import { CommandPickerModal, FilePickerModal } from "./pickers";
import type {
	CalendarConfig,
	CardKind,
	ClockConfig,
	DashboardCard,
	EmbedView,
	JiraControl,
	LinkItem,
	RssLayout,
	RssSource,
	StatId,
	StatsQuery,
	TasksConfig,
} from "./types";
import { ALL_STATS, DEFAULT_STATS, STAT_ICONS } from "./types";
import {
	DEFAULT_EVENT_NOTE_FIELDS,
	type EventField,
	type EventFieldAction,
	type EventNoteConfig,
} from "./eventnote";
import { confirmAction } from "./ui";
import { listLeafViewTypes } from "./leafview";
import { HearthTabbedModal, type HearthModalTab } from "./tabbedmodal";
import { t } from "./i18n";
import { clearJiraCache, JIRA_CONTROLS, listJiraFilters } from "./jira";
import { CARD_KINDS, cardDefinition } from "./cards";
import type { CardEditorContext } from "./cards/definition";

/** A GitHub repo split into its owner and repo halves, as pulled from user
 * input by {@link parseGithubRepo}. */
interface GithubRepo {
	owner: string;
	repo: string;
}

/** Parse an `owner/repo` string — or a full GitHub URL, or an `git@…` SSH
 * remote — into its two halves. Returns null when either half is missing so
 * callers can warn the user. */
function parseGithubRepo(input: string): GithubRepo | null {
	let s = input.trim();
	if (!s) return null;
	// Strip a leading scheme + host, an SSH `git@github.com:` remote, or a bare
	// `github.com/` prefix, so a pasted URL collapses to `owner/repo/…`.
	s = s
		.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i, "")
		.replace(/^git@[^:]+:/i, "")
		.replace(/^github\.com\//i, "");
	// Drop any query/hash and a trailing `.git`, then keep the first two path
	// segments — the rest (tree/blob/…) is irrelevant to the feed.
	s = s.split(/[?#]/)[0].replace(/\.git$/i, "");
	const parts = s.split("/").filter(Boolean);
	if (parts.length < 2) return null;
	return { owner: parts[0], repo: parts[1] };
}

/** Build the RSS sources for a repo's GitHub Atom feeds. `type` selects the
 * releases feed, the commits feed, or both. */
function githubFeedSources(
	repo: GithubRepo,
	type: "releases" | "commits" | "both",
): RssSource[] {
	const base = `https://github.com/${repo.owner}/${repo.repo}`;
	const slug = `${repo.owner}/${repo.repo}`;
	const mk = (kind: "releases" | "commits", name: string): RssSource => ({
		id: `rss-gh-${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
		name,
		url: `${base}/${kind}.atom`,
	});
	const out: RssSource[] = [];
	if (type === "releases" || type === "both") {
		out.push(
			mk("releases", t().editors.rss.githubReleasesName.replace("{repo}", slug)),
		);
	}
	if (type === "commits" || type === "both") {
		out.push(
			mk("commits", t().editors.rss.githubCommitsName.replace("{repo}", slug)),
		);
	}
	return out;
}

export interface CardSettingsOptions {
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
		cardDefinition(card).editorTypeNote?.(containerEl);

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
				.setDynamicTooltip()
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
				.setDynamicTooltip()
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


// ---- Per-kind card editors (issue #103) --------------------------------
// Lifted out of CardSettingsModal so each card kind's Content-tab controls
// can be owned by its module. Each takes a CardEditorContext instead of the
// modal's `this`. Phase B relocates these into src/cards/<kind>/.

export function embedEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const setting = new Setting(containerEl)
		.setName(t().editors.embed.file)
		.setDesc(t().editors.embed.fileDesc);
	setting.addText((txt) =>
		txt
			.setPlaceholder(t().editors.embed.filePlaceholder)
			.setValue(card.target ?? "")
			.onChange((v) => {
				setPrimaryEmbedTarget(ctx, v);
			}),
	);
	setting.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.embed.pickFile)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					setPrimaryEmbedTarget(ctx, file.path, true);
				}).open();
			}),
	);
	baseViewSetting(
		ctx,
		containerEl,
		card.target,
		() => card.baseView,
		(v) => {
			card.baseView = v;
			ctx.opts.save();
		},
	);
	new Setting(containerEl)
		.setName(t().editors.embed.zoom)
		.setDesc(t().editors.embed.zoomDesc)
		.addSlider((s) => {
			s.setLimits(50, 200, 10)
				.setValue(Math.round((card.scale ?? 1) * 100))
				.setDynamicTooltip()
				.onChange((v) => {
					card.scale = v === 100 ? undefined : v / 100;
					ctx.opts.save();
				});
		})
		.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.scale = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	new Setting(containerEl)
		.setName(t().editors.embed.editable)
		.setDesc(t().editors.embed.editableDesc)
		.addToggle((tg) =>
			tg.setValue(card.editable ?? false).onChange((v) => {
				card.editable = v || undefined;
				ctx.opts.save();
			}),
		);
	// Hide-base-header is only relevant to .base embeds; shown when either
	// view targets one.
	if (isBaseTarget(card.target) || isBaseTarget(card.secondView?.target)) {
		new Setting(containerEl)
			.setName(t().editors.embed.hideBaseHeader)
			.setDesc(t().editors.embed.hideBaseHeaderDesc)
			.addToggle((tg) =>
				tg.setValue(card.hideBaseHeader ?? false).onChange((v) => {
					card.hideBaseHeader = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}
	embedSecondView(ctx, containerEl);
}

export function dailyEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	new Setting(containerEl)
		.setName(t().editors.daily.editable)
		.setDesc(t().editors.daily.editableDesc)
		.addToggle((tg) =>
			tg.setValue(card.editable ?? false).onChange((v) => {
				card.editable = v || undefined;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.daily.openButton)
		.setDesc(t().editors.daily.openButtonDesc)
		.addToggle((tg) =>
			tg.setValue(card.showOpenButton !== false).onChange((v) => {
				card.showOpenButton = v ? undefined : false;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.daily.info)
		.setDesc(t().editors.daily.infoDesc);
}

export function webEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	new Setting(containerEl).setName(t().editors.web.url).addText((txt) =>
		txt
			.setPlaceholder(t().editors.web.urlPlaceholder)
			.setValue(card.url ?? "")
			.onChange((v) => {
				card.url = v;
				ctx.opts.save();
			}),
	);
	new Setting(containerEl)
		.setName(t().editors.web.trusted)
		.setDesc(t().editors.web.trustedDesc)
		.addToggle((tg) =>
			tg.setValue(card.sandboxTrusted ?? false).onChange((v) => {
				card.sandboxTrusted = v || undefined;
				ctx.opts.save();
			}),
		);
	refreshSetting(ctx, containerEl);
}

export function recentEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const recent = new Setting(containerEl)
		.setName(t().editors.recent.count)
		.setDesc(t().editors.recent.countDesc);
	recent.addText((txt) => {
		txt.setValue(String(card.count ?? 8)).onChange((v) => {
			const n = parseInt(v, 10);
			card.count = Number.isNaN(n) ? undefined : n;
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, recent, t().settings.resetField, () => {
		card.count = undefined;
	});
	recentTypesEditor(ctx, containerEl, card);
}

/** The performance note shown under the type dropdown for the leaf card. */
export function leafTypeNote(containerEl: HTMLElement): void {
	const note = new Setting(containerEl).setDesc(t().editors.leaf.perfNote);
	note.settingEl.addClass("hearth-setting-note");
	const icon = createSpan("hearth-setting-note-icon");
	setIcon(icon, "gauge");
	note.descEl.prepend(icon);
}

	/** Pick which registered side-panel view the "leaf" card hosts. The dropdown
	 * lists every hostable view type found in the app right now (core panes plus
	 * whatever community plugins have registered), so the choices depend on which
	 * plugins are enabled. */
export function leafEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.leafView ??= {});
	const types = listLeafViewTypes(ctx.app);

	const setting = new Setting(containerEl)
		.setName(t().editors.leaf.view)
		.setDesc(t().editors.leaf.viewDesc);

	if (types.length === 0) {
		setting.setDesc(t().editors.leaf.none);
		return;
	}

	setting.addDropdown((d) => {
		d.addOption("", t().editors.leaf.pickPlaceholder);
		for (const vt of types) d.addOption(vt.type, vt.name);
		// Keep a previously-chosen view selectable even if its plugin is now
		// disabled, so switching the plugin back on restores the card as-is.
		const current = cfg.viewType?.trim();
		if (current && !types.some((vt) => vt.type === current)) {
			d.addOption(current, current);
		}
		d.setValue(current ?? "").onChange((v) => {
			cfg.viewType = v || undefined;
			// A file chosen for the old view can't be shown by the new one and
			// makes file-backed views throw, so drop it when the view changes.
			cfg.file = undefined;
			ctx.opts.save();
			ctx.requestRender();
			ctx.opts.rerender();
		});
	});

	const fileSetting = new Setting(containerEl)
		.setName(t().editors.leaf.file)
		.setDesc(t().editors.leaf.fileDesc);
	fileSetting.addText((txt) =>
		txt
			.setPlaceholder(t().editors.leaf.filePlaceholder)
			.setValue(cfg.file ?? "")
			.onChange((v) => {
				const trimmed = v.trim();
				cfg.file = trimmed || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
	);
	fileSetting.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.leaf.pickFile)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					cfg.file = file.path;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}).open();
			}),
	);
	if (cfg.file) {
		fileSetting.addExtraButton((b) =>
			b
				.setIcon("x")
				.setTooltip(t().editors.leaf.clearFile)
				.onClick(() => {
					cfg.file = undefined;
					ctx.opts.save();
					ctx.requestRender();
					ctx.opts.rerender();
				}),
		);
	}

	new Setting(containerEl)
		.setName(t().editors.leaf.hideHeader)
		.setDesc(t().editors.leaf.hideHeaderDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.hideHeader ?? false).onChange((v) => {
				cfg.hideHeader = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);

	new Setting(containerEl)
		.setName(t().editors.leaf.note)
		.setDesc(t().editors.leaf.noteDesc);
}

export function setPrimaryEmbedTarget(ctx: CardEditorContext, value: string, rerender = false): void {
	const previousTarget = ctx.card.target?.trim() ?? "";
	const nextTarget = value.trim();
	const wasBase = isBaseTarget(previousTarget);
	const isBase = isBaseTarget(nextTarget);
	const targetChanged = nextTarget !== previousTarget;
	ctx.card.target = value;
	if (!isBase || targetChanged) ctx.card.baseView = undefined;
	ctx.opts.save();
	if (rerender || wasBase !== isBase || (isBase && targetChanged))
		ctx.requestRender();
}

export function baseViewSetting(ctx: CardEditorContext, 
	containerEl: HTMLElement,
	target: string | undefined,
	getBaseView: () => string | undefined,
	setBaseView: (value: string | undefined) => void,
): void {
	if (!isBaseTarget(target)) return;

	const setting = new Setting(containerEl)
		.setName(t().editors.embed.baseView)
		.setDesc(t().editors.embed.baseViewDesc);

	setting.addDropdown((dropdown) => {
		const selected = getBaseView()?.trim() ?? "";
		dropdown.addOption("", t().editors.embed.baseViewDefault);
		if (selected) dropdown.addOption(selected, selected);
		dropdown.setValue(selected).onChange((value) => {
			setBaseView(value || undefined);
		});

		void listBaseViews(ctx.app, target).then((result) => {
			if (!setting.settingEl.isConnected) return;

			const safeViews = result.views
				.filter((view) => view.embeddable)
				.map((view) => view.name);
			while (dropdown.selectEl.firstChild)
				dropdown.selectEl.removeChild(dropdown.selectEl.firstChild);
			dropdown.addOption("", t().editors.embed.baseViewDefault);
			for (const viewName of safeViews)
				dropdown.addOption(viewName, viewName);

			const current = getBaseView()?.trim() ?? "";
			if (!result.error && current && !safeViews.includes(current)) {
				setBaseView(undefined);
				dropdown.setValue("");
			} else {
				dropdown.setValue(current);
			}

			const unsupportedCount = result.views.length - safeViews.length;
			if (result.error === "not-found") {
				setting.setDesc(t().editors.embed.baseViewFileMissing);
			} else if (result.error) {
				setting.setDesc(t().editors.embed.baseViewLoadError);
			} else if (result.views.length === 0) {
				setting.setDesc(t().editors.embed.baseViewNoViews);
			} else if (unsupportedCount > 0) {
				setting.setDesc(
					t().editors.embed.baseViewUnsupported(unsupportedCount),
				);
			}
		});
	});
}

/** Second-view controls for an embed card: pick a second file to embed, and
 * (once one is set) its own zoom and editable options. When set, the card
 * shows a switcher between the two views. */
export function embedSecondView(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;

	new Setting(containerEl)
		.setName(t().editors.embed.secondViewHeading)
		.setHeading();

	const setting = new Setting(containerEl)
		.setName(t().editors.embed.secondViewFile)
		.setDesc(t().editors.embed.secondViewFileDesc);
	setting.addText((txt) =>
		txt
			.setPlaceholder(t().editors.embed.filePlaceholder)
			.setValue(card.secondView?.target ?? "")
			.onChange((v) => {
				setSecondViewTarget(ctx, v);
			}),
	);
	setting.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.embed.pickFile)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					setSecondViewTarget(ctx, file.path, true);
				}).open();
			}),
	);
	if (card.secondView?.target) {
		setting.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.embed.secondViewClear)
				.onClick(() => {
					card.secondView = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}

	// Zoom and editable mirror the primary embed's options, but only make
	// sense once a second file is chosen.
	if (card.secondView?.target) {
		const view = card.secondView;
		baseViewSetting(ctx, 
			containerEl,
			view.target,
			() => view.baseView,
			(v: string | undefined) => {
				view.baseView = v;
				ctx.opts.save();
			},
		);
		new Setting(containerEl)
			.setName(t().editors.embed.zoom)
			.setDesc(t().editors.embed.zoomDesc)
			.addSlider((s) => {
				s.setLimits(50, 200, 10)
					.setValue(Math.round((view.scale ?? 1) * 100))
					.setDynamicTooltip()
					.onChange((v) => {
						view.scale = v === 100 ? undefined : v / 100;
						ctx.opts.save();
					});
			})
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.resetSlider)
					.onClick(() => {
						view.scale = undefined;
						ctx.opts.save();
						ctx.requestRender();
					}),
			);
		new Setting(containerEl)
			.setName(t().editors.embed.editable)
			.setDesc(t().editors.embed.editableDesc)
			.addToggle((tg) =>
				tg.setValue(view.editable ?? false).onChange((v) => {
					view.editable = v || undefined;
					ctx.opts.save();
				}),
			);
	}
}

/** Set (or clear) the second view's embed target, creating the config object
 * on first use and dropping it entirely when emptied. */
export function setSecondViewTarget(ctx: CardEditorContext, value: string, rerender = false): void {
	const target = value.trim();
	const previousTarget = ctx.card.secondView?.target?.trim() ?? "";
	const targetChanged = target !== previousTarget;
	const wasBase = isBaseTarget(previousTarget);
	const isBase = isBaseTarget(target);
	if (!target) {
		ctx.card.secondView = undefined;
	} else {
		const next: EmbedView = { ...(ctx.card.secondView ?? {}) };
		next.target = target;
		if (!isBase || targetChanged) next.baseView = undefined;
		ctx.card.secondView = next;
	}
	ctx.opts.save();
	if (rerender || wasBase !== isBase || (isBase && targetChanged))
		ctx.requestRender();
}

export function dataviewEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.dataview ??= {});
	new Setting(containerEl)
		.setName(t().editors.dataview.language)
		.setDesc(t().editors.dataview.languageDesc)
		.addDropdown((d) => {
			d.addOption("dql", t().editors.dataview.languageDql);
			d.addOption("js", t().editors.dataview.languageJs);
			d.setValue(cfg.language ?? "dql").onChange((v) => {
				cfg.language = v === "js" ? "js" : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});
	const isJs = cfg.language === "js";
	const query = new Setting(containerEl)
		.setName(t().editors.dataview.query)
		.setDesc(
			isJs
				? t().editors.dataview.queryJsDesc
				: t().editors.dataview.queryDqlDesc,
		);
	query.addTextArea((txt) => {
		txt
			.setPlaceholder(
				isJs
					? t().editors.dataview.queryJsPlaceholder
					: t().editors.dataview.queryDqlPlaceholder,
			)
			.setValue(cfg.query ?? "")
			.onChange((v) => {
				cfg.query = v;
				ctx.opts.save();
			});
		txt.inputEl.rows = 6;
		txt.inputEl.addClass("hearth-dataview-input");
	});
	query.settingEl.addClass("hearth-setting-stacked");
}

export function rssEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.rss ??= {});
	const sources = (cfg.sources ??= []);

	new Setting(containerEl).setName(t().editors.rss.feeds).setHeading();

	sources.forEach((source, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.rss.namePlaceholder)
				.setValue(source.name)
				.onChange((v) => {
					source.name = v;
					ctx.opts.save();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.rss.urlPlaceholder)
				.setValue(source.url)
				.onChange((v) => {
					source.url = v.trim();
					ctx.opts.save();
					ctx.opts.rerender();
				});
			txt.inputEl.addClass("hearth-rss-url");
		});
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, sources, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === sources.length - 1)
				.onClick(() => moveItem(ctx, sources, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.rss.removeFeed)
				.onClick(() => {
					sources.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.rss.addFeed).onClick(() => {
			sources.push({
				id: `rss-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
				name: "",
				url: "",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);

	githubFeedAdder(ctx, containerEl, sources);

	if (sources.length > 1) {
		new Setting(containerEl)
			.setName(t().editors.rss.mergeAll)
			.setDesc(t().editors.rss.mergeAllDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.mergeAll ?? false).onChange((v) => {
					cfg.mergeAll = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	new Setting(containerEl).setName(t().editors.rss.display).setHeading();

	new Setting(containerEl)
		.setName(t().editors.rss.layout)
		.setDesc(t().editors.rss.layoutDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.rss.layoutList);
			d.addOption("cards", t().editors.rss.layoutCards);
			d.addOption("compact", t().editors.rss.layoutCompact);
			d.setValue(cfg.layout ?? "list").onChange((v) => {
				cfg.layout = v === "list" ? undefined : (v as RssLayout);
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			});
		});

	const items = new Setting(containerEl)
		.setName(t().editors.rss.itemLimit)
		.setDesc(t().editors.rss.itemLimitDesc);
	items.addSlider((s) => {
		s.setLimits(3, 50, 1)
			.setValue(cfg.itemLimit ?? 15)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.itemLimit = v === 15 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	items.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.itemLimit = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	const refresh = new Setting(containerEl)
		.setName(t().editors.rss.refresh)
		.setDesc(t().editors.rss.refreshDesc);
	refresh.addSlider((s) => {
		s.setLimits(0, 180, 5)
			.setValue(cfg.refreshMin ?? 30)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.refreshMin = v === 30 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	const isCards = (cfg.layout ?? "list") === "cards";
	if (isCards) {
		new Setting(containerEl)
			.setName(t().editors.rss.showImages)
			.setDesc(t().editors.rss.showImagesDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.showImages !== false).onChange((v) => {
					cfg.showImages = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
		new Setting(containerEl)
			.setName(t().editors.rss.showExcerpt)
			.setDesc(t().editors.rss.showExcerptDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.showExcerpt !== false).onChange((v) => {
					cfg.showExcerpt = v ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	new Setting(containerEl)
		.setName(t().editors.rss.showDate)
		.setDesc(t().editors.rss.showDateDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.showDate !== false).onChange((v) => {
				cfg.showDate = v ? undefined : false;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
}

/** Quick-add helper: turn an `owner/repo` (or a GitHub URL) into RSS sources
 * pointing at GitHub's built-in `releases.atom` / `commits.atom` feeds, so
 * the user never has to hand-write those URLs. */
export function githubFeedAdder(ctx: CardEditorContext, containerEl: HTMLElement, sources: RssSource[]): void {
	const setting = new Setting(containerEl)
		.setName(t().editors.rss.github)
		.setDesc(t().editors.rss.githubDesc)
		.setClass("hearth-rss-github");

	setting.addText((txt) => {
		txt
			.setPlaceholder(t().editors.rss.githubPlaceholder)
			.setValue((ctx.session.ghRepo as string) ?? "")
			.onChange((v) => {
				ctx.session.ghRepo = v;
			});
		txt.inputEl.addClass("hearth-rss-github-repo");
	});

	setting.addDropdown((d) => {
		d.addOption("releases", t().editors.rss.githubReleases);
		d.addOption("commits", t().editors.rss.githubCommits);
		d.addOption("both", t().editors.rss.githubBoth);
		d.setValue((ctx.session.ghFeedType as string) ?? "releases").onChange((v) => {
			ctx.session.ghFeedType = v;
		});
	});

	setting.addButton((b) =>
		b
			.setButtonText(t().editors.rss.githubAdd)
			.setCta()
			.onClick(() => {
				const repo = parseGithubRepo((ctx.session.ghRepo as string) ?? "");
				if (!repo) {
					new Notice(t().editors.rss.githubInvalid);
					return;
				}
				sources.push(
					...githubFeedSources(
						repo,
						(ctx.session.ghFeedType as "releases" | "commits" | "both") ?? "releases",
					),
				);
				ctx.session.ghRepo = "";
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);
}

export function calculatorEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.calculator ??= {});
	new Setting(containerEl)
		.setName(t().editors.calculator.angleUnit)
		.setDesc(t().editors.calculator.angleUnitDesc)
		.addDropdown((d) => {
			d.addOption("deg", t().editors.calculator.degrees);
			d.addOption("rad", t().editors.calculator.radians);
			d.setValue(cfg.angleUnit ?? "deg").onChange((v) => {
				cfg.angleUnit = v === "rad" ? "rad" : undefined;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	new Setting(containerEl)
		.setName(t().editors.calculator.keypad)
		.setDesc(t().editors.calculator.keypadDesc)
		.addDropdown((d) => {
			d.addOption("none", t().editors.calculator.keypadNone);
			d.addOption("basic", t().editors.calculator.keypadBasic);
			d.addOption("scientific", t().editors.calculator.keypadScientific);
			d.setValue(cfg.keypad ?? "none").onChange((v) => {
				cfg.keypad = v === "none" ? undefined : (v as "basic" | "scientific");
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
}

export function calendarEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.calendar ??= {});
	new Setting(containerEl)
		.setName(t().editors.calendar.view)
		.setDesc(t().editors.calendar.viewDesc)
		.addDropdown((d) => {
			d.addOption("month", t().editors.calendar.viewMonth);
			d.addOption("agenda", t().editors.calendar.viewAgenda);
			d.setValue(cfg.view ?? "month").onChange((v) => {
				cfg.view = v === "agenda" ? "agenda" : undefined;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
	if (cfg.view === "agenda") {
		const days = new Setting(containerEl)
			.setName(t().editors.calendar.agendaDays)
			.setDesc(t().editors.calendar.agendaDaysDesc);
		days.addSlider((s) => {
			s.setLimits(3, 60, 1)
				.setValue(cfg.agendaDays ?? 14)
				.setDynamicTooltip()
				.onChange((v) => {
					cfg.agendaDays = v === 14 ? undefined : v;
					ctx.opts.save();
				});
		});
		days.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					cfg.agendaDays = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	} else {
		new Setting(containerEl)
			.setName(t().editors.calendar.weekNumbers)
			.setDesc(t().editors.calendar.weekNumbersDesc)
			.addToggle((t) =>
				t.setValue(cfg.showWeekNumbers ?? false).onChange((v) => {
					cfg.showWeekNumbers = v || undefined;
					ctx.opts.save();
				}),
			);
	}
	new Setting(containerEl)
		.setName(t().editors.calendar.heatmap)
		.setDesc(t().editors.calendar.heatmapDesc)
		.addToggle((t) =>
			t.setValue(cfg.heatmap ?? false).onChange((v) => {
				cfg.heatmap = v || undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (cfg.heatmap) {
		new Setting(containerEl)
			.setName(t().editors.calendar.heatmapCounts)
			.addDropdown((d) => {
				d.addOption("modified", t().editors.metricOptions.modified);
				d.addOption("created", t().editors.metricOptions.created);
				d.setValue(cfg.heatmapMetric ?? "modified").onChange((v) => {
					cfg.heatmapMetric = v as NonNullable<typeof cfg.heatmapMetric>;
					ctx.opts.save();
				});
			});
	}

	calendarSourcesEditor(ctx, containerEl, cfg);
}

/** The "External calendars" section of the calendar editor: subscribe to one
 * or more ICS/iCal feeds (name, URL, colour, enable toggle) overlaid on the
 * card, plus their shared auto-refresh interval. */
export function calendarSourcesEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: CalendarConfig): void {
	const sources = (cfg.sources ??= []);

	new Setting(containerEl).setName(t().editors.calendar.externalCalendars).setHeading();
	new Setting(containerEl).setDesc(t().editors.calendar.externalCalendarsDesc);

	sources.forEach((source, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.calendar.sourceNamePlaceholder)
				.setValue(source.name)
				.onChange((v) => {
					source.name = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.calendar.sourceUrlPlaceholder)
				.setValue(source.url)
				.onChange((v) => {
					source.url = v.trim();
					ctx.opts.save();
					ctx.opts.rerender();
				});
			txt.inputEl.addClass("hearth-rss-url");
		});
		row.addColorPicker((c) =>
			c.setValue(source.color ?? "#7c6cff").onChange((v) => {
				source.color = v;
				ctx.opts.save();
				ctx.opts.rerender();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon(source.enabled === false ? "eye-off" : "eye")
				.setTooltip(
					source.enabled === false
						? t().editors.calendar.sourceShow
						: t().editors.calendar.sourceHide,
				)
				.onClick(() => {
					source.enabled = source.enabled === false ? undefined : false;
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, sources, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === sources.length - 1)
				.onClick(() => moveItem(ctx, sources, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.calendar.sourceRemove)
				.onClick(() => {
					sources.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.calendar.addCalendar).onClick(() => {
			sources.push({
				id: `ics-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
				name: "",
				url: "",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);

	if (sources.length === 0) return;

	const refresh = new Setting(containerEl)
		.setName(t().editors.calendar.refresh)
		.setDesc(t().editors.calendar.refreshDesc);
	refresh.addSlider((s) => {
		s.setLimits(0, 180, 5)
			.setValue(cfg.refreshMin ?? 60)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.refreshMin = v === 60 ? undefined : v;
				ctx.opts.save();
				ctx.opts.rerender();
			});
	});
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				ctx.requestRender();
			}),
	);

	eventNoteEditor(ctx, containerEl, cfg);
}

/** The "Event notes" section: configure the modal's Create-note action —
 * template, folder, filename, link property, and per-field routing so the
 * user decides what each event value becomes in the new note. */
export function eventNoteEditor(ctx: CardEditorContext, containerEl: HTMLElement, cfg: CalendarConfig): void {
	const note = (cfg.eventNote ??= {});

	new Setting(containerEl).setName(t().editors.calendar.eventNoteHeading).setHeading();
	new Setting(containerEl).setDesc(t().editors.calendar.eventNoteDesc);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteEnabled)
		.setDesc(t().editors.calendar.eventNoteEnabledDesc)
		.addToggle((tg) =>
			tg.setValue(note.enabled !== false).onChange((v) => {
				note.enabled = v ? undefined : false;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);
	if (note.enabled === false) return;

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteFolder)
		.setDesc(t().editors.calendar.eventNoteFolderDesc)
		.addText((txt) =>
			txt.setValue(note.folder ?? "").onChange((v) => {
				note.folder = v.trim() || undefined;
				ctx.opts.save();
			}),
		);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteFilename)
		.setDesc(t().editors.calendar.eventNoteFilenameDesc)
		.addText((txt) =>
			txt
				.setPlaceholder("{{summary}}")
				.setValue(note.filename ?? "")
				.onChange((v) => {
					note.filename = v.trim() || undefined;
					ctx.opts.save();
				}),
		);

	const template = new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteTemplate)
		.setDesc(t().editors.calendar.eventNoteTemplateDesc);
	template.addText((txt) => {
		txt.setValue(note.template ?? "").onChange((v) => {
			note.template = v.trim() || undefined;
			ctx.opts.save();
		});
		txt.inputEl.addClass("hearth-rss-url");
	});
	template.addExtraButton((b) =>
		b
			.setIcon("file-symlink")
			.setTooltip(t().editors.calendar.eventNotePickTemplate)
			.onClick(() => {
				new FilePickerModal(ctx.app, (file) => {
					note.template = file.path;
					ctx.opts.save();
					ctx.requestRender();
				}).open();
			}),
	);
	template.addExtraButton((b) =>
		b
			.setIcon("x")
			.setTooltip(t().editors.calendar.eventNoteClearTemplate)
			.onClick(() => {
				note.template = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteLinkKey)
		.setDesc(t().editors.calendar.eventNoteLinkKeyDesc)
		.addText((txt) =>
			txt
				.setPlaceholder("event_uid")
				.setValue(note.linkKey ?? "")
				.onChange((v) => {
					// Distinguish "unset (use default)" from "explicitly empty".
					note.linkKey = v === "" ? undefined : v.trim();
					ctx.opts.save();
				}),
		);

	new Setting(containerEl)
		.setName(t().editors.calendar.eventNoteCustomize)
		.setDesc(t().editors.calendar.eventNoteCustomizeDesc)
		.addToggle((tg) =>
			tg.setValue(note.fields !== undefined).onChange((v) => {
				note.fields = v ? DEFAULT_EVENT_NOTE_FIELDS.map((f) => ({ ...f })) : undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
		);

	if (note.fields) eventNoteFieldsEditor(ctx, containerEl, note);
}

/** The editable list of per-field routing rules (field → action → key/format). */
export function eventNoteFieldsEditor(ctx: CardEditorContext, containerEl: HTMLElement, note: EventNoteConfig): void {
	const rules = (note.fields ??= []);
	const fieldNames = t().editors.calendar.eventFieldNames;
	const actionNames = t().editors.calendar.eventFieldActions;
	const fieldOrder: EventField[] = [
		"summary",
		"date",
		"start",
		"end",
		"location",
		"description",
		"url",
		"calendar",
	];

	new Setting(containerEl).setName(t().editors.calendar.eventNoteFieldsHeading).setHeading();

	rules.forEach((rule, index) => {
		const row = new Setting(containerEl).setClass("hearth-rss-setting");
		row.addDropdown((d) => {
			for (const f of fieldOrder) d.addOption(f, fieldNames[f]);
			d.setValue(rule.field).onChange((v) => {
				rule.field = v as EventField;
				ctx.opts.save();
			});
		});
		row.addDropdown((d) => {
			d.addOption("ignore", actionNames.ignore);
			d.addOption("frontmatter", actionNames.frontmatter);
			d.addOption("body", actionNames.body);
			d.setValue(rule.action).onChange((v) => {
				rule.action = v as EventFieldAction;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
		if (rule.action !== "ignore") {
			row.addText((txt) => {
				txt
					.setPlaceholder(
						rule.action === "frontmatter"
							? t().editors.calendar.eventNotePropertyPlaceholder
							: t().editors.calendar.eventNoteHeadingPlaceholder,
					)
					.setValue(rule.key ?? "")
					.onChange((v) => {
						rule.key = v.trim() || undefined;
						ctx.opts.save();
					});
			});
		}
		if (rule.action === "frontmatter" && ["date", "start", "end"].includes(rule.field)) {
			row.addText((txt) => {
				txt
					.setPlaceholder(t().editors.calendar.eventNoteFormatPlaceholder)
					.setValue(rule.format ?? "")
					.onChange((v) => {
						rule.format = v.trim() || undefined;
						ctx.opts.save();
					});
				txt.inputEl.addClass("hearth-event-format");
			});
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, rules, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === rules.length - 1)
				.onClick(() => moveItem(ctx, rules, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.calendar.eventNoteRemoveField)
				.onClick(() => {
					rules.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.calendar.eventNoteAddField).onClick(() => {
			rules.push({ field: "location", action: "frontmatter" });
			ctx.opts.save();
			ctx.requestRender();
		}),
	);
}

export function heatmapEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.heatmap ??= {});
	new Setting(containerEl)
		.setName(t().editors.heatmap.metric)
		.addDropdown((d) => {
			d.addOption("modified", t().editors.metricOptions.modified);
			d.addOption("created", t().editors.metricOptions.created);
			d.setValue(cfg.metric ?? "modified").onChange((v) => {
				cfg.metric = v as NonNullable<typeof cfg.metric>;
				ctx.opts.save();
			});
		});
	const weeks = new Setting(containerEl)
		.setName(t().editors.heatmap.weeks)
		.setDesc(t().editors.heatmap.weeksDesc);
	weeks.addSlider((s) => {
		s.setLimits(8, 53, 1)
			.setValue(cfg.weeks ?? 26)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.weeks = v === 26 ? undefined : v;
				ctx.opts.save();
			});
	});
	weeks.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.weeks = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);
}

/**
 * The stats card is plain by default — a fixed set of tiles, no controls. An
 * "Advanced" toggle unlocks the rest: choosing which built-in stats show,
 * breaking attachments out into per-file-type tiles, and custom query counts.
 * Everything below the toggle is gated on it, so a basic card stays basic.
 */
export function statsEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.stats ??= {});

	new Setting(containerEl)
		.setName(t().editors.stats.advanced)
		.setDesc(t().editors.stats.advancedDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.advanced ?? false).onChange((v) => {
				cfg.advanced = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				// Show/hide the advanced controls below.
				ctx.requestRender();
			}),
		);

	if (!cfg.advanced) return;

	// ---- Which built-in stats to show --------------------------------------
	new Setting(containerEl).setName(t().editors.stats.builtins).setHeading();
	const builtinSetting = new Setting(containerEl).setDesc(t().editors.stats.builtinsDesc);
	addResetButton(ctx, builtinSetting, t().settings.resetField, () => {
		cfg.builtins = undefined;
	});
	const selectedBuiltins = new Set<StatId>(cfg.builtins ?? DEFAULT_STATS);
	const builtinRow = containerEl.createDiv("hearth-type-filter");
	for (const id of ALL_STATS) {
		const chip = builtinRow.createDiv("hearth-type-filter-chip");
		const on = selectedBuiltins.has(id);
		chip.toggleClass("is-active", on);
		setIcon(chip.createDiv("hearth-type-filter-icon"), STAT_ICONS[id]);
		chip.createDiv({ cls: "hearth-type-filter-label", text: t().cards.stats[id] });
		chip.setAttribute("role", "button");
		chip.setAttribute("tabindex", "0");
		chip.setAttribute("aria-pressed", String(on));
		const toggle = () => {
			if (selectedBuiltins.has(id)) selectedBuiltins.delete(id);
			else selectedBuiltins.add(id);
			const active = selectedBuiltins.has(id);
			chip.toggleClass("is-active", active);
			chip.setAttribute("aria-pressed", String(active));
			// Keep the canonical order and collapse "exactly the default set"
			// back to undefined so the card reads as unconfigured. Compared
			// element-wise (not by length) since an optional stat can stand in
			// for a deselected default at the same count.
			const ordered = ALL_STATS.filter((s) => selectedBuiltins.has(s));
			const isDefault =
				ordered.length === DEFAULT_STATS.length &&
				ordered.every((s, i) => s === DEFAULT_STATS[i]);
			cfg.builtins = isDefault ? undefined : ordered;
			ctx.opts.save();
			ctx.opts.rerender();
		};
		chip.addEventListener("click", toggle);
		chip.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		});
	}

	// ---- Attachment breakdown by file type ---------------------------------
	new Setting(containerEl).setName(t().editors.stats.attachmentTypes).setHeading();
	const attachSetting = new Setting(containerEl).setDesc(t().editors.stats.attachmentTypesDesc);
	addResetButton(ctx, attachSetting, t().settings.resetField, () => {
		cfg.attachmentTypes = undefined;
	});
	const selectedTypes = new Set(cfg.attachmentTypes ?? []);
	const typeRow = containerEl.createDiv("hearth-type-filter");
	// Attachments are non-note files, so offer every file-type group except
	// folders and markdown notes.
	const groups = FILE_TYPE_GROUPS.filter(
		(g) => g.id !== FOLDERS_GROUP_ID && g.id !== "markdown",
	);
	for (const group of groups) {
		const chip = typeRow.createDiv("hearth-type-filter-chip");
		const on = selectedTypes.has(group.id);
		chip.toggleClass("is-active", on);
		setIcon(chip.createDiv("hearth-type-filter-icon"), group.icon);
		chip.createDiv({ cls: "hearth-type-filter-label", text: fileTypeLabel(group) });
		chip.setAttribute("role", "button");
		chip.setAttribute("tabindex", "0");
		chip.setAttribute("aria-pressed", String(on));
		const toggle = () => {
			if (selectedTypes.has(group.id)) selectedTypes.delete(group.id);
			else selectedTypes.add(group.id);
			const active = selectedTypes.has(group.id);
			chip.toggleClass("is-active", active);
			chip.setAttribute("aria-pressed", String(active));
			cfg.attachmentTypes = selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		};
		chip.addEventListener("click", toggle);
		chip.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		});
	}

	// ---- Custom query counts ------------------------------------------------
	new Setting(containerEl).setName(t().editors.stats.customCounts).setHeading();
	new Setting(containerEl).setDesc(t().editors.stats.customCountsDesc);
	const queries = (cfg.queries ??= []);
	queries.forEach((q, index) => {
		const row = new Setting(containerEl).setClass("hearth-link-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.stats.labelPlaceholder)
				.setValue(q.label ?? "")
				.onChange((v) => {
					q.label = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.stats.iconPlaceholder)
				.setValue(q.icon ?? "")
				.onChange((v) => {
					q.icon = v || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.stats.queryPlaceholder)
				.setValue(q.query)
				.onChange((v) => {
					q.query = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, queries, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === queries.length - 1)
				.onClick(() => moveItem(ctx, queries, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.stats.removeCount)
				.onClick(() => {
					queries.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});
	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.stats.addCount).onClick(() => {
			queries.push({
				id: `stat-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
				query: "",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);
}

export function savedSearchEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.savedSearch ??= {});
	new Setting(containerEl)
		.setName(t().editors.savedSearch.query)
		.setDesc(t().editors.savedSearch.queryDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(t().editors.savedSearch.queryPlaceholder)
				.setValue(cfg.query ?? "")
				.onChange((v) => {
					cfg.query = v;
					ctx.opts.save();
				}),
		);
	new Setting(containerEl)
		.setName(t().editors.savedSearch.display)
		.setDesc(t().editors.savedSearch.displayDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.savedSearch.displayList);
			d.addOption("tiles", t().editors.savedSearch.displayTiles);
			d.setValue(cfg.view ?? "list").onChange((v) => {
				cfg.view = v === "list" ? undefined : (v as "tiles");
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
	const maxResults = new Setting(containerEl)
		.setName(t().editors.savedSearch.maxResults)
		.setDesc(t().editors.savedSearch.maxResultsDesc);
	maxResults.addText((t) => {
		t.setValue(String(cfg.count ?? 12)).onChange((v) => {
			const n = parseInt(v, 10);
			cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		t.inputEl.type = "number";
		t.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, maxResults, t().settings.resetField, () => {
		cfg.count = undefined;
	});
}

export function jiraEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.jira ??= {});
	const strings = t().editors.jira;

	new Setting(containerEl)
		.setName(strings.host)
		.setDesc(strings.hostDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.hostPlaceholder)
				.setValue(cfg.host ?? "")
				.onChange((value) => {
					const next = value.trim() || undefined;
					if (next !== cfg.host) clearJiraCache(cfg);
					cfg.host = next;
					ctx.opts.save();
				}),
		);

	new Setting(containerEl)
		.setName(strings.pat)
		.setDesc(strings.patDesc)
		.addText((txt) => {
			txt.setValue(cfg.pat ?? "").onChange((value) => {
				// SECURITY-REVIEW: PAT remains in the password control and per-card
				// plugin data; it is never displayed elsewhere or logged.
				const next = value || undefined;
				if (next !== cfg.pat) clearJiraCache(cfg);
				cfg.pat = next;
				ctx.opts.save();
			});
			txt.inputEl.type = "password";
			txt.inputEl.autocomplete = "off";
		});

	new Setting(containerEl)
		.setName(strings.apiBase)
		.setDesc(strings.apiBaseDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.apiBasePlaceholder)
				.setValue(cfg.apiBasePath ?? "/rest/api/latest")
				.onChange((value) => {
					const next = value.trim() || undefined;
					if (next !== cfg.apiBasePath) clearJiraCache(cfg);
					cfg.apiBasePath = next;
					ctx.opts.save();
				}),
		);

	const filterSetting = new Setting(containerEl)
		.setName(strings.savedFilter)
		.setDesc(
			ctx.opts.externalCallsDisabled
				? strings.externalCallsDisabled
				: cfg.filterName
				? strings.selectedFilter(cfg.filterName)
				: strings.savedFilterDesc,
		);
	let filterSelect: HTMLSelectElement | null = null;
	filterSetting.addButton((button) =>
		button
			.setButtonText(strings.loadFilters)
			.setDisabled(ctx.opts.externalCallsDisabled)
			.onClick(async () => {
				if (ctx.opts.externalCallsDisabled) return;
				const version = ((ctx.session.jiraLoadVersion as number) ?? 0) + 1;
					ctx.session.jiraLoadVersion = version;
				button.setDisabled(true);
				filterSelect?.remove();
				filterSelect = null;
				try {
					const filters = await listJiraFilters(cfg);
					if (
						version !== ctx.session.jiraLoadVersion ||
						!filterSetting.settingEl.isConnected
					) {
						return;
					}
					if (!filters.length) {
						new Notice(strings.noFavoriteFilters);
						return;
					}
					filterSetting.addDropdown((dropdown) => {
						filterSelect = dropdown.selectEl;
						dropdown.addOption("", strings.chooseFilter);
						for (const filter of filters) {
							dropdown.addOption(filter.id, filter.name);
						}
						dropdown.setValue(cfg.filterId ?? "").onChange((id) => {
							const selected = filters.find((filter) => filter.id === id);
							cfg.filterId = selected?.id;
							cfg.filterName = selected?.name;
							cfg.selections = {};
							ctx.opts.save();
							ctx.opts.rerender();
							ctx.requestRender();
						});
					});
				} catch {
					if (
						version === ctx.session.jiraLoadVersion &&
						filterSetting.settingEl.isConnected
					) {
						new Notice(strings.loadFailed);
					}
				} finally {
					if (
						version === ctx.session.jiraLoadVersion &&
						filterSetting.settingEl.isConnected
					) {
						button.setDisabled(false);
					}
				}
			}),
	);

	new Setting(containerEl).setName(strings.controls).setHeading();
	const enabled = new Set<JiraControl>(cfg.controls ?? JIRA_CONTROLS);
	for (const control of JIRA_CONTROLS) {
		new Setting(containerEl)
			.setName(t().cards.jira.controls[control])
			.addToggle((toggle) =>
				toggle.setValue(enabled.has(control)).onChange((value) => {
					if (value) enabled.add(control);
					else enabled.delete(control);
					cfg.controls = JIRA_CONTROLS.filter((item) => enabled.has(item));
					ctx.opts.save();
					ctx.opts.rerender();
				}),
			);
	}

	const maxResults = new Setting(containerEl)
		.setName(strings.maxResults)
		.setDesc(strings.maxResultsDesc);
	maxResults.addText((txt) => {
		txt.setValue(String(cfg.maxResults ?? 50)).onChange((value) => {
			const parsed = parseInt(value, 10);
			cfg.maxResults =
				Number.isNaN(parsed) || parsed <= 0
					? undefined
					: Math.min(200, parsed);
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.min = "1";
		txt.inputEl.max = "200";
		txt.inputEl.addClass("hearth-count-input");
	});

	const numberSetting = (
		name: string,
		description: string,
		value: number,
		update: (next: number | undefined) => void,
	): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((txt) => {
				txt.setValue(String(value)).onChange((raw) => {
					const parsed = parseInt(raw, 10);
					update(Number.isNaN(parsed) || parsed < 0 ? undefined : parsed);
					ctx.opts.save();
				});
				txt.inputEl.type = "number";
				txt.inputEl.min = "0";
				txt.inputEl.addClass("hearth-count-input");
			});
	};
	numberSetting(
		strings.refresh,
		strings.refreshDesc,
		cfg.refreshMin ?? 0,
		(value) => {
			cfg.refreshMin = value;
		},
	);
	numberSetting(strings.cache, strings.cacheDesc, cfg.cacheMin ?? 5, (value) => {
		cfg.cacheMin = value;
	});
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

/** File-type filter for the recent-files card: a row of toggleable chips
 * mirroring the search filter's types. Any combination may be selected; an
 * empty selection means every type is shown. */
export function recentTypesEditor(ctx: CardEditorContext, containerEl: HTMLElement, card: DashboardCard): void {
	const setting = new Setting(containerEl)
		.setName(t().editors.recent.types)
		.setDesc(t().editors.recent.typesDesc);
	addResetButton(ctx, setting, t().settings.resetField, () => {
		card.recentTypes = undefined;
	});

	const selected = new Set(card.recentTypes ?? []);
	const row = containerEl.createDiv("hearth-type-filter");
	// Folders can never appear among recently-opened files, so offer every
	// search-filter type except that one.
	const groups = FILE_TYPE_GROUPS.filter((g) => g.id !== FOLDERS_GROUP_ID);
	for (const group of groups) {
		const chip = row.createDiv("hearth-type-filter-chip");
		chip.toggleClass("is-active", selected.has(group.id));
		setIcon(chip.createDiv("hearth-type-filter-icon"), group.icon);
		chip.createDiv({ cls: "hearth-type-filter-label", text: fileTypeLabel(group) });
		chip.setAttribute("role", "button");
		chip.setAttribute("tabindex", "0");
		chip.setAttribute("aria-pressed", String(selected.has(group.id)));
		const toggle = () => {
			if (selected.has(group.id)) selected.delete(group.id);
			else selected.add(group.id);
			const on = selected.has(group.id);
			chip.toggleClass("is-active", on);
			chip.setAttribute("aria-pressed", String(on));
			card.recentTypes = selected.size > 0 ? Array.from(selected) : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		};
		chip.addEventListener("click", toggle);
		chip.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		});
	}
}

/** Move an item within a list, then persist and re-render the editor. */
export function moveItem<T>(ctx: CardEditorContext, arr: T[], from: number, to: number): void {
	if (to < 0 || to >= arr.length) return;
	const [item] = arr.splice(from, 1);
	arr.splice(to, 0, item);
	ctx.opts.save();
	ctx.requestRender();
}

/** Auto-refresh interval (seconds) for web cards. 0 = off. (Embed and daily
 * cards update live from vault events and don't need this.) */
export function refreshSetting(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const setting = new Setting(containerEl)
		.setName(t().editors.web.autoRefresh)
		.setDesc(t().editors.web.autoRefreshDesc);
	setting.addText((txt) => {
		txt.setValue(String(card.refreshSec ?? 0)).onChange((v) => {
			const n = parseInt(v, 10);
			card.refreshSec = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.addClass("hearth-count-input");
		txt.inputEl.setAttribute(
			"aria-label",
			t().editors.web.refreshIntervalAria,
		);
	});
	addResetButton(ctx, setting, t().settings.resetField, () => {
		card.refreshSec = undefined;
	});
}

export function linksEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	new Setting(containerEl).setName(t().editors.links.heading).setHeading();
	const card = ctx.card;
	const links = (card.links ??= []);

	new Setting(containerEl)
		.setName(t().editors.links.autoShift)
		.setDesc(t().editors.links.autoShiftDesc)
		.addToggle((t) =>
			t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
				card.tileAutoFlow = v;
				ctx.opts.save();
			}),
		);

	links.forEach((link, index) => {
		const row = new Setting(containerEl).setClass("hearth-link-setting");
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.links.labelPlaceholder)
				.setValue(link.label)
				.onChange((v) => {
					link.label = v;
					ctx.opts.save();
				}),
		);
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.links.iconPlaceholder)
				.setValue(link.icon)
				.onChange((v) => {
					link.icon = v;
					ctx.opts.save();
				}),
		);
		row.addDropdown((d) => {
			(Object.keys(t().editors.linkTypes) as LinkItem["type"][]).forEach(
				(k) => {
					d.addOption(k, t().editors.linkTypes[k]);
				},
			);
			d.setValue(link.type).onChange((v) => {
				link.type = v as LinkItem["type"];
				ctx.opts.save();
				// The target control differs by type (a command picker vs. a
				// free-text path/URL field), so rebuild the editor to swap it.
				ctx.requestRender();
			});
		});
		if (link.type === "command") {
			// Commands are addressed by an opaque id (e.g. "editor:toggle-bold")
			// that users can't be expected to know, so offer a fuzzy picker over
			// the registered commands instead of a raw text field. This mirrors
			// how the "commands" card adds tiles and is what makes command links
			// actually fire.
			row.addButton((b) => {
				const current = link.target
					? ctx.app.commands.listCommands().find((c) => c.id === link.target)
					: undefined;
				b.setButtonText(
					current ? current.name : t().editors.links.pickCommand,
				);
				b.onClick(() => {
					new CommandPickerModal(ctx.app, (command) => {
						link.target = command.id;
						// Prefill an empty label with the command name so the tile
						// isn't blank; leave a user-set label untouched.
						if (!link.label) link.label = command.name;
						// Adopt the command's own icon if the link is still on the
						// default; a user-chosen icon is left alone.
						if ((!link.icon || link.icon === "link") && command.icon) {
							link.icon = command.icon;
						}
						ctx.opts.save();
						ctx.requestRender();
					}).open();
				});
			});
		} else {
			row.addText((txt) =>
				txt
					.setPlaceholder(
						link.type === "url"
							? t().editors.links.targetUrl
							: t().editors.links.targetNote,
					)
					.setValue(link.target)
					.onChange((v) => {
						link.target = v;
						ctx.opts.save();
					}),
			);
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, links, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === links.length - 1)
				.onClick(() => moveItem(ctx, links, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.links.removeLink)
				.onClick(() => {
					links.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.links.addLink).onClick(() => {
			links.push({
				id: `link-${Date.now().toString(36)}`,
				label: "",
				icon: "link",
				target: "",
				type: "note",
			});
			ctx.opts.save();
			ctx.requestRender();
		}),
	);
}

export function commandsEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	new Setting(containerEl)
		.setName(t().editors.commands.autoShift)
		.setDesc(t().editors.commands.autoShiftDesc)
		.addToggle((t) =>
			t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
				card.tileAutoFlow = v;
				ctx.opts.save();
			}),
		);
	const buttonSize = new Setting(containerEl)
		.setName(t().editors.commands.buttonSize)
		.setDesc(t().editors.commands.buttonSizeDesc);
	buttonSize.addSlider((s) => {
		s.setLimits(60, 180, 10)
			.setValue(card.tileSize ?? 90)
			.setDynamicTooltip()
			.onChange((v) => {
				card.tileSize = v === 90 ? undefined : v;
				ctx.opts.save();
			});
	});
	buttonSize.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				card.tileSize = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);

	new Setting(containerEl).setName(t().editors.commands.heading).setHeading();
	const commands = (ctx.card.commands ??= []);

	commands.forEach((cmd, index) => {
		const row = new Setting(containerEl)
			.setClass("hearth-link-setting")
			.setName(cmd.name || cmd.id);
		row.addText((txt) =>
			txt
				.setPlaceholder(t().editors.commands.iconOptionalPlaceholder)
				.setValue(cmd.icon ?? "")
				.onChange((v) => {
					cmd.icon = v || undefined;
					ctx.opts.save();
				}),
		);
		row.addText((txt) => {
			txt
				.setPlaceholder(t().editors.commands.sizePlaceholder)
				.setValue(cmd.size ? String(cmd.size) : "")
				.onChange((v) => {
					const n = parseInt(v, 10);
					cmd.size = Number.isNaN(n) || n <= 0 ? undefined : n;
					ctx.opts.save();
				});
			txt.inputEl.type = "number";
			txt.inputEl.addClass("hearth-count-input");
			txt.inputEl.setAttribute(
				"aria-label",
				t().editors.commands.tileSizeAria,
			);
		});
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.commands.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, commands, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.commands.moveDown)
				.setDisabled(index === commands.length - 1)
				.onClick(() => moveItem(ctx, commands, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(t().editors.commands.removeCommand)
				.onClick(() => {
					commands.splice(index, 1);
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.commands.addCommand).onClick(() => {
			new CommandPickerModal(ctx.app, (command) => {
				commands.push({
					id: command.id,
					name: command.name,
					icon: command.icon,
				});
				ctx.opts.save();
				ctx.requestRender();
			}).open();
		}),
	);
}

export function tasksEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.tasks ??= {});

	new Setting(containerEl)
		.setName(t().editors.tasks.source)
		.setDesc(t().editors.tasks.sourceDesc)
		.addDropdown((d) => {
			d.addOption("checkbox", t().editors.tasks.sourceCheckbox);
			d.addOption("tasknotes", t().editors.tasks.sourceTaskNotes);
			d.addOption("kanban", t().editors.tasks.sourceKanban);
			d.setValue(cfg.source ?? "checkbox").onChange((v) => {
				cfg.source = v as TasksConfig["source"];
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	// Kanban source: pick the board note and choose plain vs. Tasks-plugin
	// (extended) card parsing.
	if (cfg.source === "kanban") {
		const boardSetting = new Setting(containerEl)
			.setName(t().editors.tasks.kanbanBoard)
			.setDesc(t().editors.tasks.kanbanBoardDesc);
		boardSetting.addText((txt) =>
			txt
				.setPlaceholder(t().editors.tasks.kanbanBoardPlaceholder)
				.setValue(cfg.kanbanFile ?? "")
				.onChange((v) => {
					cfg.kanbanFile = v.trim() || undefined;
					ctx.opts.save();
				}),
		);
		boardSetting.addExtraButton((b) =>
			b
				.setIcon("file-symlink")
				.setTooltip(t().editors.tasks.pickBoard)
				.onClick(() => {
					new FilePickerModal(
						ctx.app,
						(file) => {
							cfg.kanbanFile = file.path;
							ctx.opts.save();
							ctx.requestRender();
						},
						t().editors.tasks.pickBoard,
						(file) => {
							const fm =
								ctx.app.metadataCache.getFileCache(file)?.frontmatter;
							return !!fm && "kanban-plugin" in fm;
						},
					).open();
				}),
		);

		new Setting(containerEl)
			.setName(t().editors.tasks.kanbanExtended)
			.setDesc(t().editors.tasks.kanbanExtendedDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.kanbanExtended ?? false).onChange((v) => {
					cfg.kanbanExtended = v || undefined;
					ctx.opts.save();
				}),
			);

		// Convert-to-note options (the card right-click "Convert to note"
		// action): seed the new note from a template, and/or scrape the card's
		// metadata into the note's frontmatter instead of onto the board link.
		const tplSetting = new Setting(containerEl)
			.setName(t().editors.tasks.convertTemplate)
			.setDesc(t().editors.tasks.convertTemplateDesc);
		tplSetting.addText((txt) =>
			txt
				.setPlaceholder(t().editors.tasks.convertTemplatePlaceholder)
				.setValue(cfg.convertNoteTemplate ?? "")
				.onChange((v) => {
					cfg.convertNoteTemplate = v.trim() || undefined;
					ctx.opts.save();
				}),
		);
		tplSetting.addExtraButton((b) =>
			b
				.setIcon("file-symlink")
				.setTooltip(t().editors.tasks.pickTemplate)
				.onClick(() => {
					new FilePickerModal(
						ctx.app,
						(file) => {
							cfg.convertNoteTemplate = file.path;
							ctx.opts.save();
							ctx.requestRender();
						},
						t().editors.tasks.pickTemplate,
					).open();
				}),
		);

		new Setting(containerEl)
			.setName(t().editors.tasks.convertScrape)
			.setDesc(t().editors.tasks.convertScrapeDesc)
			.addToggle((tg) =>
				tg
					.setValue(cfg.convertMetadataToFrontmatter ?? false)
					.onChange((v) => {
						cfg.convertMetadataToFrontmatter = v || undefined;
						ctx.opts.save();
					}),
			);

		new Setting(containerEl)
			.setName(t().editors.tasks.newTaskAsNote)
			.setDesc(t().editors.tasks.newTaskAsNoteDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.newTaskAsNote ?? false).onChange((v) => {
					cfg.newTaskAsNote = v || undefined;
					ctx.opts.save();
				}),
			);
	}

	// Checkbox source: parse the inline Tasks-plugin metadata (dates, priority,
	// repeat) — the counterpart of the Kanban "Dates & priorities" toggle. On
	// by default; storing `false` opts out and reads checkboxes as plain text.
	if ((cfg.source ?? "checkbox") === "checkbox") {
		new Setting(containerEl)
			.setName(t().editors.tasks.checkboxExtended)
			.setDesc(t().editors.tasks.checkboxExtendedDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.checkboxExtended ?? true).onChange((v) => {
					cfg.checkboxExtended = v ? undefined : false;
					ctx.opts.save();
					ctx.requestRender();
				}),
			);

		// Custom checkbox statuses: the board columns / task states, one per
		// line as `[symbol] Label`, with a trailing "(done)" to mark completed
		// states. Blank uses the default set (To do / In progress / Done).
		const defaultStatusText =
			`[ ] ${t().cards.tasks.toDo}\n` +
			`[/] ${t().cards.tasks.statusInProgress}\n` +
			`[x] ${t().cards.tasks.done} (done)`;
		const statusText = (cfg.checkboxStatuses ?? []).length
			? (cfg.checkboxStatuses ?? [])
					.map((s) => `[${s.symbol}] ${s.label}${s.done ? " (done)" : ""}`)
					.join("\n")
			: defaultStatusText;
		new Setting(containerEl)
			.setName(t().editors.tasks.checkboxStatuses)
			.setDesc(t().editors.tasks.checkboxStatusesDesc)
			.addTextArea((ta) => {
				ta.setValue(statusText)
					.setPlaceholder(defaultStatusText)
					.onChange((v) => {
						const parsed = v
							.split("\n")
							.map((line) => {
								const m = /^\s*\[(.)\]\s*(.*)$/.exec(line);
								if (!m) return null;
								let label = m[2].trim();
								let done = false;
								const dm = /\(done\)\s*$/i.exec(label);
								if (dm) {
									done = true;
									label = label.slice(0, dm.index).trim();
								}
								return {
									symbol: m[1],
									label: label || m[1],
									done: done || undefined,
								};
							})
							.filter(
								(
									s,
								): s is {
									symbol: string;
									label: string;
									done: boolean | undefined;
								} => s !== null,
							);
						cfg.checkboxStatuses = parsed.length ? parsed : undefined;
						ctx.opts.save();
					});
				ta.inputEl.rows = 4;
				ta.inputEl.addClass("hearth-tasks-statuses-input");
			});
	}

	// TaskNotes source: which status values count as complete. Empty uses the
	// single global done value (Settings → Hearth); listing values here (e.g.
	// "done" and "canceled") treats each as complete.
	if (cfg.source === "tasknotes") {
		new Setting(containerEl)
			.setName(t().editors.tasks.doneStatuses)
			.setDesc(t().editors.tasks.doneStatusesDesc)
			.addTextArea((ta) => {
				ta.setValue((cfg.taskNotesDoneStatuses ?? []).join("\n"))
					.setPlaceholder(t().editors.tasks.doneStatusesPlaceholder)
					.onChange((v) => {
						const parsed = v
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						cfg.taskNotesDoneStatuses = parsed.length ? parsed : undefined;
						ctx.opts.save();
					});
				ta.inputEl.rows = 3;
				ta.inputEl.addClass("hearth-tasks-statuses-input");
			});
	}

	// Quick-view on click applies to line-based tasks (checkboxes and Kanban
	// cards); TaskNotes tasks always open in their own editor.
	if ((cfg.source ?? "checkbox") !== "tasknotes") {
		new Setting(containerEl)
			.setName(t().editors.tasks.quickView)
			.setDesc(t().editors.tasks.quickViewDesc)
			.addToggle((tg) =>
				tg.setValue(cfg.taskQuickView ?? true).onChange((v) => {
					cfg.taskQuickView = v ? undefined : false;
					ctx.opts.save();
				}),
			);
	}

	new Setting(containerEl)
		.setName(t().editors.tasks.layout)
		.setDesc(t().editors.tasks.layoutDesc)
		.addDropdown((d) => {
			d.addOption("list", t().editors.tasks.layoutList);
			d.addOption("kanban", t().editors.tasks.layoutKanban);
			d.setValue(cfg.layout ?? "list").onChange((v) => {
				cfg.layout = v === "kanban" ? "kanban" : undefined;
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if (
		cfg.layout === "kanban" &&
		(cfg.kanbanHidden?.length ||
			cfg.kanbanOrder?.length ||
			cfg.kanbanDoneColumns?.length)
	) {
		const parts: string[] = [];
		if (cfg.kanbanHidden?.length)
			parts.push(t().editors.tasks.kanbanHidden(cfg.kanbanHidden.join(", ")));
		if (cfg.kanbanDoneColumns?.length)
			parts.push(
				t().editors.tasks.kanbanDoneColumns(cfg.kanbanDoneColumns.join(", ")),
			);
		const reset = new Setting(containerEl)
			.setName(t().editors.tasks.kanbanColumns)
			.setDesc(
				parts.length ? parts.join(" ") : t().editors.tasks.kanbanCustomOrder,
			);
		if (cfg.kanbanHidden?.length) {
			reset.addButton((b) =>
				b.setButtonText(t().editors.tasks.showAll).onClick(() => {
					cfg.kanbanHidden = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
			);
		}
		reset.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.tasks.resetColumns)
				.onClick(() => {
					cfg.kanbanHidden = undefined;
					cfg.kanbanOrder = undefined;
					cfg.kanbanDoneColumns = undefined;
					ctx.opts.save();
					ctx.requestRender();
				}),
		);
	}

	new Setting(containerEl)
		.setName(t().editors.tasks.showCompleted)
		.setDesc(
			cfg.layout === "kanban"
				? t().editors.tasks.showCompletedKanbanDesc
				: "",
		)
		.addToggle((t) =>
			t.setValue(cfg.showCompleted ?? false).onChange((v) => {
				cfg.showCompleted = v || undefined;
				ctx.opts.save();
			}),
		);

	const maxTasks = new Setting(containerEl)
		.setName(t().editors.tasks.maxTasks)
		.setDesc(t().editors.tasks.maxTasksDesc);
	maxTasks.addText((t) => {
		t.setValue(String(cfg.count ?? 10)).onChange((v) => {
			const n = parseInt(v, 10);
			cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
			ctx.opts.save();
		});
		t.inputEl.type = "number";
		t.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, maxTasks, t().settings.resetField, () => {
		cfg.count = undefined;
	});

	new Setting(containerEl).setName(t().editors.tasks.folders).setHeading();
	new Setting(containerEl)
		.setName(t().editors.tasks.scope)
		.addDropdown((d) => {
			d.addOption("all", t().editors.tasks.scopeAll);
			d.addOption("whitelist", t().editors.tasks.scopeWhitelist);
			d.addOption("blacklist", t().editors.tasks.scopeBlacklist);
			d.setValue(cfg.folderScope ?? "all").onChange((v) => {
				cfg.folderScope = v as TasksConfig["folderScope"];
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if ((cfg.folderScope ?? "all") !== "all") {
		new Setting(containerEl)
			.setDesc(t().editors.tasks.foldersDesc)
			.addTextArea((t) => {
				t.setValue((cfg.folders ?? []).join("\n")).onChange((v) => {
					cfg.folders = v
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					ctx.opts.save();
				});
				t.inputEl.rows = 3;
			});
	}
}

export function favoritesEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	new Setting(containerEl)
		.setName(t().editors.favorites.heading)
		.setDesc(t().editors.favorites.headingDesc)
		.setHeading();
	const favorites = ctx.opts.favorites;

	favorites.forEach((path, index) => {
		new Setting(containerEl)
			.setName(path)
			.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().editors.favorites.moveUp)
					.setDisabled(index === 0)
					.onClick(() => moveItem(ctx, favorites, index, index - 1)),
			)
			.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().editors.favorites.moveDown)
					.setDisabled(index === favorites.length - 1)
					.onClick(() => moveItem(ctx, favorites, index, index + 1)),
			)
			.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().editors.favorites.remove)
					.onClick(() => {
						favorites.splice(index, 1);
						ctx.opts.save();
						ctx.requestRender();
					}),
			);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.favorites.addFavorite).onClick(() => {
			new FilePickerModal(
				ctx.app,
				(file) => {
					if (!favorites.includes(file.path)) {
						favorites.push(file.path);
						ctx.opts.save();
						ctx.requestRender();
					}
				},
				t().pickers.noteToFavorite,
			).open();
		}),
	);
}

export function clockEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.clock ??= {});

	new Setting(containerEl)
		.setName(t().editors.clock.style)
		.addDropdown((d) => {
			d.addOption("digital", t().editors.clock.styleDigital);
			d.addOption("analog", t().editors.clock.styleAnalog);
			d.setValue(cfg.mode ?? "digital").onChange((v) => {
				cfg.mode = v as NonNullable<ClockConfig["mode"]>;
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if (cfg.mode !== "analog") {
		new Setting(containerEl)
			.setName(t().editors.clock.hourFormat)
			.addDropdown((d) => {
				d.addOption("auto", t().editors.clock.hourFormatAuto);
				d.addOption("12", t().editors.clock.hourFormat12);
				d.addOption("24", t().editors.clock.hourFormat24);
				d.setValue(cfg.hourFormat ?? (cfg.use24Hour ? "24" : "auto")).onChange((v) => {
					cfg.hourFormat = v as NonNullable<ClockConfig["hourFormat"]>;
					cfg.use24Hour = undefined;
					ctx.opts.save();
				});
			});
	}
	new Setting(containerEl)
		.setName(t().editors.clock.showSeconds)
		.addToggle((t) =>
			t.setValue(cfg.showSeconds ?? false).onChange((v) => {
				cfg.showSeconds = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.showGreeting)
		.addToggle((t) =>
			t.setValue(cfg.showGreeting !== false).onChange((v) => {
				cfg.showGreeting = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.playful)
		.setDesc(t().editors.clock.playfulDesc)
		.addToggle((t) =>
			t.setValue(cfg.playfulGreetings ?? false).onChange((v) => {
				cfg.playfulGreetings = v || undefined;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.greetingOverride)
		.setDesc(t().editors.clock.greetingOverrideDesc)
		.addText((t) =>
			t.setValue(cfg.greetingText ?? "").onChange((v) => {
				cfg.greetingText = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.date)
		.addDropdown((d) => {
			d.addOption("full", t().editors.clock.dateFull);
			d.addOption("long", t().editors.clock.dateLong);
			d.addOption("short", t().editors.clock.dateShort);
			d.addOption("iso", t().editors.clock.dateIso);
			d.addOption("weekday", t().editors.clock.dateWeekday);
			d.addOption("custom", t().editors.clock.dateCustom);
			d.addOption("none", t().editors.clock.dateNone);
			d.setValue(cfg.dateMode ?? "full").onChange((v) => {
				cfg.dateMode = v as NonNullable<ClockConfig["dateMode"]>;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
	if (cfg.dateMode === "custom") {
		new Setting(containerEl)
			.setName(t().editors.clock.customFormat)
			.setDesc(t().editors.clock.customFormatDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(t().editors.clock.customFormatPlaceholder)
					.setValue(cfg.dateFormat ?? "")
					.onChange((v) => {
						cfg.dateFormat = v;
						ctx.opts.save();
					}),
			);
	}
}
