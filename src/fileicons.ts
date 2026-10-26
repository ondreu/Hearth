import { TFile, type App, type TAbstractFile } from "obsidian";
import { setIcon } from "./glyphs";
import { iconForFile } from "./filetypes";
import { knownIconIds } from "./lucide";
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
 *
 * A note's icon can also live in a frontmatter property, which needs no plugin
 * at all to read — plugins other than Iconize write it too (Pretty Properties,
 * Notebook Navigator, AutoIcon). That path is opt-in; see
 * {@link frontmatterIcon}.
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
	/** The frontmatter property (or comma separated properties) a note's icon
	 * lives in. Iconize lets the user rename its property, so this mirrors its
	 * default rather than assuming it (same reasoning as the TaskNotes field
	 * names). */
	frontmatterProperty: string;
	/** Read that property on every note even when neither icon plugin is
	 * enabled (#398). Off by default: `icon` is a common enough property name
	 * that a vault using it for its own purposes would otherwise see it turn
	 * into icons the moment Hearth lists the file. */
	frontmatterWithoutPlugin: boolean;
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
 * Split the settings field into property names. The field takes a comma
 * separated list so a vault whose icons are written by a plugin Hearth doesn't
 * know by name — Pretty Properties, Notebook Navigator and AutoIcon all write
 * frontmatter — can point Hearth at that plain property instead of waiting for
 * a per-plugin integration (#398).
 */
export function iconProperties(property: string): string[] {
	return property
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

/**
 * The icon value stored under one of `properties` in a note's frontmatter, or
 * null when none of them holds a non-empty string.
 *
 * Property names are matched case-insensitively: Obsidian keeps whatever
 * casing the user typed, so a vault writing `Icon:` would otherwise read as no
 * icon even though Obsidian's own properties pane shows the value. The first
 * property in the list wins, which is what makes a user-added list predictable.
 */
export function frontmatterIconValue(
	frontmatter: Record<string, unknown> | undefined,
	properties: string[],
): string | null {
	if (!frontmatter) return null;
	const byLoweredKey = new Map<string, unknown>();
	for (const [key, value] of Object.entries(frontmatter)) byLoweredKey.set(key.toLowerCase(), value);
	for (const property of properties) {
		const value = frontmatter[property] ?? byLoweredKey.get(property.toLowerCase());
		if (typeof value === "string" && value.trim()) return value;
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

/** An icon as Iconic's rule engine reports it. Only the icon is read; the
 * colour is dropped for the same reason as in {@link iconicIconForPath}. */
export interface IconicRuling {
	icon?: string | null;
}

/**
 * The icon to draw for `path` from Iconic: the one its rulebook rules over the
 * file, else the one stored for it by hand.
 *
 * The ruling wins because that is what Iconic itself does — its Files pane
 * resolves `checkRuling(...) ?? file`, so a rule overrides a manual icon
 * visually without deleting it. A ruling that carries no icon (a colour-only
 * rule) falls through to the manual icon instead of blanking it (#421).
 */
export function iconicIconForFile(
	ruling: IconicRuling | null | undefined,
	fileIcons: unknown,
	path: string,
): string | null {
	const fromRule = ruling?.icon;
	if (typeof fromRule === "string" && fromRule) return fromRule;
	return iconicIconForPath(fileIcons, path);
}

// ---- Reading the plugins ------------------------------------------------

/** Iconic's plugin instance keeps its settings — including the path→icon map —
 * on the instance itself, and settles its rulebook into `ruleManager`. */
interface IconicPluginInstance {
	settings?: { fileIcons?: unknown };
	ruleManager?: {
		checkRuling?: (page: "file" | "folder", path: string) => IconicRuling | null;
	};
}

/**
 * Ask Iconic's rule engine which rule currently governs `path`, or null when no
 * rule does.
 *
 * The rulebook is stored apart from `fileIcons` and is never written into it —
 * Iconic only overrides icons visually — so this is the only place a rule-set
 * icon can be read from. Files and folders have separate rulebooks, hence the
 * page argument.
 *
 * Wrapped on its own, not left to {@link resolveFileIcon}'s catch: a rule engine
 * that changed shape must cost the user the rule icon, not the manual icon
 * underneath it.
 */
function iconicRuling(
	plugin: IconicPluginInstance,
	page: "file" | "folder",
	path: string,
): IconicRuling | null {
	try {
		return plugin.ruleManager?.checkRuling?.(page, path) ?? null;
	} catch {
		return null;
	}
}

/** Iconic's icon for `path`: its ruling if one applies, else the stored icon. */
export function iconicIconForPlugin(
	plugin: IconicPluginInstance | undefined,
	page: "file" | "folder",
	path: string,
): string | null {
	if (!plugin) return null;
	return iconicIconForFile(iconicRuling(plugin, page, path), plugin.settings?.fileIcons, path);
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

/** Whether a community plugin is enabled right now. `app.plugins` is
 * undocumented, so a failure to read it reads as "not enabled" rather than
 * throwing out of an icon lookup. */
function isPluginEnabled(app: App, id: string): boolean {
	try {
		return app.plugins.enabledPlugins.has(id);
	} catch {
		return false;
	}
}

/**
 * A note's icon from a frontmatter property — Iconize's other storage
 * location, and the only one that works without an icon plugin installed.
 * Read through Obsidian's metadata cache, so this costs nothing and keeps
 * working regardless of what Iconize does to its internals.
 *
 * Reading it with neither plugin installed is opt-in (#398). `icon` is a
 * common enough property name that a vault using it for its own purposes — a
 * template field, a Dataview column — would otherwise find those values
 * turning into icons in Hearth without ever having installed an icon plugin.
 * Plain enough that the user has to ask for it, in other words.
 */
function frontmatterIcon(
	app: App,
	file: TAbstractFile,
	property: string,
	withoutPlugin: boolean,
): string | null {
	const properties = iconProperties(property);
	if (properties.length === 0) return null;
	if (!withoutPlugin && !isPluginEnabled(app, ICONIZE_PLUGIN_ID)) return null;
	// getFileCache takes a TFile; folders have no frontmatter to read.
	if (!(file instanceof TFile)) return null;
	// FrontMatterCache is indexed as `any`; widening it to unknown keeps the
	// value check in `frontmatterIconValue` honest.
	const frontmatter: Record<string, unknown> | undefined =
		app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatterIconValue(frontmatter, properties);
}

/** Whether either icon plugin is currently enabled. Used to decide whether the
 * settings row is worth explaining, not to gate resolution — resolution already
 * falls back on its own. */
export function hasFileIconPlugin(app: App): boolean {
	return isPluginEnabled(app, ICONIC_PLUGIN_ID) || isPluginEnabled(app, ICONIZE_PLUGIN_ID);
}

/** The icon to draw for `file`: a custom one from Iconic or Iconize when the
 * user has set one or rules one in, otherwise Hearth's own file-type icon.
 *
 * Iconic is consulted first — it is the maintained plugin, so in a vault
 * migrating from Iconize its choice is the more recent one. Within Iconic a
 * rulebook ruling beats a manual icon, mirroring Iconic's own precedence;
 * within Iconize the data file wins over frontmatter, matching Iconize's.
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
		// Rules are per page in Iconic: files and folders have separate rulebooks.
		const iconic = app.plugins.plugins[ICONIC_PLUGIN_ID] as IconicPluginInstance | undefined;
		const raw =
			iconicIconForPlugin(iconic, file instanceof TFile ? "file" : "folder", path) ??
			iconizeIcon(app, path) ??
			frontmatterIcon(app, file, opts.frontmatterProperty, opts.frontmatterWithoutPlugin);
		if (!raw) return fallback;
		const ids = knownIconIds();
		return normalizeStoredIcon(raw, (id) => ids.has(id)) ?? fallback;
	} catch {
		// Both plugins' internals are private; a shape change must cost the user
		// their custom icon, not the card it was on.
		return fallback;
	}
}

/** The resolver options carried by the user's settings. A one-liner, but it
 * keeps every call site from having to remember which fields matter. */
export function fileIconOptions(settings: HomeSettings): FileIconOptions {
	return {
		enabled: settings.customFileIcons,
		frontmatterProperty: settings.iconizeIconProperty,
		frontmatterWithoutPlugin: settings.frontmatterIconsWithoutPlugin,
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
