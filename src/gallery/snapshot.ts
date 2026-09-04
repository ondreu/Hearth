/**
 * A picture of the board, taken at publish, with everything readable taken out
 * of it first.
 *
 * A gallery entry's picture, and the only one there is. Drawing a board from
 * its card positions was tried and dropped: a diagram of a board is not a look,
 * and a board's look is what a listing is selling.
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
 *   expose. Every failure path returns null, and the publish dialog says so
 *   rather than uploading an entry with no picture in it.
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

/**
 * How many screenfuls of a scrolling board are photographed.
 *
 * A board is meant to be a screen, so most take one. This bounds what a very
 * long one costs — in the time the capture takes, in the pixels the canvas
 * holds, and in the bytes every reader downloads forever.
 */
const MAX_SCREENFULS = 4;

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

/**
 * Card kinds whose bodies are left alone, because there is nothing of the
 * author in them.
 *
 * The rule is the strip's: a card is censored when publishing removes something
 * from it or when it renders something read out of the vault. A clock renders
 * the time, a pet renders a pet, a search bar renders an empty field — none of
 * those is anybody's data, and blanking them makes the picture worse for no
 * gain. Everything else is censored, which is the safe direction for a list
 * like this to be wrong in: a kind nobody added here is protected by default.
 *
 * Deliberately *not* on it: `weather` (its place is the author's location, and
 * the strip takes it), `calculator` (its last sum is stripped), `stats` (counts
 * of somebody's vault), and every card that names a note.
 */
const OPEN_KINDS = new Set(["clock", "pet", "searchbar"]);

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
function webContents(): WebContentsLike | null {
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
				return contents as WebContentsLike;
			}
		} catch {
			// A module that isn't there, or a build that refuses it. Try the next.
		}
	}
	return null;
}

/** The slice of Electron's `webContents` this file uses. */
interface WebContentsLike {
	capturePage(rect: unknown): Promise<NativeImageLike>;
}

/** The slice of Electron's NativeImage this file uses. PNG rather than JPEG on
 * the way out of Electron: the slices are re-encoded once as a whole after
 * stitching, and putting a lossy step in front of that would compress the same
 * pixels twice. */
interface NativeImageLike {
	getSize(): { width: number; height: number };
	toPNG(): Uint8Array;
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
		if (isOpenCard(body)) continue;
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

/**
 * Whether this card's body can be photographed as it is.
 *
 * Read off the rendered card's own `data-kind`, so the answer comes from what
 * is on screen rather than from a second copy of the board's data that could
 * disagree with it. A card whose kind cannot be determined is censored, because
 * that is the direction to be wrong in.
 */
function isOpenCard(body: HTMLElement): boolean {
	const card = body.closest<HTMLElement>(".hearth-card");
	const kind = card?.dataset.kind;
	return kind !== undefined && OPEN_KINDS.has(kind);
}

/**
 * Wait for the page to have been drawn.
 *
 * Two frames, not one: the first lets a style change or a scroll be applied,
 * the second lets it be painted. Photographing between the two catches the
 * board mid-change — the redaction half-applied, or the previous scroll
 * position.
 */
function settle(): Promise<void> {
	return new Promise((resolve) =>
		window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
	);
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
	const scroller = board.querySelector<HTMLElement>(".hearth-scroll");
	const scrollFrom = scroller?.scrollTop ?? 0;

	try {
		await settle();
		const shots = await captureSlices(contents, board, rect, scroller);
		if (shots.length === 0) return null;
		return await stitch(shots, rect.width);
	} catch {
		return null;
	} finally {
		if (scroller) scroller.scrollTop = scrollFrom;
		restore();
		for (const el of hide) el.removeClass("hearth-snapshot-hidden");
		document.body.removeClass("hearth-snapshot-capturing");
	}
}

/**
 * Photograph the board one screenful at a time, scrolling between shots.
 *
 * A board is usually taller than the window it is in, and a picture of the part
 * that happens to be visible is a picture of a third of somebody's work. There
 * is no way to photograph what is off-screen — the capture takes a rectangle of
 * the *window* — so the board is scrolled through and the pieces put back
 * together afterwards.
 *
 * A board that does not scroll takes one shot and skips all of this.
 */
async function captureSlices(
	contents: WebContentsLike,
	board: HTMLElement,
	rect: DOMRect,
	scroller: HTMLElement | null,
): Promise<{ image: NativeImageLike; y: number }[]> {
	const viewport = Math.round(rect.height);
	const total = scroller
		? Math.min(scroller.scrollHeight, viewport * MAX_SCREENFULS)
		: viewport;
	const shots: { image: NativeImageLike; y: number }[] = [];

	for (let offset = 0; offset < total; offset += viewport) {
		if (scroller) {
			scroller.scrollTop = offset;
			await settle();
			// The scroller may have refused — it is already at the bottom, or the
			// board is shorter than it claimed. Taking the same shot twice would
			// stitch a repeat of it into the picture.
			if (shots.length > 0 && Math.abs(scroller.scrollTop - offset) > 2) break;
		}
		const image = await contents.capturePage({
			x: Math.round(rect.left),
			y: Math.round(rect.top),
			width: Math.round(rect.width),
			height: viewport,
		});
		if (!image || image.isEmpty()) break;
		shots.push({ image, y: scroller ? scroller.scrollTop : 0 });
		if (!scroller) break;
	}
	return shots;
}

/**
 * Put the screenfuls back into one picture, and scale it down.
 *
 * Through a canvas, because that is the only thing in a renderer that can
 * compose images — and it is also what applies the scale, so the resize and the
 * join cost one decode each rather than one per slice.
 */
async function stitch(
	shots: { image: NativeImageLike; y: number }[],
	cssWidth: number,
): Promise<BoardSnapshot | null> {
	// The captures are in device pixels; the offsets are in CSS pixels. One
	// ratio converts between them, and taking it from the picture rather than
	// from `devicePixelRatio` means it is right even on a display Obsidian
	// disagrees with.
	const first = shots[0].image.getSize();
	const ratio = first.width / cssWidth;
	const last = shots[shots.length - 1];
	const height = Math.round(last.y * ratio) + last.image.getSize().height;

	const scale = Math.min(1, MAX_WIDTH / first.width);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(first.width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.imageSmoothingQuality = "high";

	for (const shot of shots) {
		const bitmap = await decode(shot.image);
		if (!bitmap) return null;
		ctx.drawImage(
			bitmap,
			0,
			Math.round(shot.y * ratio * scale),
			canvas.width,
			Math.round(bitmap.height * scale),
		);
		bitmap.close?.();
	}

	const url = canvas.toDataURL("image/jpeg", QUALITY / 100);
	const data = url.slice(url.indexOf(",") + 1);
	if (!data) return null;
	return {
		data,
		mime: "image/jpeg",
		// base64 is four characters per three bytes; the padding is the remainder.
		bytes: Math.floor((data.length * 3) / 4),
		width: canvas.width,
		height: canvas.height,
	};
}

/** An Electron image as something a canvas can draw. */
async function decode(image: NativeImageLike): Promise<ImageBitmap | null> {
	try {
		// Copied into a plain ArrayBuffer: what Electron hands back is a Node
		// Buffer, whose backing store TypeScript will not accept as a BlobPart.
		const png = image.toPNG();
		const bytes = new Uint8Array(png.byteLength);
		bytes.set(png);
		const blob = new Blob([bytes.buffer], { type: "image/png" });
		return await createImageBitmap(blob);
	} catch {
		return null;
	}
}
