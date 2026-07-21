import type { CardDefinition } from "./definition";
import { renderLinks } from "../cardbodies";
import { linksEditor } from "../editors";

/** A free-form launchpad of link tiles. */
export const linksCard: CardDefinition<"links"> = {
	kind: "links",
	templates: [
		{ id: "links", name: "Links / launchpad", icon: "layout-grid", build: () => ({ kind: "links", title: "Links", links: [], w: 6, h: 2 }) },
	],
	render: (view, card, body) => renderLinks(view, card, body),
	renderEditor: (container, ctx) => linksEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.links) copy.links = source.links.map((l) => ({ ...l }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
};
