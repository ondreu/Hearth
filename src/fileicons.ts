import { getIconIds, setIcon, TFile, type App, type TAbstractFile } from "obsidian";
import { iconForFile } from "./filetypes";
import { type HomeSettings } from "./types";

/**
 * Per-file icons from the Iconic and Iconize community plugins (#132).
 *
 * Neither plugin exposes an API for other plugins, so — exactly as with
 * TaskNotes in `cards/tasks.ts` — Hearth reads their stored state directly.
 * That state is private and can change shape in any release of theirs, so every
 * read here is wrapped and every failure degrades silently to Hearth's own
 * file-type icon. A broken read must never surface as a broken card.
 *
 * Two plugins, because the two are mid-handover: Iconize
 * (`obsidian-icon-folder`) is deprecated but still widely installed, and Iconic
 * is its spiritual successor. A vault can have either, both, or neither.
 *
 * Scope: Lucide icons and emoji. Iconize can also draw icons from downloaded
 * icon packs (Font Awesome, Remix, …), which are SVG blobs on disk — rendering
 * those means injecting third-party markup, so those files keep Hearth's
 * built-in icon instead.
 */

/** The community-plugin id Iconic registers itself under. */
export const ICONIC_PLUGIN_ID = "iconic";
/** The community-plugin id Iconize registers itself under. Its original name
 * was "Obsidian Icon Folder", which is what the id still reflects. */
export const ICONIZE_PLUGIN_ID = "obsidian-icon-folder";

/** Iconize's prefix for icons drawn from the Lucide pack. Icons from any other
 * pack carry that pack's own prefix and aren't renderable via `setIcon`. */
const ICONIZE_LUCIDE_PREFIX = "Li";

/** Keys Iconize stores alongside the path→icon entries in its data file. They
 * are not file paths and must never be treated as one. */
const ICONIZE_RESERVED_KEYS = new Set(["settings", "migrated"]);

/**
 * An icon resolved for a file: either a Lucide id renderable with Obsidian's
 * `setIcon`, or a literal emoji that has to be rendered as text.
 */
export type ResolvedIcon =
	| { kind: "lucide"; id: string }
	| { kind: "emoji"; char: string };

/** What {@link resolveFileIcon} needs from the user's settings. */
export interface FileIconOptions {
	/** Master switch for the whole integration. */
	enabled: boolean;
	/** The frontmatter property Iconize reads a note's icon from. Iconize lets
	 * the user rename it, so it mirrors Iconize's default rather than assuming
	 * it (same reasoning as the TaskNotes field names). */
	frontmatterProperty: string;
}

// ---- Pure helpers (unit-tested) -----------------------------------------

/**
 * Whether a stored icon value is an emoji rather than an icon name.
 *
 * Both plugins store emoji as the literal character. Icon names from every pack
 * are ASCII, so a leading non-ASCII codepoint is the distinguishing signal. The
 * length cap keeps a stray sentence out of an icon slot while leaving room for
 * the longest ZWJ sequences (family emoji run to 7 codepoints with joiners).
 */
export function isEmojiIcon(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	const first = trimmed.codePointAt(0);
	if (first === undefined || first <= 0x7f) return false;
	return Array.from(trimmed).length <= 8;
}

/**
 * Convert Iconize's stored icon name into a plain Lucide id, or null when the
 * icon comes from a downloaded pack Hearth can't render.
 *
 * Iconize stores `<PackPrefix><NormalizedName>` — the Lucide id `file-text`
 * becomes `LiFileText`. Undoing the normalization means splitting the
 * PascalCase back apart: `LiFileText` → `file-text`, `LiSquare1` → `square-1`.
 * The result is only a candidate; the caller checks it against the icons
 * Obsidian actually has registered.
 */
export function iconizeNameToLucide(name: string): string | null {
	if (!name.startsWith(ICONIZE_LUCIDE_PREFIX)) return null;
	const body = name.slice(ICONIZE_LUCIDE_PREFIX.length);
	// A bare "Li" carries no icon, and a lowercase next character means the
	// prefix match was a coincidence inside some other pack's name.
	if (!body || body[0] !== body[0].toUpperCase()) return null;
	return body
		.replace(/([a-z])([A-Z0-9])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/**
 * Turn a raw stored icon value from either plugin into something renderable,
 * or null when it names an icon Obsidian doesn't have.
 *
 * `isKnown` reports whether an id is registered with Obsidian; it is injected
 * so this stays pure (and so the icon list is looked up once per render rather
 * than once per file). Handles all three shapes seen in the wild: a literal
 * emoji, a Lucide id with or without Obsidian's `lucide-` prefix (Iconic stores
 * the prefixed form), and Iconize's PascalCase pack name.
 */
export function normalizeStoredIcon(
	raw: string,
	isKnown: (id: string) => boolean,
): ResolvedIcon | null {
	const value = raw.trim();
	if (!value) return null;
	if (isEmojiIcon(value)) return { kind: "emoji", char: value };

	for (const candidate of [value, `lucide-${value}`]) {
		if (isKnown(candidate)) return { kind: "lucide", id: candidate };
	}

	const fromIconize = iconizeNameToLucide(value);
	if (fromIconize) {
		for (const candidate of [fromIconize, `lucide-${fromIconize}`]) {
			if (isKnown(candidate)) return { kind: "lucide", id: candidate };
		}
	}
	return null;
}

/**
 * Pull the icon name for `path` out of an Iconize data blob.
 *
 * Iconize keys its data file by vault path, storing either the icon name
 * directly or a `{ iconName }` object (folders, which also carry a colour).
 * Its own custom *rules* (glob/regex matchers) are deliberately not evaluated
 * here — replicating its matching order would be guesswork against private
 * behaviour, and getting it wrong shows the user the wrong icon rather than
 * none.
 */
export function iconizeIconForPath(data: unknown, path: string): string | null {
	if (!data || typeof data !== "object") return null;
	if (ICONIZE_RESERVED_KEYS.has(path)) return null;
	const entry = (data as Record<string, unknown>)[path];
	if (typeof entry === "string") return entry || null;
	if (entry && typeof entry === "object") {
		const named = (entry as { iconName?: unknown }).iconName;
		if (typeof named === "string" && named) return named;
	}
	return null;
}

/** Pull the icon name for `path` out of an Iconic `fileIcons` map, which stores
 * `{ icon, color }` per vault path. The colour is read but not applied —
 * Hearth's icons take their colour from the theme. */
export function iconicIconForPath(fileIcons: unknown, path: string): string | null {
	if (!fileIcons || typeof fileIcons !== "object") return null;
	const entry = (fileIcons as Record<string, unknown>)[path];
	if (!entry || typeof entry !== "object") return null;
	const icon = (entry as { icon?: unknown }).icon;
	return typeof icon === "string" && icon ? icon : null;
}

// ---- Reading the plugins ------------------------------------------------

/**
 * The set of icon ids Obsidian has registered, memoized by list length.
 *
 * `getIconIds()` allocates a fresh array of ~1,700 entries, which is too much
 * to redo for every file in a card. Length is a good enough cache key: the list
 * only grows, and only when a plugin calls `addIcon`.
 */
let knownIconIds: { size: number; ids: Set<string> } | null = null;

function knownIcons(): Set<string> {
	try {
		const ids = getIconIds();
		if (!knownIconIds || knownIconIds.size !== ids.length) {
			knownIconIds = { size: ids.length, ids: new Set(ids) };
		}
		return knownIconIds.ids;
	} catch {
		return new Set();
	}
}

/** Iconic's plugin instance keeps its settings — including the path→icon map —
 * on the instance itself. */
function iconicIcon(app: App, path: string): string | null {
	const plugin = app.plugins.plugins[ICONIC_PLUGIN_ID] as
		| { settings?: { fileIcons?: unknown } }
		| undefined;
	return iconicIconForPath(plugin?.settings?.fileIcons, path);
}

/** Iconize exposes its data blob through `getData()`; older builds only had the
 * `data` field, so fall back to it. */
function iconizeIcon(app: App, path: string): string | null {
	const plugin = app.plugins.plugins[ICONIZE_PLUGIN_ID] as
		| { getData?: () => unknown; data?: unknown }
		| undefined;
	if (!plugin) return null;
	const data = typeof plugin.getData === "function" ? plugin.getData() : plugin.data;
	return iconizeIconForPath(data, path);
}

/**
 * Iconize's other storage location: a frontmatter property on the note itself.
 * Read through Obsidian's metadata cache, so this one costs nothing and keeps
 * working regardless of what Iconize does to its internals.
 *
 * Gated on Iconize being enabled, deliberately. `icon` is a common enough
 * property name that a vault using it for its own purposes — a template field,
 * a Dataview column — would otherwise find those values turning into icons in
 * Hearth without ever having installed an icon plugin.
 */
function frontmatterIcon(app: App, file: TAbstractFile, property: string): string | null {
	const key = property.trim();
	if (!key) return null;
	if (!app.plugins.enabledPlugins.has(ICONIZE_PLUGIN_ID)) return null;
	// getFileCache takes a TFile; folders have no frontmatter to read.
	if (!(file instanceof TFile)) return null;
	// FrontMatterCache is indexed as `any`; widening it to unknown keeps the
	// value check below honest.
	const frontmatter: Record<string, unknown> | undefined =
		app.metadataCache.getFileCache(file)?.frontmatter;
	const value = frontmatter?.[key];
	return typeof value === "string" && value.trim() ? value : null;
}

/** Whether either icon plugin is currently enabled. Used to decide whether the
 * settings row is worth explaining, not to gate resolution — resolution already
 * falls back on its own. */
export function hasFileIconPlugin(app: App): boolean {
	try {
		const enabled = app.plugins.enabledPlugins;
		return enabled.has(ICONIC_PLUGIN_ID) || enabled.has(ICONIZE_PLUGIN_ID);
	} catch {
		return false;
	}
}

/**
 * The icon to draw for `file`: a custom one from Iconic or Iconize when the
 * user has set one, otherwise Hearth's own file-type icon.
 *
 * Iconic is consulted first — it is the maintained plugin, so in a vault
 * migrating from Iconize its choice is the more recent one. Within Iconize, the
 * data file wins over frontmatter, matching Iconize's own precedence.
 *
 * Never throws: any failure reading plugin internals falls through to
 * {@link iconForFile}.
 */
export function resolveFileIcon(
	app: App,
	file: TAbstractFile,
	opts: FileIconOptions,
): ResolvedIcon {
	const fallback: ResolvedIcon = { kind: "lucide", id: iconForFile(file) };
	if (!opts.enabled) return fallback;
	try {
		const path = file.path;
		const raw =
			iconicIcon(app, path) ??
			iconizeIcon(app, path) ??
			frontmatterIcon(app, file, opts.frontmatterProperty);
		if (!raw) return fallback;
		const ids = knownIcons();
		return normalizeStoredIcon(raw, (id) => ids.has(id)) ?? fallback;
	} catch {
		// Both plugins' internals are private; a shape change must cost the user
		// their custom icon, not the card it was on.
		return fallback;
	}
}

/** The resolver options carried by the user's settings. A one-liner, but it
 * keeps every call site from having to remember which two fields matter. */
export function fileIconOptions(settings: HomeSettings): FileIconOptions {
	return {
		enabled: settings.customFileIcons,
		frontmatterProperty: settings.iconizeIconProperty,
	};
}

/**
 * Draw an icon into `el`. Accepts a plain Lucide id for the call sites that
 * already have one (search badges), so those keep reading as a single
 * expression.
 */
export function applyFileIcon(el: HTMLElement, icon: ResolvedIcon | string): void {
	if (typeof icon === "string") {
		setIcon(el, icon);
		return;
	}
	if (icon.kind === "emoji") {
		el.empty();
		el.createSpan({ cls: "hearth-emoji-icon", text: icon.char });
		return;
	}
	setIcon(el, icon.id);
}
