/**
 * A picture for a handle, computed from the key it belongs to.
 *
 * A gallery with no accounts has no avatars to upload, and asking for one would
 * undo the thing the whole identity scheme is for: a handle says "the same hand
 * made these" and nothing else, and a photograph says rather more. So the
 * picture is *derived*, the way the handle is — the same public key always
 * gives the same one, in any vault, with nothing stored anywhere.
 *
 * What it buys is recognition rather than identity. `polished-yarrow-n5tjd6`
 * and `polished-yarrow-n5tjd5` read alike in a list of twenty, and two
 * different patterns do not. It is a **visual aid, not evidence**: an attacker
 * who wants a similar-looking mark can mint keys until they get one, exactly as
 * they can for the two words of a handle, which is why the handle is always
 * shown in full beside it and why nothing here is ever the only thing on
 * screen.
 *
 * Drawn as DOM rather than as an image: no canvas, no data URL, no request, and
 * it inherits the reader's theme.
 */

/**
 * A 5×5 identicon, mirrored down the middle.
 *
 * Mirroring is what makes these read as *marks* rather than as noise — it is
 * the trick every identicon scheme uses, and it costs half the entropy for most
 * of the recognisability. The key is 64 hex characters, so there is plenty
 * spare: the grid takes 15 cells from the first bytes and the hue from the
 * last.
 */
const GRID = 5;
const HALF = 3;

/** Two hex characters as a byte, or 0 for anything that isn't. */
function byteAt(hex: string, index: number): number {
	const pair = hex.slice(index * 2, index * 2 + 2);
	const value = Number.parseInt(pair, 16);
	return Number.isNaN(value) ? 0 : value;
}

/**
 * Draw the mark for a public key into `parent`.
 *
 * A key that isn't one still gets a picture rather than a hole: this is
 * decoration beside a handle that is itself shown in full, and a missing square
 * in a list of avatars reads as a broken gallery rather than as a warning.
 */
export function renderAvatar(parent: HTMLElement, publicKey: string, cls = ""): HTMLElement {
	const hex = /^[0-9a-f]{64}$/.test(publicKey) ? publicKey : "0".repeat(64);
	const el = parent.createDiv(`hearth-gallery-avatar ${cls}`.trim());

	// The hue comes from its own byte, so two keys that happen to share a
	// pattern still differ in colour. Saturation and lightness are fixed, which
	// keeps every mark legible against both themes rather than letting a key
	// pick something invisible.
	const hue = (byteAt(hex, 31) * 360) / 256;
	el.style.setProperty("--hearth-avatar-hue", `${Math.round(hue)}`);

	for (let y = 0; y < GRID; y++) {
		for (let x = 0; x < GRID; x++) {
			// Mirror: column 3 is column 1, column 4 is column 0.
			const column = x < HALF ? x : GRID - 1 - x;
			const bit = byteAt(hex, y * HALF + column) & 1;
			const cell = el.createDiv("hearth-gallery-avatar-cell");
			cell.toggleClass("is-on", bit === 1);
		}
	}
	return el;
}
