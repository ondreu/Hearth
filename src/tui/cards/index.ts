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
import { bookmarksTui, folderTui } from "./folder";
import { gitTui } from "./git";
import { jiraTui } from "./jira";
import { commandsTui, linksTui, templaterTui } from "./launch";
import { marketTui } from "./market";
import { dailyTui, embedTui, periodicTui, textTui } from "./notes";
import { operonTui } from "./operon";
import { rssTui } from "./rss";
import { heatmapTui, statsTui } from "./stats";
import { tasksTui } from "./tasks";
import { weatherTui } from "./weather";

export const TUI_RENDERERS: Partial<Record<CardKind, TuiRenderer>> = {
	bookmarks: bookmarksTui,
	calculator: calculatorTui,
	calendar: calendarTui,
	clock: clockTui,
	commands: commandsTui,
	daily: dailyTui,
	embed: embedTui,
	favorites: favoritesTui,
	folder: folderTui,
	git: gitTui,
	heatmap: heatmapTui,
	jira: jiraTui,
	links: linksTui,
	market: marketTui,
	operon: operonTui,
	periodic: periodicTui,
	recent: recentTui,
	rss: rssTui,
	schedule: scheduleTui,
	stats: statsTui,
	tasks: tasksTui,
	templater: templaterTui,
	text: textTui,
	weather: weatherTui,
};
