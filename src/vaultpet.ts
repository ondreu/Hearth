/**
 * The Vault Pet integration: everything Hearth knows about the
 * [Vault Pet](https://github.com/elliott-json-park/obsidian-vault-pet)
 * community plugin.
 *
 * The rule is the one the Git, Dataview and Datacore modules follow: **Hearth
 * never does the work itself.** It does not count characters, keep XP, draw a
 * sprite or store a single byte of pet state — Vault Pet owns all of it, and
 * Hearth only gives it a place on the board. Two places, in fact, and both are
 * the plugin's *own* surfaces rather than a second rendering of them:
 *
 * 1. **The pet card** — the `vault-pet` fenced block the plugin registers a
 *    Markdown processor for. Hearth renders that block into the card body, so
 *    what appears is the plugin's own compact card: its sprite, its level bar,
 *    its streak, its click-to-pet. The plugin keeps a handle on every block it
 *    renders and repaints them itself, so the card stays live with no polling
 *    of any kind from Hearth.
 * 2. **The pet house** — the `vault-pet-house` side-panel view, hosted in the
 *    card as a detached leaf the same way the Plugin view card hosts any other
 *    view. Quests, dex, badges, wardrobe and stats are all there, exactly as
 *    they are in the sidebar.
 *
 * Consequently this module is tiny and entirely made of guards. Vault Pet
 * exposes no versioned API object, so the only plugin member Hearth calls —
 * `openHouse()` — is declared optional, checked before use, and backed by the
 * plugin's own command as a fallback. A renamed method costs one button; it
 * never throws inside a dashboard render.
 */
import type { App } from "obsidian";
import type { DashboardCard, VaultPetDisplay } from "./types";

/** The community-plugin id Vault Pet registers itself under. */
export const VAULT_PET_PLUGIN_ID = "vault-pet";

/** Vault Pet's "pet house" view type — quests, dex, badges and stats. */
export const VAULT_PET_HOUSE_VIEW = "vault-pet-house";

/** The fenced-block language Vault Pet registers a Markdown processor for. */
export const VAULT_PET_BLOCK_LANG = "vault-pet";

/** The plugin's "open the pet house" command, used when the instance doesn't
 * carry `openHouse` (a renamed internal, or a future rewrite). */
export const VAULT_PET_OPEN_COMMAND = `${VAULT_PET_PLUGIN_ID}:open-house`;

/**
 * The Markdown source Hearth renders for the pet card: the plugin's own fenced
 * block, empty, which is exactly what its "Insert pet card" command writes into
 * a note. The processor ignores the block's contents, so there is nothing to
 * configure inside it.
 */
export const VAULT_PET_BLOCK = `\`\`\`${VAULT_PET_BLOCK_LANG}\n\`\`\``;

/** Every surface the card can show, in the order the editor offers them. */
export const VAULT_PET_DISPLAYS: readonly VaultPetDisplay[] = ["pet", "house"];

/**
 * Which surface a card is set to show. Total, because the value reaches here
 * from a shared board, a hand-edited `data.json` or a Hearth old enough to
 * predate the setting: anything that isn't one of the two named surfaces is
 * the default rather than an empty card.
 */
export function vaultPetDisplay(card: DashboardCard): VaultPetDisplay {
	const display = card.vaultPet?.display;
	return display && VAULT_PET_DISPLAYS.includes(display) ? display : "pet";
}

/** The members of the Vault Pet plugin instance Hearth touches. All optional:
 * none of them is a published contract. */
interface VaultPetLike {
	openHouse?: (tab?: string) => unknown;
}

/** The running Vault Pet instance, or null when it isn't enabled. */
export function vaultPetPlugin(app: App): VaultPetLike | null {
	return (app.plugins?.plugins?.[VAULT_PET_PLUGIN_ID] as VaultPetLike | undefined) ?? null;
}

/** Whether Vault Pet is installed *and* enabled right now. */
export function isVaultPetAvailable(app: App): boolean {
	return vaultPetPlugin(app) != null;
}

/**
 * Open Vault Pet's house in the sidebar, the same as clicking its ribbon icon.
 * Tries the plugin instance first and falls back to its command; returns false
 * when neither route is there, so a caller can leave its button off.
 */
export function openVaultPetHouse(app: App): boolean {
	const plugin = vaultPetPlugin(app);
	if (typeof plugin?.openHouse === "function") {
		try {
			plugin.openHouse();
			return true;
		} catch {
			// Fall through to the command, which routes its own errors.
		}
	}
	return app.commands?.executeCommandById?.(VAULT_PET_OPEN_COMMAND) ?? false;
}
