import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	flushRssState,
	initRssState,
	isRssRead,
	onRssReadChange,
	pruneRead,
	rssReadKey,
	setRssRead,
	unreadCount,
} from "../src/rssstate";
import type { HomeSettings } from "../src/types";

/** What has been read (src/rssstate.ts): kept in settings, saved quietly,
 * announced, and bounded. */

function fakeHost() {
	const settings = { rssRead: {} } as unknown as HomeSettings;
	const saveData = vi.fn(async () => {});
	initRssState({ settings, saveData });
	return { settings, saveData };
}

describe("rssstate", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("window", { setTimeout, clearTimeout });
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("keys an entry by feed and id", () => {
		expect(rssReadKey("https://a/feed", { id: "1" })).toBe(rssReadKey("https://a/feed", { id: "1" }));
		expect(rssReadKey("https://a/feed", { id: "1" })).not.toBe(rssReadKey("https://b/feed", { id: "1" }));
		expect(rssReadKey("https://a/feed", { id: "1" })).toMatch(/^[0-9a-z]{6,12}$/);
	});

	it("marks, counts, announces and saves once", () => {
		const { saveData } = fakeHost();
		const heard = vi.fn();
		const off = onRssReadChange(heard);
		const items = [{ id: "1" }, { id: "2" }, { id: "3" }] as never[];
		expect(unreadCount("u", items)).toBe(3);
		setRssRead([{ url: "u", item: { id: "1" } }, { url: "u", item: { id: "2" } }], true);
		setRssRead([{ url: "u", item: { id: "2" } }], true); // no change: not announced
		expect(isRssRead("u", { id: "1" })).toBe(true);
		expect(unreadCount("u", items)).toBe(1);
		setRssRead([{ url: "u", item: { id: "1" } }], false);
		expect(isRssRead("u", { id: "1" })).toBe(false);
		expect(heard).toHaveBeenCalledTimes(2);
		expect(saveData).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(saveData).toHaveBeenCalledTimes(1);
		off();
		setRssRead([{ url: "u", item: { id: "3" } }], true);
		expect(heard).toHaveBeenCalledTimes(2);
		flushRssState();
		expect(saveData).toHaveBeenCalledTimes(2);
	});

	it("survives settings that hold no usable record", () => {
		const { settings } = fakeHost();
		(settings as unknown as { rssRead: unknown }).rssRead = "garbage";
		expect(isRssRead("u", { id: "1" })).toBe(false);
		setRssRead([{ url: "u", item: { id: "1" } }], true);
		expect(isRssRead("u", { id: "1" })).toBe(true);
	});

	it("prunes the marks read longest ago", () => {
		const map = { a: 5, b: 1, c: 9, d: 3 };
		expect(pruneRead(map, 2)).toEqual({ c: 9, a: 5 });
		expect(pruneRead(map, 10)).toBe(map);
	});
});
