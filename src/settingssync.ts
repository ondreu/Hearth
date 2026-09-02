import { normalizePath } from "obsidian";
import type { HomeSettings } from "./types";

/**
 * Picking up settings another device wrote.
 *
 * Hearth keeps everything — dashboards, cards, card contents — in the plugin's
 * own `data.json`, and reads it exactly once, at load. That is fine on one
 * machine, where this window is the only writer. It is not fine with sync: a
 * board edited on the desktop lands on the laptop's disk while the laptop is
 * still holding the copy it read at startup, so the change is invisible until
 * Obsidian is restarted — and worse, the next thing the laptop saves writes its
 * stale copy straight back over the synced one.
 *
 * The fix is to notice the file changing underneath us and adopt it. The pieces
 * here are the parts of that worth testing on their own; the wiring — the
 * `raw` vault event, the debounce, the re-render — lives in `main.ts`.
 */

/** Vault-relative path of the plugin's own `data.json`. `manifest.dir` is what
 * Obsidian itself loads from (it accounts for a vault with a non-default config
 * folder); the fallback only matters if that ever comes back empty. */
export function pluginDataPath(configDir: string, manifest: { id: string; dir?: string }): string {
	const dir = manifest.dir || `${configDir}/plugins/${manifest.id}`;
	return normalizePath(`${dir}/data.json`);
}

/** Whether a path reported by a vault event is that `data.json`. Compared
 * case-insensitively: the event carries the path as the filesystem spelled it,
 * and Windows and macOS are both happy to spell it differently. */
export function isPluginDataPath(dataPath: string, changed: string): boolean {
	return normalizePath(changed).toLowerCase() === dataPath.toLowerCase();
}

/**
 * Whether parsed JSON looks like a settings file Hearth actually saved, rather
 * than something it must not act on.
 *
 * This is the guard against the dangerous case. A sync client writes a file
 * before it is complete, and a truncated or empty `data.json` parses perfectly
 * well as `{}` — which the migration would then hydrate into a brand-new
 * starter dashboard, silently replacing the user's boards in memory and, on the
 * next save, on disk. So nothing is adopted unless the file carries boards
 * (or the pre-3.0 single-board `cards` array a very old peer might still send).
 */
export function looksLikeSavedSettings(raw: unknown): raw is Record<string, unknown> {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
	const o = raw as Record<string, unknown>;
	const dashboards = o.dashboards;
	if (Array.isArray(dashboards) && dashboards.length > 0) return true;
	return Array.isArray(o.cards);
}

/** Key-order-independent serialisation, so settings that differ only in the
 * order two versions of Hearth happened to write their keys don't read as a
 * change. Only the shapes `data.json` can hold — JSON — are handled. */
function stableJson(value: unknown): string {
	if (value === undefined) return "null";
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	const o = value as Record<string, unknown>;
	const body = Object.keys(o)
		.sort()
		.filter((k) => o[k] !== undefined)
		.map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
		.join(",");
	return `{${body}}`;
}

/** Whether two settings objects are the same configuration. Used to tell a
 * write this window just made (identical, ignore it) from another device's
 * (different, adopt it). */
export function sameSettings(a: HomeSettings, b: HomeSettings): boolean {
	return stableJson(a) === stableJson(b);
}

/**
 * Take on `next`'s values **in place**, so every reference already handed out
 * stays live.
 *
 * Cards, the settings tab and the dashboard editor all capture
 * `plugin.settings` and hold it for as long as they exist; replacing the object
 * would leave every one of them writing into a copy nothing reads — and the
 * first such write would put the stale copy back on disk. Mutating the object
 * they already hold means the adoption reaches them all, and their next save
 * persists the synced state rather than fighting it.
 */
export function adoptSettings(current: HomeSettings, next: HomeSettings): void {
	const c = current as unknown as Record<string, unknown>;
	const n = next as unknown as Record<string, unknown>;
	// Keys the incoming settings no longer carry (a field a migration retired)
	// have to go, or they would outlive it here and be written back.
	for (const key of Object.keys(c)) if (!(key in n)) delete c[key];
	Object.assign(c, n);
}
