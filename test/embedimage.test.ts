import { describe, expect, it } from "vitest";
import {
	EMBED_IMAGE_FITS,
	EMBED_IMAGE_POSITIONS,
	embedImageFit,
	embedImagePosition,
	embedImagePositionApplies,
	embedImageScale,
	embedImageStyle,
	embedImageZoomMode,
	framesEmbedImage,
} from "../src/embedimage";
import { isImagePath } from "../src/filetypes";
import type { EmbedImageFit, EmbedImagePosition, EmbedView } from "../src/types";

/**
 * The embed card's picture formatting: which fit mode and anchor point a view
 * resolves to, and the CSS that comes out of the pair. Data in, data out — the
 * `<img>` those properties end up on is deliberately untested, per the "no
 * Obsidian API mocks" rule.
 */

function view(extra: Partial<EmbedView> = {}): EmbedView {
	return { target: "Attachments/photo.png", ...extra };
}

describe("embedImageFit", () => {
	it("defaults to the untouched natural mode", () => {
		expect(embedImageFit(view())).toBe("natural");
	});

	it("returns the mode a view is set to", () => {
		for (const fit of EMBED_IMAGE_FITS) {
			expect(embedImageFit(view({ imageFit: fit }))).toBe(fit);
		}
	});

	it("falls back to natural for a mode Hearth doesn't have", () => {
		// A hand-edited data.json, or a board exported by a newer Hearth.
		const rogue = { imageFit: "parallax" as unknown as EmbedImageFit };
		expect(embedImageFit(rogue)).toBe("natural");
	});
});

describe("embedImagePosition", () => {
	it("defaults to the centre", () => {
		expect(embedImagePosition(view())).toBe("center");
	});

	it("returns each of the nine anchor points", () => {
		for (const position of EMBED_IMAGE_POSITIONS) {
			expect(embedImagePosition(view({ imagePosition: position }))).toBe(position);
		}
	});

	it("falls back to the centre for an anchor point that isn't one of the nine", () => {
		const rogue = { imagePosition: "middle" as unknown as EmbedImagePosition };
		expect(embedImagePosition(rogue)).toBe("center");
	});
});

describe("framesEmbedImage", () => {
	it("leaves natural on Obsidian's own transclusion", () => {
		expect(framesEmbedImage("natural")).toBe(false);
	});

	it("frames every mode that sizes the picture against the card", () => {
		for (const fit of EMBED_IMAGE_FITS.filter((f) => f !== "natural")) {
			expect(framesEmbedImage(fit)).toBe(true);
		}
	});
});

describe("embedImagePositionApplies", () => {
	it("applies where the picture has room to move", () => {
		expect(embedImagePositionApplies("contain")).toBe(true);
		expect(embedImagePositionApplies("cover")).toBe(true);
		expect(embedImagePositionApplies("width")).toBe(true);
	});

	it("does not apply where there is nothing to position", () => {
		// Stretch pins all four edges; natural isn't framed by Hearth at all.
		expect(embedImagePositionApplies("stretch")).toBe(false);
		expect(embedImagePositionApplies("natural")).toBe(false);
	});
});

describe("embedImageZoomMode", () => {
	it("keeps the host zoom for natural", () => {
		expect(embedImageZoomMode("natural")).toBe("none");
	});

	it("transforms the fitted picture for the framed modes", () => {
		expect(embedImageZoomMode("contain")).toBe("scale");
		expect(embedImageZoomMode("cover")).toBe("scale");
		expect(embedImageZoomMode("stretch")).toBe("scale");
	});

	it("widens the picture in fit-the-width, so its height reflows", () => {
		expect(embedImageZoomMode("width")).toBe("width");
	});
});

describe("embedImageScale", () => {
	it("defaults to 1 when unset", () => {
		expect(embedImageScale(undefined)).toBe(1);
	});

	it("passes a real factor through", () => {
		expect(embedImageScale(1.5)).toBe(1.5);
		expect(embedImageScale(0.5)).toBe(0.5);
	});

	it("rejects factors that would make the picture vanish or break layout", () => {
		expect(embedImageScale(0)).toBe(1);
		expect(embedImageScale(-2)).toBe(1);
		expect(embedImageScale(Number.NaN)).toBe(1);
		expect(embedImageScale(Number.POSITIVE_INFINITY)).toBe(1);
	});
});

describe("embedImageStyle", () => {
	it("turns an anchor point into an object-position and a transform origin", () => {
		const style = embedImageStyle("cover", "top-left", 1);
		expect(style["--hearth-embed-img-pos"]).toBe("left top");
		expect(style["--hearth-embed-img-justify"]).toBe("flex-start");
		expect(style["--hearth-embed-img-align"]).toBe("flex-start");
	});

	it("centres every mode that has nothing to position", () => {
		for (const fit of ["stretch", "natural"] as EmbedImageFit[]) {
			const style = embedImageStyle(fit, "bottom-right", 1);
			expect(style["--hearth-embed-img-pos"]).toBe("center center");
		}
	});

	it("carries the zoom factor for a framed picture", () => {
		expect(embedImageStyle("cover", "center", 1.5)["--hearth-embed-img-scale"]).toBe("1.5");
		expect(embedImageStyle("width", "center", 0.75)["--hearth-embed-img-scale"]).toBe("0.75");
	});

	it("never zooms an unframed picture through these properties", () => {
		// Natural keeps the host's own `zoom`, so the image scale stays neutral.
		expect(embedImageStyle("natural", "center", 1.5)["--hearth-embed-img-scale"]).toBe("1");
	});

	it("neutralises a nonsense zoom factor", () => {
		expect(embedImageStyle("cover", "center", 0)["--hearth-embed-img-scale"]).toBe("1");
	});

	it("emits every anchor point as a usable CSS pair", () => {
		for (const position of EMBED_IMAGE_POSITIONS) {
			const style = embedImageStyle("contain", position, 1);
			expect(style["--hearth-embed-img-pos"]).toMatch(
				/^(left|center|right) (top|center|bottom)$/,
			);
			expect(style["--hearth-embed-img-justify"]).toMatch(
				/^(flex-start|safe center|safe flex-end)$/,
			);
			expect(style["--hearth-embed-img-align"]).toMatch(
				/^(flex-start|safe center|safe flex-end)$/,
			);
		}
	});
});

describe("isImagePath", () => {
	it("recognises the picture formats Hearth draws", () => {
		expect(isImagePath("Attachments/photo.png")).toBe(true);
		expect(isImagePath("cover.JPG")).toBe(true);
		expect(isImagePath("a/b/diagram.svg")).toBe(true);
		expect(isImagePath("  spaced.webp  ")).toBe(true);
	});

	it("rejects everything the formatting options don't apply to", () => {
		expect(isImagePath("Notes/note.md")).toBe(false);
		expect(isImagePath("Boards/tasks.base")).toBe(false);
		expect(isImagePath("Drawing.excalidraw.md")).toBe(false);
		expect(isImagePath("clip.mp4")).toBe(false);
	});

	it("handles a path with no usable extension", () => {
		expect(isImagePath("")).toBe(false);
		expect(isImagePath(undefined)).toBe(false);
		expect(isImagePath("README")).toBe(false);
		// A dot in a folder name is not the file's extension.
		expect(isImagePath("my.png.folder/file")).toBe(false);
	});
});
