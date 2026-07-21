import type { CardDefinition } from "./definition";
import { renderBookmarks } from "../cardbodies";

/** The core Bookmarks plugin's entries, grouped. No settings. */
export const bookmarksCard: CardDefinition<"bookmarks"> = {
	kind: "bookmarks",
	templates: [
		{ id: "bookmarks", name: "Bookmarks", icon: "bookmark", build: () => ({ kind: "bookmarks", title: "Bookmarks", w: 4, h: 3 }) },
	],
	render: (view, _card, body) => renderBookmarks(view, body),
	liveness: { mode: "static" },
};
