/**
 * Terminal mode's text renderers, one module per family of card kinds,
 * collected here. See src/tui/registry.ts for how a card finds its renderer
 * and what happens to a kind that has none.
 */
import type { CardKind } from "../../types";
import type { TuiRenderer } from "../card";
import { calculatorTui } from "./calculator";
import { clockTui } from "./clock";
import { favoritesTui, recentTui } from "./files";
import { commandsTui, linksTui, templaterTui } from "./launch";
import { dailyTui, embedTui, periodicTui, textTui } from "./notes";
import { heatmapTui, statsTui } from "./stats";

export const TUI_RENDERERS: Partial<Record<CardKind, TuiRenderer>> = {
	calculator: calculatorTui,
	clock: clockTui,
	commands: commandsTui,
	daily: dailyTui,
	embed: embedTui,
	favorites: favoritesTui,
	heatmap: heatmapTui,
	links: linksTui,
	periodic: periodicTui,
	recent: recentTui,
	stats: statsTui,
	templater: templaterTui,
	text: textTui,
};
