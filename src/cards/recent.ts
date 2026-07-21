import type { CardDefinition } from "./definition";
import { renderRecent } from "../cardbodies";
import { recentEditor } from "../editors";

/** Recently opened files, filtered by type. */
export const recentCard: CardDefinition<"recent"> = {
	kind: "recent",
	templates: [
		{ id: "recent", name: "Recent files", icon: "history", build: () => ({ kind: "recent", title: "Recent", count: 8, w: 4, h: 3 }) },
	],
	render: (view, card, body) => renderRecent(view, card, body),
	renderEditor: (container, ctx) => recentEditor(ctx, container),
	liveness: { mode: "static" },
};
