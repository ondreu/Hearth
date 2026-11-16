import { t } from "./i18n";
import type { DashboardCard, HomeSettings } from "./types";

/**
 * Which cards are reachable as commands (#491), what those commands are called,
 * and what a settings change means for the registry — the part of the feature
 * that can be wrong without anyone noticing, kept away from the command
 * registry and the dialog so it can be tested.
 *
 * A command's name is the only thing a user can type at: Obsidian's `/` menu
 * (and its command palette) filter on that string and nothing else, so the
 * card's own title has to be in it.
 */

/** Command ids are the plugin's, so they can never collide with another
 * plugin's; the card id keeps them stable across a rename. */
export function cardCommandId(card: DashboardCard): string {
	return `open-card-${card.id}`;
}

/** `Hearth: Open Weather` — the title first, because that is what gets typed. */
export function cardCommandName(card: DashboardCard): string {
	const label = card.title?.trim() || t().editors.kinds[card.kind];
	return `Hearth: Open ${label}`;
}

/**
 * Every card that asked for a command, across all boards and the shared pinned
 * set, once each — a pinned card is stored once but appears on every board.
 */
export function cardsWithCommands(s: HomeSettings): DashboardCard[] {
	const seen = new Set<string>();
	const out: DashboardCard[] = [];
	const all = [...s.dashboards.flatMap((d) => d.cards), ...s.pinnedCards];
	for (const card of all) {
		if (!card.command || seen.has(card.id)) continue;
		seen.add(card.id);
		out.push(card);
	}
	return out;
}

/** What the command registry should look like after a settings change. */
export interface CardCommandPlan {
	/** Commands to register — a new card, or one whose name changed. */
	add: { id: string; name: string; card: DashboardCard }[];
	/** Ids to unregister — a card that is gone, or one being re-registered
	 * under its new name (Obsidian's registry cannot rename in place). */
	remove: string[];
	/** What should be considered registered once the plan has been applied. */
	next: Map<string, string>;
}

/**
 * Compare what is registered with what the settings ask for.
 *
 * Pure on purpose: the reconciliation is where a stale command would come from
 * (a renamed card leaving its old name behind, a deleted card keeping its
 * entry), and it is the one part of this feature that can be tested without
 * Obsidian's command registry.
 */
export function planCardCommands(
	registered: ReadonlyMap<string, string>,
	s: HomeSettings,
): CardCommandPlan {
	const next = new Map<string, string>();
	const add: CardCommandPlan["add"] = [];
	const remove: string[] = [];
	for (const card of cardsWithCommands(s)) {
		const id = cardCommandId(card);
		const name = cardCommandName(card);
		next.set(id, name);
		if (registered.get(id) === name) continue;
		if (registered.has(id)) remove.push(id);
		add.push({ id, name, card });
	}
	for (const id of registered.keys()) if (!next.has(id)) remove.push(id);
	return { add, remove, next };
}
