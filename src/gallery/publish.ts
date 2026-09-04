/**
 * Publishing a board: the export pipeline, ending at a host instead of a file.
 *
 * `docs/dashboard-package.md` sets out the order these steps have to happen in,
 * and the order is the whole of this module. Embedding rewrites picture
 * references; stripping removes the author's paths; signing covers the result.
 * Any other order publishes either a broken board or an invalid signature, and
 * `exportDashboardFile` already enforces it — so publishing is that same
 * function with three of its options pinned rather than a second pipeline that
 * has to be kept in step with it.
 *
 * The three pinned options are the difference between saving a board and
 * publishing one:
 *
 * - **the pictures travel**, because a wallpaper left as a path is a wallpaper
 *   that arrives missing in every vault but the author's;
 * - **the private references come out**, because the author's folder tree is
 *   not part of the board and a published file is permanent in a way a file on
 *   your own disk is not;
 * - **it is signed**, because an unsigned package has no author, and an entry
 *   with no author is one anybody can later claim to have written.
 *
 * None of the three is offered as a switch on the publish path. The details
 * section still tunes *which* groups the strip takes, since a board whose text
 * cards are part of the design is a real case — but the switch that turns the
 * strip off entirely is not there.
 */

import type { App } from "obsidian";
import type { Dashboard, HomeSettings } from "../types";
import { exportDashboardFile, type ExportDashboardOptions } from "../portable";
import { GalleryError, type GalleryClient } from "./client";
import { asGalleryCategory, type GalleryCategory } from "./categories";

/** What the publish dialog collects on top of an ordinary export. */
export interface PublishOptions {
	/** The listing's title. Falls back to the board's name. */
	name: string;
	description: string;
	category: GalleryCategory;
	tags: string[];
	/** Which reference groups the strip takes. Paths and private references are
	 * always among them — see the module comment. */
	strip: NonNullable<ExportDashboardOptions["strip"]>;
	/** Resolve the vault's look onto the board, so it draws the same elsewhere.
	 * On for a published board unless deliberately turned off. */
	flatten: boolean;
	/** The vault's recovery key. Used to sign the file, and never sent. */
	signWith: string;
}

export interface PublishResult {
	id: string;
	/** True when the host recognised `meta.id` and replaced an existing entry
	 * rather than creating one. */
	updated: boolean;
	/**
	 * The host took the board but is holding it out of its listing until
	 * somebody has looked at it — its strip's own backstop saw something still
	 * path-shaped.
	 *
	 * Passed on rather than swallowed: "published" about a board nobody can find
	 * is a lie the author only discovers by going to look for it.
	 */
	held: boolean;
	/** Pictures that could not be carried, by vault path. */
	skippedAssets: string[];
	/** Anything still path-shaped after the strip. A non-empty list is the
	 * strip admitting the reference table missed something, and the dialog says
	 * so before the upload rather than after it. */
	residual: string[];
	bytes: number;
}

/**
 * Build the package a publish would upload, without uploading it.
 *
 * The dialog runs this first so "you are about to publish these paths" is a
 * statement about the actual file rather than a prediction about it, and so a
 * residual can stop the upload rather than being discovered afterwards.
 */
export async function buildPublishPackage(
	app: App,
	settings: HomeSettings,
	dash: Dashboard,
	opts: PublishOptions,
	common: { pluginVersion: string; locale: string },
): Promise<{ json: string; skippedAssets: string[]; residual: string[]; signed: boolean }> {
	const outcome = await exportDashboardFile(app, settings, dash, {
		...common,
		flatten: opts.flatten,
		// Pinned. See the module comment.
		embedAssets: true,
		strip: { ...opts.strip, paths: true, private: true },
		signWith: opts.signWith,
		meta: {
			name: opts.name.trim() || dash.name,
			description: opts.description.trim() || undefined,
			category: asGalleryCategory(opts.category),
			tags: opts.tags.length ? opts.tags : undefined,
		},
	});
	return {
		json: outcome.json,
		skippedAssets: (outcome.assets?.skipped ?? []).map((a) => a.path),
		residual: outcome.strip?.residual ?? [],
		signed: outcome.signed,
	};
}

/**
 * Publish a board to a host.
 *
 * Signs in first — the host has to know which key it is talking to before it
 * will take an upload — and refuses to send an unsigned file rather than
 * letting the host reject it: a package that failed to sign is one whose author
 * cannot be established, and uploading it anyway would create an entry nobody
 * can prove they wrote and nobody else can be stopped from claiming.
 */
export async function publishDashboard(
	client: GalleryClient,
	app: App,
	settings: HomeSettings,
	dash: Dashboard,
	opts: PublishOptions,
	common: { pluginVersion: string; locale: string },
	publicKey: string,
): Promise<PublishResult> {
	const built = await buildPublishPackage(app, settings, dash, opts, common);
	if (!built.signed) throw new GalleryError("rejected", "unsigned");
	await client.signIn(opts.signWith, publicKey);
	const { id, updated, held } = await client.publish(built.json);
	return {
		id,
		updated,
		held,
		skippedAssets: built.skippedAssets,
		residual: built.residual,
		bytes: built.json.length,
	};
}
