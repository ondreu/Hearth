import { setIcon, Setting, TFile } from "obsidian";
import { emptyState } from "../cardbodies";
import { moveItem } from "../editors";
import { applyFileIcon, fileIconOptions, resolveFileIcon } from "../fileicons";
import { t } from "../i18n";
import { FilePickerModal } from "../pickers";
import { makeClickable } from "../ui";
import { type HomeView } from "../view";
import { type CardDefinition, type CardEditorContext } from "./definition";


// ---- Favorites (curated note cards) ------------------------------------

export function renderFavorites(view: HomeView, body: HTMLElement): void {
	const paths = view.plugin.settings.favorites;
	if (!paths.length) {
		emptyState(body, "star", t().cards.empty.favoritesEmpty);
		return;
	}

	const grid = body.createDiv("hearth-favorites");
	const icons = fileIconOptions(view.plugin.settings);
	for (const path of paths) {
		const file = view.app.vault.getAbstractFileByPath(path);
		const card = grid.createDiv("hearth-fav-card");
		if (file instanceof TFile) {
			applyFileIcon(card.createDiv("hearth-fav-icon"), resolveFileIcon(view.app, file, icons));
			card.createDiv({ cls: "hearth-fav-name", text: file.basename });
			const open = () => void view.app.workspace.getLeaf(true).openFile(file);
			card.addEventListener("click", open);
			makeClickable(card, open, file.basename);
		} else {
			card.addClass("is-missing");
			setIcon(card.createDiv("hearth-fav-icon"), "file-x");
			card.createDiv({ cls: "hearth-fav-name", text: path });
		}
	}
}


export function favoritesEditor(ctx: CardEditorContext, containerEl: HTMLElement): void {
	new Setting(containerEl)
		.setName(t().editors.favorites.heading)
		.setDesc(t().editors.favorites.headingDesc)
		.setHeading();
	const favorites = ctx.opts.favorites;

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

/** The user's starred notes (a Hearth-global list). */
export const favoritesCard: CardDefinition<"favorites"> = {
	kind: "favorites",
	templates: [
		{ id: "favorites", name: "Favorites", icon: "star", build: () => ({ kind: "favorites", title: "Favorites", w: 4, h: 3 }) },
	],
	render: (view, _card, body) => renderFavorites(view, body),
	renderEditor: (container, ctx) => favoritesEditor(ctx, container),
	liveness: { mode: "static" },
};
