/**
 * The portable-package engine: export a dashboard, import a dashboard, back up
 * a vault, restore a vault.
 *
 * Start here. The modules behind it split along one line — everything except
 * `assets.ts` is pure logic over a settings object, and `assets.ts` is the only
 * part that touches the vault:
 *
 * - `schema.ts`  the format: one envelope, three payload kinds, and the result
 *                and warning types an import reports through.
 * - `capture.ts` building a package. Resolves the vault's look-affecting
 *                settings onto a board so it draws the same elsewhere.
 * - `apply.ts`   reading and applying one, including the pre-v3 files.
 * - `refs.ts`    every field that points outside the package, and the strip
 *                the gallery hand-off needs.
 * - `assets.ts`  carrying pictures, and writing them back out.
 *
 * The two flows below are what the UI calls; everything else is re-exported for
 * the gallery pipeline and the tests.
 */

import type { App } from "obsidian";
import type { Dashboard, HomeSettings } from "../types";
import {
	captureDashboard,
	type CaptureDashboardOptions,
	captureLayout,
	type CaptureOptions,
	captureSettings,
	serializePackage,
} from "./capture";
import {
	applyPackage,
	type ApplyOptions,
	type ImportEnvironment,
	readPackage,
	validatePackage,
} from "./apply";
import {
	clearAssetRefs,
	DEFAULT_ASSET_FOLDER,
	type EmbedReport,
	embedAssets,
	materializeAssets,
	vaultAssetStore,
} from "./assets";
import {
	type HearthPackage,
	type ImportResult,
	failure,
	warn,
} from "./schema";
import { t } from "../i18n";

export * from "./schema";
export * from "./refs";
export * from "./capture";
export * from "./apply";
export * from "./assets";

/** Options for {@link exportDashboardFile}. */
export interface ExportDashboardOptions extends CaptureDashboardOptions {
	/**
	 * Carry the board's pictures — its wallpaper, an image title icon, a
	 * slideshow's explicit slides — inside the file.
	 *
	 * Off unless asked for. With it on the board arrives looking right in a
	 * vault that has never seen those files; with it off the file stays small
	 * and its picture references remain the vault paths they were, which is
	 * what a backup of your own vault wants. Anything that can't be carried
	 * (too large, not an image type, no longer in the vault) is left as a path
	 * and reported in {@link ExportOutcome.assets}.
	 */
	embedAssets?: boolean;
}

export interface ExportOutcome {
	/** The file's contents, ready to be written or downloaded. */
	json: string;
	pkg: HearthPackage;
	/** Present when embedding was asked for. */
	assets?: EmbedReport;
}

/**
 * Export one board as a file.
 *
 * The board's look is resolved onto it (unless `flatten: false`), pictures are
 * carried if asked for, and the Jira token every export has always scrubbed
 * stays scrubbed — `layoutPayload` does that, and a dashboard capture goes
 * through the same card objects.
 */
export async function exportDashboardFile(
	app: App,
	s: HomeSettings,
	dash: Dashboard,
	opts: ExportDashboardOptions = {},
): Promise<ExportOutcome> {
	const pkg = captureDashboard(s, dash, opts);
	let assets: EmbedReport | undefined;
	if (opts.embedAssets) {
		assets = await embedAssets(pkg, vaultAssetStore(app));
	}
	return { json: serializePackage(pkg), pkg, assets };
}

/** Export every board plus the layout globals. */
export function exportLayoutFile(s: HomeSettings, opts: CaptureOptions = {}): ExportOutcome {
	const pkg = captureLayout(s, opts);
	return { json: serializePackage(pkg), pkg };
}

/** Export every setting: the full backup. */
export function exportSettingsFile(s: HomeSettings, opts: CaptureOptions = {}): ExportOutcome {
	const pkg = captureSettings(s, opts);
	return { json: serializePackage(pkg), pkg };
}

/** Options for {@link importPackageFile}. */
export interface ImportFileOptions extends ApplyOptions {
	/** Folder the package's pictures are written into. Defaults to
	 * {@link DEFAULT_ASSET_FOLDER}. */
	assetFolder?: string;
}

/**
 * Import a file into a settings object.
 *
 * Order matters: the package's pictures are written into the vault and its
 * references rewritten to real paths *first*, so what reaches the sanitizers is
 * an ordinary board holding ordinary vault paths, and the `hearth:asset/…`
 * scheme never gets anywhere near `data.json`.
 *
 * `s` is modified on success. On failure it is untouched and the result carries
 * the reason.
 */
export async function importPackageFile(
	app: App,
	s: HomeSettings,
	json: string,
	opts: ImportFileOptions = {},
): Promise<ImportResult> {
	const outcome = readPackage(json);
	if (!outcome.pkg) return failure(readErrorMessage(outcome.error));
	const pkg = outcome.pkg;

	// Checked before anything is written. Materializing the pictures has to come
	// before applying (it is what turns the package's asset references back into
	// vault paths), so a package that turns out to be unusable would otherwise
	// leave its images behind in the vault with nothing pointing at them.
	const invalid = validatePackage(s, pkg);
	if (invalid) return failure(invalid);

	// Gathered before the payload is applied, and folded into the result after —
	// an asset that couldn't be written is something to say about an import that
	// otherwise worked, not a reason to refuse it.
	let materialized: string[] = [];
	const assetProblems: string[] = [];
	if (pkg.assets?.length) {
		const report = await materializeAssets(
			pkg,
			vaultAssetStore(app),
			opts.assetFolder ?? DEFAULT_ASSET_FOLDER,
		);
		materialized = report.written;
		assetProblems.push(...report.missingRefs);
		assetProblems.push(...report.skipped.map((a) => `${a.id}:${a.reason}`));
	}
	// A package whose pictures were stripped (a gallery download, a hand edit)
	// still carries references to them; clear those so no scheme survives into
	// settings, and say the board arrived without its picture.
	assetProblems.push(...clearAssetRefs(pkg));

	const result = applyPackage(s, pkg, opts);
	result.assetsWritten = materialized;
	if (outcome.newerFormat) warn(result, "formatNewer", String(pkg.hearth.format));
	for (const problem of assetProblems) warn(result, "assetMissing", problem);
	return result;
}

/** Turn a parse failure into the message the notices use. */
function readErrorMessage(error: string | undefined): string {
	switch (error) {
		case "invalidJson":
			return t().layout.invalidJson;
		case "notAnObject":
			return t().layout.notAnObject;
		case "emptyPayload":
			return t().layout.notAHearthLayout;
		default:
			return t().layout.notAHearthLayout;
	}
}

export type { ImportEnvironment };

/** The environment checks an import runs, wired to a real vault. Passed to
 * {@link importPackageFile} so a missing note or a missing plugin comes back as
 * a warning naming it. */
export function vaultEnvironment(app: App): ImportEnvironment {
	return {
		pathExists: (path, folder) => {
			const file = app.vault.getAbstractFileByPath(path.trim());
			if (!file) return false;
			// A folder reference must find a folder and a file reference a file:
			// "the note is missing" and "the folder is missing" are different
			// things to tell someone.
			const isFolder = !("extension" in file);
			return folder ? isFolder : !isFolder;
		},
		pluginEnabled: (id) => {
			const plugins = app.plugins;
			if (plugins?.enabledPlugins?.has(id)) return true;
			return app.internalPlugins?.getPluginById?.(id)?.enabled === true;
		},
		// The same registry read `leafview.ts` uses, minus its hostability rules:
		// here the only question is whether *something* has registered the type,
		// since a package naming a view nothing provides is what needs saying.
		viewTypeKnown: (viewType) => {
			const byType = app.viewRegistry?.viewByType;
			return Boolean(byType && viewType in byType);
		},
	};
}
