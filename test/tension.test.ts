import { describe, expect, it } from "vitest";
import {
	clampScore,
	firstSentence,
	parseHistory,
	parseReading,
	tensionBand,
	tensionDelta,
	tensionFresh,
	type TensionSnapshot,
} from "../src/tension";

describe("tensionBand", () => {
	it("uses Kagi's own cut-offs, inclusive at the top of each band", () => {
		expect(tensionBand(0)).toBe("cool");
		expect(tensionBand(20)).toBe("cool");
		expect(tensionBand(20.5)).toBe("mild");
		expect(tensionBand(40)).toBe("mild");
		expect(tensionBand(60)).toBe("warm");
		expect(tensionBand(61)).toBe("hot");
		expect(tensionBand(80)).toBe("hot");
		expect(tensionBand(81)).toBe("burning");
		expect(tensionBand(100)).toBe("burning");
	});
});

describe("clampScore", () => {
	it("keeps a score inside 0–100", () => {
		expect(clampScore(65)).toBe(65);
		expect(clampScore(-3)).toBe(0);
		expect(clampScore(140)).toBe(100);
	});

	it("reads a numeric string and refuses anything else", () => {
		expect(clampScore("42")).toBe(42);
		expect(clampScore("")).toBeNull();
		expect(clampScore("high")).toBeNull();
		expect(clampScore(null)).toBeNull();
		expect(clampScore(Number.NaN)).toBeNull();
	});
});

describe("parseReading", () => {
	it("reads the latest-batch body", () => {
		expect(
			parseReading({
				chaosIndex: 65,
				chaosDescription: "High global turbulence.",
				chaosLastUpdated: "2024-01-01T12:00:00Z",
			}),
		).toEqual({ score: 65, summary: "High global turbulence.", updated: Date.parse("2024-01-01T12:00:00Z") });
	});

	it("survives a missing description and timestamp", () => {
		expect(parseReading({ chaosIndex: 12 })).toEqual({ score: 12, summary: "", updated: null });
	});

	it("gives up on a body without a score", () => {
		expect(parseReading({ chaosDescription: "…" })).toBeNull();
		expect(parseReading(null)).toBeNull();
		expect(parseReading("65")).toBeNull();
	});
});

describe("parseHistory", () => {
	it("sorts oldest first and drops entries it can't place", () => {
		const points = parseHistory([
			{ date: "2024-01-03", score: 50, summary: "c" },
			{ date: "2024-01-01", score: 30, summary: "a" },
			{ date: "nope", score: 40 },
			{ date: "2024-01-02" },
			"junk",
		]);
		expect(points.map((p) => p.score)).toEqual([30, 50]);
		expect(points[0].summary).toBe("a");
	});

	it("keeps one point per day, the last one given", () => {
		const points = parseHistory([
			{ date: "2024-01-01T06:00:00Z", score: 30 },
			{ date: "2024-01-01T18:00:00Z", score: 35 },
		]);
		expect(points).toHaveLength(1);
		expect(points[0].score).toBe(35);
	});

	it("reads a wrapped list and returns nothing for anything else", () => {
		expect(parseHistory({ history: [{ date: "2024-01-01", score: 1 }] })).toHaveLength(1);
		expect(parseHistory({})).toEqual([]);
		expect(parseHistory(null)).toEqual([]);
	});
});

describe("firstSentence", () => {
	it("cuts at the first sentence end", () => {
		expect(firstSentence("Tension is rising. Talks stalled again.")).toBe("Tension is rising.");
	});

	it("is not fooled by abbreviations and decimals", () => {
		expect(firstSentence("The U.S. raised rates by 0.5 points. Markets fell.")).toBe(
			"The U.S. raised rates by 0.5 points.",
		);
	});

	it("returns a single sentence whole", () => {
		expect(firstSentence("  Calm week  ")).toBe("Calm week");
	});
});

describe("tensionDelta", () => {
	const snap = (score: number, updated: string, history: [string, number][]): TensionSnapshot => ({
		now: { score, summary: "", updated: Date.parse(updated) },
		history: history.map(([date, s]) => ({ date, time: Date.parse(date), score: s, summary: "" })),
		fetched: Date.parse(updated),
	});

	it("compares with the day before today, not with today's own entry", () => {
		expect(tensionDelta(snap(62, "2024-01-03T10:00:00Z", [["2024-01-02", 58], ["2024-01-03", 62]]))).toBe(4);
	});

	it("says nothing without a history", () => {
		expect(tensionDelta(snap(62, "2024-01-03T10:00:00Z", []))).toBeNull();
		expect(tensionDelta(snap(62, "2024-01-03T10:00:00Z", [["2024-01-03", 62]]))).toBeNull();
	});
});

describe("tensionFresh", () => {
	const hour = 3_600_000;
	const scored = Date.parse("2026-09-29T06:00:00Z");
	const snap = (updated: number | null, fetched: number): TensionSnapshot => ({
		now: { score: 50, summary: "", updated },
		history: [],
		fetched,
	});

	it("asks nothing until a day has passed since Kagi scored the index", () => {
		const s = snap(scored, scored + hour);
		expect(tensionFresh(s, scored + 5 * hour, hour)).toBe(true);
		expect(tensionFresh(s, scored + 23.9 * hour, hour)).toBe(true);
	});

	it("checks at the card's interval once the next index is due", () => {
		const s = snap(scored, scored + 24.2 * hour);
		expect(tensionFresh(s, scored + 24.5 * hour, hour)).toBe(true);
		expect(tensionFresh(s, scored + 25.3 * hour, hour)).toBe(false);
	});

	it("falls back to the interval without a timestamp, or with one from the future", () => {
		expect(tensionFresh(snap(null, scored), scored + 2 * hour, hour)).toBe(false);
		expect(tensionFresh(snap(scored + 10 * hour, scored), scored + 2 * hour, hour)).toBe(false);
		expect(tensionFresh({ now: null, history: [], fetched: scored }, scored + 2 * hour, hour)).toBe(false);
	});
});
