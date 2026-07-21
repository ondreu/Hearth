import type { CardDefinition } from "./definition";
import { renderLeaf } from "../cardbodies";
import { leafEditor, leafTypeNote } from "../editors";
import { isLeafViewAvailable } from "../leafview";

/** Hosts another plugin's registered side-panel view inside a card. Beta. */
export const leafCard: CardDefinition<"leaf"> = {
	kind: "leaf",
	templates: [
		{
			id: "leaf",
			name: "Plugin view (beta)",
			icon: "layout-panel-left",
			build: () => ({ kind: "leaf", title: "Plugin view", leafView: {}, w: 5, h: 4 }),
			available: (app) => isLeafViewAvailable(app),
		},
	],
	render: (view, card, body, component) => renderLeaf(view, card, body, component),
	renderEditor: (container, ctx) => leafEditor(ctx, container),
	editorTypeNote: (container) => leafTypeNote(container),
	liveness: { mode: "static" },
};
