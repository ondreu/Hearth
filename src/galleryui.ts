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
import {
	type GalleryEntrySummary,
	GalleryError,
	type GalleryPreview,
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
 * Draw a board as a thumbnail.
 *
 * A grid of positioned blocks, one per card, in the reader's own theme — see
 * the note at the top of `src/gallery/preview.ts` for why it is drawn from
 * numbers rather than shown as a picture. The board's own corner radius and
 * card opacity come through, because those are most of what makes one board
 * look different from another at this size.
 *
 * `wallpaperUrl` is the entry's real wallpaper when it has one; passing it puts
 * the actual picture behind the blocks, which is the difference between a
 * thumbnail that identifies a board and one that identifies a layout.
 */
export function renderPreview(
	parent: HTMLElement,
	preview: GalleryPreview | null,
	wallpaperUrl?: string,
): HTMLElement {
	const frame = parent.createDiv("hearth-gallery-preview");
	if (!preview) {
		frame.addClass("is-empty");
		setIcon(frame.createSpan("hearth-gallery-preview-icon"), "image-off");
		return frame;
	}

	const bg = preview.background;
	if (bg?.color) frame.style.setProperty("--hearth-gallery-preview-bg", bg.color);
	if (bg?.hasImage && wallpaperUrl) {
		const img = frame.createEl("img", { cls: "hearth-gallery-preview-wall" });
		// `src` and nothing else: the URL is built by the client from the
		// configured host and an id that has already been held to a plain shape,
		// and the response is rendered by the image decoder rather than parsed.
		img.src = wallpaperUrl;
		img.alt = "";
		img.loading = "lazy";
		// A host that serves something that isn't a picture gets the flat
		// backdrop instead of a broken-image glyph.
		img.addEventListener("error", () => img.remove());
	} else if (bg?.hasImage) {
		frame.addClass("has-wallpaper");
	}

	if (preview.pluginBoard) {
		frame.addClass("is-plugin-board");
		setIcon(frame.createSpan("hearth-gallery-preview-icon"), "layout-panel-top");
		return frame;
	}

	const grid = frame.createDiv("hearth-gallery-preview-grid");
	grid.style.setProperty("--hearth-preview-cols", String(preview.columns));
	grid.style.setProperty("--hearth-preview-rows", String(Math.min(preview.rows, PREVIEW_MAX_ROWS)));
	if (preview.radius !== undefined) {
		grid.style.setProperty("--hearth-preview-radius", `${preview.radius}px`);
	}
	if (preview.opacity !== undefined) {
		grid.style.setProperty("--hearth-preview-opacity", String(preview.opacity));
	}
	for (const tile of preview.tiles) {
		const el = grid.createDiv("hearth-gallery-preview-tile");
		// Grid lines are 1-based, and every one of these numbers was clamped
		// against the column count when the preview was read.
		el.style.gridColumn = `${tile.x + 1} / span ${tile.w}`;
		el.style.gridRow = `${tile.y + 1} / span ${tile.h}`;
		if (tile.w >= 2 && tile.h >= 2 && tile.kind) {
			setIcon(el.createSpan("hearth-gallery-preview-tile-icon"), cardKindLabel(tile.kind).icon);
		}
	}
	return frame;
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
	const el = parent.createSpan({
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
	makeClickable(el, () => onOpenProfile(key), t().gallery.detail.profile(entry.author.handle));
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
		wallpaperUrl?: string;
		onOpen: (entry: GalleryEntrySummary) => void;
		onOpenProfile?: (publicKey: string) => void;
	},
): HTMLElement {
	const card = grid.createDiv("hearth-gallery-card");
	const preview = renderPreview(card, entry.preview, opts.wallpaperUrl);
	makeClickable(preview, () => opts.onOpen(entry), entry.name);

	const body = card.createDiv("hearth-gallery-card-body");
	const title = body.createDiv({ cls: "hearth-gallery-card-name", text: entry.name });
	makeClickable(title, () => opts.onOpen(entry), entry.name);
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
