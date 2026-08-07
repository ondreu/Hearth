import { describe, expect, it } from "vitest";
import { calendarChips } from "../src/types";

/**
 * Which chips an agenda entry carries. The rule that matters is the default
 * one: an existing card (no `chips` config at all) must look exactly as it did,
 * so everything the agenda already showed defaults on and only the new status
 * chip defaults off.
 */
describe("calendarChips", () => {
	it("shows everything the agenda already showed when nothing is configured", () => {
		expect(calendarChips(undefined)).toEqual({
			time: true,
			source: true,
			status: false,
			priority: true,
			due: true,
			timeblock: true,
			recurring: true,
		});
	});

	it("treats an empty config the same as no config", () => {
		expect(calendarChips({})).toEqual(calendarChips(undefined));
	});

	it("hides only what was switched off", () => {
		const chips = calendarChips({ source: false, priority: false });
		expect(chips.source).toBe(false);
		expect(chips.priority).toBe(false);
		expect(chips.due).toBe(true);
		expect(chips.time).toBe(true);
	});

	it("shows the status chip only when it is asked for", () => {
		expect(calendarChips({ status: true }).status).toBe(true);
		expect(calendarChips({ status: false }).status).toBe(false);
	});
});
