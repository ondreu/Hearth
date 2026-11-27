import { describe, expect, it } from "vitest";
import { CARD_TEMPLATES, templateCategory, unmetRequirement } from "../src/cards";
import type { App } from "obsidian";

/** The Graph template is a preset over the leaf card, not a new card kind. */
describe("graph template", () => {
	it("builds a leaf card hosting the core graph view", () => {
		const template = CARD_TEMPLATES.find((tpl) => tpl.id === "graph");
		expect(template).toBeDefined();
		expect(templateCategory("graph")).toBe("integrations");
		expect(template!.build()).toMatchObject({
			kind: "leaf",
			title: "Graph",
			leafView: { viewType: "graph" },
			w: 5,
			h: 5,
		});
	});

	it("follows the core graph plugin's enabled flag", () => {
		const template = CARD_TEMPLATES.find((tpl) => tpl.id === "graph")!;
		const appWith = (enabled: boolean) =>
			({
				internalPlugins: {
					getPluginById: (id: string) => (id === "graph" ? { enabled } : undefined),
				},
			}) as unknown as App;
		expect(unmetRequirement(appWith(true), template)).toBeNull();
		expect(unmetRequirement(appWith(false), template)?.name).toBe("Graph view");
	});
});
