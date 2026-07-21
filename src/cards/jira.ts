import type { CardDefinition } from "./definition";
import { renderJiraCard } from "../jira";
import { jiraEditor } from "../editors";

/** A Jira saved-filter card showing matching issues, with refinement controls. */
export const jiraCard: CardDefinition<"jira"> = {
	kind: "jira",
	templates: [
		{
			id: "jira",
			name: "Jira filter",
			icon: "ticket",
			build: () => ({
				kind: "jira",
				title: "Jira",
				jira: {
					apiBasePath: "/rest/api/latest",
					controls: ["status", "assignee", "priority", "issueType", "sprint", "fixVersion"],
					maxResults: 50,
					refreshMin: 0,
					cacheMin: 5,
				},
				w: 6,
				h: 5,
			}),
		},
	],
	render: (view, card, body, component) => renderJiraCard(view, card, body, component),
	renderEditor: (container, ctx) => jiraEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.jira)
			copy.jira = {
				...source.jira,
				controls: source.jira.controls ? [...source.jira.controls] : undefined,
				selections: source.jira.selections
					? Object.fromEntries(
							Object.entries(source.jira.selections).map(([key, values]) => [
								key,
								values ? [...values] : values,
							]),
						)
					: undefined,
			};
	},
	liveness: { mode: "static" },
};
