import { type App, parseYaml, TFile } from "obsidian";

export interface BaseViewOption {
	name: string;
	/** Whether the view name can be appended directly as a wikilink subpath. */
	embeddable: boolean;
}

export interface BaseViewListResult {
	views: BaseViewOption[];
	error?: "not-found" | "invalid-yaml" | "read-failed";
}

/** Whether an embed target points at a Bases (.base) file. */
export function isBaseTarget(target: string | undefined): boolean {
	return !!target && target.trim().toLowerCase().endsWith(".base");
}

/** Keep view names that would make an ambiguous or broken wikilink out of the
 * generated `![[file.base#View]]` syntax out of persisted/generated embeds. */
export function isEmbeddableBaseViewName(name: string | undefined): boolean {
	const value = name?.trim();
	return !!value && !/[#|\]\r\n]/.test(value);
}

/** Read a `.base` file and list its declared views in document order. Uses only
 * public Vault APIs plus Obsidian's YAML parser; any malformed or missing data
 * degrades to an empty list instead of breaking the settings modal. */
export async function listBaseViews(app: App, target: string | undefined): Promise<BaseViewListResult> {
	const path = target?.trim();
	if (!path || !isBaseTarget(path)) return { views: [] };

	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile) || file.extension.toLowerCase() !== "base") {
		return { views: [], error: "not-found" };
	}

	let parsed: unknown;
	try {
		const raw = await app.vault.cachedRead(file);
		parsed = parseYaml(raw) as unknown;
	} catch {
		return { views: [], error: "invalid-yaml" };
	}

	if (!parsed || typeof parsed !== "object") return { views: [] };
	const viewsRaw = (parsed as Record<string, unknown>).views;
	if (!Array.isArray(viewsRaw)) return { views: [] };

	const seen = new Set<string>();
	const views: BaseViewOption[] = [];
	for (const rawView of viewsRaw) {
		if (!rawView || typeof rawView !== "object") continue;
		const name = (rawView as Record<string, unknown>).name;
		if (typeof name !== "string") continue;
		const trimmed = name.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		views.push({ name: trimmed, embeddable: isEmbeddableBaseViewName(trimmed) });
	}
	return { views };
}
