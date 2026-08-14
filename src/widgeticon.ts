import { setIcon, setTooltip, TFile } from "obsidian";
import type { HomeView } from "./view";
import { isImageFile } from "./filetypes";
import { t } from "./i18n";

/**
 * Resolve an icon string to a vault image file, or null when it isn't one. A
 * launchpad/command tile icon is normally a Lucide icon id, but it may instead
 * be the vault path of an image (#119) — recognised here by resolving to an
 * existing image file. A bare Lucide id (no slash/extension) never resolves to
 * a file, so it falls through to Lucide rendering.
 */
export function resolveIconImage(view: HomeView, icon: string | undefined): TFile | null {
	const path = icon?.trim();
	if (!path) return null;
	const file = view.app.vault.getAbstractFileByPath(path);
	return file && isImageFile(file) ? file : null;
}

/**
 * Render a launchpad/command tile's visual into `tile`, before its label:
 *
 * - When the icon string is a vault image path, the image covers the whole tile
 *   (object-fit: cover) with the label overlaid on top (#119). The caller adds
 *   the label afterwards; the `hearth-tile-has-image` class makes CSS position
 *   the image behind it and give the label a legibility scrim.
 * - Otherwise the usual centered Lucide icon slot is used (falling back to
 *   `fallback` when the string is empty).
 */
export function applyTileVisual(
	view: HomeView,
	tile: HTMLElement,
	icon: string | undefined,
	fallback: string,
): void {
	const image = resolveIconImage(view, icon);
	if (image) {
		tile.addClass("hearth-tile-has-image");
		const img = tile.createEl("img", { cls: "hearth-tile-image" });
		img.src = view.app.vault.getResourcePath(image);
		return;
	}
	setIcon(tile.createDiv("hearth-link-icon"), icon?.trim() || fallback);
}

/**
 * Append a small "?" help badge to an icon field's control row, carrying the
 * shared icon help as its tooltip so users can discover that the field accepts
 * a Lucide id or a vault image path without having to hover the input (#119).
 */
export function addIconHelp(controlEl: HTMLElement): void {
	const help = controlEl.createSpan({ cls: "hearth-icon-help", text: "?" });
	setTooltip(help, t().editors.iconHelp);
	help.setAttribute("aria-label", t().editors.iconHelp);
}
