import { Component, Setting } from "obsidian";
import { moment } from "../cardbodies";
import { t } from "../i18n";
import { type ClockConfig, type DashboardCard, lowPowerActive } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


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


/** Draw an analogue clock face and return a tick() to rotate its hands.
 * `lowPower` drops the second hand and snaps the minute hand to whole minutes,
 * so the face only touches the DOM once a minute instead of once a second. */
function renderAnalogClock(
	wrap: HTMLElement,
	cfg: ClockConfig,
	lowPower: boolean,
): (now: Date) => void {
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
	const secHand = cfg.showSeconds && !lowPower ? hand("hearth-analog-sec", 42) : null;
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "2.5" }, "hearth-analog-pin");

	const rotate = (el: SVGElement, deg: number) =>
		el.setAttribute("transform", `rotate(${deg} 50 50)`);

	// Only write attributes that actually changed: an SVG transform write costs
	// a repaint of the face even when the angle is identical, and outside low
	// power the hour hand's angle only moves once a minute anyway.
	let lastHour = NaN;
	let lastMin = NaN;
	let lastSec = NaN;

	return (now: Date) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		const h = now.getHours() % 12;
		const hourDeg = (h + m / 60) * 30;
		// Low power: the minute hand steps rather than sweeping, so it is one
		// write per minute instead of sixty.
		const minDeg = lowPower ? m * 6 : (m + s / 60) * 6;
		if (hourDeg !== lastHour) rotate(hourHand, (lastHour = hourDeg));
		if (minDeg !== lastMin) rotate(minHand, (lastMin = minDeg));
		if (secHand && s !== lastSec) rotate(secHand, (lastSec = s) * 6);
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

	// Low power: no seconds anywhere on the face. The interval below still fires
	// every second — it has to, or the minute would land up to a second late —
	// but with seconds gone every tick becomes a pure comparison that writes
	// nothing to the DOM 59 times out of 60.
	const lowPower = lowPowerActive(view.plugin.settings);

	const tickAnalog = analog ? renderAnalogClock(wrap, cfg, lowPower) : null;
	const timeEl = analog ? null : wrap.createDiv("hearth-clock-time");
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");

	const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	const hour12 = resolveHour12(cfg);
	if (hour12 !== undefined) timeOpts.hour12 = hour12;
	if (cfg.showSeconds && !lowPower) timeOpts.second = "2-digit";

	let lastTime = "";
	let lastDate = "";
	const update = () => {
		const now = new Date();
		refreshGreeting(now.getHours());
		if (tickAnalog) tickAnalog(now);
		if (timeEl) {
			const text = now.toLocaleTimeString(undefined, timeOpts);
			if (text !== lastTime) timeEl.setText((lastTime = text));
		}
		if (dateEl) {
			const text = formatClockDate(now, dateMode, cfg.dateFormat);
			if (text !== lastDate) dateEl.setText((lastDate = text));
		}
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}


export function clockEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const cfg = (ctx.card.clock ??= {});

	new Setting(containerEl)
		.setName(t().editors.clock.style)
		.addDropdown((d) => {
			d.addOption("digital", t().editors.clock.styleDigital);
			d.addOption("analog", t().editors.clock.styleAnalog);
			d.setValue(cfg.mode ?? "digital").onChange((v) => {
				cfg.mode = v as NonNullable<ClockConfig["mode"]>;
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if (cfg.mode !== "analog") {
		new Setting(containerEl)
			.setName(t().editors.clock.hourFormat)
			.addDropdown((d) => {
				d.addOption("auto", t().editors.clock.hourFormatAuto);
				d.addOption("12", t().editors.clock.hourFormat12);
				d.addOption("24", t().editors.clock.hourFormat24);
				d.setValue(cfg.hourFormat ?? (cfg.use24Hour ? "24" : "auto")).onChange((v) => {
					cfg.hourFormat = v as NonNullable<ClockConfig["hourFormat"]>;
					cfg.use24Hour = undefined;
					ctx.opts.save();
				});
			});
	}
	new Setting(containerEl)
		.setName(t().editors.clock.showSeconds)
		.addToggle((t) =>
			t.setValue(cfg.showSeconds ?? false).onChange((v) => {
				cfg.showSeconds = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.showGreeting)
		.addToggle((t) =>
			t.setValue(cfg.showGreeting !== false).onChange((v) => {
				cfg.showGreeting = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.playful)
		.setDesc(t().editors.clock.playfulDesc)
		.addToggle((t) =>
			t.setValue(cfg.playfulGreetings ?? false).onChange((v) => {
				cfg.playfulGreetings = v || undefined;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.greetingOverride)
		.setDesc(t().editors.clock.greetingOverrideDesc)
		.addText((t) =>
			t.setValue(cfg.greetingText ?? "").onChange((v) => {
				cfg.greetingText = v;
				ctx.opts.save();
			}),
		);
	new Setting(containerEl)
		.setName(t().editors.clock.date)
		.addDropdown((d) => {
			d.addOption("full", t().editors.clock.dateFull);
			d.addOption("long", t().editors.clock.dateLong);
			d.addOption("short", t().editors.clock.dateShort);
			d.addOption("iso", t().editors.clock.dateIso);
			d.addOption("weekday", t().editors.clock.dateWeekday);
			d.addOption("custom", t().editors.clock.dateCustom);
			d.addOption("none", t().editors.clock.dateNone);
			d.setValue(cfg.dateMode ?? "full").onChange((v) => {
				cfg.dateMode = v as NonNullable<ClockConfig["dateMode"]>;
				ctx.opts.save();
				ctx.requestRender();
			});
		});
	if (cfg.dateMode === "custom") {
		new Setting(containerEl)
			.setName(t().editors.clock.customFormat)
			.setDesc(t().editors.clock.customFormatDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(t().editors.clock.customFormatPlaceholder)
					.setValue(cfg.dateFormat ?? "")
					.onChange((v) => {
						cfg.dateFormat = v;
						ctx.opts.save();
					}),
			);
	}
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
