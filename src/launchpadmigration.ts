/**
 * The retired Commands card, folded into Links / launchpad (#388).
 *
 * The two cards drew the same grid of buttons with the same sizing, drag and
 * resize; the only difference was what a button held. A Commands button was a
 * command and its captured name, nothing else — its label could not be edited,
 * so several commands from one plugin all read as the plugin's long name, cut
 * off. A launchpad button can be a command too, with a label of its own, so the
 * Commands card is gone and every one of them becomes a launchpad.
 *
 * The fold is written to lose nothing:
 *
 *  - The card keeps its id, its place, its title, its narrow-layout options and
 *    every card-level field (button sizing, button size, auto-shift…) — only its
 *    `kind` changes and `commands` becomes `links`.
 *  - Each button keeps its size and position in both sizing styles, and any
 *    field this build does not know, verbatim. Its command id becomes the
 *    target, its name the label (both cards show the label, or the target when
 *    it is empty, so the button reads exactly as it did) and its icon stays
 *    as it was — an empty one still draws the command icon, see
 *    `linkFallbackIcon`.
 *  - Nothing is checked against the commands registered right now: at load
 *    time another plugin's commands may simply not be registered yet, and
 *    dropping a button for that would be data loss.
 *  - A Commands card that also carries a `links` list (it was switched from a
 *    launchpad with the type dropdown, which leaves the old list behind) keeps
 *    it, after the commands, rather than have it deleted unseen.
 *
 * Pure and non-mutating: it is applied by `migrateSettings` on load (and to
 * settings another device synced in) and by `sanitizeCard` on every import, so
 * an old `data.json`, backup, layout export or shared board all arrive as the
 * same launchpad.
 */

/** A button on the retired Commands card, as it was persisted. Only the
 * migration still knows this shape. */
export interface LegacyCommandItem {
	/** Obsidian command id, e.g. "editor:toggle-bold". */
	id?: unknown;
	/** Display name, captured when the command was picked. */
	name?: unknown;
	/** Optional Lucide icon id or vault image path. */
	icon?: unknown;
	[key: string]: unknown;
}

/** The retired card kind. */
export const LEGACY_COMMANDS_KIND = "commands";

/** Whether a raw persisted card is a retired Commands card. */
export function isLegacyCommandsCard(raw: unknown): raw is Record<string, unknown> {
	return (
		!!raw &&
		typeof raw === "object" &&
		(raw as Record<string, unknown>).kind === LEGACY_COMMANDS_KIND
	);
}

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * One Commands button as a launchpad button. `id` is the button's own id on
 * the launchpad — a Commands button had none, its `id` was the command.
 */
export function commandAsLink(cmd: LegacyCommandItem, id: string): Record<string, unknown> {
	// Every other field (sizes, positions, anything newer) rides along as is.
	const { id: command, name, icon, ...rest } = cmd;
	return {
		...rest,
		id,
		label: text(name),
		icon: text(icon),
		target: text(command),
		type: "command",
	};
}

/**
 * A Commands card as a launchpad: a new object, the input left untouched.
 * Anything that is not a Commands card is returned as it is.
 *
 * The buttons' ids are derived from their position rather than random, so two
 * devices folding the same synced card arrive at the same result instead of
 * each rewriting the other's copy.
 */
export function commandsCardAsLaunchpad(raw: Record<string, unknown>): Record<string, unknown> {
	if (!isLegacyCommandsCard(raw)) return raw;
	const { commands, links, ...card } = raw;
	const kept = Array.isArray(links) ? (links as unknown[]) : [];
	const taken = new Set(
		kept.flatMap((l) =>
			l && typeof l === "object" && typeof (l as Record<string, unknown>).id === "string"
				? [(l as Record<string, unknown>).id as string]
				: [],
		),
	);
	const converted: Record<string, unknown>[] = [];
	if (Array.isArray(commands)) {
		commands.forEach((cmd, i) => {
			// A non-object entry was never a button: the Commands card itself
			// could not draw it.
			if (!cmd || typeof cmd !== "object") return;
			let id = `command-${i + 1}`;
			for (let n = 2; taken.has(id); n++) id = `command-${i + 1}-${n}`;
			taken.add(id);
			converted.push(commandAsLink(cmd as LegacyCommandItem, id));
		});
	}
	return { ...card, kind: "links", links: [...converted, ...kept] };
}

/**
 * Fold every Commands card in a list in place. Returns true when any was
 * folded, so the caller knows the result needs saving.
 */
export function foldCommandsCards(cards: unknown): boolean {
	if (!Array.isArray(cards)) return false;
	let folded = false;
	cards.forEach((card, i) => {
		if (!isLegacyCommandsCard(card)) return;
		cards[i] = commandsCardAsLaunchpad(card);
		folded = true;
	});
	return folded;
}
