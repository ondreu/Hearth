/**
 * The portable-package format: one envelope, three payloads.
 *
 * Hearth has had two export files since 2.x — a layout (`hearthLayout: 2`) and
 * a full settings backup (`hearthSettings: 1`) — and both describe a whole
 * vault. Neither can carry *one* dashboard, which is the unit a dashboard
 * gallery trades in, and neither says anything about itself: what made it, what
 * it needs installed, what of the author's vault it mentions.
 *
 * This format answers all three. A package is a header, some optional
 * self-description, an optional bag of embedded files, and exactly one payload:
 *
 * - `dashboard` — one board, with every look-affecting setting resolved into
 *   the board itself, so it draws the same in a vault configured differently.
 * - `layout` — every board plus the layout globals. Same payload shape the v2
 *   layout export has always written.
 * - `settings` — every configurable setting. Same payload shape the v1 settings
 *   export has always written, minus the fields it forgot.
 *
 * The two legacy files stay readable: {@link readPackage} recognises them and
 * wraps them in an envelope, so there is one parser and one sanitizer path from
 * here on. Nothing in this module reads or writes the vault — see
 * `assets.ts` for the only part that needs to, behind an interface, so the
 * engine stays testable without an Obsidian instance.
 */


import type {
	CardKind,
	Dashboard,
	DashboardCard,
	PerformanceTier,
} from "../types";
import type { LayoutExport } from "../layout";

/** Current package format. Bumped only for a change a previous Hearth could
 * not read safely; additive fields don't move it. */
export const PACKAGE_FORMAT = 3;

/** What a package carries. See the module comment. */
export type PackageKind = "dashboard" | "layout" | "settings";

/** Every {@link PackageKind}, for validation. */
export const PACKAGE_KINDS: readonly PackageKind[] = ["dashboard", "layout", "settings"];

/** File name suggested for each kind of export. */
export const PACKAGE_FILENAMES: Record<PackageKind, string> = {
	dashboard: "hearth-dashboard.json",
	layout: "hearth-layout.json",
	settings: "hearth-settings.json",
};

export interface PackageHeader {
	/** {@link PACKAGE_FORMAT} at the time of writing. */
	format: number;
	kind: PackageKind;
	/** Hearth version that wrote it, for a gallery's compatibility column and
	 * for a bug report that arrives as a file. */
	plugin?: string;
	/** ISO 8601. Informational — nothing branches on it. */
	createdAt?: string;
}

/** What a human (or a gallery listing) needs in order to tell one package from
 * another. Every field is optional: a package is still valid with none of it,
 * and a plain local backup fills in almost none. */
export interface PackageMeta {
	name?: string;
	description?: string;
	author?: string;
	/** Free-form, lower-cased by convention. A gallery's facets. */
	tags?: string[];
	/** The author's own version string for this board, if they keep one. */
	version?: string;
}

/**
 * The conditions the package was taken under.
 *
 * Recorded, never applied. The performance tier is the reason this block
 * exists: it is an override *at read time*, so a board captured on a phone at
 * `balanced` would otherwise be indistinguishable from one whose author really
 * chose a still sky and no frosted glass. Capture therefore reads the stored
 * values with the tier neutralised (see `capture.ts`) and notes the real tier
 * here, so a gallery can say "captured on a low-power device" without a
 * shared board ever forcing expensive rendering onto someone else's hardware.
 */
export interface PackageCapture {
	platform?: "desktop" | "mobile";
	performanceTier?: PerformanceTier;
	/** UI language at capture time, so a gallery can group by it. */
	locale?: string;
}

/**
 * What the importing vault needs in order to draw the package as its author
 * saw it. Advisory: a missing entry produces a warning, never a refusal — a
 * board whose Dataview card is inert is still worth importing.
 */
export interface PackageRequirements {
	/** Community/core plugin ids (`dataview`, `obsidian-git`, `bases`, …). */
	plugins?: string[];
	/** Card kinds used, so a newer board tells an older Hearth what it is
	 * missing rather than silently dropping cards. */
	cardKinds?: string[];
	/** Registered view types a leaf card or plugin board hosts. */
	viewTypes?: string[];
	/** Hearth settings that must be switched on for part of the board to show —
	 * currently only `taskFieldsEnabled`, whose master switch gates every
	 * tasks card's custom field list. */
	settings?: string[];
}

/**
 * A file carried inside the package — a wallpaper, a title icon, a slide.
 *
 * Embedding is optional at every level: the exporter chooses whether to include
 * assets at all, an asset over the size cap is left out with a warning, and a
 * package with no `assets` is perfectly valid — its references simply stay the
 * vault paths they were, and the importing vault shows what it has (or reports
 * what it hasn't).
 *
 * References to an embedded asset take the form `hearth:asset/<id>` and exist
 * *only inside a package*. The importer materializes each asset into the vault
 * and rewrites the reference to the real path it wrote, so nothing downstream —
 * no renderer, no sanitizer, no settings migration — ever sees the scheme.
 */
export interface PackageAsset {
	/** Stable within the package. Referenced as `hearth:asset/<id>`. */
	id: string;
	/** Original basename, used to name the file written on import. Carries no
	 * folder, so it leaks nothing about the author's vault layout. */
	name: string;
	mime: string;
	/** Decoded length in bytes, checked against the base64 on import. */
	bytes: number;
	/** base64, no data-URI prefix. */
	data: string;
	/** Where it came from in the author's vault. Dropped by
	 * {@link stripReferences} — it is the one part of an asset that identifies
	 * the author's folder structure. */
	from?: string;
}

/** The scheme an in-package asset reference uses. */
export const ASSET_REF_PREFIX = "hearth:asset/";

/** Whether a stored string points at an asset inside the package rather than at
 * something in the vault. */
export function isAssetRef(value: string): boolean {
	return value.startsWith(ASSET_REF_PREFIX);
}

/** The asset id inside a reference, or null when it isn't one. */
export function assetRefId(value: string): string | null {
	return isAssetRef(value) ? value.slice(ASSET_REF_PREFIX.length) : null;
}

/** Build a reference to an asset id. */
export function assetRef(id: string): string {
	return `${ASSET_REF_PREFIX}${id}`;
}

/**
 * Per-asset and total size caps.
 *
 * A package is a JSON file that has to survive being downloaded, uploaded to a
 * gallery, and read into memory in one string, and base64 costs a third again
 * on top of the file itself. These are the point at which "share your board"
 * turns into "share your wallpaper collection": generous enough for a photo,
 * small enough that a package stays a document.
 */
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 16 * 1024 * 1024;

/** The payload of a `dashboard` package: one board, and the vault-scoped extras
 * it may need. */
export interface DashboardPayload {
	dashboard: Dashboard;
	/** Cards pinned to every board in the author's vault. Carried because they
	 * are part of what the author saw, and applied only when the importer asks
	 * for them — they would otherwise appear on every board in *their* vault. */
	pinnedCards?: DashboardCard[];
	/** The author's favourites list, when the board has a card that reads it.
	 * Vault paths, and vault-wide: never applied unless the importer opts in. */
	favorites?: string[];
}

/** The payload of a `layout` package: exactly what the v2 layout export writes,
 * so it applies through the same sanitizers. */
export type LayoutPayload = LayoutExport;

/** The payload of a `settings` package: exactly what the settings export writes.
 * Left as a record because it is a flat projection of `HomeSettings`, validated
 * field by field on the way in rather than by shape. */
export type SettingsPayload = Record<string, unknown>;

export type PackagePayload = DashboardPayload | LayoutPayload | SettingsPayload;

/** A Hearth portable package. */
export interface HearthPackage {
	hearth: PackageHeader;
	meta?: PackageMeta;
	capture?: PackageCapture;
	requires?: PackageRequirements;
	assets?: PackageAsset[];
	payload: PackagePayload;
}

/** A `dashboard` package, narrowed. */
export interface DashboardPackage extends HearthPackage {
	hearth: PackageHeader & { kind: "dashboard" };
	payload: DashboardPayload;
}

/** Narrow a package to a dashboard one. */
export function isDashboardPackage(pkg: HearthPackage): pkg is DashboardPackage {
	return pkg.hearth.kind === "dashboard";
}

/** How an imported board joins the vault.
 *
 * - `add` — a new board with a new id and a name that doesn't collide. The
 *   importing vault's own settings are left completely alone. This is the
 *   gallery case, and the default.
 * - `replaceBoard` — overwrite one existing board *in place*, keeping its id so
 *   its workspace link, hosted-view cache and scroll memory survive. What
 *   "update the board I imported last week" means.
 * - `replaceAll` — throw away the vault's dashboards and settings and apply the
 *   package wholesale. What a backup restore means; only offered for `layout`
 *   and `settings` packages.
 */
export type ImportMode = "add" | "replaceBoard" | "replaceAll";

/** Why an import is less than perfect. Codes rather than sentences so the UI
 * owns the wording and a gallery can act on them. */
export type ImportWarningCode =
	/** A referenced note/folder/attachment isn't in this vault. */
	| "missingPath"
	/** A plugin the board's cards need isn't installed or enabled. */
	| "missingPlugin"
	/** A card kind this Hearth doesn't know — the card was dropped. */
	| "unknownCardKind"
	/** A hosted view type nothing has registered. */
	| "unknownViewType"
	/** An embedded asset couldn't be written (over cap, bad base64, IO error). */
	| "assetSkipped"
	/** An asset reference had no matching asset in the package. */
	| "assetMissing"
	/** The package needs a Hearth setting switched on to show everything. */
	| "settingRequired"
	/** Vault-wide extras (favourites, pinned cards) were carried but not
	 * applied, because applying them would change boards the importer didn't
	 * ask about. */
	| "notApplied"
	/** The package was written by a newer Hearth; unknown fields were ignored. */
	| "formatNewer";

export interface ImportWarning {
	code: ImportWarningCode;
	/** The offending value or a count, for the UI to quote verbatim. */
	detail?: string;
}

/** What an import did. Returned instead of the old `string | null` so a caller
 * can tell "worked, with things to know" from "worked" — which a gallery import
 * needs, since a downloaded board routinely mentions notes the importer hasn't
 * got. */
export interface ImportResult {
	ok: boolean;
	/** Set only when nothing was applied. */
	error?: string;
	warnings: ImportWarning[];
	/** Boards created, in the order they were added. */
	added: { id: string; name: string }[];
	/** Boards overwritten in place. */
	replaced: { id: string; name: string }[];
	/** Vault paths of the assets written, so the caller can mention where the
	 * wallpaper landed. */
	assetsWritten: string[];
	/** The board to switch to once the import is saved, when the import created
	 * or replaced one. */
	activeDashboardId?: string;
}

/** An empty result, ready to be filled in. */
export function emptyResult(): ImportResult {
	return { ok: true, warnings: [], added: [], replaced: [], assetsWritten: [] };
}

/** Record a warning, skipping an exact duplicate so a board with forty cards
 * pointing at the same missing folder reports it once. */
export function warn(
	result: ImportResult,
	code: ImportWarningCode,
	detail?: string,
): void {
	if (result.warnings.some((w) => w.code === code && w.detail === detail)) return;
	result.warnings.push({ code, detail });
}

/** A fatal result: nothing was applied. */
export function failure(error: string): ImportResult {
	return { ...emptyResult(), ok: false, error };
}

/** Community/core plugin ids each card kind needs to do anything, keyed by kind.
 *
 * Advisory, and deliberately kept here rather than on `CardDefinition`: it is
 * about what a package needs, not about how a card renders, and a card whose
 * plugin is missing already degrades gracefully on its own. Kinds absent from
 * this table need nothing installed.
 *
 * When you add a card kind that talks to another plugin, add it here so a
 * shared board can say what it wants.
 */
export const CARD_PLUGIN_REQUIREMENTS: Partial<Record<CardKind, readonly string[]>> = {
	dataview: ["dataview"],
	datacore: ["datacore"],
	templater: ["templater-obsidian"],
	git: ["obsidian-git"],
	operon: ["operon"],
	periodic: ["periodic-notes"],
	bookmarks: ["bookmarks"],
	daily: ["daily-notes"],
};
