import { describe, expect, it } from "vitest";
import { priorityKey, priorityLevel, priorityRank } from "../src/priority";

/**
 * Priority ordering for the tasks card. The rank has to distinguish all five
 * Tasks-plugin levels: ranking on the coarse colour level tied "highest" with
 * "high" (and "low" with "lowest"), which let the smart-sort tiebreak decide
 * and put High above Highest (#145).
 */
describe("priorityRank", () => {
	it("orders the five Tasks-plugin levels, words and emoji alike", () => {
		const words = ["highest", "high", "medium", "low", "lowest"];
		const emoji = ["🔺", "⏫", "🔼", "🔽", "⏬"];
		expect(words.map(priorityRank)).toEqual([0, 1, 2, 3, 4]);
		expect(emoji.map(priorityRank)).toEqual([0, 1, 2, 3, 4]);
	});

	it("keeps highest above high", () => {
		expect(priorityRank("highest")).toBeLessThan(priorityRank("high"));
		expect(priorityRank("🔺")).toBeLessThan(priorityRank("⏫"));
	});

	it("is case-insensitive", () => {
		expect(priorityRank("Highest")).toBe(0);
		expect(priorityRank("HIGH")).toBe(1);
	});

	it("ranks synonyms by their coarse level", () => {
		expect(priorityRank("urgent")).toBe(priorityRank("high"));
		expect(priorityRank("critical")).toBe(priorityRank("high"));
		expect(priorityRank("normal")).toBe(priorityRank("medium"));
		expect(priorityRank("minor")).toBe(priorityRank("low"));
	});

	it("sorts missing and unrecognised priorities last", () => {
		expect(priorityRank(undefined)).toBe(5);
		expect(priorityRank("")).toBe(5);
		expect(priorityRank("banana")).toBe(5);
		expect(priorityRank("lowest")).toBeLessThan(priorityRank(undefined));
	});
});

describe("priorityKey", () => {
	it("resolves emoji and words to the five keys", () => {
		expect(priorityKey("🔺")).toBe("highest");
		expect(priorityKey("⏬")).toBe("lowest");
		expect(priorityKey("Medium")).toBe("medium");
		expect(priorityKey(" high ")).toBe("high");
	});

	it("falls back to the coarse level for synonyms, and to '' otherwise", () => {
		expect(priorityKey("urgent")).toBe("high");
		expect(priorityKey("minor")).toBe("low");
		expect(priorityKey("banana")).toBe("");
		expect(priorityKey(undefined)).toBe("");
	});
});

describe("priorityLevel", () => {
	it("buckets the five keys into the three colour levels", () => {
		expect(priorityLevel("highest")).toBe("high");
		expect(priorityLevel("⏫")).toBe("high");
		expect(priorityLevel("normal")).toBe("medium");
		expect(priorityLevel("⏬")).toBe("low");
		expect(priorityLevel("banana")).toBe("other");
	});
});
