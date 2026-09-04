import { setIcon, Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { moveItem } from "../editors";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { t } from "../i18n";
import { openFile } from "../opener";
import { FilePickerModal } from "../pickers";
import { makeClickable } from "../ui";
import type { DashboardCard } from "../types";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Favorites (curated note cards) ------------------------------------

/** The list this card shows: its own, when it has one, and the vault's
 * otherwise. See `DashboardCard.favorites` — an imported board carries its
 * author's list on the card so it arrives looking like theirs. */
export function favoritesFor(view: HomeView, card: DashboardCard): string[] {
	return card.favorites ?? view.plugin.settings.favorites;
}

export function renderFavorites(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
): void {
	const paths = favoritesFor(view, card);
	if (!paths.length) {
		emptyState(body, "star", t().cards.empty.favoritesEmpty);
		return;
	}

	const grid = body.createDiv("hearth-favorites");
	const icons = fileIconOptions(view.plugin.settings);
	for (const path of paths) {
		const file = view.app.vault.getAbstractFileByPath(path);
		const tile = grid.createDiv("hearth-fav-card");
		if (file instanceof TFile) {
			applyFileIcon(tile.createDiv("hearth-fav-icon"), resolveFileIcon(view.app, file, icons));
			tile.createDiv({ cls: "hearth-fav-name", text: file.basename });
			const open = () => void openFile(view, file, "card");
			tile.addEventListener("click", open);
			makeClickable(tile, open, file.basename);
		} else {
			tile.addClass("is-missing");
			setIcon(tile.createDiv("hearth-fav-icon"), "file-x");
			tile.createDiv({ cls: "hearth-fav-name", text: path });
		}
	}
}


/**
 * The favourites editor, which edits one of two lists.
 *
 * Normally it edits the vault's, which is what a favourites card has always
 * shown and what every favourites card in the vault shares. A card that came in
 * with a board from somewhere else carries its author's list instead (see
 * `DashboardCard.favorites`), and then this edits *that* — because a list the
 * card shows and an editor that changes a different list is the kind of thing
 * nobody works out on their own.
 *
 * The row at the top says which, and switches between them: adopting the
 * vault's list drops the card's own, and taking the card's own seeds it from
 * whatever it is showing now, so neither direction loses what is on screen.
 */
export function favoritesEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	new Setting(containerEl)
		.setName(t().editors.favorites.heading)
		.setDesc(t().editors.favorites.headingDesc)
		.setHeading();

	const own = ctx.card.favorites !== undefined;
	new Setting(containerEl)
		.setName(t().editors.favorites.ownList)
		.setDesc(own ? t().editors.favorites.ownListOn : t().editors.favorites.ownListOff)
		.addToggle((tg) =>
			tg.setValue(own).onChange((v) => {
				if (v) ctx.card.favorites = [...ctx.opts.favorites];
				else delete ctx.card.favorites;
				ctx.opts.save();
				ctx.requestRender();
				ctx.opts.rerender();
			}),
		);

	const favorites = ctx.card.favorites ?? ctx.opts.favorites;

	favorites.forEach((path, index) => {
		new Setting(containerEl)
			.setName(path)
			.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().editors.favorites.moveUp)
					.setDisabled(index === 0)
					.onClick(() => moveItem(ctx, favorites, index, index - 1)),
			)
			.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().editors.favorites.moveDown)
					.setDisabled(index === favorites.length - 1)
					.onClick(() => moveItem(ctx, favorites, index, index + 1)),
			)
			.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().editors.favorites.remove)
					.onClick(() => {
						favorites.splice(index, 1);
						ctx.opts.save();
						ctx.requestRender();
					}),
			);
	});

	new Setting(containerEl).addButton((b) =>
		b.setButtonText(t().editors.favorites.addFavorite).onClick(() => {
			new FilePickerModal(
				ctx.app,
				(file) => {
					if (!favorites.includes(file.path)) {
						favorites.push(file.path);
						ctx.opts.save();
						ctx.requestRender();
					}
				},
				t().pickers.noteToFavorite,
			).open();
		}),
	);
}

/** The user's starred notes: the vault-wide list, or this card's own when an
 * import gave it one. */
export const favoritesCard: CardDefinition<"favorites"> = {
	kind: "favorites",
	templates: [
		{ id: "favorites", name: "Favorites", icon: "star", build: () => ({ kind: "favorites", title: "Favorites", w: 4, h: 3 }) },
	],
	render: (view, card, body) => renderFavorites(view, card, body),
	cloneConfig: (source, copy) => {
		if (source.favorites) copy.favorites = [...source.favorites];
	},
	renderEditor: (container, ctx) => favoritesEditor(ctx, container),
	liveness: { mode: "static" },
};
