/**
 * A picture of the board, taken at publish, with everything readable taken out
 * of it first.
 *
 * The drawn preview (`preview.ts`) says where the cards are and what kind each
 * one is, and for some boards that is not enough — a board's *look* is the
 * point, and a diagram of it is not a look. So this takes the real thing.
 *
 * Three rules, and the first is the whole reason this file is careful:
 *
 * - **Nothing readable is in the frame when the shutter opens.** Every text
 *   node under the board is replaced with block characters and every embedded
 *   picture is blurred *before* the capture and restored after, in a `finally`.
 *   This is a redaction rather than an obscuring: the characters are not in the
 *   DOM at the moment it is painted, so there is nothing in the image to
 *   recover. What survives is the layout, the card shapes, the colours, the
 *   icons and the wallpaper — which is what a look is.
 * - **The author sees it before it goes.** The share dialog shows the captured
 *   image and will not upload one that hasn't been looked at. A promise about
 *   what a picture contains is worth much less than the picture.
 * - **It is best-effort and desktop-only.** Capturing needs Electron, which
 *   Obsidian's mobile app doesn't have and a future desktop build might not
 *   expose. Every failure path returns null and the drawn preview stands, so
 *   nothing here can stop a publish.
 */

import { Platform } from "obsidian";

/** Widest a snapshot is stored at. A listing tile is ~220px and the detail view
 * ~680px, so this covers both at 2× without carrying a screenful of pixels into
 * every package. */
const MAX_WIDTH = 900;

/** JPEG rather than PNG: a screenshot of a dashboard is a photograph-shaped
 * thing (gradients, a wallpaper, soft shadows), and PNG would triple the size
 * of every package for no visible gain at this scale. */
const QUALITY = 70;

/** The character text is replaced with. A full block, so a redacted line reads
 * as "there is text here" rather than as a rendering fault. */
const BLOCK = "█";

/** Longest run of blocks one text node becomes. A card holding an essay should
 * not paint ten thousand glyphs to be photographed. */
const MAX_RUN = 120;

/** What a capture produced. */
export interface BoardSnapshot {
	/** base64 JPEG, no data-URI prefix — the shape `PackageAsset.data` wants. */
	data: string;
	mime: string;
	/** Decoded length, for the asset's own `bytes`. */
	bytes: number;
	width: number;
	height: number;
}

/** The asset id a snapshot travels under. Reserved: `embedAssets` mints ids of
 * the form `a1`, `a2`, … so this cannot collide with a real picture. */
export const SNAPSHOT_ASSET_ID = "snapshot";

/**
 * Electron's current web contents, or null.
 *
 * Two module names, because the API moved: older builds expose `remote` from
 * `electron` itself, newer ones through `@electron/remote`. Both are internals
 * of the app Hearth runs inside, so every step is guarded and a build that has
 * neither simply cannot take a picture.
 */
function webContents(): { capturePage(rect: unknown): Promise<NativeImageLike> } | null {
	if (!Platform.isDesktopApp) return null;
	const load = (window as unknown as { require?: (id: string) => unknown }).require;
	if (typeof load !== "function") return null;
	for (const id of ["@electron/remote", "electron"]) {
		try {
			const mod = load(id) as {
				getCurrentWebContents?: () => unknown;
				remote?: { getCurrentWebContents?: () => unknown };
			};
			const get = mod?.getCurrentWebContents ?? mod?.remote?.getCurrentWebContents;
			if (typeof get !== "function") continue;
			const contents: unknown = get.call(mod.remote ?? mod);
			if (contents && typeof (contents as Record<string, unknown>).capturePage === "function") {
				return contents as { capturePage(rect: unknown): Promise<NativeImageLike> };
			}
		} catch {
			// A module that isn't there, or a build that refuses it. Try the next.
		}
	}
	return null;
}

/** The slice of Electron's NativeImage this file uses. */
interface NativeImageLike {
	getSize(): { width: number; height: number };
	resize(options: { width?: number; height?: number; quality?: string }): NativeImageLike;
	toJPEG(quality: number): { length: number; toString(encoding: string): string };
	isEmpty(): boolean;
}

/** Whether this build can take a picture at all, so the dialog can offer the
 * choice rather than showing a switch that does nothing. */
export function canSnapshot(): boolean {
	return webContents() !== null;
}

/**
 * Replace every text node under `root` with blocks, and blur every embedded
 * picture. Returns the undo.
 *
 * Text nodes rather than a CSS trick, deliberately. `color: transparent` leaves
 * the characters in the document and relies on the compositor never painting
 * them; a blur leaves them recoverable in principle. Replacing the data means
 * the text is not there to be painted, which is a property of the DOM rather
 * than a property of how it happened to be rendered.
 */
function redact(root: HTMLElement): () => void {
	const originals: [Text, string][] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		const value = text.data;
		if (!value.trim()) continue;
		originals.push([text, value]);
		// Length preserved (up to the cap) so lines keep their shape, and
		// whitespace preserved so words stay words — a solid bar across a card
		// reads as a bar, while blocks with spaces read as text.
		text.data = value
			.slice(0, MAX_RUN)
			.replace(/\S/gu, BLOCK);
	}
	// Pictures inside cards are the other thing that can carry somebody's
	// content. The wallpaper is behind the grid and survives, because it is
	// already published as an asset.
	root.addClass("hearth-snapshot-redacted");
	return () => {
		for (const [node, value] of originals) node.data = value;
		root.removeClass("hearth-snapshot-redacted");
	};
}

/** One animation frame, so a style change is painted before the shutter. */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

/**
 * Photograph a rendered board.
 *
 * `hide` is anything that is on top of it — the share dialog itself — which is
 * made invisible for the duration rather than closed, so the dialog's state
 * survives and the flicker is one frame of an action that already takes a
 * second.
 *
 * Returns null for every failure, including "this build can't", and never
 * throws: a publish must not fail because a picture didn't work.
 */
export async function captureBoard(
	board: HTMLElement,
	hide: HTMLElement[] = [],
): Promise<BoardSnapshot | null> {
	const contents = webContents();
	if (!contents) return null;

	const rect = board.getBoundingClientRect();
	if (rect.width < 40 || rect.height < 40) return null;

	const restore = redact(board);
	for (const el of hide) el.addClass("hearth-snapshot-hidden");
	try {
		// Two frames: one for the redaction and the hidden dialog to be styled,
		// one for them to have been painted.
		await nextFrame();
		await nextFrame();
		const image = await contents.capturePage({
			x: Math.round(rect.left),
			y: Math.round(rect.top),
			width: Math.round(rect.width),
			height: Math.round(rect.height),
		});
		if (!image || image.isEmpty()) return null;

		const size = image.getSize();
		const scaled =
			size.width > MAX_WIDTH
				? image.resize({ width: MAX_WIDTH, quality: "good" })
				: image;
		const jpeg = scaled.toJPEG(QUALITY);
		const final = scaled.getSize();
		return {
			data: jpeg.toString("base64"),
			mime: "image/jpeg",
			bytes: jpeg.length,
			width: final.width,
			height: final.height,
		};
	} catch {
		return null;
	} finally {
		restore();
		for (const el of hide) el.removeClass("hearth-snapshot-hidden");
	}
}
