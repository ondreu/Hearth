import type { CardDefinition } from "./definition";
import { renderDataview } from "../cardbodies";
import { dataviewEditor } from "../editors";
import { isDataviewAvailable } from "../dataview";

/** A Dataview query, rendered through the Dataview plugin. Gated on that plugin. */
export const dataviewCard: CardDefinition<"dataview"> = {
	kind: "dataview",
	templates: [
		{
			id: "dataview",
			name: "Dataview query",
			icon: "database",
			build: () => ({ kind: "dataview", title: "Dataview", dataview: {}, w: 6, h: 4 }),
			available: (app) => isDataviewAvailable(app),
		},
	],
	render: (view, card, body, component) => renderDataview(view, card, body, component),
	renderEditor: (container, ctx) => dataviewEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.dataview)
			copy.dataview = {
				...source.dataview,
				columnWidths: source.dataview.columnWidths ? [...source.dataview.columnWidths] : undefined,
			};
	},
	liveness: { mode: "static" },
};
