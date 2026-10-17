import { Notice, Setting, type App } from "obsidian";
import { setIcon } from "./glyphs";
import {
	activeViewIndex,
	cardViews,
	hasViews,
	moveView,
	resolveViewSwitcher,
	rotateSeconds,
	setActiveViewIndex,
	VIEW_ROTATE_MAX,
	VIEW_SWITCHER_LABELS,
	VIEW_SWITCHER_NARROW,
	VIEW_SWITCHER_PLACEMENTS,
	VIEW_SWITCHER_REVEALS,
	VIEW_SWITCHER_STYLES,
} from "./cardviews";
import type { CardSettingsOptions } from "./editors";
import { t } from "./i18n";
import { LucideIconPickerModal } from "./lucide";
import type { DashboardCard, ViewSwitcherConfig } from "./types";
import { confirmAction } from "./ui";

/**
 * The card editor's side of cards with views (#385): the "Views" tab, where
 * views are added, merged in, reordered, moved out and deleted and the switcher
 * is set up; and the row at the top of the Content tab that picks which view
 * the rest of the tab edits.
 *
 * Everything a card can do with views can be done from here, without dragging
 * a card onto another — drop-to-merge on the arrange board is a shortcut to
 * "Merge a card into this one", not the only way in.
 */

/** What the views editor needs from the card editor. */
export interface ViewsEditorHost {
	app: App;
	/** The card on the board. */
	card: DashboardCard;
	opts: CardSettingsOptions;
	/** Which view the Content tab edits (an index into the card and its views). */
	editing(): number;
	setEditing(index: number): void;
	/** Rebuild the editor in place. */
	render(): void;
	/** Switch the editor to its Content tab. */
	showContent(): void;
}

/** Persist and redraw the board after a change to the card's views. */
function changed(host: ViewsEditorHost): void {
	host.opts.save();
	host.opts.rerender();
	host.render();
}

/** A short "1. Label" name for a view in the editor. */
function viewName(host: ViewsEditorHost, view: DashboardCard, index: number): string {
	return `${index + 1}. ${host.opts.viewLabel(view)}`;
}

/**
 * The row of chips at the top of the Content tab of a card with views: which
 * view the tab is editing. Draws nothing for a card without views, whose
 * Content tab edits the card as it always has.
 */
export function renderViewPicker(containerEl: HTMLElement, host: ViewsEditorHost): void {
	if (!hasViews(host.card)) return;
	const strings = t().views.editor;
	const setting = new Setting(containerEl).setName(strings.editing).setDesc(strings.editingDesc);
	const row = setting.controlEl.createDiv("hearth-view-picker");
	cardViews(host.card).forEach((view, index) => {
		const chip = row.createEl("button", {
			cls: "hearth-view-picker-chip",
			attr: { type: "button", "aria-pressed": String(index === host.editing()) },
		});
		chip.toggleClass("is-active", index === host.editing());
		setIcon(chip.createSpan("hearth-view-picker-icon"), host.opts.viewIcon(view));
		chip.createSpan({ text: viewName(host, view, index) });
		chip.addEventListener("click", () => {
			host.setEditing(index);
			host.render();
		});
	});
}

/** The label and icon a view shows in the switcher, edited from the Content
 * tab of a card with views. */
export function renderViewIdentity(containerEl: HTMLElement, host: ViewsEditorHost, view: DashboardCard): void {
	if (!hasViews(host.card)) return;
	const strings = t().views.editor;
	new Setting(containerEl)
		.setName(strings.label)
		.setDesc(strings.labelDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(host.opts.viewLabel({ ...view, viewLabel: undefined }))
				.setValue(view.viewLabel ?? "")
				.onChange((v) => {
					view.viewLabel = v.trim() ? v : undefined;
					host.opts.save();
				}),
		);
	const iconRow = new Setting(containerEl).setName(strings.icon).setDesc(strings.iconDesc);
	let field: { setValue(v: string): unknown } | null = null;
	const apply = (v: string) => {
		view.viewIcon = v.trim() ? v.trim() : undefined;
		host.opts.save();
	};
	iconRow.addText((txt) => {
		field = txt;
		txt
			.setPlaceholder(host.opts.viewIcon({ ...view, viewIcon: undefined }))
			.setValue(view.viewIcon ?? "")
			.onChange(apply);
	});
	iconRow.addExtraButton((b) =>
		b
			.setIcon("search")
			.setTooltip(t().pickers.iconBrowse)
			.onClick(() =>
				new LucideIconPickerModal(host.app, (name) => {
					field?.setValue(name);
					apply(name);
				}).open(),
			),
	);
}

/** The "Views" tab. */
export function renderViewsTab(containerEl: HTMLElement, host: ViewsEditorHost): void {
	const strings = t().views.editor;
	const { card } = host;
	const views = cardViews(card);
	const multi = views.length > 1;

	new Setting(containerEl).setName(strings.heading).setDesc(strings.headingDesc).setHeading();

	const shown = activeViewIndex(card);
	views.forEach((view, index) => {
		const row = new Setting(containerEl).setName(viewName(host, view, index));
		const kind = t().editors.kinds[view.kind];
		row.setDesc(index === shown && multi ? strings.kindShown(kind) : kind);
		row.settingEl.addClass("hearth-view-row");
		const icon = createSpan("hearth-view-row-icon");
		setIcon(icon, host.opts.viewIcon(view));
		row.nameEl.prepend(icon);

		row.addExtraButton((b) =>
			b
				.setIcon("pencil")
				.setTooltip(strings.edit)
				.onClick(() => {
					host.setEditing(index);
					host.showContent();
				}),
		);
		if (!multi) return;
		row.addExtraButton((b) =>
			b
				.setIcon("eye")
				.setTooltip(strings.show)
				.setDisabled(index === shown)
				.onClick(() => {
					setActiveViewIndex(card, index);
					changed(host);
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("arrow-up")
				.setTooltip(strings.moveUp)
				.setDisabled(index === 0)
				.onClick(() => {
					if (!moveView(card, index, index - 1)) return;
					host.setEditing(index - 1);
					changed(host);
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("arrow-down")
				.setTooltip(strings.moveDown)
				.setDisabled(index === views.length - 1)
				.onClick(() => {
					if (!moveView(card, index, index + 1)) return;
					host.setEditing(index + 1);
					changed(host);
				}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("square-arrow-out-up-right")
				.setTooltip(strings.detach)
				.onClick(() => {
					host.opts.detachView(index);
					host.setEditing(0);
					new Notice(strings.detached);
					host.render();
				}),
		);
		row.addExtraButton((b) => {
			b.setIcon("trash-2")
				.setTooltip(strings.remove)
				.onClick(() => {
					confirmAction(host.app, {
						title: strings.removeTitle,
						message: strings.removeMessage(host.opts.viewLabel(view)),
						confirmText: strings.removeConfirm,
						onConfirm: () => {
							host.opts.removeView(index);
							host.setEditing(0);
							host.render();
						},
					});
				});
			b.extraSettingsEl.addClass("hearth-danger-icon");
		});
	});

	// Adding: a new card from the picker, or one already on the board.
	const add = new Setting(containerEl).setName(strings.add).setDesc(strings.addDesc);
	add.addButton((b) =>
		b.setButtonText(strings.addNew).onClick(() => {
			host.opts.addNewView((index) => {
				host.setEditing(index);
				host.showContent();
			});
		}),
	);

	const candidates = host.opts.mergeCandidates();
	if (candidates.length > 0) {
		const merge = new Setting(containerEl).setName(strings.merge).setDesc(strings.mergeDesc);
		let picked = candidates[0].id;
		merge.addDropdown((d) => {
			for (const c of candidates) d.addOption(c.id, c.label);
			d.setValue(picked).onChange((v) => (picked = v));
		});
		merge.addButton((b) =>
			b.setButtonText(strings.mergeButton).onClick(() => {
				host.opts.mergeCard(picked);
				host.render();
			}),
		);
	}

	if (!multi) return;

	new Setting(containerEl)
		.setName(strings.split)
		.setDesc(strings.splitDesc)
		.addButton((b) =>
			b.setButtonText(strings.splitButton).onClick(() => {
				confirmAction(host.app, {
					title: strings.splitTitle,
					message: strings.splitMessage(views.length),
					confirmText: strings.splitConfirm,
					onConfirm: () => {
						host.opts.splitViews();
						host.setEditing(0);
						host.render();
					},
				});
			}),
		);

	renderSwitcherSettings(containerEl, host);
}

/** Write one switcher option, pruning the block back to nothing once every
 * option is at its default — absent means "the default", so a card only
 * carries what someone actually chose. */
function setSwitcher(host: ViewsEditorHost, patch: Partial<ViewSwitcherConfig>): void {
	const next: ViewSwitcherConfig = { ...host.card.viewSwitcher, ...patch };
	for (const key of Object.keys(next) as (keyof ViewSwitcherConfig)[]) {
		if (next[key] === undefined) delete next[key];
	}
	host.card.viewSwitcher = Object.keys(next).length > 0 ? next : undefined;
	// Turning memory off hands the choice back to the in-memory one, so the
	// stored index goes with it.
	if (!host.card.viewSwitcher?.rememberView) delete host.card.activeView;
}

/** How the switcher looks and behaves. */
function renderSwitcherSettings(containerEl: HTMLElement, host: ViewsEditorHost): void {
	const strings = t().views.editor;
	const { card } = host;
	const cfg = card.viewSwitcher ?? {};
	const titled = !!(card.title ?? "").trim();
	const resolved = resolveViewSwitcher(card, titled);

	new Setting(containerEl).setName(strings.switcher).setHeading();

	const dropdown = <T extends string>(
		name: string,
		desc: string,
		options: readonly T[],
		labels: Record<T, string>,
		value: T,
		set: (v: T) => void,
	) =>
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown((d) => {
				for (const o of options) d.addOption(o, labels[o]);
				d.setValue(value).onChange((v) => {
					set(v as T);
					changed(host);
				});
			});

	dropdown(
		strings.placement,
		strings.placementDesc,
		VIEW_SWITCHER_PLACEMENTS,
		strings.placements,
		cfg.placement ?? "auto",
		(v) => setSwitcher(host, { placement: v === "auto" ? undefined : v }),
	);
	if (resolved.placement === "hidden") {
		const note = new Setting(containerEl).setDesc(strings.hiddenNote);
		note.settingEl.addClass("hearth-setting-note");
	} else {
		dropdown(
			strings.style,
			strings.styleDesc,
			VIEW_SWITCHER_STYLES,
			strings.styles,
			resolved.style,
			(v) => setSwitcher(host, { style: v === "tabs" ? undefined : v }),
		);
		// Only tabs have a choice to make: icons are icons, dots are dots, and
		// the drop-down always names the view beside its icon.
		if (resolved.style === "tabs") {
			dropdown(
				strings.labelStyle,
				strings.labelStyleDesc,
				VIEW_SWITCHER_LABELS,
				strings.labels,
				resolved.label,
				(v) => setSwitcher(host, { label: v === "label" ? undefined : v }),
			);
		}
		// A header switcher always shows; only a floating one can hide.
		if (resolved.placement !== "header") {
			dropdown(
				strings.reveal,
				strings.revealDesc,
				VIEW_SWITCHER_REVEALS,
				strings.reveals,
				resolved.reveal,
				(v) => setSwitcher(host, { reveal: v === "hover" ? undefined : v }),
			);
		}
	}

	new Setting(containerEl)
		.setName(strings.rotate)
		.setDesc(strings.rotateDesc)
		.addText((txt) => {
			txt.setPlaceholder(strings.rotateOff)
				.setValue(resolved.rotateSec > 0 ? String(resolved.rotateSec) : "")
				.onChange((v) => {
					const raw = v.trim();
					const n = raw === "" ? 0 : Number(raw);
					if (Number.isNaN(n)) return;
					const secs = rotateSeconds(n);
					setSwitcher(host, { rotateSec: secs > 0 ? secs : undefined });
					host.opts.save();
					host.opts.rerender();
				});
			txt.inputEl.type = "number";
			txt.inputEl.min = "0";
			txt.inputEl.max = String(VIEW_ROTATE_MAX);
			txt.inputEl.addClass("hearth-count-input");
		});

	new Setting(containerEl)
		.setName(strings.swipe)
		.setDesc(strings.swipeDesc)
		.addToggle((tg) =>
			tg.setValue(resolved.swipe).onChange((v) => {
				setSwitcher(host, { swipe: v ? undefined : false });
				changed(host);
			}),
		);

	new Setting(containerEl)
		.setName(strings.remember)
		.setDesc(strings.rememberDesc)
		.addToggle((tg) =>
			tg.setValue(resolved.rememberView).onChange((v) => {
				const shown = activeViewIndex(card);
				setSwitcher(host, { rememberView: v ? true : undefined });
				if (v) setActiveViewIndex(card, shown);
				changed(host);
			}),
		);

	dropdown(
		strings.narrow,
		strings.narrowDesc,
		VIEW_SWITCHER_NARROW,
		strings.narrows,
		resolved.narrow,
		(v) => setSwitcher(host, { narrow: v === "switcher" ? undefined : v }),
	);
}
