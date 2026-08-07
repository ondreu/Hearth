/**
 * Hearth's brand mark: the four-facet crystal, traced from assets/icon.png
 * into four closed vector subpaths (one per facet, mirroring the transparent
 * gaps that separated the facets in the raster).
 *
 * Two variants are registered:
 * - the brand mark, filled with the raster's flat purple (#A179FF) so the
 *   default look matches the original PNG; and
 * - a themeable mark drawn with `currentColor` so Obsidian's normal icon
 *   theming applies. Its facets are inset ~1.5 units toward their centroids,
 *   widening the gaps so the four facets still read at ribbon/header sizes
 *   when everything is a single color.
 *
 * The content is sized to Obsidian's 0 0 100 100 icon viewBox.
 */
export const HEARTH_ICON_ID = "hearth-crystal";
export const HEARTH_ICON_THEMED_ID = "hearth-crystal-themed";

/** The flat purple of assets/icon.png. */
const BRAND_PURPLE = "#A179FF";

const FACETS =
	"M51.8 0L54.5 0.2L56.1 2L57.4 5.1L57.4 8.4L49.6 26.4L47.3 35L47.3 46.3L50 56.1L38.9 58.2L33.8 47.9L24 36.1L24 34.6L26.8 21.3L48.4 1.6L51.6 0.2ZM62.1 7.8L76.4 26.2L77.3 38.7L79.3 46.9L88.7 62.5L87.7 65.8L80.7 77L76.2 68.8L69.7 61.7L63.1 57.8L55.1 56.1L54.7 55.3L52 45.9L51.8 36.9L53.9 28.1L60.2 15L62.1 8ZM23 41.4L28.3 47.9L33.2 56.4L36.5 68.6L35.5 80.3L33.8 85.4L30.1 91.6L12.1 73L11.1 70.3L11.5 67.2L23 41.6ZM50.8 60.5L57.4 60.9L63.5 63.1L70.3 68.8L74 73.8L77.5 82.2L74.2 94.3L72.5 97.3L69.7 99.2L65.8 99.8L48.4 95.1L34.2 93.9L38.5 86.1L40.6 78.7L41.2 69.1L40.2 62.5L50.6 60.7Z";

const FACETS_INSET =
	"M51.4 1.4L53.9 1.6L55.4 3.3L56.6 6.3L56.5 9.6L48.3 25.7L47 33.5L47.1 44.8L49.8 54.6L39.2 56.7L34.4 46.5L25.3 35.3L25.3 33.9L28.3 21.5L48.2 3.1L51.2 1.6ZM62.3 9.3L75.8 27.6L76 39.5L77.8 46.6L87.6 61.5L86.7 64.7L80.1 75.6L75.7 67.4L69.5 60.2L63.6 56.4L56.2 55.1L55.9 54.3L53.5 45.8L53.1 37.6L54.9 29.3L60.6 16.5L62.3 9.5ZM23.1 42.9L28.1 49.4L32.2 57.5L35 68.2L34.6 79.1L33.2 84L29.8 90.1L13.4 72.3L12.5 69.8L13 67L23.1 43.1ZM51.3 61.9L57.4 62.4L62.9 64.5L69.1 69.7L72.6 74.3L76 82L73.1 93.3L71.5 96.2L68.9 97.9L65.2 98.4L49.1 93.8L35.5 93.1L39.9 85.6L42.1 78.7L42.5 69.9L41.3 63.6L51.1 62.1Z";

export const HEARTH_ICON_SVG = `<path fill="${BRAND_PURPLE}" d="${FACETS}"/>`;
export const HEARTH_ICON_THEMED_SVG = `<path fill="currentColor" d="${FACETS_INSET}"/>`;

/** Icon id for a theme-color target: the themed (currentColor) mark when the
 * icon follows the theme, the brand-purple mark otherwise. */
export function hearthIconIdFor(target: "none" | "icon" | "title" | "both"): string {
	return target === "icon" || target === "both" ? HEARTH_ICON_THEMED_ID : HEARTH_ICON_ID;
}
