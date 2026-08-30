import { Setting } from "obsidian";
import {
	activityByDay,
	createDailyNoteAt,
	customActivityByDay,
	dailyNotesOptions,
	heatLevel,
	moment,
} from "../cardbodies";
import { addResetButton, moveItem } from "../editors";
import { formatHeatValue, heatmapSource } from "../heatmapmetric";
import { t } from "../i18n";
import { openFile } from "../opener";
import {
	HEATMAP_RULE_FIELDS,
	HEATMAP_RULE_OPS,
	type DashboardCard,
	type HeatmapConfig,
	type HeatmapRuleField,
	type HeatmapRuleOp,
} from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Activity heatmap (GitHub-style) ------------------------------------

/** What one unit is called in a day's tooltip. Advanced cards may name it
 * themselves ("workouts"); otherwise it follows the metric — the file date it
 * counts, or, when the card sums a property, that property's own name. */
function heatUnit(cfg: HeatmapConfig): string {
	const custom = cfg.unit?.trim();
	if (custom) return custom;
	if ((cfg.value ?? "count") === "sum") {
		const prop = cfg.valueProperty?.trim();
		if (prop) return prop;
	}
	const source = heatmapSource(cfg);
	if (source === "created") return t().cards.heatmap.unitCreated;
	if (source === "property") return t().cards.heatmap.unitNotes;
	return t().cards.heatmap.unitModified;
}

/** A contribution-style grid: one square per day for the last N weeks, tinted
 * by how many notes were edited (or created) that day.
 *
 * With `advanced` on, the same grid stands for whatever the vault tracks: the
 * day comes from a frontmatter date, the value from a summed property, and
 * rules pick which notes count at all (see `src/heatmapmetric.ts`). */
export function renderHeatmap(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.heatmap ?? {};
	const advanced = cfg.advanced ?? false;
	const metric = cfg.metric ?? "modified";
	const weeks = cfg.weeks && cfg.weeks > 0 ? Math.min(cfg.weeks, 53) : 26;
	const activity = advanced ? customActivityByDay(view.app, cfg) : activityByDay(view.app, metric);
	const unit = advanced ? heatUnit(cfg) : metric;
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
			const date = day.format("MMM D, YYYY");
			// A summed metric can land on a fraction, so advanced cards read
			// their total through the formatter rather than as a bare number.
			const label = advanced
				? t().cards.heatmap.dayValue(date, formatHeatValue(count), unit)
				: t().cards.calendar.dayMetric(date, count, unit);
			cellEl.setAttribute("aria-label", label);
			cellEl.setAttribute("title", `${date} · ${formatHeatValue(count)} ${unit}`);
			if (options) {
				const activate = () => {
					void createDailyNoteAt(view, day, options).then((f) => {
						if (f) void openFile(view, f, "card");
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


/**
 * The heatmap card is a vault-activity grid by default — one dropdown and a
 * range. An "Advanced" toggle turns it into a custom metric: the day a note
 * lands on can come from frontmatter, the value can be a summed property, and
 * rules (all of them, or any) decide which notes count at all. Everything below
 * the toggle is gated on it, so a basic card stays basic.
 */
export function heatmapEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.heatmap ??= {});
	const strings = t().editors.heatmap;

	new Setting(containerEl)
		.setName(strings.advanced)
		.setDesc(strings.advancedDesc)
		.addToggle((tg) =>
			tg.setValue(cfg.advanced ?? false).onChange((v) => {
				cfg.advanced = v || undefined;
				ctx.opts.save();
				ctx.opts.rerender();
				// Show/hide the advanced controls below.
				ctx.requestRender();
			}),
		);

	if (!cfg.advanced) {
		new Setting(containerEl).setName(strings.metric).addDropdown((d) => {
			d.addOption("modified", t().editors.metricOptions.modified);
			d.addOption("created", t().editors.metricOptions.created);
			d.setValue(cfg.metric ?? "modified").onChange((v) => {
				cfg.metric = v as NonNullable<typeof cfg.metric>;
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
		weeksSetting(ctx, containerEl, cfg);
		return;
	}

	metricSection(ctx, containerEl, cfg);
	rulesSection(ctx, containerEl, cfg);
	// The range is about the grid rather than the metric, so with the advanced
	// sections above it, it gets a heading of its own instead of floating
	// between two of them.
	new Setting(containerEl).setName(strings.rangeHeading).setHeading();
	weeksSetting(ctx, containerEl, cfg);
}


/** How much history the grid shows — the one control both modes share. */
function weeksSetting(ctx: CardEditorContext, containerEl: HTMLElement, cfg: HeatmapConfig): void {
	const strings = t().editors.heatmap;
	const weeks = new Setting(containerEl).setName(strings.weeks).setDesc(strings.weeksDesc);
	weeks.addSlider((s) => {
		s.setLimits(8, 53, 1)
			.setValue(cfg.weeks ?? 26)
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


/** Advanced mode: where a day comes from, what each note adds, and what the
 * total is called. */
function metricSection(ctx: CardEditorContext, containerEl: HTMLElement, cfg: HeatmapConfig): void {
	const strings = t().editors.heatmap;
	new Setting(containerEl).setName(strings.metricHeading).setHeading();

	new Setting(containerEl)
		.setName(strings.source)
		.setDesc(strings.sourceDesc)
		.addDropdown((d) => {
			d.addOption("modified", strings.sourceOptions.modified);
			d.addOption("created", strings.sourceOptions.created);
			d.addOption("property", strings.sourceOptions.property);
			d.setValue(heatmapSource(cfg)).onChange((v) => {
				cfg.source = v as NonNullable<HeatmapConfig["source"]>;
				ctx.opts.save();
				ctx.opts.rerender();
				// The date-property field only applies to the property source.
				ctx.requestRender();
			});
		});

	if (heatmapSource(cfg) === "property") {
		new Setting(containerEl)
			.setName(strings.dateProperty)
			.setDesc(strings.datePropertyDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(strings.datePropertyPlaceholder)
					.setValue(cfg.dateProperty ?? "")
					.onChange((v) => {
						cfg.dateProperty = v.trim() || undefined;
						ctx.opts.save();
						ctx.opts.rerender();
					}),
			);
	}

	new Setting(containerEl)
		.setName(strings.value)
		.setDesc(strings.valueDesc)
		.addDropdown((d) => {
			d.addOption("count", strings.valueOptions.count);
			d.addOption("sum", strings.valueOptions.sum);
			d.setValue(cfg.value ?? "count").onChange((v) => {
				cfg.value = v === "count" ? undefined : "sum";
				ctx.opts.save();
				ctx.opts.rerender();
				// The value-property field only applies to a summed value.
				ctx.requestRender();
			});
		});

	if ((cfg.value ?? "count") === "sum") {
		new Setting(containerEl)
			.setName(strings.valueProperty)
			.setDesc(strings.valuePropertyDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(strings.valuePropertyPlaceholder)
					.setValue(cfg.valueProperty ?? "")
					.onChange((v) => {
						cfg.valueProperty = v.trim() || undefined;
						ctx.opts.save();
						ctx.opts.rerender();
					}),
			);
	}

	new Setting(containerEl)
		.setName(strings.unit)
		.setDesc(strings.unitDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.unitPlaceholder)
				.setValue(cfg.unit ?? "")
				.onChange((v) => {
					cfg.unit = v.trim() || undefined;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
}


/** Advanced mode: the rules deciding which notes are counted, and whether a
 * note has to meet all of them or just one. */
function rulesSection(ctx: CardEditorContext, containerEl: HTMLElement, cfg: HeatmapConfig): void {
	const strings = t().editors.heatmap;
	new Setting(containerEl).setName(strings.rules).setHeading();

	const matchSetting = new Setting(containerEl).setName(strings.match).setDesc(strings.rulesDesc);
	matchSetting.addDropdown((d) => {
		d.addOption("all", strings.matchOptions.all);
		d.addOption("any", strings.matchOptions.any);
		d.setValue(cfg.match ?? "all").onChange((v) => {
			cfg.match = v === "all" ? undefined : "any";
			ctx.opts.save();
			ctx.opts.rerender();
		});
	});
	addResetButton(ctx, matchSetting, t().settings.resetField, () => {
		cfg.match = undefined;
		cfg.rules = undefined;
	});

	const rules = (cfg.rules ??= []);
	rules.forEach((rule, index) => {
		const field: HeatmapRuleField = rule.field ?? "property";
		const op: HeatmapRuleOp = rule.op ?? "is";
		const row = new Setting(containerEl).setClass("hearth-link-setting");
		row.addDropdown((d) => {
			for (const id of HEATMAP_RULE_FIELDS) d.addOption(id, strings.fieldOptions[id]);
			d.setValue(field).onChange((v) => {
				rule.field = v === "property" ? undefined : (v as HeatmapRuleField);
				ctx.opts.save();
				ctx.opts.rerender();
				// A property rule needs a key field; the others don't.
				ctx.requestRender();
			});
		});
		if (field === "property") {
			row.addText((txt) =>
				txt
					.setPlaceholder(strings.keyPlaceholder)
					.setValue(rule.key ?? "")
					.onChange((v) => {
						rule.key = v.trim() || undefined;
						ctx.opts.save();
						ctx.opts.rerender();
					}),
			);
		}
		row.addDropdown((d) => {
			for (const id of HEATMAP_RULE_OPS) d.addOption(id, strings.opOptions[id]);
			d.setValue(op).onChange((v) => {
				rule.op = v === "is" ? undefined : (v as HeatmapRuleOp);
				ctx.opts.save();
				ctx.opts.rerender();
				// "exists"/"missing" take no value, so the field disappears.
				ctx.requestRender();
			});
		});
		if (op !== "exists" && op !== "missing") {
			row.addText((txt) =>
				txt
					.setPlaceholder(strings.valuePlaceholder)
					.setValue(rule.value ?? "")
					.onChange((v) => {
						rule.value = v.trim() || undefined;
						ctx.opts.save();
						ctx.opts.rerender();
					}),
			);
		}
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-up")
				.setTooltip(t().editors.links.moveUp)
				.setDisabled(index === 0)
				.onClick(() => moveItem(ctx, rules, index, index - 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("chevron-down")
				.setTooltip(t().editors.links.moveDown)
				.setDisabled(index === rules.length - 1)
				.onClick(() => moveItem(ctx, rules, index, index + 1)),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip(strings.removeRule)
				.onClick(() => {
					rules.splice(index, 1);
					ctx.opts.save();
					ctx.opts.rerender();
					ctx.requestRender();
				}),
		);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(strings.addRule).onClick(() => {
			rules.push({ id: `rule-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}` });
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
		if (source.heatmap)
			copy.heatmap = {
				...source.heatmap,
				rules: source.heatmap.rules ? source.heatmap.rules.map((r) => ({ ...r })) : undefined,
			};
	},
	liveness: { mode: "vault" },
};
