/**
 * The Ko-fi tip button, in one place.
 *
 * The button started life as a single row in the About tab and now shows up in
 * three unrelated surfaces — About, the "What's new" dialog, and the add-card
 * picker's "Request a card" page. All three are places where someone has just
 * been given something (a release, a way to ask for a card), which is the only
 * moment a tip button is worth its pixels; none of them locks anything behind
 * it.
 *
 * Keeping the URL, the glyph, the label and the styling here means the three
 * can never drift apart, and a fourth surface is one call. Both entry points
 * paint the same markup: {@link kofiTipButton} for a row built with Obsidian's
 * `Setting`/`ButtonComponent`, {@link createKofiTipButton} for hand-built DOM.
 */
import { setIcon, type ButtonComponent } from "obsidian";
import { t } from "./i18n";

/** Where a tip goes. */
export const KOFI_URL = "https://ko-fi.com/ondru";

/** The Lucide glyph on the button. */
const KOFI_ICON = "coffee";

/** The shared classes: `hearth-about-btn` is the icon+label button layout
 * (defined once in `styles.css`, not About-specific despite its name) and
 * `hearth-kofi-btn` paints it in Ko-fi's own white-and-red. */
const KOFI_CLASSES = ["hearth-about-btn", "hearth-kofi-btn"];

/**
 * Fill `el` with the icon and the label, and make it open Ko-fi.
 *
 * `empty()` first because Obsidian's `setButtonText` and `setIcon` overwrite
 * each other — a button showing both has to be built by hand.
 */
function paintKofiButton(el: HTMLElement): void {
	el.empty();
	for (const cls of KOFI_CLASSES) el.addClass(cls);
	setIcon(el.createSpan("hearth-about-btn-icon"), KOFI_ICON);
	el.createSpan({ text: t().settings.about.kofiButton });
	// Same as the About row's tooltip: the destination, so the button says where
	// it goes before it is pressed.
	el.setAttribute("aria-label", KOFI_URL);
}

/** Open Ko-fi in the browser (Electron hands `_blank` to the OS handler). */
function openKofi(): void {
	window.open(KOFI_URL, "_blank");
}

/** Turn a `Setting` row's button into the Ko-fi tip button. */
export function kofiTipButton(b: ButtonComponent): void {
	b.onClick(openKofi);
	paintKofiButton(b.buttonEl);
}

/** Append the Ko-fi tip button to `parent` and return it. */
export function createKofiTipButton(parent: HTMLElement): HTMLButtonElement {
	const btn = parent.createEl("button");
	paintKofiButton(btn);
	btn.addEventListener("click", openKofi);
	return btn;
}
