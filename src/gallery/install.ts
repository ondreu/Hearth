/**
 * Installing an entry: fetch the package, then hand it to the importer that
 * already exists.
 *
 * There is deliberately no separate "gallery import" path. A downloaded board
 * and one picked off disk are the same file arriving by different roads, and
 * the interesting work — reading the envelope, checking the signature, telling
 * the reader which notes they haven't got and which plugins are missing, and
 * applying the whole thing through `src/layout.ts`'s sanitizers — is the same
 * work either way. Duplicating it would mean a downloaded board getting a
 * *weaker* check than one somebody found in a forum post, which is exactly
 * backwards.
 *
 * So this module fetches bytes and validates that they are a dashboard package.
 * Everything after that is `ImportModal`.
 */

import type { GalleryClient } from "./client";
import { GalleryError } from "./client";
import { type HearthPackage, readPackage } from "../portable";

export interface FetchedEntry {
	/** The file as served, unmodified — what the signature covers. */
	json: string;
	pkg: HearthPackage;
}

/**
 * Download one entry and read it.
 *
 * Refuses anything that isn't a `dashboard` package: a gallery entry is one
 * board by definition, and a host serving a whole-vault `settings` backup under
 * an entry id is either broken or trying something, and in both cases the
 * answer is not to open the restore dialog.
 */
export async function fetchEntryPackage(
	client: GalleryClient,
	id: string,
): Promise<FetchedEntry> {
	const json = await client.download(id);
	const outcome = readPackage(json);
	if (!outcome.pkg) throw new GalleryError("badResponse", outcome.error);
	if (outcome.pkg.hearth.kind !== "dashboard") {
		throw new GalleryError("rejected", outcome.pkg.hearth.kind);
	}
	return { json, pkg: outcome.pkg };
}
