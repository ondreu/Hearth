/**
 * The Clock & greeting card as text.
 *
 * Every face has a text form: the digital, stacked and ring faces are big
 * block digits (stacked puts the minutes under the hours, ring adds a bar for
 * how far through the hour it is), the flip face boxes each digit, and the
 * analog faces draw a dial of hour marks with the hands as runs of dots. The
 * greeting, the date and the 12/24-hour choice are the card's own settings.
 *
 * The card redraws on the minute — or on the second when it shows seconds and
 * the performance tier lets anything move.
 */
import { formatClockDate, greetingBucket, pickGreeting, resolveHour12 } from "../../cards/clock";
import { effectiveCardDesign, motionAllowed, resolveClockFace, type ClockConfig } from "../../types";
import { bigLines, bigWidth, BIG_ROWS } from "../bigtext";
import type { TuiContext, TuiRenderer } from "../card";
import { asciify, centerLine, hbar, type Line } from "../text";

/** The time as the card shows it: "21:50", or "9:50" plus "PM". */
function timeParts(now: Date, cfg: ClockConfig, seconds: boolean): { time: string; suffix: string } {
	const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	const hour12 = resolveHour12(cfg);
	if (hour12 !== undefined) opts.hour12 = hour12;
	if (seconds) opts.second = "2-digit";
	const parts = new Intl.DateTimeFormat(undefined, opts).formatToParts(now);
	let time = "";
	let suffix = "";
	for (const p of parts) {
		if (p.type === "dayPeriod") suffix = p.value.trim();
		else if (p.type === "hour" || p.type === "minute" || p.type === "second") time += p.value;
		else if (p.type === "literal" && time && !/\s/.test(p.value)) time += ":";
	}
	return { time: time.replace(/:+$/, ""), suffix };
}

/** The greeting, picked once per part of the day so a playful one doesn't
 * change on every redraw. */
function greeting(ctx: TuiContext, cfg: ClockConfig, hour: number): string {
	const override = cfg.greetingText?.trim();
	if (override) return override;
	const bucket = greetingBucket(hour);
	if (ctx.state.greetingBucket !== bucket || typeof ctx.state.greeting !== "string") {
		ctx.state.greetingBucket = bucket;
		ctx.state.greeting = pickGreeting(hour, cfg.playfulGreetings ?? false);
	}
	return ctx.state.greeting as string;
}

/** Big digits centred, or — when they don't fit — the time in bold. */
function bigTime(time: string, suffix: string, cols: number): Line[] {
	const w = bigWidth(time) + (suffix ? suffix.length + 1 : 0);
	if (w > cols) return [centerLine([{ text: `${time}${suffix ? " " + suffix : ""}`, style: ["bold", "accent"] }], cols)];
	return bigLines(time).map((line, r) => {
		const tail = suffix && r === BIG_ROWS - 1 ? [{ text: ` ${suffix}`, style: "dim" as const }] : suffix ? [{ text: " ".repeat(suffix.length + 1) }] : [];
		return centerLine([...line, ...tail], cols);
	});
}

/** Each digit in a box of its own, like the cards of a flip clock. */
function flipTime(time: string, cols: number): Line[] {
	const digits = Array.from(time);
	const w = digits.reduce((n, d) => n + (d === ":" ? 2 : 6), 0);
	if (w > cols) return bigTime(time, "", cols);
	const top: Line = [];
	const mid: Line[] = [[], [], [], [], []];
	const bottom: Line = [];
	for (const d of digits) {
		if (d === ":") {
			top.push({ text: "  " });
			bottom.push({ text: "  " });
			bigLines(":").forEach((l, r) => mid[r].push(...l, { text: " " }));
			continue;
		}
		top.push({ text: "┌───┐ ", style: "rule" });
		bottom.push({ text: "└───┘ ", style: "rule" });
		bigLines(d).forEach((l, r) => mid[r].push({ text: "│", style: "rule" }, ...l, { text: "│ ", style: "rule" }));
	}
	return [top, ...mid, bottom].map((l) => centerLine(l, cols));
}

/** A dial: hour marks round an ellipse, the hands as runs of dots. Cells are
 * about twice as tall as they are wide, so the dial is twice as wide as it is
 * tall to come out round. */
function analogDial(now: Date, rows: number, cols: number, seconds: boolean): Line[] {
	const h = Math.max(7, Math.min(rows, Math.floor(cols / 2)) | 1);
	const w = h * 2 + 1;
	const cx = Math.floor(w / 2);
	const cy = Math.floor(h / 2);
	const rx = cx - 1;
	const ry = cy;
	const grid: { ch: string; style?: Line[number]["style"] }[][] = Array.from({ length: h }, () =>
		Array.from({ length: w }, () => ({ ch: " " })),
	);
	const put = (x: number, y: number, ch: string, style?: Line[number]["style"]) => {
		const gx = Math.round(x);
		const gy = Math.round(y);
		if (gy >= 0 && gy < h && gx >= 0 && gx < w) grid[gy][gx] = { ch, style };
	};
	for (let i = 1; i <= 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		const x = cx + Math.sin(a) * rx;
		const y = cy - Math.cos(a) * ry;
		if (i % 3 === 0) {
			const label = String(i);
			for (let k = 0; k < label.length; k++) put(x - (label.length - 1) / 2 + k, y, label[k], "dim");
		} else put(x, y, "·", "faint");
	}
	const hand = (fraction: number, length: number, ch: string, style: Line[number]["style"]) => {
		const a = fraction * Math.PI * 2;
		const steps = Math.ceil(length * Math.max(rx, ry) * 1.5);
		for (let s = 1; s <= steps; s++) {
			const f = (s / steps) * length;
			put(cx + Math.sin(a) * rx * f, cy - Math.cos(a) * ry * f, ch, style);
		}
	};
	const mins = now.getMinutes() + now.getSeconds() / 60;
	const hours = (now.getHours() % 12) + mins / 60;
	if (seconds) hand(now.getSeconds() / 60, 0.9, "·", "dim");
	hand(mins / 60, 0.85, "•", "accent");
	hand(hours / 12, 0.55, "●", "bold");
	put(cx, cy, "◉", "accent");
	return grid.map((row) => centerLine(row.map((c) => ({ text: c.ch, style: c.style })), cols));
}

export const clockTui: TuiRenderer = {
	render(ctx) {
		const cfg = ctx.card.clock ?? {};
		const s = ctx.view.plugin.settings;
		const expressive = effectiveCardDesign(s, ctx.card.design) === "expressive";
		const face = resolveClockFace(cfg.mode, expressive);
		const moving = motionAllowed(s);
		const seconds = cfg.showSeconds === true && moving;
		const now = new Date();
		const { time, suffix } = timeParts(now, cfg, seconds && face !== "analog" && face !== "orbit");

		const showGreeting = cfg.showGreeting !== false;
		const dateMode = cfg.dateMode ?? "full";
		const extras: Line[] = [];
		if (dateMode !== "none") extras.push(centerLine([{ text: asciify(formatClockDate(now, dateMode, cfg.dateFormat)), style: "dim" }], ctx.cols));
		if (showGreeting) extras.push(centerLine([{ text: asciify(greeting(ctx, cfg, now.getHours())), style: "bold" }], ctx.cols));

		const room = Math.max(1, ctx.rows - extras.length - 1);
		let dial: Line[];
		switch (face) {
			case "analog":
			case "orbit":
				dial = analogDial(now, Math.max(7, room), ctx.cols, seconds);
				break;
			case "flip":
				dial = room >= 7 ? flipTime(time, ctx.cols) : bigTime(time, suffix, ctx.cols);
				break;
			case "stacked": {
				const [hh, mm, ss] = time.split(":");
				if (room >= 11 && hh && mm) {
					dial = [...bigTime(hh, "", ctx.cols), [], ...bigTime(mm, suffix, ctx.cols)];
					if (ss) dial.push(centerLine([{ text: ss, style: "dim" }], ctx.cols));
				} else dial = bigTime(time, suffix, ctx.cols);
				break;
			}
			case "ring":
			case "shapes": {
				dial = room >= BIG_ROWS ? bigTime(time, suffix, ctx.cols) : [centerLine([{ text: time, style: ["bold", "accent"] }], ctx.cols)];
				const w = Math.min(ctx.cols, Math.max(10, bigWidth(time)));
				const through = (now.getMinutes() + now.getSeconds() / 60) / 60;
				dial.push(centerLine([{ text: hbar(through, w), style: "accent" }], ctx.cols));
				break;
			}
			default:
				dial = room >= BIG_ROWS ? bigTime(time, suffix, ctx.cols) : [centerLine([{ text: `${time}${suffix ? " " + suffix : ""}`, style: ["bold", "accent"] }], ctx.cols)];
		}

		// Centre the whole block vertically.
		const block: Line[] = [...dial, ...(extras.length ? [[], ...extras] : [])];
		const pad = Math.max(0, Math.floor((ctx.rows - block.length) / 2));
		const lines: Line[] = [...Array.from({ length: pad }, () => [] as Line), ...block];

		// Redraw when what is shown changes: every second with seconds on, else
		// on the minute. The check runs every second either way — it has to, or
		// the minute would land late — but writes nothing until the text moves.
		const shown = `${time}|${now.getMinutes()}`;
		ctx.component.registerInterval(
			window.setInterval(() => {
				const n = new Date();
				const next = `${timeParts(n, cfg, seconds && face !== "analog" && face !== "orbit").time}|${n.getMinutes()}`;
				if (next !== shown || (seconds && (face === "analog" || face === "orbit"))) ctx.redraw();
			}, 1000),
		);
		return { lines };
	},
};
