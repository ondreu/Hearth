import type { CardDefinition } from "./definition";
import { renderStats } from "../cardbodies";
import { statsEditor } from "../editors";

/** Vault statistics: note/word counts, attachment breakdown, custom queries. */
export const statsCard: CardDefinition<"stats"> = {
	kind: "stats",
	templates: [
		{ id: "stats", name: "Vault statistics", icon: "bar-chart-3", build: () => ({ kind: "stats", title: "Stats", w: 4, h: 2 }) },
	],
	render: (view, card, body) => renderStats(view, card, body),
	renderEditor: (container, ctx) => statsEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.stats)
			copy.stats = {
				...source.stats,
				builtins: source.stats.builtins ? [...source.stats.builtins] : undefined,
				attachmentTypes: source.stats.attachmentTypes ? [...source.stats.attachmentTypes] : undefined,
				queries: source.stats.queries ? source.stats.queries.map((q) => ({ ...q })) : undefined,
			};
	},
	liveness: { mode: "vault" },
};
