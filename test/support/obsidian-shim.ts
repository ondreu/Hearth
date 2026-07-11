/**
 * Test-time stand-in for the `obsidian` module.
 *
 * The real `obsidian` npm package ships *types only* — it has no runtime
 * entry point — so importing it under Vitest would fail. This shim makes the
 * module graph resolve so we can exercise the plugin's *pure* logic.
 *
 * Deliberate boundary:
 *   - `moment` is the GENUINE moment.js library (the very same implementation
 *     Obsidian re-exports). It is not a mock — the date logic is tested against
 *     real moment behaviour, with time frozen via vi.useFakeTimers().
 *   - Everything else below is an INERT placeholder. Those exports exist only
 *     to satisfy `import { … } from "obsidian"` in modules that transitively
 *     sit above the pure functions under test (query.ts, filetypes.ts,
 *     currency.ts). None of them is ever invoked by a pure-logic test — the
 *     functions that would call them (vault queries, network fetches, DOM work)
 *     are intentionally left untested, per the "no Obsidian API mocks" rule.
 */
import moment from "moment";

export { moment };

// i18n.ts reads this once; t() defaults to English without ever calling it.
export function getLanguage(): string {
	return "en";
}

// Inert placeholders — present for module resolution, never exercised.
export function getAllTags(): string[] {
	throw new Error("getAllTags is not implemented in tests (Obsidian API)");
}
export function prepareFuzzySearch(): unknown {
	throw new Error("prepareFuzzySearch is not implemented in tests (Obsidian API)");
}
export function requestUrl(): unknown {
	throw new Error("requestUrl is not implemented in tests (Obsidian API)");
}

export class TAbstractFile {}
export class TFile extends TAbstractFile {}
export class TFolder extends TAbstractFile {}
export class App {}
