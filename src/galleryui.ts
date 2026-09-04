/**
 * The pieces the three gallery views share: a board drawn as a thumbnail, an
 * entry drawn as a row, an author drawn as something you can click, and one
 * place that turns a {@link GalleryError} into a sentence.
 *
 * One rule runs through all of it. **Everything here comes from a server
 * somebody else runs**, so every value reaches the DOM as text or as a number
 * that has already been clamped — `createDiv({ text })` and `setText`, never
 * `innerHTML`, and no string from a response is ever interpolated into a style,
 * a URL or an attribute that could become one. The preview is drawn from the
 * numbers `src/gallery/preview.ts` validated; the only picture that is ever
 * fetched is an entry's wallpaper, which goes through `img.src` exactly as a
 * vault image does and is a raster type by the format's own allowlist.
 */

import { setIcon } from "obsidian";
import { CARD_DEFINITIONS, templateName } from "./cards";
import type { CardKind } from "./types";
import { t } from "./i18n";
import { makeClickable } from "./ui";
import { renderAvatar } from "./galleryavatar";
import {
	type GalleryEntrySummary,
	GalleryError,
	type GalleryPreview,
	type PreviewTile,
	PREVIEW_MAX_ROWS,
} from "./gallery";

/** What a card kind is called, and the icon it wears — taken from the card
 * registry so the gallery names a `tasks` card exactly as the picker does. A
 * kind this build has never heard of keeps its raw id and a neutral icon,
 * which is also what tells the reader they need a newer Hearth. */
export function cardKindLabel(kind: string): { name: string; icon: string } {
	const def = CARD_DEFINITIONS[kind as CardKind];
	const template = def?.templates?.[0];
	if (!template) return { name: kind, icon: "square-dashed" };
	return { name: templateName(template), icon: template.icon };
}

/**
 * What a card's body looks like from across the room.
 *
 * A thumbnail made of plain rectangles tells you a board has six cards and
 * nothing else — which is the complaint this table answers. Every card kind
 * draws a *skeleton* of its real shape instead: a tasks card is a stack of
 * rows, a calendar is a month grid, a clock is a dial, a stats card is one big
 * number over two small ones. At 220 pixels wide that is the difference between
 * "some board" and "a planning board with a big calendar and a task list down
 * the side".
 *
 * The alternative was a screenshot taken at publish, with the author's text
 * blurred or replaced. It is worse in four ways, and they are not effort: a
 * screenshot is of somebody else's window size and somebody else's theme, so it
 * looks wrong in a light-theme gallery; censoring text in a raster is either a
 * blur that reads as a rendering bug or a pre-capture text swap, which means
 * rendering a mangled board anyway; phones cannot capture at all; and it is a
 * standing privacy risk where one bug ships somebody's note titles. This
 * carries the layout, the kinds, the titles, the colours and the real
 * wallpaper — most of what a screenshot conveys, minus the part nobody wants
 * published.
 */
type SkeletonShape = "rows" | "grid" | "dial" | "paragraph" | "figure" | "tiles" | "block";

const SKELETON: Record<string, SkeletonShape> = {
	tasks: "rows",
	schedule: "rows",
	recent: "rows",
	favorites: "rows",
	bookmarks: "rows",
	rss: "rows",
	git: "rows",
	jira: "rows",
	search: "rows",
	dataview: "rows",
	datacore: "rows",
	operon: "rows",
	calendar: "grid",
	heatmap: "grid",
	clock: "dial",
	weather: "figure",
	stats: "figure",
	calculator: "figure",
	text: "paragraph",
	embed: "paragraph",
	daily: "paragraph",
	periodic: "paragraph",
	links: "tiles",
	commands: "tiles",
	templater: "tiles",
	slideshow: "block",
	web: "block",
	pet: "block",
	leaf: "block",
	searchbar: "block",
};

/** Bar widths per skeleton row, as percentages — uneven on purpose, because a
 * stack of identical bars reads as a loading state rather than as content. */
const ROW_WIDTHS = [92, 74, 85, 62, 80, 70];

/**
 * Draw a board as a thumbnail.
 *
 * A real grid of positioned blocks in the reader's own theme, carrying the
 * board's own column count, corner radius, card opacity and background — see
 * the note above for why it is drawn from numbers rather than shown as a
 * picture, and `src/gallery/preview.ts` for what those numbers are held to.
 *
 * `snapshot` is the author's own redacted photograph of the board, and when
 * there is one it *replaces* everything below: it is the board as it really
 * looks, and no arrangement of rectangles beats that. Everything after this
 * point is what stands in when there isn't one.
 *
 * `wallpaper` is the entry's real wallpaper; passing it puts the actual picture
 * behind the blocks, which is the difference between a thumbnail that
 * identifies a board and one that identifies a layout.
 */
export function renderPreview(
	parent: HTMLElement,
	preview: GalleryPreview | null,
	opts: { wallpaper?: string; snapshot?: string; large?: boolean } = {},
): HTMLElement {
	const frame = parent.createDiv("hearth-gallery-preview");
	frame.toggleClass("is-large", opts.large === true);

	// A real picture of the board, when its author published one.
	if (opts.snapshot) {
		frame.addClass("is-photo");
		const shot = frame.createEl("img", { cls: "hearth-gallery-preview-photo" });
		shot.src = opts.snapshot;
		shot.alt = "";
		shot.loading = "lazy";
		// A host that serves something that isn't a picture falls back to the
		// drawn preview rather than to a broken-image glyph.
		shot.addEventListener("error", () => {
			shot.remove();
			frame.removeClass("is-photo");
			renderDrawn(frame, preview, opts);
		});
		return frame;
	}

	renderDrawn(frame, preview, opts);
	return frame;
}

/** The drawn stand-in: chrome, a grid, and a skeleton per card. */
function renderDrawn(
	frame: HTMLElement,
	preview: GalleryPreview | null,
	opts: { wallpaper?: string; large?: boolean },
): void {
	if (!preview) {
		frame.addClass("is-empty");
		setIcon(frame.createSpan("hearth-gallery-preview-icon"), "image-off");
		return;
	}

	const bg = preview.background;
	if (bg?.color) frame.style.setProperty("--hearth-gallery-preview-bg", bg.color);
	if (bg?.hasImage && opts.wallpaper) {
		const img = frame.createEl("img", { cls: "hearth-gallery-preview-wall" });
		// `src` and nothing else: the URL is built by the client from the
		// configured host and an id that has already been held to a plain shape,
		// and the response is rendered by the image decoder rather than parsed.
		img.src = opts.wallpaper;
		img.alt = "";
		img.loading = "lazy";
		// A host that serves something that isn't a picture gets the flat
		// backdrop instead of a broken-image glyph.
		img.addEventListener("error", () => img.remove());
	} else if (bg?.hasImage) {
		frame.addClass("has-wallpaper");
	}

	if (preview.pluginBoard) {
		// A board that hosts one plugin's view has no grid to draw, and a blank
		// tile would read as "an empty board" rather than as what it is.
		frame.addClass("is-plugin-board");
		frame.setAttribute("aria-label", t().gallery.browse.pluginBoard);
		setIcon(frame.createSpan("hearth-gallery-preview-icon"), "layout-panel-top");
		frame.createDiv({
			cls: "hearth-gallery-preview-note",
			text: t().gallery.browse.pluginBoard,
		});
		return;
	}

	const inner = frame.createDiv("hearth-gallery-preview-inner");
	// The chrome above the grid, because a board with a heading and a search row
	// looks different from one without, and that difference is visible at
	// thumbnail size where the cards' contents are not.
	if (preview.header || preview.search) {
		const chrome = inner.createDiv("hearth-gallery-preview-chrome");
		if (preview.header) chrome.createDiv("hearth-gallery-preview-title");
		if (preview.search) chrome.createDiv("hearth-gallery-preview-searchbar");
	}

	const grid = inner.createDiv("hearth-gallery-preview-grid");
	grid.style.setProperty("--hearth-preview-cols", String(preview.columns));
	grid.style.setProperty("--hearth-preview-rows", String(Math.min(preview.rows, PREVIEW_MAX_ROWS)));
	if (preview.radius !== undefined) {
		grid.style.setProperty("--hearth-preview-radius", `${preview.radius}px`);
	}
	if (preview.opacity !== undefined) {
		grid.style.setProperty("--hearth-preview-opacity", String(preview.opacity));
	}
	for (const tile of preview.tiles) renderTile(grid, tile, opts.large === true);
}

/** One card: its chrome, and a skeleton of what it holds. */
function renderTile(grid: HTMLElement, tile: PreviewTile, large: boolean): void {
	const el = grid.createDiv("hearth-gallery-preview-tile");
	// Grid lines are 1-based, and every one of these numbers was clamped
	// against the column count when the preview was read.
	el.style.gridColumn = `${tile.x + 1} / span ${tile.w}`;
	el.style.gridRow = `${tile.y + 1} / span ${tile.h}`;

	// Below this a card is a swatch: a header and a skeleton inside four square
	// millimetres is noise, and noise at thumbnail size reads as a broken image.
	const roomy = tile.w >= 2 && tile.h >= 2;
	if (!roomy) {
		if (tile.kind) el.addClass("is-tiny");
		return;
	}

	const head = el.createDiv("hearth-gallery-preview-tile-head");
	if (tile.kind) {
		setIcon(head.createSpan("hearth-gallery-preview-tile-icon"), cardKindLabel(tile.kind).icon);
	}
	// The title only where there is room to read one. A truncated word is worse
	// than the icon on its own, and a small tile has the icon.
	const wide = large ? tile.w >= 2 : tile.w >= 3;
	const label = tile.title ?? (tile.kind ? cardKindLabel(tile.kind).name : "");
	if (wide && label) {
		head.createSpan({ cls: "hearth-gallery-preview-tile-title", text: label });
	}

	const body = el.createDiv("hearth-gallery-preview-tile-body");
	renderSkeleton(body, SKELETON[tile.kind] ?? "paragraph", tile.h);
}

/** The shape of a card's contents, at thumbnail scale. */
function renderSkeleton(body: HTMLElement, shape: SkeletonShape, height: number): void {
	body.addClass(`is-${shape}`);
	switch (shape) {
		case "rows": {
			// One row per grid row the card is tall, so a tall list looks like a
			// long list rather than like a short one with space under it.
			const count = Math.min(ROW_WIDTHS.length, Math.max(2, height - 1));
			for (let i = 0; i < count; i++) {
				const row = body.createDiv("hearth-gallery-preview-row");
				// A custom property rather than `style.width`: the width is data
				// (an uneven stack reads as content, an even one as a loading
				// state) while what it means to be that wide stays in the
				// stylesheet.
				row.style.setProperty("--hearth-preview-w", `${ROW_WIDTHS[i]}%`);
			}
			break;
		}
		case "paragraph": {
			const count = Math.min(4, Math.max(2, height - 1));
			for (let i = 0; i < count; i++) {
				const last = i === count - 1;
				const line = body.createDiv("hearth-gallery-preview-line");
				// The last line short, the way a paragraph ends — a fixed width,
				// so it is a class rather than a value computed into a style.
				if (last) line.addClass("is-last");
				else line.style.setProperty("--hearth-preview-w", `${ROW_WIDTHS[i % ROW_WIDTHS.length]}%`);
			}
			break;
		}
		case "grid": {
			// A month, roughly: seven across, as many weeks as the card is tall.
			const weeks = Math.min(5, Math.max(2, height - 1));
			for (let i = 0; i < weeks * 7; i++) body.createDiv("hearth-gallery-preview-cell");
			break;
		}
		case "tiles": {
			const count = Math.min(8, Math.max(2, (height - 1) * 2));
			for (let i = 0; i < count; i++) body.createDiv("hearth-gallery-preview-chip");
			break;
		}
		case "dial":
			body.createDiv("hearth-gallery-preview-dial");
			break;
		case "figure": {
			body.createDiv("hearth-gallery-preview-figure");
			body.createDiv("hearth-gallery-preview-line").addClass("is-sub");
			break;
		}
		case "block":
			body.createDiv("hearth-gallery-preview-block");
			break;
	}
}

/** The author line, which is also the way into their profile. An entry with no
 * provable author says so rather than naming one — an unsigned package and one
 * whose signature failed are equally not evidence of who made it. */
export function renderAuthor(
	parent: HTMLElement,
	entry: GalleryEntrySummary,
	onOpenProfile?: (publicKey: string) => void,
): void {
	const strings = t().gallery.browse;
	if (!entry.author) {
		parent.createSpan({ cls: "hearth-gallery-author is-anonymous", text: strings.anonymous });
		return;
	}
	// The mark beside the name, so a shelf of boards by one person reads as one
	// person's shelf without anybody parsing six-character suffixes.
	const line = parent.createDiv("hearth-gallery-author-line");
	renderAvatar(line, entry.author.publicKey, "is-inline");
	const el = line.createSpan({
		cls: "hearth-gallery-author",
		// The whole handle, suffix included: `polished-yarrow-n5tjd6` and
		// `…-n5tjd5` read the same to anyone skimming, and truncating to the two
		// words would make impersonation a matter of minting keys until they
		// match.
		text: strings.byAuthor(entry.author.handle),
	});
	if (!onOpenProfile) return;
	el.addClass("is-clickable");
	const key = entry.author.publicKey;
	activate(el, () => onOpenProfile(key), t().gallery.detail.profile(entry.author.handle));
}

/**
 * Make an element behave like a button, for the pointer *and* the keyboard.
 *
 * `makeClickable` deliberately only does the keyboard half — its contract is
 * that the caller wires the click up separately, which every other caller in
 * the codebase does. Doing both in one place here because these views have
 * three clickable non-buttons and forgetting the pointer on any of them looks
 * exactly like a broken gallery.
 */
export function activate(el: HTMLElement, onActivate: () => void, label?: string): void {
	makeClickable(el, onActivate, label);
	el.addEventListener("click", (evt) => {
		// A card's author sits inside the card: without this, opening a profile
		// would open the entry behind it too.
		evt.stopPropagation();
		onActivate();
	});
}

/** Score and installs, the two numbers every row carries. */
export function renderStats(parent: HTMLElement, entry: GalleryEntrySummary): void {
	const strings = t().gallery.browse;
	const stats = parent.createDiv("hearth-gallery-stats");

	const score = stats.createDiv("hearth-gallery-stat");
	score.toggleClass("is-positive", entry.score > 0);
	score.toggleClass("is-negative", entry.score < 0);
	setIcon(score.createSpan("hearth-gallery-stat-icon"), "arrow-big-up");
	score.createSpan({ cls: "hearth-gallery-stat-value", text: strings.score(entry.score) });

	const downloads = stats.createDiv("hearth-gallery-stat");
	setIcon(downloads.createSpan("hearth-gallery-stat-icon"), "download");
	downloads.createSpan({
		cls: "hearth-gallery-stat-value",
		text: String(entry.downloads),
	});
}

/** One entry, as the browse grid shows it. */
export function renderEntryCard(
	grid: HTMLElement,
	entry: GalleryEntrySummary,
	opts: {
		wallpaper?: string;
		snapshot?: string;
		onOpen: (entry: GalleryEntrySummary) => void;
		onOpenProfile?: (publicKey: string) => void;
	},
): HTMLElement {
	const card = grid.createDiv("hearth-gallery-card");
	const preview = renderPreview(card, entry.preview, {
		wallpaper: opts.wallpaper,
		snapshot: opts.snapshot,
	});
	activate(preview, () => opts.onOpen(entry), entry.name);

	const body = card.createDiv("hearth-gallery-card-body");
	const title = body.createDiv({ cls: "hearth-gallery-card-name", text: entry.name });
	activate(title, () => opts.onOpen(entry), entry.name);
	renderAuthor(body, entry, opts.onOpenProfile);
	if (entry.description) {
		body.createDiv({ cls: "hearth-gallery-card-desc", text: entry.description });
	}
	renderStats(body, entry);
	return card;
}

/**
 * What went wrong, in a sentence.
 *
 * The host's own explanation is shown only for the two codes where it is a
 * message meant for a person — a refusal and a rejection it chose the wording
 * of. For everything else Hearth says what happened in its own words, because
 * a server's 500-page body is not an error message and pasting one into a modal
 * teaches people to read arbitrary text from an arbitrary host as instructions.
 */
export function galleryErrorText(err: unknown): string {
	const strings = t().gallery.errors;
	if (!(err instanceof GalleryError)) return strings.server;
	switch (err.code) {
		case "noHost":
			return strings.noHost;
		case "offline":
			return strings.offline;
		case "badResponse":
			return strings.badResponse;
		case "unauthorized":
			return strings.unauthorized;
		// The host's own sentence, like a 422: a refusal a signed-in caller got
		// is about the request, and the commonest one — "that dashboard id
		// belongs to another author" — carries the fix with it.
		case "forbidden":
			return err.detail ? strings.rejected(err.detail) : strings.forbidden;
		case "rateLimited":
			return strings.rateLimited;
		case "tooLarge":
			return strings.tooLarge;
		case "notFound":
			return strings.notFound;
		case "rejected":
			return err.detail ? strings.rejected(err.detail) : strings.server;
		default:
			return strings.server;
	}
}

/** A date the server sent, as the reader's locale writes it. Dates from a
 * gallery are absolute rather than relative to the vault's clock, so they are
 * formatted rather than run through Hearth's "3 days ago" wording. */
export function galleryDate(iso: string | undefined): string {
	if (!iso) return "";
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return "";
	return new Date(ms).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** A modal-sized "nothing to show" block: an icon, a line, and nothing else. */
export function renderEmpty(parent: HTMLElement, icon: string, text: string): void {
	const empty = parent.createDiv("hearth-gallery-empty");
	setIcon(empty.createSpan("hearth-gallery-empty-icon"), icon);
	empty.createDiv({ cls: "hearth-gallery-empty-text", text });
}
