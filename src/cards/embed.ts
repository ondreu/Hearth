import { Component, MarkdownRenderer, TFile } from "obsidian";
import { isEmbeddableBaseViewName } from "../bases";
import {
	activeEmbedIndex,
	activeEmbedView,
	activeEmbedViewParams,
	embedViews,
	emptyState,
	renderEditableEmbed,
	renderMarkdownFile,
	watchedCardPath,
} from "../cardbodies";
import { embedEditor } from "../editors";
import { EXCALIDRAW_PLUGIN_ID, isExcalidraw } from "../filetypes";
import { t } from "../i18n";
import { type DashboardCard, type EmbedView } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


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

	const ext = file.extension.toLowerCase();
	const isMarkdown = ext === "md" || ext === "markdown";
	const excalidraw = isExcalidraw(file);

	// Editable Markdown notes are edited in place rather than rendered read-only.
	if (active.editable && isMarkdown && !excalidraw) {
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
