import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import { applyFileIcon, ICONIZE_PLUGIN_ID, normalizeStoredIcon } from "./fileicons";
import { knownIconIds, resolveIconId } from "./lucide";
import { t } from "./i18n";

/** One icon from an Iconize pack, ready to store on a tile (`LiFileText`, …). */
export interface IconizeIconEntry {
	name: string;
	label: string;
}

/** The bit of Iconize's public API Hearth needs for tile icons. */
interface IconizeApi {
	getIconByName?: (iconNameWithPrefix: string) => unknown;
	setIconForNode?: (iconName: string, node: HTMLElement, color?: string) => void;
	getAllIconPacks?: () => IconizeIconPack[];
	getIconsFromIconPack?: (packName: string) => IconizeIconPack | undefined;
}

interface IconizeIconPack {
	name: string;
	prefix: string;
	icons?: { name: string; prefix: string }[];
}

export function iconizeEnabled(app: App): boolean {
	try {
		return app.plugins.enabledPlugins.has(ICONIZE_PLUGIN_ID);
	} catch {
		return false;
	}
}

function iconizeApi(app: App): IconizeApi | null {
	if (!iconizeEnabled(app)) return null;
	const plugin = app.plugins.plugins[ICONIZE_PLUGIN_ID] as { api?: IconizeApi } | undefined;
	return plugin?.api ?? null;
}

/** Every Iconize icon name Hearth can render, for the tile-icon picker. */
export function iconizeIconEntries(app: App): IconizeIconEntry[] {
	const api = iconizeApi(app);
	if (!api?.getAllIconPacks) return [];
	const out: IconizeIconEntry[] = [];
	try {
		for (const pack of api.getAllIconPacks()) {
			const loaded = api.getIconsFromIconPack?.(pack.name) ?? pack;
			for (const icon of loaded.icons ?? []) {
				const name = `${icon.prefix}${icon.name}`;
				out.push({ name, label: `${pack.name} / ${icon.name}` });
			}
		}
	} catch {
		return [];
	}
	return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Draw an Iconize pack icon into `el`. Returns false when Iconize is off or the
 * name isn't one of its loaded icons. */
export function renderIconizeIcon(app: App, el: HTMLElement, raw: string): boolean {
	const name = raw.trim();
	if (!name) return false;
	const api = iconizeApi(app);
	if (!api?.getIconByName) return false;
	try {
		const icon = api.getIconByName(name);
		if (!icon) return false;
		el.empty();
		if (api.setIconForNode) {
			api.setIconForNode(name, el);
			return true;
		}
		const svg = (icon as { svgElement?: string }).svgElement;
		if (typeof svg === "string" && svg) {
			el.innerHTML = svg;
			return true;
		}
	} catch {
		// Iconize's API is best-effort; a broken read costs the custom icon, not
		// the tile.
	}
	return false;
}

/**
 * Draw a stored tile icon: Lucide id, emoji, Iconize pack name, or nothing.
 * Vault image paths are handled by {@link applyTileVisual} before this runs.
 */
export function applyTileIcon(app: App, el: HTMLElement, raw: string | undefined): boolean {
	const value = raw?.trim();
	if (!value) return false;
	try {
		const known = knownIconIds();
		const resolved = normalizeStoredIcon(value, (id) => known.has(id));
		if (resolved) {
			applyFileIcon(el, resolved);
			return true;
		}
		const lucide = resolveIconId(value);
		if (lucide) {
			applyFileIcon(el, { kind: "lucide", id: lucide });
			return true;
		}
		return renderIconizeIcon(app, el, value);
	} catch {
		return false;
	}
}

/** Fuzzy picker over Iconize's loaded icon packs. Only offered when Iconize is
 * enabled — Lucide icons stay on the existing Lucide picker. */
export class IconizeIconPickerModal extends FuzzySuggestModal<IconizeIconEntry> {
	constructor(
		app: App,
		private readonly onChoose: (name: string) => void,
	) {
		super(app);
		this.setPlaceholder(t().pickers.iconize);
	}

	getItems(): IconizeIconEntry[] {
		return iconizeIconEntries(this.app);
	}

	getItemText(entry: IconizeIconEntry): string {
		return entry.label;
	}

	renderSuggestion(match: FuzzyMatch<IconizeIconEntry>, el: HTMLElement): void {
		el.addClass("hearth-icon-suggestion");
		const slot = el.createSpan("hearth-icon-suggestion-icon hearth-link-icon");
		if (!renderIconizeIcon(this.app, slot, match.item.name)) {
			slot.addClass("is-empty");
		}
		el.createSpan({ cls: "hearth-icon-suggestion-name", text: match.item.label });
	}

	onChooseItem(entry: IconizeIconEntry): void {
		this.onChoose(entry.name);
	}
}
