import type { CardDefinition } from "./definition";
import { renderClock } from "../cardbodies";
import { clockEditor } from "../editors";

/** A live clock with an optional greeting and date. */
export const clockCard: CardDefinition<"clock"> = {
	kind: "clock",
	templates: [
		{ id: "clock", name: "Clock & greeting", icon: "clock", build: () => ({ kind: "clock", title: "", w: 4, h: 2 }) },
	],
	render: (view, card, body, component) => renderClock(view, card, body, component),
	renderEditor: (container, ctx) => clockEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.clock) copy.clock = { ...source.clock };
	},
	liveness: { mode: "static" },
};
