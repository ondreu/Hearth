import type { App, EventRef, TAbstractFile } from "obsidian";
import type { DashboardCard } from "./types";
import { tasksEventRelevant } from "./taskscope";

/**
 * The dashboard's shared vault-event fan-out and the pure "should this card
 * redraw for this event?" decisions, kept out of dashboard.ts so they can be
 * unit-tested without the Obsidian runtime (the module uses only type-only
 * imports from "obsidian").
 */

export type VaultEventKind = "create" | "delete" | "rename" | "modify" | "meta";

/** A vault/metadata change fanned out to the board's cards: the four vault
 * disk events plus the metadata-cache reparse ("meta"). `oldPath` is set for
 * renames only. */
export interface VaultEvent {
	kind: VaultEventKind;
	file: TAbstractFile;
	oldPath?: string;
}

export interface VaultEventHub {
	subscribe(listener: (ev: VaultEvent) => void): void;
}

/**
 * One shared set of vault/metadataCache registrations per board render,
 * fanning each event out to the subscribed cards. Every live card used to
 * register its own five listeners, so each vault event ran 5×N closures (and
 * as many debounce timers) before anything was even filtered; the hub keeps
 * the Obsidian-side registration constant no matter how many cards listen.
 *
 * Registration is lazy — a board with no event-driven cards registers nothing
 * — and each `EventRef` is handed to `register` (the render Component's
 * `registerEvent`) so the listeners tear down with the render exactly as the
 * per-card registrations did.
 */
export function createVaultEventHub(
	app: App,
	register: (ref: EventRef) => void,
): VaultEventHub {
	const listeners: ((ev: VaultEvent) => void)[] = [];
	let registered = false;
	const dispatch = (ev: VaultEvent) => {
		for (const listener of listeners) {
			// Isolate subscribers from each other — before the hub each card was
			// its own Obsidian handler, so one card's failure must not start
			// silencing the other cards' refreshes now that they share a loop.
			try {
				listener(ev);
			} catch (err) {
				console.error("Hearth card event listener error", err);
			}
		}
	};
	return {
		subscribe(listener) {
			if (!registered) {
				registered = true;
				const { vault, metadataCache } = app;
				register(vault.on("create", (file) => dispatch({ kind: "create", file })));
				register(vault.on("delete", (file) => dispatch({ kind: "delete", file })));
				register(vault.on("rename", (file, oldPath) => dispatch({ kind: "rename", file, oldPath })));
				register(vault.on("modify", (file) => dispatch({ kind: "modify", file })));
				register(metadataCache.on("changed", (file) => dispatch({ kind: "meta", file })));
			}
			listeners.push(listener);
		},
	};
}

/**
 * Whether a live (data-driven) card should redraw for an event. Non-tasks live
 * cards (stats, calendar, search, heatmap) derive their content from the whole
 * vault, so every change is relevant; a tasks card additionally honours its
 * folder scope so a change it can provably ignore skips the redraw.
 */
export function liveCardShouldRedraw(card: DashboardCard, ev: VaultEvent): boolean {
	if (card.kind === "tasks") return tasksEventRelevant(card.tasks, ev.file, ev.oldPath);
	return true;
}

/**
 * For a tracked-file (embed/daily) card, whether an event of this kind can
 * trigger a redraw at all — before the separate path-affinity check. A `meta`
 * reparse is ignored (the `modify` it follows already redrew); a content
 * `modify` is ignored while the card is edited in place (so the cursor is
 * kept), which the caller passes as `redrawOnModify`; existence events
 * (create/delete/rename) always count.
 */
export function watchedCardReactsToKind(kind: VaultEventKind, redrawOnModify: boolean): boolean {
	if (kind === "meta") return false;
	if (kind === "modify") return redrawOnModify;
	return true;
}
