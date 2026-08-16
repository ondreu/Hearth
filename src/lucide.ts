import {
	FuzzySuggestModal,
	Setting,
	getIconIds,
	setIcon,
	type App,
	type FuzzyMatch,
	type TextComponent,
} from "obsidian";
import { t } from "./i18n";

/**
 * Lucide icons as a first-class, user-pickable value.
 *
 * Obsidian ships the whole Lucide set and registers it with `addIcon`, so any
 * icon is one `setIcon` call away — the hard part is letting a user *choose*
 * one. Typing an id from memory only works if you already know the set, so
 * everything here exists to make an icon field a browsable picker with a live
 * preview: the dashboard switcher icon, the tab icon, and the title icons.
 *
 * Three shapes of icon id are in circulation and all of them have to work:
 * Obsidian's registered form (`lucide-home`), the bare Lucide name (`home`,
 * which is what plugins normally write and what Hearth stores), and whatever a
 * user typed by hand — which may not name an icon at all. {@link resolveIconId}
 * is the single place that reconciles them, so an unknown id degrades to "no
 * icon" instead of an invisible, blank icon slot.
 */

/** Obsidian's prefix on the icon ids it registers the Lucide set under. */
const LUCIDE_PREFIX = "lucide-";

/**
 * Every icon id Obsidian has registered, memoized by list length.
 *
 * `getIconIds()` allocates a fresh array of ~1,700 entries, which is too much
 * to redo per file in a card or per keystroke in a picker. Length is a good
 * enough cache key: the list only grows, and only when a plugin calls `addIcon`.
 */
let cache: { size: number; ids: Set<string> } | null = null;

export function knownIconIds(): Set<string> {
	try {
		const ids = getIconIds();
		if (!cache || cache.size !== ids.length) {
			cache = { size: ids.length, ids: new Set(ids) };
		}
		return cache.ids;
	} catch {
		return new Set();
	}
}

/**
 * Pick the id `setIcon` should be handed for a stored icon value, or null when
 * the value names nothing renderable.
 *
 * `isKnown` is injected so this stays pure and testable, and so the icon list is
 * looked up once per render rather than once per lookup. An empty registry means
 * the icon list is unavailable rather than that every icon is missing (tests,
 * a future API change), so the raw value is trusted through instead of every
 * icon silently disappearing — hence the `hasRegistry` flag.
 */
export function pickIconId(
	raw: string | undefined,
	isKnown: (id: string) => boolean,
	hasRegistry = true,
): string | null {
	const value = raw?.trim();
	if (!value) return null;
	if (!hasRegistry) return value;
	for (const candidate of [value, `${LUCIDE_PREFIX}${value}`]) {
		if (isKnown(candidate)) return candidate;
	}
	return null;
}

/** Strip Obsidian's registration prefix, leaving the bare Lucide name that
 * Hearth stores and that users recognise from lucide.dev. */
export function bareIconName(id: string): string {
	return id.startsWith(LUCIDE_PREFIX) ? id.slice(LUCIDE_PREFIX.length) : id;
}

/** {@link pickIconId} against the icons Obsidian actually has registered. */
export function resolveIconId(raw: string | undefined): string | null {
	const known = knownIconIds();
	return pickIconId(raw, (id) => known.has(id), known.size > 0);
}

/** Draw a stored icon value into `el`, or leave it empty when the value names
 * no icon Obsidian knows. Returns whether anything was drawn. */
export function renderIcon(el: HTMLElement, raw: string | undefined): boolean {
	const id = resolveIconId(raw);
	if (!id) return false;
	setIcon(el, id);
	return true;
}

/**
 * The names offered by the picker: the Lucide set, bare and sorted.
 *
 * Icons registered by plugins (Hearth's own crystal among them) are left out —
 * they are not Lucide, they come and go with whatever plugins are enabled, and
 * a board that referenced one would lose its icon the moment that plugin was
 * disabled. Should Obsidian ever stop prefixing the set, every id is offered
 * rather than an empty list.
 */
export function lucideIconNames(): string[] {
	const ids = [...knownIconIds()];
	const lucide = ids.filter((id) => id.startsWith(LUCIDE_PREFIX));
	return (lucide.length > 0 ? lucide.map(bareIconName) : ids).sort((a, b) =>
		a.localeCompare(b),
	);
}

/** A fuzzy picker over the Lucide set, each row drawn as the icon beside its
 * name so icons can be recognised rather than recalled. */
export class LucideIconPickerModal extends FuzzySuggestModal<string> {
	private onChoose: (name: string) => void;

	constructor(app: App, onChoose: (name: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder(t().pickers.icon);
	}

	getItems(): string[] {
		return lucideIconNames();
	}

	getItemText(name: string): string {
		return name;
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass("hearth-icon-suggestion");
		renderIcon(el.createSpan("hearth-icon-suggestion-icon"), match.item);
		el.createSpan({ cls: "hearth-icon-suggestion-name", text: match.item });
	}

	onChooseItem(name: string): void {
		this.onChoose(name);
	}
}

/**
 * Turn a Setting row into a Lucide icon field: a live preview, a text input for
 * anyone who knows the id they want, a Browse button opening
 * {@link LucideIconPickerModal}, and a Clear button.
 *
 * The preview is created before the text input so it sits at the left of the
 * control row, and it doubles as validation feedback — type an id that isn't an
 * icon and the preview goes blank rather than the change silently doing nothing
 * visible until the board is redrawn.
 */
export function addIconPicker(
	setting: Setting,
	app: App,
	value: string,
	onChange: (value: string) => void,
): Setting {
	const preview = setting.controlEl.createSpan({ cls: "hearth-icon-preview" });
	let text: TextComponent | undefined;

	const apply = (next: string) => {
		const trimmed = next.trim();
		preview.empty();
		preview.toggleClass("is-empty", !renderIcon(preview, trimmed));
		onChange(trimmed);
	};

	setting.addText((tx) => {
		text = tx;
		tx.setPlaceholder(t().pickers.iconPlaceholder)
			.setValue(value)
			.onChange((v) => apply(v));
	});

	setting.addExtraButton((b) =>
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

	setting.addExtraButton((b) =>
		b
			.setIcon("x")
			.setTooltip(t().pickers.iconClear)
			.onClick(() => {
				text?.setValue("");
				apply("");
			}),
	);

	preview.toggleClass("is-empty", !renderIcon(preview, value));
	return setting;
}
