import { setIcon, type App, type Setting, type TextComponent, type TFile } from "obsidian";
import { isImageFile, isImagePath } from "./filetypes";
import { HEARTH_ICON_ID } from "./icon";
import { LucideIconPickerModal, knownIconIds, pickIconId } from "./lucide";
import { FilePickerModal } from "./pickers";
import { t } from "./i18n";

/**
 * The mark beside a board's title, as one setting (#252).
 *
 * Hearth used to carry two fields for this — a "logo" holding an emoji or a
 * couple of characters, and a "title icon" holding a Lucide id that silently
 * won whenever both were set. Two fields for one slot meant the settings tab
 * (and every board's own settings) had to explain a precedence rule, and the
 * two together still couldn't draw a picture. There is now a single
 * `titleIcon` string, and what it holds decides what is drawn:
 *
 *   - empty            → the Hearth crystal (or whatever the caller passes as
 *                        the fallback icon)
 *   - `https://…`      → a picture fetched from the web
 *   - `Assets/me.png`  → a picture from the vault
 *   - `flame`          → a Lucide icon
 *   - anything else    → the text itself, emoji included
 *
 * {@link classifyTitleIcon} is the single place that decides which of those a
 * string is, so the header, the previews in both settings screens and the
 * migration in `types.ts` can never disagree about what a value means. It is
 * pure — the icon registry is injected — and tested in test/titleicon.test.ts.
 */

/** What a title-icon string turned out to be. */
export type TitleIconKind = "empty" | "url" | "image" | "lucide" | "text";

export interface TitleIcon {
	kind: TitleIconKind;
	/** The trimmed value. For `lucide` it is the *registered* id (`lucide-flame`),
	 * ready to hand to `setIcon`; for everything else it is what the user typed. */
	value: string;
}

/** Web pictures are addressed by http(s) URL. Anything else — `file:`, `data:`,
 * a bare `//host/path` — is not fetched: a title icon is not a place to let an
 * arbitrary scheme in, and a vault path covers the local case. */
const HTTP_URL = /^https?:\/\//i;

/** What a Lucide id looks like: lower-case kebab-case, two characters or more.
 * Only used when the icon registry can't be read (see {@link classifyTitleIcon}). */
const ICON_ID_SHAPE = /^[a-z][a-z0-9-]+$/;

/**
 * Decide what a stored title-icon string means.
 *
 * Order matters, and it is the order in which an answer is unambiguous: a URL
 * announces itself with its scheme, a picture with its extension (no Lucide id
 * ends in `.png`), and only then is the value offered to the icon registry.
 * Whatever the registry doesn't know is text — which is what makes an emoji, a
 * pair of initials or a word work with no marker of any kind. The trade of one
 * field for two is that a word which *is* an icon name draws the icon: "flame"
 * is the flame, "flames" is the word. That is the reading nearly everyone
 * means, and the preview in both settings screens says which one a value got
 * before it reaches a board.
 *
 * `isKnown` is injected exactly as it is for {@link pickIconId}, so this stays
 * pure. When the registry is unreadable (`hasRegistry` false) the shape of the
 * value decides: trusting *everything* through as an icon the way a Lucide-only
 * field can would turn an emoji into an unknown id, and an unknown id draws
 * nothing at all — an invisible title icon is much worse than a literal one.
 */
export function classifyTitleIcon(
	raw: string | undefined,
	isKnown: (id: string) => boolean,
	hasRegistry = true,
): TitleIcon {
	const value = raw?.trim() ?? "";
	if (!value) return { kind: "empty", value: "" };
	if (HTTP_URL.test(value)) return { kind: "url", value };
	if (isImagePath(value)) return { kind: "image", value };
	if (!hasRegistry) {
		return ICON_ID_SHAPE.test(value) ? { kind: "lucide", value } : { kind: "text", value };
	}
	const id = pickIconId(value, isKnown);
	return id ? { kind: "lucide", value: id } : { kind: "text", value };
}

/** {@link classifyTitleIcon} against the icons Obsidian actually has registered. */
export function titleIconOf(raw: string | undefined): TitleIcon {
	const known = knownIconIds();
	return classifyTitleIcon(raw, (id) => known.has(id), known.size > 0);
}

/** The vault image a title icon names, or null when the path names no picture
 * that exists. A path that doesn't resolve draws the fallback mark rather than
 * a broken image or an empty slot. */
export function titleIconFile(app: App, value: string): TFile | null {
	const file = app.vault.getAbstractFileByPath(value);
	return file && isImageFile(file) ? file : null;
}

/**
 * Draw a title icon into `parent` and return the element it created.
 *
 * `fallbackIconId` is what an empty value — and a picture that has gone missing
 * — falls back to; the header passes the Hearth crystal in the variant the
 * board's theme-colour setting asks for.
 */
export function renderTitleIcon(
	app: App,
	parent: HTMLElement,
	raw: string | undefined,
	fallbackIconId: string = HEARTH_ICON_ID,
): HTMLElement {
	const icon = titleIconOf(raw);
	if (icon.kind === "url" || icon.kind === "image") {
		const file = icon.kind === "image" ? titleIconFile(app, icon.value) : null;
		const src = icon.kind === "url" ? icon.value : file && app.vault.getResourcePath(file);
		if (src) {
			const el = parent.createSpan({ cls: "hearth-logo hearth-logo-image" });
			// Decorative: the title text beside it already names the board.
			const img = el.createEl("img", { cls: "hearth-logo-img", attr: { alt: "" } });
			img.src = src;
			return el;
		}
	} else if (icon.kind === "lucide") {
		const el = parent.createSpan({ cls: "hearth-logo hearth-logo-icon" });
		setIcon(el, icon.value);
		return el;
	} else if (icon.kind === "text") {
		return parent.createSpan({ cls: "hearth-logo", text: icon.value });
	}
	const el = parent.createSpan({ cls: "hearth-logo hearth-logo-icon" });
	setIcon(el, fallbackIconId);
	return el;
}

/**
 * Turn a Setting row into a title-icon field: a live preview of whatever the
 * value turns out to be, a text input, a Browse-icons button, a Browse-pictures
 * button, and a Clear button.
 *
 * The two Browse buttons exist because neither a Lucide id nor a vault path is
 * something anyone types from memory; emoji, text and web URLs are pasted, so
 * the input takes those. The preview is the only feedback that says which of
 * the five readings a value got — type `flame` and the flame appears, type
 * `flames` and the word does.
 */
export function addTitleIconPicker(
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
		renderTitleIcon(app, preview, trimmed);
		preview.toggleClass("is-empty", trimmed === "");
		onChange(trimmed);
	};

	setting.addText((tx) => {
		text = tx;
		tx.setPlaceholder(t().pickers.titleIconPlaceholder)
			.setValue(value)
			.onChange((v) => apply(v));
	});

	const set = (next: string) => {
		text?.setValue(next);
		apply(next);
	};

	setting.addExtraButton((b) =>
		b
			.setIcon("search")
			.setTooltip(t().pickers.iconBrowse)
			.onClick(() => new LucideIconPickerModal(app, set).open()),
	);

	setting.addExtraButton((b) =>
		b
			.setIcon("image")
			.setTooltip(t().pickers.titleIconBrowseImage)
			.onClick(() =>
				new FilePickerModal(app, (file) => set(file.path), t().pickers.image, (file) =>
					isImageFile(file),
				).open(),
			),
	);

	setting.addExtraButton((b) =>
		b
			.setIcon("x")
			.setTooltip(t().pickers.iconClear)
			.onClick(() => set("")),
	);

	renderTitleIcon(app, preview, value);
	preview.toggleClass("is-empty", value.trim() === "");
	return setting;
}
