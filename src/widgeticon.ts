import { setIcon, TFile } from "obsidian";
import type { HomeView } from "./view";

/** Image file extensions a widget tile can use as its icon (#119). */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "ico"]);

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
	return file instanceof TFile && IMAGE_EXTS.has(file.extension.toLowerCase()) ? file : null;
}

/**
 * Render a widget tile's icon into `el`: a vault image when the icon string is
 * an image path, otherwise a Lucide icon (falling back to `fallback` when the
 * string is empty). Shared by the launchpad and command cards so both accept
 * either kind (#119).
 */
export function applyWidgetIcon(
	view: HomeView,
	el: HTMLElement,
	icon: string | undefined,
	fallback: string,
): void {
	const image = resolveIconImage(view, icon);
	if (image) {
		el.addClass("hearth-icon-image");
		const img = el.createEl("img", { cls: "hearth-widget-icon-img" });
		img.src = view.app.vault.getResourcePath(image);
		return;
	}
	setIcon(el, icon?.trim() || fallback);
}
