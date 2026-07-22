import { getAllTags, setIcon, TFile, TFolder } from "obsidian";
import { dailyNotePath, dailyNotesOptions, moment, type Moment } from "../cardbodies";
import { statsEditor } from "../editors";
import { fileTypeLabel, groupById, groupForFile } from "../filetypes";
import { t } from "../i18n";
import { countQuery } from "../query";
import { DEFAULT_STATS, STAT_ICONS, type DashboardCard, type StatId } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Vault statistics -----------------------------------------------------

/** Cheap vault stats — the counts here come from the already-loaded vault index
 * and metadata cache, never a file read, so it's fast even on large vaults.
 *
 * With no advanced config the card shows its fixed default set. When the card's
 * `stats.advanced` flag is on the user picks which built-in stats appear, breaks
 * attachments out into per file-type tiles, and adds custom query counts. */
export function renderStats(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.stats;
	const advanced = cfg?.advanced ?? false;
	const vault = view.app.vault;

	let notes = 0;
	let attachments = 0;
	let folders = 0;
	// Oldest file creation time across the whole vault — the "days using Obsidian"
	// stat counts from here. Infinity so the first file always wins the min.
	let oldestCtime = Infinity;
	// Single pass over the loaded files: counts plus the tag set (collected
	// inline for markdown files) instead of a second full getMarkdownFiles scan.
	// Per-file-type-group counts feed the advanced attachment breakdown.
	const tags = new Set<string>();
	const byType = new Map<string, number>();
	for (const f of vault.getAllLoadedFiles()) {
		if (f instanceof TFolder) {
			if (f.path !== "/") folders++;
		} else if (f instanceof TFile) {
			if (f.extension.toLowerCase() === "md") {
				notes++;
				const cache = view.app.metadataCache.getFileCache(f);
				if (cache) {
					for (const t of getAllTags(cache) ?? []) tags.add(t.toLowerCase());
				}
			} else {
				attachments++;
			}
			if (f.stat.ctime > 0 && f.stat.ctime < oldestCtime) oldestCtime = f.stat.ctime;
			if (advanced) {
				const group = groupForFile(f);
				if (group) byType.set(group.id, (byType.get(group.id) ?? 0) + 1);
			}
		}
	}

	// Whole days between the oldest file's creation and now (0 for an empty vault
	// or one created today), so the tile reads as a tenure counter.
	const daysUsing = Number.isFinite(oldestCtime)
		? Math.max(0, Math.floor((Date.now() - oldestCtime) / 86_400_000))
		: 0;

	const values: Record<StatId, number> = {
		notes,
		attachments,
		folders,
		tags: tags.size,
		dayStreak: 0,
		daysUsing,
	};
	const streak = dailyNoteStreak(view);

	const grid = body.createDiv("hearth-stats");

	const builtins = advanced && cfg?.builtins ? cfg.builtins : DEFAULT_STATS;
	for (const id of builtins) {
		// The day-streak tile only appears when daily notes are configured — same
		// as it always has — whether or not it's explicitly selected.
		if (id === "dayStreak") {
			if (streak !== null) addStat(grid, STAT_ICONS.dayStreak, streak, t().cards.stats.dayStreak);
			continue;
		}
		addStat(grid, STAT_ICONS[id], values[id], t().cards.stats[id]);
	}

	if (!advanced) return;

	// Attachment breakdown: one tile per selected file-type group.
	for (const groupId of cfg?.attachmentTypes ?? []) {
		const group = groupById(groupId);
		if (!group) continue;
		addStat(grid, group.icon, byType.get(groupId) ?? 0, fileTypeLabel(group));
	}

	// Custom query counts.
	for (const q of cfg?.queries ?? []) {
		const query = q.query?.trim();
		if (!query) continue;
		addStat(grid, q.icon?.trim() || "hash", countQuery(view.app, query), q.label?.trim() || query);
	}
}


function addStat(grid: HTMLElement, icon: string, value: number, label: string): void {
	const cell = grid.createDiv("hearth-stat");
	setIcon(cell.createDiv("hearth-stat-icon"), icon);
	cell.createDiv({ cls: "hearth-stat-value", text: String(value) });
	cell.createDiv({ cls: "hearth-stat-label", text: label });
}


/** Consecutive days with an existing daily note, counting back from today —
 * or from yesterday if today's isn't written yet, so an otherwise-unbroken
 * streak doesn't read as zero just because the day isn't over. */
function dailyNoteStreak(view: HomeView): number | null {
	const options = dailyNotesOptions(view);
	if (!options) return null;

	let day: Moment = moment();
	if (!(view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile)) {
		day = day.clone().subtract(1, "day");
	}

	let streak = 0;
	while (view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile) {
		streak++;
		day = day.clone().subtract(1, "day");
		if (streak > 3650) break;
	}
	return streak;
}

/** Vault statistics: note/word counts, attachment breakdown, custom queries. */
export const statsCard: CardDefinition<"stats"> = {
	kind: "stats",
	templates: [
		{ id: "stats", name: "Vault statistics", icon: "bar-chart-3", build: () => ({ kind: "stats", title: "Stats", w: 4, h: 2 }) },
	],
	render: (view, card, body) => renderStats(view, card, body),
	renderEditor: (container, ctx) => statsEditor(ctx, container),
	cloneConfig: (source, copy) => {
		if (source.stats)
			copy.stats = {
				...source.stats,
				builtins: source.stats.builtins ? [...source.stats.builtins] : undefined,
				attachmentTypes: source.stats.attachmentTypes ? [...source.stats.attachmentTypes] : undefined,
				queries: source.stats.queries ? source.stats.queries.map((q) => ({ ...q })) : undefined,
			};
	},
	liveness: { mode: "vault" },
};
