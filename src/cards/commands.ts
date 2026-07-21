import type { CardDefinition } from "./definition";
import { renderCommands } from "../cardbodies";
import { commandsEditor } from "../editors";

/** A free-form grid of command-palette tiles. */
export const commandsCard: CardDefinition<"commands"> = {
	kind: "commands",
	templates: [
		{ id: "commands", name: "Commands", icon: "terminal-square", build: () => ({ kind: "commands", title: "Commands", commands: [], w: 6, h: 2 }) },
	],
	render: (view, card, body) => renderCommands(view, card, body),
	renderEditor: (container, ctx) => commandsEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.commands) copy.commands = source.commands.map((c) => ({ ...c }));
	},
	liveness: { mode: "static" },
	cardClass: "is-tile-card",
};
