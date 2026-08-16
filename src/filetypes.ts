import { TAbstractFile, TFile, TFolder } from "obsidian";
import { t } from "./i18n";

/**
 * A logical group of file types shown as a search filter chip.
 * Similar formats are grouped together (e.g. docx + odt under "Documents").
 */
export interface FileTypeGroup {
	id: string;
	label: string;
	/** Lucide icon id used with Obsidian's setIcon(). */
	icon: string;
	/** Lowercase extensions (without the dot). Empty array => folders. */
	extensions: string[];
}

export const FOLDERS_GROUP_ID = "folders";
export const EXCALIDRAW_GROUP_ID = "excalidraw";
export const IMAGES_GROUP_ID = "images";
export const OTHER_GROUP_ID = "other";

/** Community plugin id for Excalidraw (used to detect drawing support). */
export const EXCALIDRAW_PLUGIN_ID = "obsidian-excalidraw-plugin";

export const FILE_TYPE_GROUPS: FileTypeGroup[] = [
	{ id: FOLDERS_GROUP_ID, label: "Folders", icon: "folder", extensions: [] },
	{ id: "markdown", label: "Notes", icon: "file-text", extensions: ["md", "markdown"] },
	// Excalidraw drawings are detected specially (see isExcalidraw); the
	// "excalidraw" extension is listed so plain .excalidraw files map here too.
	{ id: EXCALIDRAW_GROUP_ID, label: "Excalidraw", icon: "pen-tool", extensions: ["excalidraw"] },
	{ id: "canvas", label: "Canvas", icon: "layout-dashboard", extensions: ["canvas"] },
	{ id: "bases", label: "Bases", icon: "database", extensions: ["base"] },
	{ id: "images", label: "Images", icon: "image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico"] },
	{ id: "videos", label: "Videos", icon: "film", extensions: ["mp4", "mkv", "webm", "mov", "avi", "ogv", "m4v"] },
	{ id: "audio", label: "Audio", icon: "music", extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "3gp"] },
	{ id: "pdf", label: "PDF", icon: "file-type", extensions: ["pdf"] },
	{ id: "documents", label: "Documents", icon: "file-text", extensions: ["doc", "docx", "odt", "rtf", "txt", "pages"] },
	{ id: "spreadsheets", label: "Sheets", icon: "file-spreadsheet", extensions: ["xls", "xlsx", "ods", "csv", "tsv", "numbers", "usheet"] },
	{ id: "presentations", label: "Slides", icon: "presentation", extensions: ["ppt", "pptx", "odp", "key"] },
	{ id: "3d", label: "3D", icon: "box", extensions: ["step", "stp", "stl", "obj", "fbx", "gltf", "glb", "3mf", "ply", "blend", "dae", "iges", "igs", "jt", "x_t", "x_b", "sldprt", "sldasm", "ipt", "iam", "prt", "asm", "c4d", "max", "ma", "mb"] },
	// Catch-all for any file not matched by a more specific group above.
	{ id: OTHER_GROUP_ID, label: "Other", icon: "file", extensions: [] },
];

const EXT_TO_GROUP: Map<string, FileTypeGroup> = (() => {
	const map = new Map<string, FileTypeGroup>();
	for (const group of FILE_TYPE_GROUPS) {
		for (const ext of group.extensions) map.set(ext, group);
	}
	return map;
})();

const EXCALIDRAW_GROUP = FILE_TYPE_GROUPS.find((g) => g.id === EXCALIDRAW_GROUP_ID)!;
const OTHER_GROUP = FILE_TYPE_GROUPS.find((g) => g.id === OTHER_GROUP_ID)!;

/** The picture formats Hearth renders as an `<img>` — the "images" group's own
 * extensions, so the one list drives the search filter, the widget-tile icons
 * (#119) and the slideshow card rather than each keeping a copy. */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(
	FILE_TYPE_GROUPS.find((g) => g.id === IMAGES_GROUP_ID)!.extensions,
);

/** Whether this file is a picture Hearth can show (see IMAGE_EXTENSIONS). */
export function isImageFile(file: TAbstractFile): file is TFile {
	return file instanceof TFile && IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

/** Whether this vault path names a picture. The path-based twin of
 * `isImageFile`, for the card editors: a target is typed there as text and may
 * not resolve to a file in the vault (yet) when the controls are drawn. */
export function isImagePath(path: string | undefined): boolean {
	const ext = /\.([^./\\]+)$/.exec((path ?? "").trim())?.[1];
	return !!ext && IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Excalidraw drawings are stored either as `*.excalidraw` files or, more
 * commonly with the Excalidraw plugin, as `*.excalidraw.md` notes. The latter
 * report a "md" extension, so match on the name suffix as well.
 */
export function isExcalidraw(file: TFile): boolean {
	const ext = file.extension.toLowerCase();
	if (ext === "excalidraw") return true;
	return file.name.toLowerCase().endsWith(".excalidraw.md");
}

export function groupForFile(file: TAbstractFile): FileTypeGroup | undefined {
	if (file instanceof TFolder) return FILE_TYPE_GROUPS[0];
	if (file instanceof TFile) {
		if (isExcalidraw(file)) return EXCALIDRAW_GROUP;
		return EXT_TO_GROUP.get(file.extension.toLowerCase()) ?? OTHER_GROUP;
	}
	return undefined;
}

export function iconForFile(file: TAbstractFile): string {
	return groupForFile(file)?.icon ?? "file";
}

export function groupById(id: string): FileTypeGroup | undefined {
	return FILE_TYPE_GROUPS.find((g) => g.id === id);
}

/** Maps a group id to its key in the `fileTypes` locale table. Ids and keys
 * match one-to-one except for "3d" (a leading digit isn't a valid key). */
const FILE_TYPE_LABEL_KEYS: Record<string, keyof ReturnType<typeof t>["fileTypes"]> = {
	folders: "folders",
	markdown: "markdown",
	excalidraw: "excalidraw",
	canvas: "canvas",
	bases: "bases",
	images: "images",
	videos: "videos",
	audio: "audio",
	pdf: "pdf",
	documents: "documents",
	spreadsheets: "spreadsheets",
	presentations: "presentations",
	"3d": "threeD",
	other: "other",
};

/** The localized filter-chip label for a group. Falls back to the English
 * `label` baked into the group when a locale is missing the key. */
export function fileTypeLabel(group: FileTypeGroup): string {
	const key = FILE_TYPE_LABEL_KEYS[group.id];
	return key ? t().fileTypes[key] : group.label;
}
