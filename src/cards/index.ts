import type { CardKind, DashboardCard } from "../types";
import type { CardDefinition, CardTemplateDef } from "./definition";
import { t } from "../i18n";

import { embedCard } from "./embed";
import { dailyCard } from "./daily";
import { webCard } from "./web";
import { bookmarksCard } from "./bookmarks";
import { favoritesCard } from "./favorites";
import { textCard } from "./text";
import { recentCard } from "./recent";
import { linksCard } from "./links";
import { commandsCard } from "./commands";
import { clockCard } from "./clock";
import { tasksCard } from "./tasks";
import { calendarCard } from "./calendar";
import { statsCard } from "./stats";
import { searchCard } from "./search";
import { heatmapCard } from "./heatmap";
import { calculatorCard } from "./calculator";
import { dataviewCard } from "./dataview";
import { rssCard } from "./rss";
import { jiraCard } from "./jira";
import { leafCard } from "./leaf";

export type {
	CardDefinition,
	CardTemplateDef,
	CardEditorContext,
	CardLiveness,
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
	daily: dailyCard,
	web: webCard,
	bookmarks: bookmarksCard,
	favorites: favoritesCard,
	text: textCard,
	recent: recentCard,
	links: linksCard,
	commands: commandsCard,
	clock: clockCard,
	tasks: tasksCard,
	calendar: calendarCard,
	stats: statsCard,
	search: searchCard,
	heatmap: heatmapCard,
	calculator: calculatorCard,
	dataview: dataviewCard,
	rss: rssCard,
	jira: jiraCard,
	leaf: leafCard,
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
 * The order the "Add card" picker offers templates in. Kept explicit because it
 * does not match `CardKind` order (e.g. `text` sits late in the menu) and
 * several templates can map to one kind (embed offers five). The unit test in
 * test/cards-registry.test.ts asserts this covers every registered template id
 * exactly once.
 */
export const TEMPLATE_MENU_ORDER: string[] = [
	"note",
	"image",
	"base",
	"excalidraw",
	"canvas",
	"daily",
	"web",
	"bookmarks",
	"favorites",
	"recent",
	"links",
	"commands",
	"clock",
	"tasks",
	"calendar",
	"stats",
	"search",
	"heatmap",
	"text",
	"calculator",
	"dataview",
	"rss",
	"jira",
	"leaf",
];

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
