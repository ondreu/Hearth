/**
 * Carrying pictures inside a package — and putting them back on the way in.
 *
 * A board's wallpaper is most of what it looks like, and a wallpaper is a file
 * in the author's vault. Export the path alone and the board arrives somewhere
 * else with no backdrop at all: the picture is the one part of a shared board
 * that cannot be described, only carried.
 *
 * So it is carried, base64 in the package, and the references that pointed at
 * the author's vault path are rewritten to `hearth:asset/<id>`. On import the
 * bytes are written into the importing vault and the references rewritten again
 * to the real path they landed at, so nothing downstream — no renderer, no
 * sanitizer — ever meets the scheme. What travels is a picture and an id; the
 * folder it used to live in does not travel at all.
 *
 * **Embedding is always the caller's choice.** It is a separate step from
 * building the package, it is off unless asked for, and it reports what it
 * skipped. A package with no assets is completely valid — its picture
 * references stay the vault paths they were, and a vault that happens to have
 * the same file at the same path still draws the board correctly.
 *
 * Vault access arrives through {@link AssetStore} rather than through `app`, so
 * everything above this line stays testable without an Obsidian instance.
 */

import { type App, arrayBufferToBase64, base64ToArrayBuffer, TFile, TFolder } from "obsidian";
import {
	assetRef,
	assetRefId,
	type HearthPackage,
	MAX_ASSET_BYTES,
	MAX_TOTAL_ASSET_BYTES,
	type PackageAsset,
} from "./schema";
import { compactTouched, type FoundReference, packageReferences } from "./refs";

/** The vault operations embedding and materializing need. */
export interface AssetStore {
	/** File contents, or null when the path holds no readable file. */
	read(path: string): Promise<ArrayBuffer | null>;
	/**
	 * Write `data` into `folder` under a name based on `name`, creating the
	 * folder if needed and picking a free name if that one is taken. Returns the
	 * vault path actually written.
	 */
	write(folder: string, name: string, data: ArrayBuffer): Promise<string>;
	encode(data: ArrayBuffer): string;
	decode(base64: string): ArrayBuffer;
}

/** Where imported pictures are written unless the caller says otherwise. A
 * folder of Hearth's own, so an import never scatters files through the vault
 * and everything one import brought in can be deleted in one go. */
export const DEFAULT_ASSET_FOLDER = "Hearth/imported";

/**
 * The picture types a package may carry.
 *
 * SVG is deliberately not among them. It is a document rather than an image —
 * it can carry script and can reference remote resources — and an imported
 * package's files are written into someone else's vault, where a board might
 * then point a title icon or a wallpaper at one. Hearth only ever renders vault
 * images through `img.src`, which neither runs an SVG's script nor is meant to,
 * but "safe because of how the consumer happens to work today" is not a
 * property to bet a shared-file format on. An SVG wallpaper is left as a path
 * and reported, exactly like one that is too large.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	avif: "image/avif",
};

const EXTENSION_BY_MIME: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/bmp": "bmp",
	"image/avif": "avif",
};

function extensionOf(path: string): string {
	const match = /\.([A-Za-z0-9]+)$/.exec(path.trim());
	return match ? match[1].toLowerCase() : "";
}

function basenameOf(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] || "image";
}

/** Whether a picture of this type may be carried.
 *
 * An allowlist by extension, not a sniff: the package's pictures are written
 * into someone else's vault, so "what does this claim to be" is not good enough
 * a reason to write it. Anything not listed is skipped with a warning. */
export function embeddableMime(path: string): string | undefined {
	return MIME_BY_EXTENSION[extensionOf(path)];
}

export interface EmbedOptions {
	/** Per-asset cap. Defaults to {@link MAX_ASSET_BYTES}. */
	maxAssetBytes?: number;
	/** Total cap across the package. Defaults to {@link MAX_TOTAL_ASSET_BYTES}. */
	maxTotalBytes?: number;
	/** Keep the original vault path on each asset as `from`. On by default for a
	 * local export — it is what lets a re-import recognise the same picture — and
	 * removed by `stripReferences({ paths: true })` when the package is published. */
	keepOrigin?: boolean;
}

/** What embedding did, so the caller can say "wallpaper included (1.2 MB)" or
 * "wallpaper too large to include". */
export interface EmbedReport {
	embedded: { id: string; from: string; bytes: number }[];
	/** Pictures left as bare paths, with why. */
	skipped: { path: string; reason: "missing" | "tooLarge" | "budget" | "type" }[];
	totalBytes: number;
}

/**
 * Fold every embeddable picture a package references into the package itself.
 *
 * Mutates `pkg`. Idempotent: a reference already rewritten to `hearth:asset/…`
 * is skipped by the walker, so embedding twice is a no-op. The same vault path
 * referenced from several places is stored once and every reference points at
 * the one copy.
 */
export async function embedAssets(
	pkg: HearthPackage,
	store: AssetStore,
	opts: EmbedOptions = {},
): Promise<EmbedReport> {
	const maxAsset = opts.maxAssetBytes ?? MAX_ASSET_BYTES;
	const maxTotal = opts.maxTotalBytes ?? MAX_TOTAL_ASSET_BYTES;
	const report: EmbedReport = { embedded: [], skipped: [], totalBytes: 0 };

	const assets = pkg.assets ?? [];
	// Reuse an asset already carried for the same path, so a wallpaper that is
	// also a slide is stored once.
	const byPath = new Map<string, PackageAsset>();
	for (const asset of assets) {
		report.totalBytes += asset.bytes;
		if (asset.from) byPath.set(asset.from, asset);
	}
	let nextId = assets.length + 1;

	// Collected first: reading is async, and the references must not be rewritten
	// while the walker is still yielding from the object it is rewriting.
	const targets = packageReferences(pkg).filter(
		(ref) => ref.scope === "asset" && typeof ref.value === "string",
	);
	const skipped = new Set<string>();

	for (const ref of targets) {
		const path = String(ref.value);
		const existing = byPath.get(path);
		if (existing) {
			ref.set(assetRef(existing.id));
			continue;
		}
		if (skipped.has(path)) continue;

		const mime = embeddableMime(path);
		if (!mime) {
			report.skipped.push({ path, reason: "type" });
			skipped.add(path);
			continue;
		}
		const data = await store.read(path);
		if (!data) {
			report.skipped.push({ path, reason: "missing" });
			skipped.add(path);
			continue;
		}
		if (data.byteLength > maxAsset) {
			report.skipped.push({ path, reason: "tooLarge" });
			skipped.add(path);
			continue;
		}
		if (report.totalBytes + data.byteLength > maxTotal) {
			report.skipped.push({ path, reason: "budget" });
			skipped.add(path);
			continue;
		}

		const asset: PackageAsset = {
			id: `a${nextId++}`,
			name: basenameOf(path),
			mime,
			bytes: data.byteLength,
			data: store.encode(data),
		};
		if (opts.keepOrigin !== false) asset.from = path;
		assets.push(asset);
		byPath.set(path, asset);
		report.totalBytes += asset.bytes;
		report.embedded.push({ id: asset.id, from: path, bytes: asset.bytes });
		ref.set(assetRef(asset.id));
	}

	if (assets.length) pkg.assets = assets;
	return report;
}

/** What materializing did. */
export interface MaterializeReport {
	/** Vault paths written, in the order written. */
	written: string[];
	/** Assets that couldn't be written, with why. */
	skipped: { id: string; reason: "tooLarge" | "corrupt" | "ioError" }[];
	/** References naming an asset the package doesn't carry. */
	missingRefs: string[];
}

/**
 * Write a package's assets into the vault and point its references at them.
 *
 * Mutates `pkg`, so an import applies the rewritten payload. Called before the
 * payload is sanitized, so what reaches the sanitizers is a board holding
 * ordinary vault paths.
 *
 * A reference to an asset the package doesn't carry — a hand-edited file, or a
 * gallery that dropped the pictures — is cleared rather than left pointing at a
 * scheme nothing understands, and reported so the importer can be told the
 * board arrived without its wallpaper.
 */
export async function materializeAssets(
	pkg: HearthPackage,
	store: AssetStore,
	folder: string = DEFAULT_ASSET_FOLDER,
): Promise<MaterializeReport> {
	const report: MaterializeReport = { written: [], skipped: [], missingRefs: [] };
	const assets = pkg.assets ?? [];
	const writtenPath = new Map<string, string>();

	for (const asset of assets) {
		// Both caps, and the base64 one first: `bytes` is a number the file
		// supplies, so trusting it would let a package declare ten bytes and
		// hand over a hundred megabytes — decoded into memory before anything
		// checked. The encoded length is the only figure here that can't lie.
		if (encodedTooLarge(asset.data) || asset.bytes > MAX_ASSET_BYTES) {
			report.skipped.push({ id: asset.id, reason: "tooLarge" });
			continue;
		}
		let data: ArrayBuffer;
		try {
			data = store.decode(asset.data);
		} catch {
			report.skipped.push({ id: asset.id, reason: "corrupt" });
			continue;
		}
		// The declared length is checked rather than trusted: it decides whether
		// the asset is written at all, and a mismatch means the file is not what
		// the package says it is.
		if (data.byteLength !== asset.bytes) {
			report.skipped.push({ id: asset.id, reason: "corrupt" });
			continue;
		}
		try {
			const path = await store.write(folder, safeAssetName(asset), data);
			writtenPath.set(asset.id, path);
			report.written.push(path);
		} catch {
			report.skipped.push({ id: asset.id, reason: "ioError" });
		}
	}

	// `includeAssetRefs` because these are exactly the references this pass
	// exists to rewrite — every other caller is asking about the outside world
	// and is right to have them filtered out.
	const blanked: FoundReference[] = [];
	for (const ref of packageReferences(pkg, { includeAssetRefs: true })) {
		if (typeof ref.value !== "string") continue;
		const id = assetRefId(ref.value);
		if (id === null) continue;
		const path = writtenPath.get(id);
		if (path) ref.set(path);
		else {
			ref.set(undefined);
			blanked.push(ref);
			report.missingRefs.push(id);
		}
	}
	// A cleared slideshow slide leaves a hole in its array.
	compactTouched(blanked);

	// The references now name real files; the base64 has done its job and would
	// otherwise be written into `data.json` by the settings save that follows.
	delete pkg.assets;
	return report;
}

/**
 * Rewriting of asset references also has to reach the fields the reference
 * walker doesn't cover, because a `hearth:asset/…` value must never survive
 * into settings. This is the sweep for that: any string anywhere in the payload
 * that is an asset reference and wasn't rewritten above is cleared.
 */
export function clearAssetRefs(pkg: HearthPackage): string[] {
	const cleared: string[] = [];
	const seen = new Set<unknown>();
	const sweep = (node: unknown): void => {
		if (typeof node !== "object" || node === null) return;
		if (seen.has(node)) return;
		seen.add(node);
		if (Array.isArray(node)) {
			const list = node as unknown[];
			for (let i = list.length - 1; i >= 0; i--) {
				const item: unknown = list[i];
				if (typeof item === "string" && assetRefId(item) !== null) {
					cleared.push(item);
					list.splice(i, 1);
				} else sweep(item);
			}
			return;
		}
		for (const [key, value] of Object.entries(node)) {
			if (typeof value === "string" && assetRefId(value) !== null) {
				cleared.push(value);
				delete (node as Record<string, unknown>)[key];
			} else sweep(value);
		}
	};
	sweep(pkg.payload);
	return cleared;
}

/** Whether a base64 payload decodes to more than the per-asset cap allows.
 * Four base64 characters carry three bytes, so the decoded size is known from
 * the string's length without decoding it. */
function encodedTooLarge(data: string): boolean {
	return Math.floor((data.length * 3) / 4) > MAX_ASSET_BYTES;
}

/**
 * A filename the vault will accept: the asset's own name if it is usable, else
 * one built from its id and type.
 *
 * Both halves are attacker-controlled — a package can say whatever it likes —
 * so both go through {@link plainFileName}. The fallback in particular: it used
 * to interpolate the raw `id`, which a package could set to `../../../evil` and
 * so choose where its file landed. `readPackage` now also holds ids to a strict
 * shape, and `vaultAssetStore.write` refuses a name with a separator; this is
 * the middle of the three, and each stands on its own.
 */
function safeAssetName(asset: PackageAsset): string {
	const cleaned = plainFileName(basenameOf(asset.name));
	const extension = extensionOf(cleaned);
	if (cleaned && extension && MIME_BY_EXTENSION[extension] === asset.mime) {
		return cleaned;
	}
	const stem = plainFileName(basenameOf(asset.id)) || "asset";
	return `${stem}.${EXTENSION_BY_MIME[asset.mime] ?? "png"}`;
}

/** A single path segment with nothing in it that could name another folder:
 * no separator, no drive colon, no leading dots, no shell-hostile characters. */
function plainFileName(value: string): string {
	return value
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/^[.\s]+/, "")
		.trim()
		.slice(0, 96);
}

/** An {@link AssetStore} backed by an Obsidian vault. The only part of the
 * engine that touches the app. */
export function vaultAssetStore(app: App): AssetStore {
	return {
		async read(path) {
			const file = app.vault.getFileByPath(path.trim());
			if (!(file instanceof TFile)) return null;
			try {
				return await app.vault.readBinary(file);
			} catch {
				return null;
			}
		},
		async write(folder, name, data) {
			const dir = folder.replace(/\/+$/, "");
			if (dir) {
				const existing = app.vault.getAbstractFileByPath(dir);
				if (!(existing instanceof TFolder)) {
					// createFolder throws when something raced us to it, which is
					// fine — the write below is what actually has to succeed.
					try {
						await app.vault.createFolder(dir);
					} catch {
						/* already there */
					}
				}
			}
			// The last of the three checks on a package-chosen filename. Nothing
			// should reach here with a separator in it; if something does, this
			// is the point where it would become a path, so it stops here.
			if (/[\\/]/.test(name) || name.startsWith(".")) {
				throw new Error("unsafe asset filename");
			}
			let path = dir ? `${dir}/${name}` : name;
			// Never overwrite: a second import of the same package should not
			// clobber a picture the first one wrote and a board still points at.
			if (app.vault.getAbstractFileByPath(path)) {
				const dot = name.lastIndexOf(".");
				const stem = dot > 0 ? name.slice(0, dot) : name;
				const extension = dot > 0 ? name.slice(dot) : "";
				for (let n = 1; n < 1000; n++) {
					const candidate = dir
						? `${dir}/${stem}-${n}${extension}`
						: `${stem}-${n}${extension}`;
					if (!app.vault.getAbstractFileByPath(candidate)) {
						path = candidate;
						break;
					}
				}
			}
			await app.vault.createBinary(path, data);
			return path;
		},
		encode: arrayBufferToBase64,
		decode: base64ToArrayBuffer,
	};
}
