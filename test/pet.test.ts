import { describe, expect, it } from "vitest";
import {
	PET_DEFAULT_GOAL,
	PET_PETTED_MS,
	PET_SLEEPY_AFTER_MS,
	PET_SPECIES,
	PET_SPRITE_SIZE,
	activityStreak,
	defaultColors,
	moodFor,
	paletteFor,
	parseHex,
	shadeHex,
	spriteFor,
	spriteRuns,
	type PetMood,
} from "../src/cards/pet";

const HOUR = 60 * 60 * 1000;

/** The mood inputs for a vault with `today` notes touched and a freshest note
 * `sinceLastMs` old, never petted. */
function pulse(today: number, sinceLastMs: number | null = 0, pettedMsAgo: number | null = null) {
	return { today, goal: PET_DEFAULT_GOAL, sinceLastMs, pettedMsAgo };
}

describe("moodFor", () => {
	it("climbs the ladder with today's activity", () => {
		expect(moodFor(pulse(0, 10 * HOUR))).toBe("sleepy");
		expect(moodFor(pulse(0, 1 * HOUR))).toBe("bored");
		expect(moodFor(pulse(1))).toBe("content");
		expect(moodFor(pulse(PET_DEFAULT_GOAL))).toBe("happy");
		expect(moodFor(pulse(PET_DEFAULT_GOAL * 2))).toBe("excited");
		expect(moodFor(pulse(500))).toBe("excited");
	});

	it("only ever falls to bored, then asleep — the ladder has no bad rung", () => {
		// The whole point of the card: whatever the vault (or the clock) does,
		// the worst state is a sleeping pet, and any activity wakes it.
		const moods = new Set<PetMood>();
		for (const today of [0, 1, 2, 3, 6, 99]) {
			for (const since of [0, HOUR, 24 * HOUR, 365 * 24 * HOUR, null]) {
				moods.add(moodFor(pulse(today, since)));
			}
		}
		expect([...moods].sort()).toEqual(["bored", "content", "excited", "happy", "sleepy"]);
	});

	it("dozes off once the freshest note is old, and never before", () => {
		expect(moodFor(pulse(0, PET_SLEEPY_AFTER_MS - 1))).toBe("bored");
		expect(moodFor(pulse(0, PET_SLEEPY_AFTER_MS))).toBe("sleepy");
		// An empty vault has no timestamp to go on.
		expect(moodFor(pulse(0, null))).toBe("sleepy");
	});

	it("lets a petting lift the mood but never lower it", () => {
		expect(moodFor(pulse(0, 100 * HOUR, 0))).toBe("happy");
		expect(moodFor(pulse(1, 0, PET_PETTED_MS - 1))).toBe("happy");
		// Worn off.
		expect(moodFor(pulse(1, 0, PET_PETTED_MS))).toBe("content");
		// Already excited: petting must not knock it down to happy.
		expect(moodFor(pulse(PET_DEFAULT_GOAL * 2, 0, 0))).toBe("excited");
		// A clock that jumped backwards leaves a negative age — not a petting.
		expect(moodFor(pulse(1, 0, -5000))).toBe("content");
	});

	it("falls back to the default goal when the card's is nonsense", () => {
		expect(moodFor({ today: 3, goal: 0, sinceLastMs: 0, pettedMsAgo: null })).toBe("happy");
		expect(moodFor({ today: 3, goal: -4, sinceLastMs: 0, pettedMsAgo: null })).toBe("happy");
	});
});

describe("activityStreak", () => {
	const day = (key: string, count = 1): [string, number] => [key, count];

	it("counts consecutive days back from today", () => {
		const counts = new Map([day("2026-06-10"), day("2026-06-09"), day("2026-06-08")]);
		expect(activityStreak(counts, new Date(2026, 5, 10))).toBe(3);
	});

	it("does not break the streak on a day that has only just started", () => {
		// Nothing written yet this morning: yesterday's streak still stands.
		const counts = new Map([day("2026-06-09"), day("2026-06-08")]);
		expect(activityStreak(counts, new Date(2026, 5, 10))).toBe(2);
	});

	it("is zero once a whole day passes unwritten", () => {
		const counts = new Map([day("2026-06-08")]);
		expect(activityStreak(counts, new Date(2026, 5, 10))).toBe(0);
	});

	it("stops at a gap and spans month and year boundaries", () => {
		const counts = new Map([day("2026-01-01"), day("2025-12-31"), day("2025-12-30"), day("2025-12-28")]);
		expect(activityStreak(counts, new Date(2026, 0, 1))).toBe(3);
	});

	it("has no streak in an empty vault", () => {
		expect(activityStreak(new Map(), new Date(2026, 5, 10))).toBe(0);
	});
});

describe("colors", () => {
	it("parses both hex forms and rejects anything else", () => {
		expect(parseHex("#fff")).toEqual([255, 255, 255]);
		expect(parseHex("#1a2b3c")).toEqual([26, 43, 60]);
		expect(parseHex("1a2b3c")).toEqual([26, 43, 60]);
		expect(parseHex("rebeccapurple")).toBeNull();
		expect(parseHex("#12345")).toBeNull();
		expect(parseHex("")).toBeNull();
	});

	it("derives darker and lighter shades, and leaves junk alone", () => {
		expect(shadeHex("#808080", -1)).toBe("#000000");
		expect(shadeHex("#808080", 1)).toBe("#ffffff");
		expect(shadeHex("#808080", 0)).toBe("#808080");
		expect(shadeHex("not a color", -0.5)).toBe("not a color");
	});

	it("falls back to the species palette when a color is missing or invalid", () => {
		const fox = defaultColors("fox");
		expect(paletteFor({ species: "fox" }).body).toBe(fox.body);
		expect(paletteFor({ species: "fox", bodyColor: "chartreuse" }).body).toBe(fox.body);
		expect(paletteFor({ species: "fox", bodyColor: "#123456" }).body).toBe("#123456");
		// The outline is always darker than the body, the belly always lighter.
		const p = paletteFor({ species: "cat", bodyColor: "#808080" });
		expect(parseHex(p.outline)![0]).toBeLessThan(0x80);
		expect(parseHex(p.light)![0]).toBeGreaterThan(0x80);
	});
});

describe("sprites", () => {
	const MOODS: PetMood[] = ["sleepy", "bored", "content", "happy", "excited"];

	it("is a square grid of known palette characters for every species and mood", () => {
		for (const species of PET_SPECIES) {
			for (const mood of MOODS) {
				const rows = spriteFor(species, mood);
				expect(rows).toHaveLength(PET_SPRITE_SIZE);
				for (const row of rows) {
					expect(row).toHaveLength(PET_SPRITE_SIZE);
					expect(row).toMatch(/^[.oblaew]+$/);
				}
			}
		}
	});

	it("gives every pet a face — two eyes, drawn differently per mood", () => {
		for (const species of PET_SPECIES) {
			const drawn = MOODS.map((mood) => spriteFor(species, mood).join("\n"));
			for (const sprite of drawn) expect(sprite.match(/e/g)!.length).toBeGreaterThanOrEqual(4);
			// No two moods look alike, so the card actually reads as a mood.
			expect(new Set(drawn).size).toBe(MOODS.length);
		}
	});

	it("collapses rows into runs that reproduce the sprite exactly", () => {
		for (const species of PET_SPECIES) {
			const rows = spriteFor(species, "content");
			const rebuilt: string[][] = rows.map(() => new Array<string>(PET_SPRITE_SIZE).fill("."));
			for (const run of spriteRuns(rows)) {
				expect(run.len).toBeGreaterThan(0);
				for (let i = 0; i < run.len; i++) rebuilt[run.row][run.col + i] = run.ch;
			}
			expect(rebuilt.map((r) => r.join(""))).toEqual(rows);
		}
	});

	it("draws far fewer runs than pixels", () => {
		const runs = spriteRuns(spriteFor("cat", "content"));
		expect(runs.length).toBeLessThan(PET_SPRITE_SIZE * PET_SPRITE_SIZE * 0.4);
	});
});
