import type { App, Component } from "obsidian";
import type { HomeView } from "../view";
import type { CardKind, DashboardCard, HomeSettings } from "../types";
import type { VaultEvent } from "../cardevents";
import type { CardSettingsOptions } from "../editors";

/**
 * The contract every card kind implements (issue #103).
 *
 * A card kind is one self-contained module, `src/cards/<kind>.ts`, that
 * exports a `CardDefinition`. The registry barrel (`src/cards/index.ts`)
 * collects them into one `CARD_DEFINITIONS` record, and every place that used
 * to enumerate kinds by hand — the render switch, the editor switch, the
 * add-card menu, layout-import validation, the live-redraw set, cloneCard —
 * derives from that record instead. Adding a kind means writing its module,
 * registering it, and adding locale strings; nothing else.
 */

/**
 * Something a card needs before it can show anything — a community plugin, or
 * an Obsidian internal the card is built on.
 *
 * This used to be a plain `available()` predicate that *hid* the template until
 * the dependency was there, which made a third of the catalogue invisible: a
 * user with no Dataview never learned the Dataview card exists, and "why does
 * my friend have a Git card?" was unanswerable from inside Hearth. Every card
 * with a requirement already renders its own "install X" prompt when the
 * dependency is missing, so the picker now offers all of them and marks the
 * unmet ones instead.
 */
export interface CardRequirement {
	/** Display name of the dependency, e.g. "Dataview". */
	name: string;
	/** Community plugin id, when the dependency is one — the picker offers a
	 * one-click jump to it in Obsidian's plugin browser. */
	pluginId?: string;
	/** Whether the dependency is usable right now. */
	satisfied: (app: App) => boolean;
}

/**
 * How the "Add card" picker groups templates. The catalogue passed ~30 entries
 * some time ago, which is more than a flat list can carry; the picker shows one
 * section per category, in `CARD_CATEGORIES` order.
 *
 * Ids key `t().cardPicker.categories`, so a missing translation is a build
 * error rather than an empty heading.
 */
export type CardCategory =
	| "notes"
	| "planning"
	| "vault"
	| "tools"
	| "integrations"
	| "fun";

/** One entry in the "Add card" picker. A kind may offer several (embed has
 * five: note / image / base / excalidraw / canvas). */
export interface CardTemplateDef {
	/** Stable id; must match the `templates.<id>` locale key. */
	id: string;
	/** English display name; used as the fallback when a locale lacks the key. */
	name: string;
	/** Lucide icon id shown in the picker menu. */
	icon: string;
	/** Builds the card content/size (id and coordinates are assigned later). */
	build: () => Omit<DashboardCard, "id" | "x" | "y">;
	/** What the card depends on, when it depends on anything. The template is
	 * offered either way; the picker badges it while unmet. */
	requires?: CardRequirement;
}

/**
 * How a card stays up to date after its first render. Declarative replacement
 * for the per-kind branches that used to live in dashboard.ts `mountCardBody`.
 *
 * - `static` — rendered once, never refreshed (most cards).
 * - `poll` — redraw every `card.refreshSec` seconds (web).
 * - `watch-file` — redraw when the tracked vault file changes (embed, daily).
 * - `vault` — redraw (debounced) on any vault/metadata change (tasks, stats,
 *   calendar, search, heatmap).
 */
export type CardLiveness =
	| { mode: "static" }
	| { mode: "poll" }
	| {
			mode: "watch-file";
			/** The vault path the card currently tracks, or null if none. */
			watchedPath: (view: HomeView, card: DashboardCard) => string | null;
			/** True while the card syncs edits in place (so a `modify` event must
			 * not redraw and drop the cursor). Re-evaluated per event. */
			editableInPlace: (card: DashboardCard) => boolean;
	  }
	| {
			mode: "vault";
			/** Skip events that provably can't change this card's content (the
			 * folder-scoped tasks card). Default: always redraw. */
			shouldRedraw?: (card: DashboardCard, ev: VaultEvent) => boolean;
	  };

/** Everything a kind's editor needs, replacing the private state and helpers it
 * used to read off `CardSettingsModal`. */
export interface CardEditorContext {
	app: App;
	card: DashboardCard;
	opts: CardSettingsOptions;
	/** Rebuild the modal in place, keeping the active tab. Was `this.render()`. */
	requestRender(): void;
	/** Per-modal-open scratch space that survives `requestRender()` rebuilds but
	 * not across separate opens (was the RSS/Jira transient modal fields). Each
	 * editor casts its own slice. */
	session: Record<string, unknown>;
}

export interface CardDefinition<K extends CardKind = CardKind> {
	kind: K;
	/** At least one; drives the add-card menu. */
	templates: CardTemplateDef[];
	/** Draw the card body. */
	render(view: HomeView, card: DashboardCard, body: HTMLElement, component: Component): void;
	/** Draw the kind-specific Content-tab controls. Omit for kinds with no
	 * settings (bookmarks, text). */
	renderEditor?(container: HTMLElement, ctx: CardEditorContext): void;
	/** Deep-clone this kind's nested config onto the shallow copy, so a cloned
	 * card shares no references with the original. Omit for kinds whose config
	 * is only primitives. */
	cloneConfig?(source: DashboardCard, copy: DashboardCard): void;
	liveness: CardLiveness;
	/** Extra class on the card root element (links/commands: "is-tile-card"). */
	cardClass?: string;
	/** Post-render header/floating extras, drawn outside arrange mode (embed's
	 * second-view switcher). */
	mountExtras?(
		view: HomeView,
		card: DashboardCard,
		cardEl: HTMLElement,
		head: HTMLElement,
		redraw: () => void,
	): void;
	/** A note shown under the type dropdown in the editor (leaf's perf warning).
	 * Gets the global settings so a note can react to them — the leaf card's
	 * warning says something extra while low power mode is on. */
	editorTypeNote?(container: HTMLElement, settings: HomeSettings): void;
}
