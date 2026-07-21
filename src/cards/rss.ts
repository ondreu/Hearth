import type { CardDefinition } from "./definition";
import { renderRss } from "../cardbodies";
import { rssEditor } from "../editors";

/** An RSS/Atom reader with its own internal refresh. */
export const rssCard: CardDefinition<"rss"> = {
	kind: "rss",
	templates: [
		{ id: "rss", name: "RSS feed", icon: "rss", build: () => ({ kind: "rss", title: "RSS", rss: { sources: [] }, w: 4, h: 5 }) },
	],
	render: (view, card, body, component) => renderRss(view, card, body, component),
	renderEditor: (container, ctx) => rssEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.rss)
			copy.rss = {
				...source.rss,
				sources: source.rss.sources ? source.rss.sources.map((s) => ({ ...s })) : undefined,
			};
	},
	liveness: { mode: "static" },
};
