/**
 * Vault statistics and the activity heatmap, as text.
 *
 * Statistics are the htop summary: `Notes 1,284   Folders 96`, labels in the
 * scheme's cyan and values in bold, in as many columns as the card is wide.
 * The heatmap is the contribution grid in `■` cells shaded in four steps,
 * with a day cursor the arrows move and Enter opens.
 */
import { activityByDay, createDailyNoteAt, customActivityByDay, dailyNotesOptions, heatLevel, moment, type Moment } from "../../cardbodies";
import { heatUnit } from "../../cards/heatmap";
import { statTiles } from "../../cards/stats";
import { formatHeatValue } from "../../heatmapmetric";
import { t } from "../../i18n";
import { openFile } from "../../opener";
import type { TuiRenderer } from "../card";
import { asciify, padEnd, padStart, spread, strWidth, type Line, type TuiStyle } from "../text";
import { messageOutput } from "./common";

/** A number the way a summary line shows it: grouped thousands. */
function fmt(n: number): string {
	return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const statsTui: TuiRenderer = {
	render(ctx) {
		const tiles = statTiles(ctx.view, ctx.card);
		if (tiles.length === 0) return messageOutput(t().tui.cards.statsEmpty, ctx.cols);
		const labelW = Math.min(16, Math.max(...tiles.map((x) => strWidth(asciify(x.label)))) + 1);
		const valueW = Math.max(...tiles.map((x) => strWidth(fmt(x.value))));
		const cellW = labelW + valueW + 3;
		const across = Math.max(1, Math.floor((ctx.cols + 3) / cellW));
		const lines: Line[] = [];
		for (let i = 0; i < tiles.length; i += across) {
			const line: Line = [];
			tiles.slice(i, i + across).forEach((tile, j) => {
				if (j > 0) line.push({ text: "   " });
				line.push({ text: padEnd(asciify(tile.label), labelW), style: "cyan" });
				line.push({ text: padStart(fmt(tile.value), valueW), style: "bold" });
			});
			lines.push(line);
		}
		return { lines };
	},
};

const HEAT: TuiStyle[] = ["faint", "heat1", "heat2", "heat3", "heat4"];

/** How many weeks the grid shows at `cols` wide, and the day it starts on:
 * the start of the week `weeks - 1` weeks back, so the last column is this
 * (partial) week. */
function heatGeometry(weeksAsked: number | undefined, cols: number): { weeks: number; start: Moment; today: Moment } {
	const asked = weeksAsked && weeksAsked > 0 ? Math.min(weeksAsked, 53) : 26;
	// Two cells a week, after a four-cell weekday gutter.
	const weeks = Math.max(4, Math.min(asked, Math.floor((cols - 4) / 2)));
	const firstDay = moment.localeData().firstDayOfWeek();
	const today = moment().startOf("day");
	let start = today.clone().subtract((weeks - 1) * 7, "days");
	start = start.clone().subtract((start.day() - firstDay + 7) % 7, "days");
	return { weeks, start, today };
}

export const heatmapTui: TuiRenderer = {
	render(ctx) {
		const { view } = ctx;
		const cfg = ctx.card.heatmap ?? {};
		const advanced = cfg.advanced ?? false;
		const metric = cfg.metric ?? "modified";
		const { weeks, start, today } = heatGeometry(cfg.weeks, ctx.cols);
		const activity = advanced ? customActivityByDay(view.app, cfg) : activityByDay(view.app, metric);
		const unit = advanced ? heatUnit(cfg) : metric === "created" ? t().cards.heatmap.unitCreated : t().cards.heatmap.unitModified;
		const options = dailyNotesOptions(view);

		const todayKey = today.format("YYYY-MM-DD");
		const dayAt = (w: number, r: number): Moment => start.clone().add(w * 7 + r, "days");

		let peak = 1;
		let total = 0;
		for (let i = 0; i < weeks * 7; i++) {
			const key = start.clone().add(i, "days").format("YYYY-MM-DD");
			if (key > todayKey) continue;
			const v = activity.get(key) ?? 0;
			peak = Math.max(peak, v);
			total += v;
		}

		// The day cursor: today until moved.
		const todayIndex = today.diff(start, "days");
		let cursor = typeof ctx.state.cursor === "number" ? ctx.state.cursor : todayIndex;
		cursor = Math.max(0, Math.min(todayIndex, cursor));
		ctx.state.cursor = cursor;

		const open = (day: Moment) => {
			if (!options) return;
			void createDailyNoteAt(view, day, options).then((f) => {
				if (f) void openFile(view, f, "card");
			});
		};

		// Month labels over the week their first day falls in.
		const months: string[] = Array.from({ length: weeks * 2 }, () => " ");
		let prevMonth = -1;
		for (let w = 0; w < weeks; w++) {
			const m = dayAt(w, 0).month();
			if (m !== prevMonth) {
				prevMonth = m;
				const label = moment(new Date(2020, m, 1)).format("MMM");
				if (w * 2 + label.length <= months.length) Array.from(label).forEach((c, k) => (months[w * 2 + k] = c));
			}
		}
		const lines: Line[] = [[{ text: "    " }, { text: months.join(""), style: "dim" }]];
		for (let r = 0; r < 7; r++) {
			const name = dayAt(0, r).format("dd");
			const line: Line = [{ text: r % 2 === 0 ? `${padEnd(name, 3)} ` : "    ", style: "dim" }];
			for (let w = 0; w < weeks; w++) {
				const day = dayAt(w, r);
				const key = day.format("YYYY-MM-DD");
				if (key > todayKey) {
					line.push({ text: "  " });
					continue;
				}
				const idx = w * 7 + r;
				const v = activity.get(key) ?? 0;
				const level = heatLevel(v, peak);
				const style: TuiStyle[] = [HEAT[level]];
				if (ctx.focused && idx === cursor) style.push("reverse");
				else if (key === todayKey) style.push("underline");
				line.push({
					text: level > 0 ? "■" : "·",
					style,
					onClick: () => {
						ctx.state.cursor = idx;
						open(day);
					},
					label: `${day.format("ll")} · ${formatHeatValue(v)} ${unit}`,
				});
				line.push({ text: " " });
			}
			lines.push(line);
		}

		const sel = start.clone().add(cursor, "days");
		const selValue = activity.get(sel.format("YYYY-MM-DD")) ?? 0;
		lines.push([]);
		lines.push(
			spread(
				[{ text: sel.format("ddd ll"), style: "bold" }, { text: ` · ${formatHeatValue(selValue)} ${unit}`, style: "dim" }],
				[
					{ text: `${t().cards.heatmap.less} `, style: "dim" },
					...HEAT.flatMap((s, i) => [{ text: i === 0 ? "·" : "■", style: s }, { text: " " }]),
					{ text: t().cards.heatmap.more, style: "dim" },
				],
				ctx.cols,
			),
		);
		return {
			lines,
			hint: t().tui.cards.heatTotal(formatHeatValue(total), weeks),
			foot: options ? t().tui.cards.heatFoot : t().tui.cards.heatFootNoDaily,
		};
	},
	key(ctx, evt) {
		const cursor = typeof ctx.state.cursor === "number" ? ctx.state.cursor : 0;
		const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[evt.key];
		if (step !== undefined) {
			ctx.state.cursor = Math.max(0, cursor + step);
			ctx.redraw();
			return true;
		}
		if (evt.key === "Home" || evt.key === "End") {
			ctx.state.cursor = evt.key === "Home" ? 0 : Number.MAX_SAFE_INTEGER;
			ctx.redraw();
			return true;
		}
		if (evt.key === "Enter") {
			const options = dailyNotesOptions(ctx.view);
			if (!options) return false;
			const { start } = heatGeometry(ctx.card.heatmap?.weeks, ctx.cols);
			const day = start.clone().add(cursor, "days");
			void createDailyNoteAt(ctx.view, day, options).then((f) => {
				if (f) void openFile(ctx.view, f, "card");
			});
			return true;
		}
		return false;
	},
};
