import type { CardDefinition } from "./definition";
import { renderSavedSearch } from "../cardbodies";
import { savedSearchEditor } from "../editors";

/** A saved query whose matching notes are listed live. */
export const searchCard: CardDefinition<"search"> = {
	kind: "search",
	templates: [
		{ id: "search", name: "Query", icon: "search", build: () => ({ kind: "search", title: "Query", savedSearch: { query: "" }, w: 4, h: 4 }) },
	],
	render: (view, card, body) => renderSavedSearch(view, card, body),
	renderEditor: (container, ctx) => savedSearchEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.savedSearch) copy.savedSearch = { ...source.savedSearch };
	},
	liveness: { mode: "vault" },
};
