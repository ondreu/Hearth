import { type Component, debounce, setIcon, Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { addResetButton } from "../editors";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { FILE_TYPE_GROUPS, fileTypeLabel, FOLDERS_GROUP_ID, groupForFile } from "../filetypes";
import { t } from "../i18n";
import { openFile } from "../opener";
import {
	clampRecentCount,
	RECENT_COUNT_DEFAULT,
	RECENT_COUNT_MIN,
	RECENT_HISTORY_MAX,
	recentFilePaths,
	rowsThatFit,
} from "../recentfiles";
import { type DashboardCard } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Recent files -------------------------------------------------------

export function renderRecent(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component?: Component,
): void {
	// "Fit to card height" asks for everything Hearth remembers and then hides
	// whatever doesn't fit, so the row count follows the card's size. A fixed
	// count is clamped to what the history can actually hold, so the card shows
	// the number the editor accepted (#228).
	const auto = card.recentAuto === true;
	const count = auto ? RECENT_HISTORY_MAX : clampRecentCount(card.count);
	// Optional file-type filter: keep only files whose group is selected. An
	// empty/undefined list means no filtering (show every type). The filter is
	// applied before the count is capped, so the card shows the N most recent
	// files of the chosen types rather than the N most recent overall.
	const types = card.recentTypes && card.recentTypes.length > 0 ? new Set(card.recentTypes) : null;
	const files = recentFilePaths(view.app)
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

	if (auto) fitRowsToBody(body, list, component);
}


/**
 * Hide the rows that don't fit the card's current height, and keep doing so as
 * the card is resized.
 *
 * Measured rather than calculated: a row's height depends on the theme's font
 * size and Obsidian's icon scale, so the only honest source is the row the
 * browser actually laid out. Every row is un-hidden before each measurement so
 * the step is read from a real pair of rows rather than from a remembered one,
 * which keeps the fit correct after a font or theme change too.
 */
function fitRowsToBody(body: HTMLElement, list: HTMLElement, component?: Component): void {
	const rows = Array.from(list.children).filter((el): el is HTMLElement =>
		el.instanceOf(HTMLElement),
	);
	if (rows.length === 0) return;

	const fit = () => {
		if (!list.isConnected) return;
		for (const row of rows) row.removeClass("hearth-list-item-clipped");
		// Rows are measured against the viewport, so a body left scrolled would
		// read the list as starting higher than it does. Nothing is meant to
		// scroll in this mode anyway — the whole point is that the list stops at
		// the card's edge.
		body.scrollTop = 0;
		const first = rows[0].getBoundingClientRect();
		const step = rows.length > 1
			? rows[1].getBoundingClientRect().top - first.top
			: first.height;
		const padBottom = parseFloat(getComputedStyle(body).paddingBottom) || 0;
		const available = body.getBoundingClientRect().bottom - padBottom - first.top;
		const visible = rowsThatFit(available, first.height, Math.max(0, step - first.height));
		for (let i = visible; i < rows.length; i++) rows[i].addClass("hearth-list-item-clipped");
	};

	// Fit before the first paint, so a tall card never flashes its full list and
	// then snaps back, then follow every resize of the card.
	window.requestAnimationFrame(fit);
	const observer = new ResizeObserver(debounce(fit, 60, true));
	observer.observe(body);
	// Without a component to hang it on (a caller that renders the card outside
	// the dashboard's lifecycle) the observer is dropped on the next render with
	// the element it watched; the initial fit still applies.
	component?.register(() => observer.disconnect());
}


export function recentEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	const card = ctx.card;

	// Fit-to-height and a fixed count are the same decision, so only one of them
	// is on screen at a time.
	const fit = new Setting(containerEl)
		.setName(t().editors.recent.fit)
		.setDesc(t().editors.recent.fitDesc);
	fit.addToggle((tg) => {
		tg.setValue(card.recentAuto === true).onChange((v) => {
			card.recentAuto = v ? true : undefined;
			ctx.opts.save();
			ctx.requestRender();
		});
	});

	if (card.recentAuto !== true) {
		const recent = new Setting(containerEl)
			.setName(t().editors.recent.count)
			.setDesc(t().editors.recent.countDesc(RECENT_HISTORY_MAX));
		recent.addText((txt) => {
			txt.setValue(String(card.count ?? RECENT_COUNT_DEFAULT)).onChange((v) => {
				const n = parseInt(v, 10);
				// Clamped on the way in, not on the way out: a card must never store
				// a number it cannot honour, or the setting silently means something
				// other than what it says (#228).
				card.count = Number.isNaN(n) ? undefined : clampRecentCount(n);
				ctx.opts.save();
			});
			txt.inputEl.type = "number";
			txt.inputEl.min = String(RECENT_COUNT_MIN);
			txt.inputEl.max = String(RECENT_HISTORY_MAX);
			txt.inputEl.addClass("hearth-count-input");
		});
		addResetButton(ctx, recent, t().settings.resetField, () => {
			card.count = undefined;
		});
	}

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
	render: (view, card, body, component) => renderRecent(view, card, body, component),
	renderEditor: (container, ctx) => recentEditor(ctx, container),
	liveness: { mode: "static" },
};
