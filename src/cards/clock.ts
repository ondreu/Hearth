import { Component, Setting } from "obsidian";
import { moment } from "../cardbodies";
import { t } from "../i18n";
import {
	CLOCK_CLASSIC_FALLBACK,
	type ClockConfig,
	type ClockFace,
	type DashboardCard,
	effectiveCardDesign,
	motionAllowed,
	resolveClockFace,
} from "../types";
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
 * locale default is used, or a boolean to force a 12- or 24-hour clock. The
 * pre-`hourFormat` `use24Hour` boolean is not read here: `sanitizeClock` folds
 * it into `hourFormat` on load and never copies it onto a `ClockConfig`. */
function resolveHour12(cfg: ClockConfig): boolean | undefined {
	const fmt = cfg.hourFormat ?? "auto";
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
	// createSvg hands `cls` to classList.add(), which rejects a string holding
	// two classes — so several go in as an array.
	return parent.createSvg(tag, { attr: attrs, cls: cls?.split(" ") });
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


/** The pieces of a time, formatted for the clock's hour format. `period` is
 * the AM/PM marker, empty on a 24-hour clock. */
interface TimeParts {
	hour: string;
	minute: string;
	second: string;
	period: string;
}


/** A formatter for the separate pieces of the time. A forced 24-hour clock
 * asks for the h23 cycle rather than `hour12: false`, which some engines
 * answer with "24" at midnight. */
function timePartsFormatter(cfg: ClockConfig, hourStyle: "2-digit" | "numeric"): (now: Date) => TimeParts {
	const opts: Intl.DateTimeFormatOptions = { hour: hourStyle, minute: "2-digit", second: "2-digit" };
	const hour12 = resolveHour12(cfg);
	if (hour12 === false) opts.hourCycle = "h23";
	else if (hour12 === true) opts.hour12 = true;
	const fmt = new Intl.DateTimeFormat(undefined, opts);
	return (now) => {
		const out: TimeParts = { hour: "", minute: "", second: "", period: "" };
		for (const p of fmt.formatToParts(now)) {
			if (p.type === "hour") out.hour = p.value;
			else if (p.type === "minute") out.minute = p.value;
			else if (p.type === "second") out.second = p.value;
			else if (p.type === "dayPeriod") out.period = p.value;
		}
		return out;
	};
}


/** Set an element's text only when it changed, so a face that ticks every
 * second writes nothing to the DOM between minutes. */
function textSetter(el: Element): (text: string) => boolean {
	let last: string | null = null;
	return (text) => {
		if (text === last) return false;
		el.textContent = last = text;
		return true;
	};
}


/**
 * A closed shape around (cx, cy) whose radius swings `amp` either side of `r`,
 * `waves` times round: a wavy ring for the Expressive progress, a cookie or a
 * clover for a tile. It starts at twelve o'clock and runs clockwise, so a
 * dash along it (with `pathLength="100"`) fills like a clock hand sweeps.
 */
export function wavyPath(cx: number, cy: number, r: number, amp: number, waves: number): string {
	const steps = Math.max(48, waves * 16);
	let d = "";
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		const rr = r + amp * Math.cos(waves * a);
		const x = cx + Math.sin(a) * rr;
		const y = cy - Math.cos(a) * rr;
		d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	return `${d}Z`;
}


/** Hours over minutes, big. Classic in light type, Expressive on two tonal
 * blocks. */
function renderStackedClock(wrap: HTMLElement, cfg: ClockConfig, seconds: boolean): (now: Date) => void {
	const parts = timePartsFormatter(cfg, "2-digit");
	const face = wrap.createDiv("hearth-clock-face hearth-clock-stacked");
	const setH = textSetter(face.createDiv("hearth-clock-stack-h"));
	const setM = textSetter(face.createDiv("hearth-clock-stack-m"));
	const side = face.createDiv("hearth-clock-stack-side");
	const setS = seconds ? textSetter(side.createSpan("hearth-clock-stack-s")) : null;
	const setP = textSetter(side.createSpan("hearth-clock-stack-p"));
	return (now) => {
		const p = parts(now);
		setH(p.hour);
		setM(p.minute);
		setS?.(p.second);
		setP(p.period);
		side.toggleClass("is-empty", !seconds && !p.period);
	};
}


/** A flip clock: a tile each for the hours, minutes and (optionally) seconds,
 * split across the middle; a tile turns over when its number changes. */
function renderFlipClock(
	wrap: HTMLElement,
	cfg: ClockConfig,
	seconds: boolean,
	animate: boolean,
): (now: Date) => void {
	const parts = timePartsFormatter(cfg, "2-digit");
	const face = wrap.createDiv("hearth-clock-face hearth-clock-flip");
	face.toggleClass("with-seconds", seconds);
	const tile = (cls: string) => {
		const el = face.createDiv(`hearth-clock-flip-tile ${cls}`);
		const set = textSetter(el.createSpan("hearth-clock-flip-num"));
		// The first paint is not a change; nothing turns over on it.
		let painted = false;
		return (text: string) => {
			const changed = set(text);
			const wasPainted = painted;
			painted = true;
			if (!changed || !wasPainted || !animate) return;
			// Restart the turn: drop the class, force a style flush, add it back.
			el.removeClass("is-turning");
			void el.offsetWidth;
			el.addClass("is-turning");
		};
	};
	const setH = tile("is-hours");
	const setM = tile("is-minutes");
	const setS = seconds ? tile("is-seconds") : null;
	const setP = textSetter(face.createDiv("hearth-clock-flip-p"));
	return (now) => {
		const p = parts(now);
		setH(p.hour);
		setM(p.minute);
		setS?.(p.second);
		setP(p.period);
	};
}


/** Concentric progress rings — minutes outside, hours inside them, seconds
 * innermost — round the time. Expressive draws each ring's progress as
 * Material's wavy indicator. */
function renderRingClock(
	wrap: HTMLElement,
	cfg: ClockConfig,
	seconds: boolean,
	lowPower: boolean,
	expressive: boolean,
): (now: Date) => void {
	const parts = timePartsFormatter(cfg, "2-digit");
	const svg = svgEl(wrap, "svg", { viewBox: "0 0 100 100" }, "hearth-clock-face hearth-clock-ring");
	const ring = (r: number, cls: string) => {
		svgEl(svg, "circle", { cx: "50", cy: "50", r: String(r) }, `hearth-clock-ring-track ${cls}`);
		// A wave of roughly the same length on every ring, whatever its radius.
		const waves = Math.round((2 * Math.PI * r) / 22);
		const d = expressive ? wavyPath(50, 50, r, 1.1, waves) : wavyPath(50, 50, r, 0, 1);
		const bar = svgEl(svg, "path", { d, pathLength: "100" }, `hearth-clock-ring-bar ${cls}`);
		let last = NaN;
		return (fraction: number) => {
			const pct = Math.round(fraction * 1000) / 10;
			if (pct === last) return;
			last = pct;
			bar.setAttribute("stroke-dasharray", `${pct} ${100 - pct + 1}`);
			bar.toggleClass("is-empty", pct === 0);
		};
	};
	const setMin = ring(44, "is-minutes");
	const setHour = ring(33, "is-hours");
	const setSec = seconds ? ring(22, "is-seconds") : null;
	const text = svgEl(
		svg,
		"text",
		{ x: "50", y: "50", "text-anchor": "middle", "dominant-baseline": "central" },
		"hearth-clock-ring-time",
	);
	text.toggleClass("is-small", seconds);
	const setText = textSetter(text);
	return (now) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		setMin(lowPower ? m / 60 : (m + s / 60) / 60);
		setHour(((now.getHours() % 12) + m / 60) / 12);
		setSec?.(s / 60);
		const p = parts(now);
		setText(`${p.hour}:${p.minute}`);
	};
}


/** The tile shapes the Shapes face puts its digits on, one per digit. */
const SHAPE_TILES: { waves: number; amp: number }[] = [
	{ waves: 4, amp: 7 }, // clover
	{ waves: 9, amp: 2.6 }, // cookie
	{ waves: 8, amp: 4 }, // flower
	{ waves: 0, amp: 0 }, // squircle (drawn as a rounded square)
];


/** Expressive only: every digit on a shape of its own — hours in the accent,
 * minutes in its complementary tone — in a 2×2 block, or a row on a wide card. */
function renderShapesClock(wrap: HTMLElement, cfg: ClockConfig, seconds: boolean): (now: Date) => void {
	const parts = timePartsFormatter(cfg, "2-digit");
	const face = wrap.createDiv("hearth-clock-face hearth-clock-shapes");
	const digits = SHAPE_TILES.map((shape, i) => {
		const tile = face.createDiv(`hearth-clock-shape ${i < 2 ? "is-hours" : "is-minutes"}`);
		const svg = svgEl(tile, "svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, "hearth-clock-shape-bg");
		if (shape.waves === 0) {
			svgEl(svg, "rect", { x: "4", y: "4", width: "92", height: "92", rx: "34" });
		} else {
			svgEl(svg, "path", { d: wavyPath(50, 50, 46 - shape.amp, shape.amp, shape.waves) });
		}
		return textSetter(tile.createSpan("hearth-clock-shape-num"));
	});
	const extra = face.createDiv("hearth-clock-shapes-extra");
	const setS = seconds ? textSetter(extra.createSpan("hearth-clock-shapes-pill is-seconds")) : null;
	const periodEl = extra.createSpan("hearth-clock-shapes-pill is-period");
	const setP = textSetter(periodEl);
	return (now) => {
		const p = parts(now);
		const text = `${p.hour}${p.minute}`;
		digits.forEach((set, i) => set(text.charAt(i)));
		setS?.(p.second);
		setP(p.period);
		periodEl.toggleClass("is-empty", !p.period);
		extra.toggleClass("is-empty", !seconds && !p.period);
	};
}


/** Expressive only: the hour, big, on a scalloped face, with the minute as a
 * dot orbiting its edge (and the seconds as a smaller one inside). */
function renderOrbitClock(
	wrap: HTMLElement,
	cfg: ClockConfig,
	seconds: boolean,
	lowPower: boolean,
): (now: Date) => void {
	const parts = timePartsFormatter(cfg, "numeric");
	const svg = svgEl(wrap, "svg", { viewBox: "0 0 100 100" }, "hearth-clock-face hearth-clock-orbit");
	svgEl(svg, "path", { d: wavyPath(50, 50, 38.5, 1.5, 12) }, "hearth-clock-orbit-face");
	// Sixty minute marks: zero-length dashes whose round caps draw dots.
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "46", pathLength: "60" }, "hearth-clock-orbit-track");
	const minDot = svgEl(svg, "circle", { cx: "50", cy: "4", r: "4" }, "hearth-clock-orbit-min");
	const secDot = seconds && !lowPower
		? svgEl(svg, "circle", { cx: "50", cy: "18", r: "1.8" }, "hearth-clock-orbit-sec")
		: null;
	const attrs = (y: string) => ({ x: "50", y, "text-anchor": "middle", "dominant-baseline": "central" });
	const setP = textSetter(svgEl(svg, "text", attrs("27"), "hearth-clock-orbit-p"));
	const setH = textSetter(svgEl(svg, "text", attrs("48"), "hearth-clock-orbit-h"));
	const setM = textSetter(svgEl(svg, "text", attrs("71"), "hearth-clock-orbit-m"));
	let lastMin = NaN;
	let lastSec = NaN;
	return (now) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		const minDeg = lowPower ? m * 6 : (m + s / 60) * 6;
		if (minDeg !== lastMin) minDot.setAttribute("transform", `rotate(${(lastMin = minDeg)} 50 50)`);
		if (secDot && s !== lastSec) secDot.setAttribute("transform", `rotate(${(lastSec = s) * 6} 50 50)`);
		const p = parts(now);
		setP(p.period);
		setH(p.hour);
		setM(p.minute);
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
	const expressive = effectiveCardDesign(view.plugin.settings, card.design) === "expressive";
	const face = resolveClockFace(cfg.mode, expressive);

	// The newer faces size themselves against the card body.
	body.toggleClass("hearth-clock-host", face !== "digital" && face !== "analog");
	const wrap = body.createDiv(`hearth-clock is-face-${face}`);
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
	const lowPower = !motionAllowed(view.plugin.settings);

	const seconds = cfg.showSeconds === true && !lowPower;
	let tickFace: ((now: Date) => void) | null = null;
	switch (face) {
		case "analog":
			tickFace = renderAnalogClock(wrap, cfg, lowPower);
			break;
		case "stacked":
			tickFace = renderStackedClock(wrap, cfg, seconds);
			break;
		case "flip":
			tickFace = renderFlipClock(wrap, cfg, seconds, !lowPower);
			break;
		case "ring":
			tickFace = renderRingClock(wrap, cfg, seconds, lowPower, expressive);
			break;
		case "shapes":
			tickFace = renderShapesClock(wrap, cfg, seconds);
			break;
		case "orbit":
			tickFace = renderOrbitClock(wrap, cfg, seconds, lowPower);
			break;
	}
	const timeEl = face === "digital" ? wrap.createDiv("hearth-clock-time") : null;
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");
	// What the face shares the card with, for the CSS that sizes it.
	wrap.toggleClass("has-greeting", greetingEl !== null);
	wrap.toggleClass("has-date", dateEl !== null);

	const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	const hour12 = resolveHour12(cfg);
	if (hour12 !== undefined) timeOpts.hour12 = hour12;
	if (cfg.showSeconds && !lowPower) timeOpts.second = "2-digit";

	let lastTime = "";
	let lastDate = "";
	const update = () => {
		const now = new Date();
		refreshGreeting(now.getHours());
		if (tickFace) tickFace(now);
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

	const expressive = effectiveCardDesign(ctx.opts.settings, ctx.card.design) === "expressive";
	const mode = cfg.mode ?? "digital";
	const labels: Record<ClockFace, string> = {
		digital: t().editors.clock.styleDigital,
		analog: t().editors.clock.styleAnalog,
		stacked: t().editors.clock.styleStacked,
		flip: t().editors.clock.styleFlip,
		ring: t().editors.clock.styleRing,
		shapes: t().editors.clock.styleShapes,
		orbit: t().editors.clock.styleOrbit,
	};
	const fallback = CLOCK_CLASSIC_FALLBACK[mode];
	new Setting(containerEl)
		.setName(t().editors.clock.style)
		.setDesc(
			// An Expressive-only face on a Classic card says what it draws instead;
			// otherwise a Classic card learns that more faces come with Expressive.
			expressive
				? ""
				: fallback
					? t().editors.clock.styleFallbackDesc(labels[fallback])
					: t().editors.clock.styleExpressiveDesc,
		)
		.addDropdown((d) => {
			for (const face of Object.keys(labels) as ClockFace[]) {
				// Expressive-only faces are offered to an Expressive card, and kept
				// in the list for a Classic one that already has one chosen.
				if (!expressive && CLOCK_CLASSIC_FALLBACK[face] && face !== mode) continue;
				d.addOption(face, labels[face]);
			}
			d.setValue(mode).onChange((v) => {
				cfg.mode = v as ClockFace;
				ctx.opts.save();
				ctx.requestRender();
			});
		});

	if (resolveClockFace(cfg.mode, expressive) !== "analog") {
		new Setting(containerEl)
			.setName(t().editors.clock.hourFormat)
			.addDropdown((d) => {
				d.addOption("auto", t().editors.clock.hourFormatAuto);
				d.addOption("12", t().editors.clock.hourFormat12);
				d.addOption("24", t().editors.clock.hourFormat24);
				d.setValue(cfg.hourFormat ?? "auto").onChange((v) => {
					cfg.hourFormat = v as NonNullable<ClockConfig["hourFormat"]>;
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
	expressive: true,
	liveness: { mode: "static" },
};
