import { setIcon, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { recentEditor } from "../editors";
import { groupForFile, iconForFile } from "../filetypes";
import { t } from "../i18n";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition } from "./definition";


// ---- Recent files -------------------------------------------------------

export function renderRecent(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const count = card.count && card.count > 0 ? card.count : 8;
	// Optional file-type filter: keep only files whose group is selected. An
	// empty/undefined list means no filtering (show every type). The filter is
	// applied before the count is capped, so the card shows the N most recent
	// files of the chosen types rather than the N most recent overall.
	const types = card.recentTypes && card.recentTypes.length > 0 ? new Set(card.recentTypes) : null;
	const files = view.app.workspace
		.getLastOpenFiles()
		.map((p) => view.app.vault.getAbstractFileByPath(p))
		.filter((f): f is TFile => f instanceof TFile)
		.filter((f) => {
			if (!types) return true;
			const group = groupForFile(f);
			return group != null && types.has(group.id);
		})
		.slice(0, count);

	if (files.length === 0) {
		emptyState(body, "history", t().cards.empty.recentEmpty);
		return;
	}

	const list = body.createDiv("hearth-list");
	for (const file of files) {
		const row = list.createDiv("hearth-list-item");
		setIcon(row.createDiv("hearth-list-icon"), iconForFile(file));
		row.createDiv({ cls: "hearth-list-label", text: file.basename });
		const open = () => void view.app.workspace.getLeaf(true).openFile(file);
		row.addEventListener("click", open);
		makeClickable(row, open, file.basename);
	}
}

/** Recently opened files, filtered by type. */
export const recentCard: CardDefinition<"recent"> = {
	kind: "recent",
	templates: [
		{ id: "recent", name: "Recent files", icon: "history", build: () => ({ kind: "recent", title: "Recent", count: 8, w: 4, h: 3 }) },
	],
	render: (view, card, body) => renderRecent(view, card, body),
	renderEditor: (container, ctx) => recentEditor(ctx, container),
	liveness: { mode: "static" },
};
