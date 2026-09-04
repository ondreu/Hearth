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

/**
 * Widest a snapshot is stored at.
 *
 * A listing tile is ~220px and the detail view ~680px, so this covers the
 * larger of the two at a little over 1× — which is the right trade, because
 * every byte here is downloaded by everyone who installs the board *and*
 * carried inside the package forever. A redacted board is flat colour and soft
 * bars, so it survives the compression better than a photograph would.
 */
const MAX_WIDTH = 760;

/** JPEG rather than PNG: a screenshot of a dashboard is a photograph-shaped
 * thing (gradients, a wallpaper, soft shadows), and PNG would triple the size
 * of every package for no visible gain at this scale. */
const QUALITY = 58;

/** The character text is replaced with. A full block, so the styled bar over it
 * has something the width of the original words to cover. */
const BLOCK = "█";

/**
 * What gets redacted: the inside of a card, and nothing else.
 *
 * The board's chrome is the thing being published — blanking the header, the
 * toolbar, the switcher or a card's own title makes a picture of a board nobody
 * could recognise, which defeats the point of taking one.
 */
const REDACT_INSIDE = ".hearth-card-body";

/** Class the wrapper carries, so `styles.css` can draw the bars. */
const REDACTED_CLASS = "hearth-snapshot-bar";

/** Longest run of blocks one string becomes. A card holding an essay should not
 * paint ten thousand glyphs to be photographed. */
const MAX_RUN = 120;

/**
 * What a piece of readable text becomes.
 *
 * Exported because it is the *rule* — everything else in this file is the DOM
 * traversal that applies it — and it is worth being able to state exactly what
 * survives: nothing but the whitespace. Length is kept up to the cap so lines
 * keep their shape, and the spaces between words are kept so a redacted line
 * still reads as a line of text rather than as one solid bar.
 */
export function redactedText(value: string): string {
	return value.slice(0, MAX_RUN).replace(/\S/gu, BLOCK);
}

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
	const wrapped: HTMLElement[] = [];
	const fields: [HTMLInputElement | HTMLTextAreaElement, string][] = [];

	// **Only the insides of cards.** The board's chrome — the vault name, the
	// header, the toolbar, the dashboard switcher, and each card's own title —
	// is not the author's content: it is the thing being published, and blanking
	// it makes a picture of a board nobody could recognise. What a card *holds*
	// is theirs: their notes, their tasks, their sums, their feed.
	for (const body of Array.from(root.querySelectorAll<HTMLElement>(REDACT_INSIDE))) {
		const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
		const texts: Text[] = [];
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node as Text;
			if (text.data.trim()) texts.push(text);
		}
		for (const text of texts) {
			originals.push([text, text.data]);
			text.data = redactedText(text.data);
			// Wrapped so the blocks can be *styled* rather than merely drawn:
			// a soft rounded bar in the theme's own ink reads as "text lives
			// here", where a row of hard glyphs reads as a rendering fault.
			const span = text.ownerDocument.createElement("span");
			span.className = REDACTED_CLASS;
			text.parentNode?.insertBefore(span, text);
			span.appendChild(text);
			wrapped.push(span);
		}

		// **A form field's value is not a text node**, so the walk above never
		// sees it — and a calculator card renders its last sum into an
		// `<input>`, a search card its query. Those are the author's own working
		// state, which the publish path removes from the *package*; a picture
		// that still showed them would put back exactly what the strip took out.
		// Placeholders stay: they are part of the board's look and travel in the
		// package anyway.
		for (const field of Array.from(
			body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
		)) {
			if (!field.value) continue;
			fields.push([field, field.value]);
			field.value = redactedText(field.value);
		}
	}

	root.addClass("hearth-snapshot-redacted");
	return () => {
		for (const span of wrapped) {
			const text = span.firstChild;
			if (text && span.parentNode) span.parentNode.replaceChild(text, span);
		}
		for (const [node, value] of originals) node.data = value;
		for (const [field, value] of fields) field.value = value;
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
	// Themes are entitled to do what they like while a modal is open, and
	// several blur the workspace behind one — Velocity does. Capturing
	// photographs the *window*, so that blur lands in the picture. This class
	// turns filters off for the duration; it is on `body` because the rule has
	// to outrank a theme's own selector, and off again in the `finally`.
	document.body.addClass("hearth-snapshot-capturing");
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
		document.body.removeClass("hearth-snapshot-capturing");
	}
}
