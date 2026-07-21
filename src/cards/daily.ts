import type { CardDefinition } from "./definition";
import { renderDaily, watchedCardPath } from "../cardbodies";
import { dailyEditor } from "../editors";

/** Today's daily note, embedded live. */
export const dailyCard: CardDefinition<"daily"> = {
	kind: "daily",
	templates: [
		{ id: "daily", name: "Daily note (today)", icon: "calendar", build: () => ({ kind: "daily", w: 6, h: 4 }) },
	],
	render: (view, card, body, component) => renderDaily(view, card, body, component),
	renderEditor: (container, ctx) => dailyEditor(ctx, container),
	liveness: {
		mode: "watch-file",
		watchedPath: (view, card) => watchedCardPath(view, card),
		editableInPlace: (card) => !!card.editable,
	},
};
