import type { CardDefinition } from "./definition";
import { renderHeatmap } from "../cardbodies";
import { heatmapEditor } from "../editors";

/** A calendar-style activity heatmap over a vault metric. */
export const heatmapCard: CardDefinition<"heatmap"> = {
	kind: "heatmap",
	templates: [
		{ id: "heatmap", name: "Activity heatmap", icon: "activity", build: () => ({ kind: "heatmap", title: "Activity", heatmap: {}, w: 6, h: 3 }) },
	],
	render: (view, card, body) => renderHeatmap(view, card, body),
	renderEditor: (container, ctx) => heatmapEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.heatmap) copy.heatmap = { ...source.heatmap };
	},
	liveness: { mode: "vault" },
};
