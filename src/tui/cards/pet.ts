/**
 * The Pet card as text.
 *
 * The pet is the graphical card's own 16×16 pixel sprite, drawn in half-block
 * characters: each cell of the grid holds two pixels, the upper one in the
 * character's colour (`▀`) and the lower one in its background — so every
 * species, colour and mood the graphical card draws is drawn here too, in
 * eight rows. It blinks and wags through the same frames when motion is on.
 *
 * Enter, Space or a click pets it.
 */
import {
	moodFor,
	moodLabel,
	paletteFor,
	PET_TICK_MS,
	petName,
	readVaultPulse,
	spriteFrames,
	thresholdsFor,
	inNightWindow,
	type PetMood,
	type PetPalette,
} from "../../cards/pet";
import { t } from "../../i18n";
import { motionAllowed } from "../../types";
import type { TuiContext, TuiRenderer } from "../card";
import { centerLine, type Line, type Seg } from "../text";

/** The eye and its shine, as the stylesheet colours them. */
const EYE = "#23242b";
const SHINE = "#ffffff";

function pixelColor(ch: string, palette: PetPalette): string | null {
	switch (ch) {
		case "o":
			return palette.outline;
		case "b":
			return palette.body;
		case "l":
			return palette.light;
		case "a":
			return palette.accent;
		case "e":
			return EYE;
		case "w":
			return SHINE;
		default:
			return null;
	}
}

/** A sprite as half-block rows: two pixel rows to a line of text. */
export function halfBlocks(rows: readonly string[], color: (ch: string) => string | null): Line[] {
	const lines: Line[] = [];
	for (let y = 0; y < rows.length; y += 2) {
		const top = rows[y] ?? "";
		const bottom = rows[y + 1] ?? "";
		const line: Line = [];
		const w = Math.max(top.length, bottom.length);
		for (let x = 0; x < w; x++) {
			const up = color(top[x] ?? ".");
			const down = color(bottom[x] ?? ".");
			let cell: Seg;
			if (!up && !down) cell = { text: " " };
			else if (up && !down) cell = { text: "▀", color: up };
			else if (!up && down) cell = { text: "▄", color: down };
			else if (up === down) cell = { text: " ", bg: up ?? undefined };
			else cell = { text: "▀", color: up ?? undefined, bg: down ?? undefined };
			line.push(cell);
		}
		lines.push(line);
	}
	return lines;
}

interface PetState {
	mood: PetMood;
	night: boolean;
	today: number;
	streak: number;
	/** Set by the frame tick's own redraw, which reuses the mood rather than
	 * reading the vault again. */
	tick: boolean;
	frame: number;
	hearts: number;
}

function petState(ctx: TuiContext): PetState {
	const cur = ctx.state.pet as PetState | undefined;
	if (cur) return cur;
	const fresh: PetState = { mood: "content", night: false, today: 0, streak: 0, tick: false, frame: 0, hearts: 0 };
	ctx.state.pet = fresh;
	return fresh;
}

function pet(ctx: TuiContext): void {
	const cfg = (ctx.card.pet ??= {});
	cfg.lastPlayedAt = Date.now();
	void ctx.view.plugin.saveData(ctx.view.plugin.settings);
	petState(ctx).hearts = Date.now() + 2500;
	ctx.redraw();
}

export const petTui: TuiRenderer = {
	render(ctx) {
		const cfg = (ctx.card.pet ??= {});
		const st = petState(ctx);
		const moving = motionAllowed(ctx.view.plugin.settings);
		if (!st.tick) {
			const pulse = readVaultPulse(ctx.view, cfg.metric ?? "modified");
			const nightMode = cfg.nightSleep ?? "quiet";
			const night = nightMode !== "off" && inNightWindow(new Date(), cfg);
			st.mood = moodFor({
				today: pulse.today,
				thresholds: thresholdsFor(cfg),
				sinceLastMs: pulse.sinceLastMs,
				pettedMsAgo: cfg.lastPlayedAt ? Date.now() - cfg.lastPlayedAt : null,
				night: { mode: nightMode, now: night },
			});
			st.night = night && st.mood === "sleepy";
			st.today = pulse.today;
			st.streak = pulse.streak;
		}
		st.tick = false;

		const palette = paletteFor(cfg);
		const frames = spriteFrames(cfg.species ?? "cat", st.mood);
		const frame = moving ? frames[st.frame % frames.length] : frames[0];
		const w = ctx.cols;
		const lines: Line[] = [];
		// What floats over the pet: hearts after a pat, z's (or the moon) asleep.
		const above: Seg[] =
			st.hearts > Date.now()
				? [{ text: "♥ ♥ ♥", style: ["red", "bold"] }]
				: st.mood === "sleepy"
					? [{ text: st.night ? ")" : "z Z z", style: "faint" }]
					: [{ text: " " }];
		lines.push(centerLine(above, w));
		const art = halfBlocks(frame, (ch) => pixelColor(ch, palette));
		const onClick = () => pet(ctx);
		for (const row of art) lines.push(centerLine(row.map((s) => ({ ...s, onClick, label: t().cards.pet.petHint })), w));
		// The selectable row is the name under the pet, not the pet itself — a
		// picture in reverse video is a different picture.
		const itemLine = lines.length;
		lines.push(centerLine([{ text: cfg.showName !== false ? petName(cfg) : t().cards.pet.petHint, style: cfg.showName !== false ? "bold" : "faint", onClick }], w));
		if (cfg.showMood !== false) lines.push(centerLine([{ text: st.night ? t().cards.pet.moodNight : moodLabel(st.mood), style: "dim" }], w));
		if (cfg.showActivity !== false) {
			const parts = [t().cards.pet.todayCount(st.today, cfg.metric ?? "modified")];
			if (st.streak > 1) parts.push(t().cards.pet.streak(st.streak));
			lines.push(centerLine([{ text: parts.join(" · "), style: "faint" }], w));
		}

		// The frames: a step every second and a half. Only the tick redraws
		// without reading the vault; the mood itself is read again on the
		// graphical card's slow timer, and on every vault change.
		if (moving) {
			ctx.component.registerInterval(
				window.setInterval(() => {
					st.frame++;
					st.tick = true;
					ctx.redraw();
				}, 1500),
			);
			ctx.component.registerInterval(window.setInterval(() => ctx.redraw(), PET_TICK_MS));
		}
		return { lines, items: [{ line: itemLine, activate: onClick, toggle: onClick }], foot: t().tui.cards.petFoot };
	},
};
