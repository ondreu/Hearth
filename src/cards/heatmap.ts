import { Setting } from "obsidian";
import { activityByDay, createDailyNoteAt, dailyNotesOptions, heatLevel, moment } from "../cardbodies";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Activity heatmap (GitHub-style) ------------------------------------

/** A contribution-style grid: one square per day for the last N weeks, tinted
 * by how many notes were edited (or created) that day. */
export function renderHeatmap(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.heatmap ?? {};
	const metric = cfg.metric ?? "modified";
	const weeks = cfg.weeks && cfg.weeks > 0 ? Math.min(cfg.weeks, 53) : 26;
	const activity = activityByDay(view.app, metric);
	const options = dailyNotesOptions(view);

	const wrap = body.createDiv("hearth-heatmap");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const today = moment().startOf("day");
	const todayKey: string = today.format("YYYY-MM-DD");
	// Start `weeks - 1` weeks back, aligned to the start of that week, so the
	// last column is the current (partial) week.
	let start = today.clone().subtract((weeks - 1) * 7, "days");
	start = start.clone().subtract((start.day() - startOfWeek + 7) % 7, "days");

	// Relative peak over the visible, non-future days.
	let peak = 1;
	for (let i = 0; i < weeks * 7; i++) {
		const key = start.clone().add(i, "days").format("YYYY-MM-DD");
		if (key <= todayKey) peak = Math.max(peak, activity.get(key) ?? 0);
	}

	const grid = wrap.createDiv("hearth-heatmap-grid");
	grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
	// Column-major fill (top-to-bottom, then next week): 7 rows, auto-flow column.
	for (let w = 0; w < weeks; w++) {
		for (let r = 0; r < 7; r++) {
			const day = start.clone().add(w * 7 + r, "days");
			const key: string = day.format("YYYY-MM-DD");
			const cellEl = grid.createDiv("hearth-heatmap-cell");
			if (key > todayKey) {
				cellEl.addClass("is-empty");
				continue;
			}
			const count = activity.get(key) ?? 0;
			cellEl.style.setProperty("--heat", String(heatLevel(count, peak)));
			cellEl.toggleClass("has-heat", count > 0);
			cellEl.setAttribute("aria-label", t().cards.calendar.dayMetric(day.format("MMM D, YYYY"), count, metric));
			cellEl.setAttribute("title", `${day.format("MMM D, YYYY")} · ${count} ${metric}`);
			if (options) {
				const activate = () => {
					void createDailyNoteAt(view, day, options).then((f) => {
						if (f) void view.app.workspace.getLeaf(true).openFile(f);
					});
				};
				cellEl.addEventListener("click", activate);
				makeClickable(cellEl, activate, day.format("MMMM D, YYYY"));
			}
		}
	}

	// A small Less→More legend.
	const legend = wrap.createDiv("hearth-heatmap-legend");
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: t().cards.heatmap.less });
	for (let l = 0; l <= 4; l++) {
		const sq = legend.createDiv("hearth-heatmap-cell");
		sq.style.setProperty("--heat", String(l));
		if (l > 0) sq.addClass("has-heat");
	}
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: t().cards.heatmap.more });
}


export function heatmapEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.heatmap ??= {});
	new Setting(containerEl)
		.setName(t().editors.heatmap.metric)
		.addDropdown((d) => {
			d.addOption("modified", t().editors.metricOptions.modified);
			d.addOption("created", t().editors.metricOptions.created);
			d.setValue(cfg.metric ?? "modified").onChange((v) => {
				cfg.metric = v as NonNullable<typeof cfg.metric>;
				ctx.opts.save();
			});
		});
	const weeks = new Setting(containerEl)
		.setName(t().editors.heatmap.weeks)
		.setDesc(t().editors.heatmap.weeksDesc);
	weeks.addSlider((s) => {
		s.setLimits(8, 53, 1)
			.setValue(cfg.weeks ?? 26)
			.setDynamicTooltip()
			.onChange((v) => {
				cfg.weeks = v === 26 ? undefined : v;
				ctx.opts.save();
			});
	});
	weeks.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.weeks = undefined;
				ctx.opts.save();
				ctx.requestRender();
			}),
	);
}

/** A calendar-style activity heatmap over a vault metric. */
export const heatmapCard: CardDefinition<"heatmap"> = {
	kind: "heatmap",
	templates: [
		{ id: "heatmap", name: "Activity heatmap", icon: "activity", build: () => ({ kind: "heatmap", title: "Activity", heatmap: {}, w: 6, h: 3 }) },
	],
	render: (view, card, body) => renderHeatmap(view, card, body),
	renderEditor: (container, ctx) => heatmapEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.heatmap) copy.heatmap = { ...source.heatmap };
	},
	liveness: { mode: "vault" },
};
