import type { CardDefinition } from "./definition";
import { renderWeb } from "../cardbodies";
import { webEditor } from "../editors";

/** A web page in a sandboxed iframe, with optional polling refresh. */
export const webCard: CardDefinition<"web"> = {
	kind: "web",
	templates: [
		{ id: "web", name: "Web page (iframe)", icon: "globe", build: () => ({ kind: "web", title: "Web", url: "", w: 6, h: 4 }) },
	],
	render: (_view, card, body, component) => renderWeb(card, body, component),
	renderEditor: (container, ctx) => webEditor(ctx, container),
	liveness: { mode: "poll" },
};
