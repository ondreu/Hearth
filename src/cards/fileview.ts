import { type Component, debounce, Setting, TFile } from "obsidian";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { fileLabel } from "../filelabel";
import { explorerTitles } from "../frontmattertitle";
import { setIcon } from "../glyphs";
import { openFile } from "../opener";
import { rowsThatFit } from "../recentfiles";
import type { DashboardCard, FileView } from "../types";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardEditorContext } from "./definition";


// ---- A card's files, as a list or as tiles (#358) -----------------------

/** How `card` draws its files. Undefined is each kind's historic look — tiles
 * for favourites, a list for recent files — so a board nobody touched looks the
 * way it did before the choice existed. */
export function fileViewFor(card: DashboardCard): FileView {
	return card.fileView ?? (card.kind === "favorites" ? "tiles" : "list");
}

/** One entry of the card: a file to open, or a path that no longer resolves
 * (a favourite whose note was moved or deleted), drawn greyed out. */
export type FileItem = { file: TFile } | { missing: string };

/**
 * Draw `items` into `body` in the card's chosen view and return the container,
 * whose children are the rows or tiles in order.
 *
 * Both views are the ones the rest of the dashboard already uses: the list is
 * the recent-files/bookmarks/saved-search row, the tiles the favourites card's
 * grid. Nothing new to style, and nothing that looks like it belongs to a
 * different plugin.
 */
export function renderFileItems(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	items: FileItem[],
): HTMLElement {
	const tiles = fileViewFor(card) === "tiles";
	const container = body.createDiv(tiles ? "hearth-favorites" : "hearth-list");
	const cls = tiles
		? { item: "hearth-fav-card", icon: "hearth-fav-icon", label: "hearth-fav-name" }
		: { item: "hearth-list-item", icon: "hearth-list-icon", label: "hearth-list-label" };
	const icons = fileIconOptions(view.plugin.settings);
	// The row's name, once for the whole list: the card's property (#399), else
	// the title the file explorer shows, else the file name.
	const label = fileLabel(view.app, card, explorerTitles(view.app, view.plugin.settings));
	for (const item of items) {
		const el = container.createDiv(cls.item);
		if ("file" in item) {
			const file = item.file;
			const text = label(file);
			applyFileIcon(el.createDiv(cls.icon), resolveFileIcon(view.app, file, icons));
			el.createDiv({ cls: cls.label, text });
			const open = () => void openFile(view, file, "card");
			el.addEventListener("click", open);
			makeClickable(el, open, text);
		} else {
			el.addClass("is-missing");
			setIcon(el.createDiv(cls.icon), "file-x");
			el.createDiv({ cls: cls.label, text: item.missing });
		}
	}
	return container;
}


/**
 * Hide the rows or tiles that don't fit the card's current height, and keep
 * doing so as the card is resized.
 *
 * Measured rather than calculated: a row's height depends on the theme's font
 * size and Obsidian's icon scale, so the only honest source is the element the
 * browser actually laid out. Everything is un-hidden before each measurement so
 * the step is read from a real pair of rows rather than from a remembered one,
 * which keeps the fit correct after a font or theme change too.
 *
 * Tiles are the same sum on a grid: the columns are however many tiles share
 * the first one's line, and every row that fits holds that many.
 */
export function fitItemsToBody(body: HTMLElement, container: HTMLElement, component?: Component): void {
	const items = Array.from(container.children).filter((el): el is HTMLElement =>
		el.instanceOf(HTMLElement),
	);
	if (items.length === 0) return;
	const isList = container.hasClass("hearth-list");

	const fit = () => {
		if (!container.isConnected) return;
		for (const item of items) item.removeClass("hearth-list-item-clipped", "is-last-unclipped");
		// Items are measured against the viewport, so a body left scrolled would
		// read the container as starting higher than it does. Nothing is meant to
		// scroll in this mode anyway — the whole point is that it stops at the
		// card's edge.
		body.scrollTop = 0;
		const first = items[0].getBoundingClientRect();
		let columns = 1;
		while (columns < items.length && items[columns].getBoundingClientRect().top === first.top) columns++;
		const step = columns < items.length
			? items[columns].getBoundingClientRect().top - first.top
			: first.height;
		const padBottom = parseFloat(getComputedStyle(body).paddingBottom) || 0;
		const available = body.getBoundingClientRect().bottom - padBottom - first.top;
		const visible = rowsThatFit(available, first.height, Math.max(0, step - first.height)) * columns;
		for (let i = visible; i < items.length; i++) items[i].addClass("hearth-list-item-clipped");
		// The last row still showing closes the group, as the list's last row would.
		if (isList && visible > 0 && visible < items.length) items[visible - 1].addClass("is-last-unclipped");
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


/** The list/tiles switch, shared by both editors so it reads the same in each. */
export function fileViewSetting(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	strings: { display: string; displayDesc: string; displayList: string; displayTiles: string },
): void {
	new Setting(containerEl)
		.setName(strings.display)
		.setDesc(strings.displayDesc)
		.addDropdown((d) => {
			d.addOption("list", strings.displayList);
			d.addOption("tiles", strings.displayTiles);
			d.setValue(fileViewFor(ctx.card)).onChange((v) => {
				// Stored even when it matches the kind's default, so the card keeps
				// what the user picked if that default ever moves.
				ctx.card.fileView = v === "tiles" ? "tiles" : "list";
				ctx.opts.save();
				ctx.opts.rerender();
			});
		});
}


/** The strings {@link displayTitleSetting} needs; both file-list editors pass
 * their own copy of the same three labels. */
export interface TitlePropertyStrings {
	titleAdvanced: string;
	titleAdvancedDesc: string;
	titleProperty: string;
	titlePropertyDesc: string;
	titlePropertyPlaceholder: string;
}

/**
 * Naming a note from a frontmatter property (#399), behind an Advanced toggle
 * like the heatmap card's custom metric: a vault that doesn't need it never
 * meets the question, and one that does finds a single field once it opts in.
 *
 * The toggle *is* the card field — on means "there is a property to read", kept
 * with an empty value until something is typed, so the state the dialog shows is
 * the state the card draws. Turning it off drops the property, because a card
 * that shows file names while a name is stored behind it is the kind of setting
 * people find years later and can't explain.
 */
export function displayTitleSetting(
	ctx: CardEditorContext,
	containerEl: HTMLElement,
	strings: TitlePropertyStrings,
): void {
	const on = ctx.card.titleProperty !== undefined;
	new Setting(containerEl)
		.setName(strings.titleAdvanced)
		.setDesc(strings.titleAdvancedDesc)
		.addToggle((tg) =>
			tg.setValue(on).onChange((v) => {
				if (v) ctx.card.titleProperty ??= "";
				else delete ctx.card.titleProperty;
				ctx.opts.save();
				ctx.opts.rerender();
				// Show/hide the property field below.
				ctx.requestRender();
			}),
		);
	if (!on) return;
	new Setting(containerEl)
		.setName(strings.titleProperty)
		.setDesc(strings.titlePropertyDesc)
		.addText((txt) =>
			txt
				.setPlaceholder(strings.titlePropertyPlaceholder)
				.setValue(ctx.card.titleProperty ?? "")
				// Saved on every keystroke so the card behind the dialog follows
				// along; the dialog itself is not rebuilt, which would take the
				// caret with it.
				.onChange((v) => {
					ctx.card.titleProperty = v;
					ctx.opts.save();
					ctx.opts.rerender();
				}),
		);
}

