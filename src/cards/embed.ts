import { Component, MarkdownRenderer, Setting, TFile } from "obsidian";
import { isBaseTarget, isEmbeddableBaseViewName, listBaseViews } from "../bases";
import {
	cardOverlayButton,
	emptyState,
	livePreviewSetting,
	renderEditableEmbed,
	renderLivePreviewEmbed,
	renderMarkdownFile,
	watchedCardPath,
	wireMarkdownLinks,
} from "../cardbodies";
import {
	EMBED_IMAGE_FITS,
	EMBED_IMAGE_POSITIONS,
	embedImageFit,
	embedImagePosition,
	embedImagePositionApplies,
	embedImageScale,
	embedImageStyle,
	framesEmbedImage,
} from "../embedimage";
import { EXCALIDRAW_PLUGIN_ID, isExcalidraw, isImageFile, isImagePath } from "../filetypes";
import { t } from "../i18n";
import { openFile } from "../opener";
import { FilePickerModal } from "../pickers";
import {
	type DashboardCard,
	type EmbedImageFit,
	type EmbedImagePosition,
} from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


export function renderEmbed(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const target = card.target?.trim();
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
	if (card.editable && isMarkdown && !excalidraw) {
		if (card.livePreview && renderLivePreviewEmbed(view, file, body, component)) return;
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	body.addClass("is-embed-host");
	// A Bases view paints its own surfaces (the table view most of all), which
	// hides the card's translucent background. This class scopes the CSS that
	// makes those surfaces defer to the card's --card-opacity.
	if (ext === "base") host.addClass("hearth-embed-base");
	// Optionally hide the embedded Bases view's own toolbar/header (view switcher
	// + filter/property controls) so only the results show. Scoped via a class on
	// the host so it only affects this card's base embed.
	if (ext === "base" && card.hideBaseHeader) host.addClass("hearth-embed-hide-base-header");
	// A picture with a fit mode set is drawn by Hearth rather than transcluded,
	// so it can be sized against the card (see renderFormattedImage). Zoom is
	// part of that sizing there, which is why the host zoom below skips it.
	const fit = isImageFile(file) ? embedImageFit(card) : "natural";
	const framed = framesEmbedImage(fit);

	// Optional zoom: scale the rendered content and widen it inversely so it
	// still fills the card width before scaling (the body handles overflow).
	const scale = embedImageScale(card.scale);
	if (scale !== 1 && !framed) {
		host.addClass("is-scaled");
		host.style.setProperty("--hearth-embed-scale", String(scale));
	}

	if (framed) {
		renderFormattedImage(view, file, body, host, fit, embedImagePosition(card), scale);
	} else if (isMarkdown && !excalidraw) {
		// Render the note's actual content so all Markdown (headings, lists,
		// callouts, links…) shows. A bare ![[embed]] only renders a placeholder
		// outside a real Markdown view, which looks empty on the dashboard.
		void renderMarkdownFile(view, file, host, component);
	} else {
		// Images, canvas, .base and Excalidraw go through Obsidian's own
		// transclusion embed, which handles those file types uniformly. Bases can
		// optionally target a named view with Obsidian's documented #View subpath.
		const baseView = card.baseView?.trim();
		const embedTarget =
			ext === "base" && isEmbeddableBaseViewName(baseView) ? `${target}#${baseView}` : target;
		void MarkdownRenderer.render(view.app, `![[${embedTarget}]]`, host, target, component);
		// A transclusion renders content that resolves its own links — a Bases
		// table's note column, most of all. Left alone, those clicks go to
		// Obsidian's default handler, which opens into the tab the click came
		// from, i.e. this Hearth tab, whatever the open-behaviour setting says
		// (#106). Delegated from the host, so it survives the async render above.
		wireMarkdownLinks(view, host, target);

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


/**
 * Draw a picture that has been given a fit mode — "Fit the whole picture",
 * "Fill the card", "Stretch to the card" or "Fit the width".
 *
 * These are the modes where the picture is sized against the card rather than
 * against itself, and Obsidian's transclusion can't express them: it renders
 * into wrappers of its own with their own margins, so there is no element to
 * hang an `object-fit` on that reliably spans the card. Hearth therefore draws
 * the `<img>` itself here — the picture gets the whole body, edge to edge, and
 * the CSS does the rest from the custom properties set below.
 *
 * "natural" never reaches this function: it stays on the transclusion path it
 * has always used, so an embed card nobody has formatted renders exactly as
 * before.
 */
function renderFormattedImage(
	view: HomeView,
	file: TFile,
	body: HTMLElement,
	host: HTMLElement,
	fit: EmbedImageFit,
	position: EmbedImagePosition,
	scale: number,
): void {
	// The body stops scrolling and drops its padding, exactly as it does for a
	// canvas embed: the picture is the card's whole surface now, and a gutter
	// around a "fill the card" picture would be a visible lie.
	body.addClass("hearth-card-body-image");
	host.addClass("hearth-embed-image", `is-fit-${fit}`);
	for (const [prop, value] of Object.entries(embedImageStyle(fit, position, scale)))
		host.style.setProperty(prop, value);

	const img = host.createEl("img", { cls: "hearth-embed-img" });
	img.src = view.app.vault.getResourcePath(file);
	img.alt = file.basename;
	// The picture is the card's surface here, not something to drag out of it —
	// the native image drag would otherwise fight the card's own in arrange mode.
	img.draggable = false;
	img.decoding = "async";
}


/** How an embed card reads in a view switcher (#385): the embedded file's name,
 * and an icon for its type. Nothing when no file is chosen yet, so the switcher
 * falls back to the kind's own name and icon. */
function embedViewIdentity(view: HomeView, card: DashboardCard): { label?: string; icon?: string } {
	const target = card.target?.trim();
	if (!target) return {};
	const file = view.app.vault.getAbstractFileByPath(target);
	if (!(file instanceof TFile)) return { label: target };
	const ext = file.extension.toLowerCase();
	const icon = isExcalidraw(file)
		? "pen-tool"
		: isImageFile(file)
			? "image"
			: ext === "base"
				? "database"
				: ext === "canvas"
					? "layout-dashboard"
					: "file-text";
	return { label: file.basename, icon };
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
	cardOverlayButton(body, "square-arrow-out-up-right", t().cards.embed.openFile, (evt) => {
		void openFile(view, file, "card", evt);
	});
}


/**
 * The picture-formatting controls: how the picture fills the card, and — for
 * the modes where that leaves it something to decide — where it sits.
 *
 * Shown only when the view's target names a picture, since every other file
 * type ignores the fields.
 */
function imageFormatSettings(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	target: string | undefined,
	view: Pick<DashboardCard, "imageFit" | "imagePosition">,
): void {
	if (!isImagePath(target)) return;
	const strings = t().editors.embed;
	const fit = embedImageFit(view);

	new Setting(containerEl)
		.setName(strings.imageFit)
		.setDesc(strings.imageFitDesc)
		.addDropdown((d) => {
			for (const option of EMBED_IMAGE_FITS)
				d.addOption(option, strings.imageFits[option]);
			d.setValue(fit).onChange((v) => {
				view.imageFit = v === "natural" ? undefined : (v as EmbedImageFit);
				ctx.opts.save();
				ctx.opts.rerender();
				// The anchor control below only exists for some of the modes.
				ctx.requestRender();
			});
		});

	if (!embedImagePositionApplies(fit)) return;
	new Setting(containerEl)
		.setName(strings.imagePosition)
		.setDesc(fit === "cover" ? strings.imagePositionCropDesc : strings.imagePositionDesc)
		.addDropdown((d) => {
			for (const option of EMBED_IMAGE_POSITIONS)
				d.addOption(option, strings.imagePositions[option]);
			d.setValue(embedImagePosition(view)).onChange((v) => {
				view.imagePosition = v === "center" ? undefined : (v as EmbedImagePosition);
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
}


/** The zoom slider. Its description depends on what
 * is being zoomed: a framed picture is scaled inside the frame it was fitted to
 * (so zooming a cropped picture crops further), everything else is scaled as a
 * whole with the card scrolling around it. */
function zoomSetting(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	target: string | undefined,
	view: Pick<DashboardCard, "imageFit" | "scale">,
): void {
	const framed = isImagePath(target) && framesEmbedImage(embedImageFit(view));
	new Setting(containerEl)
		.setName(t().editors.embed.zoom)
		.setDesc(framed ? t().editors.embed.zoomImageDesc : t().editors.embed.zoomDesc)
		.addSlider((s) => {
			s.setLimits(50, 200, 10)
				.setValue(Math.round((view.scale ?? 1) * 100))
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
}


/** Whether terminal mode draws a view pointed at `target` as text — a note is;
 * a picture, a canvas, a base or a drawing is drawn as it always is, inside
 * the terminal frame, and keeps every setting (see `embedTui.graphicalFor`).
 * An empty or missing target counts as not, so nothing is hidden before the
 * view has something to show. */
function drawnAsText(ctx: CardEditorContext, target: string | undefined): boolean {
	if (!ctx.terminal) return false;
	const file = ctx.app.vault.getAbstractFileByPath(target?.trim() ?? "");
	if (!(file instanceof TFile)) return false;
	const ext = file.extension.toLowerCase();
	return (ext === "md" || ext === "markdown") && !isExcalidraw(file);
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
	imageFormatSettings(ctx, containerEl, card.target, card);
	// A note drawn as text has no zoom, and terminal mode edits it in a plain
	// text field rather than in live preview.
	if (!drawnAsText(ctx, card.target)) zoomSetting(ctx, containerEl, card.target, card);
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
	if (card.editable && !ctx.terminal) livePreviewSetting(ctx, containerEl, card);
	// Terminal mode draws no open button on a note (its card menu opens it
	// instead).
	if (!drawnAsText(ctx, card.target)) {
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
	}
	// Hide-base-header is only relevant to .base embeds.
	if (isBaseTarget(card.target)) {
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
	// A picture brings the formatting controls with it, and loses them again
	// when the target stops being one.
	const imageChanged = isImagePath(previousTarget) !== isImagePath(nextTarget);
	if (rerender || wasBase !== isBase || imageChanged || (isBase && targetChanged))
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
	liveness: {
		mode: "watch-file",
		watchedPath: (view, card) => watchedCardPath(view, card),
		editableInPlace: (card) => !!card.editable,
	},
	viewIdentity: (view, card) => embedViewIdentity(view, card),
};
