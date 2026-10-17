import type { HomeSettings } from "./types";

/**
 * Keeping UI state on the device instead of in synced files (#392).
 *
 * Two pieces of Hearth state describe what one device is looking at rather
 * than how the vault is configured, yet both end up in files a vault synced
 * with Git (or anything else) carries between devices:
 *
 *  - **The active dashboard** is a field of `data.json`, so every switch marks
 *    the plugin's configuration as modified, and a sync drags the other
 *    device's board along with it.
 *  - **Scroll offsets** (#276) live in the tab's view state, so every scroll
 *    asks Obsidian to rewrite `workspace.json`.
 *
 * With `deviceLocalState` on, the active dashboard is remembered in the
 * vault's localStorage on this device, and `data.json` keeps whatever board it
 * last held on disk; scroll offsets are kept in memory only, for the life of
 * the tab. Off — the default — everything behaves as it always has.
 *
 * The pieces here are the parts worth testing on their own; the wiring lives
 * in `main.ts` (saving, loading, adopting synced settings) and `view.ts`
 * (scroll memory).
 */

/** localStorage key for this device's active dashboard. */
export const ACTIVE_DASHBOARD_KEY = "hearth-active-dashboard";

/** The id stored in localStorage, if it still names one of `settings`'
 * dashboards. Anything else — absent, junk, a board deleted elsewhere — is
 * `null`, so the caller falls back to what `data.json` holds. */
export function validLocalDashboardId(settings: HomeSettings, stored: unknown): string | null {
	if (typeof stored !== "string" || !stored) return null;
	return settings.dashboards.some((d) => d.id === stored) ? stored : null;
}

/**
 * What to write to `data.json` for `settings`: the settings themselves, except
 * that the active dashboard is the one already on disk, so switching boards
 * never changes the file. A disk value that no longer names a board (it was
 * deleted on this device) is replaced with the board actually active, rather
 * than writing a dangling id.
 */
export function settingsForDisk(settings: HomeSettings, diskActiveId: string): HomeSettings {
	const onDisk = settings.dashboards.some((d) => d.id === diskActiveId)
		? diskActiveId
		: settings.activeDashboardId;
	if (onDisk === settings.activeDashboardId) return settings;
	return { ...settings, activeDashboardId: onDisk };
}
