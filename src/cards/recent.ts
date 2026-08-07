import { setIcon, Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { addResetButton } from "../editors";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { FILE_TYPE_GROUPS, fileTypeLabel, FOLDERS_GROUP_ID, groupForFile } from "../filetypes";
import { t } from "../i18n";
import { openFile } from "../opener";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


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
	const icons = fileIconOptions(view.plugin.settings);
	for (const file of files) {
		const row = list.createDiv("hearth-list-item");
		applyFileIcon(row.createDiv("hearth-list-icon"), resolveFileIcon(view.app, file, icons));
		row.createDiv({ cls: "hearth-list-label", text: file.basename });
		const open = () => void openFile(view, file, "card");
		row.addEventListener("click", open);
		makeClickable(row, open, file.basename);
	}
}


export function recentEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;
	const recent = new Setting(containerEl)
		.setName(t().editors.recent.count)
		.setDesc(t().editors.recent.countDesc);
	recent.addText((txt) => {
		txt.setValue(String(card.count ?? 8)).onChange((v) => {
			const n = parseInt(v, 10);
			card.count = Number.isNaN(n) ? undefined : n;
			ctx.opts.save();
		});
		txt.inputEl.type = "number";
		txt.inputEl.addClass("hearth-count-input");
	});
	addResetButton(ctx, recent, t().settings.resetField, () => {
		card.count = undefined;
	});
	recentTypesEditor(ctx, containerEl, card);
}


/** File-type filter for the recent-files card: a row of toggleable chips
 * mirroring the search filter's types. Any combination may be selected; an
 * empty selection means every type is shown. */
export function recentTypesEditor(ctx: CardEditorContext, containerEl: HTMLElement, card: DashboardCard): void {
	const setting = new Setting(containerEl)
		.setName(t().editors.recent.types)
		.setDesc(t().editors.recent.typesDesc);
	addResetButton(ctx, setting, t().settings.resetField, () => {
		card.recentTypes = undefined;
	});

	const selected = new Set(card.recentTypes ?? []);
	const row = containerEl.createDiv("hearth-type-filter");
	// Folders can never appear among recently-opened files, so offer every
	// search-filter type except that one.
	const groups = FILE_TYPE_GROUPS.filter((g) => g.id !== FOLDERS_GROUP_ID);
	for (const group of groups) {
		const chip = row.createDiv("hearth-type-filter-chip");
		chip.toggleClass("is-active", selected.has(group.id));
		setIcon(chip.createDiv("hearth-type-filter-icon"), group.icon);
		chip.createDiv({ cls: "hearth-type-filter-label", text: fileTypeLabel(group) });
		chip.setAttribute("role", "button");
		chip.setAttribute("tabindex", "0");
		chip.setAttribute("aria-pressed", String(selected.has(group.id)));
		const toggle = () => {
			if (selected.has(group.id)) selected.delete(group.id);
			else selected.add(group.id);
			const on = selected.has(group.id);
			chip.toggleClass("is-active", on);
			chip.setAttribute("aria-pressed", String(on));
			card.recentTypes = selected.size > 0 ? Array.from(selected) : undefined;
			ctx.opts.save();
			ctx.opts.rerender();
		};
		chip.addEventListener("click", toggle);
		chip.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		});
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
