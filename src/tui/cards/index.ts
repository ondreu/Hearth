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
import { linksTui, templaterTui } from "./launch";
import { dataviewTui } from "./dataview";
import { marketTui } from "./market";
import { dailyTui, embedTui, periodicTui, textTui } from "./notes";
import { operonTui } from "./operon";
import { petTui } from "./pet";
import { rssTui } from "./rss";
import { searchTui, searchbarTui } from "./search";
import { heatmapTui, statsTui } from "./stats";
import { tasksTui } from "./tasks";
import { tensionTui } from "./tension";
import { weatherTui } from "./weather";

export const TUI_RENDERERS: Partial<Record<CardKind, TuiRenderer>> = {
	bookmarks: bookmarksTui,
	calculator: calculatorTui,
	calendar: calendarTui,
	clock: clockTui,
	daily: dailyTui,
	dataview: dataviewTui,
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
	pet: petTui,
	recent: recentTui,
	rss: rssTui,
	schedule: scheduleTui,
	search: searchTui,
	searchbar: searchbarTui,
	stats: statsTui,
	tasks: tasksTui,
	templater: templaterTui,
	tension: tensionTui,
	text: textTui,
	weather: weatherTui,
};
