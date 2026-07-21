import type { CardDefinition } from "./definition";
import {
	activeEmbedViewEditable,
	mountEmbedViewSwitcher,
	renderEmbed,
	watchedCardPath,
} from "../cardbodies";
import { embedEditor } from "../editors";

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
