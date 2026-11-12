import { describe, expect, it, vi } from "vitest";
import { refreshOnceMetadataReady } from "../src/metaready";

/**
 * #475 — the boards' `resolved` listener is a startup catch-up for a cold
 * metadata cache, not a live-refresh source. Obsidian fires `resolved` again
 * after every file modification, so the handler used to rebuild every board on
 * the autosave that follows a pause in typing: the embedded editor came back
 * empty-handed, with the caret gone and the board scrolled back to the top of
 * the note.
 */
describe("refreshOnceMetadataReady", () => {
	it("refreshes the boards on the first resolution", () => {
		const refresh = vi.fn();
		refreshOnceMetadataReady(refresh)();
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("stays silent for the resolutions Obsidian fires on every file save", () => {
		const refresh = vi.fn();
		const onResolved = refreshOnceMetadataReady(refresh);
		onResolved(); // the cache finished its first pass
		onResolved(); // an autosave re-resolved the note being typed into
		onResolved(); // …and another one, mid-sentence
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("gives each subscriber its own one-shot", () => {
		const first = vi.fn();
		const second = vi.fn();
		const a = refreshOnceMetadataReady(first);
		const b = refreshOnceMetadataReady(second);
		a();
		b();
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});
});
