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

// Inert base classes / components. They exist only so `extends` clauses and
// value imports resolve when a test transitively pulls in a UI-heavy module
// (e.g. the card registry barrel importing editors.ts). None is exercised by a
// pure-logic test.
export class Component {}
export class Modal {}
export class FuzzySuggestModal {}
export class ItemView {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Notice {}
export class Menu {}
export class MarkdownRenderer {}
export class MarkdownView {}
export class WorkspaceLeaf {}
export class ButtonComponent {}
export class SliderComponent {}
export class TextComponent {}

export function setIcon(): void {}
export function addIcon(): void {}
// fileicons.ts imports this for its icon-registry lookup. The pure helpers
// under test take the "is this icon registered?" check as a parameter, so the
// real registry is never consulted.
export function getIconIds(): string[] {
	throw new Error("getIconIds is not implemented in tests (Obsidian API)");
}
export function parseYaml(): unknown {
	throw new Error("parseYaml is not implemented in tests (Obsidian API)");
}
// Real signature returns a debounced wrapper; the identity function is enough
// for module resolution and is never scheduled in a pure-logic test.
export function debounce<T extends (...args: never[]) => unknown>(fn: T): T {
	return fn;
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isMobileApp: false,
	isDesktopApp: true,
};
export const apiVersion = "1.8.7";
