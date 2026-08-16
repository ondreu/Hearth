import type { EmbedImageFit, EmbedImagePosition, EmbedView } from "./types";

/**
 * The embed card's picture-formatting half: how an embedded image fills its
 * card, where it sits, and what CSS that comes out as. Data in, data out — no
 * vault, no DOM, no Obsidian imports — so all of it is unit-tested in
 * test/embedimage.test.ts.
 *
 * It lives here rather than in `src/cards/embed.ts` for the same reason
 * `slideshow.ts` does: the card module imports the settings-modal helpers,
 * which import the card registry, which imports the card module — a cycle a
 * test importing the card module directly walks straight into.
 */

/** The fit modes offered in the editor, in dropdown order. */
export const EMBED_IMAGE_FITS: EmbedImageFit[] = [
	"natural",
	"contain",
	"cover",
	"stretch",
	"width",
];

/** The nine anchor points, in dropdown order (reading order of a 3×3 grid). */
export const EMBED_IMAGE_POSITIONS: EmbedImagePosition[] = [
	"top-left",
	"top",
	"top-right",
	"left",
	"center",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right",
];

/** The `object-position` / `transform-origin` value for each anchor point. */
const POSITION_CSS: Record<EmbedImagePosition, string> = {
	"top-left": "left top",
	top: "center top",
	"top-right": "right top",
	left: "left center",
	center: "center center",
	right: "right center",
	"bottom-left": "left bottom",
	bottom: "center bottom",
	"bottom-right": "right bottom",
};

/** Horizontal flex alignment per anchor point. `safe` so a picture wider than
 * the card still starts at its left edge instead of overflowing both ways out
 * of a centred flex line, which would put the start of it out of scroll reach. */
const POSITION_JUSTIFY: Record<EmbedImagePosition, string> = {
	"top-left": "flex-start",
	top: "safe center",
	"top-right": "safe flex-end",
	left: "flex-start",
	center: "safe center",
	right: "safe flex-end",
	"bottom-left": "flex-start",
	bottom: "safe center",
	"bottom-right": "safe flex-end",
};

/** Vertical flex alignment per anchor point (see POSITION_JUSTIFY on `safe`). */
const POSITION_ALIGN: Record<EmbedImagePosition, string> = {
	"top-left": "flex-start",
	top: "flex-start",
	"top-right": "flex-start",
	left: "safe center",
	center: "safe center",
	right: "safe center",
	"bottom-left": "safe flex-end",
	bottom: "safe flex-end",
	"bottom-right": "safe flex-end",
};

/** The fit mode a view is set to, falling back to "natural" for anything a
 * hand-edited `data.json` (or an older Hearth) left behind. */
export function embedImageFit(view: Pick<EmbedView, "imageFit">): EmbedImageFit {
	const fit = view.imageFit;
	return fit && EMBED_IMAGE_FITS.includes(fit) ? fit : "natural";
}

/** The anchor point a view is set to, falling back to the centre. */
export function embedImagePosition(
	view: Pick<EmbedView, "imagePosition">,
): EmbedImagePosition {
	const position = view.imagePosition;
	return position && EMBED_IMAGE_POSITIONS.includes(position) ? position : "center";
}

/**
 * Whether this fit mode frames the picture itself — i.e. whether Hearth draws
 * the `<img>` and sizes it, rather than handing the file to Obsidian's own
 * transclusion. False only for "natural", which is left exactly as it was
 * before the formatting options existed.
 */
export function framesEmbedImage(fit: EmbedImageFit): boolean {
	return fit !== "natural";
}

/**
 * Whether the anchor point means anything for this fit mode. "stretch" pins
 * all four edges to the card, so there is nothing left to position; "natural"
 * isn't framed by Hearth at all.
 */
export function embedImagePositionApplies(fit: EmbedImageFit): boolean {
	return fit === "contain" || fit === "cover" || fit === "width";
}

/**
 * How a framed picture takes its zoom. The card's own `zoom` on the host is no
 * use once the picture is sized against the card: zooming the host zooms the
 * box the picture is being fitted *to*, which changes nothing at 100% height
 * except overflow. So:
 *
 * - "scale" — the fitted picture is transformed about its anchor point, which
 *   is what zooming into a cropped or letterboxed picture should do.
 * - "width" — the picture is simply drawn wider than the card and the host
 *   scrolls, because a transform wouldn't reflow the height that mode derives
 *   from the width, leaving a gap under a shrunk picture.
 * - "none" — "natural", which keeps the host zoom it always had.
 */
export function embedImageZoomMode(fit: EmbedImageFit): "none" | "scale" | "width" {
	if (fit === "width") return "width";
	return framesEmbedImage(fit) ? "scale" : "none";
}

/** The CSS custom properties a framed picture is drawn with. Returned as plain
 * data so the mapping is testable without a DOM. */
export function embedImageStyle(
	fit: EmbedImageFit,
	position: EmbedImagePosition,
	scale: number,
): Record<string, string> {
	const anchor = embedImagePositionApplies(fit) ? position : "center";
	const zoom = embedImageZoomMode(fit) === "none" ? 1 : embedImageScale(scale);
	return {
		"--hearth-embed-img-pos": POSITION_CSS[anchor],
		"--hearth-embed-img-justify": POSITION_JUSTIFY[anchor],
		"--hearth-embed-img-align": POSITION_ALIGN[anchor],
		"--hearth-embed-img-scale": String(zoom),
	};
}

/** A card's zoom factor, guarded against a missing, zero or nonsense value the
 * slider can't produce but a hand-edited `data.json` can. */
export function embedImageScale(scale: number | undefined): number {
	return typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;
}
