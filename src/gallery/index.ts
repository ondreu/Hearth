/**
 * The dashboard gallery: browsing what other people have published, installing
 * one, and publishing your own.
 *
 * The engine lives here; the three modals that use it are `src/gallerybrowse.ts`
 * and `src/gallerydetail.ts`, and publishing shares the export dialog in
 * `src/exportimport.ts`.
 *
 * - `categories.ts` the closed list of what a board is *for*.
 * - `preview.ts`    a board reduced to something a listing can draw, safely.
 * - `types.ts`      the wire shapes, and the validators every response goes
 *                   through.
 * - `client.ts`     one host, and the only place a request is made.
 * - `install.ts`    a downloaded entry, handed to the importer unchanged.
 * - `publish.ts`    an export, stripped and signed, handed to a host.
 *
 * Nothing about the gallery is required for Hearth to work, and nothing here
 * runs unless a host is configured: no host means the buttons say so and stop,
 * rather than reaching out to somewhere by default. That is deliberate — a
 * vault should not talk to a server because a plugin shipped with one in a
 * constant.
 */

import type HearthPlugin from "../main";
import { GalleryClient, GalleryError, normalizeGalleryUrl } from "./client";

export * from "./categories";
export * from "./preview";
export * from "./types";
export * from "./client";
export * from "./install";
export * from "./publish";

/** Whether a vault has somewhere to browse. */
export function galleryConfigured(plugin: HearthPlugin): boolean {
	return normalizeGalleryUrl(plugin.settings.galleryUrl) !== null;
}

/**
 * The client for this vault's configured host.
 *
 * Cached against the host string, so the sign-in token survives reopening the
 * browse modal but a changed host in settings gets a fresh client rather than
 * one still holding a token issued by somewhere else.
 */
let cached: { host: string; client: GalleryClient } | null = null;

export function galleryClient(plugin: HearthPlugin): GalleryClient | null {
	const host = normalizeGalleryUrl(plugin.settings.galleryUrl);
	if (!host) {
		cached = null;
		return null;
	}
	if (cached?.host !== host) cached = { host, client: new GalleryClient(host) };
	return cached.client;
}

/** Drop any held token. Called when the vault's identity is replaced: the
 * session proves possession of a key this vault no longer has. */
export function forgetGallerySession(): void {
	cached?.client.signOut();
}

/** The gallery error a caller can phrase, or a generic one for anything else —
 * so a `catch` never has to test `instanceof` before reading `.code`. */
export function asGalleryError(err: unknown): GalleryError {
	return err instanceof GalleryError ? err : new GalleryError("server");
}
