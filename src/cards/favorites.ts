import type { CardDefinition } from "./definition";
import { renderFavorites } from "../cardbodies";
import { favoritesEditor } from "../editors";

/** The user's starred notes (a Hearth-global list). */
export const favoritesCard: CardDefinition<"favorites"> = {
	kind: "favorites",
	templates: [
		{ id: "favorites", name: "Favorites", icon: "star", build: () => ({ kind: "favorites", title: "Favorites", w: 4, h: 3 }) },
	],
	render: (view, _card, body) => renderFavorites(view, body),
	renderEditor: (container, ctx) => favoritesEditor(ctx, container),
	liveness: { mode: "static" },
};
