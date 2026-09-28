/**
 * Terminal mode's text renderers, one module per family of card kinds,
 * collected here. See src/tui/registry.ts for how a card finds its renderer
 * and what happens to a kind that has none.
 */
import type { CardKind } from "../../types";
import type { TuiRenderer } from "../card";
import { calculatorTui } from "./calculator";
import { calendarTui, scheduleTui } from "./calendar";
import { clockTui } from "./clock";
import { favoritesTui, recentTui } from "./files";
import { gitTui } from "./git";
import { commandsTui, linksTui, templaterTui } from "./launch";
import { marketTui } from "./market";
import { dailyTui, embedTui, periodicTui, textTui } from "./notes";
import { heatmapTui, statsTui } from "./stats";
import { tasksTui } from "./tasks";
import { weatherTui } from "./weather";

export const TUI_RENDERERS: Partial<Record<CardKind, TuiRenderer>> = {
	calculator: calculatorTui,
	calendar: calendarTui,
	clock: clockTui,
	commands: commandsTui,
	daily: dailyTui,
	embed: embedTui,
	favorites: favoritesTui,
	git: gitTui,
	heatmap: heatmapTui,
	links: linksTui,
	market: marketTui,
	periodic: periodicTui,
	recent: recentTui,
	schedule: scheduleTui,
	stats: statsTui,
	tasks: tasksTui,
	templater: templaterTui,
	text: textTui,
	weather: weatherTui,
};
