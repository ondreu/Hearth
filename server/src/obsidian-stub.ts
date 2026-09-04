/**
 * A stand-in for the `obsidian` module, so the plugin's package engine can run
 * on a server.
 *
 * The `obsidian` npm package is types-only — there is no runtime entry point —
 * and the modules the server reuses (`src/portable/`, `src/identity.ts`,
 * `src/gallery/`) sit above `src/types.ts`, which imports `Platform`, and above
 * `src/i18n.ts`, which imports `getLanguage`. Everything here exists so that
 * import graph resolves.
 *
 * The distinction that matters, and it is the same one `test/support/
 * obsidian-shim.ts` draws: two of these are **real** because the engine's pure
 * logic genuinely uses them, and the rest are inert placeholders that the
 * server never reaches. If one of them ever throws, that is the intended
 * outcome — it means a code path that touches a vault, a network or a DOM has
 * been pulled into the server, and the answer is to stop calling it rather than
 * to implement it here.
 */
import { Buffer } from "node:buffer";

/** Real. Assets are base64 in the package, and the server decodes a wallpaper
 * out of one to serve it as a picture. Node's Buffer is the same base64. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return Buffer.from(buffer).toString("base64");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const bytes = Buffer.from(base64, "base64");
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** Real. A pure string function, and the engine's path handling goes through
 * it. Matches Obsidian's: collapse separators, trim the ends, NFC. */
export function normalizePath(path: string): string {
	const cleaned = path
		.replace(/([\\/])+/g, "/")
		.replace(/(^\/+|\/+$)/g, "")
		.normalize("NFC");
	return cleaned === "" ? "/" : cleaned;
}

/** The server has no user, so it has no language. Warning strings it never
 * renders come out in English. */
export function getLanguage(): string {
	return "en";
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isMobileApp: false,
	isDesktopApp: true,
};

export const apiVersion = "1.12.2";

export function requireApiVersion(): boolean {
	return true;
}

// ---- Inert ------------------------------------------------------------
// Present for module resolution only. A call means server code has wandered
// into the plugin's UI or vault layer.

function unreachable(name: string): never {
	throw new Error(`${name} is not available on the gallery server`);
}

export function getAllTags(): never {
	unreachable("getAllTags");
}
export function prepareFuzzySearch(): never {
	unreachable("prepareFuzzySearch");
}
export function requestUrl(): never {
	unreachable("requestUrl");
}
export function parseYaml(): never {
	unreachable("parseYaml");
}
export function getIconIds(): never {
	unreachable("getIconIds");
}
// Drawing helpers. No-ops rather than throws: they are called for their
// side effect on a DOM node, and a server that reached one has simply drawn
// nothing.
export function setIcon(): void {}
export function addIcon(): void {}
export function setTooltip(): void {}
export function debounce<T>(fn: T): T {
	return fn;
}

/**
 * Obsidian re-exports moment, and the plugin's date helpers import it from
 * there. Nothing the server calls formats a date — it writes ISO strings — but
 * the import has to resolve, and a module-level `moment()` call somewhere in the
 * graph would be a crash at startup rather than a mystery later.
 */
export const moment = Object.assign(
	() => unreachable("moment"),
	{
		utc: () => unreachable("moment.utc"),
		locale: () => "en",
		duration: () => unreachable("moment.duration"),
	},
);

export class TAbstractFile {}
export class TFile extends TAbstractFile {}
export class TFolder extends TAbstractFile {}
export class App {}
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
export class TextFileView {}
export class ButtonComponent {}
export class ExtraButtonComponent {}
export class Keymap {
	static isModEvent(): never {
		return unreachable("Keymap.isModEvent");
	}
}
export class SliderComponent {}
export class TextComponent {}
