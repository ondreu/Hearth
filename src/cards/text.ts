import type { CardDefinition } from "./definition";
import { renderText } from "../cardbodies";

/** A free-text jot-down note stored on the card. No settings. */
export const textCard: CardDefinition<"text"> = {
	kind: "text",
	templates: [
		{ id: "text", name: "Text / jot-down", icon: "pencil", build: () => ({ kind: "text", title: "Notes", text: "", w: 4, h: 2 }) },
	],
	render: (view, card, body, component) => renderText(view, card, body, component),
	liveness: { mode: "static" },
};
