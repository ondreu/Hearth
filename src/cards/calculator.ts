import type { CardDefinition } from "./definition";
import { renderCalculator } from "../cardbodies";
import { calculatorEditor } from "../editors";

/** A calculator with history and unit/currency conversion. */
export const calculatorCard: CardDefinition<"calculator"> = {
	kind: "calculator",
	templates: [
		{ id: "calculator", name: "Calculator", icon: "calculator", build: () => ({ kind: "calculator", title: "Calculator", calculator: {}, w: 4, h: 3 }) },
	],
	render: (view, card, body) => renderCalculator(view, card, body),
	renderEditor: (container, ctx) => calculatorEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.calculator) copy.calculator = { ...source.calculator };
	},
	liveness: { mode: "static" },
};
