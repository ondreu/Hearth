import { Component } from "obsidian";
import { moment } from "../cardbodies";
import { clockEditor } from "../editors";
import { t } from "../i18n";
import { type ClockConfig, type DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Clock / greeting ---------------------------------------------------

/** Time-of-day buckets used to pick a fitting greeting. */
function greetingBucket(hour: number): number {
	if (hour < 5) return 0; // late night
	if (hour < 8) return 1; // early morning
	if (hour < 12) return 2; // morning
	if (hour < 17) return 3; // afternoon
	if (hour < 22) return 4; // evening
	return 5; // night
}


function pickGreeting(hour: number, playful: boolean): string {
	if (!playful) {
		return hour < 12 ? t().clock.greetingMorning : hour < 18 ? t().clock.greetingAfternoon : t().clock.greetingEvening;
	}
	const pool = t().clock.playfulGreetings[greetingBucket(hour)];
	return pool[Math.floor(Math.random() * pool.length)];
}


/** Resolve the clock's `hour12` option. Returns `undefined` for "auto" so the
 * locale default is used, or a boolean to force a 12- or 24-hour clock. Falls
 * back to the deprecated `use24Hour` flag for configs saved before hourFormat. */
function resolveHour12(cfg: ClockConfig): boolean | undefined {
	const fmt = cfg.hourFormat ?? (cfg.use24Hour ? "24" : "auto");
	if (fmt === "24") return false;
	if (fmt === "12") return true;
	return undefined;
}


function formatClockDate(now: Date, mode: NonNullable<ClockConfig["dateMode"]>, custom?: string): string {
	switch (mode) {
		case "short":
			return now.toLocaleDateString(undefined, { dateStyle: "short" });
		case "long":
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
		case "iso": {
			const iso: string = moment(now).format("YYYY-MM-DD");
			return iso;
		}
		case "weekday":
			return now.toLocaleDateString(undefined, { weekday: "long" });
		case "custom": {
			const formatted: string = custom?.trim() ? moment(now).format(custom) : "";
			return formatted;
		}
		case "full":
		default:
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
	}
}


function svgEl(
	parent: Element,
	tag: keyof SVGElementTagNameMap,
	attrs: Record<string, string>,
	cls?: string,
): SVGElement {
	return parent.createSvg(tag, { attr: attrs, cls });
}


/** Draw an analogue clock face and return a tick() to rotate its hands. */
function renderAnalogClock(wrap: HTMLElement, cfg: ClockConfig): (now: Date) => void {
	const svg = svgEl(wrap, "svg", { viewBox: "0 0 100 100" }, "hearth-analog");
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "48" }, "hearth-analog-face");
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		const major = i % 3 === 0;
		const r1 = major ? 38 : 42;
		svgEl(
			svg,
			"line",
			{
				x1: String(50 + Math.sin(a) * r1),
				y1: String(50 - Math.cos(a) * r1),
				x2: String(50 + Math.sin(a) * 46),
				y2: String(50 - Math.cos(a) * 46),
			},
			major ? "hearth-analog-tick-major" : "hearth-analog-tick",
		);
	}
	const hand = (cls: string, length: number) =>
		svgEl(svg, "line", { x1: "50", y1: "50", x2: "50", y2: String(50 - length) }, cls);
	const hourHand = hand("hearth-analog-hour", 26);
	const minHand = hand("hearth-analog-min", 38);
	const secHand = cfg.showSeconds ? hand("hearth-analog-sec", 42) : null;
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "2.5" }, "hearth-analog-pin");

	const rotate = (el: SVGElement, deg: number) =>
		el.setAttribute("transform", `rotate(${deg} 50 50)`);

	return (now: Date) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		const h = now.getHours() % 12;
		rotate(hourHand, (h + m / 60) * 30);
		rotate(minHand, (m + s / 60) * 6);
		if (secHand) rotate(secHand, s * 6);
	};
}


export function renderClock(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.clock ?? {};
	const showGreeting = cfg.showGreeting !== false;
	const dateMode = cfg.dateMode ?? "full";
	const analog = cfg.mode === "analog";

	const wrap = body.createDiv("hearth-clock");
	const greetingEl = showGreeting ? wrap.createDiv("hearth-clock-greeting") : null;

	// Pick the greeting once per time bucket so playful ones don't flicker.
	let bucket = -1;
	const refreshGreeting = (hour: number) => {
		if (!greetingEl) return;
		const override = cfg.greetingText?.trim();
		if (override) {
			greetingEl.setText(override);
			return;
		}
		if (greetingBucket(hour) === bucket) return;
		bucket = greetingBucket(hour);
		greetingEl.setText(pickGreeting(hour, cfg.playfulGreetings ?? false));
	};

	const tickAnalog = analog ? renderAnalogClock(wrap, cfg) : null;
	const timeEl = analog ? null : wrap.createDiv("hearth-clock-time");
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");

	const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	const hour12 = resolveHour12(cfg);
	if (hour12 !== undefined) timeOpts.hour12 = hour12;
	if (cfg.showSeconds) timeOpts.second = "2-digit";

	const update = () => {
		const now = new Date();
		refreshGreeting(now.getHours());
		if (tickAnalog) tickAnalog(now);
		if (timeEl) timeEl.setText(now.toLocaleTimeString(undefined, timeOpts));
		if (dateEl) dateEl.setText(formatClockDate(now, dateMode, cfg.dateFormat));
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}

/** A live clock with an optional greeting and date. */
export const clockCard: CardDefinition<"clock"> = {
	kind: "clock",
	templates: [
		{ id: "clock", name: "Clock & greeting", icon: "clock", build: () => ({ kind: "clock", title: "", w: 4, h: 2 }) },
	],
	render: (view, card, body, component) => renderClock(view, card, body, component),
	renderEditor: (container, ctx) => clockEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.clock) copy.clock = { ...source.clock };
	},
	liveness: { mode: "static" },
};
