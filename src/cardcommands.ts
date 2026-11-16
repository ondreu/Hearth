import { findCardById } from "./types";
import { planCardCommands } from "./cardcommandstate";
import { openCardDialog } from "./cardmodal";
import type HearthPlugin from "./main";

/**
 * One command per card that asked for one (#491).
 *
 * Obsidian's `/` menu is not something a plugin registers into: the core
 * "Slash commands" plugin lists the command palette's commands and filters
 * them by name, so a command is all this has to add — it shows up in the
 * palette, in `/`, and in Hearth's own `>` mode by itself.
 *
 * The registry is rebuilt from settings rather than patched, so a card that was
 * deleted, un-switched or renamed cannot leave a stale command behind. Ids are
 * derived from the card, names from its title, so a rename is a re-register.
 */

/** What this plugin has registered, and under which name. Kept off the plugin
 * object so it costs nothing when the feature is unused. */
const registered = new WeakMap<object, Map<string, string>>();

export function syncCardCommands(plugin: HearthPlugin): void {
	const before = registered.get(plugin) ?? new Map<string, string>();
	const plan = planCardCommands(before, plugin.settings);
	for (const id of plan.remove) plugin.removeCommand(id);
	for (const { id, name, card } of plan.add) {
		plugin.addCommand({
			id,
			name,
			checkCallback: (checking) => {
				// The card is looked up per invocation: the command outlives a
				// settings reload, and the card may be gone by the time it runs.
				const live = findCardById(plugin.settings, card.id);
				if (!live || live.command !== true) return false;
				if (!checking) openCardDialog(plugin.app, plugin, live);
				return true;
			},
		});
	}
	registered.set(plugin, plan.next);
}
