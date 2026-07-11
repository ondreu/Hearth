import { describe, it } from "vitest";

/**
 * src/currency.ts is intentionally NOT unit-tested.
 *
 * It exposes no pure functions worth locking down:
 *   - `loadRates()` performs a network fetch via Obsidian's `requestUrl`, and
 *     its result depends on wall-clock time (a 6-hour TTL against Date.now())
 *     and hidden module-level cache/in-flight state.
 *   - `cachedRates()` just reads that module-level cache.
 *   - CURRENCY_CODES / CURRENCY_SYMBOLS are static data, not logic.
 *
 * Testing any of it would require mocking the network and manipulating the
 * clock and module state — outside the "pure logic only" scope. The one piece
 * of currency behaviour that IS pure — turning rates into a converted amount —
 * lives in the calculator and is covered in calculator.test.ts.
 */
describe.skip("currency.ts (no pure logic to test — see file comment)", () => {
	it("is covered indirectly via the calculator's currency conversions", () => {
		/* intentionally empty */
	});
});
