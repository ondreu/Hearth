import { Component, MarkdownRenderer, setIcon, Setting, TFile } from "obsidian";
import { isBaseTarget, isEmbeddableBaseViewName, listBaseViews } from "../bases";
import {
	activeEmbedIndex,
	activeEmbedView,
	activeEmbedViewParams,
	embedViews,
	emptyState,
	livePreviewSetting,
	renderEditableEmbed,
	renderLivePreviewEmbed,
	renderMarkdownFile,
	watchedCardPath,
} from "../cardbodies";
import { EXCALIDRAW_PLUGIN_ID, isExcalidraw } from "../filetypes";
import { t } from "../i18n";
import { openFile } from "../opener";
import { FilePickerModal } from "../pickers";
import { type DashboardCard, type EmbedView } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


/** Whether the embed view a card is currently showing is edited in place. Used
 * by the body watcher to decide whether a modify event should redraw. */
export function activeEmbedViewEditable(card: DashboardCard): boolean {
	return !!activeEmbedViewParams(card).editable;
}


export function renderEmbed(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const active = activeEmbedViewParams(card);
	const target = active.target?.trim();
	if (!target) {
		emptyState(body, "file-plus", t().cards.empty.embedPickFile);
		return;
	}
	const file = view.app.vault.getAbstractFileByPath(target);
	if (!(file instanceof TFile)) {
		emptyState(body, "file-x", `Not found: ${target}`);
		return;
	}

	// Bases (.base) embeds depend on the core Bases plugin being enabled.
	if (file.extension.toLowerCase() === "base") {
		const bases = view.app.internalPlugins.getPluginById("bases");
		if (!bases?.enabled) {
			emptyState(body, "database", t().cards.empty.embedEnableBases);
			return;
		}
	}

	// Canvas embeds depend on the core Canvas plugin being enabled.
	if (file.extension.toLowerCase() === "canvas") {
		const canvas = view.app.internalPlugins.getPluginById("canvas");
		if (!canvas?.enabled) {
			emptyState(body, "layout-dashboard", t().cards.empty.embedEnableCanvas);
			return;
		}
	}

	// Excalidraw drawings render through the community Excalidraw plugin.
	if (isExcalidraw(file)) {
		if (!view.app.plugins.enabledPlugins.has(EXCALIDRAW_PLUGIN_ID)) {
			emptyState(body, "pen-tool", t().cards.empty.embedInstallExcalidraw);
			return;
		}
	}

	// An embedded note is read (and often edited) right here on the board, so
	// there was no way to get to it in its own tab (#144). This optional overlay
	// button is that way. Off unless asked for — unlike the Daily card's button,
	// which predates the setting and stays on by default — so no existing board
	// grows a control it never had.
	if (card.showOpenButton === true) renderEmbedOpenButton(view, file, body);

	const ext = file.extension.toLowerCase();
	const isMarkdown = ext === "md" || ext === "markdown";
	const excalidraw = isExcalidraw(file);

	// Editable Markdown notes are edited in place rather than rendered read-only —
	// either in Obsidian's own Live Preview editor, or in Hearth's plain
	// raw-Markdown box (the fallback when hosting the real editor isn't possible).
	if (active.editable && isMarkdown && !excalidraw) {
		if (active.livePreview && renderLivePreviewEmbed(view, file, body, component)) return;
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	// Optionally hide the embedded Bases view's own toolbar/header (view switcher
	// + filter/property controls) so only the results show. Scoped via a class on
	// the host so it only affects this card's base embed.
	if (ext === "base" && card.hideBaseHeader) host.addClass("hearth-embed-hide-base-header");
	// Optional zoom: scale the rendered content and widen it inversely so it
	// still fills the card width before scaling (the body handles overflow).
	const scale = active.scale && active.scale > 0 ? active.scale : 1;
	if (scale !== 1) {
		host.addClass("is-scaled");
		host.style.setProperty("--hearth-embed-scale", String(scale));
	}

	if (isMarkdown && !excalidraw) {
		// Render the note's actual content so all Markdown (headings, lists,
		// callouts, links…) shows. A bare ![[embed]] only renders a placeholder
		// outside a real Markdown view, which looks empty on the dashboard.
		void renderMarkdownFile(view, file, host, component);
	} else {
		// Images, canvas, .base and Excalidraw go through Obsidian's own
		// transclusion embed, which handles those file types uniformly. Bases can
		// optionally target a named view with Obsidian's documented #View subpath.
		const baseView = active.baseView?.trim();
		const embedTarget =
			ext === "base" && isEmbeddableBaseViewName(baseView) ? `${target}#${baseView}` : target;
		void MarkdownRenderer.render(view.app, `![[${embedTarget}]]`, host, target, component);

		// Canvas and Excalidraw embeds are natively interactive (pan/zoom, and
		// their own in-place edit toggle) — let them fill the card edge-to-edge
		// instead of sitting in a small box inside a scrolling body, so their
		// own pan gestures don't fight the card's scrollbar.
		if (ext === "canvas" || excalidraw) {
			host.addClass("hearth-embed-live");
			body.addClass("hearth-card-body-live");
		}
	}
}


/** A short label for a view's switcher button — the embedded file's basename,
 * or a placeholder when the view has no target yet. */
function embedViewLabel(view: HomeView, ev: EmbedView, index: number): string {
	const target = ev.target?.trim();
	if (!target) return t().cards.embed.viewFallback(index + 1);
	const file = view.app.vault.getAbstractFileByPath(target);
	return file instanceof TFile ? file.basename : target;
}


/**
 * Mount the second-view switcher for an embed card, when it has one. A titled
 * card gets an inline segmented control in its header; an untitled (headerless)
 * card gets a floating control that CSS reveals on hover. Selecting a view
 * records the choice (transiently) and redraws just the card body.
 *
 * `head` is the card's header element (hidden by CSS when untitled) and `redraw`
 * re-renders the body via the same closure the live-refresh watchers use.
 */
export function mountEmbedViewSwitcher(
	view: HomeView,
	card: DashboardCard,
	cardEl: HTMLElement,
	head: HTMLElement,
	redraw: () => void,
): void {
	if (card.kind !== "embed") return;
	const views = embedViews(card);
	if (views.length < 2) return;

	const titled = !!(card.title ?? "").trim();
	const host = titled
		? head.createDiv("hearth-embed-switch is-inline")
		: cardEl.createDiv("hearth-embed-switch is-floating");

	const build = () => {
		host.empty();
		const activeIdx = activeEmbedIndex(card);
		views.forEach((ev, index) => {
			const label = embedViewLabel(view, ev, index);
			const btn = host.createEl("button", { cls: "hearth-embed-switch-btn", text: label });
			btn.toggleClass("is-active", index === activeIdx);
			btn.setAttribute("title", label);
			btn.setAttribute("aria-label", t().cards.embed.switchTo(label));
			// Don't let a click on the switcher start a card drag / bubble to the card.
			btn.addEventListener("pointerdown", (e) => e.stopPropagation());
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (index === activeIdx) return;
				activeEmbedView.set(card, index);
				redraw();
				build();
			});
		});
	};
	build();
}


// ---- Per-kind card editors (issue #103) --------------------------------
// Lifted out of CardSettingsModal so each card kind's Content-tab controls
// can be owned by its module. Each takes a CardEditorContext instead of the
// modal's `this`. Phase B relocates these into src/cards/<kind>/.

/** The "open this file in a tab" button, floated over the card like the Daily
 * card's. It lives on the card element rather than the body so it doesn't take
 * part in the body's scroll or flow. Where the file lands follows the global
 * open-behaviour setting (#106). */
function renderEmbedOpenButton(view: HomeView, file: TFile, body: HTMLElement): void {
	const cardEl = body.closest(".hearth-card");
	const overlay = (cardEl ?? body).createDiv("hearth-card-actions-overlay");
	const open = overlay.createEl("button", {
		cls: "hearth-open-btn",
		attr: { "aria-label": t().cards.embed.openFile },
	});
	setIcon(open, "square-arrow-out-up-right");
	open.addEventListener("click", (evt) => {
		void openFile(view, file, "card", evt);
	});
}


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
				// The live-preview choice below only exists while editing is on.
				ctx.requestRender();
			}),
		);
	if (card.editable) livePreviewSetting(ctx, containerEl, card);
	new Setting(containerEl)
		.setName(t().editors.embed.openButton)
		.setDesc(t().editors.embed.openButtonDesc)
		.addToggle((tg) =>
			tg.setValue(card.showOpenButton === true).onChange((v) => {
				card.showOpenButton = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
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
					ctx.requestRender();
				}),
			);
		if (view.editable) livePreviewSetting(ctx, containerEl, view);
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

/** Embedded note / image / base / excalidraw / canvas. One kind, five presets. */
export const embedCard: CardDefinition<"embed"> = {
	kind: "embed",
	templates: [
		{ id: "note", name: "Embedded note", icon: "file-text", build: () => ({ kind: "embed", title: "Note", target: "", w: 6, h: 3 }) },
		{ id: "image", name: "Embedded image", icon: "image", build: () => ({ kind: "embed", title: "Image", target: "", w: 4, h: 3 }) },
		{ id: "base", name: "Embedded base", icon: "database", build: () => ({ kind: "embed", title: "Base", target: "", w: 6, h: 4 }) },
		{ id: "excalidraw", name: "Excalidraw drawing", icon: "pen-tool", build: () => ({ kind: "embed", title: "Drawing", target: "", w: 6, h: 4 }) },
		{ id: "canvas", name: "Embedded canvas", icon: "layout-dashboard", build: () => ({ kind: "embed", title: "Canvas", target: "", w: 6, h: 4 }) },
	],
	render: (view, card, body, component) => renderEmbed(view, card, body, component),
	renderEditor: (container, ctx) => embedEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.secondView) copy.secondView = { ...source.secondView };
	},
	liveness: {
		mode: "watch-file",
		watchedPath: (view, card) => watchedCardPath(view, card),
		editableInPlace: (card) => activeEmbedViewEditable(card),
	},
	mountExtras: (view, card, cardEl, head, redraw) =>
		mountEmbedViewSwitcher(view, card, cardEl, head, redraw),
};
