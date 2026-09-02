/**
 * Reading a package, and putting it into a vault.
 *
 * Two halves. {@link readPackage} turns a string into a package or an error,
 * and recognises the two pre-v3 files as well as the v3 envelope, so there is
 * one parser for every Hearth export that has ever existed.
 * {@link applyPackage} then applies it — through the sanitizers in `layout.ts`,
 * never around them, so a hostile file can still only ever set values the
 * settings UI itself could produce.
 *
 * What is new here is that applying a package is no longer a destructive
 * replace. A `dashboard` package normally *joins* a vault: a new board, a new
 * id, a name that doesn't collide, and not one global setting touched. That is
 * what makes importing a stranger's board a safe thing to do, and it is only
 * possible because the board arrives stating its own look (see `capture.ts`)
 * rather than expecting the vault's settings to match the author's.
 *
 * The other change is that an import reports back. A downloaded board routinely
 * mentions notes the importer hasn't got and plugins they haven't installed;
 * that is normal, not a failure, and it needs to be *said* rather than shown as
 * a card that renders nothing. Hence {@link ImportResult} in place of the old
 * `string | null`.
 */

import {
	activeDashboard,
	type Dashboard,
	type DashboardCard,
	type HomeSettings,
	newDashboardId,
} from "../types";
import { CARD_KINDS, cloneCard } from "../cards";
import {
	applyLayout,
	applySettings,
	LAYOUT_SCHEMA,
	sanitizeCard,
	sanitizeDashboard,
	SETTINGS_SCHEMA,
} from "../layout";
import { t } from "../i18n";
import {
	type DashboardPayload,
	emptyResult,
	failure,
	type HearthPackage,
	type ImportMode,
	type ImportResult,
	PACKAGE_FORMAT,
	PACKAGE_KINDS,
	type PackageKind,
	warn,
} from "./schema";
import { boardReferences, cardReferences } from "./refs";

/** Parse failure reasons, as message keys the caller turns into words. */
export type ReadError = "invalidJson" | "notAnObject" | "notHearth" | "emptyPayload";

export interface ReadOutcome {
	pkg?: HearthPackage;
	error?: ReadError;
	/** The package was written by a newer format than this Hearth knows. It is
	 * still applied — unknown fields are ignored — but the caller should say so. */
	newerFormat?: boolean;
}

function isBag(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Turn a file's contents into a package.
 *
 * Recognises, in order: a v3 envelope; a v1 settings export (`hearthSettings`);
 * a v2 layout export (`hearthLayout`); and a v1 layout export, which had no
 * marker at all and is identified by carrying a bare `cards` array. The three
 * legacy shapes are wrapped in an envelope with the payload untouched, so
 * everything downstream sees one format.
 */
export function readPackage(json: string): ReadOutcome {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { error: "invalidJson" };
	}
	if (!isBag(parsed)) return { error: "notAnObject" };

	// v3: the envelope.
	if (isBag(parsed.hearth)) {
		const header = parsed.hearth;
		const kind = header.kind;
		if (!PACKAGE_KINDS.includes(kind as PackageKind)) return { error: "notHearth" };
		if (!isBag(parsed.payload)) return { error: "emptyPayload" };
		const format = typeof header.format === "number" ? header.format : 0;
		const pkg: HearthPackage = {
			hearth: {
				format,
				kind: kind as PackageKind,
				plugin: typeof header.plugin === "string" ? header.plugin : undefined,
				createdAt: typeof header.createdAt === "string" ? header.createdAt : undefined,
			},
			meta: isBag(parsed.meta) ? parsed.meta : undefined,
			capture: isBag(parsed.capture) ? parsed.capture : undefined,
			requires: isBag(parsed.requires) ? parsed.requires : undefined,
			assets: Array.isArray(parsed.assets)
				? (parsed.assets as HearthPackage["assets"])
				: undefined,
			payload: parsed.payload,
		};
		return { pkg, newerFormat: format > PACKAGE_FORMAT };
	}

	// Pre-v3 files. A settings export is checked first because it is a superset
	// of a layout export and carries both markers' worth of data.
	if (typeof parsed.hearthSettings === "number") {
		return { pkg: legacy("settings", SETTINGS_SCHEMA, parsed) };
	}
	if (typeof parsed.hearthLayout === "number" || Array.isArray(parsed.dashboards)) {
		return { pkg: legacy("layout", LAYOUT_SCHEMA, parsed) };
	}
	if (Array.isArray(parsed.cards)) {
		return { pkg: legacy("layout", 1, parsed) };
	}
	return { error: "notHearth" };
}

function legacy(
	kind: PackageKind,
	format: number,
	payload: Record<string, unknown>,
): HearthPackage {
	return { hearth: { format, kind }, payload };
}

/** The vault-side capabilities an import needs, injected so this module stays
 * free of Obsidian and testable on its own. Every one is optional: without them
 * an import still works, it just can't check what it can't see. */
export interface ImportEnvironment {
	/** Whether a vault path exists. Used only to turn misses into warnings. */
	pathExists?: (path: string, folder: boolean) => boolean;
	/** Whether a plugin id is installed *and* enabled. */
	pluginEnabled?: (id: string) => boolean;
	/** Whether a view type has been registered by something. */
	viewTypeKnown?: (viewType: string) => boolean;
}

export interface ApplyOptions {
	mode?: ImportMode;
	/** For `replaceBoard`: the id of the board to overwrite. Its id is kept, so
	 * anything keyed by board id — workspace link, hosted-view cache, scroll
	 * memory — survives the update. */
	targetBoardId?: string;
	/** Apply the package's pinned cards. Off by default: they show on *every*
	 * board, so adding a stranger's would change boards the importer never
	 * looked at. */
	applyPinnedCards?: boolean;
	/** Append the package's favourites to the vault's list, keeping the
	 * vault's own. Off by default, for the same reason. */
	applyFavorites?: boolean;
	/** Switch to the imported board afterwards. On by default. */
	activate?: boolean;
	env?: ImportEnvironment;
}

/**
 * Apply a package to a settings object, in place.
 *
 * Returns a result rather than throwing: a package with problems is usually
 * still worth importing, and the caller decides how loudly to say so. Only a
 * package that cannot be applied at all comes back with `ok: false`, and in that
 * case `s` has not been touched.
 */
export function applyPackage(
	s: HomeSettings,
	pkg: HearthPackage,
	opts: ApplyOptions = {},
): ImportResult {
	const result = emptyResult();
	if (pkg.hearth.format > PACKAGE_FORMAT) {
		warn(result, "formatNewer", String(pkg.hearth.format));
	}

	switch (pkg.hearth.kind) {
		case "dashboard":
			return applyDashboardPackage(s, pkg, opts, result);
		case "layout":
		case "settings":
			return applyWholeVaultPackage(s, pkg, opts, result);
	}
}

/** Apply a one-board package. */
function applyDashboardPackage(
	s: HomeSettings,
	pkg: HearthPackage,
	opts: ApplyOptions,
	result: ImportResult,
): ImportResult {
	const payload = pkg.payload as DashboardPayload;
	const board = sanitizeDashboard(payload.dashboard, s, s.dashboards.length);
	if (!board) return failure(t().layout.noValidDashboards);

	// Count what the sanitizer dropped, so a card this Hearth is too old to
	// know about is reported rather than silently missing.
	reportDroppedCards(payload.dashboard, board, result);

	const mode = opts.mode ?? "add";
	if (mode === "replaceBoard") {
		const targetId = opts.targetBoardId ?? s.activeDashboardId;
		const index = s.dashboards.findIndex((d) => d.id === targetId);
		if (index < 0) return failure(t().layout.noValidDashboards);
		const previous = s.dashboards[index];
		// The target's identity is kept and the package's discarded: the board id
		// is what a workspace link, the hosted-view cache and the scroll memory
		// are keyed by, and an update should not orphan any of them.
		board.id = previous.id;
		// Likewise the two vault-level claims, which belong to the board that is
		// already here rather than to the one arriving.
		if (previous.mobileDefault) board.mobileDefault = previous.mobileDefault;
		if (previous.linkedWorkspace) board.linkedWorkspace = previous.linkedWorkspace;
		s.dashboards[index] = board;
		result.replaced.push({ id: board.id, name: board.name });
	} else {
		board.id = newDashboardId();
		board.name = uniqueBoardName(s, board.name);
		// A board arriving in someone else's vault does not get to claim the
		// mobile default or a workspace, whatever the file says.
		delete board.mobileDefault;
		delete board.linkedWorkspace;
		s.dashboards.push(board);
		result.added.push({ id: board.id, name: board.name });
	}

	if (opts.activate !== false) {
		s.activeDashboardId = board.id;
		result.activeDashboardId = board.id;
	}

	applyExtras(s, payload, opts, result);
	checkEnvironment(s, board, pkg, opts.env, result);
	return result;
}

/** Apply a layout or full-settings package: the restore path. */
function applyWholeVaultPackage(
	s: HomeSettings,
	pkg: HearthPackage,
	opts: ApplyOptions,
	result: ImportResult,
): ImportResult {
	const payload = pkg.payload as Record<string, unknown>;
	const mode = opts.mode ?? "replaceAll";

	// A whole-vault package imported in `add` mode contributes its boards and
	// leaves the settings alone — which is how "import a layout someone sent me
	// without losing my own" works, and how a multi-board gallery entry lands.
	if (mode === "add") {
		const raw = Array.isArray(payload.dashboards)
			? payload.dashboards
			: Array.isArray(payload.cards)
				? [{ name: t().dashboards.fallbackName, cards: payload.cards }]
				: [];
		if (raw.length === 0) return failure(t().layout.notAHearthLayout);
		let last: Dashboard | undefined;
		raw.forEach((entry, i) => {
			const board = sanitizeDashboard(entry, s, s.dashboards.length + i, payload);
			if (!board) return;
			reportDroppedCards(entry, board, result);
			board.id = newDashboardId();
			board.name = uniqueBoardName(s, board.name);
			delete board.mobileDefault;
			delete board.linkedWorkspace;
			s.dashboards.push(board);
			result.added.push({ id: board.id, name: board.name });
			last = board;
		});
		if (!last) return failure(t().layout.noValidDashboards);
		if (opts.activate !== false) {
			s.activeDashboardId = last.id;
			result.activeDashboardId = last.id;
		}
		for (const board of s.dashboards) {
			checkEnvironment(s, board, pkg, opts.env, result);
		}
		return result;
	}

	const error =
		pkg.hearth.kind === "settings"
			? applySettingsPayload(s, payload)
			: applyLayout(s, payload);
	if (error) return failure(error);

	for (const board of s.dashboards) {
		result.replaced.push({ id: board.id, name: board.name });
		checkEnvironment(s, board, pkg, opts.env, result);
	}
	result.activeDashboardId = s.activeDashboardId;
	return result;
}

/** A settings payload applies its embedded layout first, then everything else —
 * so a malformed board aborts before any global has been written and the
 * restore stays all-or-nothing. */
function applySettingsPayload(
	s: HomeSettings,
	payload: Record<string, unknown>,
): string | null {
	const hasLayout =
		Array.isArray(payload.dashboards) || Array.isArray(payload.cards);
	if (hasLayout) {
		const error = applyLayout(s, payload);
		if (error) return error;
	}
	applySettings(s, payload);
	return null;
}

/** Pinned cards and favourites: carried by the package, applied only on
 * request, and reported when they are carried and skipped. */
function applyExtras(
	s: HomeSettings,
	payload: DashboardPayload,
	opts: ApplyOptions,
	result: ImportResult,
): void {
	if (payload.pinnedCards?.length) {
		if (opts.applyPinnedCards) {
			const cards = payload.pinnedCards
				.map((c, i) => sanitizeCard(c, i))
				.filter((c): c is DashboardCard => c !== null)
				// Fresh ids: the vault may already hold a pinned card from an
				// earlier import of the same package.
				.map((c) => cloneCard(c));
			s.pinnedCards = [...s.pinnedCards, ...cards];
		} else {
			warn(result, "notApplied", `pinnedCards:${payload.pinnedCards.length}`);
		}
	}
	if (payload.favorites?.length) {
		if (opts.applyFavorites) {
			const existing = new Set(s.favorites);
			for (const path of payload.favorites) {
				if (typeof path === "string" && !existing.has(path)) {
					s.favorites.push(path);
					existing.add(path);
				}
			}
		} else {
			warn(result, "notApplied", `favorites:${payload.favorites.length}`);
		}
	}
}

/** Cards the sanitizer refused, reported by kind. A card whose `kind` this
 * build doesn't know is the case that matters: it means the package came from a
 * newer Hearth, and saying so is better than a board that is quietly short a
 * card. */
function reportDroppedCards(
	raw: unknown,
	applied: Dashboard,
	result: ImportResult,
): void {
	if (!isBag(raw) || !Array.isArray(raw.cards)) return;
	if (raw.cards.length === applied.cards.length) return;
	const kept = new Set(applied.cards.map((c) => c.id));
	for (const card of raw.cards) {
		if (!isBag(card)) continue;
		if (typeof card.id === "string" && kept.has(card.id)) continue;
		const kind = typeof card.kind === "string" ? card.kind : "";
		if (kind && !CARD_KINDS.includes(kind as never)) {
			warn(result, "unknownCardKind", kind);
		}
	}
}

/**
 * Everything the board wants that this vault may not have: missing note paths,
 * missing plugins, unregistered view types, and the one Hearth setting a folded
 * task-field list depends on.
 *
 * All warnings, never refusals. A board whose Dataview card is inert until the
 * plugin is installed is still the board the author designed.
 */
function checkEnvironment(
	s: HomeSettings,
	board: Dashboard,
	pkg: HearthPackage,
	env: ImportEnvironment | undefined,
	result: ImportResult,
): void {
	if (env?.pathExists) {
		for (const ref of boardReferences(board)) {
			if (ref.scope !== "vaultPath" && ref.scope !== "asset") continue;
			const path = String(ref.value);
			if (!env.pathExists(path, ref.folder)) warn(result, "missingPath", path);
		}
	}
	if (env?.pluginEnabled) {
		for (const id of pkg.requires?.plugins ?? []) {
			if (!env.pluginEnabled(id)) warn(result, "missingPlugin", id);
		}
	}
	if (env?.viewTypeKnown) {
		for (const viewType of pkg.requires?.viewTypes ?? []) {
			if (!env.viewTypeKnown(viewType)) warn(result, "unknownViewType", viewType);
		}
	}
	for (const setting of pkg.requires?.settings ?? []) {
		if (setting === "taskFieldsEnabled" && !s.taskFieldsEnabled) {
			warn(result, "settingRequired", setting);
		}
	}
	// Unknown card kinds are worth reporting even when the board's own cards
	// survived — a pinned card or a newer kind named in `requires` counts too.
	for (const kind of pkg.requires?.cardKinds ?? []) {
		if (!CARD_KINDS.includes(kind as never)) warn(result, "unknownCardKind", kind);
	}
}

/** A name no existing board has, by adding " 2", " 3", … — the same shape the
 * duplicate-board action uses, so an imported board and a duplicated one read
 * the same in the switcher. */
export function uniqueBoardName(s: HomeSettings, name: string): string {
	const taken = new Set(s.dashboards.map((d) => d.name));
	if (!taken.has(name)) return name;
	for (let n = 2; n < 1000; n++) {
		const candidate = `${name} ${n}`;
		if (!taken.has(candidate)) return candidate;
	}
	return `${name} ${Date.now()}`;
}

/**
 * Whether this vault already holds the board a package describes.
 *
 * Matched on the *stored* board id, which a `dashboard` package carries
 * verbatim: importing the same package twice therefore offers to update the
 * board it created the first time instead of piling up copies. A board whose id
 * has been changed since, or one imported before this shipped, reads as new —
 * which is the safe way round.
 */
export function existingBoardFor(
	s: HomeSettings,
	pkg: HearthPackage,
): Dashboard | undefined {
	if (pkg.hearth.kind !== "dashboard") return undefined;
	const id = (pkg.payload as DashboardPayload).dashboard?.id;
	if (typeof id !== "string" || !id) return undefined;
	return s.dashboards.find((d) => d.id === id);
}

/** Card-level references for a package's own cards, so a caller can preflight
 * a package's paths without applying it. */
export function packageCardReferences(pkg: HearthPackage): ReturnType<typeof cardReferences> {
	if (pkg.hearth.kind !== "dashboard") return [];
	const payload = pkg.payload as DashboardPayload;
	const refs = [...boardReferences(payload.dashboard ?? activeBoardFallback())];
	payload.pinnedCards?.forEach((card, i) => {
		refs.push(...cardReferences(card, `pinnedCards[${i}]`));
	});
	return refs;
}

/** An empty board, so `packageCardReferences` on a malformed package returns
 * nothing rather than throwing. */
function activeBoardFallback(): Dashboard {
	return { id: "", name: "", cards: [] };
}

/** The board a `replaceBoard` import would overwrite by default. */
export function defaultReplaceTarget(s: HomeSettings): Dashboard {
	return activeDashboard(s);
}
