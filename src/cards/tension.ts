import { Component, Setting } from "obsidian";
import { emptyState } from "../cardbodies";
import { setIcon } from "../glyphs";
import { t } from "../i18n";
import { shapePath } from "../shapes";
import {
	cachedTension,
	firstSentence,
	loadTension,
	TENSION_BANDS,
	TENSION_SITE,
	tensionBand,
	tensionDelta,
	type TensionBand,
	type TensionPoint,
	type TensionRequest,
	type TensionSnapshot,
} from "../tension";
import { buildScene, mountScene } from "../tensionscene";
import {
	type DashboardCard,
	effectiveAutoRefreshMinutes,
	effectiveCardDesign,
	motionAllowed,
	skyDensity,
	type TensionConfig,
	type TensionStyle,
} from "../types";
import { makeClickable } from "../ui";
import type { HomeView } from "../view";
import type { CardDefinition, CardEditorContext } from "./definition";

// ---- World Tension ------------------------------------------------------------
//
// Kagi News' World Tension index (src/tension.ts): a language model's 0–100
// reading of how tense the world's news is today. Two styles — a minimal
// reading and a diorama that goes from peace to war (src/tensionscene.ts) —
// each in Classic and Expressive, the card's own design. Clicking the card
// opens the index on Kagi News, where the reasoning and the history are.

/** Every config value a render needs, with its default applied. */
export interface TensionResolved {
	style: TensionStyle;
	showBand: boolean;
	showSummary: boolean;
	summaryLength: "sentence" | "full";
	showChange: boolean;
	showHistory: boolean;
	historyDays: number;
	showScale: boolean;
	showUpdated: boolean;
	animate: boolean;
	refreshMin: number;
	expressive: boolean;
	density: number;
}

export const TENSION_HISTORY_DAYS = [7, 14, 30, 60, 90] as const;

export function resolveTension(cfg: TensionConfig, lowPower = false, density = 1, expressive = false): TensionResolved {
	const days = cfg.historyDays ?? 30;
	return {
		style: cfg.style === "artistic" ? "artistic" : "minimal",
		showBand: cfg.showBand !== false,
		showSummary: cfg.showSummary === true,
		summaryLength: cfg.summaryLength === "full" ? "full" : "sentence",
		showChange: cfg.showChange === true,
		showHistory: cfg.showHistory === true,
		historyDays: Math.max(2, Math.min(90, Math.round(Number.isFinite(days) ? days : 30))),
		showScale: cfg.showScale !== false,
		showUpdated: cfg.showUpdated === true,
		animate: (cfg.animate ?? true) && !lowPower,
		refreshMin: Math.max(0, cfg.refreshMin ?? 60),
		expressive,
		density,
	};
}

/** What to fetch: a history only when something on the card draws it. The
 * change against yesterday needs a couple of days at least. */
export function tensionRequest(r: TensionResolved): TensionRequest {
	if (r.showHistory) return { historyDays: r.historyDays };
	return { historyDays: r.showChange ? 7 : 0 };
}

/** The cache floor: Kagi scores the news a few times a day, so a board's
 * frequent re-renders must never become requests. */
export function tensionTtlMs(r: TensionResolved): number {
	return Math.max(r.refreshMin, 15) * 60_000;
}

export function bandLabel(band: TensionBand): string {
	return t().cards.tension.bands[band];
}

/** The model's explanation, trimmed to what the card is set to show. */
export function summaryText(summary: string, r: TensionResolved): string {
	return r.summaryLength === "full" ? summary.trim() : firstSentence(summary);
}

/** "▲ 4", "▼ 2", "= 0" — the move since the day before. */
export function changeText(delta: number): string {
	if (delta > 0) return `▲ ${delta}`;
	if (delta < 0) return `▼ ${-delta}`;
	return "= 0";
}

/** When Kagi scored it: a time today, else a date and a time. */
export function updatedText(snapshot: TensionSnapshot): string {
	const at = new Date(snapshot.now?.updated ?? snapshot.fetched);
	const sameDay = at.toDateString() === new Date().toDateString();
	const when = sameDay
		? at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
		: at.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	return t().cards.tension.updated(when);
}

// ---- Pieces ---------------------------------------------------------------------

/** The five bands as a segmented scale with a marker at the score. */
function scale(parent: HTMLElement, score: number): void {
	const el = parent.createDiv("hearth-tension-scale");
	el.setAttribute("aria-hidden", "true");
	const track = el.createDiv("hearth-tension-scale-track");
	for (const band of TENSION_BANDS) track.createDiv(`hearth-tension-scale-seg is-band-${band}`);
	const marker = el.createDiv("hearth-tension-scale-marker");
	marker.style.left = `${Math.max(0, Math.min(100, score))}%`;
}

/** The last days as a line — the Expressive design draws it thick and ends it
 * on a dot. Returns nothing below two points. */
function sparkline(parent: HTMLElement, points: readonly TensionPoint[], r: TensionResolved): void {
	if (points.length < 2) return;
	const w = 100;
	const h = 24;
	const pad = r.expressive ? 3 : 1.5;
	const xs = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
	// The whole scale, not the history's own range: a calm month shouldn't draw
	// as a mountain range.
	const ys = (score: number) => pad + (1 - score / 100) * (h - pad * 2);
	const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(2)} ${ys(p.score).toFixed(2)}`).join(" ");
	const box = parent.createDiv("hearth-tension-history");
	const svg = box.createSvg("svg", {
		attr: { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", "aria-hidden": "true" },
	});
	svg.createSvg("path", {
		cls: "hearth-tension-history-area",
		attr: { d: `${line} L${xs(points.length - 1).toFixed(2)} ${h} L${xs(0).toFixed(2)} ${h} Z` },
	});
	svg.createSvg("path", { cls: "hearth-tension-history-line", attr: { d: line, "vector-effect": "non-scaling-stroke" } });
	const last = points[points.length - 1];
	box.setAttribute(
		"title",
		t().cards.tension.historyTip(points.length, Math.round(Math.min(...points.map((p) => p.score))), Math.round(Math.max(...points.map((p) => p.score)))),
	);
	if (r.expressive) {
		const dot = box.createDiv("hearth-tension-history-dot");
		dot.style.left = `${xs(points.length - 1)}%`;
		dot.style.top = `${(ys(last.score) / h) * 100}%`;
	}
}

/** The thermometer glyph; Expressive sets it on a cookie in the band's tone. */
function glyph(parent: HTMLElement, r: TensionResolved): void {
	const el = parent.createDiv("hearth-tension-glyph");
	if (r.expressive) {
		const svg = el.createSvg("svg", { cls: "hearth-tension-cookie", attr: { viewBox: "0 0 48 48", "aria-hidden": "true" } });
		svg.createSvg("path", { attr: { d: shapePath(24, 24, 21, 9, 0.07) } });
	}
	setIcon(el.createDiv("hearth-tension-glyph-icon"), "thermometer");
}

function summaryBlock(parent: HTMLElement, snapshot: TensionSnapshot, r: TensionResolved, cls: string): void {
	const summary = snapshot.now?.summary ?? "";
	if (!r.showSummary || !summary) return;
	const box = parent.createDiv(cls);
	box.createDiv({ cls: "hearth-tension-summary-text", text: summaryText(summary, r) });
	box.createDiv({ cls: "hearth-tension-summary-source", text: t().cards.tension.source });
}

function bandLine(parent: HTMLElement, snapshot: TensionSnapshot, band: TensionBand, r: TensionResolved, cls: string): void {
	const delta = r.showChange ? tensionDelta(snapshot) : null;
	if (!r.showBand && delta === null) return;
	const row = parent.createDiv(cls);
	if (r.showBand) row.createSpan({ cls: "hearth-tension-band", text: bandLabel(band) });
	if (delta !== null) {
		const chip = row.createSpan({ cls: "hearth-tension-change", text: changeText(delta) });
		chip.toggleClass("is-up", delta > 0);
		chip.toggleClass("is-down", delta < 0);
		chip.setAttribute("title", t().cards.tension.changeTip);
	}
}

function scoreEl(parent: HTMLElement, score: number, cls: string): void {
	const el = parent.createDiv(cls);
	el.createSpan({ cls: "hearth-tension-score-value", text: String(Math.round(score)) });
	el.createSpan({ cls: "hearth-tension-score-max", text: "/100" });
}

// ---- Styles -----------------------------------------------------------------------

function paintMinimal(wrap: HTMLElement, snapshot: TensionSnapshot, r: TensionResolved): void {
	const now = snapshot.now;
	if (!now) return;
	const band = tensionBand(now.score);
	const hero = wrap.createDiv("hearth-tension-hero");
	glyph(hero, r);
	scoreEl(hero, now.score, "hearth-tension-score");
	bandLine(wrap, snapshot, band, r, "hearth-tension-meta");
	if (r.showScale) scale(wrap, now.score);
	if (r.showHistory) sparkline(wrap, snapshot.history, r);
	summaryBlock(wrap, snapshot, r, "hearth-tension-summary");
	if (r.showUpdated) wrap.createDiv({ cls: "hearth-tension-updated", text: updatedText(snapshot) });
}

let sceneSeq = 0;

function paintArtistic(wrap: HTMLElement, snapshot: TensionSnapshot, r: TensionResolved): void {
	const now = snapshot.now;
	if (!now) return;
	const band = tensionBand(now.score);
	const scene = wrap.createDiv(`hearth-tension-scene is-${band}`);
	scene.toggleClass("is-expressive", r.expressive);
	scene.toggleClass("is-animated", r.animate);
	mountScene(scene, buildScene({ band, design: r.expressive ? "expressive" : "classic", density: r.density, uid: String(++sceneSeq) }));

	const content = scene.createDiv("hearth-tension-art-content");
	const top = content.createDiv("hearth-tension-art-top");
	top.createDiv({ cls: "hearth-tension-art-title", text: t().cards.tension.title });
	bandLine(top, snapshot, band, r, "hearth-tension-art-meta");

	const bottom = content.createDiv("hearth-tension-art-bottom");
	scoreEl(bottom, now.score, "hearth-tension-art-score");
	if (r.showHistory) sparkline(bottom, snapshot.history, r);
	summaryBlock(bottom, snapshot, r, "hearth-tension-art-summary");
	if (r.showUpdated) bottom.createDiv({ cls: "hearth-tension-updated", text: updatedText(snapshot) });
}

/** Paint a snapshot that has a reading in the resolved style. Exported for the
 * DOM test, which draws every band in every style and design. */
export function paintTensionStyle(wrap: HTMLElement, snapshot: TensionSnapshot, r: TensionResolved): void {
	if (r.style === "artistic") paintArtistic(wrap, snapshot, r);
	else paintMinimal(wrap, snapshot, r);
}

// ---- Render -----------------------------------------------------------------------

export function renderTension(view: HomeView, card: DashboardCard, body: HTMLElement, component: Component): void {
	const settings = view.plugin.settings;
	const cfg = card.tension ?? {};
	const r = resolveTension(
		cfg,
		!motionAllowed(settings),
		skyDensity(settings),
		effectiveCardDesign(settings, card.design) === "expressive",
	);
	const req = tensionRequest(r);
	const ttlMs = tensionTtlMs(r);
	const disabled = settings.disableExternalCalls;

	body.addClass("hearth-tension-host");
	if (r.style === "artistic") body.addClass("hearth-tension-flush");

	let destroyed = false;
	component.register(() => {
		destroyed = true;
	});
	let loading = false;

	const wrap = body.createDiv(`hearth-tension is-${r.style}`);
	wrap.toggleClass("is-expressive", r.expressive);

	const open = (): void => {
		window.open(TENSION_SITE, "_blank");
	};
	wrap.addEventListener("click", open);
	makeClickable(wrap, open, t().cards.tension.open);

	const paint = (): void => {
		wrap.empty();
		for (const b of TENSION_BANDS) wrap.removeClass(`is-band-${b}`);
		const snapshot = cachedTension(req);
		if (snapshot?.now) {
			const band = tensionBand(snapshot.now.score);
			wrap.addClass(`is-band-${band}`);
			wrap.setAttribute(
				"aria-label",
				t().cards.tension.aria(Math.round(snapshot.now.score), bandLabel(band)),
			);
			// The whole explanation on hover, whatever the card shows of it.
			if (snapshot.now.summary) wrap.setAttribute("title", `${snapshot.now.summary}\n\n${t().cards.tension.source}`);
			else wrap.removeAttribute("title");
			paintTensionStyle(wrap, snapshot, r);
			return;
		}
		wrap.removeAttribute("title");
		if (snapshot) emptyState(wrap, "thermometer", t().cards.tension.none);
		else if (loading) emptyState(wrap, "thermometer", t().cards.tension.loading);
		else if (disabled) emptyState(wrap, "wifi-off", t().cards.tension.disabled);
		else emptyState(wrap, "cloud-off", t().cards.tension.error);
	};

	const load = (force: boolean): void => {
		loading = !cachedTension(req);
		paint();
		void loadTension(req, { ttlMs, disabled, force }).then(() => {
			if (destroyed) return;
			loading = false;
			paint();
		});
	};

	load(false);

	const autoMin = effectiveAutoRefreshMinutes(settings, r.refreshMin);
	if (autoMin > 0) {
		component.registerInterval(window.setInterval(() => load(true), autoMin * 60_000));
	}
}

// ---- Editor -----------------------------------------------------------------------

export function tensionEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.tension ??= {});
	const strings = t().editors.tension;
	const style = cfg.style ?? "minimal";
	const changed = (rebuild = false): void => {
		ctx.opts.save();
		ctx.opts.rerender();
		if (rebuild) ctx.requestRender();
	};

	new Setting(containerEl).setName(strings.about).setDesc(strings.aboutDesc);

	new Setting(containerEl).setName(strings.appearance).setHeading();
	// Terminal mode draws both styles as the same text reading.
	if (!ctx.terminal) {
		new Setting(containerEl)
			.setName(strings.style)
			.setDesc(strings.styleDesc)
			.addDropdown((d) => {
				d.addOption("minimal", strings.styleMinimal);
				d.addOption("artistic", strings.styleArtistic);
				d.setValue(style).onChange((v) => {
					cfg.style = v === "artistic" ? "artistic" : undefined;
					changed(true);
				});
			});
		if (style === "artistic") {
			new Setting(containerEl)
				.setName(strings.animate)
				.setDesc(strings.animateDesc)
				.addToggle((tg) =>
					tg.setValue(cfg.animate !== false).onChange((v) => {
						cfg.animate = v ? undefined : false;
						changed();
					}),
				);
		}
	}

	new Setting(containerEl).setName(strings.display).setHeading();
	const toggle = (name: string, desc: string, get: () => boolean | undefined, set: (v: boolean | undefined) => void, defaultOn: boolean, rebuild = false): void => {
		const setting = new Setting(containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addToggle((tg) =>
			tg.setValue(get() ?? defaultOn).onChange((v) => {
				set(v === defaultOn ? undefined : v);
				changed(rebuild);
			}),
		);
	};

	toggle(strings.showBand, "", () => cfg.showBand, (v) => (cfg.showBand = v), true);
	toggle(strings.showSummary, strings.showSummaryDesc, () => cfg.showSummary, (v) => (cfg.showSummary = v), false, true);
	if (cfg.showSummary) {
		new Setting(containerEl).setName(strings.summaryLength).addDropdown((d) => {
			d.addOption("sentence", strings.summarySentence);
			d.addOption("full", strings.summaryFull);
			d.setValue(cfg.summaryLength ?? "sentence").onChange((v) => {
				cfg.summaryLength = v === "full" ? "full" : undefined;
				changed();
			});
		});
	}
	if (style === "minimal" || ctx.terminal) {
		toggle(strings.showScale, "", () => cfg.showScale, (v) => (cfg.showScale = v), true);
	}
	toggle(strings.showChange, strings.showChangeDesc, () => cfg.showChange, (v) => (cfg.showChange = v), false);
	toggle(strings.showHistory, "", () => cfg.showHistory, (v) => (cfg.showHistory = v), false, true);
	if (cfg.showHistory) {
		new Setting(containerEl).setName(strings.historyDays).addDropdown((d) => {
			for (const days of TENSION_HISTORY_DAYS) d.addOption(String(days), strings.days(days));
			d.setValue(String(cfg.historyDays ?? 30)).onChange((v) => {
				const days = Number(v);
				cfg.historyDays = days === 30 ? undefined : days;
				changed();
			});
		});
	}
	toggle(strings.showUpdated, "", () => cfg.showUpdated, (v) => (cfg.showUpdated = v), false);

	const refresh = new Setting(containerEl).setName(strings.refresh).setDesc(strings.refreshDesc);
	refresh.addSlider((s) =>
		s
			.setLimits(0, 360, 15)
			.setValue(cfg.refreshMin ?? 60)
			.onChange((v) => {
				cfg.refreshMin = v === 60 ? undefined : v;
				changed();
			}),
	);
	refresh.addExtraButton((b) =>
		b
			.setIcon("rotate-ccw")
			.setTooltip(t().settings.resetSlider)
			.onClick(() => {
				cfg.refreshMin = undefined;
				changed(true);
			}),
	);
}

/** Kagi News' World Tension index: a language model's reading of the day's
 * news, from calm to on fire. */
export const tensionCard: CardDefinition<"tension"> = {
	kind: "tension",
	templates: [
		{
			id: "tension",
			name: "World tension",
			icon: "thermometer",
			build: () => ({ kind: "tension", title: "World tension", tension: {}, w: 3, h: 3 }),
		},
	],
	render: (view, card, body, component) => renderTension(view, card, body, component),
	renderEditor: (container, ctx) => tensionEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.tension) copy.tension = { ...source.tension };
	},
	liveness: { mode: "static" },
	expressive: true,
};
