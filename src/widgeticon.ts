import { setIcon, setTooltip, TextComponent, type App, type Setting, TFile } from "obsidian";
import type { HomeView } from "./view";
import { isImageFile } from "./filetypes";
import { applyTileIcon, iconizeEnabled, IconizeIconPickerModal } from "./iconizeicons";
import { LucideIconPickerModal } from "./lucide";
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
 * - Otherwise a centered icon slot is used: Lucide, emoji, Iconize pack icon,
 *   or `fallback` when the string is empty or unrecognised.
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
	const slot = tile.createDiv("hearth-link-icon");
	if (!applyTileIcon(view.app, slot, icon)) {
		setIcon(slot, fallback);
	}
}

/**
 * Append a small "?" help badge to an icon field's control row, carrying the
 * shared icon help as its tooltip so users can discover that the field accepts
 * a Lucide id, an Iconize icon, or a vault image path (#119).
 */
export function addIconHelp(controlEl: HTMLElement): void {
	const help = controlEl.createSpan({ cls: "hearth-icon-help", text: "?" });
	setTooltip(help, t().editors.iconHelp);
	help.setAttribute("aria-label", t().editors.iconHelp);
}

/**
 * Icon field for command / launchpad / templater tiles: text input, live
 * preview, Lucide browse, and — when Iconize is enabled — an Iconize browse
 * button for downloaded icon packs.
 */
export function addTileIconField(
	row: Setting,
	app: App,
	value: string,
	onChange: (value: string) => void,
): void {
	const preview = row.controlEl.createSpan({
		cls: "hearth-icon-preview hearth-link-icon",
	});
	let text: TextComponent | undefined;

	const apply = (next: string) => {
		const trimmed = next.trim();
		preview.empty();
		preview.toggleClass("is-empty", !applyTileIcon(app, preview, trimmed));
		onChange(trimmed);
	};

	row.addText((tx) => {
		text = tx;
		tx.setPlaceholder(t().pickers.iconPlaceholder)
			.setValue(value)
			.onChange((v) => apply(v));
		setTooltip(tx.inputEl, t().editors.iconHelp);
	});

	row.addExtraButton((b) =>
		b
			.setIcon("search")
			.setTooltip(t().pickers.iconBrowse)
			.onClick(() => {
				new LucideIconPickerModal(app, (name) => {
					text?.setValue(name);
					apply(name);
				}).open();
			}),
	);

	if (iconizeEnabled(app)) {
		row.addExtraButton((b) =>
			b
				.setIcon("shapes")
				.setTooltip(t().pickers.iconizeBrowse)
				.onClick(() => {
					new IconizeIconPickerModal(app, (name) => {
						text?.setValue(name);
						apply(name);
					}).open();
				}),
		);
	}

	addIconHelp(row.controlEl);
	preview.toggleClass("is-empty", !applyTileIcon(app, preview, value));
}
