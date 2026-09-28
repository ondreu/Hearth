/**
 * Hearth's icons, with terminal mode's text stand-ins.
 *
 * Every Hearth module draws its icons through {@link setIcon} here instead of
 * Obsidian's own. Outside terminal mode it *is* Obsidian's: the same call, the
 * same SVG. In terminal mode an icon is a character instead — `+` for "plus",
 * `▾` for "chevron-down", `✓` for "check" — so a button reads the way it would
 * in a text interface and nothing on the board is a picture.
 *
 * The glyphs are chosen from what the bundled terminal font draws (see the
 * @font-face in styles.css), so every one of them sits on the character grid
 * at exactly one cell. An icon with no sensible character gets the neutral
 * {@link FALLBACK_GLYPH} rather than nothing, so an icon-only button never
 * turns into an empty, unclickable gap.
 *
 * The icon picker (src/lucide.ts) is the one place that keeps drawing real
 * icons in terminal mode: its whole job is to show what an icon looks like.
 */
import { setIcon as obsidianSetIcon } from "obsidian";

/** The class a glyph-drawn icon element wears; styles.css sizes it to one
 * cell and clears the SVG sizing an icon container normally carries. */
export const GLYPH_CLASS = "hearth-glyph";

/** What an icon becomes when nothing in the tables below matches it. */
export const FALLBACK_GLYPH = "·";

let glyphMode: () => boolean = () => false;

/** Tell the icon helper how to find out whether terminal mode is on. A getter
 * rather than a flag, so a settings change needs no call back here. Installed
 * once by the plugin at load. */
export function installGlyphMode(active: () => boolean): void {
	glyphMode = active;
}

/** Whether icons are currently drawn as characters. */
export function glyphModeActive(): boolean {
	return glyphMode();
}

/**
 * Draw `iconId` into `parent`, replacing whatever it held — the contract of
 * Obsidian's `setIcon`, which this is a drop-in for.
 */
export function setIcon(parent: HTMLElement, iconId: string): void {
	if (!glyphMode()) {
		parent.removeClass(GLYPH_CLASS);
		obsidianSetIcon(parent, iconId);
		return;
	}
	parent.empty();
	parent.addClass(GLYPH_CLASS);
	parent.setText(iconGlyph(iconId));
}

/** Exact icon ids → their character. */
const EXACT: Record<string, string> = {
	plus: "+",
	"plus-circle": "⊕",
	"circle-plus": "⊕",
	"square-plus": "⊞",
	minus: "-",
	"minus-circle": "⊖",
	x: "x",
	"x-circle": "⊗",
	"circle-x": "⊗",
	check: "✓",
	"check-check": "✓",
	"check-circle": "✓",
	"circle-check": "✓",
	"circle-check-big": "✓",
	"check-square": "⊠",
	"square-check": "⊠",
	square: "□",
	circle: "○",
	dot: "·",
	"circle-dot": "◉",
	"chevron-down": "▾",
	"chevron-up": "▴",
	"chevron-left": "◂",
	"chevron-right": "▸",
	"chevrons-down": "▾",
	"chevrons-up": "▴",
	"chevrons-left": "«",
	"chevrons-right": "»",
	"chevrons-up-down": "↕",
	"arrow-up": "↑",
	"arrow-down": "↓",
	"arrow-left": "←",
	"arrow-right": "→",
	"arrow-up-down": "↕",
	"arrow-down-up": "↕",
	"arrow-left-right": "↔",
	"arrow-big-up": "⇧",
	"arrow-big-down": "⇩",
	"arrow-up-circle": "↑",
	"arrow-up-right": "↗",
	"external-link": "↗",
	"move": "↔",
	"grip-vertical": "⋮",
	"grip-horizontal": "⋯",
	"more-horizontal": "⋯",
	"more-vertical": "⋮",
	ellipsis: "⋯",
	"ellipsis-vertical": "⋮",
	menu: "≡",
	settings: "≡",
	"settings-2": "≡",
	"sliders-horizontal": "≡",
	sliders: "≡",
	search: "/",
	"file-search": "/",
	filter: "∇",
	trash: "x",
	"trash-2": "x",
	pencil: "⌨",
	"pen": "⌨",
	"square-pen": "⌨",
	"pencil-line": "⌨",
	edit: "⌨",
	copy: "⎕",
	"clipboard-copy": "⎕",
	"refresh-cw": "⊙",
	"refresh-ccw": "⊙",
	"rotate-cw": "⊙",
	"rotate-ccw": "⊙",
	undo: "↩",
	redo: "↪",
	home: "⌂",
	house: "⌂",
	star: "*",
	heart: "<3",
	bookmark: "⋆",
	bookmarks: "⋆",
	pin: "¤",
	"pin-off": "¤",
	link: "∞",
	"link-2": "∞",
	lock: "⊡",
	unlock: "⊡",
	eye: "◉",
	"eye-off": "○",
	info: "i",
	"help-circle": "?",
	"circle-help": "?",
	"alert-triangle": "!",
	"triangle-alert": "!",
	"alert-circle": "!",
	"circle-alert": "!",
	ban: "⊘",
	clock: "◔",
	timer: "◔",
	alarm: "◔",
	calendar: "⊞",
	"calendar-days": "⊞",
	"calendar-check": "⊞",
	"calendar-clock": "⊞",
	"calendar-plus": "⊞",
	"calendar-range": "⊞",
	history: "⊙",
	file: "◫",
	files: "◫",
	"file-text": "◫",
	"file-plus": "◫",
	"file-plus-2": "◫",
	"file-code": "◫",
	"file-x": "◫",
	"file-output": "◫",
	"file-symlink": "◫",
	"file-spreadsheet": "◫",
	"file-type": "◫",
	folder: "▸",
	"folder-open": "▾",
	"folder-tree": "▸",
	"folder-x": "▸",
	folders: "▸",
	image: "◧",
	images: "◧",
	film: "◧",
	music: "♭",
	globe: "◎",
	"globe-2": "◎",
	database: "≣",
	"database-zap": "≣",
	table: "⊞",
	"layout-grid": "⊞",
	"layout-dashboard": "⊞",
	"layout-template": "⊞",
	"columns-3": "║",
	kanban: "║",
	"bar-chart": "▁",
	"bar-chart-2": "▁",
	"bar-chart-3": "▁",
	"chart-column": "▁",
	activity: "∼",
	"trending-up": "↗",
	"trending-down": "↘",
	gauge: "◔",
	flame: "^",
	command: "⌘",
	terminal: ">",
	code: "<>",
	hash: "#",
	tag: "#",
	tags: "#",
	"list-checks": "⊠",
	"list-todo": "⊠",
	list: "≡",
	"list-tree": "≡",
	calculator: "=",
	equal: "=",
	sun: "*",
	"cloud-sun": "*",
	moon: ")",
	cloud: "~",
	cloudy: "~",
	"cloud-rain": "/",
	"cloud-snow": "*",
	"cloud-off": "~",
	fog: "=",
	droplets: "°",
	wind: "≈",
	thermometer: "°",
	rss: ")",
	mail: "@",
	"at-sign": "@",
	user: "@",
	users: "@",
	"git-branch": "±",
	"git-commit": "∘",
	"git-pull-request": "±",
	github: "±",
	git: "±",
	upload: "↑",
	download: "↓",
	"cloud-upload": "↑",
	"cloud-download": "↓",
	import: "↓",
	export: "↑",
	share: "↗",
	"share-2": "↗",
	smartphone: "⋆",
	monitor: "□",
	play: "▶",
	pause: "‖",
	"skip-forward": "»",
	"skip-back": "«",
	shuffle: "⤖",
	repeat: "⊙",
	maximize: "⊡",
	"maximize-2": "⊡",
	minimize: "⊟",
	"minimize-2": "⊟",
	expand: "⊡",
	"zoom-in": "+",
	"zoom-out": "-",
	sparkles: "*",
	sparkle: "*",
	wand: "*",
	"wand-2": "*",
	bug: "!",
	"key-round": "⊸",
	key: "⊸",
	bitcoin: "₿",
	dice: "▪",
	"dice-5": "▪",
	coins: "¤",
	"dollar-sign": "$",
	cat: "^",
	dog: "^",
	egg: "o",
	box: "□",
	package: "□",
	archive: "□",
	inbox: "□",
	anchor: "⊥",
	"circle-slash": "⊘",
	power: "⏻",
	"log-out": "→",
	"log-in": "←",
	"mic": "•",
	"pen-tool": "⌨",
	brush: "⌨",
	palette: "◕",
	"sun-moon": "◕",
	contrast: "◕",
	"mouse-pointer-click": "↖",
	hand: "↖",
};

/** Keyword rules for everything the exact table doesn't name, tried in order.
 * Lucide names are compound ("file-heart", "calendar-x-2"), so the family word
 * usually says enough. */
const FAMILIES: [RegExp, string][] = [
	[/^chevron/, "▸"],
	[/^arrow/, "→"],
	[/^file/, "◫"],
	[/^folder/, "▸"],
	[/^calendar/, "⊞"],
	[/^clock|^timer|^alarm|^hourglass/, "◔"],
	[/^cloud|^sun|^moon|^snow|^rain|^umbrella/, "~"],
	[/^git/, "±"],
	[/^list/, "≡"],
	[/^layout|^grid|^table|^panel/, "⊞"],
	[/chart|^trending/, "▁"],
	[/^circle/, "○"],
	[/^square/, "□"],
	[/^check/, "✓"],
	[/^x-|^trash/, "x"],
	[/^plus/, "+"],
	[/^minus/, "-"],
	[/^eye/, "◉"],
	[/^book/, "⋆"],
	[/^image|^camera|^picture|^film|^video/, "◧"],
	[/^user|^contact/, "@"],
	[/^mail|^message|^inbox/, "@"],
	[/^tag|^hash/, "#"],
	[/^star|^sparkle/, "*"],
	[/^heart/, "<3"],
	[/^link/, "∞"],
	[/^lock|^shield/, "⊡"],
	[/^alert|^triangle-alert|^octagon-alert/, "!"],
	[/^help|^info/, "?"],
	[/^search|^scan/, "/"],
	[/^settings|^slider|^cog/, "≡"],
	[/^pen|^pencil|^edit/, "⌨"],
	[/^refresh|^rotate/, "⊙"],
	[/^music|^audio|^headphones|^volume/, "♭"],
	[/^globe|^earth|^map|^compass/, "◎"],
	[/^database|^server|^hard-drive/, "≣"],
	[/^terminal|^code|^braces/, ">"],
	[/^mic/, "•"],
];

/** The character standing in for `iconId` in terminal mode. Accepts bare
 * Lucide names and the `lucide-` prefixed ids Obsidian registers them under;
 * Hearth's own crystal marks become a diamond. */
export function iconGlyph(iconId: string): string {
	const id = iconId.trim().toLowerCase().replace(/^lucide-/, "");
	if (id.startsWith("hearth")) return "◆";
	const exact = EXACT[id];
	if (exact) return exact;
	for (const [pattern, glyph] of FAMILIES) if (pattern.test(id)) return glyph;
	return FALLBACK_GLYPH;
}
