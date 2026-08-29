import type { App } from "obsidian";
import type { CardKind, DashboardCard } from "../types";
import type {
	CardCategory,
	CardDefinition,
	CardRequirement,
	CardTemplateDef,
} from "./definition";
import { t } from "../i18n";

import { embedCard } from "./embed";
import { slideshowCard } from "./slideshow";
import { dailyCard } from "./daily";
import { periodicCard } from "./periodic";
import { webCard } from "./web";
import { bookmarksCard } from "./bookmarks";
import { favoritesCard } from "./favorites";
import { textCard } from "./text";
import { recentCard } from "./recent";
import { linksCard } from "./links";
import { commandsCard } from "./commands";
import { templaterCard } from "./templater";
import { clockCard } from "./clock";
import { tasksCard } from "./tasks";
import { calendarCard } from "./calendar";
import { scheduleCard } from "./schedule";
import { statsCard } from "./stats";
import { searchCard } from "./search";
import { searchbarCard } from "./searchbar";
import { heatmapCard } from "./heatmap";
import { calculatorCard } from "./calculator";
import { dataviewCard } from "./dataview";
import { datacoreCard } from "./datacore";
import { rssCard } from "./rss";
import { jiraCard } from "./jira";
import { weatherCard } from "./weather";
import { gitCard } from "./git";
import { operonCard } from "./operon";
import { leafCard } from "./leaf";
import { petCard } from "./pet";

export type {
	CardCategory,
	CardDefinition,
	CardEditorContext,
	CardLiveness,
	CardRequirement,
	CardTemplateDef,
} from "./definition";

/**
 * The card registry (issue #103): exactly one definition per card kind. The
 * mapped type makes this exhaustive — add a kind to `CardKind` without
 * registering it here (or vice versa) and this fails to typecheck, the same
 * safety the old render/editor `switch`es gave. Written in `CardKind` order so
 * the editor's type dropdown keeps its historical ordering.
 */
export const CARD_DEFINITIONS: { [K in CardKind]: CardDefinition<K> } = {
	embed: embedCard,
	slideshow: slideshowCard,
	daily: dailyCard,
	periodic: periodicCard,
	web: webCard,
	bookmarks: bookmarksCard,
	favorites: favoritesCard,
	text: textCard,
	recent: recentCard,
	links: linksCard,
	commands: commandsCard,
	templater: templaterCard,
	clock: clockCard,
	tasks: tasksCard,
	calendar: calendarCard,
	schedule: scheduleCard,
	stats: statsCard,
	search: searchCard,
	searchbar: searchbarCard,
	heatmap: heatmapCard,
	calculator: calculatorCard,
	dataview: dataviewCard,
	datacore: datacoreCard,
	rss: rssCard,
	jira: jiraCard,
	weather: weatherCard,
	git: gitCard,
	operon: operonCard,
	leaf: leafCard,
	pet: petCard,
};

/** Every registered kind, in registry order. Used for layout-import validation
 * and the editor's type dropdown. */
export const CARD_KINDS = Object.keys(CARD_DEFINITIONS) as CardKind[];

/** Inert definition served for a kind this build doesn't know — persisted data
 * written by a newer Hearth version (then downgraded), a sync conflict, or a
 * hand-edited data.json. The card renders an empty body (the old render
 * switch's default) instead of a lookup on `undefined` taking down the whole
 * dashboard render; the card itself keeps its data and its slot, and the
 * editor's type dropdown still offers every known kind as a way out. */
const UNKNOWN_CARD_DEFINITION: CardDefinition = {
	// Never dispatched on: dispatch happens on the card's own (unknown) kind.
	kind: "text",
	templates: [],
	render: () => {},
	liveness: { mode: "static" },
};

/** The definition backing a card. Total: an unknown kind gets an inert
 * fallback rather than `undefined`. */
export function cardDefinition(card: DashboardCard): CardDefinition {
	return CARD_DEFINITIONS[card.kind] ?? UNKNOWN_CARD_DEFINITION;
}

/**
 * How the "Add card" picker groups and orders its templates.
 *
 * Kept explicit — and here rather than on each template — because the grouping
 * is editorial: it is the one place you can see the whole catalogue at once and
 * judge whether the sections still balance. It does not match `CardKind` order,
 * and several templates can map to one kind (embed offers five). The unit test
 * in test/cards-registry.test.ts asserts the groups cover every registered
 * template id exactly once.
 */
export const TEMPLATE_MENU_GROUPS: { category: CardCategory; templates: string[] }[] = [
	{
		category: "notes",
		templates: ["note", "daily", "periodic", "image", "slideshow", "canvas", "excalidraw", "base", "recent", "favorites", "bookmarks"],
	},
	{ category: "planning", templates: ["tasks", "schedule", "calendar", "clock"] },
	{ category: "vault", templates: ["search", "searchbar", "stats", "heatmap"] },
	{ category: "tools", templates: ["links", "commands", "text", "calculator", "web"] },
	{ category: "integrations", templates: ["templater", "dataview", "datacore", "git", "jira", "rss", "weather", "operon-tasks", "operon-board", "operon-agenda", "operon-timer", "leaf"] },
	{ category: "fun", templates: ["pet"] },
];

/** The categories, in picker order. */
export const CARD_CATEGORIES: CardCategory[] = TEMPLATE_MENU_GROUPS.map((g) => g.category);

/** Every template id, flattened in picker order. */
export const TEMPLATE_MENU_ORDER: string[] = TEMPLATE_MENU_GROUPS.flatMap((g) => g.templates);

/** The category a template belongs to, or null for an id in no group (which
 * the registry test makes impossible). */
export function templateCategory(id: string): CardCategory | null {
	return TEMPLATE_MENU_GROUPS.find((g) => g.templates.includes(id))?.category ?? null;
}

const TEMPLATES_BY_ID = new Map<string, CardTemplateDef>();
for (const def of Object.values(CARD_DEFINITIONS)) {
	for (const tpl of def.templates) TEMPLATES_BY_ID.set(tpl.id, tpl);
}

/** Every "Add card" preset, in menu order. */
export const CARD_TEMPLATES: CardTemplateDef[] = TEMPLATE_MENU_ORDER.map((id) => {
	const tpl = TEMPLATES_BY_ID.get(id);
	if (!tpl) throw new Error(`Unknown card template id in TEMPLATE_MENU_ORDER: ${id}`);
	return tpl;
});

/** The template's localized display name for the "Add card" menu. Falls back to
 * the English `name` baked into the template if a locale is missing the key. */
export function templateName(template: CardTemplateDef): string {
	const names = t().templates as Record<string, string>;
	return names[template.id] ?? template.name;
}

/** The template's one-line description for the picker, or "" if a locale has
 * none (the picker then simply shows the name on its own). */
export function templateDescription(template: CardTemplateDef): string {
	const descriptions = t().templateDescriptions as Record<string, string>;
	return descriptions[template.id] ?? "";
}

/** The template's unmet dependency, or null when it has none or it is
 * satisfied. Never throws: every `satisfied` probe reads Obsidian internals,
 * and this runs while the picker is being built. */
export function unmetRequirement(
	app: App,
	template: CardTemplateDef,
): CardRequirement | null {
	const requirement = template.requires;
	if (!requirement) return null;
	try {
		return requirement.satisfied(app) ? null : requirement;
	} catch {
		return requirement;
	}
}

/** Build a fresh card from a template (id and placeholder coordinates assigned;
 * position is resolved on placement). */
export function cardFromTemplate(template: CardTemplateDef): DashboardCard {
	return {
		id: `card-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
		x: -1,
		y: -1,
		...template.build(),
	};
}

/** The extra root classes a card's kind puts on it, resolved against the card
 * itself (a kind may vary them by config — see `CardDefinition.cardClass`).
 * Split so a definition can name several; `addClass` rejects a single string
 * holding spaces. */
export function cardClasses(card: DashboardCard): string[] {
	const cls = cardDefinition(card).cardClass;
	const raw = typeof cls === "function" ? cls(card) : cls;
	return raw ? raw.split(/\s+/).filter(Boolean) : [];
}

/** Deep-clone a card with a fresh id, so the copy can be added to a dashboard
 * (or a different one) without colliding with — or sharing nested config with —
 * the original. The kind-specific deep-clone lives on each card definition. */
export function cloneCard(card: DashboardCard): DashboardCard {
	const copy: DashboardCard = {
		...card,
		id: `card-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
	};
	// Run every kind's cloneConfig, not just the current kind's: switching a
	// card's type keeps the previous kind's config on the card (see the editor's
	// type dropdown), so a card can legitimately carry several kinds' nested
	// config. Each cloneConfig is guarded by the presence of its own field, so
	// this only deep-clones what is actually there.
	for (const def of Object.values(CARD_DEFINITIONS)) def.cloneConfig?.(card, copy);
	return copy;
}
