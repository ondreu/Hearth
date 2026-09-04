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
import { type GalleryEntrySummary, GalleryError } from "./gallery";

/** What a card kind is called, and the icon it wears — taken from the card
 * registry so the gallery names a `tasks` card exactly as the picker does. A
 * kind this build has never heard of keeps its raw id and a neutral icon,
 * which is also what tells the reader they need a newer Hearth. */
export function cardKindLabel(kind: string): { name: string; icon: string } {
	// An own-property check, for the same reason `SKELETON` is a Map: `kind`
	// comes from a server, and `CARD_DEFINITIONS["toString"]` is a function
	// rather than a card definition. (`Object.hasOwn` would read better, but
	// this project targets ES2020.)
	const def = Object.prototype.hasOwnProperty.call(CARD_DEFINITIONS, kind)
		? CARD_DEFINITIONS[kind as CardKind]
		: undefined;
	const template = def?.templates?.[0];
	if (!template) return { name: kind, icon: "square-dashed" };
	return { name: templateName(template), icon: template.icon };
}

/**
 * Draw a board's picture.
 *
 * There used to be a fallback here: a drawing of the board assembled from its
 * card positions and kinds. It is gone, and the reason is worth recording so it
 * does not come back. A drawing is only useful if it is *right*, and being
 * right means reproducing a renderer — the continuous layout, the theme, the
 * card chrome, every card kind's contents — inside a 220-pixel tile. Two
 * attempts got closer and neither got close, and a thumbnail that is nearly the
 * board is worse than no thumbnail: it sells a dashboard nobody will receive.
 *
 * So a published board carries a photograph of itself, and an entry without one
 * says so plainly. See `src/gallery/snapshot.ts` for how the photograph is
 * taken and what is taken out of it first.
 *
 * `top` crops to the top of a tall picture, which is what a listing tile wants:
 * a board is photographed whole, and the first screenful is the part that
 * identifies it.
 */
export function renderPreview(
	parent: HTMLElement,
	opts: { snapshot?: string; wallpaper?: string; large?: boolean } = {},
): HTMLElement {
	const frame = parent.createDiv("hearth-gallery-preview");
	frame.toggleClass("is-large", opts.large === true);

	if (opts.snapshot) {
		frame.addClass("is-photo");
		const shot = frame.createEl("img", { cls: "hearth-gallery-preview-photo" });
		shot.src = opts.snapshot;
		shot.alt = "";
		shot.loading = "lazy";
		// A host that serves something that isn't a picture falls back to the
		// empty state rather than to a broken-image glyph.
		shot.addEventListener("error", () => {
			shot.remove();
			frame.removeClass("is-photo");
			renderNoPicture(frame);
		});
		return frame;
	}

	// A board published from a phone, or before pictures existed. Its wallpaper
	// is the one thing about its look that did travel, so it stands in.
	if (opts.wallpaper) {
		frame.addClass("is-wallpaper");
		const img = frame.createEl("img", { cls: "hearth-gallery-preview-photo" });
		img.src = opts.wallpaper;
		img.alt = "";
		img.loading = "lazy";
		img.addEventListener("error", () => {
			img.remove();
			frame.removeClass("is-wallpaper");
			renderNoPicture(frame);
		});
		return frame;
	}

	renderNoPicture(frame);
	return frame;
}

function renderNoPicture(frame: HTMLElement): void {
	frame.addClass("is-empty");
	setIcon(frame.createSpan("hearth-gallery-preview-icon"), "image-off");
	frame.createDiv({
		cls: "hearth-gallery-preview-note",
		text: t().gallery.browse.noPicture,
	});
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
	const preview = renderPreview(card, {
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
 * Open a picture at the size it was taken.
 *
 * A thumbnail is a thumbnail — 220px of a board somebody spent an evening on —
 * and the question "what does this actually look like" has no other answer.
 * Deliberately not a `Modal`: this sits *over* the dialog that opened it, and a
 * second Obsidian modal would close the first. It is a plain overlay that
 * dismisses on click or Escape.
 */
export function openPictureViewer(src: string, label: string): void {
	const overlay = document.body.createDiv("hearth-lightbox");
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-label", label);
	const img = overlay.createEl("img", { cls: "hearth-lightbox-img" });
	img.src = src;
	img.alt = label;

	const close = (): void => {
		overlay.remove();
		document.removeEventListener("keydown", onKey, true);
	};
	function onKey(evt: KeyboardEvent): void {
		if (evt.key !== "Escape") return;
		// Captured, and stopped: Escape would otherwise also reach the dialog
		// underneath and close the thing the reader was in the middle of.
		evt.preventDefault();
		evt.stopPropagation();
		close();
	}
	overlay.addEventListener("click", close);
	document.addEventListener("keydown", onKey, true);
	// Focused so Escape works without a click first, and so a screen reader
	// lands on the picture rather than behind it.
	overlay.tabIndex = -1;
	overlay.focus();
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
