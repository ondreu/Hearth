import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
	type Dashboard,
	type DashboardCard,
	DEFAULT_SETTINGS,
	effectiveArrangeButtonVisibility,
	effectiveBackground,
	effectiveCardBlur,
	effectiveCardBorderWidth,
	effectiveCardOpacity,
	effectiveCardRadius,
	effectiveColumns,
	effectiveCompact,
	effectiveFitToPage,
	effectiveFullWidth,
	effectiveHeaderAlign,
	effectiveHeaderLogoScale,
	effectiveHeaderTitleScale,
	effectiveHiddenFilters,
	effectiveMaxWidth,
	effectiveNewNoteButtonLabel,
	effectiveNewNoteButtonMode,
	effectiveRowHeight,
	effectiveSearchPlaceholder,
	effectiveShowNewNoteButton,
	effectiveShowSearch,
	effectiveShowTitle,
	effectiveSkyAnimate,
	effectiveStackOnNarrow,
	effectiveSwitcherVisibility,
	effectiveThemeColorTarget,
	effectiveTitle,
	effectiveTitleIcon,
	type HomeSettings,
} from "../src/types";
import { exportSettingsPayload } from "../src/layout";
import { cloneDashboard } from "../src/dashboards";
import {
	applyPackage,
	type AssetStore,
	captureDashboard,
	captureLayout,
	captureSettings,
	describeReferences,
	embedAssets,
	existingBoardFor,
	materializeAssets,
	MAX_ASSET_BYTES,
	PACKAGE_FORMAT,
	readPackage,
	residualPaths,
	serializePackage,
	stripReferences,
	validatePackage,
} from "../src/portable";

/**
 * The portable-package engine.
 *
 * The test that matters most is the round trip: take a board out of one vault,
 * put it into a vault configured as differently as the settings allow, and ask
 * every `effective*()` reader what the board looks like. If the two answers
 * match, the board travelled; if they don't, it arrived wearing the importer's
 * clothes. Everything else here — the tier trap, the strip, the assets, the
 * legacy readers — protects one specific way that can go wrong.
 */

/** A card with the geometry every card carries, so the fixtures below can say
 * only what the test is about. */
function card(card: Partial<DashboardCard> & { id: string; kind: DashboardCard["kind"] }): DashboardCard {
	return { x: 0, y: 0, w: 4, h: 3, ...card };
}

function vault(): HomeSettings {
	const s: HomeSettings = structuredClone(DEFAULT_SETTINGS);
	s.dashboards = [{ id: "board-1", name: "Home", cards: [] }];
	s.activeDashboardId = "board-1";
	return s;
}

/** A vault whose every look-affecting global is set to something distinctive,
 * so a value that fails to travel shows up as the *other* vault's value rather
 * than as a coincidence. */
function opinionatedVault(): HomeSettings {
	const s = vault();
	s.gridColumns = 9;
	s.rowHeight = 120;
	s.fitToPage = false;
	s.maxWidth = 2200;
	s.fullWidth = false;
	s.compact = true;
	s.cardOpacity = 0.8;
	s.cardBlur = 12;
	s.cardRadius = 4;
	s.cardBorderWidth = 3;
	s.showSearch = false;
	s.searchPlaceholder = "Find in the archive";
	s.showNewNoteButton = true;
	s.newNoteButtonMode = "searchOnline";
	s.newNoteButtonLabel = "Look it up";
	s.hiddenFilters = ["images", "audio"];
	s.stackOnNarrow = false;
	s.arrangeButtonVisibility = "hover";
	s.dashboardSwitcherVisibility = "hover";
	s.title = "The archive";
	s.showTitle = true;
	s.titleIcon = "library";
	s.themeColorTarget = "both";
	s.backgroundKind = "image";
	s.backgroundValue = "Attachments/wall.png";
	s.backgroundOpacity = 0.6;
	s.backgroundBlur = 8;
	s.backgroundLayout = "banner";
	s.bannerHeight = 260;
	s.bannerFade = false;
	s.bannerFullWidth = true;
	s.backgroundSkyAnimate = false;
	return s;
}

/** The opposite of {@link opinionatedVault} on every field, so nothing can
 * match by accident. */
function contraryVault(): HomeSettings {
	const s = vault();
	s.dashboards = [{ id: "their-board", name: "Their board", cards: [] }];
	s.activeDashboardId = "their-board";
	s.gridColumns = 16;
	s.rowHeight = 40;
	s.fitToPage = true;
	s.maxWidth = 800;
	s.fullWidth = true;
	s.compact = false;
	s.cardOpacity = 0.1;
	s.cardBlur = 0;
	s.cardRadius = 14;
	s.cardBorderWidth = 0;
	s.showSearch = true;
	s.searchPlaceholder = "Search everything";
	s.showNewNoteButton = false;
	s.newNoteButtonMode = "newNote";
	s.newNoteButtonLabel = "";
	s.hiddenFilters = [];
	s.stackOnNarrow = true;
	s.arrangeButtonVisibility = "always";
	s.dashboardSwitcherVisibility = "always";
	s.title = "Someone else's vault";
	s.showTitle = false;
	s.titleIcon = "";
	s.themeColorTarget = "none";
	s.backgroundKind = "color";
	s.backgroundValue = "#101010";
	s.backgroundOpacity = 1;
	s.backgroundBlur = 0;
	s.backgroundLayout = "full";
	s.bannerHeight = 120;
	s.bannerFade = true;
	s.bannerFullWidth = false;
	s.backgroundSkyAnimate = undefined;
	return s;
}

/** Everything that decides how the active board is drawn, as one object. The
 * whole engine exists to make two of these equal across vaults. */
function look(s: HomeSettings): Record<string, unknown> {
	return {
		columns: effectiveColumns(s),
		rowHeight: effectiveRowHeight(s),
		fitToPage: effectiveFitToPage(s),
		maxWidth: effectiveMaxWidth(s),
		fullWidth: effectiveFullWidth(s),
		compact: effectiveCompact(s),
		cardOpacity: effectiveCardOpacity(s),
		cardBlur: effectiveCardBlur(s),
		cardRadius: effectiveCardRadius(s),
		cardBorderWidth: effectiveCardBorderWidth(s),
		showSearch: effectiveShowSearch(s),
		searchPlaceholder: effectiveSearchPlaceholder(s),
		showNewNoteButton: effectiveShowNewNoteButton(s),
		newNoteButtonMode: effectiveNewNoteButtonMode(s),
		newNoteButtonLabel: effectiveNewNoteButtonLabel(s),
		hiddenFilters: effectiveHiddenFilters(s),
		stackOnNarrow: effectiveStackOnNarrow(s),
		arrange: effectiveArrangeButtonVisibility(s),
		switcher: effectiveSwitcherVisibility(s),
		showTitle: effectiveShowTitle(s),
		title: effectiveTitle(s),
		titleIcon: effectiveTitleIcon(s),
		themeColorTarget: effectiveThemeColorTarget(s),
		headerAlign: effectiveHeaderAlign(s),
		titleScale: effectiveHeaderTitleScale(s),
		logoScale: effectiveHeaderLogoScale(s),
		skyAnimate: effectiveSkyAnimate(s),
		background: effectiveBackground(s),
	};
}

/** Export the active board of `from` and import it into `into`, returning the
 * import result. Goes through the serialized form, so anything that survives
 * only in memory fails here. */
function moveBoard(
	from: HomeSettings,
	into: HomeSettings,
	board = from.dashboards[0],
): ReturnType<typeof applyPackage> {
	const json = serializePackage(captureDashboard(from, board));
	const outcome = readPackage(json);
	expect(outcome.pkg).toBeDefined();
	return applyPackage(into, outcome.pkg!, { mode: "add" });
}

describe("a dashboard package carries the board's whole look", () => {
	it("draws the same in a vault whose every global differs", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		const before = look(mine);

		const result = moveBoard(mine, theirs);

		expect(result.ok).toBe(true);
		expect(result.added).toHaveLength(1);
		expect(theirs.activeDashboardId).toBe(result.added[0].id);
		expect(look(theirs)).toEqual(before);
	});

	it("leaves the importing vault's own settings completely alone", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		const globals = { ...theirs, dashboards: undefined, activeDashboardId: undefined };

		moveBoard(mine, theirs);

		expect({ ...theirs, dashboards: undefined, activeDashboardId: undefined }).toEqual(
			globals,
		);
	});

	it("leaves the importing vault's other boards looking as they did", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		theirs.activeDashboardId = "their-board";
		const theirLook = look(theirs);

		moveBoard(mine, theirs);
		theirs.activeDashboardId = "their-board";

		expect(look(theirs)).toEqual(theirLook);
	});

	it("keeps a board's own overrides rather than the vault's values", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].gridColumns = 6;
		mine.dashboards[0].cardOpacity = 0.25;
		mine.dashboards[0].header = { title: "Just this board" };
		const before = look(mine);

		const theirs = contraryVault();
		moveBoard(mine, theirs);

		expect(look(theirs)).toEqual(before);
		expect(effectiveColumns(theirs)).toBe(6);
		expect(effectiveTitle(theirs)).toBe("Just this board");
	});

	it("carries a plugin board's implicit defaults, not the cards-board ones", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].mode = "plugin";
		mine.dashboards[0].pluginView = { viewType: "kanban" };
		// A plugin board hides the title and search and fills the pane *unless
		// told otherwise*, so those three answers come from the board's mode
		// rather than from any stored value — exactly the case a hand-written
		// flattener would get wrong.
		const before = look(mine);
		expect(before.showTitle).toBe(false);
		expect(before.showSearch).toBe(false);
		expect(before.fullWidth).toBe(true);

		const theirs = contraryVault();
		moveBoard(mine, theirs);

		expect(look(theirs)).toEqual(before);
	});

	it("survives a round trip back into a third vault unchanged", () => {
		const mine = opinionatedVault();
		const before = look(mine);
		const second = contraryVault();
		moveBoard(mine, second);
		const third = vault();

		// Re-export the board that has just been imported: flattening an already
		// flattened board must be a no-op.
		moveBoard(second, third, second.dashboards[second.dashboards.length - 1]);

		expect(look(third)).toEqual(before);
	});
});

describe("the performance tier never gets baked into a package", () => {
	it("captures the configured look, not the look a frugal device shows", () => {
		const mine = opinionatedVault();
		mine.cardBlur = 18;
		mine.performanceTier = "minimal";
		// On this tier the readers report a flat backdrop and no frost — the point
		// of the tier. What must not happen is that becoming the file's contents.
		expect(effectiveCardBlur(mine)).toBe(0);
		expect(effectiveBackground(mine).kind).not.toBe("image");

		const pkg = captureDashboard(mine, mine.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		expect(board.cardBlur).toBe(18);
		expect(board.background?.kind).toBe("image");
		expect(board.background?.value).toBe("Attachments/wall.png");
	});

	it("records the tier it was taken on without ever applying it", () => {
		const mine = opinionatedVault();
		mine.performanceTier = "reduced";
		const theirs = contraryVault();
		theirs.performanceTier = "full";

		const pkg = captureDashboard(mine, mine.dashboards[0]);
		expect(pkg.capture?.performanceTier).toBe("reduced");

		applyPackage(theirs, pkg, { mode: "add" });
		expect(theirs.performanceTier).toBe("full");
	});

	it("shows the importing device's own tier over the imported board", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		moveBoard(mine, theirs);
		theirs.performanceTier = "minimal";

		// The board asked for frost and a wallpaper; the device declines both,
		// and can do so because the tier is still an override at read time.
		expect(effectiveCardBlur(theirs)).toBe(0);
		expect(effectiveBackground(theirs).kind).not.toBe("image");
	});
});

describe("importing a board into a vault", () => {
	it("adds a board rather than replacing anything", () => {
		const theirs = contraryVault();
		moveBoard(opinionatedVault(), theirs);
		expect(theirs.dashboards).toHaveLength(2);
		expect(theirs.dashboards[0].id).toBe("their-board");
	});

	it("gives the same package a fresh id and a free name each time", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();

		moveBoard(mine, theirs);
		moveBoard(mine, theirs);

		expect(theirs.dashboards).toHaveLength(3);
		const names = theirs.dashboards.map((d) => d.name);
		expect(names).toEqual(["Their board", "Home", "Home 2"]);
		const ids = new Set(theirs.dashboards.map((d) => d.id));
		expect(ids.size).toBe(3);
	});

	/**
	 * "I downloaded this board last month and there's a new version."
	 *
	 * The identity that answers it is `meta.id` — the dashboard as a *published
	 * work* — recorded on the board it creates. Not the board's own id, which
	 * only ever meant "which board is this in this vault".
	 */
	it("finds the board a previous import of the same dashboard created", () => {
		const mine = opinionatedVault();
		// What exporting does: the board becomes a shared work and keeps the
		// identity, so the author's next export of it agrees with this one.
		mine.dashboards[0].sourceId = "hd-reading-room";
		const theirs = contraryVault();

		const first = captureDashboard(mine, mine.dashboards[0]);
		expect(first.meta?.id).toBe("hd-reading-room");
		expect(existingBoardFor(theirs, first)).toBeUndefined();
		applyPackage(theirs, first, { mode: "add" });

		// A later version of the same dashboard finds what the first one made.
		mine.dashboards[0].cards = [card({ id: "new", kind: "clock" })];
		const second = captureDashboard(mine, mine.dashboards[0]);
		const found = existingBoardFor(theirs, second);
		expect(found?.name).toBe("Home");

		applyPackage(theirs, second, { mode: "replaceBoard", targetBoardId: found!.id });
		expect(theirs.dashboards).toHaveLength(2);
		expect(theirs.dashboards[1].cards).toHaveLength(1);
	});

	/**
	 * The case that made board-id matching the wrong mechanism, and the reason
	 * this is worth a field of its own. In a gallery, someone downloading a
	 * board, changing it and republishing is normal — and their board still
	 * carries the original's board id. Matching on that would have offered
	 * their variant as an update to the original.
	 */
	it("treats a differently-identified dashboard as new, board id or not", () => {
		const author = opinionatedVault();
		author.dashboards[0].sourceId = "hd-original";
		const reader = contraryVault();
		applyPackage(reader, captureDashboard(author, author.dashboards[0]), {
			mode: "add",
		});

		// A fork: same board, republished under its own identity.
		const forker = opinionatedVault();
		forker.dashboards[0].id = author.dashboards[0].id;
		forker.dashboards[0].sourceId = "hd-a-variant";
		const fork = captureDashboard(forker, forker.dashboards[0]);

		expect(existingBoardFor(reader, fork)).toBeUndefined();
		applyPackage(reader, fork, { mode: "add" });
		expect(reader.dashboards).toHaveLength(3);
	});

	it("reads a dashboard that claims no identity as new every time", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		const pkg = captureDashboard(mine, mine.dashboards[0]);

		expect(pkg.meta?.id).toBeUndefined();
		applyPackage(theirs, pkg, { mode: "add" });
		expect(existingBoardFor(theirs, pkg)).toBeUndefined();
		expect(theirs.dashboards[1].sourceId).toBeUndefined();
	});

	it("refuses an identity that isn't the shape an export writes", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].sourceId = "hd-fine";
		const theirs = contraryVault();
		const pkg = captureDashboard(mine, mine.dashboards[0]);
		pkg.meta!.id = "../../../etc/passwd";

		applyPackage(theirs, pkg, { mode: "add" });
		expect(theirs.dashboards[1].sourceId).toBeUndefined();
	});

	it("never lets a package pick which of the importer's boards it collides with", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		// A package naming a board id the importer already uses.
		mine.dashboards[0].id = "their-board";
		applyPackage(theirs, captureDashboard(mine, mine.dashboards[0]), { mode: "add" });

		expect(theirs.dashboards).toHaveLength(2);
		expect(theirs.dashboards[0].id).toBe("their-board");
		expect(theirs.dashboards[1].id).not.toBe("their-board");
	});

	it("does not pass a duplicated board off as the dashboard it was copied from", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].sourceId = "hd-original";
		const copy = cloneDashboard(mine.dashboards[0], "Home copy");
		expect(copy.sourceId).toBeUndefined();
	});

	it("keeps the target board's id when replacing one in place", () => {
		const mine = opinionatedVault();
		const theirs = contraryVault();
		theirs.dashboards[0].linkedWorkspace = "Writing";
		const pkg = captureDashboard(mine, mine.dashboards[0]);

		const result = applyPackage(theirs, pkg, {
			mode: "replaceBoard",
			targetBoardId: "their-board",
		});

		expect(result.replaced).toEqual([{ id: "their-board", name: "Home" }]);
		expect(theirs.dashboards).toHaveLength(1);
		// The id and the things keyed by it survive, so a workspace link and the
		// hosted-view cache aren't orphaned by an update.
		expect(theirs.dashboards[0].id).toBe("their-board");
		expect(theirs.dashboards[0].linkedWorkspace).toBe("Writing");
	});

	it("never lets an imported board claim the mobile default or a workspace", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].mobileDefault = true;
		mine.dashboards[0].linkedWorkspace = "Mine";
		const theirs = contraryVault();
		theirs.dashboards[0].mobileDefault = true;

		moveBoard(mine, theirs);

		const imported = theirs.dashboards[1];
		expect(imported.mobileDefault).toBeUndefined();
		expect(imported.linkedWorkspace).toBeUndefined();
		expect(theirs.dashboards[0].mobileDefault).toBe(true);
	});

	it("carries pinned cards and favourites but applies neither unasked", () => {
		const mine = opinionatedVault();
		mine.pinnedCards = [card({ id: "p1", kind: "clock" })];
		mine.favorites = ["Notes/Pinned.md"];
		const theirs = contraryVault();
		theirs.favorites = ["Theirs.md"];

		const pkg = captureDashboard(mine, mine.dashboards[0], {
			includePinnedCards: true,
			includeFavorites: true,
		});
		const result = applyPackage(theirs, pkg, { mode: "add" });

		expect(theirs.pinnedCards).toHaveLength(0);
		expect(theirs.favorites).toEqual(["Theirs.md"]);
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				{ code: "notApplied", detail: "pinnedCards:1" },
				{ code: "notApplied", detail: "favorites:1" },
			]),
		);
	});

	it("appends favourites without losing the vault's own when asked to", () => {
		const mine = opinionatedVault();
		mine.favorites = ["Shared.md", "Theirs.md"];
		const theirs = contraryVault();
		theirs.favorites = ["Theirs.md"];

		const pkg = captureDashboard(mine, mine.dashboards[0], { includeFavorites: true });
		applyPackage(theirs, pkg, { mode: "add", applyFavorites: true });

		expect(theirs.favorites).toEqual(["Theirs.md", "Shared.md"]);
	});

	it("reports missing notes, plugins and view types instead of hiding them", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].cards = [
			card({ id: "c1", kind: "embed", target: "Notes/Missing.md" }),
			card({ id: "c2", kind: "dataview", dataview: { query: "TABLE file.name" } }),
			card({ id: "c3", kind: "leaf", leafView: { viewType: "kanban" } }),
		];
		const theirs = contraryVault();

		const pkg = captureDashboard(mine, mine.dashboards[0]);
		const result = applyPackage(theirs, pkg, {
			mode: "add",
			env: {
				pathExists: () => false,
				pluginEnabled: () => false,
				viewTypeKnown: () => false,
			},
		});

		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				{ code: "missingPath", detail: "Notes/Missing.md" },
				{ code: "missingPlugin", detail: "dataview" },
				{ code: "unknownViewType", detail: "kanban" },
			]),
		);
		// Reported, not removed: the board is still the board its author made.
		expect(theirs.dashboards[1].cards).toHaveLength(3);
	});
});

describe("what a package refuses to carry", () => {
	it("scrubs the Jira token", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].cards = [
			card({
				id: "c1",
				kind: "jira",
				jira: { host: "https://jira.internal", pat: "super-secret-token" },
			}),
		];

		const json = serializePackage(captureDashboard(mine, mine.dashboards[0]));

		expect(json).not.toContain("super-secret-token");
		// And the live settings still have it — a capture must never scrub the
		// vault it is reading.
		expect(mine.dashboards[0].cards[0].jira?.pat).toBe("super-secret-token");
	});

	it("omits the bookkeeping a shared backup shouldn't rewind", () => {
		const mine = opinionatedVault();
		mine.lastSeenVersion = "3.0.0";
		mine.setupStatus = "done";
		const payload = exportSettingsPayload(mine);
		expect(payload.lastSeenVersion).toBeUndefined();
		expect(payload.setupStatus).toBeUndefined();
	});
});

describe("the full settings backup carries every setting", () => {
	/**
	 * The guard that found eleven settings the old export silently dropped —
	 * among them the theme-colour target, the mobile performance tier and both
	 * chrome-visibility choices. A backup that forgets a setting is not a backup,
	 * and the only way to keep that true as settings are added is to check the
	 * two lists against each other.
	 */
	it("writes every HomeSettings key except the two deliberate omissions", () => {
		const payload = exportSettingsPayload(opinionatedVault());
		const omitted = ["lastSeenVersion", "setupStatus"];
		const missing = Object.keys(DEFAULT_SETTINGS).filter(
			(key) => !omitted.includes(key) && !(key in payload),
		);
		expect(missing).toEqual([]);
	});

	it("restores every one of them into a vault set up differently", () => {
		const mine = opinionatedVault();
		mine.themeColorTarget = "icon";
		mine.mobilePerformanceTier = "minimal";
		mine.arrangeButtonVisibility = "hover";
		mine.dashboardSwitcherVisibility = "hover";
		mine.customFileIcons = false;
		mine.iconizeIconProperty = "sticker";
		mine.liveRefresh = true;
		mine.liveSettingsSync = false;
		mine.focusSearchOnOpen = true;
		mine.stackOnNarrow = false;
		mine.operonWrites = true;

		const pkg = captureSettings(mine);
		const theirs = contraryVault();
		const result = applyPackage(theirs, pkg, { mode: "replaceAll" });

		expect(result.ok).toBe(true);
		expect(theirs.themeColorTarget).toBe("icon");
		expect(theirs.mobilePerformanceTier).toBe("minimal");
		expect(theirs.arrangeButtonVisibility).toBe("hover");
		expect(theirs.dashboardSwitcherVisibility).toBe("hover");
		expect(theirs.customFileIcons).toBe(false);
		expect(theirs.iconizeIconProperty).toBe("sticker");
		expect(theirs.liveRefresh).toBe(true);
		expect(theirs.liveSettingsSync).toBe(false);
		expect(theirs.focusSearchOnOpen).toBe(true);
		expect(theirs.stackOnNarrow).toBe(false);
		expect(theirs.operonWrites).toBe(true);
	});

	it("restores a painted-sky background, which the old importer dropped", () => {
		const mine = opinionatedVault();
		mine.backgroundKind = "weather";
		mine.backgroundValue = "auto|Prague|50.08|14.44";

		const theirs = contraryVault();
		applyPackage(theirs, captureSettings(mine), { mode: "replaceAll" });

		expect(theirs.backgroundKind).toBe("weather");
		expect(theirs.backgroundValue).toBe("auto|Prague|50.08|14.44");
	});

	it("does not flatten the boards inside it — they keep inheriting", () => {
		const mine = opinionatedVault();
		const pkg = captureSettings(mine);
		const boards = (pkg.payload as { dashboards: Dashboard[] }).dashboards;
		// The globals travel alongside, so a board that overrode nothing must
		// still override nothing: that is what makes a restore exact.
		expect(boards[0].gridColumns).toBeUndefined();
		expect(boards[0].background).toBeUndefined();
	});
});

describe("reading every export Hearth has ever written", () => {
	it("reads a v3 envelope", () => {
		const pkg = captureLayout(opinionatedVault());
		const outcome = readPackage(serializePackage(pkg));
		expect(outcome.pkg?.hearth.kind).toBe("layout");
		expect(outcome.pkg?.hearth.format).toBe(PACKAGE_FORMAT);
		expect(outcome.newerFormat).toBe(false);
	});

	it("reads a v2 layout export", () => {
		const legacy = {
			hearthLayout: 2,
			dashboards: [{ id: "d1", name: "Legacy", cards: [], gridColumns: 7 }],
			activeDashboardId: "d1",
			pinnedCards: [],
			gridColumns: 10,
			rowHeight: 88,
			fitToPage: false,
			maxWidth: 1400,
			fullWidth: false,
			favorites: [],
		};
		const outcome = readPackage(JSON.stringify(legacy));
		expect(outcome.pkg?.hearth.kind).toBe("layout");

		const s = vault();
		const result = applyPackage(s, outcome.pkg!, { mode: "replaceAll" });
		expect(result.ok).toBe(true);
		expect(s.dashboards[0].name).toBe("Legacy");
		expect(effectiveColumns(s)).toBe(7);
		expect(s.rowHeight).toBe(88);
	});

	it("reads a v1 layout export, which had no marker at all", () => {
		const outcome = readPackage(
			JSON.stringify({ cards: [{ id: "c1", kind: "clock" }], gridColumns: 8 }),
		);
		expect(outcome.pkg?.hearth.kind).toBe("layout");

		const s = vault();
		const result = applyPackage(s, outcome.pkg!, { mode: "replaceAll" });
		expect(result.ok).toBe(true);
		expect(s.dashboards[0].cards).toHaveLength(1);
		expect(s.gridColumns).toBe(8);
	});

	it("reads a v1 settings export", () => {
		const outcome = readPackage(
			JSON.stringify({ hearthSettings: 1, title: "Restored", compact: true }),
		);
		expect(outcome.pkg?.hearth.kind).toBe("settings");

		const s = vault();
		applyPackage(s, outcome.pkg!, { mode: "replaceAll" });
		expect(s.title).toBe("Restored");
		expect(s.compact).toBe(true);
	});

	it("takes boards from a whole-vault file without touching the settings", () => {
		const mine = opinionatedVault();
		mine.dashboards.push({ id: "board-2", name: "Second", cards: [] });
		const theirs = contraryVault();
		const globals = { ...theirs, dashboards: undefined, activeDashboardId: undefined };

		const result = applyPackage(theirs, captureLayout(mine), { mode: "add" });

		expect(result.added).toHaveLength(2);
		expect(theirs.dashboards).toHaveLength(3);
		expect({ ...theirs, dashboards: undefined, activeDashboardId: undefined }).toEqual(
			globals,
		);
	});

	it("says so when a file comes from a newer Hearth", () => {
		const pkg = captureLayout(vault());
		pkg.hearth.format = PACKAGE_FORMAT + 5;
		const outcome = readPackage(serializePackage(pkg));
		expect(outcome.newerFormat).toBe(true);
		const result = applyPackage(vault(), outcome.pkg!, { mode: "replaceAll" });
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				{ code: "formatNewer", detail: String(PACKAGE_FORMAT + 5) },
			]),
		);
	});

	/**
	 * An import writes the package's pictures into the vault before it applies
	 * the payload — that is what turns their in-package references back into
	 * vault paths — so a payload that turns out to be unusable has to be caught
	 * *before* the writing, or its images are left in the vault with nothing
	 * pointing at them.
	 */
	it("knows an unusable package is unusable before anything is written", () => {
		const s = vault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		(pkg.payload as { dashboard: unknown }).dashboard = "not a board";
		expect(validatePackage(s, pkg)).not.toBeNull();

		const good = captureDashboard(s, s.dashboards[0]);
		expect(validatePackage(s, good)).toBeNull();
		// A settings backup may legitimately carry no boards at all.
		expect(validatePackage(s, { hearth: { format: 3, kind: "settings" }, payload: {} })).toBeNull();
	});

	it("rejects what isn't a Hearth file, without touching the vault", () => {
		expect(readPackage("not json").error).toBe("invalidJson");
		expect(readPackage("[]").error).toBe("notAnObject");
		expect(readPackage("{}").error).toBe("notHearth");
		expect(readPackage(JSON.stringify({ hearth: { format: 3, kind: "nope" } })).error).toBe(
			"notHearth",
		);
	});
});

describe("what a package points at outside itself", () => {
	function boardWithReferences(): HomeSettings {
		const s = opinionatedVault();
		s.dashboards[0].cards = [
			card({ id: "c1", kind: "embed", target: "Journal/2026-09-02.md" }),
			card({
				id: "c2",
				kind: "links",
				links: [
					{ id: "l1", label: "Inbox", icon: "inbox", target: "Inbox.md", type: "note" },
					{ id: "l2", label: "Docs", icon: "book", target: "https://obsidian.md", type: "url" },
					{ id: "l3", label: "Sync", icon: "refresh-cw", target: "app:reload", type: "command" },
				],
			}),
			card({
				id: "c3",
				kind: "calendar",
				calendar: {
					sources: [
						{ id: "s1", name: "Work", url: "webcal://cal.example.com/private/abc123.ics" },
					],
				},
			}),
			card({
				id: "c4",
				kind: "tasks",
				tasks: { folderScope: "whitelist", folders: ["Projects", "Areas"] },
			}),
			card({
				id: "c5",
				kind: "weather",
				weather: { place: { name: "Prague", lat: 50.08, lon: 14.44 } },
			}),
			card({ id: "c6", kind: "text", text: "my private notes" }),
		];
		return s;
	}

	it("finds each reference and files it under what it is", () => {
		const s = boardWithReferences();
		const report = describeReferences(captureDashboard(s, s.dashboards[0]));

		expect(report.byScope.vaultPath).toEqual(
			expect.arrayContaining(["Journal/2026-09-02.md", "Inbox.md", "Projects", "Areas"]),
		);
		expect(report.byScope.asset).toContain("Attachments/wall.png");
		expect(report.byScope.privateUrl).toEqual([
			"webcal://cal.example.com/private/abc123.ics",
		]);
		expect(report.byScope.publicUrl).toContain("https://obsidian.md");
		expect(report.byScope.commandId).toContain("app:reload");
		// Reported as strings: the report is for listing and indexing, and a
		// latitude is as much a value to show as a place name.
		expect(report.byScope.place).toEqual(
			expect.arrayContaining(["Prague", "50.08", "14.44"]),
		);
		expect(report.byScope.userContent).toContain("my private notes");
		expect(report.cardKinds).toEqual(
			expect.arrayContaining(["embed", "links", "calendar", "tasks", "weather", "text"]),
		);
	});

	/**
	 * The gallery hand-off. A board is exported from a vault with its paths —
	 * that is right, the author's own copy has to keep working — and the paths
	 * come off when it is published. What must survive is everything about how
	 * the board *looks*.
	 */
	it("strips the author's paths and private feeds, keeping the layout", () => {
		const s = boardWithReferences();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		const report = stripReferences(pkg, { paths: true, private: true, content: true });

		expect(report.removed.vaultPath).toBeGreaterThan(0);
		expect(report.removed.privateUrl).toBe(1);
		// Gone: the notes, the folders, the private feed, the author's town, the
		// author's prose.
		expect(board.cards[0].target).toBeUndefined();
		expect(board.cards[1].links?.[0].target).toBeUndefined();
		expect(board.cards[2].calendar?.sources?.[0].url).toBeUndefined();
		expect(board.cards[3].tasks?.folders).toEqual([]);
		expect(board.cards[4].weather?.place?.name).toBeUndefined();
		expect(board.cards[5].text).toBeUndefined();
		// Kept: the public link, the command, and every part of the look.
		expect(board.cards[1].links?.[1].target).toBe("https://obsidian.md");
		expect(board.cards[1].links?.[2].target).toBe("app:reload");
		expect(board.gridColumns).toBe(9);
		expect(board.cardOpacity).toBe(0.8);
		expect(board.bannerHeight).toBe(260);
		expect(board.header?.title).toBe("The archive");
		expect(board.cards).toHaveLength(6);
	});

	/**
	 * What the default strip does and doesn't take, since that default is what a
	 * gallery will call. The author's own prose goes with the paths — a board
	 * whose text card is empty works exactly as well as one whose embed card
	 * points at nothing — while what the board needs in order to function stays.
	 */
	it("takes the author's prose by default, and leaves what the board needs", () => {
		const s = boardWithReferences();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		stripReferences(pkg);

		expect(board.cards[5].text).toBeUndefined();
		expect(board.cards[1].links?.[1].target).toBe("https://obsidian.md");
		expect(board.cards[1].links?.[2].target).toBe("app:reload");
	});

	it("keeps the author's prose when a caller deliberately asks to", () => {
		const s = boardWithReferences();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		stripReferences(pkg, { paths: true, private: true, content: false });

		expect(board.cards[5].text).toBe("my private notes");
	});

	/**
	 * An advanced heatmap rule can test a note's folder or its full path, and
	 * then holds a literal one. It had no rule, and the residual sweep can't see
	 * it either: a bare folder name has no file extension to match on.
	 */
	it("strips a vault folder named by a heatmap rule", () => {
		const s = boardWithReferences();
		s.dashboards[0].cards.push(
			card({
				id: "c7",
				kind: "heatmap",
				heatmap: {
					advanced: true,
					rules: [
						{ id: "r1", field: "folder", op: "is", value: "Private/Therapy" },
						{ id: "r2", field: "property", op: "is", key: "mood", value: "good" },
					],
				},
			}),
		);
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		stripReferences(pkg, { paths: true });

		expect(board.cards[6].heatmap?.rules?.[0].value).toBeUndefined();
		// A property comparison is not a path and the card needs it to work.
		expect(board.cards[6].heatmap?.rules?.[1].value).toBe("good");
	});

	/**
	 * The backstop for the rule table being a denylist: a card kind added
	 * without a rule for its path field should show up as a finding rather than
	 * travel unnoticed. `refreshSec` is a real card field with no rule, standing
	 * in here for one that should have had one.
	 */
	it("reports anything still path-shaped after a strip", () => {
		const s = boardWithReferences();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;
		(board.cards[0] as unknown as Record<string, unknown>).somethingNew =
			"Private/Diary.md";

		// Paths only, so the private calendar feed is deliberately still there —
		// and the sweep reports it too, which is the point: it lists what still
		// looks private, whether a rule missed it or the caller kept it.
		const report = stripReferences(pkg, { paths: true });

		expect(report.residual).toEqual([
			"payload.dashboard.cards[0].somethingNew: Private/Diary.md",
			expect.stringContaining("abc123.ics"),
		]);
	});

	it("closes the holes it made and leaves alone the ones it didn't", () => {
		const s = boardWithReferences();
		// A pre-existing empty slot somewhere the strip never touches. Compacting
		// the whole payload would quietly remove it too.
		const untouched = ["a", null, "b"];
		(s.dashboards[0].cards[0] as unknown as Record<string, unknown>).untouched =
			untouched;
		const pkg = captureDashboard(s, s.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		stripReferences(pkg, { paths: true });

		// The stripped folder list is closed up, with no holes left behind.
		expect(board.cards[3].tasks?.folders).toEqual([]);
		expect(
			(board.cards[0] as unknown as Record<string, unknown>).untouched,
		).toEqual(["a", null, "b"]);
	});

	it("sees nothing path-shaped in a board that has been fully stripped", () => {
		const s = boardWithReferences();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const report = stripReferences(pkg, { paths: true, private: true, content: true });
		expect(report.residual).toEqual([]);
		expect(residualPaths(pkg)).toEqual([]);
	});
});

describe("carrying the wallpaper", () => {
	/** An asset store over a plain map, so embedding and materializing can be
	 * exercised without a vault. */
	function fakeStore(files: Record<string, string>): AssetStore & { written: Record<string, string> } {
		const written: Record<string, string> = {};
		return {
			written,
			read: (path) => {
				if (!(path in files)) return Promise.resolve(null);
				const bytes = Buffer.from(files[path]);
				// The slice matters: `.buffer` alone is Node's whole allocation
				// pool, not these bytes.
				return Promise.resolve(
					bytes.buffer.slice(
						bytes.byteOffset,
						bytes.byteOffset + bytes.byteLength,
					),
				);
			},
			write: (folder, name, data) => {
				const path = folder ? `${folder}/${name}` : name;
				written[path] = Buffer.from(data).toString();
				return Promise.resolve(path);
			},
			encode: (data) => Buffer.from(data).toString("base64"),
			decode: (b64) => {
				const bytes = Buffer.from(b64, "base64");
				return bytes.buffer.slice(
					bytes.byteOffset,
					bytes.byteOffset + bytes.byteLength,
				);
			},
		};
	}

	it("is off unless asked for, leaving the picture as a path", () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		expect(pkg.assets).toBeUndefined();
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBe("Attachments/wall.png");
	});

	it("embeds the wallpaper and points the board at the copy inside the file", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const store = fakeStore({ "Attachments/wall.png": "PNGDATA" });

		const report = await embedAssets(pkg, store);

		expect(report.embedded).toHaveLength(1);
		expect(report.skipped).toEqual([]);
		expect(pkg.assets?.[0].from).toBe("Attachments/wall.png");
		expect(pkg.assets?.[0].name).toBe("wall.png");
		expect(pkg.assets?.[0].mime).toBe("image/png");
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBe(`hearth:asset/${pkg.assets![0].id}`);
	});

	it("writes it into the importing vault and points the board at the new path", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const source = fakeStore({ "Attachments/wall.png": "PNGDATA" });
		await embedAssets(pkg, source);

		const target = fakeStore({});
		const report = await materializeAssets(pkg, target, "Hearth/imported");

		expect(report.written).toEqual(["Hearth/imported/wall.png"]);
		expect(target.written["Hearth/imported/wall.png"]).toBe("PNGDATA");
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBe("Hearth/imported/wall.png");
		// The base64 has done its job and must not reach data.json.
		expect(pkg.assets).toBeUndefined();
	});

	it("draws the imported board with its own wallpaper", async () => {
		const mine = opinionatedVault();
		const pkg = captureDashboard(mine, mine.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		await materializeAssets(pkg, fakeStore({}), "Hearth/imported");

		const theirs = contraryVault();
		applyPackage(theirs, pkg, { mode: "add" });

		const background = effectiveBackground(theirs);
		expect(background.kind).toBe("image");
		expect(background.value).toBe("Hearth/imported/wall.png");
		expect(background.opacity).toBe(0.6);
		expect(background.layout).toBe("banner");
	});

	it("stores one copy when two things point at the same picture", async () => {
		const s = opinionatedVault();
		s.dashboards[0].header = { titleIcon: "Attachments/wall.png" };
		const pkg = captureDashboard(s, s.dashboards[0]);

		const report = await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));

		expect(report.embedded).toHaveLength(1);
		expect(pkg.assets).toHaveLength(1);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;
		expect(board.header?.titleIcon).toBe(board.background?.value);
	});

	it("leaves a picture that is too large as a path, and says so", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);

		const report = await embedAssets(
			pkg,
			fakeStore({ "Attachments/wall.png": "PNGDATA" }),
			{ maxAssetBytes: 3 },
		);

		expect(report.embedded).toEqual([]);
		expect(report.skipped).toEqual([{ path: "Attachments/wall.png", reason: "tooLarge" }]);
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBe("Attachments/wall.png");
	});

	it("leaves a picture that is no longer in the vault as a path", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		const report = await embedAssets(pkg, fakeStore({}));
		expect(report.skipped).toEqual([{ path: "Attachments/wall.png", reason: "missing" }]);
		expect(pkg.assets).toBeUndefined();
	});

	it("refuses to write an asset whose bytes don't match its declared length", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		pkg.assets![0].bytes = 99;

		const report = await materializeAssets(pkg, fakeStore({}), "Hearth/imported");

		expect(report.written).toEqual([]);
		expect(report.skipped).toEqual([{ id: "a1", reason: "corrupt" }]);
	});

	/**
	 * Two things a package must not be able to talk its way past, since one
	 * arrives from strangers by design.
	 */
	it("leaves an SVG as a path rather than carrying a document as a picture", async () => {
		const s = opinionatedVault();
		s.backgroundValue = "Attachments/wall.svg";
		const pkg = captureDashboard(s, s.dashboards[0]);

		const report = await embedAssets(pkg, fakeStore({ "Attachments/wall.svg": "<svg/>" }));

		expect(report.embedded).toEqual([]);
		expect(report.skipped).toEqual([{ path: "Attachments/wall.svg", reason: "type" }]);
		expect(pkg.assets).toBeUndefined();
	});

	it("caps an asset by the bytes it actually carries, not the number it claims", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		// A hand-built package: a modest declared size over a large payload.
		pkg.assets![0].data = "A".repeat(MAX_ASSET_BYTES * 2);
		pkg.assets![0].bytes = 10;

		const target = fakeStore({});
		const report = await materializeAssets(pkg, target, "Hearth/imported");

		expect(report.skipped).toEqual([{ id: "a1", reason: "tooLarge" }]);
		expect(report.written).toEqual([]);
		expect(Object.keys(target.written)).toEqual([]);
	});

	/**
	 * A package chooses both halves of the filename its picture is written
	 * under, so both are checked here. The `id` case is the one that bit: the
	 * fallback branch interpolated it raw, and the first version of this test
	 * passed only because the id it happened to carry was `a1`.
	 */
	it("keeps a hostile asset name from escaping its folder", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		pkg.assets![0].name = "../../../.obsidian/plugins/hearth/main.js";

		const target = fakeStore({});
		const report = await materializeAssets(pkg, target, "Hearth/imported");

		expect(report.written).toEqual(["Hearth/imported/a1.png"]);
	});

	it("keeps a hostile asset id from escaping its folder", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		// A name whose extension doesn't match the mime sends safeAssetName down
		// its fallback branch, which is the one that reads the id.
		pkg.assets![0].name = "x";
		pkg.assets![0].id = "../../../.obsidian/plugins/hearth/evil";

		const target = fakeStore({});
		const report = await materializeAssets(pkg, target, "Hearth/imported");

		// The directories are stripped before the name is built, so what is left
		// is a plain segment inside the import folder.
		expect(report.written).toEqual(["Hearth/imported/evil.png"]);
		expect(Object.keys(target.written).every((path) => !path.includes(".."))).toBe(true);
	});

	it("drops an asset whose id isn't the shape this engine writes", () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		pkg.assets = [
			{ id: "../evil", name: "a.png", mime: "image/png", bytes: 1, data: "AA==" },
			{ id: "a1", name: "a.png", mime: "image/png", bytes: 1, data: "AA==" },
			{ id: "a1", name: "duplicate.png", mime: "image/png", bytes: 1, data: "AA==" },
			{ id: "a2", name: "b.png", mime: "image/png", bytes: "lots", data: "AA==" } as never,
		];

		// Parsed rather than trusted: the traversal id, the duplicate and the
		// non-numeric size are all dropped before anything can act on them.
		const reread = readPackage(serializePackage(pkg));
		expect(reread.pkg?.assets?.map((a) => a.id)).toEqual(["a1"]);
	});

	it("clears a reference to a picture the package no longer carries", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));
		// What a gallery download looks like when the pictures were dropped.
		delete pkg.assets;

		const report = await materializeAssets(pkg, fakeStore({}), "Hearth/imported");

		expect(report.missingRefs).toEqual(["a1"]);
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBeUndefined();
	});

	it("strips the author's folder from an embedded picture", async () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0]);
		await embedAssets(pkg, fakeStore({ "Attachments/wall.png": "PNGDATA" }));

		stripReferences(pkg, { paths: true });

		// The picture stays; where it used to live does not.
		expect(pkg.assets).toHaveLength(1);
		expect(pkg.assets?.[0].from).toBeUndefined();
		expect(pkg.assets?.[0].name).toBe("wall.png");
		expect(
			(pkg.payload as { dashboard: Dashboard }).dashboard.background?.value,
		).toBe("hearth:asset/a1");
	});
});

describe("task cards keep the metadata they were showing", () => {
	it("folds the vault-wide field list onto each card", () => {
		const mine = opinionatedVault();
		mine.taskFieldsEnabled = true;
		mine.taskFields = [
			{ id: "f1", name: "Due", keys: [{ source: "fm:due" }] },
		];
		mine.dashboards[0].cards = [card({ id: "c1", kind: "tasks", tasks: {} })];

		const pkg = captureDashboard(mine, mine.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		expect(board.cards[0].tasks?.taskFieldsEnabled).toBe(true);
		expect(board.cards[0].tasks?.taskFields?.[0].name).toBe("Due");
		// The one thing a board can't carry is the master switch, so it asks.
		expect(pkg.requires?.settings).toEqual(["taskFieldsEnabled"]);
	});

	it("warns when the importing vault has that master switch off", () => {
		const mine = opinionatedVault();
		mine.taskFieldsEnabled = true;
		mine.taskFields = [
			{ id: "f1", name: "Due", keys: [{ source: "fm:due" }] },
		];
		mine.dashboards[0].cards = [card({ id: "c1", kind: "tasks", tasks: {} })];

		const theirs = contraryVault();
		theirs.taskFieldsEnabled = false;
		const result = applyPackage(theirs, captureDashboard(mine, mine.dashboards[0]), {
			mode: "add",
		});

		expect(result.warnings).toEqual(
			expect.arrayContaining([{ code: "settingRequired", detail: "taskFieldsEnabled" }]),
		);
	});

	it("leaves a card that already states its own fields alone", () => {
		const mine = opinionatedVault();
		mine.taskFieldsEnabled = true;
		mine.taskFields = [
			{ id: "global", name: "Global", keys: [{ source: "fm:g" }] },
		];
		mine.dashboards[0].cards = [
			card({
				id: "c1",
				kind: "tasks",
				tasks: {
					taskFieldsEnabled: true,
					taskFields: [
						{ id: "own", name: "Own", keys: [{ source: "fm:o" }] },
					],
				},
			}),
		];

		const pkg = captureDashboard(mine, mine.dashboards[0]);
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;
		expect(board.cards[0].tasks?.taskFields?.[0].name).toBe("Own");
	});
});

describe("what a package says about itself", () => {
	it("names the plugins its cards need", () => {
		const s = opinionatedVault();
		s.dashboards[0].cards = [
			card({ id: "c1", kind: "dataview", dataview: { query: "LIST" } }),
			card({ id: "c2", kind: "git" }),
			card({ id: "c3", kind: "tasks", tasks: { source: "tasknotes" } }),
			card({ id: "c4", kind: "clock" }),
		];

		const pkg = captureDashboard(s, s.dashboards[0]);

		expect(pkg.requires?.plugins).toEqual(["dataview", "obsidian-git", "tasknotes"]);
		expect(pkg.requires?.cardKinds).toEqual(["clock", "dataview", "git", "tasks"]);
	});

	it("claims no plugin for a tasks card that reads checkboxes", () => {
		const s = opinionatedVault();
		s.dashboards[0].cards = [
			card({ id: "c1", kind: "tasks", tasks: { source: "checkbox" } }),
		];
		expect(captureDashboard(s, s.dashboards[0]).requires?.plugins).toBeUndefined();
	});

	it("carries the board's name and whatever the author wrote about it", () => {
		const s = opinionatedVault();
		const pkg = captureDashboard(s, s.dashboards[0], {
			meta: { author: "ondreu", description: "A reading board", tags: ["reading"] },
			pluginVersion: "3.1.0",
		});
		expect(pkg.meta?.name).toBe("Home");
		expect(pkg.meta?.author).toBe("ondreu");
		expect(pkg.meta?.tags).toEqual(["reading"]);
		expect(pkg.hearth.plugin).toBe("3.1.0");
	});
});

describe("a board that should adapt instead of insisting", () => {
	it("carries only its real overrides when flattening is turned off", () => {
		const mine = opinionatedVault();
		mine.dashboards[0].gridColumns = 6;

		const pkg = captureDashboard(mine, mine.dashboards[0], { flatten: false });
		const board = (pkg.payload as { dashboard: Dashboard }).dashboard;

		expect(board.gridColumns).toBe(6);
		expect(board.cardOpacity).toBeUndefined();
		expect(board.background).toBeUndefined();

		// So it takes on the importing vault's look for everything else.
		const theirs = contraryVault();
		applyPackage(theirs, pkg, { mode: "add" });
		expect(effectiveColumns(theirs)).toBe(6);
		expect(effectiveCardOpacity(theirs)).toBe(0.1);
	});
});
