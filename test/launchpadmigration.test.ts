import { describe, expect, it } from "vitest";
import { applyLayout, importSettings, sanitizeCard } from "../src/layout";
import { commandsCardAsLaunchpad, foldCommandsCards } from "../src/launchpadmigration";
import { applyPackage } from "../src/portable";
import { DEFAULT_SETTINGS, type HomeSettings, hydrateSettings, migrateSettings } from "../src/types";

/**
 * The retired Commands card, folded into Links / launchpad (#388).
 *
 * The fold runs on data that only exists in users' vaults, one way, so what
 * these pin is that nothing is lost on the way: the card's own fields, every
 * button's size and position in both sizing styles, fields this build does not
 * know, and buttons whose command is not (yet) registered. Every door into
 * settings is covered: load (`migrateSettings` / `hydrateSettings`), a single
 * card (`sanitizeCard`), a layout or backup import (`applyLayout` /
 * `importSettings`) and a shared board (`applyPackage`).
 */

/** A Commands card as 3.3 persisted it, with every field it could carry. */
function legacyCard(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "card-cmd",
		kind: "commands",
		title: "Plugin actions",
		x: 2,
		y: 1,
		w: 6,
		h: 2,
		fx: 0.25,
		fy: 0.1,
		fw: 0.5,
		fh: 0.2,
		tileSizing: "fixed",
		tileSize: 120,
		tileCols: 5,
		tileMinSize: 70,
		tileAutoFlow: true,
		mobile: { order: 3, collapsed: true },
		commands: [
			{
				id: "some-plugin:do-first-thing",
				name: "Some Long Plugin Name: Do first thing",
				icon: "zap",
				sizeW: 180,
				sizeH: 90,
				spanW: 1.5,
				spanH: 1,
				col: 1,
				row: 2,
				scaleCol: 2.5,
				scaleRow: 1,
			},
			// No icon, as most picked commands have none.
			{ id: "some-plugin:do-second-thing", name: "Some Long Plugin Name: Do second thing", size: 100 },
			// A vault image as the icon.
			{ id: "app:reload", name: "Reload", icon: "Assets/reload.png", futureField: { kept: true } },
		],
		...extra,
	};
}

/** What `data.json` hands back: the value as written to disk and read again. */
function roundTrip(value: unknown): Record<string, unknown> {
	return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function vault(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [{ id: "board-1", name: "Home", cards: [] }];
	s.activeDashboardId = "board-1";
	return s;
}

describe("commandsCardAsLaunchpad", () => {
	it("turns the card into a launchpad and keeps every card-level field", () => {
		const raw = legacyCard();
		const out = commandsCardAsLaunchpad(raw);
		const { commands: _commands, kind: _kind, ...cardFields } = raw;
		const { links: _links, kind, ...outFields } = out;

		expect(kind).toBe("links");
		expect("commands" in out).toBe(false);
		expect(outFields).toEqual(cardFields);
	});

	it("makes each button a command link, with its label, icon and geometry", () => {
		const links = commandsCardAsLaunchpad(legacyCard()).links as Record<string, unknown>[];

		expect(links).toEqual([
			{
				id: "command-1",
				label: "Some Long Plugin Name: Do first thing",
				icon: "zap",
				target: "some-plugin:do-first-thing",
				type: "command",
				sizeW: 180,
				sizeH: 90,
				spanW: 1.5,
				spanH: 1,
				col: 1,
				row: 2,
				scaleCol: 2.5,
				scaleRow: 1,
			},
			{
				id: "command-2",
				label: "Some Long Plugin Name: Do second thing",
				icon: "",
				target: "some-plugin:do-second-thing",
				type: "command",
				size: 100,
			},
			{
				id: "command-3",
				label: "Reload",
				icon: "Assets/reload.png",
				target: "app:reload",
				type: "command",
				futureField: { kept: true },
			},
		]);
	});

	it("leaves its input untouched", () => {
		const raw = legacyCard();
		const before = structuredClone(raw);
		commandsCardAsLaunchpad(raw);
		expect(raw).toEqual(before);
	});

	it("keeps a button whose command or name is missing rather than dropping it", () => {
		const out = commandsCardAsLaunchpad(legacyCard({ commands: [{ name: "Orphan" }, { id: "x:y" }] }));
		expect(out.links).toEqual([
			{ id: "command-1", label: "Orphan", icon: "", target: "", type: "command" },
			{ id: "command-2", label: "", icon: "", target: "x:y", type: "command" },
		]);
	});

	it("keeps a links list left behind by a type switch, after the commands", () => {
		const left = { id: "command-1", label: "Old", icon: "link", target: "Notes/A.md", type: "note" };
		const out = commandsCardAsLaunchpad(legacyCard({ commands: [{ id: "a:b", name: "AB" }], links: [left] }));
		const links = out.links as Record<string, unknown>[];

		expect(links.map((l) => l.label)).toEqual(["AB", "Old"]);
		expect(links[1]).toEqual(left);
		// The ids still tell the two apart, which drag and resize rely on.
		expect(new Set(links.map((l) => l.id)).size).toBe(2);
	});

	it("gives a card with no buttons an empty launchpad", () => {
		expect(commandsCardAsLaunchpad(legacyCard({ commands: undefined })).links).toEqual([]);
	});

	it("passes any other card through as is", () => {
		const other = { id: "l", kind: "links", links: [] };
		expect(commandsCardAsLaunchpad(other)).toBe(other);
	});

	it("is deterministic, so two synced devices fold a card to the same thing", () => {
		expect(commandsCardAsLaunchpad(legacyCard())).toEqual(commandsCardAsLaunchpad(legacyCard()));
	});

	it("folds a list in place and says whether it did", () => {
		const cards: unknown[] = [{ id: "c", kind: "clock" }, legacyCard()];
		expect(foldCommandsCards(cards)).toBe(true);
		expect((cards[1] as Record<string, unknown>).kind).toBe("links");
		expect(foldCommandsCards(cards)).toBe(false);
		expect(foldCommandsCards(undefined)).toBe(false);
	});
});

describe("Commands card → launchpad, on load", () => {
	it("folds every board's cards and the pinned cards, and asks for a flush", () => {
		const raw = {
			dashboards: [
				{ id: "b1", name: "One", cards: [legacyCard(), { id: "c", kind: "clock", x: 0, y: 0, w: 4, h: 2 }] },
				{ id: "b2", name: "Two", cards: [legacyCard({ id: "card-2" })] },
			],
			activeDashboardId: "b1",
			pinnedCards: [legacyCard({ id: "pinned", pinned: true })],
		};
		const { settings, migrated } = hydrateSettings(roundTrip(raw));

		expect(migrated).toBe(true);
		const [one, two] = settings.dashboards;
		expect(one.cards.map((c) => c.kind)).toEqual(["links", "clock"]);
		expect(two.cards[0].kind).toBe("links");
		expect(settings.pinnedCards[0].kind).toBe("links");
		expect(settings.pinnedCards[0].pinned).toBe(true);
		// The whole card, field for field, is what the pure fold produces.
		expect(one.cards[0]).toEqual(commandsCardAsLaunchpad(legacyCard()));
	});

	it("converges: a second load has nothing to fold and no flush to ask for", () => {
		const raw = { dashboards: [{ id: "b1", name: "One", cards: [legacyCard()] }], activeDashboardId: "b1" };
		const first = hydrateSettings(roundTrip(raw));
		const second = hydrateSettings(roundTrip(first.settings));

		expect(second.migrated).toBe(false);
		expect(second.settings.dashboards).toEqual(first.settings.dashboards);
	});

	it("folds a legacy single-board `cards` array once it is wrapped into a board", () => {
		const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
		(s as unknown as Record<string, unknown>).dashboards = [];
		const flush = migrateSettings(s, { cards: [legacyCard()] });

		expect(flush).toBe(true);
		expect(s.dashboards[0].cards[0].kind).toBe("links");
		expect(s.dashboards[0].cards[0].links).toHaveLength(3);
	});
});

describe("Commands card → launchpad, on import", () => {
	it("sanitizes a Commands card into a launchpad with its buttons intact", () => {
		const card = sanitizeCard(legacyCard(), 0)!;

		expect(card.kind).toBe("links");
		expect(card.id).toBe("card-cmd");
		expect(card.title).toBe("Plugin actions");
		expect(card.tileSizing).toBe("fixed");
		expect(card.tileSize).toBe(120);
		expect(card.tileAutoFlow).toBe(true);
		expect(card.mobile).toEqual({ order: 3, collapsed: true });
		expect(card.links).toEqual([
			{
				id: "command-1",
				label: "Some Long Plugin Name: Do first thing",
				icon: "zap",
				target: "some-plugin:do-first-thing",
				type: "command",
				sizeW: 180,
				sizeH: 90,
				spanW: 1.5,
				spanH: 1,
				col: 1,
				row: 2,
				scaleCol: 2.5,
				scaleRow: 1,
			},
			{
				id: "command-2",
				label: "Some Long Plugin Name: Do second thing",
				// Empty stays empty, so the button still draws the command icon.
				icon: "",
				target: "some-plugin:do-second-thing",
				type: "command",
				size: 100,
			},
			{ id: "command-3", label: "Reload", icon: "Assets/reload.png", target: "app:reload", type: "command" },
		]);
	});

	it("folds the Commands cards of an imported layout, pinned ones included", () => {
		const s = vault();
		const err = applyLayout(s, {
			dashboards: [{ id: "b1", name: "Imported", cards: [legacyCard()] }],
			pinnedCards: [legacyCard({ id: "pinned" })],
		});

		expect(err).toBeNull();
		expect(s.dashboards[0].cards[0].kind).toBe("links");
		expect(s.dashboards[0].cards[0].links).toHaveLength(3);
		expect(s.pinnedCards[0].kind).toBe("links");
	});

	it("folds a pre-3.4 settings backup", () => {
		const s = vault();
		const err = importSettings(
			s,
			JSON.stringify({ hearthSettings: 1, dashboards: [{ id: "b1", name: "Backup", cards: [legacyCard()] }] }),
		);

		expect(err).toBeNull();
		expect(s.dashboards[0].cards[0].kind).toBe("links");
	});

	it("lands an old shared board's Commands card as a launchpad, without a warning", () => {
		const s = vault();
		const result = applyPackage(
			s,
			{
				hearth: { format: 3, kind: "dashboard" as const },
				requires: { cardKinds: ["commands"] },
				payload: { dashboard: { id: "b", name: "Shared", cards: [legacyCard()] } },
			},
			{ mode: "add" },
		);

		expect(result.ok).toBe(true);
		expect(result.warnings.filter((w) => w.code === "unknownCardKind")).toEqual([]);
		const card = s.dashboards[1].cards[0];
		expect(card.kind).toBe("links");
		expect(card.links?.map((l) => l.target)).toEqual([
			"some-plugin:do-first-thing",
			"some-plugin:do-second-thing",
			"app:reload",
		]);
	});
});
